import { describe, it, expect, vi, beforeEach } from 'vitest';
import handleVariationChanges from './variationChanges';
import { logger } from '../../_helpers_/optimizelyHelper.js';

// Mock the logger
vi.mock('../../_helpers_/optimizelyHelper.js', () => ({
  logger: vi.fn(),
}));

describe('Variation Changes Handler', () => {
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
        experiment_id: '12345',
        api_token: 'test-token',
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

  it('should construct correct URL and headers', async () => {
    mockFetch.mockResolvedValueOnce({
      headers: new Headers({ 'content-type': 'application/json' }),
      json: vi.fn().mockResolvedValue({
        variations: [
          {},
          {
            actions: [{ changes: { key: 'value' } }],
          },
        ],
      }),
    });

    await handleVariationChanges(mockRequest);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.optimizely.com/v2/experiments/12345',
      {
        headers: {
          'content-type': 'application/json;charset=UTF-8',
          Authorization: 'Bearer test-token',
        },
      }
    );
  });

  it('should handle JSON response correctly', async () => {
    const mockChanges = { key: 'value' };
    mockFetch.mockResolvedValueOnce({
      headers: new Headers({ 'content-type': 'application/json' }),
      json: vi.fn().mockResolvedValue({
        variations: [
          {},
          {
            actions: [{ changes: mockChanges }],
          },
        ],
      }),
    });

    const response = await handleVariationChanges(mockRequest);

    expect(mockKV.put).toHaveBeenCalledWith(
      'optly_variation_changes',
      JSON.stringify(mockChanges)
    );
    expect(response.headers.get('Content-type')).toBe('application/json; charset=UTF-8');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(await response.text()).toBe(
      `Variation changes updated to:\n\n${JSON.stringify(mockChanges)}`
    );
  });

  it('should handle text response correctly', async () => {
    const mockTextResponse = 'text response';
    mockFetch.mockResolvedValueOnce({
      headers: new Headers({ 'content-type': 'text/plain' }),
      text: vi.fn().mockResolvedValue(mockTextResponse),
    });

    const response = await handleVariationChanges(mockRequest);

    expect(mockKV.put).toHaveBeenCalledWith(
      'optly_variation_changes',
      mockTextResponse
    );
    expect(await response.text()).toBe(
      `Variation changes updated to:\n\n${mockTextResponse}`
    );
  });

  it('should handle fetch errors gracefully', async () => {
    const errorMessage = 'Network error';
    mockFetch.mockRejectedValueOnce(new Error(errorMessage));

    const response = await handleVariationChanges(mockRequest);

    expect(response.status).toBe(500);
    expect(await response.text()).toBe('Error updating variation changes');
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Error in handleVariationChanges:',
      expect.any(Error)
    );
  });

  it('should handle KV store errors gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      headers: new Headers({ 'content-type': 'text/plain' }),
      text: vi.fn().mockResolvedValue('test'),
    });
    mockKV.put.mockRejectedValueOnce(new Error('KV store error'));

    const response = await handleVariationChanges(mockRequest);

    expect(response.status).toBe(500);
    expect(await response.text()).toBe('Error updating variation changes');
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('should handle missing experiment ID or API token gracefully', async () => {
    mockRequest.params = {};
    mockFetch.mockRejectedValueOnce(new Error('Invalid URL'));

    const response = await handleVariationChanges(mockRequest);

    expect(response.status).toBe(500);
    expect(await response.text()).toBe('Error updating variation changes');
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('should handle malformed JSON response gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      headers: new Headers({ 'content-type': 'application/json' }),
      json: vi.fn().mockResolvedValue({
        variations: [], // Missing the expected structure
      }),
    });

    const response = await handleVariationChanges(mockRequest);

    expect(response.status).toBe(500);
    expect(await response.text()).toBe('Error updating variation changes');
    expect(mockLogger.error).toHaveBeenCalled();
  });
});
