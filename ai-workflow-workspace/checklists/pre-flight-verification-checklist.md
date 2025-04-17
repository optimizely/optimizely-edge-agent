---
type: checklist
description: "Pre-flight verification checklist for test execution against live infrastructure"
lastUpdated: "2023-10-31"
status: "Active"
---

# Pre-Flight Verification Checklist

## Purpose

This checklist verifies that all required conditions are met before executing tests against the live Cloudflare Worker infrastructure, ensuring safe and reliable test execution.

## Application Requirements

- **When to use**: Before any test execution against live infrastructure
- **Applicable Modes**: @mode:manual, @mode:semi
- **Verification Requirement**: Human review required for @mode:manual

## Checklist Items

### Environment Validation

- [ ] **ENV.1. Environment Variables Configured** [MANDATORY]
  - ENV.1.1. EDGE_AGENT_URL is set to a valid Cloudflare Worker URL
  - ENV.1.2. SDK_KEY is set to a valid SDK key
  - ENV.1.3. Required feature/experiment keys are configured
  - ENV.1.4. Additional required environment variables are set

- [ ] **ENV.2. Connection Verification** [MANDATORY]
  - ENV.2.1. Basic HTTP connection to EDGE_AGENT_URL succeeds
  - ENV.2.2. Response contains expected Cloudflare headers
  - ENV.2.3. Service responds with appropriate status code

### Test Script Validation

- [ ] **TST.1. Test Script Integrity** [MANDATORY]
  - TST.1.1. Test script exists and has not been modified (hash verification)
  - TST.1.2. Test script dependencies are available
  - TST.1.3. Test script has logging mechanisms enabled

- [ ] **TST.2. Test Script Configuration** [MANDATORY]
  - TST.2.1. Test is correctly configured for live environment
  - TST.2.2. Test has appropriate timeouts and retries configured
  - TST.2.3. Test has appropriate rate limiting

### Evidence Collection Setup

- [ ] **EVD.1. Logging Configuration** [MANDATORY]
  - EVD.1.1. Log directory exists and is writable
  - EVD.1.2. Log format includes test ID, timestamp, and execution context
  - EVD.1.3. Request/response capture is enabled

- [ ] **EVD.2. Artifact Storage** [MANDATORY]
  - EVD.2.1. Artifact storage location exists and is writable
  - EVD.2.2. Storage has sufficient space for test artifacts
  - EVD.2.3. Naming convention established for artifacts

### Risk Assessment

- [ ] **RSK.1. Test Impact Assessment** [MANDATORY]
  - RSK.1.1. Test is non-destructive to production data
  - RSK.1.2. Test rate limits are appropriate for production
  - RSK.1.3. Test failure modes are documented

- [ ] **RSK.2. Rollback Preparation** [CRITICAL]
  - RSK.2.1. Abort procedure is documented
  - RSK.2.2. Recovery steps are documented if test affects state
  - RSK.2.3. Monitoring is in place to detect issues

## Mode-Specific Guidance

Refer to **Rule 125** for mode-specific requirements on detail, verification depth, and documentation for completing this checklist.

## Integration

Typically applied during Rule/Phase: Rule 450 / Phase 4 (Implementation) 