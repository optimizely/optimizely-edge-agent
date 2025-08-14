import { StandardMetricsAdapter } from '../StandardMetricsAdapter';
import { ILoggerAdapter } from '../../interfaces/ILoggerAdapter';
import { MetricsConfiguration, MetricTags } from '../../interfaces/IMetricsAdapter';
import { IEnvironmentAdapter } from '../../interfaces/IEnvironmentAdapter';

/**
 * Base class for all external metrics adapters (Prometheus, DataDog, New Relic, etc.)
 * Extends StandardMetricsAdapter to inherit metric collection functionality
 * and adds common utilities for external metric submission.
 */
export abstract class BaseMetricsAdapter extends StandardMetricsAdapter {
  protected environmentAdapter: IEnvironmentAdapter;
  protected buffer: MetricBuffer;
  protected retryManager: RetryManager;
  protected circuitBreaker: CircuitBreaker;

  constructor(logger: ILoggerAdapter, environmentAdapter: IEnvironmentAdapter) {
    // Extract metrics configuration from environment
    const config = extractMetricsConfig(environmentAdapter);
    super(logger, config);
    
    this.environmentAdapter = environmentAdapter;
    
    // Initialize shared components
    this.buffer = new MetricBuffer({
      maxSize: config.bufferSize || 1000,
      flushInterval: config.flushIntervalMs || 10000,
      onFlush: () => this.flush()
    });
    
    this.retryManager = new RetryManager({
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2
    });
    
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeout: 60000,
      onOpen: () => this.logger.warn('Metrics circuit breaker opened - metrics disabled temporarily'),
      onClose: () => this.logger.info('Metrics circuit breaker closed - metrics re-enabled')
    });
  }

  /**
   * Formats tags into a consistent string array format
   * @param tags - The tags to format
   * @returns Array of formatted tag strings
   */
  protected formatTags(tags?: MetricTags): string[] {
    if (!tags) return [];
    
    const globalTags = this.configuration.globalDimensions || {};
    const allTags = { ...globalTags, ...tags };
    
    return Object.entries(allTags)
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([key, value]) => `${key}:${value}`);
  }

  /**
   * Compresses data using gzip compression
   * @param data - The string data to compress
   * @returns Compressed data as ArrayBuffer
   */
  protected async compress(data: string): Promise<ArrayBuffer> {
    // Check if CompressionStream is available (it should be in most modern edge environments)
    if (typeof CompressionStream === 'undefined') {
      // Fallback: return uncompressed data
      return new TextEncoder().encode(data).buffer as ArrayBuffer;
    }

    const encoder = new TextEncoder();
    const stream = new CompressionStream('gzip');
    const writer = stream.writable.getWriter();
    
    writer.write(encoder.encode(data));
    writer.close();
    
    const chunks: Uint8Array[] = [];
    const reader = stream.readable.getReader();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    
    // Combine chunks into single ArrayBuffer
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    
    return result.buffer as ArrayBuffer;
  }

  /**
   * Maps internal metric types to provider-specific types
   * @param type - The internal metric type
   * @returns The provider-specific metric type
   */
  protected mapMetricType(type: string): string {
    // Default mapping - can be overridden by specific adapters
    const typeMap: Record<string, string> = {
      'counter': 'count',
      'gauge': 'gauge',
      'histogram': 'gauge', // Simplified for most providers
      'timer': 'gauge',
      'summary': 'gauge',
      'set': 'gauge'
    };
    return typeMap[type] || 'gauge';
  }

  /**
   * Handles errors with retry logic and circuit breaker
   * @param error - The error that occurred
   * @param operation - The operation that failed
   * @param data - The data that failed to send
   */
  protected async handleError(error: Error, operation: () => Promise<void>, data?: any): Promise<void> {
    this.logger.error(`Metrics submission failed: ${error.message}`, { error, data });
    
    // Check circuit breaker
    if (!this.circuitBreaker.allowRequest()) {
      this.logger.warn('Circuit breaker is open, skipping retry');
      return;
    }
    
    // Attempt retry with exponential backoff
    try {
      await this.retryManager.retry(operation);
      this.circuitBreaker.recordSuccess();
    } catch (retryError) {
      this.circuitBreaker.recordFailure();
      this.logger.error('Metrics submission failed after retries', { error: retryError });
    }
  }

  /**
   * Abstract method that child classes must implement to flush metrics
   * to their specific backend
   */
  abstract flush(): Promise<void>;
}

/**
 * Extracts metrics configuration from environment variables
 */
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

  // Parse global dimensions from JSON string
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

/**
 * Configuration for the metric buffer
 */
interface BufferConfig {
  maxSize: number;
  flushInterval: number;
  onFlush: () => void;
}

/**
 * Metric buffer for batching metrics before sending
 */
export class MetricBuffer {
  private buffer: any[] = [];
  private config: BufferConfig;
  private flushTimer?: ReturnType<typeof setTimeout>;

  constructor(config: BufferConfig) {
    this.config = config;
    this.startFlushTimer();
  }

  add(metric: any): void {
    this.buffer.push(metric);
    
    if (this.buffer.length >= this.config.maxSize) {
      this.flush();
    }
  }

  drain(): any[] {
    const metrics = [...this.buffer];
    this.buffer = [];
    return metrics;
  }

  isEmpty(): boolean {
    return this.buffer.length === 0;
  }

  size(): number {
    return this.buffer.length;
  }

  private flush(): void {
    if (this.config.onFlush) {
      this.config.onFlush();
    }
  }

  private startFlushTimer(): void {
    if (this.config.flushInterval > 0) {
      this.flushTimer = setInterval(() => {
        if (!this.isEmpty()) {
          this.flush();
        }
      }, this.config.flushInterval);
    }
  }

  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
  }
}

/**
 * Retry manager for handling failed requests
 */
interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export class RetryManager {
  private config: RetryConfig;

  constructor(config: RetryConfig) {
    this.config = config;
  }

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

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Circuit breaker for preventing cascading failures
 */
interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  onOpen?: () => void;
  onClose?: () => void;
}

export class CircuitBreaker {
  private config: CircuitBreakerConfig;
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private resetTimer?: ReturnType<typeof setTimeout>;

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
  }

  allowRequest(): boolean {
    if (this.state === 'closed') {
      return true;
    }

    if (this.state === 'open') {
      // Check if enough time has passed to try again
      if (Date.now() - this.lastFailureTime >= this.config.resetTimeout) {
        this.state = 'half-open';
        return true;
      }
      return false;
    }

    // half-open state
    return true;
  }

  recordSuccess(): void {
    if (this.state === 'half-open') {
      this.close();
    }
    this.failureCount = 0;
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.config.failureThreshold) {
      this.open();
    }
  }

  private open(): void {
    if (this.state !== 'open') {
      this.state = 'open';
      if (this.config.onOpen) {
        this.config.onOpen();
      }

      // Set timer to move to half-open state
      if (this.resetTimer) {
        clearTimeout(this.resetTimer);
      }
      this.resetTimer = setTimeout(() => {
        this.state = 'half-open';
      }, this.config.resetTimeout);
    }
  }

  private close(): void {
    if (this.state !== 'closed') {
      this.state = 'closed';
      this.failureCount = 0;
      if (this.config.onClose) {
        this.config.onClose();
      }
      if (this.resetTimer) {
        clearTimeout(this.resetTimer);
        this.resetTimer = undefined;
      }
    }
  }
}