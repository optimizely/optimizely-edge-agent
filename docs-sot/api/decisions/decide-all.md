# All Flags Decision API

Get feature flag decisions for all flags in a single request.

## Overview

The `/api/decide-all` endpoint returns decisions for all feature flags in your datafile with:
- **Bulk evaluation** of all flags at once
- **Consistent user context** across all decisions
- **Performance optimization** for full-page rendering
- **Complete feature state** in one request

## Authentication

**Required Headers:**
```http
X-Optimizely-Enable-FEX: true
X-Optimizely-SDK-Key: your-sdk-key
```

## POST /api/decide-all

Get decisions for all feature flags.

### Request Format

```json
{
  "userId": "user123",
  "attributes": {
    "country": "US",
    "isPremium": true,
    "device": "mobile"
  },
  "decideOptions": ["ENABLED_FLAGS_ONLY"]
}
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | string | ✅ Yes | Unique identifier for the user |
| `attributes` | object | ❌ No | User attributes for targeting |
| `decideOptions` | string[] | ❌ No | Array of decision options |
| `sdkKey` | string | ❌ No | Override SDK key (uses header by default) |

### Decision Options

| Option | Description |
|--------|-------------|
| `INCLUDE_REASONS` | Include detailed reasons for each decision |
| `EXCLUDE_VARIABLES` | Exclude variable values from responses |
| `ENABLED_FLAGS_ONLY` | Only return flags that are enabled |
| `IGNORE_USER_PROFILE_SERVICE` | Skip user profile lookup |
| `DISABLE_DECISION_EVENT` | Don't send decision events |

### Response Format

**Success Response (200):**
```json
{
  "checkout_flow_v2": {
    "enabled": true,
    "variationKey": "treatment",
    "flagKey": "checkout_flow_v2",
    "variables": {
      "button_color": "#00FF00",
      "checkout_steps": 3
    }
  },
  "premium_features": {
    "enabled": true,
    "variationKey": "premium_variation",
    "flagKey": "premium_features",
    "variables": {
      "feature_limit": 100,
      "show_analytics": true
    }
  },
  "experimental_search": {
    "enabled": false,
    "variationKey": null,
    "flagKey": "experimental_search",
    "variables": {}
  }
}
```

**Response Structure:**
- Object with flag keys as properties
- Each flag contains a decision object
- Disabled flags included unless using `ENABLED_FLAGS_ONLY`

## Examples

### Get All Decisions
```bash
curl -X POST "https://your-deployment/api/decide-all" \
  -H "Content-Type: application/json" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: your-sdk-key" \
  -d '{
    "userId": "user123"
  }'
```

### Get Enabled Flags Only
```bash
curl -X POST "https://your-deployment/api/decide-all" \
  -H "Content-Type: application/json" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: your-sdk-key" \
  -d '{
    "userId": "user123",
    "attributes": {
      "plan": "premium"
    },
    "decideOptions": ["ENABLED_FLAGS_ONLY"]
  }'
```

### Get Decisions with Reasons
```bash
curl -X POST "https://your-deployment/api/decide-all" \
  -H "Content-Type: application/json" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: your-sdk-key" \
  -d '{
    "userId": "user123",
    "decideOptions": ["INCLUDE_REASONS", "EXCLUDE_VARIABLES"]
  }'
```

## Use Cases

### 1. Initial Page Load
Get all feature states on app initialization:
```javascript
async function initializeApp(userId, userAttributes) {
  const response = await fetch('/api/decide-all', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Optimizely-Enable-FEX': 'true',
      'X-Optimizely-SDK-Key': SDK_KEY
    },
    body: JSON.stringify({
      userId,
      attributes: userAttributes,
      decideOptions: ['ENABLED_FLAGS_ONLY']
    })
  });
  
  const allDecisions = await response.json();
  
  // Apply all feature configurations
  Object.entries(allDecisions).forEach(([flagKey, decision]) => {
    applyFeature(flagKey, decision);
  });
}
```

### 2. Server-Side Rendering
Pre-fetch all flags for SSR:
```javascript
// In your SSR handler
const decisions = await getDecideAll(userId, attributes);

const html = renderPage({
  features: decisions,
  user: { id: userId, ...attributes }
});
```

### 3. Feature Inventory
Discover all available features:
```javascript
const allFlags = await getDecideAll('anonymous_user', {});
const availableFeatures = Object.keys(allFlags);
console.log(`Total features: ${availableFeatures.length}`);
```

## Performance Considerations

### Response Size
- Can be large with many flags/variables
- Use `EXCLUDE_VARIABLES` if not needed
- Use `ENABLED_FLAGS_ONLY` to reduce size

### Caching Strategy
```javascript
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const decisionCache = new Map();

async function getCachedDecisions(userId, attributes) {
  const cacheKey = `${userId}:${JSON.stringify(attributes)}`;
  const cached = decisionCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.decisions;
  }
  
  const decisions = await fetchDecideAll(userId, attributes);
  decisionCache.set(cacheKey, {
    decisions,
    timestamp: Date.now()
  });
  
  return decisions;
}
```

### Comparison with Individual Decisions

| Aspect | decide-all | Multiple decide calls |
|--------|------------|----------------------|
| Network calls | 1 | N (number of flags) |
| Total latency | Lower | Higher |
| Consistency | Guaranteed | Possible drift |
| Payload size | Larger | Smaller per call |
| Cacheability | Excellent | Good |

## Error Responses

### 400 Bad Request - Missing User ID
```json
{
  "error": "Missing required field: userId"
}
```

### 401 Unauthorized
```json
{
  "error": "Invalid or missing SDK key"
}
```

### 500 Internal Server Error
```json
{
  "error": "Failed to evaluate decisions",
  "message": "Datafile not available"
}
```

## Best Practices

### 1. Use for Initial Load Only
- Call once on app initialization
- Cache results appropriately
- Use individual decisions for updates

### 2. Filter Results Client-Side
```javascript
// Get all decisions
const allDecisions = await fetchDecideAll(userId, attributes);

// Filter by feature area
const checkoutFeatures = Object.entries(allDecisions)
  .filter(([key]) => key.startsWith('checkout_'))
  .reduce((acc, [key, decision]) => {
    acc[key] = decision;
    return acc;
  }, {});
```

### 3. Handle Large Responses
```javascript
// Use streaming if available
const response = await fetch('/api/decide-all', {
  method: 'POST',
  headers: {
    'Accept': 'application/json',
    'Accept-Encoding': 'gzip'
  },
  // ... rest of request
});
```

### 4. Implement Fallbacks
```javascript
const DEFAULT_FEATURES = {
  checkout_flow_v2: { enabled: false },
  premium_features: { enabled: false }
};

try {
  const decisions = await fetchDecideAll(userId, attributes);
  return { ...DEFAULT_FEATURES, ...decisions };
} catch (error) {
  console.error('Failed to fetch decisions:', error);
  return DEFAULT_FEATURES;
}
```

## Related Endpoints

- **[Individual Decision](./decide.md)** - Single flag evaluation
- **[Batch Decisions](./decide-for-keys.md)** - Specific flags only
- **[Decision Options](./decide-options.md)** - Available options
- **[Flag Keys](../data-management/flagkeys.md)** - Available flags

---

**Implementation Source**: `/src-v2/services/implementations/DecisionService-v2.ts:863-1027`  
**Last Updated**: 2025-05-28