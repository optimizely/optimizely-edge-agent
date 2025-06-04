# Platform-Specific Metrics Adapters

Each deployment platform has its own metrics adapter implementation optimized for that environment's capabilities and constraints.

## Cloudflare Workers

### CloudflareMetricsAdapter

The Cloudflare adapter integrates with Cloudflare Analytics Engine for efficient metrics storage and querying.

#### Features

- **Analytics Engine Integration**: Direct write to Cloudflare's time-series database
- **Automatic Batching**: Metrics are buffered and sent efficiently
- **Worker Analytics**: Integrates with Cloudflare's built-in worker analytics
- **GraphQL Query API**: Rich querying capabilities

#### Configuration

```typescript
import { CloudflareMetricsAdapter } from '@optimizely/edge-agent';

const metricsAdapter = new CloudflareMetricsAdapter(
  logger,
  'optimizely_edge_', // prefix (can be overridden by env var)
  env.ANALYTICS_ENGINE, // Cloudflare binding
  {
    enabled: true,
    defaultSamplingRate: 1.0,
    maxDimensions: 20
  },
  environmentAdapter // Optional: enables env var configuration
);
```

#### Environment Variable Configuration

CloudflareMetricsAdapter supports configuration via environment variables:

```toml
# In wrangler.toml
[vars]
OPTIMIZELY_METRICS_ENABLED = "true"
OPTIMIZELY_METRICS_PREFIX = "optimizely_edge_"
OPTIMIZELY_METRICS_SAMPLING_RATE = "0.1"  # Sample 10% of metrics
OPTIMIZELY_METRICS_MAX_DIMENSIONS = "20"
OPTIMIZELY_METRICS_ENABLE_HISTOGRAMS = "true"
OPTIMIZELY_METRICS_GLOBAL_DIMENSIONS = "{\"environment\":\"production\",\"datacenter\":\"us-east-1\"}"
```

Configuration precedence: Runtime config > Environment variables > Defaults

#### Environment Setup

In `wrangler.toml`:

```toml
[[analytics_engine_datasets]]
binding = "ANALYTICS_ENGINE"
dataset = "optimizely_metrics"
```

#### Data Structure

Cloudflare Analytics Engine stores metrics as:

```typescript
{
  indexes: [metricName, metricType],  // Indexed fields for fast lookup
  doubles: [value],                   // Numeric values
  blobs: [JSON.stringify(tags)]       // Additional metadata
}
```

#### Querying Metrics

##### Using SQL API

```javascript
const query = `
  SELECT 
    timestamp,
    index1 as metric_name,
    double1 as value,
    blob1 as tags
  FROM optimizely_metrics
  WHERE 
    timestamp >= now() - 3600
    AND index1 = 'optimizely_edge_request_duration'
`;

const response = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query })
  }
);
```

##### Using GraphQL

```graphql
query GetMetrics($accountId: String!, $filter: AnalyticsEngineFilter!) {
  viewer {
    accounts(filter: { accountTag: $accountId }) {
      analyticsEngine(filter: $filter) {
        sum {
          double1
        }
        avg {
          double1
        }
        quantiles {
          p50: quantile(level: 0.5)
          p95: quantile(level: 0.95)
          p99: quantile(level: 0.99)
        }
      }
    }
  }
}
```

#### Limitations

- Maximum 20 dimensions per metric
- 90-day data retention
- Write limits based on plan (typically 25M writes/month)

## Fastly Compute@Edge

### FastlyMetricsAdapter

Integrates with Fastly's Real-Time Analytics for instant visibility into edge performance.

#### Features

- **Real-Time Analytics**: 1-second granularity
- **Log Streaming**: Export to external systems
- **Custom Dashboards**: Built-in visualization
- **Historical API**: Access to historical data

#### Configuration

```javascript
import { FastlyMetricsAdapter } from '@optimizely/edge-agent';

const metricsAdapter = new FastlyMetricsAdapter(
  logger,
  'optimizely_edge_',
  {
    serviceId: fastly.env.FASTLY_SERVICE_ID,
    enableRealTime: true,
    enableLogging: true
  }
);
```

#### Log Format

Fastly streams metrics as structured logs:

```json
{
  "timestamp": "2024-03-14T10:30:00Z",
  "service_id": "abc123",
  "metric_type": "histogram",
  "metric_name": "optimizely_edge_request_duration",
  "value": 125.5,
  "tags": {
    "method": "GET",
    "path": "/decide"
  }
}
```

#### Real-Time Analytics Access

```javascript
// Access real-time metrics
const rtStats = await fetch(
  `https://rt.fastly.com/v1/channel/${serviceId}/ts/h`,
  {
    headers: {
      'Fastly-Key': apiKey
    }
  }
);

// Parse streaming response
const reader = rtStats.body.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const metrics = JSON.parse(new TextDecoder().decode(value));
  console.log('Real-time metrics:', metrics);
}
```

#### Custom Logging Endpoints

Configure in Fastly service:

```vcl
log "syslog " + req.service_id + " optimizely :: "
  + "metric_name=" + req.http.X-Metric-Name + " "
  + "value=" + req.http.X-Metric-Value + " "
  + "tags=" + req.http.X-Metric-Tags;
```

## Vercel Edge Functions

### VercelMetricsAdapter

Exports metrics to Vercel Analytics and external monitoring services.

#### Features

- **Vercel Analytics Integration**: Automatic performance tracking
- **OpenTelemetry Support**: Standard observability format
- **Custom Export**: Send to any monitoring service
- **Edge Config**: Dynamic configuration

#### Configuration

```typescript
import { VercelMetricsAdapter } from '@optimizely/edge-agent';

const metricsAdapter = new VercelMetricsAdapter(
  logger,
  'optimizely_edge_',
  {
    analyticsId: process.env.VERCEL_ANALYTICS_ID,
    exportEndpoint: process.env.METRICS_EXPORT_URL,
    exportInterval: 30000 // 30 seconds
  }
);
```

#### Integration with Vercel Analytics

```typescript
// Automatic integration
import { Analytics } from '@vercel/analytics';

// Metrics are automatically sent to Vercel Analytics
const analytics = new Analytics({
  framework: 'custom',
  beforeSend: (event) => {
    // Add custom metrics
    event.metrics = metricsAdapter.getSnapshot();
    return event;
  }
});
```

#### OpenTelemetry Export

```typescript
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';

const exporter = new OTLPMetricExporter({
  url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  headers: {
    'Authorization': `Bearer ${process.env.OTEL_AUTH_TOKEN}`
  }
});

// Configure adapter to use OpenTelemetry
const metricsAdapter = new VercelMetricsAdapter(logger, 'optimizely_edge_', {
  exporter: exporter,
  exportFormat: 'opentelemetry'
});
```

## Generic/Standard Adapter

### StandardMetricsAdapter

A platform-agnostic adapter for custom deployments.

#### Features

- **Memory Buffer**: In-memory metrics storage
- **Custom Export**: Flexible export mechanisms
- **Aggregation**: Client-side metric aggregation
- **Pluggable Storage**: Bring your own backend

#### Configuration

```typescript
import { StandardMetricsAdapter } from '@optimizely/edge-agent';

const metricsAdapter = new StandardMetricsAdapter(
  logger,
  'optimizely_edge_',
  {
    bufferSize: 1000,
    flushInterval: 60000, // 1 minute
    exporter: async (metrics) => {
      // Custom export logic
      await fetch('https://metrics.example.com/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metrics)
      });
    }
  }
);
```

#### Export Format

```typescript
interface ExportedMetrics {
  timestamp: string;
  metrics: Array<{
    name: string;
    type: 'counter' | 'gauge' | 'histogram' | 'timer' | 'set';
    value: number | number[];
    tags: Record<string, string>;
    aggregations?: {
      count?: number;
      sum?: number;
      min?: number;
      max?: number;
      p50?: number;
      p95?: number;
      p99?: number;
    };
  }>;
}
```

## No-Op Adapter

### NoOpMetricsAdapter

Disables all metrics collection with zero overhead.

#### Usage

```typescript
import { NoOpMetricsAdapter } from '@optimizely/edge-agent';

const metricsAdapter = new NoOpMetricsAdapter();
// All metric calls are no-ops with zero overhead
```

## Adapter Comparison

| Feature | Cloudflare | Fastly | Vercel | Standard | No-Op |
|---------|------------|---------|---------|-----------|--------|
| Real-time Analytics | ✓ (via API) | ✓ (1s) | ✓ (30s) | Configurable | ✗ |
| Built-in Storage | ✓ | ✓ | ✗ | ✗ | ✗ |
| Query API | ✓ (SQL/GraphQL) | ✓ (REST) | ✗ | Custom | ✗ |
| Export Format | Proprietary | JSON/Syslog | JSON/OTLP | Configurable | N/A |
| Overhead | Low | Low | Medium | Variable | Zero |
| Retention | 90 days | 30 days | External | External | N/A |

## Best Practices by Platform

### Cloudflare Workers

1. Use Analytics Engine for all metrics
2. Batch writes when possible
3. Query via SQL for complex analysis
4. Set up Worker Analytics for basic metrics

### Fastly Compute@Edge

1. Enable real-time analytics for live monitoring
2. Stream logs to external system for long-term storage
3. Use custom dashboards for visualization
4. Monitor via Fastly Control Panel

### Vercel Edge Functions

1. Integrate with Vercel Analytics for web vitals
2. Export to DataDog/New Relic for advanced monitoring
3. Use OpenTelemetry for standardization
4. Configure alerts in external system

### Generic Deployments

1. Choose appropriate buffer size for memory constraints
2. Implement reliable export mechanism
3. Consider using time-series database (InfluxDB, Prometheus)
4. Add retry logic for failed exports

## Migration Guide

### From v1 to v2

v1 used basic logging for metrics. v2 provides structured metrics:

```javascript
// v1
console.log(`Request duration: ${duration}ms`);

// v2
metricsAdapter.recordHistogram('request_duration', duration, {
  method: request.method,
  path: request.path
});
```

### Between Platforms

Metrics are portable between platforms:

```typescript
// Platform detection
const createMetricsAdapter = (logger: ILoggerAdapter) => {
  if (globalThis.ANALYTICS_ENGINE) {
    return new CloudflareMetricsAdapter(logger, 'optimizely_edge_', globalThis.ANALYTICS_ENGINE);
  } else if (globalThis.fastly) {
    return new FastlyMetricsAdapter(logger, 'optimizely_edge_');
  } else if (process.env.VERCEL) {
    return new VercelMetricsAdapter(logger, 'optimizely_edge_');
  } else {
    return new StandardMetricsAdapter(logger, 'optimizely_edge_');
  }
};
```

## See Also

- [Metrics Overview](./README.md)
- [Metrics API Endpoints](./api-endpoints.md)
- [Platform Deployment Guides](../deployment/README.md)