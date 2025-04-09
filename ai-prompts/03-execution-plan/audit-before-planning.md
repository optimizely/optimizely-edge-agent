**Action Required: Pre-Planning Codebase Audit**

Before finalizing the detailed implementation steps for `plan.md` (Pre-flight Checklist Step 5), you MUST perform an audit of the existing codebase to identify reusable assets and prevent redundancy. Use your filesystem access extensively.

**Audit Objectives:**

1.  **Identify Existing Components/Modules:** Recursively examine project directories (esp. `src/`, `app/`, `packages/`, `libs/`, `components/`, `services/`, `utils/`, `frontend/, `backend/`) relevant to the planned feature. Look for existing functions, classes, UI components, services, or modules that perform similar or required tasks.
2.  **Check Target Files:** Verify if files you might *think* need creating already exist and perhaps just need modification.
3.  **Understand Structure:** Re-familiarize yourself with the project's directory structure and where specific types of logic typically reside.
4. ***Confirm viability of implementation plan*** Analyze and validate by carefully reviewing the implementation plan and comparing it against the project architecture and actual codebase in the file system and reach a conclusion of the feasibility of success of the implementation plan.

**Output Expected:**

1.  Provide a **summary of relevant existing assets** found (files, components, functions with their paths) that could potentially be reused or modified for this implementation.
2.  Explicitly state if any files initially considered for creation were found to already exist.
3.  Confirm: "Pre-planning audit completed using filesystem access. I will leverage the following existing assets: [List assets or state 'None found'] and ensure no redundant code is created when generating the plan steps."
4.  Await confirmation (e.g., "Okay, proceed with plan generation") before generating the detailed `plan.md` steps.