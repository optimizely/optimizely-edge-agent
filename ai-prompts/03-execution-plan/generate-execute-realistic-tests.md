**Subject: Generate and Execute Realistic Tests with Rigorous Debugging**

**To the AI Agent:**

Your task is to generate and execute realistic tests (Unit, Integration, API, Performance - as specified) for the target component/feature detailed below. You MUST operate under the AI Workflow Framework guidelines, focusing on validating functionality against a **live development/testing environment** and employing a structured debugging process when failures occur. **Mocking should ONLY be used for isolated unit tests when explicitly requested; the primary goal here is realistic system interaction.**

**Target & Scope (User Provided):**

*   **Component/API/Feature to Test:** `[USER: SPECIFY THE EXACT FUNCTION, CLASS, MODULE, API ENDPOINT(s), or FEATURE FLOW]`
*   **Type of Tests Required:** `[USER: SPECIFY e.g., Unit Tests, API Integration Tests, E2E Flow Tests, Basic Performance Tests]`
*   **Target Environment Base URL (for Integration/API/E2E):** `[USER: PROVIDE URL, e.g., http://localhost:3000/api, https://dev.api.example.com]`
*   **Relevant Source Code/Doc Paths:**
    *   Component Source Code: `[USER: PROVIDE PATH(s) TO THE CODE BEING TESTED]`
    *   Relevant TDD/API Documentation: `[USER: PROVIDE PATH(s) TO DESIGN DOCS OR API SPECS]`
    *   Database Schema (if relevant): `[USER: PROVIDE PATH TO prisma/schema.prisma or equivalent]`

**Mandatory Workflow:**

1.  **Framework Acknowledgment (MANDATORY FIRST STEP):**
    *   Acknowledge reading these instructions.
    *   State which framework principles/capabilities are key (e.g., "Filesystem Access for code analysis", "Structured Debugging Protocol concepts", "Adherence to testing without unnecessary mocking").
    *   **Await user confirmation** ("Acknowledged, proceed") before continuing.

2.  **Analysis & Test Planning (CRITICAL PREPARATION):**
    *   **Analyze Code & Docs:** Use filesystem access to thoroughly review the specified source code, TDD/API docs, and schema.
    *   **Define Expected Structures:** Based *only* on the codebase (DTOs, interfaces, function signatures, Prisma models) and authoritative docs, explicitly define:
        *   **Expected Request Payload Structure(s):** For API/integration tests.
        *   **Expected Response Data Structure(s)/Schema(s):** For API/integration tests.
        *   **Expected Function Arguments/Return Types:** For unit tests.
    *   **Outline Test Cases:** List the specific scenarios to test (happy paths, validation errors, boundary conditions, expected failures based on requirements).

3.  **Test Implementation:**
    *   Write test code using the project's standard testing framework/libraries (identify these from `package.json` or existing tests).
    *   **Construct Payloads/Inputs:** Create request payloads (for API/integration) or function inputs (for unit) that **strictly match the Expected Structures** defined in Step 2.
    *   **Write Assertions:** Create assertions that validate the **Expected Response Structures/Schemas** or return values defined in Step 2. For API tests, assert on status codes *and* the structure/content of the response body.

4.  **Environment & Execution:**
    *   Confirm the **Target Environment Base URL** is accessible (or state assumption it is ready).
    *   Execute the generated tests against the specified target (live environment for integration/API/E2E, local execution for unit).
    *   Capture all test output (pass/fail status, logs, error messages). If tests fail, **capture the exact request sent AND the full actual response received**.

5.  **Reporting & Debugging (Iterative Process):**
    *   **Initial Report:** Summarize the execution results (e.g., X/Y tests passed).
    *   **If ALL tests pass:** Report success and provide the final test code. Task complete.
    *   **If ANY test fails:** **Invoke the Test Debugging Protocol (below).** Do NOT stop after the first failure; attempt to run all tests initially if possible to gather more data, then debug failures systematically.

**Test Debugging Protocol (Mandatory for Failures):**

*(This adapts concepts from the main Debugging Protocol specifically for test failures)*

*   **A. Announce:** "⚠️ **Entering Test Debugging Protocol** for failed test: `[Test Name]`."
*   **B. Gather Evidence:**
    *   Identify the exact error message/assertion failure.
    *   Retrieve the **Request Payload ACTUALLY SENT** by the failing test.
    *   Retrieve the **Full Response ACTUALLY RECEIVED** (body, status code, headers) from the environment.
*   **C. Perform Comparative Analysis (CRITICAL):**
    *   **Response Comparison:** Compare the **Actual Response Received** structure/data against the **Expected Response Structure/Schema** defined in Step 2. Document specific mismatches (missing fields, wrong types, unexpected values).
    *   **Request Comparison:** Compare the **Request Payload Sent** against the **Expected Request Payload Structure** defined in Step 2 (based on API DTOs/docs). Document specific mismatches.
    *   **Test Logic Review:** Briefly re-examine the test's assertions – are they *truly* reflecting the expected outcome based on Step 2?
*   **D. Formulate Hypothesis & Propose Fix:**
    *   Based *primarily on the comparison mismatches* found in C, state a specific hypothesis (e.g., "Hypothesis: Test failed because the sent request payload is missing the required `tenantId` field identified in the API DTO.").
    *   Propose a targeted fix, usually modifying the **request payload construction** or **assertions** within the test code to align with the *actual* code/API definitions. **Avoid random iterative changes to single fields.** Focus on structural correctness based on your analysis.
    *   **Loop Prevention:** If a previous fix attempt for *this same test failure* failed, explicitly state why this new hypothesis/fix is different (e.g., "Previous attempt adjusted field X. New hypothesis focuses on structural mismatch in object Y based on comparison...").
*   **E. Implement & Re-Verify:**
    *   Apply the proposed fix to the test code.
    *   Re-run **only the failed test**.
*   **F. Evaluate Outcome:**
    *   **If Test Passes:** Announce success ("✅ Test `[Test Name]` now passes."). Log the successful fix briefly. Move to the next failed test or report completion if all pass.
    *   **If Test Fails AGAIN:** Announce failure ("❌ Fix attempt failed for test `[Test Name]`."). Log the attempt. **Return to Step B (Gather Evidence)** with the *new* failure details and repeat the comparison analysis. You MUST perform the comparison again.
    *   **If Stuck:** If you cannot resolve a failure after 2-3 *distinct, comparison-driven* attempts, clearly document the failed attempts, the final comparison results, and explicitly state: "Unable to resolve failure for test `[Test Name]` after [N] attempts based on payload comparison. Requesting human guidance."

**Final Output:**

*   Clear summary of final test results (pass/fail counts).
*   The complete, final version of the test code.
*   If failures occurred, a log of the debugging steps taken for each failed test, including the comparative analysis findings and fix attempts.
*   Explicit statement if any tests remain unresolved, requiring human guidance.