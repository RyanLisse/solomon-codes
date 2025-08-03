# Makefile for Solomon Codes
# Provides convenient shortcuts for common development tasks

.PHONY: help setup dev test build lint clean

# Default target
help:
	@echo "Solomon Codes Development Commands"
	@echo ""
	@echo "Setup:"
	@echo "  setup    - Run full environment setup"
	@echo "  install  - Install dependencies only"
	@echo ""
	@echo "Development:"
	@echo "  dev      - Start all development servers"
	@echo "  web      - Start web app only (port 3001)"
	@echo "  docs     - Start docs only"
	@echo ""
	@echo "Quality:"
	@echo "  test     - Run all tests"
	@echo "  lint     - Lint all code"
	@echo "  check    - TypeScript validation"
	@echo ""
	@echo "Build:"
	@echo "  build    - Build all packages"
	@echo "  clean    - Clean build artifacts"

# Setup targets
setup:
	@echo "Running full environment setup..."
	./SETUP.sh

install:
	@echo "Installing dependencies..."
	bun install

# Development targets
dev:
	@echo "Starting development servers..."
	bun run dev

web:
	@echo "Starting web app only..."
	bun run -F web dev

docs:
	@echo "Starting docs only..."
	bun run -F docs dev

# Quality targets
test:
	@echo "Running all tests..."
	bun run test

lint:
	@echo "Linting code..."
	bun run lint

check:
	@echo "Running TypeScript validation..."
	bun run typecheck

# Build targets
build:
	@echo "Building all packages..."
	bun run build

clean:
	@echo "Cleaning build artifacts..."
	bun run clean

# Health checks
health:
	@echo "Running health checks..."
	@echo "✓ Checking essential files..."
	@test -f package.json || (echo "✗ Missing package.json" && exit 1)
	@test -f turbo.json || (echo "✗ Missing turbo.json" && exit 1)
	@test -f apps/web/package.json || (echo "✗ Missing web app package.json" && exit 1)
	@test -f AGENTS.md || (echo "✗ Missing AGENTS.md" && exit 1)
	@test -f SETUP.sh || (echo "✗ Missing SETUP.sh" && exit 1)
	@echo "✓ All essential files present"