# Batch Flag Decision API

Get feature flag decisions for multiple specific flags in a single request.

## Overview

The `/api/decide-for-keys` endpoint evaluates multiple feature flags efficiently with:
- **Batch processing** for better performance
- **Selective evaluation** of only needed flags
- **Consistent user context** across all decisions
- **Optimized for component-based architectures**

## Authentication

**Required Headers:**
```http
X-Optimizely-Enable-FEX: true
X-Optimizely-SDK-Key: your-sdk-key
```

## POST /api/decide-for-keys

Get decisions for specific feature flags.

### Request Format

```json
{
  "flagKeys": ["checkout_flow_v2", "premium_features", "search_v3"],
  "userId": "user123",
  "attributes": {
    "country": "US",
    "plan_type": "premium",
    "device": "mobile"
  },
  "decideOptions": ["INCLUDE_REASONS"]
}
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `flagKeys` | string[] | ✅ Yes | Array of flag keys to evaluate |
| `userId` | string | ✅ Yes | Unique identifier for the user |
| `attributes` | object | ❌ No | User attributes for targeting |
| `decideOptions` | string[] | ❌ No | Array of decision options |
| `forcedDecisions` | object/array | ❌ No | Force specific variations for testing |
| `sdkKey` | string | ❌ No | Override SDK key (uses header by default) |

### Decision Options

| Option | Description |
|--------|-------------|
| `INCLUDE_REASONS` | Include detailed reasons for each decision |
| `EXCLUDE_VARIABLES` | Exclude variable values from responses |
| `ENABLED_FLAGS_ONLY` | Only return enabled flags |
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
      "checkout_steps": 3,
      "show_testimonials": true
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
  "search_v3": {
    "enabled": false,
    "variationKey": null,
    "flagKey": "search_v3",
    "variables": {}
  }
}
```

**Response Structure:**
- Object with requested flag keys as properties
- Only includes flags that were requested
- Non-existent flags return default disabled state

## Examples

### Basic Batch Request
```bash
curl -X POST "https://your-deployment/api/decide-for-keys" \
  -H "Content-Type: application/json" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: your-sdk-key" \
  -d '{
    "flagKeys": ["feature_a", "feature_b"],
    "userId": "user123"
  }'
```

### Component-Specific Features
```bash
curl -X POST "https://your-deployment/api/decide-for-keys" \
  -H "Content-Type: application/json" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: your-sdk-key" \
  -d '{
    "flagKeys": [
      "header_redesign",
      "nav_menu_v2",
      "search_autocomplete"
    ],
    "userId": "user123",
    "attributes": {
      "page_type": "homepage",
      "user_segment": "returning"
    }
  }'
```

### Debugging with Reasons
```bash
curl -X POST "https://your-deployment/api/decide-for-keys" \
  -H "Content-Type: application/json" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: your-sdk-key" \
  -d '{
    "flagKeys": ["problematic_feature"],
    "userId": "test_user",
    "decideOptions": ["INCLUDE_REASONS", "EXCLUDE_VARIABLES"]
  }'
```

### With Forced Decisions
```bash
# Force specific variations for QA testing
curl -X POST "https://your-deployment/api/decide-for-keys" \
  -H "Content-Type: application/json" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: your-sdk-key" \
  -d '{
    "flagKeys": ["checkout_flow_v2", "payment_methods_v3"],
    "userId": "qa_tester",
    "forcedDecisions": {
      "checkout_flow_v2": {
        "variationKey": "express_checkout"
      },
      "payment_methods_v3": {
        "variationKey": "all_payment_options"
      }
    }
  }'
```

## Use Cases

### 1. Component-Based Loading
Load features for specific UI components:
```javascript
// React component example
function CheckoutComponent({ userId, userAttributes }) {
  const [features, setFeatures] = useState({});
  
  useEffect(() => {
    async function loadFeatures() {
      const response = await fetch('/api/decide-for-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Optimizely-Enable-FEX': 'true',
          'X-Optimizely-SDK-Key': SDK_KEY
        },
        body: JSON.stringify({
          flagKeys: [
            'checkout_flow_v2',
            'express_checkout',
            'payment_methods_v3'
          ],
          userId,
          attributes: userAttributes
        })
      });
      
      const decisions = await response.json();
      setFeatures(decisions);
    }
    
    loadFeatures();
  }, [userId, userAttributes]);
  
  // Render based on features
}
```

### 2. Progressive Feature Loading
Load features as needed:
```javascript
class FeatureManager {
  constructor(userId, attributes) {
    this.userId = userId;
    this.attributes = attributes;
    this.loadedFeatures = new Map();
  }
  
  async loadFeatures(flagKeys) {
    // Only load features not already cached
    const keysToLoad = flagKeys.filter(key => 
      !this.loadedFeatures.has(key)
    );
    
    if (keysToLoad.length === 0) {
      return this.getLoadedFeatures(flagKeys);
    }
    
    const decisions = await this.fetchDecisions(keysToLoad);
    
    // Cache the results
    Object.entries(decisions).forEach(([key, decision]) => {
      this.loadedFeatures.set(key, decision);
    });
    
    return this.getLoadedFeatures(flagKeys);
  }
}
```

### 3. A/B Test Coordination
Ensure related features are evaluated together:
```javascript
// Load all checkout-related experiments together
const checkoutFlags = [
  'checkout_flow_v2',
  'checkout_progress_indicator',
  'checkout_validation_style',
  'checkout_button_text'
];

const decisions = await decideForKeys(
  checkoutFlags,
  userId,
  attributes
);

// Apply all changes atomically
applyCheckoutVariations(decisions);
```

## Performance Benefits

### Comparison with Individual Requests

| Metric | decide-for-keys (5 flags) | 5x decide calls |
|--------|---------------------------|-----------------|
| Network calls | 1 | 5 |
| Total latency | ~20-30ms | ~100-150ms |
| Bandwidth | Optimal | 5x overhead |
| Consistency | Guaranteed | Possible drift |

### Optimal Batch Sizes
- **Small (1-5 flags)**: Minimal overhead
- **Medium (5-20 flags)**: Ideal balance
- **Large (20+ flags)**: Consider decide-all

## Error Handling

### 400 Bad Request - Missing Flag Keys
```json
{
  "error": "Missing required field: flagKeys",
  "message": "flagKeys must be a non-empty array"
}
```

### 400 Bad Request - Invalid Flag Keys
```json
{
  "error": "Invalid flagKeys format",
  "message": "flagKeys must be an array of strings"
}
```

### Response with Invalid Flags
Valid flags are evaluated, invalid ones ignored:
```json
{
  "valid_flag": {
    "enabled": true,
    "variationKey": "control"
  },
  "invalid_flag": {
    "enabled": false,
    "variationKey": null,
    "flagKey": "invalid_flag"
  }
}
```

## Best Practices

### 1. Group Related Flags
```javascript
const FEATURE_GROUPS = {
  checkout: ['checkout_flow', 'payment_options', 'shipping_calc'],
  search: ['search_algo_v2', 'search_filters', 'search_suggest'],
  profile: ['profile_layout', 'profile_privacy', 'profile_social']
};

async function loadFeatureGroup(group, userId, attributes) {
  const flagKeys = FEATURE_GROUPS[group];
  return decideForKeys(flagKeys, userId, attributes);
}
```

### 2. Implement Retry Logic
```javascript
async function decideForKeysWithRetry(flagKeys, userId, attributes, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await decideForKeys(flagKeys, userId, attributes);
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await new Promise(resolve => setTimeout(resolve, attempt * 100));
    }
  }
}
```

### 3. Cache by Component
```javascript
const componentCache = new Map();

async function getComponentFeatures(componentName, flagKeys, userId, attributes) {
  const cacheKey = `${componentName}:${userId}`;
  
  if (componentCache.has(cacheKey)) {
    return componentCache.get(cacheKey);
  }
  
  const decisions = await decideForKeys(flagKeys, userId, attributes);
  componentCache.set(cacheKey, decisions);
  
  // Clear cache after TTL
  setTimeout(() => componentCache.delete(cacheKey), 5 * 60 * 1000);
  
  return decisions;
}
```

### 4. Validate Flag Keys
```javascript
function validateFlagKeys(flagKeys) {
  if (!Array.isArray(flagKeys) || flagKeys.length === 0) {
    throw new Error('flagKeys must be a non-empty array');
  }
  
  const invalidKeys = flagKeys.filter(key => 
    typeof key !== 'string' || key.trim() === ''
  );
  
  if (invalidKeys.length > 0) {
    throw new Error(`Invalid flag keys: ${invalidKeys.join(', ')}`);
  }
  
  return flagKeys;
}
```

## Related Endpoints

- **[Individual Decision](./decide.md)** - Single flag evaluation
- **[All Decisions](./decide-all.md)** - Get all flags at once
- **[Decision Options](./decide-options.md)** - Available options
- **[Flag Keys](../data-management/flagkeys.md)** - List available flags

---

**Implementation Source**: `/src-v2/services/implementations/DecisionService-v2.ts:863-1027`  
**Last Updated**: 2025-05-28