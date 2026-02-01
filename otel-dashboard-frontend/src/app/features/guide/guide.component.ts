import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-guide',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="min-h-full bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">
      <div class="mx-auto max-w-5xl px-6 py-10 space-y-8">
        <header class="flex items-start justify-between gap-4">
          <div>
            <p class="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Setup</p>
            <h1 class="text-3xl font-bold mt-1">Send telemetry to Prism</h1>
            <p class="text-sm text-slate-500 dark:text-slate-400 mt-2">Point your OTLP exporters to the Prism gateway and verify data arrives in Logs, Traces, and Metrics.</p>
          </div>
          <a routerLink="/" class="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:opacity-90">
            <span class="material-symbols-outlined text-base">home</span>
            Back to dashboard
          </a>
        </header>

        <section class="grid gap-4 md:grid-cols-2">
          <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f1629] p-5">
            <h2 class="text-lg font-semibold">OTLP endpoints</h2>
            <ul class="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <li><strong class="font-semibold">gRPC</strong>: http://localhost:4317</li>
              <li><strong class="font-semibold">HTTP</strong>: http://localhost:5003 (REST APIs)</li>
              <li>Ports map from the container: <code class="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800">4317</code> (OTLP gRPC) and <code class="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800">5003</code> (API/UI)</li>
              <li>Auth/Copilot are optional; default minimal mode accepts data without tokens.</li>
            </ul>
          </div>
          <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f1629] p-5">
            <h2 class="text-lg font-semibold">Quick checklist</h2>
            <ol class="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300 list-decimal list-inside">
              <li>Expose OTLP gRPC to your services: http://localhost:4317</li>
              <li>Send at least one log, trace, and metric to confirm wiring</li>
              <li>Open Logs/Traces/Metrics in Prism to validate data</li>
              <li>(Optional) Enable auth + Copilot via /api/v1/config</li>
            </ol>
          </div>
        </section>

        <section class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f1629] p-5 space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-lg font-semibold">.NET (OTLP gRPC)</h2>
              <p class="text-sm text-slate-500 dark:text-slate-400">Add OpenTelemetry with OTLP exporter targeting Prism.</p>
            </div>
          </div>
            <pre class="text-xs bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto">
            <code [innerText]="dotnetSnippet"></code>
            </pre>
        </section>

        <section class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f1629] p-5 space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-lg font-semibold">Node.js (OTLP HTTP/proto)</h2>
              <p class="text-sm text-slate-500 dark:text-slate-400">Use the OTLP exporter to target Prism.</p>
            </div>
          </div>
          <pre class="text-xs bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto">
            <code [innerText]="nodeSnippet"></code>
          </pre>
        </section>

        <section class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f1629] p-5 space-y-3">
          <h2 class="text-lg font-semibold">Troubleshooting</h2>
          <ul class="list-disc list-inside text-sm text-slate-600 dark:text-slate-300 space-y-2">
            <li>Verify Prism health: curl http://localhost:5003/api/v1/health</li>
            <li>Check ports: 4317 (OTLP gRPC) and 5003 (UI/API) exposed from the container</li>
            <li>If counts stay at 0, confirm exporter endpoint URLs and firewall rules</li>
            <li>Use Logs/Traces pages to confirm ingestion; refresh Health if needed</li>
          </ul>
        </section>
      </div>
    </div>
  `,
  styles: []
})
export class GuideComponent {
  readonly dotnetSnippet = `dotnet add package OpenTelemetry.Extensions.Hosting
(dotnet add package OpenTelemetry.Exporter.OpenTelemetryProtocol)

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenTelemetry()
    .WithTracing(tracer => tracer
        .AddAspNetCoreInstrumentation()
        .AddHttpClientInstrumentation()
        .AddOtlpExporter(o =>
        {
            o.Endpoint = new Uri("http://localhost:4317");
        }))
    .WithMetrics(metrics => metrics
        .AddAspNetCoreInstrumentation()
        .AddRuntimeInstrumentation()
        .AddOtlpExporter(o =>
        {
            o.Endpoint = new Uri("http://localhost:4317");
        }));`;

  readonly nodeSnippet = `npm install @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node @opentelemetry/exporter-trace-otlp-http @opentelemetry/exporter-metrics-otlp-http

const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-http');

const traceExporter = new OTLPTraceExporter({
  url: 'http://localhost:4317/v1/traces'
});
const metricExporter = new OTLPMetricExporter({
  url: 'http://localhost:4317/v1/metrics'
});

const sdk = new NodeSDK({
  traceExporter,
  metricExporter,
  instrumentations: [getNodeAutoInstrumentations()]
});

sdk.start();`;
}
