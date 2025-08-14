# Forced Decisions Testing Guide

A comprehensive guide for testing and QA teams to use forced decisions across all CDN platforms.

## Overview

Forced decisions allow you to override normal feature flag bucketing to test specific variations. This is essential for:
- **QA Testing**: Verify all variations work correctly
- **Demo Scenarios**: Show specific features to stakeholders
- **Debugging**: Reproduce user-reported issues
- **Integration Testing**: Test specific code paths

## How Forced Decisions Work

### Single Request Scope
**Important**: Forced decisions apply only to the current request. They do not persist across requests.

```bash
# Request 1: Forces "treatment" variation
curl -H "X-Optimizely-Force-Variation: treatment" ...
# Response: { "variationKey": "treatment", ... }

# Request 2: Without forced header, returns normal bucketing
curl ...
# Response: { "variationKey": "control", ... }  # Based on normal bucketing
```

### Parameter Precedence
When multiple forced decision parameters are provided, they are evaluated in this order:
1. **Headers** (highest priority)
2. **Query Parameters**  
3. **Request Body** (lowest priority)

## Implementation Methods

### Method 1: HTTP Headers (Recommended)

The cleanest and most explicit way to force decisions.

```bash
# Force a specific variation
curl -X POST https://your-edge-agent.com/api/decide \
  -H "Content-Type: application/json" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: your-sdk-key" \
  -H "X-Optimizely-Force-Variation: treatment" \
  -d '{
    "flagKey": "checkout_flow",
    "userId": "test_user_123"
  }'

# Force variation and rule/experiment
curl -X POST https://your-edge-agent.com/api/decide \
  -H "X-Optimizely-Force-Variation: variant_b" \
  -H "X-Optimizely-Force-Rule: experiment_123" \
  -d '{
    "flagKey": "homepage_design",
    "userId": "test_user_123"
  }'
```

### Method 2: Query Parameters

Best for GET requests or when headers can't be modified.

```bash
# Basic forced variation
curl "https://your-edge-agent.com/api/decide?\
flagKey=checkout_flow&\
userId=test_user_123&\
forceVariation=treatment&\
sdkKey=your-sdk-key" \
  -H "X-Optimizely-Enable-FEX: true"

# With forced rule
curl "https://your-edge-agent.com/api/decide?\
flagKey=homepage_design&\
userId=test_user_123&\
forceVariation=variant_b&\
forceRule=experiment_123"
```

### Method 3: Request Body

Useful when building requests programmatically.

```bash
curl -X POST https://your-edge-agent.com/api/decide \
  -H "Content-Type: application/json" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: your-sdk-key" \
  -d '{
    "flagKey": "new_feature",
    "userId": "test_user_123",
    "forcedVariationKey": "variant_a",
    "forcedRuleKey": "rollout_20_percent"
  }'
```

## Platform-Specific Testing Scripts

### Cloudflare Workers

```bash
#!/bin/bash
# test-cloudflare-forced-decisions.sh

WORKER_URL="https://edge-agent.your-subdomain.workers.dev"
SDK_KEY="your-cloudflare-sdk-key"
TEST_USER="qa_tester_cf_001"

echo "=== Cloudflare Workers Forced Decision Tests ==="

# Test 1: Control variation
echo -e "\n1. Testing CONTROL variation..."
curl -s -X POST "$WORKER_URL/api/decide" \
  -H "Content-Type: application/json" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: $SDK_KEY" \
  -H "X-Optimizely-Force-Variation: control" \
  -d "{\"flagKey\": \"checkout_flow\", \"userId\": \"$TEST_USER\"}" | jq .

# Test 2: Treatment variation
echo -e "\n2. Testing TREATMENT variation..."
curl -s -X POST "$WORKER_URL/api/decide" \
  -H "X-Optimizely-Force-Variation: treatment" \
  -H "X-Optimizely-SDK-Key: $SDK_KEY" \
  -H "X-Optimizely-Enable-FEX: true" \
  -d "{\"flagKey\": \"checkout_flow\", \"userId\": \"$TEST_USER\"}" | jq .

# Test 3: Custom variation
echo -e "\n3. Testing CUSTOM variation (express_checkout)..."
curl -s -X POST "$WORKER_URL/api/decide" \
  -H "X-Optimizely-Force-Variation: express_checkout" \
  -H "X-Optimizely-SDK-Key: $SDK_KEY" \
  -H "X-Optimizely-Enable-FEX: true" \
  -d "{\"flagKey\": \"checkout_flow\", \"userId\": \"$TEST_USER\"}" | jq .

# Test 4: Verify no persistence
echo -e "\n4. Verifying forced decision doesn't persist..."
curl -s -X POST "$WORKER_URL/api/decide" \
  -H "Content-Type: application/json" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: $SDK_KEY" \
  -d "{\"flagKey\": \"checkout_flow\", \"userId\": \"$TEST_USER\"}" | jq .
```

### Vercel Edge Functions

```bash
#!/bin/bash
# test-vercel-forced-decisions.sh

VERCEL_URL="https://your-app.vercel.app"
SDK_KEY="your-vercel-sdk-key"
TEST_USER="qa_tester_vercel_001"

echo "=== Vercel Edge Functions Forced Decision Tests ==="

# Test all variations for a feature flag
VARIATIONS=("control" "treatment" "variant_a" "variant_b")
FLAG_KEY="homepage_redesign"

for variation in "${VARIATIONS[@]}"; do
  echo -e "\nTesting variation: $variation"
  
  response=$(curl -s -X POST "$VERCEL_URL/api/decide" \
    -H "Content-Type: application/json" \
    -H "X-Optimizely-Enable-FEX: true" \
    -H "X-Optimizely-SDK-Key: $SDK_KEY" \
    -H "X-Optimizely-Force-Variation: $variation" \
    -d "{
      \"flagKey\": \"$FLAG_KEY\",
      \"userId\": \"$TEST_USER\",
      \"attributes\": {
        \"plan\": \"premium\",
        \"country\": \"US\"
      }
    }")
  
  echo "$response" | jq '{
    variationKey: .variationKey,
    enabled: .enabled,
    flagKey: .flagKey
  }'
done
```

### Fastly Compute@Edge

```bash
#!/bin/bash
# test-fastly-forced-decisions.sh

FASTLY_URL="https://your-service.edgecompute.app"
SDK_KEY="your-fastly-sdk-key"
TEST_USER="qa_tester_fastly_001"

echo "=== Fastly Compute@Edge Forced Decision Tests ==="

# Test with VCL integration
echo -e "\n1. Testing with cookie-based QA override..."
curl -s "$FASTLY_URL/api/decide" \
  -H "Cookie: qa_user_id=$TEST_USER" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: $SDK_KEY" \
  -H "X-Optimizely-Force-Variation: premium_features" \
  -d "{\"flagKey\": \"feature_access\", \"userId\": \"$TEST_USER\"}" | jq .

# Test precedence
echo -e "\n2. Testing parameter precedence..."
curl -s -X POST "$FASTLY_URL/api/decide?forceVariation=query_var" \
  -H "X-Optimizely-Force-Variation: header_var" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: $SDK_KEY" \
  -d '{
    "flagKey": "precedence_test",
    "userId": "test_user",
    "forcedVariationKey": "body_var"
  }' | jq '.variationKey'  # Should output: "header_var"
```

## Testing Scenarios

### Scenario 1: Feature Rollout Testing

Test all stages of a feature rollout:

```bash
# Stage 1: Feature disabled
curl -X POST /api/decide \
  -H "X-Optimizely-Force-Variation: off" \
  -d '{"flagKey": "new_feature", "userId": "test_user"}'

# Stage 2: Beta users only
curl -X POST /api/decide \
  -H "X-Optimizely-Force-Variation: beta" \
  -d '{"flagKey": "new_feature", "userId": "test_user"}'

# Stage 3: General availability
curl -X POST /api/decide \
  -H "X-Optimizely-Force-Variation: on" \
  -d '{"flagKey": "new_feature", "userId": "test_user"}'
```

### Scenario 2: A/B Test Validation

Validate all variations in an A/B test:

```javascript
// Automated test script
const variations = ['control', 'variant_a', 'variant_b', 'variant_c'];
const testUsers = ['user_1', 'user_2', 'user_3'];

for (const user of testUsers) {
  for (const variation of variations) {
    const response = await fetch('/api/decide', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Optimizely-Enable-FEX': 'true',
        'X-Optimizely-SDK-Key': SDK_KEY,
        'X-Optimizely-Force-Variation': variation
      },
      body: JSON.stringify({
        flagKey: 'checkout_flow_test',
        userId: user
      })
    });
    
    const decision = await response.json();
    console.log(`User: ${user}, Forced: ${variation}, Got: ${decision.variationKey}`);
    
    // Validate variation was applied
    if (decision.variationKey !== variation) {
      throw new Error(`Forced variation failed for ${user}`);
    }
  }
}
```

### Scenario 3: Error Case Testing

Test edge cases and error scenarios:

```bash
# Test invalid variation key
curl -X POST /api/decide \
  -H "X-Optimizely-Force-Variation: invalid_variation_key" \
  -d '{"flagKey": "test_flag", "userId": "test_user"}'
# Expected: Falls back to normal bucketing or returns error

# Test with missing flag key
curl -X POST /api/decide \
  -H "X-Optimizely-Force-Variation: treatment" \
  -d '{"flagKey": "non_existent_flag", "userId": "test_user"}'
# Expected: Error response

# Test empty forced variation
curl -X POST /api/decide \
  -H "X-Optimizely-Force-Variation: " \
  -d '{"flagKey": "test_flag", "userId": "test_user"}'
# Expected: Normal bucketing applied
```

## Integration with QA Tools

### Postman Collection Example

```json
{
  "info": {
    "name": "Optimizely Edge Agent - Forced Decisions",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Force Control Variation",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "X-Optimizely-Enable-FEX",
            "value": "true"
          },
          {
            "key": "X-Optimizely-SDK-Key",
            "value": "{{SDK_KEY}}"
          },
          {
            "key": "X-Optimizely-Force-Variation",
            "value": "control"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"flagKey\": \"{{FLAG_KEY}}\",\n  \"userId\": \"{{TEST_USER_ID}}\"\n}"
        },
        "url": "{{BASE_URL}}/api/decide"
      }
    },
    {
      "name": "Force Treatment with Attributes",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "X-Optimizely-Force-Variation",
            "value": "treatment"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"flagKey\": \"{{FLAG_KEY}}\",\n  \"userId\": \"{{TEST_USER_ID}}\",\n  \"attributes\": {\n    \"plan\": \"premium\",\n    \"beta_tester\": true\n  }\n}"
        }
      }
    }
  ],
  "variable": [
    {
      "key": "BASE_URL",
      "value": "https://your-edge-agent.com"
    },
    {
      "key": "SDK_KEY",
      "value": "your-sdk-key"
    },
    {
      "key": "FLAG_KEY",
      "value": "test_feature"
    },
    {
      "key": "TEST_USER_ID",
      "value": "qa_tester_001"
    }
  ]
}
```

### Selenium/Playwright Example

```javascript
// playwright-forced-decisions.js
const { chromium } = require('playwright');

async function testForcedDecisions() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  
  // Intercept and modify requests to add forced variation
  await context.route('**/api/decide', route => {
    const headers = {
      ...route.request().headers(),
      'X-Optimizely-Force-Variation': 'premium_experience'
    };
    
    route.continue({ headers });
  });
  
  const page = await context.newPage();
  await page.goto('https://your-app.com/checkout');
  
  // Verify premium experience is shown
  const isPremium = await page.locator('.premium-checkout').isVisible();
  console.assert(isPremium, 'Premium checkout should be visible');
  
  await browser.close();
}
```

## Best Practices

### 1. Use Descriptive Test User IDs
```bash
# Good: Clear purpose and environment
"qa_tester_staging_001"
"demo_user_sales_presentation"
"debug_issue_12345"

# Bad: Generic IDs
"test"
"user1"
```

### 2. Document Test Scenarios
```bash
# Create a test matrix
# test-matrix.md
| Scenario | Flag Key | Forced Variation | Expected Result |
|----------|----------|------------------|-----------------|
| Checkout - Free | checkout_flow | basic | 3-step process |
| Checkout - Premium | checkout_flow | express | 1-step process |
| Homepage - A/B Test | homepage_v2 | variant_b | New design |
```

### 3. Automate Regression Tests
```javascript
// regression-test.js
const testCases = [
  { flag: 'feature_1', variation: 'on', expected: { enabled: true } },
  { flag: 'feature_2', variation: 'treatment', expected: { enabled: true } },
  { flag: 'feature_3', variation: 'off', expected: { enabled: false } }
];

async function runRegressionTests() {
  for (const testCase of testCases) {
    const result = await testForcedDecision(
      testCase.flag, 
      testCase.variation
    );
    
    if (result.enabled !== testCase.expected.enabled) {
      console.error(`FAILED: ${testCase.flag}`);
    } else {
      console.log(`PASSED: ${testCase.flag}`);
    }
  }
}
```

### 4. Clean Up Test Data
Since forced decisions don't persist, no cleanup is needed. However, if using any persistent test data:

```bash
# Clean up any test users or data created during testing
curl -X DELETE /api/test-data/cleanup \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

## Troubleshooting

### Issue: Forced Variation Not Applied

**Symptoms**: Decision returns different variation than forced
**Possible Causes**:
1. Parameter precedence - check if header is overriding other sources
2. Invalid variation key - verify variation exists in datafile
3. Authentication issues - ensure SDK key is valid

**Debug Steps**:
```bash
# Enable debug headers to see what's happening
curl -X POST /api/decide \
  -H "X-Optimizely-Enable-Debug: true" \
  -H "X-Optimizely-Force-Variation: treatment" \
  -d '{"flagKey": "test", "userId": "debug_user"}'
```

### Issue: Inconsistent Results

**Symptoms**: Same forced request gives different results
**Solution**: Check for caching issues

```bash
# Bypass cache
curl -X POST /api/decide \
  -H "Cache-Control: no-cache" \
  -H "X-Optimizely-Force-Variation: treatment" \
  -d '{"flagKey": "test", "userId": "user"}'
```

## Security Considerations

1. **Production Protection**: Consider restricting forced decisions in production
2. **Audit Logging**: Log all forced decision requests for security audits
3. **Access Control**: Limit who can use forced decisions via authentication

```javascript
// Example: Restrict forced decisions to specific users
if (headers['X-Optimizely-Force-Variation'] && !isAuthorizedQATester(userId)) {
  return { error: 'Unauthorized to use forced decisions' };
}
```

## Related Documentation

- [API Decision Endpoint Reference](../decisions/decide.md)
- [Edge Mode Testing Guide](../../cdn-adapters/edge-mode-testing-guide.md) - Comprehensive Edge Mode testing across platforms
- [Cloudflare Testing Guide](../../cdn-adapters/cloudflare-adapter.md#testing-and-qa-features)
- [Vercel Testing Guide](../../cdn-adapters/vercel-adapter.md#testing-and-qa-features)
- [Fastly Testing Guide](../../cdn-adapters/fastly-adapter.md#testing-and-qa-features)