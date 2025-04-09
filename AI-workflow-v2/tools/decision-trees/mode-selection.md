---
type: "decision-tree"
purpose: "mode-selection"
version: "1.0"
status: "Active"
description: "Decision tree for selecting the appropriate implementation mode"
ai_instructions: "Use this decision tree to determine which implementation mode is most appropriate based on context"
dateCreated: "2025-03-23"
lastUpdated: "2025-03-23"
---

# Mode Selection Decision Tree

## Mode Overview

The AI Workflow Framework defines three implementation modes:

┌───────────────┬─────────────────────────────────────────────────┐
│ @mode:manual  │ Maximum oversight with step-by-step approval    │
├───────────────┼─────────────────────────────────────────────────┤
│ @mode:semi    │ Balanced approach with component-level approval │
├───────────────┼─────────────────────────────────────────────────┤
│ @mode:auto    │ Streamlined approach with phase-level approval  │
└───────────────┴─────────────────────────────────────────────────┘

## Primary Selection Decision Tree

Use this decision tree to determine the appropriate implementation mode:

```
DECISION: Which implementation mode should be used?
├─► PRODUCTION ENVIRONMENT?
│   ├─► Yes → @mode:manual ✅
│   │   └─► CONFIDENCE: ■■■■■ 5/5 - Rule 900 explicitly requires manual mode
│   └─► No → Continue evaluation
├─► HIGH RISK IMPLEMENTATION?
│   ├─► Yes → @mode:manual ✅
│   │   └─► CONFIDENCE: ■■■■□ 4/5 - Rule 100 strongly recommends manual mode
│   └─► No → Continue evaluation
├─► UNFAMILIAR CODEBASE?
│   ├─► Yes → @mode:manual ✅
│   │   └─► CONFIDENCE: ■■■■□ 4/5 - Unfamiliarity increases risk
│   └─► No → Continue evaluation
├─► COMPLEX ARCHITECTURE?
│   ├─► Yes → @mode:manual ✅
│   │   └─► CONFIDENCE: ■■■■□ 4/5 - Complexity increases risk
│   └─► No → Continue evaluation
├─► MODERATE COMPLEXITY WITH FAMILIAR PATTERNS?
│   ├─► Yes → @mode:semi ✅
│   │   └─► CONFIDENCE: ■■■□□ 3/5 - Rule 100 suggests semi mode as appropriate
│   └─► No → Continue evaluation
├─► SIMPLE, ROUTINE CHANGES IN DEV ENVIRONMENT?
│   ├─► Yes → @mode:auto ✅
│   │   └─► CONFIDENCE: ■■■□□ 3/5 - Rule 100 suggests auto mode as appropriate
│   └─► No → Default to @mode:manual ✅
│       └─► CONFIDENCE: ■■■■□ 4/5 - Most conservative default per Rule 100
```

## Mode Transition Decision Tree

Use this decision tree to determine when to change implementation modes:

```
DECISION: Should the implementation mode be changed?
├─► USER EXPLICITLY REQUESTED CHANGE?
│   ├─► Yes → Proceed with requested transition ✅
│   │   └─► CONFIDENCE: ■■■■■ 5/5 - User instruction overrides
│   └─► No → Continue evaluation
├─► DISCOVERED INCREASED COMPLEXITY?
│   ├─► Yes → Transition to more rigorous mode ✅
│   │   └─► @mode:auto → @mode:semi
│   │   └─► @mode:semi → @mode:manual
│   └─► No → Continue evaluation
├─► DISCOVERED INCREASED RISK?
│   ├─► Yes → Transition to more rigorous mode ✅
│   └─► No → Continue evaluation
├─► DISCOVERED DECREASED COMPLEXITY/RISK?
│   ├─► Yes → Consider less rigorous mode ⚠️
│   │   └─► Requires explicit user approval
│   └─► No → Maintain current mode ✓
```

## Use Case Decision Matrix

This matrix shows which mode is most appropriate for different use cases:

┌───────────────────┬─────────────┬─────────────┬─────────────┐
│ Use Case          │ Manual      │ Semi-Auto   │ Auto        │
├───────────────────┼─────────────┼─────────────┼─────────────┤
│ Production Deploy │ ✅ Ideal    │ ❌ Unsafe   │ ❌ Unsafe   │
│ Critical Systems  │ ✅ Ideal    │ ❌ Unsafe   │ ❌ Unsafe   │
│ New Architecture  │ ✅ Ideal    │ ⚠️ Possible │ ❌ Unsafe   │
│ Feature Addition  │ ✅ Safe     │ ✅ Ideal    │ ⚠️ Possible │
│ Bug Fixes         │ ✅ Safe     │ ✅ Ideal    │ ⚠️ Possible │
│ Simple UI Changes │ ⚠️ Overkill │ ✅ Ideal    │ ✅ Ideal    │
│ Documentation     │ ⚠️ Overkill │ ✅ Ideal    │ ✅ Ideal    │
│ Local Development │ ⚠️ Overkill │ ✅ Ideal    │ ✅ Ideal    │
└───────────────────┴─────────────┴─────────────┴─────────────┘

## Mode-Specific Requirements Reference

### Manual Mode (@mode:manual)

┌─────────────────────────────────────────────────────┐
│ MANUAL MODE REQUIREMENTS                            │
│ ├─► Context header in EVERY message                │
│ ├─► Verification checkpoint before EVERY change    │
│ ├─► Memory refresh every 3-5 steps                 │
│ ├─► State snapshot after EACH component            │
│ ├─► User approval required for EVERY step          │
│ └─► Comprehensive documentation                    │
└─────────────────────────────────────────────────────┘

### Semi-Automatic Mode (@mode:semi)

┌─────────────────────────────────────────────────────┐
│ SEMI-AUTO MODE REQUIREMENTS                         │
│ ├─► Context header in substantive messages         │
│ ├─► Verification checkpoint for significant changes │
│ ├─► Memory refresh every 5-10 steps                │
│ ├─► State snapshot after major components          │
│ ├─► User approval for component boundaries         │
│ └─► Standard documentation                         │
└─────────────────────────────────────────────────────┘

### Automatic Mode (@mode:auto)

┌─────────────────────────────────────────────────────┐
│ AUTO MODE REQUIREMENTS                              │
│ ├─► Context header in primary messages only        │
│ ├─► Verification checkpoint for high-risk changes  │
│ ├─► Memory refresh every 10-15 steps               │
│ ├─► State snapshot at phase completion             │
│ ├─► User approval at major milestones              │
│ └─► Essential documentation                        │
└─────────────────────────────────────────────────────┘

## Mode Selection Process

1. Assess implementation context (environment, complexity, risk)
2. Apply decision tree to determine initial mode
3. Document mode selection rationale
4. Apply mode-specific requirements throughout implementation
5. Monitor for mode transition triggers
6. Transition modes if necessary (with approval)

## Default Behavior

If no mode is explicitly specified:

```
Default to @mode:manual for maximum safety
```

## Related Framework Rules

- **Rule 100: Implementation Modes** - Primary rule governing mode selection
- **Rule 200: Scope Control** - Scope verification varies by mode
- **Rule 275: Memory Management** - Memory refresh frequency based on mode
- **Rule 300: Verification Protocols** - Verification depth based on mode
- **Rule 400: Tracking Visualization** - Tracking detail based on mode

## Usage Example

```
CONTEXT: Implementing authentication feature in development environment

ASSESSMENT:
- Not a production environment
- Moderate complexity
- Familiar authentication patterns
- No unusual risks identified

DECISION TREE APPLICATION:
- Production environment? No → Continue
- High risk implementation? No → Continue
- Unfamiliar codebase? No → Continue
- Complex architecture? No → Continue
- Moderate complexity with familiar patterns? Yes → @mode:semi ✅

SELECTION: @mode:semi
RATIONALE: Standard authentication implementation with familiar patterns
in a development environment warrants balanced oversight. 