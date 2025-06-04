# Individual Flag Decision API

Make feature flag decisions for a single flag key.

## Overview

The `/api/decide` endpoint provides feature flag decisions for individual flags with support for:
- **User targeting** based on attributes
- **Forced variations** for testing
- **Decision options** to control behavior
- **Detailed decision reasons** (optional)
- **Variable values** for feature configurations

## Authentication

**Required Headers:**
```http
X-Optimizely-Enable-FEX: true
```

**Required Parameters (one of):**
```http
X-Optimizely-SDK-Key: your-sdk-key
```
Or provide `sdkKey` in query parameters or request body.

## GET/POST /api/decide

Make a decision for a single feature flag. Both GET and POST methods are supported.

### Request Format

```json
{
  "flagKey": "checkout_flow_v2",
  "userId": "user123",
  "attributes": {
    "country": "US",
    "isPremium": true,
    "accountAge": 365
  },
  "decideOptions": ["INCLUDE_REASONS"]
}
```

### Parameters

#### Required Parameters

| Parameter | Sources (precedence order) | Description |
|-----------|---------------------------|-------------|
| `flagKey` | • Header: `X-Optimizely-Flag-Key`<br>• Query: `?flagKey=my_flag` or `?key=my_flag`<br>• Body: `{ "flagKey": "my_flag" }` or `{ "key": "my_flag" }` | The feature flag key to evaluate |
| `userId` or `visitorId` | • Header: `X-Optimizely-Visitor-Id`<br>• Query: `?userId=user123` or `?visitorId=visitor456`<br>• Body: `{ "userId": "user123" }`<br>• Cookie: `optimizely_visitor_id` | Unique identifier for the user |
| `sdkKey` | • Header: `X-Optimizely-SDK-Key`<br>• Query: `?sdkKey=your-key`<br>• Body: `{ "sdkKey": "your-key" }` | Your Optimizely SDK key |

#### Optional Parameters

| Parameter | Type | Sources | Description |
|-----------|------|---------|-------------|
| `attributes` | object | • Header: `X-Optimizely-Attributes` (URL-encoded JSON)<br>• Query: `?attributes={"key":"value"}`<br>• Body: `{ "attributes": {...} }` | User attributes for targeting |
| `decideOptions` | string[] | • Header: `X-Optimizely-Decide-Options`<br>• Query: `?decideOptions=INCLUDE_REASONS,EXCLUDE_VARIABLES`<br>• Body: `{ "decideOptions": [...] }` | Array of decision options |
| `forcedDecisions` | object/array | • Header: `X-Optimizely-Forced-Decisions` (JSON)<br>• Query: `?forced_decisions={"flag1":{"variationKey":"on"}}`<br>• Body: `{ "forcedDecisions": {...} }` | Force specific variations for testing |
| `trimmedDecisions` | boolean | • Header: `X-Optimizely-Trimmed-Decisions`<br>• Query: `?trimmedDecisions=true`<br>• Body: `{ "trimmedDecisions": true }` | Return minimal response format |
| `overrideVisitorId` | boolean | • Header: `X-Optimizely-Override-Visitor-Id`<br>• Query: `?overrideVisitorId=true`<br>• Body: `{ "overrideVisitorId": true }` | Generate new visitor ID |

#### Response Control Parameters

| Parameter | Type | Default | Sources | Description |
|-----------|------|---------|---------|-------------|
| `setResponseHeaders` | boolean | true | • Header: `X-Optimizely-Set-Response-Headers`<br>• Query/Body | Add decision info to response headers |
| `setResponseCookies` | boolean | true | • Header: `X-Optimizely-Set-Response-Cookies`<br>• Query/Body | Set decision cookies |
| `enableResponseMetadata` | boolean | false | • Header: `X-Optimizely-Enable-Response-Metadata`<br>• Query/Body | Include metadata in response |

#### Client Identification (Optional)

| Parameter | Sources | Description |
|-----------|---------|-------------|
| `clientEngine` | • Header: `X-Optimizely-Client-Engine`<br>• Query/Body | Client name (e.g., "my-app") |
| `clientVersion` | • Header: `X-Optimizely-Client-Version`<br>• Query/Body | Client version |

### Parameter Precedence

Parameters are resolved in this order (first found wins):
1. **HTTP Headers** (highest priority)
2. **URL Query Parameters**
3. **Request Body** (lowest priority)

### Decision Options

Control decision behavior with these options:

| Option | Description |
|--------|-------------|
| `INCLUDE_REASONS` | Include detailed reasons for the decision |
| `EXCLUDE_VARIABLES` | Exclude variable values from response |
| `ENABLED_FLAGS_ONLY` | Return 404 for disabled flags |
| `IGNORE_USER_PROFILE_SERVICE` | Skip user profile lookup |
| `DISABLE_DECISION_EVENT` | Don't send decision events |

### Response Format

**Success Response (200):**
```json
{
  "variationKey": "treatment",
  "enabled": true,
  "variables": {
    "button_color": "#00FF00",
    "checkout_steps": 3,
    "show_testimonials": true
  },
  "ruleKey": "experiment_123",
  "flagKey": "checkout_flow_v2",
  "reasons": []
}
```

**With INCLUDE_REASONS option:**
```json
{
  "variationKey": "treatment",
  "enabled": true,
  "variables": {
    "button_color": "#00FF00"
  },
  "ruleKey": "experiment_123",
  "flagKey": "checkout_flow_v2",
  "reasons": [
    "Evaluating feature flag \"checkout_flow_v2\".",
    "User \"user123\" meets conditions for targeting rule 1."
  ]
}
```

**Decision Fields:**
- `enabled` - Whether the feature is enabled for this user
- `variationKey` - The variation assigned (null if not in experiment)
- `flagKey` - The evaluated flag key
- `ruleKey` - The rule or experiment key that matched
- `variables` - Feature configuration values
- `reasons` - Decision reasons (empty array by default, populated with INCLUDE_REASONS option)

## Examples

### Basic Decision Request
```bash
curl -X POST "https://your-deployment/api/decide" \
  -H "Content-Type: application/json" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: your-sdk-key" \
  -d '{
    "flagKey": "new_checkout_flow",
    "userId": "user123"
  }'
```

### Using Different Parameter Sources
```bash
# Flag key in header, user ID in query, attributes in body
curl -X POST "https://your-deployment/api/decide?userId=user123" \
  -H "Content-Type: application/json" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: your-sdk-key" \
  -H "X-Optimizely-Flag-Key: premium_features" \
  -d '{
    "attributes": {
      "plan_type": "premium",
      "country": "US"
    }
  }'
```

### Decision with All Options
```bash
curl -X POST "https://your-deployment/api/decide" \
  -H "Content-Type: application/json" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: your-sdk-key" \
  -H "X-Optimizely-Client-Engine: my-app" \
  -H "X-Optimizely-Client-Version: 1.0.0" \
  -H "X-Optimizely-Set-Response-Headers: false" \
  -H "X-Optimizely-Set-Response-Cookies: false" \
  -d '{
    "flagKey": "experimental_feature",
    "userId": "user123",
    "attributes": {
      "device": "mobile",
      "app_version": "2.1.0",
      "beta_tester": true
    },
    "decideOptions": ["INCLUDE_REASONS", "DISABLE_DECISION_EVENT"],
    "trimmedDecisions": true,
    "enableResponseMetadata": true
  }'
```

### Override Visitor ID Generation
```bash
# Generate a new visitor ID for each request
curl -X POST "https://your-deployment/api/decide" \
  -H "Content-Type: application/json" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: your-sdk-key" \
  -H "X-Optimizely-Override-Visitor-Id: true" \
  -d '{
    "flagKey": "anonymous_feature"
  }'
```

### Using Query Parameters
```bash
# All parameters via query string
curl -X POST "https://your-deployment/api/decide?\
flagKey=my_feature&\
userId=user123&\
sdkKey=your-sdk-key&\
attributes={\"country\":\"US\",\"age\":25}&\
decideOptions=INCLUDE_REASONS,EXCLUDE_VARIABLES&\
trimmedDecisions=true" \
  -H "X-Optimizely-Enable-FEX: true"
```

### Forced Decisions for Testing

Force specific variations for testing, QA, or debugging purposes.

#### Object Format
```bash
# Force a single flag to a specific variation
curl -X POST "https://your-deployment/api/decide" \
  -H "Content-Type: application/json" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: your-sdk-key" \
  -d '{
    "flagKey": "checkout_flow",
    "userId": "qa_tester_001",
    "forcedDecisions": {
      "checkout_flow": {
        "variationKey": "express_checkout"
      }
    }
  }'
```

#### Array Format
```bash
# Force multiple flags using array format
curl -X POST "https://your-deployment/api/decide" \
  -H "Content-Type: application/json" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: your-sdk-key" \
  -d '{
    "flagKey": "checkout_flow",
    "userId": "qa_tester_001",
    "forcedDecisions": [
      {
        "flagKey": "checkout_flow",
        "variationKey": "express_checkout"
      },
      {
        "flagKey": "payment_methods",
        "variationKey": "all_methods"
      }
    ]
  }'
```

#### Via Headers
```bash
# Force decisions via header (highest precedence)
curl -X POST "https://your-deployment/api/decide" \
  -H "Content-Type: application/json" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: your-sdk-key" \
  -H 'X-Optimizely-Forced-Decisions: {"checkout_flow":{"variationKey":"express_checkout"}}' \
  -d '{
    "flagKey": "checkout_flow",
    "userId": "user123"
  }'
```

#### Via Query Parameters
```bash
# Force decisions via URL-encoded query parameter
curl -X POST "https://your-deployment/api/decide?\
flagKey=checkout_flow&\
userId=user123&\
forced_decisions=%7B%22checkout_flow%22%3A%7B%22variationKey%22%3A%22express_checkout%22%7D%7D" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: your-sdk-key"
```

## Edge vs Agent Mode Behavior

### Edge Mode
- Immediate decision based on cached datafile
- No external API calls
- Fastest response times
- Limited by cache TTL

### Agent Mode
- May fetch fresh datafile if needed
- Can use User Profile Service
- Supports sticky bucketing
- Slightly higher latency

## Error Responses

### 400 Bad Request - Missing User ID
```json
{
  "error": "userId is required (can also be provided as visitorId or X-Optimizely-Visitor-Id header)"
}
```

### 400 Bad Request - Missing Flag Key
```json
{
  "error": "flagKey parameter is required (can also be provided as 'key' or X-Optimizely-Flag-Key header)"
}
```

### 404 Not Found - Flag Disabled (with ENABLED_FLAGS_ONLY)
```json
{
  "error": "Flag disabled for user",
  "flagKey": "my_feature"
}
```

### 500 Internal Server Error
```json
{
  "error": "Error getting decision",
  "message": "Unable to load datafile",
  "flagKey": "my_feature"
}
```

### 501 Not Implemented - Decision Service Unavailable
```json
{
  "error": "Decision service not available"
}
```

## Best Practices

### 1. Use Appropriate Attributes
```json
{
  "attributes": {
    "device_type": "mobile",
    "app_version": "2.1.0",
    "user_segment": "power_user"
  }
}
```

### 2. Cache Decisions Client-Side
- Decisions are deterministic for same inputs
- Cache for reasonable TTL (5-10 minutes)
- Clear cache on user attribute changes

### 3. Handle All Response Scenarios
```javascript
const response = await fetch('/api/decide', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Optimizely-Enable-FEX': 'true',
    'X-Optimizely-SDK-Key': sdkKey
  },
  body: JSON.stringify({
    flagKey: 'feature_x',
    userId: userId,
    attributes: userAttributes
  })
});

const decision = await response.json();

if (decision.enabled) {
  // Feature is enabled
  const color = decision.variables.button_color || '#default';
  renderFeature(color);
} else {
  // Feature is disabled
  renderDefault();
}
```

### 4. Use Decision Options Wisely
- `INCLUDE_REASONS` - Only for debugging
- `DISABLE_DECISION_EVENT` - For bots/crawlers
- `EXCLUDE_VARIABLES` - When variables not needed

## Performance Considerations

### Optimization Tips
1. Minimize attribute payload size
2. Use `EXCLUDE_VARIABLES` if not needed
3. Batch decisions with `/api/decide-for-keys`
4. Use Edge Mode for fastest responses
5. Enable KV storage when available

## Related Endpoints

- **[Batch Decisions](./decide-for-keys.md)** - Multiple flags in one request
- **[All Decisions](./decide-all.md)** - Get all flag decisions
- **[Forced Variations](../admin/forced-variations.md)** - Override decisions
- **[Decision Options](./decide-options.md)** - Available options reference

---

**Implementation Source**: `/src-v2/services/implementations/DecisionService-v2.ts:756-837`  
**Last Updated**: 2025-05-28