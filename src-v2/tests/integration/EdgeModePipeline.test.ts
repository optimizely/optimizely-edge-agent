/**
 * Edge Mode Pipeline Integration Tests
 * 
 * This file contains end-to-end tests for the Edge Mode request processing pipeline.
 * These tests REQUIRE a live deployment and a correctly configured datafile with
 * cdnVariationSettings to trigger specific Edge Mode behaviors.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { EDGE_AGENT_URL, OPTIMIZELY_SDK_KEY, getEdgeUrl } from './config';
import fetch from 'node-fetch';

// Test configuration
const BASE_URL = getEdgeUrl();
const SDK_KEY = OPTIMIZELY_SDK_KEY;

// Skip tests if environment variables for live testing are not set
const shouldSkipLiveTests = !process.env.EDGE_AGENT_URL || !process.env.SDK_KEY || !BASE_URL || BASE_URL.includes('example');

describe('Edge Mode Pipeline Integration Tests', () => {

  beforeAll(() => {
    if (shouldSkipLiveTests) {
      console.warn('⚠️ Skipping Edge Mode Pipeline tests. Environment variables (EDGE_AGENT_URL, SDK_KEY) not set for live testing.');
    }
    console.log(`🧪 Running Edge Mode Pipeline tests against: ${BASE_URL} using SDK Key: ${SDK_KEY}`);
  });

  // Example test - relies on specific live datafile configuration
  (shouldSkipLiveTests ? it.skip : it)('should trigger configured Edge Mode behavior for a matching URL', async () => {
    // ASSUMPTION: The live datafile for SDK_KEY contains a cdnVariationSetting where:
    // - cdnExperimentURL matches '/edge-test/match'
    // - It's configured to add a specific response header, e.g., 'X-Edge-Test: matched'

    const testPath = '/edge-test/match'; // This path MUST be configured in the live datafile
    const expectedHeaderName = 'x-edge-test'; // Header name (lowercase)
    const expectedHeaderValue = 'matched'; // Expected header value

    let response;
    try {
      response = await fetch(`${BASE_URL}${testPath}`, {
        method: 'GET',
      });
    } catch (error) {
      console.error('Error fetching test URL:', error);
      // Fail the test if the fetch itself fails
      expect(error).toBeUndefined(); 
      return; 
    }

    // Log response status for debugging
    console.log(`Response status for ${testPath}: ${response.status}`);

    // Assert basic success
    expect(response.ok).toBe(true); // Check if status is 2xx

    // Assert the specific behavior configured in the live datafile
    // This header check is an EXAMPLE - adjust based on actual live configuration
    const headerValue = response.headers.get(expectedHeaderName);
    console.log(`Header '${expectedHeaderName}': ${headerValue}`);
    expect(headerValue).toBe(expectedHeaderValue);

    // Add more assertions based on the specific configuration for this path
    // e.g., check status code, response body transformations, etc.
  });

  (shouldSkipLiveTests ? it.skip : it)('should NOT trigger Edge Mode behavior for a non-matching URL', async () => {
    // ASSUMPTION: No specific Edge Mode rule targets '/edge-test/no-match' in the live datafile.
    // The request might be forwarded to origin or handled by a default CDN rule.
    const testPath = '/edge-test/no-match';
    const specificEdgeHeader = 'x-edge-test'; // Header added by the previous test's rule

    const response = await fetch(`${BASE_URL}${testPath}`, { method: 'GET' });
    console.log(`Response status for ${testPath}: ${response.status}`);
    expect(response.ok).toBe(true); // Assuming default behavior is successful

    // Assert that specific Edge Mode headers ARE NOT present
    expect(response.headers.has(specificEdgeHeader)).toBe(false);
  });

  (shouldSkipLiveTests ? it.skip : it)('should forward the request to the origin when configured', async () => {
    // ASSUMPTION: Datafile configures '/edge-test/forward' with `forwardRequestToOrigin: true`
    // and points to a known origin (e.g., httpbin.org/get) that reflects request details.
    // `cacheRequestToOrigin` should be false or default.
    const testPath = '/edge-test/forward';
    // Replace with your actual known origin behavior check
    const expectedOriginIndicator = 'httpbin.org'; 

    const response = await fetch(`${BASE_URL}${testPath}?origin_test=true`, { method: 'GET' });
    console.log(`Response status for ${testPath}: ${response.status}`);
    expect(response.ok).toBe(true);

    const responseBody = await response.text();
    // Assert that the response body contains indicators from the origin
    expect(responseBody).toContain(expectedOriginIndicator);
    expect(responseBody).toContain('origin_test'); // Check if query params were forwarded
    // Verify no unexpected Edge Mode headers are added
    expect(response.headers.has('x-edge-test')).toBe(false);
  });

  (shouldSkipLiveTests ? it.skip : it)('should cache the response from the origin when configured', async () => {
    // ASSUMPTION: Datafile configures '/edge-test/forward-cache' with `forwardRequestToOrigin: true`,
    // `cacheRequestToOrigin: true`, and a `cacheTTL` (e.g., 10 seconds).
    const testPath = '/edge-test/forward-cache';
    const ttl = 10; // Assumed TTL in seconds

    // 1. First request (cache miss)
    console.log(`Making first request to ${testPath}`);
    const response1 = await fetch(`${BASE_URL}${testPath}`, { method: 'GET' });
    expect(response1.ok).toBe(true);
    const cfCacheStatus1 = response1.headers.get('cf-cache-status');
    console.log(`First request cf-cache-status: ${cfCacheStatus1}`);
    // Expect MISS or similar, depending on exact Cloudflare setup
    // expect(cfCacheStatus1).toMatch(/MISS|BYPASS|EXPIRED/);

    // 2. Wait briefly (less than TTL)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 3. Second request (cache hit)
    console.log(`Making second request to ${testPath}`);
    const response2 = await fetch(`${BASE_URL}${testPath}`, { method: 'GET' });
    expect(response2.ok).toBe(true);
    const cfCacheStatus2 = response2.headers.get('cf-cache-status');
    console.log(`Second request cf-cache-status: ${cfCacheStatus2}`);
    expect(cfCacheStatus2).toBe('HIT'); // Expect HIT

    // Verify responses are the same (or very similar)
    const body1 = await response1.text();
    const body2 = await response2.text();
    expect(body1).toEqual(body2); 
  });

  (shouldSkipLiveTests ? it.skip : it)('should apply content transformation when configured', async () => {
    // ASSUMPTION: Datafile configures '/edge-test/transform' with `transformContent` rules.
    // e.g., Adds `<meta name="edge-transformed" content="true">` to the <head>
    const testPath = '/edge-test/transform';
    const expectedTransformation = '<meta name="edge-transformed" content="true">';

    const response = await fetch(`${BASE_URL}${testPath}`, { method: 'GET' });
    console.log(`Response status for ${testPath}: ${response.status}`);
    expect(response.ok).toBe(true);

    const responseBody = await response.text();
    // Assert that the response body contains the expected transformation
    expect(responseBody).toContain(expectedTransformation);
  });

  (shouldSkipLiveTests ? it.skip : it)('should respect cacheTTL configuration', async () => {
    // ASSUMPTION: Datafile configures '/edge-test/ttl' with `cacheTTL: 5`.
    const testPath = '/edge-test/ttl';
    const ttl = 5; // Assumed TTL in seconds

    // 1. First request
    console.log(`Making first request to ${testPath}`);
    const response1 = await fetch(`${BASE_URL}${testPath}`, { method: 'GET' });
    expect(response1.ok).toBe(true);
    console.log(`First request cf-cache-status: ${response1.headers.get('cf-cache-status')}`);

    // 2. Wait longer than TTL
    console.log(`Waiting for ${ttl + 2} seconds...`);
    await new Promise(resolve => setTimeout(resolve, (ttl + 2) * 1000));

    // 3. Second request (should be cache miss/expired/revalidated)
    console.log(`Making second request to ${testPath}`);
    const response2 = await fetch(`${BASE_URL}${testPath}`, { method: 'GET' });
    expect(response2.ok).toBe(true);
    const cfCacheStatus2 = response2.headers.get('cf-cache-status');
    console.log(`Second request cf-cache-status: ${cfCacheStatus2}`);
    expect(cfCacheStatus2).not.toBe('HIT'); // Should not be a simple HIT
  });

  (shouldSkipLiveTests ? it.skip : it)('should handle ignored query parameters correctly', async () => {
    // ASSUMPTION: Datafile configures '/edge-test/ignore-params' with `ignoreQueryParams: ["ignored"]`
    const testPath = '/edge-test/ignore-params';

    console.log(`Making first request to ${testPath}?ignored=val1&kept=abc`);
    const response1 = await fetch(`${BASE_URL}${testPath}?ignored=val1&kept=abc`, { method: 'GET' });
    expect(response1.ok).toBe(true);
    const cfCacheStatus1 = response1.headers.get('cf-cache-status'); // Get cache status
    console.log(`First request cf-cache-status: ${cfCacheStatus1}`);

    await new Promise(resolve => setTimeout(resolve, 1000)); // Short wait

    console.log(`Making second request to ${testPath}?ignored=val2&kept=abc`);
    const response2 = await fetch(`${BASE_URL}${testPath}?ignored=val2&kept=abc`, { method: 'GET' });
    expect(response2.ok).toBe(true);
    const cfCacheStatus2 = response2.headers.get('cf-cache-status'); // Get cache status
    console.log(`Second request cf-cache-status: ${cfCacheStatus2}`);

    // If the first request was not cached, we can't guarantee a HIT here.
    // Instead, if caching is involved, the responses should be identical.
    // If origin forwarding is involved, the origin should ideally ignore 'ignored'.
    // A better test might involve checking if both resulted in a HIT if the first was cached.
    if (cfCacheStatus1 !== 'BYPASS' && cfCacheStatus1 !== 'DYNAMIC') {
      // Only assert HIT if the first request could have been cached
       expect(cfCacheStatus2).toBe('HIT'); 
    }
    // Check if bodies are identical as a fallback assertion
    const body1 = await response1.text();
    const body2 = await response2.text();
    expect(body1).toEqual(body2); 

  });

  (shouldSkipLiveTests ? it.skip : it)('should handle required query parameters correctly', async () => {
    // ASSUMPTION: Datafile configures '/edge-test/require-params' with `requiredQueryParams: ["req"]`
    // and adds a specific header 'X-Req-Param-Test: present' if triggered.
    const testPath = '/edge-test/require-params';
    const expectedHeader = 'x-req-param-test';

    // 1. Request with required parameter
    console.log(`Making request to ${testPath}?req=present`);
    const response1 = await fetch(`${BASE_URL}${testPath}?req=present`, { method: 'GET' });
    expect(response1.ok).toBe(true);
    expect(response1.headers.has(expectedHeader)).toBe(true); // Edge rule triggered
    expect(response1.headers.get(expectedHeader)).toBe('present');

    // 2. Request without required parameter
    console.log(`Making request to ${testPath}`);
    const response2 = await fetch(`${BASE_URL}${testPath}`, { method: 'GET' });
    expect(response2.ok).toBe(true); // Assuming it falls back gracefully
    expect(response2.headers.has(expectedHeader)).toBe(false); // Edge rule NOT triggered
  });

  (shouldSkipLiveTests ? it.skip : it)('should add or modify response headers when configured', async () => {
    // ASSUMPTION: Datafile configures '/edge-test/headers' with 
    // `responseHeaders: { "X-Custom-Header": "TestValue", "Cache-Control": "no-cache" }`
    const testPath = '/edge-test/headers';

    const response = await fetch(`${BASE_URL}${testPath}`, { method: 'GET' });
    console.log(`Response status for ${testPath}: ${response.status}`);
    expect(response.ok).toBe(true);

    // Assert custom header
    expect(response.headers.get('x-custom-header')).toBe('TestValue');
    // Assert modified cache-control
    expect(response.headers.get('cache-control')).toBe('no-cache');
  });

  // Add more test cases for different Edge Mode scenarios:
  // - Test for non-matching URLs (should not trigger edge behavior)
  // - Test for origin forwarding
  // - Test for content transformation
  // - Test for caching behavior
  // - Test for query parameter handling

}); 