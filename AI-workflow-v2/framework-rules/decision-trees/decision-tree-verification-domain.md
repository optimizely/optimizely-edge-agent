---
type: "decision-domain"
purpose: "verification"
version: "1.0"
status: "Active"
description: "Consolidated decision domain for all verification-related decisions"
ai_instructions: "Use this domain for decisions about verification depth, refactoring verification, pre-flight checks, and path correctness"
dateCreated: "2025-03-25"
lastUpdated: "2025-03-25"
---

# Verification Domain

## Overview

The Verification Domain consolidates all decision trees related to ensuring implementation quality, verifying refactoring operations, performing pre-flight checks, and validating path correctness. This domain provides structured approaches for verification throughout the implementation lifecycle.

## 1. Verification Depth Decisions

1.1. Environment-Based Verification Requirements:
   - Production Environment [ENV-PROD] → Comprehensive Verification [ref: decision-tree-standard-factors.md#1.1]
   - Staging Environment [ENV-STAGE] → Thorough Verification [ref: decision-tree-standard-factors.md#1.2]
   - Development Environment [ENV-DEV] → Standard Verification [ref: decision-tree-standard-factors.md#1.3]
   - Local Development → Basic Verification

1.2. Risk-Based Verification Adjustment:
   - Critical Risk [RISK-CRIT] → Comprehensive Verification [ref: decision-tree-standard-factors.md#3.1]
   - High Risk [RISK-HIGH] → Thorough Verification [ref: decision-tree-standard-factors.md#3.2]
   - Medium Risk [RISK-MED] → Standard Verification [ref: decision-tree-standard-factors.md#3.3]
   - Low Risk [RISK-LOW] → Basic Verification [ref: decision-tree-standard-factors.md#3.4]

1.3. Component-Based Verification Requirements:
   - Critical Component [COMP-CRIT] → Component-specific verification [ref: decision-tree-standard-factors.md#4.1]
   - Standard Component [COMP-STD] → Standard verification [ref: decision-tree-standard-factors.md#4.2]
   - Auxiliary Component [COMP-AUX] → Basic verification [ref: decision-tree-standard-factors.md#4.3]

1.4. Mode-Based Verification Approach:
   - Manual Mode (@mode:manual) → Comprehensive verification
   - Semi-Automatic Mode (@mode:semi) → Standard verification
   - Automatic Mode (@mode:auto) → Basic verification

### Verification Depth Decision Process

```
DECISION [D-VER-1]: What verification depth is required?

FACTORS:
- Environment Type: [Evaluate based on decision-tree-standard-factors.md#1]
- Risk Level: [Evaluate based on decision-tree-standard-factors.md#3]
- Component Type: [Evaluate based on decision-tree-standard-factors.md#4]
- Implementation Mode: [Current @mode]

PROCESS:
1. Start with Environment-Based Verification Requirements (1.1)
2. Apply Risk-Based Verification Adjustment (1.2)
3. Consider Component-Based Verification Requirements (1.3)
4. Adjust based on Mode-Based Verification Approach (1.4)
5. Never decrease below Basic Verification
6. Never exceed what's appropriate for the context

OUTCOMES:
- Comprehensive Verification: Maximum verification with all methods
- Thorough Verification: Strong verification with most methods
- Standard Verification: Normal verification with standard methods
- Basic Verification: Minimal verification with essential methods
```

## 2. Refactoring Verification Decisions

2.1. Refactoring Verification Need:
   - @LOCKED Component Modification → VERIFY NO MODIFICATIONS (CRITICAL)
   - @INTERFACE Component Interface Change → VERIFY INTERFACE COMPATIBILITY (CRITICAL)
   - @BEHAVIOR Component Behavior Change → VERIFY BEHAVIOR PRESERVATION (CRITICAL)
   - Structural Refactoring → COMPREHENSIVE VERIFICATION REQUIRED
   - Interface Refactoring → INTERFACE-SPECIFIC VERIFICATION REQUIRED
   - Performance Refactoring → PERFORMANCE-SPECIFIC VERIFICATION REQUIRED
   - Local Refactoring → STANDARD VERIFICATION REQUIRED
   - Format Refactoring → BASIC VERIFICATION REQUIRED

2.2. Component Snapshot Requirements:
   - @LOCKED Components → COMPLETE source capture with hash
   - @INTERFACE Components → INTERFACE definition with hash
   - @BEHAVIOR Components → BEHAVIORAL elements capture
   - @FLEXIBLE Components → KEY elements capture

2.3. Verification Methods Selection:
   - Content Hash Comparison: For detecting any modifications
   - Interface Signature Analysis: For verifying interface compatibility
   - Functional Equivalence Testing: For verifying behavior preservation
   - Performance Benchmarking: For verifying performance characteristics
   - Code Quality Analysis: For verifying code quality maintenance
   - Dependency Verification: For verifying dependency consistency

2.4. Change Classification:
   - Interface Changes: Modifications to public APIs or exported interfaces
   - Behavior Changes: Modifications that affect functionality or outputs
   - Implementation Changes: Internal modifications that maintain interface and behavior
   - Dependency Changes: Modifications to component dependencies

### Refactoring Verification Decision Process

```
DECISION [D-REFVER-1]: What refactoring verification is required?

FACTORS:
- Component Protection Level: [@LOCKED/@INTERFACE/@BEHAVIOR/@FLEXIBLE]
- Refactoring Type: [Structural/Interface/Performance/Local/Format]
- Change Classification: [Interface/Behavior/Implementation/Dependency]
- Implementation Mode: [Current @mode]
- Risk Level: [Evaluate based on decision-tree-standard-factors.md#3]

PROCESS:
1. Determine Refactoring Verification Need (2.1)
2. Identify Component Snapshot Requirements (2.2)
3. Select Appropriate Verification Methods (2.3)
4. Classify and Analyze Changes (2.4)

OUTCOMES:
- COMPREHENSIVE VERIFICATION: Complete verification with all methods
- INTERFACE-SPECIFIC VERIFICATION: Focused on interface compatibility
- BEHAVIOR-SPECIFIC VERIFICATION: Focused on behavior preservation
- PERFORMANCE-SPECIFIC VERIFICATION: Focused on performance characteristics
- STANDARD VERIFICATION: Normal verification approach
- BASIC VERIFICATION: Minimal verification for simple changes
```

## 3. Pre-Flight Check Decisions

3.1. Pre-Flight Check Requirements:
   - File Creation/Modification:
     - In production environment → COMPREHENSIVE PRE-FLIGHT CHECKS
     - In critical system → COMPREHENSIVE PRE-FLIGHT CHECKS
     - Modifying core components → STANDARD PRE-FLIGHT CHECKS
     - Creating new directory structure → PATH VERIFICATION
     - Simple file modification → BASIC PRE-FLIGHT CHECKS
   - Phase Transition:
     - To implementation phase → IMPLEMENTATION READINESS CHECKS
     - To verification phase → VERIFICATION READINESS CHECKS
     - To documentation phase → DOCUMENTATION READINESS CHECKS
     - To handover phase → HANDOVER READINESS CHECKS
   - Mode Transition:
     - To @mode:manual → MANUAL MODE READINESS CHECKS
     - To @mode:semi → SEMI MODE READINESS CHECKS
     - To @mode:auto → AUTO MODE READINESS CHECKS
   - Critical Decision:
     - Irreversible action → COMPREHENSIVE PRE-FLIGHT CHECKS
     - High-risk action → COMPREHENSIVE PRE-FLIGHT CHECKS
     - Moderate-risk action → STANDARD PRE-FLIGHT CHECKS

3.2. Pre-Flight Check Types:
   - Comprehensive Pre-Flight Checks:
     - Full path verification
     - Complete rule application verification
     - Context integrity verification
     - Implementation readiness verification
     - Conflict detection
     - User approval confirmation
   - Standard Pre-Flight Checks:
     - Path verification
     - Core rule application verification
     - Implementation readiness verification
     - User approval confirmation
   - Basic Pre-Flight Checks:
     - Path verification
     - Critical rule application verification
     - User approval confirmation

3.3. Mode-Specific Pre-Flight Requirements:
   - Manual Mode (@mode:manual):
     - Perform comprehensive pre-flight checks for all significant actions
     - Document detailed verification results
     - Require explicit approval before proceeding
     - Include confidence ratings for verification results
   - Semi-Automatic Mode (@mode:semi):
     - Perform standard pre-flight checks for significant actions
     - Document standard verification results
     - Require approval for critical actions
     - Include basic confidence ratings
   - Automatic Mode (@mode:auto):
     - Perform basic pre-flight checks for critical actions only
     - Document critical verification results
     - Require approval for high-risk actions
     - Focus on essential verification points

3.4. Pre-Flight Verification Statement Format:
   ```
   PRE-FLIGHT VERIFICATION:
   - Check type: [Comprehensive | Standard | Basic]
   - Verification items: [List of verified items]
   - Status: All checks passed ✅ | Some checks failed ⚠️
   - Critical items: All verified ✅ | Some failed ⚠️
   - Recommendation: [Proceed | Address issues before proceeding]
   ```

### Pre-Flight Check Decision Process

```
DECISION [D-PREFL-1]: Are pre-flight checks required?

FACTORS:
- Action Type: [File modification/Phase transition/Mode transition/Critical decision]
- Environment Type: [Evaluate based on decision-tree-standard-factors.md#1]
- Implementation Mode: [Current @mode]
- Risk Level: [Evaluate based on decision-tree-standard-factors.md#3]
- Context Factors: [Previous errors/Complexity/User requests]

PROCESS:
1. Identify Pre-Flight Check Requirements (3.1)
2. Determine Appropriate Pre-Flight Check Types (3.2)
3. Apply Mode-Specific Pre-Flight Requirements (3.3)
4. Document using Pre-Flight Verification Statement Format (3.4)

OUTCOMES:
- COMPREHENSIVE PRE-FLIGHT CHECKS REQUIRED: Maximum verification
- STANDARD PRE-FLIGHT CHECKS REQUIRED: Normal verification
- BASIC PRE-FLIGHT CHECKS REQUIRED: Minimal verification
- SPECIALIZED PRE-FLIGHT CHECKS REQUIRED: Context-specific verification
```

## 4. Path Correctness Decisions

4.1. Path Verification Requirements:
   - Creating new files or directories → COMPLETE PATH VERIFICATION
   - Modifying existing files → BASIC PATH VERIFICATION
   - File operations in production environment → COMPREHENSIVE PATH VERIFICATION
   - Path manipulation operations → COMPLETE PATH VERIFICATION
   - Directory structure changes → STRUCTURAL PATH VERIFICATION

4.2. Path Verification Elements:
   - Existence Verification: Does path exist or will it be created correctly?
   - Structure Verification: Does path follow expected structure?
   - Permission Verification: Are permissions appropriate?
   - Naming Convention Verification: Does name follow conventions?
   - Conflict Detection: Are there potential conflicts?
   - Reserved Path Verification: Is path in a reserved location?

4.3. Path Issue Resolution:
   - Missing directories → CREATE required directories
   - Wrong location → CORRECT path before proceeding
   - Permission issues → RESOLVE permissions or CHOOSE alternative location
   - Naming issues → ADJUST to follow conventions
   - Conflicts → RESOLVE conflicts before proceeding
   - Reserved location → SEEK approval or CHOOSE alternative location

4.4. Path Documentation Requirements:
   - Document path verification process
   - Record all issues found and resolutions
   - Document created directory structures
   - Document permission settings
   - Record any special path considerations

### Path Correctness Decision Process

```
DECISION [D-PATH-1]: Is path verification required?

FACTORS:
- Operation Type: [Create/Modify/Delete/Structure change]
- Environment Type: [Evaluate based on decision-tree-standard-factors.md#1]
- Path Complexity: [Simple/Nested/Complex]
- Implementation Mode: [Current @mode]
- Path Location: [Standard/System/Reserved]

PROCESS:
1. Determine Path Verification Requirements (4.1)
2. Identify Necessary Path Verification Elements (4.2)
3. Prepare for Path Issue Resolution (4.3)
4. Plan Path Documentation (4.4)

OUTCOMES:
- COMPREHENSIVE PATH VERIFICATION: Complete verification of all elements
- COMPLETE PATH VERIFICATION: Verification of all critical elements
- STRUCTURAL PATH VERIFICATION: Focus on structure and relationships
- BASIC PATH VERIFICATION: Essential verification only
```

## Mode-Specific Verification Requirements

### Manual Mode (@mode:manual)
- Apply COMPREHENSIVE verification for ALL operations
- Perform COMPLETE pre-flight checks for ALL significant actions
- Verify ALL paths thoroughly
- Document ALL verification steps and results
- Require EXPLICIT approval at verification points
- Implement ALL protection verification methods

### Semi-Automatic Mode (@mode:semi)
- Apply STANDARD verification for SIGNIFICANT operations
- Perform STANDARD pre-flight checks for IMPORTANT actions
- Verify IMPORTANT paths thoroughly
- Document KEY verification steps and results
- Require approval at MAJOR verification points
- Implement STANDARD protection verification methods

### Automatic Mode (@mode:auto)
- Apply BASIC verification for CRITICAL operations
- Perform BASIC pre-flight checks for ESSENTIAL actions
- Verify CRITICAL paths
- Document ESSENTIAL verification steps and results
- Require approval at CRITICAL verification points
- Implement BASIC protection verification methods

## Verification Domain Integration Points

- Links to [Protection Domain](decision-tree-protection-domain.md) for protection requirements
- Links to [Context Management Domain](decision-tree-context-management-domain.md) for context tracking
- Links to [Planning Domain](decision-tree-planning-domain.md) for checklist integration

## Verification Decision Documentation Standard

Use the standard decision documentation format with these verification-specific elements:

```
DECISION [D-ID]: [Verification decision question]

CONTEXT: [Current implementation context]

VERIFICATION FACTORS:
- Environment: [Evaluation] [ref: decision-tree-standard-factors.md#1]
- Risk Level: [Evaluation] [ref: decision-tree-standard-factors.md#3]
- Component Type: [Evaluation] [ref: decision-tree-standard-factors.md#4]
- Implementation Mode: [Current @mode]

VERIFICATION OUTCOME: [Verification decision outcome]

CONFIDENCE: [■■■■□ 4/5]

VERIFICATION REQUIREMENTS:
1. [Requirement 1 based on decision]
2. [Requirement 2 based on decision]

VERIFICATION METHODS:
- [Method 1 to apply]
- [Method 2 to apply]
``` 