import { CloudflareMetricsAdapter } from '../../adapters/implementations/cloudflare/CloudflareMetricsAdapter';
import { ILoggerAdapter, LogLevel } from '../../adapters/interfaces/ILoggerAdapter';
import { MetricType } from '../../adapters/interfaces/IMetricsAdapter';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock logger implementation
const createMockLogger = (): ILoggerAdapter => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  setLogLevel: vi.fn()
});

// Mock analytics engine implementation
const createMockAnalyticsEngine = () => ({
  writeDataPoint: vi.fn()
});

describe('CloudflareMetricsAdapter', () => {
  let mockLogger: ILoggerAdapter;
  let mockAnalyticsEngine: any;
  let adapter: CloudflareMetricsAdapter;
  let adapterWithAnalytics: CloudflareMetricsAdapter;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockAnalyticsEngine = createMockAnalyticsEngine();
    adapter = new CloudflareMetricsAdapter(mockLogger);
    adapterWithAnalytics = new CloudflareMetricsAdapter(
      mockLogger,
      'test_',
      mockAnalyticsEngine
    );
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('initialization', () => {
    it('logs a warning when initialized without analytics engine', () => {
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Initialized without an analytics engine')
      );
    });

    it('logs info when initialized with analytics engine', () => {
      const logger = createMockLogger();
      new CloudflareMetricsAdapter(logger, 'test_', mockAnalyticsEngine);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Initialized with prefix: test_')
      );
    });
  });

  describe('incrementCounter', () => {
    it('logs counter increments to debug log', () => {
      adapter.incrementCounter('test_counter', 5, { tag1: 'value1' });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('counter'), 
        expect.objectContaining({ tag1: 'value1' })
      );
    });

    it('calls writeDataPoint when analytics engine is available', () => {
      adapterWithAnalytics.incrementCounter('test_counter', 5, { tag1: 'value1' });
      expect(mockAnalyticsEngine.writeDataPoint).toHaveBeenCalledWith(
        expect.objectContaining({
          doubles: [5],
          indexes: ['test_test_counter', 'counter']
        })
      );
    });

    it('uses the default value of 1 when no value is provided', () => {
      adapterWithAnalytics.incrementCounter('test_counter');
      expect(mockAnalyticsEngine.writeDataPoint).toHaveBeenCalledWith(
        expect.objectContaining({
          doubles: [1]
        })
      );
    });
  });

  describe('setGauge', () => {
    it('logs gauge values to debug log', () => {
      adapter.setGauge('test_gauge', 42, { tag1: 'value1' });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('gauge'), 
        expect.objectContaining({ tag1: 'value1' })
      );
    });

    it('calls writeDataPoint when analytics engine is available', () => {
      adapterWithAnalytics.setGauge('test_gauge', 42, { tag1: 'value1' });
      expect(mockAnalyticsEngine.writeDataPoint).toHaveBeenCalledWith(
        expect.objectContaining({
          doubles: [42],
          indexes: ['test_test_gauge', 'gauge']
        })
      );
    });
  });

  describe('recordHistogram', () => {
    it('logs histogram values to debug log', () => {
      adapter.recordHistogram('test_histogram', 100, { tag1: 'value1' });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('histogram'), 
        expect.objectContaining({ tag1: 'value1' })
      );
    });

    it('calls writeDataPoint when analytics engine is available', () => {
      adapterWithAnalytics.recordHistogram('test_histogram', 100, { tag1: 'value1' });
      expect(mockAnalyticsEngine.writeDataPoint).toHaveBeenCalledWith(
        expect.objectContaining({
          doubles: [100],
          indexes: ['test_test_histogram', 'histogram']
        })
      );
    });
  });

  describe('startTimer and recordTimer', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('creates a timer that records duration when stopped', () => {
      const stopTimer = adapter.startTimer('test_timer', { tag1: 'value1' });
      vi.advanceTimersByTime(150);
      stopTimer();
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Timer Start'), 
        expect.objectContaining({ tag1: 'value1' })
      );
    });

    it('records timer in analytics engine when available', async () => {
      const stopTimer = adapterWithAnalytics.startTimer('test_timer', { tag1: 'value1' });
      vi.advanceTimersByTime(1000);
      stopTimer();
      
      // Timer duration should be recorded in seconds (1 second)
      expect(mockAnalyticsEngine.writeDataPoint).toHaveBeenCalledWith(
        expect.objectContaining({
          doubles: [1],
          indexes: ['test_test_timer', 'timer']
        })
      );
    });

    it('manually records timer durations', () => {
      adapter.recordTimer('test_timer_direct', 2500, { tag1: 'value1' });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('timer'), 
        expect.objectContaining({ tag1: 'value1' })
      );
    });
  });

  describe('error handling', () => {
    it('logs errors when analytics engine fails', () => {
      const errorEngine = {
        writeDataPoint: vi.fn().mockImplementation(() => {
          throw new Error('Analytics engine error');
        })
      };
      
      const errorAdapter = new CloudflareMetricsAdapter(
        mockLogger,
        'test_',
        errorEngine
      );
      
      errorAdapter.incrementCounter('test_counter', 1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error recording metric'),
        expect.any(Error)
      );
    });
  });

  describe('flush', () => {
    it('logs when flush is called', async () => {
      await adapter.flush();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Flush called')
      );
    });
  });
}); 