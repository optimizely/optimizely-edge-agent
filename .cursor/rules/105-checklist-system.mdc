---
description: Defines the mandatory structure, format, mode standards, and referencing for all AI Workflow Framework checklists. Use when creating, verifying, or applying any checklist.
alwaysApply: true
ai_instructions: Use this system for all checklists. Follow the standard structure, apply mode-specific standards by reference, and use the reference system for cross-checklist relationships. This system is mandatory for all checklists.
---

# Checklist System

This document defines the consolidated checklist system that standardizes the structure, format, application, and mode-specific requirements for all checklists in the AI Workflow Framework.

## 1. Checklist System Overview

```
1.1 BASE TEMPLATES → Define core checklist structures
   |
   ↓
1.2 SPECIALIZED TEMPLATES → Extend base for specific use cases
   |
   ↓
1.3 MODE STANDARDS → Apply mode-specific requirements by reference
   |
   ↓
1.4 VERIFICATION STATEMENTS → Standardize verification language
   |
   ↓
1.5 REFERENCE SYSTEM → Enable cross-checklist relationships
   |
   ↓
1.6 COMPLETION DOCUMENTATION → Standardize verification recording
```

## 2. Standard Checklist Structure

All checklists should follow this standardized structure:

```
# [CHECKLIST_NAME]

## Purpose

[PURPOSE_DESCRIPTION]

## Application Requirements

- **When to use**: [USAGE_CONTEXT]
- **Required modes**: [SUPPORTED_MODES] (@mode:manual, @mode:semi, @mode:auto)
- **Verification requirement**: [VERIFICATION_REQUIREMENT] (e.g., Human review, Automated check)
- **Completion documentation**: [COMPLETION_REQUIREMENT] (e.g., Update status.md, Link evidence)

## Critical Checklist Items

### [CATEGORY_1]

- [ ] **[ITEM_ID]. [ITEM_NAME]** [VERIFICATION_REQ] [CRITICALITY]
  - [SUB_ITEM_ID.1]. [SUB_ITEM_DESCRIPTION]
  - ...

### [CATEGORY_2]

- [ ] **[ITEM_ID]. [ITEM_NAME]** [VERIFICATION_REQ] [CRITICALITY]
  - ...

## Mode-Specific Requirements

Apply [CATEGORY] Mode Standards (Reference: `AI-workflow-v2/framework-rules/105-checklist-system.md#[CATEGORY]`)

## Verification Statement

Use Verification Statement Template: [TEMPLATE_TYPE]

## Integration with Framework

This checklist integrates with:
- [RULE_ID_1]
- [RULE_ID_2]

## Completion Documentation

[Standard format defined in Section 12]
```

## 3. Checklist Item Format

### 3.1 Standard Format

All checklist items should use this standardized format:

```
- [ ] **[ITEM_ID]. [ITEM_NAME]** [VERIFICATION_REQUIREMENT] [CRITICALITY_MARKER]
  - [SUB_ITEM_ID.1]. [SUB_ITEM_DESCRIPTION]
  - [SUB_ITEM_ID.2]. [SUB_ITEM_DESCRIPTION]
  - ...
  - [SUB_ITEM_ID.N]. [SUB_ITEM_DESCRIPTION]
```

### 3.2 Item Numbering System

The numbering system should use this hierarchical format: `[CHECKLIST_TYPE].[CATEGORY].[ITEM].[SUB_ITEM]` (See Section 10.2 for Checklist Type codes).

### 3.3 Example Item Format

```
- [ ] **VER.2.1.3. Component Interface** documented ✅ [MANDATORY]
  - VER.2.1.3.1. Public methods documented
  - VER.2.1.3.2. Parameters/return values specified
  - VER.2.1.3.3. Usage examples provided
  - VER.2.1.3.4. Exception handling documented
```

### 3.4 Criticality Markers

All checklist items MUST use these standardized criticality markers:

| Marker        | Description                            | Enforcement                                     |
|---------------|----------------------------------------|-------------------------------------------------|
| `[MANDATORY]` | Required for all implementations     | Cannot proceed without                          |
| `[CRITICAL]`  | Required for specific conditions       | Cannot proceed without when condition applies   |
| `[RECOMMENDED]`| Strongly advised but not required    | Should be completed with justification if skipped |
| `[OPTIONAL]`  | Beneficial but situational           | Can be skipped with minimal justification       |

## 4. Template Inheritance System

Checklists can optionally inherit from base templates (defined elsewhere) for common structures. Syntax (if used):

```
Template: [BASE_TEMPLATE_ID]
Extends: [PARENT_TEMPLATE_ID] (Optional)
```

*(Note: Specific base templates like Verification, Implementation, etc., are defined in separate rule files or reference documents.)*

## 5. Mode-Specific Standards

### 5.1 Mode Standards Overview

Apply standards based on the active implementation mode (`@mode:manual`, `@mode:semi`, `@mode:auto`).

```
┌─────────────────┬───────────────────┬──────────────────┬────────────────┐
│ ASPECT          │ @mode:manual      │ @mode:semi       │ @mode:auto     │
├─────────────────┼───────────────────┼──────────────────┼────────────────┤
│ Detail Level    │ COMPREHENSIVE     │ STANDARD         │ BASIC          │
│ Documentation   │ COMPLETE          │ KEY ELEMENTS     │ ESSENTIAL ONLY │
│ Verification    │ EXHAUSTIVE        │ SIGNIFICANT PTS  │ CRITICAL PTS   │
│ Human Approval  │ EVERY STEP        │ MAJOR MILESTONES │ CRITICAL GATES │
│ Evidence        │ DETAILED PROOF    │ STANDARD         │ MINIMAL        │
│ Confidence      │ MAXIMUM ASSURANCE │ STANDARD         │ BASIC          │
└─────────────────┴───────────────────┴──────────────────┴────────────────┘
```

### 5.2 Standard Reference Format

Checklists should indicate that mode-specific requirements apply. For detailed standards regarding checklist detail, documentation depth, verification rigor, etc., based on the active mode (`@mode:manual`, `@mode:semi`, `@mode:auto`), refer to the relevant sections within **Rule 125 (Mode Implementation Standards)**. The summary table in Section 5.1 provides a high-level overview. Checklists can state:

```markdown
## Mode-Specific Requirements

Apply relevant mode standards as defined in Rule 125 (Mode Implementation Standards).
```

## 6. Implementation Standards {#implementation}

*   **@mode:manual:** Comprehensive implementation; full verification; complete decision docs; exhaustive testing; multiple reviews; step approval.
*   **@mode:semi:** Standard implementation; key verification; significant decision docs; comprehensive testing; standard reviews; major decision approval.
*   **@mode:auto:** Basic implementation; critical verification; essential decision docs; critical path testing; streamlined reviews; critical decision approval.

## 7. Documentation Standards {#documentation}

*   **@mode:manual:** Comprehensive coverage; detailed explanations; extensive diagrams/examples; full metadata.
*   **@mode:semi:** Key coverage; clear explanations; important diagrams/examples; standard metadata.
*   **@mode:auto:** Essential coverage; concise explanations; critical diagrams/examples; essential metadata.

## 8. Verification Standards {#verification}

*   **@mode:manual:** Comprehensive testing (all functions/edges/integrations); detailed performance/security analysis; complete evidence.
*   **@mode:semi:** Standard testing (key functions/common edges/major integrations); standard performance/security validation; standard evidence.
*   **@mode:auto:** Basic testing (critical functions/edges/integrations); basic performance/security validation; minimal evidence.

## 9. Protection Standards {#protection}

*   **@mode:manual:** Strict boundary enforcement; comprehensive snapshots; detailed change verification; ANY change authorization; complete differential analysis; full docs.
*   **@mode:semi:** Standard boundary enforcement; important snapshots; significant change verification; SIGNIFICANT change authorization; standard differential analysis; standard docs.
*   **@mode:auto:** Basic boundary enforcement; essential snapshots; critical change verification; CRITICAL change authorization; basic differential analysis; minimal docs.

## 10. Reference System

### 10.1 Reference Format

Use for cross-referencing checklist items: `[CHECKLIST_CODE].[SECTION].[ITEM].[SUB_ITEM]`

### 10.2 Checklist Codes

| Code  | Checklist Type             |
|-------|----------------------------|
| `DOC` | Documentation Checklists   |
| `IMP` | Implementation Checklists |
| `PRO` | Protection Checklists     |
| `VER` | Verification Checklists   |
| `PRJ` | Project Lifecycle Checklists|

### 10.3 Example Reference

`Reference: VER.2.1.3.1`

## 11. Verification Statement System

Checklists requiring a final verification statement MUST include:

```markdown
## Verification Statement

Use Verification Statement Template: [TEMPLATE_TYPE_ID]
```
*(Note: Standard verification statement templates are defined elsewhere.)*

## 12. Completion Documentation

All checklists should use this standardized completion documentation format (typically managed in `status.md` or dedicated logs):

```markdown
- **Checklist Item**: [ITEM_ID] [ITEM_NAME]
- **Verification Status**: [PASS/FAIL/PARTIAL/NA]
- **Verification Date**: [DATE]
- **Verified By**: [VERIFIER_ID or AI]
- **Evidence**: [Link or reference to evidence]
- **Notes**: [Optional verification notes]
```

## 13. Checklist System Verification Statements

### 13.1 Template Compliance Verification

For checklists using this system, use the standard verification statement format from Rule 100, with:
```
I have applied the Checklist System (105) requirements following the [mode] standards, verified all necessary elements, and ensured compliance with the framework.
```

### 13.2 Mode Standards Verification

When mode standards are applied within a checklist:
```
This checklist applies the relevant Mode Standards as defined in Rule 125 (Mode Implementation Standards) for the current mode (@mode:[mode]).
```