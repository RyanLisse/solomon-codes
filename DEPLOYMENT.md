# Cloudflare Pages Deployment Guide

## 🚀 Quick Deploy to Cloudflare Pages

### Prerequisites

1. **Cloudflare Account**: Sign up at [dash.cloudflare.com](https://dash.cloudflare.com)
2. **GitHub Repository**: Your code should be pushed to GitHub
3. **Environment Variables**: Collect all required API keys

### Step 1: Connect Repository to Cloudflare Pages

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Pages** → **Create a project**
3. Select **Connect to Git** → Choose your GitHub repository
4. Configure the build settings:

```
Project name: solomon-codes
Production branch: main
Build command: cd apps/web && npm run build
Build output directory: apps/web/.next
Root directory: /
Framework preset: Next.js
Node.js version: 18
```

### Step 2: Environment Variables

Add these environment variables in Cloudflare Pages settings:

#### Required Variables

```
BROWSERBASE_API_KEY=your_browserbase_api_key
BROWSERBASE_PROJECT_ID=your_browserbase_project_id
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
OPENAI_API_KEY=your_openai_api_key
E2B_API_KEY=your_e2b_api_key
NODE_ENV=production
```

#### Optional Variables

```
OTEL_EXPORTER_OTLP_ENDPOINT=your_otel_endpoint
OTEL_EXPORTER_OTLP_HEADERS={"authorization":"Bearer your_token"}
OTEL_SAMPLING_RATIO=1.0
```

### Step 3: Deploy

1. Click **Save and Deploy**
2. Cloudflare will automatically build and deploy your app
3. Your app will be available at `https://solomon-codes.pages.dev`

### Step 4: Custom Domain (Optional)

1. Go to your Pages project → **Custom domains**
2. Add your domain name
3. Update DNS records as instructed by Cloudflare

## 🔧 Local Development

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Set up environment variables:**

   ```bash
   cp .env.example .env.local
   # Edit .env.local with your API keys
   ```

3. **Run development server:**

   ```bash
   npm run dev
   ```

4. **Build for production:**

   ```bash
   npm run build
   ```

## 📝 Notes

- **Server Actions**: Your app uses Next.js server actions which are supported by Cloudflare Pages
- **API Routes**: All your `/api/*` routes will work automatically
- **Edge Runtime**: Consider adding `export const runtime = 'edge'` to API routes for better performance
- **Database**: If you need a database, consider Cloudflare D1 or external services

## 🐛 Troubleshooting

### Build Failures

- Check build logs in Cloudflare dashboard
- Ensure all environment variables are set
- Verify Node.js version matches (18)

### Runtime Errors

- Check function logs in Cloudflare dashboard
- Verify API keys are correct
- Check network connectivity to external services

### Performance Issues

- Enable Cloudflare's caching and optimization features
- Consider using Edge Runtime for API routes
- Monitor with Web Analytics and Speed insights

## 🔗 Useful Links

- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [Next.js on Cloudflare](https://developers.cloudflare.com/pages/framework-guides/nextjs/)
- [Environment Variables](https://developers.cloudflare.com/pages/configuration/build-configuration/)
