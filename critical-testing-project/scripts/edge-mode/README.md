# Edge Mode Testing Guide

## Overview

Edge Mode is fundamentally different from Agent Mode in how it operates:

- **Agent Mode**: POST requests to `/decide*` endpoints returning JSON decision data
- **Edge Mode**: GET requests to content URLs that are intercepted and served with experimented variations

## Edge Mode vs Agent Mode

| Aspect | Agent Mode | Edge Mode |
|--------|------------|-----------|
| **Request Method** | POST | GET |
| **Endpoints** | `/decide`, `/decide-all`, `/decide-for-keys` | Any URL path matching `cdnExperimentURL` |
| **Response Type** | JSON with decisions | Actual content (HTML, images, etc.) |
| **Use Case** | Application gets decisions to render content | Users get experimented content directly |
| **Configuration** | SDK parameters | `cdnVariationSettings` in feature flags |

## How Edge Mode Works

1. **URL Matching**: Incoming GET requests are matched against `cdnExperimentURL` patterns in feature flags
2. **Decision Making**: If URL matches, Optimizely decisions are made for the visitor
3. **Content Routing**: Based on `cdnVariationSettings`, content is either:
   - Fetched from alternative URL (`cdnResponseURL`)
   - Forwarded to origin with experiment context (`forwardRequestToOrigin=true`)
   - Transformed using JavaScript functions (`transformContent`)

## Setting Up Edge Mode Testing

### 1. Configure Feature Flags with cdnVariationSettings

In your Optimizely project, create feature flags with `cdnVariationSettings` variables:

```json
{
  "cdnVariationSettings": {
    "cdnExperimentURL": "https://example.com/products/*",
    "cdnResponseURL": "https://example.com/products-v2/*", 
    "cacheKey": "VARIATION_KEY",
    "cacheTTL": "3600",
    "forwardRequestToOrigin": "true",
    "cacheRequestToOrigin": "true",
    "isControlVariation": "false"
  }
}
```

### 2. Environment Variables

Set these environment variables for testing:

```bash
# Edge Agent deployment URL
EDGE_AGENT_URL=https://your-edge-agent.workers.dev

# SDK Key for project with Edge Mode flags
SDK_KEY=your-optimizely-sdk-key

# Optional: Specific flag for Edge Mode testing
EDGE_MODE_FLAG=your-edge-mode-flag-key
```

### 3. Understanding cdnVariationSettings

| Field | Description | Example |
|-------|-------------|---------|
| `cdnExperimentURL` | URL pattern to match | `/products/*` |
| `cdnResponseURL` | Alternative content source | `/products-v2/*` |
| `forwardRequestToOrigin` | Forward to origin server | `"true"` or `"false"` |
| `cacheRequestToOrigin` | Cache the response | `"true"` or `"false"` |
| `cacheKey` | Cache identifier | `"VARIATION_KEY"` or custom |
| `cacheTTL` | Cache duration in seconds | `"3600"` |
| `pathRegex` | Regular expression pattern | `^/products/\\d+$` |
| `requiredQueryParams` | Required query parameters | `category,sort` |
| `ignoreQueryParams` | Ignore specific parameters | `utm_source,ref` |
| `responseHeaders` | Custom response headers | `{"X-Variant": "A"}` |
| `transformContent` | JavaScript transformation | `return content.replace(...)` |

## Test Scripts

### Basic Edge Mode Test

```bash
node scripts/edge-mode/edge-mode-basic-test.js
```

Tests core Edge Mode functionality:
- URL interception and processing
- Visitor ID handling
- Edge Mode vs Agent Mode behavior
- Response headers and tracing

### Comprehensive Edge Mode Test

```bash
node scripts/edge-mode/edge-mode-comprehensive-test.js
```

Tests advanced Edge Mode features:
- URL pattern matching variations
- Content delivery methods
- Caching behavior
- Visitor consistency and stickiness
- Error handling scenarios

## Debugging Edge Mode

### Enable Debug Headers

Look for these response headers to understand Edge Mode processing:

```
X-Optimizely-Edge-Mode: active
X-Optimizely-Flag: your-flag-key
X-Optimizely-Variation: your-variation-key
X-Optimizely-Visitor-Id: visitor-123
X-Edge-Cache: HIT|MISS
```

### Common Issues

1. **URLs not being intercepted**
   - Check `cdnExperimentURL` pattern matches your request URLs
   - Verify feature flag is enabled and has traffic allocation
   - Ensure SDK key is correct

2. **No Edge Mode headers**
   - Flag might not have `cdnVariationSettings` configured
   - URL pattern might not match
   - Visitor might not be bucketed into experiment

3. **Content not being served**
   - Check `cdnResponseURL` is accessible
   - Verify `forwardRequestToOrigin` setting
   - Check caching configuration

### URL Pattern Testing

Test URL patterns with different formats:

```javascript
// Test exact matches
"/products/123"

// Test wildcard patterns  
"/products/*"

// Test with query parameters
"/products/123?sort=price"

// Test path normalization
"/products/123/"  // with trailing slash
"/products//123"  // with double slashes
```

## Example Edge Mode Request Flow

1. **User visits** `https://your-site.com/products/shoes`
2. **Edge Agent intercepts** the GET request
3. **URL Matcher** checks if `/products/shoes` matches any `cdnExperimentURL`
4. **Decision Service** makes Optimizely decisions for the visitor
5. **Edge Mode Handler** processes based on `cdnVariationSettings`:
   - If `cdnResponseURL`: Fetch content from alternative URL
   - If `forwardRequestToOrigin=true`: Forward to origin with experiment context
   - If `transformContent`: Apply JavaScript transformations
6. **Response** is returned with appropriate headers and cookies

## Testing Checklist

- [ ] Feature flag configured with `cdnVariationSettings`
- [ ] URL patterns match test requests
- [ ] SDK key is valid and has access to flags
- [ ] Environment variables are set correctly
- [ ] Test URLs are accessible (if using `cdnResponseURL`)
- [ ] Traffic allocation allows test visitors to be bucketed

## Next Steps

1. Run basic Edge Mode tests to verify setup
2. Configure specific URL patterns for your use case
3. Test different content delivery methods
4. Verify caching and visitor persistence
5. Test error scenarios and edge cases

For detailed implementation analysis, see:
- `/docs-sot/configuration/edge-mode-configuration.md`
- `/src-v2/services/implementations/EdgeModeHandler.ts`
- `/src-v2/tests/integration/EdgeMode.test.ts`