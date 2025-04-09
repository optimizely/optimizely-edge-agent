---
description: "CRITICAL SAFEGUARDS for PRODUCTION environments. Apply when operating in, modifying, or deploying to production. Mandates @mode:manual, explicit verification/authorization, command safety, checklists, and rollback plans."
alwaysApply: false
ai_instructions: "Apply these safeguards when working in or deploying to PRODUCTION. Always use @mode:manual, verify environment explicitly, require approval for all changes, validate thoroughly, and maintain rollback plans. These are maximum protection requirements with no exceptions permitted."
---

# PRODUCTION ENVIRONMENT SAFEGUARDS

All work in production environments must follow these safeguards without exception. Production environment safety is the highest priority.

## 1. Core Protection Principles

1.  VERIFICATION BEFORE ACTION
2.  EXPLICIT HUMAN CONFIRMATION
3.  MINIMAL NECESSARY CHANGES
4.  DOCUMENTED ROLLBACK PLAN
5.  INCREMENTAL IMPLEMENTATION
6.  CONTINUOUS VALIDATION

## 2. Mandatory Safeguards

### 2.1 Manual Mode Requirement

*   ALL production modifications MUST use `@mode:manual`.
*   NO EXCEPTIONS.
*   VERIFICATION: Confirm mode in context header.

### 2.2 Explicit Environment Verification

Before ANY production action, confirm:
*   [✓] Explicitly identified target is PRODUCTION.
*   [✓] Read-only mode used until verification complete.
*   [✓] Verified environment indicators (hostname, prompts, etc.).
*   [✓] HUMAN explicitly confirmed production status.
*   [✓] ALL safeguards (this rule) confirmed active.

### 2.3 Production Change Authorization

NEVER proceed without:
*   EXPLICIT human authorization for the SPECIFIC change.
*   DETAILED confirmation of change plan.
*   EXPLICIT approval for each significant step.
*   DOCUMENTED rollback procedures available.

### 2.4 Command Safety Protocols

For ALL commands in production:
*   Use read-only/dry-run mode FIRST.
*   VERIFY syntax and parameters MULTIPLE times.
*   CONFIRM expected outcome BEFORE execution.
*   VALIDATE results AFTER execution.
*   NEVER use force flags without explicit approval.
*   Use least-privilege execution.

### 2.5 Modification Constraints

Production changes MUST:
*   Be MINIMAL necessary.
*   Follow PREVIOUSLY TESTED plan.
*   Have EXPLICIT approval per component.
*   Include CONTINUOUS validation.
*   Have DOCUMENTED rollback procedures.
*   Be INCREMENTAL where possible.

### 2.6 Critical Protection Boundaries (NEVER DO)

*   Direct DB schema changes without safeguards.
*   Modify security controls without triple verification.
*   Change auth systems without explicit process.
*   Modify data integrity components without validation.
*   Alter global configurations without approval.
*   Execute destructive commands without protection.
*   Skip verification steps.

### 2.7 Mandatory Pre-Execution Checklist

Confirm before EVERY production change:
*   [ ] Verified PRODUCTION environment status.
*   [ ] Obtained EXPLICIT human approval.
*   [ ] Confirmed SPECIFIC change authorization.
*   [ ] Performed DRY RUN (if applicable).
*   [ ] Verified command/change syntax MULTIPLE times.
*   [ ] Confirmed scope is MINIMAL necessary.
*   [ ] Documented ROLLBACK procedure is available.
*   [ ] Established VALIDATION method.
*   [ ] Using `@mode:manual` with ALL safeguards.
*   [ ] HUMAN CHECKPOINT: Explicit final approval received.

### 2.8 Post-Change Validation Checklist

Confirm after EVERY production change:
*   [ ] Verified change applied correctly.
*   [ ] Validated system functionality.
*   [ ] Confirmed no unintended side effects.
*   [ ] Documented actual changes made.
*   [ ] Updated rollback procedure if needed.
*   [ ] Obtained human verification of results.
*   [ ] Confirmed next steps or completion.

## 3. Emergency Rollback Procedure

If ANY issues detected:
1.  IMMEDIATELY stop changes.
2.  NOTIFY human operator.
3.  PRESENT documented rollback plan.
4.  WAIT for explicit human approval.
5.  EXECUTE approved rollback steps.
6.  VALIDATE system state after rollback.
7.  DOCUMENT incident fully.

## 4. Production Work Statement

When working in production, I MUST include this statement:

```
I acknowledge this is a PRODUCTION environment requiring maximum protection (Rule 225). I am following @mode:manual with ALL production safeguards active. Every action requires explicit human approval. Rollback plan is documented.
```

## 5. Implementation Requirements Summary

*   Verification: COMPREHENSIVE
*   Human checkpoints: MAXIMUM frequency
*   Documentation: DETAILED pre/post state
*   Testing: EXTENSIVE pre-implementation
*   Approval: EXPLICIT per step
*   Mode: ALWAYS `@mode:manual`

## 6. Application Verification Statement

Use the standard verification statement format from Rule 100, with:

```
I have applied the Production Safeguards (225) requirements following the @mode:manual standards, verified all necessary elements, and ensured compliance with the framework.
```