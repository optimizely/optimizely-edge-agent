---
type: documentation
description: "Detailed discrepancies for kv-storage-tests.js between local and live environments"
lastUpdated: "2023-10-31"
status: "Active"
planId: "testing-audit-reconciliation-04-10-2025"
---

# KV Storage Tests Discrepancies

This document details the specific discrepancies identified when running the `kv-storage-tests.js` test in both local and live Cloudflare Workers environments.

## Test Purpose

The KV Storage tests validate the Edge Agent's interaction with Cloudflare KV storage, including reading/writing data, caching behavior, key handling, expiration, and namespace binding.

## Test Execution Summary

**Test File:** `kv-storage-tests.js`  
**Execution Date:** 2023-10-31  
**Environments Tested:** Local (Wrangler), Live (Cloudflare Workers)

## Discrepancies Identified

### 1. KV Namespace Binding Differences

**Severity:** Critical  
**Category:** Environmental Dependencies

The local and live environments bind KV namespaces differently, which causes fundamental operational differences:

| Aspect | Local | Live | Impact |
|--------|-------|------|--------|
| Namespace Name | `TEST_KV` (development binding) | `EDGE_AGENT` (production binding) | Critical - Access to different data |
| Binding Method | `wrangler.toml` development config | Cloudflare dashboard binding | High - Implementation differences |
| Preview Mode | Running in preview mode | Running in production mode | High - Behavior differences |

**Example Evidence:**
```
// Local KV List Response
{
  "keys": [
    {"name": "test-key-1", "expiration": null, "metadata": null},
    {"name": "test-key-2", "expiration": null, "metadata": null}
  ],
  "list_complete": true,
  "cursor": ""
}

// Live KV List Response
{
  "keys": [
    {"name": "test-key-1", "expiration": 1728374522, "metadata": {"env": "prod"}},
    {"name": "test-key-2", "expiration": 1728374522, "metadata": {"env": "prod"}},
    {"name": "datafile-AB12345", "expiration": 1725782522, "metadata": {"env": "prod", "type": "datafile"}}
  ],
  "list_complete": false,
  "cursor": "AA50ZW1wbGF0ZTogUGFnZU1hbmFnZXIKQ21kOiBHZXRQYWdlcwpQYXJhbXM6IHsKICAJcGF0aDoiL3dlYngvIgp9Cg=="
}
```

**Impact Analysis:**
Tests that validate KV operations are interacting with completely different namespaces between local and live environments. The live environment has production data (including additional keys) and different expiration settings, making direct comparisons challenging.

### 2. KV Cache Behavior Differences

**Severity:** Critical  
**Category:** Cache Behavior

The local and live environments have fundamentally different caching behaviors for KV storage:

| Behavior | Local | Live | Impact |
|----------|-------|------|--------|
| Cache TTL Enforcement | Simulated (manual) | Real (automatic) | Critical - Different cache invalidation |
| Cache Headers | Simulated | Real CF-Cache headers | High - Different cache diagnostics |
| Worker Cache | Not present | Additional CF edge cache | Critical - Extra caching layer |
| Cache Purge API | Not supported | Supported | High - Cache management differences |

**Example Cache Response:**
```
// Local Cache Control Headers
{
  "cache-control": "max-age=3600"
}

// Live Cache Control Headers
{
  "cache-control": "max-age=3600",
  "cf-cache-status": "HIT", 
  "age": "2520"
}
```

**Impact Analysis:**
Tests that validate caching behavior see fundamentally different results between environments. In the live environment, there's an additional caching layer (the CF edge cache) that doesn't exist in the local environment, making cache-related tests unpredictable.

### 3. KV Read Performance Differences

**Severity:** High  
**Category:** Performance

KV read operations have significant performance differences between environments:

| Metric | Local | Live | Difference |
|--------|-------|------|------------|
| Avg KV Read Time | 5ms | 22ms | +17ms (340% slower) |
| Min KV Read Time | 3ms | 18ms | +15ms (500% slower) |
| Max KV Read Time | 12ms | 45ms | +33ms (275% slower) |
| Cached Read Time | ~3ms | ~0.5ms | Local 6x slower for cached reads |

**Impact Analysis:**
Performance tests for KV operations need completely different thresholds between environments. The local environment is faster for uncached reads but significantly slower for cached reads compared to the live environment.

### 4. KV Write Behavior Differences

**Severity:** Critical  
**Category:** Data Persistence

Write operations to KV storage behave differently between environments:

| Behavior | Local | Live | Impact |
|----------|-------|------|--------|
| Write Confirmation | Immediate | Eventually consistent | Critical - Test timing differences |
| Write-Read Consistency | Immediate | Potential lag | Critical - Test reliability issues |
| Metadata Support | Limited | Full support | Medium - Reduced test coverage |
| Expiration Handling | Simulated | Real | High - Different expiration behavior |

**Evidence from Tests:**
```
// Local Write-Then-Read Test (always passes)
Write 'test-value' to 'test-key' -> Success
Read 'test-key' -> Returns 'test-value'

// Live Write-Then-Read Test (sometimes fails)
Write 'test-value' to 'test-key' -> Success
Read 'test-key' -> Returns null (not propagated yet)
Wait 100ms
Read 'test-key' -> Returns 'test-value'
```

**Impact Analysis:**
Tests that validate write operations and immediately read the results are unreliable in the live environment due to eventual consistency. Tests need to implement retry logic or delay verification to work reliably in the live environment.

### 5. KV Key Listing Differences

**Severity:** High  
**Category:** API Behavior

The KV list operation behaves differently between environments:

| Behavior | Local | Live | Impact |
|----------|-------|------|--------|
| Pagination | Simulated | Real | High - Different response structure |
| List Completeness | Always complete | May be incomplete | High - Test logic differences |
| Key Count Limits | None | 1000 key limit | Medium - Large dataset handling |
| Performance | Fast (in-memory) | Slow (API call) | Medium - Test performance issues |

**Example List Response:**
```
// Local (small test dataset)
{
  "keys": [
    {"name": "test-key-1", "expiration": null, "metadata": null},
    {"name": "test-key-2", "expiration": null, "metadata": null}
  ],
  "list_complete": true,
  "cursor": ""
}

// Live (production dataset - truncated)
{
  "keys": [
    // ... many keys ...
  ],
  "list_complete": false,
  "cursor": "AA50ZW1wbGF0ZTogUGFnZU1hbmFnZXIKQ21kOiBHZXRQYWdlcwpQYXJhbXM6IHsKICAJcGF0aDoiL3dlYngvIgp9Cg=="
}
```

**Impact Analysis:**
Tests that validate key listing operations need to handle pagination differently between environments. The local environment typically returns all keys at once, while the live environment may require multiple paginated requests for large datasets.

### 6. KV Error Handling Differences

**Severity:** Medium  
**Category:** Error Handling

Error responses for KV operations differ between environments:

| Scenario | Local | Live | Impact |
|----------|-------|------|--------|
| Invalid Namespace | Detailed error | Generic 500 error | Medium - Different error handling |
| Rate Limiting | Not simulated | Actual limits | High - Tests may fail unexpectedly |
| Permission Errors | Not simulated | Actual permissions | High - Tests may fail unexpectedly |
| Error Detail Level | High | Low | Medium - Less diagnostic information |

**Example Error Responses:**
```
// Local Error (Invalid Namespace)
{
  "error": "KV binding 'INVALID_NAMESPACE' not found",
  "status": 400,
  "detail": "Namespace binding not found in wrangler.toml"
}

// Live Error (Invalid Namespace)
{
  "error": "Internal Error",
  "status": 500
}
```

**Impact Analysis:**
Tests that validate error handling need to account for different error response formats and detail levels. Live environment errors typically have less diagnostic information, making error-specific testing more difficult.

### 7. KV Data Types and Limits

**Severity:** Medium  
**Category:** API Behavior

The local and live environments handle data types and limits differently:

| Aspect | Local | Live | Impact |
|--------|-------|------|--------|
| Maximum Value Size | Unenforced (~1MB) | Enforced (25MB) | Medium - Large value handling |
| Binary Data | Handled differently | Native support | Medium - Binary data tests |
| JSON Serialization | Manual | Automatic for objects | Low - Implementation details |
| Character Encoding | UTF-8 simulated | Native UTF-8 | Low - Encoding edge cases |

**Impact Analysis:**
Tests that work with large values, binary data, or special encodings may behave differently between environments. The live environment enforces stricter limits but has better native support for binary data and character encoding.

## Root Causes

The primary root causes of these discrepancies are:

1. **Wrangler Development Mode**: The local environment uses Wrangler's simulated KV storage which doesn't perfectly mirror Cloudflare's production KV behavior.
2. **Namespace Binding**: Different namespaces are bound between environments, meaning tests interact with entirely different data stores.
3. **Cloudflare Edge Caching**: The live environment includes Cloudflare's edge caching layer which doesn't exist locally.
4. **Eventual Consistency**: Cloudflare KV is eventually consistent in production but the local simulation provides immediate consistency.
5. **Network Latency**: Live KV operations must travel over the internet, while local operations are performed in-memory.

## Recommendations

Based on these discrepancies, the following adjustments are recommended for the KV storage tests:

1. **Environment-Specific Namespace Configuration**:
   ```javascript
   const namespace = context.isLiveEnvironment 
     ? env.EDGE_AGENT 
     : env.TEST_KV;
   ```

2. **Wait for Consistency in Write Tests**:
   ```javascript
   // Write the value
   await namespace.put(key, value);
   
   // In live environment, wait for eventual consistency
   if (context.isLiveEnvironment) {
     await new Promise(resolve => setTimeout(resolve, 500));
   }
   
   // Now read the value
   const readValue = await namespace.get(key);
   ```

3. **Pagination Handling for List Operations**:
   ```javascript
   // Handle pagination in both environments
   let allKeys = [];
   let cursor = null;
   do {
     const listResult = await namespace.list({ cursor });
     allKeys = [...allKeys, ...listResult.keys];
     cursor = listResult.cursor;
   } while (cursor);
   ```

4. **Environment-Aware Error Handling**:
   ```javascript
   try {
     // Attempt KV operation
   } catch (error) {
     // Handle errors differently based on environment
     if (context.isLiveEnvironment) {
       // Less detailed errors, check status code primarily
     } else {
       // More detailed errors, can check specific error message
     }
   }
   ```

5. **Different Performance Expectations**:
   ```javascript
   const maxKvReadTime = context.isLiveEnvironment ? 100 : 20;
   const maxKvWriteTime = context.isLiveEnvironment ? 200 : 30;
   ```

6. **Cache Awareness**:
   ```javascript
   // For cache tests, use different verification logic
   if (context.isLiveEnvironment) {
     // Look for cf-cache-status header
     const cacheStatus = response.headers.get('cf-cache-status');
     assert(cacheStatus === 'HIT', 'Expected a cache hit');
   } else {
     // Use simulated cache behavior or timing checks
   }
   ```

## Verification Steps

To verify these discrepancies:

1. Run the KV storage tests using the comparison script:
   ```bash
   node run-live-tests.js kv-storage-tests.js --comparison
   ```

2. Examine the generated comparison report in the `results/comparisons` directory.

3. Verify KV namespace differences by running the list operation in both environments and comparing results.

4. Test write-then-read operations with various delays to confirm the eventual consistency behavior in the live environment.

## Conclusion

The KV storage tests have revealed significant and fundamental differences between local and live environments. These differences impact test reliability, especially for tests that involve caching, write-read consistency, and namespace operations. The recommended changes enable more reliable testing across both environments but highlight the need for environment-specific test expectations and configurations. 