# Prism Helm Chart

Helm chart for deploying Prism OTEL Dashboard to Kubernetes.

## Prerequisites

- Kubernetes 1.28+
- Helm 3.0+
- (Optional) NGINX Ingress Controller
- (Optional) cert-manager for TLS

## Installation

### Add the Helm repository (if using a chart repo)

```bash
helm repo add prism https://your-helm-repo.com/prism
helm repo update
```

### Install from local directory

```bash
cd helm/prism
helm install prism . -n monitoring --create-namespace
```

### Install with custom values

```bash
helm install prism . -n monitoring --create-namespace -f custom-values.yaml
```

## Configuration

### Key Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `replicaCount` | Number of replicas | `2` |
| `image.registry` | Container registry | `registry.jfrog.io` |
| `image.repository` | Image repository | `docker/prism-otel` |
| `image.tag` | Image tag | `latest` |
| `storage.type` | Storage backend (`memory` or `dynamodb`) | `memory` |
| `storage.dynamodb.region` | AWS region for DynamoDB | `us-east-1` |
| `storage.dynamodb.ttlDays` | Data retention in days | `30` |

### In-Memory Storage (Default)

No additional configuration needed. Data is stored in-memory and is not persisted across restarts.

```yaml
storage:
  type: memory
```

### DynamoDB Storage (Production)

Enable persistent storage with DynamoDB:

```yaml
storage:
  type: dynamodb
  dynamodb:
    region: us-east-1
    logsTable: prism-logs
    metricsTable: prism-metrics
    tracesTable: prism-traces
    ttlDays: 30
    endpoint: ""  # Empty for AWS (uses IAM/IRSA)
```

#### AWS IAM Role for Service Accounts (IRSA)

For EKS deployments, configure IRSA to grant DynamoDB access:

```yaml
serviceAccount:
  create: true
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::123456789012:role/prism-dynamodb-role
```

Required IAM policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "dynamodb:PutItem",
      "dynamodb:GetItem",
      "dynamodb:Query",
      "dynamodb:Scan",
      "dynamodb:BatchWriteItem"
    ],
    "Resource": [
      "arn:aws:dynamodb:us-east-1:123456789012:table/prism-*"
    ]
  }]
}
```

### Ingress Configuration

Enable ingress with TLS:

```yaml
ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
  hosts:
    - host: prism.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: prism-tls
      hosts:
        - prism.example.com
```

### Resources

Configure resource requests and limits:

```yaml
resources:
  requests:
    cpu: 250m
    memory: 256Mi
  limits:
    cpu: 500m
    memory: 512Mi
```

### Auto-scaling

Enable HPA for automatic scaling:

```yaml
autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 5
  targetCPUUtilizationPercentage: 80
  targetMemoryUtilizationPercentage: 80
```

## Exposed Ports

| Port | Protocol | Purpose |
|------|----------|---------|
| 80 | HTTP | Dashboard & REST API |
| 4317 | gRPC | OTLP gRPC ingestion |
| 4318 | HTTP | OTLP HTTP ingestion |

## Upgrading

```bash
helm upgrade prism . -n monitoring -f custom-values.yaml
```

## Uninstalling

```bash
helm uninstall prism -n monitoring
```

## Troubleshooting

### Check pod status

```bash
kubectl get pods -n monitoring -l app.kubernetes.io/name=prism
```

### View logs

```bash
kubectl logs -n monitoring -l app.kubernetes.io/name=prism -f
```

### Test connectivity

```bash
# Port-forward to local machine
kubectl port-forward -n monitoring svc/prism 5003:80

# Test health endpoint
curl http://localhost:5003/health
```

### DynamoDB Connection Issues

If using DynamoDB and experiencing issues:

1. Verify IRSA is configured correctly:
   ```bash
   kubectl describe sa prism -n monitoring
   ```

2. Check if the service can assume the IAM role:
   ```bash
   kubectl exec -it deploy/prism -n monitoring -- env | grep AWS
   ```

3. Test DynamoDB connectivity:
   ```bash
   kubectl exec -it deploy/prism -n monitoring -- aws dynamodb list-tables
   ```
