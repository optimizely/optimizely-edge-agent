---
type: "documentation"
purpose: "onboarding-guide"
version: "2.1"
status: "Active"
description: "Primary entry point and onboarding guide for the AI Workflow Framework v2, providing quick start instructions and implementation request templates"
ai_instructions: "Present this document to new users as their first interaction with the framework; guide users through the structured request format; adapt explanations based on user experience level"
ai_usage_context: "Reference this document when a user is getting started with the framework or when they need guidance on creating an implementation request"
related_files: [
  "README.md", 
  "templates/prompt-templates/ai-workflow-startup-template.md",
  "templates/implementation-request-template.md", 
  "framework-rules/125-mode-selection.md",
  "ai-assistant/guides/working-with-ai.md",
  "framework-rules/225-production-safeguards.md",
  "framework-rules/400-checklist-enforcement.md",
  "docs/prompt-templates.md"
]
implementation_modes: [
  "Manual (@mode:manual) - Maximum oversight with step-by-step verification",
  "Semi-Automatic (@mode:semi) - Balanced approach with component-level verification",
  "Automatic (@mode:auto) - Rapid implementation with automated verification"
]
control_options: [
  "Scope Control (@scope-control:enable) - Strict enforcement of implementation boundaries",
  "Strict Refactoring (@strict-refactor) - Prevention of unauthorized optimizations",
  "Production Safeguards (@production-safeguards) - Additional protections for production environments",
  "Implementation Checklists (@400-checklist-enforcement) - Mandatory checklists for consistent implementation"
]
editable_sections: ["Quick Start Guide", "Implementation Request Format", "Example Scenarios", "Standard Prompts"]
tags: ["documentation", "getting-started", "quick-start", "onboarding", "workflow-entry", "implementation-requests"]
priority: "critical"
audience: {
  "primary": "both new users and AI assistants",
  "technical_level": "all levels",
  "roles": ["developers", "project managers", "ai assistants", "technical leads", "new framework users"]
}
dateCreated: "2025-03-19"
lastUpdated: "2025-04-30"
---

# 🚀 Getting Started with AI Workflow v2

Welcome to the AI Workflow Framework v2! This document provides a streamlined approach for requesting implementation plans from AI assistants, with enhanced tracking and scope control features.

## Quickest Way to Start

**Use our Startup Template**: The fastest way to get started is to use the [AI Workflow Framework Startup Template](templates/prompt-templates/ai-workflow-startup-template.md). This template:

- Has all framework rules pre-configured
- Provides a simple fill-in-the-blanks structure
- Requires minimal setup or framework knowledge
- Includes an example to follow

Simply copy the template, fill in your implementation details, and you're ready to go!

## Quick Start Guide

1. **Set Up the Framework**
   - Run `npm setup` to configure the framework with your Cursor IDE
   - This copies the framework rules to Cursor's rules directory and makes tools executable

2. **Choose Your Implementation Method**
   - **[RECOMMENDED] Use the Startup Template**: [AI Workflow Framework Startup Template](templates/prompt-templates/ai-workflow-startup-template.md)
   - **Manual Method**: Follow the implementation request format below

3. **Choose Your Implementation Mode**
   - **Manual Mode** (`@mode:manual`): Maximum oversight, step-by-step verification
   - **Semi-Automatic Mode** (`@mode:semi`): Balanced approach, component-level verification
   - **Automatic Mode** (`@mode:auto`): Rapid implementation, automated verification

4. **Select Additional Control Options**
   - **Scope Control** (`@scope-control:enable`): Strict enforcement of boundaries
   - **Implementation Checklists** (`@400-checklist-enforcement`): Mandatory verification checklists
   - **Strict Refactoring** (`@strict-refactor`): No unauthorized optimizations
   - **Production Safeguards** (`@production-safeguards`): Additional safety measures

5. **Use Standard Prompts**
   - Refer to the [Prompt Templates](docs/prompt-templates.md) for standard prompts
   - Use the proper syntax to invoke framework rules
   - Include checklist verification requirements

6. **Use the Implementation Request Format**
   - Define your implementation needs using the structured format below
   - Provide clear scope boundaries and requirements
   - Include relevant technical context

7. **Review and Approve the Implementation Plan**
   - The AI will generate a detailed implementation plan
   - Review scope boundaries and steps
   - Approve or request modifications

8. **Monitor Implementation Progress**
   - Track progress through standardized headers
   - Review verification checkpoints
   - Use state snapshots for visibility

## Standard Prompts

For quick reference, here are some standard prompts to use with the framework:

### Framework-Compliant Implementation Request

```
@mode:[mode] @scope-control:enable @400-checklist-enforcement
Please help me implement [feature/component] following the AI Workflow Framework.
Remember to complete all required checklists and provide verification statements.
```

### Plan Structure Creation Request

```
@500-plan-storage @400-checklist-enforcement
Create a proper plan structure for implementing [feature/component].
Follow the Plan Storage Framework and complete the Implementation Checklist.
```

### Enforcing Checklists

```
@400-checklist-enforcement
Before proceeding, please complete the [specific] Checklist and provide the verification statement.
```

For a complete list of prompt templates, see [docs/prompt-templates.md](docs/prompt-templates.md).

## Setting Up with Cursor IDE

To enable the framework within your Cursor IDE environment:

1. **Initial Setup**
   ```bash
   # Run the setup script to configure the framework with Cursor
   npm setup
   ```
   This command:
   - Makes framework tools executable
   - Copies framework rules to the Cursor rules directory (.cursor/rules)
   - Formats the rules for Cursor compatibility

2. **Updating the Framework**
   ```bash
   # Update the framework with the latest changes
   npm run update-framework
   ```
   Use this command periodically to sync your framework with the latest updates.

3. **Verifying Setup**
   After setup, the Cursor IDE will automatically recognize the framework rules.
   You can verify this by checking if the rules are accessible via AI prompts using
   the various control commands (e.g., `@mode:manual`, `@scope-control:enable`).

4. **Troubleshooting**
   If the framework isn't being recognized:
   - Ensure Cursor IDE is restarted after setup
   - Run `npm run copy-rules:verbose` to see detailed output
   - Check that the `.cursor/rules` directory exists and contains .mdc files

## Implementation Request Format

> **Note:** For a simpler approach, we highly recommend using the [AI Workflow Framework Startup Template](templates/prompt-templates/ai-workflow-startup-template.md) instead of manually creating your request.

If you prefer to create your implementation request manually, use this structured format:

```markdown
# Implementation Request: [Project/Feature Name]

## 1. Project Type
- [ ] Add feature to existing codebase
- [ ] Create new feature
- [ ] Create new application
- [ ] Other: [specify]

## 2. High-Level Objective
[1-2 sentence description of what you're trying to accomplish]

## 3. Key Requirements
- [Requirement 1]
- [Requirement 2]
- [Requirement 3]

## 4. Technical Context
- Target Codebase: [repository/application name or URL]
- Primary Technologies: [languages, frameworks, platforms]
- Integration Points: [systems/services this needs to work with]

## 5. Constraints & Boundaries
- Timeline Expectations: [urgency level or deadlines]
- Performance Requirements: [if applicable] 
- Scope Limitations: [specific boundaries to maintain]

## 6. Implementation Mode
- [ ] Manual (@mode:manual)
- [ ] Semi-Automatic (@mode:semi)
- [ ] Automatic (@mode:auto)

## 7. Additional Control Options
- [ ] Enable Scope Control (@scope-control:enable)
- [ ] Implementation Checklists (@400-checklist-enforcement)
- [ ] Strict Refactoring (@strict-refactor)
- [ ] Production Safeguards (@production-safeguards)

## 8. Additional Information
[Any other details that might be helpful]
```

## Example Implementation Request

Here's a complete example of how to request a feature implementation:

```markdown
# Implementation Request: User Authentication System

## 1. Project Type
- [x] Add feature to existing codebase

## 2. High-Level Objective
Add user authentication with social login options to our Node.js e-commerce application.

## 3. Key Requirements
- Support login with email/password
- Add "Login with Google" and "Login with Facebook" options
- Create secure session management
- Integrate with existing user profiles

## 4. Technical Context
- Target Codebase: e-commerce-platform
- Primary Technologies: Node.js, Express, MongoDB
- Integration Points: User profile service, product recommendation engine

## 5. Constraints & Boundaries
- Timeline Expectations: Medium priority, needed within 3 weeks
- Performance Requirements: Auth process must complete in <2 seconds
- Scope Limitations: Don't modify existing user profile structure

## 6. Implementation Mode
- [x] Semi-Automatic (@mode:semi)

## 7. Additional Control Options
- [x] Enable Scope Control (@scope-control:enable)
- [x] Implementation Checklists (@400-checklist-enforcement)
- [x] Strict Refactoring (@strict-refactor)
- [ ] Production Safeguards (@production-safeguards)

## 8. Additional Information
We already have a basic user table with profiles, but no authentication mechanism.
```

## Mandatory Implementation Checklists

To ensure consistent implementation, the framework now includes mandatory checklists:

1. **Rule Application Checklist** - Before beginning any work
2. **Path Correctness Checklist** - Before creating any files
3. **Implementation Checklist** - Before starting implementation coding
4. **Phase Gate Checklist** - At each phase transition

AIs must complete these checklists and provide verification statements at the appropriate stages. If a checklist is skipped, use this prompt:

```
I notice you haven't completed the required [specific] Checklist. According to Rule 400, this verification is mandatory. 
Please complete the checklist and provide the verification statement before proceeding.
```

## Framework Benefits

- **Enhanced Tracking**: Clear visibility into implementation progress
- **Strict Scope Control**: Prevention of unauthorized changes
- **Implementation Continuity**: Easy resumption of interrupted work
- **AI-Optimized Documentation**: Specialized guidance for AI assistants
- **Flexible Control**: Multiple implementation modes to match project needs
- **Production Safety**: Built-in safeguards for working with production data
- **Consistent Implementation**: Mandatory checklists ensure consistent quality
- **Temporary Files Management**: Structured approach to handling temporary artifacts with automated cleanup

## Advanced Usage

For more complex projects, consider providing:

- Links to relevant documentation or specifications
- Examples of similar implementations
- Mockups or wireframes (if applicable)
- Specific technical constraints or preferences

## Working with Temporary Files

When developing and testing new implementations:

1. **Use the `.temp/` directory** for all draft content and experimental work
2. **Include proper metadata** in temporary files for better organization
3. **Clean up regularly** using the provided utility (`tools/temp-cleanup.js`)
4. **Follow the temporary files guidelines** in [framework-rules/protection/temporary-files.md](framework-rules/protection/temporary-files.md)

Temporary files are excluded from version control, ensuring a clean separation between work-in-progress and finalized framework components.

## Next Steps

- **[RECOMMENDED]** Use the [AI Workflow Framework Startup Template](templates/prompt-templates/ai-workflow-startup-template.md) for your first implementation
- Read the [README.md](README.md) for a comprehensive overview of the framework
- Explore implementation modes in detail in [framework-rules/125-mode-selection.md](framework-rules/125-mode-selection.md)
- Review the AI-oriented documentation in the [ai-assistant](ai-assistant) directory
- Browse example plans in the [plans](plans) directory
- See standard prompts in [docs/prompt-templates.md](docs/prompt-templates.md) 