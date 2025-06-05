# Metrics Adapters Implementation Documentation

## Overview

This document provides technical implementation details for developers working with the metrics adapters in the Optimizely Edge Agent v2.

## Architecture

### Base Classes

#### BaseMetricsAdapter

All external metrics adapters extend `BaseMetricsAdapter`, which provides:

```typescript
export abstract class BaseMetricsAdapter extends StandardMetricsAdapter {
  protected environmentAdapter: IEnvironmentAdapter;
  protected buffer: MetricBuffer;
  protected retryManager: RetryManager;
  protected circuitBreaker: CircuitBreaker;
  
  // Shared utilities
  protected formatTags(tags?: MetricTags): string[];
  protected compress(data: string): Promise<ArrayBuffer>;
  protected mapMetricType(type: string): string;
  protected handleError(error: Error, operation: () => Promise<void>, data?: any): Promise<void>;
  
  // Must be implemented by subclasses
  abstract flush(): Promise<void>;
}
```

#### StandardMetricsAdapter

Provides in-memory metrics collection with these **protected** properties available to subclasses:

```typescript
export class StandardMetricsAdapter implements IMetricsAdapter {
  protected enabled: boolean;
  protected configuration: MetricsConfiguration;
  protected logger: ILoggerAdapter;
  protected metrics: MetricValue[];
  protected counters: Map<string, number>;
  protected gauges: Map<string, number>;
  protected histograms: Map<string, HistogramData>;
  protected sets: Map<string, Set<string>>;
  protected flushTimerId: ReturnType<typeof setTimeout> | null;
}
```

### Shared Components

#### MetricBuffer
```typescript
export class MetricBuffer {
  constructor(config: BufferConfig) {
    this.config = config;
    this.startFlushTimer();
  }
  
  add(metric: any): void;
  drain(): any[];
  isEmpty(): boolean;
  size(): number;
  stop(): void;
}
```

#### RetryManager
```typescript
export class RetryManager {
  async retry<T>(operation: () => Promise<T>): Promise<T>;
  private sleep(ms: number): Promise<void>;
}
```

#### CircuitBreaker
```typescript
export class CircuitBreaker {
  allowRequest(): boolean;
  recordSuccess(): void;
  recordFailure(): void;
}
```

## Adapter Implementations

### PrometheusMetricsAdapter

**Purpose**: Sends metrics to Prometheus Push Gateway
**Use Case**: Self-hosted monitoring, Kubernetes environments
**Limitations**: Push Gateway has known limitations for edge computing

#### Key Features
- Prometheus exposition format
- Metric type conversion (counter → counter, gauge → gauge, histogram → multiple gauges)
- Label sanitization for Prometheus compliance
- Instance ID generation for edge environments

#### Implementation Details
```typescript
export class PrometheusMetricsAdapter extends BaseMetricsAdapter {
  private pushGatewayUrl: string;
  private jobName: string;
  private instanceId: string;
  
  async flush(): Promise<void> {
    const metrics = this.collectAllMetrics();
    const body = this.formatMetricsForPrometheus(metrics);
    
    const url = `${this.pushGatewayUrl}/metrics/job/${this.jobName}/instance/${this.instanceId}`;
    
    await this.environmentAdapter.fetch(url, {
      method: 'PUT',
      body,
      headers: { 'Content-Type': 'text/plain; version=0.0.4' }
    });
  }
}
```

#### Prometheus Format Example
```
# HELP optly_edge_requests_total Counter metric for requests
# TYPE optly_edge_requests_total counter
optly_edge_requests_total{endpoint="api",job="optimizely_edge_agent",instance="edge_123"} 42 1234567890

# HELP optly_edge_response_time_sum Sum of response_time observations  
# TYPE optly_edge_response_time_sum gauge
optly_edge_response_time_sum{endpoint="api",job="optimizely_edge_agent",instance="edge_123"} 1250 1234567890
```

### DataDogMetricsAdapter

**Purpose**: Sends metrics to DataDog via HTTP API
**Use Case**: Production monitoring, cloud environments
**Benefits**: Full feature set, excellent edge support

#### Key Features
- Direct API integration with DataDog
- Batching up to 500 metrics per request
- Gzip compression
- Regional endpoint support
- Rich tagging support

#### Implementation Details
```typescript
export class DataDogMetricsAdapter extends BaseMetricsAdapter {
  private apiKey: string;
  private apiEndpoint: string;
  
  async flush(): Promise<void> {
    const metrics = this.collectAllMetrics();
    const batchSize = Math.min(this.configuration.batchSize || 500, 500);
    
    for (let i = 0; i < metrics.length; i += batchSize) {
      const batch = metrics.slice(i, i + batchSize);
      await this.sendBatch(batch);
    }
  }
  
  private async sendBatch(metrics: DataDogMetric[]): Promise<void> {
    const payload = { series: metrics.map(m => this.formatMetricForDataDog(m)) };
    
    await this.environmentAdapter.fetch(this.apiEndpoint, {
      method: 'POST',
      headers: {
        'DD-API-KEY': this.apiKey,
        'Content-Type': 'application/json',
        'Content-Encoding': 'gzip'
      },
      body: await this.compress(JSON.stringify(payload))
    });
  }
}
```

#### DataDog Format Example
```json
{
  "series": [
    {
      "metric": "optly.edge.requests",
      "points": [[1234567890, 42]],
      "type": "count",
      "tags": ["endpoint:api", "env:production", "service:optimizely-edge-agent"],
      "host": "optimizely-edge-agent-us-east-1"
    }
  ]
}
```

### NewRelicMetricsAdapter

**Purpose**: Sends metrics to New Relic via Metric API
**Use Case**: APM-focused monitoring, observability platforms
**Benefits**: Rich metadata support, good edge support

#### Key Features
- Direct Metric API integration
- Batching up to 1000 metrics per request
- Rich attribute support
- Regional endpoint support
- Summary format for histograms

#### Implementation Details
```typescript
export class NewRelicMetricsAdapter extends BaseMetricsAdapter {
  private licenseKey: string;
  private apiEndpoint: string;
  
  async flush(): Promise<void> {
    const metrics = this.collectAllMetrics();
    const batchSize = Math.min(this.configuration.batchSize || 1000, 1000);
    
    for (let i = 0; i < metrics.length; i += batchSize) {
      const batch = metrics.slice(i, i + batchSize);
      await this.sendBatch(batch);
    }
  }
  
  private formatMetricForNewRelic(metric: NewRelicMetric): any {
    return {
      name: metric.name,
      type: this.mapToNewRelicType(metric.type),
      value: metric.value,
      timestamp: metric.timestamp,
      attributes: {
        'service.name': this.serviceName,
        'service.environment': this.environment,
        'instrumentation.provider': 'optimizely-edge-agent',
        ...this.configuration.globalDimensions,
        ...metric.attributes
      }
    };
  }
}
```

#### New Relic Format Example
```json
[
  {
    "metrics": [
      {
        "name": "optly.edge.requests",
        "type": "count",
        "value": 42,
        "timestamp": 1234567890,
        "attributes": {
          "service.name": "optimizely-edge-agent",
          "service.environment": "production",
          "endpoint": "api",
          "metric.type": "counter"
        }
      }
    ]
  }
]
```

## Factory Integration

### VercelAdapterFactory

The factory creates metrics adapters based on the `METRICS_PROVIDER` environment variable:

```typescript
createMetricsAdapter(): IMetricsAdapter | undefined {
  const metricsProvider = this.environmentAdapter.getVariable('METRICS_PROVIDER');
  
  switch (metricsProvider?.toLowerCase()) {
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
```

### Composition Integration

The adapters integrate into the application via composition:

```typescript
// vercelComposition.ts
function composeVercelApplication(factoryInputs: VercelAdapterFactoryInputs): VercelApplication {
  const vercelFactory = new VercelAdapterFactory(factoryInputs);
  const metricsAdapter = vercelFactory.createMetricsAdapter();
  
  // Inject metrics into services
  const datafileService = new DatafileService(
    storageAdapter,
    environmentAdapter,
    logger,
    metricsAdapter, // ← Metrics integration
    flagStorageService,
    undefined
  );
  
  // Other services also receive metrics...
}
```

## Configuration Extraction

All adapters use a shared configuration extraction function:

```typescript
export function extractMetricsConfig(environmentAdapter: IEnvironmentAdapter): MetricsConfiguration {
  const getEnvVar = (key: string) => environmentAdapter.getVariable(key);
  const getEnvNumber = (key: string, defaultValue: number) => {
    const value = getEnvVar(key);
    return value ? parseFloat(value) : defaultValue;
  };
  const getEnvBoolean = (key: string, defaultValue: boolean) => {
    const value = getEnvVar(key);
    return value ? value.toLowerCase() === 'true' : defaultValue;
  };

  // Parse global dimensions from JSON
  let globalDimensions: MetricTags = {};
  const globalDimsStr = getEnvVar('OPTIMIZELY_METRICS_GLOBAL_DIMENSIONS');
  if (globalDimsStr) {
    try {
      globalDimensions = JSON.parse(globalDimsStr);
    } catch (e) {
      console.error('Failed to parse global dimensions:', e);
    }
  }

  return {
    enabled: getEnvBoolean('OPTIMIZELY_METRICS_ENABLED', true),
    prefix: getEnvVar('OPTIMIZELY_METRICS_PREFIX') || 'optimizely',
    globalDimensions,
    defaultSamplingRate: getEnvNumber('OPTIMIZELY_METRICS_SAMPLING_RATE', 1.0),
    maxDimensions: getEnvNumber('OPTIMIZELY_METRICS_MAX_DIMENSIONS', 10),
    enableHistograms: getEnvBoolean('OPTIMIZELY_METRICS_ENABLE_HISTOGRAMS', true),
    batchSize: getEnvNumber('OPTIMIZELY_METRICS_BATCH_SIZE', 100),
    flushIntervalMs: getEnvNumber('OPTIMIZELY_METRICS_FLUSH_INTERVAL_MS', 10000),
    bufferSize: getEnvNumber('OPTIMIZELY_METRICS_BUFFER_SIZE', 1000)
  };
}
```

## Error Handling & Resilience

### Retry Logic

All adapters include exponential backoff retry:

```typescript
export class RetryManager {
  async retry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error;
    let delay = this.config.initialDelay;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < this.config.maxRetries) {
          await this.sleep(delay);
          delay = Math.min(delay * this.config.backoffMultiplier, this.config.maxDelay);
        }
      }
    }

    throw lastError!;
  }
}
```

### Circuit Breaker

Prevents cascading failures:

```typescript
export class CircuitBreaker {
  allowRequest(): boolean {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime >= this.config.resetTimeout) {
        this.state = 'half-open';
        return true;
      }
      return false;
    }
    return true;
  }
}
```

### Error Handling Pattern

```typescript
protected async handleError(error: Error, operation: () => Promise<void>, data?: any): Promise<void> {
  this.logger.error(`Metrics submission failed: ${error.message}`, { error, data });
  
  if (!this.circuitBreaker.allowRequest()) {
    this.logger.warn('Circuit breaker is open, skipping retry');
    return;
  }
  
  try {
    await this.retryManager.retry(operation);
    this.circuitBreaker.recordSuccess();
  } catch (retryError) {
    this.circuitBreaker.recordFailure();
    this.logger.error('Metrics submission failed after retries', { error: retryError });
  }
}
```

## Testing

### Unit Testing

Each adapter can be tested with mock environment:

```typescript
describe('DataDogMetricsAdapter', () => {
  let adapter: DataDogMetricsAdapter;
  let mockEnvironment: IEnvironmentAdapter;
  let mockLogger: ILoggerAdapter;

  beforeEach(() => {
    mockEnvironment = {
      getVariable: jest.fn((key: string) => {
        const vars: Record<string, string> = {
          'DD_API_KEY': 'test-key',
          'DD_SITE': 'datadoghq.com',
          'OPTIMIZELY_METRICS_ENABLED': 'true'
        };
        return vars[key] || '';
      }),
      fetch: jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => 'OK'
      })
    };
    
    adapter = new DataDogMetricsAdapter(mockLogger, mockEnvironment);
  });

  it('should send metrics to DataDog', async () => {
    adapter.incrementCounter('test.requests', 5);
    await adapter.flush();
    
    expect(mockEnvironment.fetch).toHaveBeenCalledWith(
      'https://api.datadoghq.com/api/v1/series',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'DD-API-KEY': 'test-key'
        })
      })
    );
  });
});
```

### Integration Testing

Test with real endpoints (use test API keys):

```typescript
// Set test environment variables
process.env.METRICS_PROVIDER = 'datadog';
process.env.DD_API_KEY = 'test-key';
process.env.DD_ENV = 'test';

// Create real adapter
const factory = new VercelAdapterFactory(mockInputs);
const adapter = factory.createMetricsAdapter();

// Send test metrics
adapter?.incrementCounter('test.integration', 1);
await adapter?.flush();
```

## Creating New Adapters

To create a new metrics adapter:

1. **Extend BaseMetricsAdapter**:
```typescript
export class CustomMetricsAdapter extends BaseMetricsAdapter {
  constructor(logger: ILoggerAdapter, environmentAdapter: IEnvironmentAdapter) {
    super(logger, environmentAdapter);
    // Initialize provider-specific configuration
  }
  
  async flush(): Promise<void> {
    // Implement provider-specific flush logic
  }
}
```

2. **Add to Factory**:
```typescript
// In VercelAdapterFactory
case 'custom':
  return new CustomMetricsAdapter(logger, environmentAdapter);
```

3. **Document Configuration**:
Add environment variables and setup instructions to the setup guide.

## Performance Considerations

### Batching

All adapters implement batching to reduce API calls:
- **DataDog**: 500 metrics per batch
- **New Relic**: 1000 metrics per batch  
- **Prometheus**: Single request (Push Gateway limitation)

### Compression

DataDog and New Relic adapters use gzip compression:
```typescript
protected async compress(data: string): Promise<ArrayBuffer> {
  const stream = new CompressionStream('gzip');
  // ... compression logic
}
```

### Memory Management

Adapters clear internal state after successful flush:
```typescript
private clearInternalMetrics(): void {
  this.counters.clear();
  this.gauges.clear();
  this.histograms.clear();
  this.sets.clear();
  this.metrics = [];
}
```

## Debugging

Enable debug logging to troubleshoot metrics:

```env
LOG_LEVEL=debug
```

Look for these log messages:
```
[INFO] Metrics adapter successfully created and configured
[DEBUG] Successfully sent 50 metrics to DataDog
[WARN] Circuit breaker is open - metrics disabled temporarily
[ERROR] Metrics submission failed: Invalid API key
```

## Security

### API Key Management

- Store in environment variables, never in code
- Use different keys per environment
- Rotate keys regularly
- Monitor for unauthorized usage

### Data Privacy

- Avoid sending PII in metric names or tags
- Use sampling in high-traffic environments
- Consider data residency requirements (EU vs US regions)

## Monitoring

Monitor the metrics adapters themselves:
- API response times and error rates
- Circuit breaker activations
- Retry attempts and success rates
- Memory usage and performance impact