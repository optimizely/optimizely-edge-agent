---
type: "documentation"
purpose: "README"
version: "1.0"
status: "Active"
description: "Documentation for AI workflow framework utility tools"
ai_instructions: "Reference this file when working with the framework's utility tools"
related_files: ["./date-utils.js", "./path-utils.js", "./file-utils.js"]
tags: ["utilities", "documentation", "tools"]
priority: "high"
audience: "ai-human"
dateCreated: "2025-03-25"
lastUpdated: "2025-03-25"
---

# AI Tools

This directory contains tools specifically designed for AI assistants working with the AI Workflow framework.

## Overview

The AI Tools are designed to assist AI assistants in implementing workflows according to the AI Workflow framework. These tools help with tasks such as:

- Understanding implementation context
- Tracking decisions
- Analyzing scope
- Generating code
- Managing state
- Applying workflow rules
- Verifying implementations

## Available Tools

### Core Tools

- [Context Summarizer](./context-summarizer.md): Tool for summarizing implementation context
- [Decision Tracker](./decision-tracker.md): Tool for tracking implementation decisions
- [Scope Analyzer](./scope-analyzer.md): Tool for analyzing implementation scope
- [State Manager](./state-manager.md): Tool for managing implementation state
- [Rule Applier](./rule-applier.md): Tool for applying workflow rules

### Implementation Tools

- [Code Generator](./code-generator.md): Tool for generating code
- [Test Generator](./test-generator.md): Tool for generating tests
- [Documentation Generator](./documentation-generator.md): Tool for generating documentation

### Verification Tools

- [Quality Checker](./quality-checker.md): Tool for checking implementation quality
- [Compliance Checker](./compliance-checker.md): Tool for checking compliance with workflow rules
- [Security Validator](./security-validator.md): Tool for validating security aspects

## Using the Tools

Each tool is designed to be used by AI assistants during the implementation process. The tools can be used in combination to assist with various aspects of the implementation.

For example, to use the Context Summarizer:

```
@apply-tool:context-summarizer
```

This will summarize the current implementation context, including the current phase, step, and progress.

## Creating New Tools

If you want to create a new AI tool, use the [AI Tool Template](./ai-tool-template.md) as a starting point. The template provides a structure for creating new tools that are consistent with the existing tools.

## Integration with the AI Workflow Framework

The AI tools are designed to integrate seamlessly with the AI Workflow framework. They help enforce the framework rules and guidelines, ensuring that implementations meet the quality standards expected by the framework.

## Related Resources

- [AI Workflow Framework](../../README.md): The main documentation for the AI Workflow framework
- [Implementation Process](../../framework-rules/100-implementation-process.md): Documentation on the implementation process
- [Templates](../../templates/README.md): Templates for creating workflow artifacts

# AI Workflow Framework Utilities

This directory contains essential utility tools for the AI Workflow Framework, designed to ensure consistent behavior across different environments and platforms.

## Key Utilities

### 1. File Utilities (`file-utils.js`)

Provides file operations with automatic timestamp updating for markdown files.

```javascript
const { writeFile, createDirectory, createFileWithMetadata } = require('./tools/ai-tools/file-utils.js');

// Creating a directory
createDirectory('/path/to/directory');

// Writing a file with automatic timestamp updating
writeFile('/path/to/file.md', content);

// Creating a file with metadata
createFileWithMetadata('/path/to/file.md', content, {
  type: "documentation",
  purpose: "README",
  // dateCreated and lastUpdated will be added automatically
});
```

### 2. Path Utilities (`path-utils.js`)

Handles cross-platform path resolution and ensures everything works regardless of installation location.

```javascript
const { getFrameworkRoot, getAbsolutePath, getPlanPath } = require('./tools/ai-tools/path-utils.js');

// Get the absolute path to the framework root
const root = getFrameworkRoot();

// Resolve a path relative to the framework root
const templatesPath = getAbsolutePath('templates', 'plan-templates');

// Get the path to a plan directory (creates it if it doesn't exist)
const planPath = getPlanPath('my-plan-name');
```

### 3. Date Utilities (`date-utils.js`)

Provides standardized date formatting and timestamp updating.

```javascript
const { formatDate, getCurrentDate, updateMetadataDate } = require('./tools/ai-tools/date-utils.js');

// Get today's date in YYYY-MM-DD format
const today = formatDate();

// Get comprehensive date information
const dateInfo = getCurrentDate();
console.log(dateInfo.year); // Current year
console.log(dateInfo.formatted); // YYYY-MM-DD

// Update metadata dates in file content
const updatedContent = updateMetadataDate(content);
```

## Best Practices

To ensure proper path handling and timestamp updating across the framework:

1. **Always use these utilities** instead of direct Node.js fs/path operations
2. **Use absolute paths** with the path utilities whenever possible
3. **Use file utilities** for all file operations to ensure automatic timestamp updating
4. **Include proper metadata** in all markdown files

## Implementation Guidelines

### For File Operations

Always use the file utilities for file operations to ensure automatic timestamp updating:

```javascript
// ❌ Don't use direct fs operations
fs.writeFileSync('/path/to/file.md', content);

// ✅ Use file utilities instead
writeFile('/path/to/file.md', content);
```

### For Path Handling

Always use absolute paths with the path utilities:

```javascript
// ❌ Don't use relative paths
const path = 'AI-workflow-v2/tools/plans/my-plan';

// ✅ Use absolute paths with path utilities
const path = getAbsolutePath('plans', 'my-plan');
```

### For Date Handling

Always use the date utilities for consistent date formatting:

```javascript
// ❌ Don't create dates directly
const today = new Date().toISOString().split('T')[0];

// ✅ Use date utilities
const today = formatDate();
```

## Cross-Platform Compatibility

These utilities ensure the framework works consistently across:

- Windows
- macOS
- Linux

