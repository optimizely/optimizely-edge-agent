---
type: "documentation"
purpose: "framework-overview"
version: "2.1"
status: "Active"
description: "Overview of the optimized AI Workflow Framework v2, designed for structured AI-assisted development with enhanced tracking and scope control."
ai_instructions: "This README provides a human-readable overview of the framework. Refer users here for general understanding."
tags: ["overview", "documentation", "framework", "getting-started", "architecture", "ai-workflow", "implementation-guide"]
dateCreated: "2024-05-30"
lastUpdated: "2024-05-30"
---

# AI Workflow Framework v2 (Optimized)

Welcome to the AI Workflow Framework v2, a system designed to structure and manage AI-assisted software development, ensuring clarity, control, and efficient collaboration between humans and AI assistants.

## Purpose

This framework aims to:

*   Provide a **structured process** for AI-driven implementation tasks.
*   Enhance **tracking and visibility** of AI activities.
*   Enforce **scope control** to protect codebases.
*   Optimize **AI efficiency** through clear rules and reduced verbosity.
*   Facilitate effective **human oversight and approval**.

## Core Components

The framework is built around several key directories:

1.  **`framework-rules/`**:
    *   Contains the core rules (`100*.md` to `450*.md`, etc.) defining the framework's processes, standards, and constraints.
    *   These rules are the primary source of truth for framework operation.
    *   Each rule includes `ai_instructions` metadata for concise AI guidance.
    *   **Note:** The detailed `.md` rules are processed into `.mdc` files for direct use by the AI within `.cursor/rules/`.

2.  **`templates/`**:
    *   Provides starting points for common artifacts used in the workflow.
    *   `plan-templates/`: Includes templates for `README.md`, `status.md`, and `task-status-board.md` used within implementation plan directories.

3.  **`plans/`**:
    *   The designated location for specific implementation plans executed using this framework.
    *   Each sub-directory (e.g., `optimize-framework-rules-001/`) contains the `plan.md`, `status.md`, `README.md`, and any other artifacts related to that specific implementation.
    *   `plan-registry.md`: (Optional) A central index of plans.

4.  **`tools/`**: (Potentially) Contains utility scripts supporting the framework (e.g., cleanup, migration - usage may vary).

5.  **`ai-workflow-workspace/`**: (If used) Designed to hold user-generated content separate from the core framework code (plans, outputs, etc.).

## Implementation Process (Rule 100)

The framework follows a standard 7-phase process:

```
1. ANALYSIS → Understand requirements & rules
   ↓
2. PLANNING → Define scope, mode, & plan
   ↓
3. PREPARATION → Create plan directory & artifacts
   ↓
4. IMPLEMENTATION → Execute plan tasks incrementally
   ↓
5. VERIFICATION → Validate outcome vs requirements
   ↓
6. DOCUMENTATION → Document process & decisions
   ↓
7. COMPLETION → Finalize & handover
```

Detailed requirements for each phase are defined in `framework-rules/100-implementation-process.md`.

## Implementation Modes (Rule 125)

The framework supports three primary modes, affecting the level of detail, verification, and human approval required:

*   **`@mode:manual`**: Maximum human oversight, detailed steps, frequent verification and approval. Required for high-risk operations (e.g., production changes).
*   **`@mode:semi`**: Balanced approach, standard detail, key verification points, major approvals. Suitable for standard development.
*   **`@mode:auto`**: Streamlined approach, basic detail, critical verification/approvals only. Suitable for low-risk, simple changes.

## Key Principles & Features

*   **Scope Control (Rule 200 & 275):** Implementations define clear "in-scope" and "out-of-scope" boundaries. Component Protection Levels (`@LOCKED`, `@INTERFACE`, `@BEHAVIOR`, `@FLEXIBLE`) defined in Rule 275 dictate allowed modifications.
*   **State Management (Rule 150):** Progress, decisions, and context are tracked consistently using `status.md` files and standardized context headers in AI responses.
*   **Verification (Rule 300 & others):** Built-in checkpoints and verification requirements ensure quality and adherence to the plan. Pre-flight checks (Rule 450) verify readiness for critical operations.
*   **Human Checkpoints (Rule 425):** Explicit human approval is required at key stages (e.g., phase transitions, critical decisions) to maintain oversight.
*   **AI Instructions:** Concise `ai_instructions` in rule metadata guide the AI directly, reducing the need for verbose text in the main rule body.
*   **Standard Verification Statements:** Rules include standardized statements for the AI to confirm compliance.

## Getting Started

1.  Review `start-here.md` for a more detailed walkthrough.
2.  Review the **[Quickstart Request Guide](docs/quickstart-request-guide.md)** for how to structure your implementation requests.
3.  Familiarize yourself with the core rules in `framework-rules/`, particularly Rule 100 (Process) and Rule 125 (Modes).
4.  When initiating an AI task, provide the details outlined in the Quickstart Guide, including the desired `@mode`.
5.  The AI will typically follow the framework to create a plan in `ai-workflow-workspace/plans/` and execute it phase by phase, requesting approvals at checkpoints.
6.  Monitor the `status.md` file within the relevant plan directory for progress.
7.  Refer to guides in `docs/guides/` for specific interactions like **[Requesting Corrections](docs/guides/correction-guide.md)** or **[Continuing Implementations](docs/guides/continuation-guide.md)**.

This optimized framework provides a robust yet efficient way to manage AI-assisted development. By adhering to the defined process and rules, teams can leverage AI capabilities while maintaining control, quality, and visibility.
