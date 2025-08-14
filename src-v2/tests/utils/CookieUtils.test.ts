import { describe, expect, it } from 'vitest';
import { 
  parseCookie, 
  createCookie, 
  serializeDecisions, 
  deserializeDecisions, 
  createDecisionsCookie,
  createVisitorIdCookie
} from '../../utils/CookieUtils';

describe('CookieUtils', () => {
  describe('parseCookie', () => {
    it('should parse a simple cookie string', () => {
      const cookieStr = 'name=value';
      const parsed = parseCookie(cookieStr);
      
      expect(parsed).toEqual({ name: 'value' });
    });
    
    it('should parse multiple cookies', () => {
      const cookieStr = 'name=value; another=123; third=hello%20world';
      const parsed = parseCookie(cookieStr);
      
      expect(parsed).toEqual({
        name: 'value',
        another: '123',
        third: 'hello world' // URL decoded
      });
    });
    
    it('should handle cookies without values', () => {
      const cookieStr = 'name=; another=value';
      const parsed = parseCookie(cookieStr);
      
      expect(parsed).toEqual({
        name: '',
        another: 'value'
      });
    });
    
    it('should handle cookies with special characters', () => {
      const cookieStr = 'name=value%20with%20spaces; special=%21%40%23%24%25';
      const parsed = parseCookie(cookieStr);
      
      expect(parsed).toEqual({
        name: 'value with spaces',
        special: '!@#$%'
      });
    });
    
    it('should return an empty object for empty string', () => {
      expect(parseCookie('')).toEqual({});
    });
    
    it('should return an empty object for null/undefined', () => {
      // @ts-ignore - Testing null explicitly
      expect(parseCookie(null)).toEqual({});
      // @ts-ignore - Testing undefined explicitly
      expect(parseCookie(undefined)).toEqual({});
    });
  });
  
  describe('createCookie', () => {
    it('should create a basic cookie string', () => {
      const cookie = createCookie('name', 'value');
      expect(cookie).toBe('name=value');
    });
    
    it('should create a cookie with path', () => {
      const cookie = createCookie('name', 'value', { path: '/' });
      expect(cookie).toBe('name=value; Path=/');
    });
    
    it('should create a cookie with all options', () => {
      const expires = new Date('2025-01-01T00:00:00Z');
      const cookie = createCookie('name', 'value', {
        path: '/path',
        domain: 'example.com',
        maxAge: 3600,
        expires,
        secure: true,
        httpOnly: true,
        sameSite: 'Strict'
      });
      
      expect(cookie).toBe(
        'name=value; Path=/path; Domain=example.com; Max-Age=3600; ' +
        `Expires=${expires.toUTCString()}; Secure; HttpOnly; SameSite=Strict`
      );
    });
    
    it('should properly encode values', () => {
      const cookie = createCookie('name', 'value with spaces and !@#$%');
      expect(cookie).toBe('name=value%20with%20spaces%20and%20!%40%23%24%25');
    });
    
    it('should throw an error if name is not provided', () => {
      // @ts-ignore - Testing empty name explicitly
      expect(() => createCookie('', 'value')).toThrow('Cookie name is required');
    });
  });
  
  describe('serializeDecisions and deserializeDecisions', () => {
    it('should serialize and deserialize decisions', () => {
      const decisions = {
        'flag1': { enabled: true, variationKey: 'var1' },
        'flag2': { enabled: false, variationKey: 'var2' }
      };
      
      const serialized = serializeDecisions(decisions);
      expect(typeof serialized).toBe('string');
      
      const deserialized = deserializeDecisions(serialized);
      expect(deserialized).toEqual(decisions);
    });
    
    it('should handle empty objects', () => {
      const decisions = {};
      
      const serialized = serializeDecisions(decisions);
      expect(typeof serialized).toBe('string');
      
      const deserialized = deserializeDecisions(serialized);
      expect(deserialized).toEqual(decisions);
    });
    
    it('should return null for invalid serialized value', () => {
      expect(deserializeDecisions('invalid-base64')).toBeNull();
    });
  });
  
  describe('createDecisionsCookie', () => {
    it('should create a cookie with default options', () => {
      const decisions = {
        'flag1': { enabled: true, variationKey: 'var1' }
      };
      
      const cookie = createDecisionsCookie(decisions);
      
      expect(cookie.name).toBe('optly_edge_decisions');
      expect(typeof cookie.value).toBe('string');
      expect(cookie.opts).toEqual({
        path: '/',
        maxAge: 600 // 10 minutes
      });
      
      // Verify we can deserialize the value
      const serialized = cookie.value;
      const deserialized = deserializeDecisions(serialized);
      expect(deserialized).toEqual(decisions);
    });
    
    it('should create a cookie with custom options', () => {
      const decisions = {
        'flag1': { enabled: true, variationKey: 'var1' }
      };
      
      const cookie = createDecisionsCookie(decisions, {
        cookieName: 'custom_decisions',
        ttl: 3600,
        domain: 'example.com',
        secure: true,
        path: '/custom'
      });
      
      expect(cookie.name).toBe('custom_decisions');
      expect(typeof cookie.value).toBe('string');
      expect(cookie.opts).toEqual({
        path: '/custom',
        maxAge: 3600,
        domain: 'example.com',
        secure: true
      });
    });
  });
  
  describe('createVisitorIdCookie', () => {
    it('should create a cookie with default options', () => {
      const visitorId = 'user-123';
      
      const cookie = createVisitorIdCookie(visitorId);
      
      expect(cookie.name).toBe('optly_edge_visitor_id');
      expect(cookie.value).toBe(visitorId);
      expect(cookie.opts).toEqual({
        path: '/',
        maxAge: 86400 * 365 // 1 year
      });
    });
    
    it('should create a cookie with custom options', () => {
      const visitorId = 'user-123';
      
      const cookie = createVisitorIdCookie(visitorId, {
        cookieName: 'custom_visitor_id',
        ttl: 7200,
        domain: 'example.com',
        secure: true,
        path: '/custom'
      });
      
      expect(cookie.name).toBe('custom_visitor_id');
      expect(cookie.value).toBe(visitorId);
      expect(cookie.opts).toEqual({
        path: '/custom',
        maxAge: 7200,
        domain: 'example.com',
        secure: true
      });
    });
  });
}); 