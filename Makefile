# Makefile for Solomon Codes
# Provides convenient shortcuts for common development tasks

.PHONY: help setup dev test build lint clean kill-ports test-all quality qlty qlty-fmt check

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
	@echo "  kill-ports  - Kill common development ports"
	@echo ""
	@echo "Quality & Testing:"
	@echo "  test        - Run all tests"
	@echo "  test-all    - Run comprehensive quality checks (tests, lint, typecheck, qlty)"
	@echo "  lint        - Lint all code"
	@echo "  check       - TypeScript validation"
	@echo "  quality     - Run all quality checks (test, lint, check, qlty)"
	@echo "  qlty        - Run qlty code analysis"
	@echo "  qlty-fmt    - Run qlty auto-formatting"
	@echo ""
	@echo "Build:"
	@echo "  build       - Build all packages"
	@echo "  clean       - Clean build artifacts"

# Setup targets
setup:
	@echo "Running full environment setup..."
	./SETUP.sh

install:
	@echo "Installing dependencies..."
	bun install

# Port killing utility
kill-ports:
	@echo "Killing common development ports..."
	@-pkill -f "next-server.*3000" || true
	@-pkill -f "next-server.*3001" || true
	@-lsof -ti:3000 | xargs kill -9 2>/dev/null || true
	@-lsof -ti:3001 | xargs kill -9 2>/dev/null || true
	@-lsof -ti:4321 | xargs kill -9 2>/dev/null || true
	@-lsof -ti:5173 | xargs kill -9 2>/dev/null || true
	@echo "✓ Ports cleared"

# Development targets
dev: kill-ports
	@echo "Starting development servers..."
	bun run dev

web: kill-ports
	@echo "Starting web app only..."
	bun run -F web dev

docs: kill-ports
	@echo "Starting docs only..."
	bun run -F docs dev

# Quality targets
test:
	@echo "Running all tests..."
	bun run test

test-all:
	@echo "Running comprehensive quality checks..."
	@echo "1/4 Running tests..."
	bun run test
	@echo "2/4 Linting code..."
	bun run lint
	@echo "3/4 Running TypeScript validation..."
	bun run typecheck
	@echo "4/4 Running qlty analysis..."
	qlty check
	@echo "✅ All quality checks passed!"

lint:
	@echo "Linting code..."
	bun run lint

check:
	@echo "Running TypeScript validation..."
	bun run typecheck

qlty:
	@echo "Running qlty code analysis..."
	qlty check

qlty-fmt:
	@echo "Running qlty auto-formatting..."
	qlty fmt

quality: test lint check qlty
	@echo "✅ All quality checks completed!"

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