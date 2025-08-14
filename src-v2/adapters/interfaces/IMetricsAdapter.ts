/**
 * @enum MetricType
 * @description Defines standard metric types.
 */
export enum MetricType {
  COUNTER = 'counter',    // Cumulative values that only increase
  GAUGE = 'gauge',        // Point-in-time values that can increase or decrease
  HISTOGRAM = 'histogram', // Statistical distribution of values
  TIMER = 'timer',        // Special case of histogram for durations
  SUMMARY = 'summary',    // Pre-calculated quantiles
  SET = 'set'             // Count of unique values
}

/**
 * @interface MetricTags
 * @description Defines the structure for metric dimensions/tags.
 */
export type MetricTags = Record<string, string | number | boolean>;

/**
 * @interface MetricOptions
 * @description Configuration options for metric collection.
 */
export interface MetricOptions {
  /**
   * Whether to sample this metric. If a number between 0 and 1, represents sampling probability.
   */
  sample?: boolean | number;
  
  /**
   * Unit of the metric (e.g., 'bytes', 'ms', 'count', etc.)
   */
  unit?: string;
  
  /**
   * Description of the metric for documentation purposes.
   */
  description?: string;
  
  /**
   * Any provider-specific options.
   */
  [key: string]: any;
}

/**
 * @interface MetricsConfiguration
 * @description Configuration for the metrics adapter.
 */
export interface MetricsConfiguration {
  /**
   * Prefix to add to all metric names.
   */
  prefix?: string;
  
  /**
   * Global dimensions to add to all metrics.
   */
  globalDimensions?: MetricTags;
  
  /**
   * Default sampling rate for metrics (0.0-1.0). Set to 1.0 to collect all metrics.
   */
  defaultSamplingRate?: number;
  
  /**
   * Maximum number of dimensions per metric.
   */
  maxDimensions?: number;
  
  /**
   * Whether to enable histogram metrics (higher overhead).
   */
  enableHistograms?: boolean;
  
  /**
   * Batch size for sending metrics.
   */
  batchSize?: number;
  
  /**
   * Flush interval in milliseconds.
   */
  flushIntervalMs?: number;
  
  /**
   * Buffer size before forced flush.
   */
  bufferSize?: number;
  
  /**
   * Whether to enable metrics collection.
   */
  enabled?: boolean;
}

/**
 * @interface TimerMetric
 * @description Represents a timer that can be started and stopped.
 */
export interface TimerMetric {
  /**
   * Stops the timer and records the duration.
   * @param additionalTags - Optional additional tags to add when recording.
   * @returns The duration in milliseconds.
   */
  stop(additionalTags?: MetricTags): number;
  
  /**
   * Resets the timer to start from now.
   */
  reset(): void;
  
  /**
   * Gets the current elapsed time without stopping the timer.
   * @returns The current duration in milliseconds.
   */
  current(): number;
  
  /**
   * Marks a checkpoint in the timer, useful for measuring intermediate steps.
   * @param checkpointName - Name of the checkpoint.
   * @param additionalTags - Optional additional tags for this checkpoint.
   * @returns The duration since the start or the last checkpoint in milliseconds.
   */
  checkpoint(checkpointName: string, additionalTags?: MetricTags): number;
}

/**
 * @interface IMetricsAdapter
 * @description Defines the contract for a metrics collection mechanism,
 * abstracting specific implementations (e.g., in-memory, Prometheus, CloudWatch, Datadog).
 */
export interface IMetricsAdapter {
  /**
   * Increments a counter metric by the specified value.
   * @param name - The name of the metric.
   * @param value - The value to increment by (default: 1).
   * @param tags - Optional key-value pairs for metric dimensions.
   * @param options - Optional configuration for this metric.
   */
  incrementCounter(name: string, value?: number, tags?: MetricTags, options?: MetricOptions): void;

  /**
   * Decrements a counter metric by the specified value.
   * @param name - The name of the metric.
   * @param value - The value to decrement by (default: 1).
   * @param tags - Optional key-value pairs for metric dimensions.
   * @param options - Optional configuration for this metric.
   */
  decrementCounter(name: string, value?: number, tags?: MetricTags, options?: MetricOptions): void;

  /**
   * Sets a gauge metric to the specified value.
   * @param name - The name of the metric.
   * @param value - The value to set.
   * @param tags - Optional key-value pairs for metric dimensions.
   * @param options - Optional configuration for this metric.
   */
  setGauge(name: string, value: number, tags?: MetricTags, options?: MetricOptions): void;

  /**
   * Increments a gauge metric by the specified value.
   * @param name - The name of the metric.
   * @param value - The value to increment by (default: 1).
   * @param tags - Optional key-value pairs for metric dimensions.
   * @param options - Optional configuration for this metric.
   */
  incrementGauge(name: string, value?: number, tags?: MetricTags, options?: MetricOptions): void;

  /**
   * Decrements a gauge metric by the specified value.
   * @param name - The name of the metric.
   * @param value - The value to decrement by (default: 1).
   * @param tags - Optional key-value pairs for metric dimensions.
   * @param options - Optional configuration for this metric.
   */
  decrementGauge(name: string, value?: number, tags?: MetricTags, options?: MetricOptions): void;

  /**
   * Records a value for a histogram metric.
   * @param name - The name of the metric.
   * @param value - The value to record.
   * @param tags - Optional key-value pairs for metric dimensions.
   * @param options - Optional configuration for this metric.
   */
  recordHistogram(name: string, value: number, tags?: MetricTags, options?: MetricOptions): void;

  /**
   * Starts a timer for measuring the duration of an operation.
   * @param name - The name of the metric.
   * @param tags - Optional key-value pairs for metric dimensions.
   * @param options - Optional configuration for this metric.
   * @returns A TimerMetric object with methods to control and record the timer.
   */
  startTimer(name: string, tags?: MetricTags, options?: MetricOptions): TimerMetric;

  /**
   * Records the duration of an operation directly.
   * @param name - The name of the metric.
   * @param durationMs - The duration in milliseconds.
   * @param tags - Optional key-value pairs for metric dimensions.
   * @param options - Optional configuration for this metric.
   */
  recordTimer(name: string, durationMs: number, tags?: MetricTags, options?: MetricOptions): void;

  /**
   * Tracks a set of unique values.
   * @param name - The name of the metric.
   * @param value - The value to add to the set.
   * @param tags - Optional key-value pairs for metric dimensions.
   * @param options - Optional configuration for this metric.
   */
  addToSet(name: string, value: string, tags?: MetricTags, options?: MetricOptions): void;

  /**
   * Records a pre-computed summary with statistics.
   * @param name - The name of the metric.
   * @param summary - Object with summary statistics.
   * @param tags - Optional key-value pairs for metric dimensions.
   * @param options - Optional configuration for this metric.
   */
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
  ): void;

  /**
   * Adds global dimensions to all future metrics.
   * @param dimensions - Key-value pairs to add as dimensions.
   * @param overwrite - Whether to overwrite existing dimensions with the same names.
   */
  addGlobalDimensions(dimensions: MetricTags, overwrite?: boolean): void;

  /**
   * Gets the current configuration of the metrics adapter.
   * @returns The current configuration.
   */
  getConfiguration(): MetricsConfiguration;

  /**
   * Updates the configuration of the metrics adapter.
   * @param config - The new configuration options.
   * @returns The updated configuration.
   */
  updateConfiguration(config: Partial<MetricsConfiguration>): MetricsConfiguration;

  /**
   * Flushes any buffered metrics to the underlying system.
   * This may be a no-op for systems that don't buffer metrics.
   * @returns A promise that resolves when flushing is complete.
   */
  flush(): Promise<void>;

  /**
   * Enables metrics collection.
   */
  enable(): void;

  /**
   * Disables metrics collection.
   */
  disable(): void;

  /**
   * Checks if metrics collection is enabled.
   * @returns True if metrics collection is enabled, false otherwise.
   */
  isEnabled(): boolean;
} 