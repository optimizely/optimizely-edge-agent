---
type: template
description: "Template for individual test verification criteria"
lastUpdated: "2023-10-31"
status: "Active"
planId: "testing-audit-reconciliation-04-10-2025"
---

# Individual Test Verification Criteria: [TEST_NAME]

## Test Identification

- **Test File**: `[TEST_FILENAME].js`
- **Purpose**: [TEST_PURPOSE]
- **Dependencies**: [LIST_OF_DEPENDENCIES]
- **Required Before**: [LIST_OF_DEPENDENT_TESTS]

## Test Categories and Focus Areas

- **Category**: [TEST_CATEGORY]
- **Focus Areas**:
  - [FOCUS_AREA_1]
  - [FOCUS_AREA_2]
  - [FOCUS_AREA_3]

## Required Evidence

### 1. HTTP Transaction Evidence

- [ ] Complete request headers for each API call
- [ ] Complete response headers for each API call
- [ ] Request body content (if applicable)
- [ ] Response body content
- [ ] HTTP status codes
- [ ] Request/response timing information
- [ ] Cloudflare-specific headers (cf-ray, cf-cache-status)

### 2. Test Execution Evidence

- [ ] Test initialization log
- [ ] Step-by-step execution log
- [ ] Verification point logs
- [ ] Completion status log
- [ ] Total execution time
- [ ] System information at time of execution
- [ ] Error logs (if applicable)

### 3. Assertion Evidence

- [ ] Expected vs. actual values for each assertion
- [ ] Assertion results (pass/fail)
- [ ] Context information for assertions
- [ ] Stack traces for failures (if applicable)

### 4. Test-Specific Evidence

- [ ] [TEST_SPECIFIC_EVIDENCE_1]
- [ ] [TEST_SPECIFIC_EVIDENCE_2]
- [ ] [TEST_SPECIFIC_EVIDENCE_3]

## Pass Criteria

### 1. Connectivity Requirements

- [ ] Edge Agent URL must be accessible
- [ ] Responses must be received within timeout limits
- [ ] Responses must contain Cloudflare cf-ray headers
- [ ] Response status codes must be appropriate for the request

### 2. Functional Requirements

- [ ] [FUNCTIONAL_REQUIREMENT_1]
- [ ] [FUNCTIONAL_REQUIREMENT_2]
- [ ] [FUNCTIONAL_REQUIREMENT_3]

### 3. Data Requirements

- [ ] [DATA_REQUIREMENT_1]
- [ ] [DATA_REQUIREMENT_2]
- [ ] [DATA_REQUIREMENT_3]

### 4. Performance Requirements

- [ ] [PERFORMANCE_REQUIREMENT_1]
- [ ] [PERFORMANCE_REQUIREMENT_2]
- [ ] [PERFORMANCE_REQUIREMENT_3]

## Verification Methods

### 1. Automated Verification

The following automated verification methods will be used:

- [ ] HTTP response validation against schema
- [ ] Cloudflare header verification
- [ ] Assertion result verification
- [ ] Timing verification
- [ ] Data integrity verification
- [ ] [TEST_SPECIFIC_AUTOMATED_VERIFICATION]

### 2. Manual Verification

The following aspects require manual verification:

- [ ] [MANUAL_VERIFICATION_POINT_1]
- [ ] [MANUAL_VERIFICATION_POINT_2]
- [ ] [MANUAL_VERIFICATION_POINT_3]

## Verification Workflow

1. **Pre-Execution Verification**:
   - Verify test environment setup
   - Verify dependencies have been successfully executed
   - Verify input parameters are valid

2. **Execution Verification**:
   - Verify test initialization
   - Verify step-by-step execution
   - Verify evidence collection
   - Verify completion status

3. **Post-Execution Verification**:
   - Verify all required evidence is collected
   - Verify all assertions passed
   - Verify test result is properly documented
   - Verify manifest is generated and signed

## Result Documentation Requirements

The test result document must include:

- [ ] Test summary with pass/fail status
- [ ] Detailed breakdown of test steps and results
- [ ] Evidence references with file paths
- [ ] Assertion summary
- [ ] Performance metrics
- [ ] Environment information
- [ ] Timestamps in UTC ISO-8601 format
- [ ] Cryptographic signature of the test result

## Common Issues and Resolution

| Issue | Symptoms | Resolution |
|-------|----------|------------|
| [COMMON_ISSUE_1] | [SYMPTOMS_1] | [RESOLUTION_1] |
| [COMMON_ISSUE_2] | [SYMPTOMS_2] | [RESOLUTION_2] |
| [COMMON_ISSUE_3] | [SYMPTOMS_3] | [RESOLUTION_3] |

## Reporting Requirements

The test verification report must include:

- [ ] Verification summary
- [ ] Evidence verification results
- [ ] Assertion verification results
- [ ] Discrepancy details (if any)
- [ ] Remediation recommendations (if applicable)
- [ ] Verification status (PASS/FAIL)

---

This verification criteria document establishes the standards for verifying the execution and results of the [TEST_NAME] test. All verification activities must adhere to these criteria to ensure the integrity, reliability, and validity of the test results. 