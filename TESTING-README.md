# API Datafile Endpoint - Comprehensive Testing Guide

## Overview

This document provides comprehensive testing for the `/api/datafile` endpoint implementation, covering all logic paths and error cases as specified in:
- `api-kv-parity-tdd.md` §6 
- `api-expected-behavior.md` §1

## Test Coverage

The test suite validates all permutations of the endpoint behavior:

### 1. Missing SDK Key Scenarios
- No SDK key in query parameters or headers
- Empty SDK key in query parameter  
- Empty SDK key in header

### 2. Explicit KV Requests (`datafileFromKV=true`)
- KV explicitly requested but KV disabled
- KV explicitly requested, KV enabled, but datafile not found
- KV explicitly requested with SDK key in header

### 3. Default Requests (No `datafileFromKV` parameter)
- Default request with KV disabled (should use CDN/default source)
- Default request with KV enabled (should try KV first, then fall back)
- Default request with invalid SDK key

### 4. SDK Key Source Variations
- SDK key in query parameter
- SDK key in header
- SDK key in both header and query (header precedence)

### 5. Special Parameter Values
- `datafileFromKV=false` (explicit false)
- `datafileFromKV=invalid` (invalid values treated as false)
- Case sensitivity test (`datafileFromKV=True`)

### 6. Error Response Validation
- JSON structure validation for error responses
- Error field presence validation

### 7. Response Metadata Validation
- Metadata field presence in successful responses
- `datafileFrom` source tracking validation

## Test Scripts

Two versions are provided:

### Bash Script (Linux/macOS)
```bash
./test-datafile-endpoint-comprehensive.sh
```

### PowerShell Script (Windows)
```powershell
.\test-datafile-endpoint-comprehensive.ps1
```

## Configuration

Both scripts accept the following parameters:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `BaseUrl` | `http://localhost:8080` | Edge Agent base URL |
| `TestSdkKey` | `test-sdk-key-123` | Test SDK key for error scenarios |
| `ValidSdkKey` | `21537940209` | Valid SDK key for success scenarios |
| `InvalidSdkKey` | `invalid-sdk-key` | Invalid SDK key for error scenarios |

### Examples

**Bash:**
```bash
# Use default configuration
./test-datafile-endpoint-comprehensive.sh

# Custom configuration
OPTIMIZELY_EDGE_AGENT_URL=https://my-edge-agent.com \
TEST_SDK_KEY=my-test-key \
VALID_SDK_KEY=12345678901 \
./test-datafile-endpoint-comprehensive.sh
```

**PowerShell:**
```powershell
# Use default configuration
.\test-datafile-endpoint-comprehensive.ps1

# Custom configuration
.\test-datafile-endpoint-comprehensive.ps1 `
  -BaseUrl "https://my-edge-agent.com" `
  -TestSdkKey "my-test-key" `
  -ValidSdkKey "12345678901"
```

## Expected Error Messages

The test suite validates exact error message content:

| Scenario | Status | Expected Error Message |
|----------|--------|------------------------|
| Missing SDK Key | 400 | `SDK key is required` |
| KV Disabled | 400 | `KV storage is not enabled for datafiles. Please enable it in configuration to use this feature.` |
| KV Missing Data | 404 | `Datafile not found in KV storage for the provided SDK key.` |
| Invalid SDK Key | 404 | `Datafile not found for the provided SDK key.` |

## Response Structure Validation

### Success Response
```json
{
  "version": "4",
  "projectId": "21537940209",
  "experiments": [...],
  "groups": [...],
  "metadata": {
    "datafileFrom": "cdn|kv"
  }
}
```

### Error Response
```json
{
  "error": "Error message text"
}
```

## Test Results Interpretation

### Test Output Format
Each test displays:
- Test description
- HTTP method and URL
- Status code (expected vs actual)
- Response body
- Pass/Fail result with explanation

### Example Test Output
```
[INFO] Testing: Missing SDK key (no query param, no header)
[INFO] GET http://localhost:8080/api/datafile
  Status Code: 400
  Response Body: {"error":"SDK key is required"}
[PASS] Status code matches expected (400)
[PASS] Error message contains expected text: 'SDK key is required'
```

### Summary Report
```
==========================================
TEST RESULTS SUMMARY
==========================================
Total Tests: 19
Passed: 19
Failed: 0
[PASS] ALL TESTS PASSED!
```

## Implementation Verification

This test suite validates the implementation against the following requirements:

### Core Logic Paths
1. **Explicit KV Request Logic**: When `datafileFromKV=true` is present, the system should only use KV storage and not fall back to other sources
2. **Configuration-Driven Logic**: When no explicit request is made, the system should respect the KV enabled/disabled configuration
3. **Fallback Behavior**: When KV is enabled but data is missing, the system should fall back to CDN/default source
4. **Error Handling**: All error scenarios should return appropriate HTTP status codes and clear error messages

### Error Message Compliance
All error messages must match the exact text specified in the expected behavior guide:
- No silent failures or fallbacks when explicit KV is requested but unavailable
- Clear, actionable error messages for all failure cases
- Consistent JSON error response structure

### Metadata Tracking
Success responses should include metadata indicating the source of the datafile:
- `metadata.datafileFrom: "cdn"` for CDN sources
- `metadata.datafileFrom: "kv"` for KV storage sources

## Troubleshooting

### Common Issues

1. **Connection Refused**: Ensure the Edge Agent is running on the specified URL
2. **Invalid SSL**: Use HTTP instead of HTTPS for local testing, or configure SSL properly
3. **SDK Key Issues**: Ensure you have valid SDK keys for testing success scenarios
4. **KV Configuration**: Some tests require KV storage to be properly configured

### Debug Mode

To enable verbose output, modify the scripts to include additional debugging:

**Bash:**
```bash
set -x  # Enable debug mode
```

**PowerShell:**
```powershell
$VerbosePreference = "Continue"
```

### Manual Testing

You can also run individual tests manually using curl:

```bash
# Test missing SDK key
curl -v http://localhost:8080/api/datafile

# Test explicit KV request
curl -v "http://localhost:8080/api/datafile?sdkKey=test-key&datafileFromKV=true"

# Test success scenario
curl -v "http://localhost:8080/api/datafile?sdkKey=21537940209"
```

## Integration with CI/CD

The test scripts return appropriate exit codes:
- `0`: All tests passed
- `1`: One or more tests failed

This makes them suitable for CI/CD pipeline integration:

```yaml
# Example GitHub Actions step
- name: Test API Datafile Endpoint
  run: |
    chmod +x test-datafile-endpoint-comprehensive.sh
    ./test-datafile-endpoint-comprehensive.sh
```

## Verification Criteria

This test suite fulfills the verification criteria for Task T6:

✅ **All permutations in expected behavior guide are tested**
- Missing SDK key scenarios (3 tests)
- Explicit KV requests with various states (3 tests)  
- Default requests with various configurations (3 tests)
- SDK key source variations (3 tests)
- Special parameter values (3 tests)
- Response validation (4 tests)

✅ **Error messages match those specified in the guide**
- Exact text matching for all specified error messages
- Proper HTTP status codes for all scenarios
- JSON structure validation for all responses 