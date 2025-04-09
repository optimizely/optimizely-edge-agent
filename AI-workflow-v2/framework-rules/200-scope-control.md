---
type: "rule"
purpose: "scope_control"
category: "Protection"
version: "1.2"
status: "Active"
description: Defines the system for controlling implementation scope. Covers defining in/out scope, using protection levels from Rule 275, restrictions, pre-flight checks, boundary decisions, exceptions, and mode variations. Apply before and during any modification.
dateCreated: "2023-03-10"
lastUpdated: "2024-05-29"
ai_instructions: "Apply before any file modification or system interaction. Verify actions against defined scope (in/out), Protection Levels defined in Rule 275, and restrictions. Use pre-flight verification (Section 4) and the Scope Boundary Decision Tree. Escalate boundary cases or ambiguities for human approval."
sourceRules: ["275-component-integrity-protection.md"]
alwaysApply: true
applicablePhases: ["Planning", "Implementation", "Verification"]
---

# Scope Control System

This document defines the scope control system used to define and enforce scope boundaries for all implementations to prevent unauthorized changes and scope creep.

## 1. Scope Definition Requirements

*(Guidance for defining scope and evaluating boundaries can be found in the [Scope Boundary Decision Tree](AI-workflow-v2/framework-rules/decision-trees/decision-tree-protection-domain.md#2).)*

Every implementation plan (`plan.md`) should define:

1.  **In-Scope Items:** Explicit list of components/files to be modified.
2.  **Out-of-Scope Items:** Explicit list of components/files that should NOT be modified.
3.  **Protection Levels:** Assigned Protection Level for each in-scope item (Using levels from Rule 275, Section 2).
4.  **Modification Restrictions:** Specific limitations on changes (if any).
5.  **Approval Requirements:** Required approvals for specific modifications (often dictated by Protection Level).
6.  **Verification Approach:** How scope compliance will be verified.

## 2. Scope Definition Template Format

Use this structure within `plan.md` or a dedicated scope file:

```markdown
# Implementation Scope Definition

## In-Scope Components
- [Path/Component 1] - [Protection Level from Rule 275 (e.g., @INTERFACE)] - Permitted: [specific modifications allowed under level/plan]
- ...

## Out-of-Scope Components
- [Path/Component A] - @LOCKED (Implicit or Explicit) - Rationale: [reason]
- ...

## Modification Restrictions
- [Restriction 1]: Applies to [Components], Rationale: [reason]
- ...

## Approval Requirements (Refer to Rule 275 & 425)
- [Requirement 1]: Process: [details], Applies to: [Components/Actions/Protection Level]
- ...

## Scope Boundaries Verification
- Method: [description], Criteria: [details]
- ...
```

## 3. Scope Boundary Decision Tree

Before modifying any component, follow this logic:

1.  **Is component explicitly IN SCOPE?**
    *   Yes -> Go to 2
    *   No -> Is component explicitly OUT OF SCOPE? -> Prohibited ❌
    *   No -> Not explicitly defined? -> Clarify/Seek Approval ⚠️ (Is it required for in-scope work? Is it a reasonable extension? If unclear or unrelated -> Prohibited ❌)
2.  **What is the component's Protection Level (Rule 275)?**
    *   `@LOCKED` -> Prohibited ❌ (Unless explicit override per Rule 275)
    *   `@INTERFACE` -> Go to 3a
    *   `@BEHAVIOR` -> Go to 3b
    *   `@FLEXIBLE` -> Go to 4
3.  **Does the modification respect the Protection Level?**
    *   a) `@INTERFACE`: Does it change the external interface? -> Special Approval Required (Rule 275) ⚠️ | No -> Go to 4
    *   b) `@BEHAVIOR`: Does it change the functional behavior? -> Verification/Approval Required (Rule 275) ⚠️ | No -> Go to 4
4.  **Is modification within defined RESTRICTIONS?**
    *   Yes -> Go to 5
    *   No -> Prohibited ❌
5.  **Is required APPROVAL obtained (based on level/restrictions/plan)?**
    *   Yes / Not Needed -> Permitted ✅
    *   No -> Seek Approval First ❌

## 4. Pre-Flight Scope Verification Format

Document this verification (e.g., in `status.md` or pre-flight check logs) before proceeding with a modification:

```markdown
**SCOPE PRE-FLIGHT VERIFICATION**
- **Component:** [component name/path]
- **Protection Level:** [Level from Rule 275]
- **Planned Mod:** [description]
- **Respects Level?** [YES/NO/N/A]
- **Within Restrictions?** [YES/NO]
- **Approval Obtained?** [YES/NO/N/A]
- **RESULT:** [PASS/FAIL]
```

## 5. Scope Boundary Exceptions

*   **Not Permitted:** Modifying `@LOCKED` components without override; changes in Production without approval (Rule 225); unauthorized changes to security/data-integrity components.
*   **Explicit Human Approval Required:** Violating specific restrictions; modifying adjacent/required components not explicitly in scope; changes needing Enhanced/Critical approval per Protection Level (Rule 275).
*   **Standard Approval May Suffice:** Minor extensions to `@FLEXIBLE` components; closely related components not explicitly defined if required for implementation integrity (requires justification).

## 6. Mode-Specific Requirements

Refer to **Rule 125 (Mode Implementation Standards), Section 3 (Scope Control Standards)** for mode-specific details on definition depth, authorization granularity, pre-flight frequency, approval triggers, and documentation levels.

## 7. Scope Control Enforcement

Enforced via:
1.  Scope Definition in `plan.md` (using Rule 275 levels).
2.  Pre-Flight Checks (Sec 4).
3.  Human Checkpoints for boundary cases.
4.  Post-Implementation Verification.
5.  Context Header tracking (implicit).

## Scope Control Verification

Use the standard verification statement format from Rule 100, with:

```
I have applied the Scope Control (200) requirements following the @mode:[mode] standards, verified all necessary elements (using Protection Levels from Rule 275), and ensured compliance with the framework.
```

