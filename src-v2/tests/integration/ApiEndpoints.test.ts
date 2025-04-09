/**
 * API Endpoints Integration Tests
 * 
 * This file contains comprehensive end-to-end tests for all API endpoints in the Optimizely Edge Agent.
 * Tests cover GET, POST, PUT operations for all endpoints including:
 * - Datafile API
 * - Flag Keys API
 * - SDK Info API
 * - Variations API
 * - Admin API
 */
import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { EDGE_AGENT_URL, OPTIMIZELY_SDK_KEY, getEdgeUrl } from './config';
import fetch from 'node-fetch';

// Response type definitions
interface ErrorResponse {
  error: string;
}

interface SuccessResponse {
  success: boolean;
}

interface FlagKeysResponse {
  flagKeys: string[];
}

interface SdkInfoResponse {
  name: string;
  version: string;
  environment: string;
  cdnProvider: string;
}

interface DatafileResponse {
  revision: string;
  version: string;
  featureFlags: Array<{
    key: string;
    experimentKey: string;
  }>;
  experiments: Array<{
    key: string;
    variations: Array<{
      key: string;
    }>;
  }>;
}

// Test configuration
const BASE_URL = getEdgeUrl();
const SDK_KEY = OPTIMIZELY_SDK_KEY;
const ADMIN_TOKEN = 'test-admin-token'; // Replace with actual admin token for live tests
const TEST_SDK_KEY = process.env.SDK_KEY || 'test-sdk-key';
const TEST_USER_ID = 'test-user-' + Math.floor(Math.random() * 1000000);
const TEST_FLAG_KEY = 'test-flag';
const TEST_VARIATION_KEY = 'test-variation';

// Test data
const SAMPLE_DATAFILE = {
  revision: '123',
  version: '4',
  featureFlags: [
    { key: 'test_flag_1', experimentKey: 'test_exp_1' },
    { key: 'test_flag_2', experimentKey: 'test_exp_2' }
  ],
  experiments: [
    { key: 'test_exp_1', variations: [{ key: 'control' }, { key: 'treatment' }] },
    { key: 'test_exp_2', variations: [{ key: 'control' }, { key: 'treatment' }] }
  ]
};

// Helper function to create headers
const createHeaders = (isAdmin = false) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  
  if (isAdmin) {
    headers['Authorization'] = `Bearer ${ADMIN_TOKEN}`;
  }
  
  return headers;
};

// Update callApi to use type assertion on fetch directly
async function callApi(endpoint: string, method = 'POST', body?: any) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const options: any = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const url = `${BASE_URL}${endpoint}`;
  const response = await fetch(url, options);

  return {
    status: response.status,
    data: await response.json().catch(() => null)
  };
}

// Skip tests if environment variables are not set
const shouldSkipTests = !process.env.EDGE_AGENT_URL || !process.env.SDK_KEY;

describe('API Endpoints Integration Tests', () => {
  let testSdkKey: string;

  beforeAll(() => {
    // Generate a unique SDK key for testing to avoid conflicts
    testSdkKey = `test-sdk-${Date.now()}`;
    console.log(`🧪 Running API tests with SDK key: ${testSdkKey}`);
  });

  beforeEach(() => {
    // Any setup needed before each test
  });

  afterAll(async () => {
    // Clean up any test data created during tests
    try {
      // Delete test datafile if possible
      await fetch(`${BASE_URL}/api/datafile?sdkKey=${testSdkKey}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${ADMIN_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      console.warn('⚠️ Could not clean up test data. May need manual cleanup.');
    }
  });

  describe('Datafile API', () => {
    it('should return 404 when datafile is not found', async () => {
      // Arrange
      const nonExistentSdkKey = `non-existent-${Date.now()}`;
      
      // Act
      const response = await fetch(`${BASE_URL}/api/datafile?sdkKey=${nonExistentSdkKey}`);
      const data = await response.json() as ErrorResponse;
      
      // Assert
      expect(response.status).toBe(404);
      expect(data.error).toContain('not found');
    });

    it('should create and retrieve a datafile', async () => {
      // Arrange
      const createResponse = await fetch(`${BASE_URL}/api/datafile?sdkKey=${testSdkKey}`, {
        method: 'POST',
        headers: createHeaders(true),
        body: JSON.stringify(SAMPLE_DATAFILE)
      });
      
      // Assert creation was successful
      expect(createResponse.status).toBe(200);
      const createData = await createResponse.json() as SuccessResponse;
      expect(createData.success).toBe(true);
      
      // Act - retrieve the datafile
      const getResponse = await fetch(`${BASE_URL}/api/datafile?sdkKey=${testSdkKey}`);
      
      // Assert
      expect(getResponse.status).toBe(200);
      const getDatafile = await getResponse.json() as DatafileResponse;
      expect(getDatafile).toHaveProperty('revision', SAMPLE_DATAFILE.revision);
      expect(getDatafile).toHaveProperty('featureFlags');
      expect(Array.isArray(getDatafile.featureFlags)).toBe(true);
    });

    it('should require admin token for creating datafiles', async () => {
      // Act
      const response = await fetch(`${BASE_URL}/api/datafile?sdkKey=${testSdkKey}`, {
        method: 'POST',
        headers: createHeaders(false), // No admin token
        body: JSON.stringify(SAMPLE_DATAFILE)
      });
      
      // Assert
      expect(response.status).toBe(403);
      const data = await response.json() as ErrorResponse;
      expect(data.error).toContain('Unauthorized');
    });

    it('should update an existing datafile', async () => {
      // Arrange
      const updatedDatafile = {
        ...SAMPLE_DATAFILE,
        revision: '124', // Increment revision
        featureFlags: [
          ...SAMPLE_DATAFILE.featureFlags,
          { key: 'test_flag_3', experimentKey: 'test_exp_3' }
        ]
      };
      
      // Act
      const response = await fetch(`${BASE_URL}/api/datafile?sdkKey=${testSdkKey}`, {
        method: 'PUT',
        headers: createHeaders(true),
        body: JSON.stringify(updatedDatafile)
      });
      
      // Assert
      expect(response.status).toBe(200);
      const data = await response.json() as SuccessResponse;
      expect(data.success).toBe(true);
      
      // Verify the datafile was updated
      const getResponse = await fetch(`${BASE_URL}/api/datafile?sdkKey=${testSdkKey}`);
      const getDatafile = await getResponse.json() as DatafileResponse;
      expect(getDatafile.featureFlags).toHaveLength(3);
    });

    it('should delete a datafile', async () => {
      // Act
      const deleteResponse = await fetch(`${BASE_URL}/api/datafile?sdkKey=${testSdkKey}`, {
        method: 'DELETE',
        headers: createHeaders(true)
      });

      // Assert deletion was successful
      expect(deleteResponse.status).toBe(200);
      const deleteData = await deleteResponse.json() as SuccessResponse;
      expect(deleteData.success).toBe(true);

      // Verify the datafile is gone
      const getResponse = await fetch(`${BASE_URL}/api/datafile?sdkKey=${testSdkKey}`);
      expect(getResponse.status).toBe(404);
    });
  });

  describe('Flag Keys API', () => {
    it('should return flag keys after datafile creation', async () => {
      // Act
      const response = await fetch(`${BASE_URL}/api/flagkeys?sdkKey=${testSdkKey}`);
      
      // Assert
      expect(response.status).toBe(200);
      const data = await response.json() as FlagKeysResponse;
      expect(Array.isArray(data.flagKeys)).toBe(true);
      expect(data.flagKeys).toContain('test_flag_1');
      expect(data.flagKeys).toContain('test_flag_2');
      expect(data.flagKeys).toContain('test_flag_3'); // From updated datafile
    });

    it('should return 404 when flag keys are not found', async () => {
      // Arrange
      const nonExistentSdkKey = `non-existent-${Date.now()}`;
      
      // Act
      const response = await fetch(`${BASE_URL}/api/flagkeys?sdkKey=${nonExistentSdkKey}`);
      
      // Assert
      expect(response.status).toBe(404);
      const data = await response.json() as ErrorResponse;
      expect(data.error).toContain('not found');
    });

    it('should allow manually updating flag keys with admin token', async () => {
      // Arrange
      const customFlagKeys = ['custom_flag_1', 'custom_flag_2', 'custom_flag_3'];
      
      // Act
      const response = await fetch(`${BASE_URL}/api/flagkeys?sdkKey=${testSdkKey}`, {
        method: 'PUT',
        headers: createHeaders(true),
        body: JSON.stringify({ flagKeys: customFlagKeys })
      });
      
      // Assert
      expect(response.status).toBe(200);
      const data = await response.json() as SuccessResponse;
      expect(data.success).toBe(true);
      
      // Verify flag keys were updated
      const getResponse = await fetch(`${BASE_URL}/api/flagkeys?sdkKey=${testSdkKey}`);
      const getData = await getResponse.json() as FlagKeysResponse;
      expect(getData.flagKeys).toEqual(customFlagKeys);
    });
  });

  describe('SDK Info API', () => {
    it('should return SDK information', async () => {
      // Act
      const response = await fetch(`${BASE_URL}/api/sdk`);
      
      // Assert
      expect(response.status).toBe(200);
      const data = await response.json() as SdkInfoResponse;
      expect(data).toHaveProperty('name', 'optimizely-edge-agent');
      expect(data).toHaveProperty('version');
      expect(data).toHaveProperty('environment');
      expect(data).toHaveProperty('cdnProvider');
    });
  });

  describe('Variations API', () => {
    it('should return not implemented for now', async () => {
      // Act
      const response = await fetch(`${BASE_URL}/api/variations?sdkKey=${testSdkKey}`);
      
      // Assert
      expect(response.status).toBe(501); // Not Implemented
      const data = await response.json() as ErrorResponse;
      expect(data.error).toContain('not implemented');
    });
  });

  describe('Admin API', () => {
    it('should require admin token for admin endpoints', async () => {
      // Act
      const response = await fetch(`${BASE_URL}/api/admin/cache/clear`, {
        method: 'POST',
        headers: createHeaders(false) // No admin token
      });
      
      // Assert
      expect(response.status).toBe(403);
      const data = await response.json() as ErrorResponse;
      expect(data.error).toContain('Unauthorized');
    });

    it('should clear cache with admin token', async () => {
      // Act
      const response = await fetch(`${BASE_URL}/api/admin/cache/clear`, {
        method: 'POST',
        headers: createHeaders(true)
      });
      
      // Assert
      expect(response.status).toBe(200);
      const data = await response.json() as SuccessResponse;
      expect(data.success).toBe(true);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should return 400 for missing SDK key', async () => {
      // Act
      const response = await fetch(`${BASE_URL}/api/datafile`); // No SDK key
      
      // Assert
      expect(response.status).toBe(400);
      const data = await response.json() as ErrorResponse;
      expect(data.error).toContain('SDK key is required');
    });

    it('should return 405 for unsupported methods', async () => {
      // Act
      const response = await fetch(`${BASE_URL}/api/sdk`, {
        method: 'DELETE'
      });
      
      // Assert
      expect(response.status).toBe(405);
      const data = await response.json() as ErrorResponse;
      expect(data.error).toContain('Method not allowed');
    });

    it('should return 404 for unknown API endpoints', async () => {
      // Act
      const response = await fetch(`${BASE_URL}/api/nonexistent-endpoint`);
      
      // Assert
      expect(response.status).toBe(404);
      const data = await response.json() as ErrorResponse;
      expect(data.error).toContain('Unknown API endpoint');
    });

    it('should reject invalid request bodies', async () => {
      // Act - trying to set flag keys with an invalid body format
      const response = await fetch(`${BASE_URL}/api/flagkeys?sdkKey=${testSdkKey}`, {
        method: 'POST',
        headers: createHeaders(true),
        body: JSON.stringify({ invalidFormat: true }) // Missing 'flagKeys' array
      });
      
      // Assert
      expect(response.status).toBe(400);
      const data = await response.json() as ErrorResponse;
      expect(data.error).toContain('Invalid request body');
    });
  });

  // Tests that require a valid SDK Key and deployment
  (shouldSkipTests ? describe.skip : describe)('Decision API Endpoints', () => {
    it('should handle /api/decide endpoint', async () => {
      const response = await callApi('/api/decide', 'POST', {
        sdkKey: TEST_SDK_KEY,
        flagKey: TEST_FLAG_KEY,
        userId: TEST_USER_ID
      });
      
      // Even if the flag doesn't exist, we should get a valid response structure
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('variationKey');
      expect(response.data).toHaveProperty('enabled');
      expect(response.data).toHaveProperty('variables');
    });
    
    it('should handle /api/decide endpoint with INCLUDE_REASONS option', async () => {
      const response = await callApi('/api/decide', 'POST', {
        sdkKey: TEST_SDK_KEY,
        flagKey: TEST_FLAG_KEY,
        userId: TEST_USER_ID,
        decideOptions: ['INCLUDE_REASONS']
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('variationKey');
      expect(response.data).toHaveProperty('enabled');
      expect(response.data).toHaveProperty('variables');
      expect(response.data).toHaveProperty('reasons'); // Expect reasons to be present
      expect(Array.isArray(response.data.reasons)).toBe(true);
    });

    it('should handle /api/decide endpoint with EXCLUDE_VARIABLES option', async () => {
      const response = await callApi('/api/decide', 'POST', {
        sdkKey: TEST_SDK_KEY,
        flagKey: TEST_FLAG_KEY,
        userId: TEST_USER_ID,
        decideOptions: ['EXCLUDE_VARIABLES']
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('variationKey');
      expect(response.data).toHaveProperty('enabled');
      // Variables should be an empty object or not present depending on SDK behavior
      expect(response.data.variables).toEqual({}); 
    });

    it('should handle /api/decide endpoint with ENABLED_FLAGS_ONLY option', async () => {
      // This option primarily affects decide-all/decide-for-keys, but test if it's accepted
      const response = await callApi('/api/decide', 'POST', {
        sdkKey: TEST_SDK_KEY,
        flagKey: TEST_FLAG_KEY, // Assuming this flag exists and might be enabled or disabled
        userId: TEST_USER_ID,
        decideOptions: ['ENABLED_FLAGS_ONLY']
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('variationKey'); 
      // Further assertions might depend on the actual flag state in the test datafile
    });

    it('should handle /api/decide-all endpoint', async () => {
      const response = await callApi('/api/decide-all', 'POST', {
        sdkKey: TEST_SDK_KEY,
        userId: TEST_USER_ID
      });
      
      expect(response.status).toBe(200);
      // Response should be an object mapping flag keys to decisions
      expect(typeof response.data).toBe('object');
    });
    
    it('should handle /api/decide-for-keys endpoint with specific flag keys', async () => {
      const response = await callApi('/api/decide-for-keys', 'POST', {
        sdkKey: TEST_SDK_KEY,
        userId: TEST_USER_ID,
        flagKeys: [TEST_FLAG_KEY]
      });
      
      expect(response.status).toBe(200);
      // Response should be an object mapping flag keys to decisions
      expect(typeof response.data).toBe('object');
      
      // If the test flag exists, it should be in the response
      // Otherwise, we'll just have an empty object or other existing flags
    });
    
    it('should handle /api/decide-for-keys endpoint with INCLUDE_REASONS option', async () => {
      const response = await callApi('/api/decide-for-keys', 'POST', {
        sdkKey: TEST_SDK_KEY,
        userId: TEST_USER_ID,
        flagKeys: [TEST_FLAG_KEY],
        decideOptions: ['INCLUDE_REASONS']
      });

      expect(response.status).toBe(200);
      expect(typeof response.data).toBe('object');
      if (response.data && response.data[TEST_FLAG_KEY]) {
        expect(response.data[TEST_FLAG_KEY]).toHaveProperty('reasons');
        expect(Array.isArray(response.data[TEST_FLAG_KEY].reasons)).toBe(true);
      }
    });

    it('should validate required parameters in /api/decide-for-keys', async () => {
      // Missing sdkKey
      const response1 = await callApi('/api/decide-for-keys', 'POST', {
        userId: TEST_USER_ID,
        flagKeys: [TEST_FLAG_KEY]
      });
      
      expect(response1.status).toBe(400);
      expect(response1.data).toHaveProperty('error');
      
      // Missing flagKeys
      const response2 = await callApi('/api/decide-for-keys', 'POST', {
        sdkKey: TEST_SDK_KEY,
        userId: TEST_USER_ID
      });
      
      expect(response2.status).toBe(400);
      expect(response2.data).toHaveProperty('error');
      
      // Empty flagKeys array
      const response3 = await callApi('/api/decide-for-keys', 'POST', {
        sdkKey: TEST_SDK_KEY,
        userId: TEST_USER_ID,
        flagKeys: []
      });
      
      expect(response3.status).toBe(400);
      expect(response3.data).toHaveProperty('error');
    });

    it('should handle /api/decide-options endpoint', async () => {
      const response = await callApi('/api/decide-options', 'GET');
      
      expect(response.status).toBe(200);
      // Response should contain information about available decide options
      expect(response.data).toHaveProperty('sdkVersions');
      expect(response.data.sdkVersions).toHaveProperty('javascript');
      expect(response.data.sdkVersions).toHaveProperty('react');
      expect(response.data.sdkVersions).toHaveProperty('node');
      
      // Check for options array
      expect(Array.isArray(response.data.sdkVersions.javascript.options)).toBe(true);
      
      // Check specific options - fix implicit 'any' type
      const options = response.data.sdkVersions.javascript.options;
      expect(options.some((opt: { key: string }) => opt.key === 'INCLUDE_REASONS')).toBe(true);
      expect(options.some((opt: { key: string }) => opt.key === 'EXCLUDE_VARIABLES')).toBe(true);
      expect(options.some((opt: { key: string }) => opt.key === 'ENABLED_FLAGS_ONLY')).toBe(true);
      
      // Check API usage examples
      expect(response.data).toHaveProperty('apiUsage');
      expect(response.data.apiUsage).toHaveProperty('example');
    });
    
    it('should support POST method for /api/decide-options endpoint', async () => {
      const response = await callApi('/api/decide-options', 'POST');
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('sdkVersions');
    });
    
    it('should reject unsupported methods for /api/decide-options', async () => {
      const response = await callApi('/api/decide-options', 'PUT');
      
      expect(response.status).toBe(405);
      expect(response.data).toHaveProperty('error');
    });
  });
  
  (shouldSkipTests ? describe.skip : describe)('Forced Variation API Endpoints', () => {
    // Test set-forced-variation
    it('should handle /api/set-forced-variation endpoint', async () => {
      const response = await callApi('/api/set-forced-variation', 'POST', {
        sdkKey: TEST_SDK_KEY,
        flagKey: TEST_FLAG_KEY,
        userId: TEST_USER_ID,
        variationKey: TEST_VARIATION_KEY
      });

      // This test should be updated when the implementation is complete
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('success', true);
    });

    // Test get-forced-variation
    it('should handle /api/get-forced-variation endpoint with POST', async () => {
      // Ensure variation is set first
      await callApi('/api/set-forced-variation', 'POST', {
        sdkKey: TEST_SDK_KEY, flagKey: TEST_FLAG_KEY, userId: TEST_USER_ID, variationKey: TEST_VARIATION_KEY
      });

      const response = await callApi('/api/get-forced-variation', 'POST', {
        sdkKey: TEST_SDK_KEY,
        flagKey: TEST_FLAG_KEY,
        userId: TEST_USER_ID
      });

      expect(response.status).toBe(200);
      // Expect the variation key set previously
      expect(response.data).toHaveProperty('variationKey', TEST_VARIATION_KEY);
    });

    it('should handle /api/get-forced-variation endpoint with GET', async () => {
      // Ensure variation is set first
      await callApi('/api/set-forced-variation', 'POST', {
        sdkKey: TEST_SDK_KEY, flagKey: TEST_FLAG_KEY, userId: TEST_USER_ID, variationKey: TEST_VARIATION_KEY
      });

      const endpoint = `/api/get-forced-variation?sdkKey=${TEST_SDK_KEY}&flagKey=${TEST_FLAG_KEY}&userId=${TEST_USER_ID}`;
      const response = await callApi(endpoint, 'GET');

      expect(response.status).toBe(200);
      // Expect the variation key set previously
      expect(response.data).toHaveProperty('variationKey', TEST_VARIATION_KEY);
    });

    // Test remove-forced-variation
    it('should handle /api/remove-forced-variation endpoint with POST', async () => {
      // Ensure variation is set first
      await callApi('/api/set-forced-variation', 'POST', {
        sdkKey: TEST_SDK_KEY, flagKey: TEST_FLAG_KEY, userId: TEST_USER_ID, variationKey: TEST_VARIATION_KEY
      });

      const response = await callApi('/api/remove-forced-variation', 'POST', {
        sdkKey: TEST_SDK_KEY,
        flagKey: TEST_FLAG_KEY,
        userId: TEST_USER_ID
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('success', true);

      // Verify it's removed
      const getResponse = await callApi('/api/get-forced-variation', 'POST', {
        sdkKey: TEST_SDK_KEY, flagKey: TEST_FLAG_KEY, userId: TEST_USER_ID
      });
      expect(getResponse.status).toBe(200);
      expect(getResponse.data).toHaveProperty('variationKey', null);
    });

    it('should handle /api/remove-forced-variation endpoint with DELETE', async () => {
      // Ensure variation is set first
      await callApi('/api/set-forced-variation', 'POST', {
        sdkKey: TEST_SDK_KEY, flagKey: TEST_FLAG_KEY, userId: TEST_USER_ID, variationKey: TEST_VARIATION_KEY
      });

      const endpoint = `/api/remove-forced-variation?sdkKey=${TEST_SDK_KEY}&flagKey=${TEST_FLAG_KEY}&userId=${TEST_USER_ID}`;
      const response = await callApi(endpoint, 'DELETE');

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('success', true);

      // Verify it's removed
      const getResponse = await callApi('/api/get-forced-variation', 'POST', {
        sdkKey: TEST_SDK_KEY, flagKey: TEST_FLAG_KEY, userId: TEST_USER_ID
      });
      expect(getResponse.status).toBe(200);
      expect(getResponse.data).toHaveProperty('variationKey', null);
    });

    it('should validate required parameters in forced variation endpoints', async () => {
      // Missing params in set-forced-variation
      const response1 = await callApi('/api/set-forced-variation', 'POST', {
        sdkKey: TEST_SDK_KEY,
        // Missing flagKey and userId
      });
      
      expect(response1.status).toBe(400);
      expect(response1.data).toHaveProperty('error');
      
      // Missing params in get-forced-variation
      const response2 = await callApi('/api/get-forced-variation', 'POST', {
        // Missing sdkKey, flagKey, userId
      });
      
      expect(response2.status).toBe(400);
      expect(response2.data).toHaveProperty('error');
      
      // Missing params in remove-forced-variation
      const response3 = await callApi('/api/remove-forced-variation', 'POST', {
        sdkKey: TEST_SDK_KEY,
        flagKey: TEST_FLAG_KEY,
        // Missing userId
      });
      
      expect(response3.status).toBe(400);
      expect(response3.data).toHaveProperty('error');
    });

    it('should return the forced variation when calling /api/decide', async () => {
      // Set a forced variation
      await callApi('/api/set-forced-variation', 'POST', {
        sdkKey: TEST_SDK_KEY,
        flagKey: TEST_FLAG_KEY,
        userId: TEST_USER_ID,
        variationKey: TEST_VARIATION_KEY
      });

      // Call /api/decide for the same flag and user
      const decideResponse = await callApi('/api/decide', 'POST', {
        sdkKey: TEST_SDK_KEY,
        flagKey: TEST_FLAG_KEY,
        userId: TEST_USER_ID
      });

      // Assert that the decide response returns the forced variation
      expect(decideResponse.status).toBe(200);
      expect(decideResponse.data).toHaveProperty('variationKey', TEST_VARIATION_KEY);
      // Check if reasons include forced decision
      expect(decideResponse.data).toHaveProperty('reasons');
      expect(decideResponse.data.reasons).toContainEqual(expect.stringContaining('forced'));

      // Clean up: remove the forced variation
      await callApi('/api/remove-forced-variation', 'POST', {
        sdkKey: TEST_SDK_KEY, flagKey: TEST_FLAG_KEY, userId: TEST_USER_ID
      });
    });
  });
  
  (shouldSkipTests ? describe.skip : describe)('Event Tracking API Endpoints', () => {
    it('should handle /api/track endpoint', async () => {
      const response = await callApi('/api/track', 'POST', {
        sdkKey: TEST_SDK_KEY,
        userId: TEST_USER_ID,
        eventKey: 'test_event',
        eventTags: {
          value: 10,
          category: 'test'
        }
      });
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('success', true);
    });
    
    it('should validate required parameters in /api/track', async () => {
      // Missing sdkKey
      const response1 = await callApi('/api/track', 'POST', {
        userId: TEST_USER_ID,
        eventKey: 'test_event'
      });
      
      expect(response1.status).toBe(400);
      expect(response1.data).toHaveProperty('error');
      
      // Missing eventKey
      const response2 = await callApi('/api/track', 'POST', {
        sdkKey: TEST_SDK_KEY,
        userId: TEST_USER_ID
      });
      
      expect(response2.status).toBe(400);
      expect(response2.data).toHaveProperty('error');
    });
  });
}); 