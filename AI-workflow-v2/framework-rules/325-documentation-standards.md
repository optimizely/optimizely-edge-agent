---
description: Standard documentation requirements and metadata schema for all framework components
alwaysApply: true
ai_instructions: "Follow these standards for all documentation. Ensure completeness, accuracy, clarity, consistency, structure, and accessibility. Include required metadata, follow file-type specific requirements, and use standard formatting. Adjust detail based on mode."
---

# DOCUMENTATION STANDARDS

All files, plans, and implementation artifacts should follow these documentation standards for maintainability, knowledge sharing, and verification.

## Core Documentation Principles

┌────────────────────────────────────────────────────┐
│ DOCUMENTATION PRINCIPLES                           │
├────────────────────────────────────────────────────┤
│ 1. COMPLETENESS   - Covers all necessary aspects.  │
│ 2. ACCURACY       - Content is correct and current.│
│ 3. CLARITY        - Easy to understand.            │
│ 4. CONSISTENCY    - Uniform style and terminology. │
│ 5. STRUCTURE      - Logically organized content.   │
│ 6. ACCESSIBILITY  - Easy to locate and navigate.   │
└────────────────────────────────────────────────────┘

## Metadata Schema Requirements

All framework files should include YAML frontmatter adhering to the defined schema.

### Common File Metadata Schema (Illustrative Example)

```yaml
# metadata_schema.yaml (Reference: AI-workflow-v2/references/schemas/metadata_schema.yaml)
version: "1.0"
metadata_types:
  common:
    required:
      - name: "type" # file type (rule, plan, component, etc.)
      - name: "purpose" # specific purpose ID
      - name: "category" # framework area (Core, Protection, etc.)
      - name: "version" # semantic version (e.g., 1.0.0)
      - name: "status" # Active, Draft, Deprecated
      - name: "description" # concise summary
      - name: "dateCreated" # YYYY-MM-DD
      - name: "lastUpdated" # YYYY-MM-DD
    optional: # Varies by type
      - name: "ai_instructions" # For rules
      - name: "sourceRules" # For rules
      # ... other type-specific fields
```
*Note: Refer to the full `metadata_schema.yaml` for complete details and type-specific fields.*

### Example File Metadata Application (Rule)

```yaml
---
type: "rule"
purpose: "component_protection"
category: "Protection"
version: "1.2.0"
status: "Active"
description: "Integrated component protection system..."
dateCreated: "2025-03-15"
lastUpdated: "2025-10-28"
ai_instructions: "Apply this rule whenever working with protected components..."
sourceRules: ["275-component-boundary-protection", "325-component-snapshot-verification"]
alwaysApply: false
applicablePhases: ["Planning", "Implementation", "Verification"]
---
```

## Documentation Requirements By File Type

Specific content requirements vary by file type.

### 1. Framework Rules (`type: rule`)
*   YAML frontmatter (including `ai_instructions`, `applicablePhases`, etc.)
*   Title (H1) & Mandatory Warning
*   Purpose/Principles Statement
*   Structured sections with clear H2/H3 headings
*   Code blocks for examples, checklists, statements
*   Mode-specific requirements (if applicable)
*   Verification/Application details

### 2. Implementation Plans (`type: plan`)
*   YAML frontmatter (including `planId`, `implementationMode`, etc.)
*   Title & Description
*   Scope Definition (In/Out)
*   Mode Declaration (@mode:...)
*   Task Breakdown / Phases
*   Verification Approach
*   Human Checkpoint Plan
*   Risk Assessment

### 3. Component Implementation Files (`type: component`)
*   File header comment (Purpose, Author, Date)
*   YAML frontmatter (if applicable, e.g., for framework components)
*   Component Description/Overview
*   Usage Examples / API Documentation
*   Implementation Notes (logic, design choices)
*   Known Limitations

### 4. Status Tracking Files (`type: tracking`, e.g., `status.md`)
*   Current Phase & Progress %
*   Recent Activity Log (Sequentially Numbered, e.g., [Step N])
*   Next Steps / Pending Tasks
*   Blockers / Issues Log
*   Decision Log (Timestamped)
*   Human Checkpoint Records

## Documentation Format Standards

### Markdown Formatting
*   Use standard Markdown syntax (Headers, Lists, Code Blocks, Tables, etc.).
*   Use ATX-style headers (`# H1`, `## H2`, `### H3`).
*   Use fenced code blocks with language identifiers (e.g., ```yaml, ```markdown).
*   Use emphasis (`**bold**`, `*italic*`, `` `code` ``) appropriately.

### Visual Elements
*   Use ASCII boxes for critical information, principles, statements.
    ```
    ┌───────────────────────────────────┐
    │ BOXED ELEMENTS FOR EMPHASIS       │
    └───────────────────────────────────┘
    ```
*   Use diagrams (ASCII or linked images) for workflows or complex structures.
*   Maintain consistent visual hierarchy and spacing.

## Required Documentation Sections (General)

While specific sections depend on file type, common elements include:

### 1. Overview / Purpose
*   What is this file/component/plan for?
*   What problem does it solve or what process does it define?
*   High-level summary.

### 2. Details / Implementation / Configuration
*   The core content explaining the "how".
*   Configuration options, specific steps, rules, code logic.
*   Design choices and rationale (if applicable).

### 3. Usage / Examples
*   How to use the component or apply the rule/plan.
*   Concrete examples, scenarios, code snippets.

### 4. Verification / Testing
*   How is the correctness/quality of this ensured?
*   Relevant checklists, testing strategies, quality standards.

## Documentation Verification Checklist

Use this checklist before finalizing any documentation artifact:

```
┌────────────────────────────────────────────────────┐
│ DOCUMENTATION VERIFICATION CHECKLIST                │
├────────────────────────────────────────────────────┤
│ METADATA & STRUCTURE:                              │
│ □ Required metadata present and accurate (YAML)?   │
│ □ Follows required file type structure?            │
│ □ Required sections included?                      │
│ □ Format standards followed (Markdown, Visuals)?   │
│                                                     │
│ CORE PRINCIPLES:                                   │
│ □ Completeness: Covers all necessary info?         │
│ □ Accuracy: Content factually correct & current?   │
│ □ Clarity: Easy to understand? Language precise?   │
│ □ Consistency: Style/terms match related docs?     │
│ □ Structure: Logically organized? Easy to follow?  │
│ □ Accessibility: Easy to find? Links working?      │
└────────────────────────────────────────────────────┘
```

## Mode-Specific Requirements

Refer to **Rule 125 (Mode Implementation Standards), Section 5 (Context Management Standards)** for mode-specific requirements regarding documentation detail, depth, and examples.

## Documentation Standards Verification

Use the standard verification statement format from Rule 100, with:

```
I have applied the Documentation Standards (325) requirements following the @mode:[mode] standards, verified all necessary elements, and ensured compliance with the framework.
```
This documentation standard is MANDATORY and MUST be followed for all files created or modified within the framework. 