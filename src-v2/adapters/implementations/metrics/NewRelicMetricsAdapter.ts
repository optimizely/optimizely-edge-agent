import { BaseMetricsAdapter } from './BaseMetricsAdapter';
import { ILoggerAdapter } from '../../interfaces/ILoggerAdapter';
import { IEnvironmentAdapter } from '../../interfaces/IEnvironmentAdapter';
import { MetricTags } from '../../interfaces/IMetricsAdapter';

/**
 * New Relic metrics adapter for sending metrics to New Relic's Metric API.
 * This adapter is production-ready and optimized for edge environments.
 */
export class NewRelicMetricsAdapter extends BaseMetricsAdapter {
  private licenseKey: string;
  private apiEndpoint: string;
  private serviceName: string;
  private environment: string;
  private version: string;
  private metricsBuffer: NewRelicMetric[] = [];

  constructor(logger: ILoggerAdapter, environmentAdapter: IEnvironmentAdapter) {
    super(logger, environmentAdapter);
    
    this.licenseKey = environmentAdapter.getVariable('NEW_RELIC_LICENSE_KEY') || '';
    this.serviceName = environmentAdapter.getVariable('NEW_RELIC_APP_NAME') || 'optimizely-edge-agent';
    this.environment = environmentAdapter.getVariable('NEW_RELIC_ENVIRONMENT') || 'production';
    this.version = environmentAdapter.getVariable('NEW_RELIC_APP_VERSION') || '1.0.0';
    
    // Determine New Relic region
    const region = environmentAdapter.getVariable('NEW_RELIC_REGION') || 'US';
    this.apiEndpoint = region.toUpperCase() === 'EU' 
      ? 'https://metric-api.eu.newrelic.com/metric/v1'
      : 'https://metric-api.newrelic.com/metric/v1';
    
    if (!this.licenseKey) {
      this.logger.warn('New Relic license key not configured. Metrics will not be sent.');
      this.disable();
    }
    
    this.logger.info(`NewRelicMetricsAdapter initialized for region: ${region}, endpoint: ${this.apiEndpoint}`);
  }

  /**
   * Flushes buffered metrics to New Relic
   */
  async flush(): Promise<void> {
    if (!this.isEnabled() || !this.licenseKey) {
      return;
    }

    const metrics = this.collectAllMetrics();
    
    if (metrics.length === 0) {
      return;
    }

    // New Relic allows up to 1000 metrics per request with 1MB max payload
    const batchSize = Math.min(this.configuration.batchSize || 1000, 1000);
    
    for (let i = 0; i < metrics.length; i += batchSize) {
      const batch = metrics.slice(i, i + batchSize);
      await this.sendBatch(batch);
    }

    // Clear internal metrics after successful send
    this.clearInternalMetrics();
  }

  /**
   * Sends a batch of metrics to New Relic
   */
  private async sendBatch(metrics: NewRelicMetric[]): Promise<void> {
    try {
      const payload = [{
        metrics: metrics.map(metric => this.formatMetricForNewRelic(metric))
      }];

      const body = JSON.stringify(payload);
      
      await this.circuitBreaker.allowRequest() && await this.retryManager.retry(async () => {
        const response = await this.environmentAdapter.fetch(this.apiEndpoint, {
          method: 'POST',
          headers: {
            'Api-Key': this.licenseKey,
            'Content-Type': 'application/json',
            'Content-Encoding': 'gzip'
          },
          body: await this.compress(body)
        });
        
        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          throw new Error(`New Relic API responded with ${response.status}: ${errorText}`);
        }
        
        this.logger.debug(`Successfully sent ${metrics.length} metrics to New Relic`);
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
   * Formats a metric for New Relic API
   */
  private formatMetricForNewRelic(metric: NewRelicMetric): any {
    return {
      name: metric.name,
      type: this.mapToNewRelicType(metric.type),
      value: metric.value,
      timestamp: metric.timestamp,
      attributes: {
        // Standard attributes
        'service.name': this.serviceName,
        'service.environment': this.environment,
        'service.version': this.version,
        'instrumentation.provider': 'optimizely-edge-agent',
        'instrumentation.version': this.version,
        
        // Add global dimensions
        ...this.configuration.globalDimensions,
        
        // Add metric-specific attributes
        ...metric.attributes
      }
    };
  }

  /**
   * Maps internal metric types to New Relic types
   */
  private mapToNewRelicType(type: string): string {
    const typeMap: Record<string, string> = {
      'counter': 'count',
      'gauge': 'gauge',
      'histogram': 'summary',
      'timer': 'summary',
      'summary': 'summary',
      'set': 'gauge'
    };
    return typeMap[type] || 'gauge';
  }

  /**
   * Collects all metrics from internal state
   */
  private collectAllMetrics(): NewRelicMetric[] {
    const metrics: NewRelicMetric[] = [];
    const timestamp = Date.now();

    // Collect counters
    this.counters.forEach((value, name) => {
      metrics.push({
        name: this.prefixMetricName(name),
        type: 'counter',
        value,
        timestamp,
        attributes: {
          'metric.type': 'counter'
        }
      });
    });

    // Collect gauges
    this.gauges.forEach((value, name) => {
      metrics.push({
        name: this.prefixMetricName(name),
        type: 'gauge',
        value,
        timestamp,
        attributes: {
          'metric.type': 'gauge'
        }
      });
    });

    // Collect histograms as summaries
    this.histograms.forEach((data, name) => {
      const baseName = this.prefixMetricName(name);
      
      // New Relic summary format with all statistics
      metrics.push({
        name: baseName,
        type: 'summary',
        value: data.count, // Use count as the primary value
        timestamp,
        attributes: {
          'metric.type': 'histogram',
          'summary.count': data.count,
          'summary.sum': data.sum,
          'summary.min': data.min !== Infinity ? data.min : 0,
          'summary.max': data.max !== -Infinity ? data.max : 0,
          'summary.avg': data.count > 0 ? data.sum / data.count : 0
        }
      });
    });

    // Collect sets
    this.sets.forEach((set, name) => {
      metrics.push({
        name: this.prefixMetricName(name),
        type: 'gauge',
        value: set.size,
        timestamp,
        attributes: {
          'metric.type': 'set',
          'set.cardinality': set.size
        }
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
 * Internal type for New Relic metrics
 */
interface NewRelicMetric {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'timer' | 'summary' | 'set';
  value: number;
  timestamp: number;
  attributes: Record<string, any>;
}