---
type: "documentation"
purpose: "directory-overview"
version: "2.0"
status: "Active"
description: "Overview of example implementation plans using different implementation modes in the AI Workflow Framework"
ai_instructions: "Reference this document when explaining example implementation plans or when helping users understand the differences between implementation modes"
ai_usage_context: "Use when a user is looking for examples of implementation plans or needs guidance on which implementation mode to choose"
related_files: [
  "AI-workflow-v2/templates/plan-templates/implementation-plan-template.md",
  "AI-workflow-v2/framework-rules/core/mode-selection.md",
  "AI-workflow-v2/plans/README.md"
]
directory_purpose: "This directory contains example implementation plans that demonstrate the three implementation modes in the AI Workflow Framework."
tags: ["examples", "implementation", "plans", "modes", "documentation"]
priority: "medium"
audience: {
  "primary": "both AI assistants and developers",
  "technical_level": "all levels"
}
dateCreated: "2025-03-19"
lastUpdated: "2025-03-19"
---

# Example Implementation Plans

This directory contains example implementation plans that demonstrate the three implementation modes of the AI Workflow Framework. These examples serve as references for creating your own implementation plans and help illustrate the differences between the implementation modes.

## Directory Structure

```
example-plans/
├── README.md - This overview document
├── manual-example-2025-03-15/ - Example plan using manual mode
│   ├── README.md - Overview of this example
│   └── plan.md - The implementation plan
├── semi-auto-example-2025-03-16/ - Example plan using semi-automatic mode
│   ├── README.md - Overview of this example
│   └── plan.md - The implementation plan
└── auto-example-2025-03-17/ - Example plan using automatic mode
    ├── README.md - Overview of this example
    └── plan.md - The implementation plan
```

## Example Plans Overview

### Manual Mode Example: User Authentication System

The [manual-example-2025-03-15](manual-example-2025-03-15) directory contains an example implementation plan using manual mode (@mode:manual), demonstrating:

- Detailed step-by-step verification
- Comprehensive documentation requirements
- Explicit approval points
- Complete implementation logs
- Thorough security review process

This example shows how to implement a user authentication system with login, registration, password reset, and profile management features.

### Semi-Automatic Mode Example: API Integration

The [semi-auto-example-2025-03-16](semi-auto-example-2025-03-16) directory contains an example implementation plan using semi-automatic mode (@mode:semi), demonstrating:

- Component-level verification
- Balanced implementation guidance
- Approval at key decision points
- Focused documentation
- Efficient progress tracking

This example shows how to implement a third-party API integration for weather data, including API client, data models, and display components.

### Automatic Mode Example: Pagination Component

The [auto-example-2025-03-17](auto-example-2025-03-17) directory contains an example implementation plan using automatic mode (@mode:auto), demonstrating:

- High-level verification
- Outcome-focused guidance
- Minimal approval requirements
- Streamlined documentation
- Rapid implementation approach

This example shows how to implement a pagination component including the component itself, styles, and tests.

## When to Use Each Mode

### Manual Mode

Consider using manual mode when:
- Working on critical system components
- Implementing security-related features
- Working on production environments
- Implementing complex integrations
- Regulatory compliance is required

### Semi-Automatic Mode

Consider using semi-automatic mode when:
- Working on important but non-critical components
- Balancing speed and oversight
- Implementing moderate complexity features
- Working on staging environments
- Some verification is required but full oversight is unnecessary

### Automatic Mode

Consider using automatic mode when:
- Working on non-critical components
- Implementing simple or well-understood features
- Working on development environments
- Speed is a priority
- The implementation follows established patterns

## Using These Examples

These examples can be used in several ways:

1. **As References**: Study these examples to understand the different implementation modes
2. **As Templates**: Use these examples as starting points for your own implementation plans
3. **For Comparison**: Compare the different approaches to decide which mode suits your needs
4. **For Learning**: Learn best practices for creating implementation plans

