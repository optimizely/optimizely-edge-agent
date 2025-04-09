import { describe, it, expect } from 'vitest';
import { URLMatcher } from '../../services/implementations/URLMatcher';

describe('URLMatcher', () => {
  const urlMatcher = new URLMatcher();

  describe('normalizePath', () => {
    it('should handle empty paths', () => {
      expect(urlMatcher.normalizePath('')).toBe('/');
      expect(urlMatcher.normalizePath(null as any)).toBe('/');
      expect(urlMatcher.normalizePath(undefined as any)).toBe('/');
    });

    it('should ensure paths start with /', () => {
      expect(urlMatcher.normalizePath('test')).toBe('/test');
      expect(urlMatcher.normalizePath('test/path')).toBe('/test/path');
    });

    it('should remove trailing slashes unless root path', () => {
      expect(urlMatcher.normalizePath('/')).toBe('/');
      expect(urlMatcher.normalizePath('/test/')).toBe('/test');
      expect(urlMatcher.normalizePath('/test/path/')).toBe('/test/path');
    });

    it('should remove query strings if present', () => {
      expect(urlMatcher.normalizePath('/test?param=value')).toBe('/test');
      expect(urlMatcher.normalizePath('/test/?param=value')).toBe('/test');
    });
  });

  describe('matchesPath', () => {
    it('should match exact paths', () => {
      expect(urlMatcher.matchesPath('example.com/test', '/test')).toBe(true);
      expect(urlMatcher.matchesPath('https://example.com/test', '/test')).toBe(true);
      expect(urlMatcher.matchesPath('example.com/test', 'test')).toBe(true);
    });

    it('should normalize paths before matching', () => {
      expect(urlMatcher.matchesPath('example.com/test/', '/test')).toBe(true);
      expect(urlMatcher.matchesPath('example.com/test', '/test/')).toBe(true);
    });

    it('should not match different paths', () => {
      expect(urlMatcher.matchesPath('example.com/test', '/other')).toBe(false);
      expect(urlMatcher.matchesPath('example.com/test/child', '/test')).toBe(false);
    });

    it('should handle regex patterns when isRegex is true', () => {
      expect(urlMatcher.matchesPath('example.com/test123', '^/test\\d+$', true)).toBe(true);
      expect(urlMatcher.matchesPath('example.com/test/123', '^/test/\\d+$', true)).toBe(true);
      expect(urlMatcher.matchesPath('example.com/other', '^/test.*$', true)).toBe(false);
    });

    it('should handle invalid URLs gracefully', () => {
      expect(urlMatcher.matchesPath('', '/test')).toBe(false);
      expect(urlMatcher.matchesPath('invalid\\url', '/test')).toBe(false);
    });
  });

  describe('matchesQueryParams', () => {
    it('should match when required params are present', () => {
      expect(urlMatcher.matchesQueryParams('example.com?param1=value1', ['param1'])).toBe(true);
      expect(urlMatcher.matchesQueryParams('example.com?param1=value1&param2=value2', ['param1', 'param2'])).toBe(true);
    });

    it('should not match when required params are missing', () => {
      expect(urlMatcher.matchesQueryParams('example.com', ['param1'])).toBe(false);
      expect(urlMatcher.matchesQueryParams('example.com?param1=value1', ['param1', 'param2'])).toBe(false);
    });

    it('should ignore specified parameters', () => {
      expect(
        urlMatcher.matchesQueryParams(
          'example.com?param1=value1&param2=value2&param3=value3',
          ['param1'],
          ['param2', 'param3']
        )
      ).toBe(true);
    });

    it('should handle URLs with no query parameters', () => {
      expect(urlMatcher.matchesQueryParams('example.com', [])).toBe(true);
      expect(urlMatcher.matchesQueryParams('example.com/path', [], ['param1'])).toBe(true);
    });

    it('should handle invalid URLs gracefully', () => {
      expect(urlMatcher.matchesQueryParams('', ['param1'])).toBe(false);
      expect(urlMatcher.matchesQueryParams('invalid\\url', ['param1'])).toBe(false);
    });
  });

  describe('matches', () => {
    it('should match exact URLs', () => {
      expect(urlMatcher.matches('example.com/test', '/test')).toBe(true);
      expect(urlMatcher.matches('https://example.com/test', '/test')).toBe(true);
    });

    it('should match URLs with regex when isRegex option is true', () => {
      expect(urlMatcher.matches('example.com/test123', '^/test\\d+$', { isRegex: true })).toBe(true);
      expect(urlMatcher.matches('example.com/test', '^/other.*$', { isRegex: true })).toBe(false);
    });

    it('should match URLs considering query parameters', () => {
      expect(urlMatcher.matches(
        'example.com/test?param1=value1&param2=value2',
        '/test',
        { requiredQueryParams: ['param1'] }
      )).toBe(true);
      
      expect(urlMatcher.matches(
        'example.com/test?param1=value1',
        '/test',
        { requiredQueryParams: ['param1', 'param2'] }
      )).toBe(false);
    });

    it('should ignore specified query parameters', () => {
      expect(urlMatcher.matches(
        'example.com/test?param1=value1&param2=value2',
        '/test',
        { requiredQueryParams: ['param1'], ignoreQueryParams: ['param2'] }
      )).toBe(true);
    });

    it('should support case-insensitive matching with regex', () => {
      expect(urlMatcher.matches(
        'example.com/TEST',
        'test', 
        { isRegex: true, ignoreCase: true }
      )).toBe(true);
    });

    it('should handle invalid URLs gracefully', () => {
      expect(urlMatcher.matches('', '/test')).toBe(false);
      expect(urlMatcher.matches('invalid\\url', '/test')).toBe(false);
    });
  });
}); 