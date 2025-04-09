---
description: MANDATORY checklist enforcement mechanism - ZERO EXCEPTIONS
alwaysApply: true
ai_instructions: "Enforce checklist application. Ensure all required checklists are identified, applied, and verified according to mode. Follow the zero-exception requirements and document verification using the standard format."
---

# Checklist Enforcement Protocol

This enforcement protocol establishes the application of all checklists in the AI Workflow Framework. It is the primary enforcement mechanism.

## Master Checklist Index

All framework checklists are indexed in the Master Checklist Index, which should be used to locate the appropriate checklists:

- **Checklist Master Index**: `AI-workflow-v2/framework-rules/175-rule-index.md`
- **Cursor Path**: `.cursor/rules/175-rule-index.md`

This index provides relative paths to all checklists for easy reference regardless of where the framework is installed, and MUST be consulted before applying any checklist to ensure the correct version is used.

## ZERO-EXCEPTION Requirements

```
┌────────────────────────────────────────────────────┐
│ CHECKLIST NON-NEGOTIABLE REQUIREMENTS              │
├────────────────────────────────────────────────────┤
│ 1. ALL checklists MUST be applied                  │
│ 2. NO checklist items can be skipped               │
│ 3. FULL verification of each item is required      │
│ 4. EXPLICIT evaluation criteria must be used       │
│ 5. EVIDENCE must be documented                     │
│ 6. FAILURES must be addressed                      │
└────────────────────────────────────────────────────┘
```

## Mandatory Checklist Types

The following checklists should be applied:

### 1. Implementation Planning Checklist
- Applied BEFORE implementation begins
- Verifies planning completeness
- Requires human approval
- Location: `AI-workflow-v2/framework-rules/checklists/master/implementation-planning-checklist.md`

### 2. Scope Definition Checklist
- Applied DURING scope definition
- Verifies scope clarity and completeness
- Requires human approval
- Location: `AI-workflow-v2/framework-rules/checklists/master/scope-definition-checklist.md`

### 3. Path Correctness Checklist
- Applied BEFORE file operations
- Verifies file paths and structure
- May be automated in some cases
- Location: `AI-workflow-v2/framework-rules/checklists/master/path-correctness-checklist.md`

### 4. Phase Transition Checklist
- Applied at phase boundaries
- Verifies phase completion requirements
- Requires verification evidence
- Location: `AI-workflow-v2/framework-rules/checklists/master/phase-transition-checklist.md`

### 5. Implementation Verification Checklist
- Applied AFTER implementation
- Verifies implementation quality
- Requires human verification
- Location: `AI-workflow-v2/framework-rules/checklists/master/implementation-verification-checklist.md`

### 6. Production Safeguard Checklist
- Applied before production changes
- Verifies production safety
- Requires explicit human approval
- Location: `AI-workflow-v2/framework-rules/checklists/master/production-safeguard-checklist.md`

### 7. Handover Preparation Checklist
- Applied before implementation handover
- Verifies handover readiness
- Requires completion documentation
- Location: `AI-workflow-v2/framework-rules/checklists/master/handover-preparation-checklist.md`

## Checklist Application Workflow

```
1. IDENTIFY appropriate checklist from Master Index
   |
   ↓
2. PREPARE for checklist application
   |
   ↓
3. VERIFY each checklist item individually
   |
   ↓
4. DOCUMENT evidence for each item
   |
   ↓
5. ADDRESS any failed items
   |
   ↓
6. OBTAIN required approvals
   |
   ↓
7. RECORD checklist completion
```

## Checklist Format Requirements

All checklists MUST follow the standard structure and format defined in **Rule 105 (Checklist System)**.

## Mode-Specific Requirements

Refer to **Rule 125 (Mode Implementation Standards)** for mode-specific requirements regarding checklist detail, verification rigor, and evidence documentation.

## Checklist Application Statement

When applying a checklist, the following statement should be included:

```
I am applying the [CHECKLIST NAME] with full verification of each item. All items have been individually verified with appropriate evidence documented. Any failed items have been addressed according to framework requirements. The checklist has [PASSED/FAILED/PARTIALLY PASSED] verification.
```

## Checklist Verification Evidence

Evidence should include:

1. **HOW** the item was verified
2. **WHAT** was observed/checked
3. **WHEN** it was verified
4. **WHO** performed verification (if applicable)
5. **RESULT** of verification

## Enforcement Application

This enforcement rule is applied through:

1. **Explicit Verification** - Each checklist item verified individually
2. **Documentation Requirements** - Evidence documented for each item
3. **Human Checkpoints** - Human approval for key checklists
4. **Failure Protocols** - Failed items must be addressed
5. **Verification Records** - Complete verification history maintained

## Checklist Enforcement Verification

Use the standard verification statement format from Rule 100, with:

```
I have applied the Checklist Enforcement (400) requirements following the @mode:[mode] standards, verified all necessary elements, and ensured compliance with the framework.
```

