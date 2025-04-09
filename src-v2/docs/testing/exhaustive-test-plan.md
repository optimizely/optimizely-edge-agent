# Exhaustive Parameter Testing Plan

This document provides a comprehensive test matrix for validating all parameter input combinations in the Optimizely Edge Agent.

## Test Matrix Overview

The test matrix covers:
- All parameter input methods (Headers, Query parameters, JSON body)
- All parameter combinations
- Common error cases
- Precedence rules

## 1. Basic Input Method Tests

| ID | Endpoint | Method | Headers | Query Params | JSON Body | Expected Result |
|----|----------|--------|---------|--------------|-----------|----------------|
| B-01 | `/decide` | POST | All params in headers | None | None | 200 OK - Valid decision |
| B-02 | `/decide` | POST | None | All params in query | None | 200 OK - Valid decision |
| B-03 | `/decide` | POST | None | None | All params in body | 200 OK - Valid decision |
| B-04 | `/track` | POST | All params in headers | None | None | 200 OK - Success response |
| B-05 | `/track` | POST | None | All params in query | None | 200 OK - Success response |
| B-06 | `/track` | POST | None | None | All params in body | 200 OK - Success response |
| B-07 | `/track.gif` | GET | None | All params in query | None | 200 OK - 1x1 GIF |
| B-08 | `/decide-for-keys` | POST | All params in headers | None | None | 200 OK - Multiple decisions |
| B-09 | `/decide-for-keys` | POST | None | None | All params in body | 200 OK - Multiple decisions |

## 2. Parameter Precedence Tests

| ID | Endpoint | Method | Headers | Query Params | JSON Body | Expected Result |
|----|----------|--------|---------|--------------|-----------|----------------|
| P-01 | `/decide` | POST | sdkKey=valid | sdkKey=invalid | None | 200 OK - Use header sdkKey |
| P-02 | `/decide` | POST | sdkKey=valid | None | sdkKey=invalid | 200 OK - Use header sdkKey |
| P-03 | `/decide` | POST | None | sdkKey=valid | sdkKey=invalid | 200 OK - Use query sdkKey |
| P-04 | `/decide` | POST | flagKey=valid | flagKey=invalid | None | 200 OK - Use header flagKey |
| P-05 | `/decide` | POST | userId=valid | userId=invalid | None | 200 OK - Use header userId |
| P-06 | `/track` | POST | eventKey=valid | eventKey=invalid | None | 200 OK - Use header eventKey |
| P-07 | `/track` | POST | None | value=99.99 | eventTags={value: 50} | 200 OK - Use query value |

## 3. Mixed Input Source Tests

| ID | Endpoint | Method | Headers | Query Params | JSON Body | Expected Result |
|----|----------|--------|---------|--------------|-----------|----------------|
| M-01 | `/decide` | POST | sdkKey | flagKey, userId | None | 200 OK - Combined params |
| M-02 | `/decide` | POST | sdkKey, flagKey | userId | None | 200 OK - Combined params |
| M-03 | `/decide` | POST | sdkKey | None | flagKey, user | 200 OK - Combined params |
| M-04 | `/decide` | POST | None | sdkKey, flagKey | user | 200 OK - Combined params |
| M-05 | `/track` | POST | sdkKey, eventKey | None | user | 200 OK - Combined params |
| M-06 | `/track` | POST | sdkKey | eventKey, userId | eventTags | 200 OK - Combined params |
| M-07 | `/decide` | POST | X-Optimizely-Attributes | attributes param | user.attributes | 200 OK - Combined attributes |

## 4. Error Case Tests

| ID | Endpoint | Method | Headers | Query Params | JSON Body | Expected Result |
|----|----------|--------|---------|--------------|-----------|----------------|
| E-01 | `/decide` | POST | Missing sdkKey | Missing sdkKey | Missing sdkKey | 400 Bad Request |
| E-02 | `/decide` | POST | Invalid sdkKey | None | None | 404 Not Found |
| E-03 | `/decide` | POST | None | None | Invalid JSON | 400 Bad Request |
| E-04 | `/decide` | POST | sdkKey | None | Missing flagKey | 400 Bad Request |
| E-05 | `/track` | POST | Missing eventKey | None | None | 400 Bad Request |
| E-06 | `/track.gif` | GET | None | Missing sdkKey | None | 400 Bad Request |

## 5. Special Parameter Tests

| ID | Endpoint | Method | Headers | Query Params | JSON Body | Expected Result |
|----|----------|--------|---------|--------------|-----------|----------------|
| S-01 | `/decide` | POST | None | None | options=["INCLUDE_REASONS"] | 200 OK - With reasons |
| S-02 | `/decide` | POST | None | include_reasons=true | None | 200 OK - With reasons |
| S-03 | `/decide` | POST | None | None | options=["EXCLUDE_VARIABLES"] | 200 OK - No variables |
| S-04 | `/decide` | POST | None | None | Complex attributes | 200 OK - Uses attributes |
| S-05 | `/track` | POST | None | value=99.99 | None | 200 OK - Value tracked |
| S-06 | `/track` | POST | None | None | Complex eventTags | 200 OK - Tags tracked |

## 6. Header Format Tests

| ID | Endpoint | Method | Headers | Query Params | JSON Body | Expected Result |
|----|----------|--------|---------|--------------|-----------|----------------|
| H-01 | `/decide` | POST | X-Optimizely-* headers | None | None | 200 OK - Standard headers work |
| H-02 | `/decide` | POST | x-optly-* headers | None | None | 200 OK - Legacy headers work |
| H-03 | `/decide` | POST | Mixed case headers | None | None | 200 OK - Case insensitive |
| H-04 | `/decide` | POST | JSON formatted X-Optimizely-Attributes | None | None | 200 OK - Parses JSON |

## 7. Complex Combination Tests

| ID | Endpoint | Method | Headers | Query Params | JSON Body | Expected Result |
|----|----------|--------|---------|--------------|-----------|----------------|
| C-01 | `/decide` | POST | sdkKey, userId | flagKey | attributes | 200 OK - All combined |
| C-02 | `/track` | POST | sdkKey | eventKey, userId, value | eventTags | 200 OK - All combined |
| C-03 | `/decide` | POST | sdkKey, some attributes | more attributes | user with attributes | 200 OK - Merged attributes |
| C-04 | `/track.gif` | GET | X-Optimizely-SDK-Key | eventKey, userId | N/A | 200 OK - 1x1 GIF |
| C-05 | `/decide-for-keys` | POST | sdkKey | None | flagKeys=[], options=[] | 200 OK - Empty decisions |

## Implementation Plan

### Test Script Requirements

Create a `parameter-exhaustive-test.ts` script with:

1. **Parameter Generators**:
   ```typescript
   function generateHeadersOnly(params: Record<string, any>): Record<string, string> {
     // Convert parameters to X-Optimizely-* headers
   }
   
   function generateQueryOnly(params: Record<string, any>): URLSearchParams {
     // Convert parameters to URL search params
   }
   ```

2. **Test Runner**:
   ```typescript
   async function runTest(testCase: {
     id: string;
     endpoint: string;
     method: string;
     headers: Record<string, string>;
     queryParams: Record<string, string>;
     body: any;
     expectedStatus: number;
   }) {
     // Execute test and record results
   }
   ```

3. **Matrix Executor**:
   ```typescript
   async function executeTestMatrix(matrix: TestCase[]) {
     const results = [];
     for (const testCase of matrix) {
       results.push(await runTest(testCase));
     }
     return results;
   }
   ```

### Automated Testing Strategy

1. **Run Basic Tests First**:
   - Ensure each input method works in isolation
   - Exit early if basic tests fail

2. **Run Precedence Tests**:
   - Verify parameter precedence rules
   - Headers > Query Params > JSON Body

3. **Run Complex Combinations**:
   - Test all possible combinations
   - Focus on edge cases

4. **Generate Report**:
   - Output results in markdown table format
   - Include success/failure indication
   - Show detailed errors for failures

## Next Steps

1. Implement the exhaustive test script
2. Add to CI/CD pipeline
3. Create dashboard to monitor test results over time
4. Update on API changes or bug fixes 