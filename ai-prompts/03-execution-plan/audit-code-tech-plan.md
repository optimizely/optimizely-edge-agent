**Action Required: Code Audit (Technology & Plan Adherence)**

Before proceeding or marking the last step as fully complete, perform a mandatory audit of the code you just implemented. You MUST use your filesystem access to review the actual code.

**Audit Checklist:**

1.  **Technology Compliance:**
    *   Verify **NO** vanilla JavaScript was used where framework components (e.g., React) are expected.
    *   Verify **ONLY** Chakra UI version 3 components were used (or the specified UI library/version). Check imports and usage.
    *   Verify adherence to any technology constraints mentioned in the `plan.md` or `Scope Contract` (Modification Limits).
2.  **Plan Adherence:**
    *   Compare the implemented code line-by-line against the specific instructions for the relevant step(s) in the `plan.md`.
    *   Confirm no deviations occurred (e.g., extra features added, steps skipped, logic altered).
3.  **Scope Control:**
    *   Confirm that only files listed as `IN SCOPE` were modified and that `MODIFICATION LIMITS` were respected (Rule 002).

**Output Expected:**

*   Acknowledge completion of this audit.
*   Explicitly confirm: "I have audited the code changes via filesystem access. Technology constraints (Chakra UI v3, no vanilla JS) and plan instructions were followed. Scope (Rule 002) was adhered to."
*   OR, if issues were found: "Audit revealed the following discrepancies: [List specific deviations from tech constraints, plan steps, or scope]. I will now correct these issues by invoking the Debugging Protocol."