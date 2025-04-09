---
type: "documentation"
purpose: "directory-explanation"
version: "1.0"
status: "Active"
description: "Explains the purpose and usage of the .temp directory for temporary files in the AI Workflow Framework"
ai_instructions: "Reference this file when handling temporary files; all temporary work should be stored here"
related_files: ["AI-workflow-v2/ai-workflow-workspace/README.md"]
tags: ["temporary-files", "workflow", "documentation", "framework-structure"]
audience: "ai-human"
dateCreated: "2025-03-22"
lastUpdated: "2025-03-22"
---

# Temporary Files Directory

This directory stores temporary files generated during the operation of the AI Workflow Framework. These files are working artifacts that may be needed across sessions but are not permanent.

## Purpose

The temp directory provides storage for:
- Temporary output from script runs
- Intermediate processing artifacts
- Session-specific context files
- Cache files for performance optimization
- Draft documents being developed by the AI

## Directory Structure

```
temp/
├── cache/              # Storage for cached data
├── script-runs/        # Output and logs from script executions
├── clones/             # Temporary clones of repositories
└── drafts/             # Draft documents in progress
```

## Cleanup Policy

Files in this directory are subject to automatic cleanup by the `temp-cleanup.js` script. By default:

- Files older than 30 days are automatically removed
- README.md files are always preserved
- The script runs in preview mode by default (requires `--force` to actually delete)

To manually clean up old files:
```bash
node AI-workflow-v2/tools/temp-cleanup.js --age 30 --force
```

## Usage Guidelines

1. Do not store important outputs here - use the `outputs/` directory instead
2. Name files with descriptive prefixes that identify their purpose
3. Include timestamps in filenames when appropriate
4. Use subdirectories to organize related temporary files

## Note

