**Optimizely Edge Agent: Functionality & Architecture Guide (Baseline Version)**

**1. Introduction: What is Optimizely Edge Agent?**

Optimizely Edge Agent is a sophisticated solution designed to integrate A/B testing and feature experimentation directly into the network edge, leveraging edge computing infrastructure (like Cloudflare Workers, Fastly Compute@Edge, etc.) and serverless architecture.

* **Core Purpose:** To enable seamless, high-performance feature experimentation, A/B testing, and targeted content delivery across various platforms and architectures.
* **Hybrid Approach:** It combines the lightweight decision-making capabilities typically found in client-side SDKs (like Optimizely's Feature Experimentation SDKs) with the robust server-side functionality of the Optimizely Feature Experimentation Agent.
* **Environment:** It operates as a worker/function within Content Delivery Networks (CDNs), making decisions close to the end-user to minimize latency and dependency on origin servers.
* **Key Capabilities:** Includes datafile management, user ID generation, cookie management for sticky bucketing, caching control, and interaction with backend Optimizely services.

**2. Core Concepts**

* **Edge Computing:** Performing computation (like A/B test decisions) on servers located geographically closer to the end-user (the "edge") rather than on a centralized origin server. This reduces latency.
* **Serverless Architecture:** The agent runs in environments where infrastructure management (scaling, patching) is handled automatically by the provider (e.g., Cloudflare). Developers deploy code without managing underlying servers.
* **A/B Testing at the Edge:** Making decisions about which variation of an experiment a user sees directly within the CDN worker. This allows for faster delivery of tested content and reduces load on origin servers.
* **Datafile Management:** The agent handles fetching, caching, and updating the Optimizely datafile (which contains experiment configurations) automatically, potentially using Key-Value (KV) stores for persistence and speed.
* **Sticky Bucketing:** Ensuring a user consistently sees the same experiment variation across multiple sessions or requests using cookies or KV store-based user profiles.

**3. Operating Modes: Edge vs. Agent**

The Optimizely Edge Agent operates in two distinct modes based on the HTTP request method it receives:

* **A. Edge Mode (GET Requests):**
    * **Functionality:** Acts like an enhanced edge SDK. It makes decisions *before* fetching content or forwarding requests.
    * **Key Tasks:**
        * Matching incoming URLs against experiment configurations (`cdnExperimentURL`).
        * Making bucketing decisions (which variation a user sees) based on user profiles (cookie or KV store) and datafile rules.
        * Fetching variant-specific content (`cdnResponseURL`) or forwarding the request to the origin (`forwardRequestToOrigin`).
        * Managing caching of variation content at the edge (`cacheKey`, `cacheRequestToOrigin`, `cacheTTL`).
        * Managing cookie serialization for sticky bucketing.
        * Generating user IDs if needed.
        * Embedding decision information into headers/cookies for downstream use (`setResponseHeaders`, etc.).
        * Automated reconciliation of stored decisions against active experiments in the current datafile.
    * **Configuration:** Primarily driven by the `cdnVariationSettings` flag variable within Optimizely Feature Experimentation, but also influenced by request headers and query parameters.

* **B. Agent Mode (POST Requests):**
    * **Functionality:** Acts as a serverless interface to the Optimizely Feature Experimentation SDK. Allows applications to get decisions or track events remotely without embedding the full SDK.
    * **Key Tasks:**
        * Receiving requests (often containing user attributes, event data, etc. in the JSON body).
        * Interacting with the initialized Optimizely SDK (via `OptimizelyProvider`) to perform actions like:
            * `decide` (get flag decisions)
            * `track` (send events to Optimizely)
        * Returning decision results or tracking confirmation in the response.
    * **Configuration:** Driven by request headers, query parameters, and importantly, the JSON body payload of the POST request. It does *not* use `cdnVariationSettings`.

**4. Architecture Overview**

The agent is designed with a modular architecture to handle requests efficiently within an edge worker environment:

* **`OptimizelyProvider`:** The core interface with the Optimizely Feature Experimentation SDK. It handles:
    * SDK initialization (using the `sdkKey`).
    * Making decisions (`decide` calls).
    * Dispatching tracking events.
    * Managing the datafile.
* **`CoreLogic`:** The central processing unit. It orchestrates the request handling flow, coordinating between the incoming request, the `OptimizelyProvider`, and other modules based on the request type (GET/POST) and configuration.
* **`CDN Adapters`:** (Conceptual) Modules designed to tailor functionality for specific CDN provider environments (e.g., Cloudflare Workers specific APIs), ensuring compatibility and optimal performance.
* **`RequestConfig`:** A crucial module that parses and centralizes configuration settings from various sources (Headers, Query Parameters, JSON Body) based on a defined priority order. It makes these settings easily accessible throughout the agent's code.
* **`OptimizelyHelper`:** Provides utility functions supporting core logic, such as:
    * Cookie serialization/deserialization for sticky bucketing.
    * User profile management (interacting with KV store if configured).
    * Potentially helper functions related to datafile updates or flag processing.
* **`cookieOptions`:** Defines default settings for cookies created by the agent (path, expiry, security flags).

**5. Key Functionality Deep Dive: `cdnVariationSettings` (Edge Mode - GET Requests)**

This Feature Experimentation **flag variable** is **essential** for controlling how the Edge Agent handles **GET requests** on a **per-variation** basis. It allows fine-grained control over content fetching, caching, and delivery without requiring worker redeployment for configuration changes.

* **Purpose:** To define how the edge worker should behave when a user is bucketed into a specific variation of an experiment triggered by a matching GET request URL.
* **How it Works:** When a GET request matches a `cdnExperimentURL` defined in a variation's `cdnVariationSettings`, the agent evaluates the properties within that specific `cdnVariationSettings` object to determine its next actions.

* **Properties:**
    * `cdnExperimentURL` (String): The URL pattern the incoming GET request must match to trigger this experiment's evaluation.
    * `cdnResponseURL` (String): The URL from which the content for *this specific variation* should be fetched. This allows serving content from a different URL while the user's browser still shows the original `cdnExperimentURL`. Crucial for testing different page versions without redirects.
    * `cacheKey` (String): Defines how the response for this variation is cached.
        * If set to the literal string `"VARIATION_KEY"`, a unique cache key is constructed using the `cdnExperimentURL` + flag key + variation key (e.g., `https://example.com/page_hero-experiment_variation-A`). This caches each variation separately.
        * If set to any other string, that string is used directly as the cache key.
    * `forwardRequestToOrigin` (Boolean String: `"true"`/`"false"`):
        * `"true"`: Forward the original request (potentially modified with decision headers/cookies) to the origin server after the edge decision is made. Useful if the origin needs to perform further processing based on the variation.
        * `"false"`: Serve the response directly from the edge (either fetched via `cdnResponseURL` or from cache) without contacting the origin.
    * `cacheRequestToOrigin` (Boolean String: `"true"`/`"false"`):
        * `"true"`: Cache the content fetched from the `cdnResponseURL` (or the origin if `forwardRequestToOrigin` is true) at the edge.
        * `"false"`: Do not cache the fetched content at the edge.
    * `cacheTTL` (String representing number): The Time-To-Live (in milliseconds or seconds, as interpreted by the implementation - documentation example uses 60000ms) for the cached content specified by `cacheRequestToOrigin`.
    * `isControlVariation` (Boolean String: `"true"`/`"false"`): Identifies if this variation represents the baseline or "control" group in the experiment, used for accurate results analysis.

* **Benefits Tied to `cdnVariationSettings`:**
    * **Streamlined Deployment:** Change experiment targeting, content sources, and caching rules by modifying the flag variable in the Optimizely UI, *without* redeploying the edge worker code.
    * **Automated Caching Management:** Enables variation-specific caching strategies directly at the edge, improving performance and reducing origin load.

**6. Configuration**

The agent's behavior is highly configurable through multiple methods, applied with a specific priority:

* **Configuration Methods:**
    1.  **HTTP Headers:** Settings passed in the request headers (e.g., `X-Optimizely-Sdk-Key`). Highest priority.
    2.  **Query Parameters:** Settings passed in the URL's query string (e.g., `?visitorId=user123`). Medium priority.
    3.  **JSON Body:** Settings passed as a JSON object in the request body ( **Agent Mode - POST requests ONLY**). Lowest priority.
* **Priority Order:** Headers > Query Parameters > JSON Body. A setting found in a higher priority source overrides the same setting from a lower priority source.
* **`requestConfig.js` Module:** This module centralizes the process of reading configuration from these sources according to the priority rules and makes them available throughout the agent via a `requestConfig` object. It also supports adding custom configuration settings.

* **Configuration Matrix:**

| Setting                   | Description                                                                          | Headers | Query Params | JSON Body (POST Only) |
| :------------------------ | :----------------------------------------------------------------------------------- | :------ | :----------- | :-------------------- |
| `sdkKey`                  | The datafile SDK key for the Optimizely project.                                     | Yes     | Yes          | Yes                   |
| `overrideCache`           | Indicates whether to override the cache.                                             | Yes     | Yes          | Yes                   |
| `overrideVisitorId`       | Indicates whether to override the visitor ID. (Generates new ID per request).        | Yes     | Yes          | Yes                   |
| `attributes`              | Custom attributes and audience conditions for the visitor.                             | Yes     | No           | Yes                   |
| `eventTags`               | Event tags for tracking and reporting.                                               | Yes     | No           | Yes                   |
| `datafileAccessToken`     | Access token for retrieving the datafile (if needed).                                | Yes     | No           | No                    |
| `enableOptimizelyHeader`  | Indicates whether to enable Optimizely Experimentation (likely legacy/specific use).   | Yes     | No           | No                    |
| `decideOptions`           | Options for the Optimizely SDK `decide` function (e.g., `disableDecisionEvent`).     | Yes     | No           | No                    |
| `visitorId`               | The visitor ID for the request.                                                      | Yes     | Yes          | Yes                   |
| `trimmedDecisions`        | Indicates whether to trim decisions (likely internal optimization).                    | Yes     | Yes          | Yes                   |
| `enableFlagsFromKV`       | Indicates whether to enable filtering feature flags based on keys from KV store.      | Yes     | No           | Yes                   |
| `eventKey`                | The event key for tracking events.                                                   | Yes     | Yes          | Yes                   |
| `datafileFromKV`          | Indicates whether to retrieve the datafile from the KV store instead of CDN.         | Yes     | No           | Yes                   |
| `enableRespMetadataHeader`| Indicates whether to enable response metadata header (likely internal/debug).        | Yes     | No           | No                    |
| `setResponseCookies`      | Indicates whether to set response cookies with bucketing decisions.                    | Yes     | Yes          | Yes                   |
| `setResponseHeaders`      | Indicates whether to set response headers with bucketing decisions.                    | Yes     | Yes          | Yes                   |
| `setRequestHeaders`       | Indicates whether to set request headers (for origin forwarding) with decisions.     | Yes     | Yes          | Yes                   |
| `setRequestCookies`       | Indicates whether to set request cookies (for origin forwarding) with decisions.     | Yes     | Yes          | Yes                   |
| `serverMode`              | The server mode for the agent (Edge or Agent) - likely inferred, but maybe override. | No      | Yes          | No                    |
| `flagKeys`                | Specific flag keys to evaluate (comma-separated in query, array in JSON).            | No      | Yes          | Yes                   |
| `enableResponseMetadata`  | Indicates whether to enable response metadata (likely internal/debug).               | Yes     | Yes          | Yes                   |
| `decideAll`               | Indicates whether to evaluate all flag keys (overrides `flagKeys` filtering).          | No      | Yes          | Yes                   |
| `disableDecisionEvent`    | Indicates whether to disable sending the decision event for `decide` calls.          | No      | Yes          | Yes                   |
| `enabledFlagsOnly`        | Indicates whether to return only enabled flag keys in decisions.                     | No      | Yes          | Yes                   |
| `includeReasons`          | Indicates whether to include reasons for flag decisions in the response.             | No      | Yes          | Yes                   |
| `ignoreUserProfileService`| Indicates whether to ignore the user profile service for decisions.                  | No      | Yes          | Yes                   |
| `excludeVariables`        | Indicates whether to exclude variables from the decision response.                   | Yes     | Yes          | Yes                   |
| `forcedDecisions`         | Forced decisions for specific flag keys (for testing/debugging).                     | No      | No           | Yes                   |

**7. Key-Value (KV) Store Integration (Optional, e.g., Cloudflare KV)**

The agent can leverage KV stores for enhanced performance and functionality:

* **Datafile Storage (`datafileFromKV`):** Store the Optimizely datafile directly in the KV store to reduce latency compared to fetching from the Optimizely CDN on each worker instantiation.
* **Flag Key Filtering (`enableFlagsFromKV`):** Store a specific list of `flagKeys` (comma-delimited) in the KV store (default key: `optly_flagKeys`). If enabled, the agent only evaluates experiments corresponding to these keys, even if the datafile contains more. This optimizes performance.
* **User Profile Storage (Sticky Bucketing):** Use a separate KV namespace (default: `OPTLY_HYBRID_AGENT_UPS_KV`) to store user profile information (mapping `visitorId` to decisions). This provides a robust mechanism for sticky bucketing across requests.
* **Management API:** Includes built-in REST API endpoints (e.g., `/v1/api/datafiles/:sdkKey`, `/v1/api/flag_keys`) to manage the datafile and flag keys stored in the KV store.
* **Webhook Integration:** Can be configured with Optimizely webhooks to automatically trigger updates to the datafile stored in the KV store whenever the project's datafile changes in Optimizely.

**8. Cookie Management**

* **Purpose:** Primarily used for "sticky bucketing" in Edge Mode (GET requests) to ensure users consistently see the same variation.
* **`cookieOptions.js`:** Defines default settings for cookies set by the agent.
* **Default Options:**
    * `path`: `/` (available across the domain)
    * `expires`: 365 days from creation
    * `maxAge`: 365 days (in seconds)
    * `domain`: `.expedge.com` (Example - should be configured for the relevant domain, leading dot for subdomains)
    * `secure`: `true` (Only sent over HTTPS)
    * `httpOnly`: `true` (Not accessible via client-side JavaScript)
    * `sameSite`: `none` (Sent on cross-site requests; requires `secure: true`)
* **Overridable:** These defaults can typically be overridden when cookies are set if specific behavior is needed.

**9. Summary of Benefits**

* **Performance:** Reduced latency via edge decisions and edge caching.
* **Scalability:** Leverages scalable serverless infrastructure.
* **Cost Efficiency:** Reduced origin server load and bandwidth usage.
* **Streamlined Experimentation:** Easier deployment and management of A/B tests, especially with `cdnVariationSettings`.
* **Reliability:** Decentralized decisions and caching improve uptime.
* **Flexibility:** Supports both simple edge decisions (GET) and complex remote interactions (POST).

**10. Note for Users of this Guide**

This document provides a foundational understanding of the Optimizely Edge Agent's baseline architecture, configuration, and functionality as described in the source material. It is intended to equip engineers, architects, and AI agents with the core knowledge needed to navigate the codebase, understand its purpose, and analyze its behavior. For implementation specifics, detailed code analysis alongside this guide is recommended.

---