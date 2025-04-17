# Optimizely Edge Agent: Test Coverage Map

This document tracks the current test coverage and identifies gaps for the Optimizely Edge Agent implementation.

## Existing Test Coverage

| Test Category | Test File | Implementation | Status | Environment | Description |
|--------------|-----------|----------------|--------|-------------|-------------|
| [To be populated] | | | | | |

## Required Tests by Feature

### Infrastructure Validation

| Test Name | Description | Implementation Status | Priority | Dependencies |
|-----------|-------------|----------------------|----------|--------------|
| Infrastructure Verification | Basic connectivity to edge agent and verification of Cloudflare environment | | High | None |
| Environment Configuration | Validates environment variables and configuration | | High | Infrastructure Verification |

### Edge Mode Tests (GET Requests)

| Test Name | Description | Implementation Status | Priority | Dependencies |
|-----------|-------------|----------------------|----------|--------------|
| URL Matching | Tests if URLs are correctly matched against cdnExperimentURL patterns | | High | Infrastructure Verification |
| Variation Content Serving | Tests if correct variation content is served based on bucketing | | High | URL Matching |
| Caching Behavior | Tests caching behavior based on cacheKey settings | | High | Variation Content Serving |
| Response Headers | Tests if correct headers are included in responses | | Medium | URL Matching |
| Origin Forwarding | Tests forwardRequestToOrigin functionality | | Medium | URL Matching |
| Cache TTL | Tests cache time-to-live settings | | Medium | Caching Behavior |
| Error Handling | Tests error handling for edge mode | | Medium | Infrastructure Verification |

### Agent Mode Tests (POST Requests)

| Test Name | Description | Implementation Status | Priority | Dependencies |
|-----------|-------------|----------------------|----------|--------------|
| Feature Flag Decisions | Tests basic feature flag decisions | | High | Infrastructure Verification |
| Experiment Decisions | Tests experiment variation assignments | | High | Infrastructure Verification |
| Batch Decisions | Tests retrieving decisions for multiple flags | | High | Feature Flag Decisions |
| Event Tracking | Tests conversion event tracking | | High | Infrastructure Verification |
| Decision Options | Tests includeReasons, excludeVariables options | | Medium | Feature Flag Decisions |
| Error Handling | Tests error responses for agent mode | | Medium | Infrastructure Verification |

### Forced Variations Tests

| Test Name | Description | Implementation Status | Priority | Dependencies |
|-----------|-------------|----------------------|----------|--------------|
| Header-based Forced Variations | Tests setting forced variations via headers | | High | Feature Flag Decisions |
| JSON-based Forced Variations | Tests setting forced variations via JSON | | High | Feature Flag Decisions |
| Query-based Forced Variations | Tests setting forced variations via query parameters | | High | Feature Flag Decisions |
| Precedence Rules | Tests precedence when multiple forced variation methods are used | | Medium | All Forced Variation tests |
| Get/Set/Remove API | Tests the API endpoints for forced variations | | Medium | Feature Flag Decisions |

### Parameter Handling Tests

| Test Name | Description | Implementation Status | Priority | Dependencies |
|-----------|-------------|----------------------|----------|--------------|
| Query Parameter Handling | Tests extracting parameters from query strings | | High | Infrastructure Verification |
| Header Parameter Handling | Tests extracting parameters from headers | | High | Infrastructure Verification |
| JSON Body Parameter Handling | Tests extracting parameters from JSON body | | High | Infrastructure Verification |
| Parameter Precedence | Tests precedence rules when parameters appear in multiple sources | | Medium | All Parameter Handling tests |

### KV Storage Tests

| Test Name | Description | Implementation Status | Priority | Dependencies |
|-----------|-------------|----------------------|----------|--------------|
| Flag Key Storage | Tests storing and retrieving flag keys from KV | | Medium | Infrastructure Verification |
| Datafile Storage | Tests storing and retrieving the datafile from KV | | Medium | Infrastructure Verification |
| User Profile Storage | Tests user profile service with KV | | Medium | Infrastructure Verification |

### Type and Validation Tests

| Test Name | Description | Implementation Status | Priority | Dependencies |
|-----------|-------------|----------------------|----------|--------------|
| Parameter Validation | Tests validation of API parameters | | Medium | Infrastructure Verification |
| Lowercase Variation | Tests handling of "on" variations with case sensitivity | | Medium | Feature Flag Decisions |

### CDN-Specific Tests

| Test Name | Description | Implementation Status | Priority | Dependencies |
|-----------|-------------|----------------------|----------|--------------|
| Cloudflare Workers | Tests Cloudflare Workers specific functionality | | High | Infrastructure Verification |
| Vercel Edge Functions | Tests Vercel-specific functionality | | Medium | Infrastructure Verification |
| Fastly Compute@Edge | Tests Fastly-specific functionality | | Medium | Infrastructure Verification |

## Test Gaps Analysis

[To be populated as existing tests are analyzed]

## Testing Environment Requirements

### Local Testing
- **Wrangler Dev**: Local development environment with logging capability
- **Configuration**: SDK key, feature flags, experiments
- **Tools**: Necessary tools for test execution and validation

### Staging Testing
- **Deployed Edge Agent**: Testing against a staging deployment
- **Configuration**: Staging SDK key and configurations
- **Monitoring**: Access to logs and performance metrics

### Production Validation
- **Validation Approach**: Approach for production validation
- **Risk Mitigation**: Strategies to minimize risk during validation

## Implementation Priorities

1. **Phase 1**: Infrastructure verification and basic connectivity tests
2. **Phase 2**: Core functionality tests (Edge Mode and Agent Mode basics)
3. **Phase 3**: Advanced feature tests
4. **Phase 4**: Performance and reliability tests 