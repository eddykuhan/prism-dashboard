# Plan: Kubernetes Pods Monitoring — Final Implementation

Integrate Kubernetes pod monitoring into Prism with in-cluster or out-of-cluster API authentication from environment variables, 30-second background polling with status-based color mapping, date-fns relative timestamps, skeleton loader, and error state display.

## Steps

1. **Create Kubernetes DTOs and Models** — Define:
   - `KubernetesPod`: name, namespace, status (Running/Pending/Failed/Succeeded), ready (e.g., "2/3"), restarts, created_at, image
   - `KubernetesOptions`: apiUrl, token, namespaces (comma-separated or array), insecureSkipVerify (for self-signed certs)
   - `KubernetesPollingState`: pods[], lastFetchTime, error?, isLoading

2. **Register Kubernetes config in [Program.cs](otel-dashboard-api/Program.cs)** — Read `K8S_API_URL`, `K8S_TOKEN`, `K8S_NAMESPACES`, `K8S_INSECURE_SKIP_VERIFY` from environment; validate at least `K8S_API_URL` and `K8S_NAMESPACES` set at startup (throw `InvalidOperationException` if missing); `K8S_TOKEN` defaults to in-cluster service account token if not set (reads from `/var/run/secrets/kubernetes.io/serviceaccount/token`); register `KubernetesOptions` in DI.

3. **Create `KubernetesService.cs` in [Services/](otel-dashboard-api/Services/)** — Inject `IConfiguration`, `IHttpClientFactory`, `ILogger`; implement `GetPodsAsync(cancellationToken)`:
   - Add Authorization header: `Authorization: Bearer {K8S_TOKEN}`
   - For each namespace in `K8S_NAMESPACES`, query `/api/v1/namespaces/{namespace}/pods`
   - Extract fields: metadata.name, metadata.namespace, status.phase, status.conditions (ready), status.containerStatuses[].restartCount, metadata.creationTimestamp, spec.containers[0].image
   - Merge results from all namespaces, filter out completed pods (optional: exclude status=Succeeded), sort by creation timestamp descending, return top 30
   - Throw exception on auth/network errors (error stored, not retried immediately)

4. **Create `KubernetesPollingService.cs` in [Services/](otel-dashboard-api/Services/)** — Register as `IHostedService`; background task executes every 30 seconds:
   - Call `KubernetesService.GetPodsAsync()`
   - **Success**: Update `InMemoryStore` with pods + timestamp, broadcast `"kubernetes_pods"` via `WebSocketStreamService`, clear error, set `isLoading=false`
   - **Failure**: Capture error message in `InMemoryStore`, broadcast `"kubernetes_error"`, keep previous pods cached, set `isLoading=false` (wait 30s for next retry)
   - Initial state: `isLoading=true` until first poll completes

5. **Add `KubernetesController.cs` in [Controllers/](otel-dashboard-api/Controllers/)** — Implement `[HttpGet("api/v1/kubernetes/pods")]`:
   - Returns `KubernetesPollingState` from `InMemoryStore`: pods[], lastFetchTime, error?, isLoading
   - Returns 200 OK regardless of polling state (frontend handles display logic)

6. **Create frontend service [kubernetes.service.ts](otel-dashboard-frontend/src/app/core/services/)** — Inject `HttpClient`, `WebSocketService`; expose `state$: Observable<KubernetesPollingState>`:
   - Initial HTTP fetch from `/api/v1/kubernetes/pods`
   - Subscribe to WebSocket `"kubernetes_pods"` and `"kubernetes_error"` events
   - Use `merge()` + `scan()` to accumulate updates into state stream

7. **Build Kubernetes Pods widget component** — Standalone in [features/kubernetes-pods/](otel-dashboard-frontend/src/app/features/):
   - **Loading state** (isLoading=true): Display 10-row skeleton table
   - **Error state** (error exists): Red alert box with error message, timestamp, info text "Retrying in 30 seconds"
   - **Data state**: Table with columns:
     - **Pod**: Pod name, left-aligned, clickable (opens pod logs or details view)
     - **Namespace**: Namespace name, smaller text
     - **Status**: Color badge (Running=green, Pending=yellow, Failed=red, Succeeded=gray, other=gray)
     - **Ready**: e.g., "2/3" badge, red if false
     - **Restarts**: Numeric badge, red if >0
     - **Image**: Truncate to 50 chars, monospace font, smaller text
     - **Age**: Use `date-fns` `formatDistanceToNow(date)` → "5 minutes ago"
   - Sort table by creation timestamp descending (newest first)
   - Optional: Filter by namespace dropdown

8. **Update [ConfigController.GetConfig()](otel-dashboard-api/Controllers/ConfigController.cs)** — Add `kubernetesEnabled: bool` based on `K8S_API_URL` presence.

9. **Add widget to dashboard** — Insert Kubernetes Pods widget component into navigation/sidebar; conditionally show based on `kubernetesEnabled` from config endpoint.

## Implementation Details

### Error Recovery Flow
- Poll attempt fails (auth 403, connection refused, invalid token, etc.) → Error stored, user sees alert
- Next scheduled 30-second poll automatically retries → No exponential backoff, no manual retry button
- On success, error cleared and widget shows data

### Status Color Mapping
```
if (status === 'Running') → green
else if (status === 'Pending') → yellow
else if (status === 'Failed') → red
else if (status === 'Succeeded' || status === 'Completed') → gray
else → gray
```

### Ready Status Color
```
if (pod.ready === true) → green checkmark
else → red X or badge showing "0/3"
```

### Date Format
`formatDistanceToNow(new Date(created_at), { addSuffix: true })` → "5 minutes ago"

## Environment Variables Required

```bash
K8S_API_URL=https://kubernetes.default.svc.cluster.local:443
K8S_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # Optional, defaults to in-cluster
K8S_NAMESPACES=default,kube-system,monitoring
K8S_INSECURE_SKIP_VERIFY=false  # Set to true for self-signed certs (dev only)
```

## In-Cluster vs Out-of-Cluster Authentication

### In-Cluster (Recommended for Production)
- Kubernetes automatically mounts service account token at `/var/run/secrets/kubernetes.io/serviceaccount/token`
- Set `K8S_API_URL=https://kubernetes.default.svc.cluster.local:443`
- Omit `K8S_TOKEN` or leave empty
- Service: Auto-reads token from mounted file

### Out-of-Cluster (Development)
- `K8S_API_URL=https://your-cluster-api:6443` (from kubeconfig)
- `K8S_TOKEN=<bearer-token>` (from kubeconfig or `kubectl create token`)
- Optional: `K8S_INSECURE_SKIP_VERIFY=true` for self-signed certificates

### RBAC Permissions Required
```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: prism-dashboard
  namespace: default
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: prism-dashboard
rules:
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list", "watch"]
- apiGroups: [""]
  resources: ["namespaces"]
  verbs: ["get", "list"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: prism-dashboard
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: prism-dashboard
subjects:
- kind: ServiceAccount
  name: prism-dashboard
  namespace: default
```

## Architecture Pattern

**Backend Flow:**
```
KubernetesPollingService (every 30s)
  → KubernetesService.GetPodsAsync()
  → InMemoryStore.SetKubernetesState()
  → WebSocketStreamService.BroadcastAsync("kubernetes_pods")
```

**Frontend Flow:**
```
KubernetesService
  → HTTP GET /api/v1/kubernetes/pods (initial load)
  → WebSocket subscription (live updates)
  → state$ Observable<KubernetesPollingState>
  → KubernetesPodsComponent (async pipe)
```

## Files to Create/Modify

### Backend
- `otel-dashboard-api/Models/OtelModels.cs` — Add KubernetesPod, KubernetesOptions, KubernetesPollingState
- `otel-dashboard-api/Services/KubernetesService.cs` — New file
- `otel-dashboard-api/Services/KubernetesPollingService.cs` — New file
- `otel-dashboard-api/Services/InMemoryStore.cs` — Add Kubernetes state storage
- `otel-dashboard-api/Controllers/KubernetesController.cs` — New file
- `otel-dashboard-api/Controllers/ConfigController.cs` — Add kubernetesEnabled flag
- `otel-dashboard-api/Program.cs` — Register services, validate env vars, handle in-cluster token

### Frontend
- `otel-dashboard-frontend/src/app/core/models/otel.models.ts` — Add TypeScript interfaces
- `otel-dashboard-frontend/src/app/core/services/kubernetes.service.ts` — New file
- `otel-dashboard-frontend/src/app/features/kubernetes-pods/kubernetes-pods.component.ts` — New file
- `otel-dashboard-frontend/src/app/features/kubernetes-pods/kubernetes-pods.component.html` — New file
- `otel-dashboard-frontend/src/app/features/kubernetes-pods/kubernetes-pods.component.scss` — New file
- `otel-dashboard-frontend/src/app/app.routes.ts` — Add Kubernetes Pods route
- `otel-dashboard-frontend/src/app/app.component.html` — Add navigation link

## API Considerations

### Kubernetes API Endpoint
- **In-cluster**: `https://kubernetes.default.svc.cluster.local:443/api/v1/namespaces/{namespace}/pods`
- **Out-of-cluster**: `https://your-api-server:6443/api/v1/namespaces/{namespace}/pods`
- Response format: Standard Kubernetes API Pod resource with status fields

### TLS/Certificate Handling
- In-cluster: Kubernetes CA certificate automatically trusted
- Out-of-cluster: May need custom CA bundle or `insecureSkipVerify` flag for self-signed
- Note: `insecureSkipVerify=true` should only be used for development

### Data Extraction from API Response
```
metadata.name → pod.name
metadata.namespace → pod.namespace
status.phase → pod.status
status.conditions[type=Ready].status → pod.ready (boolean)
status.containerStatuses[0].restartCount → pod.restarts
metadata.creationTimestamp → pod.created_at
spec.containers[0].image → pod.image
```

### Filtering Strategy
- Include all statuses: Running, Pending, Failed, Succeeded
- Optionally exclude Succeeded status (completed jobs)
- Filter by namespace from `K8S_NAMESPACES` list
- Top 30 pods (sorted by creation time descending)
