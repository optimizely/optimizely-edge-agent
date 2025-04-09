# Guide: Requesting a Correction from the AI Assistant

If you detect that the AI assistant has violated a framework rule or made an error, use the following structure to request a correction. Providing clear, specific feedback helps the AI understand the issue and revise its approach.

```markdown
## ⚠️ Rule Compliance Correction Required

**Previous Action:** [Briefly describe the AI's last action, e.g., "Edited file X to add function Y"]

**Detected Violation:** [State the specific violation, e.g., "Modification occurred outside defined scope", "Mandatory checklist item Z was not addressed", "Operation performed on a @LOCKED component"]

**Violated Rule:** [Reference the specific rule ID and name, e.g., "Rule 200-scope-control.md - Scope Boundaries"]

**Relevant Section/Item:** [Point to the specific part of the rule, if applicable, e.g., "Section 3 - Scope Boundary Decision Tree", "Checklist item..." ]

**Current Context (Optional but helpful):**
*   **Plan ID:** [Current Plan ID]
*   **Phase:** [Current Phase from state]
*   **Step:** [Current Step Ref from state]
*   **Mode:** [@mode:current]

**Correction Request:**
[Clearly explain what needs to be corrected or revised. E.g., "Please undo the change to file Z as it was out of scope." or "Please address checklist item X before proceeding."]
```

**Instructions for AI:**

When you receive a correction request structured like this, please:

1.  Acknowledge the reported violation.
2.  Review the specific rule and section mentioned.
3.  Propose a revised action or plan that complies with the rule.
4.  Alternatively, if you believe the action *was* compliant, provide specific justification based on the rules.
5.  Ask for clarification if the violation or rule is unclear.

**Do not proceed with the violating action. Wait for confirmation or clarification on the corrected approach.** 