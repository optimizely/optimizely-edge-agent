---
type: "custom-rule"
rule_name: "[RULE NAME]"
description: "[Brief description of the rule purpose]"
version: "1.0"
status: "Active"
rule_type: "[extension/override/new]"
target_rule: "[Core rule name - only for extension/override rules]"
application: {
  "globs": "[File glob patterns - e.g., **/*.js,**/*.ts]",
  "repositories": "[Repository names - e.g., repo1,repo2]",
  "conditions": "[Activation conditions - e.g., implementation_mode == 'manual']"
}
tags: ["custom-rule", "[additional-tags]"]
priority: "[high/medium/low]"
dateCreated: "[YYYY-MM-DD]"
lastUpdated: "[YYYY-MM-DD]"
---

# [RULE NAME]

[Introduction and overview of the rule. Explain what this rule does and why it exists. Include any important context that helps understand the rule.]

## Rule Purpose

[Explain the specific purpose of this rule. Why was it created? What problem does it solve? How does it extend or override the target core rule (if applicable)?]

## Requirements

[List the specific requirements or guidelines that this rule enforces. Use clear, concise language and be explicit about what is required vs. recommended.]

1. **[Requirement 1]**: [Detailed explanation]
2. **[Requirement 2]**: [Detailed explanation]
3. **[Requirement 3]**: [Detailed explanation]
4. [Add more requirements as needed]

## Examples

### Good Examples

```[language]
[Example of code or implementation that follows this rule]
```

**Why this is good**: [Explanation of why this example follows the rule correctly]

### Bad Examples

```[language]
[Example of code or implementation that violates this rule]
```

**Why this is bad**: [Explanation of why this example violates the rule]

## Application

This rule applies to:

- **File Types**: [Types of files this rule applies to]
- **Repositories**: [Repositories where this rule should be applied]
- **Conditions**: [Any conditions that must be met for this rule to apply]

## Integration with Core Rules

[Only for extension/override rules. Explain how this rule relates to the core rule it targets. How does it extend or modify the core rule's behavior?]

### Extension Details

[For extension rules. Explain what additional requirements or guidelines this rule adds to the core rule.]

### Override Details

[For override rules. Explain which parts of the core rule are being replaced and why.]

## Usage Guidelines

[Provide guidance on how to effectively follow this rule. Include any tips, tricks, or best practices that might help users comply with the rule.]

## Verification

Use the following criteria to verify compliance with this rule:

- **[Verification Point 1]**: [What to check]
- **[Verification Point 2]**: [What to check]
- **[Verification Point 3]**: [What to check]
- [Add more verification points as needed]

## Exceptions

[Document any valid exceptions to this rule. When might it be acceptable to not follow this rule? What conditions justify exceptions?]

## Related Rules

- **[Related Rule 1]**: [Brief explanation of relationship]
- **[Related Rule 2]**: [Brief explanation of relationship]
- [Add more related rules as needed]

## Notes

[Any additional information or context that doesn't fit in the sections above. Include any caveats, warnings, or additional considerations.] 