#!/bin/bash

# CI Script - Mirror of GitHub Actions workflow
# This script runs the exact same steps as our CI/CD pipeline
# Run locally: npm run ci
# Used in CI: .github/workflows/ci.yml

set -euo pipefail  # Fail fast on any error

# Ensure we're in the project root
cd "$(dirname "$0")/.."

echo "🚀 Starting CI pipeline..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_step() {
    echo -e "${BLUE}📋 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Step 1: Install dependencies (same as CI)
print_step "Installing dependencies..."
if [ -f "package-lock.json" ]; then
    npm ci --prefer-offline --no-audit
elif [ -f "bun.lockb" ]; then
    print_warning "Using bun install (npm ci preferred for CI/CD consistency)"
    bun install
else
    print_warning "No lockfile found, running npm install (not recommended for CI)"
    npm install
fi
print_success "Dependencies installed"

# Step 2: Lint and format check
print_step "Running linter and format checks..."
if npm run check; then
    print_success "Linting passed"
else
    print_error "Linting failed"
    exit 1
fi

# Step 3: Type checking
print_step "Running TypeScript type checking..."
if npm run typecheck; then
    print_success "Type checking passed"
else
    print_error "Type checking failed"
    exit 1
fi

# Step 4: Run tests
print_step "Running tests..."
if npm run test; then
    print_success "Tests passed"
else
    print_error "Tests failed"
    exit 1
fi

# Step 5: Production build test
print_step "Testing production build..."
if npm run build; then
    print_success "Production build successful"
else
    print_error "Production build failed"
    exit 1
fi

# Optional: Bundle size check (if configured)
print_step "Checking bundle sizes..."
cd apps/web
if [ -f "next.config.ts" ]; then
    # Check if build output exists and report sizes
    if [ -d ".next" ]; then
        du -sh .next/ | sed 's/^/📦 Bundle size: /'
    fi
fi
cd ../..

print_success "🎉 All CI checks passed!"
echo ""
echo "✨ Your code is ready for deployment!"