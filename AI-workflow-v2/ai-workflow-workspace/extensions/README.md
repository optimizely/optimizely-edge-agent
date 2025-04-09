---
type: "documentation"
purpose: "extensions-overview"
version: "2.0"
status: "Active"
description: "Guide to extending the AI Workflow Framework with custom rules and repository profiles"
ai_instructions: "Share this documentation when users need to understand how to customize the framework for specific repositories or use cases"
related_files: [
  "AI-workflow-v2/ai-workflow-workspace/README.md",
  "AI-workflow-v2/framework-rules/150-extension-integration.md",
  "AI-workflow-v2/framework-rules/README.md"
]
directory_purpose: "This directory serves as the master repository for customizing and extending the AI Workflow Framework for specific repositories and use cases."
tags: ["extensions", "customization", "repository-specific", "custom-rules", "repository-profiles"]
priority: "high"
audience: "ai-human"
dateCreated: "2025-03-20"
lastUpdated: "2025-03-20"
---

# AI Workflow Framework Extensions

This directory contains the Extensions System for the AI Workflow Framework. It enables customization for specific repositories and use cases without modifying the core framework.

## Overview

The Extensions System provides three key customization mechanisms:

1. **Custom Rules** - Extend or override core framework rules
2. **Repository Profiles** - Complete configuration sets for specific repositories
3. **Integration Points** - Connect with external tools and systems

When the framework is used, these extensions are **automatically discovered and incorporated** into the AI's workflow.

## Directory Structure

```
extensions/
├── README.md - This guide
├── custom-rules/ - Global custom rules
│   ├── [rule-name].md - Individual custom rules
│   └── ... - Additional custom rules
├── repository-profiles/ - Repository-specific configurations
│   ├── [repo-name]/ - Repository profile directory
│   │   ├── profile.md - Repository profile configuration
│   │   └── custom-rules/ - Repository-specific rules
│   └── ... - Additional repository profiles
└── integration-points/ - External system integrations
    ├── [integration-name].md - Individual integration configurations
    └── ... - Additional integration points
```

## Automatic Rule Discovery

The framework includes an [Extension Integration Protocol](AI-workflow-v2/framework-rules/150-extension-integration.md) that automatically:

1. Scans this directory at the beginning of any planning/implementation process
2. Identifies relevant custom rules and repository profiles
3. Incorporates these extensions into the AI's workflow
4. Documents which extensions were applied

## Custom Rules

Custom rules extend or override core framework rules to modify the AI's behavior in specific contexts.

### Creating a Custom Rule

To create a custom rule:

1. Create a markdown file in the `custom-rules/` directory
2. Name it descriptively (e.g., `enhanced-verification.md`)
3. Include the required metadata
4. Specify which core rule it extends or overrides
5. Define the custom behavior

Example custom rule metadata:

```yaml
---
type: "extension-rule"
purpose: "enhanced-verification"
version: "1.0"
status: "Active"
description: "Enhanced verification protocol for API implementations"
ai_instructions: "Apply this rule when implementing or modifying APIs"
related_files: [
  "AI-workflow-v2/guidelines/framework-rules/300-verification-protocols.md"
]
extends: "300-verification-protocols.md"  # Core rule being extended
integration_type: "extension"  # extension or override
application_context: "API implementations"  # When to apply
rule_priority: "high"
dateCreated: "2025-03-20"
lastUpdated: "2025-03-20"
---
```

### Rule Precedence

Custom rules have precedence over core rules, with this hierarchy:

1. Repository-specific rules (highest precedence)
2. Global custom rules (medium precedence)
3. Core framework rules (base precedence)

## Repository Profiles

Repository profiles provide complete configuration sets for specific repository types.

### Creating a Repository Profile

To create a repository profile:

1. Create a directory in `repository-profiles/` named after your repository
2. Create a `profile.md` file with repository configuration
3. Create a `custom-rules/` subdirectory for repository-specific rules
4. Add any repository-specific rules to this directory

Example repository profile:

```yaml
---
type: "repository-profile"
purpose: "e-commerce-platform-profile"
version: "1.0"
status: "Active"
description: "Repository profile for e-commerce platform implementations"
ai_instructions: "Apply this profile when working with e-commerce platform repositories"
repository_identifiers: [
  "e-commerce-platform",
  "shop-system"
]
custom_rules: [
  "custom-rules/e-commerce-scope-control.md"
]
priority: "high"
dateCreated: "2025-03-20"
lastUpdated: "2025-03-20"
---
```

### Repository Detection

The framework identifies repositories based on:
- Repository name/path detection
- Codebase pattern matching
- Manual activation (`@profile:activate [repo-name]`)

## Integration Points

Integration points define connections to external tools and systems.

### Creating an Integration Point

To create an integration point:

1. Create a markdown file in the `integration-points/` directory
2. Define the integration configuration
3. Specify activation conditions

Example integration point:

```yaml
---
type: "integration-point"
purpose: "jira-integration"
version: "1.0"
status: "Active"
description: "Integration with Jira for task tracking"
ai_instructions: "Use this integration when tracking tasks in Jira"
activation_command: "@integration:jira"
priority: "medium"
dateCreated: "2025-03-20"
lastUpdated: "2025-03-20"
---
```

## Extension Commands

The following commands can manually control extensions:

- `@extension:scan` - Manually trigger extension scanning
- `@extension:list` - List all available extensions
- `@extension:apply [name]` - Manually apply a specific extension
- `@profile:activate [name]` - Activate a specific repository profile
- `@integration:activate [name]` - Activate a specific integration point

## Examples

### Custom Rule Example

See `custom-rules/enhanced-verification.md` for an example of a custom rule that extends the verification protocols for API implementations.

### Repository Profile Example

See `repository-profiles/e-commerce-platform/` for an example of a repository profile for e-commerce platforms, including custom rules specific to e-commerce implementations.

## Best Practices

When creating extensions:

1. **Be Specific** - Target extensions to specific contexts
2. **Document Clearly** - Explain when and how the extension applies
3. **Test Thoroughly** - Verify the extension works as expected
4. **Consider Interactions** - Account for interactions with other extensions
5. **Follow Standards** - Maintain consistent formatting and structure
6. **Version Control** - Track changes to extensions with versioning

## Extension Development Workflow

1. **Identify Need** - Determine where customization is needed
2. **Create Extension** - Develop the custom rule, profile, or integration
3. **Test Extension** - Verify correct behavior in test cases
4. **Document Extension** - Add clear documentation
5. **Deploy Extension** - Add to the extensions directory
6. **Update References** - Reference the extension in related files

## Technical Implementation

Technically, extensions are:
1. Discovered through a directory scan at planning/implementation start
2. Loaded into the AI's working memory
3. Applied according to their integration type and context
4. Documented in the implementation plan

