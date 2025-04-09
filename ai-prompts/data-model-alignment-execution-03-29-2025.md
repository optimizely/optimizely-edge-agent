**Objective:** Implement the "Unified Job System & Content Model Refinement" plan (Version 4.0, Date: 2025-03-29).

**AI Workflow Framework Directories to use:** @AI-workflow-Max @ai-workflow-workspace-Max and never the deprecated "AI-workflow-v2"

**Context:**
*   The implementation plan document is provided below.
*   The target codebase is the `rexearch-saas-platform` repository.
*   Assume access to the file system and necessary CLI tools (npx, git).
*   The goal is to unify asynchronous tasks, refine the data model using PostgreSQL/Prisma, leverage Cloudflare R2/Vectorize/Queues, and centralize orchestration in the NestJS backend.

**Framework Instructions:**
1.  **Mode:** Operate using `@mode:manual`. 
2.  **Plan Storage (CRITICAL - Rule 003):**
    *   Use the `create-plan.js` tool immediately to create the plan directory structure: `node AI-workflow-Maxtools/create-plan.js "Unified Job System v4.0" assisted`
    *   Place a copy of the plan provided below into the created `ai-workflow-workspace-Max/plans/plan-unified-job-system-v4-0-YYYY-MM-DD/plan.md` file.
    *   Place a copy of this prompt's context into the `ai-workflow-workspace-Max/plans/plan-unified-job-system-v4-0-YYYY-MM-DD/README.md` file (or generate a suitable README).
    *   Initialize the `ai-workflow-workspace-Max/plans/plan-unified-job-system-v4-0-YYYY-MM-DD/status.md` file.
    *   Update the central registry files (`ai-workflow-workspace-Max/registry/plan-registry.md` and `ai-workflow-workspace-Max/registry/implementation-log.md`) to reflect the new plan creation. **Confirm when this is done.**
3.  **Scope Control (CRITICAL - Rule 002):**
    *   Strictly adhere to the component changes outlined in Section 2 and the steps in Section 6 of the plan.
    *   The primary focus areas are `prisma/schema.prisma`, `rko-backend/src/`, and `cloudflare-content-core/src/workers/`. Do not modify other areas unless explicitly required by a step.
4.  **Tracking & Logging (CRITICAL - Rule 004):**
    *   Continuously update the plan's `status.md` file with the current step, overall progress percentage, and any blockers.
    *   Add entries to the central `implementation-log.md` upon completion of each *Phase* (e.g., "Completed Phase 1: Schema Foundation").
5.  **Safety Protocols (Rule 005):** Assume this is a development environment unless specified otherwise. Standard caution applies.
6.  **AI Guidance:** Refer to `AI-workflow-Maxai-guidance/` for best practices, but prioritize the specific steps in the provided plan.

**Starting Point:**
*   Begin with **Phase 1: Schema Foundation & Cleanup**.
*   Execute **Step 1.1** through **Step 1.10** sequentially as detailed in the plan.
*   Report progress after completing Step 1.10 (including the outcome of the `prisma migrate dev` command).

**Implementation Plan Document:**

---
**Implementation Plan File:** **/ai-prompts/pending-implementations/architecture-updates/data-model-alignment-plan-03-29-2025.md** 

---

**Prisma Shared Implementation: **This application shares a common prisma implementation in the root directory that is shared by the frontend and the backend components @prisma-schema 


**System Architecture:** Please read the @README.md in /docs/architecture/README.md file as it provides guidance and navigation indexes to all our documentation. Refer to this documentation before updating code, components or modifying the architecture. Referring to this documentation as necessary is critical to our success.

Please proceed with setting up the plan storage and then begin implementing Phase 1. Confirm once the plan storage and registry updates are complete before starting Step 1.1.

