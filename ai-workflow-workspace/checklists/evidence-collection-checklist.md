---
type: checklist
description: "Evidence collection checklist for test execution traceability"
lastUpdated: "2023-10-31"
status: "Active"
---

# Evidence Collection Checklist

## Purpose

This checklist ensures that all necessary evidence is collected during test execution to provide traceability, verification, and auditability of test results against live infrastructure.

## Application Requirements

- **When to use**: During and after test execution against live infrastructure
- **Applicable Modes**: @mode:manual, @mode:semi
- **Verification Requirement**: Human review required for @mode:manual

## Checklist Items

### Pre-Execution Evidence

- [ ] **PRE.1. Test Environment Documentation** [MANDATORY]
  - PRE.1.1. Environment variables documented with values (sanitized as needed)
  - PRE.1.2. Test script version/hash documented
  - PRE.1.3. Execution context (timestamp, executor, etc.) documented

- [ ] **PRE.2. Test Expectations Documentation** [MANDATORY]
  - PRE.2.1. Expected outcomes documented
  - PRE.2.2. Success criteria explicitly defined
  - PRE.2.3. Verification approach documented

### Execution Evidence

- [ ] **EXE.1. Request Capture** [MANDATORY]
  - EXE.1.1. HTTP requests logged with headers
  - EXE.1.2. Request payloads captured (sanitized as needed)
  - EXE.1.3. Request timestamps recorded

- [ ] **EXE.2. Response Capture** [MANDATORY]
  - EXE.2.1. HTTP response status codes logged
  - EXE.2.2. Response headers captured
  - EXE.2.3. Response bodies captured
  - EXE.2.4. Response timestamps recorded

- [ ] **EXE.3. Execution Flow Evidence** [MANDATORY]
  - EXE.3.1. Execution steps logged in sequence
  - EXE.3.2. Decision points and branches documented
  - EXE.3.3. Error/exception handling events recorded

### Verification Evidence

- [ ] **VER.1. Test Assertion Evidence** [MANDATORY]
  - VER.1.1. All assertions recorded with expected vs. actual values
  - VER.1.2. Assertion outcomes (pass/fail) explicitly recorded
  - VER.1.3. Assertion context (test step, data values) documented

- [ ] **VER.2. Test Status Evidence** [MANDATORY]
  - VER.2.1. Overall test status (pass/fail/partial) recorded
  - VER.2.2. Individual test case results documented
  - VER.2.3. Test completion state verified

### Post-Execution Evidence

- [ ] **POST.1. Evidence Preservation** [MANDATORY]
  - POST.1.1. All evidence artifacts stored with appropriate naming
  - POST.1.2. Evidence hash/checksum generated for integrity
  - POST.1.3. Evidence indexed for traceability

- [ ] **POST.2. Evidence Accessibility** [MANDATORY]
  - POST.2.1. Evidence accessible via defined paths/references
  - POST.2.2. Evidence format suitable for review/audit
  - POST.2.3. Evidence cross-referenced with test results

## Mode-Specific Guidance

Refer to **Rule 125** for mode-specific requirements on detail, verification depth, and documentation for completing this checklist.

## Integration

Typically applied during Rule/Phase: Rule 300 / Phase 4 (Implementation) and Phase 5 (Verification) 