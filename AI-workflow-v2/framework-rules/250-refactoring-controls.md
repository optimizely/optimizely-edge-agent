---
description: MANDATORY Controls for REFACTORING operations. Apply when intending to refactor code. Covers risk assessment, mode selection, incremental changes, verification points, checkpoints, and prohibitions to ensure behavior preservation.
alwaysApply: false
ai_instructions: "Apply these controls for all refactoring operations. Assess risk level, select appropriate mode, make incremental changes, verify after each step, and enforce behavior preservation. Never combine refactoring with behavior changes. Follow mode-specific requirements based on risk level."
---

# REFACTORING CONTROLS

Refactoring operations present unique risks. This rule establishes strict controls for safe refactoring to ensure behavior preservation.

## 1. Core Protection Principles

1.  BEHAVIOR PRESERVATION (Primary Goal)
2.  INCREMENTAL CHANGES
3.  CONTINUOUS VERIFICATION
4.  HUMAN OVERSIGHT
5.  TRACEABILITY
6.  SCOPE CONTROL

## 2. Refactoring Risk Assessment

Assess risk level BEFORE starting any refactoring:

*   **LOW RISK:** Format/style changes, local variable renaming, comment/whitespace mods.
*   **MEDIUM RISK:** Method extraction (same class), control structure optimization, local var optimization, private method param reordering.
*   **HIGH RISK:** Interface/public API changes, cross-module refactoring, performance-critical code, complex algorithm restructuring.
*   **CRITICAL RISK:** Security-sensitive code, core architecture, DB schema, concurrency/threading code, error handling systems.

## 3. Mandatory Refactoring Controls

### 3.1 Pre-Refactoring Requirements

BEFORE starting:
*   Document CURRENT behavior with examples.
*   Define clear refactoring BOUNDARIES.
*   Identify affected DEPENDENCIES.
*   Establish VERIFICATION method (tests, manual checks).
*   Determine ROLLBACK approach.
*   Assess RISK level (See Section 2).
*   Select appropriate MODE based on risk (See Section 3.2).

### 3.2 Mode Requirements by Risk Level

*   **LOW RISK:** `@mode:auto` acceptable.
*   **MEDIUM RISK:** `@mode:semi` required.
*   **HIGH RISK:** `@mode:manual` required.
*   **CRITICAL RISK:** `@mode:manual` + additional project-specific controls required.

### 3.3 Incremental Implementation Requirements

All refactoring MUST be:
*   Broken into SMALLEST possible, verifiable steps.
*   Verified (tests pass, behavior preserved) after EACH step.
*   Traceable (link changes to plan/requirement).
*   Documented (briefly, what changed and why per step).
*   Validated through appropriate testing (unit, integration, etc.).

### 3.4 Critical Verification Points

Verification MUST occur:
1.  BEFORE refactoring starts (baseline tests pass).
2.  AFTER each incremental change.
3.  AFTER completing logical groups of changes.
4.  AFTER all refactoring is complete.
5.  AFTER integration with dependent systems (if applicable).

### 3.5 Human Checkpoint Requirements by Risk

*   **LOW RISK:** Final approval only.
*   **MEDIUM RISK:** Approval of initial plan + final verification approval.
*   **HIGH RISK:** Approval of initial plan + checkpoints at key increments + final verification approval.
*   **CRITICAL RISK:** Comprehensive approval workflow; potentially approval/verification at EACH step.

### 3.6 Mandatory Refactoring Pre-Submission Checklist

Confirm before submitting/merging:
*   [ ] Behavior preservation verified (all tests pass, manual checks done).
*   [ ] No unintended side effects observed.
*   [ ] Performance impact assessed (and acceptable).
*   [ ] Changes align with documented plan/scope.
*   [ ] Code quality/readability improved or maintained.
*   [ ] Each step was verified incrementally.
*   [ ] Required human approvals obtained.
*   [ ] Relevant documentation updated.
*   [ ] Scope boundaries (Rule 200) respected.

### 3.7 Critical Refactoring Prohibitions

NEVER:
*   Refactor AND change behavior simultaneously in the same step/commit.
*   Skip verification steps.
*   Combine multiple high-risk refactorings without approval.
*   Refactor across multiple core systems/modules at once without careful planning.
*   Proceed if verification fails at any step.

## 4. Mode-Specific Requirements Summary

*   **@mode:manual:** Comprehensive docs/traceability; approval/verification EACH step.
*   **@mode:semi:** Standard docs/traceability; approval/verification at KEY points/groups.
*   **@mode:auto:** Basic docs/traceability; approval/verification at start/end.

*(Detailed mode requirements influence the frequency and depth specified in Section 3)*

## 5. Application Verification Statement

Use the standard verification statement format from Rule 100, with:

```
I have applied the Refactoring Controls (250) requirements following the @mode:[mode] standards, verified all necessary elements, and ensured compliance with the framework.
```