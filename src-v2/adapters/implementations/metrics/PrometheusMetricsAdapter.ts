import { BaseMetricsAdapter, MetricBuffer } from './BaseMetricsAdapter';
import { ILoggerAdapter } from '../../interfaces/ILoggerAdapter';
import { IEnvironmentAdapter } from '../../interfaces/IEnvironmentAdapter';
import { MetricTags, MetricType } from '../../interfaces/IMetricsAdapter';

/**
 * Prometheus Push Gateway adapter for metrics collection.
 * 
 * NOTE: Push Gateway has limitations and is not recommended for general metrics.
 * It's best suited for batch jobs and edge aggregation scenarios.
 * For high-volume metrics, consider DataDog or New Relic adapters.
 */
export class PrometheusMetricsAdapter extends BaseMetricsAdapter {
  private pushGatewayUrl: string;
  private jobName: string;
  private instanceId: string;
  private metricsBuffer: PrometheusMetric[] = [];

  constructor(logger: ILoggerAdapter, environmentAdapter: IEnvironmentAdapter) {
    super(logger, environmentAdapter);
    
    this.pushGatewayUrl = environmentAdapter.getVariable('PROMETHEUS_PUSH_GATEWAY_URL') || '';
    this.jobName = environmentAdapter.getVariable('PROMETHEUS_JOB_NAME') || 'optimizely_edge_agent';
    this.instanceId = environmentAdapter.getVariable('PROMETHEUS_INSTANCE_ID') || this.generateInstanceId();
    
    if (!this.pushGatewayUrl) {
      this.logger.warn('Prometheus Push Gateway URL not configured. Metrics will not be sent.');
      this.disable();
    }
    
    this.logger.info(`PrometheusMetricsAdapter initialized with gateway: ${this.pushGatewayUrl}`);
  }

  /**
   * Flushes buffered metrics to Prometheus Push Gateway
   */
  async flush(): Promise<void> {
    if (!this.isEnabled() || !this.pushGatewayUrl) {
      return;
    }

    // Get all metrics from StandardMetricsAdapter's internal state
    const metrics = this.collectAllMetrics();
    
    if (metrics.length === 0) {
      return;
    }

    try {
      const body = this.formatMetricsForPrometheus(metrics);
      
      // Push Gateway expects metrics at /metrics/job/<job>/instance/<instance>
      const url = `${this.pushGatewayUrl}/metrics/job/${this.jobName}/instance/${this.instanceId}`;
      
      await this.circuitBreaker.allowRequest() && await this.retryManager.retry(async () => {
        const response = await this.environmentAdapter.fetch(url, {
          method: 'PUT', // PUT replaces all metrics for this job/instance
          body,
          headers: {
            'Content-Type': 'text/plain; version=0.0.4',
            'Content-Length': body.length.toString()
          }
        });
        
        if (!response.ok) {
          throw new Error(`Push Gateway responded with ${response.status}: ${response.statusText}`);
        }
        
        this.logger.debug(`Successfully pushed ${metrics.length} metrics to Prometheus`);
        this.circuitBreaker.recordSuccess();
      });
      
      // Clear internal metrics after successful push
      this.clearInternalMetrics();
      
    } catch (error) {
      this.circuitBreaker.recordFailure();
      await this.handleError(
        error as Error,
        () => this.flush(),
        { metricsCount: metrics.length }
      );
    }
  }

  /**
   * Collects all metrics from internal state
   */
  private collectAllMetrics(): PrometheusMetric[] {
    const metrics: PrometheusMetric[] = [];
    const timestamp = Date.now();

    // Collect counters
    this.counters.forEach((value, name) => {
      metrics.push({
        name: this.prefixMetricName(name),
        type: 'counter',
        value,
        timestamp,
        help: `Counter metric for ${name}`
      });
    });

    // Collect gauges
    this.gauges.forEach((value, name) => {
      metrics.push({
        name: this.prefixMetricName(name),
        type: 'gauge',
        value,
        timestamp,
        help: `Gauge metric for ${name}`
      });
    });

    // Collect histograms (simplified as gauges for Push Gateway)
    this.histograms.forEach((data, name) => {
      const prefixedName = this.prefixMetricName(name);
      
      // Prometheus histogram format includes sum, count, and buckets
      metrics.push({
        name: `${prefixedName}_sum`,
        type: 'gauge',
        value: data.sum,
        timestamp,
        help: `Sum of ${name} observations`
      });
      
      metrics.push({
        name: `${prefixedName}_count`,
        type: 'gauge',
        value: data.count,
        timestamp,
        help: `Count of ${name} observations`
      });
      
      // Add min/max as additional gauges
      if (data.min !== Infinity) {
        metrics.push({
          name: `${prefixedName}_min`,
          type: 'gauge',
          value: data.min,
          timestamp,
          help: `Minimum value of ${name}`
        });
      }
      
      if (data.max !== -Infinity) {
        metrics.push({
          name: `${prefixedName}_max`,
          type: 'gauge',
          value: data.max,
          timestamp,
          help: `Maximum value of ${name}`
        });
      }
    });

    // Collect sets (as gauge showing unique count)
    this.sets.forEach((set, name) => {
      metrics.push({
        name: this.prefixMetricName(name),
        type: 'gauge',
        value: set.size,
        timestamp,
        help: `Unique count for set ${name}`
      });
    });

    return metrics;
  }

  /**
   * Formats metrics in Prometheus exposition format
   */
  private formatMetricsForPrometheus(metrics: PrometheusMetric[]): string {
    const lines: string[] = [];
    const processedMetrics = new Set<string>();

    for (const metric of metrics) {
      // Skip if we've already processed this metric name/type combo
      const metricKey = `${metric.name}:${metric.type}`;
      if (processedMetrics.has(metricKey)) {
        continue;
      }
      processedMetrics.add(metricKey);

      // Add TYPE and HELP lines (Prometheus format)
      if (metric.help) {
        lines.push(`# HELP ${metric.name} ${metric.help}`);
      }
      lines.push(`# TYPE ${metric.name} ${metric.type}`);
      
      // Format metric line
      const labels = this.formatLabelsForPrometheus(metric.tags);
      const labelStr = labels.length > 0 ? `{${labels.join(',')}}` : '';
      
      // Add timestamp in milliseconds (Prometheus expects seconds, but some implementations accept ms)
      lines.push(`${metric.name}${labelStr} ${metric.value} ${metric.timestamp}`);
    }

    // Add a newline at the end (Prometheus format requirement)
    return lines.join('\n') + '\n';
  }

  /**
   * Formats tags/labels for Prometheus
   */
  private formatLabelsForPrometheus(tags?: MetricTags): string[] {
    const allTags = {
      ...this.configuration.globalDimensions,
      ...tags,
      job: this.jobName,
      instance: this.instanceId
    };

    return Object.entries(allTags)
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([key, value]) => {
        // Escape quotes in label values
        const escapedValue = String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        return `${this.sanitizeLabelName(key)}="${escapedValue}"`;
      });
  }

  /**
   * Sanitizes label names to be Prometheus-compliant
   */
  private sanitizeLabelName(name: string): string {
    // Prometheus label names must match [a-zA-Z_][a-zA-Z0-9_]*
    return name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^([0-9])/, '_$1');
  }

  /**
   * Sanitizes metric names to be Prometheus-compliant
   */
  private sanitizeMetricName(name: string): string {
    // Prometheus metric names must match [a-zA-Z_:][a-zA-Z0-9_:]*
    return name.replace(/[^a-zA-Z0-9_:]/g, '_').replace(/^([0-9])/, '_$1');
  }

  /**
   * Prefixes metric name with configured prefix
   */
  private prefixMetricName(name: string): string {
    const sanitizedName = this.sanitizeMetricName(name);
    return this.configuration.prefix 
      ? `${this.sanitizeMetricName(this.configuration.prefix)}_${sanitizedName}`
      : sanitizedName;
  }

  /**
   * Generates a unique instance ID for this edge worker
   */
  private generateInstanceId(): string {
    // In edge environments, we might not have a stable hostname
    // Use a combination of timestamp and random value
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `edge_${timestamp}_${random}`;
  }

  /**
   * Clear internal metrics after successful flush
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
 * Internal type for Prometheus metrics
 */
interface PrometheusMetric {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  value: number;
  timestamp: number;
  tags?: MetricTags;
  help?: string;
}