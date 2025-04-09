**Action Required: Implementaiton Plan and Codebase Audit**

**Implementaiton Plan to Audit:**: 

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
The ultimate goal of your task is to validate the implementation plan against the current code base and implementation sequentially and methodically file by file component by component 
to make sure that the implementation plan presented can be implemented successfully. During this investigation you must identify if there are some discrepancies on what is proposed on
the plan that would make it very difficult or require fundamental changes to their current architecture of the extension in order to be successfully implemented. I am providing the
implementation plan that is split into multiple parts from phase one to 6 and I am providing the technical documents that were used in order to create that plan from products perspective. 
The api component integration map the server alignment audit and the UI requirements and recommendations. Make sure that this plan faithfully respects the requirements of the product team 
and the engineering team but at the same time that it can realistically be implemented and it's compatible with our code base. Not the case you would need to articulate and give your rationale 
as to why this is not compatible or why it would require changes so that we might evaluate solutions. You find something that is not compatible or would cause issues and you have a possible 
solution then make that recommendation as to how he could possibly be resolved without causing major disruptions.@ui-requirements-and-recommendations.md @api-component-integration-map.md 
@server-alignment-audit.md @plan.md @phase-docs Please read this documentation build the context required with a clear understanding of what is required of you. Once you have done this I 
want you to acknowledge and read back to me what you understand your task is and then wait for my instructions