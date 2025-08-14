# Optimizely Edge Agent v2: Interaction Guide

_Last Updated: Based on analysis up to 2025-04-24 and recent remediation plans._

This guide is intended to help engineers and automated agents understand how to correctly interact with the Optimizely Edge Agent v2, covering operational modes, parameter passing, key endpoints, and troubleshooting common issues.

## 1. Core Concepts: Edge Mode vs. Agent Mode

The Optimizely Edge Agent v2 operates in two primary modes, typically differentiated by the HTTP request method:

*   **Edge Mode (Primarily GET Requests):**
    *   **Purpose:** Designed for dynamic content delivery and decision-making at the CDN edge. When a user requests a URL managed by the Edge Agent in this mode, the agent can make Optimizely decisions to alter the response, fetch content from different origins, or modify caching behavior based on flag variations (using `cdnVariationSettings`).
    *   **Interaction:** Users/clients make standard GET requests to URLs. The Edge Agent, configured for that path, intercepts the request and processes it. Testing this usually involves setting up feature flags with `cdnVariationSettings` in Optimizely and then accessing the public URL.
    *   **Key Parameters:** `sdkKey` (often from environment or path configuration), `userId` (from cookie or header), and user attributes (from cookies or headers) influence the decision.
    *   **Response:** Typically an HTML page, JSON data, or other content, potentially modified or sourced based on the Optimizely decision.

*   **Agent Mode (Primarily POST Requests to `/api/...` Endpoints):**
    *   **Purpose:** Provides an SDK-like interface for server-side applications or other services to get decisions, track events, and manage Optimizely configurations.
    *   **Interaction:** Clients make explicit POST requests to specific API endpoints (e.g., `/api/decide`, `/api/track`).
    *   **Key Parameters:** Explicitly provided in the request (headers, query parameters, or request body), including `sdkKey`, `userId`, `flagKey`(s), attributes, event details, etc.
    *   **Response:** Typically a JSON object containing decision results, tracking confirmation, or requested data.

**The error "Unsupported route. POST requests must use an API endpoint" indicates a POST request was made to a path not recognized by the `ApiRouter` (e.g., POST to `/decide` instead of `/api/decide`).**

## 2. General Request Handling & Agent Activation

For the Edge Agent v2 to process any Optimizely-related logic (either Edge Mode or Agent Mode API calls), it generally needs to be activated. Activation depends on:

1.  **`X-Optimizely-Enable-FEX: true` Header:** This header must be present and set to `true`.
    *   _Remediation Note:_ Task T9 of the `gemini-gap-issues-remediation` plan and RPV2-6 of `restore-v1-config-parity-v2` plan addressed and confirmed the handling of this header.
    *   **To disable Optimizely processing (e.g., for passthrough or testing non-Optimizely behavior), set this header to `X-Optimizely-Enable-FEX: false`.**
2.  **Valid `sdkKey`:** A valid Optimizely SDK key must be provided (unless `X-Optimizely-Enable-FEX` is explicitly `false`). The agent will not operate without it if FEX is considered enabled.

**If you receive "The Optimizely Edge Agent is disabled," it usually means `X-Optimizely-Enable-FEX` was not `true` OR a valid `sdkKey` was missing when FEX was considered enabled.**

## 3. Agent Mode: Interacting with API Endpoints (e.g., `/api/decide`)

These endpoints are typically called using the **POST** method with `Content-Type: application/json` if sending a JSON body.

### 3.1. `/api/decide` Endpoint

This is used to get a decision for a single flag.

*   **Method:** POST
*   **Path:** `/api/decide`

**Mandatory Parameters:**

*   **`sdkKey`**: Your Optimizely SDK Key.
    *   Sources: Header (`X-Optimizely-SDK-Key`), Query Parameter (`sdkKey`), Request Body (`sdkKey`).
*   **`userId`**: The ID of the user for bucketing.
    *   Sources: Header (`X-Optimizely-Visitor-Id`), Query Parameter (`userId`), Request Body (`userId`).
*   **`flagKey`**: The key of the feature flag for which you want a decision.
    *   Sources: Header (`X-Optimizely-Flag-Key`), Query Parameter (`flagKey`), Request Body (`flagKey`).
    *   **The error "flag key parameter is required" means this was not provided or not found by the `ConfigurationService`.**

**Optional Parameters (can be provided via Headers, Query Parameters, or Request Body, with Body preferred for complex objects like `attributes` and `decideOptions` in POST requests):**

*   **`attributes`**: A JSON object of user attributes.
    *   Header: `X-Optimizely-Attributes` (URL-encoded JSON string)
    *   Query: `attributes` (URL-encoded JSON string)
    *   Body: `attributes` (JSON object)
*   **`decideOptions`**: An array of Optimizely Decide Options strings. These influence how the decision is made and what information is returned. Common options include:
    *   `"DISABLE_DECISION_EVENT"`: Prevents the decision from automatically triggering an impression event.
    *   `"EXCLUDE_VARIABLES"`: Excludes flag variable values from the decision result.
    *   `"INCLUDE_REASONS"`: Includes debugging reasons for the decision outcome.
    *   `"IGNORE_USER_PROFILE_SERVICE"`: Skips reading from or writing to the User Profile Service (if configured) for this decision.
    *   `"SKIP_USER_PROFILE_SERVICE"`: (Often an alias or similar to `IGNORE_USER_PROFILE_SERVICE`)
    *   Sources:
        *   Header: `X-Optimizely-Decide-Options` (URL-encoded JSON string array, e.g., `["INCLUDE_REASONS","DISABLE_DECISION_EVENT"]`)
        *   Query: `decideOptions` (URL-encoded JSON string array)
        *   Body: `decideOptions` (JSON array)

*   **Other Configuration Flags (typically booleans, can influence processing or response):**
    *   These can often be set via headers (e.g., `X-Optimizely-Trimmed-Decisions: true`), query parameters (e.g., `trimmedDecisions=true`), or in the request body.
    *   `trimmedDecisions`: If true, returns a more minimal decision response. (Default: usually `false`)
    *   `disableDecisionEvent`: (Can also be a top-level flag equivalent to putting it in `decideOptions`). If true, suppresses the dispatch of a decision event (impression).
    *   `excludeVariables`: (Can also be a top-level flag). If true, variable values are excluded from the decision result.
    *   `includeReasons`: (Can also be a top-level flag). If true, includes debugging reasons.
    *   `skipUserProfileService` / `ignoreUserProfileService`: (Can also be a top-level flag). If true, User Profile Service is bypassed for this request.
    *   `setResponseHeaders`: If true, adds Optimizely decision information to response headers. (Default: `true`)
    *   `setResponseCookies`: If true, sets Optimizely cookies for visitor ID and decisions. (Default: `true`)
    *   `enableResponseMetadata`: If true, includes detailed metadata about the request processing in the response. (Default: `false`)

*   **Client Identification (Optional, for diagnostics/logging):**
    *   `clientEngine`: Name of the client making the request (e.g., "edge-agent-node-sdk").
        *   Header: `X-Optimizely-Client-Engine`
        *   Query: `clientEngine`
        *   Body: `clientEngine`
    *   `clientVersion`: Version of the client.
        *   Header: `X-Optimizely-Client-Version`
        *   Query: `clientVersion`
        *   Body: `clientVersion`

**Parameter Precedence:** The agent resolves parameters in this order (first found wins):
1.  HTTP Headers
2.  URL Query Parameters
3.  Request Body (for POST/PUT)

**Example `curl` for `/api/decide` (with more options):**

```bash
curl -X POST \
  http://localhost:8787/api/decide \
  -H 'Content-Type: application/json' \
  -H 'X-Optimizely-Enable-FEX: true' \
  -H 'X-Optimizely-SDK-Key: YOUR_SDK_KEY' \
  -H 'X-Optimizely-Client-Engine: curl-test-suite' \
  -H 'X-Optimizely-Client-Version: 1.0.0' \
  -d '{
    "userId": "user123",
    "flagKey": "my_awesome_feature",
    "attributes": {
      "plan_type": "premium",
      "is_logged_in": true
    },
    "decideOptions": [
      "INCLUDE_REASONS",
      "DISABLE_DECISION_EVENT",
      "EXCLUDE_VARIABLES"
    ],
    "trimmedDecisions": true,
    "setResponseCookies": false
  }'
```

**Other Decision Endpoints:**

*   `/api/decide-all`: Get decisions for all active flags. Accepts `sdkKey`, `userId`, `attributes`, `decideOptions`, and other relevant global flags.
*   `/api/decide-for-keys`: Get decisions for a specified list of flag keys. Accepts `sdkKey`, `userId`, `attributes`, `decideOptions`, other global flags, and requires a `flagKeys` (JSON array of strings) in the request body.


### 3.2. Other API Endpoints

Consult `src-v2/services/implementations/ApiRouter.ts` for a full list, but common ones include:
*   `/api/track`: For tracking events (POST).
*   `/api/datafile`: For managing datafiles (GET/POST).
*   `/api/flagkeys`: For managing flag keys (GET/POST).

## 4. Edge Mode Parameter Passing (GET Requests)

When a GET request is made to a URL handled by Edge Mode:

*   **`sdkKey`:** Usually configured at the CDN/environment level or derived from the request path/host by the CDN adapter. It's less common to pass this per-request as a query parameter for public-facing URLs but might be possible for testing.
*   **`userId`:** Typically derived from a cookie (e.g., `optly_visitor_id`) or specific headers. The `CookieService` in v2 handles this.
*   **`attributes`:** Can be derived from cookies or specific headers.

The primary dynamic control in Edge Mode comes from `cdnVariationSettings` associated with a decided flag variation, which then dictates how the agent processes the request (e.g., which origin to fetch from). This was a key piece fixed by Task T1 of the `gemini-gap-issues-remediation` plan.

## 5. Debug Endpoint (`/api/debug`)

This endpoint helps you understand how the agent is interpreting your request parameters and its configuration.

*   **Method:** POST (recommended, to allow sending a body for overriding/testing parameters) or GET.
*   **Path:** `/api/debug`
*   **Functionality:** Returns a JSON response detailing the configuration the agent has resolved for the request, including all parameters, their sources, and any validation issues.
*   **Usage:** Send parameters just like you would for `/api/decide` (e.g., `sdkKey`, `attributes`, `X-Optimizely-Enable-FEX`). The response will show you what the `ConfigurationService` "sees."

**If you get "unsupported route" for the debug endpoint, ensure you are using `/api/debug` and check the HTTP method (try POST).**

## 6. Troubleshooting Recap

*   **"Unsupported route. POST requests must use an API endpoint"**:
    *   You likely POSTed to a base path (e.g., `/decide` instead of `/api/decide`).
    *   Ensure your POST requests target a valid path defined in `ApiRouter.ts` (e.g., `/api/decide`, `/api/track`, `/api/debug`).
*   **"The Optimizely Edge Agent is disabled"**:
    *   Missing `X-Optimizely-Enable-FEX: true` header, or it was set to `false`.
    *   Missing or invalid `sdkKey` (from header, query, or body) when `X-Optimizely-Enable-FEX` was not explicitly `false`.
*   **"/api/decide" returns "flag key parameter is required"**:
    *   `flagKey` was not provided in headers (`X-Optimizely-Flag-Key`), query (`flagKey`), or body (`flagKey`).
    *   Ensure the parameter name and value are correct and sent according to precedence rules.
*   **FEX Enablement Issues / Still getting disabled errors:**
    *   Double-check the exact spelling and value of the `X-Optimizely-Enable-FEX: true` header.
    *   Verify the `sdkKey` is valid and correctly passed. Use the (once accessible) `/api/debug` endpoint to see how the agent perceives your SDK key.
*   **KV User Profile Service & Sticky Bucketing Verification:**
    *   Once you can successfully call `/api/decide`, make multiple requests for the same `userId` and `flagKey` (with a flag that has multiple variations).
    *   If KV User Profile Service is working (Task T2 of remediation plan was DONE), you should consistently get the same variation decision for that user, as the decision should be stored in and retrieved from the KV store.
    *   Check response headers/cookies for any Optimizely-specific identifiers that might indicate the decision source if the debug endpoint or detailed logging provides this.

## 7. Further References

*   **`src-v2/docs/configuration-options.md`**: Details on many configuration parameters and their sources.
*   **`documentation/v1-v2-feature-validation-guide.md`**: For understanding v1 features and their v2 counterparts.
*   **`src-v2/services/implementations/ApiRouter.ts`**: Source of truth for defined API routes.
*   **`src-v2/services/implementations/ConfigurationService.ts`**: Source of truth for how parameters are parsed and validated.

This guide should provide a clearer path for the other AI agent to successfully test the Optimizely Edge Agent v2.
