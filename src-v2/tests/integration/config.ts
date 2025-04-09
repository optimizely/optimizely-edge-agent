/**
 * Integration Test Configuration
 * 
 * This file provides configuration for the integration tests, including
 * retrieving settings from environment variables.
 */

// Default test values (will be overridden by environment variables if available)
export const EDGE_AGENT_URL = process.env.EDGE_AGENT_URL || 'https://example.workers.dev';
export const OPTIMIZELY_SDK_KEY = process.env.SDK_KEY || 'test-sdk-key';
export const OPTIMIZELY_FLAG_KEY = (process.env.FEATURE_KEYS || 'test-flag').split(',')[0];
export const OPTIMIZELY_EXPERIMENT_KEY = (process.env.EXPERIMENT_KEYS || 'test-experiment').split(',')[0];

// URLs to test for matching in Edge Mode tests
export const EDGE_URLS = {
  match: [
    // Basic path matches
    '/optimizely/test-flag',
    '/optimizely/test-flag/',
    
    // With query parameters
    '/optimizely/test-flag?userId=user123',
    '/optimizely/test-flag?userId=user123&attr1=value1',
    
    // With different casing (should be case-sensitive)
    '/optimizely/TEST-flag',
    
    // With encoded characters
    '/optimizely/test-flag%20with%20spaces',
  ],
  noMatch: [
    // Different paths
    '/not-optimizely/test-flag',
    '/optimizely/different-flag',
    
    // Invalid formats
    '/optimizely/', 
    '/optimizely',
    
    // Invalid characters
    '/optimizely/%00test-flag',
  ]
};

/**
 * Get the full URL for Edge Agent
 */
export function getEdgeUrl(): string {
  return EDGE_AGENT_URL.endsWith('/') 
    ? EDGE_AGENT_URL.slice(0, -1) 
    : EDGE_AGENT_URL;
}

/**
 * Get the full URL for Agent endpoints
 */
export function getAgentUrl(): string {
  return getEdgeUrl();
}

/**
 * Get the test visitor IDs to use
 */
export function getVisitorIds(): string[] {
  return ['test-visitor-1', 'test-visitor-2', 'test-visitor-3'];
}

/**
 * Get test attributes for audience targeting
 */
export function getAttributes(): Record<string, any> {
  return {
    device: 'mobile',
    country: 'US',
    age: 25,
    returningUser: true
  };
}

/**
 * Get all feature keys to test
 */
export function getFeatureKeys(): string[] {
  return (process.env.FEATURE_KEYS || OPTIMIZELY_FLAG_KEY).split(',');
}

/**
 * Get all experiment keys to test
 */
export function getExperimentKeys(): string[] {
  return (process.env.EXPERIMENT_KEYS || OPTIMIZELY_EXPERIMENT_KEY).split(',');
} 