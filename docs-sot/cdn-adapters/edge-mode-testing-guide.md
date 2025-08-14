# Edge Mode Testing Guide

## Overview

This guide provides comprehensive information for testing Edge Mode functionality across all CDN platforms, with special focus on Cloudflare's same-zone limitations and testing workarounds.

## Table of Contents

1. [Platform-Specific Limitations](#platform-specific-limitations)
2. [Testing Setup Configurations](#testing-setup-configurations)
3. [Testing Edge Mode Features](#testing-edge-mode-features)
4. [Forced Decisions Testing](#forced-decisions-testing)
5. [Performance Testing](#performance-testing)
6. [Troubleshooting](#troubleshooting)

## Platform-Specific Limitations

### Cloudflare Same-Zone Restriction

**Critical Limitation**: Cloudflare Workers cannot fetch from other Workers or Pages in the same zone using standard Routes.

#### What Doesn't Work

```javascript
// ❌ Worker → Worker (same zone, using Routes)
await fetch('https://other-worker.example.com/api'); // 404 error

// ❌ Worker → Cloudflare Pages (same zone, using Routes)  
await fetch('https://pages.example.com/content'); // 404 error

// ❌ Worker → workers.dev subdomain (same zone)
await fetch('https://my-worker.username.workers.dev'); // 404 error
```

#### What Works

```javascript
// ✅ Worker → External origins (AWS, GCP, etc.)
await fetch('https://origin.aws.example.com/content'); // Works perfectly!

// ✅ Worker → Worker with Custom Domains
await fetch('https://api.example.com/content'); // Works with custom_domain = true

// ✅ Worker → Worker via Service Bindings
await env.CONTENT_SERVICE.fetch(request); // Direct binding, no network

// ✅ Worker → Any non-Cloudflare hosted content
await fetch('https://external-api.com/data'); // No restrictions
```

### Customer Deployment Implications

**Important**: Most production deployments fetch from external origins and are NOT affected by this limitation.

```javascript
// Typical customer deployment - NO ISSUES
{
  "cdnVariationSettings": {
    "cdnExperimentURL": "https://edge.customer.com/*",
    "cdnResponseURL": "https://origin.aws.customer.com/content/variation-b"
  }
}
```

## Testing Setup Configurations

### Option 1: Custom Domains (Recommended for Production-like Testing)

#### Step 1: Configure Custom Domains

```toml
# wrangler.toml for Edge Agent Worker
name = "optimizely-edge-agent"
main = "dist/cloudflare/index.js"

[[routes]]
pattern = "api.example.com/*"
custom_domain = true  # This enables same-zone fetching!

[vars]
CONTENT_BASE_URL = "https://content.example.com"
```

#### Step 2: Pages Custom Domain Setup

```bash
# In Cloudflare Dashboard:
# 1. Go to Pages > Your Project > Custom domains
# 2. Add: content.example.com
# 3. Ensure DNS points to Pages project
```

#### Step 3: Test Configuration

```javascript
// Flag configuration in Optimizely
{
  "flagKey": "homepage_test",
  "variables": {
    "cdnVariationSettings": {
      "cdnExperimentURL": "https://api.example.com/",
      "cdnResponseURL": "https://content.example.com/homepage-variation-b",
      "cacheKey": "homepage_test_v2",
      "cacheTTL": 3600,
      "forwardRequestToOrigin": "false",
      "cacheRequestToOrigin": "true"
    }
  }
}
```

### Option 2: Service Bindings (For Development)

```toml
# wrangler.toml
[[services]]
binding = "CONTENT_SERVICE"
service = "pages-content-worker"

# Or for Pages Functions
[[services]]
binding = "PAGES_CONTENT"
service = "pages-project-name"
```

```javascript
// Using service binding in Worker
export default {
  async fetch(request, env, ctx) {
    // Direct Worker-to-Worker communication
    const contentResponse = await env.CONTENT_SERVICE.fetch(request);
    return contentResponse;
  }
};
```

### Option 3: Debug Mode (For Local Testing)

```javascript
// URLMatcher includes debug flag support
if (parsedUrl.searchParams.has('force-edge-mode')) {
  return { matched: true, settings: debugSettings };
}
```

```bash
# Test with debug flag
curl http://localhost:8787/?force-edge-mode=true \
  -H "X-Optimizely-SDK-Key: 8mR1pGh8u2ztUP8GqjmQq"
```

## Testing Edge Mode Features

### Basic Edge Mode Test

```bash
#!/bin/bash
# test-edge-mode.sh

WORKER_URL="https://api.example.com"
SDK_KEY="8mR1pGh8u2ztUP8GqjmQq"

# Test 1: Verify Edge Mode is active
echo "Testing Edge Mode activation..."
curl -I "$WORKER_URL/" \
  -H "X-Optimizely-SDK-Key: $SDK_KEY" \
  -H "X-Optimizely-Visitor-ID: test-visitor-001"

# Check for Edge Mode headers
# Expected: X-Edge-Mode: active
```

### Content Routing Test

```javascript
// test-content-routing.js
const testContentRouting = async () => {
  const tests = [
    {
      name: "Control variation - fetch from origin",
      userId: "control-user",
      expectedSource: "origin"
    },
    {
      name: "Treatment variation - fetch from CDN",
      userId: "treatment-user",
      expectedSource: "cdn"
    }
  ];

  for (const test of tests) {
    const response = await fetch(`${WORKER_URL}/`, {
      headers: {
        'X-Optimizely-SDK-Key': SDK_KEY,
        'X-Optimizely-Visitor-ID': test.userId
      }
    });

    console.log(`${test.name}:`);
    console.log(`- Status: ${response.status}`);
    console.log(`- Content-Source: ${response.headers.get('X-Content-Source')}`);
    console.log(`- Variation: ${response.headers.get('X-Optimizely-Variation-Key')}`);
  }
};
```

### URL Pattern Matching Test

```javascript
// Test various URL patterns
const patterns = [
  { url: '/', expected: true },
  { url: '/products/123', expected: true },
  { url: '/api/data', expected: false }, // Excluded
  { url: '/admin/dashboard', expected: false } // Excluded
];

for (const { url, expected } of patterns) {
  const response = await fetch(`${WORKER_URL}${url}`, {
    headers: { 'X-Optimizely-SDK-Key': SDK_KEY }
  });
  
  const isEdgeMode = response.headers.get('X-Edge-Mode') === 'active';
  console.log(`${url}: ${isEdgeMode === expected ? '✅' : '❌'}`);
}
```

## Forced Decisions Testing

### Testing Forced Variations in Edge Mode

```bash
#!/bin/bash
# test-forced-decisions-edge-mode.sh

# Test 1: Force variation via header (highest precedence)
echo "Testing forced variation via header..."
curl "$WORKER_URL/" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: $SDK_KEY" \
  -H "X-Optimizely-Force-Variation: treatment" \
  -H "X-Optimizely-Visitor-ID: qa-tester"

# Test 2: Force variation via query parameter
echo -e "\n\nTesting forced variation via query..."
curl "$WORKER_URL/?forceVariation=control" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: $SDK_KEY"

# Test 3: Force specific rule/experiment
echo -e "\n\nTesting forced rule..."
curl "$WORKER_URL/" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: $SDK_KEY" \
  -H 'X-Optimizely-Forced-Decision: {"flagKey":"homepage_test","ruleKey":"exp_123","variationKey":"variant_b"}'
```

### Automated Edge Mode Testing

```javascript
// edge-mode-test-suite.js
import { describe, it, expect } from 'vitest';

describe('Edge Mode Integration', () => {
  const baseUrl = process.env.WORKER_URL || 'http://localhost:8787';
  
  it('should route to correct content source based on decision', async () => {
    // User bucketed into treatment
    const response = await fetch(baseUrl, {
      headers: {
        'X-Optimizely-SDK-Key': '8mR1pGh8u2ztUP8GqjmQq',
        'X-Optimizely-Visitor-ID': 'treatment-user-123'
      }
    });
    
    expect(response.status).toBe(200);
    expect(response.headers.get('X-Content-Source')).toBe('cdn');
    expect(response.headers.get('X-Edge-Mode')).toBe('active');
  });

  it('should respect forced decisions in Edge Mode', async () => {
    const response = await fetch(baseUrl, {
      headers: {
        'X-Optimizely-Enable-FEX': 'true',
        'X-Optimizely-SDK-Key': '8mR1pGh8u2ztUP8GqjmQq',
        'X-Optimizely-Force-Variation': 'special-variant'
      }
    });
    
    expect(response.headers.get('X-Optimizely-Variation-Key')).toBe('special-variant');
  });

  it('should handle debug mode', async () => {
    const response = await fetch(`${baseUrl}?force-edge-mode=true`, {
      headers: {
        'X-Optimizely-SDK-Key': '8mR1pGh8u2ztUP8GqjmQq'
      }
    });
    
    expect(response.headers.get('X-Edge-Mode')).toBe('active');
    expect(response.headers.get('X-Debug-Mode')).toBe('true');
  });
});
```

## Performance Testing

### Edge Mode Performance Benchmarks

```javascript
// performance-test.js
const runPerformanceTest = async () => {
  const iterations = 100;
  const results = {
    edgeMode: [],
    directFetch: []
  };

  // Test Edge Mode performance
  console.log('Testing Edge Mode performance...');
  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    await fetch(`${WORKER_URL}/`, {
      headers: {
        'X-Optimizely-SDK-Key': SDK_KEY,
        'X-Optimizely-Visitor-ID': `perf-user-${i}`
      }
    });
    results.edgeMode.push(Date.now() - start);
  }

  // Test direct origin fetch (baseline)
  console.log('Testing direct fetch performance...');
  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    await fetch(ORIGIN_URL);
    results.directFetch.push(Date.now() - start);
  }

  // Calculate statistics
  const stats = (arr) => ({
    avg: arr.reduce((a, b) => a + b) / arr.length,
    min: Math.min(...arr),
    max: Math.max(...arr),
    p95: arr.sort((a, b) => a - b)[Math.floor(arr.length * 0.95)]
  });

  console.log('Edge Mode:', stats(results.edgeMode));
  console.log('Direct Fetch:', stats(results.directFetch));
};
```

### Cache Performance Testing

```javascript
// cache-test.js
const testCachePerformance = async () => {
  const cacheKey = 'test-content-v1';
  
  // First request - cache miss
  const miss = await fetch(`${WORKER_URL}/products/123`, {
    headers: { 'X-Optimizely-SDK-Key': SDK_KEY }
  });
  
  console.log('Cache miss:', {
    status: miss.headers.get('X-Cache-Status'),
    time: miss.headers.get('X-Response-Time')
  });

  // Second request - cache hit
  const hit = await fetch(`${WORKER_URL}/products/123`, {
    headers: { 'X-Optimizely-SDK-Key': SDK_KEY }
  });
  
  console.log('Cache hit:', {
    status: hit.headers.get('X-Cache-Status'),
    time: hit.headers.get('X-Response-Time')
  });
};
```

## Troubleshooting

### Common Issues and Solutions

#### 1. 404 Errors on Same-Zone Fetch

**Symptom**: 
```
Failed to fetch content: 404 Not Found
```

**Solution**: Use one of the recommended approaches:
- Set up Custom Domains
- Use Service Bindings
- Change to external origin

#### 2. Edge Mode Not Activating

**Debug Steps**:
```bash
# Check if URL matches patterns
curl -v "$WORKER_URL/test-path" \
  -H "X-Optimizely-SDK-Key: $SDK_KEY" \
  2>&1 | grep "X-Edge-Mode"

# Force Edge Mode for testing
curl "$WORKER_URL/?force-edge-mode=true" \
  -H "X-Optimizely-SDK-Key: $SDK_KEY"
```

#### 3. Incorrect Content Routing

**Verify cdnVariationSettings**:
```javascript
// Check flag configuration
const response = await fetch(`${WORKER_URL}/api/datafile`, {
  headers: { 'X-Optimizely-SDK-Key': SDK_KEY }
});

const datafile = await response.json();
const flag = datafile.featureFlags.find(f => f.key === 'your-flag');
console.log('cdnVariationSettings:', flag.variables.cdnVariationSettings);
```

### Debug Headers

When debugging is enabled, these headers help troubleshoot:

```
X-Edge-Mode: active
X-Edge-Decision: treatment
X-Content-Source: cdn
X-Cache-Status: HIT
X-URL-Match: true
X-Debug-Mode: true
X-Fetch-URL: https://content.example.com/variation
```

### Logging and Metrics

```javascript
// Enable debug logging
export EDGE_MODE_DEBUG=true
export LOG_LEVEL=debug

// Check metrics
const metrics = await fetch(`${WORKER_URL}/api/metrics`, {
  headers: { 'Authorization': 'Bearer admin-token' }
});

console.log('Edge Mode Metrics:', await metrics.json());
```

## Best Practices

### 1. Test Environment Setup

```javascript
// test-config.js
export const TEST_CONFIG = {
  // Use external origin for CI/CD
  production: {
    workerUrl: 'https://edge.example.com',
    originUrl: 'https://origin.aws.example.com'
  },
  
  // Use Custom Domains for staging
  staging: {
    workerUrl: 'https://api-staging.example.com',
    originUrl: 'https://content-staging.example.com'
  },
  
  // Use debug mode for local
  local: {
    workerUrl: 'http://localhost:8787',
    originUrl: 'http://localhost:3000',
    debugMode: true
  }
};
```

### 2. Comprehensive Test Coverage

```javascript
// Run all Edge Mode tests
const runEdgeModeTests = async () => {
  await testURLMatching();
  await testContentRouting();
  await testForcedDecisions();
  await testCaching();
  await testPerformance();
  await testErrorHandling();
};
```

### 3. Monitor Edge Mode Health

```javascript
// health-check.js
const checkEdgeModeHealth = async () => {
  const checks = {
    edgeModeActive: false,
    contentFetchable: false,
    cacheWorking: false,
    decisionsWorking: false
  };

  // Test each component
  try {
    const response = await fetch(`${WORKER_URL}/health`, {
      headers: { 'X-Optimizely-SDK-Key': SDK_KEY }
    });
    
    const health = await response.json();
    return health;
  } catch (error) {
    console.error('Health check failed:', error);
    return checks;
  }
};
```

## See Also

- [Cloudflare Adapter Documentation](./cloudflare-adapter.md#important-limitations)
- [Edge Mode Configuration](../configuration/edge-mode-configuration.md)
- [Forced Decisions Guide](../api/testing/forced-decisions-guide.md)
- [Customer Deployment Patterns](/CUSTOMER-DEPLOYMENT-PATTERNS.md)
- [Testing Setup Guide](/EDGE-MODE-TESTING-SETUP-GUIDE.md)