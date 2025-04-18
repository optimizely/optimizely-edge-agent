// @ts-nocheck
// This file contains tests for the ContentFetcher service
// The ts-nocheck directive is used to suppress TypeScript errors in this test file


import { ContentFetcher } from '../../services/implementations/ContentFetcher';
import { ILoggerAdapter } from '../../adapters/interfaces/ILoggerAdapter';
import { IRequestAdapter } from '../../adapters/interfaces/IRequestAdapter';
import { IResponseAdapter } from '../../adapters/interfaces/IResponseAdapter';
import { ICacheService } from '../../services/interfaces/ICacheService';
import { ContentFetchOptions } from '../../services/interfaces/IContentFetcher';

// Add Jest types to fix linter errors
declare const global: {
  fetch: any;
};
declare const jest: {
  fn: () => any;
  clearAllMocks: () => void;
};
declare const describe: (name: string, fn: () => void) => void;
declare const beforeEach: (fn: () => void) => void;
declare const afterEach: (fn: () => void) => void;
declare const it: (name: string, fn: () => Promise<void> | void) => void;
declare const expect: any;

interface jest {
  Mock: any;
}

// Define LogEntry and LogLevel types to match ILoggerAdapter requirements
interface LogEntry {
  level: LogLevel;
  message: string;
  metadata?: unknown;
}

type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'fatal';

/**
 * Mock implementations for testing
 */
class MockLoggerAdapter {
  public logs: Array<{ level: string; message: string; metadata?: unknown }> = [];
  
  debug(message: string, metadata?: unknown): void {
    this.logs.push({ level: 'debug', message, metadata });
  }
  
  info(message: string, metadata?: unknown): void {
    this.logs.push({ level: 'info', message, metadata });
  }
  
  warn(message: string, metadata?: unknown): void {
    this.logs.push({ level: 'warn', message, metadata });
  }
  
  error(message: string, error?: unknown, metadata?: unknown): void {
    this.logs.push({ level: 'error', message, metadata: { error, ...metadata as object } });
  }
  
  trace(message: string, metadata?: unknown): void {
    this.logs.push({ level: 'trace', message, metadata });
  }
  
  fatal(message: string, error?: unknown, metadata?: unknown): void {
    this.logs.push({ level: 'fatal', message, metadata: { error, ...metadata as object } });
  }
  
  logEntry(entry: LogEntry): void {
    this.logs.push({ level: entry.level, message: entry.message, metadata: entry.metadata });
  }
  
  child(metadata: Record<string, unknown>): ILoggerAdapter {
    return this; // Return self for child logger in tests
  }
  
  forComponent(componentName: string): ILoggerAdapter {
    return this; // Return self for component logger in tests
  }
  
  forRequest(requestId: string): ILoggerAdapter {
    return this; // Return self for request logger in tests
  }
  
  setLogLevel(): void {
    // No-op for tests
  }
  
  getLogLevel(): LogLevel {
    return 'debug';
  }
  
  isEnabled(): boolean {
    return true;
  }
  
  isLevelEnabled(level: LogLevel): boolean {
    return true;
  }
  
  getConfiguration(): Record<string, unknown> {
    return {}; // Empty config for tests
  }
  
  getNativeLogger<T = unknown>(): T {
    return {} as T;
  }
  
  clear(): void {
    this.logs = [];
  }
}

class MockRequestAdapter implements IRequestAdapter {
  private method: string;
  private url: URL;
  private headers: Headers;
  
  constructor(url = 'https://example.com', method = 'GET', headers = {}) {
    this.method = method;
    this.url = new URL(url);
    this.headers = new Headers(headers);
  }
  
  getMethod(): string {
    return this.method;
  }
  
  getUrl(): URL {
    return this.url;
  }
  
  getHeader(name: string): string | null {
    return this.headers.get(name);
  }
  
  getHeaders(): Headers {
    return this.headers;
  }
  
  async getBodyText(): Promise<string> {
    return '';
  }
  
  async getBodyJson<T>(): Promise<T> {
    return {} as T;
  }
  
  async getBody(): Promise<any> {
    return {};
  }
  
  getNativeRequest<T = unknown>(): T {
    return {} as T;
  }
}

class MockResponseAdapter implements IResponseAdapter {
  private headers: Headers = new Headers();
  private statusCode: number = 200;
  private responseBody: string = '';
  private contentType: string = 'text/plain';
  
  setHeader(name: string, value: string): void {
    this.headers.set(name, value);
  }
  
  getHeaders(): Headers {
    return this.headers;
  }
  
  status(code: number): void {
    this.statusCode = code;
  }
  
  getStatus(): number {
    return this.statusCode;
  }
  
  send(content: string): void {
    this.responseBody = content;
  }
  
  getBody(): string {
    return this.responseBody;
  }
  
  json(data: any): void {
    this.contentType = 'application/json';
    this.responseBody = JSON.stringify(data);
    this.headers.set('Content-Type', 'application/json');
  }
}

class MockCacheService implements ICacheService {
  private cache: Map<string, any> = new Map();
  public getCalls: string[] = [];
  public setCalls: Array<{ key: string, value: any, ttl?: number }> = [];
  public deleteCalls: string[] = [];
  
  async get<T = any>(key: string): Promise<T | null> {
    this.getCalls.push(key);
    return this.cache.get(key) as T || null;
  }
  
  async set<T = any>(key: string, value: T, ttl?: number): Promise<boolean> {
    this.setCalls.push({ key, value, ttl });
    this.cache.set(key, value);
    return true;
  }
  
  async has(key: string): Promise<boolean> {
    return this.cache.has(key);
  }
  
  async delete(key: string): Promise<boolean> {
    this.deleteCalls.push(key);
    return this.cache.delete(key);
  }
  
  generateCacheKey(baseCacheKey: string, flagKey?: string, variationKey?: string): string {
    if (baseCacheKey === 'VARIATION_KEY' && flagKey && variationKey) {
      return `${flagKey}:${variationKey}`;
    }
    return baseCacheKey;
  }
  
  clear(): void {
    this.cache.clear();
    this.getCalls = [];
    this.setCalls = [];
    this.deleteCalls = [];
  }
}

/**
 * Mock global fetch for testing
 */
const mockFetch = (mockResponse: Response) => {
  global.fetch = jest.fn().mockResolvedValue(mockResponse);
  return global.fetch as jest.Mock;
};

describe('ContentFetcher', () => {
  let logger: MockLoggerAdapter;
  let cacheService: MockCacheService;
  let createResponseAdapter: jest.Mock;
  let contentFetcher: ContentFetcher;
  let mockRequest: MockRequestAdapter;
  
  beforeEach(() => {
    logger = new MockLoggerAdapter();
    cacheService = new MockCacheService();
    createResponseAdapter = jest.fn().mockImplementation(() => new MockResponseAdapter());
    contentFetcher = new ContentFetcher(
      logger,
      cacheService,
      createResponseAdapter
    );
    mockRequest = new MockRequestAdapter();
    
    // Reset fetch mock
    global.fetch = jest.fn();
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('fetchContent', () => {
    it('should fetch content from URL and return response', async () => {
      // Arrange
      const url = 'https://example.com/content';
      const mockResponseText = '<html><body>Content</body></html>';
      
      mockFetch(new Response(mockResponseText, {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      }));
      
      // Act
      const result = await contentFetcher.fetchContent(url, mockRequest);
      
      // Assert
      expect(global.fetch).toHaveBeenCalledWith(url, expect.any(Object));
      expect(result.cacheHit).toBe(false);
      expect(result.timeTaken).toBeGreaterThan(0);
      expect(result.response.getStatus()).toBe(200);
      expect(result.response.getBody()).toBe(mockResponseText);
      expect(result.response.getHeaders().get('Content-Type')).toBe('text/html');
      expect(result.response.getHeaders().get('X-Edge-Cache')).toBe('MISS');
      
      // Verify cache was set
      expect(cacheService.setCalls.length).toBe(1);
      expect(cacheService.setCalls[0].key).toContain(url);
      expect(cacheService.setCalls[0].value).toEqual({
        body: mockResponseText,
        status: 200,
        headers: expect.objectContaining({ 'content-type': 'text/html' })
      });
    });
    
    it('should return cached content when available', async () => {
      // Arrange
      const url = 'https://example.com/cached';
      const cacheKey = contentFetcher.generateCacheKey(url);
      const cachedContent = {
        body: '<html><body>Cached Content</body></html>',
        status: 200,
        headers: { 'content-type': 'text/html', 'x-custom': 'value' }
      };
      
      await cacheService.set(cacheKey, cachedContent);
      cacheService.getCalls = []; // Clear for clean test
      
      const fetchSpy = mockFetch(new Response('', { status: 200 }));
      
      // Act
      const result = await contentFetcher.fetchContent(url, mockRequest);
      
      // Assert
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(result.cacheHit).toBe(true);
      expect(result.response.getStatus()).toBe(200);
      expect(result.response.getBody()).toBe(cachedContent.body);
      expect(result.response.getHeaders().get('X-Edge-Cache')).toBe('HIT');
      expect(result.response.getHeaders().get('Content-Type')).toBe('text/html');
      expect(result.response.getHeaders().get('X-Custom')).toBe('value');
      
      // Verify cache was checked
      expect(cacheService.getCalls.length).toBe(1);
      expect(cacheService.getCalls[0]).toBe(cacheKey);
    });
    
    it('should handle fetch errors gracefully', async () => {
      // Arrange
      const url = 'https://example.com/error';
      const errorMessage = 'Network Error';
      
      global.fetch = jest.fn().mockRejectedValue(new Error(errorMessage));
      
      // Act
      const result = await contentFetcher.fetchContent(url, mockRequest);
      
      // Assert
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe(errorMessage);
      expect(result.cacheHit).toBe(false);
      expect(result.response.getStatus()).toBe(502);
      
      // Verify error was logged
      const errorLog = logger.logs.find(log => log.level === 'error');
      expect(errorLog).toBeDefined();
      expect(errorLog?.message).toContain('Error fetching content');
    });
    
    it('should handle request timeout', async () => {
      // Arrange
      const url = 'https://example.com/timeout';
      const options: ContentFetchOptions = { timeout: 100 }; // Fast timeout for test
      
      // Simulate timeout by never resolving the fetch promise
      global.fetch = jest.fn().mockImplementation(() => new Promise(() => {}));
      
      // Act
      const result = await contentFetcher.fetchContent(url, mockRequest, options);
      
      // Assert
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('timeout');
      expect(result.response.getStatus()).toBe(504); // Gateway Timeout
      
      // Verify timeout error message type
      const responseBody = JSON.parse(result.response.getBody());
      expect(responseBody.error).toBe('Failed to fetch content');
      expect(responseBody.message).toContain('timeout');
    });
    
    it('should handle non-200 responses', async () => {
      // Arrange
      const url = 'https://example.com/not-found';
      
      mockFetch(new Response('Not Found', { status: 404 }));
      
      // Act
      const result = await contentFetcher.fetchContent(url, mockRequest);
      
      // Assert
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Failed to fetch content: 404');
      expect(result.response.getStatus()).toBe(502);
      
      // Verify error was logged
      const errorLog = logger.logs.find(log => log.level === 'error');
      expect(errorLog).toBeDefined();
      expect(errorLog?.message).toContain('Error fetching content');
    });
    
    it('should not cache when cache option is disabled', async () => {
      // Arrange
      const url = 'https://example.com/no-cache';
      const options: ContentFetchOptions = { cache: false };
      
      mockFetch(new Response('Content', { status: 200 }));
      
      // Act
      const result = await contentFetcher.fetchContent(url, mockRequest, options);
      
      // Assert
      expect(result.cacheHit).toBe(false);
      expect(result.response.getStatus()).toBe(200);
      
      // Verify cache was not set
      expect(cacheService.setCalls.length).toBe(0);
    });
    
    it('should use custom cache key when provided', async () => {
      // Arrange
      const url = 'https://example.com/custom-key';
      const customCacheKey = 'custom:key';
      const options: ContentFetchOptions = { cacheKey: customCacheKey };
      
      mockFetch(new Response('Content', { status: 200 }));
      
      // Act
      const result = await contentFetcher.fetchContent(url, mockRequest, options);
      
      // Assert
      expect(cacheService.getCalls[0]).toBe(customCacheKey);
      expect(cacheService.setCalls[0].key).toBe(customCacheKey);
    });
  });
  
  describe('clearCache', () => {
    it('should clear cache for a URL', async () => {
      // Arrange
      const url = 'https://example.com/clear-me';
      const cacheKey = contentFetcher.generateCacheKey(url);
      
      await cacheService.set(cacheKey, 'cached content');
      cacheService.deleteCalls = []; // Clear for clean test
      
      // Act
      const result = await contentFetcher.clearCache(url);
      
      // Assert
      expect(result).toBe(true);
      expect(cacheService.deleteCalls.length).toBe(1);
      expect(cacheService.deleteCalls[0]).toBe(cacheKey);
    });
    
    it('should handle errors when clearing cache', async () => {
      // Arrange
      const url = 'https://example.com/clear-error';
      
      cacheService.delete = jest.fn().mockRejectedValue(new Error('Cache error'));
      
      // Act
      const result = await contentFetcher.clearCache(url);
      
      // Assert
      expect(result).toBe(false);
      
      // Verify error was logged
      const errorLog = logger.logs.find(log => log.level === 'error');
      expect(errorLog).toBeDefined();
      expect(errorLog?.message).toContain('Error clearing cache');
    });
  });
  
  describe('generateCacheKey', () => {
    it('should generate a cache key for a URL', () => {
      // Arrange
      const url = 'https://example.com/key-test';
      
      // Act
      const result = contentFetcher.generateCacheKey(url);
      
      // Assert
      expect(result).toBe(`content:${url}`);
    });
    
    it('should include sorted params in the cache key', () => {
      // Arrange
      const url = 'https://example.com/params';
      const params = { c: '3', a: '1', b: '2' };
      
      // Act
      const result = contentFetcher.generateCacheKey(url, params);
      
      // Assert
      expect(result).toBe(`content:${url}:a=1&b=2&c=3`);
    });
  });
}); 