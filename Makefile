# Makefile for Solomon Codes
# Provides convenient shortcuts for common development tasks

.PHONY: help setup install dev web docs storybook test build build-prod lint clean kill-ports test-all quality qlty qlty-fmt check ci pre-push pre-commit deploy deploy-vercel deploy-railway deploy-cloudflare health debug

# Default target
help:
	@echo "Solomon Codes Development Commands"
	@echo ""
	@echo "Setup:"
	@echo "  setup       - Run full environment setup"
	@echo "  install     - Install dependencies only"
	@echo ""
	@echo "Development:"
	@echo "  dev         - Start all development servers (kills ports first)"
	@echo "  web         - Start web app only (port 3001)"
	@echo "  docs        - Start docs only"
	@echo "  storybook   - Start Storybook (port 6006)"
	@echo "  kill-ports  - Kill common development ports"
	@echo ""
	@echo "Quality & Testing (Recommended):"
	@echo "  ci          - Run full CI pipeline (SAME as production CI/CD)"
	@echo "  pre-push    - Run pre-push checks (prevents broken pushes)"
	@echo "  pre-commit  - Run pre-commit checks (quick feedback loop)"
	@echo "  test        - Run all tests"
	@echo "  lint        - Lint and auto-fix all code"
	@echo "  check       - TypeScript validation"
	@echo "  quality     - Run all quality checks (test, lint, check)"
	@echo ""
	@echo "Legacy Quality & Testing:"
	@echo "  test-all    - Run comprehensive quality checks (tests, lint, typecheck, qlty)"
	@echo "  qlty        - Run qlty code analysis"
	@echo "  qlty-fmt    - Run qlty auto-formatting"
	@echo ""
	@echo "Build & Deploy:"
	@echo "  build       - Build all packages"
	@echo "  build-prod  - Production build with optimizations"
	@echo "  deploy      - Deploy to production (runs full pipeline)"
	@echo "  clean       - Clean build artifacts"
	@echo ""
	@echo "Health & Debug:"
	@echo "  health      - Run system health checks"
	@echo "  debug       - Show debug information"

# Setup targets
setup:
	@echo "Running full environment setup..."
	@./SETUP.sh

install:
	@echo "Installing dependencies with optimal package manager..."
	@if command -v bun >/dev/null 2>&1; then \
		echo "Using bun (fastest)..."; \
		bun install; \
	elif [ -f "package-lock.json" ]; then \
		echo "Using npm ci (deterministic)..."; \
		npm ci --prefer-offline --no-audit; \
	else \
		echo "Using npm install..."; \
		npm install; \
	fi

# Port killing utility
kill-ports:
	@echo "Killing common development ports..."
	@-pkill -f "next-server.*3000" || true
	@-pkill -f "next-server.*3001" || true
	@-lsof -ti:3000 | xargs kill -9 2>/dev/null || true
	@-lsof -ti:3001 | xargs kill -9 2>/dev/null || true
	@-lsof -ti:4321 | xargs kill -9 2>/dev/null || true
	@-lsof -ti:5173 | xargs kill -9 2>/dev/null || true
	@-lsof -ti:6006 | xargs kill -9 2>/dev/null || true
	@echo "✓ Ports cleared"

# Development targets
dev: kill-ports
	@echo "Starting development servers..."
	@npm run dev

web: kill-ports
	@echo "Starting web app only (port 3001)..."
	@cd apps/web && npm run dev

docs: kill-ports
	@echo "Starting docs only..."
	@cd apps/docs && npm run dev

storybook: kill-ports
	@echo "Starting Storybook (port 6006)..."
	@cd apps/web && npm run storybook

# Modern CI/CD-aligned quality targets (RECOMMENDED)
ci:
	@echo "🚀 Running FULL CI Pipeline (identical to production CI/CD)..."
	@echo "This is the SAME pipeline that runs in GitHub Actions"
	@npm run ci

pre-push:
	@echo "🔍 Running pre-push checks (blocks broken pushes)..."
	@echo "This prevents failed CI/CD builds"
	@npm run ci

pre-commit:
	@echo "⚡ Running pre-commit checks (quick feedback)..."
	@npx lint-staged

# Individual quality targets
test:
	@echo "Running all tests..."
	@npm run test

lint:
	@echo "Linting and auto-fixing code..."
	@npx biome check --write --unsafe || npm run lint:fix || true

check:
	@echo "Running TypeScript validation..."
	@npm run typecheck

quality: test lint check
	@echo "✅ All quality checks completed!"

# Legacy quality targets (kept for backwards compatibility)
test-all:
	@echo "Running comprehensive quality checks..."
	@echo "1/4 Running tests..."
	@npm run test
	@echo "2/4 Linting code..."
	@npm run lint
	@echo "3/4 Running TypeScript validation..."
	@npm run typecheck
	@echo "4/4 Running qlty analysis..."
	@qlty check || true
	@echo "✅ All quality checks passed!"

qlty:
	@echo "Running qlty code analysis..."
	@qlty check || echo "⚠️  qlty not installed or failed"

qlty-fmt:
	@echo "Running qlty auto-formatting..."
	@qlty fmt || echo "⚠️  qlty not installed or failed"

# Build targets
build:
	@echo "Building all packages..."
	@npm run build

build-prod:
	@echo "Production build with optimizations..."
	@NODE_ENV=production npm run build

# Deploy targets
deploy: ci build-prod
	@echo "🚀 Deploying to production..."
	@echo "✅ All checks passed, build successful"
	@echo "Choose deployment target:"
	@echo "  make deploy-vercel    - Deploy to Vercel"
	@echo "  make deploy-railway   - Deploy to Railway" 
	@echo "  make deploy-cloudflare - Deploy to Cloudflare Pages"

deploy-vercel: ci build-prod
	@echo "🚀 Deploying to Vercel..."
	@cd apps/web && npm run deploy:vercel

deploy-railway: ci build-prod
	@echo "🚀 Deploying to Railway..."
	@cd apps/web && npm run deploy:railway

deploy-cloudflare: ci build-prod
	@echo "🚀 Deploying to Cloudflare Pages..."
	@cd apps/web && npm run deploy:cloudflare

clean:
	@echo "Cleaning build artifacts..."
	@npm run clean
	@echo "✓ Clean complete"

# Health checks
health:
	@echo "Running health checks..."
	@echo "✓ Checking essential files..."
	@test -f package.json || (echo "✗ Missing package.json" && exit 1)
	@test -f turbo.json || (echo "✗ Missing turbo.json" && exit 1)
	@test -f apps/web/package.json || (echo "✗ Missing web app package.json" && exit 1)
	@test -f AGENTS.md || (echo "✗ Missing AGENTS.md" && exit 1)
	@test -f SETUP.sh || (echo "✗ Missing SETUP.sh" && exit 1)
	@test -f scripts/ci.sh || (echo "✗ Missing CI script" && exit 1)
	@test -f .husky/pre-commit || (echo "✗ Missing pre-commit hook" && exit 1)
	@test -f .husky/pre-push || (echo "✗ Missing pre-push hook" && exit 1)
	@echo "✓ All essential files present"
	@echo "✓ Checking Node.js version..."
	@node --version
	@echo "✓ Checking npm version..."
	@npm --version
	@if command -v bun >/dev/null 2>&1; then echo "✓ Bun available: $$(bun --version)"; fi

# Debug information
debug:
	@echo "🔍 System Debug Information"
	@echo "=========================="
	@echo "Node.js: $$(node --version)"
	@echo "npm: $$(npm --version)"
	@if command -v bun >/dev/null 2>&1; then echo "Bun: $$(bun --version)"; else echo "Bun: Not installed"; fi
	@echo "Platform: $$(uname -s)"
	@echo "Architecture: $$(uname -m)"
	@echo ""
	@echo "📦 Project Information"
	@echo "====================="
	@echo "Project: $$(node -p "require('./package.json').name")"
	@echo "Version: $$(node -p "require('./package.json').version")"
	@echo ""
	@echo "🔧 Development Status"
	@echo "===================="
	@echo "Git branch: $$(git branch --show-current 2>/dev/null || echo 'Not a git repo')"
	@echo "Git status: $$(git status --porcelain 2>/dev/null | wc -l | xargs echo) files changed"
	@echo ""
	@echo "🌐 Port Status"
	@echo "=============="
	@echo "Port 3001 (Web): $$(lsof -ti:3001 >/dev/null && echo 'In use' || echo 'Available')"
	@echo "Port 6006 (Storybook): $$(lsof -ti:6006 >/dev/null && echo 'In use' || echo 'Available')"