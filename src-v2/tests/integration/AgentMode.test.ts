/**
 * Agent Mode Integration Tests
 * 
 * These tests verify the Agent Mode (POST request) functionality of the Optimizely Edge Agent
 * running in a Cloudflare environment.
 * 
 * The tests interact directly with the deployed API on Cloudflare and verify
 * the responses against expected behavior.
 */

import { expect, describe, test } from 'vitest';
import { v4 as uuidv4 } from 'uuid';

// Common test setup
const AGENT_ENDPOINT = 'http://localhost:8787'; // Default URL, should be overridden by real config
const SDK_KEY = 'your-sdk-key';  // Default, should be overridden
const FLAG_KEY = 'flag_key';  // Default, should be overridden
const EXPERIMENT_KEY = 'ab_test';  // Default, should be overridden

// Test configuration
const testConfig = {
  baseUrl: AGENT_ENDPOINT,
  sdkKey: SDK_KEY,
  featureKeys: [FLAG_KEY],
  experimentKeys: [EXPERIMENT_KEY]
};

// Attempt to load config if available (will be done at runtime)
try {
  // In a real implementation, we'd import the config module
  // and set these values appropriately
  console.log('Using default test configuration');
} catch (e) {
  console.warn('Error loading config, using defaults', e);
}

// Types
interface ApiResponse {
  status: number;
  headers: Headers;
  body: any;
}

describe('Optimizely Edge Agent - Agent Mode', () => {

  // Reusable function to make POST requests to the agent
  async function callAgent(endpoint: string, body: any): Promise<ApiResponse> {
    const response = await fetch(`${testConfig.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    } as any);
    
    return {
      status: response.status,
      headers: response.headers,
      body: await response.json()
    };
  }

  describe('Feature flag decisions', () => {
    test('Should return feature flag decision', async () => {
      const userId = `test-user-${uuidv4()}`;
      
      const result = await callAgent('/decide', {
        sdkKey: testConfig.sdkKey,
        flagKey: testConfig.featureKeys[0],
        user: {
          id: userId,
          attributes: {}
        }
      });
      
      expect(result.status).toBe(200);
      expect(result.body).toHaveProperty('flagKey', testConfig.featureKeys[0]);
      expect(result.body).toHaveProperty('enabled');
      expect(result.body).toHaveProperty('variables');
      expect(result.body).toHaveProperty('variationKey');
    });
    
    test('Should return error for missing flag key', async () => {
      const userId = `test-user-${uuidv4()}`;
      
      const result = await callAgent('/decide', {
        sdkKey: testConfig.sdkKey,
        user: {
          id: userId,
          attributes: {}
        }
      });
      
      expect(result.status).toBe(400);
      expect(result.body).toHaveProperty('error');
    });
    
    test('Should return error for missing SDK key', async () => {
      const userId = `test-user-${uuidv4()}`;
      
      const result = await callAgent('/decide', {
        flagKey: testConfig.featureKeys[0],
        user: {
          id: userId,
          attributes: {}
        }
      });
      
      expect(result.status).toBe(400);
      expect(result.body).toHaveProperty('error');
    });
  });
  
  describe('Experiment variation decisions', () => {
    test('Should return experiment variation assignment', async () => {
      const userId = `test-user-${uuidv4()}`;
      
      const result = await callAgent('/decide', {
        sdkKey: testConfig.sdkKey,
        flagKey: testConfig.experimentKeys[0],
        user: {
          id: userId,
          attributes: {}
        }
      });
      
      expect(result.status).toBe(200);
      expect(result.body).toHaveProperty('flagKey', testConfig.experimentKeys[0]);
      expect(result.body).toHaveProperty('variationKey');
    });
  });
  
  describe('Batch decisions', () => {
    test('Should return decisions for multiple flags', async () => {
      const userId = `test-user-${uuidv4()}`;
      
      const result = await callAgent('/decide-all', {
        sdkKey: testConfig.sdkKey,
        user: {
          id: userId,
          attributes: {}
        }
      });
      
      expect(result.status).toBe(200);
      expect(result.body).toBeInstanceOf(Object);
      
      // Should include the flag we know about
      expect(result.body).toHaveProperty(testConfig.featureKeys[0]);
      expect(result.body[testConfig.featureKeys[0]]).toHaveProperty('enabled');
    });
    
    test('Should return decisions for specified flags', async () => {
      const userId = `test-user-${uuidv4()}`;
      
      const result = await callAgent('/decide-all', {
        sdkKey: testConfig.sdkKey,
        flagKeys: [testConfig.featureKeys[0]],
        user: {
          id: userId,
          attributes: {}
        }
      });
      
      expect(result.status).toBe(200);
      expect(result.body).toHaveProperty(testConfig.featureKeys[0]);
      expect(Object.keys(result.body).length).toBe(1);
    });
  });
  
  describe('Event tracking', () => {
    test('Should track conversion event', async () => {
      const userId = `test-user-${uuidv4()}`;
      const eventKey = 'test_event';
      
      const result = await callAgent('/track', {
        sdkKey: testConfig.sdkKey,
        eventKey: eventKey,
        user: {
          id: userId,
          attributes: {}
        }
      });
      
      expect(result.status).toBe(200);
      expect(result.body).toHaveProperty('success', true);
    });
    
    test('Should track conversion event with value', async () => {
      const userId = `test-user-${uuidv4()}`;
      const eventKey = 'purchase';
      
      const result = await callAgent('/track', {
        sdkKey: testConfig.sdkKey,
        eventKey: eventKey,
        user: {
          id: userId,
          attributes: {}
        },
        eventTags: {
          revenue: 100,
          value: 10.5
        }
      });
      
      expect(result.status).toBe(200);
      expect(result.body).toHaveProperty('success', true);
    });
  });

  describe('Forced variations', () => {
    test('Should set and get forced variation', async () => {
      const userId = `test-forced-var-${uuidv4()}`;
      const variationKey = 'variation_1';
      
      // Set forced variation
      const setResult = await callAgent('/set-forced-variation', {
        sdkKey: testConfig.sdkKey,
        flagKey: testConfig.featureKeys[0],
        userId: userId,
        variationKey: variationKey
      });
      
      expect(setResult.status).toBe(200);
      expect(setResult.body).toHaveProperty('success', true);
      
      // Get forced variation
      const getResult = await callAgent('/get-forced-variation', {
        sdkKey: testConfig.sdkKey,
        flagKey: testConfig.featureKeys[0],
        userId: userId
      });
      
      expect(getResult.status).toBe(200);
      expect(getResult.body).toHaveProperty('variationKey', variationKey);
      
      // Verify decision respects forced variation
      const decisionResult = await callAgent('/decide', {
        sdkKey: testConfig.sdkKey,
        flagKey: testConfig.featureKeys[0],
        user: {
          id: userId,
          attributes: {}
        }
      });
      
      expect(decisionResult.status).toBe(200);
      expect(decisionResult.body).toHaveProperty('variationKey', variationKey);
      
      // Remove forced variation
      const removeResult = await callAgent('/set-forced-variation', {
        sdkKey: testConfig.sdkKey,
        flagKey: testConfig.featureKeys[0],
        userId: userId,
        variationKey: null
      });
      
      expect(removeResult.status).toBe(200);
      expect(removeResult.body).toHaveProperty('success', true);
    });
  });
  
  describe('Audience targeting', () => {
    test('Should target user based on attributes', async () => {
      const userId = `test-audience-${uuidv4()}`;
      
      // Test with attributes that should match an audience
      const matchResult = await callAgent('/decide', {
        sdkKey: testConfig.sdkKey,
        flagKey: testConfig.featureKeys[0],
        user: {
          id: userId,
          attributes: {
            country: 'US',
            age: 30
          }
        }
      });
      
      expect(matchResult.status).toBe(200);
      
      // Store this decision for comparison
      const matchDecision = matchResult.body;
      
      // Test with attributes that shouldn't match the audience
      const noMatchResult = await callAgent('/decide', {
        sdkKey: testConfig.sdkKey,
        flagKey: testConfig.featureKeys[0],
        user: {
          id: userId,
          attributes: {
            country: 'UK',
            age: 15
          }
        }
      });
      
      expect(noMatchResult.status).toBe(200);
      
      // We can't know for sure if the audience conditions in the project will actually 
      // produce different results, but we can at least verify the call works with attributes
      console.log('Audience targeting test - match decision:', matchDecision.variationKey);
      console.log('Audience targeting test - no match decision:', noMatchResult.body.variationKey);
    });
    
    test('Should handle date attributes in audience targeting', async () => {
      const userId = `test-date-${uuidv4()}`;
      const now = new Date();
      
      const result = await callAgent('/decide', {
        sdkKey: testConfig.sdkKey,
        flagKey: testConfig.featureKeys[0],
        user: {
          id: userId,
          attributes: {
            lastLogin: now.toISOString(),
            signupDate: now.toISOString()
          }
        }
      });
      
      expect(result.status).toBe(200);
      expect(result.body).toHaveProperty('flagKey', testConfig.featureKeys[0]);
    });
  });

  // NEW TEST SECTIONS BELOW

  describe('Decision options', () => {
    test('Should include decision reasons when requested', async () => {
      const userId = `test-reasons-${uuidv4()}`;
      
      const result = await callAgent('/decide', {
        sdkKey: testConfig.sdkKey,
        flagKey: testConfig.featureKeys[0],
        user: {
          id: userId,
          attributes: {}
        },
        options: {
          includeReasons: true
        }
      });
      
      expect(result.status).toBe(200);
      expect(result.body).toHaveProperty('flagKey', testConfig.featureKeys[0]);
      expect(result.body).toHaveProperty('reasons');
      expect(Array.isArray(result.body.reasons)).toBe(true);
    });
    
    test('Should exclude variables when requested', async () => {
      const userId = `test-novars-${uuidv4()}`;
      
      const result = await callAgent('/decide', {
        sdkKey: testConfig.sdkKey,
        flagKey: testConfig.featureKeys[0],
        user: {
          id: userId,
          attributes: {}
        },
        options: {
          excludeVariables: true
        }
      });
      
      expect(result.status).toBe(200);
      expect(result.body).toHaveProperty('flagKey', testConfig.featureKeys[0]);
      expect(result.body).not.toHaveProperty('variables');
    });
  });

  describe('Request configuration handling', () => {
    test('Should handle configuration from query parameters', async () => {
      const userId = `test-query-${uuidv4()}`;
      
      // Using fetch directly to test query parameters
      const url = new URL(`${testConfig.baseUrl}/decide`);
      url.searchParams.append('sdkKey', testConfig.sdkKey);
      url.searchParams.append('flagKey', testConfig.featureKeys[0]);
      url.searchParams.append('userId', userId);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({}) // Empty body since params are in URL
      } as any);
      
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body).toHaveProperty('flagKey', testConfig.featureKeys[0]);
    });
    
    test('Should prioritize headers over body parameters', async () => {
      const userId = `test-headers-${uuidv4()}`;
      const headerSdkKey = testConfig.sdkKey;
      const bodyFlagKey = 'wrong_flag_key'; // This should be overridden
      const headerFlagKey = testConfig.featureKeys[0];
      
      // Using fetch directly to test headers
      const response = await fetch(`${testConfig.baseUrl}/decide`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Optimizely-SDK-Key': headerSdkKey,
          'X-Optimizely-Flag-Key': headerFlagKey,
          'X-Optimizely-Visitor-Id': userId
        },
        body: JSON.stringify({
          sdkKey: "incorrect-sdk-key", // Should be ignored due to header
          flagKey: bodyFlagKey // Should be ignored due to header
        })
      } as any);
      
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body).toHaveProperty('flagKey', headerFlagKey); // Should use header value
    });
  });

  describe('Multiple variation decisions', () => {
    test('Should handle multiple flag key requests', async () => {
      const userId = `test-multi-${uuidv4()}`;
      
      // Assuming there are at least two flag keys in your test environment
      const flagKeys = testConfig.featureKeys.length > 1 
        ? testConfig.featureKeys 
        : [testConfig.featureKeys[0], testConfig.experimentKeys[0]];
      
      const result = await callAgent('/decide-for-keys', {
        sdkKey: testConfig.sdkKey,
        flagKeys: flagKeys,
        user: {
          id: userId,
          attributes: {}
        }
      });
      
      expect(result.status).toBe(200);
      expect(result.body).toBeInstanceOf(Object);
      
      // Should include all requested flags
      for (const flagKey of flagKeys) {
        expect(result.body).toHaveProperty(flagKey);
        expect(result.body[flagKey]).toHaveProperty('enabled');
      }
    });
  });

  describe('Event tracking advanced scenarios', () => {
    test('Should batch track multiple events', async () => {
      const userId = `test-batch-events-${uuidv4()}`;
      
      const result = await callAgent('/track-events', {
        sdkKey: testConfig.sdkKey,
        events: [
          {
            eventKey: 'test_event_1',
            userId: userId,
            attributes: {}
          },
          {
            eventKey: 'test_event_2',
            userId: userId,
            attributes: {},
            eventTags: {
              value: 15.5
            }
          }
        ]
      });
      
      expect(result.status).toBe(200);
      expect(result.body).toHaveProperty('success', true);
      expect(result.body).toHaveProperty('processedEvents');
      expect(result.body.processedEvents).toBe(2);
    });
    
    test('Should handle complex event tags', async () => {
      const userId = `test-tags-${uuidv4()}`;
      
      const result = await callAgent('/track', {
        sdkKey: testConfig.sdkKey,
        eventKey: 'purchase_complete',
        user: {
          id: userId,
          attributes: {}
        },
        eventTags: {
          revenue: 199.99,
          currency: 'USD',
          items: [
            { id: 'product-1', name: 'Widget', price: 99.99, quantity: 1 },
            { id: 'product-2', name: 'Gadget', price: 50.00, quantity: 2 }
          ],
          transactionId: `txn-${uuidv4()}`,
          location: 'US-NY'
        }
      });
      
      expect(result.status).toBe(200);
      expect(result.body).toHaveProperty('success', true);
    });
  });

  describe('Error handling and resilience', () => {
    test('Should handle invalid JSON gracefully', async () => {
      // Using fetch directly to send invalid JSON
      const response = await fetch(`${testConfig.baseUrl}/decide`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: '{invalid json}'
      } as any);
      
      const body = await response.json();
      expect(response.status).toBe(400);
      expect(body).toHaveProperty('error');
    });
    
    test('Should handle unsupported endpoints properly', async () => {
      const userId = `test-invalid-${uuidv4()}`;
      
      const response = await fetch(`${testConfig.baseUrl}/unsupported-endpoint`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sdkKey: testConfig.sdkKey,
          user: {
            id: userId
          }
        })
      } as any);
      
      // Should either return 404 or 501 depending on implementation
      expect([404, 501]).toContain(response.status);
    });
  });

  describe('User profile service integration', () => {
    test('Should persist bucketing decisions across requests', async () => {
      const userId = `test-persistent-${uuidv4()}`;
      
      // First decision
      const firstResult = await callAgent('/decide', {
        sdkKey: testConfig.sdkKey,
        flagKey: testConfig.featureKeys[0],
        user: {
          id: userId,
          attributes: {}
        },
        options: {
          enableUserProfileService: true
        }
      });
      
      expect(firstResult.status).toBe(200);
      const firstDecision = firstResult.body.variationKey;
      
      // Second decision (should be the same due to user profile service)
      const secondResult = await callAgent('/decide', {
        sdkKey: testConfig.sdkKey,
        flagKey: testConfig.featureKeys[0],
        user: {
          id: userId,
          attributes: {
            // Add an attribute that might otherwise change the decision
            random_attr: Math.random()
          }
        },
        options: {
          enableUserProfileService: true
        }
      });
      
      expect(secondResult.status).toBe(200);
      expect(secondResult.body.variationKey).toBe(firstDecision);
    });
  });

  describe('Decision options', () => {
    test('Should include options for decide API', async () => {
      const response = await callAgent('/api/decide-options', 'GET');
      
      expect(response.status).toBe(200);
      // Response should contain information about available decide options
      expect(response.body).toHaveProperty('sdkVersions');
      expect(response.body.sdkVersions).toHaveProperty('javascript');
      expect(response.body.sdkVersions).toHaveProperty('react');
      expect(response.body.sdkVersions).toHaveProperty('node');
      
      // Check for options array
      expect(Array.isArray(response.body.sdkVersions.javascript.options)).toBe(true);
      
      // Check specific options - fix implicit 'any' type
      const options = response.body.sdkVersions.javascript.options;
      expect(options.some((opt: { key: string }) => opt.key === 'INCLUDE_REASONS')).toBe(true);
      expect(options.some((opt: { key: string }) => opt.key === 'EXCLUDE_VARIABLES')).toBe(true);
      expect(options.some((opt: { key: string }) => opt.key === 'ENABLED_FLAGS_ONLY')).toBe(true);
    });
  });
}); 