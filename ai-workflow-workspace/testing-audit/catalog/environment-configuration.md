---
type: documentation
description: "Environment configuration requirements for Edge Agent testing"
lastUpdated: "2023-10-31"
status: "Active"
planId: "testing-audit-reconciliation-04-10-2025"
---

# Environment Configuration Requirements

This document identifies and validates all environment configuration requirements for test execution against the live Cloudflare Workers infrastructure.

## Environment Variables

Based on analysis of the test scripts, the following environment variables are required for test execution:

| Variable | Purpose | Default Value | Required By | Format |
|----------|---------|---------------|------------|--------|
| `EDGE_AGENT_URL` | URL of the Edge Agent deployment | https://edge-agent-test.expedge.workers.dev | All test scripts | URL string |
| `SDK_KEY` | SDK key for testing | 8mR1pGh8u2ztUP8GqjmQq | All test scripts | String |
| `FEATURE_KEYS` | Feature flags to test | test-flag,homepage-test,product-test | forced-variation-tests.js, feature-parity-test.js | Comma-separated list |
| `EXPERIMENT_KEYS` | Experiments to test | ab-test-1,feature-test-1 | forced-variation-tests.js, feature-parity-test.js | Comma-separated list |
| `LOG_LEVEL` | Logging detail level | info | All test scripts (optional) | String: debug, info, warn, error |
| `RUN_ONLY` | Run only specific test group | N/A | run-all-tests.js (optional) | Number or comma-separated numbers |

## Cloudflare Worker Deployment

According to `infrastructure-config.md` and script defaults, the primary testing endpoint is:

```
https://edge-agent-test.expedge.workers.dev
```

### Validation Status: ⚠️ REQUIRES VERIFICATION

The URL needs to be verified as a valid and accessible Cloudflare Workers deployment. This will be done in the Testing Infrastructure Setup phase (M2).

## SDK Key Validation

According to `infrastructure-config.md` and script defaults, the primary test SDK key is:

```
8mR1pGh8u2ztUP8GqjmQq
```

### Validation Status: ⚠️ REQUIRES VERIFICATION

The SDK key needs to be verified as valid and containing the necessary feature flags and experiments. This will be done in the Testing Infrastructure Setup phase (M2).

## Feature and Experiment Requirements

The tests expect specific feature flags and experiments to be configured in the Optimizely project associated with the SDK key:

### Feature Flags

| Flag Key | Description | Usage |
|----------|-------------|-------|
| `test-flag` | Simple boolean flag | Basic testing |
| `homepage-test` | Flag with audience targeting | Audience rule testing |
| `product-test` | Flag with attribute-based targeting | Attribute-based testing |

### Experiments

| Experiment Key | Description | Usage |
|----------------|-------------|-------|
| `ab-test-1` | A/B test with two variations | Basic experiment testing |
| `feature-test-1` | Feature test with multiple variations | Multi-variation testing |

### Validation Status: ⚠️ REQUIRES VERIFICATION

These keys need to be verified as existing in the Optimizely project associated with the SDK key. This will be done in the Testing Infrastructure Setup phase (M2).

## CDN Variation Settings

The `cdn-variation-test.js` script requires specific CDN variation settings to be configured in the Optimizely project. These settings include:

1. Trusted origins configuration (`cdnTrustedOrigins` array)
2. Experiment-specific CDN settings (`cdnExperimentSettings` array)
3. Variation-specific settings for each experiment

### Validation Status: ⚠️ REQUIRES VERIFICATION

These settings need to be verified as correctly configured in the Optimizely project. This will be done in the Testing Infrastructure Setup phase (M2).

## KV Storage Requirements

The `kv-storage-tests.js` script tests interaction with Cloudflare KV namespaces:

| KV Namespace | Purpose | Access Pattern |
|--------------|---------|----------------|
| `TEST_OPTIMIZELY_DATAFILES` | Stores datafiles by SDK key | Read access needed |
| `TEST_OPTIMIZELY_FLAGS` | Stores flag settings | Read/write access needed |
| `TEST_OPTIMIZELY_CACHE` | Stores cache entries | Read/write access needed |

### Validation Status: ⚠️ REQUIRES VERIFICATION

The existence and accessibility of these KV namespaces needs to be verified. This will be done in the Testing Infrastructure Setup phase (M2).

## Test Origin Requirements

For testing origin request forwarding, the following endpoints are used:

| Path | Origin | Purpose |
|------|--------|---------|
| `/edge-test/forward` | https://httpbin.org/get | Returns request info |
| `/edge-test/headers` | https://httpbin.org/headers | Tests header forwarding |
| `/edge-test/html` | https://example.com | HTML content transformation |

### Validation Status: ✅ VERIFIED

These public endpoints are accessible and suitable for testing.

## Environment Setup Commands

To configure the testing environment, the following commands should be used:

### For Bash/Linux/macOS:

```bash
export EDGE_AGENT_URL=https://edge-agent-test.expedge.workers.dev
export SDK_KEY=8mR1pGh8u2ztUP8GqjmQq
export FEATURE_KEYS=test-flag,homepage-test,product-test
export EXPERIMENT_KEYS=ab-test-1,feature-test-1
export LOG_LEVEL=debug  # Optional, for more detailed logging
```

### For Windows Command Prompt:

```cmd
set EDGE_AGENT_URL=https://edge-agent-test.expedge.workers.dev
set SDK_KEY=8mR1pGh8u2ztUP8GqjmQq
set FEATURE_KEYS=test-flag,homepage-test,product-test
set EXPERIMENT_KEYS=ab-test-1,feature-test-1
set LOG_LEVEL=debug
```

### For Windows PowerShell:

```powershell
$env:EDGE_AGENT_URL = "https://edge-agent-test.expedge.workers.dev"
$env:SDK_KEY = "8mR1pGh8u2ztUP8GqjmQq"
$env:FEATURE_KEYS = "test-flag,homepage-test,product-test"
$env:EXPERIMENT_KEYS = "ab-test-1,feature-test-1"
$env:LOG_LEVEL = "debug"
```

## Next Steps

1. Verify the accessibility of the Cloudflare Worker deployment
2. Validate the SDK key and its associated configuration
3. Confirm the existence of required feature flags and experiments
4. Verify the CDN variation settings configuration
5. Validate access to the KV namespaces 