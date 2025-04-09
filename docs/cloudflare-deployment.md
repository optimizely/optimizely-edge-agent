# Deploying Optimizely Edge Agent on Cloudflare Workers

This guide walks you through the process of deploying the Optimizely Edge Agent to Cloudflare Workers, setting up KV storage, and configuring your environment.

## Prerequisites

Before you begin, make sure you have:

1. A Cloudflare account with Workers enabled
2. Wrangler CLI installed and configured (Cloudflare's CLI tool)
3. The Optimizely Edge Agent codebase
4. Node.js (v16 or later) and npm installed

## Step 1: Clone the Repository

```bash
git clone https://github.com/optimizely/optimizely-edge-agent.git
cd optimizely-edge-agent
npm install
```

## Step 2: Configure KV Namespace

The Edge Agent requires a KV namespace for storing datafiles and flag keys. Create a new KV namespace using the Cloudflare Dashboard or Wrangler CLI:

Using Wrangler CLI:

```bash
wrangler kv:namespace create "OPTIMIZELY_EDGE_AGENT"
```

Make note of the namespace ID in the output - you'll need it for your configuration.

## Step 3: Configure Environment Variables

Create a `.dev.vars` file in your project root for local development:

```
OPTIMIZELY_ADMIN_TOKEN=your-secure-admin-token
OPTIMIZELY_API_KEY=your-optimizely-api-key
OPTIMIZELY_LOG_LEVEL=info
```

Then, set up environment variables in your `wrangler.toml` file for production:

```toml
name = "optimizely-edge-agent"
main = "dist/worker.js"
compatibility_date = "2023-04-01"

kv_namespaces = [
  { binding = "OPTIMIZELY_EDGE_AGENT", id = "your-kv-namespace-id" }
]

[vars]
OPTIMIZELY_LOG_LEVEL = "info"
OPTIMIZELY_CDN_PROVIDER = "cloudflare"

[env.production]
kv_namespaces = [
  { binding = "OPTIMIZELY_EDGE_AGENT", id = "your-production-kv-namespace-id" }
]
[env.production.vars]
OPTIMIZELY_LOG_LEVEL = "warn"
OPTIMIZELY_CDN_PROVIDER = "cloudflare"

# Add the admin token using wrangler secrets, not here
# wrangler secret put OPTIMIZELY_ADMIN_TOKEN --env production
```

## Step 4: Set Up Secrets

Set up your secrets using Wrangler CLI:

```bash
# For development
wrangler secret put OPTIMIZELY_ADMIN_TOKEN

# For production
wrangler secret put OPTIMIZELY_ADMIN_TOKEN --env production
```

## Step 5: Build the Project

```bash
npm run build
```

This will create the production Worker code in the `dist/` directory.

## Step 6: Test Locally

Before deploying to production, test the Edge Agent locally:

```bash
npm run dev
```

This starts a local server at http://localhost:8787 for testing.

## Step 7: Deploy to Cloudflare

### Deploy to Development Environment

```bash
wrangler publish
```

### Deploy to Production Environment

```bash
wrangler publish --env production
```

## Step 8: Set Up Custom Domain (Optional)

To use a custom domain for your Edge Agent:

1. Go to the Cloudflare Dashboard
2. Select your account and website
3. Navigate to Workers > Add Route
4. Enter your route pattern (e.g., `optimizely-edge-agent.yourdomain.com/*`)
5. Select your worker from the dropdown
6. Click "Save"

## Step 9: Verify Deployment

Test your deployed Edge Agent with a simple API request:

```bash
curl https://[your-worker-url]/api/sdk
```

You should receive a JSON response with the Edge Agent version and configuration.

## Step 10: Configure SDK Keys

For each Optimizely project you want to use with the Edge Agent, you'll need to upload its datafile:

```bash
curl -X POST https://[your-worker-url]/api/datafile?sdkKey=your-sdk-key \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: your-admin-token" \
  -d @path/to/datafile.json
```

You can download datafiles from the Optimizely Dashboard or use the Optimizely API.

## Performance Tuning

### Caching

Cloudflare Workers include built-in caching. The Edge Agent is configured to respect cache headers and optimize performance. To further improve caching:

1. Use a custom Cache-Control header for your datafile requests:

```
Cache-Control: public, max-age=300, stale-while-revalidate=60
```

2. Configure the Edge Agent to refresh datafiles from Optimizely CDN periodically:

```toml
[vars]
OPTIMIZELY_REFRESH_INTERVAL = "300" # 5 minutes in seconds
```

### Worker CPU and Memory Limits

Cloudflare Workers have specific CPU and memory limits. The Edge Agent is optimized to work within these constraints, but keep in mind:

- Worker CPU time is limited to 10ms on the free plan, 50ms on paid plans
- Memory usage is limited to 128MB
- Subrequests are limited to 50 per worker invocation

## Monitoring and Troubleshooting

### Viewing Logs

Access your worker logs through the Cloudflare Dashboard:

1. Go to the Cloudflare Dashboard
2. Select your account and website
3. Navigate to Workers > Logs

### Common Issues

1. **KV Storage Errors**: Ensure your KV namespace is correctly configured in `wrangler.toml`.
2. **Authentication Failures**: Verify your admin token is correctly set using `wrangler secret`.
3. **Rate Limiting**: Check if you're hitting Cloudflare's rate limits for Workers or KV operations.

### Health Checks

Set up a health check endpoint to monitor your Edge Agent:

```bash
curl https://[your-worker-url]/api/admin/status \
  -H "X-Admin-Token: your-admin-token"
```

## Upgrading

To upgrade your Edge Agent:

1. Pull the latest changes from the repository
2. Install dependencies
3. Build the project
4. Deploy to Cloudflare

```bash
git pull
npm install
npm run build
wrangler publish --env production
```

## Additional Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Cloudflare KV Storage Documentation](https://developers.cloudflare.com/workers/runtime-apis/kv/)
- [Optimizely Documentation](https://docs.developers.optimizely.com/)
- [Edge Agent API Documentation](./api-endpoints.md)

## Support

If you encounter issues with your Edge Agent deployment, please contact Optimizely Support or open an issue on the GitHub repository. 