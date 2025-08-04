#!/bin/bash

# Simple Railway Deployment for Solomon Codes
# This script creates a new service and deploys

set -e

echo "🚀 Railway Deployment for Solomon Codes"
echo "======================================"

# Check authentication
if ! railway whoami &> /dev/null; then
    echo "❌ Not logged in to Railway. Please run 'railway login' first."
    exit 1
fi

echo "✅ Railway authentication verified"

# Get project ID
PROJECT_ID="solomon-codes"
echo "📍 Using project: $PROJECT_ID"

# Set up environment variables (if we can create a service)
echo "🌍 Setting up environment variables..."

# Try to set some basic variables at project level
railway variables set NODE_ENV=production --environment production 2>/dev/null || echo "⚠️  Could not set NODE_ENV"
railway variables set RAILWAY_ENVIRONMENT=production --environment production 2>/dev/null || echo "⚠️  Could not set RAILWAY_ENVIRONMENT"

# Deploy with a simpler approach - just deploy to current project
echo "🚀 Starting deployment..."
echo "📝 Note: If this fails due to multiple services, you'll need to:"
echo "   1. Go to railway.app dashboard"
echo "   2. Create a new service in the solomon-codes project"
echo "   3. Run: railway link --project solomon-codes --service YOUR_NEW_SERVICE_NAME"
echo "   4. Then run: railway up"
echo ""

# Try the deployment
if railway up --detach; then
    echo "✅ Deployment started successfully!"
    echo "🔗 Check your Railway dashboard for deployment status"
    echo "📊 Run 'railway status' to check deployment progress"
    echo "📋 Run 'railway logs' to see deployment logs"
else
    echo "❌ Deployment failed. Manual steps required:"
    echo ""
    echo "Manual Deployment Steps:"
    echo "1. Go to https://railway.app/dashboard"
    echo "2. Open your 'solomon-codes' project"
    echo "3. Click 'New Service' -> 'GitHub Repo'"
    echo "4. Select your solomon-codes repository"
    echo "5. Set Root Directory to: apps/web"
    echo "6. Set Build Command to: npm run build"
    echo "7. Set Start Command to: npm start"
    echo "8. Add environment variables:"
    echo "   - NODE_ENV=production"
    echo "   - RAILWAY_ENVIRONMENT=production"
    echo "9. Click Deploy"
    echo ""
    echo "Alternative CLI approach:"
    echo "1. In Railway dashboard, note your new service name"
    echo "2. Run: railway link --project solomon-codes --service YOUR_SERVICE_NAME"
    echo "3. Run: railway up"
fi

echo ""
echo "🎉 Deployment script completed!"