import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConfigService } from '../../../services/implementations/ConfigService';
import { ILoggerAdapter } from '../../../adapters/interfaces/ILoggerAdapter';
import { IDatafileService } from '../../../services/interfaces/IDatafileService';

// Mock implementations
const createMockLogger = (): ILoggerAdapter => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  setLogLevel: vi.fn()
});

const createMockDatafileService = () => ({
  getDatafile: vi.fn(),
  setDatafile: vi.fn(),
  saveDatafile: vi.fn(),
  refreshDatafile: vi.fn(),
  fetchDatafileFromCDN: vi.fn(),
  purgeDatafile: vi.fn(),
  getFlagKeys: vi.fn(),
  setFlagKeys: vi.fn(),
  saveFlagKeys: vi.fn(),
  purgeFlagKeys: vi.fn(),
  extractFlagKeys: vi.fn()
}) as unknown as IDatafileService;

describe('ConfigService', () => {
  let configService: ConfigService;
  let datafileService: IDatafileService;
  let logger: ILoggerAdapter;
  let mockDatafile: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create test dependencies
    logger = createMockLogger();
    datafileService = createMockDatafileService();

    // Setup mock datafile
    mockDatafile = {
      revision: '123',
      version: '4',
      sdkKey: 'test-key',
      featureFlags: [{ id: '1', key: 'test-flag', rolloutId: '', experimentIds: [], variables: [] }]
    };

    // Create the service under test
    configService = new ConfigService(datafileService, logger);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getDatafile method', () => {
    it('should fetch a datafile from storage', async () => {
      // Test data
      const sdkKey = 'test-key';

      // Setup datafileService to return the mock datafile
      (datafileService.getDatafile as any).mockResolvedValue(JSON.stringify(mockDatafile));

      // Execute
      const datafile = await configService.getDatafile(sdkKey);

      // Verify
      expect(datafileService.getDatafile).toHaveBeenCalledWith(sdkKey);
      expect(datafile).toEqual(mockDatafile);
      expect(logger.info).toHaveBeenCalled();
    });

    it('should return null and log warning if datafile is not found', async () => {
      // Test data
      const sdkKey = 'test-key';

      // Setup datafileService to return null (no datafile found)
      (datafileService.getDatafile as any).mockResolvedValue(null);
      (datafileService.refreshDatafile as any).mockResolvedValue(null);

      // Execute
      const datafile = await configService.getDatafile(sdkKey);

      // Verify
      expect(datafileService.getDatafile).toHaveBeenCalled();
      expect(datafile).toBeNull();
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should handle storage errors gracefully', async () => {
      // Test data
      const sdkKey = 'test-key';
      const storageError = new Error('Storage error');

      // Setup datafileService to throw an error
      (datafileService.getDatafile as any).mockRejectedValue(storageError);

      // Execute
      const datafile = await configService.getDatafile(sdkKey);

      // Verify
      expect(datafileService.getDatafile).toHaveBeenCalled();
      expect(datafile).toBeNull();
      expect(logger.error).toHaveBeenCalled();
    });

    it('should return null if sdkKey is not provided', async () => {
      // Execute
      const datafile = await configService.getDatafile(undefined);

      // Verify
      expect(datafileService.getDatafile).not.toHaveBeenCalled();
      expect(datafile).toBeNull();
      expect(logger.error).toHaveBeenCalled();
    });

    it('should extract revision for logging when available', async () => {
      // Test data
      const sdkKey = 'test-key';
      const mockDatafileWithRevision = {
        ...mockDatafile,
        revision: '456'
      };

      // Setup datafileService to return datafile with revision
      (datafileService.getDatafile as any).mockResolvedValue(JSON.stringify(mockDatafileWithRevision));

      // Execute
      const datafile = await configService.getDatafile(sdkKey);

      // Verify
      expect(datafile).toEqual(mockDatafileWithRevision);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('456')
      );
    });

    it('should handle malformed datafile structure gracefully', async () => {
      // Test data
      const sdkKey = 'test-key';
      const malformedDatafile = "not a real datafile object";

      // Setup datafileService to return malformed data
      (datafileService.getDatafile as any).mockResolvedValue(malformedDatafile);

      // Execute
      const datafile = await configService.getDatafile(sdkKey);

      // Verify datafile is still returned but logging handles structure issue
      expect(datafile).toEqual(malformedDatafile);
      expect(logger.info).toHaveBeenCalled();
    });
  });
}); 