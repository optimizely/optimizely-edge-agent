import { 
  IMetricsAdapter, 
  MetricType, 
  MetricTags, 
  MetricOptions, 
  MetricsConfiguration,
  TimerMetric
} from "../../interfaces/IMetricsAdapter";
import { ILoggerAdapter } from "../../interfaces/ILoggerAdapter";
import { IEnvironmentAdapter } from "../../interfaces/IEnvironmentAdapter";

/**
 * Cloudflare-specific implementation of IMetricsAdapter.
 * 
 * Integrates with Cloudflare Analytics Engine for metrics collection in the
 * Cloudflare Workers environment.
 */
export class CloudflareMetricsAdapter implements IMetricsAdapter {
  private readonly logger: ILoggerAdapter;
  private readonly prefix: string;
  private enabled: boolean;
  private analyticsEngine: any | null;
  private globalDimensions: MetricTags = {};
  private configuration: MetricsConfiguration;
  private readonly environmentAdapter?: IEnvironmentAdapter;

  /**
   * Creates an instance of CloudflareMetricsAdapter.
   * @param logger - The logger adapter for logging metrics operations.
   * @param prefix - Optional prefix for all metric names (can be overridden by env var).
   * @param analyticsEngine - Optional reference to Cloudflare analytics engine.
   * @param config - Optional additional configuration.
   * @param environmentAdapter - Optional environment adapter to read configuration from env vars.
   */
  constructor(
    logger: ILoggerAdapter,
    prefix: string = 'optimizely_edge_',
    analyticsEngine: any = null,
    config?: Partial<MetricsConfiguration>,
    environmentAdapter?: IEnvironmentAdapter
  ) {
    this.logger = logger;
    this.environmentAdapter = environmentAdapter;
    
    // Read configuration from environment variables if available
    const envConfig = this.readEnvironmentConfiguration();
    
    // Determine final prefix (env var takes precedence)
    this.prefix = envConfig.prefix || prefix;
    this.analyticsEngine = analyticsEngine;
    
    // Determine if metrics are enabled (env var takes precedence)
    this.enabled = envConfig.enabled !== undefined ? envConfig.enabled : !!analyticsEngine;
    
    // Default configuration
    this.configuration = {
      prefix: this.prefix,
      globalDimensions: {},
      defaultSamplingRate: 1.0,
      maxDimensions: 20,
      enableHistograms: true,
      enabled: this.enabled,
      ...envConfig // Apply environment configuration
    };
    
    // Apply custom configuration if provided (takes highest precedence)
    if (config) {
      this.updateConfiguration(config);
    }

    if (!this.enabled) {
      this.logger.warn(`[CloudflareMetricsAdapter] Initialized without an analytics engine. Metrics will be logged but not recorded.`);
    } else {
      this.logger.info(`[CloudflareMetricsAdapter] Initialized with prefix: ${this.prefix}, enabled: ${this.enabled}`);
    }
  }

  /**
   * Reads metrics configuration from environment variables.
   * @returns Partial metrics configuration from environment variables.
   */
  private readEnvironmentConfiguration(): Partial<MetricsConfiguration> {
    if (!this.environmentAdapter) {
      return {};
    }

    const config: Partial<MetricsConfiguration> = {};

    try {
      // Read enabled flag
      const enabledVar = this.environmentAdapter.getVariable('OPTIMIZELY_METRICS_ENABLED');
      if (enabledVar !== undefined) {
        config.enabled = enabledVar.toLowerCase() === 'true';
      }

      // Read prefix
      const prefixVar = this.environmentAdapter.getVariable('OPTIMIZELY_METRICS_PREFIX');
      if (prefixVar !== undefined) {
        config.prefix = prefixVar;
      }

      // Read sampling rate
      const samplingRateVar = this.environmentAdapter.getVariable('OPTIMIZELY_METRICS_SAMPLING_RATE');
      if (samplingRateVar !== undefined) {
        const samplingRate = parseFloat(samplingRateVar);
        if (!isNaN(samplingRate) && samplingRate >= 0 && samplingRate <= 1) {
          config.defaultSamplingRate = samplingRate;
        } else {
          this.logger.warn(`[CloudflareMetricsAdapter] Invalid sampling rate in env var: ${samplingRateVar}. Using default.`);
        }
      }

      // Read max dimensions
      const maxDimensionsVar = this.environmentAdapter.getVariable('OPTIMIZELY_METRICS_MAX_DIMENSIONS');
      if (maxDimensionsVar !== undefined) {
        const maxDimensions = parseInt(maxDimensionsVar, 10);
        if (!isNaN(maxDimensions) && maxDimensions > 0) {
          config.maxDimensions = maxDimensions;
        } else {
          this.logger.warn(`[CloudflareMetricsAdapter] Invalid max dimensions in env var: ${maxDimensionsVar}. Using default.`);
        }
      }

      // Read enable histograms
      const enableHistogramsVar = this.environmentAdapter.getVariable('OPTIMIZELY_METRICS_ENABLE_HISTOGRAMS');
      if (enableHistogramsVar !== undefined) {
        config.enableHistograms = enableHistogramsVar.toLowerCase() === 'true';
      }

      // Read global dimensions
      const globalDimensionsVar = this.environmentAdapter.getVariable('OPTIMIZELY_METRICS_GLOBAL_DIMENSIONS');
      if (globalDimensionsVar !== undefined) {
        try {
          const globalDimensions = JSON.parse(globalDimensionsVar);
          if (typeof globalDimensions === 'object' && globalDimensions !== null) {
            config.globalDimensions = globalDimensions;
          } else {
            this.logger.warn(`[CloudflareMetricsAdapter] Invalid global dimensions in env var: must be a JSON object. Using default.`);
          }
        } catch (error) {
          this.logger.warn(`[CloudflareMetricsAdapter] Failed to parse global dimensions from env var: ${error}. Using default.`);
        }
      }

      this.logger.debug(`[CloudflareMetricsAdapter] Environment configuration loaded:`, config);
    } catch (error) {
      this.logger.warn(`[CloudflareMetricsAdapter] Error reading environment configuration: ${error}`);
    }

    return config;
  }

  /**
   * Formats a metric name with the configured prefix.
   * @param name - The base metric name.
   * @returns The formatted metric name.
   */
  private formatMetricName(name: string): string {
    return `${this.prefix}${name}`;
  }

  /**
   * Formats tags as an object for Cloudflare analytics.
   * @param tags - Optional key-value pairs for metric dimensions.
   * @returns Formatted tags object or undefined if none provided.
   */
  private formatTags(tags?: MetricTags): Record<string, string> | undefined {
    if (!tags && !this.globalDimensions) {
      return undefined;
    }
    
    // Start with global dimensions
    const result: Record<string, string> = {};
    
    // Add global dimensions first
    if (this.globalDimensions) {
      for (const [key, value] of Object.entries(this.globalDimensions)) {
        result[key] = String(value);
      }
    }
    
    // Add specific tags, potentially overriding globals
    if (tags) {
      // Respect maxDimensions limit
      const availableSlots = this.configuration.maxDimensions 
        ? this.configuration.maxDimensions - Object.keys(result).length 
        : Infinity;
        
      if (availableSlots > 0) {
        const tagKeys = Object.keys(tags).slice(0, availableSlots);
        for (const key of tagKeys) {
          result[key] = String(tags[key]);
        }
      }
    }
    
    return Object.keys(result).length > 0 ? result : undefined;
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
   * Records a metric to Cloudflare analytics engine if available.
   * @param type - The type of metric.
   * @param name - The metric name.
   * @param value - The metric value.
   * @param tags - Optional tags.
   * @param options - Optional metric options.
   */
  private recordMetric(
    type: MetricType,
    name: string,
    value: number,
    tags?: MetricTags,
    options?: MetricOptions
  ): void {
    // Skip if disabled or sampled out
    if (!this.shouldSampleMetric(options)) {
      return;
    }
    
    const formattedName = this.formatMetricName(name);
    const formattedTags = this.formatTags(tags);

    // Log the metric for debugging
    this.logger.debug(`[CloudflareMetricsAdapter] ${type}: ${formattedName} = ${value}`, formattedTags);

    // Record to Cloudflare analytics if enabled
    if (this.enabled && this.analyticsEngine) {
      try {
        // Add detailed debugging
        this.logger.debug(
          `[CloudflareMetricsAdapter] Attempting to write to Analytics Engine: ${formattedName}, Type: ${type}, Value: ${value}`
        );
        
        // Check if analyticsEngine has writeDataPoint method
        if (typeof this.analyticsEngine.writeDataPoint !== 'function') {
          throw new Error('Analytics Engine missing writeDataPoint method');
        }
        
        switch (type) {
          case MetricType.COUNTER:
            this.analyticsEngine.writeDataPoint({
              blobs: formattedTags ? [JSON.stringify(formattedTags)] : undefined,
              doubles: [value],
              indexes: [formattedName, 'counter']
            });
            this.logger.debug(`[CloudflareMetricsAdapter] Successfully wrote counter metric: ${formattedName}`);
            break;
          case MetricType.GAUGE:
            this.analyticsEngine.writeDataPoint({
              blobs: formattedTags ? [JSON.stringify(formattedTags)] : undefined,
              doubles: [value],
              indexes: [formattedName, 'gauge']
            });
            this.logger.debug(`[CloudflareMetricsAdapter] Successfully wrote gauge metric: ${formattedName}`);
            break;
          case MetricType.HISTOGRAM:
          case MetricType.TIMER:
            this.analyticsEngine.writeDataPoint({
              blobs: formattedTags ? [JSON.stringify(formattedTags)] : undefined,
              doubles: [value],
              indexes: [formattedName, type === MetricType.HISTOGRAM ? 'histogram' : 'timer']
            });
            this.logger.debug(`[CloudflareMetricsAdapter] Successfully wrote ${type} metric: ${formattedName}`);
            break;
          case MetricType.SUMMARY:
            this.analyticsEngine.writeDataPoint({
              blobs: formattedTags ? [JSON.stringify(formattedTags)] : undefined,
              doubles: [value],
              indexes: [formattedName, 'summary']
            });
            this.logger.debug(`[CloudflareMetricsAdapter] Successfully wrote summary metric: ${formattedName}`);
            break;
          case MetricType.SET:
            // For SET type, we record the cardinality of the set
            this.analyticsEngine.writeDataPoint({
              blobs: formattedTags ? [JSON.stringify(formattedTags)] : undefined,
              doubles: [value],
              indexes: [formattedName, 'set']
            });
            this.logger.debug(`[CloudflareMetricsAdapter] Successfully wrote set metric: ${formattedName}`);
            break;
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error(`[CloudflareMetricsAdapter] Error recording metric '${formattedName}': ${errorMessage}`);
        
        // Add detailed error info
        if (error instanceof Error && error.stack) {
          this.logger.debug(`[CloudflareMetricsAdapter] Error stack: ${error.stack}`);
        }
        
        // Log analytics engine state
        this.logger.debug(
          `[CloudflareMetricsAdapter] Analytics Engine state:`, 
          { 
            engineExists: !!this.analyticsEngine,
            engineType: this.analyticsEngine ? typeof this.analyticsEngine : 'undefined',
            hasWriteMethod: this.analyticsEngine && typeof this.analyticsEngine.writeDataPoint === 'function',
            metricDetails: {
              name: formattedName,
              type,
              value
            }
          }
        );
      }
    } else if (!this.analyticsEngine) {
      this.logger.debug(`[CloudflareMetricsAdapter] Analytics Engine not available, skipping metric: ${formattedName}`);
    } else if (!this.enabled) {
      this.logger.debug(`[CloudflareMetricsAdapter] Metrics disabled, skipping metric: ${formattedName}`);
    }
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
    // No way to read current gauge value in Cloudflare, so we just record the increment
    this.recordMetric(MetricType.GAUGE, `${name}.increment`, value, tags, options);
  }

  decrementGauge(name: string, value: number = 1, tags?: MetricTags, options?: MetricOptions): void {
    // No way to read current gauge value in Cloudflare, so we just record the decrement
    this.recordMetric(MetricType.GAUGE, `${name}.decrement`, value, tags, options);
  }

  recordHistogram(name: string, value: number, tags?: MetricTags, options?: MetricOptions): void {
    this.recordMetric(MetricType.HISTOGRAM, name, value, tags, options);
  }

  startTimer(name: string, tags?: MetricTags, options?: MetricOptions): TimerMetric {
    this.logger.debug(`[Metrics] Timer Start: ${name}`, tags);
    return this.createTimer(name, tags, options);
  }

  recordTimer(name: string, durationMs: number, tags?: MetricTags, options?: MetricOptions): void {
    this.recordMetric(MetricType.TIMER, name, durationMs, tags, options);
  }

  addToSet(name: string, value: string, tags?: MetricTags, options?: MetricOptions): void {
    // For Cloudflare, we can't actually track sets, so we just record that an item was added
    // In a real implementation, this would need server-side aggregation
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
    this.logger.debug(`[CloudflareMetricsAdapter] SUMMARY: ${name}`, { summary, tags });
    
    // Record individual metrics for each part of the summary
    const mergedTags = this.formatTags(tags);
    
    // Record count
    this.recordMetric(MetricType.GAUGE, `${name}.count`, summary.count, tags, options);
    
    // Record sum
    this.recordMetric(MetricType.GAUGE, `${name}.sum`, summary.sum, tags, options);
    
    // Record min/max if provided
    if (summary.min !== undefined) {
      this.recordMetric(MetricType.GAUGE, `${name}.min`, summary.min, tags, options);
    }
    
    if (summary.max !== undefined) {
      this.recordMetric(MetricType.GAUGE, `${name}.max`, summary.max, tags, options);
    }
    
    // Record percentiles if provided
    if (summary.p50 !== undefined) {
      this.recordMetric(MetricType.GAUGE, `${name}.p50`, summary.p50, tags, options);
    }
    
    if (summary.p90 !== undefined) {
      this.recordMetric(MetricType.GAUGE, `${name}.p90`, summary.p90, tags, options);
    }
    
    if (summary.p95 !== undefined) {
      this.recordMetric(MetricType.GAUGE, `${name}.p95`, summary.p95, tags, options);
    }
    
    if (summary.p99 !== undefined) {
      this.recordMetric(MetricType.GAUGE, `${name}.p99`, summary.p99, tags, options);
    }
  }

  addGlobalDimensions(dimensions: MetricTags, overwrite: boolean = true): void {
    if (!dimensions) return;
    
    if (overwrite) {
      // Overwrite existing dimensions
      this.globalDimensions = { ...this.globalDimensions, ...dimensions };
    } else {
      // Only add dimensions that don't already exist
      for (const [key, value] of Object.entries(dimensions)) {
        if (!(key in this.globalDimensions)) {
          this.globalDimensions[key] = value;
        }
      }
    }
    
    // Update configuration
    this.configuration.globalDimensions = this.globalDimensions;
  }

  getConfiguration(): MetricsConfiguration {
    return { ...this.configuration };
  }

  updateConfiguration(config: Partial<MetricsConfiguration>): MetricsConfiguration {
    this.configuration = { ...this.configuration, ...config };
    
    // Update global dimensions if provided
    if (config.globalDimensions) {
      this.globalDimensions = { ...config.globalDimensions };
    }
    
    // Update enabled state if provided
    if (config.enabled !== undefined) {
      this.enabled = config.enabled && !!this.analyticsEngine;
    }
    
    return this.getConfiguration();
  }

  async flush(): Promise<void> { 
    this.logger.debug('[CloudflareMetricsAdapter] Flush called');
    // No action needed for Cloudflare analytics engine, metrics are sent immediately
  }

  enable(): void {
    this.enabled = !!this.analyticsEngine;
    this.configuration.enabled = this.enabled;
    this.logger.info('[CloudflareMetricsAdapter] Metrics collection enabled');
  }

  disable(): void {
    this.enabled = false;
    this.configuration.enabled = false;
    this.logger.info('[CloudflareMetricsAdapter] Metrics collection disabled');
  }

  isEnabled(): boolean {
    return this.enabled;
  }
} 