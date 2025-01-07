import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleDatafile, handleGetDatafile } from './datafile';
import { AbstractRequest } from '../../_helpers_/abstraction-classes/abstractRequest';

describe('Datafile handlers', () => {
  let mockRequest;
  let mockAbstractionHelper;
  let mockKvStore;
  let mockLogger;
  let mockDefaultSettings;
  let mockParams;

  beforeEach(() => {
    mockRequest = new Request('https://example.com/v1/api/datafiles/test-key');
    mockAbstractionHelper = {
      abstractRequest: {
        getHttpMethodFromRequest: vi.fn(),
      },
      createResponse: vi.fn((body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers })),
      getResponseContent: vi.fn(),
    };
    mockKvStore = {
      get: vi.fn(),
      put: vi.fn(),
    };
    mockLogger = {
      debug: vi.fn(),
      debugExt: vi.fn(),
      error: vi.fn(),
    };
    mockDefaultSettings = {};
    mockParams = {
      key: 'test-key',
    };

    // Mock the static method
    vi.spyOn(AbstractRequest, 'fetchRequest').mockImplementation(() => Promise.resolve(new Response()));
  });

  describe('handleDatafile (POST)', () => {
    beforeEach(() => {
      mockAbstractionHelper.abstractRequest.getHttpMethodFromRequest.mockReturnValue('POST');
    });

    it('should return 405 for non-POST requests', async () => {
      mockAbstractionHelper.abstractRequest.getHttpMethodFromRequest.mockReturnValue('GET');

      await handleDatafile(
        mockRequest,
        mockAbstractionHelper,
        mockKvStore,
        mockLogger,
        mockDefaultSettings,
        mockParams,
      );

      expect(mockAbstractionHelper.createResponse).toHaveBeenCalledWith('Method Not Allowed', 405);
    });

    it('should return 400 when datafile key is missing', async () => {
      await handleDatafile(
        mockRequest,
        mockAbstractionHelper,
        mockKvStore,
        mockLogger,
        mockDefaultSettings,
        {},
      );

      expect(mockAbstractionHelper.createResponse).toHaveBeenCalledWith(
        'Datafile SDK key is required but it is missing from the request.',
        400,
      );
    });

    it('should handle successful datafile update', async () => {
      const mockDatafile = { version: '1.0.0' };
      mockAbstractionHelper.getResponseContent.mockResolvedValue(JSON.stringify(mockDatafile));
      mockKvStore.get.mockResolvedValue(JSON.stringify(mockDatafile));

      await handleDatafile(
        mockRequest,
        mockAbstractionHelper,
        mockKvStore,
        mockLogger,
        mockDefaultSettings,
        mockParams,
      );

      expect(AbstractRequest.fetchRequest).toHaveBeenCalledWith(
        'https://cdn.optimizely.com/datafiles/test-key.json',
      );
      expect(mockKvStore.put).toHaveBeenCalledWith('test-key', JSON.stringify(mockDatafile));
      expect(mockAbstractionHelper.createResponse).toHaveBeenCalledWith(
        {
          message: 'Datafile updated to Key: test-key',
          datafile: JSON.stringify(mockDatafile),
        },
        200,
        { 'Content-Type': 'application/json' },
      );
    });

    it('should handle fetch errors gracefully', async () => {
      const errorMessage = 'Network error';
      AbstractRequest.fetchRequest.mockRejectedValue(new Error(errorMessage));

      await handleDatafile(
        mockRequest,
        mockAbstractionHelper,
        mockKvStore,
        mockLogger,
        mockDefaultSettings,
        mockParams,
      );

      expect(mockLogger.error).toHaveBeenCalledWith('Error in handleDatafile:', errorMessage);
      expect(mockAbstractionHelper.createResponse).toHaveBeenCalledWith(
        expect.stringContaining('Error updating datafile'),
        500,
      );
    });

    it('should handle KV store errors gracefully', async () => {
      mockAbstractionHelper.getResponseContent.mockResolvedValue('{}');
      mockKvStore.put.mockRejectedValue(new Error('KV store error'));

      await handleDatafile(
        mockRequest,
        mockAbstractionHelper,
        mockKvStore,
        mockLogger,
        mockDefaultSettings,
        mockParams,
      );

      expect(mockLogger.error).toHaveBeenCalled();
      expect(mockAbstractionHelper.createResponse).toHaveBeenCalledWith(
        expect.stringContaining('Error updating datafile'),
        500,
      );
    });
  });

  describe('handleGetDatafile (GET)', () => {
    beforeEach(() => {
      mockAbstractionHelper.abstractRequest.getHttpMethodFromRequest.mockReturnValue('GET');
    });

    it('should return 405 for non-GET requests', async () => {
      mockAbstractionHelper.abstractRequest.getHttpMethodFromRequest.mockReturnValue('POST');

      await handleGetDatafile(
        mockRequest,
        mockAbstractionHelper,
        mockKvStore,
        mockLogger,
        mockDefaultSettings,
        mockParams,
      );

      expect(mockAbstractionHelper.createResponse).toHaveBeenCalledWith('Method Not Allowed', 405);
    });

    it('should return 404 when datafile is not found', async () => {
      mockKvStore.get.mockResolvedValue(null);

      await handleGetDatafile(
        mockRequest,
        mockAbstractionHelper,
        mockKvStore,
        mockLogger,
        mockDefaultSettings,
        mockParams,
      );

      expect(mockAbstractionHelper.createResponse).toHaveBeenCalledWith('Datafile not found', 404);
    });

    it('should return datafile when it exists', async () => {
      const mockDatafile = { version: '1.0.0' };
      mockKvStore.get.mockResolvedValue(JSON.stringify(mockDatafile));

      await handleGetDatafile(
        mockRequest,
        mockAbstractionHelper,
        mockKvStore,
        mockLogger,
        mockDefaultSettings,
        mockParams,
      );

      expect(mockKvStore.get).toHaveBeenCalledWith('test-key');
      expect(mockAbstractionHelper.createResponse).toHaveBeenCalledWith(
        JSON.stringify(mockDatafile),
        200,
        { 'Content-Type': 'application/json' },
      );
    });

    it('should handle KV store errors gracefully', async () => {
      mockKvStore.get.mockRejectedValue(new Error('KV store error'));

      await handleGetDatafile(
        mockRequest,
        mockAbstractionHelper,
        mockKvStore,
        mockLogger,
        mockDefaultSettings,
        mockParams,
      );

      expect(mockLogger.error).toHaveBeenCalled();
      expect(mockAbstractionHelper.createResponse).toHaveBeenCalledWith(
        'Error retrieving datafile',
        500,
      );
    });
  });
});
