# Stage 1: Build Angular frontend
FROM --platform=linux/amd64 node:20-alpine AS angular-build
WORKDIR /app/frontend

# Copy frontend package files
COPY prism-frontend/package*.json ./

# Install dependencies
RUN npm ci

# Copy frontend source
COPY prism-frontend/ ./

# Build Angular app for production
RUN npm run build -- --configuration production

# Stage 2: Build .NET API (use amd64 for Grpc.Tools compatibility)
FROM --platform=linux/amd64 mcr.microsoft.com/dotnet/sdk:10.0-preview AS dotnet-build
WORKDIR /app/api

# Copy csproj and restore dependencies
COPY prism-api/*.csproj ./
RUN dotnet restore

# Copy proto files and source
COPY prism-api/Protos/ ./Protos/
COPY prism-api/ ./

# Build and publish
RUN dotnet publish -c Release -o out

# Stage 3: Runtime (multi-arch for deployment flexibility)
FROM mcr.microsoft.com/dotnet/aspnet:10.0-preview AS runtime
WORKDIR /app

# Install curl for health checks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Copy .NET API
COPY --from=dotnet-build /app/api/out ./

# Copy Angular static files to wwwroot
COPY --from=angular-build /app/frontend/dist/prism-frontend/browser ./wwwroot

# Expose ports
# 5003: HTTP REST API + gRPC (HTTP/1.1 + HTTP/2)
# 4317: gRPC only (HTTP/2) - standard OTLP port
EXPOSE 5003
EXPOSE 4317

# Set environment variables
ENV ASPNETCORE_URLS="http://+:5003;http://+:4317"
ENV ASPNETCORE_ENVIRONMENT="Production"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5003/api/v1/health || exit 1

# Entry point
ENTRYPOINT ["dotnet", "PrismDashboard.Api.dll"]
