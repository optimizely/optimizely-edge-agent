## Documentation Output Requirements (for AI Auditor)

1.  **Structured Report Generation**: Upon completing the entire audit plan, you MUST generate a comprehensive and structured report detailing your findings.
2.  **Output Location**: All generated documentation MUST be placed within the following directory structure:
    ```
    docs-revised/analysis/gemini-04-18-2025/
    ```
3.  **Required Files & Structure**:
    *   **`README.md`**: This file will serve as the main entry point for your report. It should include:
        *   A brief overview of the audit's scope and objective (validating the prior analysis of `src-v2/`).
        *   A link to the detailed report file (`validation_remediation_report.md`).
        *   A high-level executive summary of the most critical validated findings (e.g., confirmed gaps, refuted issues).
        *   "Last Updated" timestamp.
    *   **`validation_remediation_report.md`**: This is the main detailed report file. It MUST be structured logically, following the sequence of the **Detailed Audit Plan** provided in the main prompt. It should contain the following sections:
        *   **Introduction:** Briefly restate the audit scope and methodology.
        *   **Executive Summary:** Summarize the key validated findings, highlighting critical gaps confirmed in `src-v2/` and any significant refutations of the prior analysis.
        *   **Detailed Validation Findings:** This section should follow the steps of the audit plan. For *each* item/finding validated:
            *   **Finding from Prior Analysis:** Clearly state the finding being validated (copied from `prior_analysis.txt`).
            *   **Code Location(s) Examined:** List the specific `src-v2/` file(s) and relevant functions/lines analyzed.
            *   **Validation Result:** Use one of the following statuses: `CONFIRMED`, `REFUTED`, `PARTIALLY CONFIRMED/REFUTED`, `NEEDS REFINEMENT`.
            *   **Evidence & Explanation:** Provide **concrete evidence from the code** to support your validation result. Explain *why* the finding is confirmed or refuted, referencing specific code logic, function calls, or the absence thereof. This is the most critical part.
        *   **Detailed Remediation Assessment:** For *each* finding validated as `CONFIRMED` (representing a gap or issue):
            *   **Issue:** Briefly restate the confirmed problem.
            *   **Suggested Remediation Approach:** Describe the high-level technical steps or architectural changes needed within the `src-v2/` codebase to address the issue.
            *   **Estimated Complexity:** Assign a relative complexity (e.g., Low, Medium, High) based on the perceived effort and scope of changes required.
4.  **Reporting Format**:
    *   Use clear, concise language suitable for both technical and semi-technical audiences.
    *   Use standard Markdown formatting (headings, lists, bolding, etc.).
    *   Use code blocks (```typescript ... ```) when referencing specific snippets as evidence.
    *   Include Mermaid diagrams (```mermaid ... ```) *only if* they significantly clarify complex validated flows or proposed remediation architectures.
    *   Ensure all statements about the code's behavior are factual and directly supported by your analysis. Avoid speculation.
5.  **Completion**: The final report should be generated *after* all steps in the Detailed Audit Plan have been executed, ensuring comprehensive coverage.

Please confirm you understand these **reporting requirements** before proceeding with the audit tasks outlined in the main prompt and the Detailed Audit Plan. Your final deliverable will be the structured content for `README.md` and `validation_remediation_report.md` within the specified directory.