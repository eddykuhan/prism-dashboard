# Plan: GitHub PR Monitoring — Final Implementation

Integrate GitHub pull requests into Prism with token authentication from environment variables, 30-second background polling with state-based color mapping, date-fns relative timestamps, skeleton loader, and error state display.

## Steps

1. **Create GitHub DTOs and Models** — Define:
   - `GitHubPullRequest`: number, title, state (draft/open/closed/merged), author, created_at, updated_at, review_comments
   - `GitHubOptions`: token, owner, repos (comma-separated or array)
   - `GitHubPollingState`: pullRequests[], lastFetchTime, error?, isLoading

2. **Register GitHub config in [Program.cs](otel-dashboard-api/Program.cs)** — Read `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPOS` from environment; validate all three set at startup (throw `InvalidOperationException` if missing); register `GitHubOptions` in DI; note: `GITHUB_REPOS` can be comma-separated list (e.g., "repo1,repo2,repo3").

3. **Create `GitHubService.cs` in [Services/](otel-dashboard-api/Services/)** — Inject `IConfiguration`, `IHttpClientFactory`, `ILogger`; implement `GetPullRequestsAsync(cancellationToken)`:
   - Add Authorization header: `Authorization: token {GITHUB_TOKEN}`
   - For each repo in `GITHUB_REPOS`, query REST API `/repos/{owner}/{repo}/pulls?state=all&sort=created&direction=desc&per_page=100`
   - Fields: number, title, state, user.login, created_at, updated_at, review_comments
   - Merge results from all repos, sort by created_at descending, return top 20
   - Throw exception on auth/network errors (error stored, not retried immediately)

4. **Create `GitHubPollingService.cs` in [Services/](otel-dashboard-api/Services/)** — Register as `IHostedService`; background task executes every 30 seconds:
   - Call `GitHubService.GetPullRequestsAsync()`
   - **Success**: Update `InMemoryStore` with pull requests + timestamp, broadcast `"github_pullrequests"` via `WebSocketStreamService`, clear error, set `isLoading=false`
   - **Failure**: Capture error message in `InMemoryStore`, broadcast `"github_error"`, keep previous pull requests cached, set `isLoading=false` (wait 30s for next retry)
   - Initial state: `isLoading=true` until first poll completes

5. **Add `GitHubController.cs` in [Controllers/](otel-dashboard-api/Controllers/)** — Implement `[HttpGet("api/v1/github/pullrequests")]`:
   - Returns `GitHubPollingState` from `InMemoryStore`: pullRequests[], lastFetchTime, error?, isLoading
   - Returns 200 OK regardless of polling state (frontend handles display logic)

6. **Create frontend service [github.service.ts](otel-dashboard-frontend/src/app/core/services/)** — Inject `HttpClient`, `WebSocketService`; expose `state$: Observable<GitHubPollingState>`:
   - Initial HTTP fetch from `/api/v1/github/pullrequests`
   - Subscribe to WebSocket `"github_pullrequests"` and `"github_error"` events
   - Use `merge()` + `scan()` to accumulate updates into state stream

7. **Build GitHub PR widget component** — Standalone in [features/github-pr/](otel-dashboard-frontend/src/app/features/):
   - **Loading state** (isLoading=true): Display 5-row skeleton table
   - **Error state** (error exists): Red alert box with error message, timestamp, info text "Retrying in 30 seconds"
   - **Data state**: Table with columns:
     - **#**: PR number, left-aligned, clickable (opens on GitHub)
     - **Title**: Truncate to 60 chars, ellipsis
     - **State**: Color badge (draft=gray, open=blue, closed=red, merged=purple)
     - **Author**: GitHub username/avatar or initials
     - **Created**: Use `date-fns` `formatDistanceToNow(date)` → "3 days ago"
     - **Reviews**: Badge with review_comments count
   - Sort table by created_at descending (newest first)

8. **Update [ConfigController.GetConfig()](otel-dashboard-api/Controllers/ConfigController.cs)** — Add `githubEnabled: bool` based on `GITHUB_TOKEN` presence.

9. **Add widget to dashboard** — Insert GitHub PR widget component into navigation/sidebar; conditionally show based on `githubEnabled` from config endpoint.

## Implementation Details

### Error Recovery Flow
- Poll attempt fails (auth 401, rate limit 403, network timeout, etc.) → Error stored, user sees alert
- Next scheduled 30-second poll automatically retries → No exponential backoff, no manual retry button
- On success, error cleared and widget shows data

### State Color Mapping
```
if (state.toLowerCase() === 'draft') → gray
else if (state.toLowerCase() === 'open') → blue
else if (state.toLowerCase() === 'closed') → red
else if (state.toLowerCase() === 'merged') → purple
else → gray
```

### Date Format
`formatDistanceToNow(new Date(created_at), { addSuffix: true })` → "3 days ago"

### PR Link
Clickable number links to: `https://github.com/{owner}/{repo}/pull/{number}`

## Environment Variables Required

```bash
GITHUB_TOKEN=ghp_xxxxxxxxxxxxx
GITHUB_OWNER=your-org-or-username
GITHUB_REPOS=repo1,repo2,repo3
```

## Architecture Pattern

**Backend Flow:**
```
GitHubPollingService (every 30s)
  → GitHubService.GetPullRequestsAsync()
  → InMemoryStore.SetGitHubState()
  → WebSocketStreamService.BroadcastAsync("github_pullrequests")
```

**Frontend Flow:**
```
GitHubService
  → HTTP GET /api/v1/github/pullrequests (initial load)
  → WebSocket subscription (live updates)
  → state$ Observable<GitHubPollingState>
  → GitHubPrComponent (async pipe)
```

## Files to Create/Modify

### Backend
- `otel-dashboard-api/Models/OtelModels.cs` — Add GitHubPullRequest, GitHubOptions, GitHubPollingState
- `otel-dashboard-api/Services/GitHubService.cs` — New file
- `otel-dashboard-api/Services/GitHubPollingService.cs` — New file
- `otel-dashboard-api/Services/InMemoryStore.cs` — Add GitHub state storage
- `otel-dashboard-api/Controllers/GitHubController.cs` — New file
- `otel-dashboard-api/Controllers/ConfigController.cs` — Add githubEnabled flag
- `otel-dashboard-api/Program.cs` — Register services, validate env vars

### Frontend
- `otel-dashboard-frontend/src/app/core/models/otel.models.ts` — Add TypeScript interfaces
- `otel-dashboard-frontend/src/app/core/services/github.service.ts` — New file
- `otel-dashboard-frontend/src/app/features/github-pr/github-pr.component.ts` — New file
- `otel-dashboard-frontend/src/app/features/github-pr/github-pr.component.html` — New file
- `otel-dashboard-frontend/src/app/features/github-pr/github-pr.component.scss` — New file
- `otel-dashboard-frontend/src/app/app.routes.ts` — Add GitHub PR route
- `otel-dashboard-frontend/src/app/app.component.html` — Add navigation link

## API Considerations

### GitHub REST API
- Uses: `/repos/{owner}/{repo}/pulls?state=all&sort=created&direction=desc&per_page=100`
- Rate limit: 5000 requests/hour with token authentication
- Current polling (30s = ~2880 req/day) is well under limit
- Simple JSON response, easy pagination

### Rate Limiting Handling
- GitHub returns X-RateLimit-Remaining and X-RateLimit-Reset headers
- Current plan ignores rate limiting (safe headroom with token)
- If needed later: Add backoff logic or show rate-limit warning
