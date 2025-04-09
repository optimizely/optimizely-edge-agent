---
description: Unified adaptive pre-flight check system with modular extensions for all operation types
alwaysApply: false
ai_instructions: "Apply these pre-flight checks before any critical operation. Identify operation type, risk level, affected components, and required modules (Core, Refactoring, Protection, Production). Apply mode-specific requirements, execute checks, document results, and handle failures. Use the standard verification statement."
---

# Adaptive Pre-Flight Check System

This document defines the UNIFIED adaptive pre-flight check system with step numbering that should be implemented before any critical operation. The system provides a modular approach with core checks and specialized extensions based on operation type.

## ⚠️ CRITICAL: MANDATORY VERIFICATION MECHANISM ⚠️

## 1. Pre-Flight Check Determination

*(Guidance on determining when pre-flight checks are required and selecting the appropriate type based on context can be found in the [Pre-Flight Check Decision Tree](AI-workflow-v2/framework-rules/decision-trees/decision-tree-verification-domain.md#3).)*

1.1 - Identify operation type (Standard, Refactoring, Production, Protected Component, etc.)
1.2 - Determine risk level (Critical, High, Medium, Low - considering operation type and component sensitivity)
1.3 - Identify affected components and their protection levels (Rule 275).
1.4 - Determine required areas of verification based on operation type, risk, and components involved.
1.5 - Apply mode-specific requirements (Section 5).

## 2. Required Areas of Verification

Depending on the determination in Section 1, verification MUST cover applicable requirements from the following primary rules:

*   **Scope:** Verify compliance with **Rule 200 (Scope Control)**.
*   **Safety/Impact/Risk:** Verify safety, assess impact, and manage risk according to **Rule 100 (Planning Phase)**, **Rule 225 (Production Safeguards)**, **Rule 250 (Refactoring Controls)**, or other relevant context.
*   **Path Correctness:** Verify file paths and structures (Consider using a dedicated checklist per Rule 400).
*   **Specification/Standards:** Verify compliance with **Rule 300 (Quality Assurance)** and **Rule 325 (Documentation Standards)**.
*   **Approvals:** Verify necessary approvals have been obtained according to **Rule 425 (Human Checkpoints)**.
*   **Component Protection:** For protected components, verify compliance with **Rule 275 (Component Integrity Protection)**.
*   **Refactoring:** For refactoring operations, verify compliance with **Rule 250 (Refactoring Controls)**.

## 3. Operation-Specific Check Focus

*   **Refactoring:** Emphasize checks from Rule 250 and Rule 275 (behavior preservation, protection levels, snapshots).
*   **Production:** Emphasize checks from Rule 225 (environment verification, command safety, rollback).
*   **Protected Components:** Emphasize checks from Rule 275 (protection levels, boundary enforcement, snapshots).
*   *(Add other specific operation types and their key rule focuses as needed)*

## 4. Risk-Based Verification Requirements

Verification depth and rigor depend on the assessed risk level (Section 1.2). Higher risk requires more comprehensive verification across all applicable rule areas.

*   **Critical/High Risk:** Requires comprehensive and detailed verification from all applicable rules.
*   **Medium Risk:** Requires standard verification from applicable rules.
*   **Low Risk:** Requires essential verification from applicable rules.

## 5. Mode-Specific Check Requirements

Refer to **Rule 125 (Mode Implementation Standards), Section 7 (Pre-Flight Check Standards)** for mode-specific requirements regarding check detail, verification rigor, approval triggers, and documentation levels.

## 6. Pre-Flight Check Execution

6.1 - Identify required rule areas based on Sections 1, 2, 3.
6.2 - Determine required depth based on risk (Section 4) and mode (Section 5).
6.3 - Execute required checks by applying the referenced primary rules.
6.4 - Document check results (Pass/Fail/Notes) referencing the applied rules.
6.5 - Address any check failures before proceeding, re-verifying as needed.

### 6.1 Standard Pre-Flight Check Format (Simplified)

Document pre-flight checks, for example:

```
┌─────────────────────────────────────────────────────┐
│ PRE-FLIGHT CHECK: [operation description]           │
├─────────────────────────────────────────────────────┤
│ Operation Type: [type]                              │
│ Risk Level: [level]                                 │
│ Mode: @mode:[mode]                                  │
│ Affected Components: [list]                         │
│ Required Rule Areas: [Rule 200, Rule 275, etc.]     │
│                                                     │
│ Rule Verification Results:                          │
│ - Rule 200 (Scope): [PASS/FAIL/NA] [Notes]          │
│ - Rule 275 (Protection): [PASS/FAIL/NA] [Notes]     │
│ - Rule 250 (Refactoring): [PASS/FAIL/NA] [Notes]    │
│ - Rule 425 (Approvals): [PASS/FAIL/NA] [Notes]      │
│ - ... (Other applicable rules) ...                  │
│                                                     │
│ OVERALL RESULT: [PASS/FAIL]                         │
│ APPROVAL REQUIRED: [YES/NO] (Per Rule 425/etc.)     │
│ TIMESTAMP: [verification time]                      │
└─────────────────────────────────────────────────────┘
```

### 6.2 Check Failure Handling

If a check against a primary rule fails:

1. Document the specific failure and the rule violated.
2. Assess severity.
3. Determine resolution (e.g., fix code, update plan, get approval).
4. Implement corrections.
5. Re-verify against the relevant rule(s).
6. Document resolution and re-verification.

## 7. Verification and Documentation

7.1 - Document determination of required rule areas (Section 1).
7.2 - Record verification results against each required rule.
7.3 - Maintain verification audit trail (e.g., in `status.md`).
7.4 - Document approval decisions related to pre-flight checks.

## Pre-Flight Verification Statement

Use the standard verification statement format from Rule 100, with:

```
I have applied the Adaptive Pre-Flight Checks (450) requirements following the @mode:[mode] standards, verified all necessary elements by applying the requirements of the referenced primary rules, and ensured compliance with the framework.
``` 
