import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VercelRequestAdapter } from '../../../adapters/implementations/vercel/VercelRequestAdapter';
import { VercelStorageAdapter } from '../../../adapters/implementations/vercel/VercelStorageAdapter';
import { VercelEnvironmentAdapter } from '../../../adapters/implementations/vercel/VercelEnvironmentAdapter';
import { VercelLoggerAdapter } from '../../../adapters/implementations/vercel/VercelLoggerAdapter';
import { VercelAdapterFactory } from '../../../adapters/factories/VercelAdapterFactory';

describe('Vercel Adapters - Integration Tests', () => {
  // Mock Vercel specific objects
  const mockRequest = new Request('https://example.com/test');
  const mockEnv = {
    // Mock Vercel environment variables and KV store
    OPTLY_HYBRID_AGENT_KV: {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      list: vi.fn()
    }
  };
  const mockCtx = {
    waitUntil: vi.fn()
  };

  const factoryInputs = { request: mockRequest, env: mockEnv, ctx: mockCtx };
  let factory: VercelAdapterFactory;

  beforeEach(() => {
    vi.resetAllMocks();
    factory = new VercelAdapterFactory(factoryInputs);
  });

  describe('VercelRequestAdapter', () => {
    it('should properly extract URL and parameters from request', async () => {
      const adapter = factory.createRequestAdapter();
      expect(adapter).toBeInstanceOf(VercelRequestAdapter);
      expect(adapter.getUrl()).toBe('https://example.com/test');
    });

    it('should properly extract headers from request', async () => {
      const requestWithHeaders = new Request('https://example.com/test', {
        headers: {
          'x-test-header': 'test-value',
          'content-type': 'application/json'
        }
      });
      const factoryWithHeaders = new VercelAdapterFactory({
        ...factoryInputs,
        request: requestWithHeaders
      });
      const adapter = factoryWithHeaders.createRequestAdapter();
      
      expect(adapter.getHeader('x-test-header')).toBe('test-value');
      expect(adapter.getHeader('content-type')).toBe('application/json');
      expect(adapter.getHeader('non-existent')).toBeNull();
    });
  });

  describe('VercelStorageAdapter', () => {
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

  describe('VercelEnvironmentAdapter', () => {
    it('should run tasks in the background with waitUntil', async () => {
      const adapter = factory.createEnvironmentAdapter();
      const task = vi.fn().mockResolvedValue('test-result');
      
      // Cast to any to avoid TypeScript errors in the test
      (adapter as any).runInBackground(task);
      
      expect(mockCtx.waitUntil).toHaveBeenCalled();
    });
  });

  describe('VercelLoggerAdapter', () => {
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
      
      expect(mockConsole.info).toHaveBeenCalledWith('[OPTLY-EDGE-v2][VERCEL]', 'Test info message');
      expect(mockConsole.warn).toHaveBeenCalledWith('[OPTLY-EDGE-v2][VERCEL]', 'Test warn message');
      expect(mockConsole.error).toHaveBeenCalledWith('[OPTLY-EDGE-v2][VERCEL]', 'Test error message');
      expect(mockConsole.debug).toHaveBeenCalledWith('[OPTLY-EDGE-v2][VERCEL]', 'Test debug message');
      
      // Restore original console methods
      console.info = originalConsole.info;
      console.warn = originalConsole.warn;
      console.error = originalConsole.error;
      console.debug = originalConsole.debug;
    });
  });

  describe('VercelAdapterFactory', () => {
    it('should create all adapter types correctly', () => {
      expect(factory.createRequestAdapter()).toBeInstanceOf(VercelRequestAdapter);
      expect(factory.createStorageAdapter('OPTLY_HYBRID_AGENT_KV')).toBeInstanceOf(VercelStorageAdapter);
      expect(factory.createEnvironmentAdapter()).toBeInstanceOf(VercelEnvironmentAdapter);
      expect(factory.createLoggerAdapter()).toBeInstanceOf(VercelLoggerAdapter);
    });
  });
}); 