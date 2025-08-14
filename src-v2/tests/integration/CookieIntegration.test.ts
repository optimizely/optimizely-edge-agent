import { describe, expect, it, vi, beforeEach } from 'vitest';
import { RequestHandler } from '../../services/implementations/RequestHandler';
import { CookieService } from '../../services/implementations/CookieService';
import { IRequestAdapter } from '../../adapters/interfaces/IRequestAdapter';
import { ILoggerAdapter, LogContext, LogEntry, LogLevel, LoggerConfiguration } from '../../adapters/interfaces/ILoggerAdapter';
import { IMetricsAdapter, MetricTags, MetricOptions, MetricsConfiguration, TimerMetric } from '../../adapters/interfaces/IMetricsAdapter';
import { OptimizelyDecision } from '../../services/interfaces/IDecisionService';
import { MockLoggerAdapter } from '../test-utils/MockLoggerAdapter';
import { MockMetricsAdapter } from '../test-utils/MockMetricsAdapter';

interface MockRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: any;
}

// Simple MockRequestAdapter to use until we fix the other version
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
  
  async getBody(): Promise<any> {
    if (!this.req.body) return null;
    
    try {
      return typeof this.req.body === 'string' ? JSON.parse(this.req.body) : this.req.body;
    } catch (error) {
      // Not JSON, return the raw string
      return this.req.body;
    }
  }
  
  getNativeRequest<T = unknown>(): T {
    // Return this adapter instance as the native request
    return this as unknown as T;
  }
}

describe('Cookie Integration', () => {
  // Mock dependencies
  const mockDecisionService = {
    getDecision: vi.fn(),
    getAllDecisions: vi.fn(),
    decide: vi.fn()
  };
  
  const mockEventService = {
    createEvent: vi.fn(),
    trackEvent: vi.fn(),
    flushEvents: vi.fn()
  };
  
  const mockLogger = new MockLoggerAdapter();
  const mockCache = { get: vi.fn(), set: vi.fn() };
  const mockEdgeMode = { getIntegration: vi.fn() };
  const mockMetrics = new MockMetricsAdapter();
  
  let cookieService: CookieService;
  let requestHandler: RequestHandler;
  
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Create fresh instances for each test
    cookieService = new CookieService(mockLogger);
    
    requestHandler = new RequestHandler(
      mockDecisionService as any,
      mockEventService as any,
      mockLogger,
      mockCache as any,
      mockEdgeMode as any,
      mockMetrics,
      cookieService
    );
  });
  
  it('should extract visitor ID from cookies', async () => {
    // Create a mock request with cookies
    const mockRequest = new MockRequestAdapter({
      method: 'GET',
      url: 'https://example.com/decide?flagKey=test-flag&userId=test-user',
      headers: {
        'cookie': 'optly_edge_visitor_id=cookie-visitor-id; other=value'
      }
    });
    
    // Configure decision service to return a valid decision
    const mockOptlyDecision: Partial<OptimizelyDecision> = {
      flagKey: 'test-flag',
      enabled: true,
      variationKey: 'variation-a',
      ruleKey: 'rule-1',
      variables: {},
      reasons: []
    };
    
    mockDecisionService.getDecision.mockResolvedValueOnce(mockOptlyDecision);
    
    // Call the request handler
    const response = await requestHandler.handleRequest(mockRequest);
    
    // Check that the visitor ID from the cookie was used
    expect(mockDecisionService.getDecision).toHaveBeenCalledWith(
      'cookie-visitor-id', // Should use cookie-based ID instead of query param
      'test-flag',
      expect.any(Object)
    );
    
    // Verify that decision succeeded
    expect(response.status).toBe(200);
  });
  
  it('should persist decisions in cookies', async () => {
    // Create a mock request without cookies initially
    const mockRequest = new MockRequestAdapter({
      method: 'GET',
      url: 'https://example.com/decide?flagKey=test-flag&userId=test-user',
      headers: {}
    });
    
    // Configure decision service to return a valid decision
    const testDecision: Partial<OptimizelyDecision> = {
      flagKey: 'test-flag',
      enabled: true,
      variationKey: 'variation-a',
      ruleKey: 'rule-1',
      variables: {},
      reasons: []
    };
    
    mockDecisionService.getDecision.mockResolvedValueOnce(testDecision);
    
    // Call the request handler
    const response = await requestHandler.handleRequest(mockRequest);
    
    // Check that the response includes Set-Cookie headers
    const setCookieHeader = response.headers['Set-Cookie'];
    expect(setCookieHeader).toBeDefined();
    
    // Should contain both visitor ID and decisions cookies
    const cookieStr = Array.isArray(setCookieHeader) ? setCookieHeader.join('; ') : String(setCookieHeader);
    expect(cookieStr).toContain('optly_edge_visitor_id');
    expect(cookieStr).toContain('optly_edge_decisions');
    
    // Verify the decision was included in the response
    expect(response.status).toBe(200);
  });
  
  it('should use previously persisted decisions for sticky bucketing', async () => {
    // Create a mock request with decision cookies
    const previousDecision: Partial<OptimizelyDecision> = {
      flagKey: 'test-flag',
      enabled: true,
      variationKey: 'persisted-variation',
      ruleKey: 'rule-1',
      variables: {},
      reasons: []
    };
    
    // Create serialized cookie value
    const serializedDecisions = btoa(JSON.stringify({ 'test-flag': previousDecision }));
    
    // Create a mock request with the decision cookie
    const mockRequest = new MockRequestAdapter({
      method: 'GET',
      url: 'https://example.com/decide?flagKey=test-flag&userId=test-user',
      headers: {
        'cookie': `optly_edge_decisions=${serializedDecisions}; optly_edge_visitor_id=test-user`
      }
    });
    
    // The decision service shouldn't be called for previously saved decisions,
    // but we'll mock it anyway in case it is called
    const newDecision: Partial<OptimizelyDecision> = {
      flagKey: 'test-flag',
      enabled: true,
      variationKey: 'new-variation', // This should NOT be used due to sticky bucketing
      ruleKey: 'rule-2',
      variables: {},
      reasons: []
    };
    
    mockDecisionService.getDecision.mockResolvedValueOnce(newDecision);
    
    // Call the request handler
    const response = await requestHandler.handleRequest(mockRequest);
    
    // Verify the response
    expect(response.status).toBe(200);
    
    // Parse the response body
    const responseBody = JSON.parse(response.body as string);
    
    // Should contain the persisted decision, not the new one from the decision service
    expect(responseBody.variationKey).toBe('persisted-variation');
  });
}); 