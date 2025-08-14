import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigurationService } from '../../services/implementations/ConfigurationService';
import { MockLoggerAdapter } from '../test-utils/MockLoggerAdapter';
import { IRequestAdapter } from '../../adapters/interfaces/IRequestAdapter';

/**
 * Mock implementation of IRequestAdapter for testing
 */
class MockRequestAdapter implements IRequestAdapter {
  private headers: Headers = new Headers();
  private queryParams: URLSearchParams = new URLSearchParams();
  private body: Record<string, any> = {};
  private httpMethod: string = 'GET';
  private contentType: string = 'application/json';
  
  constructor() {
    this.headers.set('Content-Type', this.contentType);
  }

  getHeaders(): Headers {
    return this.headers;
  }

  getUrl(): URL {
    const url = new URL('https://example.com/test');
    url.search = this.queryParams.toString();
    return url;
  }

  getMethod(): string {
    return this.httpMethod;
  }

  getHeader(name: string): string | null {
    return this.headers.get(name);
  }

  async getBodyJson<T>(): Promise<T> {
    if (this.httpMethod === 'GET') {
      throw new Error('Cannot get body from GET request');
    }
    return this.body as T;
  }

  async getBodyText(): Promise<string> {
    return JSON.stringify(this.body);
  }

  async getBody(): Promise<any> {
    return this.body;
  }

  getNativeRequest<T = unknown>(): T {
    // Return a simple object for testing purposes
    return { headers: this.headers, method: this.httpMethod } as T;
  }

  // Test helpers to set up the mock
  setHeader(name: string, value: string): void {
    this.headers.set(name, value);
  }

  setQueryParam(name: string, value: string): void {
    this.queryParams.set(name, value);
  }

  addQueryParam(name: string, value: string): void {
    this.queryParams.append(name, value);
  }

  setBody(body: Record<string, any>): void {
    this.body = body;
    this.httpMethod = 'POST'; // Automatically set to POST when body is set
  }

  setMethod(method: string): void {
    this.httpMethod = method;
  }

  setContentType(contentType: string): void {
    this.contentType = contentType;
    this.headers.set('Content-Type', contentType);
  }
}

describe('ConfigurationService', () => {
  let configService: ConfigurationService;
  let logger: MockLoggerAdapter;
  let requestAdapter: MockRequestAdapter;
  let mockDatafileService: any;
  
  beforeEach(() => {
    logger = new MockLoggerAdapter();
    mockDatafileService = {
      async getDatafile() { return {}; },
      async clearDatafileCache() {},
      async updateDatafile() {}
    };
    configService = new ConfigurationService(mockDatafileService, logger);
    requestAdapter = new MockRequestAdapter();
  });
  
  describe('initialization', () => {
    it('should initialize with default settings', () => {
      const settings = configService.getSettings();
      expect(settings).toBeDefined();
      expect(settings.defaultTrimmedDecisions).toBe(true);
      expect(settings.prioritizeHeadersOverQueryParams).toBe(true);
    });
    
    it('should initialize metadata', () => {
      const metadata = configService.getMetadata();
      expect(metadata).toBeDefined();
      expect(metadata.visitorId).toBe('');
      expect(metadata.sdkKey).toBe('');
    });
  });
  
  describe('header processing', () => {
    it('should process X-Optimizely-* headers', async () => {
      requestAdapter.setHeader('X-Optimizely-SDK-Key', 'test-sdk-key');
      await configService.initialize(requestAdapter);
      
      const config = configService.getConfig();
      expect(config.sdkKey).toBe('test-sdk-key');
    });
    
    it('should process x-optly-* headers (legacy format)', async () => {
      requestAdapter.setHeader('x-optly-sdk-key', 'legacy-sdk-key');
      await configService.initialize(requestAdapter);
      
      const config = configService.getConfig();
      expect(config.sdkKey).toBe('legacy-sdk-key');
    });
    
    it('should convert header names to camelCase', async () => {
      requestAdapter.setHeader('X-Optimizely-Flag-Key', 'my-flag');
      await configService.initialize(requestAdapter);
      
      const config = configService.getConfig();
      expect(config.flagKey).toBe('my-flag');
    });
    
    it('should handle JSON values in headers', async () => {
      requestAdapter.setHeader('X-Optimizely-Attributes', JSON.stringify({ country: 'US', age: 25 }));
      await configService.initialize(requestAdapter);
      
      const config = configService.getConfig();
      expect(config.attributes).toEqual({ country: 'US', age: 25 });
    });
    
    it('should handle boolean headers', async () => {
      requestAdapter.setHeader('X-Optimizely-Trimmed-Decisions', 'true');
      requestAdapter.setHeader('X-Optimizely-Override-Cache', 'false');
      await configService.initialize(requestAdapter);
      
      const config = configService.getConfig();
      expect(config.trimmedDecisions).toBe(true);
      expect(config.overrideCache).toBe(false);
    });
    
    it('should parse decide options from headers', async () => {
      requestAdapter.setHeader('X-Optimizely-Decide-Options', JSON.stringify(['ENABLED_FLAGS_ONLY', 'INCLUDE_REASONS']));
      await configService.initialize(requestAdapter);
      
      const config = configService.getConfig();
      expect(config.decideOptions).toEqual(['ENABLED_FLAGS_ONLY', 'INCLUDE_REASONS']);
    });
    
    it('should handle comma-separated decide options if not valid JSON', async () => {
      requestAdapter.setHeader('X-Optimizely-Decide-Options', 'ENABLED_FLAGS_ONLY,INCLUDE_REASONS');
      await configService.initialize(requestAdapter);
      
      const config = configService.getConfig();
      expect(config.decideOptions).toContain('ENABLED_FLAGS_ONLY');
      expect(config.decideOptions).toContain('INCLUDE_REASONS');
    });
  });
  
  describe('query parameter processing', () => {
    it('should process basic query parameters', async () => {
      requestAdapter.setQueryParam('sdkKey', 'query-sdk-key');
      await configService.initialize(requestAdapter);
      
      const config = configService.getConfig();
      expect(config.sdkKey).toBe('query-sdk-key');
    });
    
    it('should handle multiple flag keys in query parameters', async () => {
      requestAdapter.addQueryParam('keys', 'flag1');
      requestAdapter.addQueryParam('keys', 'flag2');
      await configService.initialize(requestAdapter);
      
      const config = configService.getConfig();
      expect(config.flagKeys).toEqual(['flag1', 'flag2']);
    });
    
    it('should handle JSON values in query parameters', async () => {
      requestAdapter.setQueryParam('attributes', JSON.stringify({ country: 'UK', age: 30 }));
      await configService.initialize(requestAdapter);
      
      const config = configService.getConfig();
      expect(config.attributes).toEqual({ country: 'UK', age: 30 });
    });
    
    it('should handle boolean query parameters', async () => {
      requestAdapter.setQueryParam('trimmedDecisions', 'true');
      requestAdapter.setQueryParam('decideAll', 'false');
      await configService.initialize(requestAdapter);
      
      const config = configService.getConfig();
      expect(config.trimmedDecisions).toBe(true);
      expect(config.decideAll).toBe(false);
    });
  });
  
  describe('request body processing', () => {
    it('should process JSON body in POST requests', async () => {
      requestAdapter.setMethod('POST');
      requestAdapter.setBody({ 
        sdkKey: 'body-sdk-key',
        visitorId: 'test-visitor-id',
        eventKey: 'purchase'
      });
      
      await configService.initialize(requestAdapter);
      
      const config = configService.getConfig();
      expect(config.sdkKey).toBe('body-sdk-key');
      expect(config.visitorId).toBe('test-visitor-id');
      expect(config.eventKey).toBe('purchase');
    });
    
    it('should handle complex objects in body', async () => {
      requestAdapter.setMethod('POST');
      requestAdapter.setBody({ 
        attributes: { country: 'CA', premium: true },
        eventTags: { revenue: 125.50 }
      });
      
      await configService.initialize(requestAdapter);
      
      const config = configService.getConfig();
      expect(config.attributes).toEqual({ country: 'CA', premium: true });
      expect(config.eventTags).toEqual({ revenue: 125.50 });
    });
    
    it('should handle userId as an alias for visitorId', async () => {
      requestAdapter.setMethod('POST');
      requestAdapter.setBody({ userId: 'user-123' });
      
      await configService.initialize(requestAdapter);
      
      const config = configService.getConfig();
      expect(config.visitorId).toBe('user-123');
    });
    
    it('should convert flagKey to flagKeys array if flagKeys not provided', async () => {
      requestAdapter.setMethod('POST');
      requestAdapter.setBody({ flagKey: 'my-feature' });
      
      await configService.initialize(requestAdapter);
      
      const config = configService.getConfig();
      expect(config.flagKeys).toEqual(['my-feature']);
    });
    
    it('should not process body for GET requests', async () => {
      requestAdapter.setMethod('GET');
      
      // This would normally throw since we're not supposed to access the body
      // of a GET request, but our mock simply returns an empty object without throwing
      requestAdapter.setBody({ sdkKey: 'get-body-sdk-key' });
      
      await configService.initialize(requestAdapter);
      
      const config = configService.getConfig();
      expect(config.sdkKey).toBeUndefined();
    });
    
    it('should ignore body if content type is not application/json', async () => {
      requestAdapter.setMethod('POST');
      requestAdapter.setContentType('text/plain');
      requestAdapter.setBody({ sdkKey: 'wrong-content-type-sdk-key' });
      
      await configService.initialize(requestAdapter);
      
      const config = configService.getConfig();
      expect(config.sdkKey).toBeUndefined();
    });
  });
  
  describe('precedence rules', () => {
    it('should prioritize headers over query parameters over body', async () => {
      // Set up conflicting values in different sources
      requestAdapter.setHeader('X-Optimizely-SDK-Key', 'header-sdk-key');
      requestAdapter.setQueryParam('sdkKey', 'query-sdk-key');
      requestAdapter.setMethod('POST');
      requestAdapter.setBody({ sdkKey: 'body-sdk-key' });
      
      await configService.initialize(requestAdapter);
      
      const config = configService.getConfig();
      expect(config.sdkKey).toBe('header-sdk-key'); // Headers take precedence
    });
    
    it('should use query parameters if headers don\'t provide a value', async () => {
      // No header for sdkKey
      requestAdapter.setQueryParam('sdkKey', 'query-sdk-key');
      requestAdapter.setMethod('POST');
      requestAdapter.setBody({ sdkKey: 'body-sdk-key' });
      
      await configService.initialize(requestAdapter);
      
      const config = configService.getConfig();
      expect(config.sdkKey).toBe('query-sdk-key'); // Query params take precedence over body
    });
    
    it('should use body if headers and query parameters don\'t provide a value', async () => {
      // No header or query param for sdkKey
      requestAdapter.setMethod('POST');
      requestAdapter.setBody({ sdkKey: 'body-sdk-key' });
      
      await configService.initialize(requestAdapter);
      
      const config = configService.getConfig();
      expect(config.sdkKey).toBe('body-sdk-key'); // Body is used when other sources don't provide a value
    });
    
    it('should apply defaults if no source provides a value', async () => {
      await configService.initialize(requestAdapter);
      
      const config = configService.getConfig();
      expect(config.trimmedDecisions).toBe(true); // Default from settings
      expect(config.setResponseHeaders).toBe(true); // Default from settings
    });
  });
  
  describe('configuration updates', () => {
    it('should allow updating configuration programmatically', async () => {
      await configService.initialize(requestAdapter);
      
      configService.updateConfig({
        sdkKey: 'programmatic-sdk-key',
        visitorId: 'programmatic-visitor-id'
      });
      
      const config = configService.getConfig();
      expect(config.sdkKey).toBe('programmatic-sdk-key');
      expect(config.visitorId).toBe('programmatic-visitor-id');
    });
    
    it('should allow getting and setting specific values', async () => {
      await configService.initialize(requestAdapter);
      
      configService.setValue('flagKey', 'my-flag-key');
      
      expect(configService.getValue('flagKey')).toBe('my-flag-key');
    });
  });
  
  describe('decide options', () => {
    it('should compile decide options from configuration', async () => {
      requestAdapter.setHeader('X-Optimizely-Decide-Options', JSON.stringify(['DISABLE_DECISION_EVENT']));
      requestAdapter.setQueryParam('enabledFlagsOnly', 'true');
      requestAdapter.setMethod('POST');
      requestAdapter.setBody({ includeReasons: true });
      
      await configService.initialize(requestAdapter);
      
      const decideOptions = configService.getDecideOptions();
      expect(decideOptions).toContain('DISABLE_DECISION_EVENT'); // From header
      expect(decideOptions).toContain('ENABLED_FLAGS_ONLY'); // From query param
      expect(decideOptions).toContain('INCLUDE_REASONS'); // From body
    });
    
    it('should check if a specific decide option is enabled', async () => {
      requestAdapter.setQueryParam('enabledFlagsOnly', 'true');
      
      await configService.initialize(requestAdapter);
      
      expect(configService.hasDecideOption('ENABLED_FLAGS_ONLY')).toBe(true);
      expect(configService.hasDecideOption('EXCLUDE_VARIABLES')).toBe(false);
    });
  });
  
  describe('metadata tracking', () => {
    it('should track metadata about configuration sources', async () => {
      requestAdapter.setHeader('X-Optimizely-SDK-Key', 'header-sdk-key');
      requestAdapter.setQueryParam('visitorId', 'query-visitor-id');
      requestAdapter.setMethod('POST');
      requestAdapter.setBody({ attributes: { country: 'US' } });
      
      await configService.initialize(requestAdapter);
      
      const metadata = configService.getMetadata();
      expect(metadata.sdkKeyFrom).toBe('header');
      expect(metadata.visitorIdFrom).toBe('queryParams');
      expect(metadata.attributesFrom).toBe('body');
    });
  });
  
  describe('configuration validation', () => {
    it('should validate configuration and detect issues', async () => {
      // Set up invalid configuration
      requestAdapter.setHeader('X-Optimizely-Flag-Key', 123 as any); // Wrong type
      requestAdapter.setQueryParam('sdkKey', ''); // Empty required field
      
      await configService.initialize(requestAdapter);
      
      const validationResult = configService.validate();
      
      expect(validationResult.valid).toBe(false);
      expect(validationResult.hasErrors).toBe(true);
      expect(validationResult.issues.length).toBeGreaterThan(0);
      
      // Check for type error with flagKey
      const flagKeyIssue = validationResult.issues.find(
        issue => issue.field === 'flagKey' && issue.type === 'INVALID_TYPE'
      );
      expect(flagKeyIssue).toBeDefined();
      
      // Check for required field error with sdkKey
      const sdkKeyIssue = validationResult.issues.find(
        issue => issue.field === 'sdkKey' && issue.type === 'REQUIRED_FIELD_MISSING'
      );
      expect(sdkKeyIssue).toBeDefined();
    });
    
    it('should validate specific configuration values', () => {
      // Initialize first to ensure validation rules are set up
      configService.initialize(requestAdapter);
      
      // Test validateValue for different types of values
      const stringIssue = configService.validateValue('sdkKey', 123);
      expect(stringIssue).toBeDefined();
      expect(stringIssue?.type).toBe('INVALID_TYPE');
      
      const arrayIssue = configService.validateValue('flagKeys', 'not-an-array');
      expect(arrayIssue).toBeDefined();
      expect(arrayIssue?.type).toBe('INVALID_TYPE');
      
      const objectIssue = configService.validateValue('attributes', 'not-an-object');
      expect(objectIssue).toBeDefined();
      expect(objectIssue?.type).toBe('INVALID_TYPE');
      
      // Test valid values
      const validStringResult = configService.validateValue('sdkKey', 'valid-sdk-key');
      expect(validStringResult).toBeNull();
      
      const validArrayResult = configService.validateValue('flagKeys', ['flag1', 'flag2']);
      expect(validArrayResult).toBeNull();
      
      const validObjectResult = configService.validateValue('attributes', { country: 'US' });
      expect(validObjectResult).toBeNull();
    });
    
    it('should identify unknown configuration options', async () => {
      // Set some unknown option
      requestAdapter.setMethod('POST');
      requestAdapter.setBody({ 
        unknownOption1: 'value1',
        unknownOption2: 'value2'
      });
      
      await configService.initialize(requestAdapter);
      
      const validationResult = configService.validate();
      
      // Find unknown option issues
      const unknownOptions = validationResult.issues.filter(
        issue => issue.type === 'UNKNOWN_OPTION'
      );
      
      expect(unknownOptions.length).toBe(2);
      expect(unknownOptions[0].severity).toBe('WARNING'); // Unknown options are warnings, not errors
      
      // Validate directly
      const unknownIssue = configService.validateValue('notARealOption' as any, 'some-value');
      expect(unknownIssue).toBeDefined();
      expect(unknownIssue?.type).toBe('UNKNOWN_OPTION');
    });
    
    it('should validate decide options correctly', async () => {
      // Set invalid decide options
      requestAdapter.setHeader('X-Optimizely-Decide-Options', JSON.stringify([
        'ENABLED_FLAGS_ONLY', // Valid
        'INVALID_OPTION', // Invalid
        'ANOTHER_INVALID' // Invalid
      ]));
      
      await configService.initialize(requestAdapter);
      
      const validationResult = configService.validate();
      
      // Find decide options issue
      const decideOptionsIssue = validationResult.issues.find(
        issue => issue.field === 'decideOptions'
      );
      
      expect(decideOptionsIssue).toBeDefined();
      expect(decideOptionsIssue?.type).toBe('INVALID_VALUE');
      expect(decideOptionsIssue?.context?.invalidOptions).toContain('INVALID_OPTION');
      expect(decideOptionsIssue?.context?.invalidOptions).toContain('ANOTHER_INVALID');
      expect(decideOptionsIssue?.severity).toBe('WARNING'); // Invalid decide options are warnings
    });
    
    it('should identify incompatible options', async () => {
      // Set both flagKey and flagKeys
      requestAdapter.setHeader('X-Optimizely-Flag-Key', 'single-flag');
      requestAdapter.addQueryParam('keys', 'flag1');
      requestAdapter.addQueryParam('keys', 'flag2');
      
      await configService.initialize(requestAdapter);
      
      const validationResult = configService.validate();
      
      // Find incompatible options issue
      const incompatibleIssue = validationResult.issues.find(
        issue => issue.type === 'INCOMPATIBLE_OPTIONS'
      );
      
      expect(incompatibleIssue).toBeDefined();
      expect(incompatibleIssue?.field).toBe('flagKey');
      expect(incompatibleIssue?.context?.flagKeys).toEqual(['flag1', 'flag2']);
    });
    
    it('should auto-fix validation issues', async () => {
      // Set up configuration with fixable issues
      requestAdapter.setHeader('X-Optimizely-Flag-Key', 123 as any); // Wrong type, will be removed
      requestAdapter.setQueryParam('serverMode', 'invalid'); // Invalid value, will be fixed to a valid one
      requestAdapter.setBody({ 
        unknownOption: 'value', // Unknown option, will be removed
      });
      
      await configService.initialize(requestAdapter);
      
      // Get validation issues
      const validationResult = configService.validate();
      expect(validationResult.issues.length).toBeGreaterThan(0);
      
      // Fix issues
      const fixedCount = configService.fixValidationIssues(validationResult.issues);
      expect(fixedCount).toBeGreaterThan(0);
      
      // Validate again - should have fewer issues now
      const updatedResult = configService.validate();
      expect(updatedResult.issues.length).toBeLessThan(validationResult.issues.length);
    });
    
    it('should include validation results in metadata when enabled', async () => {
      // Set invalid configuration with metadata enabled
      requestAdapter.setHeader('X-Optimizely-Enable-Response-Metadata', 'true');
      requestAdapter.setHeader('X-Optimizely-Flag-Key', 123 as any); // Invalid type
      
      await configService.initialize(requestAdapter);
      
      const metadata = configService.getMetadata();
      expect(metadata.validationResult).toBeDefined();
      expect(metadata.validationResult?.issues.length).toBeGreaterThan(0);
    });
  });
}); 