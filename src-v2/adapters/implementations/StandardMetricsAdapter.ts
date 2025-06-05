import { 
  IMetricsAdapter, 
  MetricTags, 
  MetricOptions, 
  MetricsConfiguration, 
  TimerMetric,
  MetricType
} from '../interfaces/IMetricsAdapter';
import { ILoggerAdapter } from '../interfaces/ILoggerAdapter';

/**
 * Represents a stored metric value.
 */
interface MetricValue {
  name: string;
  type: MetricType;
  value: number;
  timestamp: number;
  tags?: MetricTags;
  options?: MetricOptions;
}

/**
 * Represents a histogram with statistical data.
 */
interface HistogramData {
  count: number;
  sum: number;
  min: number;
  max: number;
  values: number[];
}

/**
 * Standard implementation of IMetricsAdapter that provides in-memory metrics collection
 * with optional logging. This implementation is suitable for most environments.
 */
export class StandardMetricsAdapter implements IMetricsAdapter {
  protected enabled: boolean = false;
  protected configuration: MetricsConfiguration;
  protected logger: ILoggerAdapter;
  protected metrics: MetricValue[] = [];
  protected counters: Map<string, number> = new Map();
  protected gauges: Map<string, number> = new Map();
  protected histograms: Map<string, HistogramData> = new Map();
  protected sets: Map<string, Set<string>> = new Map();
  protected flushTimerId: ReturnType<typeof setTimeout> | null = null;
  protected readonly logPrefix = '[StandardMetricsAdapter]';

  /**
   * Creates a new instance of StandardMetricsAdapter.
   * @param logger - The logger adapter for logging metrics operations.
   * @param config - Optional configuration options.
   */
  constructor(logger: ILoggerAdapter, config?: Partial<MetricsConfiguration>) {
    this.logger = logger;
    
    // Default configuration
    this.configuration = {
      prefix: 'optly_edge_',
      globalDimensions: {},
      defaultSamplingRate: 1.0,
      maxDimensions: 20,
      enableHistograms: true,
      batchSize: 10,
      flushIntervalMs: 10000,
      bufferSize: 100,
      enabled: true
    };
    
    if (config) {
      this.updateConfiguration(config);
    } else {
      this.enabled = this.configuration.enabled || false;
    }
    
    this.logger.info(`${this.logPrefix} Initialized with prefix: ${this.configuration.prefix}`);
    
    // Start automatic flushing if enabled
    this.startAutoFlush();
  }

  /**
   * Starts the automatic flush timer.
   */
  private startAutoFlush(): void {
    if (this.flushTimerId) {
      clearTimeout(this.flushTimerId);
    }
    
    if (this.enabled && this.configuration.flushIntervalMs && this.configuration.flushIntervalMs > 0) {
      this.flushTimerId = setTimeout(async () => {
        await this.flush();
        this.startAutoFlush();
      }, this.configuration.flushIntervalMs);
    }
  }

  /**
   * Generates a unique key for a metric based on its name and tags.
   * @param name - The metric name.
   * @param tags - The metric tags.
   * @returns A unique string key.
   */
  private getMetricKey(name: string, tags?: MetricTags): string {
    const formattedName = this.formatMetricName(name);
    
    if (!tags || Object.keys(tags).length === 0) {
      return formattedName;
    }
    
    // Sort keys for consistent order
    const sortedTags = Object.keys(tags).sort().map(key => `${key}:${tags[key]}`).join(',');
    return `${formattedName}[${sortedTags}]`;
  }

  /**
   * Formats a metric name with the configured prefix.
   * @param name - The base metric name.
   * @returns The formatted metric name.
   */
  private formatMetricName(name: string): string {
    return `${this.configuration.prefix}${name}`;
  }

  /**
   * Merges the provided tags with the global dimensions.
   * @param tags - The tags to merge.
   * @returns The merged tags.
   */
  private mergeTags(tags?: MetricTags): MetricTags {
    const result: MetricTags = { ...this.configuration.globalDimensions };
    
    if (tags) {
      // Add tags, but respect maxDimensions limit
      const availableSlots = this.configuration.maxDimensions 
        ? this.configuration.maxDimensions - Object.keys(result).length 
        : Infinity;
        
      if (availableSlots > 0) {
        const tagKeys = Object.keys(tags).slice(0, availableSlots);
        for (const key of tagKeys) {
          result[key] = tags[key];
        }
      }
    }
    
    return result;
  }

  /**
   * Determines if a metric should be sampled based on its options and configuration.
   * @param options - The metric options.
   * @returns True if the metric should be recorded, false if it should be sampled out.
   */
  private shouldSampleMetric(options?: MetricOptions): boolean {
    if (!this.enabled) return false;
    
    // Default to configuration's sampling rate
    const defaultRate = this.configuration.defaultSamplingRate ?? 1.0;
    
    // If no sampling is specified, use the default
    if (!options || options.sample === undefined) {
      return Math.random() < defaultRate;
    }
    
    // If sampling is a boolean, respect it directly
    if (typeof options.sample === 'boolean') {
      return options.sample;
    }
    
    // If sampling is a number, use it as a probability
    return Math.random() < options.sample;
  }

  /**
   * Records a metric if it passes sampling checks.
   * @param type - The type of metric.
   * @param name - The metric name.
   * @param value - The metric value.
   * @param tags - Optional tags.
   * @param options - Optional configuration.
   */
  private recordMetric(
    type: MetricType,
    name: string,
    value: number,
    tags?: MetricTags,
    options?: MetricOptions
  ): void {
    if (!this.enabled || !this.shouldSampleMetric(options)) {
      return;
    }
    
    // Skip histogram recording if disabled
    if ((type === MetricType.HISTOGRAM || type === MetricType.TIMER) && 
        this.configuration.enableHistograms === false) {
      return;
    }
    
    const mergedTags = this.mergeTags(tags);
    const formattedName = this.formatMetricName(name);
    const metricKey = this.getMetricKey(name, mergedTags);
    
    // Log the metric
    this.logger.debug(`${this.logPrefix} ${type}: ${formattedName} = ${value}`, { tags: mergedTags });
    
    // Store the metric
    this.metrics.push({
      name: formattedName,
      type,
      value,
      timestamp: Date.now(),
      tags: mergedTags,
      options
    });
    
    // Update in-memory storage based on type
    switch (type) {
      case MetricType.COUNTER:
        const currentCount = this.counters.get(metricKey) || 0;
        this.counters.set(metricKey, currentCount + value);
        break;
        
      case MetricType.GAUGE:
        this.gauges.set(metricKey, value);
        break;
        
      case MetricType.HISTOGRAM:
      case MetricType.TIMER:
        this.updateHistogram(metricKey, value);
        break;
        
      case MetricType.SET:
        if (typeof value === 'string') {
          const set = this.sets.get(metricKey) || new Set<string>();
          set.add(value);
          this.sets.set(metricKey, set);
        }
        break;
    }
    
    // Automatically flush if buffer size is reached
    if (this.configuration.bufferSize && 
        this.metrics.length >= this.configuration.bufferSize) {
      this.flush().catch(error => {
        this.logger.error(`${this.logPrefix} Error flushing metrics: ${error.message}`);
      });
    }
  }

  /**
   * Updates a histogram with a new value.
   * @param key - The histogram key.
   * @param value - The value to add.
   */
  private updateHistogram(key: string, value: number): void {
    const histogram = this.histograms.get(key) || { 
      count: 0, 
      sum: 0, 
      min: Number.MAX_VALUE, 
      max: Number.MIN_VALUE,
      values: []
    };
    
    histogram.count += 1;
    histogram.sum += value;
    histogram.min = Math.min(histogram.min, value);
    histogram.max = Math.max(histogram.max, value);
    
    // Only store values if we're keeping full histograms
    if (this.configuration.enableHistograms) {
      histogram.values.push(value);
    }
    
    this.histograms.set(key, histogram);
  }

  /**
   * Creates a timer that records its duration when stopped.
   * @param name - The metric name.
   * @param tags - Optional tags.
   * @param options - Optional configuration.
   * @returns A TimerMetric object.
   */
  private createTimer(
    name: string, 
    tags?: MetricTags, 
    options?: MetricOptions
  ): TimerMetric {
    const startTime = Date.now();
    let lastCheckpointTime = startTime;
    let active = true;
    
    return {
      stop: (additionalTags?: MetricTags): number => {
        if (!active) return 0;
        
        const elapsed = Date.now() - startTime;
        active = false;
        
        const combinedTags = additionalTags 
          ? { ...tags, ...additionalTags } 
          : tags;
          
        this.recordTimer(name, elapsed, combinedTags, options);
        return elapsed;
      },
      
      reset: (): void => {
        // Reset the timer
        lastCheckpointTime = Date.now();
        active = true;
      },
      
      current: (): number => {
        return active ? Date.now() - startTime : 0;
      },
      
      checkpoint: (checkpointName: string, additionalTags?: MetricTags): number => {
        if (!active) return 0;
        
        const now = Date.now();
        const elapsed = now - lastCheckpointTime;
        lastCheckpointTime = now;
        
        // Record the checkpoint as a separate timer
        const checkpointMetricName = `${name}.checkpoint.${checkpointName}`;
        const combinedTags = additionalTags 
          ? { ...tags, ...additionalTags } 
          : tags;
          
        this.recordTimer(checkpointMetricName, elapsed, combinedTags, options);
        
        return elapsed;
      }
    };
  }

  // IMetricsAdapter implementation

  incrementCounter(name: string, value: number = 1, tags?: MetricTags, options?: MetricOptions): void {
    this.recordMetric(MetricType.COUNTER, name, value, tags, options);
  }

  decrementCounter(name: string, value: number = 1, tags?: MetricTags, options?: MetricOptions): void {
    this.recordMetric(MetricType.COUNTER, name, -Math.abs(value), tags, options);
  }

  setGauge(name: string, value: number, tags?: MetricTags, options?: MetricOptions): void {
    this.recordMetric(MetricType.GAUGE, name, value, tags, options);
  }

  incrementGauge(name: string, value: number = 1, tags?: MetricTags, options?: MetricOptions): void {
    const metricKey = this.getMetricKey(name, this.mergeTags(tags));
    const currentValue = this.gauges.get(metricKey) || 0;
    this.setGauge(name, currentValue + value, tags, options);
  }

  decrementGauge(name: string, value: number = 1, tags?: MetricTags, options?: MetricOptions): void {
    const metricKey = this.getMetricKey(name, this.mergeTags(tags));
    const currentValue = this.gauges.get(metricKey) || 0;
    this.setGauge(name, currentValue - value, tags, options);
  }

  recordHistogram(name: string, value: number, tags?: MetricTags, options?: MetricOptions): void {
    this.recordMetric(MetricType.HISTOGRAM, name, value, tags, options);
  }

  startTimer(name: string, tags?: MetricTags, options?: MetricOptions): TimerMetric {
    return this.createTimer(name, tags, options);
  }

  recordTimer(name: string, durationMs: number, tags?: MetricTags, options?: MetricOptions): void {
    this.recordMetric(MetricType.TIMER, name, durationMs, tags, options);
  }

  addToSet(name: string, value: string, tags?: MetricTags, options?: MetricOptions): void {
    // Use 1 as a placeholder value, the actual value is stored in the set
    this.recordMetric(MetricType.SET, name, 1, tags, { ...options, setItem: value });
  }

  recordSummary(
    name: string, 
    summary: { 
      count: number; 
      sum: number; 
      min?: number; 
      max?: number; 
      p50?: number; 
      p90?: number; 
      p95?: number; 
      p99?: number; 
    }, 
    tags?: MetricTags, 
    options?: MetricOptions
  ): void {
    // Log the summary
    this.logger.debug(`${this.logPrefix} SUMMARY: ${name}`, { summary, tags });
    
    // Record individual metrics for each part of the summary
    const mergedTags = this.mergeTags(tags);
    
    // Record count
    this.recordMetric(MetricType.GAUGE, `${name}.count`, summary.count, mergedTags, options);
    
    // Record sum
    this.recordMetric(MetricType.GAUGE, `${name}.sum`, summary.sum, mergedTags, options);
    
    // Record min/max if provided
    if (summary.min !== undefined) {
      this.recordMetric(MetricType.GAUGE, `${name}.min`, summary.min, mergedTags, options);
    }
    
    if (summary.max !== undefined) {
      this.recordMetric(MetricType.GAUGE, `${name}.max`, summary.max, mergedTags, options);
    }
    
    // Record percentiles if provided
    if (summary.p50 !== undefined) {
      this.recordMetric(MetricType.GAUGE, `${name}.p50`, summary.p50, mergedTags, options);
    }
    
    if (summary.p90 !== undefined) {
      this.recordMetric(MetricType.GAUGE, `${name}.p90`, summary.p90, mergedTags, options);
    }
    
    if (summary.p95 !== undefined) {
      this.recordMetric(MetricType.GAUGE, `${name}.p95`, summary.p95, mergedTags, options);
    }
    
    if (summary.p99 !== undefined) {
      this.recordMetric(MetricType.GAUGE, `${name}.p99`, summary.p99, mergedTags, options);
    }
  }

  addGlobalDimensions(dimensions: MetricTags, overwrite: boolean = true): void {
    if (!dimensions) return;
    
    const current = this.configuration.globalDimensions || {};
    
    if (overwrite) {
      // Overwrite existing dimensions
      this.configuration.globalDimensions = { ...current, ...dimensions };
    } else {
      // Only add dimensions that don't already exist
      for (const [key, value] of Object.entries(dimensions)) {
        if (!(key in current)) {
          current[key] = value;
        }
      }
      this.configuration.globalDimensions = current;
    }
  }

  getConfiguration(): MetricsConfiguration {
    return { ...this.configuration };
  }

  updateConfiguration(config: Partial<MetricsConfiguration>): MetricsConfiguration {
    const wasEnabled = this.enabled;
    this.configuration = { ...this.configuration, ...config };
    this.enabled = this.configuration.enabled || false;
    
    // Restart auto-flush if needed
    if (this.enabled !== wasEnabled || 
        config.flushIntervalMs !== undefined) {
      this.startAutoFlush();
    }
    
    return this.getConfiguration();
  }

  async flush(): Promise<void> {
    if (!this.enabled || this.metrics.length === 0) {
      return;
    }
    
    this.logger.debug(`${this.logPrefix} Flushing ${this.metrics.length} metrics`);
    
    try {
      // In a real implementation, this would send metrics to a backend service
      // For this implementation, we just log them as a batch
      if (this.metrics.length > 0) {
        // Here we could send metrics to a backend system if configured
        this.logger.info(`${this.logPrefix} Flushed ${this.metrics.length} metrics`);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`${this.logPrefix} Error flushing metrics: ${errorMessage}`);
      throw error;
    } finally {
      // Clear the buffer regardless of success/failure
      this.metrics = [];
    }
  }

  enable(): void {
    this.enabled = true;
    this.configuration.enabled = true;
    this.startAutoFlush();
    this.logger.info(`${this.logPrefix} Metrics collection enabled`);
  }

  disable(): void {
    this.enabled = false;
    this.configuration.enabled = false;
    
    if (this.flushTimerId) {
      clearTimeout(this.flushTimerId);
      this.flushTimerId = null;
    }
    
    this.logger.info(`${this.logPrefix} Metrics collection disabled`);
  }

  isEnabled(): boolean {
    return this.enabled;
  }
} 