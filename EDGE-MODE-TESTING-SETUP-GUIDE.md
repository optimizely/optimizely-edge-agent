# Edge Mode Testing Setup Guide

## Overview

This guide provides the optimal configuration for testing Optimizely Edge Agent v2 Edge Mode with Cloudflare Workers and Pages, avoiding same-zone fetch restrictions.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    expedge.com Zone                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────────────┐      ┌────────────────────┐   │
│  │   Edge Agent Worker  │      │   Pages Content    │   │
│  │  api.expedge.com     │ ───> │ content.expedge.com │   │
│  │  (Custom Domain)     │      │  (Custom Domain)    │   │
│  └─────────────────────┘      └────────────────────┘   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Step 1: Configure Pages Site

1. **Deploy your Pages site** with content variations
2. **Set up Custom Domain**:
   ```bash
   # In Cloudflare Dashboard:
   # Pages > Your Project > Custom domains
   # Add: content.expedge.com
   ```

3. **Example Pages Structure**:
   ```
   /
   ├── index.html          # Default/control
   ├── variation-a.html    # Variation A
   ├── variation-b.html    # Variation B
   └── category/
       └── backpack.html   # Category page
   ```

## Step 2: Configure Worker (Edge Agent)

1. **Update wrangler.toml**:
   ```toml
   name = "edge-agent-demo"
   main = "index.js"
   compatibility_date = "2025-05-01"

   [[routes]]
   pattern = "api.expedge.com/*"
   custom_domain = true

   [vars]
   # Update to point to Pages custom domain
   DEV_CONTENT_BASE_URL = "https://content.expedge.com"
   EDGE_MODE_CONTENT_URL = "https://content.expedge.com"

   [[kv_namespaces]]
   binding = "OPTLY_HYBRID_AGENT_KV"
   id = "your-kv-id"
   ```

2. **Deploy the Worker**:
   ```bash
   npx wrangler deploy
   ```

## Step 3: Update Flag Configuration

Configure your flags to use the new domains:

```json
{
  "flagKey": "cloudflare_demo_flag",
  "variables": {
    "cdnVariationSettings": {
      "cdnExperimentURL": "https://api.expedge.com/",
      "cdnResponseURL": "https://content.expedge.com/category/backpack",
      "cacheKey": "VARIATION_KEY",
      "forwardRequestToOrigin": "false",
      "cacheRequestToOrigin": "true"
    }
  }
}
```

## Step 4: Testing URLs

### Agent Mode (API Endpoints)
```bash
# Decision API
curl https://api.expedge.com/api/decide?userId=test&flagKey=cloudflare_demo_flag \
  -H "X-Optimizely-SDK-Key: YOUR_SDK_KEY"

# Datafile API  
curl https://api.expedge.com/api/datafile \
  -H "X-Optimizely-SDK-Key: YOUR_SDK_KEY"
```

### Edge Mode (Content Routing)
```bash
# Test Edge Mode with forced decisions
curl https://api.expedge.com/ \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: YOUR_SDK_KEY" \
  -H "X-Optimizely-Visitor-ID: test-visitor" \
  -H 'X-Optimizely-Forced-Decisions: {"cloudflare_demo_flag":{"variationKey":"on"}}'
```

## Step 5: Local Development Testing

For local development, you can still use the debug flag:

```bash
# Local testing with force-edge-mode parameter
curl http://localhost:8787/?force-edge-mode=true \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: YOUR_SDK_KEY"
```

## Environment Variables

### Production
```env
EDGE_MODE_CONTENT_URL=https://content.expedge.com
OPTIMIZELY_METRICS_SAMPLING_RATE=0.5
OPTIMIZELY_METRICS_MAX_DIMENSIONS=5
```

### Development
```env
DEV_CONTENT_BASE_URL=https://content.expedge.com
OPTIMIZELY_METRICS_SAMPLING_RATE=1.0
OPTIMIZELY_METRICS_MAX_DIMENSIONS=20
```

## Benefits of This Setup

1. **No Same-Zone Restrictions**: Custom domains can fetch from each other
2. **Clean Separation**: API vs Content are clearly separated
3. **Easy Testing**: Each component can be tested independently
4. **Production-Ready**: This mirrors real customer deployments

## Troubleshooting

### Issue: 404 errors when fetching content
**Solution**: Ensure content.expedge.com is properly configured as a custom domain on your Pages project

### Issue: URL matching failures
**Solution**: Update cdnExperimentURL to match api.expedge.com pattern

### Issue: CORS errors
**Solution**: Add appropriate CORS headers in Pages _headers file:
```
/*
  Access-Control-Allow-Origin: https://api.expedge.com
  Access-Control-Allow-Methods: GET, POST, OPTIONS
  Access-Control-Allow-Headers: *
```

## Alternative: Using Service Bindings

If you prefer to keep everything under one domain, use Service Bindings:

```toml
# wrangler.toml
[[services]]
binding = "CONTENT_SERVICE"
service = "pages-content-worker"
```

Then fetch using the binding:
```javascript
const response = await env.CONTENT_SERVICE.fetch(request);
```

This avoids network requests entirely and provides better performance.