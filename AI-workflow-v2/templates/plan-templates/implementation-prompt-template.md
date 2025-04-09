---
type: "template"
purpose: "implementation-prompt"
version: "1.0"
status: "Active"
description: "Implementation prompt template to initiate the implementation of a planned feature, pre-configured with specific scope and rule requirements"
ai_instructions: "Use this template as part of the planning phase deliverables to create a customized implementation prompt for the specific plan"
ai_usage_context: "Generate this during planning phase as a deliverable to ensure accurate implementation context transfer"
related_files: [
  "../README.md",
  "../prompt-templates/implementation-request-template.md",
  "plan-template-manual.md",
  "plan-template-semi.md",
  "plan-template-auto.md"
]
required_sections: [
  "Plan Identification",
  "Scope Definition",
  "Implementation Mode",
  "Framework Rules",
  "Protected Components",
  "Human Checkpoint Schedule",
  "Verification Requirements"
]
optional_sections: [
  "Special Instructions",
  "Custom Configuration",
  "References & Documentation"
]
tags: ["template", "implementation-prompt", "framework", "context-management"]
priority: "high"
audience: {
  "primary": "human user",
  "technical_level": "all levels"
}
dateCreated: "2025-05-15"
lastUpdated: "2025-05-15"
---

# Implementation Prompt: {{planName}}

*This prompt is auto-generated as part of the planning phase. Use it to start the implementation of your planned feature with the correct scope and rule configuration. Simply copy this entire prompt and provide it to the AI to begin implementation.*

## Plan Identification

- **Plan Name**: {{planName}}
- **Plan ID**: {{planId}}
- **Implementation Date**: [ENTER CURRENT DATE]
- **Plan Version**: {{planVersion}}
- **Plan Location**: {{planLocation}}

## Scope Definition

### In-Scope Components
{{#each inScopeComponents}}
- **{{name}}** - {{authorizationLevel}} - {{permittedModifications}}
{{/each}}

### Out-of-Scope Components
{{#each outOfScopeComponents}}
- **{{name}}** - {{accessLevel}} - {{rationale}}
{{/each}}

### Modification Restrictions
{{#each modificationRestrictions}}
- **{{name}}** - {{details}} - {{rationale}}
{{/each}}

## Implementation Mode

**Selected Mode**: @mode:{{implementationMode}}

**Justification**: {{modeJustification}}

**Mode-Specific Requirements**:
{{#each modeRequirements}}
- {{this}}
{{/each}}

## Framework Rules

The following framework rules MUST be applied for this implementation:

{{#each applicableRules}}
- **{{ruleNumber}}-{{ruleName}}**: {{ruleDescription}}
{{/each}}

## Protected Components

{{#if hasProtectedComponents}}
The following components have protection requirements:

{{#each protectedComponents}}
- **{{name}}** - @{{protectionLevel}} - {{justification}}
{{/each}}

**Component Protection Strategy**: {{componentProtectionStrategy}}
{{else}}
No components require protection for this implementation.
{{/if}}

## Human Checkpoint Schedule

Human approval is REQUIRED at these points:

{{#each humanCheckpoints}}
- **{{name}}**: {{description}} - {{timing}}
{{/each}}

## Verification Requirements

The following verification is required:

{{#each verificationRequirements}}
- **{{name}}**: {{description}} - {{criteria}}
{{/each}}

## Special Instructions

{{#if specialInstructions}}
{{specialInstructions}}
{{else}}
No special instructions for this implementation.
{{/if}}

## Custom Configuration

```
FRAMEWORK CONFIGURATION:
TESTING_REQUIRED: {{testingRequired}}
DOCUMENTATION_LEVEL: {{documentationLevel}}
VERIFICATION_DEPTH: {{verificationDepth}}
```

## References & Documentation

{{#each references}}
- [{{name}}]({{url}})
{{/each}}

---

## Implementation Instructions

To begin implementation:

1. Copy this entire prompt
2. Start a new conversation with the AI assistant
3. Paste the prompt as your first message
4. The AI will begin implementation following the defined scope and rules
5. Provide approvals at the scheduled human checkpoints

## Continuation Instructions

If you need to continue implementation in a new session:

1. Locate the `continuation-request-{{planId}}.md` file
2. Copy the content of that file
3. Start a new conversation with the AI assistant
4. Paste the content as your first message
5. Include the last Implementation Handover Document

## Handover Instructions

If you need to request a handover document:

1. Locate the `handover-request-{{planId}}.md` file
2. Copy the content of that file
3. Paste it in the current conversation
4. The AI will generate a comprehensive Implementation Handover Document

---

# Implementation Request: [Project Name]

## Context
[Provide context about the project, its purpose, and what needs to be implemented]

## Implementation Details
[Describe what specifically needs to be implemented, including:
- Key features and functionality
- Any specific requirements or constraints
- Any design guidelines or patterns to follow]

## Resources
- [Link to relevant documentation, designs, or existing code]
- [Link to relevant API documentation]
- [Planning Process Reference](../../../references/by-phase/planning/planning-process.md)
- [Scope Definition Reference](../../../references/by-phase/planning/scope-definition.md)

## Implementation Mode
[Specify the implementation mode: @mode:auto, @mode:semi, or @mode:manual]

## Deliverables
[List the expected deliverables, such as:
- Code files
- Documentation
- Tests
- Any other artifacts]

## Timeline
[Provide information about the timeline, such as:
- Deadline
- Milestones
- Any other time-related constraints]

## Contact
[Provide contact information for the project lead or other stakeholders]

---

*This is an implementation request template. Please customize it to fit your specific project needs.*

