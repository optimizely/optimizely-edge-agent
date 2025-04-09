### Prompt for AI Agent

@scope:verify
### DATE TO USE: [04-01-2025]

Plan reference: [plan-name-YYYY-MM-DD]
Current phase: [Phase name/number]
Implementation mode: [@mode:manual]

## Report directory output location
- Save the compatibility assessment report in the same directory as the technnical design document with the name: **audit-report-results.md**

**Date to use:** 03-27-2025

You are an AI agent tasked with auditing and consolidating the documentation for a software project to ensure it accurately reflects the current state of the codebase and architecture. The project includes a frontend Remix application in the `/frontend` directory and a backend NestJS server in the `/backend` directory. Your goal is to process all documentation related to architecture design, product requirements, and implementation plans, consolidate it into an accurate and cohesive set, and eliminate any outdated or redundant files.

#### Instructions

1. **Locate Documentation Files**
   - Identify all relevant documentation files, including technical design documents (TDD), product design documents (PRD), implementation plans, READMEs, and other architecture-related files.
   - Search in the all project root directories "/", "/docs", "/docs-platform", "docs-cf",  and any nested directories (e.g., `/frontend`, `/backend`) as indicated by the project structure recursively excluding node_modules directory.
   - Include all files discovered in directory listings per the provided instructions.
   - Examples of our architecture@tdd.md @ui-architecture.md @ui-specifications.md 

2. **Read and Understand Documentation**
   - Iterate through each document one by one.
   - Read the content thoroughly, following any links to related documents to ensure full coverage of interconnected information.
   - Build a comprehensive understanding of the documented architecture, requirements, and plans.
   - Design documents or documents found in the design or relevant folders contain high level architecture and designs used to create bigger implementation plans that are actually implemented and built. These may not accurately reflect the final architecture, implemented features, and actual code base.

3. **Analyze the Codebase**
   - Examine the actual codebase in the `/frontend` (Remix application) and `/backend` (NestJS server) directories.
   - Understand the current architecture, components, data flow, API designs, and implementation details.
   - You must look at all code examples, architecture patterns, folder structure in ascii format, diagrams, api, etc. and compare them against the files that are in the file system 

4. **Compare Documentation to Codebase**
   - For each document:
     - Compare its content to the codebase to identify discrepancies (e.g., outdated descriptions, missing components, or incorrect details).
     - If the document outlines a proposed implementation plan, assess its compatibility with the current architecture and note any potential integration challenges.

5. **Consolidate and Update Documentation**
   - Take the following actions based on your analysis:
     - **Update**: Modify outdated documents to align with the current codebase.
     - **Merge**: Combine documents with overlapping topics into single, comprehensive files, preserving all relevant details.
     - **Delete**: Remove documents that are no longer valid (e.g., describing removed features or obsolete plans).
   - Ensure the resulting documentation is well-organized and eliminates redundancy.

6. **Validate Final Documentation**
   - Confirm that the consolidated documentation accurately and completely represents the current codebase and true architecture.
   - Verify that no critical information is lost during consolidation.

7. **Generate a Report**
   - Produce a detailed markdown report including:
     - **Date**: 03-27-2025
     - **Summary of Actions**: List documents updated, merged, or deleted, with file paths where applicable.
     - **Discrepancies**: Highlight any differences found between the original documentation and the codebase.
     - **Compatibility Notes**: For proposed plans, indicate if they align with the current architecture or require adjustments.
     - **Recommendations**: Suggest further improvements or areas needing attention.   

#### Execution Guidelines
- Proceed systematically, processing documents sequentially and following all links.
- Be thorough in comparing documentation to code, providing specific examples (e.g., file paths, code snippets) in the report if discrepancies are found.
- If ambiguities arise (e.g., unclear document purpose or missing links), note them in the report for clarification.
- Use the Cursor editor’s capabilities to read, edit, and write files as needed.

#### Example Workflow
- Start with `@README.md` in the root, follow its links, then move to `@docs` files like TDDs or PRDs.
- Check `/frontend` and `/backend` code against a document’s architecture description.
- Merge two PRDs covering the same feature into one updated file, delete an old TDD for a removed component, and update a README with current API endpoints.
- Document all actions in the report.

Begin the task now, ensuring the final documentation is a true reflection of the codebase and architecture.

---

### Why This Prompt Works
- **Clarity**: It breaks the task into actionable steps, mirroring your request to "go one by one" and "follow links."
- **Comprehensive**: It addresses auditing (comparing to the codebase), consolidation (merging/updating), and cleanup (removing invalid files).
- **Efficient**: It leverages the AI’s ability to iterate and analyze systematically, minimizing manual oversight.
- **Aligned with Goals**: It ensures the "ultimate documentation" reflects the "true architecture," as you specified.
- **Reuses Logic**: It adapts the audit and compatibility analysis from your earlier tasks to enhance accuracy.

**Before you start make sure that yo read your instructions and tell me what rules from the AI framework are you going to be using and await confirmation before proceeding**