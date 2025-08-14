# Optimizely Edge Agent v2 - Vercel Test Application

This test application provides a comprehensive testing environment for the Optimizely Edge Agent v2 on Vercel, and can also serve as an origin server for testing with Cloudflare and Fastly.

## 🚀 Quick Start

### 1. Local Development

```bash
# Navigate to the test app directory
cd vercel-test-app

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Edit .env.local and add your Optimizely SDK key
# OPTIMIZELY_SDK_KEY=your-actual-sdk-key

# Run locally
npm run dev

# Open http://localhost:3000
```

### 2. Deploy to Vercel

```bash
# Install Vercel CLI if needed
npm i -g vercel

# Deploy to Vercel
vercel

# For production deployment
vercel --prod
```

## 🧪 Testing Scenarios

### Edge Mode Testing

Edge Mode automatically intercepts requests and serves content variations based on feature flags.

1. **Visit test pages:**
   - `/test-pages/home` - Tests content variation
   - `/test-pages/product` - Tests product page variations
   - `/test-pages/checkout` - Tests checkout flow variations

2. **How it works:**
   - Edge Agent middleware intercepts the request
   - Evaluates feature flags for the user
   - Serves appropriate content based on `cdnVariationSettings`
   - Caches the decision for performance

3. **Test different users:**
   - Use the buttons on test pages to simulate different users
   - Check browser cookies for `optimizely_user_id`
   - View response headers for variation information

### Agent Mode Testing

Agent Mode provides REST API endpoints for programmatic access.

1. **Use the API Tester:**
   - Visit `/test-api` for interactive testing
   - Test all API endpoints with customizable payloads
   - View response times, headers, and body

2. **Test endpoints:**
   ```bash
   # Decision endpoint (POST)
   curl -X POST https://your-app.vercel.app/api/decide \
     -H "Content-Type: application/json" \
     -H "X-Optimizely-SDK-Key: your-sdk-key" \
     -d '{"userId": "user123", "flagKey": "test_feature"}'

   # Same request as GET
   curl "https://your-app.vercel.app/api/decide?userId=user123&flagKey=test_feature" \
     -H "X-Optimizely-SDK-Key: your-sdk-key"
   ```

3. **Available endpoints:**
   - `/api/decide` - Single flag decision
   - `/api/decide-all` - All flags decision
   - `/api/decide-for-keys` - Multiple specific flags
   - `/api/datafile` - Datafile management
   - `/api/flagkeys` - Flag keys management
   - `/api/config` - Configuration endpoint
   - `/api/set-forced-variation` - Force variations
   - `/api/debug` - Debug information

### Using as Origin for CDN Testing

This Vercel app can serve as an origin server for testing Cloudflare or Fastly Edge Agent deployments.

1. **Origin endpoints:**
   - `/origin/home` - Control version of home page
   - `/origin/home-variant` - Treatment version of home page
   - `/origin/product` - Control product page
   - `/origin/product-variant` - Treatment product page

2. **Configure in Cloudflare/Fastly:**
   ```javascript
   // Example cdnVariationSettings
   {
     "cdnExperimentURL": "/home",
     "cdnResponseURL": "https://your-app.vercel.app/origin/home-variant",
     "cacheKey": "home_variant_b",
     "cacheTTL": 300,
     "forwardRequestToOrigin": "true"
   }
   ```

3. **CORS headers are configured** - Origin endpoints include proper CORS headers for cross-origin fetching.

## 📊 Metrics Configuration

### DataDog (Recommended)

```env
METRICS_PROVIDER=datadog
DD_API_KEY=your-datadog-api-key
DD_SITE=datadoghq.com
DD_ENV=production
DD_SERVICE=optimizely-edge-agent-test
```

### New Relic

```env
METRICS_PROVIDER=newrelic
NEW_RELIC_LICENSE_KEY=your-license-key
NEW_RELIC_REGION=US
NEW_RELIC_APP_NAME=optimizely-edge-agent-test
```

### Prometheus

```env
METRICS_PROVIDER=prometheus
PROMETHEUS_PUSH_GATEWAY_URL=http://your-pushgateway:9091
PROMETHEUS_JOB_NAME=edge_agent_test
```

## 🔧 Configuration

### Environment Variables

All Edge Agent configuration is done through environment variables:

```env
# Required
OPTIMIZELY_SDK_KEY=your-sdk-key
NEXT_PUBLIC_OPTIMIZELY_SDK_KEY=your-sdk-key  # For client-side

# Optional
OPTIMIZELY_ENABLE_EDGE_MODE=true
OPTIMIZELY_ENABLE_AGENT_MODE=true
OPTIMIZELY_LOG_LEVEL=info
OPTIMIZELY_CACHE_TTL=300
OPTIMIZELY_ADMIN_TOKEN=your-admin-token
```

### Feature Flag Setup

For Edge Mode testing, create feature flags with `cdnVariationSettings`:

```json
{
  "flagKey": "home_page_test",
  "variations": {
    "control": {
      "id": "1",
      "key": "control",
      "variables": {
        "cdnVariationSettings": {
          "cdnExperimentURL": "/test-pages/home",
          "cdnResponseURL": "/origin/home",
          "cacheKey": "home_control",
          "cacheTTL": 300,
          "forwardRequestToOrigin": "false",
          "isControlVariation": "true"
        }
      }
    },
    "treatment": {
      "id": "2", 
      "key": "treatment",
      "variables": {
        "cdnVariationSettings": {
          "cdnExperimentURL": "/test-pages/home",
          "cdnResponseURL": "/origin/home-variant",
          "cacheKey": "home_treatment",
          "cacheTTL": 300,
          "forwardRequestToOrigin": "false",
          "isControlVariation": "false"
        }
      }
    }
  }
}
```

## 🧩 Integration with Edge Agent

The middleware (`middleware.ts`) integrates the Edge Agent:

```typescript
import { composeVercelApplication } from '../src-v2/composition/vercelComposition';

const edgeAgent = composeVercelApplication({
  context: process.env,
  request: null,
  waitUntil: (promise) => promise.catch(console.error)
});

export async function middleware(request: NextRequest) {
  // Handle request through Edge Agent
  const response = await edgeAgent.requestHandler.handleRequest(request);
  return response;
}
```

## 📈 Performance Testing

1. **Monitor metrics:**
   - Request duration
   - Cache hit rates
   - Decision timing
   - Error rates

2. **Load testing:**
   ```bash
   # Simple load test
   for i in {1..100}; do
     curl -s https://your-app.vercel.app/api/decide \
       -H "X-Optimizely-SDK-Key: your-key" \
       -d '{"userId": "user'$i'", "flagKey": "test"}' &
   done
   ```

3. **Check Edge Function logs:**
   - View in Vercel dashboard
   - Monitor for errors or warnings
   - Track performance metrics

## 🐛 Troubleshooting

### Edge Agent not working?

1. Check environment variables are set correctly
2. Verify SDK key is valid
3. Check middleware is properly configured
4. Look for errors in Vercel Function logs

### API endpoints returning 404?

1. Ensure Agent Mode is enabled: `OPTIMIZELY_ENABLE_AGENT_MODE=true`
2. Check middleware matcher configuration
3. Verify Edge Agent is properly initialized

### Metrics not appearing?

1. Verify metrics provider is configured
2. Check API keys are valid
3. Look for errors in logs
4. Ensure `OPTIMIZELY_METRICS_ENABLED=true`

## 🚀 Next Steps

1. **Test locally** to ensure everything works
2. **Deploy to Vercel** for production testing
3. **Configure Cloudflare/Fastly** to use this as origin
4. **Monitor metrics** to track performance
5. **Run load tests** to validate scalability

## 📚 Additional Resources

- [Edge Agent Documentation](../docs-sot/README.md)
- [Vercel Edge Functions Guide](https://vercel.com/docs/functions/edge-functions)
- [Optimizely Feature Flags](https://docs.developers.optimizely.com/feature-experimentation/docs)