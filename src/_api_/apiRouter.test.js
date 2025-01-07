import { describe, it, expect, vi, beforeEach } from 'vitest';
import handleRequest from './apiRouter';

describe('apiRouter', () => {
  let mockRequest;
  let mockAbstractionHelper;
  let mockKvStore;
  let mockLogger;
  let mockDefaultSettings;

  beforeEach(() => {
    mockRequest = new Request('https://example.com/v1/api/datafiles/test-key');
    mockAbstractionHelper = {
      abstractRequest: {
        getNewURL: vi.fn((url) => new URL(url)),
        getPathnameFromRequest: vi.fn(),
        getHttpMethodFromRequest: vi.fn(),
      },
      createResponse: vi.fn((body, status = 200) => new Response(body, { status })),
    };
    mockKvStore = {
      get: vi.fn(),
      put: vi.fn(),
    };
    mockLogger = {
      debug: vi.fn(),
      error: vi.fn(),
    };
    mockDefaultSettings = {};
  });

  it('should return 404 for non-existing routes', async () => {
    mockAbstractionHelper.abstractRequest.getPathnameFromRequest.mockReturnValue('/non-existing-route');
    mockAbstractionHelper.abstractRequest.getHttpMethodFromRequest.mockReturnValue('GET');

    const response = await handleRequest(
      mockRequest,
      mockAbstractionHelper,
      mockKvStore,
      mockLogger,
      mockDefaultSettings
    );

    expect(response.status).toBe(404);
    expect(await response.text()).toBe('Not found');
  });

  it('should handle datafile GET request', async () => {
    const mockDatafileKey = 'test-key';
    mockRequest = new Request(`https://example.com/v1/api/datafiles/${mockDatafileKey}`);
    mockRequest.params = { key: mockDatafileKey };
    mockAbstractionHelper.abstractRequest.getPathnameFromRequest.mockReturnValue(`/v1/api/datafiles/${mockDatafileKey}`);
    mockAbstractionHelper.abstractRequest.getHttpMethodFromRequest.mockReturnValue('GET');
    mockKvStore.get.mockResolvedValue(JSON.stringify({ key: mockDatafileKey }));

    await handleRequest(
      mockRequest,
      mockAbstractionHelper,
      mockKvStore,
      mockLogger,
      mockDefaultSettings
    );

    expect(mockLogger.debug).toHaveBeenCalled();
  });

  it('should handle datafile POST request', async () => {
    const mockDatafileKey = 'test-key';
    mockRequest = new Request(`https://example.com/v1/api/datafiles/${mockDatafileKey}`, {
      method: 'POST',
      body: JSON.stringify({ key: mockDatafileKey }),
    });
    mockRequest.params = { key: mockDatafileKey };
    mockAbstractionHelper.abstractRequest.getPathnameFromRequest.mockReturnValue(`/v1/api/datafiles/${mockDatafileKey}`);
    mockAbstractionHelper.abstractRequest.getHttpMethodFromRequest.mockReturnValue('POST');

    await handleRequest(
      mockRequest,
      mockAbstractionHelper,
      mockKvStore,
      mockLogger,
      mockDefaultSettings
    );

    expect(mockLogger.debug).toHaveBeenCalled();
  });

  it('should handle flag_keys GET request', async () => {
    mockRequest = new Request('https://example.com/v1/api/flag_keys');
    mockAbstractionHelper.abstractRequest.getPathnameFromRequest.mockReturnValue('/v1/api/flag_keys');
    mockAbstractionHelper.abstractRequest.getHttpMethodFromRequest.mockReturnValue('GET');
    mockKvStore.get.mockResolvedValue(JSON.stringify({ flags: [] }));

    await handleRequest(
      mockRequest,
      mockAbstractionHelper,
      mockKvStore,
      mockLogger,
      mockDefaultSettings
    );

    expect(mockLogger.debug).toHaveBeenCalled();
  });

  it('should handle flag_keys POST request', async () => {
    mockRequest = new Request('https://example.com/v1/api/flag_keys', {
      method: 'POST',
      body: JSON.stringify({ flags: [] }),
    });
    mockAbstractionHelper.abstractRequest.getPathnameFromRequest.mockReturnValue('/v1/api/flag_keys');
    mockAbstractionHelper.abstractRequest.getHttpMethodFromRequest.mockReturnValue('POST');

    await handleRequest(
      mockRequest,
      mockAbstractionHelper,
      mockKvStore,
      mockLogger,
      mockDefaultSettings
    );

    expect(mockLogger.debug).toHaveBeenCalled();
  });

  it('should handle sdk GET request', async () => {
    const mockSdkUrl = 'test-sdk';
    mockRequest = new Request(`https://example.com/v1/api/sdk/${mockSdkUrl}`);
    mockRequest.params = { sdk_url: mockSdkUrl };
    mockAbstractionHelper.abstractRequest.getPathnameFromRequest.mockReturnValue(`/v1/api/sdk/${mockSdkUrl}`);
    mockAbstractionHelper.abstractRequest.getHttpMethodFromRequest.mockReturnValue('GET');

    await handleRequest(
      mockRequest,
      mockAbstractionHelper,
      mockKvStore,
      mockLogger,
      mockDefaultSettings
    );

    expect(mockLogger.debug).toHaveBeenCalled();
  });

  it('should handle variation_changes GET request', async () => {
    const mockExperimentId = '123';
    const mockApiToken = 'test-token';
    mockRequest = new Request(`https://example.com/v1/api/variation_changes/${mockExperimentId}/${mockApiToken}`);
    mockRequest.params = { experiment_id: mockExperimentId, api_token: mockApiToken };
    mockAbstractionHelper.abstractRequest.getPathnameFromRequest.mockReturnValue(`/v1/api/variation_changes/${mockExperimentId}/${mockApiToken}`);
    mockAbstractionHelper.abstractRequest.getHttpMethodFromRequest.mockReturnValue('GET');

    await handleRequest(
      mockRequest,
      mockAbstractionHelper,
      mockKvStore,
      mockLogger,
      mockDefaultSettings
    );

    expect(mockLogger.debug).toHaveBeenCalled();
  });

  it('should handle variation_changes POST request', async () => {
    const mockExperimentId = '123';
    const mockApiToken = 'test-token';
    mockRequest = new Request(`https://example.com/v1/api/variation_changes/${mockExperimentId}/${mockApiToken}`, {
      method: 'POST',
      body: JSON.stringify({ variations: [] }),
    });
    mockRequest.params = { experiment_id: mockExperimentId, api_token: mockApiToken };
    mockAbstractionHelper.abstractRequest.getPathnameFromRequest.mockReturnValue(`/v1/api/variation_changes/${mockExperimentId}/${mockApiToken}`);
    mockAbstractionHelper.abstractRequest.getHttpMethodFromRequest.mockReturnValue('POST');

    await handleRequest(
      mockRequest,
      mockAbstractionHelper,
      mockKvStore,
      mockLogger,
      mockDefaultSettings
    );

    expect(mockLogger.debug).toHaveBeenCalled();
  });
});
