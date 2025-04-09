**Subject: Generate API Integration Guide**

**To the AI Agent:**

Assume the role of a **Principal Software Architect/Engineer** familiar with this project. Your task is to generate a comprehensive **API Integration Guide**.

**Target Audience & Purpose (User MUST Specify):**

*   **Who is this guide for?** (e.g., "Internal frontend team", "External partner service", "Mobile app developers") -> `[USER: SPECIFY TARGET AUDIENCE]`
*   **What is their primary goal/integration scenario?** (e.g., "Displaying user profiles", "Submitting orders", "Synchronizing inventory data", "General API usage") -> `[USER: SPECIFY INTEGRATION GOAL/SCENARIO]`

**Input Documents & Analysis (Mandatory):**

You MUST use the following to generate the guide accurately:

1.  **System Architecture Document:** Located at: `[USER: PROVIDE PATH TO System Architecture / TDD]`
2.  **Project README:** Located at: `[USER: PROVIDE PATH TO docs/README.md or docs-platform/README.md]`
3.  **Database Schema:** Located at: `[USER: PROVIDE PATH TO prisma/schema.prisma or equivalent]`
4.  **Your Codebase Analysis:** Use your filesystem access to actively explore the codebase (esp. API controllers/routes (`src/controllers`, `app/routes/api`, etc.), authentication middleware, service layers, DTOs/interfaces (`src/dto`, `src/interfaces`), relevant data models) to verify details, extract practical examples, and identify endpoints relevant to the specified **Integration Goal/Scenario**.

**Guide Requirements:**

The guide must be clear, practical, and tailored (where possible) to the specified **Target Audience** and **Integration Goal**. It must cover:

*   **Authentication:** How consumers should authenticate requests to the API (e.g., JWT flow, API keys, obtaining credentials, required headers). Reference specific auth modules/middleware identified during analysis.
*   **Relevant API Endpoints:** Document the essential endpoints required to achieve the specified **Integration Goal**. For each relevant endpoint:
    *   HTTP Method and Path (e.g., `GET /api/v1/users/{id}`)
    *   Description of purpose.
    *   Required Headers (e.g., `Authorization`, `Content-Type`).
    *   Path/Query Parameters (with types/descriptions).
    *   Request Body Structure (if applicable, using actual DTOs/types identified in code, provide JSON examples).
    *   Successful Response Structure (using actual DTOs/types identified in code, provide JSON examples).
*   **Relevant Data Models:** Explain the structure of key data models the consumer will interact with (referencing the schema file and providing simplified TypeScript interfaces/examples based on actual code). Focus on models relevant to the **Integration Goal**.
*   **Rate Limiting:** Mention any applicable rate limits identified in the code/configuration.
*   **Error Handling:** Describe common error responses (status codes, standard error DTO/structure identified in code).
*   **Base URL:** Specify the base URL(s) for accessing the API (e.g., for development, staging, production environments, if known from configuration).
*   **Best Practices/Tips:** Any specific advice for interacting with this API (e.g., handling specific fields, required sequences of calls).

**Output Expected:**

Generate the full content of the **API Integration Guide** in Markdown format directly in your response. Structure it logically with clear headings. Ensure information is consistent between provided documents and your direct codebase analysis. Prioritize accuracy, practical examples derived from the code, and clarity for the specified **Target Audience** and **Integration Goal**.
