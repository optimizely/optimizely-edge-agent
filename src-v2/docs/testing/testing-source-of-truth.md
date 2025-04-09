# Optimizely Edge Agent Testing Source of Truth

## IMPORTANT UPDATE: Feature Parity Gaps Implementation Progress (2025-04-07)

During a comprehensive review of the original Edge Agent implementation and our new implementation, we identified several critical feature parity gaps not yet covered in our testing approach. A new implementation plan (`edge-agent-feature-parity-002`) has been created to address these gaps.

**Current Implementation Progress:**

1. **Cookie Persistence and Decision Sticky Bucketing**: 
   - ✅ Implemented cookie parsing and generation utilities in `src-v2/utils/CookieUtils.ts`
   - ✅ Created `ICookieService` interface and `CookieService` implementation
   - ✅ Added comprehensive unit tests for both components
   - 🟡 Partially integrated cookie-based visitor ID extraction in RequestHandler
   - 🟡 Started implementation of decision persistence via cookies
   - ❌ End-to-end testing of cookie functionality still needed

2. **Response Header Management**:
   - ❌ Configuration-driven response header handling is incomplete
   - ❌ Metadata headers are missing
   - ❌ Cache control headers need implementation

3. **KV Storage Integration**:
   - ❌ Flag and datafile storage in KV is not implemented
   - ❌ Caching mechanisms need enhancement

4. **Configuration Options Support**:
   - ❌ Many configuration options from the original `requestConfig.js` are not implemented
   - ❌ All 30+ configuration options need implementation and testing

5. **Visitor ID Management**:
   - 🟡 Basic visitor ID extraction from cookies implemented
   - ❌ The complete visitor ID precedence rules and persistence are incomplete
   - ❌ Override behavior needs implementation

Our current test plan will be updated as these features are implemented.

---

This document provides a comprehensive view of the current testing landscape for the Optimizely Edge Agent, with a specific focus on how query parameters, headers, and JSON payloads are tested across various endpoints and functionality.

## Table of Contents

1. [Overview](#overview)
2. [Test Structure](#test-structure)
3. [Endpoint Coverage](#endpoint-coverage)
4. [Headers and Query Parameters](#headers-and-query-parameters)
5. [JSON Payload Coverage](#json-payload-coverage)
6. [Silent/Pixel Tracking Support](#silentpixel-tracking-support)
7. [CDN Variation Settings](#cdn-variation-settings)
8. [Metrics Coverage](#metrics-coverage)
9. [Gap Analysis](#gap-analysis)
10. [Test Execution Methods](#test-execution-methods)
11. [Cookie & Decision Persistence Testing](#cookie-and-decision-persistence-testing)

## Overview

The Optimizely Edge Agent test suite consists of:

- **Unit Tests**: Tests for isolated components and services
- **Integration Tests**: Tests for interactions between components within the system
- **Live Deployment Tests**: Tests for verifying production-like deployments

Most of these tests are located in the `src-v2/tests/` directory, with integration tests specifically in `src-v2/tests/integration/`.

## Test Structure

```
src-v2/tests/
├── adapters/                      # Adapter implementations tests
├── integration/                   # Integration tests for combined functionality
│   ├── AgentMode.test.ts          # Tests for agent mode (POST requests) 
│   ├── EdgeMode.test.ts           # Tests for edge mode (GET requests)
│   └── EdgeModePipeline.test.ts   # Tests for edge mode pipeline
├── metrics-test.ts                # Metrics testing script
├── run-integration-tests.ts       # Integration test runner
├── sdk-node-test.ts               # Node.js SDK integration test
├── services/                      # Individual service tests
│   ├── CacheManager.test.ts       # Cache management tests
│   ├── ContentTransformer.test.ts # Content transformation tests
│   ├── CookieService.test.ts      # Cookie management tests (NEW)
│   └── optimizely/                # Optimizely service tests
│       ├── decision.test.ts       # Decision service tests
│       └── event-tracking.test.ts # Event tracking tests
├── utils/                         # Utility tests (NEW)
│   └── CookieUtils.test.ts        # Cookie utility tests (NEW)
└── test-utils/                    # Testing utilities and mocks
```

## Endpoint Coverage

| Endpoint | Coverage | Files | Test Types |
|----------|----------|-------|------------|
| `/decide` | ✅ Comprehensive | `AgentMode.test.ts`, `metrics-test.ts` | POST requests, different parameter methods |
| `/decide-for-keys` | ✅ Basic | `AgentMode.test.ts` | POST requests with JSON body |
| `/decide-all` | ✅ Basic | `decision.test.ts` | Unit tests |
| `/track` | ⚠️ Partial | `AgentMode.test.ts`, `metrics-test.ts`, `event-tracking.test.ts` | POST with JSON body only |
| `/track-events` | ✅ Basic | `AgentMode.test.ts` | POST with JSON body |
| `/track.gif` | ❌ Missing | N/A | No dedicated tests |
| `/force-variation` | ✅ Basic | `forced-decisions.test.ts` | Unit tests only |
| Status endpoints | ⚠️ Partial | `integration/EdgeMode.test.ts` | Limited coverage |

## Headers and Query Parameters

### Headers Coverage

The following headers are defined in the codebase but have varying levels of test coverage:

| Header | Used For | Tested In | Coverage Level |
|--------|----------|-----------|----------------|
| `X-Optimizely-SDK-Key` | Authentication | `AgentMode.test.ts` (line 394) | ✅ Tested |
| `X-Optimizely-Flag-Key` | Flag identification | `AgentMode.test.ts` (line 394) | ✅ Tested |
| `X-Optimizely-User-Id` | User identification | `AgentMode.test.ts` (line 394) | ✅ Tested |
| `X-Optimizely-Event-Key` | Event tracking | N/A | ❌ Not tested |
| `X-Optimizely-Attributes` | User attributes | `RequestHandler.ts` (line 1228) | ❌ Not tested |
| `X-Optimizely-Visitor-Id` | Response header | `RequestHandler.ts` (line 1211) | ❌ Not tested |
| `X-Optimizely-Variation` | Response header | `RequestHandler.ts` (line 1216) | ❌ Not tested |
| `X-Optimizely-Cache` | Caching info | `RequestHandler.ts` (line 1275) | ❌ Not tested |
| `Cookie` | Request cookies | `CookieService.test.ts` | ✅ Tested |
| `Set-Cookie` | Response cookies | `CookieService.test.ts` | 🟡 Partially tested |

### Query Parameters Coverage

The following query parameters are defined or used in the codebase:

| Parameter | Used For | Tested In | Coverage Level |
|-----------|----------|-----------|----------------|
| `sdkKey` | Authentication | `AgentMode.test.ts` (line 372) | ✅ Tested |
| `flagKey` | Flag identification | `AgentMode.test.ts` (line 372) | ✅ Tested |
| `userId` | User identification | `AgentMode.test.ts` (line 372) | ✅ Tested |
| `eventKey` | Event tracking | N/A | ❌ Not tested |
| `visitor_id` | Alternative ID | `RequestHandler.ts` (line 734) | ❌ Not tested |
| Required query parameters | URL matching | `URLMatcher.test.ts`, `EdgeModePipeline.test.ts` | ✅ Tested |
| Ignored query parameters | URL matching | `URLMatcher.test.ts`, `EdgeModePipeline.test.ts` | ✅ Tested |

## JSON Payload Coverage

JSON payload structures are primarily tested in agent mode tests with coverage as follows:

| Payload Type | Purpose | Test Location | Coverage |
|--------------|---------|---------------|----------|
| Decision Payload | Flag decisions | `AgentMode.test.ts` | ✅ Good |
| Batch Decision Payload | Multiple flags | `AgentMode.test.ts` | ✅ Good |
| Track Event Payload | Event tracking | `AgentMode.test.ts` | ✅ Basic |
| Complex Event Tags | Rich events | `AgentMode.test.ts` (line 470) | ✅ Good |
| User Context w/ Attributes | User targeting | `AgentMode.test.ts` | ✅ Good |
| Decision Options | Advanced control | `AgentMode.test.ts` (line 584) | ✅ Basic |

## Silent/Pixel Tracking Support

Support for silent tracking methods is included but **poorly tested**:

| Method | Implementation | Test Coverage | Notes |
|--------|---------------|---------------|-------|
| Query Parameter Tracking | `RequestHandler.ts` (extracting from URL) | ⚠️ Minimal | Basic test in AgentMode.test.ts but not comprehensive |
| Header-Based Tracking | `RequestHandler.ts` (reading headers) | ⚠️ Minimal | Basic test in AgentMode.test.ts but not comprehensive |
| Pixel/Image Tracking | Unknown location | ❌ None | No dedicated tests found |
| Combined Methods | N/A | ❌ None | No tests for combined approaches |

The status.md file specifically notes: *"Verify silent tracking with query parameters"* as a remaining task.

## CDN Variation Settings

CDN Variation Settings functionality is partially tested with significant gaps:

| Aspect | Test Files | Coverage Level |
|--------|------------|----------------|
| URL Matching | `URLMatcher.test.ts`, `EdgeModePipeline.test.ts` | ✅ Good |
| Query Parameter Handling | `EdgeModePipeline.test.ts` (lines 170, 203) | ⚠️ Basic |
| Response Headers | `EdgeModePipeline.test.ts` (line 223) | ⚠️ Basic |
| Content Transformation | `ContentTransformer.test.ts` | ✅ Good |
| Caching | `CacheManager.test.ts` | ✅ Good |
| Full CDN Variation Response | Edge Mode test files | ⚠️ Basic |

## Cookie and Decision Persistence Testing

The following table outlines cookie management and decision persistence testing coverage:

| Feature | Test Type | Test Files | Coverage Level |
|---------|-----------|------------|----------------|
| Cookie Parsing | Unit | `CookieUtils.test.ts` | ✅ Complete |
| Cookie Generation | Unit | `CookieUtils.test.ts` | ✅ Complete |
| Decision Serialization | Unit | `CookieUtils.test.ts` | ✅ Complete |
| Decision Deserialization | Unit | `CookieUtils.test.ts` | ✅ Complete |
| Cookie Service (API) | Unit | `CookieService.test.ts` | ✅ Complete |
| Cookie Configuration | Unit | `CookieService.test.ts` | ✅ Complete |
| Visitor ID Extraction | Unit | `CookieService.test.ts` | ✅ Complete |
| Decision Extraction | Unit | `CookieService.test.ts` | ✅ Complete |
| Cookie Persistence | Integration | N/A | ❌ Missing |
| Decision Sticky Bucketing | Integration | N/A | ❌ Missing |
| Cookie Path/Domain Options | Integration | N/A | ❌ Missing |
| Multi-Cookie Support | Integration | N/A | ❌ Missing |

### Cookie Test Scenarios

Cookie management testing covers the following key scenarios:

1. **Cookie Parsing**:
   - Empty cookie strings
   - Single cookie
   - Multiple cookies
   - URL-encoded values
   - Malformed cookies
   - Edge cases (empty keys, missing values)

2. **Cookie Generation**:
   - Basic cookies
   - Cookies with expiration
   - Cookies with path/domain
   - Secure cookies
   - HTTP-only cookies
   - SameSite options

3. **Decision Persistence**:
   - Decision serialization/deserialization
   - Multiple decisions
   - Empty decisions
   - Malformed decision data

4. **Visitor ID Management**:
   - Visitor ID extraction
   - Visitor ID cookie creation
   - Default visitor ID generation
   - Visitor ID override

### Cookie Test Limitations

The following limitations remain in the cookie testing approach:

1. **Integration Testing Gap**: No end-to-end tests for cookie persistence across requests
2. **Browser Compatibility**: No tests for browser-specific cookie behavior
3. **Performance Testing**: No tests for cookie parsing/generation performance with large datasets
4. **Real-world Scenarios**: Missing tests for cookie interaction with CDN edge caches

## Metrics Coverage

Metrics testing is minimal and primarily focused on the metrics-test.ts file:

| Metric Type | Test Location | Status |
|-------------|---------------|--------|
| Request Metrics | `metrics-test.ts` | ⚠️ Tests request but doesn't verify metrics |
| Decision Metrics | `metrics-test.ts` | ⚠️ Tests decision but doesn't verify metrics |
| Event Tracking Metrics | `metrics-test.ts` | ⚠️ Tests tracking but doesn't verify metrics |
| Analytics Engine Integration | N/A | ❌ Not tested |

**Known Issue:** CloudflareMetricsAdapter is failing to record metrics to Analytics Engine:
```
(error) [ERROR] [CloudflareMetricsAdapter] Error recording metric 'optimizely_edge_requests_total' { error: {} }
```

## Gap Analysis

Based on the current test coverage, the following key gaps exist:

1. **Silent Tracking**: Minimal testing of tracking methods via:
   - Query parameters
   - Headers
   - Pixel/image requests
   
2. **Header-Based Configuration**: Limited testing of:
   - Request headers for configuration
   - Response headers for verification
   - Combined header + query parameter approaches
   
3. **Complex Behavior Testing**:
   - No tests combining various methods
   - Limited tests for error scenarios
   - Minimal validation of Analytics Engine integration

4. **Metrics Validation**:
   - Tests invoke endpoints but don't validate metrics recording
   - CloudflareMetricsAdapter failure not addressed in tests

5. **Cookie Integration Testing**:
   - Missing end-to-end tests for cookie persistence
   - No tests for sticky bucketing behavior
   - No tests for multiple cookies or complex configurations

## Test Execution Methods

The project provides multiple ways to run tests:

```
# Run all tests
npm test

# Run integration tests
npm run test:integration

# Run specific integration test categories
npm run test:integration -- --edge-only
npm run test:integration -- --agent-only

# Run specific test files
npx vitest run tests/utils/CookieUtils.test.ts
npx vitest run tests/services/CookieService.test.ts

# Run metrics test
npx ts-node src-v2/tests/metrics-test.ts

# Run SDK node test
npx ts-node src-v2/tests/sdk-node-test.ts
```

For live deployment testing, refer to the [Live Deployment Testing Guide](./live-deployment-testing.md) which covers:
- Setting up test environments
- Testing against real deployments
- Environment variables required
- Best practices for realistic testing 