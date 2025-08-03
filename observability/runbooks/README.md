# VibeX Observability Runbooks

This directory contains runbooks for troubleshooting common issues in the VibeX application.

## Quick Reference

### Alert Severity Levels

- **Critical**: Immediate action required, service degradation or outage
- **Warning**: Attention needed, potential issues developing
- **Info**: Informational, no immediate action required

### Common Commands

```bash
# Check observability stack status
./scripts/observability.sh status

# View logs
./scripts/observability.sh logs jaeger
./scripts/observability.sh logs otel-collector

# Restart observability stack
./scripts/observability.sh restart

# Test trace collection
./scripts/observability.sh test
```

### Access Points

- **Jaeger UI**: http://localhost:16686
- **OTLP Endpoint**: http://localhost:4318/v1/traces
- **Application**: http://localhost:3002

## Runbook Index

1. [High Error Rate](./high-error-rate.md)
2. [High Response Time](./high-response-time.md)
3. [VibeKit Operation Failures](./vibekit-failures.md)
4. [GitHub Rate Limit Issues](./github-rate-limit.md)
5. [Database Performance Issues](./database-performance.md)
6. [Infrastructure Issues](./infrastructure-issues.md)

## Escalation Procedures

### Critical Alerts (Severity: Critical)
1. **Immediate Response**: 15 minutes
2. **Escalation**: If not resolved in 30 minutes, escalate to senior engineer
3. **Communication**: Update status page and notify stakeholders
4. **Post-Incident**: Conduct post-mortem within 24 hours

### Warning Alerts (Severity: Warning)
1. **Response Time**: 1 hour during business hours, 4 hours off-hours
2. **Investigation**: Determine root cause and impact
3. **Resolution**: Fix or schedule maintenance window

### Info Alerts (Severity: Info)
1. **Response Time**: Next business day
2. **Review**: Analyze trends and patterns
3. **Action**: Update monitoring thresholds if needed

## Contact Information

- **On-Call Engineer**: [Your on-call system]
- **Team Lead**: [Team lead contact]
- **Infrastructure Team**: [Infrastructure team contact]
- **Status Page**: [Your status page URL]

## Monitoring Tools

- **Traces**: Jaeger UI
- **Metrics**: [Your metrics dashboard]
- **Logs**: [Your log aggregation system]
- **APM**: [Your APM tool if different]

## Common Troubleshooting Steps

### 1. Check Service Health
```bash
# Check if services are running
docker ps | grep vibeX

# Check application logs
docker logs vibeX-web-app

# Check resource usage
docker stats
```

### 2. Verify Connectivity
```bash
# Test OTLP endpoint
curl -f http://localhost:4318/v1/traces

# Test application endpoint
curl -f http://localhost:3002/api/health

# Check DNS resolution
nslookup your-domain.com
```

### 3. Analyze Traces
1. Open Jaeger UI: http://localhost:16686
2. Select service: `vibeX-web-app`
3. Look for errors and high latency spans
4. Check for missing spans or broken traces

### 4. Review Metrics
1. Check error rates and response times
2. Look for unusual patterns or spikes
3. Compare with historical data
4. Identify correlations between metrics

## Emergency Procedures

### Service Outage
1. **Assess Impact**: Determine scope and affected users
2. **Immediate Action**: Implement quick fixes or rollback
3. **Communication**: Update status page and notify users
4. **Investigation**: Use traces and logs to identify root cause
5. **Resolution**: Apply permanent fix
6. **Follow-up**: Post-mortem and preventive measures

### Data Loss Prevention
1. **Stop Processing**: Prevent further data corruption
2. **Backup**: Secure current state
3. **Assess Damage**: Determine extent of data loss
4. **Recovery**: Restore from backups if necessary
5. **Validation**: Verify data integrity

## Maintenance Procedures

### Planned Maintenance
1. **Schedule**: Announce maintenance window
2. **Preparation**: Prepare rollback plan
3. **Execution**: Follow change management process
4. **Monitoring**: Watch for issues during and after changes
5. **Validation**: Confirm successful deployment

### Emergency Maintenance
1. **Assessment**: Evaluate urgency and impact
2. **Authorization**: Get approval for emergency change
3. **Implementation**: Apply fix with minimal disruption
4. **Communication**: Notify stakeholders of emergency change
5. **Documentation**: Document change and lessons learned
