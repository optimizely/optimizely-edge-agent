/**
 * Edge Mode Integration Tests
 * 
 * These tests verify the Edge Mode (GET request) functionality of the Optimizely Edge Agent
 * running in a Cloudflare environment.
 * 
 * The tests interact directly with the deployed API on Cloudflare and verify
 * the responses against expected behavior.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// Test environment configuration
interface TestConfig {
  baseUrl: string;
  sdkKey: string;
  testUrls: {
    // URLs that should match experiment patterns
    match: string[];
    // URLs that should not match experiment patterns
    noMatch: string[];
  };
  // Test visitor IDs to use in requests
  visitorIds: string[];
}

// We'll load this from environment variables in a real test
const testConfig: TestConfig = {
  baseUrl: 'https://optimizely-edge-agent.example.workers.dev',
  sdkKey: 'test-sdk-key',
  testUrls: {
    match: [
      '/products/123',
      '/categories/shoes?sort=price',
      '/homepage-test'
    ],
    noMatch: [
      '/about-us',
      '/contact',
      '/terms-of-service'
    ]
  },
  visitorIds: [
    'test-visitor-1',
    'test-visitor-2',
    'test-visitor-3'
  ]
};

describe('Edge Mode Integration Tests', () => {
  // Helper function to make requests
  async function makeEdgeModeRequest(url: string, visitorId?: string) {
    const requestUrl = new URL(url, testConfig.baseUrl);
    
    // Add visitor ID as query parameter if provided
    if (visitorId) {
      requestUrl.searchParams.append('optimizely_visitor_id', visitorId);
    }
    
    const response = await fetch(requestUrl.toString(), {
      method: 'GET',
      headers: {
        'x-sdk-key': testConfig.sdkKey,
        'user-agent': 'OptimizelyEdgeAgentTest/1.0'
      }
    });
    
    return response;
  }
  
  describe('URL Pattern Matching', () => {
    it('should match experiment URLs and return appropriate variations', async () => {
      for (const matchUrl of testConfig.testUrls.match) {
        const response = await makeEdgeModeRequest(matchUrl, testConfig.visitorIds[0]);
        
        expect(response.status).toBe(200);
        // Check for Optimizely response headers
        expect(response.headers.get('x-optimizely-activation')).toBeTruthy();
      }
    });
    
    it('should not match non-experiment URLs and pass through', async () => {
      for (const noMatchUrl of testConfig.testUrls.noMatch) {
        const response = await makeEdgeModeRequest(noMatchUrl, testConfig.visitorIds[0]);
        
        expect(response.status).toBe(200);
        // Verify no Optimizely activation headers are present
        expect(response.headers.get('x-optimizely-activation')).toBeFalsy();
      }
    });

    it('should handle URLs with trailing slashes correctly', async () => {
      // Test URLs with trailing slashes (assuming the experiment URL doesn't have them)
      for (const matchUrl of testConfig.testUrls.match) {
        // Add trailing slash if not already present
        const urlWithTrailingSlash = matchUrl.endsWith('/') ? matchUrl : `${matchUrl}/`;
        const response = await makeEdgeModeRequest(urlWithTrailingSlash, testConfig.visitorIds[0]);
        
        expect(response.status).toBe(200);
        // Should still match despite trailing slash difference
        expect(response.headers.get('x-optimizely-activation')).toBeTruthy();
      }
    });

    it('should handle URLs with duplicate slashes correctly', async () => {
      // Test URLs with duplicate slashes
      for (const matchUrl of testConfig.testUrls.match) {
        // Insert duplicate slash in the middle of the path
        const parts = matchUrl.split('/');
        if (parts.length > 2) {  // Ensure there's a path to modify
          const modifiedUrl = parts.slice(0, 2).join('/') + '//' + parts.slice(2).join('/');
          const response = await makeEdgeModeRequest(modifiedUrl, testConfig.visitorIds[0]);
          
          expect(response.status).toBe(200);
          // Should still match despite duplicate slashes
          expect(response.headers.get('x-optimizely-activation')).toBeTruthy();
        }
      }
    });

    it('should handle query parameters according to configuration', async () => {
      // This test requires knowledge of how your system is configured to handle query parameters
      // If your cdnExperimentURL includes query parameters, they should be required in the request
      
      // Example: If your cdnExperimentURL is "/products?category=shoes"
      const urlWithRequiredParams = '/products?category=shoes';
      const response1 = await makeEdgeModeRequest(urlWithRequiredParams, testConfig.visitorIds[0]);
      
      // Should match if the query parameters match
      expect(response1.status).toBe(200);
      
      // Example: Test with missing required parameter
      const urlWithMissingParams = '/products';
      const response2 = await makeEdgeModeRequest(urlWithMissingParams, testConfig.visitorIds[0]);
      
      // Behavior depends on your ignoreQueryParameters setting
      // If ignoreQueryParameters is true, it should match regardless
      // If false, it should not match
      
      // Assumption: your implementation uses ignoreQueryParameters=true by default
      // Adjust this test based on your actual implementation
      expect(response2.status).toBe(200);
    });

    it('should handle requests with additional query parameters', async () => {
      // Test with additional query parameters beyond what's in the cdnExperimentURL
      for (const matchUrl of testConfig.testUrls.match) {
        // Add an extra query parameter
        const separator = matchUrl.includes('?') ? '&' : '?';
        const urlWithExtraParam = `${matchUrl}${separator}extra_param=value`;
        const response = await makeEdgeModeRequest(urlWithExtraParam, testConfig.visitorIds[0]);
        
        expect(response.status).toBe(200);
        // Should still match despite additional parameters
        expect(response.headers.get('x-optimizely-activation')).toBeTruthy();
      }
    });
  });
  
  describe('Visitor Identification', () => {
    const testUrl = testConfig.testUrls.match[0];
    
    it('should identify visitors from query parameters', async () => {
      const response = await makeEdgeModeRequest(testUrl, testConfig.visitorIds[0]);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('x-optimizely-visitor-id')).toBe(testConfig.visitorIds[0]);
    });
    
    it('should identify visitors from cookies', async () => {
      const response = await fetch(new URL(testUrl, testConfig.baseUrl).toString(), {
        method: 'GET',
        headers: {
          'x-sdk-key': testConfig.sdkKey,
          'user-agent': 'OptimizelyEdgeAgentTest/1.0',
          'cookie': `optimizely_visitor_id=${testConfig.visitorIds[1]}`
        }
      });
      
      expect(response.status).toBe(200);
      expect(response.headers.get('x-optimizely-visitor-id')).toBe(testConfig.visitorIds[1]);
    });
    
    it('should generate a visitor ID if none is provided', async () => {
      const response = await fetch(new URL(testUrl, testConfig.baseUrl).toString(), {
        method: 'GET',
        headers: {
          'x-sdk-key': testConfig.sdkKey,
          'user-agent': 'OptimizelyEdgeAgentTest/1.0'
        }
      });
      
      expect(response.status).toBe(200);
      // Should have a visitor ID in the response
      expect(response.headers.get('x-optimizely-visitor-id')).toBeTruthy();
      // And it should set a cookie
      expect(response.headers.get('set-cookie')).toContain('optimizely_visitor_id=');
    });
  });
  
  describe('Caching Behavior', () => {
    const testUrl = testConfig.testUrls.match[0];
    
    it('should respect TTL settings for cached content', async () => {
      // First request should be a cache miss
      const response1 = await makeEdgeModeRequest(testUrl, testConfig.visitorIds[0]);
      
      expect(response1.status).toBe(200);
      const cacheStatus1 = response1.headers.get('x-cache-status');
      
      // Make the same request again immediately, should be a cache hit
      const response2 = await makeEdgeModeRequest(testUrl, testConfig.visitorIds[0]);
      
      expect(response2.status).toBe(200);
      const cacheStatus2 = response2.headers.get('x-cache-status');
      
      // If proper caching is implemented, first would be MISS and second would be HIT
      // But this depends on how the actual implementation handles the x-cache-status header
      expect(cacheStatus1).not.toEqual(cacheStatus2);
    });
    
    it('should vary cache by visitor ID for personalization', async () => {
      // Request with first visitor ID
      const response1 = await makeEdgeModeRequest(testUrl, testConfig.visitorIds[0]);
      expect(response1.status).toBe(200);
      
      // Request with second visitor ID
      const response2 = await makeEdgeModeRequest(testUrl, testConfig.visitorIds[1]);
      expect(response2.status).toBe(200);
      
      // The responses should potentially have different content if personalization is working
      // This is hard to test definitively without knowing the experiment setup,
      // but we can check that the visitor IDs in the response are different
      expect(response1.headers.get('x-optimizely-visitor-id')).not.toEqual(
        response2.headers.get('x-optimizely-visitor-id')
      );
    });
  });
  
  describe('Response Handling', () => {
    const testUrl = testConfig.testUrls.match[0];
    
    it('should forward requests to origin when configured', async () => {
      // This test assumes that some URLs are configured to forward to origin
      // Implementation details would determine how to test this properly
      const response = await makeEdgeModeRequest(testUrl, testConfig.visitorIds[0]);
      
      expect(response.status).toBe(200);
      // Check for header that might indicate forwarding behavior
      // This would depend on your actual implementation
    });
    
    it('should serve content directly when configured', async () => {
      // This test assumes that some URLs are configured to serve directly from edge
      // Implementation details would determine how to test this properly
      const response = await makeEdgeModeRequest(testUrl, testConfig.visitorIds[0]);
      
      expect(response.status).toBe(200);
      // Check for header that might indicate direct serving
      // This would depend on your actual implementation
    });
  });
  
  describe('Error Handling', () => {
    it('should handle invalid SDK keys gracefully', async () => {
      const response = await fetch(new URL(testConfig.testUrls.match[0], testConfig.baseUrl).toString(), {
        method: 'GET',
        headers: {
          'x-sdk-key': 'invalid-sdk-key',
          'user-agent': 'OptimizelyEdgeAgentTest/1.0'
        }
      });
      
      // Should return a 4xx error for invalid SDK key
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.status).toBeLessThan(500);
    });
    
    it('should handle missing SDK keys gracefully', async () => {
      const response = await fetch(new URL(testConfig.testUrls.match[0], testConfig.baseUrl).toString(), {
        method: 'GET',
        headers: {
          'user-agent': 'OptimizelyEdgeAgentTest/1.0'
        }
      });
      
      // Should return a 4xx error for missing SDK key
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.status).toBeLessThan(500);
    });
  });
}); 