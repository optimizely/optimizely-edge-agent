**Memory Check & Rule Reminder:**

Please remember to adhere to the **Simplified AI Workflow Framework (v2.1)** as you proceed. Key points to keep in focus:

*   **Core Rules (Mandatory):** Always follow rules `001` through `005` located in `AI-workflow-Max/core-rules/`.
    *   **CRITICAL Priorities:** Pay special attention to **Rule 003 (Plan Storage)** for correct file/directory creation and registry updates, and **Rule 002 (Scope Control)** for strict adherence to the approved Scope Contract. **Rule 004 (Tracking/Logging)** requires continuous updates to `status.md` and `implementation-log.md`.
*   **Implementation Mode:** Operate according to the currently active mode (`@mode:manual` or `@mode:assisted`), referencing the definitions in `AI-workflow-Max/modes/`.
*   **AI Guidance (Reference):** For best practices on *how* to perform tasks (planning, tracking, context management), refer to the guides in `AI-workflow-Max/ai-guidance/`.
*   **Tools (Reference):** Utilize tools in `AI-workflow-Max/tools/` (like `create-plan.js`, `update-registry.js`, AI helpers) for consistency and compliance.

**CRITICAL EXECUTION & VERIFICATION PROTOCOL:**

*   **Sequential Execution:** You MUST execute the steps outlined in the `plan.md` strictly in the specified order, one step at a time unless the plan explicitly groups sub-tasks within a single step.
*   **Step-Level Verification:** BEFORE marking any step as complete or moving to the next, you MUST perform all necessary verification checks defined for that step in the `plan.md` or required by the current `@mode`. This always includes scope checks (Rule 002) for all changes made within the step.
*   **Accurate Tracking (Per Step):** IMMEDIATELY AFTER successfully completing AND verifying a single step, you MUST:
    1.  Update the plan's `status.md` file to accurately reflect the completion of *that specific step* and the updated overall progress.
    2.  Add a corresponding, accurate entry to the central `implementation-log.md` (Rule 004).
*   **Honest Reporting:** You MUST report progress accurately. Do NOT state a step is complete until all its actions have been performed AND successfully verified according to the plan or mode requirements. Falsely reporting completion is a critical failure and requires immediate correction.
*   **Checklist Mentality:** Treat the verification criteria for each step as a mandatory checklist. All items must be checked off before the step is considered complete. If verification fails, address the issues before reporting completion.

*   **Handling Difficulties:** If you encounter a technical challenge you cannot resolve *while adhering strictly to the plan, scope, and specified technologies/components*, you **MUST NOT** deviate, simplify the approach, or swap components unilaterally. Instead, you **MUST** pause, clearly explain the specific problem you are facing, outline why the planned approach is difficult within the constraints, and explicitly **ask for human guidance or clarification** before proceeding differently.   

**File System Access:** Yes, You are capable and have access to the system files and directories.

## Operating System: "Windows 11"
**All Terminal commands must be formatted for the command line in windows**

## Terminal: Command Line
**Use the windows command line terminal for C

**Status and Progress (CRITICAL):** Make sure to update the plan's status and progress in all relevant documentation. Refer to 003-plan-storage.mdc and 004-tracking-logging.mdc

*   **Accurate Tracking (Per Step):** IMMEDIATELY AFTER successfully completing AND verifying a single step, you MUST:
    1.  Update the plan's `status.md` file to accurately reflect the completion of *that specific step* and the updated overall progress. Use `AI-workflow-Max/tools/ai-tools/progress-indicators.js` for visual elements.
    2.  Add a corresponding, accurate entry to the central `implementation-log.md` (`ai-workflow-workspace-Max/registry/implementation-log.md`) using `AI-workflow-Max/tools/update-registry.js` or equivalent logic.
    3.  **Report to User:** Provide a brief status update **in this chat conversation**, confirming the step completion, verification status, and overall progress (e.g., "Step X.Y completed and verified. Overall progress: Z%").

Continue with the current task, keeping these framework requirements in mind. Let me know if any of these rules conflict with the immediate task or if you need clarification.
