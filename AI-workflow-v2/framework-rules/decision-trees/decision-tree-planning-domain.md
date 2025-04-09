---
type: "decision-domain"
purpose: "planning"
version: "1.0"
status: "Active"
description: "Consolidated decision domain for all planning-related decisions"
ai_instructions: "Use this domain for decisions about plan structure, mode selection, checklist selection, documentation depth, human checkpoints, and rule application"
dateCreated: "2025-03-25"
lastUpdated: "2025-03-25"
---

# Planning Domain

## Overview

The Planning Domain consolidates all decision trees related to implementation planning, mode selection, checklist application, rule application, documentation requirements, and human checkpoint management. This domain guides the establishment of appropriate implementation processes and structures.

## 1. Plan Structure Decisions

1.1. Complexity-Based Plan Structure:
   - High Complexity [COMP-HIGH] → Comprehensive Plan Structure [ref: decision-tree-standard-factors.md#2.1]
   - Medium Complexity [COMP-MED] → Standard Plan Structure [ref: decision-tree-standard-factors.md#2.2]
   - Low Complexity [COMP-LOW] → Simple Plan Structure [ref: decision-tree-standard-factors.md#2.3]

1.2. Core Plan Elements:
   - Requirements Analysis: Understanding implementation requirements
   - Scope Definition: Defining clear boundaries
   - Component Identification: Identifying affected components
   - Risk Assessment: Evaluating implementation risks
   - Task Breakdown: Breaking implementation into tasks
   - Dependency Analysis: Identifying dependencies
   - Verification Approach: Defining verification strategy
   - Documentation Requirements: Planning required documentation

1.3. Plan Type Selection:
   - Multi-Component Plan: For implementations affecting multiple components
   - Single-Component Plan: For implementations focused on one component
   - Feature Implementation Plan: For adding new features
   - Bug Fix Plan: For addressing specific issues
   - Refactoring Plan: For code improvement without behavioral changes
   - Documentation Plan: For documentation-focused implementations

1.4. Plan Documentation Requirements:
   - README.md: Overview and basic information
   - plan.md: Detailed implementation plan
   - scope.md: Scope definition and boundaries
   - status.md: Implementation status tracking
   - components/: Component-specific documentation
   - decisions/: Decision records

### Plan Structure Decision Process

```
DECISION [D-PLAN-1]: What plan structure is appropriate?

FACTORS:
- Implementation Complexity: [Evaluate based on decision-tree-standard-factors.md#2]
- Implementation Scope: [Number and types of components affected]
- Implementation Type: [Feature/Bug Fix/Refactoring/Documentation]
- Implementation Mode: [Current @mode]
- Risk Level: [Evaluate based on decision-tree-standard-factors.md#3]

PROCESS:
1. Determine Complexity-Based Plan Structure (1.1)
2. Identify Required Core Plan Elements (1.2)
3. Select Appropriate Plan Type (1.3)
4. Define Plan Documentation Requirements (1.4)

OUTCOMES:
- Comprehensive Plan Structure: Detailed plan with all elements
- Standard Plan Structure: Standard plan with key elements
- Simple Plan Structure: Minimal plan with essential elements
```

## 2. Mode Selection Decisions

2.1. Mode Selection Factors:
   - Production Environment [ENV-PROD] → @mode:manual [ref: decision-tree-standard-factors.md#1.1]
   - High-Risk Operations [RISK-CRIT/RISK-HIGH] → @mode:manual [ref: decision-tree-standard-factors.md#3.1/3.2]
   - Sensitive Data Access [DATA-HIGH] → @mode:manual [ref: decision-tree-standard-factors.md#6.1]
   - Complex Architecture [COMP-HIGH] → @mode:manual [ref: decision-tree-standard-factors.md#2.1]
   - Moderate Complexity with Familiar Patterns → @mode:semi
   - Simple Changes in Development Environment → @mode:auto

2.2. Mode Transition Assessment:
   - Increased Risk Detected → Transition to more rigorous mode
   - Decreased Risk Confirmed (non-production) → Transition may be considered
   - Unexpected Complexity Discovered → Transition to more rigorous mode
   - Human Explicitly Requests Mode Change → Follow human instruction

2.3. Mode-Specific Implementation Paths:
   - @mode:manual Path:
     - Apply ALL checklists in full detail
     - Require human approval at EVERY step
     - Document ALL decisions comprehensively
     - Verify ALL implementation aspects
     - Apply ALL safety controls
   - @mode:semi Path:
     - Apply CRITICAL checklists with standard detail
     - Require human approval at SIGNIFICANT steps
     - Document SIGNIFICANT decisions with standard detail
     - Verify KEY implementation aspects
     - Apply STANDARD safety controls
   - @mode:auto Path:
     - Apply ESSENTIAL checklists with basic detail
     - Require human approval at CRITICAL steps only
     - Document CRITICAL decisions with basic detail
     - Verify ESSENTIAL implementation aspects
     - Apply BASIC safety controls

2.4. Mode Selection Documentation:
   ```
   MODE SELECTION DECISION RECORD
   Selected Mode: @mode:[selected]
   Confidence: [confidence rating] - [explanation]
   Primary Factors:
   - [factor 1 that influenced decision]
   - [factor 2 that influenced decision]
   - [factor 3 that influenced decision]
   Alternatives Considered:
   - [alternative 1] - [why rejected]
   - [alternative 2] - [why rejected]
   
   Decision Path: [key decision tree branches followed]
   ```

### Mode Selection Decision Process

```
DECISION [D-MODE-1]: Which implementation mode should be used?

FACTORS:
- Environment Type: [Evaluate based on decision-tree-standard-factors.md#1]
- Risk Level: [Evaluate based on decision-tree-standard-factors.md#3]
- Implementation Complexity: [Evaluate based on decision-tree-standard-factors.md#2]
- Data Sensitivity: [Evaluate based on decision-tree-standard-factors.md#6]
- Human Preferences: [Any explicit mode requests]

PROCESS:
1. Evaluate Mode Selection Factors (2.1)
2. Consider potential Mode Transitions (2.2)
3. Understand Mode-Specific Implementation Paths (2.3)
4. Document Mode Selection Decision (2.4)

OUTCOMES:
- @mode:manual: Maximum rigor with comprehensive controls
- @mode:semi: Balanced approach with standard controls
- @mode:auto: Streamlined approach with essential controls
```

## 3. Checklist Selection Decisions

3.1. Required Checklist Types:
   - Implementation Planning Checklist: Before implementation begins
   - Scope Definition Checklist: During scope definition
   - Path Correctness Checklist: Before file operations
   - Phase Transition Checklist: At phase boundaries
   - Implementation Verification Checklist: After implementation
   - Production Safeguard Checklist: Before production changes
   - Handover Preparation Checklist: Before implementation handover
   - Component Protection Checklist: For protected components
   - Refactoring Verification Checklist: During refactoring operations

3.2. Checklist Application Approach:
   - Comprehensive Application: All items with detailed verification
   - Standard Application: Critical items with standard verification
   - Basic Application: Essential items with minimal verification

3.3. Checklist Verification Requirements:
   - Item-by-Item Verification: Verify each item individually
   - Evidence Documentation: Document verification evidence
   - Failure Handling: Address any failed items
   - Approval Requirements: Obtain required approvals
   - Verification Recording: Document checklist completion

3.4. Mode-Specific Checklist Requirements:
   - Manual Mode (@mode:manual):
     - ALL checklists with FULL detail
     - EVERY checklist item verified
     - COMPREHENSIVE evidence documented
     - EXPLICIT human approval for each checklist
   - Semi-Automatic Mode (@mode:semi):
     - CRITICAL checklists with STANDARD detail
     - KEY checklist items verified
     - SUFFICIENT evidence documented
     - HUMAN approval for MAJOR checklists
   - Automatic Mode (@mode:auto):
     - ESSENTIAL checklists with BASIC detail
     - CORE checklist items verified
     - BASIC evidence documented
     - HUMAN approval for CRITICAL checklists

### Checklist Selection Decision Process

```
DECISION [D-CHECK-1]: What checklists are required?

FACTORS:
- Implementation Phase: [Evaluate based on decision-tree-standard-factors.md#7]
- Implementation Activity: [Current implementation activity]
- Implementation Mode: [Current @mode]
- Component Protection: [Any protected components involved]
- Risk Level: [Evaluate based on decision-tree-standard-factors.md#3]

PROCESS:
1. Identify Required Checklist Types (3.1)
2. Determine Checklist Application Approach (3.2)
3. Establish Checklist Verification Requirements (3.3)
4. Apply Mode-Specific Checklist Requirements (3.4)

OUTCOMES:
- COMPREHENSIVE CHECKLIST APPLICATION: All checklists with full detail
- STANDARD CHECKLIST APPLICATION: Critical checklists with standard detail
- BASIC CHECKLIST APPLICATION: Essential checklists with basic detail
```

## 4. Rule Application Decisions

4.1. Applicable Framework Rules:
   - Implementation Process Rules: Core process requirements
   - Mode-Specific Rules: Requirements based on selected mode
   - Protection Rules: Safety and boundary controls
   - Verification Rules: Quality and validation controls
   - Enforcement Rules: Compliance mechanisms

4.2. Rule Prioritization Framework:
   - Critical Rules: Must be applied without exception
   - High-Priority Rules: Should be applied in nearly all cases
   - Standard Rules: Applied based on context
   - Guidance Rules: Applied when relevant

4.3. Rule Conflict Resolution:
   - Explicit user instructions override all components
   - Protection components override other components
   - Mode-specific requirements override general requirements
   - Context-specific requirements override broad requirements
   - Component protection requirements override general refactoring requirements

4.4. Rule Application Documentation:
   - Document which rules are being applied
   - Record any exceptions or modifications
   - Document rule conflicts and resolutions
   - Verify consistent rule application
   - Document rule application verification

### Rule Application Decision Process

```
DECISION [D-RULE-1]: What framework rules apply?

FACTORS:
- Implementation Mode: [Current @mode]
- Implementation Phase: [Current phase]
- Protection Requirements: [Any protection mechanisms active]
- Component Types: [Types of components involved]
- Risk Level: [Evaluate based on decision-tree-standard-factors.md#3]

PROCESS:
1. Identify Applicable Framework Rules (4.1)
2. Apply Rule Prioritization Framework (4.2)
3. Resolve Any Rule Conflicts (4.3)
4. Document Rule Application (4.4)

OUTCOMES:
- COMPREHENSIVE RULE APPLICATION: All applicable rules applied in detail
- STANDARD RULE APPLICATION: Critical and high-priority rules applied
- BASIC RULE APPLICATION: Only critical rules applied
```

## 5. Documentation Depth Decisions

5.1. Documentation Depth Requirements:
   - Production Environment [ENV-PROD] → Comprehensive Documentation [ref: decision-tree-standard-factors.md#1.1]
   - High-Risk Operations [RISK-CRIT/RISK-HIGH] → Comprehensive Documentation [ref: decision-tree-standard-factors.md#3.1/3.2]
   - Complex Implementation [COMP-HIGH] → Comprehensive Documentation [ref: decision-tree-standard-factors.md#2.1]
   - Standard Implementation [COMP-MED] → Standard Documentation [ref: decision-tree-standard-factors.md#2.2]
   - Simple Changes [COMP-LOW] → Basic Documentation [ref: decision-tree-standard-factors.md#2.3]

5.2. Documentation Elements:
   - Implementation Overview: Basic description
   - Requirements Documentation: Detailed requirements
   - Architecture Documentation: System architecture
   - Component Documentation: Component details
   - Interface Documentation: API and interfaces
   - Decision Documentation: Key decisions
   - Verification Documentation: Testing and verification
   - User Documentation: End-user instructions

5.3. Documentation Structure Requirements:
   - Consistent Format: Standardized formatting
   - Clear Organization: Logical structure
   - Progressive Detail: From overview to specifics
   - Cross-References: Links between related documents
   - Metadata: Creation date, version, status
   - Change History: Document revisions

5.4. Documentation Quality Verification:
   - Accuracy Check: Information is correct
   - Completeness Check: All required elements included
   - Clarity Check: Information is clear and understandable
   - Consistency Check: Terminology and style are consistent
   - Structure Check: Organization follows standards
   - Reference Check: Links and references are valid

### Documentation Depth Decision Process

```
DECISION [D-DOC-1]: What documentation depth is needed?

FACTORS:
- Environment Type: [Evaluate based on decision-tree-standard-factors.md#1]
- Risk Level: [Evaluate based on decision-tree-standard-factors.md#3]
- Implementation Complexity: [Evaluate based on decision-tree-standard-factors.md#2]
- Implementation Mode: [Current @mode]
- Audience Requirements: [Who will use the documentation]

PROCESS:
1. Determine Documentation Depth Requirements (5.1)
2. Identify Required Documentation Elements (5.2)
3. Apply Documentation Structure Requirements (5.3)
4. Plan Documentation Quality Verification (5.4)

OUTCOMES:
- COMPREHENSIVE DOCUMENTATION: Detailed documentation of all aspects
- STANDARD DOCUMENTATION: Documentation of key aspects
- BASIC DOCUMENTATION: Essential documentation only
```

## 6. Human Checkpoint Decisions

6.1. Human Checkpoint Requirements:
   - Phase Transitions: Between implementation process phases
   - Critical Decision Points: When making significant implementation decisions
   - Implementation Milestones: At completion of major implementation components
   - Scope Boundary Cases: When approaching or potentially exceeding scope
   - Risk Mitigation Points: Before high-risk operations
   - Verification Gates: After implementation verification

6.2. Approval Type Requirements:
   - Formal Approval: Explicit decision required
   - Review and Feedback: Input without formal decision
   - Information Checkpoint: Keeping human informed
   - Direction Checkpoint: Seeking guidance

6.3. Checkpoint Presentation Format:
   ```
   HUMAN CHECKPOINT: [checkpoint type]
   
   CURRENT STATE:
   - Implementation Phase: [phase]
   - Progress: [progress percentage]
   - Current Status: [status description]
   
   CHECKPOINT PURPOSE:
   [Clear explanation of why approval is needed]
   
   APPROVAL REQUEST:
   [Specific request requiring explicit response]
   
   OPTIONS:
   1. APPROVE: [implications of approval]
   2. REJECT: [implications of rejection]
   3. MODIFY: [modification instructions]
   ```

6.4. Checkpoint Documentation Requirements:
   ```
   CHECKPOINT DOCUMENTATION
   CHECKPOINT ID: [identifier]
   TYPE: [checkpoint type]
   TIMESTAMP: [date/time]
   REQUEST: [approval requested]
   RESPONSE: [human response]
   OUTCOME: [approved/rejected/modified]
   IMPLEMENTATION: [actions taken]
   ```

### Human Checkpoint Decision Process

```
DECISION [D-HUMAN-1]: When are human checkpoints required?

FACTORS:
- Implementation Phase: [Current phase]
- Decision Criticality: [Impact and importance of decision]
- Risk Level: [Evaluate based on decision-tree-standard-factors.md#3]
- Implementation Mode: [Current @mode]
- Scope Factors: [Proximity to scope boundaries]

PROCESS:
1. Identify Human Checkpoint Requirements (6.1)
2. Determine Appropriate Approval Type (6.2)
3. Prepare Checkpoint Presentation Format (6.3)
4. Plan Checkpoint Documentation (6.4)

OUTCOMES:
- COMPREHENSIVE CHECKPOINT STRATEGY: Detailed checkpoints at all key points
- STANDARD CHECKPOINT STRATEGY: Checkpoints at major decision points
- BASIC CHECKPOINT STRATEGY: Checkpoints only at critical points
```

## Mode-Specific Planning Requirements

### Manual Mode (@mode:manual)
- Create COMPREHENSIVE plans with ALL details
- Select @mode:manual with ALL safety controls
- Apply ALL checklists with FULL verification
- Apply ALL applicable framework rules
- Create COMPREHENSIVE documentation
- Implement EXTENSIVE human checkpoints
- Document ALL planning decisions and rationales

### Semi-Automatic Mode (@mode:semi)
- Create STANDARD plans with KEY details
- Select @mode:semi with STANDARD safety controls
- Apply CRITICAL checklists with STANDARD verification
- Apply IMPORTANT framework rules
- Create STANDARD documentation
- Implement REGULAR human checkpoints
- Document SIGNIFICANT planning decisions and rationales

### Automatic Mode (@mode:auto)
- Create BASIC plans with ESSENTIAL details
- Select @mode:auto with BASIC safety controls
- Apply ESSENTIAL checklists with BASIC verification
- Apply CRITICAL framework rules
- Create BASIC documentation
- Implement MINIMAL human checkpoints
- Document CRITICAL planning decisions and rationales

## Planning Domain Integration Points

- Links to [Protection Domain](decision-tree-protection-domain.md) for protection planning
- Links to [Context Management Domain](decision-tree-context-management-domain.md) for context tracking
- Links to [Verification Domain](decision-tree-verification-domain.md) for verification planning

## Planning Decision Documentation Standard

Use the standard decision documentation format with these planning-specific elements:

```
DECISION [D-ID]: [Planning decision question]

CONTEXT: [Current implementation context]

PLANNING FACTORS:
- Environment: [Evaluation] [ref: decision-tree-standard-factors.md#1]
- Complexity: [Evaluation] [ref: decision-tree-standard-factors.md#2]
- Risk Level: [Evaluation] [ref: decision-tree-standard-factors.md#3]
- Implementation Mode: [Current @mode]

PLANNING OUTCOME: [Planning decision outcome]

CONFIDENCE: [■■■■□ 4/5]

PLANNING REQUIREMENTS:
1. [Requirement 1 based on decision]
2. [Requirement 2 based on decision]

APPROVAL NEEDS:
- [Approval requirement 1]
- [Approval requirement 2]
``` 