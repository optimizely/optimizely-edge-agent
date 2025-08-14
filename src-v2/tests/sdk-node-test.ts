/**
 * Test Script for Optimizely Node.js SDK Integration
 * 
 * This script verifies that our Node.js SDK integration is working correctly
 * in a Cloudflare Workers environment by creating a minimal client and checking
 * for browser compatibility issues.
 */

import * as optimizely from '@optimizely/optimizely-sdk/dist/optimizely.lite.es';

// Define a minimal datafile for testing
const minimalDatafile = {
  version: '4',
  rollouts: [],
  anonymizeIP: true,
  projectId: 'test-project',
  variables: [],
  featureFlags: [
    {
      id: 'test-flag',
      key: 'test-flag',
      experimentIds: [],
      rolloutId: '',
      variables: []
    }
  ],
  experiments: [],
  audiences: [],
  groups: [],
  attributes: [],
  botFiltering: false,
  events: [],
  revision: 'test-revision'
};

// Test function to be called directly
async function testNodeSdkIntegration() {
  console.log('🧪 Testing Optimizely Node.js SDK integration');
  
  try {
    // Create a logger that doesn't use browser APIs
    const logger = {
      log: (level: any, message: string) => {
        console.log(`[${level}] ${message}`);
      }
    };
    
    // Create error handler
    const errorHandler = {
      handleError: (error: Error) => {
        console.error('SDK Error:', error.message);
      }
    };
    
    // Create Optimizely client
    console.log('Creating Optimizely client...');
    const client = optimizely.createInstance({
      datafile: JSON.stringify(minimalDatafile),
      logger,
      errorHandler
    });
    
    // Check if client was created successfully
    if (!client) {
      throw new Error('Failed to create Optimizely client');
    }
    
    console.log('✅ Successfully created Optimizely client');
    
    // Create a user context
    const userId = 'test-user';
    console.log(`Creating user context for user '${userId}'...`);
    const userContext = client.createUserContext(userId);
    
    if (!userContext) {
      throw new Error('Failed to create user context');
    }
    
    console.log('✅ Successfully created user context');
    
    // Get a decision
    console.log(`Making decision for flag 'test-flag'...`);
    const decision = userContext.decide('test-flag');
    
    console.log('✅ Successfully made decision:', decision);
    
    return {
      success: true,
      message: 'Node SDK integration test passed',
      client: true,
      userContext: true,
      decision: true
    };
  } catch (error) {
    console.error('❌ Node SDK integration test failed:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
      error: error
    };
  }
}

// Run the test
testNodeSdkIntegration().then(result => {
  console.log('Test result:', result);
});

// Export for potential automation/external usage
export { testNodeSdkIntegration }; 