---
description: "Defines the core AI Workflow modes (@mode:manual, @mode:semi, @mode:auto) and their associated standards for process detail, scope, protection, context, verification, and pre-flight checks."
alwaysApply: true
ai_instructions: Apply the appropriate mode standards for each implementation. Follow the detailed requirements for the selected mode (@mode:manual, @mode:semi, @mode:auto) across all aspects of implementation including process detail, scope control, component protection, context management, verification, and pre-flight checks.
---

# Mode Implementation Standards

This document defines the mode-specific requirements with step numbering for the AI Workflow Framework. It serves as a central reference for all mode-specific requirements across framework components.

## 1. Mode Definitions and Selection

### 1.1 Implementation Mode Definitions

*   **@mode:manual:** Maximum oversight with step-by-step approval.
*   **@mode:semi:** Balanced approach with component-level approval.
*   **@mode:auto:** Streamlined approach with phase-level approval.

### 1.2 Mode Characteristics Overview

```
┌─────────────────┬───────────────┬─────────────────┬────────────────┐
│ Characteristic  │ Manual Mode   │ Semi-Auto Mode  │ Auto Mode      │
├─────────────────┼───────────────┼─────────────────┼────────────────┤
│ Risk Tolerance  │ 🔴 Lowest     │ 🟡 Moderate     │ 🟢 Highest     │
│ Verification    │ ■■■■■ Every   │ ■■■□□ Important │ ■■□□□ Critical │
│ Documentation   │ ■■■■■ Complete│ ■■■□□ Standard  │ ■■□□□ Minimal  │
│ Approval Points │ ■■■■■ Each    │ ■■■□□ Component │ ■■□□□ Phase    │
│ Memory Refresh  │ Every 3-5     │ Every 5-10      │ Every 10-15    │
│ Context Headers │ Every message │ Substantive     │ Primary only   │
│ Suitable For    │ Production    │ Standard dev    │ Simple changes │
└─────────────────┴───────────────┴─────────────────┴────────────────┘
```

### 1.3 Mode Selection Criteria

*(Guidance for applying these criteria can be found in the [Mode Selection Decision Tree](AI-workflow-v2/framework-rules/decision-trees/decision-tree-planning-domain.md#2).)*

*   **Manual Mode (@mode:manual) is REQUIRED for:**
    *   Production environments (1.3.1.1)
    *   High-risk operations (1.3.1.2)
    *   Sensitive data access (1.3.1.3)
    *   Complex architecture (1.3.1.4)
    *   Unfamiliar codebases (1.3.1.5)
*   **Semi-Automatic Mode (@mode:semi) is RECOMMENDED for:**
    *   Development environments (1.3.2.1)
    *   Moderate-risk operations (1.3.2.2)
    *   Non-sensitive data access (1.3.2.3)
    *   Familiar patterns (1.3.2.4)
    *   Standard complexity (1.3.2.5)
*   **Automatic Mode (@mode:auto) is SUITABLE for:**
    *   Development environments (1.3.3.1)
    *   Low-risk operations (1.3.3.2)
    *   Non-sensitive data (1.3.3.3)
    *   Well-understood patterns (1.3.3.4)
    *   Simple changes (1.3.3.5)

### 1.4 Mode Selection Documentation Format

```
┌─────────────────────────────────────────────────────┐
│ MODE SELECTION RECORD                               │
├─────────────────────────────────────────────────────┤
│ Selected Mode: @mode:[selected]                     │
│ Selection Justification: [Factors leading to choice]│
│ Alternatives Considered: [@mode:alt1 (reason), ...] │
│ Implementation Approach: [Based on selected mode]   │
│ Confidence: [Rating with explanation]               │
└─────────────────────────────────────────────────────┘
```

### 1.5 Mode Transition Rules

*   **Increased Risk/Complexity:** Automatically transition up (@auto -> @semi -> @manual). (Confidence: 5/5)
*   **Decreased Risk/Complexity:** Requires explicit human approval. Never transition from @manual in production. (Confidence: 3/5)
*   **Human Request:** Follow explicit instruction; document change and reason. (Confidence: 5/5)

## 2. Core Implementation Process Standards

*   **@mode:manual:** Follow ALL phases with COMPREHENSIVE detail; require human approval at EVERY significant step; provide DETAILED documentation for ALL decisions; apply ALL checklists with FULL verification; maintain COMPREHENSIVE status tracking; apply COMPLETE component protection process; create COMPREHENSIVE component snapshots; perform DETAILED verification at EVERY step. (2.1.1-2.1.8)
*   **@mode:semi:** Follow ALL phases with STANDARD detail; require human approval at MAJOR steps; provide STANDARD documentation for SIGNIFICANT decisions; apply CRITICAL checklists with STANDARD verification; maintain STANDARD status tracking; apply STANDARD component protection process; create STANDARD component snapshots; perform VERIFICATION at KEY points. (2.2.1-2.2.8)
*   **@mode:auto:** Follow ALL phases with BASIC detail; require human approval at CRITICAL steps only; provide BASIC documentation for ESSENTIAL decisions; apply ESSENTIAL checklists with BASIC verification; maintain BASIC status tracking; apply BASIC component protection process; create BASIC component snapshots; perform VERIFICATION at CRITICAL points. (2.3.1-2.3.8)

## 3. Scope Control Standards

*   **@mode:manual:** COMPREHENSIVE scope definition; EXPLICIT authorization for EVERY component; PRE-FLIGHT verification before EVERY change; HUMAN approval for ALL boundary cases; VERIFICATION after EVERY change. (3.1.1-3.1.5)
*   **@mode:semi:** STANDARD scope definition; EXPLICIT authorization for PRIMARY components; PRE-FLIGHT verification for SIGNIFICANT changes; HUMAN approval for SIGNIFICANT boundary cases; VERIFICATION after MAJOR changes. (3.2.1-3.2.5)
*   **@mode:auto:** BASIC scope definition; EXPLICIT authorization for CRITICAL components; PRE-FLIGHT verification for CRITICAL changes; HUMAN approval for CRITICAL boundary cases; VERIFICATION after CRITICAL changes. (3.3.1-3.3.5)

## 4. Component Protection Standards

*   **@mode:manual:** Apply COMPREHENSIVE boundary protection; maintain DETAILED registry/snapshots; perform RIGOROUS verification; require EXPLICIT approval for ALL changes; document status in ALL interactions. (4.1.1-4.1.5)
*   **@mode:semi:** Apply STANDARD boundary protection; maintain STANDARD registry/snapshots; perform VERIFICATION at KEY points; require approval for SIGNIFICANT changes; document status at MAJOR steps. (4.2.1-4.2.5)
*   **@mode:auto:** Apply BASIC boundary protection; maintain ESSENTIAL registry info; perform VERIFICATION at CRITICAL points; require approval for CRITICAL changes; document status at PRIMARY interactions. (4.3.1-4.3.5)

## 5. Context Management Standards

*   **@mode:manual:** Context header EVERY message; verification before EVERY change; refresh context 3-5 steps; document ALL decisions; human approval EVERY step; complete ALL checklist items; traverse ALL decision paths; COMPREHENSIVE documentation. (5.1.1-5.1.8)
*   **@mode:semi:** Context header substantive messages; verification for significant changes; refresh context 5-10 steps; document MAJOR decisions; human approval at component boundaries; complete CRITICAL checklist items; traverse MAJOR decision paths; STANDARD documentation. (5.2.1-5.2.8)
*   **@mode:auto:** Context header primary messages; verification for high-risk changes; refresh context 10-15 steps; document CRITICAL decisions; human approval at major milestones; complete ESSENTIAL checklist items; traverse ESSENTIAL decision paths; BASIC documentation. (5.3.1-5.3.8)

## 6. Verification Standards

*   **@mode:manual:** Verify ALL aspects; COMPREHENSIVE tests; MULTIPLE verification levels; document ALL activities; HUMAN verification of results. (6.1.1-6.1.5)
*   **@mode:semi:** Verify KEY aspects; STANDARD tests; BASIC verification levels; document MAJOR activities; HUMAN verification of CRITICAL results. (6.2.1-6.2.5)
*   **@mode:auto:** Verify CRITICAL aspects; ESSENTIAL tests; MINIMAL verification levels; document CRITICAL activities; HUMAN verification of ESSENTIAL results. (6.3.1-6.3.5)

## 7. Pre-Flight Check Standards

*   **@mode:manual:** Apply ALL checks with MAXIMUM detail; verify EVERY aspect; EXPLICIT approval for EVERY check; document ALL evidence; STRINGENT criteria. (7.1.1-7.1.5)
*   **@mode:semi:** Apply KEY checks with STANDARD detail; verify SIGNIFICANT aspects; approval for SIGNIFICANT checks; document STANDARD evidence; STANDARD criteria. (7.2.1-7.2.5)
*   **@mode:auto:** Apply CRITICAL checks with BASIC detail; verify CRITICAL aspects; approval for CRITICAL checks; document BASIC evidence; MINIMAL criteria. (7.3.1-7.3.5)

## Mode Verification Statement

Use the standard verification statement format from Rule 100, with:

```
I have applied the Mode Implementation Standards (125) requirements following the @mode:[mode] standards, verified all necessary elements, and ensured compliance with the framework.
```