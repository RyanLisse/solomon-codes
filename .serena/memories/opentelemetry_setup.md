# OpenTelemetry Integration with VibeKit

## Overview
OpenTelemetry has been integrated into the solomon_codes web application using VibeKit's built-in telemetry support. This provides distributed tracing capabilities for monitoring and observability.

## Configuration Files

### Environment Variables (.env)
```bash
# OpenTelemetry Configuration
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces
OTEL_EXPORTER_OTLP_HEADERS={}
OTEL_SAMPLING_RATIO=1.0
```

### VibeKit Integration
Telemetry configuration is added to VibeKitConfig objects in:
- `src/app/actions/vibekit.ts` - Pull request creation service
- `src/lib/inngest.ts` - Inngest function for task generation

## Configuration Details

### Service Names
- **vibekit actions**: `solomon-codes-web`
- **inngest functions**: `solomon-codes-inngest`

### Default Settings
- **Enabled**: Only in production (`NODE_ENV === "production"`)
- **Endpoint**: `http://localhost:4318/v1/traces` (OTLP format)
- **Sampling**: 100% (1.0) - adjust for production
- **Timeout**: 5000ms
- **Resource Attributes**: Environment, service instance ID

### Supported Backends
- Jaeger (recommended for local development)
- Zipkin
- DataDog
- New Relic
- Honeycomb
- Grafana Tempo
- OpenTelemetry Collector

## Testing
- Tests in `src/lib/telemetry.test.ts` verify configuration behavior
- Mock VibeKit to test telemetry config without real backend
- All 16 tests passing including telemetry tests

## Usage Notes
- Telemetry is disabled in development by default
- Set `NODE_ENV=production` to enable tracing
- Customize endpoint and headers for production backends
- Adjust sampling ratio for high-volume production environments