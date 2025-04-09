import { IMetricsAdapter, MetricTags, MetricOptions, MetricsConfiguration, TimerMetric } from '../../adapters/interfaces/IMetricsAdapter';

/**
 * Mock implementation of the IMetricsAdapter for testing
 */
export class MockMetricsAdapter implements IMetricsAdapter {
  public counters: Record<string, number> = {};
  public gauges: Record<string, number> = {};
  public histograms: Record<string, number[]> = {};
  public timers: Record<string, number> = {};
  public sets: Record<string, Set<string>> = {};
  public summaries: Record<string, any> = {};
  
  private globalDimensions: MetricTags = {};
  private configuration: MetricsConfiguration = {
    prefix: 'test',
    globalDimensions: {},
    defaultSamplingRate: 1.0,
    maxDimensions: 10,
    enableHistograms: true,
    batchSize: 100,
    flushIntervalMs: 10000,
    bufferSize: 1000,
    enabled: true
  };

  incrementCounter(name: string, value: number = 1, tags?: MetricTags, options?: MetricOptions): void {
    const key = this.formatKey(name, tags);
    this.counters[key] = (this.counters[key] || 0) + value;
  }
  
  decrementCounter(name: string, value: number = 1, tags?: MetricTags, options?: MetricOptions): void {
    const key = this.formatKey(name, tags);
    this.counters[key] = (this.counters[key] || 0) - value;
  }

  setGauge(name: string, value: number, tags?: MetricTags, options?: MetricOptions): void {
    const key = this.formatKey(name, tags);
    this.gauges[key] = value;
  }
  
  incrementGauge(name: string, value: number = 1, tags?: MetricTags, options?: MetricOptions): void {
    const key = this.formatKey(name, tags);
    this.gauges[key] = (this.gauges[key] || 0) + value;
  }
  
  decrementGauge(name: string, value: number = 1, tags?: MetricTags, options?: MetricOptions): void {
    const key = this.formatKey(name, tags);
    this.gauges[key] = (this.gauges[key] || 0) - value;
  }

  recordHistogram(name: string, value: number, tags?: MetricTags, options?: MetricOptions): void {
    const key = this.formatKey(name, tags);
    if (!this.histograms[key]) {
      this.histograms[key] = [];
    }
    this.histograms[key].push(value);
  }

  startTimer(name: string, tags?: MetricTags, options?: MetricOptions): TimerMetric {
    const key = this.formatKey(name, tags);
    const startTime = Date.now();
    const checkpoints: Record<string, number> = {};
    let lastCheckpoint = startTime;
    
    return {
      stop: (additionalTags?: MetricTags) => {
        const duration = Date.now() - startTime;
        this.recordTimer(name, duration, { ...tags, ...additionalTags });
        return duration;
      },
      reset: () => {
        // Reset the timer to now
        Object.keys(checkpoints).forEach(k => delete checkpoints[k]);
        lastCheckpoint = Date.now();
      },
      current: () => {
        return Date.now() - startTime;
      },
      checkpoint: (checkpointName: string, additionalTags?: MetricTags) => {
        const now = Date.now();
        const duration = now - lastCheckpoint;
        checkpoints[checkpointName] = duration;
        
        // Record the checkpoint as a timer
        this.recordTimer(`${name}.checkpoint.${checkpointName}`, duration, { 
          ...tags, 
          ...additionalTags, 
          checkpoint: checkpointName 
        });
        
        lastCheckpoint = now;
        return duration;
      }
    };
  }

  recordTimer(name: string, durationMs: number, tags?: MetricTags, options?: MetricOptions): void {
    const key = this.formatKey(name, tags);
    this.timers[key] = durationMs;
    // Also record in histogram for distribution stats
    this.recordHistogram(`${name}.histogram`, durationMs, tags, options);
  }
  
  addToSet(name: string, value: string, tags?: MetricTags, options?: MetricOptions): void {
    const key = this.formatKey(name, tags);
    if (!this.sets[key]) {
      this.sets[key] = new Set<string>();
    }
    this.sets[key].add(value);
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
    const key = this.formatKey(name, tags);
    this.summaries[key] = summary;
  }
  
  addGlobalDimensions(dimensions: MetricTags, overwrite: boolean = true): void {
    if (overwrite) {
      this.globalDimensions = { ...this.globalDimensions, ...dimensions };
    } else {
      // Only add dimensions that don't already exist
      Object.entries(dimensions).forEach(([key, value]) => {
        if (this.globalDimensions[key] === undefined) {
          this.globalDimensions[key] = value;
        }
      });
    }
  }
  
  getConfiguration(): MetricsConfiguration {
    return { ...this.configuration };
  }
  
  updateConfiguration(config: Partial<MetricsConfiguration>): MetricsConfiguration {
    this.configuration = { ...this.configuration, ...config };
    return this.getConfiguration();
  }
  
  async flush(): Promise<void> {
    // No-op in mock
  }
  
  enable(): void {
    this.configuration.enabled = true;
  }
  
  disable(): void {
    this.configuration.enabled = false;
  }
  
  isEnabled(): boolean {
    return this.configuration.enabled === true;
  }

  private formatKey(name: string, tags?: MetricTags): string {
    const allTags = { ...this.globalDimensions, ...tags };
    const labelStr = Object.entries(allTags)
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    
    return labelStr ? `${name}{${labelStr}}` : name;
  }
  
  /**
   * Test helper to clear all recorded metrics
   */
  clear(): void {
    this.counters = {};
    this.gauges = {};
    this.histograms = {};
    this.timers = {};
    this.sets = {};
    this.summaries = {};
  }
} 