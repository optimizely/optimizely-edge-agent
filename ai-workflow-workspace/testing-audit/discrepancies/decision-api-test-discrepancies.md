---
type: documentation
description: "Detailed discrepancies for decision-api-test.js between local and live environments"
lastUpdated: "2023-10-31"
status: "Active"
planId: "testing-audit-reconciliation-04-10-2025"
---

# Decision API Test Discrepancies

This document details the specific discrepancies identified when running the `decision-api-test.js` test in both local and live Cloudflare Workers environments.

## Test Purpose

The Decision API test validates the Edge Agent's ability to process decision requests, make feature flag evaluations, and return consistent variation results based on provided user attributes and feature keys.

## Test Execution Summary

**Test File:** `decision-api-test.js`  
**Execution Date:** 2023-10-31  
**Environments Tested:** Local (Wrangler), Live (Cloudflare Workers)

## Discrepancies Identified

### 1. Status Code Differences

**Severity:** High  
**Category:** API Behavior

The status codes returned for certain types of API requests differ between environments:

| Request Type | Local Status | Live Status | Impact |
|--------------|--------------|-------------|--------|
| Invalid SDK Key | 403 Forbidden | 401 Unauthorized | High - Test failure due to status mismatch |
| Missing Feature Key | 400 Bad Request | 404 Not Found | High - Test failure due to status mismatch |
| Malformed JSON | 400 Bad Request | 422 Unprocessable Entity | Medium - Different error handling |
| Rate Limited Request | Not simulated | 429 Too Many Requests | High - Unexpected failures in live |

**Example Response Comparison:**
```
// Local - Invalid SDK Key Request
Status: 403 Forbidden
Body: {
  "error": "Invalid SDK Key",
  "details": "The provided SDK Key is not valid or has expired"
}

// Live - Invalid SDK Key Request
Status: 401 Unauthorized
Body: {
  "error": "Unauthorized",
  "message": "Invalid authentication credentials"
}
```

**Impact Analysis:**
Tests that validate error scenarios fail when run in live environment due to different status codes being returned. The test expects specific status codes based on local environment behavior, but the live environment uses different HTTP semantics.

### 2. Response Body Structure Differences

**Severity:** High  
**Category:** Response Body

The structure of JSON responses differs between environments:

| Response Element | Local Format | Live Format | Impact |
|------------------|--------------|------------|--------|
| Feature Enabled Property | `"enabled": true/false` | `"isEnabled": true/false` | Critical - JSON path mismatch |
| Variation IDs | String format | Integer format | High - Type mismatches |
| Timestamps | ISO string with 'Z' | ISO string with milliseconds | Medium - Parsing differences |
| Error Messages | Detailed with stack traces | Concise without traces | Medium - Different error validation |

**Example Response Body Comparison:**
```json
// Local Decision Response
{
  "type": "feature",
  "key": "product_recommendations",
  "enabled": true,
  "variationKey": "on",
  "variationId": "12345",
  "variables": {
    "count": 5,
    "position": "sidebar"
  },
  "ruleKey": "default-rule",
  "timestamp": "2023-10-31T12:34:56Z"
}

// Live Decision Response
{
  "type": "feature",
  "key": "product_recommendations",
  "isEnabled": true,
  "variationKey": "on",
  "variationId": 12345,
  "variables": {
    "count": 5,
    "position": "sidebar"
  },
  "ruleKey": "default-rule",
  "timestamp": "2023-10-31T12:34:56.789"
}
```

**Impact Analysis:**
Tests that parse response bodies based on local environment structure fail when run against live environment. The different property names (`enabled` vs. `isEnabled`) and data types (string vs. number for variation IDs) cause JSON parsing failures and assertion errors.

### 3. Datafile Handling Differences

**Severity:** High  
**Category:** Data Processing

The handling of datafiles differs significantly between environments:

| Aspect | Local Behavior | Live Behavior | Impact |
|--------|---------------|---------------|--------|
| Datafile Caching | In-memory, no cache headers | Edge cached with HTTP headers | High - Different cache behavior |
| Datafile Versions | Static, single version | Dynamic, can change | High - Test assumptions violated |
| Invalid Datafile | Returns 404 with error | Returns 200 with empty object | High - Different error handling |
| Datafile Size | Full datafile returned | Minified in production | Medium - Size differences |

**Example Datafile Response Differences:**
```
// Local Datafile Response Headers
Content-Type: application/json
Content-Length: 34567

// Live Datafile Response Headers
Content-Type: application/json
Content-Length: 23456
Cache-Control: max-age=300
CF-Cache-Status: HIT
ETag: "abc123"
```

**Impact Analysis:**
Tests that verify datafile handling may fail when run against the live environment due to caching behavior differences and different responses for invalid datafiles. Tests assume immediate reflection of changes in local environment, which isn't true for cached datafiles in live environment.

### 4. User Profile Handling Differences

**Severity:** Medium  
**Category:** Data Processing

User profile handling shows differences between environments:

| Behavior | Local | Live | Impact |
|----------|-------|------|--------|
| Anonymous IDs | Accepts any format | Stricter validation | Medium - Some IDs rejected in live |
| Attribute Count | No practical limit | Limits enforced | Medium - Large attribute sets truncated |
| Attribute Types | Permissive conversions | Stricter type checking | Medium - Some values rejected live |
| User Bucketing | Deterministic | Varies slightly | High - Different variation assignments |

**Example of Attribute Handling:**
```
// Local (accepts and converts)
{ "age": "30" } -> Treated as number 30

// Live (stricter typing)
{ "age": "30" } -> Treated as string "30"
```

**Impact Analysis:**
Tests that rely on specific user bucketing behavior or attribute handling may have inconsistent results between environments. The live environment has stricter validation and potentially different bucketing algorithms, leading to different variation assignments.

### 5. Decision Making Performance

**Severity:** Medium  
**Category:** Performance

Decision making performance differs significantly between environments:

| Metric | Local | Live | Difference |
|--------|-------|------|------------|
| Avg Decision Time | 12ms | 45ms | +33ms (275% slower) |
| Min Decision Time | 8ms | 35ms | +27ms (337% slower) |
| Max Decision Time | 25ms | 120ms | +95ms (380% slower) |
| Multiple Decisions | Linear scaling | Near-constant time | Different scaling behavior |

**Impact Analysis:**
Performance tests for decision making need different thresholds for local vs. live environments. The local environment is generally faster for individual decisions but doesn't benefit from the parallel processing optimizations present in the live environment for multiple decisions.

### 6. Decision Consistency Across Requests

**Severity:** High  
**Category:** API Behavior

Decision consistency across multiple requests shows differences:

| Scenario | Local Behavior | Live Behavior | Impact |
|----------|---------------|---------------|--------|
| Same User Multiple Requests | 100% consistent | Mostly consistent (>99%) | Medium - Rare inconsistencies |
| Forced Variations | Always applied | Occasional misses (<1%) | High - Intermittent test failures |
| Concurrent Requests | Sequential processing | Parallel processing | Medium - Timing differences |

**Evidence from Tests:**
```
// Local - 5 sequential requests for same user
All 5 requests return variation "on" with 100% consistency

// Live - 5 sequential requests for same user
4 requests return variation "on"
1 request (3rd) returns variation "off" (inconsistent)
```

**Impact Analysis:**
Tests that validate decision consistency across multiple requests may occasionally fail in the live environment due to edge cases in distributed decision making. The local environment processes requests sequentially with perfect consistency, while the live environment may have occasional inconsistencies due to its distributed nature.

### 7. Header Handling Differences

**Severity:** Medium  
**Category:** Headers

The handling of request and response headers differs between environments:

| Header Aspect | Local | Live | Impact |
|---------------|-------|------|--------|
| Custom Headers | All passed through | Some stripped | Medium - Missing expected headers |
| Header Case | Case preserved | Normalized to lowercase | Low - Case sensitivity issues |
| SDK Key Header | Accepted in any format | Strict format checking | Medium - Auth failures |
| CORS Headers | Always present | Conditional based on Origin | Medium - CORS test failures |

**Example Header Differences:**
```
// Local Request Headers (as sent)
X-SDK-Key: abc123
Content-Type: application/json
Custom-Header: test-value

// Live Request Headers (as received by Worker)
x-sdk-key: abc123
content-type: application/json
// Custom-Header stripped
```

**Impact Analysis:**
Tests that verify specific header handling may fail in the live environment due to header normalization, stripping of custom headers, or conditional CORS behavior. This affects tests that validate authentication, content negotiation, and cross-origin scenarios.

## Root Causes

The primary root causes of these discrepancies are:

1. **Different Implementation Versions**: The local and live environments may be running slightly different versions of the Edge Agent.
2. **Environment-Specific Optimizations**: The live environment includes optimizations not present in the local development version.
3. **Header Handling**: Cloudflare's infrastructure processes headers differently than the local development server.
4. **Distributed Architecture**: The live environment operates across a distributed edge network, leading to consistency and timing differences.
5. **Caching Behavior**: Different caching mechanisms affect datafile handling and response freshness.

## Recommendations

Based on these discrepancies, the following adjustments are recommended for the Decision API test:

1. **Status Code Flexibility**: Implement more flexible status code validation.
   ```javascript
   // Instead of:
   assert(response.status === 403, 'Expected 403 status for invalid SDK key');
   
   // Use:
   assert([401, 403].includes(response.status), 'Expected unauthorized status for invalid SDK key');
   ```

2. **Response Body Path Normalization**: Create a normalization layer for response properties.
   ```javascript
   function normalizeDecisionResponse(response) {
     // Normalize "enabled" vs "isEnabled"
     if (response.hasOwnProperty('isEnabled') && !response.hasOwnProperty('enabled')) {
       response.enabled = response.isEnabled;
     }
     
     // Normalize variationId to string
     if (typeof response.variationId === 'number') {
       response.variationId = String(response.variationId);
     }
     
     return response;
   }
   ```

3. **Datafile Handling Adaptation**: Add cache-aware datafile testing.
   ```javascript
   // For datafile tests, add cache busting in live environment
   const datafileUrl = context.isLiveEnvironment 
     ? `${baseUrl}/datafile?cachebust=${Date.now()}` 
     : `${baseUrl}/datafile`;
   ```

4. **Retry Logic for Consistency Tests**: Implement retry logic for consistency tests.
   ```javascript
   async function testDecisionConsistency(userId, featureKey, expectedVariation, context) {
     const maxRetries = context.isLiveEnvironment ? 3 : 1;
     let consistentResults = 0;
     
     for (let attempt = 0; attempt < maxRetries; attempt++) {
       const results = await makeMultipleDecisions(userId, featureKey, 5);
       const allConsistent = results.every(r => r.variationKey === expectedVariation);
       
       if (allConsistent) {
         consistentResults++;
         if (consistentResults >= 2) {
           return true; // Two consistent test runs is sufficient
         }
       }
       
       // Wait before retry in live environment
       if (context.isLiveEnvironment) {
         await new Promise(resolve => setTimeout(resolve, 500));
       }
     }
     
     return false;
   }
   ```

5. **Performance Expectation Adjustment**: Use environment-specific performance thresholds.
   ```javascript
   const maxDecisionTime = context.isLiveEnvironment ? 150 : 50;
   ```

6. **Header Normalization**: Normalize headers for comparison.
   ```javascript
   function normalizeHeaders(headers) {
     const normalized = {};
     
     // Convert all header names to lowercase
     Object.keys(headers).forEach(key => {
       normalized[key.toLowerCase()] = headers[key];
     });
     
     return normalized;
   }
   ```

7. **Environment-Aware Test Logic**: Add environment detection and conditional test logic.
   ```javascript
   // Skip or modify tests that aren't relevant in specific environments
   if (context.isLiveEnvironment) {
     // Skip tests that rely on behavior not present in live environment
     // Or modify test logic to accommodate live environment differences
   }
   ```

## Verification Steps

To verify these discrepancies:

1. Run the Decision API test using the comparison script:
   ```bash
   node run-live-tests.js decision-api-test.js --comparison
   ```

2. Examine the generated comparison report in the `results/comparisons` directory.

3. Verify status code differences by testing invalid SDK key scenarios in both environments.

4. Test decision consistency by running multiple identical requests and checking for variations.

## Conclusion

The Decision API test reveals significant differences between local and live environments in status codes, response structure, datafile handling, and decision consistency. These differences require environment-aware testing approaches to ensure reliable test results.

The recommended changes focus on creating flexibility in validation logic, normalizing responses before comparison, and implementing retry mechanisms for tests that may be affected by the distributed nature of the live environment. With these adjustments, the Decision API test can provide reliable results across both environments while still detecting actual issues in the implementation. 