# Implementation Plan: Comprehensive Parameter Testing

## Overview

This plan outlines the implementation approach for improving parameter handling and testing in the Optimizely Edge Agent, specifically focusing on headers, query parameters, and JSON payload testing.

## Background

Our test results from `parameter-combination-test.ts` revealed several issues with the current implementation:

1. **Headers Not Being Processed Correctly**:
   - Headers with the `X-Optimizely-` prefix were not being processed
   - Only headers with the legacy `x-optly-` prefix were recognized

2. **Mixed Parameter Sources Not Working**:
   - Combinations of headers, query parameters, and JSON bodies were failing
   - Parameters from different sources were not being merged correctly

3. **Missing Endpoints**:
   - The `/track.gif` endpoint for pixel tracking was missing/broken

## Implementation Approach

### Phase 1: Fix Header Processing ✅ COMPLETED

1. **Update `getRequestConfig` Method**:
   - ✅ Modified to recognize both `X-Optimizely-` and `x-optly-` prefixes
   - ✅ Added proper parameter name conversion (e.g., `X-Optimizely-SDK-Key` → `sdkKey`)
   - ✅ Added special handling for user attributes in headers

2. **Add Debug Logging**:
   - ✅ Added detailed logging of parameter extraction from each source
   - ✅ Log the final merged configuration for debugging

### Phase 2: Add Pixel Tracking ✅ COMPLETED

1. **Implement `/track.gif` Endpoint**:
   - ✅ Added support for the endpoint in the request handler
   - ✅ Ensured it accepts the same parameters as the regular `/track` endpoint
   - ✅ Returns a proper 1x1 transparent GIF response
   - ✅ Added metrics for pixel tracking

### Phase 3: Comprehensive Testing ✅ COMPLETED

1. **Extend Test Coverage**:
   - ✅ Updated `parameter-combination-test.ts` to test all parameter combinations
   - ✅ Added tests for header precedence over query parameters and body
   - ✅ Tested pixel tracking functionality

2. **Create Documentation**:
   - ✅ Updated API documentation to clarify parameter options
   - ✅ Documented header, query parameter, and body parameter usage
   - ✅ Included examples for silent tracking methods

### Phase 4: Edge Mode Parameter Testing ⏳ IN PROGRESS

1. **Test CDN Variation Settings**:
   - ⏳ Create tests for required and ignored query parameters
   - ⏳ Test URL matching with various parameter combinations
   - ⏳ Validate header passing to origin servers

### Phase 5: Analytics Engine Integration ⏳ PLANNED

1. **Fix CloudflareMetricsAdapter**:
   - ⏳ Debug Analytics Engine binding in wrangler.toml
   - ⏳ Add detailed error logging to the adapter
   - ⏳ Identify and fix integration issues with Cloudflare

2. **Add Metrics Verification**:
   - ⏳ Create tests to verify metrics are properly recorded
   - ⏳ Add monitoring for metrics recording failures

## Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| Header Processing | ✅ Implemented | Fixed in `RequestHandler.ts` - all header tests passing |
| Pixel Tracking | ✅ Implemented | Added `/track.gif` endpoint - all pixel tracking tests passing |
| Comprehensive Testing | ✅ Implemented | All parameter combination tests now passing |
| Edge Mode Parameter Testing | 🔄 In Progress | Basic testing implemented, more needed |
| Analytics Engine Integration | 📝 Planned | CloudflareMetricsAdapter still fails to record metrics |
| Documentation Updates | ✅ Implemented | Updated all relevant test documentation |

## Next Steps

1. **Metrics Integration**:
   - Investigate why CloudflareMetricsAdapter fails to record metrics
   - Add better error handling and diagnostics
   - Test with a basic Analytics Engine example

2. **Edge Mode Testing**:
   - Create comprehensive Edge Mode test suite
   - Test CDN Variation Settings with different parameter combinations
   - Add tests for URL path parameters

3. **CI/CD Integration**:
   - Add parameter combination tests to CI/CD pipeline
   - Ensure test runs with each deployment
   - Add metrics tests to validate Analytics Engine integration

## Additional Resources

- **Parameter-combination-test.ts**: Test script for all parameter combinations
- **Parameter-test-results.md**: Detailed test results and findings
- **Status.md**: Current implementation status and next steps 