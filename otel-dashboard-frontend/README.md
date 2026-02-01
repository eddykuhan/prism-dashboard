# OtelDashboardFrontend - Prism Angular Application

A modern Angular 18 Single Page Application providing real-time visualization of OpenTelemetry traces, metrics, and logs with integrated AI-powered debugging via Azure OpenAI.

## 📋 Table of Contents
- [Features](#-features)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Development](#-development)
- [Build & Deployment](#-build--deployment)
- [Configuration](#-configuration)
- [Services](#-services)
- [Components](#-components)
- [Authentication](#-authentication)
- [AI Copilot](#-ai-copilot)
- [Styling](#-styling)
- [Build Size](#-build-size)
- [Troubleshooting](#-troubleshooting)

## ✨ Features

### Core Dashboard
- **Real-time Trace Visualization** - Distributed trace explorer with span hierarchy
- **Live Metrics Dashboard** - System and application metrics streaming
- **Structured Log Viewer** - Full-text search and filtering
- **WebSocket Integration** - Efficient real-time updates via gRPC

### UI/UX
- **Dark Mode Support** - Native dark theme with Tailwind CSS
- **Responsive Design** - Mobile-friendly layout
- **Live Connection Status** - Connection state indicators
- **Collapsible Panels** - Customizable layout

### AI Features (Optional)
- **Trace Analysis** - AI-powered trace debugging
- **Log Explanation** - Understanding error logs
- **Span Inspection** - Detailed span analysis
- **Chat Interface** - Multi-turn conversations with context

## 🗂️ Project Structure

```
otel-dashboard-frontend/
├── src/
│   ├── app/
│   │   ├── app.component.ts              # Root component with auth UI
│   │   ├── app.config.ts                 # Angular config with MSAL setup
│   │   │
│   │   ├── core/                         # Core services & interceptors
│   │   │   ├── services/
│   │   │   │   ├── auth.service.ts       # MSAL wrapper & auth methods
│   │   │   │   ├── app-config.service.ts # Runtime config management
│   │   │   │   ├── ai-assistant.service.ts # AI chat service
│   │   │   │   ├── api.service.ts        # REST API client
│   │   │   │   ├── websocket.service.ts  # WebSocket management
│   │   │   │   ├── trace-stream.service.ts
│   │   │   │   ├── log-stream.service.ts
│   │   │   │   ├── metric-stream.service.ts
│   │   │   │   └── ...
│   │   │   ├── interceptors/
│   │   │   │   └── auth.interceptor.ts   # Bearer token attachment
│   │   │   └── models/
│   │   │       └── otel.models.ts        # TypeScript interfaces
│   │   │
│   │   ├── features/
│   │   │   ├── traces/
│   │   │   │   ├── traces.component.ts
│   │   │   │   ├── traces.component.html
│   │   │   │   └── traces.component.scss
│   │   │   ├── metrics/
│   │   │   │   ├── metrics.component.ts
│   │   │   │   ├── metrics.component.html
│   │   │   │   └── metrics.component.scss
│   │   │   ├── logs/
│   │   │   │   ├── logs.component.ts
│   │   │   │   └── logs.component.html
│   │   │   ├── ai-panel/
│   │   │   │   ├── ai-panel.component.ts
│   │   │   │   └── ai-panel.component.html
│   │   │   └── ...
│   │   │
│   │   └── shared/
│   │       └── (future: shared utilities)
│   │
│   ├── main.ts                           # Bootstrap with config loading
│   ├── styles.scss                       # Global styles + Tailwind
│   └── index.html
│
├── angular.json                          # Angular CLI configuration
├── tsconfig.json                         # TypeScript configuration
├── tailwind.config.js                    # Tailwind CSS setup
├── package.json                          # Dependencies
├── README.md                             # This file
└── public/                               # Static assets (icons, etc)
```

## 🚀 Getting Started

### Prerequisites
- **Node.js 20+** - Use `node --version` to verify
- **npm 10+** - Package manager
- **.NET API Running** - Backend must be accessible on `http://localhost:5003`

### Installation

```bash
cd otel-dashboard-frontend
npm install
```

### Development Server

```bash
npm start
```

Navigate to `http://localhost:4200` in your browser. The app will auto-reload when you modify source files.

### Hot Module Replacement (HMR)

Already enabled in development mode - changes reload instantly without losing state.

## 💻 Development

### Adding a New Component

```bash
ng generate component features/my-feature/my-component
```

This creates:
- `my-component.ts` - Component logic
- `my-component.html` - Template
- `my-component.scss` - Styles

### Adding a Service

```bash
ng generate service core/services/my-service
```

### Development Workflow

1. **Create Feature Branch**
   ```bash
   git checkout -b feature/new-feature
   ```

2. **Make Changes** - Components, services, styles

3. **Test Locally**
   ```bash
   npm start
   # Test in browser
   ```

4. **Build for Verification**
   ```bash
   npm run build
   ```

5. **Commit & Push**
   ```bash
   git add .
   git commit -m "feat: add new feature"
   git push origin feature/new-feature
   ```

### Code Organization

#### Component Structure
```typescript
@Component({
  selector: 'app-my-component',
  standalone: true,
  imports: [CommonModule],
  template: `...`,
  styles: [`...`]
})
export class MyComponent {
  // State
  data: any[] = [];
  
  // Lifecycle
  ngOnInit() { }
  
  // Methods
  handleClick() { }
}
```

#### Service Structure
```typescript
@Injectable({
  providedIn: 'root'
})
export class MyService {
  private data$ = new BehaviorSubject([]);
  
  constructor(private http: HttpClient) {}
  
  getData() {
    return this.data$.asObservable();
  }
  
  fetchData() {
    // async logic
  }
}
```

## 🔨 Build & Deployment

### Production Build

```bash
npm run build
```

Outputs to `dist/otel-dashboard-frontend/browser/`

### Build Size

Current bundle sizes (gzipped):
- Main: ~185 KB (MSAL + OpenTelemetry libs)
- Vendor: ~63 KB
- Polyfills: ~11 KB
- Styles: ~5 KB
- **Total: ~272 KB**

See `angular.json` for budget configuration.

### Docker Build

```bash
cd ../prism
docker build -t prism:latest .
```

The build is multi-stage:
1. Node 20 Alpine - Compiles Angular
2. .NET 10 SDK - Builds API
3. .NET 10 Runtime - Final image with both

## ⚙️ Configuration

### Runtime Configuration

Configuration is loaded from `/api/v1/config` before app bootstrap:

```typescript
{
  "authEnabled": false,           // Enable/disable Azure AD
  "copilotEnabled": false,        // Enable/disable AI features
  "azureAd": {
    "clientId": "...",            // SPA app ID
    "tenantId": "...",            // Azure AD tenant
    "authority": "...",           // Login endpoint
    "redirectUri": "...",         // Post-login redirect
    "scopes": [...]               // Required scopes
  }
}
```

### MSAL Configuration

When `authEnabled: true`, MSAL is configured with:
- **Client ID**: SPA app registration ID
- **Tenant ID**: Azure AD tenant
- **Cache Location**: Local Storage
- **Interaction Type**: Redirect (full page)

### API Configuration

Default base URL: `http://localhost:5003`

Change in `core/services/api.service.ts`:
```typescript
private apiBaseUrl = 'http://localhost:5003/api/v1';
```

### Environment-Specific Config

Create `environment.ts` variants:
```typescript
// environment.ts (development)
export const environment = {
  apiUrl: 'http://localhost:5003',
  production: false
};

// environment.prod.ts (production)
export const environment = {
  apiUrl: 'https://prism.yourdomain.com',
  production: true
};
```

## 🔧 Services

### AppConfigService
Loads and stores runtime configuration from API.

```typescript
constructor(private config: AppConfigService) {
  const cfg = config.getConfig();
  if (cfg.authEnabled) { ... }
}
```

### AuthService
MSAL wrapper for login/logout and token acquisition.

```typescript
constructor(private auth: AuthService) {
  const isLoggedIn = this.auth.isLoggedIn();
  const token = await this.auth.getAccessToken();
}
```

### AIAssistantService
Chat interface with AI backend.

```typescript
async explainTrace(trace) {
  this.aiService.explainTrace(trace);
}
```

### ApiService
REST client for OTEL data.

```typescript
getTraces() { return this.api.getTraces(); }
getLogs() { return this.api.getLogs(); }
getMetrics() { return this.api.getMetrics(); }
```

### WebSocketService
Real-time data streaming.

```typescript
constructor(private ws: WebSocketService) {
  ws.status$.subscribe(status => {
    // 'connected' | 'connecting' | 'disconnected'
  });
}
```

## 🎨 Components

### app.component
Root component with:
- Navigation layout
- Auth UI (Login/Logout button)
- User avatar display
- Dark mode toggle (planned)

### traces.component
- Trace list with filters
- Span tree visualization
- Timing breakdown
- Error highlighting
- Copilot button (if enabled)

### logs.component
- Log stream with live updates
- Level-based filtering
- Detailed log view
- Search/filter
- Copilot button (if enabled)

### metrics.component
- Dashboard of system metrics
- Time-series graphs
- Custom metric selection
- Export capability

### ai-panel.component
- Chat interface
- Message history
- Real-time streaming responses
- Error handling

## 🔐 Authentication

### MSAL Integration

MSAL (Microsoft Authentication Library) handles Azure AD authentication.

#### Sign In Flow
1. User clicks "Sign In" button
2. Redirects to Azure AD login page
3. User authenticates and consents
4. Redirected back with authorization code
5. MSAL exchanges for access token
6. Token stored in browser (LocalStorage)

#### Protected API Calls
Authorization header automatically added:
```
Authorization: Bearer <access_token>
```

#### Sign Out
```typescript
logout() {
  this.auth.logout();
  // User redirected to logout endpoint
}
```

### Handling Unauthorized (403)
- User doesn't have Azure OpenAI access
- Graceful error displayed
- Copilot features disabled
- Rest of dashboard continues to work

## 🤖 AI Copilot

### When Enabled
- Copilot buttons visible in Traces and Logs
- Chat panel appears when clicked
- Context (trace/log) automatically included
- Multi-turn conversations supported

### When Disabled
- Copilot buttons hidden
- No configuration shown
- Full dashboard functionality remains

See [../.copilot-instructions.md](../.copilot-instructions.md) for detailed usage.

## 🎨 Styling

### Tailwind CSS
Framework used for all styling.

**Key Classes Used:**
```
dark:          # Dark mode variants
flex, grid     # Layouts
gap-*          # Spacing
px-*, py-*     # Padding
rounded-*      # Border radius
bg-*, text-*   # Colors
hover:, focus: # Interactive states
```

### CSS Variables
Custom colors in `styles.scss`:
```scss
$primary: #3b82f6;      // Blue
$success: #10b981;      // Green
$warning: #f59e0b;      // Amber
$error: #ef4444;        // Red
```

### Dark Mode
Tailwind's `dark:` prefix automatically applied based on `prefers-color-scheme`.

Override in component:
```html
<div class="dark:bg-slate-900 bg-white">
```

## 📦 Build Size

### Budget Configuration
Set in `angular.json`:
```json
"budgets": [
  {
    "type": "initial",
    "maximumWarning": "1MB",
    "maximumError": "2MB"
  }
]
```

### Optimization Tips
1. **Lazy Load Routes** - Load features on-demand
2. **Tree Shake Unused Code** - Remove unused imports
3. **Minify Assets** - Production builds do this automatically
4. **Compress Images** - Optimize SVG/PNG assets

## 🐛 Troubleshooting

### Build Fails
```bash
# Clear cache
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Angular Not Compiling
```
Error: Component not found
- Check standalone: true in component decorator
- Verify imports: [CommonModule, ...] in component
- Ensure service provided in root or component
```

### MSAL Login Loop
```
Symptom: Redirects to login repeatedly
Solution:
1. Check Azure AD app redirect URI matches localhost:4200
2. Verify client ID in config is correct
3. Clear LocalStorage: localStorage.clear()
```

### API Calls Failing
```
Symptom: 404/CORS errors
Solution:
1. Verify backend running on :5003
2. Check CORS configured in API
3. Use browser DevTools → Network tab to debug
```

### Copilot Not Showing
```
Symptom: Buttons hidden despite config
Solution:
1. Verify /api/v1/config returns copilotEnabled: true
2. Check user is logged in (check browser console)
3. Verify Azure AD app permissions configured
```

### Performance Issues
```
Symptom: Slow rendering with many traces
Solution:
1. Use OnPush change detection strategy
2. Virtual scroll large lists
3. Unsubscribe from observables in ngOnDestroy
4. Profile with Chrome DevTools Performance tab
```

## 📚 Dependencies

Key packages:
- **@angular/core**: 18.x - Framework
- **@azure/msal-angular**: 4.x - Auth
- **@azure/msal-browser**: 4.x - Auth lib
- **tailwindcss**: 3.x - Styling
- **date-fns**: 3.x - Date utilities
- **rxjs**: 7.x - Reactive streams

See `package.json` for full dependency tree.

## 🔄 Upgrading Dependencies

```bash
# Check for outdated packages
npm outdated

# Update all to latest
npm update

# Update specific package
npm install @angular/core@latest
```

## 🚀 Performance Tips

1. **OnPush Change Detection**
   ```typescript
   @Component({
     changeDetection: ChangeDetectionStrategy.OnPush
   })
   ```

2. **Unsubscribe in ngOnDestroy**
   ```typescript
   ngOnDestroy() {
     this.subscriptions.forEach(s => s.unsubscribe());
   }
   ```

3. **Lazy Load Routes**
   ```typescript
   {
     path: 'traces',
     loadComponent: () => import('...').then(m => m.TracesComponent)
   }
   ```

4. **Virtual Scrolling for Large Lists**
   ```html
   <cdk-virtual-scroll-viewport>
     <div *cdkVirtualFor="let item of items">
   </cdk-virtual-scroll-viewport>
   ```

## 📖 Additional Resources

- [Angular Documentation](https://angular.io/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [MSAL Angular](https://github.com/AzureAD/microsoft-authentication-library-for-js/tree/dev/lib/msal-angular)
- [RxJS Operators](https://rxjs.dev/guide/operators)
- [OpenTelemetry JS](https://opentelemetry.io/docs/instrumentation/js/)

## 🤝 Contributing

1. Follow Angular style guide
2. Use standalone components
3. Add types (no `any`)
4. Document complex logic
5. Test locally before committing

## 📄 License

MIT - See LICENSE file
