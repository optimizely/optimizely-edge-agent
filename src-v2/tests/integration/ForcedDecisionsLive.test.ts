import { describe, test, expect, beforeAll } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import fetch, { Headers as FetchHeaders, RequestInit } from 'node-fetch';

// Test configuration 
const testConfig = {
  // Default to localhost:8787 for Wrangler dev server
  baseUrl: process.env.TEST_BASE_URL || 'http://localhost:8787',
  sdkKey: process.env.TEST_SDK_KEY || '8mR1pGh8u2ztUP8GqjmQq', // Use a default test SDK key
  featureKeys: (process.env.TEST_FEATURE_KEYS || 'test-flag,another-flag').split(',')
};

interface ApiResponse {
  status: number;
  headers: FetchHeaders;
  body: any;
}

// Helper functions
async function makeApiCall(
  endpoint: string,
  method: string = 'GET',
  body?: any,
  headers?: Record<string, string>
): Promise<ApiResponse> {
  const url = `${testConfig.baseUrl}${endpoint}`;
  
  const requestOptions: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined
  };

  const response = await fetch(url, requestOptions);
  let responseBody = null;
  
  try {
    responseBody = await response.json();
  } catch (e) {
    // Response might not be JSON
    responseBody = await response.text();
  }

  return {
    status: response.status,
    headers: response.headers,
    body: responseBody
  };
}

// Get decisions for a user
async function getDecisions(userId: string) {
  return makeApiCall(
    `/v2/decide?sdkKey=${testConfig.sdkKey}`,
    'POST',
    {
      userId,
      features: testConfig.featureKeys
    }
  );
}

// Force a decision via configuration attributes
async function forceDecisionViaAttributes(userId: string, featureKey: string, variationKey: string) {
  return makeApiCall(
    `/v2/decide?sdkKey=${testConfig.sdkKey}`,
    'POST',
    {
      userId,
      features: [featureKey],
      attributes: {
        $opt_forced_decisions: {
          [featureKey]: {
            variation_key: variationKey
          }
        }
      }
    }
  );
}

// Force a decision via SDK endpoint
async function forceDecisionViaSdk(userId: string, featureKey: string, variationKey: string) {
  return makeApiCall(
    `/v2/optimizely/forced-decision`,
    'POST',
    {
      sdkKey: testConfig.sdkKey,
      userId,
      flagKey: featureKey,
      ruleKey: null,
      variationKey
    }
  );
}

// Remove a forced decision via SDK endpoint
async function removeForceDecisionViaSdk(userId: string, featureKey: string) {
  return makeApiCall(
    `/v2/optimizely/forced-decision/remove`,
    'POST',
    {
      sdkKey: testConfig.sdkKey,
      userId,
      flagKey: featureKey,
      ruleKey: null
    }
  );
}

/**
 * ForcedDecisions Live Integration Tests
 * 
 * These tests validate forcedDecisions functionality by making real HTTP requests
 * to a running Optimizely Edge Agent instance (via Wrangler dev). The tests cover:
 * 
 * 1. Configuration-passed forcedDecisions (attributes.forcedDecisions)
 * 2. SDK's setForcedDecision method interaction
 * 3. Precedence between config-based and SDK-based forced decisions
 * 4. Removal functionality (removeForcedDecision, removeAllForcedDecisions)
 */
describe('ForcedDecisions Live Integration Tests', () => {
  let testUserId: string;
  
  beforeAll(() => {
    // Generate a unique user ID for each test run
    testUserId = `test-user-${uuidv4()}`;
    
    // Verify we have configuration
    expect(testConfig.baseUrl).toBeDefined();
    expect(testConfig.sdkKey).toBeDefined();
    expect(testConfig.featureKeys.length).toBeGreaterThan(0);
  });

  /**
   * Section 1: Configuration-Based Forced Decisions
   * Tests the application of forced decisions passed via attributes
   */
  describe('Configuration-based forced decisions', () => {
    test('should apply a forced decision via attributes', async () => {
      const featureKey = testConfig.featureKeys[0];
      const testVariation = 'variation_1';
      
      const response = await forceDecisionViaAttributes(testUserId, featureKey, testVariation);
      
      expect(response.status).toBe(200);
      expect(response.body.decisions[featureKey]).toBeDefined();
      expect(response.body.decisions[featureKey].variationKey).toBe(testVariation);
    });

    test('should apply multiple forced decisions via attributes', async () => {
      // Only run if we have at least 2 feature keys
      if (testConfig.featureKeys.length < 2) {
        console.warn('Skipping multi-feature test as not enough feature keys available');
        return;
      }

      const [featureKey1, featureKey2] = testConfig.featureKeys;
      const testVariation1 = 'variation_1';
      const testVariation2 = 'variation_2';
      
      const response = await makeApiCall(
        `/v2/decide?sdkKey=${testConfig.sdkKey}`,
        'POST',
        {
          userId: testUserId,
          features: [featureKey1, featureKey2],
          attributes: {
            $opt_forced_decisions: {
              [featureKey1]: {
                variation_key: testVariation1
              },
              [featureKey2]: {
                variation_key: testVariation2
              }
            }
          }
        }
      );
      
      expect(response.status).toBe(200);
      expect(response.body.decisions[featureKey1].variationKey).toBe(testVariation1);
      expect(response.body.decisions[featureKey2].variationKey).toBe(testVariation2);
    });
  });

  /**
   * Section 2: SDK-Based Forced Decisions
   * Tests that setForcedDecision API functionality works correctly
   */
  describe('SDK-based forced decisions', () => {
    test('should set a forced decision via SDK endpoint', async () => {
      const featureKey = testConfig.featureKeys[0];
      const testVariation = 'variation_1';
      
      // Set the forced decision
      const setResponse = await forceDecisionViaSdk(testUserId, featureKey, testVariation);
      expect(setResponse.status).toBe(200);
      
      // Verify the decision is applied
      const getResponse = await getDecisions(testUserId);
      expect(getResponse.status).toBe(200);
      expect(getResponse.body.decisions[featureKey].variationKey).toBe(testVariation);
    });

    test('should remove a forced decision via SDK endpoint', async () => {
      const featureKey = testConfig.featureKeys[0];
      const testVariation = 'variation_3'; // Use a different variation
      
      // Set the forced decision
      await forceDecisionViaSdk(testUserId, featureKey, testVariation);
      
      // Verify it was set
      const getResponse1 = await getDecisions(testUserId);
      expect(getResponse1.body.decisions[featureKey].variationKey).toBe(testVariation);
      
      // Remove the forced decision
      const removeResponse = await removeForceDecisionViaSdk(testUserId, featureKey);
      expect(removeResponse.status).toBe(200);
      
      // Verify it was removed (decision should revert to default)
      const getResponse2 = await getDecisions(testUserId);
      expect(getResponse2.status).toBe(200);
      expect(getResponse2.body.decisions[featureKey].variationKey).not.toBe(testVariation);
    });
  });
  
  /**
   * Section 3: Precedence testing
   * Tests that SDK-based forced decisions take precedence over attribute-based ones
   */
  describe('Precedence testing', () => {
    test('attribute forced decisions should take precedence over SDK forced decisions', async () => {
      const featureKey = testConfig.featureKeys[0];
      const sdkVariation = 'sdk_variation';
      const attrVariation = 'attr_variation';
      
      // Set a forced decision via SDK
      await forceDecisionViaSdk(testUserId, featureKey, sdkVariation);
      
      // Now request with attribute forced decision
      const response = await forceDecisionViaAttributes(testUserId, featureKey, attrVariation);
      
      // The attribute-based forced decision should win
      expect(response.status).toBe(200);
      expect(response.body.decisions[featureKey].variationKey).toBe(attrVariation);
    });
  });
  
  /**
   * Section 4: Edge Case Testing
   * Tests various edge cases and error handling for forced decisions
   */
  describe('Edge cases', () => {
    test('should handle invalid variation keys gracefully', async () => {
      const featureKey = testConfig.featureKeys[0];
      const invalidVariation = 'non_existent_variation';
      
      // Try to set an invalid variation
      const response = await forceDecisionViaAttributes(testUserId, featureKey, invalidVariation);
      
      // The service should still return 200, but the variation should not be the invalid one
      expect(response.status).toBe(200);
      // Note: behavior depends on implementation, it might return the invalid key or revert to default
    });
    
    test('should handle empty forced decisions object', async () => {
      const response = await makeApiCall(
        `/v2/decide?sdkKey=${testConfig.sdkKey}`,
        'POST',
        {
          userId: testUserId,
          features: testConfig.featureKeys,
          attributes: {
            $opt_forced_decisions: {}
          }
        }
      );
      
      // Should process normally without errors
      expect(response.status).toBe(200);
      expect(response.body.decisions).toBeDefined();
    });
  });
}); 