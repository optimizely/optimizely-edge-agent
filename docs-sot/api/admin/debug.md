# Debug API

Inspect and validate Edge Agent configuration and request processing.

## Overview

The `/api/debug` endpoint helps you understand:
- **How parameters are resolved** from headers, query, and body
- **What configuration is active** for your request
- **Which sources provided** each parameter value
- **Request validation issues** and missing parameters

This is essential for troubleshooting integration issues and understanding the Edge Agent's behavior.

## Authentication

**Required Headers:**
```http
X-Optimizely-Enable-FEX: true
```

Note: SDK key can be provided but is not required for debug access.

## POST /api/debug

Analyze request configuration and parameter resolution.

### Method Requirement

**Only POST method is supported** to allow sending test parameters in the request body.

### Request Format

Send any parameters you would normally send to other endpoints:

```json
{
  "userId": "test_user",
  "flagKey": "my_feature",
  "attributes": {
    "country": "US",
    "plan": "premium"
  },
  "decideOptions": ["INCLUDE_REASONS"],
  "sdkKey": "your-sdk-key"
}
```

### Response Format

**Success Response (200):**
```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "method": "POST",
  "path": "/api/debug",
  "headers": {
    "content-type": "application/json",
    "x-optimizely-enable-fex": "true",
    "x-optimizely-sdk-key": "your-sdk-key",
    "host": "your-deployment.com",
    "user-agent": "curl/7.68.0"
  },
  "queryParams": {
    "verbose": "true"
  },
  "config": {
    "sdkKey": "your-sdk-key",
    "userId": "test_user",
    "visitorId": "test_user",
    "configMetadata": {
      "sdkKey": "your-sdk-key",
      "sdkKeyFrom": "header",
      "visitorId": "test_user",
      "visitorIdFrom": "body",
      "attributes": {
        "country": "US",
        "plan": "premium"
      },
      "attributesFrom": "body",
      "decideOptions": ["INCLUDE_REASONS"],
      "flagKeysDecided": ["my_feature"],
      "flagKeysFrom": "body",
      "datafileFrom": "cdn",
      "agentServerMode": true,
      "pathName": "/api/debug",
      "trimmedDecisions": true,
      "decideAll": false,
      "storedDecisionsFound": false,
      "storedCookieDecisions": [],
      "forcedDecisions": [],
      "cdnVariationSettings": {}
    },
    "setResponseHeaders": true,
    "setResponseCookies": true,
    "setRequestHeaders": true,
    "setRequestCookies": true,
    "attributes": {
      "country": "US",
      "plan": "premium"
    }
  },
  "attributes": {
    "country": "US",
    "plan": "premium"
  },
  "eventTags": {},
  "eventKey": null
}
```

## Understanding the Response

### Parameter Sources

The `configMetadata` section shows where each parameter came from:

| Field | Possible Sources | Priority Order |
|-------|-----------------|----------------|
| `sdkKeyFrom` | "header", "query", "body", "initialization" | Header → Query → Body |
| `visitorIdFrom` | "header", "query", "body", "cookie", "override" | Header → Query → Body → Cookie |
| `attributesFrom` | "header", "query", "body" | Header → Query → Body |
| `flagKeysFrom` | "header", "query", "body" | Header → Query → Body |
| `decideOptionsFrom` | Multiple sources combined | All sources merged |
| `datafileFrom` | "kv", "cdn" | Based on configuration |

### Configuration Flags

| Flag | Description | Default |
|------|-------------|---------|
| `agentServerMode` | Whether request is to API endpoint | Detected from path |
| `trimmedDecisions` | Return minimal decision format | true |
| `setResponseHeaders` | Add decision headers to response | true |
| `setResponseCookies` | Set decision cookies in response | true |
| `enableResponseMetadata` | Include metadata in responses | false |

## Examples

### Basic Configuration Check
```bash
curl -X POST "https://your-deployment/api/debug" \
  -H "Content-Type: application/json" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: your-sdk-key" \
  -d '{}'
```

### Test Parameter Precedence
```bash
# Send same parameter via multiple sources
curl -X POST "https://your-deployment/api/debug?userId=query_user" \
  -H "Content-Type: application/json" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-Visitor-Id: header_user" \
  -d '{
    "userId": "body_user"
  }'

# Response will show:
# "visitorId": "header_user"
# "visitorIdFrom": "header"
```

### Debug Decision Configuration
```bash
curl -X POST "https://your-deployment/api/debug" \
  -H "Content-Type: application/json" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: your-sdk-key" \
  -H "X-Optimizely-Decide-Options: [\"INCLUDE_REASONS\"]" \
  -d '{
    "userId": "test_user",
    "flagKey": "feature_x",
    "attributes": {
      "device": "mobile",
      "country": "US"
    },
    "decideOptions": ["EXCLUDE_VARIABLES"]
  }'
```

### Test Cookie and Header Control
```bash
curl -X POST "https://your-deployment/api/debug" \
  -H "Content-Type: application/json" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-Set-Response-Headers: false" \
  -H "X-Optimizely-Set-Response-Cookies: false" \
  -d '{
    "userId": "test_user",
    "setResponseHeaders": true,
    "setResponseCookies": true
  }'

# Response shows header takes precedence:
# "setResponseHeaders": false (from header)
# "setResponseCookies": false (from header)
```

## Common Use Cases

### 1. Troubleshooting Missing Parameters
```javascript
// If decide endpoint returns "flag key parameter is required"
// Use debug to see what's being received:

const debugResponse = await fetch('/api/debug', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Optimizely-Enable-FEX': 'true',
    'X-Optimizely-SDK-Key': SDK_KEY,
    'X-Optimizely-Flag-Key': 'my_flag'  // Try header
  },
  body: JSON.stringify({
    userId: 'user123',
    flagKey: 'my_flag'  // And body
  })
});

const debug = await debugResponse.json();
console.log('Flag key from:', debug.config.configMetadata.flagKeysFrom);
console.log('Flag keys detected:', debug.config.configMetadata.flagKeysDecided);
```

### 2. Verify Visitor ID Resolution
```javascript
// Check where visitor ID is coming from
const sources = ['header', 'query', 'body', 'cookie'];

for (const source of sources) {
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Optimizely-Enable-FEX': 'true'
    }
  };
  
  if (source === 'header') {
    options.headers['X-Optimizely-Visitor-Id'] = 'header_visitor';
  } else if (source === 'query') {
    options.url = '/api/debug?visitorId=query_visitor';
  } else if (source === 'body') {
    options.body = JSON.stringify({ visitorId: 'body_visitor' });
  }
  
  const response = await fetch(options.url || '/api/debug', options);
  const data = await response.json();
  console.log(`${source}: visitorIdFrom = ${data.config.configMetadata.visitorIdFrom}`);
}
```

### 3. Test Attribute Extraction
```bash
# Test different attribute formats
curl -X POST "https://your-deployment/api/debug" \
  -H "Content-Type: application/json" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-Attributes: {\"header_attr\":\"value1\"}" \
  -d '{
    "userId": "test_user",
    "attributes": {
      "body_attr": "value2",
      "numeric": 123,
      "boolean": true,
      "nested": {
        "key": "value"
      }
    }
  }'
```

## Debug Headers in Responses

When debug mode is enabled, responses include additional headers:

```http
X-Optimizely-Debug-Config: {
  "setResponseHeaders": true,
  "setResponseCookies": true,
  "userId": "test_use...",
  "decisions": true
}

X-Optimizely-Debug-Decision-Format: {
  "type": "single",
  "trimmed": true,
  "count": 1
}
```

Enable debug headers by:
1. Using the debug endpoint (automatic)
2. Setting environment variable `OPTIMIZELY_ENABLE_DEBUG_HEADERS=true`
3. Including header `X-Optimizely-Enable-Debug-Headers: true`

## Metadata Fields Explained

### Core Identification
- `visitorId` - The resolved user/visitor identifier
- `visitorIdFrom` - Where the ID was found (header/query/body/cookie/override)
- `sdkKey` - The SDK key being used
- `sdkKeyFrom` - Where the SDK key was found

### Decision Configuration
- `flagKeysDecided` - Array of flag keys to be evaluated
- `flagKeysFrom` - Where flag keys were specified
- `decideOptions` - Merged array of all decide options
- `trimmedDecisions` - Whether to return minimal response format

### Feature Flags
- `attributes` - User attributes for targeting
- `attributesFrom` - Where attributes were found
- `forcedDecisions` - Any forced variations set
- `storedDecisionsFound` - Whether sticky decisions exist

### Request Context
- `agentServerMode` - true for API endpoints, false for edge mode
- `pathName` - The request path
- `datafileFrom` - Expected datafile source (kv/cdn)

### Response Control
- `setResponseHeaders` - Whether to add decision headers
- `setResponseCookies` - Whether to set decision cookies
- `enableResponseMetadata` - Whether to include metadata in responses

## Troubleshooting Common Issues

### "The Optimizely Edge Agent is disabled"
```bash
# Debug why agent is disabled
curl -X POST "https://your-deployment/api/debug" \
  -H "Content-Type: application/json" \
  -d '{}'

# Check for X-Optimizely-Enable-FEX header
```

### Parameter Not Being Recognized
```bash
# Send parameter via all sources to test precedence
curl -X POST "https://your-deployment/api/debug?param=query_value" \
  -H "X-Optimizely-Param: header_value" \
  -d '{"param": "body_value"}'

# Check which source is used in response
```

### Attributes Not Working
```bash
# Test attribute parsing
curl -X POST "https://your-deployment/api/debug" \
  -H "Content-Type: application/json" \
  -H "X-Optimizely-Enable-FEX: true" \
  -d '{
    "userId": "test",
    "attributes": {
      "test_attribute": "value"
    }
  }'

# Verify attributes and attributesFrom in response
```

## Best Practices

1. **Use debug endpoint first** when integrating new features
2. **Test parameter precedence** to ensure correct values are used
3. **Verify attribute extraction** for complex targeting rules
4. **Check visitor ID resolution** when implementing user identification
5. **Monitor metadata fields** to understand request processing

## Related Endpoints

- **[Decision API](../decisions/)** - Make feature flag decisions
- **[Forced Variations](./forced-variations.md)** - Override decisions
- **[Configuration](../configuration/)** - Edge Agent configuration

---

**Implementation Source**: `/src-v2/services/implementations/ApiRouter.ts:3017-3060`  
**Last Updated**: 2025-05-28