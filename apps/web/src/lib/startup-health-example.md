# Startup Validation and Health Checks - Usage Guide

This guide demonstrates how to use the comprehensive startup validation and health check system implemented in Task 13.

## Overview

The system provides:
1. **Enhanced startup validation** with database and telemetry checks
2. **Comprehensive health check endpoints** for monitoring
3. **Graceful shutdown handling** with proper cleanup
4. **Startup timing and performance monitoring**

## 1. Startup Validation

### Basic Usage

```typescript
import { validateStartupOrExit, getStartupValidationService } from "@/lib/config/startup";

// In your application entry point (e.g., server.ts, app.ts)
async function startApplication() {
  // This will validate all systems and exit if critical failures occur
  await validateStartupOrExit();
  
  // Your application startup code here...
  console.log("Application started successfully!");
}

startApplication().catch(console.error);
```

### Advanced Usage with Custom Validation

```typescript
import { getStartupValidationService, type StartupMetrics } from "@/lib/config/startup";

async function customStartup() {
  const startupService = getStartupValidationService();
  
  // Run validation without automatic exit
  const result = await startupService.validateStartup();
  
  if (!result.success) {
    console.error("Startup validation failed:", result.errors);
    // Handle failure according to your needs
    return;
  }
  
  // Get detailed metrics
  const metrics: StartupMetrics = startupService.getStartupMetrics();
  console.log(`Startup completed in ${metrics.duration}ms`);
  
  // Log timing for each validation step
  metrics.validationSteps.forEach(step => {
    console.log(`${step.name}: ${step.duration}ms (${step.success ? 'success' : 'failed'})`);
  });
  
  // Get validation summary for monitoring dashboards
  const summary = startupService.getValidationSummary();
  console.log("Validation summary:", summary);
}
```

## 2. Health Check Endpoints

### General Application Health: `/api/health`

```bash
# Check overall application health
curl http://localhost:3000/api/health

# Example response
{
  "status": "healthy", // "healthy" | "degraded" | "unhealthy"
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600,
  "version": "1.0.0",
  "environment": "production",
  "checks": {
    "database": {
      "status": "healthy",
      "responseTime": 45,
      "message": "Database connection successful"
    },
    "telemetry": {
      "status": "healthy",
      "enabled": true,
      "message": "Telemetry service operational"
    },
    "configuration": {
      "status": "healthy",
      "message": "Configuration valid"
    },
    "startup": {
      "status": "healthy",
      "duration": 150,
      "message": "All startup validations passed"
    }
  },
  "details": {
    "errors": [],
    "warnings": [],
    "metrics": {
      "startupDuration": 150,
      "validationSteps": [...]
    }
  }
}
```

### Kubernetes Readiness Probe: `/api/health/readiness`

```bash
# Check if application is ready to accept traffic
curl http://localhost:3000/api/health/readiness

# Example response
{
  "ready": true,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "checks": {
    "startup": true,
    "database": true,
    "configuration": true
  },
  "message": "Application is ready",
  "details": {
    "errors": [],
    "warnings": ["Non-critical startup steps failed: telemetry"]
  }
}
```

### Kubernetes Liveness Probe: `/api/health/liveness`

```bash
# Check if application process is alive and responding
curl http://localhost:3000/api/health/liveness

# Example response
{
  "alive": true,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600,
  "pid": 1234,
  "memory": {
    "rss": 52428800,
    "heapTotal": 31457280,
    "heapUsed": 15728640,
    "external": 5242880,
    "arrayBuffers": 1048576
  },
  "cpu": {
    "user": 100000,
    "system": 50000
  },
  "message": "Application is alive",
  "details": {
    "errors": [],
    "warnings": []
  }
}
```

### Service-Specific Health: `/api/stagehand/health`

```bash
# Check Stagehand browser automation service health
curl http://localhost:3000/api/stagehand/health

# Example response
{
  "healthy": true,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "service": "stagehand",
  "version": "1.0.0",
  "message": "Stagehand service is healthy",
  "details": {
    "configuration": {
      "status": "healthy",
      "browserbaseConfigured": true,
      "message": "BrowserBase configured successfully"
    },
    "connectivity": {
      "status": "healthy",
      "responseTime": 85,
      "message": "Stagehand service responding"
    },
    "dependencies": {
      "status": "healthy",
      "message": "All Stagehand dependencies available"
    },
    "errors": [],
    "warnings": []
  }
}
```

## 3. Graceful Shutdown

### Basic Setup

```typescript
import { getGracefulShutdownService } from "@/lib/shutdown/graceful-shutdown";

// The service automatically sets up signal handlers
// No additional setup needed for basic graceful shutdown
const shutdownService = getGracefulShutdownService();

console.log("Graceful shutdown handlers are active");
```

### Custom Shutdown Handlers

```typescript
import { registerShutdownHandler, type ShutdownHandler } from "@/lib/shutdown/graceful-shutdown";

// Register custom cleanup logic
const customHandler: ShutdownHandler = {
  name: "cleanup-user-sessions",
  priority: 2, // Lower number = higher priority (executes first)
  timeout: 5000, // Max time to wait for this handler
  handler: async () => {
    console.log("Cleaning up user sessions...");
    // Your cleanup logic here
    await cleanupUserSessions();
    console.log("User sessions cleaned up");
  }
};

registerShutdownHandler(customHandler);

// Register another handler with different priority
const cacheHandler: ShutdownHandler = {
  name: "flush-cache",
  priority: 8, // Lower priority (executes later)
  handler: async () => {
    console.log("Flushing cache...");
    await flushCache();
  }
};

registerShutdownHandler(cacheHandler);
```

### Manual Shutdown

```typescript
import { initiateGracefulShutdown } from "@/lib/shutdown/graceful-shutdown";

// Manually trigger graceful shutdown
async function emergencyShutdown() {
  try {
    await initiateGracefulShutdown("manual", 30000); // 30 second timeout
  } catch (error) {
    console.error("Graceful shutdown failed:", error);
  }
}
```

### Shutdown Metrics

```typescript
import { getGracefulShutdownService } from "@/lib/shutdown/graceful-shutdown";

const shutdownService = getGracefulShutdownService();

// Get shutdown metrics after shutdown completes
const metrics = shutdownService.getMetrics();
console.log("Shutdown metrics:", {
  duration: metrics.duration,
  signal: metrics.signal,
  forced: metrics.forced,
  handlersExecuted: metrics.handlersExecuted.length,
  successfulHandlers: metrics.handlersExecuted.filter(h => h.success).length,
  failedHandlers: metrics.handlersExecuted.filter(h => !h.success).length
});
```

## 4. Docker and Kubernetes Integration

### Dockerfile

```dockerfile
FROM node:18-alpine

# ... your app setup ...

# Health check for Docker
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health/liveness || exit 1

# Expose port
EXPOSE 3000

# Use graceful shutdown
STOPSIGNAL SIGTERM

CMD ["node", "server.js"]
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: solomon-codes-web
spec:
  replicas: 3
  selector:
    matchLabels:
      app: solomon-codes-web
  template:
    metadata:
      labels:
        app: solomon-codes-web
    spec:
      containers:
      - name: web
        image: solomon-codes-web:latest
        ports:
        - containerPort: 3000
        
        # Readiness probe - when to route traffic
        readinessProbe:
          httpGet:
            path: /api/health/readiness
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
        
        # Liveness probe - when to restart pod
        livenessProbe:
          httpGet:
            path: /api/health/liveness
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        
        # Startup probe - during initial startup
        startupProbe:
          httpGet:
            path: /api/health/readiness
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 2
          timeoutSeconds: 3
          failureThreshold: 30 # Allow up to 60 seconds for startup
        
        # Graceful shutdown
        lifecycle:
          preStop:
            exec:
              command: ["sleep", "15"] # Give time for graceful shutdown
        
        # Resource limits
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        
        # Environment variables
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: database-url
---
apiVersion: v1
kind: Service
metadata:
  name: solomon-codes-web-service
spec:
  selector:
    app: solomon-codes-web
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
```

### Service Monitor (Prometheus)

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: solomon-codes-web-health
  labels:
    app: solomon-codes-web
spec:
  selector:
    matchLabels:
      app: solomon-codes-web
  endpoints:
  - port: web
    path: /api/health
    interval: 30s
    scrapeTimeout: 10s
```

## 5. Monitoring and Alerting

### Custom Monitoring Dashboard

```typescript
// Example monitoring service that uses health endpoints
export class HealthMonitoringService {
  private async checkApplicationHealth(): Promise<void> {
    try {
      const response = await fetch('/api/health');
      const health = await response.json();
      
      // Send metrics to your monitoring system
      this.recordMetric('app.health.status', health.status === 'healthy' ? 1 : 0);
      this.recordMetric('app.health.uptime', health.uptime);
      this.recordMetric('app.health.startup_duration', health.details.metrics.startupDuration);
      
      // Alert on errors
      if (health.details.errors.length > 0) {
        this.sendAlert('Application health check failed', health.details.errors);
      }
      
      // Track database response time
      if (health.checks.database.responseTime) {
        this.recordMetric('app.database.response_time', health.checks.database.responseTime);
      }
      
    } catch (error) {
      this.sendAlert('Health endpoint unreachable', [error.message]);
    }
  }
  
  private recordMetric(name: string, value: number): void {
    // Send to your metrics system (DataDog, Prometheus, etc.)
  }
  
  private sendAlert(title: string, details: string[]): void {
    // Send to your alerting system (PagerDuty, Slack, etc.)
  }
}
```

### Environment-Specific Configuration

```typescript
// config/startup-validation.ts
export const startupValidationConfig = {
  development: {
    database: { required: false, timeout: 5000 },
    telemetry: { required: false },
    gracefulShutdownTimeout: 5000,
  },
  production: {
    database: { required: true, timeout: 10000 },
    telemetry: { required: true },
    gracefulShutdownTimeout: 30000,
  },
  test: {
    database: { required: false, timeout: 2000 },
    telemetry: { required: false },
    gracefulShutdownTimeout: 2000,
  }
};
```

## 6. Troubleshooting

### Common Issues

1. **Database connectivity failures**
   ```bash
   # Check database health specifically
   curl http://localhost:3000/api/health | jq '.checks.database'
   ```

2. **Slow startup times**
   ```bash
   # Check startup metrics
   curl http://localhost:3000/api/health | jq '.details.metrics.validationSteps'
   ```

3. **Memory issues**
   ```bash
   # Check memory usage
   curl http://localhost:3000/api/health/liveness | jq '.memory'
   ```

4. **Graceful shutdown not working**
   ```bash
   # Check if handlers are registered
   docker logs <container-id> | grep "Shutdown handler registered"
   ```

### Debug Mode

```typescript
// Enable debug logging for startup validation
process.env.DEBUG_STARTUP = "true";

// Enable debug logging for graceful shutdown
process.env.DEBUG_SHUTDOWN = "true";
```

This comprehensive system provides robust startup validation, health monitoring, and graceful shutdown capabilities that are essential for production applications running in containerized environments.