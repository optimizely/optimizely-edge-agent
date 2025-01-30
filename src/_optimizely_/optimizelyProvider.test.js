import { describe, it, expect, vi, beforeEach } from 'vitest';
import OptimizelyProvider from './optimizelyProvider';
import * as optlyHelper from '../_helpers_/optimizelyHelper';
import defaultSettings from '../_config_/defaultSettings';

describe('OptimizelyProvider', () => {
  let provider;
  let mockRequest;
  let mockEnv;
  let mockCtx;
  let mockRequestConfig;
  let mockAbstractionHelper;
  let mockKvStoreUserProfile;
  let mockOptlyDecideOptions;

  beforeEach(() => {
    vi.mock('@optimizely/optimizely-sdk/dist/optimizely.lite.min.js', () => ({
      createInstance: vi.fn(),
      enums: {
        DECISION_NOTIFICATION_TYPES: {
          FLAG: 'flag'
        }
      },
      OptimizelyDecideOption: {
        DISABLE_DECISION_EVENT: 'DISABLE_DECISION_EVENT',
        ENABLED_FLAGS_ONLY: 'ENABLED_FLAGS_ONLY',
        INCLUDE_REASONS: 'INCLUDE_REASONS',
        EXCLUDE_VARIABLES: 'EXCLUDE_VARIABLES'
      }
    }));

    mockOptlyDecideOptions = {
      DISABLE_DECISION_EVENT: 'DISABLE_DECISION_EVENT',
      ENABLED_FLAGS_ONLY: 'ENABLED_FLAGS_ONLY',
      INCLUDE_REASONS: 'INCLUDE_REASONS',
      EXCLUDE_VARIABLES: 'EXCLUDE_VARIABLES'
    };

    mockRequest = {
      headers: new Map([['user-agent', 'test-agent']])
    };
    mockEnv = {};
    mockCtx = {};
    mockRequestConfig = {};
    mockAbstractionHelper = {
      abstractRequest: {
        method: 'GET'
      },
      abstractContext: {}
    };
    mockKvStoreUserProfile = {
      get: vi.fn(),
      put: vi.fn()
    };

    vi.spyOn(optlyHelper, 'logger').mockReturnValue({
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      debugExt: vi.fn()
    });

    provider = new OptimizelyProvider(
      mockRequest,
      mockEnv,
      mockCtx,
      mockRequestConfig,
      mockAbstractionHelper,
      mockKvStoreUserProfile
    );
  });

  describe('constructor', () => {
    it('should initialize with correct properties', () => {
      expect(provider.visitorId).toBeUndefined();
      expect(provider.optimizelyClient).toBeUndefined();
      expect(provider.cdnAdapter).toBeUndefined();
      expect(provider.request).toBe(mockRequest);
      expect(provider.httpMethod).toBe('GET');
      expect(provider.kvStoreUserProfileEnabled).toBe(true);
    });
  });

  describe('setCdnAdapter and getCdnAdapter', () => {
    it('should set and get CDN adapter', () => {
      const mockAdapter = { fetch: vi.fn() };
      provider.setCdnAdapter(mockAdapter);
      expect(provider.getCdnAdapter()).toBe(mockAdapter);
    });

    it('should throw error when setting invalid adapter', () => {
      expect(() => provider.setCdnAdapter(null)).toThrow('CDN adapter must be an object.');
      expect(() => provider.setCdnAdapter('invalid')).toThrow('CDN adapter must be an object.');
    });

    it('should throw error when getting adapter before setting', () => {
      expect(() => provider.getCdnAdapter()).toThrow('CDN adapter has not been set.');
    });
  });

  describe('validateParameters', () => {
    it('should validate parameters without throwing for valid inputs', () => {
      expect(() => {
        provider.validateParameters(
          { attr: 'value' },
          { tag: 'value' },
          ['option1'],
          'user-agent',
          'token'
        );
      }).not.toThrow();
    });

    it('should throw for invalid attributes', () => {
      expect(() => {
        provider.validateParameters(
          'invalid',
          { tag: 'value' },
          ['option1'],
          'user-agent',
          'token'
        );
      }).toThrow('Attributes must be a valid object.');
    });

    it('should throw for invalid eventTags', () => {
      expect(() => {
        provider.validateParameters(
          { attr: 'value' },
          'invalid',
          ['option1'],
          'user-agent',
          'token'
        );
      }).toThrow('Event tags must be a valid object.');
    });

    it('should throw for invalid defaultDecideOptions', () => {
      expect(() => {
        provider.validateParameters(
          { attr: 'value' },
          { tag: 'value' },
          'invalid',
          'user-agent',
          'token'
        );
      }).toThrow('Default decide options must be an array.');
    });
  });

  describe('getAttributes', () => {
    it('should merge provided attributes with user agent', async () => {
      const customAttrs = { custom: 'value' };
      const userAgent = 'test-agent';
      const result = await provider.getAttributes(customAttrs, userAgent);
      
      expect(result).toEqual({
        custom: 'value',
        $opt_user_agent: userAgent
      });
    });

    it('should handle undefined attributes', async () => {
      const userAgent = 'test-agent';
      const result = await provider.getAttributes(undefined, userAgent);
      
      expect(result).toEqual({
        $opt_user_agent: userAgent
      });
    });
  });

  describe('buildDecideOptions', () => {
    it('should return empty array when no options provided', () => {
      const result = provider.buildDecideOptions([]);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual([]);
    });

    it('should map decide options to their corresponding values', () => {
      const options = ['DISABLE_DECISION_EVENT', 'ENABLED_FLAGS_ONLY'];
      const result = provider.buildDecideOptions(options);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual([
        'DISABLE_DECISION_EVENT',
        'ENABLED_FLAGS_ONLY'
      ]);
    });

    it('should handle undefined input', () => {
      const result = provider.buildDecideOptions();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual([]);
    });
  });
});
