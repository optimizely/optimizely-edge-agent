/**
 * Test Configuration
 * 
 * This file contains the configuration settings for the integration tests.
 * Users can customize these values to test against their specific Cloudflare deployment.
 */

// Edge Mode test configuration
export interface EdgeModeConfig {
  baseUrl: string;
  sdkKey: string;
  testUrls: {
    match: string[];
    noMatch: string[];
  };
  visitorIds: string[];
}

// Agent Mode test configuration
export interface AgentModeConfig {
  baseUrl: string;
  sdkKey: string;
  featureKeys: string[];
  experimentKeys: string[];
  visitorIds: string[];
  attributes: Record<string, string | number | boolean>;
}

// Default Edge Mode test configuration
export const defaultEdgeModeConfig: EdgeModeConfig = {
  baseUrl: process.env.EDGE_AGENT_URL || 'https://optimizely-edge-agent.example.workers.dev',
  sdkKey: process.env.SDK_KEY || 'test-sdk-key',
  testUrls: {
    match: [
      '/products/123',
      '/categories/shoes?sort=price',
      '/homepage-test',
      '/search?q=test&page=1',  // URL with multiple query parameters
      '/api/data?version=v2'     // API URL with version parameter
    ],
    noMatch: [
      '/about-us',
      '/contact',
      '/terms-of-service',
      '/help/faq?section=orders'  // URL with query parameter that shouldn't match
    ]
  },
  visitorIds: [
    'test-visitor-1',
    'test-visitor-2',
    'test-visitor-3'
  ]
};

// Default Agent Mode test configuration
export const defaultAgentModeConfig: AgentModeConfig = {
  baseUrl: process.env.EDGE_AGENT_URL || 'https://optimizely-edge-agent.example.workers.dev',
  sdkKey: process.env.SDK_KEY || 'test-sdk-key',
  featureKeys: process.env.FEATURE_KEYS ? process.env.FEATURE_KEYS.split(',') : ['feature1', 'feature2', 'feature3'],
  experimentKeys: process.env.EXPERIMENT_KEYS ? process.env.EXPERIMENT_KEYS.split(',') : ['experiment1', 'experiment2'],
  visitorIds: [
    'test-visitor-1',
    'test-visitor-2',
    'test-visitor-3'
  ],
  attributes: {
    device: 'mobile',
    location: 'US',
    returningUser: true,
    daysSinceLastVisit: 5
  }
};

// Helper to merge user config with defaults
export function mergeWithDefaultEdgeModeConfig(userConfig: Partial<EdgeModeConfig> = {}): EdgeModeConfig {
  return {
    ...defaultEdgeModeConfig,
    ...userConfig,
    testUrls: {
      match: [...(userConfig.testUrls?.match || []), ...defaultEdgeModeConfig.testUrls.match],
      noMatch: [...(userConfig.testUrls?.noMatch || []), ...defaultEdgeModeConfig.testUrls.noMatch]
    }
  };
}

// Helper to merge user config with defaults
export function mergeWithDefaultAgentModeConfig(userConfig: Partial<AgentModeConfig> = {}): AgentModeConfig {
  return {
    ...defaultAgentModeConfig,
    ...userConfig,
    attributes: {
      ...defaultAgentModeConfig.attributes,
      ...(userConfig.attributes || {})
    }
  };
} 