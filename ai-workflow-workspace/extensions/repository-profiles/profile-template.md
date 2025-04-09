---
type: "repository-profile"
repository_name: "[REPOSITORY NAME]"
repository_url: "[REPOSITORY URL]"
description: "[Brief description of the repository and its purpose]"
version: "1.0"
status: "Active"
framework_configuration: {
  "default_implementation_mode": "semi",
  "verification_protocols": "standard",
  "tracking_requirements": "standard"
}
custom_rules: [
  "[list of custom rules included in this profile]"
]
custom_templates: [
  "[list of custom templates included in this profile]"
]
custom_instructions: [
  "[list of custom instructions included in this profile]"
]
tags: ["repository-profile", "[repository-specific tags]"]
priority: "high"
dateCreated: "[YYYY-MM-DD]"
lastUpdated: "[YYYY-MM-DD]"
---

# [REPOSITORY NAME] Profile

This profile customizes the AI Workflow Framework for the [REPOSITORY NAME] repository, ensuring that implementations follow repository-specific conventions and patterns.

## Repository Overview

[Provide a brief description of the repository, its purpose, architecture, and key components. Include information about the tech stack, frameworks, and libraries used in the repository.]

## Framework Configuration

### Implementation Mode

The default implementation mode for this repository is `@mode:semi` (Semi-Automatic Mode), which provides a balanced approach between oversight and automation. This mode is appropriate for this repository because [explain why this mode is appropriate].

[Adjust this section as needed if a different default mode is more appropriate for your repository.]

### Verification Protocols

This repository requires [standard/enhanced/custom] verification protocols:

- **Scope Verification**: Required for [all/significant/high-risk] changes
- **Code Quality**: [Comprehensive/Standard/Minimal] checks of [all/key/critical] aspects
- **Functional Verification**: [Detailed/Basic/Focused] analysis with [multiple/primary/core] test cases
- **Production Safety**: Required for [all/high-impact/production] changes

[Customize this section based on the verification needs of your repository.]

### Tracking Requirements

This repository uses [standard/enhanced/custom] tracking requirements:

- **Context Headers**: Required in [every/substantive/primary] message
- **Progress Format**: [Detailed/Component-level/Phase-level] tracking
- **Memory Refreshes**: Required every [3-5/5-10/10-15] steps
- **State Snapshots**: Required after [each/major/phase] components

[Customize this section based on the tracking needs of your repository.]

## Custom Rules

This profile includes the following custom rules:

1. **[Rule Name]** ([custom-rules/rule-name.md]): [Brief description of the rule and how it extends or overrides core rules]
2. **[Rule Name]** ([custom-rules/rule-name.md]): [Brief description of the rule and how it extends or overrides core rules]
3. [Add more rules as needed]

[Provide information about each custom rule included in the profile, explaining its purpose and how it modifies the core framework.]

## Custom Templates

This profile includes the following custom templates:

1. **[Template Name]** ([custom-templates/template-name.md]): [Brief description of the template and its purpose]
2. **[Template Name]** ([custom-templates/template-name.md]): [Brief description of the template and its purpose]
3. [Add more templates as needed]

[Provide information about each custom template included in the profile, explaining its purpose and how it fits into the repository workflow.]

## Custom Instructions

This profile includes the following custom instructions:

1. **[Instruction Name]** ([custom-instructions/instruction-name.md]): [Brief description of the instruction and its purpose]
2. **[Instruction Name]** ([custom-instructions/instruction-name.md]): [Brief description of the instruction and its purpose]
3. [Add more instructions as needed]

[Provide information about each custom instruction included in the profile, explaining its purpose and how it helps with working in the repository.]

## Repository-Specific Guidelines

### Coding Standards

[Describe the coding standards, style guides, and best practices specific to this repository. Include information about naming conventions, code organization, and any other guidelines that should be followed.]

### Architectural Patterns

[Describe the architectural patterns and design principles used in the repository. Include information about how different components interact, the data flow, and any other architectural considerations.]

### Development Workflow

[Describe the development workflow used in the repository. Include information about branching strategies, code review processes, testing requirements, and deployment procedures.]

### Common Components

[Describe common components, utilities, or libraries used throughout the repository. Include information about how these components should be used and any associated best practices.]

## Usage

To activate this profile:

```
@profile:activate [repository-name]
```

This will load all repository-specific configurations, rules, templates, and instructions, adapting the AI Workflow Framework to this repository.

## Additional Resources

- [Link to repository documentation]
- [Link to architectural diagrams]
- [Link to style guides]
- [Other relevant resources]

## Profile Maintenance

This profile is maintained by [maintainer name/team]. If you find issues or have suggestions for improvements, please [contact information or process for suggestions]. 