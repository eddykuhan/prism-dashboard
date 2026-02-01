# Plan: ServiceNow Incident Polling — Final Implementation

Integrate ServiceNow incidents into Prism with Basic Auth credentials from environment variables, 30-second background polling with generic state color mapping, date-fns relative timestamps, skeleton loader, and error state display.

## Steps

1. **Create ServiceNow DTOs and Models** — Define:
   - `ServiceNowIncident`: number, state, short_description, priority, created_on
   - `ServiceNowOptions`: URL, username, password, assignment_group
   - `ServiceNowPollingState`: incidents[], lastFetchTime, error?, isLoading

2. **Register ServiceNow config in [Program.cs](otel-dashboard-api/Program.cs)** — Read `SERVICE_NOW_URL`, `SERVICE_NOW_USERNAME`, `SERVICE_NOW_PASSWORD`, `SERVICE_NOW_ASSIGNMENT_GROUP` from environment; validate all four set at startup (throw `InvalidOperationException` if missing); register `ServiceNowOptions` in DI.

3. **Create `ServiceNowService.cs` in [Services/](otel-dashboard-api/Services/)** — Inject `IConfiguration`, `IHttpClientFactory`, `ILogger`; implement `GetIncidentsAsync(cancellationToken)`:
   - Base64 encode `username:password` → Basic Auth header
   - Query `/api/now/table/incident?sysparm_query=assignment_group={GROUP}&sysparm_limit=100&sysparm_fields=number,state,short_description,priority,created_on`
   - Sort by created_on descending, return top 20
   - Throw exception on auth/network errors (error stored, not retried immediately)

4. **Create `ServiceNowPollingService.cs` in [Services/](otel-dashboard-api/Services/)** — Register as `IHostedService`; background task executes every 30 seconds:
   - Call `ServiceNowService.GetIncidentsAsync()`
   - **Success**: Update `InMemoryStore` with incidents + timestamp, broadcast `"servicenow_incidents"` via `WebSocketStreamService`, clear error, set `isLoading=false`
   - **Failure**: Capture error message in `InMemoryStore`, broadcast `"servicenow_error"`, keep previous incidents cached, set `isLoading=false` (wait 30s for next retry)
   - Initial state: `isLoading=true` until first poll completes

5. **Add `ServiceNowController.cs` in [Controllers/](otel-dashboard-api/Controllers/)** — Implement `[HttpGet("api/v1/servicenow/incidents")]`:
   - Returns `ServiceNowPollingState` from `InMemoryStore`: incidents[], lastFetchTime, error?, isLoading
   - Returns 200 OK regardless of polling state (frontend handles display logic)

6. **Create frontend service [servicenow.service.ts](otel-dashboard-frontend/src/app/core/services/)** — Inject `HttpClient`, `WebSocketService`; expose `state$: Observable<ServiceNowPollingState>`:
   - Initial HTTP fetch from `/api/v1/servicenow/incidents`
   - Subscribe to WebSocket `"servicenow_incidents"` and `"servicenow_error"` events
   - Use `merge()` + `scan()` to accumulate updates into state stream

7. **Build ServiceNow widget component** — Standalone in [features/servicenow/](otel-dashboard-frontend/src/app/features/):
   - **Loading state** (isLoading=true): Display 5-row skeleton table
   - **Error state** (error exists): Red alert box with error message, timestamp, info text "Retrying in 30 seconds"
   - **Data state**: Table with columns:
     - **Number**: Left-aligned, clickable (opens incident detail)
     - **State**: Generic color mapping (blue for "new" substring, yellow for "in_progress", green for "resolved", gray default)
     - **Priority**: Numeric badge (1-5)
     - **Description**: Truncate to 50 chars, ellipsis
     - **Created On**: Use `date-fns` `formatDistanceToNow(date)` → "2 hours ago"
   - Sort table by created_on descending (newest first)

8. **Update [ConfigController.GetConfig()](otel-dashboard-api/Controllers/ConfigController.cs)** — Add `servicenowEnabled: bool` based on `SERVICE_NOW_URL` presence.

9. **Add widget to dashboard** — Insert ServiceNow widget component into navigation/sidebar; conditionally show based on `servicenowEnabled` from config endpoint.

## Implementation Details

### Error Recovery Flow
- Poll attempt fails (auth 401, connection timeout, etc.) → Error stored, user sees alert
- Next scheduled 30-second poll automatically retries → No exponential backoff, no manual retry button
- On success, error cleared and widget shows data

### State Color Generic Logic
```
if (state.toLowerCase().includes('new')) → blue
else if (state.toLowerCase().includes('progress')) → yellow
else if (state.toLowerCase().includes('resolved') || state.toLowerCase().includes('closed')) → green
else → gray
```

### Date Format
`formatDistanceToNow(new Date(created_on), { addSuffix: true })` → "2 hours ago"

## Environment Variables Required

```bash
SERVICE_NOW_URL=https://your-instance.service-now.com
SERVICE_NOW_USERNAME=your-username
SERVICE_NOW_PASSWORD=your-password
SERVICE_NOW_ASSIGNMENT_GROUP=your-assignment-group
```

## Architecture Pattern

**Backend Flow:**
```
ServiceNowPollingService (every 30s)
  → ServiceNowService.GetIncidentsAsync()
  → InMemoryStore.SetServiceNowState()
  → WebSocketStreamService.BroadcastAsync("servicenow_incidents")
```

**Frontend Flow:**
```
ServiceNowService
  → HTTP GET /api/v1/servicenow/incidents (initial load)
  → WebSocket subscription (live updates)
  → state$ Observable<ServiceNowPollingState>
  → ServiceNowComponent (async pipe)
```

## Files to Create/Modify

### Backend
- `otel-dashboard-api/Models/OtelModels.cs` — Add ServiceNowIncident, ServiceNowOptions, ServiceNowPollingState
- `otel-dashboard-api/Services/ServiceNowService.cs` — New file
- `otel-dashboard-api/Services/ServiceNowPollingService.cs` — New file
- `otel-dashboard-api/Services/InMemoryStore.cs` — Add ServiceNow state storage
- `otel-dashboard-api/Controllers/ServiceNowController.cs` — New file
- `otel-dashboard-api/Controllers/ConfigController.cs` — Add servicenowEnabled flag
- `otel-dashboard-api/Program.cs` — Register services, validate env vars

### Frontend
- `otel-dashboard-frontend/src/app/core/models/otel.models.ts` — Add TypeScript interfaces
- `otel-dashboard-frontend/src/app/core/services/servicenow.service.ts` — New file
- `otel-dashboard-frontend/src/app/features/servicenow/servicenow.component.ts` — New file
- `otel-dashboard-frontend/src/app/features/servicenow/servicenow.component.html` — New file
- `otel-dashboard-frontend/src/app/features/servicenow/servicenow.component.scss` — New file
- `otel-dashboard-frontend/src/app/app.routes.ts` — Add ServiceNow route
- `otel-dashboard-frontend/src/app/app.component.html` — Add navigation link
