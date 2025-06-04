# Metrics

The Optimizely Edge Agent v2 provides comprehensive metrics collection capabilities to monitor performance, track usage patterns, and ensure reliability across different deployment platforms.

## Overview

The Edge Agent uses a flexible metrics adapter pattern that allows for platform-specific implementations while maintaining a consistent interface. Metrics are collected automatically throughout the request lifecycle and written directly to platform-specific monitoring systems.

**Important**: The Edge Agent does NOT provide metrics export endpoints. Metrics are written directly to each platform's native analytics system (e.g., Cloudflare Analytics Engine, Fastly Real-Time Analytics).

## Architecture

### Metrics Adapter Interface

All metrics collection is done through the `IMetricsAdapter` interface, which provides standardized methods for different metric types:

- **Counters**: For tracking cumulative values (requests, errors, etc.)
- **Gauges**: For tracking current values (active connections, cache size, etc.)
- **Histograms**: For tracking distributions (response sizes, processing times, etc.)
- **Timers**: For measuring durations with automatic histogram recording
- **Sets**: For tracking unique values (unique users, flag keys, etc.)
- **Summaries**: For pre-aggregated statistics with percentiles

### Platform Adapters

The Edge Agent includes platform-specific adapters:

- **CloudflareMetricsAdapter**: Integrates with Cloudflare Analytics Engine
- **FastlyMetricsAdapter**: Integrates with Fastly's real-time analytics
- **VercelMetricsAdapter**: Integrates with Vercel's monitoring
- **StandardMetricsAdapter**: Generic adapter for custom implementations
- **NoOpMetricsAdapter**: Disables metrics collection

## Collected Metrics

### Request Metrics

| Metric Name | Type | Description | Tags |
|------------|------|-------------|------|
| `request_duration` | Timer | Total request processing time | method, path |
| `response_size_bytes` | Histogram | Size of response body in bytes | method, status |
| `requests_total` | Counter | Total number of requests | method, path |
| `service_available` | Gauge | Service availability status (1=available, 0=unavailable) | service |

### Decision Service Metrics

| Metric Name | Type | Description | Tags |
|------------|------|-------------|------|
| `client_initialization_duration` | Timer | Time to initialize Optimizely client | component, sdkKey (masked) |
| `datafile_fetch_duration` | Timer | Time to fetch datafile | sdkKey (masked) |
| `client_creation_duration` | Timer | Time to create SDK client instance | sdkKey (masked) |
| `client_creation_time` | Histogram | Client creation time distribution | sdkKey (masked) |
| `datafile_size_bytes` | Histogram | Size of datafile in bytes | sdkKey (masked) |
| `datafile_update_interval_ms` | Histogram | Interval between datafile updates | sdkKey (masked) |
| `client_total_initialization_time` | Histogram | Total initialization time | sdkKey (masked), source |
| `user_context_creation_duration` | Timer | Time to create user context | component |
| `user_context_creation_time` | Histogram | User context creation time distribution | component |
| `user_context_total_time` | Histogram | Total user context time | component |
| `cache_cleanup_duration` | Timer | Time to clean up caches | component |
| `decision_duration` | Timer | Time to make a decision | component, flagKey, sdkKey (masked) |
| `decision_time` | Histogram | Decision time distribution | component, flagKey |
| `batch_decision_duration` | Timer | Time for batch decisions | component, sdkKey (masked) |
| `batch_decision_time` | Histogram | Batch decision time distribution | component |
| `sdk_decide_duration` | Timer | Time for SDK decide call | component, flagKey |
| `process_attributes_duration` | Timer | Time to process attributes | component |
| `get_user_context_duration` | Timer | Time to get user context | component |
| `fallback_decision_creation_duration` | Timer | Time to create fallback decision | component, reason |
| `forced_variation_duration` | Timer | Time for forced variation operations | component, operation |
| `cache_size` | Gauge | Current cache size | component |
| `cache_size_limit` | Gauge | Cache size limit | component |
| `cache_ttl_ms` | Gauge | Cache TTL in milliseconds | component |
| `caching_enabled` | Gauge | Whether caching is enabled (1=yes, 0=no) | component |
| `experiment_count` | Gauge | Number of experiments in datafile | sdkKey (masked) |
| `feature_flag_count` | Gauge | Number of feature flags in datafile | sdkKey (masked) |

### API Metrics

| Metric Name | Type | Description | Tags |
|------------|------|-------------|------|
| `api_request_duration_seconds` | Timer | API request processing time | method, endpoint |
| `api_requests_total` | Counter | Total API requests | method, endpoint |
| `api_responses_total` | Counter | Total API responses | status_code, method, endpoint |
| `api_errors_total` | Counter | Total API errors | method, endpoint, error_type |
| `datafile_save_duration` | Timer | Time to save datafile to storage | - |
| `flagkeys_fetch_duration` | Timer | Time to fetch flag keys | - |
| `flagkeys_count` | Histogram | Number of flag keys | endpoint, source |
| `flagkeys_save_duration` | Timer | Time to save flag keys | - |
| `cache_clear_duration` | Timer | Time to clear cache | - |

### Edge Mode Metrics

| Metric Name | Type | Description | Tags |
|------------|------|-------------|------|
| `edge_mode_duration` | Timer | Total Edge Mode processing time | - |
| `edge_mode_pipeline_duration` | Timer | Edge Mode pipeline processing time | method, path |
| `should_handle_duration` | Timer | Time to determine if request should be handled | - |
| `url_matching_duration` | Timer | Time to match URL patterns | - |
| `content_preparation_duration` | Timer | Time to prepare content | - |
| `content_fetch_duration` | Timer | Time to fetch content from origin | - |
| `transform_duration` | Timer | Time to transform content | - |
| `origin_fetch_duration` | Timer | Time to fetch from origin | - |
| `variations_evaluated_before_match` | Histogram | Number of variations evaluated before finding a match | - |
| `event_tracking_duration` | Timer | Time to track events | - |

### Storage Service Metrics  

| Metric Name | Type | Description | Tags |
|------------|------|-------------|------|
| `datafile_refresh_duration_ms` | Timer | Time to refresh datafile from CDN | - |
| `datafile_storage_duration_ms` | Timer | Time to store datafile | - |
| `cdn_fetch_duration_ms` | Timer | Time to fetch from CDN | - |
| `flagkeys_fetch_duration_ms` | Timer | Time to fetch flag keys | - |
| `flagkeys_storage_duration_ms` | Timer | Time to store flag keys | - |
| `datafile_size_bytes` | Histogram | Size of datafile | endpoint, source |

### Request Handler Metrics

| Metric Name | Type | Description | Tags |
|------------|------|-------------|------|
| `cleanup_trigger_interval_ms` | Gauge | Cleanup trigger interval in milliseconds | - |
| `cleanup_trigger_probability` | Gauge | Cleanup trigger probability | - |

## Configuration

Metrics collection can be configured through environment variables and runtime configuration.

### Environment Variables

The Edge Agent now supports configuring metrics through environment variables:

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `OPTIMIZELY_METRICS_ENABLED` | boolean | `true`* | Enable/disable metrics collection |
| `OPTIMIZELY_METRICS_PREFIX` | string | `optimizely_edge_` | Prefix for all metric names |
| `OPTIMIZELY_METRICS_SAMPLING_RATE` | number | `1.0` | Sampling rate (0.0-1.0) |
| `OPTIMIZELY_METRICS_MAX_DIMENSIONS` | number | `20` | Max dimensions per metric |
| `OPTIMIZELY_METRICS_ENABLE_HISTOGRAMS` | boolean | `true` | Enable histogram metrics |
| `OPTIMIZELY_METRICS_GLOBAL_DIMENSIONS` | JSON | `{}` | Global dimensions for all metrics |

*Default is `true` if Analytics Engine is available, `false` otherwise

### Configuration Precedence

1. **Runtime Configuration** (highest priority)
2. **Environment Variables**
3. **Default Values** (lowest priority)

### Runtime Configuration

Configuration can also be passed when creating the metrics adapter:

```typescript
const metricsConfig: MetricsConfiguration = {
  enabled: true,
  prefix: 'optimizely_edge_',
  defaultSamplingRate: 1.0,
  maxDimensions: 20,
  enableHistograms: true,
  globalDimensions: {
    environment: 'production',
    version: '2.0.0'
  }
};
```

### Environment Variable Configuration Examples

#### In wrangler.toml:
```toml
[vars]
OPTIMIZELY_METRICS_ENABLED = "true"
OPTIMIZELY_METRICS_PREFIX = "optimizely_edge_"
OPTIMIZELY_METRICS_SAMPLING_RATE = "0.1"  # Sample 10% in production
OPTIMIZELY_METRICS_GLOBAL_DIMENSIONS = "{\"environment\":\"production\",\"region\":\"us-east-1\"}"
```

#### Environment-specific configuration:
```toml
# Development
[vars]
OPTIMIZELY_METRICS_SAMPLING_RATE = "1.0"  # Sample everything in dev

# Production
[env.production.vars]
OPTIMIZELY_METRICS_SAMPLING_RATE = "0.05"  # Sample 5% in production
OPTIMIZELY_METRICS_PREFIX = "prod_optimizely_"
```

## Accessing Metrics

**Important**: The Edge Agent does NOT expose any metrics endpoints. Metrics must be accessed through platform-specific tools.

### Platform-Specific Access

#### Cloudflare Workers

Metrics are written to Analytics Engine. Access via:
- Cloudflare Dashboard → Analytics → Analytics Engine
- Analytics Engine SQL API
- GraphQL API

Example SQL query:
```sql
SELECT 
  timestamp,
  index1 as metric_name,
  double1 as value,
  blob1 as tags
FROM your_dataset
WHERE timestamp >= now() - 3600
  AND index1 = 'optimizely_edge_request_duration'
```

#### Fastly Compute@Edge

Metrics are available through Fastly's real-time analytics:
- Fastly Control Panel → Analytics → Real-time
- Real-Time Analytics API
- Log streaming to external systems

#### Vercel Edge Functions

Metrics are exported to your configured monitoring service. Check your:
- DataDog dashboard
- New Relic dashboard
- Custom monitoring endpoint

### Adding Custom Metrics

You can add custom metrics through the metrics adapter in your service implementations:

```typescript
// In a custom service
constructor(private metrics: IMetricsAdapter) {}

async processRequest() {
  const timer = this.metrics.startTimer('custom_processing', {
    operation: 'feature_check'
  });
  
  try {
    // Your processing logic
    const result = await this.doWork();
    
    // Record custom metrics
    this.metrics.incrementCounter('custom_requests', 1, {
      feature: 'my_feature'
    });
    
    return result;
  } finally {
    timer.stop();
  }
}
```

## Monitoring Best Practices

### Essential Metrics to Monitor

1. **Request Performance**
   - `request_duration` percentiles (p50, p95, p99)
   - `response_size_bytes` distribution
   
2. **SDK Performance**
   - `client_initialization_duration` trends
   - `datafile_fetch_duration` spikes
   - `datafile_size_bytes` changes

3. **Error Rates**
   - Failed requests by status code
   - Timeout occurrences
   - Cache miss rates

### Setting Alerts

Recommended alert thresholds:

- Request duration p95 > 1000ms
- Datafile fetch duration p95 > 500ms
- Error rate > 1%
- Cache miss rate > 20%

## Performance Impact

The metrics system is designed for minimal overhead:

- Asynchronous collection (non-blocking)
- Configurable sampling rates
- Platform-optimized implementations
- Automatic batching where supported

### Overhead Estimates

- Counter increment: < 0.1ms
- Timer operations: < 0.2ms
- Histogram recording: < 0.3ms
- With sampling (10%): 90% reduction in overhead

## Platform-Specific Details

### Cloudflare Workers

- Uses Analytics Engine for storage
- Supports up to 20 dimensions per metric
- Data retention: 90 days
- Query via GraphQL API

### Fastly Compute@Edge

- Integrates with Fastly Real-Time Analytics
- 1-second granularity
- Historical data via API
- Custom dashboards supported

### Vercel Edge Functions

- Exports to configured monitoring service
- Supports OpenTelemetry format
- Integration with Vercel Analytics
- Custom export endpoints

## Troubleshooting

### Metrics Not Appearing

1. Check if metrics are enabled:
   ```typescript
   console.log(metricsAdapter.isEnabled());
   ```
   
   Or check environment variable:
   ```bash
   echo $OPTIMIZELY_METRICS_ENABLED
   ```

2. Verify platform configuration:
   - Cloudflare: Analytics Engine enabled
   - Fastly: Real-time analytics activated
   - Vercel: Monitoring integration configured

3. Check sampling configuration:
   - Ensure sampling rate > 0
   - Verify metric-specific sampling
   - Check `OPTIMIZELY_METRICS_SAMPLING_RATE` environment variable

### Environment Variable Issues

1. **Variables not being read**:
   - Ensure environment adapter is passed to metrics adapter
   - Check variable names are exactly as documented (case-sensitive)
   - Verify wrangler.toml syntax

2. **Invalid values**:
   - Boolean values must be `"true"` or `"false"` (strings)
   - Sampling rate must be between 0.0 and 1.0
   - Global dimensions must be valid JSON

3. **Debugging configuration**:
   ```typescript
   // Enable debug logging to see configuration details
   const logger = new CloudflareLoggerAdapter('debug');
   ```

### High Metric Volume

1. Adjust sampling rates:
   ```typescript
   metricsAdapter.updateConfiguration({
     defaultSamplingRate: 0.1 // 10% sampling
   });
   ```

2. Reduce dimensions:
   - Remove high-cardinality tags
   - Use aggregated values

3. Filter unnecessary metrics:
   - Disable histogram collection if not needed
   - Use metric-specific options

## See Also

- [Metrics Environment Variables](./environment-variables.md)
- [Metrics API Endpoints](./api-endpoints.md)
- [Platform-Specific Adapters](./platform-adapters.md)
- [Configuration Reference](../configuration/README.md)
- [Performance Optimization](../performance/README.md)
- [Platform Deployment Guides](../deployment/README.md)