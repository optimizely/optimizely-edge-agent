---
type: "documentation"
purpose: "plans-guidance"
version: "2.2"
status: "Active"
description: "Guidance on implementation plan structure, location, core artifacts, naming conventions, the example skeleton, and optional central tracking files within this directory."
ai_instructions: "Reference this document for guidance on AI Workflow plan structure, the purpose of the example skeleton, and where actual plans should be created."
ai_usage_context: "Use when explaining plan creation, structure, or the contents of the docs/guides/plans/ directory."
related_files: [
  "../../README.md",
  "../../../framework-rules/100-implementation-process.md",
  "../../../framework-rules/150-implementation-state-management.md",
  "./plan-registry.md",
  "./implementation-log.md",
  "./example-plan-skeleton/README.md"
]
directory_purpose: "This directory (docs/guides/plans/) provides guidance on implementation plans, houses an example skeleton structure, and contains optional central tracking files (registry, log). Actual plans reside in ai-workflow-workspace/plans/."
tags: ["plans", "implementation", "framework", "documentation", "rule-100", "guides", "skeleton"]
priority: "medium"
audience: {
  "primary": "both AI assistants and developers",
  "technical_level": "all levels",
  "roles": ["developers", "project managers", "ai assistants", "technical leads"]
}
dateCreated: "2025-03-19"
lastUpdated: "2025-03-31"
---

# Implementation Plan Guidance

This document provides guidance on how implementation plans are structured, created, and managed within the AI Workflow framework.

## Overview

Implementation plans are central to tracking and executing tasks using the AI Workflow framework. They ensure a structured approach, defining scope, tasks, and verification according to the framework's process (Rule 100).

**Key Distinction:** This directory (`docs/guides/plans/`) contains *guidance*, an *example skeleton*, and *optional central tracking* files. The actual operational plan directories created during implementations reside in the user's workspace at `ai-workflow-workspace/plans/`.

## Plan Storage and Structure (Rule 100, Phase 3: Preparation)

**CRITICAL: All implementation activities MUST be managed within a dedicated plan directory located in `ai-workflow-workspace/plans/`.**

As defined in **Rule 100 (Implementation Process)**, during the **Preparation Phase**, the AI assistant MUST:
1.  Determine or be assigned a **Unique Plan ID** (e.g., `[plan-name]-[timestamp/sequence]`).
2.  Create a dedicated plan directory within the **workspace**: `ai-workflow-workspace/plans/[unique-plan-id]/`
3.  Populate this directory with essential artifacts, using the structure provided in the `example-plan-skeleton` (see below) as a template:
    *   `README.md`: Overview specific to this plan.
    *   `plan.md`: Contains the detailed plan (scope, mode, tasks, verification, checkpoints - defined in Phase 2).
    *   `status.md`: Tracks the real-time status, progress, decisions, logs, and verification results (See Rule 150).
    *   Required Checklists (as identified in Phase 2).
4.  Optionally, update a central plan registry (like `plan-registry.md` located *here* in `docs/guides/plans/`) if one is being used.

**Failure to follow this structure renders the implementation non-compliant with the framework.**

## Core Plan Artifacts (within `ai-workflow-workspace/plans/[unique-plan-id]/`)

Within each **operational** plan directory, the key files are:

*   **`plan.md`**: The static blueprint for the implementation, created during the Planning Phase. It outlines *what* needs to be done, including scope, mode, task breakdown, and planned verification.
*   **`status.md`**: The dynamic logbook for the implementation. It tracks *how* the plan is progressing, recording actions, decisions, verification results, issues, and human checkpoint outcomes. It relies heavily on **Rule 150 (Implementation State Management)**.

## Example Plan Skeleton (Template for New Plans)

Located within this directory at [`example-plan-skeleton/`](./example-plan-skeleton/), you will find the basic required file structure for a new plan:

*   `README.md`
*   `plan.md`
*   `status.md`

Use this skeleton as a template when creating a new plan directory inside `ai-workflow-workspace/plans/[unique-plan-id]/` during the Preparation phase (Rule 100).

*(Note: The `example-plans/` directory, also located here, contains older, more fleshed-out examples that may be useful for reference but are not the primary template.)*

## Optional Central Tracking Files (Located Here)

This directory (`docs/guides/plans/`) can optionally house central tracking files if your workflow utilizes them:

### Plan Registry (`plan-registry.md`)

If used, the [Plan Registry](./plan-registry.md) provides a central list of different implementation plans undertaken within the workspace, potentially categorized by status (Active, Completed, Archived).

### Implementation Log (`implementation-log.md`)

If used, the [Implementation Log](./implementation-log.md) can offer a compact, chronological overview of implementation activities, useful for quick reviews of past work.

*Note: The creation and maintenance of these central files are optional additions to the core process defined in Rule 100.*


## Related Resources

- **[Rule 100: Implementation Process](../../../framework-rules/100-implementation-process.md)**: Defines the core 7 phases, including Planning and Preparation for plan creation.
- **[Rule 150: Implementation State Management](../../../framework-rules/150-implementation-state-management.md)**: Details how state, including progress and decisions, is tracked, often within `status.md`.
- [AI Workflow Framework README](../../README.md): Main documentation for the AI Workflow framework.
- [Example Plan Skeleton](./example-plan-skeleton/README.md): The basic template structure for new plans.

## Plan Naming Convention

While Rule 100 requires a **unique** plan ID for the directory created in `ai-workflow-workspace/plans/`, a helpful convention for the directory name `[unique-plan-id]` is:

```
[short-descriptive-name]-[sequence_or_timestamp]
```

Example: `user-authentication-setup-001` or `refactor-database-query-202503311030`

Ensuring uniqueness is the primary requirement.
