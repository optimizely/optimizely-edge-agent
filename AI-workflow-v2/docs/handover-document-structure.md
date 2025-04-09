# Handover Document Structure Reference

This document outlines the standard structure and required sections for an Implementation Handover Document, as specified in Rule 150 (Implementation State Management), Section 7.2.

**User Trigger:** The AI assistant generates this document when requested by a user prompt, typically: 
> "Please generate the implementation handover document for plan [plan-id]."

When an AI assistant generates a handover document, it should include the following sections, populated with information from the plan-specific `_handover-template.md` (if available) and the latest `status.md` log:

## 1. Implementation Identification
*   **Plan Name**: Official name of the plan.
*   **Plan ID**: Unique identifier.
*   **Handover Date**: Current date/time.
*   **Implementation Mode**: Current `@mode`. 

## 2. Current Implementation State
*   **Current Phase**: Active phase (e.g., IMPLEMENTATION).
*   **Current Step**: Exact step reference ID.
*   **Current Progress**: Visual progress bar and percentage.
*   **Last Completed Step**: Description.
*   **Next Pending Step**: Description.

## 3. Scope Summary
*   **In Scope**: List of components/areas.
*   **Out of Scope**: List of excluded components/areas.

## 4. Framework Rules
*   **Active Rules**: List applicable rules being followed.

## 5. Component Protection Status (if applicable)
*   **Protected Components**: List with levels (@LOCKED, @INTERFACE, etc.).
*   **Snapshot Status**: Current status.
*   **Verification Status**: Current status.

## 6. Completed Components/Tasks
*   Summary of major completed tasks or components.

## 7. Pending Components/Tasks
*   List of remaining tasks or components.
*   Current status and blockers.

## 8. Decision History
*   Summary of key decisions made (from `status.md`).

## 9. Known Issues
*   Summary of unresolved issues or blockers (from `status.md`).

## 10. Checklist Status
*   Summary of required checklist completion status.

## 11. Critical Context Elements
*   Any other vital context for the next agent.

## 12. Resumption Instructions
*   Guidance for the next agent on how to resume.

---

*This structure ensures the receiving agent has the necessary information to continue the implementation seamlessly.* 