import { describe, expect, it, vi, beforeEach } from 'vitest';
import { RequestHandler } from '../../services/implementations/RequestHandler';
import { IRequestAdapter } from '../../adapters/interfaces/IRequestAdapter';
import { OptimizelyDecision } from '../../services/interfaces/IDecisionService';
import { MockLoggerAdapter } from '../test-utils/MockLoggerAdapter';
import { MockMetricsAdapter } from '../test-utils/MockMetricsAdapter';

interface MockRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: any;
}

// Simple MockRequestAdapter to use in tests
class MockRequestAdapter implements IRequestAdapter {
  private req: MockRequest;
  
  constructor(req: MockRequest) {
    this.req = req;
  }
  
  getMethod(): string {
    return this.req.method;
  }
  
  getUrl(): URL {
    return new URL(this.req.url);
  }
  
  getHeader(name: string): string | null {
    return this.req.headers[name.toLowerCase()] || null;
  }
  
  getHeaders(): Headers {
    const headers = new Headers();
    Object.entries(this.req.headers).forEach(([key, value]) => {
      headers.append(key, value);
    });
    return headers;
  }
  
  async getBodyJson<T>(): Promise<T> {
    return this.req.body || {} as T;
  }
  
  async getBodyText(): Promise<string> {
    return JSON.stringify(this.req.body || '');
  }
  
  async getBodyBuffer(): Promise<ArrayBuffer> {
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(JSON.stringify(this.req.body || ''));
    // Create a new proper ArrayBuffer and copy the data
    const buffer = new ArrayBuffer(encodedData.byteLength);
    new Uint8Array(buffer).set(encodedData);
    return buffer;
  }
  
  getNativeRequest<T>(): T {
    return this.req as unknown as T;
  }
  
  async getBody(): Promise<unknown> {
    return this.req.body || {};
  }
}

describe('Response Headers Integration Tests', () => {
  // Mock dependencies
  const mockDecisionService = {
    decide: vi.fn(),
    getDecision: vi.fn(),
    getAllDecisions: vi.fn(),
    decideAll: vi.fn()
  };
  
  const mockEventService = {
    trackEvent: vi.fn(),
    createEvent: vi.fn(),
    flushEvents: vi.fn()
  };
  
  const mockLogger = new MockLoggerAdapter();
  const mockCache = { get: vi.fn(), set: vi.fn() };
  const mockEdgeMode = { getIntegration: vi.fn() };
  const mockMetrics = new MockMetricsAdapter();
  
  let requestHandler: RequestHandler;
  
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Create fresh instance for each test
    const cookieService = null; // Not testing cookie functionality in this test
    
    requestHandler = new RequestHandler(
      mockDecisionService as any,
      mockEventService as any,
      mockLogger,
      mockCache as any,
      mockEdgeMode as any,
      mockMetrics,
      cookieService as any
    );
  });
  
  it('should include default headers in decisions response', async () => {
    // Create a mock request
    const mockRequest = new MockRequestAdapter({
      method: 'POST',
      url: 'https://example.com/decide',
      headers: {
        'content-type': 'application/json'
      },
      body: {
        sdkKey: 'test-sdk-key',
        flagKey: 'test-flag',
        userId: 'test-user'
      }
    });
    
    // Configure decision service to return a decision
    const mockDecision: Partial<OptimizelyDecision> = {
      flagKey: 'test-flag',
      enabled: true,
      variationKey: 'variation-a',
      ruleKey: 'rule-1',
      experimentKey: 'exp-1',
      variables: {},
      reasons: []
    };
    
    mockDecisionService.getDecision.mockResolvedValueOnce(mockDecision);
    
    // Call the request handler
    const response = await requestHandler.handleRequest(mockRequest);
    
    // Verify standard headers are present
    expect(response.status).toBe(200);
    expect(response.headers['X-Implementation-Version']).toBe('v2');
    expect(response.headers['Content-Type']).toBe('application/json');
    expect(response.headers['X-Request-ID']).toBeDefined();
    
    // Verify decision-specific headers
    expect(response.headers['X-Optimizely-Variation-test-flag']).toBe('variation-a');
    expect(response.headers['X-Optimizely-Experiment-test-flag']).toBe('exp-1');
    expect(response.headers['X-Optimizely-Decision']).toBeDefined();
    
    // Verify the decision is base64 encoded JSON
    const decodedDecision = JSON.parse(response.headers['X-Optimizely-Decision']);
    expect(decodedDecision['test-flag']).toBeDefined();
    expect(decodedDecision['test-flag'].variationKey).toBe('variation-a');
  });
  
  it('should include cache control headers when configured', async () => {
    // Create a mock request with cache control configuration
    const mockRequest = new MockRequestAdapter({
      method: 'POST',
      url: 'https://example.com/decide',
      headers: {
        'content-type': 'application/json'
      },
      body: {
        sdkKey: 'test-sdk-key',
        flagKey: 'test-flag',
        userId: 'test-user',
        cacheControl: {
          default: {
            browserTTL: 60,
            edgeTTL: 300,
            bypassCache: false
          },
          headers: {
            'Cache-Control': 'max-age=60, public'
          }
        }
      }
    });
    
    // Configure decision service to return a decision
    const mockDecision: Partial<OptimizelyDecision> = {
      flagKey: 'test-flag',
      enabled: true,
      variationKey: 'variation-a',
      variables: {},
      reasons: []
    };
    
    mockDecisionService.getDecision.mockResolvedValueOnce(mockDecision);
    
    // Call the request handler
    const response = await requestHandler.handleRequest(mockRequest);
    
    // Verify cache control headers are present
    expect(response.headers['Cache-Control']).toBe('max-age=60, public');
    expect(response.headers['CDN-Cache-Control']).toBe('max-age=300');
  });
  
  it('should respect header configuration options', async () => {
    // Create a mock request with header configuration
    const mockRequest = new MockRequestAdapter({
      method: 'POST',
      url: 'https://example.com/decide',
      headers: {
        'content-type': 'application/json'
      },
      body: {
        sdkKey: 'test-sdk-key',
        flagKey: 'test-flag',
        userId: 'test-user',
        headers: {
          'decisions': true,
          'variations': false, // Turn off variation headers
          'experiments': true,
          'visitor-id': true,
          'sdk-key': false, // Turn off SDK key header
          'powered-by': true
        }
      }
    });
    
    // Configure decision service to return a decision
    const mockDecision: Partial<OptimizelyDecision> = {
      flagKey: 'test-flag',
      enabled: true,
      variationKey: 'variation-a',
      experimentKey: 'exp-1',
      ruleKey: 'rule-1',
      variables: { foo: 'bar' },
      reasons: ['reason1', 'reason2']
    };
    
    mockDecisionService.getDecision.mockResolvedValueOnce(mockDecision);
    
    // Call the request handler
    const response = await requestHandler.handleRequest(mockRequest);
    
    // Verify headers based on configuration
    expect(response.headers['X-Optimizely-Decision']).toBeDefined(); // Should be present (decisions: true)
    expect(response.headers['X-Optimizely-Variation-test-flag']).toBeUndefined(); // Should be absent (variations: false)
    expect(response.headers['X-Optimizely-Experiment-test-flag']).toBeDefined(); // Should be present (experiments: true)
    expect(response.headers['X-Optimizely-Visitor-Id']).toBeDefined(); // Should be present (visitor-id: true)
    expect(response.headers['X-Optimizely-SDK-Key']).toBeUndefined(); // Should be absent (sdk-key: false)
    expect(response.headers['X-Powered-By']).toBeDefined(); // Should be present (powered-by: true)
  });
  
  it('should include custom headers from config', async () => {
    // Create a mock request with custom headers
    const mockRequest = new MockRequestAdapter({
      method: 'POST',
      url: 'https://example.com/decide',
      headers: {
        'content-type': 'application/json'
      },
      body: {
        sdkKey: 'test-sdk-key',
        flagKey: 'test-flag',
        userId: 'test-user',
        customHeaders: {
          'X-Custom-Header': 'custom-value',
          'X-Custom-Object': { key: 'value' },
          'X-Custom-Array': [1, 2, 3]
        }
      }
    });
    
    // Configure decision service to return a decision
    const mockDecision: Partial<OptimizelyDecision> = {
      flagKey: 'test-flag',
      enabled: true,
      variationKey: 'variation-a',
      variables: {},
      reasons: []
    };
    
    mockDecisionService.getDecision.mockResolvedValueOnce(mockDecision);
    
    // Call the request handler
    const response = await requestHandler.handleRequest(mockRequest);
    
    // Verify custom headers are present
    expect(response.headers['X-Custom-Header']).toBe('custom-value');
    expect(response.headers['X-Custom-Object']).toBe('{"key":"value"}');
    expect(response.headers['X-Custom-Array']).toBe('[1,2,3]');
  });
  
  it('should apply trimmedDecisions option', async () => {
    // Create a mock request with trimmedDecisions enabled
    const mockRequest = new MockRequestAdapter({
      method: 'POST',
      url: 'https://example.com/decide',
      headers: {
        'content-type': 'application/json'
      },
      body: {
        sdkKey: 'test-sdk-key',
        flagKey: 'test-flag',
        userId: 'test-user',
        trimmedDecisions: true
      }
    });
    
    // Configure decision service to return a decision with lots of extra fields
    const mockDecision: Partial<OptimizelyDecision> = {
      flagKey: 'test-flag',
      enabled: true,
      variationKey: 'variation-a',
      experimentKey: 'exp-1',
      ruleKey: 'rule-1',
      variables: { foo: 'bar' },
      reasons: ['reason1', 'reason2']
    };
    
    mockDecisionService.getDecision.mockResolvedValueOnce(mockDecision);
    
    // Call the request handler
    const response = await requestHandler.handleRequest(mockRequest);
    
    // Verify the decision header is trimmed
    const decodedDecision = JSON.parse(response.headers['X-Optimizely-Decision']);
    expect(decodedDecision['test-flag']).toBeDefined();
    
    // Should have only essential fields
    expect(decodedDecision['test-flag'].flagKey).toBe('test-flag');
    expect(decodedDecision['test-flag'].enabled).toBe(true);
    expect(decodedDecision['test-flag'].variationKey).toBe('variation-a');
    expect(decodedDecision['test-flag'].experimentKey).toBe('exp-1');
    expect(decodedDecision['test-flag'].ruleKey).toBe('rule-1');
    expect(decodedDecision['test-flag'].variables).toEqual({ foo: 'bar' });
    
    // Should not have these fields
    expect(decodedDecision['test-flag'].reasons).toBeUndefined();
  });
}); 