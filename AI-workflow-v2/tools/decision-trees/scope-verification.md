---
type: "decision-tree"
purpose: "scope-verification"
version: "1.0"
status: "Active"
description: "Decision tree for verifying changes against defined scope boundaries"
ai_instructions: "Use this decision tree to verify if changes are within approved scope boundaries"
dateCreated: "2025-03-23"
lastUpdated: "2025-03-23"
---

# Scope Verification Decision Tree

## Core Verification Concept

Scope verification ensures all changes remain within explicitly defined boundaries. This decision tree provides a standardized approach to verifying changes against scope.

## Primary Scope Verification Decision Tree

Use this decision tree before making any file or component changes:

```
DECISION: Is this change within approved scope?
├─► TARGET LOCATION CHECK
│   ├─► File/component in APPROVED FILES list?
│   │   ├─► Yes → Continue verification ✓
│   │   │   └─► CONFIDENCE: ■■■■■ 5/5 - Explicit inclusion in scope
│   │   └─► No → SCOPE VIOLATION ❌
│   │       └─► CONFIDENCE: ■■■■■ 5/5 - Explicit boundary violation
├─► MODIFICATION TYPE CHECK
│   ├─► Change type in APPROVED MODIFICATIONS?
│   │   ├─► Yes → Continue verification ✓
│   │   │   └─► CONFIDENCE: ■■■■■ 5/5 - Approved modification type
│   │   └─► No → SCOPE VIOLATION ❌
│   │       └─► CONFIDENCE: ■■■■■ 5/5 - Unauthorized modification type
├─► IMPACT BOUNDARY CHECK
│   ├─► Change affects ONLY in-scope components?
│   │   ├─► Yes → APPROVED CHANGE ✅
│   │   │   └─► CONFIDENCE: ■■■■■ 5/5 - Within defined boundaries
│   │   └─► No → SCOPE VIOLATION ❌
│   │       └─► CONFIDENCE: ■■■■■ 5/5 - Impact extends beyond scope
```

## Scope Expansion Decision Tree

Use this decision tree when scope expansion appears necessary:

```
DECISION: Is scope expansion justified?
├─► IMPLEMENTATION BLOCKED?
│   ├─► Yes → Continue evaluation ✓
│   │   └─► CONFIDENCE: ■■■■□ 4/5 - Blocking issue may justify expansion
│   └─► No → DENY EXPANSION ❌
│       └─► CONFIDENCE: ■■■■■ 5/5 - No technical necessity
├─► CRITICAL DEPENDENCY?
│   ├─► Yes → Continue evaluation ✓
│   │   └─► CONFIDENCE: ■■■■□ 4/5 - Technical necessity
│   └─► No → DENY EXPANSION ❌
│       └─► CONFIDENCE: ■■■■□ 4/5 - Not technically required
├─► MINIMAL EXPANSION?
│   ├─► Yes → DOCUMENT AND REQUEST APPROVAL ✅
│   │   └─► CONFIDENCE: ■■■■□ 4/5 - Limited scope impact
│   └─► No → DENY EXPANSION ❌
│       └─► CONFIDENCE: ■■■■□ 4/5 - Excessive scope change
```

## Scope Definition Decision Tree

Use this decision tree to verify if a scope definition is adequate:

```
DECISION: Is this scope definition adequate?
├─► EXPLICIT IN-SCOPE ITEMS
│   ├─► Lists specific components/files/functions? 
│   │   ├─► Yes → Continue verification ✓
│   │   │   └─► CONFIDENCE: ■■■■■ 5/5 - Specific inclusions required
│   │   └─► No → INADEQUATE SCOPE ❌ Add specific items
│   │       └─► CONFIDENCE: ■■■■■ 5/5 - Vague scope boundaries
├─► EXPLICIT OUT-OF-SCOPE ITEMS
│   ├─► Lists specific boundaries and exclusions?
│   │   ├─► Yes → Continue verification ✓
│   │   │   └─► CONFIDENCE: ■■■■■ 5/5 - Specific exclusions required
│   │   └─► No → INADEQUATE SCOPE ❌ Add explicit exclusions
│   │       └─► CONFIDENCE: ■■■■■ 5/5 - Unbounded scope risk
├─► FILE/DIRECTORY SPECIFICITY
│   ├─► Lists exact file paths and directories?
│   │   ├─► Yes → Continue verification ✓
│   │   │   └─► CONFIDENCE: ■■■■■ 5/5 - Explicit paths required
│   │   └─► No → INADEQUATE SCOPE ❌ Add specific paths
│   │       └─► CONFIDENCE: ■■■■■ 5/5 - Path ambiguity risk
├─► MODIFICATION TYPES
│   ├─► Defines specific allowed changes per file?
│   │   ├─► Yes → Continue verification ✓
│   │   │   └─► CONFIDENCE: ■■■■□ 4/5 - Specific changes required
│   │   └─► No → INADEQUATE SCOPE ❌ Add change specifications
│   │       └─► CONFIDENCE: ■■■■□ 4/5 - Change ambiguity risk
├─► PROTECTED ELEMENTS
│   ├─► Explicitly identifies protected files/components?
│   │   ├─► Yes → ADEQUATE SCOPE ✅
│   │   │   └─► CONFIDENCE: ■■■■■ 5/5 - Protection boundaries clear
│   │   └─► No → INADEQUATE SCOPE ❌ Add protected elements
│   │       └─► CONFIDENCE: ■■■■■ 5/5 - Protection boundary risk
```

## Scope Compliance Monitoring Decision Tree

Use this decision tree for ongoing scope compliance verification:

```
DECISION: Is implementation maintaining scope compliance?
├─► FILE MODIFICATIONS
│   ├─► Only modifying approved files?
│   │   ├─► Yes → Continue verification ✓
│   │   │   └─► CONFIDENCE: ■■■■■ 5/5 - File compliance required
│   │   └─► No → COMPLIANCE VIOLATION ❌
│   │       └─► CONFIDENCE: ■■■■■ 5/5 - Unauthorized file modification
├─► CHANGE TYPES
│   ├─► Only making approved modification types?
│   │   ├─► Yes → Continue verification ✓
│   │   │   └─► CONFIDENCE: ■■■■■ 5/5 - Change compliance required
│   │   └─► No → COMPLIANCE VIOLATION ❌
│   │       └─► CONFIDENCE: ■■■■■ 5/5 - Unauthorized change type
├─► IMPACT BOUNDARIES
│   ├─► Changes affecting only in-scope components?
│   │   ├─► Yes → Continue verification ✓
│   │   │   └─► CONFIDENCE: ■■■■■ 5/5 - Impact compliance required
│   │   └─► No → COMPLIANCE VIOLATION ❌
│   │       └─► CONFIDENCE: ■■■■■ 5/5 - Unauthorized impact
├─► PROTECTED ELEMENTS
│   ├─► Avoiding all protected files/components?
│   │   ├─► Yes → COMPLIANCE MAINTAINED ✅
│   │   │   └─► CONFIDENCE: ■■■■■ 5/5 - Protection compliance required
│   │   └─► No → COMPLIANCE VIOLATION ❌
│   │       └─► CONFIDENCE: ■■■■■ 5/5 - Protected element violation
```

## Scope Contract Format

Standard format for scope contract:

```
## Implementation Scope Contract
### 1. Scope Boundaries
- **EXPLICITLY IN SCOPE**: ✅ [detailed list of specific files/components/functions]
- **EXPLICITLY OUT OF SCOPE**: ❌ [detailed list of specific exclusions]
- **MODIFICATION LIMITS**: ⚠️ [specific restrictions on changes]

### 2. Authorization Boundaries
- **APPROVED FILES/DIRECTORIES**: [explicit list of files/directories permitted to modify]
- **PROTECTED FILES/DIRECTORIES**: [explicit list of files/directories never to modify]
- **CONDITIONAL ACCESS**: [files/directories with conditional access rules]

### 3. Approved Modifications
- [file/component]: [specific allowed changes]
- [file/component]: [specific allowed changes]

### 4. Banned Modifications
- **GLOBAL RESTRICTIONS**: [types of changes forbidden across all files]
- **FILE-SPECIFIC RESTRICTIONS**: [file-specific forbidden change types]
- **STRUCTURAL LIMITATIONS**: [limits on structural code changes]

### 5. Scope Enforcement Declaration
I commit to STRICTLY adhering to these boundaries.
I will NOT modify any files not explicitly listed in EXPLICITLY IN SCOPE.
I will NOT access files listed in EXPLICITLY OUT OF SCOPE.
I will NOT refactor code outside the specified scope.
I will NOT implement features beyond those defined in this plan.
I will IMMEDIATELY STOP if I detect any potential scope violation.
```

## Mode-Specific Verification Differences

#### Manual Mode (@mode:manual):
- Verify EVERY change against scope boundaries
- Document verification for EVERY file change
- Create snapshots after EACH component

#### Semi-Automatic Mode (@mode:semi):
- Verify SIGNIFICANT changes against boundaries
- Document verification for major changes
- Create snapshots at logical boundaries

#### Automatic Mode (@mode:auto):
- Verify HIGH-RISK changes against boundaries
- Document verification for critical changes
- Create snapshots at phase boundaries

## Scope Violation Response

When a violation is detected:

```
┌─────────────────────────────────────────────────────┐
│ SCOPE VIOLATION DETECTED                            │
│ ├─► Violation Type: [type of boundary crossed]     │
│ ├─► Attempted Change: [what change was attempted]  │
│ ├─► Scope Boundary: [specific boundary violated]   │
│ ├─► Required Action: STOP IMPLEMENTATION           │
│ ├─► Resolution Options:                            │
│ │   1. Request scope expansion with justification  │
│ │   2. Find alternative approach within scope      │
│ └─► Await explicit user instruction               │
└─────────────────────────────────────────────────────┘
```

## Related Framework Rules

- **Rule 200: Scope Control** - Primary rule governing scope boundaries
- **Rule 800: Strict Refactoring** - Enhances scope control for refactoring
- **Rule 900: Production Safeguards** - Strengthens scope control in production

## Usage Example

```
SCOPE VERIFICATION EXAMPLE:

Proposed change: Adding OAuth provider to auth service

DECISION: Is this change within approved scope?
├─► TARGET LOCATION CHECK
│   ├─► File in APPROVED FILES list?
│   │   ├─► Yes (auth.service.js is listed) → Continue ✓
├─► MODIFICATION TYPE CHECK
│   ├─► Change type in APPROVED MODIFICATIONS?
│   │   ├─► Yes (Adding authentication methods is approved) → Continue ✓
├─► IMPACT BOUNDARY CHECK
│   ├─► Change affects ONLY in-scope components?
│   │   ├─► Yes (Only affects auth service) → APPROVED CHANGE ✅

✅ SCOPE VERIFICATION PASSED: Change is within approved scope boundaries.
``` 