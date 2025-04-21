# Metrics Collection in v2

_Last Updated: 2025-04-18_

## Overview

The v2 implementation introduces a comprehensive metrics collection system integrated throughout the request handling flow. This document analyzes the metrics collection architecture, key measurement points, and how this data contributes to observability.

## Metrics Service Architecture

The v2 implementation uses a dedicated metrics service based on the `IMetricsService` interface:

```typescript
// src-v2/services/interfaces/IMetricsService.ts
export interface IMetricsService {
  /**
   * Increment a counter metric
   */
  incrementCounter(
    name: string,
    value: number,
    tags?: Record<string, string | number | boolean>
  ): void;

  /**
   * Record a gauge metric value
   */
  recordGauge(
    name: string,
    value: number,
    tags?: Record<string, string | number | boolean>
  ): void;

  /**
   * Start a timer and return a function to stop and record it
   */
  startTimer(
    name: string,
    tags?: Record<string, string | number | boolean>
  ): Timer;
  
  /**
   * Record a distribution metric (histogram)
   */
  recordDistribution(
    name: string,
    value: number,
    tags?: Record<string, string | number | boolean>
  ): void;
}

export interface Timer {
  stop(): number;
}
```

This interface is implemented by different adapters depending on the deployment environment:

1. `CloudflareMetricsService` - For Cloudflare Workers environment
2. `PrometheusMetricsService` - For traditional server environments
3. `NoOpMetricsService` - For testing or when metrics are disabled

## Key Metrics Collection Points

### 1. Request Lifecycle Metrics

The primary request metrics are collected in the `RequestHandler`:

```typescript
// Request start
const requestTimer = this.metrics?.startTimer('request_duration', {
  method,
  path,
});

try {
  // Request processing
  
  // Request completion
  if (requestTimer) {
    requestTimer.stop();
  }
  
  // Track request result
  this.metrics?.incrementCounter('requests_total', 1, {
    method,
    path,
    status: responseResult.status.toString(),
  });
} catch (error) {
  // Error tracking
  this.metrics?.incrementCounter('request_errors', 1, {
    method,
    path: url.pathname,
    error_type: error instanceof Error ? error.name : 'unknown',
  });
  
  // Stop timer even on error
  if (requestTimer) {
    requestTimer.stop();
  }
}
```

These metrics provide:
- Total request count by path and method
- Request duration distribution
- Error count by type and endpoint
- HTTP status code distribution

### 2. Feature Management Metrics

The `OptimizelyFeatureManager` tracks metrics related to feature flag evaluation:

```typescript
// Feature flag evaluation metrics
this.metrics?.incrementCounter('feature_evaluations_total', 1, {
  featureKey,
  hasResult: String(!!result),
});

if (result && result.variables) {
  this.metrics?.incrementCounter('feature_variables_accessed_total', 
    Object.keys(result.variables).length, 
    { featureKey }
  );
}

// Fallback metrics
if (usedFallback) {
  this.metrics?.incrementCounter('feature_fallbacks_total', 1, {
    featureKey,
    reason: fallbackReason || 'unknown',
  });
}
```

These metrics track:
- Feature flag evaluation count by key
- Success/failure rates of evaluations
- Variable usage patterns
- Fallback usage with reason tracking

### 3. Cache Performance Metrics

The cache service collects detailed metrics about cache operations:

```typescript
// Cache hit metrics
this.metrics?.incrementCounter('cache_operations_total', 1, {
  operation: 'get',
  status: cacheHit ? 'hit' : 'miss',
  namespace,
});

// Cache set metrics
this.metrics?.incrementCounter('cache_operations_total', 1, {
  operation: 'set',
  status: success ? 'success' : 'failure',
  namespace,
});

// Cache size metrics
this.metrics?.recordGauge('cache_size_bytes', estimatedSize, {
  namespace,
});

// Cache operation duration
const cacheTimer = this.metrics?.startTimer('cache_operation_duration', {
  operation,
  namespace,
});
// ...perform operation
cacheTimer?.stop();
```

These metrics provide insights into:
- Cache hit/miss ratios
- Cache operation success rates
- Cache size trends
- Cache performance (timing)

### 4. API Router Metrics

The `ApiRouter` collects metrics about API endpoint usage:

```typescript
// Track API request
this.metrics?.incrementCounter('api_requests_total', 1, {
  path,
  method,
});

// API response timing
const apiTimer = this.metrics?.startTimer('api_response_time', {
  path,
  method,
});

// ... process API request

// Stop timer
const duration = apiTimer?.stop();

// Record API response
this.metrics?.incrementCounter('api_responses_total', 1, {
  path,
  method,
  status: result.status.toString(),
});
```

This provides visibility into:
- API endpoint popularity
- API response time distribution
- API status code distribution

### 5. SDK Client Metrics

The `OptimizelyClientWrapper` tracks SDK client performance:

```typescript
// Track SDK operations
const sdkTimer = this.metrics?.startTimer('sdk_operation_duration', {
  operation: 'createUserContext',
});

// ... perform SDK operation

// Record duration
const duration = sdkTimer?.stop();

// Track SDK errors
if (error) {
  this.metrics?.incrementCounter('sdk_errors_total', 1, {
    operation,
    errorType: error.name,
  });
}
```

These metrics track:
- SDK operation performance
- SDK error rates
- SDK usage patterns

### 6. Configuration Metrics

The `ConfigurationManager` tracks configuration status:

```typescript
// Configuration load metrics
this.metrics?.incrementCounter('config_operations_total', 1, {
  operation: 'load',
  status: success ? 'success' : 'failure',
  source,
});

// Config size metrics
this.metrics?.recordGauge('config_size_bytes', JSON.stringify(config).length, {
  source,
});

// Config update frequency
this.metrics?.incrementCounter('config_updates_total', 1, {
  source,
  trigger: updateTrigger,
});
```

These metrics provide insights into:
- Configuration status and health
- Configuration load performance
- Update frequency patterns

## Metrics Aggregation and Processing

All metrics use a consistent naming pattern with appropriate tagging:

```
<component>_<action>_<unit>
```

Examples:
- `request_duration` (milliseconds)
- `requests_total` (count)
- `feature_evaluations_total` (count)
- `cache_operations_total` (count)

Tags provide multi-dimensional data that can be used for filtering and aggregation:
- HTTP method (`GET`, `POST`, etc.)
- Path/endpoint
- Status codes
- Error types
- Feature keys
- Operation types

## Comparison with v1

| Feature | v1 Implementation | v2 Implementation |
|---------|-------------------|-------------------|
| **Metrics Interface** | Ad-hoc implementation | Standardized `IMetricsService` |
| **Collection Points** | Limited (mainly requests) | Comprehensive across all services |
| **Metric Types** | Mainly counters | Counters, gauges, timers, distributions |
| **Dimensionality** | Limited tagging | Rich context tags on all metrics |
| **Error Tracking** | Basic counts | Detailed error type tracking |
| **Performance Metrics** | Limited timing | Comprehensive timing across operations |
| **Cache Metrics** | Minimal | Detailed hit/miss/performance tracking |
| **API Metrics** | None | Comprehensive endpoint tracking |

## Benefits of the v2 Metrics Architecture

1. **Enhanced Observability**: Provides deep visibility into system behavior and performance
2. **Problem Isolation**: Enables pinpointing issues to specific components
3. **Performance Tracking**: Clear visibility into latency sources and bottlenecks
4. **Usage Patterns**: Reveals how features and APIs are being used
5. **Error Detection**: Quickly identifies error patterns and frequencies
6. **Capacity Planning**: Provides data for scaling decisions
7. **Deployment Validation**: Allows comparing metrics before/after deployments

The rich metrics infrastructure in v2 significantly enhances operability, troubleshooting, and system understanding compared to v1's limited instrumentation.