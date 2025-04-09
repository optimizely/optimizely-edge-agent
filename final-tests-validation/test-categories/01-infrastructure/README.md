# Infrastructure Verification Tests

This directory contains detailed test specifications for verifying the basic infrastructure and connectivity of the Optimizely Edge Agent. These tests validate that the Edge Agent is correctly deployed and accessible before proceeding with more complex functional tests.

## Test Objectives

1. **Basic Connectivity**
   - Verify HTTP/HTTPS response from deployment URL
   - Confirm Cloudflare headers are present (cf-ray ID)
   - Verify response timing is consistent with edge deployment

2. **SDK Key Validation**
   - Verify test SDK key is accepted
   - Verify invalid SDK key is rejected
   - Confirm SDK key environment binding is working

3. **Environment Variable Resolution**
   - Verify environment variables are properly resolved
   - Test fallback behavior when variables are not set

## Test Script

The primary test script for infrastructure verification is `infrastructure-verification.js`. This script:

- Makes requests to the Edge Agent endpoint
- Verifies Cloudflare-specific headers
- Tests valid and invalid SDK keys
- Documents environment variable usage

## Evidence Collection

Infrastructure verification tests collect the following evidence:

- Response headers (including Cloudflare-specific headers)
- Response status codes
- Response body samples
- Environment variable resolution details

## Related Configuration

The infrastructure verification tests use configuration from:

- `infrastructure-config.md`: URLs, SDK keys
- Environment variables: EDGE_AGENT_URL, SDK_KEY

## Success Criteria

Infrastructure verification tests pass when:

- The Edge Agent returns a successful response code
- Cloudflare headers are present in the response
- The valid SDK key is accepted
- The invalid SDK key is rejected

## Related Test Categories

- **02-decision-service/**: Depends on successful infrastructure verification
- **03-cdn-variations/**: Depends on successful infrastructure verification

## Implementation Notes

These tests are the first that should be run in any test cycle, as all other tests depend on successful infrastructure verification. 