---

**Optimizely Edge Agent: Comprehensive Architecture & Functionality Guide**

**Version:** Based on Beta Documentation Synthesis

**Purpose:** This guide provides a detailed architectural and functional overview of the Optimizely Edge Agent. It aims to equip engineers, architects, and AI systems with the necessary understanding to navigate the project's codebase and concepts effectively. It explains *what* the Edge Agent does, *how* it works, and *how* to configure it, serving as a foundational blueprint for understanding its capabilities.

---

**1. Introduction: What is Optimizely Edge Agent?**

Optimizely Edge Agent is a sophisticated, hybrid solution designed to integrate A/B testing and feature experimentation directly into the network edge, leveraging edge computing infrastructure (like Cloudflare Workers, Fastly Compute@Edge, etc.) and serverless architecture.

*   **Core Purpose:** To enable seamless, high-performance feature experimentation, A/B testing, and targeted content delivery across various platforms and architectures with minimal latency.
*   **Hybrid Approach:** It combines the lightweight decision-making capabilities typically found in client-side SDKs with the robust server-side functionality of the Optimizely Feature Experimentation Agent, optimized for edge environments.
*   **Environment:** It operates as a worker/function within Content Delivery Networks (CDNs), making decisions close to the end-user to minimize latency and reduce dependency on origin servers.
*   **Key Capabilities:** Provides comprehensive, ready-to-deploy functionality including automated datafile management, user ID generation/management, persistent cookie handling for sticky bucketing, fine-grained caching control, and interaction with backend Optimizely services.

---

**2. Core Concepts**

Understanding these concepts is fundamental to grasping the Edge Agent's purpose and design:

*   **Edge Computing:** Performing computation (like A/B test decisions) on servers located geographically closer to the end-user (the "edge") rather than on a centralized origin server. This significantly reduces latency for decision-making and content delivery.
*   **Serverless Architecture:** The agent runs in environments where infrastructure management (scaling, patching, availability) is handled automatically by the cloud provider (e.g., Cloudflare). Developers deploy and manage code without provisioning or managing underlying servers.
*   **A/B Testing at the Edge:** Making decisions about which variation of an experiment a user sees directly within the CDN worker. This allows for faster delivery of tested content variations and reduces computational load on origin servers.
*   **Datafile Management:** The agent handles fetching, caching, and updating the Optimizely datafile (a JSON file containing all experiment configurations, audiences, and feature flags) automatically. It can leverage Key-Value (KV) stores for persistence and faster access.
*   **Sticky Bucketing:** Ensuring a user consistently sees the same experiment variation across multiple sessions or requests. This is crucial for experiment validity and user experience, typically achieved using persistent cookies or KV store-based user profiles.

---

**3. Operating Modes: Edge vs. Agent**

The Optimizely Edge Agent operates in two distinct modes based on the HTTP request method it receives, adapting its functionality accordingly:

*   **A. Edge Mode (Triggered by `GET` Requests):**
    *   **Functionality:** Acts like an intelligent, enhanced edge-side SDK integrated directly into the content delivery path. It makes decisions *before* fetching content or forwarding requests to the origin.
    *   **Key Tasks:**
        *   Matching incoming request URLs against experiment configurations (specifically the `cdnExperimentURL` within `cdnVariationSettings`).
        *   Making bucketing decisions (determining which variation a user sees) based on user context (visitor ID, attributes), user profiles (from cookie or KV store), and datafile rules.
        *   Fetching variant-specific content from a designated URL (`cdnResponseURL`) based on the decision, *or* forwarding the original request (potentially modified) to the origin server (`forwardRequestToOrigin`).
        *   Managing the caching of variation-specific content at the edge (`cacheKey`, `cacheRequestToOrigin`, `cacheTTL`).
        *   Managing cookie serialization/deserialization for user ID persistence and sticky bucketing.
        *   Generating unique user IDs if one is not provided or found.
        *   Embedding decision information into response headers/cookies (`setResponseHeaders`, `setResponseCookies`) or request headers/cookies (`setRequestHeaders`, `setRequestCookies`) for downstream use or stickiness.
        *   Performing automated reconciliation of stored bucketing decisions (in cookies or KV store) against the active experiments in the current datafile, removing stale decisions.
    *   **Configuration:** Primarily driven by the `cdnVariationSettings` Feature Experimentation flag variable (detailed below), but also influenced by request headers and query parameters.

*   **B. Agent Mode (Triggered by `POST` Requests):**
    *   **Functionality:** Acts as a serverless microservice endpoint, providing a remote interface to the Optimizely Feature Experimentation SDK. Allows applications (backend services, other microservices) to get decisions or track events without needing to embed and manage the SDK themselves.
    *   **Key Tasks:**
        *   Receiving POST requests, typically containing user context (visitor ID, attributes), event data, or specific decision requests in the JSON body, headers, or query parameters.
        *   Interacting with the initialized Optimizely SDK instance (via `OptimizelyProvider`) to perform core SDK actions like:
            *   `decide`: Get flag decisions for a given user context.
            *   `track`: Send user events to the Optimizely results backend.
        *   Returning decision results (e.g., enabled flags, variables) or tracking confirmation in the HTTP response body, usually as JSON.
    *   **Configuration:** Driven by request headers, query parameters, and importantly, the JSON body payload of the POST request. **It does *not* use `cdnVariationSettings`.**

---

**4. Architecture Overview**

The agent is designed with a modular architecture for flexibility and maintainability within an edge worker environment:

*   **`OptimizelyProvider`:** The core interface encapsulating interactions with the Optimizely Feature Experimentation SDK. Responsibilities include:
    *   SDK initialization using the provided `sdkKey`.
    *   Fetching and managing the Optimizely datafile.
    *   Executing decision logic (`decide` calls).
    *   Dispatching tracking events (`track` calls).
*   **`CoreLogic`:** Acts as the central processing unit or request orchestrator. It determines the operating mode (Edge/Agent), coordinates interactions between the incoming request, `OptimizelyProvider`, caching mechanisms, and other modules to generate the final response.
*   **`CDN Adapters`:** (Conceptual/Implementation Detail) Platform-specific modules that adapt the core logic to the nuances of the target CDN environment (e.g., Cloudflare Workers API for KV access, caching, request/response handling).
*   **`RequestConfig`:** A crucial module responsible for parsing, consolidating, and managing configuration settings provided via HTTP Headers, URL Query Parameters, and the JSON Body (for POST requests). It applies a defined priority order and makes the final configuration accessible throughout the agent.
*   **`OptimizelyHelper`:** Provides essential utility functions supporting core operations, such as:
    *   Cookie serialization and deserialization for sticky bucketing.
    *   User profile management, including interaction with KV stores if configured.
    *   Helper functions for decision reconciliation or flag processing.
*   **`cookieOptions`:** A configuration module defining the default settings (path, expiry, security flags like `Secure`, `HttpOnly`, `SameSite`) for cookies created by the agent.

---

**5. Key Functionality Deep Dive: `cdnVariationSettings` (Edge Mode - GET Requests)**

This configuration object, defined as a **variable within an Optimizely Feature Experimentation flag**, is **essential** for controlling how the Edge Agent handles **GET requests** on a **per-variation** basis within an experiment. It enables fine-grained control over content fetching, caching, and delivery strategies directly from the Optimizely UI, minimizing the need for worker code redeployments for experiment adjustments.

*   **Purpose:** To instruct the Edge Agent on the specific actions to take (fetch content, cache, forward request) when a user is bucketed into a particular variation of an experiment triggered by a matching GET request URL.
*   **How it Works:**
    1.  A `GET` request arrives at the edge worker.
    2.  The worker checks if the request URL matches the `cdnExperimentURL` defined in *any* variation's `cdnVariationSettings` for active experiments.
    3.  If a match occurs, the agent uses Optimizely logic (user ID, attributes, datafile rules, sticky bucketing info) to determine the specific variation the user is assigned to.
    4.  The agent then reads the *specific* `cdnVariationSettings` object associated with that *chosen* variation.
    5.  It executes the instructions defined within that variation's `cdnVariationSettings` properties.

*   **`cdnVariationSettings` Properties:**

    *   **`cdnExperimentURL` (String):** The URL pattern that the incoming GET request must match to trigger this experiment's evaluation.
        *   *Example:* `"https://www.example.com/products"`
    *   **`cdnResponseURL` (String):** The URL from which the Edge Agent should **fetch the content** for *this specific variation*. Critically, the end-user's browser URL remains the original `cdnExperimentURL`. This enables serving entirely different pages or content components without client-side redirects.
        *   *Example:* `"https://origin.example.com/variants/products-new-layout.html"`
    *   **`cacheKey` (String):** Defines how the fetched content for this variation is cached at the edge.
        *   If set to the literal string `"VARIATION_KEY"`, a unique cache key is automatically constructed, typically combining the `cdnExperimentURL`, the experiment's flag key, and the variation key (e.g., `https://www.example.com/products_product-layout-test_new-layout`). This ensures each variation's content is cached independently.
        *   If set to any other string value, that specific string is used directly as the cache key, offering flexibility for custom caching strategies.
    *   **`forwardRequestToOrigin` (String: `"true"` or `"false"`):** Controls whether the original request (potentially modified with decision headers/cookies via `setRequestHeaders`/`setRequestCookies`) is forwarded to the origin server *after* the edge decision is made.
        *   `"true"`: Forward the request. Useful for testing backend changes driven by the variation or when the origin needs the decision context for rendering.
        *   `"false"`: Do *not* forward the request. The response is served directly from the edge (either newly fetched content via `cdnResponseURL` or from the edge cache).
    *   **`cacheRequestToOrigin` (String: `"true"` or `"false"`):** Determines whether the content fetched (either from `cdnResponseURL` or from the origin if `forwardRequestToOrigin` was true) should be cached at the edge.
        *   `"true"`: Enable caching for this variation's content at the edge, using the `cacheKey` and `cacheTTL`.
        *   `"false"`: Do not cache the fetched content at the edge.
    *   **`cacheTTL` (String representing number):** Specifies the cache Time-To-Live for content cached at the edge for this variation (when `cacheRequestToOrigin` is `"true"`). The value represents the duration in milliseconds (e.g., `"60000"` for 60 seconds).
    *   **`isControlVariation` (String: `"true"` or `"false"`):** Identifies if this specific variation represents the baseline or "control" group in the A/B test. This is crucial for accurate analysis of experiment results.

*   **Benefits Tied to `cdnVariationSettings`:**
    *   **Streamlined A/B Test Deployment:** Initiate, modify, or stop experiments (adjusting targeting, content sources, caching) by changing flag variables in the Optimizely UI, *without* needing to redeploy the edge worker code.
    *   **Automated Content Caching Management:** Simplifies complex caching scenarios by allowing per-variation caching rules directly at the edge, optimizing performance and reducing origin load.
    *   **Rapid Iteration:** Faster feedback loops as changes can be pushed live quickly through the Optimizely platform.

---

**6. Configuration**

The Edge Agent's behavior is highly configurable to adapt to various use cases and environments. Settings can be provided via multiple methods, processed in a specific order of precedence:

*   **Configuration Methods & Priority:**
    1.  **HTTP Headers:** Highest priority. Settings passed in request headers (e.g., `X-Optimizely-Sdk-Key`, `X-Optimizely-Visitor-Id`). Applicable in both Edge (GET) and Agent (POST) modes. Overrides settings from lower priority sources.
    2.  **URL Query Parameters:** Medium priority. Settings passed in the URL's query string (e.g., `?sdkKey=ABC&visitorId=123`). Used if a setting is not found in Headers. Applicable in both Edge (GET) and Agent (POST) modes.
    3.  **JSON Request Body:** Lowest priority. Settings passed as a JSON object in the request body. **Applicable only in Agent mode (POST requests)**. Used if a setting is not found in Headers or Query Parameters.

*   **`requestConfig.js` Module:** This central module handles the extraction and parsing of configuration settings from all sources according to the defined priority order. It consolidates them into a single `requestConfig` object, making settings consistently accessible throughout the agent's codebase. It also supports the inclusion and parsing of custom configuration settings passed via these methods.

*   **Comprehensive Configuration Settings Matrix:**

| Setting                   | Description                                                                          | Headers | Query Params | JSON Body (POST Only) | Notes                                                                 |
| :------------------------ | :----------------------------------------------------------------------------------- | :------ | :----------- | :-------------------- | :-------------------------------------------------------------------- |
| `sdkKey`                  | **Required.** The datafile SDK key for the Optimizely project.                       | Yes     | Yes          | Yes                   | Identifies your Optimizely project environment.                       |
| `visitorId`               | The visitor ID for the request. Essential for consistent bucketing.                  | Yes     | Yes          | Yes                   | If not provided, one might be generated.                              |
| `attributes`              | Custom user attributes (key-value pairs) for audience targeting.                     | Yes     | No           | Yes                   | JSON format expected in Header/Body.                                  |
| `flagKeys`                | Specific flag key(s) to evaluate. Limits decisions to only these flags.              | No      | Yes          | Yes                   | Query param often comma-separated; JSON Body expects an array.         |
| `decideAll`               | Evaluate *all* flag keys in the datafile (overrides `flagKeys` filtering).             | No      | Yes          | Yes                   | Boolean.                                                              |
| `enabledFlagsOnly`        | Return decisions only for flags that are currently enabled ('on').                   | No      | Yes          | Yes                   | Boolean.                                                              |
| `includeReasons`          | Include debugging reasons for flag decisions in the response.                        | No      | Yes          | Yes                   | Boolean. Useful for debugging decision logic.                         |
| `excludeVariables`        | Exclude feature variables from the decision response.                                | Yes     | Yes          | Yes                   | Boolean. Can reduce payload size.                                     |
| `disableDecisionEvent`    | Prevent the agent from automatically sending a decision event to Optimizely.         | No      | Yes          | Yes                   | Boolean. Use if you handle impression tracking separately.            |
| `ignoreUserProfileService`| Ignore any configured user profile service for bucketing decisions.                  | No      | Yes          | Yes                   | Boolean. Useful for testing without stickiness.                       |
| `forcedDecisions`         | Force specific decisions for certain flag keys, bypassing normal logic.              | No      | No           | Yes                   | JSON format {flagKey: {variationKey: '...'}}. Primarily for testing. |
| `eventKey`                | The event key to track when making a `track` call (Agent Mode mainly).               | Yes     | Yes          | Yes                   | For custom event tracking via POST.                                   |
| `eventTags`               | Tags (key-value pairs) associated with a tracked event.                              | Yes     | No           | Yes                   | JSON format expected in Header/Body. Adds metadata to events.         |
| `overrideCache`           | Force bypass of any CDN or internal caching mechanisms (for content/datafile).       | Yes     | Yes          | Yes                   | Boolean. Useful for development/debugging cache issues.               |
| `overrideVisitorId`       | Force generation of a *new* visitor ID for every request.                            | Yes     | Yes          | Yes                   | Boolean. Breaks stickiness; strictly for testing.                     |
| `datafileAccessToken`     | Access token required if the Optimizely datafile endpoint is secured.                | Yes     | No           | No                    |                                                                       |
| `enableOptimizelyHeader`  | (Likely legacy/specific) Toggles Optimizely functionality. Check implementation.     | Yes     | No           | No                    | Boolean.                                                              |
| `decideOptions`           | Pass-through options directly to the Optimizely SDK's `decide` method.               | Yes     | No           | No                    | JSON format. Allows fine-grained SDK control (e.g., includeReasons).  |
| `trimmedDecisions`        | (Likely specific) Indicates if decision results should be trimmed/simplified.        | Yes     | Yes          | Yes                   | Boolean. Check implementation details.                                |
| `enableFlagsFromKV`       | Use the list of flag keys stored in the KV store to filter evaluations.              | Yes     | Yes          | Yes                   | Boolean. Requires KV setup & flag key list population.                |
| `datafileFromKV`          | Load the Optimizely datafile directly from the KV store instead of CDN/fetch.        | Yes     | Yes          | Yes                   | Boolean. Requires KV setup & datafile sync mechanism (e.g., webhook). |
| `setResponseCookies`      | Set cookies in the response containing bucketing decisions/visitorId (for stickiness). | Yes     | Yes          | Yes                   | Boolean. Crucial for Edge Mode stickiness via cookies.                |
| `setResponseHeaders`      | Set headers in the response containing bucketing decisions.                          | Yes     | Yes          | Yes                   | Boolean.                                                              |
| `setRequestHeaders`       | Set headers in the *outgoing* request (e.g., to origin) with decisions.            | Yes     | Yes          | Yes                   | Boolean. Used with `forwardRequestToOrigin`.                          |
| `setRequestCookies`       | Set cookies in the *outgoing* request (e.g., to origin) with decisions.            | Yes     | Yes          | Yes                   | Boolean. Used with `forwardRequestToOrigin`.                          |
| `enableRespMetadataHeader`| Include internal agent processing metadata in a response header.                   | Yes     | No           | No                    | Boolean. For debugging agent performance/flow.                        |
| `enableResponseMetadata`  | Include decision metadata (like reasons if enabled) in the response body/payload.    | Yes     | Yes          | Yes                   | Boolean.                                                              |
| `serverMode`              | Explicitly sets the mode (Edge or Agent). Rarely needed; usually inferred by method. | No      | Yes          | No                    | String ('Edge' or 'Agent').                                           |

---

**7. Key-Value (KV) Store Integration (Optional, e.g., Cloudflare KV)**

The Edge Agent can optionally leverage CDN Key-Value (KV) stores for significant performance enhancements and robust state management:

*   **Benefits:**
    *   **Reduced Latency:** Accessing datafiles or user profiles from a co-located KV store is typically much faster than fetching from external CDNs or databases.
    *   **Optimized Performance:** Filtering flag evaluations based on keys stored in KV reduces unnecessary computation.
    *   **Robust Stickiness:** Provides a persistent, shared storage mechanism for user profiles across edge locations.
*   **Uses:**
    *   **Datafile Storage (`datafileFromKV=true`):** Store the entire Optimizely datafile in the KV store (default namespace: `OPTLY_HYBRID_AGENT_KV`, keyed by SDK Key). This avoids repeated fetches from the Optimizely CDN. Requires a mechanism (like webhooks + API) to keep the KV version synchronized with Optimizely project updates.
    *   **Flag Key Filtering (`enableFlagsFromKV=true`):** Store a specific list of `flagKeys` (e.g., as a comma-delimited string) in the KV store (default namespace: `OPTLY_HYBRID_AGENT_KV`, default key: `optly_flagKeys`). If enabled, the agent only evaluates experiments corresponding to these keys, significantly speeding up decisions in projects with many flags. Requires managing this list via the API.
    *   **User Profile Storage (Sticky Bucketing):** Use a separate KV namespace (default: `OPTLY_HYBRID_AGENT_UPS_KV`) to store user profile information (mapping `visitorId` to experiment/variation decisions). This provides a reliable backend for the User Profile Service, ensuring consistent bucketing across requests and edge locations.
*   **Management API:** The agent typically implements internal REST API endpoints (e.g., `/v1/api/datafiles/:sdkKey`, `/v1/api/flag_keys`) to allow external systems (like a webhook receiver) to update the datafile or the list of active flag keys stored in the KV namespaces.
*   **Webhook Integration:** Can be configured to listen to Optimizely webhooks (e.g., `project.datafile.updated`). When a webhook notification is received, the agent can trigger its internal API to fetch the latest datafile and update it in the KV store automatically.

---

**8. Cookie Management**

Cookies play a vital role, primarily for maintaining state across requests, especially for sticky bucketing in Edge Mode.

*   **Purpose:** To store the `visitorId` and potentially serialized bucketing decisions on the user's browser, ensuring consistency across sessions.
*   **`cookieOptions.js`:** This module defines the default attributes applied when the agent sets cookies.
*   **Default Options:** These defaults prioritize security and broad applicability:
    *   `path`: `/` (Cookie is sent for all paths within the domain).
    *   `expires`: `new Date(Date.now() + 86400e3 * 365)` (Expires 365 days from creation).
    *   `maxAge`: `86400 * 365` (Maximum age in seconds, matching `expires`).
    *   `domain`: `.expedge.com` (Example - **should be configured for the relevant domain**; leading dot allows use on subdomains).
    *   `secure`: `true` (Cookie is only sent over HTTPS connections).
    *   `httpOnly`: `true` (Cookie is not accessible via client-side JavaScript, mitigating XSS risks).
    *   `sameSite`: `none` (Cookie is sent on both same-site and cross-site requests. **Requires `secure: true`**). Other options (`Lax`, `Strict`) might be applicable depending on the use case.
*   **Overridable:** While these are the defaults, the implementation might allow overriding specific options during cookie setting if necessary, though often controlled via configuration flags like `setResponseCookies`.

---

**9. Summary of Benefits**

Implementing Optimizely Edge Agent provides significant advantages:

*   **Enhanced Performance:** Dramatically reduced latency for experimentation decisions and potentially content delivery by operating at the edge.
*   **Improved Scalability:** Seamlessly handles varying traffic loads by leveraging the inherent scalability of CDN serverless platforms.
*   **Increased Cost Efficiency:** Reduces load and bandwidth costs on origin servers by handling decisions and caching closer to the user.
*   **Streamlined Experimentation Workflow:** Simplifies deployment and management of A/B tests and feature flags, especially using `cdnVariationSettings` for dynamic configuration without code changes.
*   **Greater Reliability & Uptime:** Decentralized decision-making and edge caching reduce single points of failure compared to relying solely on origin infrastructure.
*   **Consistent User Experience:** Robust sticky bucketing mechanisms (cookies, KV store) ensure users aren't unexpectedly switched between variations.
*   **Architectural Flexibility:** Supports experimentation for both user-facing content (GET requests) and backend/API interactions (POST requests).

---

**10. Note for Users of this Guide**

This document provides a comprehensive, foundational understanding of the Optimizely Edge Agent's architecture, configuration, and core functionality based on the synthesized information from provided documentation. It is intended to equip engineers, architects, and AI agents with the essential knowledge needed to effectively navigate the project's codebase, understand its purpose, and analyze its behavior. For specific implementation details, debugging, or advanced customization, detailed analysis of the source code alongside this guide is highly recommended.

---