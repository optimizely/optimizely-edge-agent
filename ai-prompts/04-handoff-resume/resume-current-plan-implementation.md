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
dateCreated: "2025-04-02"
lastUpdated: "2025-04-02"
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

**Core Rules (Available in `.cursor/rules/`):**

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



**Subject: Resuming Implementation: [Refer to Handover Summary Document]**

**To the AI Agent:**

### AI FRAMEWORK
**"You must use the AI Workflow Framework"**

You are continuing an existing implementation task. Your primary source of information for the current state, scope, completed work, and next steps is the **"Implementation Handoff Document"** which will be provided immediately following these instructions.

Your goal is to seamlessly resume the work outlined in the handoff document, strictly adhering to the AI Workflow Framework.

You must acknowledge that you have read this text and that you understand the rules and instructions. You must then wait for approval before continuing. 