---
type: "decision-domain"
purpose: "context-management"
version: "1.0"
status: "Active"
description: "Consolidated decision domain for all context and memory management decisions"
ai_instructions: "Use this domain for decisions about context management, memory refresh, handover timing, and token efficiency"
dateCreated: "2025-03-25"
lastUpdated: "2025-03-25"
---

# Context Management Domain

## Overview

The Context Management Domain consolidates all decision trees related to maintaining implementation state, managing memory, optimizing token usage, and determining handover timing. This domain ensures consistent implementation state throughout the workflow process.

## 1. Context Management Decisions

1.1. Required Context Elements:
   - Current Phase [PHASE]: Active implementation phase [ref: decision-tree-standard-factors.md#7]
   - Implementation Mode [MODE]: Selected @mode:[mode]
   - Progress Status [PROG]: Current completion percentage
   - Applicable Rules [RULES]: Framework rules in use
   - Scope Boundaries [SCOPE]: Defined scope limits
   - Current Status [STATUS]: Implementation state with indicator
   - Recent Actions [ACTIONS]: Last completed steps
   - Pending Actions [PENDING]: Next planned steps
   - Verification Status [VERIFY]: Checklist completion status
   - Decision History [DECISIONS]: Key decisions with rationale
   - Component Protection Status [PROTECT]: Protected component status (if applicable)
   - Snapshot Status [SNAPSHOT]: Component snapshot status (if applicable)

1.2. Context Maintenance Approach:
   - Comprehensive Maintenance: For @mode:manual or critical implementations
   - Standard Maintenance: For @mode:semi or standard implementations
   - Basic Maintenance: For @mode:auto or simple implementations

1.3. Context Header Requirements:
   - Comprehensive Header: All context elements with full detail
   - Standard Header: Key context elements with standard detail
   - Basic Header: Essential context elements with minimal detail

1.4. Context Verification Process:
   - Phase Verification: Is current phase correct?
   - Mode Verification: Is implementation mode correct?
   - Progress Verification: Is progress status accurate?
   - Rule Verification: Are applicable rules correctly identified?
   - Scope Verification: Are scope boundaries clear?
   - Status Verification: Is current status accurate?
   - Action Verification: Are recent and pending actions documented?
   - Component Verification: Is component protection status accurate? (if applicable)

### Context Management Decision Process

```
DECISION [D-CTX-1]: What context elements need to be maintained?

FACTORS:
- Implementation Mode: [Evaluate based on @mode]
- Implementation Phase: [Evaluate based on decision-tree-standard-factors.md#7]
- Implementation Complexity: [Evaluate based on decision-tree-standard-factors.md#2]
- Component Protection: [Is component protection active?]

PROCESS:
1. Identify Required Context Elements (1.1)
2. Determine Context Maintenance Approach (1.2)
3. Define Context Header Requirements (1.3)
4. Establish Context Verification Process (1.4)

OUTCOMES:
- Comprehensive Context Maintenance: All elements with full detail
- Standard Context Maintenance: Key elements with standard detail
- Basic Context Maintenance: Essential elements with minimal detail
```

## 2. Memory Refresh Decisions

2.1. Memory Refresh Triggers:
   - Approaching Token Context Limit (>70% used) → MEMORY REFRESH REQUIRED
   - Extended Implementation Session (>30 minutes) → MEMORY REFRESH REQUIRED
   - Framework Rule Deviation Observed → MEMORY REFRESH REQUIRED
   - Inconsistent Application of Standards → MEMORY REFRESH REQUIRED
   - Confusion About Current Implementation State → MEMORY REFRESH REQUIRED
   - Phase Transition (e.g., Planning → Implementation) → MEMORY REFRESH RECOMMENDED
   - After Significant Pause in Implementation → MEMORY REFRESH REQUIRED
   - Significant Scope or Requirement Changes → MEMORY REFRESH REQUIRED
   - Human Indicates Confusion or Misalignment → MEMORY REFRESH REQUIRED

2.2. Memory Management Approach:
   - Comprehensive Memory Management: For @mode:manual, production environments, or complex implementations
   - Standard Memory Management: For @mode:semi or standard implementations
   - Minimal Memory Management: For @mode:auto or simple implementations

2.3. Memory Refresh Protocol:
   - Pause Implementation: Stop current work and note progress
   - Review Critical Context: Mode, phase, scope, rules, status
   - Document Memory Refresh: State reason and level
   - Execute Refresh: Apply appropriate approach
   - Verify Memory Accuracy: Review implementation understanding
   - Resume Implementation: Continue from interruption point

2.4. Memory Issue Indicators:
   - Framework Rule Amnesia: Forgetting to apply rules
   - Context Confusion: Uncertainty about state
   - Implementation Inconsistency: Changing approaches without justification
   - Task Amnesia: Forgetting current tasks

### Memory Refresh Decision Process

```
DECISION [D-MEM-1]: Is memory refresh needed?

FACTORS:
- Token Usage: [Current percentage of context limit used]
- Session Duration: [Time elapsed in current session]
- Memory Indicators: [Signs of memory degradation observed]
- Implementation Mode: [Current @mode]
- Implementation Phase: [Current phase]
- Implementation Complexity: [Based on decision-tree-standard-factors.md#2]

PROCESS:
1. Check for Memory Refresh Triggers (2.1)
2. Determine Memory Management Approach (2.2)
3. Apply Memory Refresh Protocol if needed (2.3)
4. Monitor for Memory Issue Indicators (2.4)

OUTCOMES:
- MEMORY REFRESH REQUIRED: Must perform refresh before continuing
- MEMORY REFRESH RECOMMENDED: Should consider refresh but may continue
- NO MEMORY REFRESH NEEDED: Can continue without refresh
```

## 3. Handover Timing Decisions

3.1. Handover Need Assessment:
   - Implementation Complete → No handover needed
   - Implementation at Logical Boundary → Handover may be appropriate
   - Complex State Requiring Preservation → Prefer continuation
   - Implementation at Phase Boundary → Suitable for handover
   - Significant Context Volume → Handover challenging
   - Component Protection Active → Enhanced handover required
   - Human Explicitly Requests Handover → Perform handover
   - Implementation in Progress → Prefer continuation

3.2. Handover Approach Selection:
   - Comprehensive Handover: For complex implementations or protected components
   - Standard Handover: For typical implementations
   - Basic Handover: For simple implementations with minimal state

3.3. Handover Preparation Requirements:
   - Implementation Identification: Plan name, ID, date, mode
   - Current Implementation State: Phase, progress, last completed step, next pending step
   - Scope Summary: In-scope and out-of-scope components, modification levels
   - Framework Rules: Active rules, mode-specific requirements
   - Component Protection Status: Protected components, snapshots, verification status (if applicable)
   - Completed and Pending Components: Status and details
   - Decision History: Key decisions with rationale
   - Known Issues: Description and status
   - Checklist Status: Status of all applicable checklists
   - Critical Context Elements: Important context to preserve
   - Resumption Instructions: How to resume implementation

3.4. Handover Documentation Format:
   - Comprehensive Documentation: All elements with detailed information
   - Standard Documentation: Key elements with standard information
   - Basic Documentation: Essential elements with minimal information

### Handover Timing Decision Process

```
DECISION [D-HAND-1]: Is implementation handover needed?

FACTORS:
- Implementation Status: [Current completion state]
- Implementation Phase: [Current phase]
- Context Complexity: [Volume and complexity of current context]
- Component Protection: [Active protection status]
- Human Requests: [Explicit handover requests]

PROCESS:
1. Assess Handover Need (3.1)
2. Select Appropriate Handover Approach (3.2)
3. Determine Handover Preparation Requirements (3.3)
4. Define Handover Documentation Format (3.4)

OUTCOMES:
- HANDOVER RECOMMENDED: Should prepare for handover
- CONTINUATION PREFERRED: Should continue current implementation
- HANDOVER REQUIRED: Must perform handover (e.g., human request)
```

## 4. Token Efficiency Decisions

4.1. Token Usage Optimization:
   - Focus on Essential Information: Prioritize critical implementation details
   - Use Concise Language: Eliminate unnecessary verbiage
   - Reference Standard Factors: Use references to standard decision factors
   - Structured Format: Use consistent, space-efficient formats
   - Progressive Detail: Present information with increasing specificity
   - Context Headers: Use appropriate level of context headers

4.2. Token Efficiency Techniques:
   - Comprehensive Context Headers: Use for @mode:manual or complex implementations
   - Standard Context Headers: Use for @mode:semi or standard implementations
   - Basic Context Headers: Use for @mode:auto or simple implementations
   - Reference Factor IDs: Use standardized identifiers from factors document
   - Abbreviated Notation: Use established abbreviations for common elements
   - Decision References: Reference previous decisions rather than repeating

4.3. Memory Allocation Prioritization:
   - Critical Framework Rules: Always maintain in active memory
   - Current Implementation Phase: Always maintain in active memory
   - Active Component Details: Prioritize components currently being modified
   - Protection Requirements: Prioritize for protected components
   - Decision History: Maintain for key decisions
   - Contextual Information: Adjust based on relevance to current task

4.4. Content Prioritization Framework:
   - Must Retain: Implementation mode, current phase, scope boundaries, protection status
   - High Priority: Active component details, current verification status, pending actions
   - Medium Priority: Recent decisions, completed components, rule application details
   - Lower Priority: Detailed history, alternative options, extended rationales

### Token Efficiency Decision Process

```
DECISION [D-TOKEN-1]: How should token usage be optimized?

FACTORS:
- Implementation Mode: [Current @mode]
- Implementation Phase: [Current phase]
- Implementation Complexity: [Based on decision-tree-standard-factors.md#2]
- Context Volume: [Amount of context to maintain]
- Component Protection: [Active protection requirements]

PROCESS:
1. Apply Token Usage Optimization Principles (4.1)
2. Select Appropriate Efficiency Techniques (4.2)
3. Prioritize Memory Allocation (4.3)
4. Implement Content Prioritization (4.4)

OUTCOMES:
- Comprehensive Efficiency Approach: For complex implementations
- Standard Efficiency Approach: For typical implementations
- Basic Efficiency Approach: For simple implementations
```

## Mode-Specific Context Requirements

### Manual Mode (@mode:manual)
- Maintain COMPREHENSIVE context with ALL elements
- Perform context refreshes at EVERY major step
- Include DETAILED context headers
- Create COMPREHENSIVE handover documents
- Verify context state CONTINUOUSLY
- Maintain COMPLETE component protection context
- Include ALL component-specific headers
- Apply MAXIMUM token efficiency techniques

### Semi-Automatic Mode (@mode:semi)
- Maintain STANDARD context with KEY elements
- Perform context refreshes at SIGNIFICANT steps
- Include STANDARD context headers
- Create STANDARD handover documents
- Verify context state at MAJOR decision points
- Maintain STANDARD component protection context
- Include component-specific headers at KEY points
- Apply STANDARD token efficiency techniques

### Automatic Mode (@mode:auto)
- Maintain BASIC context with ESSENTIAL elements
- Perform context refreshes at CRITICAL steps
- Include BASIC context headers
- Create BASIC handover documents
- Verify context state at PHASE transitions
- Maintain BASIC component protection context
- Include component-specific headers at CRITICAL points
- Apply BASIC token efficiency techniques

## Context Management Domain Integration Points

- Links to [Protection Domain](decision-tree-protection-domain.md) for protection context
- Links to [Verification Domain](decision-tree-verification-domain.md) for verification context
- Links to [Planning Domain](decision-tree-planning-domain.md) for planning context

## Context Decision Documentation Standard

Use the standard decision documentation format with these context-specific elements:

```
DECISION [D-ID]: [Context management decision question]

CONTEXT: [Current implementation context]

CONTEXT FACTORS:
- Implementation Mode: [@mode]
- Implementation Phase: [Current phase]
- Context Status: [Current context state]
- Memory Indicators: [Current memory status]
- Token Usage: [Current token status]

CONTEXT OUTCOME: [Context decision outcome]

CONFIDENCE: [■■■■□ 4/5]

CONTEXT ACTIONS:
1. [Action 1 required based on decision]
2. [Action 2 required based on decision]

MEMORY IMPACTS:
- [Impact 1 on memory/context]
- [Impact 2 on memory/context]
``` 