---
description: Defines the system for tracking and managing implementation state, including phase, mode, progress, context (scope, history, decisions), state visualization (context headers, progress bars), confidence reporting, state maintenance (refresh), verification, recovery, and handover.
alwaysApply: true
ai_instructions: Track implementation state consistently using context headers and status.md updates. Maintain progress visualization, detect context degradation, refresh context when needed, and handle state recovery or handover when appropriate. Report confidence scores for all significant actions.
---

# Implementation State Management System

This document defines the implementation state management system used to maintain implementation state, track progress, prevent context degradation, report AI compliance confidence, and ensure consistent framework application.
*(Structured guidance for context-related decisions, such as context maintenance approach, memory refresh triggers, and handover timing, can be found in the [Context Management Decision Domain](AI-workflow-v2/framework-rules/decision-trees/decision-tree-context-management-domain.md).)*

## 1. State Management Overview

```
1.1 STATE DEFINITION → Establish initial implementation state
   |
   ↓
1.2 STATE TRACKING → Monitor implementation progress
   |
   ↓
1.3 STATE MAINTENANCE → Update and refresh context
   |
   ↓
1.4 STATE VISUALIZATION → Display current state
   |
   ↓
1.5 STATE VERIFICATION → Verify state accuracy
   |
   ↓
1.6 STATE RECOVERY → Address degradation
   |
   ↓
1.7 STATE HANDOVER → Transfer to new sessions
```

## 2. State Elements and Structure

### 2.1 Core State Elements

Track these elements (primarily within `status.md` and context headers):

*   **Phase Elements:**
    *   Current Phase & Step ID (e.g., `PLANNING.3.1`)
    *   Phase Progress (%)
    *   Phase Verification Status
*   **Mode Elements:**
    *   Selected Mode (`@mode:...`)
    *   Mode Verification Status
*   **Progress Tracking:**
    *   Overall Progress (%)
    *   Current Step Reference ID
    *   Task Completion (Pending/Completed count or list)
*   **Context Elements:**
    *   Applicable Rules (List)
    *   Scope Boundaries (Summary or link)
    *   Recent Actions (Brief summary of last 1-2)
    *   Pending Actions (Brief summary of next 1-2)
    *   Decision History (Key decisions with `[ref: rule/tree#section]`)
    *   Component Protection Status (If applicable)
    *   Snapshot Status (If applicable)

### 2.2 Standard Plan Files for State

The following files within the plan directory (`ai-workflow-workspace/plans/[unique-plan-id]/`) are central to state management:

*   **`plan.md`:** Defines tasks, scope, mode, planned checkpoints.
*   **`status.md`:** Primary log for status updates, progress, decisions, checkpoint records, AI confidence, context refresh events, errors, and recovery actions.
*   **`task-status-board.md` (Optional):** Detailed task status (PENDING, IN_PROGRESS, BLOCKED, COMPLETE).

## 3. State Tracking and Visualization

### 3.1 Progress Visualization Elements

Use standardized visual elements for clarity:

*   **Progress Bar:** `[██████░░░░] 60%` (Update frequently, include in headers. Use `█` for filled, `░` for empty)
*   **Phase Indicator:** `PHASE: IMPLEMENTATION (4/7)` (Update at phase transitions, include in headers)
*   **Status Indicators:** `✅ COMPLETE`, `🔄 IN_PROGRESS` (or `⏳`), `🔜 PENDING`, `⚠️ BLOCKED`, `❌ FAILED` (Use in status updates, task boards)
*   **Verification/Risk Indicators:** `✓ VERIFIED`, `⚠️ NEEDS_REVIEW`, `❌ REJECTED`; `🟢 LOW`, `🟡 MEDIUM`, `🔴 HIGH/CRITICAL` (Use when applicable)

### 3.2 Step Reference System Format

Use `[PHASE_ID].[TASK_ID].[SUBSTEP_ID]` for tracking granular progress.

### 3.3 Context Headers Format

Every response should include a context header reflecting the current state:

```
┌─────────────────────────────────────────────────────┐
│ IMPLEMENTATION CONTEXT                              │
├─────────────┬───────────────────────────────────────┤
│ PHASE       │ [Phase Name] ([Phase Num]/7)          │
│ MODE        │ @mode:[mode]                          │
│ STATUS      │ [Indicator] - [Brief Description]     │
│ PROGRESS    │ [Progress Bar] [X%]                 │
│ STEP        │ [Current Step Ref ID]                 │
│ NEXT        │ [Next Step Ref ID or Description]     │
│ AI CONFIDENCE │ [X/5] [Level Description]           │
└─────────────┴───────────────────────────────────────┘
```
*(Include Component Protection Header below this if applicable - see Section 8)*

### 3.4 AI Compliance Confidence Score

Include in context header before actions or status updates.

*   **Scale:**
    *   `5/5 (Very High)`: Certain compliance.
    *   `4/5 (High)`: Confident, minor uncertainty possible.
    *   `3/5 (Medium)`: Generally compliant, moderate uncertainty (e.g., boundary cases). *May warrant human check.*
    *   `2/5 (Low)`: Significant uncertainty. *Likely needs review.*
    *   `1/5 (Very Low)`: Suspected violation. *Requires human review.*
*   **Reporting:**
    *   Base on self-assessment against active rules.
    *   Justify scores <= 3/5 briefly (e.g., "Uncertain rule X application").
    *   Update before significant actions (edits, tool calls) or relevant status updates.

## 4. State Maintenance

### 4.1 Context Degradation Detection

Refresh context if:
*   Rule deviation observed?
*   Implementation inconsistency?
*   Context confusion evident?
*   Token usage high / Session long (per mode rules)?
*   Human requests refresh?
*   *(Recommended)* Phase transition?
*   *(Component-specific)* Component protection active?
*   *(Enhanced)* Refactoring operation?

### 4.2 Context Refresh Procedure

1.  **Capture State:** Log current step, progress, critical elements.
2.  **Framework Review:** Re-verify active rules, phase, mode, scope, decision history.
3.  **Verify Status:** Check checklist/step completion, component status, approvals.
4.  **Update State:** Confirm next steps, present updated context header, refresh protection/snapshot status if applicable.

### 4.3 Status Update Requirements

Update state (especially in `status.md` and context headers) after:
*   Any significant step completion.
*   Phase transitions (before and after).
*   Major decisions.
*   Progress changes.
*   Human checkpoints (before and after).
*   Component status changes (if applicable).
*   At intervals based on mode (see Rule 125).

## 5. State Verification Process

### 5.1 State Accuracy Verification

Periodically verify:
*   Is the Phase correct?
*   Is the Mode correct?
*   Is Progress accurate?
*   Are Applicable Rules correct?
*   Are Scope Boundaries clear?
*   Is Current Status accurate?
*   Are Recent Actions documented?
*   Are Next Steps identified?
*   Is Verification Status accurate?
*   *(If applicable)* Is Component Protection Status accurate?
*   *(If applicable)* Are Component Snapshots current?
*   If any check fails -> Refresh context (Sec 4.2).

### 5.2 Status Accuracy Requirements

*   Progress within ~5%.
*   Phase, Step Ref, Mode: Exactly correct.
*   Status Indicators: Reflect reality.
*   History (Actions, Decisions): Complete & Accurate.

## 6. State Recovery

If context degradation is detected:
1.  **Identify:** Detect type/severity, affected elements.
2.  **Reconstruct:** Review last good state, re-establish core context (phase, mode, step, scope, progress).
3.  **Verify:** Check accuracy of recovered state.
4.  **Document:** Log recovery action, note info loss, update status, present refreshed header.

## 7. State Handover

### 7.1 Handover Decision

*   **Prefer Continuation** if mid-task, complex state, high context volume.
*   **Consider Handover** at logical boundaries (e.g., task completion).
*   **Suitable for Handover** at phase boundaries.
*   **Perform Handover** if human requests (e.g., "Generate handover document for plan [plan-id]").
*   **Enhanced Handover Required** if component protection active.

### 7.2 Handover Document Generation

Upon user request, generate a handover document by:
1.  Locating the plan-specific `_handover-template.md` in `ai-workflow-workspace/plans/[plan-id]/` (created during Planning, Rule 100).
2.  Reading the latest dynamic state from `status.md` (current phase/step/progress, recent log entries, decisions, issues).
3.  Merging the static template information with the dynamic status information.
4.  Formatting the output according to the standard structure defined in **`docs/handover-document-structure.md`**.
5.  Including the standard verification statement confirming compliance.

## 8. Component-Specific State Management

(Apply when Component Protection is active - see Rule 275)

### 8.1 Additional State Elements
*   Protected Components Registry (Levels, Justification, History)
*   Component Snapshot State (Status, Timestamps, Verification, Hashes)
*   Component Verification State (Status, History, Changes, Authorization)

### 8.2 Component Protection Header Format

Include this header below the main context header (Sec 3.3) when protected components are in scope:
```
┌─────────────────────────────────────────────────────┐
│ COMPONENT PROTECTION STATUS                         │
├─────────────┬───────────────────────────────────────┤
│ COMPONENTS  │ [count] components in scope           │
│ PROTECTED   │ [count] protected components          │
│ @LOCKED     │ [count] locked components             │
│ @INTERFACE  │ [count] interface-protected components│
│ @BEHAVIOR   │ [count] behavior-protected components │
│ @FLEXIBLE   │ [count] flexible components           │
│ SNAPSHOT    │ [status] snapshot capture status      │
│ VERIFICATION│ [status] boundary enforcement active  │
└─────────────┴───────────────────────────────────────┘
```

## 9. Mode-Specific Requirements

Refer to **Rule 125 (Mode Implementation Standards), Section 5 (Context Management Standards)** for mode-specific details on context headers, refresh frequency, decision documentation depth, etc.

## Implementation State Management Verification

Use the standard verification statement format from Rule 100, with:

```
I have applied the Implementation State Management (150) requirements following the @mode:[mode] standards, verified all necessary elements, and ensured compliance with the framework.
```

---