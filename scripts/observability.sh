#!/bin/bash

# VibeX Observability Stack Management Script
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.observability.yml"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running"
        exit 1
    fi
}

start_observability() {
    log_info "Starting VibeX observability stack..."
    check_docker
    
    cd "$PROJECT_ROOT"
    docker-compose -f "$COMPOSE_FILE" up -d
    
    log_info "Waiting for services to be healthy..."
    sleep 10
    
    # Check Jaeger health
    if curl -f -s http://localhost:16686/api/services > /dev/null 2>&1; then
        log_success "Jaeger UI is accessible at http://localhost:16686"
    else
        log_warning "Jaeger UI may not be ready yet. Check http://localhost:16686 in a few moments."
    fi
    
    # Check OTLP endpoint
    if curl -f -s http://localhost:4318/v1/traces > /dev/null 2>&1; then
        log_success "OTLP HTTP endpoint is accessible at http://localhost:4318"
    else
        log_warning "OTLP endpoint may not be ready yet."
    fi
    
    log_success "Observability stack started successfully!"
    echo ""
    echo "📊 Access Points:"
    echo "  - Jaeger UI: http://localhost:16686"
    echo "  - OTLP HTTP: http://localhost:4318/v1/traces"
    echo "  - OTLP gRPC: http://localhost:4317"
}

stop_observability() {
    log_info "Stopping VibeX observability stack..."
    cd "$PROJECT_ROOT"
    docker-compose -f "$COMPOSE_FILE" down
    log_success "Observability stack stopped"
}

restart_observability() {
    stop_observability
    start_observability
}

status_observability() {
    log_info "Checking observability stack status..."
    cd "$PROJECT_ROOT"
    docker-compose -f "$COMPOSE_FILE" ps
}

logs_observability() {
    cd "$PROJECT_ROOT"
    docker-compose -f "$COMPOSE_FILE" logs -f "${2:-}"
}

test_traces() {
    log_info "Testing trace collection..."
    
    # Test OTLP HTTP endpoint
    if curl -f -s -X POST http://localhost:4318/v1/traces \
        -H "Content-Type: application/json" \
        -d '{"resourceSpans":[]}' > /dev/null; then
        log_success "OTLP HTTP endpoint is responding"
    else
        log_error "OTLP HTTP endpoint is not responding"
        return 1
    fi
    
    log_info "Make some requests to your VibeX application to generate traces"
    log_info "Then check Jaeger UI at http://localhost:16686"
}

case "${1:-}" in
    start)
        start_observability
        ;;
    stop)
        stop_observability
        ;;
    restart)
        restart_observability
        ;;
    status)
        status_observability
        ;;
    logs)
        logs_observability "$@"
        ;;
    test)
        test_traces
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs|test}"
        echo ""
        echo "Commands:"
        echo "  start   - Start the observability stack"
        echo "  stop    - Stop the observability stack"
        echo "  restart - Restart the observability stack"
        echo "  status  - Show status of observability services"
        echo "  logs    - Show logs (optionally specify service name)"
        echo "  test    - Test trace collection endpoints"
        exit 1
        ;;
esac
