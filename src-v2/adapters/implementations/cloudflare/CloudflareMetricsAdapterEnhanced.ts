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
 * Enhanced Cloudflare-specific implementation of IMetricsAdapter with priority-based sampling.
 * 
 * Prevents Analytics Engine write limit exceeded errors by implementing intelligent sampling
 * based on metric priority levels.
 */
export class CloudflareMetricsAdapterEnhanced implements IMetricsAdapter {
  private readonly logger: ILoggerAdapter;
  private readonly prefix: string;
  private enabled: boolean;
  private analyticsEngine: any | null;
  private globalDimensions: MetricTags = {};
  private configuration: MetricsConfiguration;
  private readonly environmentAdapter?: IEnvironmentAdapter;
  
  // Track data points per request to prevent exceeding limit
  private dataPointsWritten: number = 0;
  private readonly MAX_DATA_POINTS_PER_REQUEST = 25;
  
  /**
   * Metric priority levels for intelligent sampling
   */
  private static readonly METRIC_PRIORITIES = {
    // Critical business metrics - always track (100% sampling)
    CRITICAL: [
      'decision_duration', 'decision_time', 'variations_evaluated_before_match',
      'flagActivations', 'variationActivations', 'batch_decision_duration',
      'edge_mode_pipeline_duration', 'url_matching_duration', 'content_fetch_duration',
      'feature_flag_count', 'experiment_count'
    ],
    // Moderate importance - 50% sampling
    MODERATE: [
      'api_request_duration_seconds', 'datafile_fetch_duration', 'flagkeys_fetch_duration',
      'user_context_cache_misses', 'cache_clear_duration', 'request_duration',
      'should_handle_duration', 'content_preparation_duration', 'transform_duration'
    ],
    // Low priority - 10% sampling in production
    LOW: [
      'service_available', 'cache_size_limit', 'cache_ttl_ms', 'caching_enabled',
      'response_size_bytes', 'datafile_size_bytes', 'cleanup_trigger_interval_ms',
      'client_initialization_duration', 'cache_cleanup_duration', 'cache_size',
      'client_creation_duration', 'user_context_creation_duration', 'process_attributes_duration',
      'get_user_context_duration', 'sdk_decide_duration', 'fallback_decision_creation_duration',
      'datafile_storage_duration_ms', 'cdn_fetch_duration_ms', 'datafile_refresh_duration_ms',
      'flagkeys_storage_duration_ms', 'cleanup_trigger_probability', 'event_tracking_duration',
      'origin_fetch_duration', 'forced_variation_duration', 'optimizely_config_fetch_duration'
    ]
  };

  /**
   * Batched metrics for writing at the end of request
   */
  private batchedMetrics: Array<{
    type: MetricType;
    name: string;
    value: number;
    tags?: MetricTags;
    priority: 'CRITICAL' | 'MODERATE' | 'LOW' | 'UNKNOWN';
  }> = [];
  
  private batchingEnabled: boolean = false;

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
    
    // Check for batching mode
    this.batchingEnabled = this.environmentAdapter?.getVariable('OPTIMIZELY_METRICS_BATCHING')?.toLowerCase() === 'true' || false;
    
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
      this.logger.info(`[CloudflareMetricsAdapter] Initialized with prefix: ${this.prefix}, enabled: ${this.enabled}, batching: ${this.batchingEnabled}`);
    }
  }

  /**
   * Reads metrics configuration from environment variables.
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
        }
      }

      // Read max dimensions
      const maxDimensionsVar = this.environmentAdapter.getVariable('OPTIMIZELY_METRICS_MAX_DIMENSIONS');
      if (maxDimensionsVar !== undefined) {
        const maxDimensions = parseInt(maxDimensionsVar, 10);
        if (!isNaN(maxDimensions) && maxDimensions > 0) {
          config.maxDimensions = maxDimensions;
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
          }
        } catch (error) {
          this.logger.warn(`[CloudflareMetricsAdapter] Failed to parse global dimensions from env var: ${error}`);
        }
      }

      this.logger.debug(`[CloudflareMetricsAdapter] Environment configuration loaded:`, config);
    } catch (error) {
      this.logger.warn(`[CloudflareMetricsAdapter] Error reading environment configuration: ${error}`);
    }

    return config;
  }

  /**
   * Get metric priority level
   */
  private getMetricPriority(metricName: string): 'CRITICAL' | 'MODERATE' | 'LOW' | 'UNKNOWN' {
    if (CloudflareMetricsAdapterEnhanced.METRIC_PRIORITIES.CRITICAL.includes(metricName)) {
      return 'CRITICAL';
    }
    if (CloudflareMetricsAdapterEnhanced.METRIC_PRIORITIES.MODERATE.includes(metricName)) {
      return 'MODERATE';
    }
    if (CloudflareMetricsAdapterEnhanced.METRIC_PRIORITIES.LOW.includes(metricName)) {
      return 'LOW';
    }
    return 'UNKNOWN';
  }

  /**
   * Get sampling rate based on metric priority
   */
  private getSamplingRateForMetric(metricName: string): number {
    const baseSamplingRate = this.configuration.defaultSamplingRate ?? 1.0;
    const priority = this.getMetricPriority(metricName);
    
    switch (priority) {
      case 'CRITICAL':
        return baseSamplingRate; // 100% of base rate
      case 'MODERATE':
        return baseSamplingRate * 0.5; // 50% of base rate
      case 'LOW':
        return baseSamplingRate * 0.1; // 10% of base rate
      case 'UNKNOWN':
        return baseSamplingRate * 0.25; // 25% of base rate
    }
  }

  /**
   * Determines if a metric should be sampled based on priority and current state
   */
  private shouldSampleMetric(name: string, options?: MetricOptions): boolean {
    if (!this.enabled) return false;
    
    const priority = this.getMetricPriority(name);
    
    // Check if we're approaching the data point limit
    if (this.dataPointsWritten >= this.MAX_DATA_POINTS_PER_REQUEST - 5) {
      // Near limit - only allow critical metrics
      if (priority !== 'CRITICAL') {
        this.logger.debug(`[CloudflareMetricsAdapter] Skipping ${name} (${priority}) - approaching data point limit`);
        return false;
      }
    }
    
    // Get priority-based sampling rate
    const prioritySamplingRate = this.getSamplingRateForMetric(name);
    
    // If options specify custom sampling, combine with priority sampling
    if (options?.sample !== undefined) {
      if (typeof options.sample === 'boolean') {
        return options.sample && (Math.random() < prioritySamplingRate);
      }
      // If it's a number, multiply with priority rate
      return Math.random() < (options.sample * prioritySamplingRate);
    }
    
    // Use priority-based sampling rate
    return Math.random() < prioritySamplingRate;
  }

  /**
   * Formats a metric name with the configured prefix.
   */
  private formatMetricName(name: string): string {
    return `${this.prefix}${name}`;
  }

  /**
   * Formats tags as an object for Cloudflare analytics.
   */
  private formatTags(tags?: MetricTags): Record<string, string> | undefined {
    if (!tags && !this.globalDimensions) {
      return undefined;
    }
    
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
   * Records a metric, either immediately or batched
   */
  private recordMetric(
    type: MetricType,
    name: string,
    value: number,
    tags?: MetricTags,
    options?: MetricOptions
  ): void {
    // Skip if disabled or sampled out
    if (!this.shouldSampleMetric(name, options)) {
      return;
    }
    
    const priority = this.getMetricPriority(name);
    
    if (this.batchingEnabled) {
      // Add to batch
      this.batchedMetrics.push({ type, name, value, tags, priority });
    } else {
      // Write immediately
      this.writeMetric(type, name, value, tags);
    }
  }

  /**
   * Writes a metric to Analytics Engine
   */
  private writeMetric(
    type: MetricType,
    name: string,
    value: number,
    tags?: MetricTags
  ): void {
    if (!this.enabled || !this.analyticsEngine) {
      return;
    }
    
    // Check data point limit
    if (this.dataPointsWritten >= this.MAX_DATA_POINTS_PER_REQUEST) {
      this.logger.warn(`[CloudflareMetricsAdapter] Data point limit reached (${this.MAX_DATA_POINTS_PER_REQUEST}), skipping metric: ${name}`);
      return;
    }
    
    const formattedName = this.formatMetricName(name);
    const formattedTags = this.formatTags(tags);

    try {
      this.analyticsEngine.writeDataPoint({
        blobs: formattedTags ? [JSON.stringify(formattedTags)] : undefined,
        doubles: [value],
        indexes: [formattedName, type.toLowerCase()]
      });
      
      this.dataPointsWritten++;
      this.logger.debug(`[CloudflareMetricsAdapter] Wrote ${type} metric: ${formattedName} (${this.dataPointsWritten}/${this.MAX_DATA_POINTS_PER_REQUEST})`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`[CloudflareMetricsAdapter] Error recording metric '${formattedName}': ${errorMessage}`);
    }
  }

  /**
   * Flushes batched metrics, respecting priorities and limits
   */
  public async flush(): Promise<void> {
    if (!this.batchingEnabled || this.batchedMetrics.length === 0) {
      return;
    }
    
    this.logger.debug(`[CloudflareMetricsAdapter] Flushing ${this.batchedMetrics.length} batched metrics`);
    
    // Sort by priority: CRITICAL > MODERATE > LOW > UNKNOWN
    const priorityOrder = { 'CRITICAL': 0, 'MODERATE': 1, 'LOW': 2, 'UNKNOWN': 3 };
    this.batchedMetrics.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    
    // Write metrics up to the limit
    for (const metric of this.batchedMetrics) {
      if (this.dataPointsWritten >= this.MAX_DATA_POINTS_PER_REQUEST) {
        this.logger.warn(`[CloudflareMetricsAdapter] Reached data point limit during flush, dropped ${this.batchedMetrics.length - this.dataPointsWritten} metrics`);
        break;
      }
      
      this.writeMetric(metric.type, metric.name, metric.value, metric.tags);
    }
    
    // Clear batch
    this.batchedMetrics = [];
  }

  /**
   * Creates a timer that records its duration when stopped.
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
    this.recordMetric(MetricType.GAUGE, `${name}.increment`, value, tags, options);
  }

  decrementGauge(name: string, value: number = 1, tags?: MetricTags, options?: MetricOptions): void {
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
    // For summaries, only record essential metrics to avoid data point explosion
    this.recordMetric(MetricType.GAUGE, `${name}.count`, summary.count, tags, options);
    this.recordMetric(MetricType.GAUGE, `${name}.sum`, summary.sum, tags, options);
    
    // Only record percentiles for critical metrics
    const priority = this.getMetricPriority(name);
    if (priority === 'CRITICAL' && summary.p95 !== undefined) {
      this.recordMetric(MetricType.GAUGE, `${name}.p95`, summary.p95, tags, options);
    }
  }

  addGlobalDimensions(dimensions: MetricTags, overwrite: boolean = true): void {
    if (!dimensions) return;
    
    if (overwrite) {
      this.globalDimensions = { ...this.globalDimensions, ...dimensions };
    } else {
      for (const [key, value] of Object.entries(dimensions)) {
        if (!(key in this.globalDimensions)) {
          this.globalDimensions[key] = value;
        }
      }
    }
    
    this.configuration.globalDimensions = this.globalDimensions;
  }

  getConfiguration(): MetricsConfiguration {
    return { ...this.configuration };
  }

  updateConfiguration(config: Partial<MetricsConfiguration>): MetricsConfiguration {
    this.configuration = { ...this.configuration, ...config };
    
    if (config.globalDimensions) {
      this.globalDimensions = { ...config.globalDimensions };
    }
    
    if (config.enabled !== undefined) {
      this.enabled = config.enabled && !!this.analyticsEngine;
    }
    
    return this.getConfiguration();
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