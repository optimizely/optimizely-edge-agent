# Edge Mode Path Configuration Guide

## Overview
Edge Mode requires URL pattern configuration to determine which requests should trigger content replacement. There are two main fields for this:

1. **`cdnExperimentURL`** - Simple URL path matching
2. **`pathRegex`** - Regular expression pattern for complex matching

**IMPORTANT**: At least ONE of these fields must be configured for Edge Mode to work.

## Configuration Fields

### cdnExperimentURL
- **Type**: String
- **Purpose**: Simple path matching
- **Example**: `/homepage`, `/product/*`, `/`
- **Use Case**: When you want to match exact paths or simple patterns

### pathRegex  
- **Type**: String (Regular Expression)
- **Purpose**: Complex pattern matching with regex
- **Example**: `^/products/[0-9]+$`, `^/(home|index)\.html$`
- **Use Case**: When you need more sophisticated URL matching logic

## CDNVariationSettings Structure

```json
{
  "cdnVariationSettings": {
    // URL Matching (at least one required)
    "cdnExperimentURL": "/",           // Simple path to match
    "pathRegex": "^/.*$",              // OR regex pattern
    
    // Content Source (at least one required)
    "cdnResponseURL": "https://example.com/variation-a.html",  // External content URL
    "forwardRequestToOrigin": "false",                         // OR forward to origin
    
    // Optional Configuration
    "cacheKey": "VARIATION_KEY",       // Cache identifier
    "cacheTTL": "3600",                // Cache time in seconds
    "ignoreQueryParams": "true",       // Ignore query strings in matching
    "requiredQueryParams": "utm_source,utm_campaign",  // Required params
    "responseHeaders": "{\"X-Test\":\"value\"}"        // Additional headers
  }
}
```

## Example Configurations

### 1. Simple Homepage Test
```json
{
  "cdnVariationSettings": {
    "cdnExperimentURL": "/",
    "cdnResponseURL": "https://github.io/variation-a/index.html"
  }
}
```

### 2. Product Pages with Regex
```json
{
  "cdnVariationSettings": {
    "pathRegex": "^/products/[a-zA-Z0-9-]+$",
    "cdnResponseURL": "https://cdn.example.com/products/variation-b.html"
  }
}
```

### 3. Multiple Pages Pattern
```json
{
  "cdnVariationSettings": {
    "pathRegex": "^/(home|about|contact)$",
    "cdnResponseURL": "https://cdn.example.com/multi-page-test.html"
  }
}
```

### 4. Catch-All Pattern
```json
{
  "cdnVariationSettings": {
    "pathRegex": "^/.*$",  // Matches all paths
    "cdnResponseURL": "https://cdn.example.com/global-test.html"
  }
}
```

## For edge_mode_final_test Flag

The flag needs configuration like this for each variation:

### Control Variation
```json
{
  "cdnVariationSettings": {
    "pathRegex": "^/$",  // Match root path
    "cdnResponseURL": "https://simone-coelho.github.io/optimizely-edge-mode-demo/control.html",
    "cacheKey": "VARIATION_KEY",
    "cacheTTL": "300"
  }
}
```

### Variation A
```json
{
  "cdnVariationSettings": {
    "pathRegex": "^/$",
    "cdnResponseURL": "https://simone-coelho.github.io/optimizely-edge-mode-demo/variation-a.html",
    "cacheKey": "VARIATION_KEY",
    "cacheTTL": "300"
  }
}
```

### Variation B
```json
{
  "cdnVariationSettings": {
    "pathRegex": "^/$",
    "cdnResponseURL": "https://simone-coelho.github.io/optimizely-edge-mode-demo/variation-b.html",
    "cacheKey": "VARIATION_KEY",
    "cacheTTL": "300"
  }
}
```

## Common Issues

### Issue: "Missing both cdnExperimentURL and pathRegex"
**Solution**: Add at least one URL pattern field to your cdnVariationSettings

### Issue: "No content source specified"
**Solution**: Add either `cdnResponseURL` or set `forwardRequestToOrigin: true`

### Issue: Edge Mode not triggering
**Possible Causes**:
1. URL pattern doesn't match the request path
2. Missing required configuration fields
3. Flag not enabled for the user
4. X-Optimizely-Enable-FEX header not set to true

## Testing Your Configuration

1. **Check flag configuration**:
```bash
curl -s "http://localhost:8787/api/decide?flagKey=YOUR_FLAG&userId=test" \
  -H "X-Optimizely-SDK-Key: YOUR_SDK_KEY" | jq '.variables.cdnVariationSettings'
```

2. **Test Edge Mode**:
```bash
curl -s "http://localhost:8787/" \
  -H "X-Optimizely-SDK-Key: YOUR_SDK_KEY" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-Forced-Decisions: {\"YOUR_FLAG\":{\"variationKey\":\"control\"}}"
```

3. **Verify headers**:
Look for these response headers:
- `X-Optimizely-Variation`: Should show the variation key
- `X-Optimizely-Cache`: Shows cache hit/miss
- `X-Optimizely-Mode`: Should show "edge" when active