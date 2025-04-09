---
type: "template"
purpose: "implementation-guidance"
version: "1.0"
status: "Active"
description: "Implementation guidance for using the plan-specific templates"
ai_instructions: "Generate this template as part of any plan's README.md file to provide guidance on using the associated templates"
ai_usage_context: "Include this in plan README.md files to provide clear instructions on implementation workflow"
related_files: [
  "implementation-prompt-template.md",
  "continuation-request-template.md",
  "handover-request-template.md"
]
required_sections: [
  "Implementation Workflow",
  "Using the Templates",
  "Troubleshooting"
]
tags: ["guidance", "workflow", "implementation", "templates"]
priority: "high"
audience: {
  "primary": "human user",
  "technical_level": "all levels"
}
dateCreated: "2025-05-15"
lastUpdated: "2025-05-15"
---

# Implementation Guidance

This section provides guidance on how to use the templates generated as part of this implementation plan.

## Implementation Workflow

The implementation workflow consists of the following steps:

1. **Start Implementation**: Use the `implementation-prompt-{{planId}}.md` file
2. **Continue Implementation**: Use the `continuation-request-{{planId}}.md` file if you need to continue in a new session
3. **Generate a Handover Document**: Use the `handover-request-{{planId}}.md` file if you need to generate a handover document

## Using the Templates

### Starting Implementation

To start implementing this plan:

1. Open the `implementation-prompt-{{planId}}.md` file
2. Copy the entire contents of the file
3. Start a new conversation with the AI assistant
4. Paste the contents as your first message
5. The AI will begin implementation following the plan

This implementation prompt has been specifically generated for this plan and includes:
- The precise scope boundaries
- The appropriate implementation mode
- The specific framework rules to follow
- Any protected components and their protection levels
- The human checkpoint schedule
- Verification requirements

### Continuing Implementation

If you need to continue the implementation in a new session:

1. Open the `continuation-request-{{planId}}.md` file
2. Copy the entire contents of the file
3. Start a new conversation with the AI assistant
4. Paste the contents as your first message
5. Immediately after, paste the most recent Implementation Handover Document
6. The AI will reconstruct the implementation state and continue

### Generating a Handover Document

If you need to generate a handover document to preserve implementation state:

1. Open the `handover-request-{{planId}}.md` file
2. Copy the entire contents of the file
3. Paste the contents in your current conversation with the AI
4. The AI will generate a comprehensive Implementation Handover Document
5. Save this document for future continuation

## Troubleshooting

### Common Issues

- **AI doesn't follow the plan**: Ensure you're using the exact implementation prompt provided
- **Context loss during implementation**: Use the continuation request with the most recent handover document
- **Implementation goes out of scope**: Remind the AI of the scope boundaries defined in the plan

### Getting Help

If you encounter issues with the implementation:

1. Generate a handover document to preserve the current state
2. Start a new conversation focusing specifically on the issue
3. Reference the specific templates and steps that are causing problems

---

These templates were auto-generated as part of the planning phase and are customized specifically for this implementation plan. They ensure that all AI assistants working on this implementation follow the same framework rules, maintain the same scope boundaries, and provide consistent outputs. 