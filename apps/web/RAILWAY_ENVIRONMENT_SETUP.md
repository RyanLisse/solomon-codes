# Railway CI/CD Environment Variables Setup

## Required Environment Variables

### Critical API Keys (Production/Staging Required)

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

### Platform Variables (Auto-set by Railway)

```bash
# Node.js Environment
NODE_ENV=production

# Railway Platform Variables (automatically set)
RAILWAY_ENVIRONMENT=production
RAILWAY_PROJECT_ID=auto_set_by_railway
RAILWAY_SERVICE_ID=auto_set_by_railway

# Public URLs
NEXT_PUBLIC_SERVER_URL=https://your-app.railway.app
```

### Optional Configuration

```bash
# Logging
LOG_LEVEL=info
SERVICE_NAME=solomon-codes-web
SERVICE_VERSION=0.1.0

# OpenTelemetry (optional for production monitoring)
OTEL_EXPORTER_OTLP_ENDPOINT=https://your-jaeger-endpoint.com/v1/traces
OTEL_SAMPLING_RATIO=0.1

# Voice Features (optional)
LETTA_API_KEY=your_letta_api_key_here
LETTA_BASE_URL=https://api.letta.com
NEXT_PUBLIC_LETTA_API_URL=https://api.letta.com
```

## Railway Setup Instructions

### 1. Add Environment Variables in Railway Dashboard

1. Go to your Railway project dashboard
2. Navigate to **Variables** tab
3. Add each required environment variable above
4. Click **Deploy** to apply changes

### 2. Verify Environment Configuration

Run the validation script to ensure all variables are properly configured:

```bash
# Local test (with your variables)
NODE_ENV=production RAILWAY_ENVIRONMENT=production node scripts/validate-build-env.js
```

### 3. Deploy to Railway

Railway will automatically:
- Set `RAILWAY_ENVIRONMENT=production`
- Set `NODE_ENV=production`
- Use your configured environment variables
- Build and deploy the application

## Security Notes

⚠️ **Important Security Considerations:**

1. **Never commit secrets to git** - use Railway's environment variable system
2. **Use strong JWT secrets** - minimum 32 characters, cryptographically secure
3. **Rotate API keys regularly** - especially in production environments
4. **Use Railway's PostgreSQL** - for automatic backups and scaling
5. **Enable HTTPS only** - Railway provides SSL certificates automatically

## Validation Status

✅ Environment validation script updated to allow placeholder values during build/CI
✅ Railway deployment target configuration optimized
✅ All required variables properly validated for production deployment

## Getting API Keys

### OpenAI API Key
1. Visit [OpenAI API](https://platform.openai.com/api-keys)
2. Create new API key
3. Format: `sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### E2B API Key
1. Visit [E2B Platform](https://e2b.dev)
2. Sign up and get API key
3. Minimum 32 characters required

### Browserbase
1. Visit [Browserbase](https://browserbase.com)
2. Create project and get API key + project ID

### GitHub OAuth App
1. Go to GitHub Settings > Developer settings > OAuth Apps
2. Create new OAuth app
3. Set authorization callback URL to: `https://your-app.railway.app/api/auth/github/callback`
4. Get Client ID and Client Secret

## Deployment Health Check

After deployment, verify the application is running:

- Health endpoint: `https://your-app.railway.app/api/health`
- Version endpoint: `https://your-app.railway.app/api/version`
- Ready endpoint: `https://your-app.railway.app/api/ready`