# Optimizely Edge Agent: Critical Testing Analysis

## Overview

This document tracks the ongoing analysis of the Optimizely Edge Agent codebases (original JS implementation and new TypeScript implementation) to identify feature parity issues, missing functionality, and testing gaps. It will be continuously updated as the analysis progresses.

## Current Status

**Analysis Start Date:** April 25, 2025
**Last Updated:** April 25, 2025

**Primary Concerns:**
- Feature parity issues between src/ and src-v2/ implementations
- Testing coverage gaps and lack of verification against live infrastructure
- Technical debt and potential missing functionality
- Testing against live deployments using Wrangler Dev
- Documentation inconsistencies

## Initial Project Setup

We've created a structured approach to address the critical testing needs:

1. **Project Structure**: Created a comprehensive directory structure for the critical-testing-project
2. **Documentation Framework**: Set up templates for feature parity analysis and test coverage tracking
3. **Infrastructure Testing**: Created initial infrastructure verification test script
4. **Test Runner**: Implemented Wrangler Dev integration for local testing with log capture
5. **Analysis Reports**: Established a documentation system in the `docs/` directory with numbered reports (00-XX) to maintain historical context of all findings and insights. See `docs/index.md` for the current list of available reports.

## Next Steps

Our immediate next actions are:

1. **Codebase Comparison**:
   - Analyze the original JS implementation (src/)
   - Analyze the new TypeScript implementation (src-v2/)
   - Identify key components and their functionality
   - Document API endpoints in both implementations

2. **Feature Parity Assessment**:
   - Complete the feature-parity-matrix.md with actual implementation details
   - Identify missing or partially implemented features
   - Prioritize features for testing based on critical functionality

3. **Test Suite Evaluation**:
   - Review existing test files in both codebases
   - Determine what tests can be reused vs. what needs to be created
   - Update the test-coverage-map.md with findings

4. **Implementation Path**:
   - Begin with core infrastructure tests (already created)
   - Move to API endpoint testing for key functionality
   - Develop specialized tests for identified gaps

## Codebase Comparison

### Original Implementation (src/)
- **Language**: JavaScript
- **Structure**: [To be analyzed]
- **Key Components**: [To be analyzed]
- **API Endpoints**: [To be analyzed]

### New Implementation (src-v2/)
- **Language**: TypeScript
- **Structure**: [To be analyzed]
- **Key Components**: [To be analyzed]
- **API Endpoints**: [To be analyzed]

## Feature Parity Analysis

| Feature | Original Implementation | New Implementation | Status | Notes |
|---------|------------------------|------------------|--------|-------|
| [Feature 1] | [Details] | [Details] | [Complete/Partial/Missing] | [Notes] |

## Testing Infrastructure Analysis

### Existing Test Coverage

| Test Type | Coverage | Implementation | Execution Method | Status |
|-----------|----------|----------------|-----------------|--------|
| [Test Type 1] | [What it tests] | [Files/Location] | [How it runs] | [Working/Broken/Partial] |

### Testing Gaps

[To be identified]

## Technical Debt Identification

[To be analyzed]

## Implementation Plan

# Optimizely Edge Agent: Critical Testing Analysis (Enhanced Plan)

## Enhanced Implementation Plan

This plan details the specific tasks required to achieve comprehensive feature parity testing. Tasks are designed to be prescriptive and cover the complexities of parameter handling and operational modes.

### Phase 1: Analysis & Assessment (Refined)
- [ ] Create project structure and documentation framework
- [ ] Implement initial infrastructure verification test
- [ ] Create test runner with Wrangler Dev integration
- [ ] **Task 1.1:** Complete detailed codebase comparison (src/ vs src-v2/), documenting key functions, modules, and data flows for Agent Mode (POST) and Edge Mode (GET).
- [ ] **Task 1.2:** Populate `feature-parity-matrix.md` based on Task 1.1 findings, specifically noting differences in parameter handling, caching, and `cdnVariationSettings` logic.
- [ ] **Task 1.3:** Analyze existing test coverage in both `src/` and `src-v2/`. Document findings in `test-coverage-map.md` (Existing Coverage section).
- [ ] **Task 1.4:** Identify and document specific testing gaps based on Task 1.3 and the requirements outlined in Phase 3 below. Update `test-coverage-map.md` (Required Tests section).
- [ ] **Task 1.5:** Evaluate and document potential technical debt identified during codebase comparison (Task 1.1).

### Phase 2: Testing Framework Design (Refined)
- [ ] **Task 2.1:** Design standardized test script structure for Agent Mode tests (POST requests). Template should accommodate variations in input methods (Header, Query, Body).
- [ ] **Task 2.2:** Design standardized test script structure for Edge Mode tests (GET requests). Template should accommodate testing different `cdnVariationSettings` configurations and caching scenarios.
- [ ] **Task 2.3:** Define precise verification methodology for each test category (e.g., assert status code, response body structure, specific header values, cache status headers, KV store state).
- [ ] **Task 2.4:** Define evidence collection process: Ensure `run-test-with-wrangler.js` captures sufficient logs and test script outputs are saved systematically (e.g., JSON results per test case).

### Phase 3: Test Implementation & Execution (Highly Prescriptive)

**Objective:** Develop and execute individual test scripts for *every* identified feature and parameter variation, comparing `src/` and `src-v2/` behavior against the live Wrangler Dev environment.

**Note:** Each "Test Task" below implies creating a dedicated test script (or function within a larger script) that executes the described scenario against *both* `src/` and `src-v2/` (by switching the running worker) and asserts parity or documents discrepancies.

**3.1 Agent Mode (POST Requests) - Parameter Handling & Core Logic**

*   **Parameter: `sdkKey`**
    *   [ ] **Test Task 3.1.1:** Verify `/decide` processes `sdkKey` via `X-Optimizely-SDK-Key` header. (Expected: 200 OK, valid decision)
    *   [ ] **Test Task 3.1.2:** Verify `/decide` processes `sdkKey` via `sdkKey` query parameter. (Expected: 200 OK, valid decision)
    *   [ ] **Test Task 3.1.3:** Verify `/decide` processes `sdkKey` via JSON body field. (Expected: 200 OK, valid decision)
    *   [ ] **Test Task 3.1.4:** Verify `/decide` parameter precedence for `sdkKey` (Header > Query > Body). (Expected: Header value used)
    *   [ ] **Test Task 3.1.5:** Verify `/decide` fails (400 Bad Request) if `sdkKey` is missing from all sources.
    *   [ ] **Test Task 3.1.6:** Verify `/track` processes `sdkKey` via Header, Query, Body, and precedence. (Expected: 200 OK)
    *   [ ] **Test Task 3.1.7:** Verify `/track` fails (400 Bad Request) if `sdkKey` is missing.
*   **Parameter: `userId` / `visitorId`**
    *   [ ] **Test Task 3.1.8:** Verify `/decide` processes `userId` via `X-Optimizely-User-Id` header. (Expected: 200 OK)
    *   [ ] **Test Task 3.1.9:** Verify `/decide` processes `userId` via `userId` query parameter. (Expected: 200 OK)
    *   [ ] **Test Task 3.1.10:** Verify `/decide` processes `visitorId` via `visitorId` query parameter. (Expected: 200 OK)
    *   [ ] **Test Task 3.1.11:** Verify `/decide` processes `userId` via `user.id` in JSON body. (Expected: 200 OK)
    *   [ ] **Test Task 3.1.12:** Verify `/decide` parameter precedence for `userId`/`visitorId` (Header > Query > Body). (Expected: Header value used)
    *   [ ] **Test Task 3.1.13:** Verify `/decide` fails (400 Bad Request) if `userId`/`visitorId` is missing.
    *   [ ] **Test Task 3.1.14:** Verify `/track` processes `userId`/`visitorId` via Header, Query, Body, and precedence. (Expected: 200 OK)
*   **Parameter: `flagKey` / `flagKeys`**
    *   [ ] **Test Task 3.1.15:** Verify `/decide` processes `flagKey` via `X-Optimizely-Flag-Key` header. (Expected: 200 OK, single decision)
    *   [ ] **Test Task 3.1.16:** Verify `/decide` processes `flagKey` via `flagKey` query parameter. (Expected: 200 OK, single decision)
    *   [ ] **Test Task 3.1.17:** Verify `/decide` processes `flagKey` via JSON body field. (Expected: 200 OK, single decision)
    *   [ ] **Test Task 3.1.18:** Verify `/decide-for-keys` processes `flagKeys` via JSON body field. (Expected: 200 OK, multiple decisions)
    *   [ ] **Test Task 3.1.19:** Verify `/decide-for-keys` processes `keys` via multiple query parameters. (Expected: 200 OK, multiple decisions)
    *   [ ] **Test Task 3.1.20:** Verify `/decide` fails (400 Bad Request) if `flagKey` is missing.
    *   [ ] **Test Task 3.1.21:** Verify `/decide-for-keys` fails (400 Bad Request) if `flagKeys`/`keys` are missing or invalid.
*   **Parameter: `attributes`**
    *   [ ] **Test Task 3.1.22:** Verify `/decide` processes `attributes` via `X-Optimizely-Attributes` header (JSON string). (Expected: 200 OK, decision reflects attributes)
    *   [ ] **Test Task 3.1.23:** Verify `/decide` processes `attributes` via `attributes` query parameter (URL-encoded JSON string). (Expected: 200 OK, decision reflects attributes)
    *   [ ] **Test Task 3.1.24:** Verify `/decide` processes `attributes` via `user.attributes` in JSON body. (Expected: 200 OK, decision reflects attributes)
    *   [ ] **Test Task 3.1.25:** Verify `/decide` parameter precedence for `attributes` (Header > Query > Body - need to confirm exact merge/override logic in v1). (Expected: Correct merge/override)
    *   [ ] **Test Task 3.1.26:** Verify `/track` processes `attributes` via Header, Query, Body, and precedence. (Expected: 200 OK, attributes included in tracking call)
*   **Parameter: `eventKey`**
    *   [ ] **Test Task 3.1.27:** Verify `/track` processes `eventKey` via `X-Optimizely-Event-Key` header. (Expected: 200 OK)
    *   [ ] **Test Task 3.1.28:** Verify `/track` processes `eventKey` via `eventKey` query parameter. (Expected: 200 OK)
    *   [ ] **Test Task 3.1.29:** Verify `/track` processes `eventKey` via JSON body field. (Expected: 200 OK)
    *   [ ] **Test Task 3.1.30:** Verify `/track` parameter precedence for `eventKey`. (Expected: Header value used)
    *   [ ] **Test Task 3.1.31:** Verify `/track` fails (400 Bad Request) if `eventKey` is missing.
*   **Parameter: `eventTags`**
    *   [ ] **Test Task 3.1.32:** Verify `/track` processes `eventTags` via `X-Optimizely-Event-Tags` header (JSON string). (Expected: 200 OK, tags included)
    *   [ ] **Test Task 3.1.33:** Verify `/track` processes `eventTags` via `eventTags` query parameter (URL-encoded JSON string). (Expected: 200 OK, tags included)
    *   [ ] **Test Task 3.1.34:** Verify `/track` processes `eventTags` via JSON body field. (Expected: 200 OK, tags included)
    *   [ ] **Test Task 3.1.35:** Verify `/track` parameter precedence for `eventTags`. (Expected: Correct merge/override)
*   **Parameter: `decideOptions`**
    *   [ ] **Test Task 3.1.36:** Verify `/decide` processes `decideOptions` via `X-Optimizely-Decide-Options` header (JSON array string). (Expected: 200 OK, options applied)
    *   [ ] **Test Task 3.1.37:** Verify `/decide` processes `decideOptions` via `decideOptions` query parameter (comma-separated string). (Expected: 200 OK, options applied)
    *   [ ] **Test Task 3.1.38:** Verify `/decide` processes `decideOptions` via JSON body field (array). (Expected: 200 OK, options applied)
    *   [ ] **Test Task 3.1.39:** Test specific options (`INCLUDE_REASONS`, `EXCLUDE_VARIABLES`, etc.) via each method. (Expected: Correct decision format)

**3.2 Edge Mode (GET Requests) - `cdnVariationSettings` & Core Logic**

*   **Feature: URL Matching**
    *   [ ] **Test Task 3.2.1:** Verify exact path match against `cdnExperimentURL`. (Expected: Edge Mode triggered)
    *   [ ] **Test Task 3.2.2:** Verify path match with trailing slash variations. (Expected: Edge Mode triggered)
    *   [ ] **Test Task 3.2.3:** Verify match failure for non-matching paths. (Expected: Fallback/Origin response)
    *   [ ] **Test Task 3.2.4:** Verify match with `pathRegex`. (Expected: Edge Mode triggered for regex match)
    *   [ ] **Test Task 3.2.5:** Verify match failure for non-matching regex. (Expected: Fallback/Origin response)
    *   [ ] **Test Task 3.2.6:** Verify match requires `requiredQueryParams` if specified. (Expected: Match only if params present)
    *   [ ] **Test Task 3.2.7:** Verify match ignores `ignoreQueryParams` if specified. (Expected: Match even if ignored params differ)
*   **Feature: Content Fetching & Serving**
    *   [ ] **Test Task 3.2.8:** Verify content is fetched from `cdnResponseURL` when matched. (Expected: Response body matches content at `cdnResponseURL`)
*   **Feature: Origin Forwarding**
    *   [ ] **Test Task 3.2.9:** Verify request is forwarded to origin when `forwardRequestToOrigin=true`. (Requires mock origin or inspectable endpoint). (Expected: Origin receives request)
    *   [ ] **Test Task 3.2.10:** Verify decision headers/cookies are added to forwarded request when `forwardRequestToOrigin=true`. (Expected: Origin receives Optimizely headers/cookies)
    *   [ ] **Test Task 3.2.11:** Verify request is *not* forwarded when `forwardRequestToOrigin=false`. (Expected: Response served directly or from `cdnResponseURL`)
*   **Feature: Visitor ID Handling (Edge Mode)**
    *   [ ] **Test Task 3.2.12:** Verify visitor ID is read from `optly_edge_visitor_id` cookie. (Expected: Consistent bucketing)
    *   [ ] **Test Task 3.2.13:** Verify visitor ID is read from `visitor_id` query parameter (if supported in v1). (Expected: Consistent bucketing)
    *   [ ] **Test Task 3.2.14:** Verify new visitor ID is generated and set via `Set-Cookie` if no ID present. (Expected: `Set-Cookie` header present)
*   **Feature: Audience Evaluation (Edge Mode)**
    *   [ ] **Test Task 3.2.15:** Verify audience evaluation uses attributes passed via cookies/headers (determine v1 mechanism). (Expected: Correct variation based on attributes)

**3.3 Caching Logic**

*   **Feature: Cache Key Generation**
    *   [ ] **Test Task 3.3.1:** Verify cache key generation when `cacheKey='VARIATION_KEY'` (Edge Mode). (Expected: Key includes flagKey + variationKey)
    *   [ ] **Test Task 3.3.2:** Verify cache key generation uses custom string when `cacheKey='custom_string'` (Edge Mode). (Expected: Key includes 'custom_string')
    *   [ ] **Test Task 3.3.3:** Verify cache key generation in Agent Mode (if applicable in v1). (Expected: Correct key format)
*   **Feature: Cache Behavior**
    *   [ ] **Test Task 3.3.4:** Verify cache HIT for subsequent identical requests (Edge Mode). (Expected: Cache status header indicates HIT)
    *   [ ] **Test Task 3.3.5:** Verify cache MISS for first request or expired cache (Edge Mode). (Expected: Cache status header indicates MISS)
    *   [ ] **Test Task 3.3.6:** Verify `cacheTTL` setting is respected (Edge Mode). (Requires waiting > TTL) (Expected: Cache MISS after TTL)
    *   [ ] **Test Task 3.3.7:** Verify `cacheRequestToOrigin=true` results in caching of origin response (Edge Mode). (Expected: Subsequent requests hit cache)
    *   [ ] **Test Task 3.3.8:** Verify `cacheRequestToOrigin=false` prevents caching of origin response (Edge Mode). (Expected: Subsequent requests re-fetch)
    *   [ ] **Test Task 3.3.9:** Verify `overrideCache=true` parameter bypasses cache read. (Expected: Cache status MISS even if cached)

**3.4 Administrative API Endpoints**

*   [ ] **Test Task 3.4.1:** Verify `GET /api/datafile` retrieves correct datafile. (Requires pre-loading datafile via POST or KV).
*   [ ] **Test Task 3.4.2:** Verify `POST /api/datafile` updates datafile (Requires Admin Token).
*   [ ] **Test Task 3.4.3:** Verify `GET /api/flagkeys` retrieves correct flag keys.
*   [ ] **Test Task 3.4.4:** Verify `POST /api/flagkeys` updates flag keys (Requires Admin Token).
*   [ ] **Test Task 3.4.5:** Verify `GET /api/sdk` returns correct agent info.
*   [ ] **Test Task 3.4.6:** Verify `GET /api/admin/status` requires Admin Token and returns status.
*   [ ] **Test Task 3.4.7:** Verify `POST /api/admin/cache/clear` requires Admin Token and clears cache (verify subsequent requests miss cache).

**3.5 Final Parity Sweep**

*   [ ] **Test Task 3.5.1:** Execute existing `src/` test suite (if any) against the `src-v2/` implementation.
*   [ ] **Test Task 3.5.2:** Review documented edge cases or known behaviors from `src/` and create specific tests in `src-v2/` to verify parity.

### Phase 4: Remediation & Final Verification
- [ ] **Task 4.1:** Analyze results from Phase 3 tests. Document all discrepancies and failures.
- [ ] **Task 4.2:** Prioritize and fix identified feature parity issues in `src-v2/`.
- [ ] **Task 4.3:** Implement missing functionality identified during testing.
- [ ] **Task 4.4:** Re-run all Phase 3 tests against the fixed `src-v2/` implementation.
- [ ] **Task 4.5:** Perform exploratory testing based on findings.
- [ ] **Task 4.6:** Finalize `feature-parity-matrix.md` and `test-coverage-map.md`.
- [ ] **Task 4.7:** Generate final test report with evidence.

## Findings Log

[Existing Log - Continue adding findings as tests are executed]

## Findings Log

### April 25, 2025
- Initial document created
- Project setup and structure established
- Created infrastructure verification test script
- Implemented Wrangler Dev test runner
- Created feature parity matrix template
- Created test coverage map template

[More findings will be added as analysis progresses] 