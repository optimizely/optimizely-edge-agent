# Metrics API Endpoints

## Important Note

**The Optimizely Edge Agent v2 does NOT provide any metrics API endpoints.** 

Metrics are collected internally and written directly to platform-specific analytics systems. There are no endpoints to:
- Export metrics
- Query metrics
- Reset metrics
- Configure metrics

## How Metrics Work

### Collection
Metrics are collected automatically throughout the request lifecycle using the platform-specific adapter (e.g., CloudflareMetricsAdapter).

### Storage
Metrics are written directly to the platform's native analytics system:
- **Cloudflare**: Analytics Engine
- **Fastly**: Real-Time Analytics
- **Vercel**: External monitoring service
- **Generic**: Custom export mechanism

### Access
To access metrics, you must use the platform's native tools:

#### Cloudflare Workers
Access metrics through Cloudflare Analytics Dashboard or Analytics Engine API:

```bash
# Query metrics via Analytics Engine SQL API
curl -X POST https://api.cloudflare.com/client/v4/accounts/{account_id}/analytics_engine/sql \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "SELECT timestamp, double1 as duration FROM dataset WHERE index1 = '\''optimizely_edge_request_duration'\''"
  }'
```

#### Fastly Compute@Edge
Access through Fastly's Real-Time Analytics API:

```bash
# Get real-time metrics
curl -H "Fastly-Key: {api_key}" \
  "https://rt.fastly.com/v1/channel/{service_id}/ts/h"
```

#### Vercel Edge Functions
Metrics are exported to your configured monitoring service (DataDog, New Relic, etc.).

## Common Misconceptions

### There is NO `/metrics` endpoint
Unlike traditional applications that expose Prometheus-style metrics endpoints, the Edge Agent does not provide any metrics export endpoints.

### There are NO metrics management endpoints
You cannot:
- Reset metrics via API
- Configure metrics via API
- Query metrics via API

### Metrics are write-only
The Edge Agent can only write metrics to the platform's analytics system. It cannot read or query them.

## Alternative Approaches

If you need metrics in a different format or system:

1. **Use Platform Export**: Most platforms allow exporting analytics data
   - Cloudflare: Export from Analytics Engine
   - Fastly: Stream logs to external systems
   - Vercel: Configure external monitoring integration

2. **Custom Adapter**: Implement a custom metrics adapter that exports to your preferred system

3. **Log Processing**: Parse application logs to extract metric-like data

## Configuration

While there are no API endpoints, metrics can be configured via environment variables or during adapter initialization:

### Environment Variables

```toml
# In wrangler.toml
[vars]
OPTIMIZELY_METRICS_ENABLED = "true"
OPTIMIZELY_METRICS_PREFIX = "optimizely_edge_"
OPTIMIZELY_METRICS_SAMPLING_RATE = "1.0"
OPTIMIZELY_METRICS_MAX_DIMENSIONS = "20"
OPTIMIZELY_METRICS_ENABLE_HISTOGRAMS = "true"
OPTIMIZELY_METRICS_GLOBAL_DIMENSIONS = "{\"environment\":\"production\"}"
```

### Runtime Configuration

```typescript
const metricsAdapter = new CloudflareMetricsAdapter(
  logger,
  'optimizely_edge_', // prefix (overridden by env var if set)
  env.ANALYTICS_ENGINE, // platform binding
  {
    enabled: true,
    defaultSamplingRate: 1.0,
    maxDimensions: 20
  },
  environmentAdapter // Pass to enable env var support
);
```

Configuration precedence: Runtime config > Environment variables > Defaults

## See Also

- [Metrics Overview](./README.md)
- [Platform-Specific Adapters](./platform-adapters.md)
- [Platform Deployment Guides](../deployment/README.md)