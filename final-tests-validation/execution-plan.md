# Optimizely Edge Agent Live Testing Execution Plan

## Overview

This document serves as the master checklist for validating the Optimizely Edge Agent against live infrastructure. Each test category includes specific tests to validate feature parity and functionality.

## Test Status Indicators

- ⏳ **PENDING**: Test has not been started
- 🔄 **IN PROGRESS**: Test is currently being executed
- ✅ **PASSED**: Test has passed all validation criteria
- ❌ **FAILED**: Test has failed validation criteria
- ⚠️ **PARTIAL**: Test passed with some issues or limitations
- 🔶 **BLOCKED**: Test cannot proceed due to dependencies

## Master Test Checklist

### 1. Infrastructure Verification

- [x] **1.1 Basic Connectivity** ✅
  - [x] 1.1.1 Verify correct HTTP/HTTPS response from deployment URL ✅
  - [x] 1.1.2 Confirm Cloudflare headers present (cf-ray ID) ✅
  - [x] 1.1.3 Verify response timing consistent with edge deployment ✅

- [x] **1.2 SDK Key Validation** ⚠️
  - [x] 1.2.1 Verify test SDK key is accepted ✅
  - [x] 1.2.2 Verify invalid SDK key is rejected ❌
  - [x] 1.2.3 Confirm SDK key environment binding is working ✅

### 2. Decision Service Tests

- [x] **2.1 Feature Flag Decisions** ❌
  - [x] 2.1.1 Verify `/api/decide` endpoint with valid flags ❌
  - [x] 2.1.2 Test user targeting and attributes ❌
  - [x] 2.1.3 Validate all decide options ❌

- [x] **2.2 Experiment Decisions** ❌
  - [x] 2.2.1 Verify experiment bucketing consistency ❌
  - [x] 2.2.2 Test audience targeting ❌
  - [x] 2.2.3 Validate variation assignment ❌

- [x] **2.3 Forced Variations** ❌
  - [x] 2.3.1 Test setting forced variations ❌
  - [x] 2.3.2 Test getting forced variations ❌
  - [x] 2.3.3 Test removing forced variations ❌

### 3. CDN Variation Settings Tests

- [x] **3.1 URL Pattern Matching** ❌
  - [x] 3.1.1 Test exact match patterns ❌
  - [x] 3.1.2 Test wildcard patterns ❌
  - [x] 3.1.3 Test regex patterns ❌
  - [x] 3.1.4 Validate priority handling for multiple matches ❌

- [x] **3.2 Origin Request Forwarding** ❌
  - [x] 3.2.1 Test `forwardRequestToOrigin: true` behavior ❌
  - [x] 3.2.2 Test `forwardRequestToOrigin: false` behavior ❌
  - [x] 3.2.3 Validate header forwarding ❌
  - [x] 3.2.4 Validate query parameter forwarding ❌

- [x] **3.3 Content Transformation** ❌
  - [x] 3.3.1 Test HTML content transformation ❌
  - [x] 3.3.2 Test JS content transformation ❌
  - [x] 3.3.3 Test CSS content transformation ❌
  - [x] 3.3.4 Validate transformation with variation content ❌

### 4. Caching Behavior Tests

- [x] **4.1 Basic Caching** ❌
  - [x] 4.1.1 Verify initial request shows MISS ❌
  - [x] 4.1.2 Verify subsequent request shows HIT ❌
  - [x] 4.1.3 Test cache expiration based on TTL ❌

- [x] **4.2 Cache Key Variations** ❌
  - [x] 4.2.1 Test default VARIATION_KEY behavior ❌
  - [x] 4.2.2 Test custom cache key behavior ❌
  - [x] 4.2.3 Validate different variations get different cache entries ❌

- [x] **4.3 Cache Configuration** ❌
  - [x] 4.3.1 Test `cacheTTL` configuration ❌
  - [x] 4.3.2 Test `cacheRequestToOrigin` configuration ❌
  - [x] 4.3.3 Validate cache headers in response ❌

### 5. API Endpoint Parity

- [x] **5.1 Datafile Endpoints** ❌
  - [x] 5.1.1 Test GET `/api/datafile` ❌
  - [x] 5.1.2 Validate datafile caching ❌
  - [x] 5.1.3 Test datafile authorization ❌

- [x] **5.2 Flag Key Endpoints** ❌
  - [x] 5.2.1 Test GET `/api/flagkeys` ❌
  - [x] 5.2.2 Validate response format matches original ❌

- [x] **5.3 Decision Endpoints** ❌
  - [x] 5.3.1 Test POST `/api/decide` ❌
  - [x] 5.3.2 Test POST `/api/decide-all` ❌
  - [x] 5.3.3 Test POST `/api/decide-for-keys` ❌
  - [x] 5.3.4 Test GET/POST `/api/decide-options` ❌

- [x] **5.4 Tracking Endpoints** ❌
  - [x] 5.4.1 Test POST `/api/track` ❌
  - [x] 5.4.2 Test GET `/api/track.gif` ❌
  - [x] 5.4.3 Validate event dispatching ❌

### 6. Parameter Validation

- [x] **6.1 Header Parameters** ❌
  - [x] 6.1.1 Test all supported HTTP headers ❌
  - [x] 6.1.2 Validate header precedence rules ❌
  - [x] 6.1.3 Test header format variations ❌

- [x] **6.2 Query Parameters** ❌
  - [x] 6.2.1 Test all supported query parameters ❌
  - [x] 6.2.2 Validate query parameter precedence rules ❌
  - [x] 6.2.3 Test query parameter format variations ❌

- [x] **6.3 JSON Body Parameters** ❌
  - [x] 6.3.1 Test all supported JSON body parameters ❌
  - [x] 6.3.2 Validate JSON body parameter precedence rules ❌
  - [x] 6.3.3 Test JSON body parameter format variations ❌

### 7. Feature Parity Verification

- [x] **7.1 Core Feature Verification** ❌
  - [x] 7.1.1 Verify Cookie Management & Decision Persistence ❌
  - [x] 7.1.2 Verify Response Headers ❌
  - [x] 7.1.3 Verify KV Storage Integration ❌
  - [x] 7.1.4 Verify Configuration Options ❌
  - [x] 7.1.5 Verify Visitor ID Management ❌

- [x] **7.2 Side-by-Side Comparison** ❌
  - [x] 7.2.1 Compare original vs new implementation responses ❌
  - [x] 7.2.2 Validate identical behavior for key workflows ❌
  - [x] 7.2.3 Document any intentional differences ❌

## Test Execution History

| Date | Test ID | Status | Tester | Notes |
|------|---------|--------|--------|-------|
| 2025-04-09 | Infrastructure Verification | ⚠️ PARTIAL | AI Agent | Basic connectivity confirmed, SDK key validation issues |
| 2025-04-09 | CDN Variation | ❌ FAILED | AI Agent | Null reference error in targetUrl property |
| 2025-04-09 | Decision API | ❌ FAILED | AI Agent | API endpoint not implemented in RequestHandler |
| 2025-04-09 | Parameter Validation | ❌ FAILED | AI Agent | API endpoints not fully implemented |
| 2025-04-09 | Feature Parity | ❌ FAILED | AI Agent | Most features unimplemented |

## Dependencies and Critical Paths

- Tests 1.1 and 1.2 must be completed before any other tests
- Tests 3.x and 4.x depend on successful completion of 2.x
- Tests 7.x should be performed after all other tests

## Test Completion Checklist

- [x] All tests executed against live infrastructure
- [x] All test results documented with evidence
- [x] Issues categorized and prioritized
- [x] Final report generated
- [x] Implementation plan updated based on findings

## Reference Information

- Test infrastructure details in [infrastructure-config.md](./infrastructure-config.md)
- Issue tracking in [issue-tracking.md](./issue-tracking.md)
- Test results stored in [/test-results](./test-results/) directory 
- Final test execution summary in [/test-results/test-execution-summary.md](./test-results/test-execution-summary.md) 