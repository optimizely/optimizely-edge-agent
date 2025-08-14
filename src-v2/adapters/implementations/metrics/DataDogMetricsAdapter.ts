import { BaseMetricsAdapter } from './BaseMetricsAdapter';
import { ILoggerAdapter } from '../../interfaces/ILoggerAdapter';
import { IEnvironmentAdapter } from '../../interfaces/IEnvironmentAdapter';
import { MetricTags } from '../../interfaces/IMetricsAdapter';

/**
 * DataDog metrics adapter for sending metrics to DataDog's metrics API.
 * This adapter is production-ready and optimized for edge environments.
 */
export class DataDogMetricsAdapter extends BaseMetricsAdapter {
  private apiKey: string;
  private apiEndpoint: string;
  private serviceName: string;
  private environment: string;
  private version: string;
  private metricsBuffer: DataDogMetric[] = [];

  constructor(logger: ILoggerAdapter, environmentAdapter: IEnvironmentAdapter) {
    super(logger, environmentAdapter);
    
    this.apiKey = environmentAdapter.getVariable('DD_API_KEY') || '';
    this.serviceName = environmentAdapter.getVariable('DD_SERVICE') || 'optimizely-edge-agent';
    this.environment = environmentAdapter.getVariable('DD_ENV') || 'production';
    this.version = environmentAdapter.getVariable('DD_VERSION') || '1.0.0';
    
    // Determine DataDog site/region
    const ddSite = environmentAdapter.getVariable('DD_SITE') || 'datadoghq.com';
    this.apiEndpoint = `https://api.${ddSite}/api/v1/series`;
    
    if (!this.apiKey) {
      this.logger.warn('DataDog API key not configured. Metrics will not be sent.');
      this.disable();
    }
    
    this.logger.info(`DataDogMetricsAdapter initialized for site: ${ddSite}`);
  }

  /**
   * Flushes buffered metrics to DataDog
   */
  async flush(): Promise<void> {
    if (!this.isEnabled() || !this.apiKey) {
      return;
    }

    const metrics = this.collectAllMetrics();
    
    if (metrics.length === 0) {
      return;
    }

    // DataDog allows up to 500 series per request
    const batchSize = Math.min(this.configuration.batchSize || 500, 500);
    
    for (let i = 0; i < metrics.length; i += batchSize) {
      const batch = metrics.slice(i, i + batchSize);
      await this.sendBatch(batch);
    }

    // Clear internal metrics after successful send
    this.clearInternalMetrics();
  }

  /**
   * Sends a batch of metrics to DataDog
   */
  private async sendBatch(metrics: DataDogMetric[]): Promise<void> {
    try {
      const payload = {
        series: metrics.map(metric => this.formatMetricForDataDog(metric))
      };

      const body = JSON.stringify(payload);
      
      await this.circuitBreaker.allowRequest() && await this.retryManager.retry(async () => {
        const response = await this.environmentAdapter.fetch(this.apiEndpoint, {
          method: 'POST',
          headers: {
            'DD-API-KEY': this.apiKey,
            'Content-Type': 'application/json',
            'Content-Encoding': 'gzip'
          },
          body: await this.compress(body)
        });
        
        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          throw new Error(`DataDog API responded with ${response.status}: ${errorText}`);
        }
        
        this.logger.debug(`Successfully sent ${metrics.length} metrics to DataDog`);
        this.circuitBreaker.recordSuccess();
      });
      
    } catch (error) {
      this.circuitBreaker.recordFailure();
      await this.handleError(
        error as Error,
        () => this.sendBatch(metrics),
        { metricsCount: metrics.length, batch: metrics }
      );
    }
  }

  /**
   * Formats a metric for DataDog API
   */
  private formatMetricForDataDog(metric: DataDogMetric): any {
    return {
      metric: metric.name,
      points: [[Math.floor(metric.timestamp / 1000), metric.value]], // DataDog expects seconds
      type: this.mapToDataDogType(metric.type),
      tags: this.formatTagsForDataDog(metric.tags),
      host: this.generateHostname(),
      source_type_name: 'edge-agent'
    };
  }

  /**
   * Maps internal metric types to DataDog types
   */
  private mapToDataDogType(type: string): string {
    const typeMap: Record<string, string> = {
      'counter': 'count',
      'gauge': 'gauge',
      'histogram': 'gauge',
      'timer': 'gauge',
      'summary': 'gauge',
      'set': 'gauge'
    };
    return typeMap[type] || 'gauge';
  }

  /**
   * Formats tags for DataDog (as array of strings)
   */
  private formatTagsForDataDog(tags?: MetricTags): string[] {
    const defaultTags = {
      service: this.serviceName,
      env: this.environment,
      version: this.version,
      ...this.configuration.globalDimensions
    };

    const allTags = { ...defaultTags, ...tags };
    
    return Object.entries(allTags)
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([key, value]) => `${key}:${value}`);
  }

  /**
   * Collects all metrics from internal state
   */
  private collectAllMetrics(): DataDogMetric[] {
    const metrics: DataDogMetric[] = [];
    const timestamp = Date.now();

    // Collect counters
    this.counters.forEach((value, name) => {
      metrics.push({
        name: this.prefixMetricName(name),
        type: 'counter',
        value,
        timestamp,
        tags: {}
      });
    });

    // Collect gauges
    this.gauges.forEach((value, name) => {
      metrics.push({
        name: this.prefixMetricName(name),
        type: 'gauge',
        value,
        timestamp,
        tags: {}
      });
    });

    // Collect histograms
    this.histograms.forEach((data, name) => {
      const baseName = this.prefixMetricName(name);
      
      // Send histogram stats as separate gauges
      metrics.push({
        name: `${baseName}.sum`,
        type: 'gauge',
        value: data.sum,
        timestamp,
        tags: {}
      });
      
      metrics.push({
        name: `${baseName}.count`,
        type: 'gauge',
        value: data.count,
        timestamp,
        tags: {}
      });
      
      if (data.min !== Infinity) {
        metrics.push({
          name: `${baseName}.min`,
          type: 'gauge',
          value: data.min,
          timestamp,
          tags: {}
        });
      }
      
      if (data.max !== -Infinity) {
        metrics.push({
          name: `${baseName}.max`,
          type: 'gauge',
          value: data.max,
          timestamp,
          tags: {}
        });
      }

      // Calculate and send average
      if (data.count > 0) {
        metrics.push({
          name: `${baseName}.avg`,
          type: 'gauge',
          value: data.sum / data.count,
          timestamp,
          tags: {}
        });
      }
    });

    // Collect sets
    this.sets.forEach((set, name) => {
      metrics.push({
        name: this.prefixMetricName(name),
        type: 'gauge',
        value: set.size,
        timestamp,
        tags: {}
      });
    });

    return metrics;
  }

  /**
   * Prefixes metric name with configured prefix
   */
  private prefixMetricName(name: string): string {
    return this.configuration.prefix 
      ? `${this.configuration.prefix}.${name}`
      : name;
  }

  /**
   * Generates a hostname for DataDog (edge environments don't have stable hostnames)
   */
  private generateHostname(): string {
    // Use environment-specific hostname pattern
    const region = this.environmentAdapter.getVariable('VERCEL_REGION') || 
                   this.environmentAdapter.getVariable('CF_RAY') || 
                   'edge';
    return `${this.serviceName}-${region}`;
  }

  /**
   * Clear internal metrics after successful send
   */
  private clearInternalMetrics(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.sets.clear();
    this.metrics = [];
  }
}

/**
 * Internal type for DataDog metrics
 */
interface DataDogMetric {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'timer' | 'summary' | 'set';
  value: number;
  timestamp: number;
  tags: MetricTags;
}