# AI Workflow Framework Rules (Optimized)

This directory contains the core AI Workflow Framework rules, optimized for efficiency and clarity.

## Framework Numerical Organization

The framework maintains its numerical categorization system:

1. **100-199: Core** - Core framework components and processes
2. **200-299: Protection** - Protection and safety controls
3. **300-399: Verification** - Verification and quality controls
4. **400-499: Enforcement** - Enforcement mechanisms

## Directory Structure

```
framework-rules/
├── 100-implementation-process.md
├── 105-checklist-system.md
├── 125-mode-implementation-standards.md
├── 150-implementation-state-management.md
├── 175-rule-index.md
├── 200-scope-control.md
├── 225-production-safeguards.md
├── 250-refactoring-controls.md
├── 275-component-integrity-protection.md
├── 300-quality-assurance.md
├── 325-documentation-standards.md
├── 400-checklist-enforcement.md
├── 425-human-checkpoints.md
├── 450-adaptive-pre-flight-checks.md
├── README.md                  # This file
└── checklists/                # Directory containing checklist documents
    └── consolidated/          # Consolidated/Master checklist files
└── decision-trees/            # Decision tree components (Structure TBD)
```

## Key Changes & Consolidation History

This version includes significant optimizations:
* **Boilerplate Reduction:** Removed excessive warnings, emphasis, and mandatory language.
* **AI Instructions:** Added `ai_instructions` metadata for direct AI guidance.
* **Standard Verification:** Standardized verification statements across rules (defined in Rule 100).
* **Consolidation:** Several older rules were consolidated into the current set (see `175-rule-index.md` for history).
* **Removed External Content:** `references/`, `ai-assistant/`, and some `templates/` content were removed to improve focus and reduce token load.

## Usage Guidance

* Refer to the main **`AI-workflow-v2/README.md`** for a general framework overview.
* Use the **`175-rule-index.md`** as a map to the rules within this directory.
* Follow the **`100-implementation-process.md`** as the primary workflow guide.
* Apply rules based on the selected **`@mode`** as defined in **`125-mode-implementation-standards.md`**.
* Identify and apply relevant checklists from the **`checklists/consolidated/`** directory as required by Rule 400.

## Consolidated Components

The framework now includes consolidated documents with step numbering:

1. **125: Mode Implementation Standards** (consolidates all mode-specific requirements)
2. **150: Implementation State Management** (unifies context management and progress tracking)
3. **275: Component Integrity Protection** (integrates component protection and verification)
4. **450: Adaptive Pre-Flight Checks** (combines all pre-flight verification systems)

The following documents have been deprecated and their content consolidated:
- 125-mode-selection.md → 125-mode-implementation-standards.md
- 150-context-management.md → 150-implementation-state-management.md
- 275-component-boundary-protection.md → 275-component-integrity-protection.md
- 325-component-snapshot-verification.md → 275-component-integrity-protection.md
- 350-progress-tracking.md → 150-implementation-state-management.md
- 450-pre-flight-checks.md → 450-adaptive-pre-flight-checks.md
- 455-refactoring-pre-flight-checks.md → 450-adaptive-pre-flight-checks.md

## Step Numbering System

All consolidated documents implement a standardized hierarchical step numbering system:

```
[PHASE-ID].[COMPONENT-ID].[STEP-ID] - [Step Description]
```

Example:
```
3.2.4 - Initialize component registry with protection levels
4.1.2 - Verify interface compatibility with snapshot
```

For tracking and reference purposes, implementations now use this standardized step reference format:

```
┌─────────────────────────────────────────────────────┐
│ STEP REFERENCE: [PHASE-ID].[COMPONENT-ID].[STEP-ID] │
├─────────────────────────────────────────────────────┤
│ Description: [step description]                     │
│ Status: [PENDING/IN PROGRESS/COMPLETE/BLOCKED]      │
│ Dependencies: [list of dependent step references]   │
│ Verification: [verification requirement]            │
│ Approval: [approval requirement]                    │
└─────────────────────────────────────────────────────┘
```

## Key Benefits

1. **Reduced Token Usage**: Eliminates repetitive content across documents
2. **Improved Reference**: Consistent step numbering for precise references
3. **Enhanced Tracking**: Standardized step reference system 
4. **Preserved Security**: All protection mechanisms retained
5. **Backwards Compatibility**: Original rules referenced in consolidated documents

## Enforcement Focus

This framework maintains strict enforcement through:

- Consistent step numbering for tracking (all consolidated documents)
- Strict enforcement mechanisms for checklists (400-series)
- Mandatory human checkpoints and approvals (425)
- Unified pre-flight verification checks (450)
- Comprehensive state management (150)
- Integrated component protection (275)

## Mode-Specific Requirements

All mode-specific requirements are now consolidated in the Mode Implementation Standards document (125):

- **Manual Mode** (@mode:manual): Most rigorous, with full checklist verification
- **Semi-Automatic Mode** (@mode:semi): Standard rigor with key verification points 
- **Automatic Mode** (@mode:auto): Streamlined with essential verification only

See the updated Rule Index (175) and Consolidation Summary for more information about the updated framework structure. 