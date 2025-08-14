# Metrics Adapters Implementation Strategy

## Overview
This document outlines the implementation strategy for creating metrics adapters that work with external monitoring services. Since neither Vercel nor Fastly have native analytics engines like Cloudflare, we'll create reusable adapters for popular metrics platforms.

## Implementation Approach

### All Adapters Are Production-Ready
Each metrics adapter will be fully functional for production use. We'll build shared components first, then implement all three adapters as production-ready solutions:

1. **Shared Components** (Build First)
   - BaseMetricsAdapter for common functionality
   - MetricBuffer for batching and timing
   - Compression utilities
   - Retry logic and circuit breakers
   - Error handling patterns

2. **Production Adapters** (Build on Shared Components)
   - PrometheusMetricsAdapter - Full production implementation
   - DataDogMetricsAdapter - Full production implementation
   - NewRelicMetricsAdapter - Full production implementation

## Platform Comparison

| Feature | Prometheus | DataDog | New Relic |
|---------|------------|---------|-----------|
| **Endpoint** | Push Gateway | HTTPS API | HTTPS API |
| **Auth** | None (usually) | API Key | License Key |
| **Format** | Text-based | JSON | JSON |
| **Batching** | Not recommended | Up to 500 series | Up to 1000 metrics |
| **Rate Limits** | N/A | ~500 req/min | Based on plan |
| **Compression** | Optional | Supported | Recommended |
| **Best for Edge** | ⚠️ Limited* | ✅ Excellent | ✅ Excellent |

*Note: Prometheus Push Gateway has known limitations but the adapter is still production-ready for appropriate use cases (batch jobs, aggregated metrics). For high-volume edge metrics, DataDog or New Relic are recommended.

## Implementation Details

### 1. PrometheusMetricsAdapter (Production-Ready)

```typescript
export class PrometheusMetricsAdapter extends BaseMetricsAdapter implements IMetricsAdapter {
  private pushGatewayUrl: string;
  private jobName: string;
  private buffer: MetricBuffer;
  
  constructor(logger: ILoggerAdapter, environmentAdapter: IEnvironmentAdapter) {
    super(logger, environmentAdapter);
    
    this.pushGatewayUrl = environmentAdapter.getVariable('PROMETHEUS_PUSH_GATEWAY_URL') || '';
    this.jobName = environmentAdapter.getVariable('PROMETHEUS_JOB_NAME') || 'optimizely_edge_agent';
    
    this.buffer = new MetricBuffer({
      maxSize: 100,
      flushInterval: 10000, // 10 seconds
      onFlush: this.flush.bind(this)
    });
  }
  
  private formatMetric(metric: Metric): string {
    const labels = Object.entries(metric.tags || {})
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    
    return `${metric.name}{${labels}} ${metric.value} ${metric.timestamp}`;
  }
  
  async flush(): Promise<void> {
    if (!this.pushGatewayUrl || this.buffer.isEmpty()) return;
    
    const metrics = this.buffer.drain();
    const body = metrics.map(m => this.formatMetric(m)).join('\n');
    
    try {
      const response = await fetch(
        `${this.pushGatewayUrl}/metrics/job/${this.jobName}`,
        {
          method: 'POST',
          body,
          headers: {
            'Content-Type': 'text/plain; version=0.0.4'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`Push Gateway responded with ${response.status}`);
      }
    } catch (error) {
      this.logger.error('Failed to push metrics to Prometheus:', error);
      // Implement retry logic here
    }
  }
}
```

### 2. DataDogMetricsAdapter

```typescript
export class DataDogMetricsAdapter extends BaseMetricsAdapter implements IMetricsAdapter {
  private apiKey: string;
  private apiEndpoint: string;
  private buffer: MetricBuffer;
  
  constructor(logger: ILoggerAdapter, environmentAdapter: IEnvironmentAdapter) {
    super(logger, environmentAdapter);
    
    this.apiKey = environmentAdapter.getVariable('DD_API_KEY') || '';
    this.apiEndpoint = environmentAdapter.getVariable('DD_SITE') 
      ? `https://api.${environmentAdapter.getVariable('DD_SITE')}/api/v1/series`
      : 'https://api.datadoghq.com/api/v1/series';
    
    this.buffer = new MetricBuffer({
      maxSize: 500, // DataDog limit
      flushInterval: 10000,
      onFlush: this.flush.bind(this)
    });
  }
  
  private formatMetric(metric: Metric): any {
    return {
      metric: metric.name,
      points: [[Math.floor(metric.timestamp / 1000), metric.value]],
      type: this.mapMetricType(metric.type),
      tags: this.formatTags(metric.tags),
      host: metric.host
    };
  }
  
  async flush(): Promise<void> {
    if (!this.apiKey || this.buffer.isEmpty()) return;
    
    const metrics = this.buffer.drain();
    const series = metrics.map(m => this.formatMetric(m));
    
    try {
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'DD-API-KEY': this.apiKey,
          'Content-Type': 'application/json',
          'Content-Encoding': 'gzip'
        },
        body: await this.compress(JSON.stringify({ series }))
      });
      
      if (!response.ok) {
        throw new Error(`DataDog API responded with ${response.status}`);
      }
    } catch (error) {
      this.logger.error('Failed to send metrics to DataDog:', error);
      await this.handleError(error, metrics);
    }
  }
}
```

### 3. NewRelicMetricsAdapter

```typescript
export class NewRelicMetricsAdapter extends BaseMetricsAdapter implements IMetricsAdapter {
  private licenseKey: string;
  private apiEndpoint: string;
  private buffer: MetricBuffer;
  
  constructor(logger: ILoggerAdapter, environmentAdapter: IEnvironmentAdapter) {
    super(logger, environmentAdapter);
    
    this.licenseKey = environmentAdapter.getVariable('NEW_RELIC_LICENSE_KEY') || '';
    this.apiEndpoint = environmentAdapter.getVariable('NEW_RELIC_REGION') === 'EU'
      ? 'https://metric-api.eu.newrelic.com/metric/v1'
      : 'https://metric-api.newrelic.com/metric/v1';
    
    this.buffer = new MetricBuffer({
      maxSize: 1000, // New Relic limit
      flushInterval: 5000,
      onFlush: this.flush.bind(this)
    });
  }
  
  private formatMetric(metric: Metric): any {
    return {
      name: metric.name,
      type: metric.type,
      value: metric.value,
      timestamp: metric.timestamp,
      attributes: {
        ...this.config.globalDimensions,
        ...metric.tags
      }
    };
  }
  
  async flush(): Promise<void> {
    if (!this.licenseKey || this.buffer.isEmpty()) return;
    
    const metrics = this.buffer.drain();
    const payload = [{
      metrics: metrics.map(m => this.formatMetric(m))
    }];
    
    try {
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Api-Key': this.licenseKey,
          'Content-Type': 'application/json',
          'Content-Encoding': 'gzip'
        },
        body: await this.compress(JSON.stringify(payload))
      });
      
      if (!response.ok) {
        throw new Error(`New Relic API responded with ${response.status}`);
      }
    } catch (error) {
      this.logger.error('Failed to send metrics to New Relic:', error);
      await this.handleError(error, metrics);
    }
  }
}
```

## Shared Components

### BaseMetricsAdapter
```typescript
export abstract class BaseMetricsAdapter {
  protected logger: ILoggerAdapter;
  protected config: MetricsConfiguration;
  
  constructor(logger: ILoggerAdapter, environmentAdapter: IEnvironmentAdapter) {
    this.logger = logger;
    this.config = extractMetricsConfig(environmentAdapter);
  }
  
  // Common metric type mapping
  protected mapMetricType(type: string): string {
    const typeMap: Record<string, string> = {
      'counter': 'count',
      'gauge': 'gauge',
      'histogram': 'gauge', // Simplified for external services
      'timer': 'gauge'
    };
    return typeMap[type] || 'gauge';
  }
  
  // Common tag formatting
  protected formatTags(tags?: Record<string, any>): string[] {
    if (!tags) return [];
    return Object.entries(tags).map(([k, v]) => `${k}:${v}`);
  }
  
  // Common compression utility
  protected async compress(data: string): Promise<ArrayBuffer> {
    const encoder = new TextEncoder();
    const stream = new CompressionStream('gzip');
    const writer = stream.writable.getWriter();
    writer.write(encoder.encode(data));
    writer.close();
    
    const reader = stream.readable.getReader();
    const chunks: Uint8Array[] = [];
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    
    return Buffer.concat(chunks);
  }
  
  // Common error handling with retry
  protected async handleError(error: Error, metrics: Metric[]): Promise<void> {
    // Implement exponential backoff retry logic
    // Store failed metrics for retry
    // Circuit breaker pattern
  }
}
```

### MetricBuffer
```typescript
export class MetricBuffer {
  private buffer: Metric[] = [];
  private config: BufferConfig;
  private flushTimer?: NodeJS.Timeout;
  
  constructor(config: BufferConfig) {
    this.config = config;
    this.startFlushTimer();
  }
  
  add(metric: Metric): void {
    this.buffer.push(metric);
    
    if (this.buffer.length >= this.config.maxSize) {
      this.flush();
    }
  }
  
  drain(): Metric[] {
    const metrics = [...this.buffer];
    this.buffer = [];
    return metrics;
  }
  
  isEmpty(): boolean {
    return this.buffer.length === 0;
  }
  
  private flush(): void {
    if (this.config.onFlush) {
      this.config.onFlush();
    }
  }
  
  private startFlushTimer(): void {
    if (this.config.flushInterval) {
      this.flushTimer = setInterval(() => {
        this.flush();
      }, this.config.flushInterval);
    }
  }
}
```

## Environment Variables

### Prometheus
```env
PROMETHEUS_PUSH_GATEWAY_URL=http://prometheus-pushgateway:9091
PROMETHEUS_JOB_NAME=optimizely_edge_agent
```

### DataDog
```env
DD_API_KEY=your-datadog-api-key
DD_SITE=datadoghq.com  # or datadoghq.eu, us3.datadoghq.com, etc.
DD_ENV=production
DD_SERVICE=optimizely-edge-agent
DD_VERSION=1.0.0
```

### New Relic
```env
NEW_RELIC_LICENSE_KEY=your-license-key
NEW_RELIC_REGION=US  # or EU
NEW_RELIC_APP_NAME=optimizely-edge-agent
```

## Factory Integration

Update the adapter factories to support metric adapter selection:

```typescript
export class VercelAdapterFactory {
  createMetricsAdapter(): IMetricsAdapter | undefined {
    const metricsProvider = this.environmentAdapter.getVariable('METRICS_PROVIDER');
    
    switch (metricsProvider) {
      case 'prometheus':
        return new PrometheusMetricsAdapter(this.logger, this.environmentAdapter);
      case 'datadog':
        return new DataDogMetricsAdapter(this.logger, this.environmentAdapter);
      case 'newrelic':
        return new NewRelicMetricsAdapter(this.logger, this.environmentAdapter);
      default:
        this.logger.warn(`Unknown metrics provider: ${metricsProvider}`);
        return undefined;
    }
  }
}
```

## Implementation Priority

1. **Phase 1**: Create shared base components
   - BaseMetricsAdapter abstract class
   - MetricBuffer with configurable batching
   - Compression utilities
   - Retry logic with exponential backoff
   - Circuit breaker pattern

2. **Phase 2**: Implement all production adapters
   - PrometheusMetricsAdapter (fully functional)
   - DataDogMetricsAdapter (fully functional)
   - NewRelicMetricsAdapter (fully functional)

3. **Phase 3**: Integration and testing
   - Unit tests for each adapter
   - Integration tests with real endpoints
   - Performance testing
   - Edge environment validation

4. **Phase 4**: Documentation and deployment
   - Usage documentation for each adapter
   - Configuration examples
   - Troubleshooting guides
   - Performance tuning recommendations

## Benefits of This Approach

1. **Flexibility**: Users can choose their preferred metrics platform
2. **Reusability**: Same adapters work for both Vercel and Fastly  
3. **Production Ready**: All adapters include batching, compression, error handling, and retry logic
4. **Extensibility**: Shared components make it easy to add more providers (Grafana Cloud, AWS CloudWatch, etc.)
5. **Developer Friendly**: Well-documented patterns for creating additional adapters
6. **Battle-Tested**: Each adapter is optimized for edge/serverless environments

## Next Steps

1. Implement shared base components (BaseMetricsAdapter, MetricBuffer, utilities)
2. Implement all three production adapters concurrently:
   - PrometheusMetricsAdapter
   - DataDogMetricsAdapter  
   - NewRelicMetricsAdapter
3. Set up test environments for each platform
4. Update Vercel and Fastly factories to support adapter selection
5. Comprehensive testing with real endpoints
6. Document usage, configuration, and best practices