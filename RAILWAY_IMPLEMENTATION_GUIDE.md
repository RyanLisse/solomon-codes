# Railway CLI Implementation Guide

**Status**: Ready for Manual Implementation  
**Issue**: Railway CLI requires interactive login

---

## 🚀 Step-by-Step Railway Deployment

### **Step 1: Railway Authentication** (2 minutes)

You'll need to login to Railway interactively:

```bash
# Login to Railway (opens browser)
railway login

# Verify login
railway whoami
```

### **Step 2: Link to Existing Project** (1 minute)

```bash
# Link to your existing Railway project
railway link 6044e658-7a5a-4dec-bcbc-8ea7de7e28eb

# Or if creating new project
railway new solomon-codes
```

### **Step 3: Add PostgreSQL Service** (2 minutes)

```bash
# Add PostgreSQL addon
railway add postgresql

# Verify services
railway status
```

### **Step 4: Configure Environment Variables** (10 minutes)

**Option A: Using Railway Dashboard**
1. Go to https://railway.com/project/6044e658-7a5a-4dec-bcbc-8ea7de7e28eb
2. Click on your web service → Variables
3. Copy variables from `apps/web/.env.production`
4. Replace placeholder values with real API keys

**Option B: Using Railway CLI**
```bash
# Set production environment variables
railway variables set NODE_ENV=production
railway variables set RAILWAY_ENVIRONMENT=production
railway variables set LOG_LEVEL=info

# Set API keys (replace with real values)
railway variables set OPENAI_API_KEY=sk-your-real-key
railway variables set E2B_API_KEY=your-real-e2b-key
railway variables set BROWSERBASE_API_KEY=your-real-browserbase-key
railway variables set BROWSERBASE_PROJECT_ID=your-real-project-id

# Set security secrets (generate secure values)
railway variables set JWT_SECRET=$(openssl rand -base64 32)

# Set GitHub OAuth (your production app)
railway variables set GITHUB_CLIENT_ID=your-production-github-client-id
railway variables set GITHUB_CLIENT_SECRET=your-production-github-client-secret

# Set monitoring configuration
railway variables set SERVICE_NAME=solomon-codes-web
railway variables set SERVICE_VERSION=1.0.0
railway variables set OTEL_SAMPLING_RATIO=0.1
```

### **Step 5: Deploy Application** (5 minutes)

```bash
# Deploy to Railway
railway up

# Monitor deployment
railway logs --follow
```

### **Step 6: Verify Deployment** (3 minutes)

```bash
# Get deployed URL
railway domain

# Test health endpoints
curl -f https://your-app.railway.app/api/health
curl -f https://your-app.railway.app/api/health/readiness
curl -f https://your-app.railway.app/api/health/liveness

# Check logs for any issues
railway logs
```

---

## 🛠️ Pre-configured Files Ready

✅ **Dockerfile** - Multi-stage production build  
✅ **railway.json** - Enhanced configuration with health checks  
✅ **GitHub Actions** - CI/CD pipeline ready  
✅ **Environment Template** - Complete production config  

---

## 🚨 Important Notes

### **Environment Variable Priority**
Your system has `LOG_LEVEL=INFO` set globally. For Railway deployment, ensure:
```bash
# Either unset system variable
unset LOG_LEVEL

# Or override in Railway
railway variables set LOG_LEVEL=info
```

### **Security Considerations**
- Never commit real API keys to git
- Use Railway's built-in secrets management
- Generate secure JWT_SECRET (32+ characters)
- Use production GitHub OAuth app credentials

### **Database Connection**
Railway PostgreSQL will automatically provide:
- `DATABASE_URL` environment variable
- Connection pooling and backups
- SSL encryption enabled

---

## 🔍 Troubleshooting

### **Common Issues**

**1. Build Failures**
```bash
# Check build logs
railway logs --deployment

# Validate environment locally
cd apps/web && LOG_LEVEL=info npm run validate-env
```

**2. Health Check Failures**
```bash
# Test health endpoint locally
npm run dev --workspace=apps/web
curl http://localhost:3001/api/health
```

**3. Database Connection Issues**
```bash
# Check database status
railway status

# Connect to database directly
railway connect postgresql
```

### **Quick Fixes**

**Environment Validation Error:**
```bash
# Fix LOG_LEVEL before deployment
export LOG_LEVEL=info
npm run validate-env --workspace=apps/web
```

**Build Timeout:**
```bash
# Increase Railway build timeout in dashboard
# Or optimize build process
```

---

## ✅ Success Criteria

After deployment, verify:
- [ ] Application accessible at Railway URL
- [ ] Health endpoints return 200 status
- [ ] Database connectivity working
- [ ] No critical errors in logs
- [ ] Environment variables loaded correctly

**Expected Performance:**
- Page load time < 2 seconds
- Memory usage < 512MB
- Zero critical errors

---

## 📞 Next Steps After Deployment

1. **Set up monitoring alerts** in Railway dashboard
2. **Configure custom domain** if needed
3. **Set up GitHub Actions secrets** for automated deployments
4. **Enable Railway's auto-deploy** on git push

**Total Estimated Time: ~25 minutes**