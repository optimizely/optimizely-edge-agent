import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleCloudflareWorkerRequest,
  handleVercelEdgeRequest,
  handleFastlyComputeRequest,
} from '../../compositionRoot';
import { CloudflareAdapterFactory } from '../../adapters/factories/CloudflareAdapterFactory';
import { VercelAdapterFactory } from '../../adapters/factories/VercelAdapterFactory';
import { FastlyAdapterFactory } from '../../adapters/factories/FastlyAdapterFactory';
import { CloudflareExecutionContext } from '../../adapters/implementations/cloudflare/CloudflareEnvironmentAdapter';
import { VercelExecutionContext } from '../../adapters/implementations/vercel/VercelEnvironmentAdapter';
import { FastlyExecutionContext } from '../../adapters/implementations/fastly/FastlyEnvironmentAdapter';

// Mock the adapter factories
vi.mock('../../adapters/factories/CloudflareAdapterFactory');
vi.mock('../../adapters/factories/VercelAdapterFactory');
vi.mock('../../adapters/factories/FastlyAdapterFactory');

describe('Composition Root - Environment Detection Tests', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    
    // Mock the adapter factory implementations
    (CloudflareAdapterFactory as any).mockImplementation(() => ({
      createLoggerAdapter: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }),
      createRequestAdapter: () => ({
        getUrl: vi.fn().mockReturnValue('https://example.com/test'),
        getBody: vi.fn().mockReturnValue(null),
        getHeader: vi.fn().mockReturnValue(null),
        getMethod: vi.fn().mockReturnValue('GET'),
      }),
      createEnvironmentAdapter: vi.fn(),
      createStorageAdapter: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
      }),
    }));
    
    (VercelAdapterFactory as any).mockImplementation(() => ({
      createLoggerAdapter: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }),
      createRequestAdapter: () => ({
        getUrl: vi.fn().mockReturnValue('https://example.com/test'),
        getBody: vi.fn().mockReturnValue(null),
        getHeader: vi.fn().mockReturnValue(null),
        getMethod: vi.fn().mockReturnValue('GET'),
      }),
      createEnvironmentAdapter: vi.fn(),
      createStorageAdapter: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
      }),
    }));
    
    (FastlyAdapterFactory as any).mockImplementation(() => ({
      createLoggerAdapter: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }),
      createRequestAdapter: () => ({
        getUrl: vi.fn().mockReturnValue('https://example.com/test'),
        getBody: vi.fn().mockReturnValue(null),
        getHeader: vi.fn().mockReturnValue(null),
        getMethod: vi.fn().mockReturnValue('GET'),
      }),
      createEnvironmentAdapter: vi.fn(),
      createStorageAdapter: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
      }),
    }));
  });

  it('should use Cloudflare adapters when handling a Cloudflare request', async () => {
    const mockRequest = new Request('https://example.com/test');
    const mockEnv = { OPTLY_HYBRID_AGENT_KV: {} };
    const mockCtx: CloudflareExecutionContext = { 
      waitUntil: vi.fn(), 
      passThroughOnException: vi.fn() 
    };

    await handleCloudflareWorkerRequest(mockRequest, mockEnv, mockCtx);

    expect(CloudflareAdapterFactory).toHaveBeenCalledWith({ 
      request: mockRequest, 
      env: mockEnv, 
      ctx: mockCtx 
    });
    expect(VercelAdapterFactory).not.toHaveBeenCalled();
    expect(FastlyAdapterFactory).not.toHaveBeenCalled();
  });

  it('should use Vercel adapters when handling a Vercel request', async () => {
    const mockRequest = new Request('https://example.com/test');
    const mockEnv = { OPTLY_HYBRID_AGENT_KV: {} };
    const mockCtx: VercelExecutionContext = { 
      waitUntil: vi.fn() 
    };

    await handleVercelEdgeRequest(mockRequest, mockEnv, mockCtx);

    expect(VercelAdapterFactory).toHaveBeenCalledWith({ 
      request: mockRequest, 
      env: mockEnv, 
      ctx: mockCtx 
    });
    expect(CloudflareAdapterFactory).not.toHaveBeenCalled();
    expect(FastlyAdapterFactory).not.toHaveBeenCalled();
  });

  it('should use Fastly adapters when handling a Fastly request', async () => {
    const mockRequest = new Request('https://example.com/test');
    const mockEnv = { OPTLY_HYBRID_AGENT_KV: {} };
    const mockCtx: FastlyExecutionContext = { 
      waitUntil: vi.fn() 
    };

    await handleFastlyComputeRequest(mockRequest, mockEnv, mockCtx);

    expect(FastlyAdapterFactory).toHaveBeenCalledWith({ 
      request: mockRequest, 
      env: mockEnv, 
      ctx: mockCtx 
    });
    expect(CloudflareAdapterFactory).not.toHaveBeenCalled();
    expect(VercelAdapterFactory).not.toHaveBeenCalled();
  });

  it('should handle errors gracefully', async () => {
    // Cause an error by not providing required parameters
    const mockRequest = new Request('https://example.com/test');
    
    // Mock console.error to avoid polluting test output
    const originalConsoleError = console.error;
    console.error = vi.fn();
    
    // CloudflareAdapterFactory will throw due to missing env/ctx
    (CloudflareAdapterFactory as any).mockImplementation(() => {
      throw new Error('Missing required parameters');
    });
    
    const mockCtx: CloudflareExecutionContext = { 
      waitUntil: vi.fn(), 
      passThroughOnException: vi.fn() 
    };
    
    const response = await handleCloudflareWorkerRequest(mockRequest, {}, mockCtx);
    
    expect(response.status).toBe(500);
    const responseBody = await response.json();
    expect(responseBody).toHaveProperty('message', 'Internal Server Error');
    expect(responseBody).toHaveProperty('cdnType', 'cloudflare');
    
    // Restore console.error
    console.error = originalConsoleError;
  });
}); 