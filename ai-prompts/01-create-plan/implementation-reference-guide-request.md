# AI Prompt: Generate Implementation Reference Guide for [Optimizely Edge Agent]

## Purpose
You are tasked with creating a comprehensive **"Implementation Reference Guide"** for the recently completed **Optimizely Edge Agent** Cloudflare worker implementation located in "/". This document should serve as a detailed, standardized record of the system's architecture, components, interactions, testing, deployment, and more, acting as a reliable reference for future maintenance, enhancements, or onboarding. The guide must be saved as **"docs/implementation-reference-guide-2025-04-03.md"** in the component folder where all related documents are stored, ensuring persistence and accessibility.

---

## Instructions for Creating the Implementation Reference Guide

### 1. Document Structure
The Implementation Reference Guide must follow this standardized structure, ensuring consistency across all projects. Use the chat context and codebase analysis to populate each section with accurate, project-specific details.

#### 1.1 System Overview
- Provide a high-level description of **[SYSTEM_NAME]**, its purpose, and how it fits into the broader application or system.
- Example: "The Enterprise Notifications System provides real-time and persistent notifications across the application," or "The Cloudflare Content Core enables document ingestion, processing, and assembly via a serverless workflow."

#### 1.2 Architecture
- Describe the system's overall architecture, including key components and their relationships.
- Include **two diagrams**:
  - **Mermaid Diagram**: A detailed, technical visualization of the architecture (e.g., components, data flow, integrations).
  - **ASCII Diagram**: A simpler, text-based representation for quick reference in any editor.
- Example: Show how the Ingress Worker, Workflow Worker, and Assembly Worker interact in Cloudflare Content Core, or how backend services and WebSocket gateways connect in the Enterprise Notifications System.

#### 1.3 File Structure
- Create a table listing all files created or modified during the implementation, grouped by category (e.g., Backend, Frontend, Workers, Testing, Documentation).
- Columns:
  - **File**: File name.
  - **Path**: Full path in the codebase.
  - **Purpose**: Brief description of the file’s role.
- Example: Include `notifications.module.ts` (backend) from Enterprise Notifications and `index.ts` (Producer Worker) from Cloudflare Queue.

#### 1.4 Component Details
- Provide detailed descriptions of each major component in the system.
- For each component, include:
  - **Role**: What it does (e.g., "Handles job submission" for Producer Worker).
  - **Key Functions/Methods**: Highlight critical logic or endpoints (e.g., `/enqueue` in Producer Worker).
  - **Interactions**: How it communicates with other components or systems (e.g., "Uses NotificationService to create notifications").
- Cover all relevant areas (e.g., backend, frontend, workers, database).

#### 1.5 Data Flow
- Describe how data moves through the system, from input to output.
- Include a step-by-step explanation referencing specific components and functions.
- Optionally, include a diagram (Mermaid or ASCII) to visualize the flow.
- Example: "Notification creation flow: JobsService → NotificationService → Redis → WebSocket clients" (Enterprise Notifications).

#### 1.6 Integration Points
- Detail how **[SYSTEM_NAME]** integrates with other modules, systems, or external services.
- List specific changes made to existing files (e.g., added imports to `app.module.ts`) and new interactions (e.g., "Consumer Worker reports to backend API").
- Example: Include JobsService integration from Enterprise Notifications and Notification System integration from Cloudflare Queue.

#### 1.7 Configuration Details
- Document environment variables, queue settings, or other configurations required for the system.
- Example: List `CLOUDFLARE_API_KEY` and queue settings from Cloudflare Queue, or WebSocket settings from Enterprise Notifications.

#### 1.8 Testing
- Describe the testing approach, including:
  - Types of tests (e.g., unit, integration, end-to-end).
  - Key test cases or scenarios.
  - Test files created (include paths and purposes).
- Example: Include integration tests from Cloudflare Queue (`queue-integration.test.js`) and mock environment setup from Cloudflare Content Core.

#### 1.9 Deployment
- Provide details on how the system is deployed, including:
  - Deployment steps or scripts (e.g., `wrangler publish` commands).
  - Environment-specific configurations (e.g., development vs. production).
  - Verification steps (e.g., health checks).
- Example: Include deployment workflow from Cloudflare Queue or staging deployment from Enterprise Notifications.

#### 1.10 Known Issues and Limitations
- List any unresolved issues, bugs, or constraints encountered during implementation.
- Include their impact and any workarounds or planned fixes.
- Example: "Authentication failures due to mismatched API keys" from Cloudflare Queue.

#### 1.11 Next Steps
- Suggest future enhancements, optimizations, or maintenance tasks.
- Prioritize based on importance or urgency.
- Example: "Add email integration" (Enterprise Notifications) or "Performance testing" (Cloudflare Queue).

#### 1.12 Extensibility Points (Optional)
- Highlight areas designed for future expansion (e.g., "Supports additional delivery channels" from Enterprise Notifications).
- Include only if applicable to the project.

#### 1.13 Best Practices and Lessons Learned (Optional)
- Document key insights or strategies from the implementation (e.g., "Testing Cloudflare Workers requires comprehensive mocks" from Cloudflare Content Core).
- Include only if significant lessons were learned.

---

### 2. Additional Guidance
- **Consistency**: Follow the exact structure above for every guide, using the same section headings and order.
- **Comprehensiveness**: Include all relevant details from the chat context and codebase, merging common elements (e.g., file structure) and unique elements (e.g., job types from Cloudflare Content Core) from the examples.
- **Clarity**: Write for someone new to the project, avoiding jargon unless explained, and using examples where possible.
- **Flexibility**: Add project-specific sections (e.g., "Job Types" from Cloudflare Content Core) if necessary, placing them after "Next Steps" but before optional sections.
- **Diagrams**: Always include both Mermaid and ASCII diagrams for Architecture and optionally for Data Flow, ensuring technical accuracy and readability.

---

### 3. Mandatory Instructions (CRITICAL - FOLLOW WITHOUT FAILURE)
- **Filesystem Usage**:
  - Save the "implementation-reference-guide.md" file to the local filesystem in the component folder where related documents are stored (e.g., `docs/components/[SYSTEM_NAME]/` or as specified in the chat).
  - Update the file in real-time as you work to ensure persistence.
- **Codebase Reference**:
  - Base the guide on the actual codebase and chat context, not assumptions.
  - Reference specific files, functions, or lines of code where necessary for clarity (e.g., "See `notification.service.ts:32`").
- **Diagrams**:
  - Use Mermaid syntax for detailed diagrams (e.g., `graph TD` for flowcharts).
  - Use ASCII art for simpler, text-based diagrams (e.g., using `+---+` boxes and arrows).
- **Chat Context**:
  - Use details from the current conversation to inform the content, ensuring relevance to the specific implementation.
- **Status & Progress Updates**:
  - You must update all implementation plan documentation that was used to track status and progress, including readme.md, plan-registry.md, plan.md, status.md, and the implementation-log.md documents.
---

### 4. Placeholder Guide
- **[SYSTEM_NAME]**: Replace with the system or feature name (e.g., "Enterprise Notifications System").
- **[SYSTEM_PURPOSE]**: Define its purpose (e.g., "deliver real-time updates to users").
- **[SYSTEM_FUNCTIONALITY]**: Specify deliverables (e.g., "notification creation, delivery, and management").

---

### 5. Obsolete Files and Modules
  - Once you have performed these comprehensive audit identify all files that are no longer being used referenced and are obsolete or deprecated since they're not referenced by any module imported and could in theory be removed. Make a comprehensive list and the rationale for it and included as a section at the end of the report.

## Final Notes
- **Start by Reviewing**: Analyze the chat context and codebase to ensure the guide reflects the completed implementation accurately.
- **Merge Best Practices**: Combine overlapping sections (e.g., File Structure) and include unique sections (e.g., Testing Infrastructure from Cloudflare Content Core) to create a complete guide.
- **Focus on Practicality**: Prioritize details that help future developers understand, maintain, or extend the system (e.g., integration points, deployment steps).
- **Iterate as Needed**: Update the guide continuously during generation to capture all insights, ensuring it remains a reliable resource.
s learned). 