import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleFlagKeys, handleGetFlagKeys } from './flagKeys';
import { AbstractRequest } from '../../_helpers_/abstraction-classes/abstractRequest';

describe('flagKeys handlers', () => {
  let mockRequest;
  let mockAbstractionHelper;
  let mockKvStore;
  let mockLogger;
  let mockDefaultSettings;

  beforeEach(() => {
    mockRequest = new Request('https://example.com/v1/api/flag_keys');
    mockAbstractionHelper = {
      abstractRequest: {
        getHttpMethodFromRequest: vi.fn(),
      },
      createResponse: vi.fn((body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers })),
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
    mockDefaultSettings = {
      kv_key_optly_flagKeys: 'optly_flagKeys',
    };

    // Mock the static method
    vi.spyOn(AbstractRequest, 'readRequestBody').mockImplementation(() => Promise.resolve({}));
  });

  describe('handleFlagKeys (POST)', () => {
    beforeEach(() => {
      mockAbstractionHelper.abstractRequest.getHttpMethodFromRequest.mockReturnValue('POST');
    });

    it('should return 405 for non-POST requests', async () => {
      mockAbstractionHelper.abstractRequest.getHttpMethodFromRequest.mockReturnValue('GET');

      const response = await handleFlagKeys(
        mockRequest,
        mockAbstractionHelper,
        mockKvStore,
        mockLogger,
        mockDefaultSettings,
      );

      expect(mockAbstractionHelper.createResponse).toHaveBeenCalledWith('Method Not Allowed', 405);
    });

    it('should return 400 for invalid flag keys array', async () => {
      AbstractRequest.readRequestBody.mockResolvedValue({ flagKeys: [] });

      const response = await handleFlagKeys(
        mockRequest,
        mockAbstractionHelper,
        mockKvStore,
        mockLogger,
        mockDefaultSettings,
      );

      expect(mockAbstractionHelper.createResponse).toHaveBeenCalledWith('Expected an array of Flag Keys', 400);
    });

    it('should handle valid flag keys successfully', async () => {
      const mockFlagKeys = ['flag1', 'flag2', 'flag3'];
      AbstractRequest.readRequestBody.mockResolvedValue({ flagKeys: mockFlagKeys });

      await handleFlagKeys(
        mockRequest,
        mockAbstractionHelper,
        mockKvStore,
        mockLogger,
        mockDefaultSettings,
      );

      expect(mockKvStore.put).toHaveBeenCalledWith('optly_flagKeys', 'flag1,flag2,flag3');
      expect(mockAbstractionHelper.createResponse).toHaveBeenCalledWith(
        {
          message: 'Flag keys were updated successfully in the KV store.',
          flagKeys: mockFlagKeys,
        },
        200,
        { 'Content-Type': 'application/json' },
      );
    });

    it('should trim flag keys before storing', async () => {
      const mockFlagKeys = [' flag1 ', '  flag2', 'flag3  '];
      AbstractRequest.readRequestBody.mockResolvedValue({ flagKeys: mockFlagKeys });

      await handleFlagKeys(
        mockRequest,
        mockAbstractionHelper,
        mockKvStore,
        mockLogger,
        mockDefaultSettings,
      );

      expect(mockKvStore.put).toHaveBeenCalledWith('optly_flagKeys', 'flag1,flag2,flag3');
    });

    it('should handle errors gracefully', async () => {
      const errorMessage = 'Test error';
      mockKvStore.put.mockRejectedValue(new Error(errorMessage));
      AbstractRequest.readRequestBody.mockResolvedValue({ flagKeys: ['flag1'] });

      await handleFlagKeys(
        mockRequest,
        mockAbstractionHelper,
        mockKvStore,
        mockLogger,
        mockDefaultSettings,
      );

      expect(mockLogger.error).toHaveBeenCalled();
      expect(mockAbstractionHelper.createResponse).toHaveBeenCalledWith(
        `Error: ${errorMessage}`,
        500,
      );
    });
  });

  describe('handleGetFlagKeys (GET)', () => {
    beforeEach(() => {
      mockAbstractionHelper.abstractRequest.getHttpMethodFromRequest.mockReturnValue('GET');
    });

    it('should return 405 for non-GET requests', async () => {
      mockAbstractionHelper.abstractRequest.getHttpMethodFromRequest.mockReturnValue('POST');

      await handleGetFlagKeys(
        mockRequest,
        mockAbstractionHelper,
        mockKvStore,
        mockLogger,
        mockDefaultSettings,
      );

      expect(mockAbstractionHelper.createResponse).toHaveBeenCalledWith('Method Not Allowed', 405);
    });

    it('should return 404 when no flag keys are found', async () => {
      mockKvStore.get.mockResolvedValue(null);

      await handleGetFlagKeys(
        mockRequest,
        mockAbstractionHelper,
        mockKvStore,
        mockLogger,
        mockDefaultSettings,
      );

      expect(mockAbstractionHelper.createResponse).toHaveBeenCalledWith('No flag keys found', 404);
    });

    it('should return flag keys when they exist', async () => {
      const storedFlagKeys = 'flag1,flag2,flag3';
      mockKvStore.get.mockResolvedValue(storedFlagKeys);

      await handleGetFlagKeys(
        mockRequest,
        mockAbstractionHelper,
        mockKvStore,
        mockLogger,
        mockDefaultSettings,
      );

      expect(mockAbstractionHelper.createResponse).toHaveBeenCalledWith(
        ['flag1', 'flag2', 'flag3'],
        200,
        { 'Content-Type': 'application/json' },
      );
    });

    it('should trim flag keys and filter empty strings', async () => {
      const storedFlagKeys = ' flag1 , flag2,  ,flag3  ';
      mockKvStore.get.mockResolvedValue(storedFlagKeys);

      await handleGetFlagKeys(
        mockRequest,
        mockAbstractionHelper,
        mockKvStore,
        mockLogger,
        mockDefaultSettings,
      );

      expect(mockAbstractionHelper.createResponse).toHaveBeenCalledWith(
        ['flag1', 'flag2', 'flag3'],
        200,
        { 'Content-Type': 'application/json' },
      );
    });

    it('should handle errors gracefully', async () => {
      const errorMessage = 'Test error';
      mockKvStore.get.mockRejectedValue(new Error(errorMessage));

      await handleGetFlagKeys(
        mockRequest,
        mockAbstractionHelper,
        mockKvStore,
        mockLogger,
        mockDefaultSettings,
      );

      expect(mockLogger.error).toHaveBeenCalled();
      expect(mockAbstractionHelper.createResponse).toHaveBeenCalledWith(
        `Error: ${errorMessage}`,
        500,
      );
    });
  });
});
