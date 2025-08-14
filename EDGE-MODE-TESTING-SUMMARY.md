# Edge Mode Testing Summary

## Overview

I have completed a comprehensive analysis of Edge Mode functionality and created a complete testing framework. Here's what has been delivered:

## What is Edge Mode?

Edge Mode is fundamentally different from Agent Mode:

- **Agent Mode**: POST requests to `/decide*` endpoints returning JSON decision data for applications to use
- **Edge Mode**: GET requests to content URLs that are intercepted and served with experimented content variations

### Key Differences

| Aspect | Agent Mode | Edge Mode |
|--------|------------|-----------|
| **Request Type** | POST to API endpoints | GET to content URLs |
| **Response** | JSON decisions | Actual web content |
| **Use Case** | Apps get decisions to render | Users get experimented content directly |
| **Configuration** | SDK parameters | `cdnVariationSettings` in feature flags |
| **Integration** | Application-driven | CDN/Edge-driven |

## Edge Mode Architecture

Edge Mode uses these key components:

1. **EdgeModeHandler** - Core processing logic
2. **URLMatcher** - Sophisticated URL pattern matching
3. **EdgeModeIntegration** - Service orchestration layer
4. **cdnVariationSettings** - Feature flag configuration for content routing

### Content Delivery Methods

Edge Mode can serve content in multiple ways:

1. **Alternative URLs** (`cdnResponseURL`) - Fetch from different content source
2. **Origin Forwarding** (`forwardRequestToOrigin=true`) - Forward to origin with experiment context
3. **Content Transformation** (`transformContent`) - Apply JavaScript transformations
4. **Caching Control** - Sophisticated caching with `cacheKey` and `cacheTTL`

## Testing Framework Created

### Files Created

1. **`/critical-testing-project/scripts/edge-mode/edge-mode-basic-test.js`**
   - Core Edge Mode functionality tests
   - URL interception verification
   - Edge Mode vs Agent Mode comparison
   - Visitor ID handling
   - Header validation

2. **`/critical-testing-project/scripts/edge-mode/edge-mode-comprehensive-test.js`**
   - Advanced Edge Mode features
   - URL pattern matching variations
   - Content delivery methods
   - Caching behavior
   - Visitor consistency and stickiness
   - Error handling scenarios

3. **`/critical-testing-project/scripts/edge-mode/run-edge-mode-tests.js`**
   - Test runner with environment validation
   - Comprehensive reporting
   - Error handling and troubleshooting guidance

4. **`/critical-testing-project/scripts/edge-mode/README.md`**
   - Complete setup and configuration guide
   - `cdnVariationSettings` field documentation
   - Debugging and troubleshooting guide
   - Testing checklist

## How to Test Edge Mode

### 1. Environment Setup

Set these environment variables:

```bash
EDGE_AGENT_URL=https://your-edge-agent.workers.dev
SDK_KEY=your-optimizely-sdk-key
EDGE_MODE_FLAG=your-edge-mode-flag-key  # optional
```

### 2. Configure Feature Flags

Create feature flags with `cdnVariationSettings` variables:

```json
{
  "cdnVariationSettings": {
    "cdnExperimentURL": "/products/*",
    "cdnResponseURL": "/products-v2/*",
    "forwardRequestToOrigin": "true",
    "cacheRequestToOrigin": "true",
    "cacheKey": "VARIATION_KEY",
    "cacheTTL": "3600"
  }
}
```

### 3. Run Tests

```bash
# Basic Edge Mode tests
node critical-testing-project/scripts/edge-mode/run-edge-mode-tests.js basic

# Or run directly
node critical-testing-project/scripts/edge-mode/edge-mode-basic-test.js
```

## Key Edge Mode Features to Test

### 1. URL Pattern Matching
- **cdnExperimentURL** patterns
- **pathRegex** for complex patterns
- Query parameter handling
- Path normalization (trailing slashes, etc.)

### 2. Content Delivery
- Alternative content sources via `cdnResponseURL`
- Origin forwarding with experiment context
- Content transformations
- Response header customization

### 3. Visitor Management
- Visitor ID generation and persistence
- Variation stickiness across requests
- Cookie management

### 4. Caching Behavior
- Cache key generation strategies
- TTL enforcement
- Cache hit/miss tracking

### 5. Tracing and Debugging
- Edge Mode activation headers
- Experiment context headers
- Cache status indicators

## Testing Strategy

The testing framework validates Edge Mode through:

1. **Functional Testing** - Core URL interception and processing
2. **Integration Testing** - End-to-end content delivery scenarios  
3. **Behavioral Testing** - Visitor consistency and stickiness
4. **Performance Testing** - Caching effectiveness
5. **Error Testing** - Graceful handling of invalid configurations

## Expected Test Results

When Edge Mode is working correctly, you should see:

### Response Headers
```
X-Optimizely-Edge-Mode: active
X-Optimizely-Flag: your-flag-key
X-Optimizely-Variation: your-variation-key
X-Optimizely-Visitor-Id: generated-or-provided-id
X-Edge-Cache: HIT|MISS
```

### Behaviors
- GET requests to matching URLs are intercepted
- Different content served based on experiment decisions
- Visitor IDs are generated and persisted
- Variations remain consistent for the same visitor
- Appropriate caching behavior

## Troubleshooting Guide

### Common Issues

1. **URLs not intercepted**
   - Check `cdnExperimentURL` pattern
   - Verify feature flag is enabled
   - Ensure traffic allocation includes test visitors

2. **No Edge Mode headers**
   - Flag missing `cdnVariationSettings`
   - URL pattern doesn't match
   - Visitor not bucketed into experiment

3. **Content not served**
   - `cdnResponseURL` not accessible
   - Invalid `forwardRequestToOrigin` setting
   - Caching configuration issues

### Debug Process
1. Run basic tests to verify Edge Mode activation
2. Check feature flag configuration
3. Verify URL patterns match test requests
4. Review response headers for debugging info
5. Test with different visitor IDs

## Next Steps

1. **Set up your Optimizely project** with feature flags containing `cdnVariationSettings`
2. **Configure URL patterns** that match your testing scenarios
3. **Run the basic tests** to verify Edge Mode is working
4. **Iterate on configuration** based on test results
5. **Scale to comprehensive testing** once basic functionality is confirmed

The testing framework provides comprehensive validation of Edge Mode functionality and will help ensure your Edge Agent is properly processing content experimentation workflows.

## Implementation Files Referenced

- `/src-v2/services/implementations/EdgeModeHandler.ts`
- `/src-v2/services/interfaces/IEdgeModeHandler.ts`
- `/src-v2/services/implementations/URLMatcher.ts`
- `/src-v2/tests/integration/EdgeMode.test.ts`
- `/docs-sot/configuration/edge-mode-configuration.md`