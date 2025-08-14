// @ts-nocheck
// This file contains tests for the ContentFetcher service
// The ts-nocheck directive is used to suppress TypeScript errors in this test file

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EdgeModeHandler } from '../../services/implementations/EdgeModeHandler';
import { CDNVariationSettings } from '../../services/interfaces/IEdgeModeHandler';
import { IRequestAdapter } from '../../adapters/interfaces/IRequestAdapter';
import { IResponseAdapter } from '../../adapters/interfaces/IResponseAdapter';
import { ILoggerAdapter, LogLevel } from '../../adapters/interfaces/ILoggerAdapter';
import { ICacheService } from '../../services/interfaces/ICacheService';

// Mock adapters
class MockRequestAdapter implements IRequestAdapter {
  public url: URL;
  public method: string;
  public headers: Record<string, string>;
  
  constructor(url: string, method = 'GET', headers: Record<string, string> = {}) {
    this.url = new URL(url.startsWith('http') ? url : `https://${url}`);
    this.method = method;
    this.headers = headers;
  }
  
  getMethod(): string {
    return this.method;
  }
  
  getUrl(): URL {
    return this.url;
  }
  
  getHeader(name: string): string | null {
    return this.headers[name] || null;
  }
  
  getHeaders(): Headers {
    const headers = new Headers();
    Object.entries(this.headers).forEach(([key, value]) => {
      headers.append(key, value);
    });
    return headers;
  }
  
  async getBodyText(): Promise<string> {
    return '';
  }
  
  async getBodyJson<T>(): Promise<T> {
    return {} as T;
  }
  
  async getBody(): Promise<any> {
    return null;
  }
  
  getNativeRequest<T = unknown>(): T {
    return {} as T;
  }
}

class MockResponseAdapter implements IResponseAdapter {
  public statusCode = 200;
  public headers: Record<string, string> = {};
  public responseBody = '';
  
  setHeader(name: string, value: string): void {
    this.headers[name] = value;
  }
  
  getHeaders(): Headers {
    const headers = new Headers();
    Object.entries(this.headers).forEach(([key, value]) => {
      headers.append(key, value);
    });
    return headers;
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
    this.responseBody = JSON.stringify(data);
    this.headers['Content-Type'] = 'application/json';
  }
}

// Create mock fetch
const createGlobalFetch = () => {
  const originalFetch = global.fetch;
  
  beforeEach(() => {
    // @ts-ignore - override fetch for testing
    global.fetch = vi.fn().mockImplementation((url, options) => {
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({
          'Content-Type': 'text/html',
          'X-Test': 'test-value'
        }),
        text: () => Promise.resolve('<html><body>Test content</body></html>')
      });
    });
  });
  
  return () => {
    // @ts-ignore - restore fetch
    global.fetch = originalFetch;
  };
};

describe('EdgeModeHandler', () => {
  // Setup and teardown for global fetch mock
  const restoreFetch = createGlobalFetch();
  
  // Mock services
  const logger: ILoggerAdapter = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    setLogLevel: vi.fn()
  };
  
  const cacheService: ICacheService = {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    has: vi.fn(),
    generateCacheKey: vi.fn().mockImplementation((key) => key)
  };
  
  // Response factory
  const createResponseAdapter = (request: IRequestAdapter): IResponseAdapter => {
    return new MockResponseAdapter();
  };
  
  // Create handler
  let handler: EdgeModeHandler;
  
  beforeEach(() => {
    vi.resetAllMocks();
    handler = new EdgeModeHandler(logger, cacheService, createResponseAdapter);
    
    // Default behavior for cache get (no cache hit)
    (cacheService.get as any).mockResolvedValue(null);
  });
  
  describe('findMatchingConfig', () => {
    it('should return null if no settings are provided', () => {
      const result = handler.findMatchingConfig('example.com', []);
      expect(result).toBeNull();
    });
    
    it('should find a match with exact URL', () => {
      const settings: CDNVariationSettings[] = [
        {
          cdnExperimentURL: '/test',
          cdnResponseURL: 'https://cdn.example.com/test-variation'
        }
      ];
      
      const result = handler.findMatchingConfig('example.com/test', settings);
      expect(result).toEqual(settings[0]);
    });
    
    it('should find a match with regex pattern', () => {
      const settings: CDNVariationSettings[] = [
        {
          cdnExperimentURL: '/other',
          cdnResponseURL: 'https://cdn.example.com/other-variation'
        },
        {
          cdnExperimentURL: '/test',
          cdnResponseURL: 'https://cdn.example.com/test-variation',
          pathRegex: '^/test\\d+$'
        }
      ];
      
      const result = handler.findMatchingConfig('example.com/test123', settings);
      expect(result).toEqual(settings[1]);
    });
    
    it('should respect required query parameters', () => {
      const settings: CDNVariationSettings[] = [
        {
          cdnExperimentURL: '/test',
          cdnResponseURL: 'https://cdn.example.com/test-variation',
          requiredQueryParams: ['param1', 'param2']
        }
      ];
      
      // Should not match (missing param2)
      const result1 = handler.findMatchingConfig('example.com/test?param1=value1', settings);
      expect(result1).toBeNull();
      
      // Should match (has both params)
      const result2 = handler.findMatchingConfig('example.com/test?param1=value1&param2=value2', settings);
      expect(result2).toEqual(settings[0]);
    });
    
    it('should respect ignored query parameters', () => {
      const settings: CDNVariationSettings[] = [
        {
          cdnExperimentURL: '/test',
          cdnResponseURL: 'https://cdn.example.com/test-variation',
          ignoreQueryParams: ['tracking', 'ref']
        }
      ];
      
      // Should match even with ignored params
      const result = handler.findMatchingConfig('example.com/test?tracking=1234&ref=source', settings);
      expect(result).toEqual(settings[0]);
    });
  });
  
  describe('fetchContent', () => {
    it('should fetch content from CDN response URL', async () => {
      const request = new MockRequestAdapter('example.com/test');
      const response = await handler.fetchContent('https://cdn.example.com/content', request);
      
      expect(global.fetch).toHaveBeenCalledWith('https://cdn.example.com/content');
      expect(response.getStatus()).toBe(200);
      expect(response.getBody()).toBe('<html><body>Test content</body></html>');
      expect(response.getHeaders().get('X-Test')).toBe('test-value');
      expect(response.getHeaders().get('X-Edge-Cache')).toBe('MISS');
    });
    
    it('should return cached content if available', async () => {
      const request = new MockRequestAdapter('example.com/test');
      const cachedContent = '<html><body>Cached content</body></html>';
      
      // Set up cache hit
      (cacheService.get as any).mockResolvedValue(cachedContent);
      
      const response = await handler.fetchContent('https://cdn.example.com/content', request);
      
      expect(global.fetch).not.toHaveBeenCalled();
      expect(response.getBody()).toBe(cachedContent);
      expect(response.getHeaders().get('X-Edge-Cache')).toBe('HIT');
    });
    
    it('should handle fetch errors gracefully', async () => {
      const request = new MockRequestAdapter('example.com/test');
      
      // Set up fetch to fail
      (global.fetch as any).mockRejectedValue(new Error('Network error'));
      
      const response = await handler.fetchContent('https://cdn.example.com/content', request);
      
      expect(response.getStatus()).toBe(502);
      expect(response.getBody()).toBe('Error fetching content');
      expect(logger.error).toHaveBeenCalled();
    });
    
    it('should cache successful responses', async () => {
      const request = new MockRequestAdapter('example.com/test');
      const response = await handler.fetchContent('https://cdn.example.com/content', request);
      
      expect(cacheService.set).toHaveBeenCalledWith(
        'https://cdn.example.com/content',
        '<html><body>Test content</body></html>',
        3600 // 1 hour
      );
    });
  });
  
  describe('transformContent', () => {
    it('should return original content if no transform function', async () => {
      const content = '<html><body>Original</body></html>';
      const result = await handler.transformContent(content, '');
      expect(result).toBe(content);
    });
    
    it('should apply transform function to content', async () => {
      const content = '<html><body>Original</body></html>';
      const transformFn = 'return content.replace("Original", "Transformed");';
      const result = await handler.transformContent(content, transformFn);
      expect(result).toBe('<html><body>Transformed</body></html>');
    });
    
    it('should handle transform function errors gracefully', async () => {
      const content = '<html><body>Original</body></html>';
      const transformFn = 'throw new Error("Transform error");';
      const result = await handler.transformContent(content, transformFn);
      expect(result).toBe(content);
      expect(logger.error).toHaveBeenCalled();
    });
    
    it('should handle non-string return values', async () => {
      const content = '<html><body>Original</body></html>';
      const transformFn = 'return 42;'; // Not a string
      const result = await handler.transformContent(content, transformFn);
      expect(result).toBe(content);
      expect(logger.warn).toHaveBeenCalled();
    });
  });
  
  describe('processRequest', () => {
    it('should process request by fetching content', async () => {
      const request = new MockRequestAdapter('example.com/test');
      const cdnSettings: CDNVariationSettings = {
        cdnExperimentURL: '/test',
        cdnResponseURL: 'https://cdn.example.com/content'
      };
      
      // Spy on fetchContent
      const fetchContentSpy = vi.spyOn(handler, 'fetchContent');
      
      await handler.processRequest(request, cdnSettings);
      
      expect(fetchContentSpy).toHaveBeenCalledWith('https://cdn.example.com/content', request);
    });
    
    it('should forward request to origin if specified', async () => {
      const request = new MockRequestAdapter('example.com/test');
      const cdnSettings: CDNVariationSettings = {
        cdnExperimentURL: '/test',
        cdnResponseURL: 'https://cdn.example.com/content',
        forwardRequestToOrigin: true
      };
      
      // Spy on forwardToOrigin
      const forwardToOriginSpy = vi.spyOn(handler, 'forwardToOrigin');
      
      await handler.processRequest(request, cdnSettings);
      
      expect(forwardToOriginSpy).toHaveBeenCalledWith(request, cdnSettings);
    });
    
    it('should handle errors gracefully', async () => {
      const request = new MockRequestAdapter('example.com/test');
      const cdnSettings: CDNVariationSettings = {
        cdnExperimentURL: '/test',
        cdnResponseURL: 'https://cdn.example.com/content'
      };
      
      // Make fetchContent throw an error
      vi.spyOn(handler, 'fetchContent').mockRejectedValue(new Error('Test error'));
      
      const response = await handler.processRequest(request, cdnSettings);
      
      expect(response.getStatus()).toBe(500);
      expect(response.getBody()).toBe('Error processing Edge Mode request');
      expect(logger.error).toHaveBeenCalled();
    });
  });
  
  describe('forwardToOrigin', () => {
    it('should forward request to origin', async () => {
      const request = new MockRequestAdapter('example.com/test');
      const cdnSettings: CDNVariationSettings = {
        cdnExperimentURL: '/test',
        cdnResponseURL: 'https://cdn.example.com/content',
        forwardRequestToOrigin: true
      };
      
      const response = await handler.forwardToOrigin(request, cdnSettings);
      
      expect(global.fetch).toHaveBeenCalledWith('https://example.com/test', expect.any(Object));
      expect(response.getStatus()).toBe(200);
      expect(response.getBody()).toBe('<html><body>Test content</body></html>');
      expect(response.getHeaders().get('X-Edge-Origin-Cache')).toBe('MISS');
    });
    
    it('should return cached origin response if available', async () => {
      const request = new MockRequestAdapter('example.com/test');
      const cdnSettings: CDNVariationSettings = {
        cdnExperimentURL: '/test',
        cdnResponseURL: 'https://cdn.example.com/content',
        forwardRequestToOrigin: true,
        cacheRequestToOrigin: true
      };
      
      // Set up cache hit
      const cachedResponse = JSON.stringify({
        status: 200,
        headers: { 'Content-Type': 'text/html', 'X-Cached': 'yes' },
        body: '<html><body>Cached origin response</body></html>'
      });
      
      (cacheService.get as any).mockResolvedValue(cachedResponse);
      
      const response = await handler.forwardToOrigin(request, cdnSettings);
      
      expect(global.fetch).not.toHaveBeenCalled();
      expect(response.getStatus()).toBe(200);
      expect(response.getBody()).toBe('<html><body>Cached origin response</body></html>');
      expect(response.getHeaders().get('X-Cached')).toBe('yes');
      expect(response.getHeaders().get('X-Edge-Origin-Cache')).toBe('HIT');
    });
    
    it('should apply transform function to origin response', async () => {
      const request = new MockRequestAdapter('example.com/test');
      const cdnSettings: CDNVariationSettings = {
        cdnExperimentURL: '/test',
        cdnResponseURL: 'https://cdn.example.com/content',
        forwardRequestToOrigin: true,
        transformContent: 'return content.replace("Test content", "Transformed content");'
      };
      
      // Spy on transformContent
      const transformContentSpy = vi.spyOn(handler, 'transformContent').mockResolvedValue('<html><body>Transformed content</body></html>');
      
      const response = await handler.forwardToOrigin(request, cdnSettings);
      
      expect(transformContentSpy).toHaveBeenCalled();
      expect(response.getBody()).toBe('<html><body>Transformed content</body></html>');
    });
    
    it('should add custom response headers', async () => {
      const request = new MockRequestAdapter('example.com/test');
      const cdnSettings: CDNVariationSettings = {
        cdnExperimentURL: '/test',
        cdnResponseURL: 'https://cdn.example.com/content',
        forwardRequestToOrigin: true,
        responseHeaders: {
          'X-Custom': 'custom-value',
          'Cache-Control': 'max-age=3600'
        }
      };
      
      const response = await handler.forwardToOrigin(request, cdnSettings);
      
      expect(response.getHeaders().get('X-Custom')).toBe('custom-value');
      expect(response.getHeaders().get('Cache-Control')).toBe('max-age=3600');
    });
    
    it('should handle fetch errors gracefully', async () => {
      const request = new MockRequestAdapter('example.com/test');
      const cdnSettings: CDNVariationSettings = {
        cdnExperimentURL: '/test',
        cdnResponseURL: 'https://cdn.example.com/content',
        forwardRequestToOrigin: true
      };
      
      // Set up fetch to fail
      (global.fetch as any).mockRejectedValue(new Error('Network error'));
      
      const response = await handler.forwardToOrigin(request, cdnSettings);
      
      expect(response.getStatus()).toBe(502);
      expect(response.getBody()).toBe('Error forwarding request to origin');
      expect(logger.error).toHaveBeenCalled();
    });
    
    it('should cache successful origin responses if enabled', async () => {
      const request = new MockRequestAdapter('example.com/test');
      const cdnSettings: CDNVariationSettings = {
        cdnExperimentURL: '/test',
        cdnResponseURL: 'https://cdn.example.com/content',
        forwardRequestToOrigin: true,
        cacheRequestToOrigin: true,
        cacheTTL: 7200 // 2 hours
      };
      
      await handler.forwardToOrigin(request, cdnSettings);
      
      expect(cacheService.set).toHaveBeenCalledWith(
        'origin:https://example.com/test',
        expect.any(String),
        7200
      );
    });
  });
}); 