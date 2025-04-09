---
description: Core AI Workflow Framework v2 implementation process. Defines the 7 phases (Analysis to Completion), emphasizing granular planning, dedicated plan directories, task breakdown, and verification. Apply this for guiding all implementation tasks.
alwaysApply: true
ai_instructions: |-
  Follow this 7-phase implementation process sequentially for all tasks:
  1. ANALYSIS: Understand reqs, ID rules, assess risk/complexity.
  2. PLANNING: Define scope, select mode (@manual/@semi/@auto), break down tasks, plan verification/checkpoints/docs.
  3. PREPARATION: Create plan dir (ai-workflow-workspace/plans/[unique-plan-id]/), populate artifacts (README, plan.md, status.md, checklists), update registry.
  4. IMPLEMENTATION: Work in plan dir, execute tasks incrementally, verify continuously (scope, pre-flight, task-specific), update status, use checkpoints.
  5. VERIFICATION: Validate overall outcome vs reqs, consolidate results, verify scope/rule compliance, assess quality (Rule 300).
  6. DOCUMENTATION: Document approach/decisions/issues (Rule 325), update system docs.
  7. COMPLETION: Finalize status/registry, archive/handover.
  Adjust detail/verification/approval level based on selected mode (Rule 125). Ensure enforcement via checklists/checkpoints/headers (Rules 400, 425, 150).
---

# AI Workflow V2: Implementation Process

This document defines the implementation process for the AI Workflow Framework. It establishes the core phases, verification points, and human checkpoints throughout the implementation lifecycle.

## Implementation Process Overview

```
1. ANALYSIS → Understand requirements and identify applicable rules
   |
   ↓
2. PLANNING → Define scope, select mode, create plan
   |
   ↓
3. PREPARATION → Create structure, set up environment
   |
   ↓
4. IMPLEMENTATION → Execute plan with continuous verification
   |
   ↓
5. VERIFICATION → Validate implementation against requirements
   |
   ↓
6. DOCUMENTATION → Document implementation details and decisions
   |
   ↓
7. COMPLETION → Finalize implementation and handover
```

## Phase 1: Analysis

**Purpose:** Understand requirements and identify applicable framework rules.

**Requirements:**
*   Understand implementation requirements thoroughly
*   Identify applicable framework rules
*   Assess complexity and risk
*   Gather context and prerequisites
*   *(Optional: Identify components needing protection)*

**Deliverables:**
*   Initial requirements understanding
*   List of applicable framework rules
*   Preliminary risk assessment
*   *(Optional: Component boundary identification)*

**Verification:**
*   Human confirmation of requirements understanding
*   Rule Application Checklist

**Reference Docs:**
*   `AI-workflow-v2/references/by-phase/analysis/analysis-process.md`

## Phase 2: Planning

**Purpose:** Define scope, select implementation mode, create detailed plan components.

**Requirements:**
*   Define clear scope boundaries (Rule 200)
*   Select implementation mode (@mode:[mode], Rule 125)
*   Define concise plan name/ID
*   Break down implementation into granular tasks
*   Identify verification approach *(Use [Verification Depth Decision Tree](AI-workflow-v2/framework-rules/decision-trees/decision-tree-verification-domain.md#1))*
*   Assess risks and define mitigation
*   Determine required checklists (see Rule 400 / Checklist Master Index) *(Use [Checklist Selection Decision Tree](AI-workflow-v2/framework-rules/decision-trees/decision-tree-planning-domain.md#3))*
*   Plan human checkpoints (Rule 425) *(Use [Human Checkpoint Decision Tree](AI-workflow-v2/framework-rules/decision-trees/decision-tree-planning-domain.md#6) to guide planning)*
*   *(Optional: Assign component protection ([See Protection Decision Tree](AI-workflow-v2/framework-rules/decision-trees/decision-tree-protection-domain.md#4)), plan snapshots, plan templates)*

**Deliverables:**
*   Scope definition *(Use [Scope Boundary Decision Tree](AI-workflow-v2/framework-rules/decision-trees/decision-tree-protection-domain.md#2) to guide definition and Rule 200 for structure)*
*   Mode selection record *(Use [Mode Selection Decision Tree](AI-workflow-v2/framework-rules/decision-trees/decision-tree-planning-domain.md#2) to determine and document)*
*   Plan Name/ID
*   Detailed Task Breakdown
*   Risk assessment/mitigation plan
*   List of Required Checklists
*   Human checkpoint plan
*   *(Optional: Component protection strategy, templates)*

**Verification:**
*   Implementation Planning Checklist
*   Human approval of plan components
*   *(Optional: Component Protection Checklist)*

**Reference Docs:**
*   `AI-workflow-v2/references/by-phase/planning/planning-process.md`
*   `AI-workflow-v2/references/by-phase/planning/task-breakdown.md`
*   `AI-workflow-v2/templates/reference-cards/task-breakdown.md`
*   `AI-workflow-v2/templates/plan-templates/task-status-board.md`

## Phase 3: Preparation

**Purpose:** Create the dedicated plan directory within the workspace and populate it with initial tracking and planning artifacts.

**Requirements:**
*   Determine plan number/Construct Unique Plan ID (Check `ai-workflow-workspace/plans/` or registry if used)
*   Create dedicated plan directory: `ai-workflow-workspace/plans/[unique-plan-id]/`
*   Create artifacts inside `ai-workflow-workspace/plans/[unique-plan-id]/`: `README.md`, `plan.md`, `status.md`, `_handover-template.md`, checklists
*   Update central plan registry (e.g., `ai-workflow-workspace/plans/plan-registry.md`) if used
*   Set up planned verification mechanisms
*   *(Optional: Initialize component registry/snapshots)*

**Deliverables:**
*   Dedicated Plan Directory: `ai-workflow-workspace/plans/[unique-plan-id]/` containing core artifacts (incl. `_handover-template.md`)
*   Updated central plan registry entry (if used)
*   *(Optional: Initialized component registry entries, snapshots)*

**Verification:**
*   Preparation Checklist
*   Path Correctness verification (relative to workspace root)
*   Human approval of setup
*   *(Optional: Snapshot Verification Check)*

## Phase 4: Implementation

**Purpose:** Execute implementation plan task-by-task within the dedicated plan directory, with continuous verification.

**Requirements:**
*   Navigate to plan directory (`ai-workflow-workspace/plans/[unique-plan-id]/`)
*   Consult plan/task board for next task
*   Update task status
*   Verify task scope compliance (Rule 200)
*   Apply task pre-flight checks (Rule 450)
*   Execute single granular task
*   Perform task-specific verification
*   Update `status.md` (Rule 150)
*   Complete relevant checklist items
*   Present human checkpoints (Rule 425)
*   Document decisions in `status.md`
*   *(Optional: Enforce component boundaries/verify snapshots - Rule 275)*
*   Repeat for next task

**Deliverables:**
*   Implemented changes for completed tasks
*   Updated `status.md` / `task-status-board.md`
*   Decision/Checkpoint records (in `status.md`)
*   Completed checklist files
*   *(Optional: Component modification verification results)*

**Verification:**
*   Pre-Flight Checks (per task)
*   Task-Specific Verification Criteria (from `plan.md`)
*   Human Checkpoints (as planned)
*   Scope Boundary verification (per task)
*   *(Optional: Component Protection Verification)*

**Reference Docs:**
*   `AI-workflow-v2/references/by-phase/implementation/implementation-process.md`

## Phase 5: Verification

**Purpose:** Validate the entire implementation against requirements and quality standards.

**Requirements:**
*   Verify overall outcome vs requirements
*   Perform self-review
*   Consolidate task verification results (from `ai-workflow-workspace/plans/[unique-plan-id]/status.md` etc.)
*   Validate final state vs scope boundaries
*   Verify overall framework rule compliance
*   Assess overall quality (Rule 300)
*   Identify/document remaining issues
*   *(Optional: Perform differential component analysis/boundary preservation check - Rule 275)*

**Deliverables:**
*   Final verification report (`ai-workflow-workspace/plans/[unique-plan-id]/verification-report.md`)
*   Updated issue log (in `status.md`)
*   Final scope/rule compliance statements
*   *(Optional: Component verification reports)*

**Verification:**
*   Implementation Verification Checklist
*   Human verification of complete implementation
*   *(Optional: Refactoring Verification Checklist)*

**Reference Docs:**
*   `AI-workflow-v2/references/by-phase/verification/verification-process.md`
*   `AI-workflow-v2/framework-rules/300-quality-assurance.md`

## Phase 6: Documentation

**Purpose:** Document the completed implementation details and decisions.

**Requirements:**
*   Document final approach (ref `plan.md`)
*   Summarize key decisions (from `status.md`)
*   Document known issues/limitations
*   Update project/system docs (per Rule 325)
*   Ensure documentation accuracy
*   *(Optional: Document final component protection status, prepare handover artifacts)*

**Deliverables:**
*   Completed implementation documentation
*   Finalized decision/issue records
*   Updated project/system documentation
*   *(Optional: Component protection documentation)*

**Verification:**
*   Documentation Checklist
*   Human approval of documentation

**Reference Docs:**
*   `AI-workflow-v2/framework-rules/325-documentation-standards.md`
*   `AI-workflow-v2/references/by-phase/documentation/documentation-process.md`

## Phase 7: Completion

**Purpose:** Finalize the implementation and associated plan artifacts.

**Requirements:**
*   Verify all deliverables complete
*   Perform final review (using `ai-workflow-workspace/plans/[unique-plan-id]/` docs)
*   Finalize `ai-workflow-workspace/plans/[unique-plan-id]/status.md`
*   Update central plan registry (e.g., `ai-workflow-workspace/plans/plan-registry.md`) if used
*   *(Optional: Prepare handover documentation, finalize component protection registry, archive snapshots/plan directory)*

**Deliverables:**
*   Completed and verified implementation
*   Final update to `ai-workflow-workspace/plans/[unique-plan-id]/status.md`
*   Updated entry in central plan registry (if used)
*   Completion report (`ai-workflow-workspace/plans/[unique-plan-id]/completion-report.md`)
*   *(Optional: Handover documentation, Final component protection status)*

**Verification:**
*   Completion Checklist
*   Human approval of completion

**Reference Docs:**
*   `AI-workflow-v2/references/by-phase/completion/completion-process.md`

## Refactoring Operations Process

For operations involving refactoring, especially with protected components, follow this specialized process:

```
1. PRE-REFACTORING → Identify components and protection levels
   |
   ↓
2. SNAPSHOT → Create baseline component snapshots
   |
   ↓
3. PLANNING → Define refactoring approach and steps
   |
   ↓
4. VERIFICATION SETUP → Establish verification methods
   |
   ↓
5. INCREMENTAL REFACTORING → Execute in small verified steps
   |
   ↓
6. CONTINUOUS VERIFICATION → Verify at each increment
   |
   ↓
7. FINAL VALIDATION → Complete verification of all changes
```

### Refactoring-Specific Requirements:

- Apply Component Protection Checklist
- Implement Component Snapshot System
- Use Refactoring Pre-Flight Checks
- Apply Refactoring Verification Checklist
- Maintain Component-Specific Context
- Apply appropriate verification level based on protection
- Obtain required approvals for protected components

## Parallel Implementation Process

For implementations involving multiple developers or AIs working in parallel:

```
1. TASK BREAKDOWN → Create independent, non-conflicting tasks
   |
   ↓
2. INTERFACE DEFINITION → Define clear contracts between components
   |
   ↓
3. TASK STATUS BOARD → Create central coordination document
   |
   ↓
4. PARALLEL EXECUTION → Multiple developers work independently
   |
   ↓
5. COORDINATION CHECKPOINTS → Regular status board reviews
   |
   ↓
6. INTEGRATION → Combine completed components
   |
   ↓
7. VERIFICATION → Validate complete implementation
```

### Parallel-Specific Requirements:

- Create detailed task breakdown with file-level assignments
- Define explicit interface contracts before implementation
- Maintain an up-to-date task status board
- Follow the task assignment protocol (check board, update status)
- Conduct regular coordination checkpoints
- Document and resolve any conflicts promptly
- Verify integration of parallel components

## Mandatory Checkpoints

Human approval is required at these points:

1. After Analysis Phase - Requirements understanding
2. After Planning Phase - Scope and implementation plan
3. After Preparation Phase - Directory structure and setup
4. During Implementation - At specified intervals
5. After Verification - Implementation correctness
6. After Documentation - Documentation quality
7. At Completion - Final implementation approval

## Component Protection Checkpoints

When working with protected components, additional human approval is required at:

1. Component Protection Assignment - Protection level decisions
2. Pre-Refactoring Verification - Before any refactoring begins
3. Interface Modification - Before @INTERFACE component changes
4. Behavior Modification - Before @BEHAVIOR component changes
5. After Differential Analysis - Verification of all changes
6. Final Component Verification - Complete component validation

## Mode-Specific Requirements

Refer to **Rule 125 (Mode Implementation Standards)** for detailed mode-specific requirements regarding process detail, verification rigor, approval frequency, documentation depth, etc.

## Reference Materials

For detailed guidance on implementing this process, refer to:
- [Planning Process Reference](AI-workflow-v2/references/by-phase/planning/planning-process.md)
- [Planning Checklist Reference Card](AI-workflow-v2/templates/reference-cards/planning-checklist.md)
- [Scope Definition Reference](AI-workflow-v2/references/by-phase/planning/scope-definition.md)
- [Task Breakdown Reference](AI-workflow-v2/references/by-phase/planning/task-breakdown.md)
- [Task Status Board Template](AI-workflow-v2/templates/plan-templates/task-status-board.md)
- [Implementation State Management](AI-workflow-v2/framework-rules/150-implementation-state-management.md)
- [Scope Control](AI-workflow-v2/framework-rules/200-scope-control.md)
- [Human Checkpoints](AI-workflow-v2/framework-rules/425-human-checkpoints.md)

## Standard Verification Statement

Use this standard verification statement format when creating verification statements across all rules:

```
I have applied the [rule name/number] requirements following the [mode] standards, verified all necessary elements, and ensured compliance with the framework.
```

## Implementation Process Enforcement

This implementation process is enforced through:

1. Checklist Enforcement - Verifies process compliance
2. Human Checkpoints - Requires approval at key points
3. Pre-Flight Checks - Ensures verification before critical actions
4. Context Headers - Tracks implementation status
5. Decision Documentation - Documents implementation decisions
6. Component Protection - Enforces component boundaries
7. Snapshot Verification - Verifies component state preservation
8. Task Status Board - Coordinates parallel development efforts
