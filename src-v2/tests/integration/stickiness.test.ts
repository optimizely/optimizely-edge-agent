import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { RequestHandler } from '../../services/implementations/RequestHandler';
import { DecisionService } from '../../services/implementations/DecisionService';
import { CookieService } from '../../services/implementations/CookieService';
import { ConfigService } from '../../services/implementations/ConfigService';
import { CacheService } from '../../services/implementations/CacheService';
import { ConfigurationService } from '../../services/implementations/ConfigurationService';
import { EventDispatcher } from '../../services/implementations/EventDispatcher';
import { ILoggerAdapter } from '../../adapters/interfaces/ILoggerAdapter';
import { IStorageAdapter, StoragePutOptions } from '../../adapters/interfaces/IStorageAdapter';
import { IEnvironmentAdapter } from '../../adapters/interfaces/IEnvironmentAdapter';
import { IRequestAdapter } from '../../adapters/interfaces/IRequestAdapter';
import { KVUserProfileService } from '../../services/storage/KVUserProfileService';
import { OptimizelyUserProfileServiceAdapter } from '../../services/storage/OptimizelyUserProfileServiceAdapter';
import { IMetricsAdapter } from '../../adapters/interfaces/IMetricsAdapter';
import { MockLoggerAdapter } from '../test-utils/MockLoggerAdapter';

/**
 * Integration tests for cookie-based sticky bucketing.
 * These tests verify that the Optimizely Edge Agent correctly maintains
 * consistent user experiences across requests by using cookies.
 */
describe('Cookie-Based Sticky Bucketing Integration Tests', () => {
  const TEST_DATAFILE = {
    revision: '1',
    version: '4',
    anonymizeIP: true,
    projectId: 'test-project',
    variables: [],
    featureFlags: [{
      id: '123',
      key: 'test-flag',
      rolloutId: '',
      experimentIds: [],
      variables: []
    }],
    experiments: [],
    audiences: [],
    events: [],
    attributes: [],
    groups: [],
    botFiltering: false
  };

  // Create a minimal environment with the required components
  const testEnv = {
    logger: new MockLoggerAdapter() as ILoggerAdapter,
    
    // Implement a simple in-memory storage adapter
    storageImpl: new Map<string, any>(),
    storage: {
      async get(key: string, type?: string) {
        const val = testEnv.storageImpl.get(key);
        if (!val) return null;
        if (type === 'json' && typeof val === 'string') {
          try { return JSON.parse(val); } 
          catch { return val; }
        }
        return val;
      },
      async put(key: string, value: any, options?: StoragePutOptions) {
        testEnv.storageImpl.set(key, value);
      },
      async delete(key: string) {
        testEnv.storageImpl.delete(key);
      }
    } as IStorageAdapter,

    environment: {
      getVariable: () => null,
      waitUntil: () => {},
      getCrypto: () => ({
        getRandomValues: (arr: Uint8Array) => {
          for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
          return arr;
        },
        randomUUID: () => 'test-' + Math.random().toString(36).substring(2, 9)
      })
    } as unknown as IEnvironmentAdapter,
    
    metrics: {
      increment: () => {},
      gauge: () => {},
      histogram: () => {},
      startTimer: () => ({ end: () => {} })
    } as unknown as IMetricsAdapter,
    
    clearStorage() {
      testEnv.storageImpl.clear();
    }
  };

  let requestHandler: RequestHandler;
  let cookieService: CookieService;
  let datafileResponse: typeof TEST_DATAFILE | null;
  let configService: ConfigService;
  
  class TestRequestAdapter implements IRequestAdapter {
    constructor(
      private method: string,
      private urlStr: string,
      private headers: Record<string, string> = {},
      private requestBody: any = null
    ) {}
    
    getMethod(): string {
      return this.method;
    }
    
    getUrl(): URL {
      return new URL(this.urlStr);
    }
    
    getHeader(name: string): string | null {
      return this.headers[name.toLowerCase()] || null;
    }
    
    getHeaders(): Headers {
      const headers = new Headers();
      Object.entries(this.headers).forEach(([k, v]) => headers.append(k, v));
      return headers;
    }
    
    async getBodyJson<T>(): Promise<T> {
      return (this.requestBody || {}) as T;
    }
    
    async getBodyText(): Promise<string> {
      return typeof this.requestBody === 'string' 
        ? this.requestBody 
        : this.requestBody ? JSON.stringify(this.requestBody) : '';
    }
    
    async getBody(): Promise<any> {
      return this.requestBody;
    }
    
    getNativeRequest<T = unknown>(): T {
      return this as unknown as T;
    }
  }

  beforeEach(() => {
    // Initialize services with minimal real implementations
    datafileResponse = TEST_DATAFILE;
    
    const mockDatafileService = {
      async getDatafile() { return datafileResponse; },
      async clearDatafileCache() {},
      async updateDatafile() {}
    };
    
    configService = new ConfigService(mockDatafileService as any, testEnv.logger);
    cookieService = new CookieService(testEnv.logger);
    
    const cacheService = new CacheService(testEnv.storage, testEnv.logger);
    const configurationService = new ConfigurationService(mockDatafileService as any, testEnv.logger);
    const eventService = new EventDispatcher(testEnv.logger, testEnv.environment);
    const flagStorageService = {
      getFlags: async () => ({}),
      storeFlags: async () => {},
      deleteFlags: async () => {}
    };
    
    // Create the decision service
    const decisionService = new DecisionService(
      configService,
      testEnv.logger,
      'test-sdk-key'
    );
    
    // Create the request handler
    requestHandler = new RequestHandler(
      decisionService,
      eventService,
      testEnv.logger,
      cacheService,
      undefined, // edgeModeIntegration
      testEnv.metrics,
      cookieService,
      flagStorageService as any,
      configurationService
    );
  });

  afterEach(() => {
    // Reset state between tests
    datafileResponse = null;
    testEnv.clearStorage();
  });

  it('should maintain consistent variation decisions with cookie-based sticky bucketing', async () => {
    // First request without any cookies
    const firstRequest = new TestRequestAdapter(
      'GET',
      'https://example.com/decide?flagKey=test-flag&userId=test-visitor'
    );
    
    const firstResponse = await requestHandler.handleRequest(firstRequest);
    
    // Verify first response
    expect(firstResponse.status).toBe(200);
    
    // Extract the variation and cookies from the first response
    const firstResponseBody = JSON.parse(firstResponse.body as string);
    const firstVariation = firstResponseBody.variationKey;
    
    // Check that we got a cookie back
    const setCookieHeader = firstResponse.headers['Set-Cookie'];
    expect(setCookieHeader).toBeDefined();
    
    // Extract cookie value for second request
    const cookieStr = Array.isArray(setCookieHeader) ? setCookieHeader.join('; ') : String(setCookieHeader);
    
    // Make second request with the cookie
    const secondRequest = new TestRequestAdapter(
      'GET',
      'https://example.com/decide?flagKey=test-flag&userId=test-visitor',
      { 'cookie': cookieStr }
    );
    
    const secondResponse = await requestHandler.handleRequest(secondRequest);
    
    // Verify second response
    expect(secondResponse.status).toBe(200);
    const secondResponseBody = JSON.parse(secondResponse.body as string);
    
    // The key assertion: variation is consistent across requests
    expect(secondResponseBody.variationKey).toBe(firstVariation);
  });

  it('should handle multiple requests with and without existing cookies', async () => {
    // First user - has no cookie
    const userOneFirstRequest = new TestRequestAdapter(
      'GET',
      'https://example.com/decide?flagKey=test-flag&userId=visitor-one'
    );
    
    const userOneFirstResponse = await requestHandler.handleRequest(userOneFirstRequest);
    const userOneFirstBody = JSON.parse(userOneFirstResponse.body as string);
    const userOneFirstCookie = userOneFirstResponse.headers['Set-Cookie'];
    expect(userOneFirstCookie).toBeDefined();
    
    // Second user - also no cookie initially
    const userTwoFirstRequest = new TestRequestAdapter(
      'GET',
      'https://example.com/decide?flagKey=test-flag&userId=visitor-two'
    );
    
    const userTwoFirstResponse = await requestHandler.handleRequest(userTwoFirstRequest);
    const userTwoFirstBody = JSON.parse(userTwoFirstResponse.body as string);
    const userTwoFirstCookie = userTwoFirstResponse.headers['Set-Cookie'];
    expect(userTwoFirstCookie).toBeDefined();
    
    // User One comes back with their cookie
    const userOneSecondRequest = new TestRequestAdapter(
      'GET',
      'https://example.com/decide?flagKey=test-flag&userId=visitor-one',
      { 'cookie': Array.isArray(userOneFirstCookie) ? userOneFirstCookie.join('; ') : String(userOneFirstCookie) }
    );
    
    const userOneSecondResponse = await requestHandler.handleRequest(userOneSecondRequest);
    const userOneSecondBody = JSON.parse(userOneSecondResponse.body as string);
    
    // User Two comes back with their cookie
    const userTwoSecondRequest = new TestRequestAdapter(
      'GET',
      'https://example.com/decide?flagKey=test-flag&userId=visitor-two',
      { 'cookie': Array.isArray(userTwoFirstCookie) ? userTwoFirstCookie.join('; ') : String(userTwoFirstCookie) }
    );
    
    const userTwoSecondResponse = await requestHandler.handleRequest(userTwoSecondRequest);
    const userTwoSecondBody = JSON.parse(userTwoSecondResponse.body as string);
    
    // Verify each user gets their consistent variation
    expect(userOneSecondBody.variationKey).toBe(userOneFirstBody.variationKey);
    expect(userTwoSecondBody.variationKey).toBe(userTwoFirstBody.variationKey);
    
    // Bonus: verify the users get (potentially) different variations from each other
    // Note: This is a non-deterministic check as they could randomly get the same variation
    // So we'll just log it rather than assert it
    console.log('User variations are different:', userOneFirstBody.variationKey !== userTwoFirstBody.variationKey);
  });

  it('should work with the UserProfileService for sticky bucketing', async () => {
    // Create real UserProfileService implementation
    const kvUserProfileService = new KVUserProfileService(
      testEnv.storage,
      testEnv.logger,
      {
        sdkKey: 'test-sdk-key',
        keyPrefix: 'optly-ups-test',
        maxCacheSize: 10
      }
    );
    
    // Create adapter
    const userProfileServiceAdapter = new OptimizelyUserProfileServiceAdapter(
      kvUserProfileService,
      testEnv.logger
    );
    
    // Create decision service with user profile service
    const decisionServiceWithUPS = new DecisionService(
      configService,
      testEnv.logger,
      'test-sdk-key',
      userProfileServiceAdapter
    );
    
    // Create request handler with UPS-enabled decision service
    const requestHandlerWithUPS = new RequestHandler(
      decisionServiceWithUPS,
      new EventDispatcher(testEnv.logger, testEnv.environment),
      testEnv.logger,
      new CacheService(testEnv.storage, testEnv.logger),
      undefined,
      testEnv.metrics,
      cookieService,
      {
        getFlags: async () => ({}),
        storeFlags: async () => {},
        deleteFlags: async () => {}
      } as any,
      new ConfigurationService(mockDatafileService as any, testEnv.logger)
    );
    
    // First request establishes the user profile
    const firstRequest = new TestRequestAdapter(
      'GET',
      'https://example.com/decide?flagKey=test-flag&userId=profile-user'
    );
    
    const firstResponse = await requestHandlerWithUPS.handleRequest(firstRequest);
    const firstResponseBody = JSON.parse(firstResponse.body as string);
    
    // Second request should get the same variation, even without cookies
    const secondRequest = new TestRequestAdapter(
      'GET',
      'https://example.com/decide?flagKey=test-flag&userId=profile-user'
    );
    
    const secondResponse = await requestHandlerWithUPS.handleRequest(secondRequest);
    const secondResponseBody = JSON.parse(secondResponse.body as string);
    
    // Verify same variation is returned
    expect(secondResponseBody.variationKey).toBe(firstResponseBody.variationKey);
  });
}); 