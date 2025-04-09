# Quickstart: Requesting AI Workflow Tasks

This guide outlines the essential information needed to request a new task using the AI Workflow Framework.

## Core Request Information

When requesting a new implementation or feature using the framework, please provide the following details:

1.  **Intent:** Clearly state you want to use the **AI Workflow Framework**.
2.  **Goal/Objective:** Briefly describe the overall goal of the task (1-2 sentences).
3.  **Key Requirements:** List the specific functional or non-functional requirements.
4.  **Technical Context:** Specify the relevant environment, platform, languages, frameworks, etc.
5.  **Scope Boundaries:**
    *   **In-Scope:** List the specific files, components, or areas to be modified.
    *   **Out-of-Scope:** List specific files, components, or areas that **must not** be modified.
6.  **Implementation Mode:** Select the desired mode:
    *   `@mode:manual` (for high-risk, production, or complex tasks requiring maximum oversight)
    *   `@mode:semi` (for standard development tasks with balanced oversight)
    *   `@mode:auto` (for low-risk, simple tasks where speed is prioritized)

## Example Request Prompt

```
I'd like to use the AI Workflow Framework for a new task.

Goal: Add a simple health check endpoint `/healthz` to the backend API.
Requirements:
- Endpoint should return HTTP 200 OK with body `{"status": "ok"}`.
- No database or external service checks needed for this version.
Context: Node.js backend using Express.
Scope:
- In-Scope: Modify `server.js` or create a new `healthCheck.js` route file.
- Out-of-Scope: Frontend code, database schema, authentication logic.
Mode: @mode:auto
```

Providing these details allows the AI assistant to properly initiate the framework's Planning Phase (Rule 100) and create an appropriate implementation plan. 