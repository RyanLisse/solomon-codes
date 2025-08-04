# GitHub Secrets Setup for CI/CD Pipeline

## 📋 Required GitHub Secrets

### 🔑 Core API Keys & Services

Add these secrets in your GitHub repository settings (`Settings > Secrets and variables > Actions`):

```bash
# OpenAI API Key
OPENAI_API_KEY=sk-your_openai_api_key_here

# E2B Code Execution Platform
E2B_API_KEY=your_e2b_api_key_here

# Browserbase Browser Automation
BROWSERBASE_API_KEY=your_browserbase_api_key_here
BROWSERBASE_PROJECT_ID=your_browserbase_project_id_here

# Database (Railway PostgreSQL)
DATABASE_URL=postgresql://user:password@railway.app:5432/database

# Security
JWT_SECRET=your_jwt_secret_minimum_32_characters_for_security

# GitHub OAuth (for repository access)
GITHUB_CLIENT_ID=your_github_oauth_app_client_id
GITHUB_CLIENT_SECRET=your_github_oauth_app_client_secret
```

### 🚀 Deployment Secrets

```bash
# Railway Deployment
RAILWAY_TOKEN=your_railway_api_token
RAILWAY_SERVICE_ID=your_railway_service_id

# Vercel Deployment (if using Vercel)
VERCEL_TOKEN=your_vercel_token
VERCEL_ORG_ID=your_vercel_org_id
VERCEL_PROJECT_ID=your_vercel_project_id

# Public URLs
NEXT_PUBLIC_SERVER_URL=https://your-app.railway.app
```

### 🔒 Optional Security & Monitoring

```bash
# Security Scanning
SNYK_TOKEN=your_snyk_token

# Notifications
SLACK_WEBHOOK=your_slack_webhook_url

# Code Coverage
CODECOV_TOKEN=your_codecov_token
```

## 🛠️ How to Add Secrets in GitHub

### 1. Navigate to Repository Settings

- Go to your GitHub repository
- Click **Settings** tab
- Click **Secrets and variables** → **Actions**

### 2. Add Each Secret

- Click **New repository secret**
- Enter the **Name** (e.g., `OPENAI_API_KEY`)
- Enter the **Value** (your actual API key)
- Click **Add secret**

### 3. Verify Secrets are Added

Your secrets list should include all the required variables above.

## 🔑 How to Get API Keys

### OpenAI API Key

1. Visit [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create new API key
3. Format: `sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### E2B API Key

1. Visit [E2B Platform](https://e2b.dev)
2. Sign up and get API key
3. Minimum 32 characters required

### Browserbase

1. Visit [Browserbase](https://www.browserbase.com)
2. Create project and get:
   - API key (`BROWSERBASE_API_KEY`)
   - Project ID (`BROWSERBASE_PROJECT_ID`)

### Railway

1. Visit [Railway](https://railway.app)
2. Go to Account Settings → Tokens
3. Generate new token for `RAILWAY_TOKEN`
4. Get service ID from your project URL

### GitHub OAuth App

1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Create new OAuth app
3. Set authorization callback URL: `https://your-app.railway.app/api/auth/github/callback`
4. Get Client ID and Client Secret

## 🎯 CI/CD Workflow Behavior

### Current Workflow Features

- ✅ **Quality checks**: Biome linting, ESLint, TypeScript
- ✅ **Unit tests**: Both Bun and Vitest test runners
- ✅ **E2E tests**: Playwright with multiple browsers
- ✅ **Build validation**: Multi-platform deployment builds
- ✅ **Security scanning**: npm audit and Snyk
- ✅ **Auto deployment**: Staging (develop) and Production (main)

### Branch Workflow

- **Pull Requests**: Runs quality, tests, and build validation
- **Develop Branch**: Deploys to staging environment
- **Main Branch**: Deploys to production environment

### Environment Validation

The workflow uses placeholder values during build/CI phases and real secrets during deployment, thanks to the updated environment validation script.

## ⚠️ Security Best Practices

1. **Never commit secrets to git** - always use GitHub Secrets
2. **Use different secrets for staging/production** - separate environments
3. **Rotate API keys regularly** - especially production keys
4. **Use minimum required permissions** - scope API keys appropriately
5. **Monitor secret usage** - review access logs periodically

## 🚨 Current CI/CD Status

**Issue**: The current workflow assumes Vercel deployment but your project is configured for Railway.

**Required Changes**:

- Update the workflow to use Railway deployment instead of Vercel
- Remove Vercel-specific steps and secrets
- Ensure Railway deployment works with your environment validation

The environment validation and build scripts are already configured correctly for Railway deployment. The GitHub Actions workflow needs to be updated to match your Railway setup.

## ✅ Next Steps

1. **Add all required secrets** to your GitHub repository
2. **Update the workflow file** to use Railway instead of Vercel
3. **Test the pipeline** by pushing to develop branch first
4. **Verify deployment** works correctly before merging to main

Once these secrets are added, your CI/CD pipeline will have everything needed to build, test, and deploy your application successfully.
