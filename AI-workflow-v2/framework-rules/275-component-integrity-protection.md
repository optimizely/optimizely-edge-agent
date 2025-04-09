---
description: Defines the system for protecting component integrity using levels (@LOCKED, @INTERFACE, @BEHAVIOR, @FLEXIBLE), registry, snapshots, boundary enforcement, and verification. Apply when protected components are involved.
alwaysApply: false
ai_instructions: "Apply when working with protected components. Identify protection levels, maintain component registry, create snapshots, enforce boundaries, verify changes, monitor for violations, and include protection status in reports. Follow the modification authorization decision process and enforce protection according to component levels."
---

# Component Integrity Protection System

This document defines the component integrity protection system used to protect component boundaries, verify component state, and prevent unwanted modifications when components require protection.

## 1. Component Protection Overview

```
1.1 PROTECTION DEFINITION → Establish component protection levels
   |
   ↓
1.2 REGISTRY MANAGEMENT → Maintain component protection registry
   |
   ↓
1.3 SNAPSHOT MANAGEMENT → Create and maintain component snapshots
   |
   ↓
1.4 BOUNDARY ENFORCEMENT → Apply protection during operations
   |
   ↓
1.5 VERIFICATION → Validate boundary preservation and state
   |
   ↓
1.6 PROTECTION MONITORING → Detect and prevent violations
   |
   ↓
1.7 PROTECTION REPORTING → Document protection status
```

## 2. Component Protection Levels

*(Guidance for determining appropriate levels ([Protection Level Determination](AI-workflow-v2/framework-rules/decision-trees/decision-tree-protection-domain.md#1)) and assigning them ([Component Protection Assignment](AI-workflow-v2/framework-rules/decision-trees/decision-tree-protection-domain.md#4)) can be found in the Protection Domain Decision Tree.)*

This section defines the standard protection levels...

### 2.1 Protection Level Definitions

Every component requiring protection should be assigned one of these levels in the registry. These levels define both the integrity guarantees and the permitted modification authorization:

*   **`@LOCKED` (🔒):** No modifications permitted (Equivalent to `NO ACCESS`/`READ ONLY`). Interface and behavior are immutable.
*   **`@INTERFACE` (🔵):** Interface must remain stable. Internal implementation changes allowed if behavior is preserved and interface signature is unchanged (Equivalent to aspects of `MINIMAL`/`STANDARD`). Interface modifications require special approval.
*   **`@BEHAVIOR` (🟡):** Functional behavior must be preserved. Interface and internal implementation changes allowed if behavior tests pass (Equivalent to aspects of `STANDARD`/`EXTENDED`). Behavior-altering changes require special approval.
*   **`@FLEXIBLE` (🟢):** Modifications permitted with standard controls (Equivalent to `STANDARD`/`EXTENDED`/`FULL` depending on plan scope). Requires standard verification and approval.

### 2.2 Protection Level Characteristics & Authorization

*   **`@LOCKED`:** Cannot be modified. For critical infrastructure, security components. Any modification attempt fails. Requires explicit override to change status. Risk: MAXIMUM.
    *   *Authorization:* None. Read-only.
*   **`@INTERFACE`:** External interface (API, public methods) must not change. For integration points. Requires interface signature verification. Interface changes need explicit approval. Risk: HIGH.
    *   *Authorization:* Internal implementation changes preserving behavior. Interface changes require enhanced approval.
*   **`@BEHAVIOR`:** Functional behavior must remain identical. For business logic, algorithms. Requires comprehensive before/after behavior comparison/testing. Behavior verification needed for changes. Risk: MEDIUM.
    *   *Authorization:* Implementation and interface changes preserving behavior. Behavior changes require enhanced approval.
*   **`@FLEXIBLE`:** Can be modified with standard care/verification/approval. For internal implementation, non-critical parts. Risk: LOW.
    *   *Authorization:* Defined by the implementation plan scope (can range from MINIMAL to FULL). Standard approval process applies.

## 3. Component Protection Registry

A central registry (e.g., `protection-registry.md` or similar) should list all protected components, their level, justification, and version, maintained throughout the project lifecycle.

### 3.1 Registry Management Process
*   **Initial Creation:** Identify components needing protection, determine level, justify, record version, create registry entries.
*   **Maintenance:** Update registry on level changes, document approval chain, maintain history, verify consistency/completeness.

## 4. Component Snapshot System

Snapshots capture a baseline for verification.

### 4.1 Snapshot Requirements

Snapshots should capture (detail varies by protection level):
*   Content Hash (Cryptographic signature)
*   Interface Definition (Public API/methods)
*   Behavior Specification (Functional documentation)
*   Dependency Map (Internal/External)
*   Protection Level
*   Version Information
*   Metadata (Timestamp, etc.)
*   Critical Paths (Logic flows)

### 4.2 Snapshot Detail by Protection Level
*   **`@LOCKED`:** Complete source capture/hash, comprehensive interface/behavior docs, complete dependencies. Capture BEFORE any nearby operation.
*   **`@INTERFACE`:** Interface definition/hash, comprehensive interface docs, interface behavior spec, interface dependencies. Capture BEFORE interface-affecting ops.
*   **`@BEHAVIOR`:** Behavioral elements, basic interface docs, detailed behavior spec, critical dependencies. Capture BEFORE behavior-affecting ops.
*   **`@FLEXIBLE`:** Key elements, basic interface/behavior docs, major dependencies. Capture BEFORE significant ops.

### 4.3 Snapshot Capture Process
1.  Identify component boundaries.
2.  Determine capture depth based on level.
3.  Document interface.
4.  Capture behavior.
5.  Map dependencies.
6.  Generate content hash/signature.
7.  Store/Register snapshot.
8.  Verify snapshot completeness.

## 5. Boundary Enforcement

### 5.1 Modification Authorization Decision Process

Is modification allowed?
1.  Is it `@LOCKED`? -> NO ❌
2.  Is it `@INTERFACE` and changes interface? -> Special Approval needed ⚠️
3.  Is it `@BEHAVIOR` and changes behavior? -> Verification required ⚠️
4.  Is it `@FLEXIBLE`? -> Standard process ✅
5.  Is there explicit human OVERRIDE? -> Follow Override Protocol (Sec 5.2) ⚠️
6.  Uncertain about impact? -> Assume NO / Seek Clarification ❌

### 5.2 Protection Override Protocol

In EXCEPTIONAL cases:
1.  **Documentation:** Document reason, risk assessment, mitigation plan, obtain high-level approval, define verification.
2.  **Implementation:** Apply temporary suspension (time-limited), enhanced verification, have reversion plan, update registry.

## 6. Verification Process

### 6.1 Differential Analysis Process

Compare current state to baseline snapshot:
1.  Retrieve baseline.
2.  Capture current state.
3.  Compare interfaces.
4.  Analyze behavior.
5.  Verify dependency consistency.
6.  Identify ALL differences.
7.  Classify changes (Interface, Behavior, Implementation, Dependency).
8.  Determine if changes are authorized based on protection level.

### 6.2 Change Classification Matrix

| Change Type   | Protection     | Authorization       |
|---------------|----------------|---------------------|
| INTERFACE     | `@LOCKED`      | NEVER ALLOWED       |
|               | `@INTERFACE`   | SPECIAL APPROVAL    |
|               | `@BEHAVIOR`    | APPROVAL REQUIRED   |
|               | `@FLEXIBLE`    | NORMAL APPROVAL     |
| BEHAVIOR      | `@LOCKED`      | NEVER ALLOWED       |
|               | `@INTERFACE`   | VERIFY NO IMPACT    |
|               | `@BEHAVIOR`    | SPECIAL APPROVAL    |
|               | `@FLEXIBLE`    | NORMAL APPROVAL     |
| IMPLEMENTATION| `@LOCKED`      | NEVER ALLOWED       |
|               | `@INTERFACE`   | VERIFY NO IMPACT    |
|               | `@BEHAVIOR`    | VERIFY PRESERVATION |
|               | `@FLEXIBLE`    | STANDARD PROCESS    |
| DEPENDENCY    | `@LOCKED`      | NEVER ALLOWED       |
|               | `@INTERFACE`   | IMPACT ANALYSIS     |
|               | `@BEHAVIOR`    | IMPACT ANALYSIS     |
|               | `@FLEXIBLE`    | STANDARD PROCESS    |

### 6.3 Verification Requirements by Protection Level
*   **`@LOCKED`:** Pre/Post check component identical (hash compare). Freq: Before/After ALL ops. Approval: For ANY exception.
*   **`@INTERFACE`:** Pre: Capture interface def. Post: Verify interface compatibility (signature compare). Freq: Before/After interface-adjacent ops. Approval: For interface changes.
*   **`@BEHAVIOR`:** Pre: Document behavior. Post: Verify behavior preserved (functional tests). Freq: Before/After behavior-affecting ops. Approval: For significant refactoring.
*   **`@FLEXIBLE`:** Standard pre/post checks and verification. Freq: Standard points. Approval: Standard process.

### 6.4 Verification Decision Process

Are detected changes authorized?
1.  Was a protected component modified? -> Verify level.
2.  Was `@LOCKED` changed? -> Unauthorized ❌
3.  Was `@INTERFACE` changed at interface? -> Verify Special Approval ⚠️
4.  Was `@BEHAVIOR` changed in behavior? -> Verify Behavior Preservation ⚠️
5.  Do changes match approved scope? -> AUTHORIZED ✅
6.  Unexpected changes detected? -> Unauthorized ❌
7.  Uncertainty? -> Requires Investigation ⚠️

## 7. Protection Monitoring

Automated checks (e.g., via static analysis, tests, hooks) SHOULD be used where possible to detect interface, behavior, or dependency changes in protected components.

## 8. Protection Reporting

### 8.1 Verification Report Format (Example)

```markdown
**COMPONENT VERIFICATION REPORT**
- **Component:** [component-id]
- **Protection:** [protection-level]
- **Timestamp:** [verification-time]
- **Status:** [PASSED/FAILED/WARNING]
- **Changes Detected:** [count] ([authorized-count] Auth / [unauthorized-count] Unauth)
- **Action Taken:** [ALLOWED/BLOCKED/ETC]
- **Detected Changes:**
  - [Type] in [Location]: [Desc]. Auth: [Status] ([Reason])
  - ...
- **Verification Steps:**
  - [Method 1]: [Result]
  - ...
- **Recommendations:**
  - [Rec 1]
  - ...
```

## 9. Mode-Specific Requirements

Refer to **Rule 125 (Mode Implementation Standards), Section 4 (Component Protection Standards)** for mode-specific details on registry/snapshot detail, verification rigor, and approval requirements.

## 10. Integration with Pre-Flight Checks

Component protection is verified as part of **Rule 450 (Adaptive Pre-Flight Checks)**, specifically using its modules for Component Protection Verification, Snapshot Verification, and Impact Assessment.

## Component Integrity Protection Verification

Use the standard verification statement format from Rule 100, with:

```
I have applied the Component Integrity Protection (275) requirements following the @mode:[mode] standards, verified all necessary elements, and ensured compliance with the framework.
```

---