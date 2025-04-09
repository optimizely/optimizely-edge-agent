**Action Required: Audit Local Data Models & Formulate API Questions**

To prepare for integration with the external team's API, you need to first thoroughly understand our relevant data models within the specified module/directory: `[USER: PROVIDE PATH TO TARGET MODULE/EXTENSION DIRECTORY]`. Perform a comprehensive audit using filesystem access.

**Audit Tasks:**

1.  **Identify Data Models/Collections:** Examine all files within the specified directory (and subdirectories) to identify data structures (e.g., Prisma models, TypeScript interfaces/types, classes) used for storing or representing data relevant to the integration feature.
2.  **Extract Key Fields:** For each significant model/structure identified, list its primary fields and their types.

**Question Formulation Task:**d

Based on your understanding of **our local models** from the audit and the general requirements of the integration feature, formulate a list of specific questions for the external team regarding their API. These questions should aim to clarify how their API data maps to or interacts with our structures. Include questions about:

*   **Data Structures:** "What is the exact structure (fields, types, nesting) of the data returned by your `[Specific Endpoint]`?" or "How does your `[Their Concept]` map to our `[Our Model Name]`?"
*   **Endpoints:** "Which specific API endpoint should we use to [achieve specific goal, e.g., fetch user profiles]?"
*   **Authentication/Authorization:** "What authentication method is required for this API?"
*   **Pagination:** "Does the `[List Endpoint]` support pagination? If so, what are the parameters (e.g., limit/offset, page/pageSize, cursor)?"
*   **Filtering & Sorting:** "Can we filter the results from `[List Endpoint]` by `[Specific Field, e.g., tenantId, status]`? How?" / "Is sorting supported?"
*   **Rate Limits:** "Are there any rate limits we should be aware of?"
*   **Error Handling:** "What are the common error codes/structures we should expect?"
*   *Add any other relevant questions based on the feature.*

**Output Expected:**

1.  **Audit Report:**
    *   "**Data Model Audit for `[Directory Path]`:**"
    *   List of identified models/collections/interfaces.
    *   For each, list key fields and types.
2.  **API Questions for External Team:**
    *   "**Questions for External API Team:**"
    *   Present the clearly formulated list of questions covering the points above.