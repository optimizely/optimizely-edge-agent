---
version: "1.1"
type: "directory-guide"
purpose: "template-directory-overview"
description: "Central directory for core plan artifact templates used in the AI Workflow Framework."
related_files:
  - "../README.md"
  - "plan-templates/readme-template.md"
  - "plan-templates/status-template.md"
  - "plan-templates/task-status-board.md"
tags: ["templates", "resources", "framework-overview", "documentation", "plans"]
audience: "AI assistants and developers implementing the AI Workflow Framework"
---

# AI Workflow Framework Templates

This directory contains templates for core artifacts used when generating and tracking implementation plans within the AI Workflow Framework.

## Directory Overview

Templates provide standardized structures for creating consistent artifacts. Using these templates ensures that plans and status logs follow the same patterns and include necessary information for both AI processing and human review.

## Template Categories

The primary category is:

### Plan Templates (`plan-templates/`)

These templates are used for creating the standard files within a specific plan directory (`ai-workflow-workspace/plans/[plan-id]/`):

*   **[README Template](plan-templates/readme-template.md)**: Standard structure for a plan's `README.md` overview file.
*   **[Status Log Template](plan-templates/status-template.md)**: Standard structure for a plan's `status.md` log file.
*   **[Task Status Board Template](plan-templates/task-status-board.md)**: Optional template for tracking parallel task execution.
*   *(Mode-Specific Plan Templates may also exist here: `plan-template-manual.md`, `plan-template-semi.md`, `plan-template-auto.md`)*

*(Note: `prompt-templates/` may contain utility templates for specific user interactions, but are not typically loaded into the AI context by default.)*

## Using Templates

Templates are typically used automatically by the AI assistant when generating new plan artifacts based on framework rules (e.g., Rule 100, Phase 3 requires creating README, plan, status files).

## Template Metadata

All templates include metadata at the top of the file in YAML format. This metadata provides information about the template's purpose, version, etc.

## Contributing Templates

To contribute a new template:

1.  Use an existing template as a starting point.
2.  Ensure your template follows the established structure and includes metadata.
3.  Add your template to the appropriate directory (`plan-templates/`).
4.  Update this README.md if necessary.
5.  Ensure framework rules are updated if the template is required by a process step.
