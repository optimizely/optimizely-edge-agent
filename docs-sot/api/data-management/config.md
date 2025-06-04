# Config API

## Overview

The `/api/config` endpoint provides dynamic access to OptimizelyConfig data with flexible querying capabilities. This endpoint enables you to:

- Retrieve complete project configuration
- Query specific features, experiments, audiences, or events
- Perform lookups by ID or key
- Filter and format responses
- Get summary statistics

## Endpoint

```
GET /api/config
```

## Authentication

Requires both admin token and SDK key for security:

### Required Headers
```bash
X-Optimizely-Enable-FEX: true
X-Optimizely-Admin-Token: your-admin-token
```

### SDK Key Options
```bash
# Header (recommended)
X-Optimizely-SDK-Key: your-sdk-key

# Query parameter
?sdkKey=your-sdk-key
```

### Environment Configuration
The admin token must be configured in your deployment:

```toml
# wrangler.toml
[vars]
ADMIN_TOKEN = "your_secure_admin_token"
```

## Query Parameters

### Resource Selection
| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `include` | string | Comma-separated resources to include | `?include=features,experiments` |
| `exclude` | string | Comma-separated resources to exclude | `?exclude=audiences,events` |
| `summary` | boolean | Return only counts | `?summary=true` |

### Lookup Operations
| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `lookup` | "key" \| "id" | Lookup method | `?lookup=key` |
| `value` | string | Value to lookup | `?value=checkout_flow` |
| `type` | "feature" \| "experiment" \| "audience" \| "event" | Resource type | `?type=feature` |

### Reverse Lookup
| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `reverseLookup` | "id" \| "key" | Return opposite of lookup | `?reverseLookup=id` |
| `key` | string | Key for reverse lookup | `?key=checkout_flow` |
| `type` | string | Resource type | `?type=feature` |

### Specific Resource Filters
| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `featureKey` | string | Get specific feature | `?featureKey=checkout_flow` |
| `experimentKey` | string | Get specific experiment | `?experimentKey=ab_test_1` |
| `audienceId` | string | Get specific audience | `?audienceId=123456` |
| `eventKey` | string | Get specific event | `?eventKey=purchase` |

### Format Control
| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `format` | "minimal" \| "standard" \| "full" | Detail level | `?format=minimal` |
| `metadata` | boolean | Include metadata | `?metadata=false` |

## Response Format

### Full Response (default)
```json
{
  "metadata": {
    "revision": "123",
    "sdkKey": "your-sdk-key",
    "environmentKey": "production",
    "timestamp": "2024-01-27T10:30:00.000Z",
    "requestId": "550e8400-e29b-41d4-a716"
  },
  "features": {
    "checkout_flow": {
      "id": "12345",
      "key": "checkout_flow",
      "variablesMap": {...},
      "experimentsMap": {...}
    }
  },
  "experiments": {...},
  "attributes": [...],
  "audiences": [...],
  "events": [...]
}
```

### Summary Response
```json
{
  "metadata": {...},
  "summary": {
    "totalFeatures": 42,
    "totalExperiments": 15,
    "totalAttributes": 8,
    "totalAudiences": 12,
    "totalEvents": 25
  }
}
```

### Lookup Response
```json
{
  "metadata": {...},
  "lookup": {
    "id": "12345",
    "key": "checkout_flow",
    "variablesMap": {...}
  }
}
```

## Examples

### Get Full Configuration
```bash
curl -X GET "https://edge.example.com/api/config" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-Admin-Token: your-admin-token" \
  -H "X-Optimizely-SDK-Key: your-sdk-key"
```

### Get Summary Only
```bash
curl -X GET "https://edge.example.com/api/config?summary=true" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-Admin-Token: your-admin-token" \
  -H "X-Optimizely-SDK-Key: your-sdk-key"
```

### Get Features Only (Minimal Format)
```bash
curl -X GET "https://edge.example.com/api/config?include=features&format=minimal" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-Admin-Token: your-admin-token" \
  -H "X-Optimizely-SDK-Key: your-sdk-key"
```

### Lookup Feature by Key
```bash
curl -X GET "https://edge.example.com/api/config?lookup=key&value=checkout_flow&type=feature" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-Admin-Token: your-admin-token" \
  -H "X-Optimizely-SDK-Key: your-sdk-key"
```

### Get Feature ID from Key
```bash
curl -X GET "https://edge.example.com/api/config?reverseLookup=id&key=checkout_flow&type=feature" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-Admin-Token: your-admin-token" \
  -H "X-Optimizely-SDK-Key: your-sdk-key"
```

### Get Specific Feature
```bash
curl -X GET "https://edge.example.com/api/config?featureKey=checkout_flow" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-Admin-Token: your-admin-token" \
  -H "X-Optimizely-SDK-Key: your-sdk-key"
```

### Exclude Large Data
```bash
curl -X GET "https://edge.example.com/api/config?exclude=variablesMap,experimentsMap" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-Admin-Token: your-admin-token" \
  -H "X-Optimizely-SDK-Key: your-sdk-key"
```

## Performance Considerations

### Caching
- OptimizelyConfig is cached for improved performance
- Default cache TTL: 60 minutes
- Configure via `OPTIMIZELY_CONFIG_CACHE_TTL` environment variable

### Response Size
- Large projects may have significant config data
- Use filtering parameters to reduce payload size
- Set `OPTIMIZELY_CONFIG_RESPONSE_SIZE_LIMIT` to enforce limits

### Optimization Tips
1. Use `summary=true` for quick overviews
2. Use `format=minimal` to reduce data transfer
3. Use `include/exclude` to get only needed data
4. Use specific resource queries for targeted data

## Error Responses

| Status | Error | Description |
|--------|-------|-------------|
| 400 | "SDK key is required" | No SDK key provided |
| 401 | "Admin token required for config endpoint" | Missing or invalid admin token |
| 404 | "Configuration not found for the provided SDK key" | Invalid SDK key or no datafile |
| 405 | "Method not allowed. Config endpoint supports GET only." | Non-GET request |
| 500 | "Failed to retrieve configuration" | Internal server error |
| 503 | "Decision service not available" | Service not initialized |

## Use Cases

### 1. Admin Dashboard
```javascript
// Get summary for overview
const summary = await fetch('/api/config?summary=true&sdkKey=' + SDK_KEY, {
  headers: {
    'X-Optimizely-Enable-FEX': 'true',
    'X-Optimizely-Admin-Token': ADMIN_TOKEN
  }
});
const data = await summary.json();
console.log(`Total features: ${data.summary.totalFeatures}`);
```

### 2. Feature Discovery
```javascript
// Find all features with minimal data
const features = await fetch('/api/config?include=features&format=minimal&sdkKey=' + SDK_KEY, {
  headers: {
    'X-Optimizely-Enable-FEX': 'true',
    'X-Optimizely-Admin-Token': ADMIN_TOKEN
  }
});
const data = await features.json();
Object.keys(data.features).forEach(key => {
  console.log(`Feature: ${key} (ID: ${data.features[key].id})`);
});
```

### 3. ID to Key Mapping
```javascript
// Convert feature ID to key
const lookup = await fetch(`/api/config?lookup=id&value=${featureId}&type=feature&sdkKey=${SDK_KEY}`, {
  headers: {
    'X-Optimizely-Enable-FEX': 'true',
    'X-Optimizely-Admin-Token': ADMIN_TOKEN
  }
});
const data = await lookup.json();
console.log(`Feature key: ${data.lookup?.key}`);
```

### 4. Debugging
```javascript
// Get complete feature details
const feature = await fetch(`/api/config?featureKey=${flagKey}&sdkKey=${SDK_KEY}`, {
  headers: {
    'X-Optimizely-Enable-FEX': 'true',
    'X-Optimizely-Admin-Token': ADMIN_TOKEN
  }
});
const data = await feature.json();
console.log('Feature config:', data.feature);
```

## Implementation Notes

- **Admin Authentication Required**: Config endpoint requires admin token for security
- **Read-Only**: This endpoint is read-only and doesn't modify any data
- **Platform Agnostic**: Works across all CDN platforms (Cloudflare, Fastly, Vercel)
- **Secure Access**: Admin token must be configured via ADMIN_TOKEN environment variable
- **Type Safety**: Response structure matches Optimizely SDK's OptimizelyConfig type

---

**Implementation Source**: `/src-v2/services/implementations/ApiRouter.ts:1001-1088`  
**Last Updated**: 2025-01-27