---
description: Defines the Quality Assurance Protocol, including quality dimensions, verification matrix, rating system, workflow, checklists, and mode-specific standards. Apply during Implementation and Verification phases.
alwaysApply: true
ai_instructions: "Apply this quality assurance protocol during implementation and verification. Assess quality across dimensions (readability, maintainability, performance, security, testability), use the verification matrix to track progress, document evidence, assign quality ratings, and follow the verification workflow. Mode-specific requirements determine verification depth."
---

# QUALITY ASSURANCE PROTOCOL

Implementation quality should be systematically verified using this structured approach. Quality assurance is important for all implementations.

## Core Verification Principles

┌────────────────────────────────────────────────────┐
│ QUALITY ASSURANCE PRINCIPLES                       │
├────────────────────────────────────────────────────┤
│ 1. VERIFICATION THROUGHOUT LIFECYCLE               │
│ 2. MULTI-DIMENSIONAL ASSESSMENT                    │
│ 3. EVIDENCE-BASED EVALUATION                       │
│ 4. REGRESSION PREVENTION                           │
│ 5. CONTINUOUS IMPROVEMENT                          │
│ 6. TRACEABLE VERIFICATION                          │
└────────────────────────────────────────────────────┘

## Quality Dimensions

*   **Readability:**
    *   Clear, descriptive naming conventions
    *   Consistent formatting
    *   Appropriate comments
    *   Logical code organization
    *   Managed complexity
*   **Maintainability:**
    *   Modular, reusable components
    *   Minimized and managed dependencies
    *   Consistent patterns
    *   Appropriate documentation
    *   Designed for future refactoring
*   **Performance:**
    *   Optimized resource usage
    *   Efficient algorithms
    *   Optimized queries
    *   Designed for appropriate load
    *   Responsiveness
*   **Security:**
    *   Input validation
    *   Proper access controls
    *   Secure sensitive data
    *   Secure error handling
    *   Prevention of common vulnerabilities
*   **Testability:**
    *   Comprehensive test coverage
    *   Mockable dependencies
    *   State verification support
    *   Error condition testing support
    *   Performance measurement support

## Verification Dimensions

1.  **Functional Correctness:** Meets specified requirements.
2.  **Code Quality:** Follows best practices and standards.
3.  **Performance:** Meets efficiency requirements.
4.  **Security:** Free from known vulnerabilities.
5.  **Maintainability:** Can be understood and modified effectively.
6.  **Compatibility:** Works correctly with other system components.
7.  **Reliability:** Functions consistently and predictably under expected conditions.
8.  **Documentation:** Is complete, accurate, and meets standards.

## Verification Matrix

```
┌───────────────┬───────────┬───────────┬───────────┬───────────┐
│ Component     │ Verified? │ Evidence  │ Issues    │ Score     │
├───────────────┼───────────┼───────────┼───────────┼───────────┤
│ Component 1   │ [Y/N/P]   │ [Ref Link]│ [IDs/Desc]│ [1-5]     │
├───────────────┼───────────┼───────────┼───────────┼───────────┤
│ Component 2   │ [Y/N/P]   │ [Ref Link]│ [IDs/Desc]│ [1-5]     │
├───────────────┼───────────┼───────────┼───────────┼───────────┤
│ ...           │ ...       │ ...       │ ...       │ ...       │
└───────────────┴───────────┴───────────┴───────────┴───────────┘
```
*   **Y:** Yes, **N:** No, **P:** Partially
*   **Evidence:** Link to test results, review comments, etc.
*   **Issues:** Reference to logged defects or description.
*   **Score:** Quality Rating (1-5).

## Verification Approaches

*(Guidance on determining the appropriate verification depth and approach based on context can be found in the [Verification Depth Decision Tree](AI-workflow-v2/framework-rules/decision-trees/decision-tree-verification-domain.md#1).)*

*   **Automated Verification:**
    *   Unit tests
    *   Integration tests
    *   Static analysis (Linting, Security Scanning)
    *   Performance benchmarks
*   **Manual Verification:**
    *   Code reviews
    *   Functionality testing (including exploratory and edge cases)
    *   Documentation review
    *   User Experience (UX) evaluation (if applicable)
*   **Evidence Collection:**
    *   Test execution reports
    *   Code review summaries/approvals
    *   Static analysis reports
    *   Benchmark results
    *   Validation artifacts (e.g., screenshots, logs)

## Quality Rating System

```
┌────────────────────────────────────────────────────┐
│ QUALITY RATING SCALE                               │
├────────────────────────────────────────────────────┤
│ ⭐⭐⭐⭐⭐ (5/5) - EXCEPTIONAL                      │
│ - Exceeds all requirements, zero defects, exemplary│
│ - Complete docs, highly optimized.                 │
│                                                    │
│ ⭐⭐⭐⭐ (4/5) - STRONG                           │
│ - Meets all requirements, minor defects only.      │
│ - Well-implemented, good docs & optimization.      │
│                                                    │
│ ⭐⭐⭐ (3/5) - SATISFACTORY                      │
│ - Meets core requirements, few significant defects.│
│ - Standard implementation, adequate docs, basic opt│
│                                                    │
│ ⭐⭐ (2/5) - NEEDS IMPROVEMENT                   │
│ - Partially meets requirements, multiple defects.  │
│ - Substandard implementation, incomplete docs.     │
│                                                    │
│ ⭐ (1/5) - UNSATISFACTORY                        │
│ - Fails requirements, critical defects.            │
│ - Poor implementation, missing docs, unoptimized.  │
└────────────────────────────────────────────────────┘
```

## Verification Workflow

```
1. REQUIREMENTS VERIFICATION → Validate understanding pre-impl.
   |
   ↓
2. IMPLEMENTATION VERIFICATION → Verify continuously during impl.
   |
   ↓
3. COMPONENT VERIFICATION → Verify each unit/component post-impl.
   |
   ↓
4. INTEGRATION VERIFICATION → Verify component interactions.
   |
   ↓
5. SYSTEM VERIFICATION → Verify complete implementation end-to-end.
   |
   ↓
6. REGRESSION VERIFICATION → Verify changes didn't break existing functionality.
   |
   ↓
7. FINAL VERIFICATION → Consolidate results, final report & rating.
```

## Mode-Specific Quality Requirements

Refer to **Rule 125 (Mode Implementation Standards), Section 6 (Verification Standards)** for mode-specific requirements regarding verification depth, rigor, and documentation.

## Quality Verification Checklist

```
┌─────────────────────────────────────────────────────┐
│ QUALITY VERIFICATION CHECKLIST                      │
├─────────────────────────────────────────────────────┤
│ Readability:                                        │
│ □ Naming conventions follow standards?              │
│ □ Formatting consistent?                            │
│ □ Comments appropriate and helpful?                 │
│ □ Code organization logical?                        │
│ □ Complexity managed?                               │
│                                                     │
│ Maintainability:                                    │
│ □ Components modular and reusable?                  │
│ □ Dependencies minimized and managed?               │
│ □ Patterns consistent?                              │
│ □ Documentation appropriate?                        │
│ □ Designed for refactoring?                         │
│                                                     │
│ Performance:                                        │
│ □ Resource usage optimized?                         │
│ □ Algorithms efficient?                             │
│ □ Queries optimized?                                │
│ □ Load requirements met?                            │
│ □ Response times acceptable?                        │
│                                                     │
│ Security:                                           │
│ □ Inputs validated?                                 │
│ □ Access controls implemented?                      │
│ □ Sensitive data secured?                           │
│ □ Error handling secure?                            │
│ □ Common vulnerabilities prevented?                 │
│                                                     │
│ Testability:                                        │
│ □ Test coverage adequate?                           │
│ □ Dependencies mockable?                            │
│ □ State verifiable?                                 │
│ □ Error conditions testable?                        │
│ □ Performance measurable?                           │
└─────────────────────────────────────────────────────┘
```

## Mandatory Verification Checklist

```
┌────────────────────────────────────────────────────┐
│ IMPLEMENTATION VERIFICATION CHECKLIST (FINAL)      │
├────────────────────────────────────────────────────┤
│ □ All requirements verified?                       │
│ □ Code quality standards met?                      │
│ □ Tests implemented and passing?                   │
│ □ Performance requirements met?                    │
│ □ Security requirements met?                       │
│ □ Documentation complete and accurate?             │
│ □ Integration verification completed?              │
│ □ Regression testing performed?                    │
│ □ Quality ratings assigned (via Matrix)?           │
│ □ Verification evidence collected and linked?      │
│ □ Human verification completed?                    │
│ □ Verification matrix completed?                   │
└────────────────────────────────────────────────────┘
```

## Implementation Quality Standards

Minimum acceptable overall quality rating:
*   **@mode:manual:** 4/5
*   **@mode:semi:** 3/5
*   **@mode:auto:** 3/5

Implementations below these standards require remediation before completion.

## Reference Materials

*   [Code Quality Reference Card](AI-workflow-v2/templates/reference-cards/quality-standards.md)
*   Language-Specific Standards (e.g., `javascript-standards.md`, `python-standards.md`)
*   Project-Specific Quality Guidelines (if applicable)
*   `ai-workflow-workspace/plans/[unique-plan-id]/verification-report.md` (for detailed results)

## Quality Assurance Verification

Use the standard verification statement format from Rule 100, with:

```
I have applied the Quality Assurance (300) requirements following the @mode:[mode] standards, verified all necessary elements, and ensured compliance with the framework.
```

