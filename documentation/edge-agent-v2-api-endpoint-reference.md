# Optimizely Edge Agent v2: API Endpoint Reference

_Last Updated: Based on code analysis of `ApiRouter.ts` and `ConfigurationService.ts` as of 2025-04-24._

This document provides a comprehensive reference for the API endpoints available in the Optimizely Edge Agent v2. It details supported HTTP methods, paths, and parameters (including their sources: Header, URL Query, or Request Body).

## General API Activation & Common Parameters

For most API interactions that involve Optimizely SDK logic, the following are generally required:

1.  **`X-Optimizely-Enable-FEX: true`** (Header): Must be present and true to enable Optimizely processing.
    *   If `false`, Optimizely logic is bypassed.
2.  **`sdkKey`**: Your Optimizely SDK Key.
    *   **Sources (Precedence: Header > Query > Body)**:
        *   Header: `X-Optimizely-SDK-Key`
        *   Query: `sdkKey`
        *   Body: `sdkKey` (for POST/PUT requests with a JSON body)

Many endpoints also implicitly support common parameters like `userId`, `attributes`, and `decideOptions` which are resolved by the `ConfigurationService` with the same precedence (Header > Query > Body). These will be noted under "Common Optional Parameters" for relevant endpoints.

**Parameter Precedence (General Rule):**
1.  HTTP Headers
2.  URL Query Parameters
3.  Request Body (for POST/PUT methods with JSON payload)

--- 

## API Endpoints

### 1. `/api/decide`

*   **Description:** Get a decision for a single feature flag.
*   **Method:** `POST`
*   **Request Body Type:** `application/json`
*   **Mandatory Parameters:**
    *   `sdkKey` (Common Parameter - see above)
    *   `userId` (Common Parameter - see below or provide as `visitorId`)
        *   Header: `X-Optimizely-Visitor-Id` or `X-Optimizely-Visitor-Id`
        *   Query: `userId` or `visitorId`
        *   Body: `userId` or `visitorId`
    *   `key` (Specific to this endpoint for the flag identifier)
        *   Header: `X-Optimizely-Flag-Key` (Note: Header uses 'Flag-Key')
        *   Query: `key`
        *   Body: `key`
*   **Common Optional Parameters (resolved by `ConfigurationService`):**
    *   `attributes` (JSON object): User attributes for segmentation.
        *   Header: `X-Optimizely-Attributes` (URL-encoded JSON string)
        *   Query: `attributes` (URL-encoded JSON string)
        *   Body: `attributes`
    *   `decideOptions` (Array of strings): Optimizely Decide Options (e.g., `["INCLUDE_REASONS", "DISABLE_DECISION_EVENT"]`).
        *   Header: `X-Optimizely-Decide-Options` (URL-encoded JSON string array or CSV)
        *   Query: `decideOptions` (CSV or URL-encoded JSON string array)
        *   Body: `decideOptions`
    *   Boolean flags (e.g., `trimmedDecisions`, `disableDecisionEvent`, `includeReasons`, `excludeVariables`, `ignoreUserProfileService`, `setResponseHeaders`, `setResponseCookies`, `enableResponseMetadata`). Refer to `documentation/edge-agent-v2-interaction-guide.md` or `src-v2/docs/configuration-options.md` for exact header/query/body names.
*   **Example Request Body:**
    ```json
    {
      "sdkKey": "YOUR_SDK_KEY",
      "userId": "user123",
      "key": "my_feature_flag",
      "attributes": { "plan": "premium" },
      "decideOptions": ["INCLUDE_REASONS"]
    }
    ```
*   **Response:** JSON object representing the `OptimizelyDecision`.

### 2. `/api/decide-all`

*   **Description:** Get decisions for all active flags for a user.
*   **Method:** `POST`
*   **Request Body Type:** `application/json`
*   **Mandatory Parameters:**
    *   `sdkKey` (Common Parameter)
    *   `userId` (Common Parameter - Header/Query/Body as `userId` or `visitorId`)
*   **Common Optional Parameters:** `attributes`, `decideOptions`, boolean flags (as per `/api/decide`).
*   **Specific Optional Query Parameters:**
    *   `flagsFromKV` (boolean string `"true"`/`"false"`): If true and `enableFlagsFromKV` is enabled in config, attempts to load flag keys from KV store.
*   **Example Request Body:**
    ```json
    {
      "sdkKey": "YOUR_SDK_KEY",
      "userId": "user123",
      "attributes": { "plan": "premium" },
      "decideOptions": ["ENABLED_FLAGS_ONLY"]
    }
    ```
*   **Response:** JSON object `{ "decisions": [OptimizelyDecision, ...] }`.

### 3. `/api/decide-for-keys`

*   **Description:** Get decisions for a specified list of feature flag keys.
*   **Method:** `POST`
*   **Request Body Type:** `application/json`
*   **Mandatory Parameters:**
    *   `sdkKey` (Common Parameter)
    *   `userId` (Common Parameter - Header/Query/Body as `userId` or `visitorId`)
    *   `flagKeys` or `keys` (Array of strings for flag identifiers in the Request Body)
        *   Header: `X-Optimizely-Flag-Keys` (JSON string array or CSV) or `X-Optimizely-Flag-Key` (for a single key if this header is used exclusively)
        *   Query: `flagKeys` or `keys` (CSV or URL-encoded JSON string array)
        *   Body: `flagKeys` or `keys` (JSON array)
*   **Common Optional Parameters:** `attributes`, `decideOptions`, boolean flags (as per `/api/decide`).
*   **Example Request Body:**
    ```json
    {
      "sdkKey": "YOUR_SDK_KEY",
      "userId": "user123",
      "flagKeys": ["feature_1", "feature_2"],
      "attributes": { "plan": "premium" }
    }
    ```
*   **Response:** JSON object `{ "decisions": [OptimizelyDecision, ...] }`.

### 4. `/api/track`

*   **Description:** Track an event.
*   **Method:** `POST`
*   **Request Body Type:** `application/json`
*   **Mandatory Parameters (from Header/Query/Body):**
    *   `sdkKey` (Common Parameter)
    *   `eventKey`: The key of the event to track.
    *   `userId` (Common Parameter - Header/Query/Body as `userId` or `visitorId`)
*   **Optional Parameters (from Header/Query/Body):**
    *   `attributes`: JSON object of user attributes.
    *   `eventTags`: JSON object of event tags.
    *   `value`: Numerical value associated with the event (e.g., for revenue).
*   **Example Request Body:**
    ```json
    {
      "sdkKey": "YOUR_SDK_KEY",
      "eventKey": "purchased_item",
      "userId": "user123",
      "attributes": { "plan": "premium" },
      "eventTags": { "revenue": 49.99, "item_type": "subscription" }
    }
    ```
*   **Response:** JSON object, typically `{"success": true}` or an error.

### 5. `/api/datafile`

*   **Description:** Manage Optimizely datafiles.
*   **Methods:** `GET`, `POST`, `PUT`
*   **GET Parameters:**
    *   `sdkKey` (Mandatory - Header `X-Optimizely-SDK-Key` or Query `sdkKey`)
    *   `datafileFromKV` (Optional Query Parameter - boolean string `"true"`/`"false"`): If true and KV is configured, attempts to fetch from KV.
*   **POST/PUT Parameters (Admin Only - requires `X-Optimizely-Admin-Token` header):**
    *   `sdkKey` (Mandatory - Header `X-Optimizely-SDK-Key` or Query `sdkKey`)
    *   **Request Body:** Raw JSON datafile content.
*   **Response (GET):** JSON datafile content.
*   **Response (POST/PUT):** JSON `{"success": true}` or error.

### 6. `/api/flagkeys`

*   **Description:** Manage lists of flag keys associated with an SDK key (often for KV storage).
*   **Methods:** `GET`, `POST`, `PUT`
*   **GET Parameters:**
    *   `sdkKey` (Mandatory - Header `X-Optimizely-SDK-Key` or Query `sdkKey`)
    *   `flagsFromKV` (Optional Query Parameter - boolean string `"true"`/`"false"`): If true and KV is configured, attempts to fetch from KV.
*   **POST/PUT Parameters (Admin Only - requires `X-Optimizely-Admin-Token` header):**
    *   `sdkKey` (Mandatory - Header `X-Optimizely-SDK-Key` or Query `sdkKey`)
    *   **Request Body:** JSON `{"flagKeys": ["key1", "key2"]}`
*   **Response (GET):** JSON `{"flagKeys": ["key1", "key2"]}`.
*   **Response (POST/PUT):** JSON `{"success": true}` or error.

### 7. `/api/sdk`

*   **Description:** Get information about the Edge Agent SDK.
*   **Method:** `GET`
*   **Parameters:** None required beyond common activation.
*   **Response:** JSON object with agent name, version, environment, CDN provider.
    ```json
    {
      "name": "optimizely-edge-agent",
      "version": "2.0.0",
      "environment": "production",
      "cdnProvider": "cloudflare"
    }
    ```

### 8. `/api/variations`

*   **Description:** Intended to manage or retrieve variation information.
*   **Methods:** `GET`, `POST`, `PUT`
*   **Status:** Currently returns **501 Not Implemented**. Task T7 of `gemini-gap-issues-remediation` plan is to remove this endpoint (resulting in a 404).
*   **Parameters (if it were implemented):** Would likely require `sdkKey` and potentially admin token for write operations.

### 9. `/api/decide-options`

*   **Description:** Get a list of available Optimizely Decide Options.
*   **Methods:** `GET`, `POST`
*   **Parameters:** None required beyond common activation for POST if providing a body (though body is not used by this endpoint).
*   **Response:** JSON object listing available decide options with descriptions and example usage.

### 10. `/api/set-forced-variation`

*   **Description:** Set a forced variation for a user and flag (or experiment/rule).
*   **Methods:** `POST`, `PUT`
*   **Request Body Type:** `application/json`
*   **Body Parameters:**
    *   `sdkKey` (Optional, but recommended if `DecisionService` isn't pre-configured with a default)
    *   `userId` or `visitorId` (Mandatory)
    *   `flagKey` (Mandatory)
    *   `variationKey` (Mandatory)
    *   `ruleKey` (Optional): For rule-specific forced decisions.
    *   `experimentKey` (Optional): For experiment-specific forced decisions (often used with `ruleKey`).
*   **Response:** JSON `{"success": true, ...}` or error.

### 11. `/api/get-forced-variation`

*   **Description:** Get the forced variation for a user and flag.
*   **Methods:** `GET`, `POST`
*   **Parameters (sourced from Query for GET, Body for POST):**
    *   `sdkKey` (Mandatory)
    *   `userId` (Mandatory)
    *   `flagKey` (Mandatory)
*   **Response:** JSON `{"flagKey": "...", "userId": "...", "variationKey": "..."}` or error.

### 12. `/api/remove-forced-variation`

*   **Description:** Remove a forced variation.
*   **Methods:** `POST`, `DELETE`
*   **Parameters (sourced from Query for DELETE, Body for POST):**
    *   `sdkKey` (Optional for some SDK methods, but good practice to include)
    *   `userId` or `visitorId` (Mandatory)
    *   `flagKey` (Mandatory)
    *   `ruleKey` (Optional)
    *   `experimentKey` (Optional)
*   **Response:** JSON `{"success": true, ...}` or error.

### 13. `/api/remove-all-forced-decisions`

*   **Description:** Remove all forced decisions for a user.
*   **Methods:** `POST`, `DELETE`
*   **Parameters (sourced from Query for DELETE, Body for POST):**
    *   `sdkKey` (Optional)
    *   `userId` or `visitorId` (Mandatory)
*   **Response:** JSON `{"success": true, ...}` or error.

### 14. `/api/debug`

*   **Description:** Provides debugging information about how the agent has interpreted the request parameters and its current configuration.
*   **Method:** `POST` (Recommended, allows sending a body to test parameter parsing).
*   **Parameters:** Accepts all common parameters (`sdkKey`, `userId`, `flagKey`/`key`, `attributes`, `decideOptions`, boolean flags, etc.) via Header, Query, or Body.
*   **Response:** JSON object detailing the resolved configuration, including sources of parameters and any validation issues.

### 15. `/api/admin/cache/clear`

*   **Description:** Clear caches.
*   **Method:** `POST` (Likely, or as defined by its new plan)
*   **Parameters (Admin Only - requires `X-Optimizely-Admin-Token` header):**
    *   Specific parameters to define cache scope to clear will be defined in its dedicated implementation plan (Task T8 of `gemini-gap-issues-remediation` is BLOCKED pending this new plan).
*   **Status:** Currently a placeholder. Actual implementation is pending a new dedicated plan.
*   **Response:** Currently `{"success": true}` but doesn't perform actual clearing.

### 16. `/api/admin/status`

*   **Description:** Get administrative status information about the agent.
*   **Method:** `GET` (Likely, or as defined by its new plan)
*   **Parameters (Admin Only - requires `X-Optimizely-Admin-Token` header):** None specific beyond admin token.
*   **Response:** JSON object with timestamp, uptime (placeholder 'healthy'), version, environment, CDN provider.

---
This reference should provide a solid basis for interacting with the Edge Agent v2 API. Always refer to the latest source code (`ApiRouter.ts`, `ConfigurationService.ts`) and specific TDDs/behavior guides for the absolute source of truth, especially as features evolve. 