---
type: "template"
purpose: "continuation-request-template"
version: "1.0"
status: "Active"
description: "Template for creating a continuation request for a specific implementation plan"
ai_instructions: "Use this template as part of the planning phase deliverables to create a plan-specific continuation request"
ai_usage_context: "Generate this during planning phase as a deliverable to ensure accurate implementation continuation"
related_files:
  - "../README.md"
  - "../reference-cards/planning-checklist.md"
  - "../prompt-templates/continuation-request.md"
required_sections:
  - "Plan Information"
  - "Current Status"
  - "Next Steps"
  - "Critical Context"
tags:
  - "continuation"
  - "implementation"
  - "planning"
  - "template"
priority: "high"
audience: "AI assistants and developers implementing the AI Workflow Framework"
dateCreated: "2025-05-15"
lastUpdated: "2025-05-15"
---

# Continuation Request Template

This template is used to create a continuation request for a specific implementation plan. It provides the necessary context and information for an AI assistant to continue an implementation that was started in a previous session.

## Plan Information

- **Plan Name**: {{planName}}
- **Plan ID**: {{planId}}
- **Implementation Mode**: @mode:{{implementationMode}}
- **Original Plan**: {{originalPlanLink}}

## Current Status

### Implementation Progress

- **Current Phase**: {{currentPhase}}
- **Overall Progress**: {{progressBar}} {{progressPercentage}}%
- **Last Completed Step**: {{lastCompletedStep}}
- **Current Status**: {{statusIndicator}} - {{statusDescription}}

### Completed Components

- {{component1}}: {{component1Description}}
- {{component2}}: {{component2Description}}
- {{component3}}: {{component3Description}}

## Next Steps

The next steps in the implementation plan are:

1. {{nextStep1}}
2. {{nextStep2}}
3. {{nextStep3}}

## Critical Context

### Scope Boundaries

- **IN SCOPE**: {{inScopeSummary}}
- **OUT OF SCOPE**: {{outOfScopeSummary}}
{{#if hasProtectedComponents}}
- **Protected Components**: {{protectedComponentsSummary}}
{{/if}}

### Implementation Decisions

- {{decision1}}: {{decision1Rationale}}
- {{decision2}}: {{decision2Rationale}}
- {{decision3}}: {{decision3Rationale}}

### Known Issues

- {{issue1}}: {{issue1Description}}
- {{issue2}}: {{issue2Description}}
- {{issue3}}: {{issue3Description}}

## Verification Requirements

Before proceeding, verify:

- [ ] Current implementation state is understood
- [ ] Scope boundaries are clear
- [ ] Next steps are well-defined
- [ ] Any required human checkpoints are identified

## Additional Information

{{additionalContext}}

---

*This is a continuation request template. Please customize it to fit your specific implementation needs.*

---

#### *AI Workflow Framework Requirements*

You MUST adhere to the following MANDATORY framework rules:

1. **Implementation Process (100)**: Follow the mandatory implementation process with all required phases, verification points, and human checkpoints.

2. **Implementation State Management (150)**: Maintain complete implementation state tracking with:
   - Current phase and step reference ([PHASE-ID].[COMPONENT-ID].[STEP-ID])
   - Implementation mode (@mode:{{implementationMode}})
   - Progress tracking with visual indicators [■■■■□□□□□□] XX%
   - Status indicators (✅ COMPLETE, ⏳ IN PROGRESS, 🔜 PENDING, ⚠️ BLOCKED, ❌ FAILED)
   - Scope boundaries and compliance verification
   - Decision history and rationale

3. **Scope Control (200)**: Maintain strict scope boundaries:
   - Verify all modifications against scope authorization levels
   - Apply pre-flight verification before EVERY change
   - Seek human approval for ANY boundary cases
   - Never modify @LOCKED components

{{#if hasProtectedComponents}}
4. **Component Integrity Protection (275)**: When working with protected components:
   - Respect component protection levels (@LOCKED, @INTERFACE, @BEHAVIOR, @FLEXIBLE)
   - Maintain component snapshots for verification
   - Verify boundary preservation after modifications
{{/if}}

5. **Checklist Enforcement (400)**: Apply all required checklists with:
   - Complete verification of each checklist item
   - Explicit evaluation criteria and evidence
   - Documentation of failures and resolutions

6. **Human Checkpoint Protocol (425)**: Implement mandatory human checkpoints:
   - Obtain EXPLICIT approval at critical points
   - Provide COMPLETE transparency
   - Document all approvals formally
   - NEVER proceed without explicit approval

7. **Adaptive Pre-Flight Checks (450)**: Before critical operations:
   - Identify operation type and risk level
   - Apply appropriate check modules
   - Verify all requirements are met
   - Document verification evidence

### *Required Checklists*

Apply these checklists based on your implementation mode:

1. **Phase Transition Checklist**: Verify phase boundary requirements
2. **Path Correctness Checklist**: Validate file operations
3. **Implementation Verification Checklist**: Validate implementation quality
4. **Scope Definition Checklist**: Verify scope boundaries
{{#if hasProtectedComponents}}
5. **Component Protection Checklist**: Verify component protection requirements
{{/if}}

These checklists can be found in the framework structure at:
`AI-workflow-v2/framework-rules/checklists/master/[checklist-name].md`

### *Context Header Requirement*

Every response MUST include an appropriate context header:

```
┌─────────────────────────────────────────────────────┐
│ IMPLEMENTATION CONTEXT                              │
├─────────────┬───────────────────────────────────────┤
│ PHASE       │ [current phase] ([phase-id].[step-id])│
│ MODE        │ @mode:{{implementationMode}}          │
│ STATUS      │ [status indicator] - [description]    │
│ PROGRESS    │ [progress bar] [X%]                   │
│ STEP        │ [PHASE-ID].[COMPONENT-ID].[STEP-ID]   │
│ NEXT        │ [next step reference]                 │
└─────────────┴───────────────────────────────────────┘
```

---

#### *Implementation Status Update*

You will begin with a status update following this format:

```
┌─────────────────────────────────────────────────────┐
│ IMPLEMENTATION STATUS UPDATE                        │
├─────────────────────────────────────────────────────┤
│ Plan Name: {{planName}}                             │
│ Current Phase: [phase]                              │
│ Implementation Mode: @mode:{{implementationMode}}   │
│ Overall Progress: [progress bar] [X%]               │
│ Current Step: [PHASE-ID].[COMPONENT-ID].[STEP-ID]   │
│ Last Completed: [description of last completed step]│
│ Next Pending: [description of next pending step]    │
│                                                     │
│ SCOPE SUMMARY:                                      │
│ • In Scope: {{inScopeSummary}}                      │
│ • Out of Scope: {{outOfScopeSummary}}               │
{{#if hasProtectedComponents}}
│ • Protected Components: {{protectedComponentsSummary}}│
{{/if}}
│                                                     │
│ HUMAN CHECKPOINT:                                   │
│ Explicit approval needed to continue implementation │
└─────────────────────────────────────────────────────┘
```

You MUST wait for explicit human approval before proceeding with implementation.

---

#### *Using the Implementation Handover Document*

Following this introduction, you will receive the *"Implementation Handover Document"* from the previous session. This document contains all specific details required to continue the implementation. You MUST:

1. Reconstruct the complete implementation state
2. Verify scope boundaries and authorization levels
3. Review applicable framework rules
4. Confirm component protection status (if applicable)
5. Identify the next steps in the implementation plan
6. Present a human checkpoint requesting approval to continue
7. Wait for explicit approval before proceeding

---

#### *Framework Verification Statement*

After receiving the Implementation Handover Document, you MUST include this verification statement:

```
I am following the mandatory AI Workflow Framework with all required rules applied. I am maintaining complete implementation state at step [PHASE-ID].[COMPONENT-ID].[STEP-ID] with [PROGRESS]% overall completion. Current phase is [PHASE] with @mode:{{implementationMode}} requirements applied. I will proceed ONLY with explicit human approval. All framework rules are being strictly followed with ZERO EXCEPTIONS.
```

---

