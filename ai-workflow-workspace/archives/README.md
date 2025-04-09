# Archives

This directory contains archived implementation plans and outputs that are no longer actively developed but should be preserved for reference.

## Purpose

The archives directory provides a location for storing completed or deprecated implementation plans without cluttering the active plans directory. This helps maintain organization while preserving valuable historical information.

## When to Archive

Plans should be archived when they are:
- Fully completed and no longer actively referenced
- Superseded by newer implementations
- Deprecated or no longer relevant
- Historical but valuable for reference

## Archive Structure

Each archived plan maintains its original structure:

```
archives/
├── plan-archived-name-date/
│   ├── README.md
│   ├── implementation/
│   ├── artifacts/
│   └── etc...
```

## Archive Process

When archiving a plan:
1. Move the entire plan directory from `AI-workflow-v2/plans/` to `./`
2. Update the plan's status in its README.md to indicate it is archived
3. Update references in the plan registry to show the plan is archived
4. Consider adding an archive note in the plan's README explaining why it was archived

## Retrieving Archives

