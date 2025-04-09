
### Instructions

@generate-ai-framework.md Please process the following text. It contains instructions followed by the content of multiple files, each delimited by --- START OF FILE [filepath] --- and --- END OF FILE [filepath] ---. Follow the instructions provided at the beginning of the text (within the _SETUP_FRAMEWORK_FILES.md block) to recreate the specified directory structure and files accurately in the current project's root directory.

--- START OF FILE _SETUP_FRAMEWORK_FILES.md ---
# AI Workflow Framework Setup Instructions

**Objective:** Recreate the simplified AI Workflow Framework directory structure and file content based on the delimited data provided below.

**DATE CONSTANT:** Replace date placeholders "YYYY-MM-DD" with "2025-03-29"

**Instructions:**

1.  **Parse the Data:** Read the text that follows these instructions. Identify blocks of text delimited by `--- START OF FILE [filepath] ---` and `--- END OF FILE [filepath] ---`.
2.  **Extract File Path and Content:** For each block, extract the `[filepath]` (e.g., `AI-workflow-Max/core-rules/001-core-principles.md`) and the content between the start and end delimiters.
3.  **Create Directories:** For each extracted `[filepath]`, determine the necessary directory path. If the directory does not exist, create it recursively (e.g., for `AI-workflow-Max/core-rules/001-core-principles.md`, ensure `AI-workflow-Max/core-rules/` exists). Assume the paths are relative to the project's root directory.
4.  **Create Files:** Create a file at the specified `[filepath]` and write the extracted content into it. Use the correct file extension (`.md` or `.mdc`) as specified in the path. Overwrite existing files if they exist to ensure the latest structure is applied.
5.  **Verify:** After processing all blocks, confirm that the directory structure and files match the provided data.

**Example Delimiter Format:**

```
--- START OF FILE path/to/your/file.ext ---
File content goes here.
Multiple lines are okay.
--- END OF FILE path/to/your/file.ext ---
```

**Execute these steps carefully to set up the framework files.**

--- END OF FILE _SETUP_FRAMEWORK_FILES.md ---

--- START OF FILE AI-workflow-Max/README.md ---
---
type: "documentation"
purpose: "framework-overview"
version: "2.2" # Indicate updated version reflecting restructuring
status: "Active"
description: "Simplified overview of the AI Workflow Framework Max, focusing on core principles, structure, usage, and refined agent instructions."
dateCreated: "2025-03-29"
lastUpdated: "2025-03-29"
---

# AI Workflow Framework Max (Simplified)

Welcome to the simplified AI Workflow Framework. This framework provides structure for AI-assisted development, emphasizing clear scope, reliable tracking, safety, and enhanced agent guidance.

## Core Principles

1.  **Scope Control:** Strictly adhere to defined implementation boundaries.
2.  **Plan Storage & Setup:** All plans MUST be stored correctly, and the mandatory setup checklist completed *before* implementation.
3.  **Tracking & Logging:** Maintain clear status and logs, reporting progress visually in manual mode.
4.  **Safety:** Follow protocols for production and refactoring.
5.  **Clear Communication:** Use standardized formats and provide context.

## Structure

-   **`AI-workflow-Max/`**: Contains core rules, modes, templates, tools, and AI guidance. (This directory)
-   **`ai-workflow-workspace-Max/`**: Contains user-generated plans, registry, extensions, outputs, etc. (Separate directory)

## Key Components

-   **`core-rules/`**: Essential rules (Scope, Storage, Tracking, Safety).
-   **`modes/`**: Defines `manual` and `assisted` modes (verification/autonomy levels).
-   **`templates/`**: Basic templates for requests, plans, status.
-   **`tools/`**: Utilities (plan creation, registry updates, AI helpers).
-   **`ai-guidance/`**: Best practices and guides for AI assistants.
-   **`custom-dev-agent-instructions.md`**: **(CRITICAL READ)** Core instructions, checklists, and priorities for the AI agent.

## Getting Started

1.  Review `start-here.md`.
2.  Use `tools/create-plan.js` to initiate new implementations (part of mandatory setup).
3.  Specify `@mode:manual` or `@mode:assisted`.
4.  Follow the core rules, especially Scope Control (Rule 002) and the **mandatory** pre-implementation setup defined in `custom-dev-agent-instructions.md` (based on Rule 003).
--- END OF FILE AI-workflow-Max/README.md ---

--- START OF FILE AI-workflow-Max/start-here.md ---
---
type: "documentation"
purpose: "onboarding-guide"
version: "2.2" # Reflects framework update
status: "Active"
description: "Simplified entry point and onboarding guide for the AI Workflow Framework Max."
dateCreated: "2025-03-29"
lastUpdated: "2025-03-29"
---

# 🚀 Getting Started (Simplified AI Workflow Max)

Welcome! This guide helps you start using the simplified AI Workflow Framework.

## Quick Start

1.  **Understand the Goal:** Define what you want the AI to implement.
2.  **Create an Implementation Request:** Use the simplified `templates/request.md` to outline your needs. Include:
    *   Objective
    *   Key Requirements
    *   Technical Context (codebase, tech stack)
    *   Constraints & Boundaries (crucial for scope!)
3.  **Choose Your Mode:**
    *   `@mode:manual`: High oversight, step-by-step approval needed. AI provides visual progress updates in chat. Best for critical/complex tasks.
    *   `@mode:assisted`: More AI autonomy, component-level verification. Good for standard tasks. (Default if unspecified)
4.  **Initiate the Plan Setup (Mandatory):** Ask the AI to set up the implementation plan structure. **The AI MUST follow the "Critical Priorities & Pre-flight Checklist"** in its instructions, which uses `tools/create-plan.js`, sets up files in `ai-workflow-workspace-Max/plans/`, and updates the registry.
    *   Example prompt: "Set up the implementation plan structure for [Your Objective] using `@mode:assisted`. Follow the mandatory pre-flight checklist."
5.  **Review the Plan & Approve Scope:** The AI will generate a `plan.md` including a **Scope Contract**. Review this carefully, especially the scope. Approve or request changes. **AI cannot proceed without scope approval.**
6.  **Execute:** The AI will implement the plan, updating `status.md` and `implementation-log.md` in the workspace registry (`ai-workflow-workspace-Max/registry/`). Interact based on the chosen mode (more approval needed in manual, expect visual progress updates in chat in manual).
7.  **Verify:** Review the completed work and final status.

## Core Rules to Remember

*   **Setup First:** The AI MUST complete the pre-flight checklist (Rule 003 setup) *before* implementation starts.
*   **Scope is King:** The AI MUST adhere strictly to the approved Scope Contract (Rule 002).
*   **Storage is Mandatory:** Plans MUST live in `ai-workflow-workspace-Max/plans/` (Rule 003).
*   **Tracking is Essential:** `status.md` and `implementation-log.md` MUST be kept up-to-date (Rule 004). Visual progress updates provided in chat for manual mode.

## Next Steps

*   Review the `core-rules/` for essential framework principles.
*   Check the `templates/` for request and plan formats.
*   Explore `ai-workflow-workspace-Max/examples/` (if populated) for completed plans.
*   Understand the detailed agent requirements in `AI-workflow-Max/custom-dev-agent-instructions.md`.
--- END OF FILE AI-workflow-Max/start-here.md ---

--- START OF FILE AI-workflow-Max/package.json ---
{
  "name": "ai-workflow-max",
  "version": "2.2.0",
  "description": "AI Workflow Framework Core (Max)",
  "type": "module",
  "private": true,
  "scripts": {
    "create-plan": "node tools/create-plan.js",
    "update-registry": "node tools/update-registry.js"
  },
  "engines": {
    "node": ">=16.0.0"
  }
}
--- END OF FILE AI-workflow-Max/package.json ---

--- START OF FILE AI-workflow-Max/.gitignore ---
# Ignore node_modules and potentially sensitive files
node_modules/
.env
*.log
*.bak
*.swp

# Ignore OS-specific files
.DS_Store
Thumbs.db

# Ignore temporary framework development files if any
temp-dev/
dist/
build/
coverage/

# Ignore Cursor directory within the framework source
.cursor/
--- END OF FILE AI-workflow-Max/.gitignore ---

--- START OF FILE AI-workflow-Max/core-rules/README.md ---
---
type: "documentation"
purpose: "rules-overview"
version: "1.0"
status: "Active"
description: "Overview of the simplified core framework rules."
dateCreated: "2025-03-29"
lastUpdated: "2025-03-29"
---

# Core Framework Rules (Simplified)

This directory contains the essential, non-negotiable rules governing the AI Workflow Framework. These rules are further elaborated and prioritized in `AI-workflow-Max/custom-dev-agent-instructions.md`.

-   **`001-core-principles.md`**: Basic AI behavior, communication standards. (Environmental context moved to main instructions).
-   **`002-scope-control.md`**: Mandatory scope definition and adherence.
-   **`003-plan-storage.md`**: Mandatory plan storage location, structure, and registry updates. (Environmental context moved; detailed setup checklist in main instructions).
-   **`004-tracking-logging.md`**: Requirements for status and log file updates. (Environmental context moved; reporting details in main instructions and modes).
-   **`005-safety-protocols.md`**: Combined rules for production and refactoring safety.
--- END OF FILE AI-workflow-Max/core-rules/README.md ---

--- START OF FILE AI-workflow-Max/core-rules/001-core-principles.md ---
---
type: "core-rule"
rule_id: "001"
version: "1.1" # Updated to reflect removal of redundancy
status: "Active"
description: "Core principles for AI behavior within the framework."
dateCreated: "2025-03-29"
lastUpdated: "2025-03-29"
---

# Rule 001: Core Principles

## AI Assistant MUST:

1.  **Prioritize User Instructions:** Explicit user commands override framework rules where safe and reasonable. Document such overrides.
2.  **Follow the Approved Plan:** Adhere strictly to the steps outlined in the approved `plan.md`.
3.  **Communicate Clearly:**
    *   Use concise language.
    *   Provide context (current step, progress).
    *   Clearly state when input or decisions are needed.
    *   Report errors or blockers promptly.
    *   Provide specific progress reporting as defined by the active mode (see `modes/manual.md` and `custom-dev-agent-instructions.md`).
4.  **Use Framework Tools:** Utilize provided tools (e.g., `create-plan.js`, `update-registry.js`, `ai-tools`) where applicable to ensure consistency.
5.  **Maintain State:** Keep track of implementation progress, decisions, and modified files as per Rule 004 and detailed in `custom-dev-agent-instructions.md`.
6.  **Adhere to Mode:** Operate according to the specified `@mode:manual` or `@mode:assisted` rules regarding verification, autonomy, and reporting.
7.  **Be Proactive (within bounds):** Identify potential issues (e.g., scope conflicts, technical challenges) but do *not* act outside the plan without approval. Document potential improvements separately.
8.  **Respect Safety Protocols:** Strictly follow Rule 005 in relevant contexts (production, refactoring).

**(Note: Environment details like File System Access, OS, and Terminal commands are defined in `AI-workflow-Max/custom-dev-agent-instructions.md`)**
--- END OF FILE AI-workflow-Max/core-rules/001-core-principles.md ---

--- START OF FILE AI-workflow-Max/core-rules/002-scope-control.md ---
---
type: "core-rule"
rule_id: "002"
version: "1.0"
status: "Active"
description: "Mandatory scope definition and adherence protocol."
dateCreated: "2025-03-29"
lastUpdated: "2025-03-29"
---

# Rule 002: Scope Control (CRITICAL)

## Mandatory Requirements:

1.  **Scope Contract:** Every `plan.md` MUST begin with a `## Scope Contract` section defining:
    *   `### IN SCOPE`: Explicit list of files, components, or functionalities to be modified/created.
    *   `### OUT OF SCOPE`: Explicit list of items that MUST NOT be touched.
    *   `### MODIFICATION LIMITS`: Specific restrictions on *how* in-scope items can be changed (e.g., "add methods only, do not change existing signatures").
2.  **Verification Before Change:** Before implementing *any* code change or file modification, the AI Assistant MUST mentally or explicitly verify:
    *   "Is the target file/component listed in `IN SCOPE`?"
    *   "Does the planned change respect the `MODIFICATION LIMITS`?"
    *   "Does this change affect anything listed in `OUT OF SCOPE`?"
3.  **Strict Adherence:** The AI Assistant MUST NOT perform any action that violates the approved Scope Contract.
4.  **No Unauthorized Changes:** Do not implement improvements, fixes, or refactoring outside the defined scope, even if beneficial. Document these separately (e.g., in `references/lessons-learned.md` within the plan directory).
5.  **Clarification Protocol:** If scope is unclear or a change seems necessary but is outside scope, STOP and request clarification from the user. Do not proceed with assumptions.
6.  **Scope Change Procedure:** If the user wishes to change scope mid-implementation:
    *   The Scope Contract in `plan.md` MUST be updated.
    *   The AI MUST receive explicit confirmation of the updated scope before proceeding.

**Failure to adhere to scope control is a critical framework violation.** Scope approval is required *before* starting implementation steps (see Pre-flight Checklist in `custom-dev-agent-instructions.md`).
--- END OF FILE AI-workflow-Max/core-rules/002-scope-control.md ---

--- START OF FILE AI-workflow-Max/core-rules/003-plan-storage.md ---
---
type: "core-rule"
rule_id: "003"
version: "1.1" # Updated to reflect removal of redundancy
status: "Active"
description: "Mandatory plan storage location, structure, naming, and registry update rules. Setup details are in custom-dev-agent-instructions.md."
dateCreated: "2025-03-29"
lastUpdated: "2025-03-29"
---

# Rule 003: Plan Storage (CRITICAL)

## Mandatory Requirements:

1.  **Storage Location:** All implementation plans MUST be created and stored exclusively within the `ai-workflow-workspace-Max/plans/` directory. **NEVER** store plans within the `AI-workflow-Max/` directory structure.
2.  **Directory Naming:** Each plan MUST reside in its own directory named using the convention: `plan-[descriptive-name]-[YYYY-MM-DD]`. Use lowercase, hyphens for spaces, and the creation date (use `tools/ai-tools/date-utils.js`).
    *   Example: `ai-workflow-workspace-Max/plans/plan-user-authentication-2025-03-29`
3.  **Core File Structure:** Upon creation (using `AI-workflow-Max/tools/create-plan.js`), each plan directory MUST contain at least these files:
    *   `README.md`: Overview with simplified metadata (Type, Purpose, Status, Mode, Dates).
    *   `plan.md`: The detailed implementation steps, including the mandatory Scope Contract (Rule 002).
    *   `status.md`: The live file for tracking current progress (Rule 004).
    *   *(Input documents like `technical-design.md`, `prd.md` should also be placed here by the user or AI).*
4.  **Registry Update:** Immediately after creating the plan directory and core files, the AI Assistant MUST update **both** registry files in `ai-workflow-workspace-Max/registry/`:
    *   **`plan-registry.md`:** Add a new row to the top of the relevant table (usually "Active Plans") with Status (🟡), Plan ID (linking to the plan's README), Mode, Description, and initial Progress (0%).
    *   **`implementation-log.md`:** Add a new row to the top with Timestamp, Plan ID, Action ("Plan Created"), and Status ("Planning").
5.  **Verification:** The mandatory **"Critical Priorities & Pre-flight Checklist"** defined in `AI-workflow-Max/custom-dev-agent-instructions.md` MUST be completed *before* starting any implementation steps defined in `plan.md`. This checklist ensures compliance with steps 1-4 above and scope approval.

**(Note: Environment details like File System Access, OS, and Terminal commands are defined in `AI-workflow-Max/custom-dev-agent-instructions.md`)**

**Failure to store plans correctly or update the registry is a critical framework violation.** Use the `AI-workflow-Max/tools/create-plan.js` script as part of the mandatory pre-flight checklist.
--- END OF FILE AI-workflow-Max/core-rules/003-plan-storage.md ---

--- START OF FILE AI-workflow-Max/core-rules/004-tracking-logging.md ---
---
type: "core-rule"
rule_id: "004"
version: "1.1" # Updated to reflect removal of redundancy and link to reporting details
status: "Active"
description: "Mandatory requirements for updating status and implementation log files. Reporting details are in custom-dev-agent-instructions.md and modes."
dateCreated: "2025-03-29"
lastUpdated: "2025-03-29"
---

# Rule 004: Tracking & Logging (CRITICAL)

## Mandatory Requirements:

1.  **Live Status File (`status.md`):**
    *   Each plan directory MUST contain a `status.md` file (e.g., `ai-workflow-workspace-Max/plans/plan-[name]-[date]/status.md`).
    *   This file MUST be kept **continuously updated** during implementation, immediately following the completion *and successful verification* of each step.
    *   It MUST contain at least:
        *   `Current Step:` The ID and description of the step currently being worked on (or just completed).
        *   `Progress:` A visual indicator (e.g., progress bar using `tools/ai-tools/progress-indicators.js`) and percentage/fraction (e.g., `[███░░░] 3/5 steps (60%)`).
        *   `Status:` The overall status (e.g., 🔄 In Progress, ⚠️ Blocked, ✅ Completed). Use indicators from `tools/ai-tools/progress-indicators.js`.
        *   `Blockers:` List any issues preventing progress, or "None".
        *   `Last Update:` Timestamp of the last update (use `tools/ai-tools/date-utils.js`).
    *   Use the `AI-workflow-Max/templates/status.md` as a base.

2.  **Implementation Log (`implementation-log.md`):**
    *   The central `ai-workflow-workspace-Max/registry/implementation-log.md` MUST be updated chronologically (newest entries first).
    *   Log entries MUST be added immediately following significant actions, including (but not limited to):
        *   Plan Creation (as part of pre-flight checklist)
        *   Implementation Start
        *   Step Completion (after successful verification)
        *   Component Completion
        *   Phase Transitions
        *   Encountering/Resolving Blockers
        *   Scope Changes (if approved)
        *   Implementation Paused/Resumed
        *   Implementation Completed/Failed
    *   Each log entry MUST include: Timestamp, Plan ID, Action Description, Status.

3.  **Consistency:** The information in `status.md`, `implementation-log.md`, and reported in chat (especially in manual mode) must be consistent with the actual state of the implementation.

4.  **Tool Usage:** Use `AI-workflow-Max/tools/update-registry.js` (or equivalent internal logic) to help maintain the central log if available.

5.  **Verification & Reporting:** Adhere to the **"Post-Step Completion & Reporting Checklist"** defined in `AI-workflow-Max/custom-dev-agent-instructions.md` after completing *and verifying* each step. This includes specific reporting requirements for different modes.

**(Note: Environment details like File System Access, OS, and Terminal commands are defined in `AI-workflow-Max/custom-dev-agent-instructions.md`)**

**Accurate and timely tracking and reporting are essential for visibility, resumption, and collaboration.**
--- END OF FILE AI-workflow-Max/core-rules/004-tracking-logging.md ---

--- START OF FILE AI-workflow-Max/core-rules/005-safety-protocols.md ---
---
type: "core-rule"
rule_id: "005"
version: "1.0"
status: "Active"
description: "Combined safety protocols for production environments and refactoring tasks."
dateCreated: "2025-03-29"
lastUpdated: "2025-03-29"
---

# Rule 005: Safety Protocols

## Mandatory Requirements:

These protocols apply in **high-caution contexts**, defined as:
*   Working directly in a designated **Production Environment**.
*   Performing tasks explicitly identified as **Refactoring**.
*   When the user explicitly invokes `@safety:enable`.

In these contexts, the AI Assistant MUST:

1.  **Strict Plan Adherence:** Execute **only** the changes explicitly defined in the approved `plan.md` and its Scope Contract. There is **zero tolerance** for deviation.
2.  **No Unauthorized Changes:**
    *   DO NOT implement any optimizations, improvements, or fixes not listed in the plan, regardless of perceived benefit or simplicity.
    *   DO NOT fix typos, update dependencies, or perform any code cleanup unless it is the *specific task* defined in the plan.
3.  **Document, Don't Implement:** If potential improvements or unrelated issues are identified:
    *   Document them clearly in a separate section (e.g., "Potential Improvements" or "Observations") within the plan's `references/lessons-learned.md` or equivalent (create if needed).
    *   Explicitly state that these items were *not* implemented because they were outside the approved scope/plan.
4.  **Assume Manual Mode:** Even if `@mode:assisted` was requested, operate with the verification level, caution, and **reporting requirements** (including visual progress updates in chat) of `@mode:manual` in high-caution contexts. This means seeking confirmation before significant steps and explaining actions clearly.
5.  **Prioritize Stability:** When faced with ambiguity or unexpected behavior, err on the side of caution. Stop, document the issue, and request clarification rather than making assumptions.
6.  **Verify Rollback Plan:** Before starting, ensure a clear rollback plan exists within the `plan.md`.

**Communication:** When operating under these protocols, clearly state it at the beginning of the session (e.g., "🛑 SAFETY PROTOCOLS ACTIVE: Operating with maximum caution. Only explicitly planned changes will be made. Reporting and verification will follow `@mode:manual` requirements.").
--- END OF FILE AI-workflow-Max/core-rules/005-safety-protocols.md ---

--- START OF FILE AI-workflow-Max/modes/README.md ---
---
type: "documentation"
purpose: "modes-overview"
version: "1.0"
status: "Active"
description: "Overview of the simplified implementation modes."
dateCreated: "2025-03-29"
lastUpdated: "2025-03-29"
---

# Implementation Modes (Simplified)

This directory defines the two primary implementation modes in the simplified framework. Modes primarily dictate the level of AI autonomy, verification frequency, communication style, and **reporting requirements**.

-   **`manual.md`**: Defines `@mode:manual` - High oversight, step-by-step approval, explicit visual progress reporting in chat.
-   **`assisted.md`**: Defines `@mode:assisted` - More autonomy, component-level verification, proceed-unless-blocked approach.

The default mode (if unspecified) should be `@mode:assisted` for most standard tasks, reserving `@mode:manual` for critical or complex implementations.
--- END OF FILE AI-workflow-Max/modes/README.md ---

--- START OF FILE AI-workflow-Max/modes/manual.md ---
---
type: "mode-definition"
mode_id: "manual"
version: "1.1" # Updated to include explicit reporting requirement
status: "Active"
description: "Defines the requirements for Manual Implementation Mode, including visual progress reporting."
dateCreated: "2025-03-29"
lastUpdated: "2025-03-29"
---

# Mode: Manual (`@mode:manual`)

**Goal:** Maximum human oversight, detailed verification, explicit step-by-step approval, and clear visual progress reporting in chat responses. Suitable for critical, high-risk, or complex tasks.

## Requirements:

1.  **Planning:** Generate a highly detailed `plan.md` with small, discrete steps. Each step must have clear verification criteria.
2.  **Scope Verification:** Explicitly perform and state scope verification (Rule 002) *before* proposing the implementation of *each* step.
3.  **Approval:** Request explicit user approval *before* implementing *each* step. Present the planned change clearly.
4.  **Execution:** Implement only one approved step at a time.
5.  **Verification:** Perform detailed verification against criteria *after* implementing each step. Document evidence if necessary. Only proceed after successful verification.
6.  **Tracking & Logging:** Update `status.md` and `implementation-log.md` immediately *after* successful verification of *each* step (Rule 004).
7.  **Communication & Reporting (CRITICAL):**
    *   Provide detailed context headers in every message (if applicable/useful).
    *   Explain the rationale for implementation choices *before* acting.
    *   Confirm completion and successful verification of each step *after* implementation.
    *   **Crucially, after confirming step completion and verification, your chat response MUST include:**
        *   A clear statement that the step is complete and verified.
        *   The current progress summary from `status.md`, including:
            *   The visual progress bar (generated using `AI-workflow-Max/tools/ai-tools/progress-indicators.js`).
            *   The step count (e.g., "3/5 steps").
            *   The percentage complete.
            *   The overall status indicator (e.g., `🔄 In Progress`).
        *   Example segment of response:
            ```
            Step 2.1: Add 'createdAt' field to User model - Completed and Verified.

            Progress Update:
            Status: 🔄 In Progress
            Progress: [██░░░░░░░░] 20% (2/10 steps)
            Next Step: 2.2 Run database migration
            ```
8.  **Safety:** Automatically enforces highest level of safety protocols (Rule 005).
--- END OF FILE AI-workflow-Max/modes/manual.md ---

--- START OF FILE AI-workflow-Max/modes/assisted.md ---
---
type: "mode-definition"
mode_id: "assisted"
version: "1.0"
status: "Active"
description: "Defines the requirements for Assisted Implementation Mode (combines Semi/Auto)."
dateCreated: "2025-03-29"
lastUpdated: "2025-03-29"
---

# Mode: Assisted (`@mode:assisted`)

**Goal:** Balance AI autonomy with necessary human oversight. AI proceeds with implementation, requesting clarification or approval only when necessary (blockers, high uncertainty, major checkpoints). Suitable for standard development tasks.

## Requirements:

1.  **Planning:** Generate a `plan.md` with logical steps grouped into components or phases. Define key verification points/success criteria for components/phases.
2.  **Scope Verification:** Mentally or explicitly perform scope verification (Rule 002) before implementing changes. Explicitly state verification *only* if a change is near a scope boundary or potentially ambiguous.
3.  **Approval:**
    *   Proceed with implementing steps within a component/phase *without* step-by-step approval *unless* encountering a blocker, significant uncertainty (e.g., confidence < 60%), or a predefined major checkpoint/decision point.
    *   Request approval *before* starting a new major component or phase, presenting a summary of the previous one.
    *   Request approval *before* making changes deemed high-risk or deviating significantly from the plan.
4.  **Execution:** Implement steps sequentially within a component/phase.
5.  **Verification:** Perform verification against criteria upon completing components or phases. Document summary results. Only proceed after successful verification of the current step/component.
6.  **Tracking & Logging:** Update `status.md` and `implementation-log.md` upon completion of components or significant milestones (Rule 004).
7.  **Communication & Reporting:**
    *   Provide context headers in substantive messages (start of component, updates, requests) if helpful.
    *   Explain actions *after* completing a component or reaching a checkpoint, or when requesting input.
    *   Summarize progress periodically (e.g., after completing a component/phase). Progress bar reporting in chat is *not* required after every step, unlike manual mode, but can be provided at major summary points.
8.  **Safety:** Follow standard safety protocols (Rule 005) if context requires (production/refactoring). Note that Rule 005 forces manual-like reporting even in assisted mode.
--- END OF FILE AI-workflow-Max/modes/assisted.md ---

--- START OF FILE AI-workflow-Max/templates/README.md ---
---
type: "documentation"
purpose: "templates-overview"
version: "1.0"
status: "Active"
description: "Overview of the simplified core templates."
dateCreated: "2025-03-29"
lastUpdated: "2025-03-29"
---

# Core Templates (Simplified)

This directory contains the essential templates for the simplified framework.

-   **`request.md`**: For users to initiate implementation requests.
-   **`plan.md`**: Basic structure for AI-generated implementation plans.
-   **`status.md`**: Template for the live `status.md` file within each plan directory.

Custom templates can be added to `ai-workflow-workspace-Max/extensions/templates/`.
--- END OF FILE AI-workflow-Max/templates/README.md ---

--- START OF FILE AI-workflow-Max/templates/request.md ---
---
type: "template"
purpose: "implementation-request"
version: "1.0"
status: "Active"
description: "Simplified template for requesting implementations."
dateCreated: "2025-03-29"
lastUpdated: "2025-03-29"
---

# Implementation Request

## 1. Objective
*What is the main goal? (1-2 sentences)*

## 2. Key Requirements / User Story
*List the essential requirements or provide a user story.*
- Req 1
- Req 2
- ...

## 3. Technical Context
*Provide essential technical details.*
- **Codebase:** [Link or name]
- **Tech Stack:** [Primary languages/frameworks]
- **Relevant Files/Modules:** [Specific areas to focus on]

## 4. Scope Boundaries & Constraints (CRITICAL)
*What is explicitly IN and OUT of scope? Any limitations?*
- **IN SCOPE:**
- **OUT OF SCOPE:**
- **Constraints:** [e.g., performance targets, deadlines, specific libraries to use/avoid]

## 5. Implementation Mode
*Choose one:*
- [ ] `@mode:manual` (High oversight, step-approval, visual progress updates in chat)
- [ ] `@mode:assisted` (More autonomy, component-approval) - *Default*

## 6. Input Documents (Optional)
*Provide paths to PRD or Technical Design documents if available (relative to workspace root).*
- **PRD:** [ai-workflow-workspace-Max/path/to/prd.md]
- **Tech Design:** [ai-workflow-workspace-Max/path/to/tech-design.md]

## 7. Anything Else?
*Any other context, preferences, or examples?*
--- END OF FILE AI-workflow-Max/templates/request.md ---

--- START OF FILE AI-workflow-Max/templates/plan.md ---
---
type: "template"
purpose: "implementation-plan-base"
version: "1.0"
status: "Active"
description: "Simplified base template for AI-generated implementation plans."
dateCreated: "2025-03-29"
lastUpdated: "2025-03-29"
---

# Implementation Plan: {{Plan Name}}

## Scope Contract (CRITICAL)
*Generated based on user request. MUST be reviewed and approved by user before proceeding (see Pre-flight Checklist).*
### IN SCOPE
*   [Explicit list of files/components/functionalities]
### OUT OF SCOPE
*   [Explicit list of items NOT to be touched]
### MODIFICATION LIMITS
*   [Specific restrictions on HOW in-scope items can be changed]

---
**=> User Approval Required Here Before Proceeding <=**
---

## High-Level Steps / Phases
*AI generates logical steps or phases based on technical design and scope.*
1.  **Phase/Step 1: [Name]**
    *   Goal: [Brief goal]
    *   Key Actions: [List 2-3 key actions or detailed sub-steps like 1.1, 1.2]
    *   Verification: [How success is measured for the phase/step(s)]
2.  **Phase/Step 2: [Name]**
    *   Goal: [Brief goal]
    *   Key Actions: [List actions/sub-steps]
    *   Verification: [How success is measured]
3.  **Phase/Step N: [Name]**
    *   Goal: [Brief goal]
    *   Key Actions: [List actions/sub-steps]
    *   Verification: [How success is measured]

## Key Verification Points
*Define critical checkpoints based on mode and complexity. Step-level verification is always required before marking a step complete.*
-   [Checkpoint 1: e.g., After Component X implementation]
-   [Checkpoint 2: e.g., Before database migration]

## Estimated Effort / Complexity
*Optional: AI provides a rough estimate.*
-   Complexity: [Low/Medium/High]
-   Estimated Steps: [Number]

## Rollback Strategy (If Applicable)
*Outline high-level rollback approach for critical steps.*
-   [Strategy: e.g., Git revert, Feature flag disable]
--- END OF FILE AI-workflow-Max/templates/plan.md ---

--- START OF FILE AI-workflow-Max/templates/status.md ---
---
type: "template"
purpose: "live-status-tracking"
version: "1.0"
status: "Active"
description: "Template for the mandatory live status file within each plan directory."
dateCreated: "2025-03-29"
lastUpdated: "2025-03-29"
---

# Implementation Status: {{Plan Name}}

**Mode:** `@mode:{{Mode}}`

**Overall Status:** 🟡 Planning

**Progress:** [░░░░░░░░░░] 0% (0/{{Total Steps}} steps)

**Current Step:** None

**Blockers:** None

**Last Update:** {{Timestamp}}

---

*This file is automatically updated by the AI Assistant during implementation after each verified step.*
--- END OF FILE AI-workflow-Max/templates/status.md ---

--- START OF FILE AI-workflow-Max/tools/README.md ---
---
type: "documentation"
purpose: "tools-overview"
version: "1.0"
status: "Active"
description: "Overview of the essential framework utility tools."
dateCreated: "2025-03-29"
lastUpdated: "2025-03-29"
---

# Framework Tools

This directory contains essential utilities for managing the AI Workflow Framework. AI Agents MUST use these where appropriate.

-   **`create-plan.js`**: **(CRITICAL)** Use this script via the **mandatory Pre-flight Checklist** to initialize a new implementation plan. It enforces the correct directory structure and file creation as per Rule 003.
    ```bash
    node AI-workflow-Max/tools/create-plan.js "Your Plan Name" [manual|assisted]
    ```
-   **`update-registry.js`**: Utility to help update the central registry files (`plan-registry.md`, `implementation-log.md`). Use after plan creation and significant status changes/step completions.
    ```bash
    node AI-workflow-Max/tools/update-registry.js [plan-id] [status] "[message]"
    ```
-   **`ai-tools/`**: Contains helper modules used by the framework and potentially by the AI assistant for tasks like date formatting, path resolution, progress visualization, and token management.
    *   `date-utils.js`: Use for consistent timestamps (`getTimestamp()`, `formatDate()`).
    *   `path-utils.js`: Use for reliable workspace/framework paths (`getWorkspacePath()`, `getFrameworkPath()`).
    *   `progress-indicators.js`: Use for status icons (`getStatusIndicator()`) and progress bars (`createProgressBar()`) in `status.md` and chat reports (`@mode:manual`).
--- END OF FILE AI-workflow-Max/tools/README.md ---

--- START OF FILE AI-workflow-Max/tools/create-plan.js ---
#!/usr/bin/env node
// --- Simplified Metadata ---
// type: "utility-script"
// purpose: "plan-creation"
// description: "Creates a new implementation plan with the correct structure (Simplified). Part of mandatory pre-flight setup."
// ---
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Use path-utils and date-utils from ai-tools
import pathUtils from './ai-tools/path-utils.js';
import dateUtils from './ai-tools/date-utils.js';

const { getWorkspacePath, getFrameworkPath } = pathUtils;
const { formatDate } = dateUtils;

console.log('Simplified Plan Creator - Max');

const planName = process.argv[2];
const mode = process.argv[3] || 'assisted'; // Default to assisted

if (!planName) {
  console.error('Error: Plan name is required.');
  console.log('Usage: node tools/create-plan.js "Plan Name" [manual|assisted]');
  process.exit(1);
}
if (!['manual', 'assisted'].includes(mode)) {
  console.error('Error: Invalid mode. Use manual or assisted.');
  process.exit(1);
}

const today = formatDate();
// Ensure workspace path uses the correct name
const workspacePlansPath = getWorkspacePath('plans'); // Resolves to ai-workflow-workspace-Max/plans
const planDirName = `plan-${planName.replace(/\s+/g, '-').toLowerCase()}-${today}`;
const planPath = path.join(workspacePlansPath, planDirName);
const planId = planDirName; // Use directory name as ID for simplicity

try {
  if (fs.existsSync(planPath)) {
    console.warn(`Warning: Plan directory already exists: ${planPath}. Skipping directory creation.`);
  } else {
    fs.mkdirSync(planPath, { recursive: true });
    console.log(`Created directory: ${planPath}`);
  }

  // Create core files
  const coreFiles = ['README.md', 'plan.md', 'status.md'];
  const templateDir = getFrameworkPath('templates');

  coreFiles.forEach(file => {
    const destPath = path.join(planPath, file);
    if (!fs.existsSync(destPath)) {
      const templatePath = path.join(templateDir, file);
      if (fs.existsSync(templatePath)) {
        let content = fs.readFileSync(templatePath, 'utf8');
        // Basic templating
        content = content.replace(/\{\{Plan Name\}\}/g, planName);
        content = content.replace(/\{\{Mode\}\}/g, mode);
        content = content.replace(/\{\{Timestamp\}\}/g, new Date().toISOString()); // Initial timestamp
        content = content.replace(/\{\{Total Steps\}\}/g, '0'); // Placeholder, AI updates later
        fs.writeFileSync(destPath, content);
        console.log(`Created file: ${destPath} from template`);
      } else {
        // Fallback if template is missing
        fs.writeFileSync(destPath, `# ${file}\n\nContent needed for ${planName}. Mode: ${mode}`);
        console.warn(`Warning: Template not found for ${file}. Created basic placeholder.`);
      }
    } else {
       console.log(`File already exists, skipped: ${destPath}`);
    }
  });

  // Create optional input file placeholders if they don't exist
  const inputFiles = ['technical-design.md', 'prd.md'];
   inputFiles.forEach(file => {
    const destPath = path.join(planPath, file);
     if (!fs.existsSync(destPath)) {
       fs.writeFileSync(destPath, `# ${file}\n\n(Optional: Add content here or reference external document)`);
       console.log(`Created placeholder file: ${destPath}`);
     }
   });


  console.log(`\nPlan structure created successfully for plan ID: ${planId}`);
  console.log('Next steps (as part of Pre-flight Checklist):');
  console.log(`1. Add PRD/Technical Design content to ${planPath} (if applicable)`);
  console.log(`2. Update registry files in ai-workflow-workspace-Max/registry/ using update-registry.js or manually.`);
  console.log(`3. Ask the AI to generate the detailed steps in ${path.join(planPath, 'plan.md')}`);
  console.log(`4. Obtain user approval for the Scope Contract in plan.md.`);

} catch (error) {
  console.error(`Error creating plan: ${error.message}`);
  process.exit(1);
}
--- END OF FILE AI-workflow-Max/tools/create-plan.js ---

--- START OF FILE AI-workflow-Max/tools/update-registry.js ---
#!/usr/bin/env node
// --- Simplified Metadata ---
// type: "utility-script"
// purpose: "registry-update"
// description: "Updates plan-registry.md and implementation-log.md (Simplified). Use after plan creation and significant updates."
// ---
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Use path-utils and date-utils from ai-tools
import pathUtils from './ai-tools/path-utils.js';
import dateUtils from './ai-tools/date-utils.js';
import progressIndicators from './ai-tools/progress-indicators.js';

const { getWorkspacePath } = pathUtils; // Resolves to ai-workflow-workspace-Max
const { getTimestamp } = dateUtils;
const { getStatusIndicator } = progressIndicators;

console.log('Simplified Registry Updater - Max');

const planId = process.argv[2];
const status = process.argv[3]; // e.g., Planning, In Progress, Completed
const message = process.argv[4] || 'Status Update';

if (!planId || !status) {
  console.error('Error: Plan ID and Status are required.');
  console.log('Usage: node tools/update-registry.js [plan-id] [status] "[message]"');
  process.exit(1);
}

const registryDir = getWorkspacePath('registry'); // Gets correct workspace path
const planRegistryPath = path.join(registryDir, 'plan-registry.md');
const logPath = path.join(registryDir, 'implementation-log.md');

const statusIcon = getStatusIndicator(status.toLowerCase().replace(/ /g, '_'));
const currentTimestamp = getTimestamp();

try {
  // --- Update implementation-log.md ---
  if (fs.existsSync(logPath)) {
    let logContent = fs.readFileSync(logPath, 'utf8');
    // Ensure planId is included for clarity if message doesn't contain it
    const fullMessage = message.includes(planId) ? message : `${message} for ${planId}`;
    const logEntry = `| ${currentTimestamp} | ${planId} | ${fullMessage} | ${status} |`;
    // Find the header separator line
    const headerSeparatorIndex = logContent.indexOf('\n|--');
    if (headerSeparatorIndex !== -1) {
      const insertIndex = logContent.indexOf('\n', headerSeparatorIndex + 1); // Find the end of the separator line
      if (insertIndex !== -1) {
        logContent = logContent.slice(0, insertIndex + 1) + logEntry + logContent.slice(insertIndex);
        fs.writeFileSync(logPath, logContent);
        console.log(`Added entry to ${logPath}`);
      } else {
         // Handle case where separator is the last line
         logContent += '\n' + logEntry;
         fs.writeFileSync(logPath, logContent);
         console.log(`Added entry to end of ${logPath}`);
      }
    } else {
        // If no separator, maybe it's an empty file or just headers? Add after headers if possible.
        const headerEndIndex = logContent.indexOf('\n');
        if (headerEndIndex !== -1) {
            logContent += '\n|---|---|---|---|\n' + logEntry; // Add separator and entry
        } else {
            logContent += '\n| Timestamp | Plan ID | Action | Status |\n|---|---|---|---|\n' + logEntry; // Add headers, separator, entry
        }
       fs.writeFileSync(logPath, logContent);
       console.warn(`Could not find header separator in ${logPath}. Added entry, potentially needing format review.`);
    }
  } else {
    console.warn(`Warning: ${logPath} not found. Cannot add log entry.`);
  }

  // --- Update plan-registry.md ---
  if (fs.existsSync(planRegistryPath)) {
      let registryContent = fs.readFileSync(planRegistryPath, 'utf8');
      // Regex: | optional whitespace | any non-| char | optional whitespace | | optional whitespace | [planId link syntax]
      const planRegex = new RegExp(`^\\|\\s*([^|]+?)\\s*\\|\\s*\\[${planId}\\]`, 'm');
      const match = registryContent.match(planRegex);

      if (match) {
          // Replace the existing icon/whitespace with the new icon, preserving alignment roughly
          const existingIconPart = match[1];
          // Ensure enough space for alignment, considering potential existing content length
          const newIconPart = ` ${statusIcon} `.padEnd(existingIconPart.length, ' '); // Center icon roughly
          const replacement = `|${newIconPart}| [${planId}]`;
          registryContent = registryContent.replace(match[0], replacement);

          // TODO: Add ability to update Progress % via argument later if needed
          fs.writeFileSync(planRegistryPath, registryContent);
          console.log(`Updated status for ${planId} to ${statusIcon} in ${planRegistryPath}`);
      } else {
           // If plan not found, maybe add it? (This script primarily updates existing)
           console.warn(`Could not find entry for ${planId} in ${planRegistryPath} to update status.`);
           console.log(`If this is a new plan, ensure create-plan.js was run and registry updated initially.`);
           // Optionally add a new entry if status is 'Planning' or similar initial state
           if (status.toLowerCase() === 'planning') {
               const planLink = `[${planId}](../plans/${planId}/README.md)`; // Assume README link
               const newEntry = `|  ${statusIcon}   | ${planLink} | @mode:unknown | Initial entry by update-registry | 0% |`; // Add placeholder row
                const headerSeparatorIndex = registryContent.indexOf('\n|:--');
                if (headerSeparatorIndex !== -1) {
                    const insertIndex = registryContent.indexOf('\n', headerSeparatorIndex + 1);
                    if (insertIndex !== -1) {
                        registryContent = registryContent.slice(0, insertIndex + 1) + newEntry + registryContent.slice(insertIndex);
                        fs.writeFileSync(planRegistryPath, registryContent);
                        console.log(`Added new placeholder entry for ${planId} in ${planRegistryPath}`);
                    } else {
                        registryContent += '\n' + newEntry;
                         fs.writeFileSync(planRegistryPath, registryContent);
                         console.log(`Added new placeholder entry for ${planId} to end of ${planRegistryPath}`);
                    }
                } else {
                     console.warn(`Could not find separator in ${planRegistryPath} to add new entry.`);
                }
           }
      }
  } else {
      console.warn(`Warning: ${planRegistryPath} not found.`);
  }

  console.log('\nRegistry update attempt finished.');

} catch (error) {
  console.error(`Error updating registry: ${error.message}`);
  process.exit(1);
}
--- END OF FILE AI-workflow-Max/tools/update-registry.js ---

--- START OF FILE AI-workflow-Max/tools/ai-tools/README.md ---
---
type: "documentation"
purpose: "ai-tools-overview"
version: "1.0"
status: "Active"
description: "Overview of utilities specifically designed for AI/framework interaction."
dateCreated: "2025-03-29"
lastUpdated: "2025-03-29"
---

# AI Tools

This directory contains utility modules designed to help AI assistants interact consistently and effectively with the framework and project environment. **Use these helpers whenever applicable.**

-   **`date-utils.js`**: Standardized date formatting (`formatDate`) and timestamp retrieval (`getTimestamp`).
-   **`path-utils.js`**: Reliable cross-platform path resolution relative to framework/workspace roots (`getFrameworkPath`, `getWorkspacePath`).
-   **`file-utils.js`**: Basic file system operations (`readFile`, `writeFile`, `createDirectory`).
-   **`progress-indicators.js`**: Generating standard visual progress bars (`createProgressBar`) and status icons (`getStatusIndicator`). **Use for `status.md` updates and chat reports in manual mode.**
-   **`token-utils.js`**: Helpers for estimating token counts and managing context (if needed).
--- END OF FILE AI-workflow-Max/tools/ai-tools/README.md ---

--- START OF FILE AI-workflow-Max/tools/ai-tools/date-utils.js ---
// --- Simplified Metadata ---
// type: "utility-script"
// purpose: "date-handling"
// description: "Date utilities for consistent formatting (Simplified)."
// ---
export function getCurrentDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  return {
    year: year.toString(),
    month: month,
    day: day,
    formatted: `${year}-${month}-${day}`,
    iso: now.toISOString(),
  };
}

/**
 * Formats a Date object or a parsable date string into YYYY-MM-DD format.
 * Defaults to the current date if input is invalid or missing.
 * @param {Date|string} [date=new Date()] - The date to format.
 * @returns {string} The formatted date string (YYYY-MM-DD).
 */
export function formatDate(date = new Date()) {
  let d = date instanceof Date ? date : new Date(); // Default to now if not already a Date object

  if (typeof date === 'string') {
     // Try parsing common formats, including ISO with/without time
     const parsedDate = new Date(date);
     if (!isNaN(parsedDate.getTime())) {
       d = parsedDate;
     } else {
       // Handle simple YYYY-MM-DD if parsing failed
       const parts = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
       if (parts) {
         // Note: This creates date in local timezone based on YYYY-MM-DD midnight
         // Be cautious if UTC is strictly required, might need Date.UTC()
         d = new Date(parseInt(parts[1]), parseInt(parts[2]) - 1, parseInt(parts[3]));
       } else {
         console.warn(`Could not parse date string: "${date}". Using current date.`);
         d = new Date(); // Fallback to current date
       }
     }
  } else if (!(date instanceof Date)) {
     console.warn(`Invalid date input type: ${typeof date}. Using current date.`);
     d = new Date();
  }

  if (isNaN(d.getTime())) {
    console.warn(`Resulting date is invalid after processing input "${date}". Using current date.`);
    d = new Date(); // Fallback if date is invalid
  }

  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Gets the current timestamp in YYYY-MM-DD HH:MM:SS format.
 * @returns {string} The formatted timestamp string.
 */
export function getTimestamp() {
    const now = new Date();
    const datePart = formatDate(now); // Use our reliable formatDate
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    return `${datePart} ${hours}:${minutes}:${seconds}`;
}

export default { getCurrentDate, formatDate, getTimestamp };
--- END OF FILE AI-workflow-Max/tools/ai-tools/date-utils.js ---

--- START OF FILE AI-workflow-Max/tools/ai-tools/path-utils.js ---
// --- Simplified Metadata ---
// type: "utility-script"
// purpose: "path-handling"
// description: "Path utilities for reliable path resolution (Simplified)."
// ---
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Assume this script is in AI-workflow-Max/tools/ai-tools
const FRAMEWORK_ROOT = path.resolve(__dirname, '..', '..');
// Dynamically determine workspace root relative to framework root
// Assumes workspace is one level up and then into 'ai-workflow-workspace-Max'
const WORKSPACE_ROOT_RELATIVE_PATH = '../ai-workflow-workspace-Max';
const WORKSPACE_ROOT = path.resolve(FRAMEWORK_ROOT, WORKSPACE_ROOT_RELATIVE_PATH);

/** Gets the absolute path to the framework root directory (AI-workflow-Max). */
export function getFrameworkRoot() { return FRAMEWORK_ROOT; }

/**
 * Gets the absolute path to the workspace root directory (ai-workflow-workspace-Max).
 * Creates the directory if it doesn't exist.
 */
export function getWorkspaceRoot() {
    // Check and create workspace directory if it doesn't exist
    if (!fs.existsSync(WORKSPACE_ROOT)) {
        try {
            fs.mkdirSync(WORKSPACE_ROOT, { recursive: true });
            console.log(`Workspace directory created: ${WORKSPACE_ROOT}`);
        } catch (error) {
            console.error(`Error creating workspace directory ${WORKSPACE_ROOT}: ${error.message}`);
            // Depending on severity, you might want to throw or exit
            throw new Error(`Failed to create necessary workspace directory: ${WORKSPACE_ROOT}`);
        }
    }
    return WORKSPACE_ROOT;
}

/**
 * Joins path segments to the framework root directory.
 * @param {...string} segments - Path segments relative to the framework root.
 * @returns {string} Absolute path within the framework directory.
 */
export function getFrameworkPath(...segments) { return path.join(FRAMEWORK_ROOT, ...segments); }

/**
 * Joins path segments to the workspace root directory. Ensures workspace exists.
 * @param {...string} segments - Path segments relative to the workspace root.
 * @returns {string} Absolute path within the workspace directory.
 */
export function getWorkspacePath(...segments) { return path.join(getWorkspaceRoot(), ...segments); } // Ensures workspace exists via getter

export default { getFrameworkRoot, getWorkspaceRoot, getFrameworkPath, getWorkspacePath };
--- END OF FILE AI-workflow-Max/tools/ai-tools/path-utils.js ---

--- START OF FILE AI-workflow-Max/tools/ai-tools/file-utils.js ---
// --- Simplified Metadata ---
// type: "utility-script"
// purpose: "file-handling"
// description: "Basic file system utilities (Simplified)."
// ---
import fs from 'fs';
import path from 'path';

/**
 * Reads a file synchronously. Throws error on failure.
 * @param {string} filePath - Absolute path to the file.
 * @param {string} [encoding='utf8'] - File encoding.
 * @returns {string} File content.
 */
export function readFile(filePath, encoding = 'utf8') {
  try {
    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found at ${filePath}`);
    }
    return fs.readFileSync(filePath, encoding);
  } catch (error) {
    console.error(`Error reading file ${filePath}: ${error.message}`);
    throw error; // Re-throw error after logging
  }
}

/**
 * Writes content to a file synchronously. Creates directories if needed. Throws error on failure.
 * @param {string} filePath - Absolute path to the file.
 * @param {string} content - Content to write.
 * @returns {string} The filePath written to.
 */
export function writeFile(filePath, content) {
  try {
    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
    fs.writeFileSync(filePath, content);
    // console.log(`Successfully wrote to file: ${filePath}`); // Optional success log
    return filePath;
  } catch (error) {
    console.error(`Error writing file ${filePath}: ${error.message}`);
    throw error; // Re-throw error after logging
  }
}

/**
 * Creates a directory synchronously if it doesn't exist. Throws error on failure.
 * @param {string} dirPath - Absolute path to the directory.
 * @param {object} [options={ recursive: true }] - Options for mkdirSync.
 * @returns {string} The dirPath created or verified.
 */
export function createDirectory(dirPath, options = { recursive: true }) {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, options);
      console.log(`Created directory: ${dirPath}`);
    } else {
      // console.log(`Directory already exists: ${dirPath}`); // Optional log
    }
    return dirPath;
  } catch (error) {
    console.error(`Error creating directory ${dirPath}: ${error.message}`);
    throw error; // Re-throw error after logging
  }
}

export default { readFile, writeFile, createDirectory };
--- END OF FILE AI-workflow-Max/tools/ai-tools/file-utils.js ---

--- START OF FILE AI-workflow-Max/tools/ai-tools/progress-indicators.js ---
// --- Simplified Metadata ---
// type: "utility-script"
// purpose: "visual-progress"
// description: "Generates visual progress indicators (Simplified)."
// ---

/**
 * Creates a text-based progress bar.
 * @param {number} percentage - The progress percentage (0-100).
 * @param {number} [width=10] - The desired width of the bar in characters.
 * @returns {string} The formatted progress bar string (e.g., "[####------]").
 */
export function createProgressBar(percentage, width = 10) {
  const clampedPercentage = Math.max(0, Math.min(100, percentage));
  const filledWidth = Math.round((clampedPercentage / 100) * width);
  const emptyWidth = width - filledWidth;
  // Use simple characters for broad compatibility
  const filled = '#'.repeat(filledWidth);
  const empty = '-'.repeat(emptyWidth);
  return `[${filled}${empty}]`;
}

// Define standard status indicators
export const STATUS_INDICATORS = {
  completed: '✅',
  in_progress: '🔄',
  planning: '🟡',
  blocked: '⚠️',
  archived: '⚫',
  not_started: '⏹️',
  unknown: '❓' // Added for fallback
};

/**
 * Gets a suitable status indicator icon based on a status string.
 * Normalizes input string (lowercase, spaces to underscores).
 * @param {string} status - The status string (e.g., "In Progress", "completed").
 * @returns {string} The corresponding emoji indicator, or '❓' if unknown.
 */
export function getStatusIndicator(status) {
  const normalizedStatus = status
                            ? status.toLowerCase().replace(/ /g, '_')
                            : 'not_started';
  return STATUS_INDICATORS[normalizedStatus] || STATUS_INDICATORS['unknown'];
}

export default { createProgressBar, getStatusIndicator, STATUS_INDICATORS };
--- END OF FILE AI-workflow-Max/tools/ai-tools/progress-indicators.js ---

--- START OF FILE AI-workflow-Max/tools/ai-tools/token-utils.js ---
// --- Simplified Metadata ---
// type: "utility-script"
// purpose: "token-management"
// description: "Basic token estimation helper (Simplified)."
// ---

/**
 * Provides a very rough estimate of token count for a given text.
 * Assumes ~4 characters per token for typical English text.
 * This is highly approximate and model-dependent. Use with caution.
 * @param {string} text - The text to estimate tokens for.
 * @returns {number} An estimated token count.
 */
export function estimateTokens(text) {
  if (!text) return 0;
  // Very rough estimate: 1 token per 4 chars for English text.
  // This is highly approximate and model-dependent.
  // For more accurate counts, use a library specific to the LLM (e.g., tiktoken for OpenAI).
  return Math.ceil(text.length / 4);
}

export default { estimateTokens };
--- END OF FILE AI-workflow-Max/tools/ai-tools/token-utils.js ---

--- START OF FILE AI-workflow-Max/ai-guidance/README.md ---
---
type: "documentation"
purpose: "ai-guidance-overview"
version: "1.1" # Updated version
status: "Active"
description: "Overview of guidance documents for AI assistants, including the debugging protocol."
dateCreated: "2025-03-29"
lastUpdated: "2025-03-29"
---

# AI Guidance

This directory provides best practices and how-to guides for AI assistants using the simplified framework. These are recommendations and elaborations, not strict rules like those in `core-rules/`. **Refer to these guides alongside the core instructions.**

-   **`working-with-framework.md`**: High-level guide on core principles and modes.
-   **`planning-guide.md`**: Tips for generating effective implementation plans (crucially, after the mandatory pre-flight setup).
-   **`tracking-guide.md`**: Best practices for updating status/logs *and* reporting progress in chat (especially manual mode).
-   **`debugging-protocol.md`**: **(IMPORTANT)** Structured workflow for handling errors, bugs, and regressions. Follow when issues arise.
-   **`context-management-tips.md`**: Advice on managing context window and memory.
-   **`common-patterns/`**: Reference examples for common implementation tasks.
--- END OF FILE AI-workflow-Max/ai-guidance/README.md ---

--- START OF FILE AI-workflow-Max/ai-guidance/working-with-framework.md ---
---
type: "ai-guidance"
purpose: "core-usage"
version: "1.1" # Updated for Max framework
status: "Active"
description: "High-level guide for AI assistants on using the simplified framework Max."
dateCreated: "2025-03-29"
lastUpdated: "2025-03-29"
---

# AI Guide: Working with the Simplified Framework (Max)

## Core Responsibilities

1.  **Follow Core Instructions:** Adhere strictly to `AI-workflow-Max/custom-dev-agent-instructions.md`, including all checklists and priorities.
2.  **Execute Mandatory Setup:** Complete the "Critical Priorities & Pre-flight Checklist" *before* any implementation work begins (Rule 003).
3.  **Adhere to Core Rules:** Strictly follow `core-rules/001` through `005`. Scope Control (002), Plan Storage (003), Tracking (004), and Safety (005) are paramount.
4.  **Adhere to Mode:** Operate according to `@mode:manual` or `@mode:assisted` as defined in `modes/`, paying close attention to verification and reporting requirements.
5.  **Use Tools:** Leverage `tools/` like `create-plan.js`, `update-registry.js`, and helpers in `ai-tools/` for consistency.
6.  **Communicate Clearly:** Provide context, status updates (including visual progress in manual mode chat), and request clarification when needed.
7.  **Generate Plans:** Create `plan.md` based on user requests and technical designs, *after* the mandatory setup is complete.
8.  **Track Progress:** Keep `status.md` and `implementation-log.md` up-to-date following the "Post-Step Completion & Reporting Checklist".

## Workflow Summary

1.  Receive request (`templates/request.md`).
2.  Confirm mode (`manual` or `assisted`).
3.  **Execute Mandatory Setup (Pre-flight Checklist):**
    *   Use `tools/create-plan.js` to set up plan directory in `ai-workflow-workspace-Max/plans/`.
    *   Verify core files (`README.md`, `plan.md`, `status.md`).
    *   Update registry files (`plan-registry.md`, `implementation-log.md`).
4.  Generate `plan.md`, including Scope Contract.
5.  **Get user approval for the Scope Contract.** (Part of Pre-flight Checklist)
6.  **(Implementation Phase Begins)** Execute steps in `plan.md`, adhering to Scope Control (Rule 002).
7.  **After each verified step, execute Post-Step Completion & Reporting Checklist:**
    *   Update `status.md`.
    *   Update `implementation-log.md`.
    *   Report progress in chat (with visual progress bar if in `@mode:manual`).
8.  Request approvals/clarifications based on the selected mode (`modes/`).
9.  Upon completion, update final status in registry and `status.md`.

## Key Changes in Max

*   **Mandatory Checklists:** Explicit Pre-flight and Post-Step checklists in `custom-dev-agent-instructions.md`.
*   **Consolidated Context:** OS/Terminal info centralized in main instructions.
*   **Explicit Manual Mode Reporting:** Requirement to show progress bar in chat for `@mode:manual`.
*   **Emphasis on Setup First:** Rule 003 compliance via the checklist is the absolute first step before planning/implementation.

**Your goal is reliable execution within clear boundaries, starting with mandatory setup, followed by meticulous step execution, verification, and reporting.**
--- END OF FILE AI-workflow-Max/ai-guidance/working-with-framework.md ---

--- START OF FILE AI-workflow-Max/ai-guidance/planning-guide.md ---
---
type: "ai-guidance"
purpose: "plan-generation-detailed"
version: "1.2" # Updated for Max
status: "Active"
description: "Enhanced guide for AI assistants on generating detailed, prescriptive, and sequential implementation plans (Max)."
related_files: ["../core-rules/002-scope-control.md", "../core-rules/003-plan-storage.md", "../templates/plan.md", "working-with-framework.md", "../custom-dev-agent-instructions.md"]
dateCreated: "2025-03-29" # Set current date
lastUpdated: "2025-03-29" # Set current date
---

# AI Guide: Generating Detailed Implementation Plans (Max)

## Goal

Create a clear, **detailed**, **prescriptive**, and **sequentially actionable** `plan.md` based on user requests, technical designs (TDD), and PRDs. The generated plan must be suitable for execution by another AI agent, adhering strictly to the simplified framework's core rules and the specified execution mode.

## Prerequisite: Mandatory Setup (CRITICAL)

**BEFORE generating any `plan.md` content, you MUST have already completed the "Critical Priorities & Pre-flight Checklist"** found in `AI-workflow-Max/custom-dev-agent-instructions.md`. This includes:
1.  Running `tools/create-plan.js`.
2.  Verifying the plan directory and core files (`README.md`, `plan.md`, `status.md`) exist in `ai-workflow-workspace-Max/plans/`.
3.  Placing copies of input documents (TDD, PRD) into the plan directory (if provided).
4.  Updating **both** central registry files (`plan-registry.md`, `implementation-log.md`).
5.  **Confirming completion** of these setup steps with the user.

**Do NOT proceed to generate the plan steps until the Pre-flight Checklist is complete and confirmed.**

## Plan Generation Process (After Setup)

1.  **Understand Inputs:** Thoroughly analyze the user request, TDD, PRD, and any relevant conversation context within the created plan directory. Identify objectives, components, and constraints.
2.  **Confirm Target Execution Mode:** Note whether the plan is being generated for `@mode:manual` or `@mode:assisted` execution.
3.  **Define Scope Contract (CRITICAL - Rule 002):**
    *   Draft the `## Scope Contract` section at the very beginning of the existing `plan.md`.
    *   Be **explicit and exhaustive** in listing `IN SCOPE` files/components/functions.
    *   Be equally explicit about `OUT OF SCOPE` items.
    *   Define clear `MODIFICATION LIMITS`.
    *   **Present this section clearly for user review and explicit approval. This approval is the FINAL item on the Pre-flight Checklist.**
4.  **Structure into Phases:** Organize the implementation into logical phases. Define a clear objective for each phase.
5.  **Generate Prescriptive Steps (CRITICAL):**
    *   Within each phase, break down the work into **small, single-purpose, actionable steps** (e.g., `Step 1.1`, `Step 1.2`).
    *   For **each step**, include:
        *   **Action:** Clear, imperative statement (e.g., "Add `status` field to `Task` model").
        *   **Target File(s):** Specific file path(s) relative to project root.
        *   **Code/Guidance:** Necessary code snippets, definitions, CLI commands, config examples. Reference `common-patterns/` if applicable. Use `AI-workflow-Max/tools/ai-tools/` helpers where needed (e.g., for paths).
        *   **Verification Criteria:** Define *how* to verify successful completion of *this specific step* (e.g., "Run `npm run lint -- --fix` successfully", "Observe 'Task created' log"). Tailor detail to the target mode.
        *   **Context/Rationale (Recommended):** Briefly explain *why*.
6.  **Ensure Sequential Logic:** Order steps logically.
7.  **Incorporate Best Practices:** Consider Rationale, Risk Assessment (for manual), Technical Details, Resource Notes within steps.
8.  **Define Key Verification Points:** Define major checkpoints (often end of phases) besides step-level verification.
9.  **Outline Rollback Strategy (If High-Risk):** Outline approach for critical phases.
10. **Final Review:** Review the generated plan within `plan.md` for clarity, sequence, actionability, and scope adherence. Ensure `{{Total Steps}}` placeholder in `status.md` is updated based on the generated plan.

## Execution Protocol Awareness (CRITICAL)

Remember the Implementer AI follows the **CRITICAL EXECUTION & VERIFICATION PROTOCOL** and **Post-Step Completion & Reporting Checklist**. Your plan must enable this:
*   Steps must be sequential and clear.
*   Verification criteria must be defined for *each* step.
*   Structure must facilitate accurate step-by-step tracking and reporting.

**Your goal is a plan, generated *after* mandatory setup, so clear that another AI can execute it reliably following all framework rules and checklists.**
--- END OF FILE AI-workflow-Max/ai-guidance/planning-guide.md ---

--- START OF FILE AI-workflow-Max/ai-guidance/tracking-guide.md ---
---
type: "ai-guidance"
purpose: "status-logging-reporting" # Updated purpose
version: "1.1" # Updated for Max
status: "Active"
description: "Guide for AI assistants on updating status.md, implementation-log.md, and reporting progress in chat (Max)."
dateCreated: "2025-03-29"
lastUpdated: "2025-03-29"
---

# AI Guide: Tracking, Logging, and Reporting (Max)

## Goal

Maintain accurate and up-to-date records of implementation progress using `status.md` and `implementation-log.md`, **and** provide clear progress reports in chat responses as required by the mode and instructions.

## Process: The Post-Step Completion & Reporting Checklist

**After successfully completing AND verifying each individual step**, you MUST perform the actions outlined in the **"Post-Step Completion & Reporting Checklist"** found in `AI-workflow-Max/custom-dev-agent-instructions.md`. This checklist covers:

1.  **Updating `status.md` (Live Status):**
    *   **Location:** `ai-workflow-workspace-Max/plans/plan-[name]-[date]/status.md`
    *   **Purpose:** Current snapshot.
    *   **Update Frequency:** Immediately after verifying each step.
    *   **Mandatory Fields to Update:**
        *   `Overall Status:` Use standard indicators (`getStatusIndicator()`).
        *   `Progress:` Update progress bar (`createProgressBar()`) and step count/percentage.
        *   `Current Step:` Reflect the step just completed or the next one if known.
        *   `Blockers:` Update if necessary.
        *   `Last Update:` Update timestamp (`getTimestamp()`).
    *   **Tool:** Use `AI-workflow-Max/tools/ai-tools/` helpers.

2.  **Updating `implementation-log.md` (Chronological Log):**
    *   **Location:** `ai-workflow-workspace-Max/registry/implementation-log.md`
    *   **Purpose:** Historical record across all plans.
    *   **Update Frequency:** Add entry immediately after verifying each significant action (esp. step completion). Newest first.
    *   **Mandatory Fields (Table Row):**
        *   `Timestamp:` Use `getTimestamp()`.
        *   `Plan ID:` The unique plan ID.
        *   `Action:` Concise description (e.g., "Completed Step 1.2: ...", "Resolved Blocker: ...").
        *   `Status:` Resulting status (e.g., In Progress, Blocked).
    *   **Tool:** Use `AI-workflow-Max/tools/update-registry.js` or equivalent logic.

3.  **Reporting Progress in Chat Response:**
    *   **Frequency:** Depends on mode.
        *   `@mode:manual`: **Required after every verified step.**
        *   `@mode:assisted`: Required at major checkpoints, component/phase completion, or when reporting blockers/requesting input. Summaries are acceptable.
    *   **Content (`@mode:manual`):**
        *   Clear statement of step completion and verification.
        *   Visual progress bar (`createProgressBar()`).
        *   Step count and percentage.
        *   Overall status indicator (`getStatusIndicator()`).
        *   (See example in `AI-workflow-Max/modes/manual.md`).
    *   **Content (`@mode:assisted` Summaries):**
        *   Summary of work completed (e.g., "Completed Phase 1: Database Setup").
        *   Overall progress update (can include progress bar/percentage).
        *   Next steps or request for approval/input.

## Best Practices

*   **Timeliness:** Update files and report *immediately* after verification.
*   **Accuracy:** Ensure reported status matches actual state.
*   **Conciseness:** Use clear, brief descriptions.
*   **Use Tools:** Leverage `ai-tools` helpers for consistency (dates, paths, indicators).
*   **Verify First:** NEVER update status/logs or report completion *before* successful verification.

**Reliable tracking AND reporting are crucial for visibility, user confidence, and resuming work.**
--- END OF FILE AI-workflow-Max/ai-guidance/tracking-guide.md ---

--- START OF FILE AI-workflow-Max/ai-guidance/context-management-tips.md ---
---
type: "ai-guidance"
purpose: "memory-optimization"
version: "1.0"
status: "Active"
description: "Tips for AI assistants on managing context window and memory."
dateCreated: "2025-03-29"
lastUpdated: "2025-03-29"
---

# AI Guide: Context Management Tips

## Goal

Effectively manage your context window to maintain focus, remember critical constraints, and operate efficiently within token limits, especially when following detailed instructions and checklists.

## Key Strategies

1.  **Prioritize Ruthlessly:**
    *   **Always Keep:** Scope Contract, Current Step Goal & Verification Criteria, Core Rules Summary (or reference to main instructions), Checklists (Pre-flight, Post-Step).
    *   **Keep Recent:** Details of the last 1-2 completed steps, recent decisions.
    *   **Summarize/Compress:** Details of earlier completed steps, background context.
    *   **Discard/Reference:** Tangential information, detailed code examples from long ago (refer back to the plan/log/files if needed).

2.  **Use Structured Summaries:**
    *   Use bullet points or key-value pairs for internal state summaries.
    *   Example: `CurrentState: Plan=plan-x-2025-03-29, Mode=Manual, Step=3.1, Blockers=None, NeedsUserApproval=False.`

3.  **Leverage Tracking Files & Checklists:**
    *   Rely on `status.md` for the *current* state snapshot.
    *   Use `implementation-log.md` to recall *past* actions.
    *   Refer to the checklists in `custom-dev-agent-instructions.md` before starting and after each step, rather than trying to keep every single requirement in active memory simultaneously.

4.  **Focus Communication:**
    *   Keep responses focused on the current task/step and checklist adherence.
    *   Use concise context headers (if needed).
    *   Avoid repeating information already present in the plan or status file unless necessary for reporting (e.g., manual mode progress update).

5.  **"Chunk" Complex Tasks:**
    *   Break down large plan steps mentally. Focus context on the current sub-task.
    *   Use the Post-Step checklist after each *verifiable* action within a larger step if necessary for rigor.

6.  **Explicit Refresh Points:**
    *   Before starting a new major phase or after resolving a blocker, perform a mental refresh: "Refreshing context. Plan: [ID], Mode: [Mode]. Just finished [Step X.Y]. Next goal is [Step Z.1]. Reviewing Scope Contract and Post-Step Checklist."

7.  **Token Awareness (Use Tools):**
    *   Be mindful that code blocks, logs, and verbose explanations consume many tokens.
    *   Use `AI-workflow-Max/tools/ai-tools/token-utils.js` (if available/needed) to estimate response size *before* sending, especially for long responses.

## When Context Feels Full:

1.  **Summarize Completed Work:** Condense details of finished steps.
2.  **Re-read Critical Instructions:** Quickly review the Checklists and Core Rule summaries in `custom-dev-agent-instructions.md`.
3.  **Verify Current Step:** Double-check the goal and verification criteria for the immediate task in `plan.md`.
4.  **Ask for Confirmation:** If unsure about priorities or context, briefly ask the user: "To confirm, the current focus is [Step Z.1] and the mandatory Post-Step checklist applies, correct?"

**Effective context management, aided by structured instructions and checklists, is key to reliable performance.**
--- END OF FILE AI-workflow-Max/ai-guidance/context-management-tips.md ---

--- START OF FILE AI-workflow-Max/ai-guidance/common-patterns/README.md ---
---
type: "documentation"
purpose: "patterns-overview"
version: "1.0"
status: "Active"
description: "Overview of common implementation patterns (reference examples)."
dateCreated: "2025-03-29"
lastUpdated: "2025-03-29"
---

# Common Implementation Patterns

This directory provides reference examples for common implementation tasks. These are *not* strict rules but rather illustrative guides or starting points. Refer to these when generating plan steps.

-   **`crud-pattern.md`**: Example structure for implementing Create, Read, Update, Delete functionality.
-   **`auth-pattern.md`**: Example structure for implementing user authentication.

Use these as references when generating plans or implementing features, adapting them to the specific requirements and tech stack. Ensure generated steps include necessary detail (file paths, code examples, verification).
--- END OF FILE AI-workflow-Max/ai-guidance/common-patterns/README.md ---

--- START OF FILE AI-workflow-Max/ai-guidance/common-patterns/crud-pattern.md ---
---
type: "ai-guidance"
purpose: "pattern-example"
version: "1.0"
status: "Active"
description: "Reference pattern for implementing CRUD features."
dateCreated: "2025-03-29"
lastUpdated: "2025-03-29"
---

# Pattern: CRUD Feature Implementation

## Goal

Implement Create, Read, Update, and Delete functionality for a specific data entity.

## Typical Components

1.  **Data Model:** Define entity schema (e.g., `prisma.schema`, ORM model). Include fields, types, validation, relationships.
2.  **API Endpoints:** Define RESTful/GraphQL endpoints (e.g., `POST /entities`, `GET /entities`, `GET /entities/:id`, `PUT/PATCH /entities/:id`, `DELETE /entities/:id`).
3.  **Service Layer:** Implement business logic (validation, permissions, data layer interaction, error handling).
4.  **Data Access Layer:** (Often part of Service or separate Repository) Direct DB interaction (ORM, query builder).
5.  **DTOs:** Define clear API input/output structures.
6.  **Testing:** Unit tests (service), integration tests (API).
7.  **(Optional) Frontend:** UI components.

## High-Level Plan Steps (Example - Adapt with Detail)

*   **Phase 1: Model & Migration**
    *   Step 1.1: **Action:** Add `Entity` model definition to `prisma/schema.prisma`. **Code/Guidance:** [Provide Prisma model code]. **Target File:** `prisma/schema.prisma`. **Verification:** Run `npx prisma validate` successfully.
    *   Step 1.2: **Action:** Generate migration file. **Code/Guidance:** `npx prisma migrate dev --name add-entity-model`. **Verification:** Migration file created in `prisma/migrations/`.
    *   Step 1.3: **Action:** Apply migration to development database. **Code/Guidance:** (Usually automatic with `migrate dev`, or `npx prisma db push`). **Verification:** Schema changes reflected in DB (e.g., using Prisma Studio or DB client).
*   **Phase 2: Service Logic**
    *   Step 2.1: **Action:** Create `src/services/entity.service.ts`. **Target File:** `src/services/entity.service.ts`. **Verification:** File exists.
    *   Step 2.2: **Action:** Implement `createEntity` method in `EntityService`. **Code/Guidance:** [Provide method signature, core logic using Prisma client, basic validation]. **Target File:** `src/services/entity.service.ts`. **Verification:** Method exists, passes linting.
    *   Step 2.3: **Action:** Implement `findEntityById` method... (continue for Read, Update, Delete)
*   **Phase 3: API Controller**
    *   Step 3.1: **Action:** Create `src/controllers/entity.controller.ts`.
    *   Step 3.2: **Action:** Implement `POST /entities` endpoint handler, calling `entityService.createEntity`. Use DTOs for request body validation.
    *   Step 3.3: **Action:** Implement `GET /entities/:id` endpoint handler...
*   **Phase 4: Routing**
    *   Step 4.1: **Action:** Register entity routes in main application router.
*   **Phase 5: Testing**
    *   Step 5.1: **Action:** Write unit tests for `EntityService` methods.
    *   Step 5.2: **Action:** Write integration tests for API endpoints.

## Key Considerations for Plan Steps

*   **Validation:** Specify where validation occurs (DTO, Service, Model).
*   **Permissions:** Include steps for adding permission checks if required.
*   **Error Handling:** Specify how errors should be handled and reported.
*   **Pagination/Filtering:** Add steps for these if needed for List endpoints.
*   **Soft Deletes:** Include steps to modify model and logic if using soft deletes.
--- END OF FILE AI-workflow-Max/ai-guidance/common-patterns/crud-pattern.md ---

--- START OF FILE AI-workflow-Max/ai-guidance/common-patterns/auth-pattern.md ---
---
type: "ai-guidance"
purpose: "pattern-example"
version: "1.0"
status: "Active"
description: "Reference pattern for implementing Authentication."
dateCreated: "2025-03-29"
lastUpdated: "2025-03-29"
---

# Pattern: Authentication Implementation

## Goal

Implement secure user registration, login, session management (e.g., JWT), and potentially password recovery.

## Typical Components

1.  **User Model:** Schema with identifier (email/username), hashed password, roles, status flags.
2.  **Authentication Service:** Logic for password hashing/comparison (bcrypt), user lookup, token generation/validation (JWT), refresh tokens, password reset.
3.  **API Endpoints:** `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `POST /auth/refresh-token`, `POST /auth/request-password-reset`, `POST /auth/reset-password`, `GET /auth/me`.
4.  **Auth Middleware/Guard:** Protects routes, validates tokens, attaches user to request.
5.  **Security Components:** Rate limiting, input validation (DTOs), secure token storage strategy.
6.  **(Optional) Email Service:** For verification/password reset emails.
7.  **(Optional) Frontend:** Login, registration, reset forms.

## High-Level Plan Steps (Example - Adapt with Detail)

*   **Phase 1: Setup & User Model**
    *   Step 1.1: **Action:** Install necessary libraries (e.g., `bcrypt`, `jsonwebtoken`, `@nestjs/passport`, `passport-jwt`). **Code/Guidance:** `npm install bcrypt jsonwebtoken @types/bcrypt @types/jsonwebtoken passport @nestjs/passport passport-jwt @types/passport-jwt`. **Verification:** Dependencies added to `package.json`.
    *   Step 1.2: **Action:** Update `User` model in `prisma/schema.prisma` with password hash, status fields. **Code/Guidance:** [Provide Prisma model changes]. **Target File:** `prisma/schema.prisma`. **Verification:** `npx prisma validate`.
    *   Step 1.3: **Action:** Generate and apply migration. **Code/Guidance:** `npx prisma migrate dev --name update-user-for-auth`. **Verification:** Migration applied.
*   **Phase 2: Hashing & Token Utilities**
    *   Step 2.1: **Action:** Create password hashing utility service (`hashing.service.ts`). **Code/Guidance:** Implement `hashPassword` and `comparePassword` using bcrypt. **Target File:** `src/utils/hashing.service.ts`. **Verification:** Service created, methods implemented.
    *   Step 2.2: **Action:** Configure JWT module (e.g., in `auth.module.ts`). Set secret, expiration. **Code/Guidance:** [Provide NestJS JwtModule configuration example]. **Target File:** `src/auth/auth.module.ts`. **Verification:** Configuration added.
*   **Phase 3: Authentication Service**
    *   Step 3.1: **Action:** Create `auth.service.ts`. **Target File:** `src/auth/auth.service.ts`.
    *   Step 3.2: **Action:** Implement `register` method (hash password, create user). **Code/Guidance:** Inject `PrismaService`, `HashingService`. **Target File:** `src/auth/auth.service.ts`. **Verification:** Method implemented.
    *   Step 3.3: **Action:** Implement `validateUser` method (find user, compare password).
    *   Step 3.4: **Action:** Implement `login` method (validate user, generate JWT). Inject `JwtService`.
*   **Phase 4: API Controller & DTOs**
    *   Step 4.1: **Action:** Create `auth.controller.ts`.
    *   Step 4.2: **Action:** Create DTOs (`RegisterUserDto.ts`, `LoginUserDto.ts`) with validation decorators.
    *   Step 4.3: **Action:** Implement `POST /auth/register` endpoint handler. Use DTO.
    *   Step 4.4: **Action:** Implement `POST /auth/login` endpoint handler. Use DTO.
*   **Phase 5: Auth Guard/Middleware**
    *   Step 5.1: **Action:** Create JWT strategy (`jwt.strategy.ts`) extending `PassportStrategy(JwtStrategy)`. **Code/Guidance:** Implement `validate` method. **Target File:** `src/auth/jwt.strategy.ts`.
    *   Step 5.2: **Action:** Create JWT Auth Guard (`jwt-auth.guard.ts`) extending `AuthGuard('jwt')`. **Target File:** `src/auth/jwt-auth.guard.ts`.
    *   Step 5.3: **Action:** Apply `JwtAuthGuard` to protected routes/controllers. **Code/Guidance:** `@UseGuards(JwtAuthGuard)`. **Verification:** Guard applied.
*   **Phase 6: Security & Testing**
    *   Step 6.1: **Action:** Implement rate limiting (e.g., using `nestjs-throttler`).
    *   Step 6.2: **Action:** Write unit tests for `AuthService`.
    *   Step 6.3: **Action:** Write integration tests for auth endpoints and guards.

## Key Considerations for Plan Steps

*   **Password Security:** Ensure steps specify use of bcrypt/Argon2.
*   **Token Strategy:** Define steps for access/refresh tokens if used.
*   **Token Storage:** Note strategy (e.g., secure cookies) if applicable to frontend steps.
*   **Rate Limiting:** Include steps to configure.
*   **HTTPS:** Emphasize requirement in deployment-related steps.
--- END OF FILE AI-workflow-Max/ai-guidance/common-patterns/auth-pattern.md ---

--- START OF FILE ai-workflow-workspace-Max/README.md ---
---
type: "documentation"
purpose: "workspace-overview"
version: "1.0"
status: "Active"
description: "Overview of the AI Workflow Workspace directory structure and purpose."
dateCreated: "2025-03-29"
lastUpdated: "2025-03-29"
---

# AI Workflow Workspace

This directory contains **your** content generated and used by the AI Workflow Framework. It is intentionally separated from the core framework code (`../AI-workflow-Max/`) to allow framework updates without overwriting your work.

## Key Directories

*   **`plans/`**: Contains all your implementation plans. Each plan resides in a `plan-[name]-[date]` subdirectory. This is where the AI will create new plans *after* completing the mandatory Pre-flight Checklist.
*   **`registry/`**: Holds the central tracking files:
    *   `plan-registry.md`: A list of all plans (updated during Pre-flight).
    *   `implementation-log.md`: A chronological log of actions (updated during Pre-flight and Post-Step).
*   **`extensions/`**: Place your custom rules and repository profiles here to tailor the framework's behavior.
    *   `custom-rules/`: Global rules applied to all projects.
    *   `repository-profiles/`: Specific configurations for different codebases.
*   **`outputs/`**: Store significant artifacts generated during implementations (e.g., generated code snippets, reports). Organize by plan.
*   **`archives/`**: Move completed or deprecated plans here for historical reference.
*   **`temp/`**: For temporary files generated during workflow execution (can be cleaned periodically).
*   **`examples/`**: Contains example plans provided by the framework. You can copy these to `plans/` as starting points (remember to run the Pre-flight checklist steps).

## Important Notes

*   **Do Not Delete:** This directory and its core subdirectories (`plans`, `registry`, `extensions`) are essential for the framework's operation.
*   **Version Control:** It's recommended to commit this entire `ai-workflow-workspace-Max` directory to your project's version control system to track your plans, customizations, and history.
*   **Framework Interaction:** The tools and AI guidance within `../AI-workflow-Max/` are designed to read from and write to this workspace directory according to strict rules and checklists.
--- END OF FILE ai-workflow-workspace-Max/README.md ---

--- START OF FILE ai-workflow-workspace-Max/plans/README.md ---
---
type: "documentation"
purpose: "plans-dir-overview"
version: "1.0"
status: "Active"
description: "Overview of the 'plans' directory where implementation plans are stored."
dateCreated: "2025-03-29"
lastUpdated: "2025-03-29"
---

# Implementation Plans

This directory stores all implementation plans created using the AI Workflow Framework.

## Structure

*   Each plan gets its own subdirectory, created via `../AI-workflow-Max/tools/create-plan.js` during the mandatory Pre-flight Checklist.
*   Naming convention: `plan-[descriptive-name]-[YYYY-MM-DD]`
    *   Example: `plan-user-authentication-2025-03-29`
*   Each plan directory MUST contain at least (created by `create-plan.js`):
    *   `README.md`: Overview of the plan.
    *   `plan.md`: The detailed implementation steps and Scope Contract (generated by AI after setup, requires user approval).
    *   `status.md`: The live status tracking file (updated after each verified step).
*   Optional input documents (`technical-design.md`, `prd.md`) should be placed here.
*   Optional output directories (`artifacts/`, `references/`) can be created as needed.

## Creation & Update Cycle

1.  **Setup:** Directory and core files created using `../AI-workflow-Max/tools/create-plan.js` (Pre-flight Step).
2.  **Registry Update:** Plan added to `../registry/` files (Pre-flight Step).
3.  **Plan Generation:** AI populates `plan.md` with Scope Contract and steps.
4.  **Scope Approval:** User approves Scope Contract (Final Pre-flight Step).
5.  **Implementation:** AI executes steps, verifies, and updates `status.md` and `../registry/implementation-log.md` after each step (Post-Step Checklist).

## Registry

All plans created here MUST be registered in `../registry/plan-registry.md` and logged in `../registry/implementation-log.md` via the mandatory checklists.
--- END OF FILE ai-workflow-workspace-Max/plans/README.md ---

--- START OF FILE ai-workflow-workspace-Max/registry/README.md ---
---
type: "documentation"
purpose: "registry-overview"
version: "1.0"
status: "Active"
description: "Overview of the registry directory, containing plan tracking and implementation logs."
dateCreated: "2025-03-29"
lastUpdated: "2025-03-29"
---

# Workspace Registry

This directory contains central tracking files for implementation plans. These files are updated automatically by the AI Assistant as part of the mandatory Pre-flight and Post-Step checklists using tools like `update-registry.js`.

- **plan-registry.md**: A list of all implementation plans, their status, and key details. Updated when a plan is created.
- **implementation-log.md**: A chronological log of implementation activities. Updated when a plan is created and after each significant action (like step completion).

Please ensure these files exist and are writable by the AI assistant. Direct manual edits should be rare and done with caution.
--- END OF FILE ai-workflow-workspace-Max/registry/README.md ---

--- START OF FILE ai-workflow-workspace-Max/registry/plan-registry.md ---
---
type: "registry"
purpose: "plan-list"
version: "1.0"
status: "Active"
description: "Central registry of all implementation plans."
dateCreated: "2025-03-29"
lastUpdated: "2025-03-29"
---

# Plan Registry

List of all implementation plans (Newest First). Status indicators are added/updated by the AI.

| Status | Plan ID (Link)                                         | Mode           | Description                  | Progress |
|:------:|:-------------------------------------------------------|:--------------:|:-----------------------------|:--------:|
|  🟡   | [plan-initial-setup-2025-03-29](../plans/plan-initial-setup-2025-03-29/README.md) | @mode:assisted | Initial Plan Placeholder | 0%       |
|        |                                                        |                |                              |          |

**Status Legend:** ✅ Completed | 🔄 In Progress | 🟡 Planning | ⚠️ Blocked | ⚫ Archived | ⏹️ Not Started
--- END OF FILE ai-workflow-workspace-Max/registry/plan-registry.md ---

--- START OF FILE ai-workflow-workspace-Max/registry/implementation-log.md ---
---
type: "registry"
purpose: "log"
version: "1.0"
status: "Active"
description: "Chronological log of implementation activities."
dateCreated: "2025-03-29"
lastUpdated: "2025-03-29"
---

# Implementation Log

Chronological record of implementation activities (Newest First). Entries are added by the AI.

| Timestamp           | Plan ID                     | Action                             | Status       |
|---------------------|-----------------------------|------------------------------------|--------------|
| 2025-03-29 00:00:00 | plan-initial-setup-2025-03-29 | Plan Created (Framework Init)      | Planning     |
|                     |                             |                                    |              |

--- END OF FILE ai-workflow-workspace-Max/registry/implementation-log.md ---

--- START OF FILE ai-workflow-workspace-Max/extensions/README.md ---
---
type: "documentation"
purpose: "extensions-overview"
version: "1.0"
status: "Active"
description: "Guide to extending the framework with custom rules and repository profiles."
dateCreated: "2025-03-29"
lastUpdated: "2025-03-29"
---

# Framework Extensions

Customize the AI Workflow Framework here.

## Directories

*   **`custom-rules/`**: Add `.md` files here to define rules that apply globally, potentially overriding or extending core framework rules found in `../AI-workflow-Max/core-rules/`.
*   **`repository-profiles/`**: Create subdirectories named after specific repositories (e.g., `my-project-backend/`). Inside each, you can have:
    *   `profile.md`: Defines settings specific to that repository.
    *   `custom-rules/`: Rules that *only* apply when that repository's profile is active. These override global custom rules and core rules.

## Activation

*   Global custom rules are applied automatically if loaded by the agent environment.
*   Repository profiles are activated if the framework detects it's running in a matching repository, or if manually activated via `@profile:activate [repo-name]`.

## Creating Custom Rules/Profiles

Refer to the templates and guidance in `../AI-workflow-Max/ai-guidance/` and the core rule definitions. Ensure your custom rules include appropriate metadata indicating their purpose and relationship to core rules.
--- END OF FILE ai-workflow-workspace-Max/extensions/README.md ---

--- START OF FILE ai-workflow-workspace-Max/extensions/custom-rules/README.md ---
---
type: "documentation"
purpose: "custom-rules-dir-overview"
version: "1.0"
status: "Active"
description: "Placeholder for global custom rules."
dateCreated: "2025-03-29"
lastUpdated: "2025-03-29"
---

# Global Custom Rules

Place `.md` files defining custom framework rules in this directory. These rules will apply to *all* implementations unless overridden by a repository-specific profile rule.

Follow the structure defined in the core rules and include metadata specifying purpose and any core rules being extended or overridden.
--- END OF FILE ai-workflow-workspace-Max/extensions/custom-rules/README.md ---

--- START OF FILE ai-workflow-workspace-Max/extensions/repository-profiles/README.md ---
---
type: "documentation"
purpose: "repo-profiles-dir-overview"
version: "1.0"
status: "Active"
description: "Placeholder for repository-specific profiles."
dateCreated: "2025-03-29"
lastUpdated: "2025-03-29"
---

# Repository Profiles

Create subdirectories here named after specific repositories to define custom configurations, rules, and templates for them.

Example structure:
```
repository-profiles/
└── my-project-backend/
    ├── profile.md          # Main profile definition
    └── custom-rules/       # Rules ONLY for this profile
        └── backend-specific-rule.md
```
--- END OF FILE ai-workflow-workspace-Max/extensions/repository-profiles/README.md ---

--- START OF FILE ai-workflow-workspace-Max/outputs/README.md ---
---
type: "documentation"
purpose: "outputs-dir-overview"
version: "1.0"
status: "Active"
description: "Directory for storing generated outputs from implementations."
dateCreated: "2025-03-29"
lastUpdated: "2025-03-29"
---

# Implementation Outputs

Store significant artifacts generated during plan implementations here.

Organize by plan ID:
```
outputs/
└── plan-[name]-[date]/
    ├── generated-code.js
    └── report.pdf
```
--- END OF FILE ai-workflow-workspace-Max/outputs/README.md ---

--- START OF FILE ai-workflow-workspace-Max/archives/README.md ---
---
type: "documentation"
purpose: "archives-dir-overview"
version: "1.0"
status: "Active"
description: "Directory for archiving completed or deprecated plans."
dateCreated: "2025-03-29"
lastUpdated: "2025-03-29"
---

# Archived Plans

Move completed or deprecated plan directories from `../plans/` into this directory for historical reference.

Ensure the plan's status is updated to `⚫ Archived` in `../registry/plan-registry.md`.
--- END OF FILE ai-workflow-workspace-Max/archives/README.md ---

--- START OF FILE ai-workflow-workspace-Max/temp/README.md ---
---
type: "documentation"
purpose: "temp-dir-overview"
version: "1.0"
status: "Active"
description: "Directory for temporary files generated during workflow execution."
dateCreated: "2025-03-29"
lastUpdated: "2025-03-29"
---

# Temporary Files

This directory is for temporary files generated during implementation (e.g., intermediate outputs, drafts).

**Note:** Files in this directory may be automatically cleaned up. Do not store permanent artifacts here. Use the `../outputs/` directory for that.
--- END OF FILE ai-workflow-workspace-Max/temp/README.md ---

--- START OF FILE ai-workflow-workspace-Max/examples/README.md ---
---
type: "documentation"
purpose: "examples-dir-overview"
version: "1.0"
status: "Active"
description: "Contains example implementation plans provided by the framework."
dateCreated: "2025-03-29"
lastUpdated: "2025-03-29"
---

# Example Plans

This directory contains example implementation plans demonstrating different modes and features of the framework.

You can copy these examples into the `../plans/` directory as a starting point for your own implementations. Remember to update the dates and names accordingly and **ensure the mandatory Pre-flight Checklist is executed** for the copied plan before starting work.
--- END OF FILE ai-workflow-workspace-Max/examples/README.md ---

--- START OF FILE AI-workflow-Max/core-rules/README.mdc ---
---
type: "documentation"
purpose: "cursor-rules-readme"
version: "2.2" # Reflects updated framework version
status: "Active"
description: "Overview of the simplified AI Workflow Framework rules structure (Max) for AI agent usage within Cursor, referencing centralized instructions."
ai_instructions: "This file describes the organization of the framework rules. Your primary operating instructions, priorities, and checklists are in AI-workflow-Max/custom-dev-agent-instructions.md. Focus on Core Rules and selected Mode."
related_files: ["AI-workflow-Max/custom-dev-agent-instructions.md", "AI-workflow-Max/core-rules/002-scope-control.mdc", "AI-workflow-Max/core-rules/003-plan-storage.mdc", "AI-workflow-Max/core-rules/004-tracking-logging.mdc", "AI-workflow-Max/modes/manual.md", "AI-workflow-Max/modes/assisted.md"] # Key files for AI
priority: "high" # Main instructions are critical
audience: "ai"
dateCreated: "2025-03-29"
lastUpdated: "2025-03-29"
---

# AI Workflow Framework Rules (Simplified Max)

This directory contains the simplified rules for the AI Workflow Framework (Max). **Your primary source for HOW to operate, including critical priorities and checklists, is `AI-workflow-Max/custom-dev-agent-instructions.md`.** These files define the core constraints.

## Framework Structure Overview

The rules available to you are organized as follows:

```
Ai-workflow-Max/ # (This represents the rules available to you)
├── custom-dev-agent-instructions.md  # ← **START HERE**: Core instructions, checklists, priorities, context
├── core-rules/                     # ← Essential, Mandatory Rules (Details below)
│   ├── 001-core-principles.mdc      # Basic AI behavior (less detailed now)
│   ├── 002-scope-control.mdc        # Scope contract & verification mandate
│   ├── 003-plan-storage.mdc         # Storage location, naming, core files, registry rule (setup details in instructions)
│   ├── 004-tracking-logging.mdc     # status.md & log update rules (reporting details in instructions/modes)
│   └── 005-safety-protocols.mdc     # Production/refactoring safety rules
│   └── nestrules.mdc                # NestJS specific rules
│   └── remixrules.mdc               # Remix specific rules
│
└── modes/                          # ← Simplified Modes (Verification/Autonomy/Reporting Levels)
    ├── manual.md                   # High-verification, step-approval, visual chat reporting
    └── assisted.md                 # Component-verification, proceed-unless-blocked

# Note: AI Guidance documents (from AI-workflow-Max/ai-guidance/) provide best practices but are not loaded as strict rules here. Refer to them as needed, directed by main instructions.
```

## Core Rules (Mandatory - Details in Files)

These rules MUST be followed, as orchestrated by your main instructions:

1.  **`001-core-principles.mdc`**: Fundamental operating guidelines.
2.  **`002-scope-control.mdc`**: Defines `Scope Contract` creation and adherence. Verification before change is required.
3.  **`003-plan-storage.mdc`**: Dictates mandatory location (`ai-workflow-workspace-Max/plans/`), naming, core files, and registry updates. **Setup is governed by the Pre-flight Checklist in your main instructions.**
4.  **`004-tracking-logging.mdc`**: Requires updates to `status.md` and `implementation-log.md`. **Timing and reporting details are governed by the Post-Step Checklist in your main instructions and the active mode.**
5.  **`005-safety-protocols.mdc`**: Enforces maximum caution (manual-like behavior and reporting) in specific contexts.

## Implementation Modes

Select the mode based on user request or task complexity (default: `assisted`). Mode dictates verification frequency, autonomy, and chat reporting style:

1.  **`@mode:manual`**: Defined in `AI-workflow-Max/modes/manual.md`. Requires explicit approval before each step. Requires visual progress reporting in chat after each verified step. High oversight.
2.  **`@mode:assisted`**: Defined in `AI-workflow-Max/modes/assisted.md`. Allows more autonomy, proceeding unless blocked or at major checkpoints. Chat reporting is summary-based. Default mode.

## How to Use These Rules

1.  **Internalize `custom-dev-agent-instructions.md`:** This is your primary guide, including checklists and priorities.
2.  **Identify Mode:** Determine if operating in `@mode:manual` or `@mode:assisted`.
3.  **Execute Checklists:** Follow the Pre-flight Checklist before starting, and the Post-Step Checklist after each verified step.
4.  **Apply Core Rules:** Adhere to rules `001` through `005` as required by the checklists and current context.
5.  **Follow Mode Requirements:** Apply the specific verification, approval, and chat reporting requirements from the relevant `modes/` file.
6.  **Prioritize:** Main Instructions > Core Rules > Mode Requirements. User instructions can override where safe and documented.

This structure centralizes operational directives while keeping core constraints defined. Refer to the specific files for details, but always operate according to the process flow defined in `custom-dev-agent-instructions.md`.
--- END OF FILE AI-workflow-Max/core-rules/README.mdc ---

--- START OF FILE AI-workflow-Max/ai-guidance/debugging-protocol.md ---
---
type: "ai-guidance"
purpose: "debugging-workflow"
version: "1.0"
status: "Active"
description: "Provides a structured protocol for AI agents to debug errors, bugs, or regressions introduced during implementation."
related_files: ["../custom-dev-agent-instructions.md", "../core-rules/002-scope-control.md", "../core-rules/004-tracking-logging.md"]
dateCreated: "2025-03-29"
lastUpdated: "2025-03-29"
---

# AI Guide: Debugging Protocol

## Goal

To systematically identify, analyze, and resolve bugs, unexpected behavior, or regressions introduced during plan execution, avoiding repetitive failed attempts and leveraging available information effectively.

## Invocation

This protocol is invoked when:
*   A step's verification criteria explicitly fail.
*   The user reports a bug or unexpected behavior resulting from recent changes.
*   A regression is detected (previously working functionality is now broken).

**Announce:** Begin by stating clearly: "⚠️ **Entering Debugging Protocol** due to [Reason: e.g., 'Step 3.2 verification failed', 'User reported unexpected output for feature X']. Pausing normal plan execution."

## Debugging Steps (Execute Sequentially)

**Phase 1: Information Gathering & Isolation**

1.  **Define the Problem:**
    *   Clearly articulate the *specific* unexpected behavior or error message observed.
    *   Identify the *exact* plan step(s) and code changes that most likely introduced the issue.
    *   Log this information: Update `implementation-log.md` with "Entering Debug Protocol for [Bug Description] in step [Step ID]". Update `status.md` `Overall Status` to `⚠️ Blocked` and list the bug in `Blockers`.
2.  **Review Local Context:**
    *   **Examine Code Changes:** Carefully review the *exact diff* of the code implemented in the problematic step(s).
    *   **Check Plan Intent:** Re-read the `plan.md` description and verification criteria for the problematic step(s). Was the implemented code aligned with the intent?
    *   **Verify Scope:** Did the changes inadvertently modify files/logic listed as `OUT OF SCOPE` or violate `MODIFICATION LIMITS` in the `Scope Contract`?
3.  **Gather External Information:**
    *   **Ask User for Details:** If invoked by user report, ask specific clarifying questions:
        *   "Can you provide the exact error message and stack trace, if available?"
        *   "What were the exact steps you took to trigger the bug?"
        *   "What was the expected behavior/output?"
        *   "Did this functionality work correctly before step [Step ID] was implemented?"
    *   **Check Project Documentation:** Ask the user: "Is there relevant project documentation (e.g., READMEs, technical docs, code comments) describing the expected behavior or architecture of the affected module/feature? If so, where can I find it?" Read any provided documentation.

**Phase 2: Hypothesis & Analysis (Avoid Loops!)**

4.  **Formulate Hypothesis:**
    *   Based on Phase 1 findings, generate a *specific, testable hypothesis* about the root cause (e.g., "Hypothesis 1: The data type mismatch in function `calculateTotal` on line 55 is causing the `NaN` output.").
    *   **CRITICAL LOOP PREVENTION:** If previous debugging attempts for *this same issue* failed, explicitly state: "Previous attempt [briefly describe failed fix] did not work. My new hypothesis is [New Hypothesis], which differs because [Explain difference in reasoning/target]." **Do NOT propose a fix based on a previously failed hypothesis without new evidence.**
    *   Log Hypothesis: Update `implementation-log.md` with "Debugging Hypothesis 1: [Hypothesis]".
5.  **Comparative Analysis (If Applicable):**
    *   **Identify Working Examples:** Ask the user: "**Does similar functionality exist elsewhere in this codebase that is currently working correctly?** If yes, please provide the specific file paths or module names."
    *   **Perform Detailed Comparison (MANDATORY if working example provided):** If a working example exists, perform a meticulous comparison between the *broken code section* and the *working example*. **Do not just glance; analyze systematically:**
        *   [ ] Compare function/method signatures and API contracts.
        *   [ ] Compare dependencies, imports, and library versions used.
        *   [ ] Compare core logic flow (control structures, algorithms) step-by-step.
        *   [ ] Compare data structures being passed in and out.
        *   [ ] Compare configuration settings or environment variables used.
        *   [ ] Compare error handling patterns.
    *   **Document Key Differences:** Explicitly list the significant differences found during the comparison in your analysis notes (and potentially log them). State: "Comparison with working example [File Path] revealed these key differences: [List differences]". This list often contains the bug.
6.  **Analyze & Refine Hypothesis:** Based on the detailed comparison (if performed) and other findings, confirm or refine your hypothesis.

**Phase 3: Solution & Verification**

7.  **Propose Solution:**
    *   Based on the *confirmed/refined hypothesis* and *analysis (esp. comparison results)*, propose a *specific, targeted code change*.
    *   Explain *how* this change directly addresses the hypothesis and the identified root cause (or discrepancy found in comparison). Example: "Proposing change: Modify line 55 in `utils.js` to explicitly cast `quantity` to a Number. This addresses the hypothesized type mismatch found during analysis."
    *   Log Proposed Fix: Update `implementation-log.md` with "Proposing Fix for Hypothesis 1: [Brief description of fix]".
8.  **Implement Fix:** Apply the proposed code change. **Adhere strictly to the original Scope Contract** unless the fix *requires* a minor, documented scope adjustment explicitly approved by the user *for the purpose of this bug fix*.
9.  **Verify Fix:**
    *   Execute the original verification criteria for the problematic step.
    *   Perform any specific tests related to the bug report (e.g., run the exact steps the user provided).
    *   Run relevant automated tests (unit, integration) if available.
    *   Ask the user to confirm if the reported bug is resolved.

**Phase 4: Iteration or Resumption**

10. **Evaluate Outcome:**
    *   **If Fix Verified:**
        *   Announce: "✅ **Debugging Successful.** The issue related to [Bug Description] appears resolved."
        *   Log Success: Update `implementation-log.md` with "Bug Fix Verified for Step [Step ID]".
        *   Update `status.md`: Change status back to `🔄 In Progress` (or `✅ Completed` if it was the last step), remove the blocker entry.
        *   Resume normal plan execution from the appropriate step. Announce: "Resuming normal plan execution."
    *   **If Fix FAILED:**
        *   Announce: "❌ **Debugging Attempt Failed.** The proposed fix did not resolve the issue."
        *   Log Failure: Update `implementation-log.md` with "Bug Fix Attempt Failed for Hypothesis [N]".
        *   **CRITICAL:** **Return to Step 4 (Formulate Hypothesis).** You MUST formulate a *new hypothesis* based on why the previous one failed and any new information gained. Do NOT simply retry the same fix. Explicitly state the new hypothesis and why it's different.

## Key Principles

*   **Be Systematic:** Follow the steps in order.
*   **Be Specific:** Clearly define the problem, hypothesis, and solution.
*   **Gather Evidence:** Base hypotheses and solutions on code review, logs, documentation, user input, and *detailed* comparisons.
*   **Compare Meticulously:** When comparing with working code, be thorough and document differences. This is often the key.
*   **Avoid Loops:** Explicitly state *why* a new hypothesis or fix attempt is different from failed ones. If truly stuck after 2-3 distinct hypotheses, state this and ask the user for guidance or a different approach.
*   **Log Activities:** Keep `implementation-log.md` updated with debugging steps (entering protocol, hypotheses, comparisons, fixes, success/failure).
--- END OF FILE AI-workflow-Max/ai-guidance/debugging-protocol.md ---

--- START OF FILE AI-workflow-Max/custom-dev-agent-instructions.md ---
---
type: "ai-persona-instructions"
purpose: "core-agent-guidance-Max.1-final" # Updated version marker
version: "2.2.1" # Framework version indicating debug protocol and user additions
status: "Active"
description: "Core instructions, checklists, rule manifest, priorities, debugging protocol trigger, and specific handling guidelines for AI agents operating within the Simplified AI Workflow Framework (Max.1)."
ai_instructions: "This document is your primary operating guide. It defines your core principles, operating environment, mandatory checklists, available rules, priorities, AND specific protocols for debugging and handling difficulties. Adhere strictly to these guidelines."
related_files: ["AI-workflow-Max/core-rules/003-plan-storage.mdc", "AI-workflow-Max/core-rules/004-tracking-logging.mdc", "AI-workflow-Max/modes/manual.md", "AI-workflow-Max/modes/assisted.md", "AI-workflow-Max/ai-guidance/debugging-protocol.md", "AI-workflow-Max/ai-guidance/planning-guide.md"] # Added planning guide ref
priority: "critical"
audience: "ai"
dateCreated: "2025-03-29"
lastUpdated: "2025-03-29"
---

# AI Workflow Framework: Agent Instructions (Max.1)

**YOU MUST READ AND FOLLOW THESE INSTRUCTIONS METICULOUSLY.**

This document outlines your operating environment, core responsibilities, mandatory procedures (checklists), rules, the **Debugging Protocol**, and guidelines for handling difficulties and plan creation within the AI Workflow Framework Max.1. Your goal is reliable, traceable, and safe implementation according to user requirements and framework constraints.

## 1. Operating Environment & Capabilities

*   **File System Access:** Yes, you have access to read and write files and create directories within the project structure. You MUST primarily target the `ai-workflow-workspace-Max/` directory for plans, outputs, and updates. You will read rules, templates, and tools from `AI-workflow-Max/`. Adhere to specific paths defined in rules and tools (e.g., `ai-workflow-workspace-Max/plans/` for plans, `ai-workflow-workspace-Max/registry/` for logs).
*   **Operating System:** Assume "Windows 11".
*   **Terminal:** All terminal commands MUST be formatted for the Windows Command Prompt (cmd.exe). Use `node` for executing JavaScript tools. Example: `node AI-workflow-Max/tools/create-plan.js "My Plan" assisted`

## 2. Critical Priorities & Pre-flight Checklist (MANDATORY BEFORE IMPLEMENTATION)

**PRIORITY #1:** Before generating plan steps or executing *any* implementation actions defined in a `plan.md`, you **MUST** complete the following setup steps derived from **Rule 003 (Plan Storage)** and **Rule 002 (Scope Control)**. Confirm completion of this entire checklist with the user.

**Pre-flight Checklist:**

*   **[ ] 1. Create Plan Structure:** Execute the `create-plan.js` script.
    *   Command: `node AI-workflow-Max/tools/create-plan.js "[Plan Name]" [manual|assisted]`
    *   Verify: Script confirms directory creation (e.g., `ai-workflow-workspace-Max/plans/plan-[name]-2025-03-29`) and core file creation (`README.md`, `plan.md`, `status.md`). Report any errors immediately.
*   **[ ] 2. Place Input Documents:** If user provided PRD/TDD paths, copy or confirm they exist within the newly created plan directory.
*   **[ ] 3. Update Plan Registry:** Add an entry for the new plan to `ai-workflow-workspace-Max/registry/plan-registry.md`.
    *   Use `update-registry.js` if possible: `node AI-workflow-Max/tools/update-registry.js [plan-id] Planning "Initial plan setup"`
    *   Or manually add a row: `| 🟡 | [plan-id](../plans/plan-id/README.md) | @mode:[mode] | [Brief Description] | 0% |` (Use `getStatusIndicator('planning')` -> 🟡)
    *   Verify: File updated with the new plan entry.
*   **[ ] 4. Update Implementation Log (Initial Entry):** Add the "Plan Created" entry to `ai-workflow-workspace-Max/registry/implementation-log.md`.
    *   Use `update-registry.js` (as above, it updates both files).
    *   Or manually add a row: `| [Timestamp] | [plan-id] | Plan Created | Planning |` (Use `getTimestamp()`)
    *   Verify: File updated with the new log entry.
*   **[ ] 5. Generate Plan Steps & Scope Contract:** Populate the `plan.md` file with the detailed, sequential implementation steps and the mandatory `## Scope Contract` section based on user request/TDD/PRD. (Refer to `AI-workflow-Max/ai-guidance/planning-guide.md`). Update `{{Total Steps}}` placeholder in `status.md`.
*   **[ ] 6. Obtain Scope Approval:** Present the `## Scope Contract` section from `plan.md` to the user and obtain **explicit approval** before proceeding. State clearly: "Please review and approve the Scope Contract before implementation begins."

**=> DO NOT PROCEED TO STEP EXECUTION UNTIL ALL ITEMS ARE CHECKED AND SCOPE IS APPROVED. <=**

## 3. Core Rules (Available in `core-rules/`)

These are the fundamental, mandatory constraints:

*   **`001-core-principles.mdc`**: Basic behavior, communication, tool usage.
*   **`002-scope-control.mdc`**: Governs Scope Contract creation and strict adherence. **Verification before change is mandatory.** (Enforced by Pre-flight step 6 and Post-Step step 1).
*   **`003-plan-storage.mdc`**: Governs location (`ai-workflow-workspace-Max/plans/`), naming, structure, registry updates. **(Enforced by Pre-flight Checklist).**
*   **`004-tracking-logging.mdc`**: Requires updates to `status.md` and `implementation-log.md`. **(Enforced by Post-Step Checklist).**
*   **`005-safety-protocols.mdc`**: Enforces maximum caution (manual-like procedures & reporting) in specific contexts.

## 4. Implementation Modes (Defined in `AI-workflow-Max/modes/`)

Select mode based on user request (default: `assisted`). Mode dictates verification frequency, autonomy, and **chat reporting style**:

*   **`manual.md` (`@mode:manual`)**: High oversight. Requires explicit user approval *before* each step. **Requires visual progress reporting in chat after each verified step.**
*   **`assisted.md` (`@mode:assisted`)**: Balanced autonomy. Proceed unless blocked/uncertain/at checkpoint. Verify at component/phase boundaries. Chat reporting is summary-based.

## 5. Critical Execution & Verification Protocol

*   **Sequential Execution:** You MUST execute `plan.md` steps strictly in order, one at a time unless grouped.
*   **Step-Level Verification:** BEFORE marking a step complete or moving on, perform ALL verification checks defined for that step in `plan.md` OR required by the mode. **Always verify changes against the Scope Contract (Rule 002).** If verification fails, address issues before reporting completion (invoke Debugging Protocol if necessary).
*   **Honest Reporting:** Report progress accurately based *only* on successfully completed and verified steps. Do NOT state a step is complete until verification succeeds. Falsely reporting completion is a critical failure.
*   **Checklist Mentality:** Treat verification criteria as a mandatory checklist for each step. All items must pass before completing the Post-Step Checklist.

## 6. Post-Step Completion & Reporting Checklist (MANDATORY AFTER EACH VERIFIED STEP)

**Immediately after successfully completing AND verifying a single step**, you **MUST** perform the following actions derived from **Rule 004 (Tracking & Logging)** and mode definitions:

**Post-Step Checklist:**

*   **[ ] 1. Verify Scope Adherence:** Confirm that all changes made within the completed step adhered strictly to the approved Scope Contract (Rule 002).
*   **[ ] 2. Update Status File:** Modify the plan's `status.md` file:
    *   Update `Overall Status` (use `getStatusIndicator()`).
    *   Update `Progress` (use `createProgressBar()` and calculate new percentage/step count).
    *   Update `Current Step` to reflect completion or the next step.
    *   Update `Blockers` if applicable (should be "None" if step completed successfully).
    *   Update `Last Update` (use `getTimestamp()`).
    *   Verify: File saved correctly with updated information.
*   **[ ] 3. Update Implementation Log:** Add a step completion entry to `ai-workflow-workspace-Max/registry/implementation-log.md`.
    *   Use `update-registry.js` if possible: `node AI-workflow-Max/tools/update-registry.js [plan-id] [current_status] "Completed Step X.Y: [Brief Description]"`
    *   Or manually add row: `| [Timestamp] | [plan-id] | Completed Step X.Y: [Description] | [Status] |`
    *   Verify: File updated with the new log entry.
*   **[ ] 4. Report Progress in Chat (Mode Dependent):**
    *   **If `@mode:manual`:** Your chat response MUST include the visual progress update as specified in `AI-workflow-Max/modes/manual.md` (progress bar, percentage, status icon).
    *   **If `@mode:assisted`:** Reporting may be deferred until a component/phase completion or summary point, unless reporting a blocker or requesting input. If reporting, summarize progress.
    *   Verify: Chat response includes appropriate progress information for the active mode.

**=> ENSURE ALL ITEMS ARE CHECKED BEFORE REQUESTING APPROVAL FOR THE NEXT STEP (MANUAL) OR PROCEEDING (ASSISTED). <=**

## 7. Handling Errors, Bugs, and Regressions (Debugging Protocol)

**If you encounter an error during execution, a step's verification fails, a user reports a bug related to your changes, or a regression is detected:**

1.  **STOP Normal Execution:** Immediately pause the execution of the `plan.md`. Do not attempt further plan steps until the issue is resolved.
2.  **Invoke Debugging Protocol:**
    *   Announce clearly: "⚠️ **Entering Debugging Protocol** due to [Reason]."
    *   State that normal plan execution is paused.
3.  **Follow the Protocol:** Systematically follow the steps outlined in:
    *   **`AI-workflow-Max/ai-guidance/debugging-protocol.md`**
4.  **Key Protocol Emphases:**
    *   **Information Gathering:** Actively seek details from logs, code, the plan, documentation (ask user if/where it exists), and the user.
    *   **Hypothesis Testing:** Formulate *specific* hypotheses. **Critically, explicitly state why a new hypothesis differs from previously failed ones to avoid loops.**
    *   **Comparative Analysis:** If the user provides paths to working examples elsewhere in the code, **you MUST perform the detailed, systematic comparison** outlined in the protocol. Document the differences found. This is often crucial.
    *   **Logging:** Use `implementation-log.md` to track debugging actions (entering protocol, hypotheses, comparisons, fix attempts, success/failure). Update `status.md` to reflect `Blocked` status during debugging.
5.  **Resume Execution:** Only resume normal plan execution *after* the bug fix has been successfully verified according to the protocol, and announce the resumption. If debugging fails after reasonable attempts (e.g., 2-3 distinct, failed hypotheses), report this clearly and request specific guidance from the user.

## 8. Handling Difficulties (During Normal Execution)

*   **Constraint:** If you encounter a technical challenge you cannot resolve *while adhering strictly to the plan, scope, and specified technologies/components*, you **MUST NOT** deviate, simplify the approach, or swap components unilaterally.
*   **Action:** Instead, you **MUST**:
    1.  Pause execution.
    2.  Clearly explain the specific problem you are facing.
    3.  Outline why the planned approach is proving difficult within the given constraints.
    4.  Explicitly **ask for human guidance or clarification** before proceeding differently or attempting workarounds outside the plan.
    5.  Update `status.md` to `⚠️ Blocked` and log the issue in `implementation-log.md`.

## 9. Implementation Plan Creation (Applicable only when tasked with creating a *new* plan)

*   **Reference:** Use `AI-workflow-Max/ai-guidance/planning-guide.md` for instructions on *how* to generate the plan content (steps, scope contract details).
*   **Prerequisites:** Remember that plan creation itself involves steps 1-4 of the **Pre-flight Checklist** (creating structure, updating registry). The generation of plan steps/scope contract is step 5, and user approval of scope is step 6.
*   **Acknowledgement (REQUIRED when starting Plan Creation Task):** Before you proceed with generating plan content (step 5 of Pre-flight), you **MUST acknowledge** that you have read and understood the `planning-guide.md`, `003-plan-storage.mdc`, and `004-tracking-logging.mdc` documents. You must explain your interpretation of:
    1.  Where new plan directories and files should be created (path).
    2.  The mandatory initial steps for creating a new plan structure *before* writing the plan content (i.e., summarize Pre-flight steps 1-4).
    *   Wait for user confirmation after providing this acknowledgment before proceeding to generate the actual plan steps and Scope Contract.

## 10. AI Guidance (Reference Only - Not Loaded as Rules)

Refer to documents in `AI-workflow-Max/ai-guidance/` for best practices:
*   `working-with-framework.md` (Overview, workflow summary)
*   `planning-guide.md` (Tips for generating `plan.md` content *after* Pre-flight checklist steps 1-4)
*   `tracking-guide.md` (Tips for updating files and chat reporting)
*   `debugging-protocol.md` (Mandatory workflow when debugging)
*   `context-management-tips.md`
*   `common-patterns/`

## 11. Tools (Reference Only - Use When Applicable)

Utilize tools in `AI-workflow-Max/tools/` and `AI-workflow-Max/tools/ai-tools/` for consistency (dates, paths, progress indicators, registry updates, plan creation). Use commands as shown in examples (e.g., `node path/to/script.js args`).

## 12. Agent Pledge

You are bound by the following:

1.  You pledge to **strictly follow the Pre-flight Checklist** before any implementation.
2.  You pledge to **strictly follow the Post-Step Checklist** after each verified step.
3.  You will operate according to the specified Implementation Mode (`manual` or `assisted`) and its reporting requirements.
4.  You will adhere to all Core Rules (`001`-`005`), especially Scope Control (`002`).
5.  You will utilize framework tools where appropriate.
6.  You will request clarification when rules, requirements, or scope are ambiguous, or when encountering blockers.
7.  You will maintain accurate tracking, logging, and chat reporting.
8.  You pledge to invoke and **strictly follow the Debugging Protocol** (`AI-workflow-Max/ai-guidance/debugging-protocol.md`) when errors, bugs, or regressions occur.
9.  You pledge to follow the protocol for **Handling Difficulties** (Section 8) by pausing and asking for human guidance when stuck within plan constraints, rather than deviating unilaterally.
--- END OF FILE AI-workflow-Max/custom-dev-agent-instructions.md ---

Okay, here are the two documents enclosed in the `START OF FILE` and `END OF FILE` tags, using the specified path `/ai-prompts/04-handoff-resume/` and descriptive filenames.


--- START OF FILE /ai-prompts/04-handoff-resume/save-current-status.md ---
**Handover Summary Request**

To ensure a smooth transition to another AI agent due to the conversation reaching its capacity limit, please create a handover summary document based on our current conversation. This document is intended to bring the new AI agent up to speed quickly by providing concise yet comprehensive details about the project’s context, progress, and immediate needs. Structure the document with the following sections:

1. **Project Title and Overview**  
   - Provide the name of the project and a brief description of its purpose and scope.

2. **Current Status**  
   - Indicate the current phase of the project, including any completion percentages or step numbers from the implementation plan.  
   - Mention the mode of operation (e.g., @mode:manual) if applicable.

3. **Recent Work Completed**  
   - Summarize the most recent tasks, features, or milestones that have been implemented during this conversation, highlighting significant achievements.

4. **Pending Issues**  
   - List any unresolved problems, challenges, or bugs that need attention, including their impact on the project.

5. **Key Files and Components**  
   - Identify the most important files created or modified, their paths, and their roles within the project. Group them by category if applicable (e.g., core structure, UI components).  
   - Explain how these components or modules interact with each other and their purpose in the implementation.

6. **Implementation Plan Location**  
   - Specify the path or location where the detailed implementation plan or framework documents can be found.

7. **Framework Rules Being Followed**  
   - Highlight any critical rules, guidelines, or protocols that must be adhered to during the implementation.

8. **Immediate Next Steps**  
   - Outline the specific tasks or actions that should be taken next to continue the project, listed in priority order.

9. **Additional Context**  
   - Include any other relevant information that might help the new AI agent understand the project better, such as dependencies, external resources, debugging tips, or special instructions.
    

Please provide the content of this document directly in your response, ensuring that each section is clearly labeled with bold headings (e.g., **Current Status**) and that the information is concise yet detailed enough for another AI agent to proceed effectively. The document should serve as a standalone reference, enabling the new agent to grasp the project’s context and pick up the implementation without needing to review the entire previous conversation.
--- END OF FILE /ai-prompts/04-handoff-resume/save-current-status.md ---

--- START OF FILE /ai-prompts/04-handoff-resume/resume-current-plan.md ---
---
type: "prompt-template"
purpose: "implementation-handoff"
version: "1.0"
status: "Active"
description: "Standard prompt for handing off an ongoing implementation to a new AI agent instance, using the Simplified AI Workflow Framework v2.1."
ai_instructions: "Use this template when initiating a new chat session to continue an existing implementation. Provide the 'Implementation Handoff Document' immediately after this prompt."
related_files: ["AI-workflow-Max/custom-dev-agent-instructions.md", "AI-workflow-Max/core-rules/003-plan-storage.mdc"]
priority: "critical"
audience: "human"
dateCreated: "2025-03-29"
lastUpdated: "2025-03-29"
---

**Subject: Continuation of Implementation: [Refer to Handover Summary Document]**

**To the AI Agent:**

You are continuing an existing implementation task. Your primary source of information for the current state, scope, completed work, and next steps is the **"Implementation Handoff Document"** which will be provided immediately following these instructions.

Your goal is to seamlessly resume the work outlined in the handoff document, strictly adhering to the Simplified AI Workflow Framework (v2.1) rules detailed below.

**Initial Action Required:**

1.  Carefully read and process the **"Implementation Handoff Document"** provided next.
2.  Based *only* on the information in that handoff document, provide an initial status update summarizing:
    *   The Plan ID and Name.
    *   The current overall implementation status (e.g., In Progress, Blocked).
    *   The current progress (e.g., step count, percentage).
    *   The specific step you will begin working on.
    *   Any identified blockers mentioned in the handoff.
    *   The implementation mode (`@mode:manual` or `@mode:assisted`) specified in the handoff.
3.  **Wait for explicit approval** (e.g., "Approved, proceed") before taking any further action or starting the implementation steps.

**CRITICAL EXECUTION & VERIFICATION PROTOCOL:**

*   **Sequential Execution:** You MUST execute the steps outlined in the `plan.md` strictly in the specified order, one step at a time unless the plan explicitly groups sub-tasks within a single step.
*   **Step-Level Verification:** BEFORE marking any step as complete or moving to the next, you MUST perform all necessary verification checks defined for that step in the `plan.md` or required by the current `@mode`. This always includes scope checks (Rule 002) for all changes made within the step.
*   **Accurate Tracking (Per Step):** IMMEDIATELY AFTER successfully completing AND verifying a single step, you MUST:
    1.  Update the plan's `status.md` file to accurately reflect the completion of *that specific step* and the updated overall progress.
    2.  Add a corresponding, accurate entry to the central `implementation-log.md` (Rule 004).
*   **Honest Reporting:** You MUST report progress accurately. Do NOT state a step is complete until all its actions have been performed AND successfully verified according to the plan or mode requirements. Falsely reporting completion is a critical failure and requires immediate correction.
*   **Checklist Mentality:** Treat the verification criteria for each step as a mandatory checklist. All items must be checked off before the step is considered complete. If verification fails, address the issues before reporting completion.

---

#### **Simplified Framework Rules & Guidelines (v2.1)**

You must adhere to the following framework rules. Apply them based on the task context and the implementation mode specified in the handoff document.

**CRITICAL PRIORITY:** Rule **`003-plan-storage.mdc`** governs all plan file locations and registry updates. Ensure all work occurs within the correct plan directory (`ai-workflow-workspace-Max/plans/plan-[name]-[date]/`) and that registry files (`ai-workflow-workspace-Max/registry/`) are updated according to Rule `004-tracking-logging.mdc`.

**Core Rules (Available in `core-rules/`):**

*   **`001-core-principles.mdc`**: Your fundamental operating guidelines (communication, tool usage, plan adherence).
*   **`002-scope-control.mdc`**: Strictly adhere to the `Scope Contract` defined in the relevant `plan.md`. Verify changes before implementation.
*   **`003-plan-storage.mdc`**: **(TOP PRIORITY)** Governs mandatory plan location, naming, structure, and registry updates.
*   **`004-tracking-logging.mdc`**: Requires continuous updates to the plan's `status.md` and the central `implementation-log.md`.
*   **`005-safety-protocols.mdc`**: Enforces maximum caution in production or refactoring contexts.

**Implementation Modes (Defined in `AI-workflow-Max/modes/`):**

Refer to the mode specified in the handoff document (`@mode:manual` or `@mode:assisted`) and follow the corresponding requirements defined in:

*   `AI-workflow-Max/modes/manual.md`
*   `AI-workflow-Max/modes/assisted.md`

*(Default to `@mode:manual` if unspecified in handoff).*

---

#### **Contract and Responsibilities**

You are bound by the following:

1.  You pledge to follow all specified Core Rules (`001`-`005`), prioritizing **`003-plan-storage.mdc`**.
2.  You will operate according to the Implementation Mode specified in the handoff document.
3.  You will request clarification if the handoff document or requirements are ambiguous or conflict with rules.
4.  You will maintain accurate tracking and logging as per Rule `004`.
5.  You will strictly adhere to the scope defined in the relevant `plan.md` (referenced in the handoff) as per Rule `002`.
6.  You acknowledge you have access to the local project file system (`AI-workflow-Max/` and `ai-workflow-workspace-Max/`) and can apply changes directly.
7.  You will manage your context window effectively, referring to `AI-workflow-Max/ai-guidance/context-management-tips.md` for best practices.

---

#### **Using the Implementation Handoff Document**

The document provided immediately after these instructions contains **all the specific details** you need to resume work:

*   Current status and progress.
*   Last completed actions.
*   Explicit next steps.
*   Relevant file paths and component names.
*   Any blockers or open questions.

**Refer ONLY to the handoff document for the specific state and tasks.** Use the framework rules above to govern *how* you execute those tasks.

**Awaiting your initial status update based on the handoff document.**
--- END OF FILE /ai-prompts/04-handoff-resume/resume-current-plan.md ---

--- START OF FILE AI-workflow-Max/core-rules/README.mdc ---
---
type: "documentation"
purpose: "cursor-rules-readme"
version: "2.2.1" # Reflects updated framework version
status: "Active"
description: "Index of available rule files for the AI Workflow Framework (v2.2.1). Your primary operating guide is custom-dev-agent-instructions.md."
ai_instructions: "This file lists the rule documents available. **Your primary operating instructions, priorities, and mandatory checklists are located in 'AI-workflow-Max/custom-dev-agent-instructions.md'.** Use this file only as a reference map to the specific rule details when directed."
related_files: ["AI-workflow-Max/custom-dev-agent-instructions.md", "AI-workflow-Max/core-rules/002-scope-control.mdc", "AI-workflow-Max/core-rules/003-plan-storage.mdc", "AI-workflow-Max/core-rules/004-tracking-logging.mdc", "AI-workflow-Max/modes/manual.md", "AI-workflow-Max/modes/assisted.md", "AI-workflow-Max/ai-guidance/debugging-protocol.md"] # Added main instructions and debug protocol
priority: "high" # Main instructions are critical
audience: "ai"
dateCreated: "2025-03-29"
lastUpdated: "2025-03-29"
---

# AI Workflow Framework Rules Index (v2.2.1)

**ATTENTION AI AGENT:** Your main operational guide, including mandatory checklists (Pre-flight, Post-Step), priorities, context handling, and the Debugging Protocol, is located in:

**`AI-workflow-Max/custom-dev-agent-instructions.md`**

**You MUST primarily follow the instructions and procedures outlined in that document.** This file serves only as an index to the detailed rule definitions you might be referred to.

## Available Rule Files Overview

The rule files defining specific constraints and modes are organized as follows:

AI-workflow-Max/
├── custom-dev-agent-instructions.md # ← **PRIMARY OPERATING GUIDE & CHECKLISTS**
│
├── core-rules/                     # ← Essential, Mandatory Rule Definitions
│   ├── 001-core-principles.mdc      # Basic AI behavior principles
│   ├── 002-scope-control.mdc        # Scope contract & verification definition
│   ├── 003-plan-storage.mdc         # Storage location, naming, core files, registry rule definition
│   ├── 004-tracking-logging.mdc     # status.md & log update rule definition
│   ├── 005-safety-protocols.mdc     # Production/refactoring safety rule definition
│   ├── nestrules.mdc                # NestJS specific backend standards (if applicable)
│   └── remixrules.mdc               # Remix specific frontend standards (if applicable)
│
└── modes/                          # ← Implementation Mode Definitions (Verification/Autonomy/Reporting)
    ├── manual.md                   # Defines high-verification, step-approval, visual chat reporting mode
    └── assisted.md                 # Defines component-verification, proceed-unless-blocked mode

# Note: AI Guidance documents (e.g., planning-guide.md, debugging-protocol.md in AI-workflow-Max/ai-guidance/) provide best practices and specific workflows. Your main instructions will direct you when to consult these.


## Core Rules (Referenced by Main Instructions)

The definitions for mandatory rules are found in `core-rules/`:

1.  **`001-core-principles.mdc`**: Fundamental operating guidelines.
2.  **`002-scope-control.mdc`**: Defines Scope Contract creation/adherence.
3.  **`003-plan-storage.mdc`**: Defines mandatory location, naming, structure, registry updates. (Setup governed by Pre-flight Checklist in main instructions).
4.  **`004-tracking-logging.mdc`**: Defines requirements for `status.md` and `implementation-log.md` updates. (Timing/reporting governed by Post-Step Checklist and Mode).
5.  **`005-safety-protocols.mdc`**: Defines high-caution procedures.

## Implementation Modes (Referenced by Main Instructions)

Mode definitions dictate verification frequency, autonomy, and reporting style:

1.  **`@mode:manual`**: Defined in `AI-workflow-Max/modes/manual.md`.
2.  **`@mode:assisted`**: Defined in `AI-workflow-Max/modes/assisted.md`.

## How to Use These Rules

1.  **Follow `custom-dev-agent-instructions.md`:** This dictates your workflow, including when to perform checklists and apply rules.
2.  **Refer to Specific Files:** When your main instructions or context requires understanding the specific details of a rule (e.g., "Adhere to Scope Control Rule 002") or mode, consult the relevant file listed here.
3.  **Prioritize:** `custom-dev-agent-instructions.md` > Core Rules / Mode Definitions. User instructions override where safe and documented.

This index helps locate specific rule details, but your operational flow is defined in the main agent instructions document.
--- END OF FILE AI-workflow-Max/core-rules/README.mdc ---
