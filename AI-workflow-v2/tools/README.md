# AI Workflow Tools

This directory contains a collection of tools and utilities to support the AI Workflow framework.

## Overview

The tools in this directory serve several purposes:

1.  **Framework Utilities**: Core scripts for managing and using the framework (e.g., copying rules, creating plans, updating paths/timestamps).
2.  **AI Assistant Tools**: Utilities specifically designed to aid AI assistants working within the framework (located in `ai-tools/`).
3.  **Decision Tree Docs**: Reference documents outlining decision processes (located in `decision-trees/`).
4.  **Helper Scripts**: Assorted scripts for tasks like verification (located in `scripts/`).

## Directory Structure

The actual structure differs slightly from the original plan:

```
tools/
├── ai-tools/           # Utilities specifically designed for AI assistants
├── decision-trees/     # Documentation for decision processes
├── scripts/            # Helper scripts (e.g., verification)
│
├── copy-rules-to-cursor.js # Copies framework rules for IDE integration
├── convert-rules.js    # Converts rule formats (if needed)
├── get-ai-workflow.js  # Utility for workflow initialization/retrieval
├── index.js            # Entry point for importing tools as modules
├── package.json        # Node.js dependencies and scripts for this directory
├── readme-timestamp-generator.js # Generates timestamps for README files
├── temp-cleanup.js     # Cleans up temporary files
├── update-rule-paths.js # Updates paths referenced within rule files
└── update-timestamps.js # Updates timestamps within documentation files
```

## Available Tools & Scripts

This section lists the primary tools available. For AI-specific utilities, see the `ai-tools/README.md`.

### Core Framework Utilities (Root of `tools/`)

| Tool                            | Description                                       | NPM Script Equivalent (from root) |
| :------------------------------ | :------------------------------------------------ | :-------------------------------- |
| `copy-rules-to-cursor.js`       | Copy framework rules to the Cursor IDE            | `npm run copy-rules`              |
| `temp-cleanup.js`             | Clean up temporary files                          | `npm run temp-cleanup`            |
| `update-timestamps.js`        | Update timestamps in files                        | `npm run update-timestamps`       |
| `readme-timestamp-generator.js` | Generate timestamps for READMEs                   | `npm run readme-timestamp`        |
| `update-rule-paths.js`        | Updates paths referenced within rule files        | *(Indirectly used?)*             |
| `convert-rules.js`            | Convert framework rules to another format         | `npm run tools:convert-rules`   |
| `get-ai-workflow.js`          | Initialize/retrieve AI workflow components        | `npm run tools:get-ai-workflow` |
| `index.js`                    | Module entry point for programmatic use         |                                   |
| `package.json`                | Dependencies for tools directory                  |                                   |

### AI Assistant Utilities (`ai-tools/`)

This subdirectory contains specialized utilities for AI assistants, such as token counting, progress indicators, communication templates, context management, and file/path utilities.
*   See `ai-tools/README.md` for details.
*   Some may be callable via NPM scripts like `npm run ai:tokenize`, `npm run ai:progress`, `npm run ai:date-utils`.

### Helper Scripts (`scripts/`)

| Tool                       | Description                                  |
| :------------------------- | :------------------------------------------- |
| `verify-plan-structure.js` | Validates a plan directory's structure       |

### Decision Tree Documentation (`decision-trees/`)

Contains Markdown documents outlining decision processes (e.g., `mode-selection.md`, `scope-verification.md`). These are reference materials, not executable tools.

*(Note: Previous versions of this README listed tools in non-existent directories like `dev-tools/`, `automation/`, `qa-tools/`, and mentioned several scripts that have since been removed as obsolete or single-use, such as `update-paths.js`, `migrate-installer.js`, etc.)*

## Using the Tools

The tools can be used in several ways:

### 1. Via NPM Scripts (Recommended)

The easiest way to use many tools is through npm scripts defined in the root `package.json`:

```bash
# From the AI-workflow-v2 root directory:
npm run copy-rules
npm run temp-cleanup
npm run update-timestamps
npm run readme-timestamp
npm run ai:tokenize
# ... and potentially others listed in the root package.json
```
*(Note: Ensure the root `package.json` accurately reflects available tool scripts.)*

### 2. Direct Node Execution

You can run the `.js` tools directly with Node from the project root or the `tools/` directory (adjust paths accordingly):

```bash
# From the project root
node AI-workflow-v2/tools/copy-rules-to-cursor.js
node AI-workflow-v2/tools/scripts/verify-plan-structure.js plan-xyz

# From the tools directory
node copy-rules-to-cursor.js
node scripts/verify-plan-structure.js ../ai-workflow-workspace/plans/plan-xyz
```

### 3. Importing as Modules

The tools (via `index.js` and potentially `ai-tools/index.js`) can be imported as modules in other JavaScript files. See original README sections for examples if needed, ensuring paths are correct.

## Contributing

Contributions are welcome. If adding a new tool:
- Place it in the relevant subdirectory (`ai-tools/`, `scripts/`, or root `tools/`).
- Add documentation or update this README.
- If applicable, add an NPM script to the root `package.json`.
- Follow existing coding standards.

## Related Resources

- [AI Workflow Framework Root](../README.md)
- [Framework Rules](../framework-rules/README.md)
- [Templates](../templates/README.md)
- [AI Workflow Workspace](../ai-workflow-workspace/README.md) 