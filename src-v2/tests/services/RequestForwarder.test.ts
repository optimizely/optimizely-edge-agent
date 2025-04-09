import { RequestForwarder } from '../../services/implementations/RequestForwarder';
import { ILoggerAdapter } from '../../adapters/interfaces/ILoggerAdapter';
import { IRequestAdapter } from '../../adapters/interfaces/IRequestAdapter';
import { IResponseAdapter } from '../../adapters/interfaces/IResponseAdapter';
import { RequestForwardOptions } from '../../services/interfaces/IRequestForwarder';

// Declare Jest globals to resolve type issues
declare global {
  function describe(name: string, fn: () => void): void;
  function beforeEach(fn: () => void): void;
  function afterEach(fn: () => void): void;
  function it(name: string, fn: () => void | Promise<void>, timeout?: number): void;
  function expect<T>(actual: T): any;
  const jest: any;
}

/**
 * Mock logger adapter for testing
 */
class MockLoggerAdapter implements ILoggerAdapter {
  public messages: Array<{level: string, message: string, data?: any}> = [];

  debug(message: string, data?: any): void {
    this.messages.push({ level: 'debug', message, data });
  }
  
  info(message: string, data?: any): void {
    this.messages.push({ level: 'info', message, data });
  }
  
  warn(message: string, data?: any): void {
    this.messages.push({ level: 'warn', message, data });
  }
  
  error(message: string, data?: any): void {
    this.messages.push({ level: 'error', message, data });
  }
}

/**
 * Mock request adapter for testing
 */
class MockRequestAdapter implements IRequestAdapter {
  private url: string;
  private method: string;
  private headers: Record<string, string>;
  private body: Uint8Array | null;
  
  constructor(options: {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body?: Uint8Array | string | null;
  }) {
    this.url = options.url;
    this.method = options.method || 'GET';
    this.headers = options.headers || {};
    
    if (typeof options.body === 'string') {
      const encoder = new TextEncoder();
      this.body = encoder.encode(options.body);
    } else {
      this.body = options.body || null;
    }
  }
  
  getUrl(): string {
    return this.url;
  }
  
  getMethod(): string {
    return this.method;
  }
  
  getHeaders(): Record<string, string> {
    return this.headers;
  }
  
  getHeader(name: string): string | undefined {
    return this.headers[name];
  }
  
  async getBody(): Promise<Uint8Array | null> {
    return this.body;
  }
  
  async getBodyText(): Promise<string> {
    if (!this.body) return '';
    
    const decoder = new TextDecoder();
    return decoder.decode(this.body);
  }
}

/**
 * Mock response adapter for testing
 */
class MockResponseAdapter implements IResponseAdapter {
  private status: number;
  private headers: Record<string, string>;
  private body: Uint8Array | null;
  
  constructor(options: {
    status?: number;
    headers?: Record<string, string>;
    body?: Uint8Array | string | null;
  } = {}) {
    this.status = options.status || 200;
    this.headers = options.headers || {};
    
    if (typeof options.body === 'string') {
      const encoder = new TextEncoder();
      this.body = encoder.encode(options.body);
    } else {
      this.body = options.body || null;
    }
  }
  
  getStatus(): number {
    return this.status;
  }
  
  setStatus(status: number): void {
    this.status = status;
  }
  
  getHeaders(): Record<string, string> {
    return this.headers;
  }
  
  getHeader(name: string): string | undefined {
    return this.headers[name];
  }
  
  setHeader(name: string, value: string): void {
    this.headers[name] = value;
  }
  
  removeHeader(name: string): void {
    delete this.headers[name];
  }
  
  async getBody(): Promise<Uint8Array | null> {
    return this.body;
  }
  
  setBody(body: Uint8Array): void {
    this.body = body;
  }
  
  async getBodyText(): Promise<string> {
    if (!this.body) return '';
    
    const decoder = new TextDecoder();
    return decoder.decode(this.body);
  }
  
  setBodyText(text: string): void {
    const encoder = new TextEncoder();
    this.body = encoder.encode(text);
  }
}

/**
 * Mock Response class for testing
 */
class MockResponse implements Response {
  readonly headers: Headers;
  readonly ok: boolean;
  readonly redirected: boolean;
  readonly status: number;
  readonly statusText: string;
  readonly type: ResponseType;
  readonly url: string;
  readonly body: ReadableStream<Uint8Array> | null;
  readonly bodyUsed: boolean;
  private responseData: string | Uint8Array;
  
  constructor(options: {
    url?: string;
    status?: number;
    statusText?: string;
    headers?: Record<string, string>;
    body?: string | Uint8Array;
    redirected?: boolean;
  } = {}) {
    this.url = options.url || 'https://example.com';
    this.status = options.status || 200;
    this.statusText = options.statusText || 'OK';
    this.redirected = options.redirected || false;
    this.ok = this.status >= 200 && this.status < 300;
    this.type = 'basic';
    this.bodyUsed = false;
    this.body = null; // We won't implement ReadableStream for this mock
    
    // Setup headers
    this.headers = new Headers();
    if (options.headers) {
      Object.entries(options.headers).forEach(([key, value]) => {
        this.headers.set(key, value);
      });
    }
    
    // Store data for response methods
    this.responseData = options.body || '';
  }
  
  async arrayBuffer(): Promise<ArrayBuffer> {
    if (this.responseData instanceof Uint8Array) {
      return this.responseData.buffer;
    }
    const encoder = new TextEncoder();
    return encoder.encode(this.responseData).buffer;
  }
  
  async blob(): Promise<Blob> {
    throw new Error('Method not implemented in mock.');
  }
  
  async formData(): Promise<FormData> {
    throw new Error('Method not implemented in mock.');
  }
  
  async json(): Promise<any> {
    if (typeof this.responseData === 'string') {
      return JSON.parse(this.responseData);
    }
    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(this.responseData));
  }
  
  async text(): Promise<string> {
    if (typeof this.responseData === 'string') {
      return this.responseData;
    }
    const decoder = new TextDecoder();
    return decoder.decode(this.responseData);
  }
  
  clone(): Response {
    return new MockResponse({
      url: this.url,
      status: this.status,
      statusText: this.statusText,
      headers: Array.from(this.headers.entries()).reduce((obj, [key, value]) => {
        obj[key] = value;
        return obj;
      }, {} as Record<string, string>),
      body: this.responseData,
      redirected: this.redirected
    });
  }
}

describe('RequestForwarder', () => {
  let forwarder: RequestForwarder;
  let mockLogger: MockLoggerAdapter;
  let mockFetch: jest.Mock;
  
  beforeEach(() => {
    // Reset mocks
    mockLogger = new MockLoggerAdapter();
    mockFetch = jest.fn();
    forwarder = new RequestForwarder(mockLogger, mockFetch);
  });
  
  describe('buildForwardUrl', () => {
    it('should handle absolute URLs', () => {
      const originalUrl = 'https://original.com/path?a=1&b=2';
      const targetUrl = 'https://target.com/newpath';
      
      const result = forwarder.buildForwardUrl(originalUrl, targetUrl);
      
      expect(result).toBe('https://target.com/newpath');
    });
    
    it('should handle relative URLs', () => {
      const originalUrl = 'https://original.com/path?a=1&b=2';
      const targetUrl = '/newpath';
      
      const result = forwarder.buildForwardUrl(originalUrl, targetUrl);
      
      expect(result).toBe('https://original.com/newpath');
    });
    
    it('should preserve original query parameters when requested', () => {
      const originalUrl = 'https://original.com/path?a=1&b=2';
      const targetUrl = 'https://target.com/newpath';
      
      const result = forwarder.buildForwardUrl(originalUrl, targetUrl, {
        preserveOriginalQueryParams: true
      });
      
      expect(result).toBe('https://target.com/newpath?a=1&b=2');
    });
    
    it('should add additional query parameters', () => {
      const originalUrl = 'https://original.com/path';
      const targetUrl = 'https://target.com/newpath';
      
      const result = forwarder.buildForwardUrl(originalUrl, targetUrl, {
        additionalQueryParams: { c: '3', d: '4' }
      });
      
      expect(result).toBe('https://target.com/newpath?c=3&d=4');
    });
    
    it('should remove specified query parameters', () => {
      const originalUrl = 'https://original.com/path?a=1&b=2';
      const targetUrl = 'https://target.com/newpath?c=3';
      
      const result = forwarder.buildForwardUrl(originalUrl, targetUrl, {
        preserveOriginalQueryParams: true,
        removeQueryParams: ['b', 'c']
      });
      
      expect(result).toBe('https://target.com/newpath?a=1');
    });
  });
  
  describe('forwardRequest', () => {
    it('should forward a request successfully', async () => {
      // Setup request
      const request = new MockRequestAdapter({
        url: 'https://original.com/path?a=1',
        method: 'GET',
        headers: { 'accept': 'application/json' }
      });
      
      // Setup response to be returned by fetch
      const mockResponse = new MockResponse({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ success: true })
      });
      
      // Setup fetch mock
      mockFetch.mockResolvedValueOnce(mockResponse);
      
      // Forward options
      const options: RequestForwardOptions = {
        targetUrl: 'https://target.com/api'
      };
      
      // Execute
      const result = await forwarder.forwardRequest(request, options);
      
      // Verify
      expect(result.success).toBe(true);
      expect(result.targetUrl).toBe('https://target.com/api?a=1');
      expect(result.timeTaken).toBeGreaterThanOrEqual(0);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://target.com/api?a=1',
        expect.objectContaining({
          method: 'GET',
          headers: { 'accept': 'application/json' }
        })
      );
      
      // Verify response adapter
      expect(result.response).toBeDefined();
      if (result.response) {
        expect(result.response.getStatus()).toBe(200);
        expect(result.response.getHeader('content-type')).toBe('application/json');
        expect(await result.response.getBodyText()).toBe(JSON.stringify({ success: true }));
      }
    });
    
    it('should handle errors during forwarding', async () => {
      // Setup request
      const request = new MockRequestAdapter({
        url: 'https://original.com/path',
      });
      
      // Setup fetch mock to fail
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      
      // Forward options
      const options: RequestForwardOptions = {
        targetUrl: 'https://target.com/api'
      };
      
      // Execute
      const result = await forwarder.forwardRequest(request, options);
      
      // Verify
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Network error');
      expect(result.response).toBeUndefined();
    });
    
    it('should respect custom headers and method', async () => {
      // Setup request
      const request = new MockRequestAdapter({
        url: 'https://original.com/path',
        method: 'GET',
        headers: { 'accept': 'application/json' }
      });
      
      // Setup response
      const mockResponse = new MockResponse({ status: 200 });
      mockFetch.mockResolvedValueOnce(mockResponse);
      
      // Forward options with custom headers and method
      const options: RequestForwardOptions = {
        targetUrl: 'https://target.com/api',
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-custom-header': 'custom-value'
        }
      };
      
      // Execute
      await forwarder.forwardRequest(request, options);
      
      // Verify
      expect(mockFetch).toHaveBeenCalledWith(
        'https://target.com/api',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'content-type': 'application/json',
            'x-custom-header': 'custom-value'
          }
        })
      );
    });
    
    it('should handle request body for POST requests', async () => {
      // Setup request with body
      const requestBody = JSON.stringify({ key: 'value' });
      const request = new MockRequestAdapter({
        url: 'https://original.com/path',
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: requestBody
      });
      
      // Setup response
      const mockResponse = new MockResponse({ status: 201 });
      mockFetch.mockResolvedValueOnce(mockResponse);
      
      // Forward options
      const options: RequestForwardOptions = {
        targetUrl: 'https://target.com/api'
      };
      
      // Execute
      await forwarder.forwardRequest(request, options);
      
      // Verify body was included
      const fetchCalls = mockFetch.mock.calls;
      expect(fetchCalls.length).toBe(1);
      
      // The body should be a Uint8Array containing our requestBody
      const encoder = new TextEncoder();
      const expectedBody = encoder.encode(requestBody);
      expect(fetchCalls[0][1].body).toEqual(expectedBody);
    });
    
    it('should handle timeout options', async () => {
      // Setup request
      const request = new MockRequestAdapter({
        url: 'https://original.com/path'
      });
      
      // Setup response
      const mockResponse = new MockResponse({ status: 200 });
      mockFetch.mockResolvedValueOnce(mockResponse);
      
      // Forward options with custom timeout
      const options: RequestForwardOptions = {
        targetUrl: 'https://target.com/api',
        timeout: 5000 // 5 seconds
      };
      
      // Execute
      await forwarder.forwardRequest(request, options);
      
      // Verify AbortController was set up with the timeout
      // We can't directly test the setTimeout in Jest easily, but we can verify
      // that fetch was called with a signal
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          signal: expect.any(Object)
        })
      );
    });
  });
  
  describe('forwardRequestAndApplyResponse', () => {
    it('should apply the forwarded response to the original response', async () => {
      // Setup request
      const request = new MockRequestAdapter({
        url: 'https://original.com/path'
      });
      
      // Setup original response to be modified
      const response = new MockResponseAdapter();
      
      // Setup fetch response
      const mockResponse = new MockResponse({
        status: 201,
        headers: { 
          'content-type': 'application/json',
          'x-custom-header': 'custom-value'
        },
        body: JSON.stringify({ result: 'success' })
      });
      mockFetch.mockResolvedValueOnce(mockResponse);
      
      // Forward options
      const options: RequestForwardOptions = {
        targetUrl: 'https://target.com/api'
      };
      
      // Execute
      const result = await forwarder.forwardRequestAndApplyResponse(request, response, options);
      
      // Verify
      expect(result.success).toBe(true);
      
      // Verify the original response was updated
      expect(response.getStatus()).toBe(201);
      expect(response.getHeader('content-type')).toBe('application/json');
      expect(response.getHeader('x-custom-header')).toBe('custom-value');
      expect(await response.getBodyText()).toBe(JSON.stringify({ result: 'success' }));
    });
    
    it('should handle errors when applying the response', async () => {
      // Setup request
      const request = new MockRequestAdapter({
        url: 'https://original.com/path'
      });
      
      // Setup original response that will fail when setting the body
      const response = new MockResponseAdapter();
      jest.spyOn(response, 'setBody').mockImplementation(() => {
        throw new Error('Failed to set body');
      });
      
      // Setup fetch response
      const mockResponse = new MockResponse({
        status: 200,
        body: 'Test response'
      });
      mockFetch.mockResolvedValueOnce(mockResponse);
      
      // Forward options
      const options: RequestForwardOptions = {
        targetUrl: 'https://target.com/api'
      };
      
      // Execute
      const result = await forwarder.forwardRequestAndApplyResponse(request, response, options);
      
      // Verify
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Failed to set body');
    });
  });
}); 