# Forced Variations API

Manage forced variations for testing, QA, and debugging purposes.

## Overview

Forced variations allow you to override Optimizely's bucketing algorithm and assign specific variations to users. This is useful for:
- **QA Testing** - Test specific variations without randomization
- **Debugging** - Reproduce user-reported issues
- **Demos** - Show specific variations to stakeholders
- **Development** - Test variation-specific code changes

## Methods for Forcing Variations

### 1. Inline Forced Decisions (Recommended)
Pass forced decisions directly in decision requests without using API endpoints. See [Request Parameters](../../configuration/request-parameters.md#forced-decisions) for details.

### 2. API Endpoints
Use dedicated API endpoints to set persistent forced variations that apply across multiple requests

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/set-forced-variation` | POST/PUT | Set a forced variation |
| `/api/get-forced-variation` | GET/POST | Get current forced variation |
| `/api/remove-forced-variation` | POST/DELETE | Remove a forced variation |
| `/api/remove-all-forced-decisions` | POST/DELETE | Remove all forced decisions for a user |

## Authentication

All forced variation endpoints require:
```http
X-Optimizely-Enable-FEX: true
X-Optimizely-SDK-Key: your-sdk-key
```

Admin operations (PUT/POST/DELETE) may additionally require:
```http
X-Optimizely-Admin-Token: your-admin-token
```

## Parameter Precedence

All endpoints follow consistent parameter resolution order:
1. **HTTP Headers** (highest priority)
2. **URL Query Parameters**
3. **Request Body** (lowest priority)

## Common Parameters

### User Identification
At least one is required:
- `userId` - User identifier
- `visitorId` - Visitor identifier (alias for userId)

Sources:
- Header: `X-Optimizely-Visitor-Id`
- Query: `?userId=user123` or `?visitorId=visitor456`
- Body: `{ "userId": "user123" }` or `{ "visitorId": "visitor456" }`

### SDK Key
Required for all operations:
- Header: `X-Optimizely-SDK-Key`
- Query: `?sdkKey=your-sdk-key`
- Body: `{ "sdkKey": "your-sdk-key" }`

---

## POST/PUT /api/set-forced-variation

Set a forced variation for a specific user and flag.

### Request Format

```json
{
  "userId": "user123",
  "flagKey": "checkout_flow_v2",
  "variationKey": "treatment",
  "sdkKey": "your-sdk-key",
  "ruleKey": "experiment_123",
  "experimentKey": "ab_test_checkout"
}
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` or `visitorId` | string | ✅ Yes | User identifier |
| `flagKey` | string | ✅ Yes | Feature flag key |
| `variationKey` | string | ✅ Yes | Variation to force |
| `sdkKey` | string | ❌ No* | SDK key (*required if not in header) |
| `ruleKey` | string | ❌ No | Specific rule key (for experiments) |
| `experimentKey` | string | ❌ No | Specific experiment key |

### Response

**Success (200):**
```json
{
  "success": true,
  "userId": "user123",
  "flagKey": "checkout_flow_v2",
  "variationKey": "treatment",
  "ruleKey": "experiment_123",
  "experimentKey": "ab_test_checkout"
}
```

**Error - Missing Parameters (400):**
```json
{
  "error": "Missing flagKey",
  "message": "The request must include a flagKey"
}
```

### Examples

#### Basic Forced Variation
```bash
curl -X POST "https://your-deployment/api/set-forced-variation" \
  -H "Content-Type: application/json" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: your-sdk-key" \
  -d '{
    "userId": "qa_tester_001",
    "flagKey": "new_feature",
    "variationKey": "variant_b"
  }'
```

#### Experiment-Specific Forced Variation
```bash
curl -X POST "https://your-deployment/api/set-forced-variation" \
  -H "Content-Type: application/json" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: your-sdk-key" \
  -H "X-Optimizely-Admin-Token: admin-token" \
  -d '{
    "userId": "test_user",
    "flagKey": "checkout_redesign",
    "variationKey": "treatment",
    "ruleKey": "experiment_456",
    "experimentKey": "checkout_ab_test"
  }'
```

---

## GET/POST /api/get-forced-variation

Retrieve the forced variation for a user and flag.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | string | ✅ Yes | User identifier |
| `flagKey` | string | ✅ Yes | Feature flag key |
| `sdkKey` | string | ✅ Yes | SDK key |

### Request Examples

#### GET Request
```bash
curl -X GET "https://your-deployment/api/get-forced-variation?userId=user123&flagKey=feature_x&sdkKey=your-sdk-key" \
  -H "X-Optimizely-Enable-FEX: true"
```

#### POST Request
```bash
curl -X POST "https://your-deployment/api/get-forced-variation" \
  -H "Content-Type: application/json" \
  -H "X-Optimizely-Enable-FEX: true" \
  -d '{
    "userId": "user123",
    "flagKey": "feature_x",
    "sdkKey": "your-sdk-key"
  }'
```

### Response

**When Forced Variation Exists (200):**
```json
{
  "flagKey": "feature_x",
  "userId": "user123",
  "variationKey": "treatment"
}
```

**When No Forced Variation (200):**
```json
{
  "flagKey": "feature_x",
  "userId": "user123",
  "variationKey": null
}
```

---

## POST/DELETE /api/remove-forced-variation

Remove a forced variation for a specific user and flag.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` or `visitorId` | string | ✅ Yes | User identifier |
| `flagKey` | string | ✅ Yes | Feature flag key |
| `sdkKey` | string | ❌ No* | SDK key (*required if not in header) |
| `ruleKey` | string | ❌ No | Specific rule key |
| `experimentKey` | string | ❌ No | Specific experiment key |

### Request Examples

#### POST Request
```bash
curl -X POST "https://your-deployment/api/remove-forced-variation" \
  -H "Content-Type: application/json" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: your-sdk-key" \
  -d '{
    "userId": "user123",
    "flagKey": "feature_x"
  }'
```

#### DELETE Request
```bash
curl -X DELETE "https://your-deployment/api/remove-forced-variation?userId=user123&flagKey=feature_x" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: your-sdk-key"
```

### Response

**Success (200):**
```json
{
  "success": true,
  "userId": "user123",
  "flagKey": "feature_x",
  "ruleKey": null,
  "experimentKey": null
}
```

**No Forced Variation Found (200):**
```json
{
  "success": true,
  "message": "No forced variation was set to remove",
  "userId": "user123",
  "flagKey": "feature_x"
}
```

---

## POST/DELETE /api/remove-all-forced-decisions

Remove all forced decisions for a specific user across all flags.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` or `visitorId` | string | ✅ Yes | User identifier |
| `sdkKey` | string | ❌ No* | SDK key (*required if not in header) |

### Request Examples

#### POST Request
```bash
curl -X POST "https://your-deployment/api/remove-all-forced-decisions" \
  -H "Content-Type: application/json" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: your-sdk-key" \
  -d '{
    "userId": "user123"
  }'
```

#### DELETE Request
```bash
curl -X DELETE "https://your-deployment/api/remove-all-forced-decisions?userId=user123" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: your-sdk-key"
```

### Response

**Success (200):**
```json
{
  "success": true,
  "userId": "user123"
}
```

**Error (500):**
```json
{
  "error": "Failed to remove all forced decisions for user 'user123'",
  "userId": "user123"
}
```

---

## Use Cases

### 1. QA Testing Workflow
```bash
# 1. Set forced variation for QA tester
curl -X POST "/api/set-forced-variation" \
  -H "Content-Type: application/json" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: $SDK_KEY" \
  -d '{
    "userId": "qa_tester_001",
    "flagKey": "checkout_redesign",
    "variationKey": "variant_c"
  }'

# 2. QA tester performs testing...

# 3. Remove forced variation after testing
curl -X POST "/api/remove-forced-variation" \
  -H "Content-Type: application/json" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: $SDK_KEY" \
  -d '{
    "userId": "qa_tester_001",
    "flagKey": "checkout_redesign"
  }'
```

### 2. Debugging User Issues
```javascript
// Check what variation a user is forced to
async function debugUserVariation(userId, flagKey) {
  const response = await fetch('/api/get-forced-variation', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Optimizely-Enable-FEX': 'true',
      'X-Optimizely-SDK-Key': SDK_KEY
    },
    body: JSON.stringify({ userId, flagKey, sdkKey: SDK_KEY })
  });
  
  const data = await response.json();
  console.log(`User ${userId} forced variation:`, data.variationKey);
  return data;
}
```

### 3. Demo Script
```javascript
// Set up demo environment with specific variations
async function setupDemo() {
  const demoVariations = [
    { userId: 'demo_user_1', flagKey: 'new_header', variationKey: 'modern' },
    { userId: 'demo_user_2', flagKey: 'new_header', variationKey: 'classic' },
    { userId: 'demo_user_3', flagKey: 'checkout_flow', variationKey: 'express' }
  ];
  
  for (const setup of demoVariations) {
    await setForcedVariation(setup);
  }
}

// Clean up after demo
async function cleanupDemo() {
  const demoUsers = ['demo_user_1', 'demo_user_2', 'demo_user_3'];
  
  for (const userId of demoUsers) {
    await fetch('/api/remove-all-forced-decisions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Optimizely-Enable-FEX': 'true',
        'X-Optimizely-SDK-Key': SDK_KEY
      },
      body: JSON.stringify({ userId })
    });
  }
}
```

## Important Notes

### Persistence
- Forced variations are stored in the User Profile Service (if enabled)
- They persist across sessions until explicitly removed
- In KV-enabled deployments, they're stored in the KV store

### Precedence
- Forced variations take precedence over normal bucketing
- They override audience targeting rules
- They persist even if the user wouldn't normally qualify

### Limitations
- Forced variations are user-specific
- They don't affect other users
- They require the Decision Service to be available
- Some CDN environments may not support all forced variation features

### Best Practices
1. **Always remove forced variations after testing**
2. **Document forced variations in QA test plans**
3. **Use descriptive user IDs for test users**
4. **Monitor forced variation usage in production**
5. **Implement access controls via admin tokens**

## Error Handling

### Common Errors

| Status | Error | Cause |
|--------|-------|-------|
| 400 | Missing required field | userId, flagKey, or variationKey not provided |
| 405 | Method not allowed | Wrong HTTP method for endpoint |
| 501 | Not implemented | Decision service doesn't support forced variations |
| 500 | Internal error | Server error during operation |

### Troubleshooting

1. **"Decision service not available"**
   - Ensure the Edge Agent is properly configured
   - Check that the SDK key is valid
   - Verify datafile is loaded

2. **"User context creation failed"**
   - Check user ID format
   - Ensure SDK key has proper permissions
   - Verify datafile contains the flag

3. **No effect on decisions**
   - Confirm forced variation was set successfully
   - Check that the same user ID is used
   - Verify the flag key matches exactly

## Related Endpoints

- **[Decision API](../decisions/decide.md)** - Make decisions with forced variations
- **[Debug API](./debug.md)** - Debug configuration and settings
- **[User Profile Service](../data-management/user-profiles.md)** - Persistence layer

---

**Implementation Source**: `/src-v2/services/implementations/ApiRouter.ts:1188-1819`  
**Last Updated**: 2025-05-28