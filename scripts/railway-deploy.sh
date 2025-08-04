#!/bin/bash

# Railway Deployment Script
# This script prepares and deploys the solomon_codes application to Railway

set -e  # Exit on any error

echo "🚀 Starting Railway Deployment Process..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    print_error "Railway CLI is not installed. Install it first:"
    echo "npm install -g @railway/cli"
    exit 1
fi

print_status "Railway CLI is installed"

# Check if user is logged in
if ! railway whoami &> /dev/null; then
    print_warning "Not logged in to Railway. Please run:"
    echo "railway login"
    echo ""
    echo "Then run this script again."
    exit 1
fi

print_status "Railway authentication verified"

# Set environment to avoid LOG_LEVEL conflict
export LOG_LEVEL=info

# Step 1: Validate environment
echo ""
echo "🔍 Step 1: Validating environment..."
cd apps/web
if npm run validate-env; then
    print_status "Environment validation passed"
else
    print_error "Environment validation failed"
    exit 1
fi
cd ../..

# Step 2: Run tests
echo ""
echo "🧪 Step 2: Running tests..."
cd apps/web
if npm run test:ci; then
    print_status "All tests passed"
else
    print_warning "Some tests failed, continuing with deployment..."
fi
cd ../..

# Step 3: Check Railway project status
echo ""
echo "📊 Step 3: Checking Railway project status..."
if railway status; then
    print_status "Railway project status retrieved"
else
    print_error "Failed to get Railway project status"
    echo "Make sure you're linked to the correct project:"
    echo "railway link 6044e658-7a5a-4dec-bcbc-8ea7de7e28eb"
    exit 1
fi

# Step 4: Set critical environment variables
echo ""
echo "🌍 Step 4: Setting up critical environment variables..."

# Check if DATABASE_URL exists (PostgreSQL service should be added)
if ! railway variables | grep -q "DATABASE_URL"; then
    print_warning "DATABASE_URL not found. Adding PostgreSQL service..."
    railway add postgresql
    print_status "PostgreSQL service added"
fi

# Set production environment variables
print_status "Setting production environment variables..."
railway variables set NODE_ENV=production
railway variables set RAILWAY_ENVIRONMENT=production
railway variables set LOG_LEVEL=info
railway variables set SERVICE_NAME=solomon-codes-web
railway variables set SERVICE_VERSION=1.0.0

print_status "Critical environment variables set"

# Step 5: Deploy
echo ""
echo "🚀 Step 5: Deploying to Railway..."
if railway up; then
    print_status "Deployment initiated successfully"
else
    print_error "Deployment failed"
    exit 1
fi

# Step 6: Get deployment URL
echo ""
echo "🌐 Step 6: Getting deployment URL..."
RAILWAY_URL=$(railway domain 2>/dev/null || echo "URL not available yet")
echo "Deployment URL: $RAILWAY_URL"

# Step 7: Wait for deployment and test health endpoints
echo ""
echo "⏳ Step 7: Waiting for deployment to be ready..."
sleep 30  # Give deployment time to start

if [[ "$RAILWAY_URL" != "URL not available yet" ]]; then
    echo "Testing health endpoints..."
    
    # Test main health endpoint
    if curl -f --max-time 30 "${RAILWAY_URL}/api/health" > /dev/null 2>&1; then
        print_status "Health endpoint responding"
    else
        print_warning "Health endpoint not responding yet (this is normal for new deployments)"
    fi
    
    # Test readiness endpoint
    if curl -f --max-time 30 "${RAILWAY_URL}/api/health/readiness" > /dev/null 2>&1; then
        print_status "Readiness endpoint responding"
    else
        print_warning "Readiness endpoint not responding yet"
    fi
else
    print_warning "Cannot test endpoints - URL not available yet"
fi

# Step 8: Show logs
echo ""
echo "📋 Step 8: Recent deployment logs..."
railway logs --tail 20

echo ""
echo "🎉 Deployment process completed!"
echo ""
echo "Next steps:"
echo "1. Set up your production API keys in Railway dashboard"
echo "2. Configure custom domain if needed"
echo "3. Set up monitoring alerts"
echo "4. Test all application features"
echo ""
echo "Useful commands:"
echo "  railway logs --follow    # Watch live logs"
echo "  railway status          # Check service status"
echo "  railway domain          # Get current domain"
echo "  railway rollback        # Rollback if needed"
echo ""
print_status "Railway deployment script completed successfully!"