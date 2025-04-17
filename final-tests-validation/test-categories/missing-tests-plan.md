# Missing Tests Implementation Plan

This document outlines the specifications for tests that still need to be created to ensure complete coverage of the Optimizely Edge Agent functionality.

## 1. Forced Variation Tests

### Test Script: forced-variation-tests.js

#### Header-Based Tests:
- Test setting variation via `X-Optimizely-Forced-Decision` header
- Test precedence when header conflicts with other sources
- Test multiple forced decisions in a single header

#### JSON Payload Tests:
- Test setting variation via `forcedDecisions` property in JSON body
- Test structure variations of the forcedDecisions object
- Test precedence when JSON conflicts with other sources

#### Query Parameter Tests:
- Test setting variation via `variation` query parameter
- Test in combination with `experiment_key` parameter
- Test precedence when query parameters conflict with other sources

## 2. Parameter Handling Tests

### Test Script: parameter-handling-tests.js

#### Query Parameter Tests:
- Test `visitor_id` parameter for user identification
- Test `flag_key` parameter for feature flag specification
- Test `sdk_key` parameter for authentication
- Test `attributes.*` parameters for visitor attributes
- Test `override_visitor_id` parameter for visitor ID override
- Test `return_decisions` parameter for decision details inclusion

#### Header Option Tests:
- Test `X-Optimizely-SDK-Key` header for authentication
- Test `X-Optimizely-User-ID` header for user identification
- Test `X-Optimizely-Attribute-*` headers for visitor attributes
- Test `X-Optimizely-Flag-Key` header for feature flag specification
- Test `X-Optimizely-Experiment-Key` header for experiment specification
- Test `X-Optimizely-Return-Decisions` header for decision details inclusion

#### JSON Payload Tests:
- Test `userId` parameter for user identification
- Test `attributes` object for visitor attributes
- Test `flagKey` parameter for feature flag specification
- Test `experimentKey` parameter for experiment specification
- Test `sdkKey` parameter for authentication
- Test `decideOptions` object for decision configuration
- Test `overrideVisitorId` parameter for visitor ID override
- Test `returnDecisions` parameter for decision details inclusion
- Test `responseCookies` parameter for cookie storage control
- Test `secureCookies` parameter for secure cookie configuration

#### Parameter Precedence Tests:
- Test precedence when same parameter is provided in multiple sources
- Test parameter combination across different sources
- Test parameter type conversion and validation

## 3. CDN Variation Tests

### Test Script Updates: cdn-variation-test.js

#### Current Issues:
- Fix "body used already" error in existing test
- Ensure proper stream handling for response bodies
- Add test for URL pattern matching
- Add test for Optimizely query parameter removal
- Add test for error recovery with fallbacks

## 4. KV Storage Tests

### Test Script: kv-storage-tests.js

#### Cache Key Tests:
- Test enhanced cache key generation
- Test cache key uniqueness
- Test cache key for different SDK configurations

#### Datafile Caching Tests:
- Test datafile caching in KV storage
- Test datafile retrieval from cache
- Test cache expiration and refresh
- Test fallback behavior when cache fails

#### Configuration Tests:
- Test configuration inheritance
- Test nested configuration options
- Test configuration override precedence

## Implementation Timeline

| Test Category | Planned Completion | Priority | Dependencies |
|---------------|-------------------|----------|--------------|
| Forced Variation Tests | Week 1 | High | None |
| Parameter Handling Tests | Week 1 | High | None |
| CDN Variation Test Fixes | Week 2 | Medium | None |
| KV Storage Tests | Week 2 | Medium | Completion of KV features |

## Progress Tracking

Implementation progress will be tracked in the [verification matrix](../../ai-workflow-workspace/plans/edge-agent-feature-parity-002/implementation-verification-matrix.md) and the [execution plan](../execution-plan.md). 