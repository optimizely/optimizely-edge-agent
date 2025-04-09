---
type: "documentation"
purpose: "custom-rules-overview"
version: "2.0"
status: "Active"
description: "Overview of custom rules, which extend or override core framework rules in the AI Workflow Framework"
ai_instructions: "Reference this document when explaining custom rules; guide users on creating and using repository-specific rule extensions"
ai_usage_context: "Reference this document when a user needs to create or use custom rules that extend or override core framework rules"
related_files: [
  "AI-workflow-v2/ai-workflow-workspace/README.md",
  "rule-template.md",
  "AI-workflow-v2/framework-rules/README.md"
]
directory_purpose: "This directory contains custom rules that extend or override core framework rules, allowing for repository-specific adaptations."
tags: ["custom-rules", "customization", "framework-rules", "extensions"]
priority: "high"
audience: {
  "primary": "both AI assistants and developers",
  "technical_level": "all levels"
}
dateCreated: "2025-03-19"
lastUpdated: "2025-03-19"
---

# Custom Rules

This directory contains Custom Rules for the AI Workflow Framework, which extend or override core framework rules. Custom rules allow you to adapt the framework's behavior for specific repositories or use cases without modifying the core rules.

## What are Custom Rules?

Custom rules are extensions or overrides of the core framework rules. They allow you to:

- **Extend** core rules with additional guidance
- **Override** core rules with repository-specific requirements
- **Create** new rules for repository-specific needs

All custom rules follow the same basic format as core rules but include additional metadata to specify how they relate to core rules.

## Rule Types

The framework supports three types of custom rules:

1. **Extension Rules**: Add additional guidance to core rules without changing existing behavior
2. **Override Rules**: Replace core rule behavior with custom behavior
3. **New Rules**: Create entirely new rules for repository-specific needs

## Directory Structure

```
custom-rules/
├── README.md - This overview document
├── rule-template.md - Template for creating new rules
└── [rule-name].md - Individual custom rules
```

Custom rules can also be part of repository profiles in the `repository-profiles/[repository-name]/custom-rules/` directory.

## Creating a Custom Rule

To create a new custom rule:

1. Copy the `rule-template.md` file to `custom-rules/[rule-name].md`
2. Specify the rule type (extension, override, or new) and target core rule (if applicable)
3. Customize the rule content as needed
4. Specify application settings (glob patterns, repositories, etc.)

## Using Custom Rules

To use a custom rule:

1. Ensure the rule is available in the `custom-rules/` directory or in a repository profile
2. Activate the rule using the `@rule:activate [rule-name]` command
3. The framework will automatically load and apply the rule

If the rule is part of a repository profile, it will be activated automatically when the profile is activated.

## Custom Rule Format

Each custom rule follows this format:

```
---
type: "custom-rule"
rule_name: "[rule name]"
description: "[rule description]"
version: "[rule version]"
status: "Active"
rule_type: "[extension/override/new]"
target_rule: "[core rule name or ID]" # Only for extension or override rules
application: {
  "globs": "[glob patterns]",
  "repositories": "[repository names]",
  "conditions": "[activation conditions]"
}
tags: ["[rule-specific tags]"]
priority: "[high/medium/low]"
dateCreated: "[creation date]"
lastUpdated: "[update date]"
---

# [Rule Name]

[Rule content following the same structure as core rules]
```

## Extension Rules

Extension rules add additional guidance to core rules without changing existing behavior. They include additional information, examples, or guidelines specific to certain repositories or use cases.

Example extension rule:

```
---
type: "custom-rule"
rule_name: "react-component-structure"
description: "Extends the component structure guidelines with React-specific requirements"
version: "1.0"
status: "Active"
rule_type: "extension"
target_rule: "component-structure"
application: {
  "globs": "**/*.jsx,**/*.tsx",
  "repositories": ["react-app", "react-library"],
  "conditions": "file_contains('React')"
}
tags: ["react", "components", "structure"]
priority: "high"
dateCreated: "2025-03-15"
lastUpdated: "2025-03-19"
---

# React Component Structure

This rule extends the core component structure guidelines with React-specific requirements.

## React Component Requirements

In addition to the base component structure requirements, React components MUST:

1. Use functional components with hooks instead of class components
2. Follow the named export pattern
3. Include prop type definitions using PropTypes or TypeScript interfaces
4. Implement memoization for expensive components using React.memo

[Additional React-specific guidance...]
```

## Override Rules

Override rules replace core rule behavior with custom behavior. They provide alternative guidance that takes precedence over the core rules for specific scenarios.

Example override rule:

```
---
type: "custom-rule"
rule_name: "custom-verification-protocol"
description: "Overrides standard verification protocols with custom requirements"
version: "1.0"
status: "Active"
rule_type: "override"
target_rule: "verification-protocols"
application: {
  "globs": "**/*",
  "repositories": ["security-focused-app"],
  "conditions": "implementation_mode == 'manual'"
}
tags: ["verification", "security", "override"]
priority: "high"
dateCreated: "2025-03-15"
lastUpdated: "2025-03-19"
---

# Custom Verification Protocol

This rule overrides the standard verification protocols with enhanced security-focused requirements.

## Verification Requirements

When implementing changes in this repository, these verification steps MUST be followed:

1. **Security Review**: All changes must undergo a security review
2. **Data Privacy Check**: Verify compliance with data privacy regulations
3. **Authentication Verification**: Verify authentication mechanisms are properly implemented
4. **Authorization Check**: Verify proper authorization checks are in place
5. **Injection Protection**: Verify protection against common injection attacks

[Additional security verification guidance...]
```

## New Rules

New rules create entirely new guidance for repository-specific needs. They provide additional guidance not covered by the core rules.

Example new rule:

```
---
type: "custom-rule"
rule_name: "graphql-schema-design"
description: "Guidelines for designing GraphQL schemas"
version: "1.0"
status: "Active"
rule_type: "new"
target_rule: null
application: {
  "globs": "**/*.graphql",
  "repositories": ["graphql-api"],
  "conditions": "true"
}
tags: ["graphql", "schema", "api"]
priority: "high"
dateCreated: "2025-03-15"
lastUpdated: "2025-03-19"
---

# GraphQL Schema Design

This rule provides guidelines for designing GraphQL schemas in this repository.

## Schema Design Principles

When designing GraphQL schemas, follow these principles:

1. **Descriptive Types**: Use clear, descriptive names for types and fields
2. **Consistent Naming**: Follow consistent naming conventions
3. **Field Nullability**: Make fields non-nullable unless they are truly optional
4. **Reusable Objects**: Create reusable object types for common structures
5. **Query Structure**: Design queries to minimize the number of resolver calls

[Additional GraphQL schema guidance...]
```

## Rule Activation Process

When a custom rule is activated, the framework:

1. **Loads the rule configuration** - Reading and parsing the rule file
2. **Checks the rule type** - Determining how to apply the rule
3. **Finds the target rule** - For extension and override rules
4. **Merges or replaces** - Applying the custom rule alongside or in place of the core rule
5. **Converts to Cursor rule** - For applicable rules, converts the rule to an .mdc file in the .cursor/rules directory

## Rule Precedence

Custom rules follow this precedence order (highest to lowest):

1. Repository-specific rules in an active profile
2. Explicitly activated custom rules
3. Core framework rules

## Best Practices for Custom Rules

### Rule Scope

- Keep rules focused on specific concerns
- Avoid overly broad rules that try to cover too many scenarios
- Create separate rules for different repositories or components as needed
- Keep rule content concise and clear

### Rule Documentation

- Clearly document the purpose of the rule
- Explain how it extends or overrides core rules
- Provide examples of proper implementation
- Document any edge cases or exceptions

### Rule Testing

- Test rules before deployment
- Verify that rules are properly applied
- Check for conflicts with other rules
- Update rules when repository requirements change

## Rule Template

