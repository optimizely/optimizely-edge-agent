**Subject: Audit, Consolidate, and Update Project Documentation**

**Date to use on all documentation:** [2025-04-02]

**To the AI Agent:**

Your objective is to create an **Authoritative Documentation Set** for this project. This requires auditing all specified project documentation against the current codebase, consolidating overlapping information, updating inaccuracies, removing obsolete files, and generating a detailed report of your actions and findings. You will operate under the AI Workflow Framework guidelines.

**Mandatory Inputs & Analysis Sources:**

1.  **Documentation Search Paths (User Provided):**
    **Existing Documentation Index:** Located at: `[docs/index.md]`
    **Existing System Architecture Document:** Located at: `[docs/architecture/system-architecture.md]`
    **Existing Project README:** Located at: `[docs/architecture/README.md]`
    **Existing Database Schema:** Located at: `[packages/prisma-schema/schema.prisma]`
    **Existing Shared Prisma ORM Usage Readme:** Located at: `[packages/prisma-schema/README.md]`
    *   *(Note: You will search these paths recursively, excluding `node_modules` and similar build/dependency directories).*
2.  **Codebase Source Directories (Standard):**
    *   `/frontend` (Remix Application)
    *   `/backend` (NestJS Server)
    *   `/cloudflare` (Cloudflare Queue)
3.  **Your Filesystem Access Capability:** You MUST use your filesystem access extensively to locate documents and analyze the actual code.

**Required Audit & Consolidation Steps:**

1.  **Framework Acknowledgment (MANDATORY FIRST STEP):**
    *   Before starting the audit, acknowledge you have read these instructions.
    *   Briefly state which core principles or capabilities defined in your primary instructions (`AI-workflow-Max/custom-dev-agent-instructions.md`) are most relevant to this task (e.g., "Filesystem Access capability is critical for code analysis and document access," "Core Principle of clear communication is needed for the report").
    *   **Await user confirmation** (e.g., "Acknowledged, proceed") before starting Step 2.

2.  **Locate Documentation Files:**
    *   Recursively search the specified **Documentation Search Paths**.
    *   Identify all potential documentation files (READMEs, `.md`, potentially others based on project conventions). Prioritize files matching names like `TDD`, `architecture`, `PRD`, `plan`, `specifications`, `README`.
    *   Compile a list of candidate file paths found.

3.  **Analyze & Categorize Documents:**
    *   Iterate through the discovered documents one by one.
    *   Read and understand the content, following relative links within the documentation set.
    *   Categorize each document's likely purpose (e.g., High-Level Architecture, Feature Requirement (PRD), Technical Design (TDD), Implementation Plan Draft, Component README, Obsolete). Recognize that design documents might represent initial ideas, not the final implementation.

4.  **Analyze Codebase:**
    *   Thoroughly examine the code within the specified **Codebase Source Directories** (`/frontend`, `/backend`).
    *   Use your **filesystem access** to understand the *actual*:
        *   Directory structure and module organization.
        *   Implemented architecture patterns.
        *   Key component implementations (frontend UI, backend services/controllers).
        *   Data flow and API contracts (routes, DTOs, service methods).
        *   Database schema (`prisma.schema` or equivalent).
        *   Configuration methods.

5.  **Compare Documentation to Codebase (Identify Discrepancies):**
    *   For each relevant document identified in Step 3:
        *   Systematically compare its descriptions, diagrams, API contracts, data models, and architectural assertions against the findings from your codebase analysis (Step 4).
        *   Note specific discrepancies: outdated information, missing features described in docs, features in code not in docs, incorrect diagrams, mismatched API signatures, etc.
        *   For documents identified as potential *implementation plans*, assess their high-level compatibility with the *current* codebase structure and architecture. Note major conflicts or required adaptations.

6.  **Consolidate & Update Documentation (Create Authoritative Set):**
    *   Based on the comparison (Step 5), take corrective actions using your **filesystem access**:
        *   **Update:** Modify existing documents containing inaccuracies to reflect the current state of the codebase. Prioritize updating core architecture docs and widely referenced READMEs.
        *   **Merge:** If multiple documents cover the same topic redundantly or partially, merge their relevant, *accurate* content into a single, authoritative document (choose the best existing file or create a new one logically named). Ensure no critical, accurate information is lost.
        *   **Delete:** Remove documents confirmed to be entirely obsolete (e.g., describing removed features, superseded designs, invalid plans). Be cautious; if unsure, mark for review instead of deleting.
    *   Organize the resulting documentation logically within the documentation directories.

7.  **Validate Final Documentation Set:**
    *   Briefly review the modified/consolidated documentation set to ensure it presents a cohesive and accurate picture of the current system, as reflected in the code.

8.  **Generate Audit Report:**
    *   Create a detailed report in Markdown format.
    *   **Output Location:** `[USER: SPECIFY OUTPUT PATH FOR REPORT, e.g., "/docs/audit-report-YYYY-MM-DD.md"]` (Use current date unless specified otherwise: `[DATE TO USE: YYYY-MM-DD]`)
    *   **Report Content:**
        *   **Date:** [Use specified date]
        *   **Scope:** List the documentation paths searched and codebase directories analyzed.
        *   **Summary of Actions:** Detail which files were `Updated`, `Merged` (specify source/target), or `Deleted`. Include full paths.
        *   **Key Discrepancies Found:** Bulleted list highlighting significant differences discovered between original docs and the actual codebase (provide specific examples/paths where possible).
        *   **Implementation Plan Compatibility Notes:** Summarize findings on the compatibility of any audited plan documents with the current architecture.
        *   **Consolidation Decisions:** Briefly explain the rationale for key merge/delete decisions.
        *   **Recommendations:** Suggest any further documentation cleanup, areas needing clarification, or potential new documentation needed.

**Execution Guidelines:**

*   Proceed systematically. Log actions mentally or briefly in chat if helpful during the process.
*   Be thorough in code analysis and comparison. Use specific file paths/names in your report.
*   If significant ambiguities are found (e.g., unable to determine a document's relevance or purpose), note them clearly in the "Recommendations" section of the report.
*   You have permission to read, write, and delete files within the specified documentation paths as needed to perform the consolidation. Be careful with deletions.
