# Prism: OTEL Dashboard with AI Copilot

A unified OpenTelemetry (OTEL) dashboard combining real-time trace, metrics, and log visualization with intelligent Azure OpenAI integration via OAuth2 On-Behalf-Of (OBO) flow.

## 🎯 Features

### Core Dashboard
- **Real-time Logs** - Stream and search application logs with live ingestion metrics
- **Distributed Traces** - Visualize trace spans with flamegraph-style display and timing analysis
- **Live Metrics** - Monitor system metrics with streaming updates and charts
- **WebSocket Streaming** - Efficient real-time data delivery via gRPC and HTTP/JSON
- **Interactive Charts** - Real-time ingestion activity graph with hover tooltips
- **OTLP-Ready** - Drop-in OTLP exporter support for .NET, Node.js, Python, Go, and more
- **Collapsible Sidebar** - Compact icon-only mode for focused dashboard views
- **Dark/Light Mode** - Full theme support with Material Design

### AI Copilot (Optional)
- **Trace Analysis** - AI-powered debugging and performance insights
- **Log Explanation** - Understand errors and anomalies with context
- **Smart Suggestions** - Get recommendations based on telemetry patterns
- **Azure OpenAI Integration** - Secure OBO token flow for multi-tenant scenarios

## 📋 Project Structure

```
prism/
├── Dockerfile                    # Multi-stage build for Angular + .NET
├── otel-dashboard-api/           # .NET 10 API Gateway
│   ├── Controllers/
│   │   ├── ConfigController.cs   # Runtime config endpoint
│   │   ├── AiController.cs       # AI chat with OBO flow
│   │   ├── HealthController.cs
│   │   ├── LogsController.cs
│   │   └── ...
│   ├── Services/
│   │   ├── OtlpTraceGrpcService.cs
│   │   ├── OtlpMetricsGrpcService.cs
│   │   ├── OtlpLogsGrpcService.cs
│   │   └── WebSocketStreamService.cs
│   ├── Models/
│   ├── Protos/
│   │   ├── trace.proto
│   │   ├── metrics.proto
│   │   └── logs.proto
│   ├── Program.cs
│   └── appsettings.json
│
└── otel-dashboard-frontend/      # Angular 18 SPA
    ├── src/
    │   ├── app/
    │   │   ├── core/
    │   │   │   ├── services/
    │   │   │   │   ├── auth.service.ts              # MSAL wrapper
    │   │   │   │   ├── app-config.service.ts        # Runtime config
    │   │   │   │   ├── ai-assistant.service.ts      # AI calls
    │   │   │   │   ├── websocket.service.ts         # WebSocket streaming
    │   │   │   │   ├── log-stream.service.ts        # Live log updates
    │   │   │   │   ├── trace-stream.service.ts      # Live trace updates
    │   │   │   │   └── metric-stream.service.ts     # Live metric updates
    │   │   │   ├── interceptors/
    │   │   │   │   └── auth.interceptor.ts          # Bearer token attachment
    │   │   │   └── models/
    │   │   │       └── otel.models.ts               # TypeScript types for OTLP data
    │   │   ├── features/
    │   │   │   ├── home/                            # Dashboard overview with charts
    │   │   │   ├── logs/                            # Log viewer with search
    │   │   │   ├── traces/                          # Trace flamegraph view
    │   │   │   ├── metrics/                         # Metrics dashboard
    │   │   │   └── guide/                           # Setup guide with code samples
    │   │   ├── shared/
    │   │   │   └── components/
    │   │   │       ├── prism-logo/                  # Prism icon component
    │   │   │       └── ai-panel/                    # AI Copilot chat
    │   │   └── app.component.ts                     # Root with sidebar navigation
    │   ├── main.ts                                  # Config bootstrap
    │   └── styles.scss
    ├── angular.json
    └── package.json
```

## 🚀 Getting Started

### Prerequisites

- **Docker** (for containerized deployment)
- **.NET 10 SDK** (for local development)
- **Node.js 20+** (for Angular development)
- **Docker Compose** (optional, for local testing)

### Build Docker Image

```bash
cd prism
docker build -t prism:latest .
```

### Run Dashboard

#### Minimal Mode (No Auth)
```bash
docker run -p 5003:5003 -p 4317:4317 prism:latest

docker run -d --name prism -p 5003:5003 -p 4317:4317 prism:test && sleep 2 && curl -s http://localhost:5003/api/v1/health | jq .status
```

#### Full OBO Mode (Auth + AI)
```bash
docker run -p 5003:5003 -p 4317:4317 \
  -e AZURE_AD_TENANT_ID=<your-tenant-id> \
  -e AZURE_AD_CLIENT_ID_API=<api-app-id> \
  -e AZURE_AD_CLIENT_ID_SPA=<spa-app-id> \
  -e AZURE_OPENAI_ENABLED=true \
  -e AZURE_OPENAI_ENDPOINT=https://<resource>.openai.azure.com \
  -e AZURE_OPENAI_DEPLOYMENT=gpt-4 \
  prism:latest
```

## 🔧 Configuration

### Environment Variables

**Authentication & Authorization:**
```env
# Azure AD Configuration
AZURE_AD_TENANT_ID=<tenant-id>              # Your Azure AD tenant
AZURE_AD_CLIENT_ID_API=<api-app-id>         # Backend API app registration
AZURE_AD_CLIENT_ID_SPA=<spa-app-id>         # Frontend SPA app registration
AZURE_AD_CLIENT_SECRET=<client-secret>      # API client secret (for OBO)

# Azure OpenAI (requires auth enabled)
AZURE_OPENAI_ENABLED=true|false             # Enable AI Copilot
AZURE_OPENAI_ENDPOINT=https://xxx.openai.azure.com
AZURE_OPENAI_DEPLOYMENT=gpt-4
AZURE_OPENAI_API_VERSION=2024-02-15-preview
```

**Server Configuration:**
```env
ASPNETCORE_ENVIRONMENT=Production|Development
Logging__LogLevel__Default=Information|Debug
```

### Deployment Scenarios

#### Scenario 1: Minimal (Telemetry Only)
- No authentication required
- No AI features
- Perfect for development/testing
- **Start command:** Default docker run

#### Scenario 2: Full OBO (Auth + AI)
- Azure AD authentication via MSAL
- AI Copilot enabled for authenticated users
- Secure OBO token flow to Azure OpenAI
- **Requires Azure AD app registrations** (see Azure Setup section)

## 📊 API Endpoints

### Configuration
- `GET /api/v1/config` - Runtime configuration for frontend

### OTEL Data Collection
- `POST /v1/traces` - OTLP HTTP/JSON traces
- `POST /v1/metrics` - OTLP HTTP/JSON metrics
- `POST /v1/logs` - OTLP HTTP/JSON logs
- `grpc://localhost:4317` - OTLP gRPC (standard port)
- `grpc://localhost:5003` - OTLP gRPC (alternative)

### AI Features (Auth Required)
- `POST /api/v1/ai/chat` - Chat endpoint with OBO flow

### Health & Status
- `GET /api/v1/health` - Health check with stats
- `WS /ws/stream` - WebSocket for real-time updates

### API Documentation
- `GET /swagger` - Swagger UI (always enabled)

## 🔑 Azure AD Setup (For Full OBO Mode)

### 1. Create API App Registration

```
Name: Prism API
Supported account types: Single tenant
Redirect URI: N/A (backend service)

Expose an API:
  - App ID URI: api://<api-app-id>
  - Scope: access_as_user
  
API Permissions:
  - Microsoft Graph: User.Read
  - Azure Cognitive Services: user_impersonation
```

### 2. Create SPA App Registration

```
Name: Prism Dashboard
Supported account types: Single tenant
Redirect URI: http://localhost:5003 (add http://yourdomain.com for prod)

Authentication:
  - Allow public client flows: Yes
  
API Permissions:
  - Prism API: access_as_user (Delegated)
```

### 3. Configure Azure OpenAI

- Ensure your Azure OpenAI resource has the API app registered
- Assign "Cognitive Services OpenAI User" role to your app
- Note the endpoint and deployment name

## 📝 Local Development

### Backend (.NET API)
```bash
cd prism/otel-dashboard-api
dotnet restore
dotnet run
```
Runs on: `http://localhost:5003`

### Frontend (Angular)
```bash
cd prism/otel-dashboard-frontend
npm install
npm start
```
Runs on: `http://localhost:4200`

### Development Mode
For local development, both services run separately:
- Angular dev server handles requests via proxy to API
- Full hot-reload support
- See `angular.json` for proxy configuration

## 🐳 Docker Deployment

### Build
```bash
cd prism
docker build -t prism:v1.0.0 .
```

### Push to Registry
```bash
docker tag prism:v1.0.0 yourregistry/prism:v1.0.0
docker push yourregistry/prism:v1.0.0
```

### Kubernetes Deployment
```bash
kubectl create deployment prism --image=yourregistry/prism:v1.0.0
kubectl expose deployment prism --port=5003 --type=LoadBalancer
```

## 📈 Sending Telemetry Data

### Quick Start: Connect Your Service

**Environment Variable:**
```bash
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
```

**Or Docker:**
```bash
docker run -e OTEL_EXPORTER_OTLP_ENDPOINT=http://prism:4317 yourapp:latest
```

### OTLP Client Configuration

**OpenTelemetry Python:**
```python
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

exporter = OTLPSpanExporter(endpoint="http://localhost:4317")
tracer_provider = TracerProvider()
tracer_provider.add_span_processor(BatchSpanProcessor(exporter))
```

**OpenTelemetry Node.js:**
```javascript
const { NodeTracerProvider } = require('@opentelemetry/node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-grpc');

const exporter = new OTLPTraceExporter({
  url: 'grpc://localhost:4317'
});
const provider = new NodeTracerProvider();
provider.addSpanProcessor(new BatchSpanProcessor(exporter));
```

**OpenTelemetry Go:**
```go
exporter, _ := otlptracegrpc.New(ctx, otlptracegrpc.WithEndpoint("localhost:4317"))
provider := sdktrace.NewTracerProvider(sdktrace.WithBatcher(exporter))
```

**OpenTelemetry Collector Gateway:**
```yaml
# otel-collector-config.yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

exporters:
  otlp/prism:
    endpoint: http://prism:4317

service:
  pipelines:
    traces:
      receivers: [otlp]
      exporters: [otlp/prism]
```

## 🔐 Security Notes

- **Minimal Mode:** No authentication - suitable for internal development only
- **Full OBO Mode:** Uses Azure AD OAuth2 with OBO flow
- **Token Caching:** In-memory token cache (single-instance deployment)
- **CORS:** Production CORS allows same-origin requests
- **Static Files:** Angular frontend served from .NET (no separate static server needed)

## 🐛 Troubleshooting

### Dashboard UI Not Loading
- Ensure port 5003 is not blocked
- Check `docker logs prism` for startup errors
- Verify `wwwroot` contains Angular build artifacts

### AI Copilot Not Appearing
- Verify `AZURE_AD_TENANT_ID`, `AZURE_AD_CLIENT_ID_API`, `AZURE_AD_CLIENT_ID_SPA` are set
- Check Azure AD app registrations exist
- Ensure logged-in user has Azure OpenAI access (RBAC role assignment)

### No Telemetry Data
- Verify OTLP client is configured to send to `localhost:4317` or `localhost:5003`
- Check network connectivity between client and dashboard
- Review `/api/v1/health` endpoint for stats

## 📚 Technology Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| API Gateway | .NET | 10.0 |
| Web Framework | ASP.NET Core | 10.0 |
| Frontend | Angular | 18 |
| Auth | MSAL Angular | 4.x |
| OTLP Receiver | gRPC/HTTP | OTEL Standard |
| Container | Docker | Latest |

## 🤝 Contributing

For issues, feature requests, or improvements, follow these guidelines:
1. Create a feature branch from `main`
2. Make changes in isolated commits
3. Test in Docker before submitting
4. Update documentation for new features

## 📄 License

MIT License - See LICENSE file for details

## 🔗 References

- [OpenTelemetry Specification](https://opentelemetry.io/docs/reference/specification/)
- [OTLP Protocol](https://github.com/open-telemetry/opentelemetry-proto)
- [Azure AD OAuth2 On-Behalf-Of Flow](https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-on-behalf-of-flow)
- [MSAL Angular Documentation](https://github.com/AzureAD/microsoft-authentication-library-for-js/tree/dev/lib/msal-angular)
