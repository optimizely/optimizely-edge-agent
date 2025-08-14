import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FastlyRequestAdapter } from '../../../adapters/implementations/fastly/FastlyRequestAdapter';
import { FastlyStorageAdapter } from '../../../adapters/implementations/fastly/FastlyStorageAdapter';
import { FastlyEnvironmentAdapter } from '../../../adapters/implementations/fastly/FastlyEnvironmentAdapter';
import { FastlyLoggerAdapter } from '../../../adapters/implementations/fastly/FastlyLoggerAdapter';
import { FastlyAdapterFactory } from '../../../adapters/factories/FastlyAdapterFactory';

describe('Fastly Adapters - Integration Tests', () => {
  // Mock Fastly specific objects
  const mockRequest = new Request('https://example.com/test');
  const mockEnv = {
    // Mock Fastly environment variables and KV store
    OPTLY_HYBRID_AGENT_KV: {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn()
    }
  };
  const mockCtx = {
    waitUntil: vi.fn()
  };

  const factoryInputs = { request: mockRequest, env: mockEnv, ctx: mockCtx };
  let factory: FastlyAdapterFactory;

  beforeEach(() => {
    vi.resetAllMocks();
    factory = new FastlyAdapterFactory(factoryInputs);
  });

  describe('FastlyRequestAdapter', () => {
    it('should properly extract URL and parameters from request', async () => {
      const adapter = factory.createRequestAdapter();
      expect(adapter).toBeInstanceOf(FastlyRequestAdapter);
      expect(adapter.getUrl()).toBe('https://example.com/test');
    });

    it('should properly extract headers from request', async () => {
      const requestWithHeaders = new Request('https://example.com/test', {
        headers: {
          'x-test-header': 'test-value',
          'content-type': 'application/json'
        }
      });
      const factoryWithHeaders = new FastlyAdapterFactory({
        ...factoryInputs,
        request: requestWithHeaders
      });
      const adapter = factoryWithHeaders.createRequestAdapter();
      
      expect(adapter.getHeader('x-test-header')).toBe('test-value');
      expect(adapter.getHeader('content-type')).toBe('application/json');
      expect(adapter.getHeader('non-existent')).toBeNull();
    });
  });

  describe('FastlyStorageAdapter', () => {
    it('should call KV get and set methods correctly', async () => {
      mockEnv.OPTLY_HYBRID_AGENT_KV.get.mockResolvedValue('{"key":"value"}');
      mockEnv.OPTLY_HYBRID_AGENT_KV.set.mockResolvedValue(undefined);

      const adapter = factory.createStorageAdapter('OPTLY_HYBRID_AGENT_KV');
      
      // Test get
      const value = await adapter.get('test-key', 'json');
      expect(mockEnv.OPTLY_HYBRID_AGENT_KV.get).toHaveBeenCalledWith('test-key');
      expect(value).toEqual({ key: 'value' });

      // Test put
      const data = { newData: 'data' };
      await adapter.put('test-key', JSON.stringify(data));
      expect(mockEnv.OPTLY_HYBRID_AGENT_KV.set).toHaveBeenCalledWith('test-key', JSON.stringify(data));
    });

    it('should handle KV get errors gracefully', async () => {
      mockEnv.OPTLY_HYBRID_AGENT_KV.get.mockRejectedValue(new Error('KV error'));

      const adapter = factory.createStorageAdapter('OPTLY_HYBRID_AGENT_KV');
      
      await expect(adapter.get('test-key', 'json')).rejects.toThrow('KV error');
    });
  });

  describe('FastlyEnvironmentAdapter', () => {
    it('should run tasks in the background with waitUntil', async () => {
      const adapter = factory.createEnvironmentAdapter();
      const task = vi.fn().mockResolvedValue('test-result');
      
      // Cast to any to avoid TypeScript errors in the test
      (adapter as any).runInBackground(task);
      
      expect(mockCtx.waitUntil).toHaveBeenCalled();
    });
  });

  describe('FastlyLoggerAdapter', () => {
    it('should log messages at different levels', () => {
      // Mock console methods
      const originalConsole = { ...console };
      const mockConsole = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      };
      
      // Replace console methods with mocks
      console.info = mockConsole.info;
      console.warn = mockConsole.warn;
      console.error = mockConsole.error;
      console.debug = mockConsole.debug;
      
      const adapter = factory.createLoggerAdapter();
      
      adapter.info('Test info message');
      adapter.warn('Test warn message');
      adapter.error('Test error message');
      adapter.debug('Test debug message');
      
      expect(mockConsole.info).toHaveBeenCalledWith('[OPTLY-EDGE-v2][FASTLY]', 'Test info message');
      expect(mockConsole.warn).toHaveBeenCalledWith('[OPTLY-EDGE-v2][FASTLY]', 'Test warn message');
      expect(mockConsole.error).toHaveBeenCalledWith('[OPTLY-EDGE-v2][FASTLY]', 'Test error message');
      expect(mockConsole.debug).toHaveBeenCalledWith('[OPTLY-EDGE-v2][FASTLY]', 'Test debug message');
      
      // Restore original console methods
      console.info = originalConsole.info;
      console.warn = originalConsole.warn;
      console.error = originalConsole.error;
      console.debug = originalConsole.debug;
    });
  });

  describe('FastlyAdapterFactory', () => {
    it('should create all adapter types correctly', () => {
      expect(factory.createRequestAdapter()).toBeInstanceOf(FastlyRequestAdapter);
      expect(factory.createStorageAdapter('OPTLY_HYBRID_AGENT_KV')).toBeInstanceOf(FastlyStorageAdapter);
      expect(factory.createEnvironmentAdapter()).toBeInstanceOf(FastlyEnvironmentAdapter);
      expect(factory.createLoggerAdapter()).toBeInstanceOf(FastlyLoggerAdapter);
    });
  });
}); 