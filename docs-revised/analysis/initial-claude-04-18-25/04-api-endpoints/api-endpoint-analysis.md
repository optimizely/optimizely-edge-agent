# API Endpoint Implementation Analysis (v1 vs v2)

This document analyzes the implementation of management API endpoints in the Optimizely Edge Agent v1 (JavaScript) and v2 (TypeScript) codebases.

**Relevant Files:**

*   **v1:**
    *   `src/_api_/apiRouter.js`
    *   `src/_api_/handlers/datafile.js`
    *   `src/_api_/handlers/flagKeys.js`
    *   `src/_api_/handlers/sdk.js`
    *   `src/_api_/handlers/variationChanges.js`
*   **v2:**
    *   `src-v2/services/implementations/ApiRouter.ts`
    *   Dependencies: `IDatafileService`, `ICacheService`, `IConfigService`, `ILoggerAdapter`, `IMetricsAdapter`, `IDecisionService`

## 1. Routing Comparison

### v1 (`apiRouter.js`)

*   **Mechanism:** Custom function (`apiRouter`) iterates through a predefined `routes` object.
*   **Matching:** Uses `RegExp` matching for paths, including extraction of parameters (e.g., `/:key`).
*   **Method Handling:** Explicitly checks request method against allowed methods defined in the `routes` object for the matched pattern.
*   **Handlers:** Imports and calls specific handler functions from the `./handlers/` directory.
*   **404:** Returns plain text `Not Found` response if no route/method matches.

### v2 (`ApiRouter.ts`)

*   **Mechanism:** Logic embedded within the `routeApiRequest` method of the `ApiRouter` class.
*   **Matching:** Uses simple `if/else if` statements with `path.endsWith()` or `path.includes()` for matching. No explicit path parameter extraction at the routing level (handled within specific handlers).
*   **Method Handling:** Checks HTTP method within individual internal handler methods (e.g., `handleDatafileRequest`), returning a 405 JSON error if disallowed.
*   **Handlers:** Calls internal private methods within the `ApiRouter` class (e.g., `handleDatafileRequest`, `handleFlagKeysRequest`, `handleAdminRequest`). These methods utilize injected services.
*   **404:** Returns a standard 404 JSON error (`{ error: "Unknown endpoint" }`).

### Summary

| Feature         | v1                                       | v2                                                          |
| :-------------- | :--------------------------------------- | :---------------------------------------------------------- |
| **Mechanism**   | Custom function + `routes` object        | `if/else if` in `ApiRouter` class method                    |
| **Matching**    | RegExp, extracts path params             | String methods (`.endsWith`, `.includes`), no param extract |
| **Handlers**    | External functions (in `./handlers/`)    | Internal private methods within `ApiRouter`                 |
| **404/405**     | Plain text / Status code only            | Structured JSON error responses                             |
| **Extensibility** | Requires editing `routes` object & import | Requires adding `else if` block & new internal method       |

## 2. Endpoint Functionality Comparison

| Endpoint (v1 Path)                                    | v1 Handler(s)                 | v2 Path                        | v2 Handler Method                  | v2 Status       | Notes                                                                                                     |
| :---------------------------------------------------- | :---------------------------- | :----------------------------- | :--------------------------------- | :-------------- | :-------------------------------------------------------------------------------------------------------- |
| `/v1/api/datafiles/:key` (GET)                        | `handleGetDatafile`           | `/api/datafile` (GET)          | `handleDatafileRequest`            | Implemented     | Retrieves datafile from KV/Service. v2 adds metrics.                                                      |
| `/v1/api/datafiles/:key` (POST)                       | `handleDatafile`              | `/api/datafile` (PUT/POST)     | `handleDatafileRequest`            | Implemented     | v1 fetches from CDN & stores. v2 requires body content & admin auth, updates flags. v2 adds metrics.        |
| `/v1/api/flag_keys` (GET)                             | `handleGetFlagKeys`           | `/api/flagkeys` (GET)          | `handleFlagKeysRequest`            | Implemented     | Retrieves flag keys from KV/Service. v2 adds metrics.                                                     |
| `/v1/api/flag_keys` (POST)                            | `handleFlagKeys`              | `/api/flagkeys` (PUT/POST)     | `handleFlagKeysRequest`            | Implemented     | Stores flag keys from body to KV/Service. v2 requires admin auth, adds metrics.                            |
| `/v1/api/sdk/:sdk_url` (GET)                          | `handleSDK`                   | `/api/sdk` (GET)               | `handleSdkInfoRequest`             | **Changed**     | v1 fetches external SDK & stores in KV. v2 returns internal agent version/env info.                     |
| `/v1/api/variation_changes/:exp_id/:token` (GET/POST) | `handleVariationChanges`      | `/api/variations` (GET/PUT/POST) | `handleVariationsRequest`          | **Not Impl.**   | v1 fetches external Optly API & stores changes in KV. v2 endpoint exists but returns 501.             |
| *N/A*                                                 | *N/A*                         | `/api/decide`                  | `handleDecideRequest`              | **New (v2)**    | Handles single flag decisions via `IDecisionService`.                                                     |
| *N/A*                                                 | *N/A*                         | `/api/decide-all`              | `handleDecideAllRequest`           | **New (v2)**    | Handles decisions for all flags via `IDecisionService`.                                                     |
| *N/A*                                                 | *N/A*                         | `/api/decide-for-keys`         | `handleDecideForKeysRequest`       | **New (v2)**    | Handles decisions for specific flags via `IDecisionService`.                                                |
| *N/A*                                                 | *N/A*                         | `/api/decide-options`          | `handleDecideOptionsRequest`       | **New (v2)**    | Returns available SDK decide options.                                                                     |
| *N/A*                                                 | *N/A*                         | `/api/set-forced-variation`    | `handleSetForcedVariationRequest`  | **New (v2)**    | Sets forced variations via `IDecisionService`.                                                          |
| *N/A*                                                 | *N/A*                         | `/api/get-forced-variation`    | `handleGetForcedVariationRequest`  | **New (v2)**    | Gets forced variations via `IDecisionService`.                                                          |
| *N/A*                                                 | *N/A*                         | `/api/remove-forced-variation` | `handleRemoveForcedVariationRequest` | **New (v2)**    | Removes forced variations via `IDecisionService`.                                                       |
| *N/A*                                                 | *N/A*                         | `/api/debug`                   | `handleDebugRequest`               | **New (v2)**    | Returns request context for debugging.                                                                    |
| *N/A*                                                 | *N/A*                         | `/api/admin/cache/clear`       | `handleAdminRequest`               | **New (v2)**    | Admin endpoint to clear cache (logging only currently). Requires admin auth.                              |
| *N/A*                                                 | *N/A*                         | `/api/admin/status`            | `handleAdminRequest`               | **New (v2)**    | Admin endpoint to get agent status. Requires admin auth.                                                |

## 3. Validation Comparison

| Feature                  | v1                                                           | v2                                                                               |
| :----------------------- | :----------------------------------------------------------- | :------------------------------------------------------------------------------- |
| **HTTP Method**          | Checked in handlers (405 plain text response)                | Checked in handlers (405 JSON error response)                                    |
| **Required Params**      | Implicit path param check (routing). Body check (`flagKeys`) | Explicit check for query/body params (400 JSON error with required param info)     |
| **Body Structure**       | Basic array check (`flagKeys`)                               | Basic array check (`flagKeys`) (400 JSON error)                                  |
| **Type Validation**      | Limited/Implicit                                             | Limited runtime checks; relies on TS static typing & underlying service validation |
| **Authentication**       | None internal (except external token use)                    | `isAdminRequest` helper for admin endpoints (403 JSON error)                       |

## 4. Authentication Comparison

*   **v1:** Lacks internal authentication for its API endpoints. The `/variation_changes` endpoint uses a token from the URL path *only* for authenticating against the external Optimizely API.
*   **v2:** Implements token-based authentication for administrative actions (updating datafiles/flagkeys, clearing cache, getting status). It uses the `isAdminRequest` helper to compare an `X-Optimizely-Admin-Token` request header against a value stored in the `IConfigService`. Non-admin endpoints remain unauthenticated.

## 5. Error Handling & Response Formatting Comparison

| Feature                 | v1                                                                  | v2                                                                                                                            |
| :---------------------- | :------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------- |
| **Error Capturing**     | `try/catch` in handlers                                             | `try/catch` in main router & handlers                                                                                       |
| **Logging**             | `logger` object, basic error messages                               | `ILoggerAdapter` with context (`requestId`), structured logging                                                               |
| **Client Error Response** | 4xx plain text, 500 plain text (sometimes with error details)         | 4xx/500 structured JSON (`{error: msg}`), generic 500 messages (details logged internally)                                       |
| **Success Response**    | Varies (plain text, JSON string)                                    | Structured JSON (`{success: true}` or data payload)                                                                           |
| **Headers**             | `Content-Type` sometimes inconsistent/missing                       | Consistent `Content-Type: application/json`, `X-Request-ID`, `this.configurationService.getImplementationVersionHeader()`, `Cache-Control: no-store` (for JSON) |
| **Metrics**             | None                                                                | Integrated error/request/response counts & timers via `IMetricsAdapter`                                                     |

## 6. Enhancements in v2

*   **New Decision Endpoints:** `/decide`, `/decide-all`, `/decide-for-keys` leverage the `IDecisionService`.
*   **Forced Variation API:** `/set-/get-/remove-forced-variation` endpoints for managing overrides.
*   **Debug Endpoint:** `/api/debug` provides introspection.
*   **Admin Endpoints:** `/api/admin/status`, `/api/admin/cache/clear` provide administrative functions.
*   **SDK Info Endpoint:** `/api/sdk` returns agent metadata instead of fetching the JS SDK.
*   **Integrated Metrics:** Comprehensive metrics collection via `IMetricsAdapter`.
*   **Structured Error Handling:** Consistent JSON error responses and internal logging.
*   **Internal Authentication:** Added admin token check for sensitive operations.
*   **Standardized Headers:** Consistent and informative response headers.
*   **Improved Structure:** Use of Dependency Injection and Services (`IDatafileService`, etc.) promotes better code organization and testability compared to v1's more monolithic handlers.

## 7. Conclusion

The v2 API layer represents a significant improvement over v1. It introduces many new endpoints related to core decisioning and management, standardizes error handling and response formatting using JSON, adds internal authentication for admin tasks, integrates metrics collection, and utilizes a more modular service-based architecture. While v1 had basic datafile/flagkey management, v2 expands this and adds crucial decisioning APIs directly, making it a more capable standalone agent. The removal/change of the `/sdk` and `/variation_changes` endpoints indicates a shift in how external resources are handled compared to v1. 