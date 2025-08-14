# Optimizely Edge Agent Metrics

This document describes the metrics implementation in the Optimizely Edge Agent that allows for tracking performance and operational metrics.

## Overview

The metrics system provides a standardized way to track:

- Counter metrics (incrementing values)
- Gauge metrics (current values)
- Histogram metrics (distributions)
- Timer metrics (operation durations)

The implementation follows a modular, adapter-based design where the core application uses the `IMetricsAdapter` interface, which can be implemented for different environments.

## CloudflareMetricsAdapter

The primary implementation is `CloudflareMetricsAdapter` which supports two modes:

1. **Analytics Engine Mode**: When a Cloudflare Analytics Engine is available, metrics are recorded to Cloudflare's metrics system
2. **Logging Mode**: When Analytics Engine is not available, metrics are logged to the console via the logger

### Metrics Format

All metrics are prefixed with `optimizely_edge_` by default (configurable) and include:

- **Metric Name**: Descriptive name for the metric (e.g., `api_requests_total`)
- **Metric Value**: Numeric value appropriate for the metric type
- **Tags**: Key-value pairs to provide dimensions for the metric (e.g., `{ method: 'GET', endpoint: '/api/datafile' }`)

## Key Metrics

The Edge Agent tracks the following key metrics:

### API Request Metrics
- `api_requests_total` - Total count of API requests, tagged with method and endpoint
- `api_request_duration_seconds` - Duration of API requests in seconds
- `api_responses_total` - Count of API responses, tagged with status code
- `api_errors_total` - Count of API errors, tagged with error type

### Datafile Metrics
- `datafile_requests_total` - Count of datafile requests
- `datafile_updates_total` - Count of datafile updates
- `datafile_fetch_duration` - Time to fetch a datafile
- `datafile_cache_hit` - Cache hit count, tagged with source and type
- `datafile_cache_miss` - Cache miss count
- `datafile_size_bytes` - Size of datafiles

### Flag Key Metrics
- `flagkeys_requests_total` - Count of flag key requests
- `flagkeys_updates_total` - Count of flag key updates
- `flagkeys_fetch_duration` - Time to fetch flag keys
- `flagkeys_count` - Number of flag keys
- `flagkeys_cache_hit` - Cache hit count
- `flagkeys_cache_miss` - Cache miss count

### Cache Metrics
- `cache_clear_duration` - Time to clear cache
- `cache_status` - Cache status (hit/miss)

### Edge Mode Metrics
- `edge_mode_pipeline_duration` - Total time for edge mode pipeline execution
- `edge_mode_eligibility` - Whether a request is eligible for edge mode
- `url_match_found` - Whether a URL match is found
- `content_preparation_duration` - Time to prepare content
- `content_fetch_duration` - Time to fetch content
- `transform_duration` - Time to transform content
- `edge_mode_errors` - Count of edge mode errors

## Usage in Code

### Basic Usage Examples

```typescript
// Increment a counter
metricsAdapter.incrementCounter('api_requests_total', 1, { 
  method: 'GET', 
  endpoint: '/api/datafile' 
});

// Set a gauge value
metricsAdapter.setGauge('active_connections', 42);

// Record a histogram value
metricsAdapter.recordHistogram('response_size_bytes', 2048);

// Time an operation
const timerStop = metricsAdapter.startTimer('operation_duration');
// ... perform operation ...
timerStop(); // Automatically records the duration

// Or record a timer directly
metricsAdapter.recordTimer('operation_duration', 150); // 150ms
```

### Composition Root

The metrics adapter is initialized in the composition root (`cloudflareComposition.ts`) and injected into services that need to track metrics. The system will automatically detect if Cloudflare Analytics Engine is available and use it, otherwise falling back to console logging.

## Testing

The metrics adapter includes comprehensive tests that verify both the logging-only mode and the Analytics Engine mode. Tests can be run with:

```
npm test src-v2/tests/metrics
``` 