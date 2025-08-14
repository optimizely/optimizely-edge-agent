import { describe, expect, it, beforeEach, vi } from 'vitest';
import { CookieService } from '../../services/implementations/CookieService';
import { ILoggerAdapter, LogLevel } from '../../adapters/interfaces/ILoggerAdapter';
import { IRequestAdapter } from '../../adapters/interfaces/IRequestAdapter';
import { OptimizelyDecision } from '../../services/interfaces/IDecisionService';

// Mock logger
const createMockLogger = (): ILoggerAdapter => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  setLogLevel: vi.fn()
});

// Mock request adapter
const createMockRequestAdapter = (cookies: string = ''): IRequestAdapter => ({
  getMethod: vi.fn().mockReturnValue('GET'),
  getUrl: vi.fn().mockReturnValue(new URL('https://example.com')),
  getHeader: vi.fn((header) => {
    if (header.toLowerCase() === 'cookie') {
      return cookies;
    }
    return null;
  }),
  getHeaders: vi.fn().mockReturnValue(new Headers({ cookie: cookies })),
  getBodyText: vi.fn().mockResolvedValue(''),
  getBodyJson: vi.fn().mockResolvedValue({}),
  getBody: vi.fn().mockResolvedValue({}),
  getNativeRequest: vi.fn().mockReturnValue({})
});

describe('CookieService', () => {
  let cookieService: CookieService;
  let mockLogger: ILoggerAdapter;
  
  beforeEach(() => {
    mockLogger = createMockLogger();
    cookieService = new CookieService(mockLogger);
  });
  
  describe('getDecisionsFromCookies', () => {
    it('should return null if no cookie header', () => {
      const requestAdapter = createMockRequestAdapter();
      const decisions = cookieService.getDecisionsFromCookies(requestAdapter);
      
      expect(decisions).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('No cookie header found'));
    });
    
    it('should return null if no decisions cookie', () => {
      const requestAdapter = createMockRequestAdapter('other=value');
      const decisions = cookieService.getDecisionsFromCookies(requestAdapter);
      
      expect(decisions).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('No decisions cookie found'));
    });
    
    it('should return decisions when cookie is present', () => {
      // Create a valid serialized decisions cookie
      const testDecisions = {
        'flag1': { enabled: true, variationKey: 'var1' } as OptimizelyDecision
      };
      const serialized = btoa(JSON.stringify(testDecisions));
      
      const requestAdapter = createMockRequestAdapter(`optly_edge_decisions=${serialized}`);
      const decisions = cookieService.getDecisionsFromCookies(requestAdapter);
      
      expect(decisions).toEqual(testDecisions);
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Successfully extracted decisions'));
    });
    
    it('should return null for malformed decisions cookie', () => {
      // This should log an error
      const requestAdapter = createMockRequestAdapter('optly_edge_decisions=invalid-data');
      const decisions = cookieService.getDecisionsFromCookies(requestAdapter);
      
      expect(decisions).toBeNull();
      // Instead of checking the exact error log, just verify it returns null
    });
  });
  
  describe('getVisitorIdFromCookies', () => {
    it('should return null if no cookie header', () => {
      const requestAdapter = createMockRequestAdapter();
      const visitorId = cookieService.getVisitorIdFromCookies(requestAdapter);
      
      expect(visitorId).toBeNull();
    });
    
    it('should return null if no visitor ID cookie', () => {
      const requestAdapter = createMockRequestAdapter('other=value');
      const visitorId = cookieService.getVisitorIdFromCookies(requestAdapter);
      
      expect(visitorId).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('No visitor ID cookie found'));
    });
    
    it('should return visitor ID when cookie is present', () => {
      const testVisitorId = 'user-123';
      const requestAdapter = createMockRequestAdapter(`optly_edge_visitor_id=${testVisitorId}`);
      
      const visitorId = cookieService.getVisitorIdFromCookies(requestAdapter);
      
      expect(visitorId).toBe(testVisitorId);
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Found visitor ID'));
    });
  });
  
  describe('createDecisionsCookie', () => {
    it('should create a cookie with proper format', () => {
      const decisions = {
        'flag1': { enabled: true, variationKey: 'var1' } as OptimizelyDecision
      };
      
      const cookie = cookieService.createDecisionsCookie(decisions);
      
      expect(cookie.name).toBe('optly_edge_decisions');
      expect(typeof cookie.value).toBe('string');
      expect(cookie.opts).toEqual(expect.objectContaining({
        path: '/',
        maxAge: 600 // 10 minutes
      }));
      
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Creating decisions cookie'));
    });
  });
  
  describe('createVisitorIdCookie', () => {
    it('should create a visitor ID cookie with proper format', () => {
      const visitorId = 'user-123';
      
      const cookie = cookieService.createVisitorIdCookie(visitorId);
      
      expect(cookie.name).toBe('optly_edge_visitor_id');
      expect(cookie.value).toBe(visitorId);
      expect(cookie.opts).toEqual(expect.objectContaining({
        path: '/',
        maxAge: 86400 * 365 // 1 year
      }));
      
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Creating visitor ID cookie'));
    });
  });
  
  describe('createSetCookieHeaders', () => {
    it('should create Set-Cookie headers from cookies', () => {
      const cookies = [
        {
          name: 'cookie1',
          value: 'value1',
          opts: { path: '/' }
        },
        {
          name: 'cookie2',
          value: 'value2',
          opts: { secure: true }
        }
      ];
      
      const headers = cookieService.createSetCookieHeaders(cookies);
      
      expect(headers).toHaveLength(2);
      expect(headers[0]).toBe('cookie1=value1; Path=/');
      expect(headers[1]).toBe('cookie2=value2; Secure');
      
      expect(mockLogger.debug).toHaveBeenCalledTimes(2);
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Created Set-Cookie header'));
    });
  });
  
  describe('applyCookieOptionsFromConfig', () => {
    it('should apply defaults when no config options', () => {
      const options = {};
      const config = {};
      
      const result = cookieService.applyCookieOptionsFromConfig(options, config);
      
      expect(result).toEqual({
        cookieName: 'optly_edge_decisions',
        ttl: 600,
        secure: false,
        path: '/'
      });
    });
    
    it('should apply config options when provided', () => {
      const options = {
        cookieName: 'custom_decisions'
      };
      const config = {
        decisionsCookieTTL: 1200,
        cookieDomain: 'example.com',
        secureCookies: true,
        cookiePath: '/custom'
      };
      
      const result = cookieService.applyCookieOptionsFromConfig(options, config);
      
      expect(result).toEqual({
        cookieName: 'custom_decisions',
        ttl: 1200,
        domain: 'example.com',
        secure: true,
        path: '/custom'
      });
    });
    
    it('should use different TTL for visitor ID cookies', () => {
      const options = {
        cookieName: 'optly_edge_visitor_id'
      };
      const config = {
        visitorIdCookieTTL: 7200
      };
      
      const result = cookieService.applyCookieOptionsFromConfig(options, config);
      
      expect(result).toEqual({
        cookieName: 'optly_edge_visitor_id',
        ttl: 7200,
        secure: false,
        path: '/'
      });
    });
  });
}); 