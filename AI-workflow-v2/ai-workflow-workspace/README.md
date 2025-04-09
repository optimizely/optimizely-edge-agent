# AI Workflow Workspace

This directory contains all user-generated content and implementation artifacts created using the AI Workflow Framework.

## Directory Structure

- **plans/** - Implementation plans created for specific projects
- **registry/** - Implementation tracking and plan registry
- **outputs/** - Generated outputs and artifacts from implementations
- **archives/** - Completed or archived implementations

## Purpose

The AI Workflow Workspace is separated from the framework code (located in `AI-workflow-v2/`) to create a clean separation between:

1. **Framework Code** (tools, templates, guidelines) - Can be updated without affecting user content
2. **User Content** (plans, outputs, registries) - Preserved during framework updates

This separation allows for easier framework updates while preserving all user-generated content.

## Usage

When creating new implementation plans or other content, store them in this workspace rather than within the framework directory.

## Framework Relationship

The AI Workflow Framework (`AI-workflow-v2/`) contains the tools, templates, and guidelines that interact with this workspace. The framework code is designed to locate and interact with content in this workspace automatically.

## Workspace Structure

This workspace contains your AI implementation plans and related content, separated from the framework code.

### Directories

- `plans/` - Your implementation plans
- `registry/` - Plan registry and implementation logs
- `examples/` - Example implementation plans
- `outputs/` - Generated outputs from implementations
- `archives/` - Completed or archived implementations
- `temp/` - Temporary files
- `templates/` - Custom templates for creating plans

## Date Handling

The AI Workflow Framework automatically uses your system's current date for all operations:

- When creating plans
- In metadata timestamps
- For implementation logs
- In generated file content

All dates are formatted consistently in YYYY-MM-DD format (e.g., 2024-03-19).

## Registry Management

The framework maintains two registry files in the `registry/` directory:

1. `plan-registry.md` - A table of all implementation plans in reverse chronological order
2. `implementation-log.md` - A log of all implementations and major activities

### Adding New Plans to Registry

When creating a new plan, add it to the top of the Active Plans table in `plan-registry.md`:

```markdown
| 🟡 | [plan-name-YYYY-MM-DD](AI-workflow-v2/plans/plan-name-YYYY-MM-DD) | @mode:mode | Brief description | 0% |
