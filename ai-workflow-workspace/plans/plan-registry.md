---
type: "registry"
purpose: "plan-tracking"
version: "1.0"
status: "Active"
description: "Registry of all implementation plans"
ai_instructions: "This file tracks all plans in the AI Workflow Framework. Add new plans at the top of the table."
dateCreated: "2025-03-19"
lastUpdated: "2025-03-19"
---

# AI Workflow Implementation Plan Registry

This registry tracks all implementation plans in reverse chronological order (newest plans at the top).

## Active Plans

| Status | Plan ID | Mode | Description | Progress |
|:---:|:---|:---|:---|:---:|
| 🟡 | [plan-test-workspace-templates-2025-03-19](AI-workflow-v2/plans/plan-test-workspace-templates-2025-03-19) | @mode:manual | Test of workspace templates | 0% |
| 🟢 | [plan-esm-migration-2025-05-20](AI-workflow-v2/plans/plan-esm-migration-2025-05-20) | @mode:manual | Migrate framework to ESM modules | 100% |

## Example Plans 

| Status | Plan ID | Mode | Description |
|:---:|:---|:---|:---|
| 🟢 | [auto-example-2025-03-17](AI-workflow-v2/ai-workflow-workspace/plans/examples/auto-example-2025-03-17) | @mode:auto | Example of automatic mode plan |
| 🟢 | [semi-auto-example-2025-03-16](AI-workflow-v2/ai-workflow-workspace/plans/examples/semi-auto-example-2025-03-16) | @mode:semi | Example of semi-automatic mode plan |
| 🟢 | [manual-example-2025-03-15](AI-workflow-v2/ai-workflow-workspace/plans/examples/manual-example-2025-03-15) | @mode:manual | Example of manual mode plan |

## Status Legend

- 🟢 Complete - Implementation finished
- 🔵 Review - Implementation ready for review
- 🟠 In Progress - Implementation in progress
- 🟡 Planning - Plan created but not started
- ⚫ Archived - Plan no longer relevant
- ⚠️ Blocked - Implementation blocked

## How to Add a New Plan

When creating a new plan, add it to the top of the Active Plans table with:

```markdown
| 🟡 | [plan-name-YYYY-MM-DD](AI-workflow-v2/plans/plan-name-YYYY-MM-DD) | @mode:mode | Brief description | 0% |
```

