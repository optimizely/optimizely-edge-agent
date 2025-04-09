---
type: "documentation"
purpose: "repository-profiles-overview"
version: "2.0"
status: "Active"
description: "Overview of repository profiles, which provide complete configuration sets for specific repositories within the AI Workflow Framework"
ai_instructions: "Reference this document when explaining repository profiles; guide users on creating and using repository-specific profiles"
ai_usage_context: "Reference this document when a user needs to create or use a repository-specific profile"
related_files: [
  "AI-workflow-v2/ai-workflow-workspace/README.md",
  "profile-template.md"
]
directory_purpose: "This directory contains repository profiles for customizing the AI Workflow Framework for specific repositories."
tags: ["repository-profiles", "customization", "repository-specific", "configuration"]
priority: "high"
audience: {
  "primary": "both AI assistants and developers",
  "technical_level": "all levels"
}
dateCreated: "2025-03-19"
lastUpdated: "2025-03-19"
---

# Repository Profiles

This directory contains Repository Profiles for the AI Workflow Framework, which provide complete configuration sets for specific repositories. Repository profiles allow you to adapt the framework to particular codebases and workflows without modifying the core framework.

## What is a Repository Profile?

A repository profile is a complete configuration set for a specific repository, including:

- **Repository Information**: Metadata about the repository
- **Framework Configuration**: Implementation modes, verification protocols, etc.
- **Custom Rules**: Repository-specific rules that extend or override core rules
- **Custom Templates**: Repository-specific templates for implementations
- **Custom Instructions**: Special instructions for working with the repository

Repository profiles are designed to be portable, allowing you to pull the AI Workflow Framework into different repositories while maintaining repository-specific customizations.

## Directory Structure

```
repository-profiles/
├── README.md - This overview document
├── profile-template.md - Template for creating new profiles
└── [repository-name]/ - Folder for each repository profile
    ├── profile.md - Repository profile configuration
    ├── custom-rules/ - Repository-specific rules
    │   └── [rule-name].md - Individual custom rules
    ├── custom-templates/ - Repository-specific templates
    │   └── [template-name].md - Individual custom templates
    └── custom-instructions/ - Repository-specific instructions
        └── [instruction-name].md - Individual custom instructions
```

## Creating a Repository Profile

To create a new repository profile:

1. Create a new directory in `repository-profiles/` named after your repository
2. Copy the `profile-template.md` file to `repository-profiles/[repository-name]/profile.md`
3. Customize the profile with repository-specific settings
4. Create subdirectories for custom rules, templates, and instructions as needed
5. Add custom rules, templates, and instructions as appropriate

## Using a Repository Profile

To use a repository profile:

1. Ensure the profile is available in the `repository-profiles/` directory
2. Activate the profile using the `@profile:activate [repository-name]` command
3. The framework will automatically load and apply the profile configuration

## Repository Profile Format

Each repository profile consists of a main `profile.md` file with this structure:

```
---
type: "repository-profile"
repository_name: "[repository name]"
repository_url: "[repository URL]"
description: "[repository description]"
version: "[profile version]"
status: "Active"
framework_configuration: {
  "implementation_modes": "[default mode]",
  "verification_protocols": "[verification level]",
  "tracking_requirements": "[tracking level]"
}
custom_rules: [
  "[list of custom rules]"
]
custom_templates: [
  "[list of custom templates]"
]
custom_instructions: [
  "[list of custom instructions]"
]
tags: ["[repository-specific tags]"]
priority: "high"
dateCreated: "[creation date]"
lastUpdated: "[update date]"
---

# [Repository Name] Profile

[Repository-specific configuration and documentation]

## Repository Overview

[Brief description of the repository, its purpose, and key components]

## Framework Configuration

[Configuration details for how the framework should operate in this repository]

## Custom Rules

[List and description of repository-specific rules]

## Custom Templates

[List and description of repository-specific templates]

## Custom Instructions

[List and description of repository-specific instructions]

## Usage Guidelines

[Guidelines for using the framework with this repository]
```

## Additional Profile Components

### Custom Rules

Repository-specific rules are stored in the `custom-rules/` subdirectory of the repository profile. Each rule follows the same format as core framework rules but includes additional metadata to specify how it relates to core rules.

### Custom Templates

Repository-specific templates are stored in the `custom-templates/` subdirectory of the repository profile. These templates can extend or override core templates and are used for repository-specific implementation requests.

### Custom Instructions

Repository-specific instructions are stored in the `custom-instructions/` subdirectory of the repository profile. These instructions provide guidance on working with the specific repository and are referenced by the AI assistant when implementing changes.

## Profile Activation Process

When a repository profile is activated, the framework:

1. **Loads the profile configuration** - Reading and parsing the profile.md file
2. **Loads custom components** - Loading all custom rules, templates, and instructions
3. **Merges with core framework** - Combining the profile with the core framework
4. **Generates Cursor rules** - Converting relevant .md files to .mdc in the .cursor/rules directory
5. **Applies the profile** - Applying the profile to the current implementation

## Best Practices for Repository Profiles

### Profile Organization

- Create one profile per repository
- Keep profiles self-contained and portable
- Document repository-specific requirements and constraints
- Organize custom components into appropriate subdirectories

### Profile Maintenance

- Update profiles when repository requirements change
- Version-control profiles alongside the repository
- Document profile changes and updates
- Test profiles before deployment

### Profile Documentation

- Clearly document the purpose and scope of the profile
- Explain repository-specific customizations
- Provide usage instructions for the profile
- Document any known limitations or issues

## Example Repository Profile

An example repository profile for a React application might look like this:

```
repository-profiles/
└── react-app/
    ├── profile.md - Repository profile configuration
    ├── custom-rules/
    │   ├── react-component-structure.md
    │   └── jsx-naming-conventions.md
    ├── custom-templates/
    │   ├── react-component-template.md
    │   └── react-hook-template.md
    └── custom-instructions/
        └── react-app-architecture.md
```

