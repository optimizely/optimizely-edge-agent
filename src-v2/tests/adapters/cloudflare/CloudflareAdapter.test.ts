import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CloudflareRequestAdapter } from '../../../adapters/implementations/cloudflare/CloudflareRequestAdapter';
import { CloudflareStorageAdapter } from '../../../adapters/implementations/cloudflare/CloudflareStorageAdapter';
import { CloudflareEnvironmentAdapter } from '../../../adapters/implementations/cloudflare/CloudflareEnvironmentAdapter';
import { CloudflareLoggerAdapter } from '../../../adapters/implementations/cloudflare/CloudflareLoggerAdapter';
import { CloudflareAdapterFactory } from '../../../adapters/factories/CloudflareAdapterFactory';

describe('Cloudflare Adapters - Integration Tests', () => {
  // Mock Cloudflare specific objects
  const mockRequest = new Request('https://example.com/test');
  const mockEnv = {
    OPTLY_HYBRID_AGENT_KV: {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      list: vi.fn()
    }
  };
  const mockCtx = {
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn()
  };

  const factoryInputs = { request: mockRequest, env: mockEnv, ctx: mockCtx };
  let factory: CloudflareAdapterFactory;

  beforeEach(() => {
    vi.resetAllMocks();
    factory = new CloudflareAdapterFactory(factoryInputs);
  });

  describe('CloudflareRequestAdapter', () => {
    it('should properly extract URL and parameters from request', async () => {
      const adapter = factory.createRequestAdapter();
      expect(adapter).toBeInstanceOf(CloudflareRequestAdapter);
      expect(adapter.getUrl()).toBe('https://example.com/test');
    });

    it('should properly extract headers from request', async () => {
      const requestWithHeaders = new Request('https://example.com/test', {
        headers: {
          'x-test-header': 'test-value',
          'content-type': 'application/json'
        }
      });
      const factoryWithHeaders = new CloudflareAdapterFactory({
        ...factoryInputs,
        request: requestWithHeaders
      });
      const adapter = factoryWithHeaders.createRequestAdapter();
      
      expect(adapter.getHeader('x-test-header')).toBe('test-value');
      expect(adapter.getHeader('content-type')).toBe('application/json');
      expect(adapter.getHeader('non-existent')).toBeNull();
    });
  });

  describe('CloudflareStorageAdapter', () => {
    it('should call KV get and put methods correctly', async () => {
      mockEnv.OPTLY_HYBRID_AGENT_KV.get.mockResolvedValue('{"key":"value"}');
      mockEnv.OPTLY_HYBRID_AGENT_KV.put.mockResolvedValue(undefined);

      const adapter = factory.createStorageAdapter('OPTLY_HYBRID_AGENT_KV');
      
      // Test get
      const value = await adapter.get('test-key', 'json');
      expect(mockEnv.OPTLY_HYBRID_AGENT_KV.get).toHaveBeenCalledWith('test-key', { type: 'json' });
      expect(value).toEqual({ key: 'value' });

      // Test put
      const data = { newData: 'data' };
      await adapter.put('test-key', JSON.stringify(data));
      expect(mockEnv.OPTLY_HYBRID_AGENT_KV.put).toHaveBeenCalledWith('test-key', JSON.stringify(data));
    });

    it('should handle KV get errors gracefully', async () => {
      mockEnv.OPTLY_HYBRID_AGENT_KV.get.mockRejectedValue(new Error('KV error'));

      const adapter = factory.createStorageAdapter('OPTLY_HYBRID_AGENT_KV');
      
      await expect(adapter.get('test-key', 'json')).rejects.toThrow('KV error');
    });
  });

  describe('CloudflareEnvironmentAdapter', () => {
    it('should run tasks in the background with waitUntil', async () => {
      const adapter = factory.createEnvironmentAdapter();
      const task = vi.fn().mockResolvedValue('test-result');
      
      // Cast to any to avoid TypeScript errors in the test
      (adapter as any).runInBackground(task);
      
      expect(mockCtx.waitUntil).toHaveBeenCalled();
    });
  });

  describe('CloudflareLoggerAdapter', () => {
    it('should log messages at different levels', () => {
      // Mock console methods
      const originalConsole = { ...console };
      const mockConsole = {
        log: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      };
      
      // Replace console methods with mocks
      console.log = mockConsole.log;
      console.info = mockConsole.info;
      console.warn = mockConsole.warn;
      console.error = mockConsole.error;
      console.debug = mockConsole.debug;
      
      const adapter = factory.createLoggerAdapter();
      
      // Use the methods that exist on ILoggerAdapter
      adapter.info('Test info message');
      adapter.warn('Test warn message');
      adapter.error('Test error message');
      adapter.debug('Test debug message');
      
      expect(mockConsole.info).toHaveBeenCalledWith('[OPTLY-EDGE-v2]', 'Test info message');
      expect(mockConsole.warn).toHaveBeenCalledWith('[OPTLY-EDGE-v2]', 'Test warn message');
      expect(mockConsole.error).toHaveBeenCalledWith('[OPTLY-EDGE-v2]', 'Test error message');
      expect(mockConsole.debug).toHaveBeenCalledWith('[OPTLY-EDGE-v2]', 'Test debug message');
      
      // Restore original console methods
      console.log = originalConsole.log;
      console.info = originalConsole.info;
      console.warn = originalConsole.warn;
      console.error = originalConsole.error;
      console.debug = originalConsole.debug;
    });
  });

  describe('CloudflareAdapterFactory', () => {
    it('should create all adapter types correctly', () => {
      expect(factory.createRequestAdapter()).toBeInstanceOf(CloudflareRequestAdapter);
      expect(factory.createStorageAdapter('OPTLY_HYBRID_AGENT_KV')).toBeInstanceOf(CloudflareStorageAdapter);
      expect(factory.createEnvironmentAdapter()).toBeInstanceOf(CloudflareEnvironmentAdapter);
      expect(factory.createLoggerAdapter()).toBeInstanceOf(CloudflareLoggerAdapter);
    });
  });
}); 