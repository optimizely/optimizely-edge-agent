/**
 * @fileoverview Environment Detection Module
 * 
 * This module provides functionality to detect the current execution environment
 * (local or live) and enhance the test context with environment-specific information.
 * 
 * Created as part of the Testing Audit Reconciliation project (testing-audit-reconciliation-04-10-2025)
 */

/**
 * Detects the current execution environment
 * @param {object} context - Test context
 * @returns {object} Enhanced context with environment information
 */
function detectEnvironment(context = {}) {
  // Check if environment is explicitly set
  if (context.environment?.mode === 'live') {
    return enhanceContext(context, true);
  }
  
  // Check URL patterns
  const baseUrl = context.baseUrl || '';
  const isLive = baseUrl.includes('edge-agent.optimizely.com') || 
                !!process.env.CLOUDFLARE_WORKER_URL;
  
  return enhanceContext(context, isLive);
}

/**
 * Enhances the test context with environment-specific information
 * @param {object} context - Original test context
 * @param {boolean} isLive - Whether the environment is live
 * @returns {object} Enhanced context
 */
function enhanceContext(context, isLive) {
  return {
    ...context,
    isLiveEnvironment: isLive,
    environmentType: isLive ? 'live' : 'local',
    environmentName: isLive ? 'Cloudflare Workers' : 'Wrangler Local',
    // Additional environment-specific context
    timing: {
      requestTimeout: isLive ? 5000 : 1000,
      operationTimeout: isLive ? 10000 : 2000,
      retryDelay: isLive ? 500 : 100
    },
    // Network configurations
    network: {
      rateLimit: isLive ? true : false,
      rateLimitDelay: isLive ? 500 : 0,
      concurrentRequests: isLive ? 1 : 5
    },
    // Validation configurations
    validation: {
      strictHeaderMatching: !isLive,
      strictBodyMatching: !isLive,
      allowLiveStatusVariance: isLive,
      ignoreExtraProperties: isLive
    }
  };
}

/**
 * Creates a debug string representation of the environment
 * @param {object} context - Enhanced context
 * @returns {string} Debug string
 */
function getEnvironmentDebugString(context) {
  if (!context) return 'No context provided';
  
  const isLive = context.isLiveEnvironment;
  return `Environment: ${context.environmentName || (isLive ? 'Live' : 'Local')} (${isLive ? 'Production' : 'Development'})
Base URL: ${context.baseUrl || 'Not set'}
Explicitly Set: ${context.environment?.mode ? 'Yes' : 'No'}
Environment Variables: ${process.env.CLOUDFLARE_WORKER_URL ? 'CLOUDFLARE_WORKER_URL set' : 'CLOUDFLARE_WORKER_URL not set'}`;
}

module.exports = {
  detectEnvironment,
  enhanceContext,
  getEnvironmentDebugString
}; 