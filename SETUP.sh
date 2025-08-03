#!/bin/bash

# SETUP.sh - Idempotent environment setup for Solomon Codes
# Prepares the codebase for agentic development tools

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Node.js version
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed. Please install Node.js >= 20.18.1"
        exit 1
    fi
    
    local node_version=$(node --version | cut -d'v' -f2)
    local required_version="20.18.1"
    if ! printf '%s\n%s\n' "$required_version" "$node_version" | sort -V -C; then
        log_error "Node.js version $node_version is too old. Required: >= $required_version"
        exit 1
    fi
    
    # Check Bun
    if ! command -v bun &> /dev/null; then
        log_warning "Bun not found. Installing Bun..."
        curl -fsSL https://bun.sh/install | bash
        export PATH="$HOME/.bun/bin:$PATH"
    fi
    
    # Check PostgreSQL
    if ! command -v psql &> /dev/null; then
        log_warning "PostgreSQL not found. Please install PostgreSQL for database functionality"
    fi
    
    log_success "Prerequisites check completed"
}

# Install dependencies
install_dependencies() {
    log_info "Installing dependencies..."
    
    if [ -f "bun.lock" ]; then
        bun install --frozen-lockfile
    else
        bun install
    fi
    
    log_success "Dependencies installed"
}

# Setup environment files
setup_environment() {
    log_info "Setting up environment files..."
    
    # Copy .env.example to .env in web app if not exists
    if [ ! -f "apps/web/.env" ]; then
        if [ -f "apps/web/.env.example" ]; then
            cp apps/web/.env.example apps/web/.env
            log_success "Created apps/web/.env from .env.example"
            log_warning "Please configure API keys in apps/web/.env"
        else
            log_error "apps/web/.env.example not found"
            exit 1
        fi
    else
        log_info "apps/web/.env already exists"
    fi
    
    # Create logs directory
    mkdir -p logs
    mkdir -p apps/web/logs
    
    log_success "Environment setup completed"
}

# Setup database
setup_database() {
    log_info "Setting up database..."
    
    # Check if DATABASE_URL is configured
    if [ -f "apps/web/.env" ]; then
        if grep -q "DATABASE_URL=postgresql://" apps/web/.env; then
            log_info "Database URL configured"
        else
            log_warning "DATABASE_URL not configured. Database features may not work"
        fi
    fi
    
    log_success "Database setup completed"
}

# Validate configuration
validate_setup() {
    log_info "Validating setup..."
    
    # Check if we can run basic commands
    if ! bun run --silent typecheck &> /dev/null; then
        log_warning "TypeScript validation failed. Run 'bun run typecheck' to see issues"
    else
        log_success "TypeScript validation passed"
    fi
    
    # Check if essential files exist
    local essential_files=(
        "package.json"
        "turbo.json"
        "apps/web/package.json"
        "apps/web/next.config.ts"
        "apps/web/.env"
    )
    
    for file in "${essential_files[@]}"; do
        if [ ! -f "$file" ]; then
            log_error "Essential file missing: $file"
            exit 1
        fi
    done
    
    log_success "Configuration validation completed"
}

# Create helpful shortcuts
create_shortcuts() {
    log_info "Creating development shortcuts..."
    
    # Create a simple development helper script
    cat > dev.sh << 'EOF'
#!/bin/bash
# Quick development commands for Solomon Codes

case "$1" in
    "start"|"dev")
        echo "Starting development servers..."
        bun run dev
        ;;
    "web")
        echo "Starting web app only..."
        bun run -F web dev
        ;;
    "test")
        echo "Running all tests..."
        bun run test
        ;;
    "lint")
        echo "Linting code..."
        bun run lint
        ;;
    "build")
        echo "Building all packages..."
        bun run build
        ;;
    *)
        echo "Usage: ./dev.sh [start|web|test|lint|build]"
        echo "  start - Start all development servers"
        echo "  web   - Start web app only"
        echo "  test  - Run all tests"
        echo "  lint  - Lint code"
        echo "  build - Build all packages"
        ;;
esac
EOF
    
    chmod +x dev.sh
    log_success "Created dev.sh helper script"
}

# Main execution
main() {
    log_info "Starting Solomon Codes environment setup..."
    
    check_prerequisites
    install_dependencies
    setup_environment
    setup_database
    validate_setup
    create_shortcuts
    
    log_success "Setup completed successfully!"
    echo
    log_info "Next steps:"
    echo "  1. Configure API keys in apps/web/.env"
    echo "  2. Set up PostgreSQL database connection"
    echo "  3. Run: ./dev.sh start (or bun run dev)"
    echo "  4. Visit: http://localhost:3001"
    echo
    log_info "Quick commands:"
    echo "  ./dev.sh start  - Start development"
    echo "  ./dev.sh test   - Run tests"
    echo "  ./dev.sh lint   - Check code quality"
}

# Run main function
main "$@"