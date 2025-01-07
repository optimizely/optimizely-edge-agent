import { describe, it, expect, vi, beforeEach } from 'vitest';
import handleSDK from './sdk';
import { logger } from '../../_helpers_/optimizelyHelper.js';

// Mock the logger
vi.mock('../../_helpers_/optimizelyHelper.js', () => ({
  logger: vi.fn(),
}));

describe('SDK Handler', () => {
  let mockRequest;
  let mockFetch;
  let mockKV;
  let mockLogger;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup mock logger
    mockLogger = {
      error: vi.fn(),
    };
    logger.mockReturnValue(mockLogger);

    // Mock the request
    mockRequest = {
      params: {
        sdk_url: 'https%3A%2F%2Fexample.com%2Fsdk.js',
      },
    };

    // Mock fetch
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    // Mock KV store
    mockKV = {
      put: vi.fn(),
    };
    global.OPTLY_HYBRID_AGENT_KV = mockKV;
  });

  it('should decode the SDK URL correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      headers: new Headers({ 'content-type': 'text/javascript' }),
      text: vi.fn().mockResolvedValue('console.log("SDK")'),
    });

    await handleSDK(mockRequest);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/sdk.js',
      expect.any(Object)
    );
  });

  it('should handle JSON response from SDK URL', async () => {
    const mockJsonResponse = { version: '1.0.0' };
    mockFetch.mockResolvedValueOnce({
      headers: new Headers({ 'content-type': 'application/json' }),
      json: vi.fn().mockResolvedValue(mockJsonResponse),
    });

    await handleSDK(mockRequest);

    expect(mockKV.put).toHaveBeenCalledWith(
      'optly_js_sdk',
      JSON.stringify(mockJsonResponse)
    );
  });

  it('should handle text response from SDK URL', async () => {
    const mockTextResponse = 'console.log("SDK")';
    mockFetch.mockResolvedValueOnce({
      headers: new Headers({ 'content-type': 'text/javascript' }),
      text: vi.fn().mockResolvedValue(mockTextResponse),
    });

    await handleSDK(mockRequest);

    expect(mockKV.put).toHaveBeenCalledWith('optly_js_sdk', mockTextResponse);
  });

  it('should handle response with no content-type header', async () => {
    const mockTextResponse = 'console.log("SDK")';
    mockFetch.mockResolvedValueOnce({
      headers: new Headers({}),
      text: vi.fn().mockResolvedValue(mockTextResponse),
    });

    await handleSDK(mockRequest);

    expect(mockKV.put).toHaveBeenCalledWith('optly_js_sdk', mockTextResponse);
  });

  it('should return success response with correct headers', async () => {
    mockFetch.mockResolvedValueOnce({
      headers: new Headers({ 'content-type': 'text/javascript' }),
      text: vi.fn().mockResolvedValue('console.log("SDK")'),
    });

    const response = await handleSDK(mockRequest);

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Content-type')).toBe('text/javascript');
    expect(await response.text()).toBe(
      'SDK updated to: https://example.com/sdk.js\n'
    );
  });

  it('should handle fetch errors gracefully', async () => {
    const errorMessage = 'Network error';
    mockFetch.mockRejectedValueOnce(new Error(errorMessage));

    const response = await handleSDK(mockRequest);

    expect(response.status).toBe(500);
    expect(await response.text()).toBe('Error updating SDK');
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Error in handleSDK:',
      expect.any(Error)
    );
  });

  it('should handle KV store errors gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      headers: new Headers({ 'content-type': 'text/javascript' }),
      text: vi.fn().mockResolvedValue('console.log("SDK")'),
    });
    mockKV.put.mockRejectedValueOnce(new Error('KV store error'));

    const response = await handleSDK(mockRequest);

    expect(response.status).toBe(500);
    expect(await response.text()).toBe('Error updating SDK');
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Error in handleSDK:',
      expect.any(Error)
    );
  });

  it('should set correct request headers when fetching SDK', async () => {
    mockFetch.mockResolvedValueOnce({
      headers: new Headers({ 'content-type': 'text/javascript' }),
      text: vi.fn().mockResolvedValue('console.log("SDK")'),
    });

    await handleSDK(mockRequest);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: {
          'content-type': 'text/javascript;charset=UTF-8',
        },
      })
    );
  });
});
