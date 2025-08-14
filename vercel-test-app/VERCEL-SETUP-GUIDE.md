# Complete Vercel Setup Guide

## Prerequisites

1. **Vercel Account** - You mentioned you have one ✓
2. **Node.js** - Version 16.x or higher
3. **Git** - For version control

## Step 1: Install Vercel CLI

```bash
# Install Vercel CLI globally
npm install -g vercel

# Verify installation
vercel --version
```

## Step 2: Login to Vercel

```bash
# Login to your Vercel account
vercel login

# This will:
# 1. Ask for your email
# 2. Send a verification email
# 3. Click the link in the email to authenticate
```

## Step 3: Prepare the Test Application

```bash
# Navigate to the Edge Agent directory
cd /mnt/c/Users/LAH/Documents/__Development/Optimizely/optimizely-edge-agent/optimizely-edge-agent

# Go to the test app directory
cd vercel-test-app

# Install dependencies
npm install

# Create your environment file
cp .env.example .env.local
```

## Step 4: Configure Environment Variables

Edit `.env.local` with your actual values:

```env
# REQUIRED - Get this from Optimizely
OPTIMIZELY_SDK_KEY=your-actual-optimizely-sdk-key
NEXT_PUBLIC_OPTIMIZELY_SDK_KEY=your-actual-optimizely-sdk-key

# Edge Agent Configuration
OPTIMIZELY_ENABLE_EDGE_MODE=true
OPTIMIZELY_ENABLE_AGENT_MODE=true

# Optional - Metrics (can add later)
# METRICS_PROVIDER=datadog
# DD_API_KEY=your-datadog-key
```

### Where to get your Optimizely SDK Key:

1. Log into [Optimizely](https://app.optimizely.com)
2. Go to Settings → Environments
3. Copy the SDK Key for your environment
4. It looks like: `AbCdEfGhIjKlMnOp123`

## Step 5: Build the Edge Agent First

Before deploying, we need to build the Edge Agent v2:

```bash
# Go back to the main project root
cd ..

# Install main project dependencies
npm install

# Build the Edge Agent for Vercel
npm run build:vercel

# This creates the compiled Edge Agent files
```

## Step 6: Test Locally First

```bash
# Go back to the test app
cd vercel-test-app

# Run locally to test
npm run dev

# Open http://localhost:3000
# Make sure the app loads without errors
```

## Step 7: Deploy to Vercel

### Option A: Deploy with Vercel CLI (Recommended)

```bash
# In the vercel-test-app directory
vercel

# The CLI will ask:
# 1. Set up and deploy? → Yes
# 2. Which scope? → Select your account
# 3. Link to existing project? → No (create new)
# 4. Project name? → optimizely-edge-agent-test (or your choice)
# 5. Directory? → ./ (current directory)
# 6. Override settings? → No

# For production deployment
vercel --prod
```

### Option B: Deploy via GitHub (Alternative)

1. Push your code to GitHub
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import your GitHub repository
4. Configure environment variables in Vercel dashboard
5. Deploy

## Step 8: Configure Environment Variables in Vercel

### Via CLI:
```bash
# Add environment variables for production
vercel env add OPTIMIZELY_SDK_KEY production
# Paste your SDK key when prompted

vercel env add NEXT_PUBLIC_OPTIMIZELY_SDK_KEY production
# Paste the same SDK key

# Add other variables
vercel env add OPTIMIZELY_ENABLE_EDGE_MODE production
# Type: true

vercel env add OPTIMIZELY_ENABLE_AGENT_MODE production
# Type: true
```

### Via Dashboard:
1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click on your project
3. Go to Settings → Environment Variables
4. Add each variable:
   - `OPTIMIZELY_SDK_KEY` = your-key
   - `NEXT_PUBLIC_OPTIMIZELY_SDK_KEY` = your-key
   - `OPTIMIZELY_ENABLE_EDGE_MODE` = true
   - `OPTIMIZELY_ENABLE_AGENT_MODE` = true

## Step 9: Redeploy with Environment Variables

```bash
# Trigger a new deployment with the env vars
vercel --prod

# Your app will be available at:
# https://optimizely-edge-agent-test.vercel.app
# (or similar based on your project name)
```

## Step 10: Verify Deployment

1. **Check the deployment URL** provided by Vercel
2. **Test the home page** loads correctly
3. **Test API endpoints**:
   ```bash
   # Test the decide endpoint
   curl https://your-app.vercel.app/api/decide \
     -H "Content-Type: application/json" \
     -H "X-Optimizely-SDK-Key: your-sdk-key" \
     -d '{"userId": "test123", "flagKey": "test_feature"}'
   ```

## Troubleshooting

### "Module not found" errors:

The Edge Agent needs to be built first. Make sure you:
1. Built the main project: `npm run build:vercel` in the root directory
2. Have a symlink or proper import path to the Edge Agent

### Fix the import path in middleware.ts:

```typescript
// Update the import in vercel-test-app/middleware.ts
// Change from:
import { composeVercelApplication } from '../src-v2/composition/vercelComposition';

// To use the built version:
import { composeVercelApplication } from '../dist/vercel/composition/vercelComposition';
```

### Environment variables not working:

1. Make sure to use `NEXT_PUBLIC_` prefix for client-side variables
2. Redeploy after adding environment variables
3. Check Vercel dashboard → Functions tab for logs

### Middleware not running:

1. Check the `matcher` configuration in middleware.ts
2. Ensure the file is in the root of the app directory
3. Check Vercel Functions logs for errors

## Next Steps

Once deployed successfully:

1. **Test Edge Mode**: Visit `/test-pages/home`
2. **Test Agent Mode**: Visit `/test-api`
3. **Use as Origin**: 
   - Your origin URLs will be:
   - `https://your-app.vercel.app/origin/home`
   - `https://your-app.vercel.app/origin/home-variant`
4. **Configure Cloudflare/Fastly** to use these origin URLs

## Vercel Features You Get

- **Global Edge Network**: Your app runs on Vercel's edge
- **Automatic HTTPS**: SSL certificates included
- **Preview Deployments**: Each git push gets a preview URL
- **Analytics**: Basic analytics included (upgrade for more)
- **Logs**: Real-time function logs in dashboard

## Useful Vercel Commands

```bash
# View all projects
vercel list

# View project info
vercel inspect

# View logs
vercel logs

# View environment variables
vercel env ls

# Remove a deployment
vercel remove [url]

# Link to existing project
vercel link
```

## Support Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js on Vercel](https://vercel.com/docs/frameworks/nextjs)
- [Edge Functions Guide](https://vercel.com/docs/functions/edge-functions)
- [Troubleshooting](https://vercel.com/guides/troubleshooting-deployments)