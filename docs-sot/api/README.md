# API Reference

## Overview

The Optimizely Edge Agent v2 provides a comprehensive RESTful API for feature flag decisions, datafile management, and administrative operations. This API runs at the edge, delivering sub-millisecond response times with global availability.

## API Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         Edge Agent API Architecture                      │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Client Request          API Router              Service Layer           │
│  ┌──────────────┐      ┌─────────────┐        ┌──────────────┐           │
│  │   HTTP/REST  │      │   Route     │        │  Decision    │           │
│  │              │────▶│   Match     │───────▶│  Service     │           │
│  │  JSON Body   │      │   Handler   │        │              │           │
│  └──────────────┘      └─────────────┘        └──────────────┘           │
│                               │                                          │
│                        ┌──────┴──────┐                                   │
│                        │ Middleware  │                                   │
│                        │ • Auth      │                                   │
│                        │ • Validate  │                                   │
│                        │ • Headers   │                                   │
│                        └─────────────┘                                   │
│                                                                          │
│  API Endpoints:                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐     │
│  │ Decisions    │ Data         │ Admin        │ Utility            │     │
│  ├──────────────┼──────────────┼──────────────┼────────────────────┤     │
│  │ /decide      │ /datafile    │ /admin/*     │ /debug             │     │
│  │ /decide-all  │ /flagkeys    │ /force-*     │ /sdk               │     │
│  │ /decide-for-keys │           │             │                    │     │
│  └─────────────────────────────────────────────────────────────────┘     │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Basic Decision Request

```bash
# Get a single feature flag decision
curl -X POST https://edge.example.com/api/decide \
  -H "Content-Type: application/json" \
  -H "X-Optimizely-SDK-Key: your-sdk-key" \
  -H "X-Optimizely-Enable-FEX: true" \
  -d '{
    "userId": "user123",
    "flagKey": "checkout_flow"
  }'
```

### Decision with Forced Variation

```bash
# Force a specific variation for testing
curl -X POST https://edge.example.com/api/decide \
  -H "Content-Type: application/json" \
  -H "X-Optimizely-SDK-Key: your-sdk-key" \
  -H "X-Optimizely-Enable-FEX: true" \
  -d '{
    "userId": "qa_tester",
    "flagKey": "checkout_flow",
    "forcedDecisions": {
      "checkout_flow": {"variationKey": "express_checkout"}
    }
  }'
```

### Response

```json
{
  "enabled": true,
  "variationKey": "new_checkout",
  "ruleKey": "targeted_rollout",
  "flagKey": "checkout_flow",
  "variables": {},
  "reasons": []
}
```

## Base Configuration

### Base URL
```
https://your-domain.com/api
```

### Required Headers
| Header | Required | Description |
|--------|----------|-------------|
| `X-Optimizely-Enable-FEX` | Yes | Must be `true` to enable Edge Agent |
| `X-Optimizely-SDK-Key` | Sometimes* | Your Optimizely SDK key |
| `Content-Type` | Yes (POST) | Must be `application/json` for POST requests |
| `X-Request-ID` | No | Unique request identifier for tracing |

*SDK key can also be provided via query parameter or request body.

## API Endpoints

### 🎯 Decision Endpoints
Make feature flag decisions for your users.

#### [GET/POST /api/decide](./decisions/decide.md)
Get a decision for a single feature flag.

#### [GET/POST /api/decide-all](./decisions/decide-all.md)
Get decisions for all feature flags.

#### [GET/POST /api/decide-for-keys](./decisions/decide-for-keys.md)
Get decisions for specific feature flags.

#### [GET/POST /api/decide-options](./decisions/decide-options.md)
Configure decision options.

### 📊 Data Management
Access and manage Optimizely datafiles.

#### [GET/PUT/POST /api/datafile](./data-management/datafile.md)
Retrieve, update, or fetch the current datafile.

#### [GET/PUT/POST /api/flagkeys](./data-management/flagkeys.md)
List, update, or filter feature flag keys.

#### [GET /api/sdk](./data-management/sdk-info.md)
Get SDK and datafile information.

#### [GET /api/config](./data-management/config.md)
Get OptimizelyConfig with dynamic querying capabilities.

#### [GET/PUT/POST /api/variations](./data-management/variations.md)
Manage variations (GET returns 501 Not Implemented).

### 🔧 Admin Endpoints
Administrative operations for testing and debugging.

#### Forced Variations (Deprecated)
> **⚠️ These endpoints are deprecated.** Use `/api/decide` with `forcedDecisions` parameter instead.

- [POST/PUT /api/set-forced-variation](./admin/forced-variations.md#set) ⚠️ **DEPRECATED**
- [GET/POST /api/get-forced-variation](./admin/forced-variations.md#get) ⚠️ **DEPRECATED**
- [POST/DELETE /api/remove-forced-variation](./admin/forced-variations.md#remove) ⚠️ **DEPRECATED**
- [POST/DELETE /api/remove-all-forced-decisions](./admin/forced-variations.md#remove-all) ⚠️ **DEPRECATED**

#### System Operations
- [POST /api/debug](./admin/debug.md) - Debug information
- [POST /api/admin/cache/clear](./admin/cache.md) - Clear cache (admin only)
- [GET /api/admin/status](./admin/status.md) - Service status (admin only)

## Authentication

The Edge Agent supports multiple authentication methods:

```typescript
// 1. Header-based (recommended)
headers: {
  'X-Optimizely-SDK-Key': 'your-sdk-key',
  'X-Optimizely-Enable-FEX': 'true'
}

// 2. Query parameter
?sdkKey=your-sdk-key

// 3. Request body
{
  "sdkKey": "your-sdk-key",
  "userId": "user123"
}
```

Administrative endpoints require additional authentication:
```http
X-Optimizely-Admin-Token: your-admin-token
```

[Full authentication guide →](./authentication.md)

## Parameter Precedence

When the same parameter is provided in multiple places, the following precedence applies:

1. **Headers** (highest priority)
2. **Query parameters**
3. **Request body** (lowest priority)

```javascript
// Example: SDK key precedence
// Header wins over query and body
X-Optimizely-SDK-Key: production-key  // ← This is used
?sdkKey=staging-key
{ "sdkKey": "development-key" }
```

## Common Parameters

### User Identification
```json
{
  "userId": "user123",           // Required: Unique user identifier
  "userAttributes": {            // Optional: User attributes for targeting
    "plan": "premium",
    "country": "US",
    "age": 25
  }
}
```

### Decision Options
```json
{
  "decideOptions": [
    "DISABLE_DECISION_EVENT",    // Don't track this decision
    "ENABLED_FLAGS_ONLY",        // Only return enabled flags
    "IGNORE_USER_PROFILE_SERVICE", // Skip user profile lookup
    "INCLUDE_REASONS",           // Include decision reasons
    "EXCLUDE_VARIABLES"          // Exclude variable values
  ]
}
```

## Response Format

### Success Response
```json
{
  "enabled": true,
  "variationKey": "treatment",
  "ruleKey": "experiment_1",
  "flagKey": "new_feature",
  "variables": {
    "color": "blue",
    "text": "Welcome!"
  },
  "reasons": []
}
```

### Error Response
```json
{
  "error": "The provided SDK key is invalid"
}
```

## Implementation Details

The Edge Agent API is implemented using a modular service architecture:

- **Router**: `/src-v2/services/implementations/ApiRouter.ts`
- **Authentication**: `/src-v2/services/implementations/ConfigService.ts`
- **Caching**: `/src-v2/services/implementations/CacheService.ts`
- **Decisions**: `/src-v2/services/implementations/DecisionService-v2.ts`

**Note**: Rate limiting is not currently implemented in the Edge Agent.

## Error Handling

### Common Errors

All errors return a simple JSON format:
```json
{
  "error": "Error message"
}
```

| Status | Example Message | Description |
|--------|----------------|-------------|
| 400 | "SDK key is required" | Missing required parameters |
| 403 | "Unauthorized" | Missing/invalid admin token |
| 404 | "Datafile not found" | Resource not found |
| 500 | "Error processing request" | Server error |

## SDK Integration

### JavaScript/TypeScript
```typescript
const response = await fetch('https://edge.example.com/api/decide', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Optimizely-SDK-Key': 'your-sdk-key',
    'X-Optimizely-Enable-FEX': 'true'
  },
  body: JSON.stringify({
    userId: 'user123',
    flagKey: 'new_feature',
    userAttributes: {
      plan: 'premium'
    }
  })
});

const decision = await response.json();
```

### Python
```python
import requests

response = requests.post(
    'https://edge.example.com/api/decide',
    headers={
        'Content-Type': 'application/json',
        'X-Optimizely-SDK-Key': 'your-sdk-key',
        'X-Optimizely-Enable-FEX': 'true'
    },
    json={
        'userId': 'user123',
        'flagKey': 'new_feature',
        'userAttributes': {
            'plan': 'premium'
        }
    }
)

decision = response.json()
```

[More SDK examples →](./examples/README.md)

## Performance

### Response Times
- **p50**: < 10ms
- **p95**: < 25ms  
- **p99**: < 50ms

### Optimization Tips
1. Use batch endpoints for multiple decisions
2. Enable response compression
3. Implement client-side caching
4. Use persistent connections

## Best Practices

### 1. Always Include Request ID
```bash
X-Request-ID: 550e8400-e29b-41d4-a716-446655440000
```

### 2. Handle Errors Gracefully
```javascript
try {
  const decision = await getDecision(userId, flagKey);
  return decision.enabled ? 'treatment' : 'control';
} catch (error) {
  // Fallback to default
  return 'control';
}
```

### 3. Use Appropriate Timeouts
```javascript
const response = await fetch(url, {
  signal: AbortSignal.timeout(5000) // 5 second timeout
});
```

### 4. Implement Retry Logic
```javascript
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetch(url, options);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(Math.pow(2, i) * 1000); // Exponential backoff
    }
  }
}
```

## API Testing

### Using cURL
```bash
# Test health endpoint
curl https://edge.example.com/api/health

# Test with debug mode
curl -X POST https://edge.example.com/api/decide \
  -H "X-Enable-Debug: true" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "Content-Type: application/json" \
  -d '{"userId": "test", "flagKey": "test_flag"}'
```

## Getting Started

1. **[Authentication Setup](./authentication.md)** - Configure API access
2. **[Quick Start Guide](./quick-start.md)** - Make your first API call
3. **[Decision Endpoints](./decisions/README.md)** - Core decision APIs
4. **[Examples](./examples/README.md)** - Real-world implementations

---

**Implementation Source**: `/src-v2/services/implementations/ApiRouter.ts`  
**Last Updated**: 2025-05-30