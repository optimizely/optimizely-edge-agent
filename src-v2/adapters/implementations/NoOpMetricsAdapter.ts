import { 
  IMetricsAdapter, 
  MetricTags, 
  MetricOptions, 
  MetricsConfiguration, 
  TimerMetric 
} from '../interfaces/IMetricsAdapter';

/**
 * Implementation of IMetricsAdapter that doesn't record any metrics.
 * This is useful for environments where metrics collection is disabled or unavailable.
 */
export class NoOpMetricsAdapter implements IMetricsAdapter {
  private enabled: boolean = false;
  private configuration: MetricsConfiguration = {
    prefix: 'noop_',
    globalDimensions: {},
    defaultSamplingRate: 1.0,
    maxDimensions: 20,
    enableHistograms: true,
    batchSize: 10,
    flushIntervalMs: 10000,
    bufferSize: 100,
    enabled: false
  };

  /**
   * Creates a new instance of NoOpMetricsAdapter.
   * @param config - Optional configuration options.
   */
  constructor(config?: Partial<MetricsConfiguration>) {
    if (config) {
      this.updateConfiguration(config);
    }
  }

  /**
   * Creates a no-op timer that doesn't record any metrics.
   * @returns A TimerMetric interface implementation that does nothing.
   */
  private createNoOpTimer(): TimerMetric {
    const startTime = Date.now();
    let lastCheckpointTime = startTime;
    
    return {
      stop(additionalTags?: MetricTags): number {
        const elapsed = Date.now() - startTime;
        return elapsed;
      },
      reset(): void {
        // No-op
      },
      current(): number {
        return Date.now() - startTime;
      },
      checkpoint(checkpointName: string, additionalTags?: MetricTags): number {
        const now = Date.now();
        const elapsed = now - lastCheckpointTime;
        lastCheckpointTime = now;
        return elapsed;
      }
    };
  }

  incrementCounter(name: string, value: number = 1, tags?: MetricTags, options?: MetricOptions): void {
    // No-op
  }

  decrementCounter(name: string, value: number = 1, tags?: MetricTags, options?: MetricOptions): void {
    // No-op
  }

  setGauge(name: string, value: number, tags?: MetricTags, options?: MetricOptions): void {
    // No-op
  }

  incrementGauge(name: string, value: number = 1, tags?: MetricTags, options?: MetricOptions): void {
    // No-op
  }

  decrementGauge(name: string, value: number = 1, tags?: MetricTags, options?: MetricOptions): void {
    // No-op
  }

  recordHistogram(name: string, value: number, tags?: MetricTags, options?: MetricOptions): void {
    // No-op
  }

  startTimer(name: string, tags?: MetricTags, options?: MetricOptions): TimerMetric {
    return this.createNoOpTimer();
  }

  recordTimer(name: string, durationMs: number, tags?: MetricTags, options?: MetricOptions): void {
    // No-op
  }

  addToSet(name: string, value: string, tags?: MetricTags, options?: MetricOptions): void {
    // No-op
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
    // No-op
  }

  addGlobalDimensions(dimensions: MetricTags, overwrite: boolean = true): void {
    // No-op
  }

  getConfiguration(): MetricsConfiguration {
    return { ...this.configuration };
  }

  updateConfiguration(config: Partial<MetricsConfiguration>): MetricsConfiguration {
    this.configuration = { ...this.configuration, ...config };
    this.enabled = !!this.configuration.enabled;
    return this.getConfiguration();
  }

  async flush(): Promise<void> {
    // No-op
  }

  enable(): void {
    this.enabled = true;
    this.configuration.enabled = true;
  }

  disable(): void {
    this.enabled = false;
    this.configuration.enabled = false;
  }

  isEnabled(): boolean {
    return this.enabled;
  }
} 