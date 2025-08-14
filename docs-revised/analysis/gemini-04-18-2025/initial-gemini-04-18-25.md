## Execution Plan: Vertical Slice Task List

This plan outlines the sequential analysis of key functional areas across both codebases.

**Slice 1: Configuration Loading & Validation**
*   **Task 1.1 (SRC/):** Analyze `_config_/requestConfig.js`. Document the `initialize`, `initializeFromHeaders`, `initializeFromQueryParams`, `initializeFromBody` methods. Validate the implemented parameter extraction logic and priority order (Headers > Query > Body) against the Unified Guide. Document supported config keys and their sources.
*   **Task 1.2 (src-v2/):** Analyze `services/implementations/ConfigurationService.ts`. Document the `initialize`, header/query/body processing methods. Validate the implemented logic and priority order against `docs/configuration-options.md` and the Unified Guide. Document supported config keys, their sources (headers, query, body), parsing logic (booleans, JSON), and validation rules (`getValidationRules`, `validate`).
*   **Task 1.3 (Compare):** Compare the configuration keys, sources, types, priority, and validation mechanisms between SRC/ (`requestConfig.js`) and src-v2/ (`ConfigurationService.ts`). Note differences in supported options or handling.

**Slice 2: Request Routing & Mode Determination**
*   **Task 2.1 (SRC/):** Analyze `index.js` (entry point) and `coreLogic.js` (`processRequest`). Document how requests are initially handled and how GET (Edge Mode) vs POST (Agent Mode) paths are determined (e.g., based on `httpMethod`, `isDecideOperation`).
*   **Task 2.2 (src-v2/):** Analyze entry points (`index.ts`, `vercel.ts`, `fastly.js`), composition roots (`composition/*.ts`), and `services/implementations/RequestHandler.ts` (`handleRequest`). Document how requests are routed to Edge Mode (`EdgeModeIntegration`), Agent Mode, or API (`ApiRouter`) based on method and path.
*   **Task 2.3 (Compare):** Compare the overall request routing and mode determination flow between SRC/ and src-v2/.

**Slice 3: GET Request Handling / Edge Mode**
*   **Task 3.1 (SRC/):** Analyze the GET path in `coreLogic.js` (`processRequest`). Document the flow:
    *   Fetching the datafile (`retrieveDatafile`).
    *   Initializing Optimizely (`initializeOptimizely`).
    *   Making decisions (`optimizelyExecute`, `decide`).
    *   Finding matching CDN config (`findMatchingConfig`).
    *   *Crucially:* Locating and documenting how `cdnVariationSettings` is read (confirm it's from the decision `variables`) and how its properties (`cdnExperimentURL`, `cdnResponseURL`, `forwardRequestToOrigin`, `cacheKey`, `cacheTTL`, etc.) control behavior.
    *   Logic for fetching content vs forwarding (`handleOriginForwarding`, `prepareLocalResponse`).
    *   Caching logic (if implemented within `coreLogic.js` or helpers).
    *   Validate against Unified Guide Section 5.
*   **Task 3.2 (src-v2/):** Analyze the GET path in `services/implementations/RequestHandler.ts` (`handleEdgeModeRequest`) and `services/implementations/EdgeModeIntegration.ts` (`processEdgeModeRequest`). Document the pipeline:
    *   `shouldHandleRequest` (eligibility check).
    *   `findMatch` (`URLMatcher.ts`).
    *   `prepareContent` (determining fetch/forward).
    *   *Crucially:* Determine how `cdnVariationSettings` is actually obtained and used. Is it from decision variables (like v1)? Is it passed differently? Is the feature fully implemented? Document the *code's* behavior vs the Unified Guide and v2 docs ambiguity.
    *   Content Fetching (`ContentFetcher.ts`).
    *   Caching (`CacheManager.ts`).
    *   Transformation (`ContentTransformer.ts`).
    *   Forwarding (`RequestForwarder.ts`).
    *   Validate against Unified Guide Section 5 (for parity) and check if v2 implementation details align with any v2 docs (though specific Edge Mode mechanics seem sparse in v2 docs).
*   **Task 3.3 (Compare):** Compare the Edge Mode implementation flow, `cdnVariationSettings` handling, caching, fetching, and forwarding logic between SRC/ and src-v2/. Highlight differences, especially regarding `cdnVariationSettings`.

**Slice 4: POST Request Handling / Agent Mode**
*   **Task 4.1 (SRC/):** Analyze the POST path in `coreLogic.js` (`processRequest`, `handlePostOperations`). Document how it:
    *   Initializes Optimizely.
    *   Parses request config (Headers/Query/Body).
    *   Calls SDK methods (`decide`, `track`).
    *   Formats and returns the JSON response.
    *   Confirm it does *not* use `cdnVariationSettings`.
    *   Validate against Unified Guide Section 3B.
*   **Task 4.2 (src-v2/):** Analyze the POST path in `services/implementations/RequestHandler.ts` (`handleAgentModeRequest`). Document how it:
    *   Uses `ConfigurationService` to get config.
    *   Uses `DecisionService` (`decide`, `decideAll`) and `EventService` (`trackEvent`).
    *   Formats and returns the JSON response.
    *   Confirm functional parity with v1 Agent Mode based on Unified Guide Section 3B.
*   **Task 4.3 (Compare):** Compare Agent Mode implementation, focusing on request processing, SDK interaction, and response generation between SRC/ and src-v2/.

**Slice 5: Optimizely SDK Initialization & Usage**
*   **Task 5.1 (SRC/):** Analyze `_optimizely_/optimizelyProvider.js`. Document the `initializeOptimizely`, `decide`, `track` methods. Note the SDK initialization pattern (`createInstance`) and how user context/attributes are handled.
*   **Task 5.2 (src-v2/):** Analyze `services/implementations/DecisionService.ts` and `services/implementations/EventDispatcher.ts` (or `CloudflareEventService.ts`). Document the `getOptimizelyClient`, `decide`, `decideAll`, `trackEvent` methods. Note the use of `createUserContext`.
*   **Task 5.3 (Compare):** Compare SDK initialization, client caching (v2 introduces explicit caching), user context creation, decision methods, and event tracking implementation between the versions.

**Slice 6: KV Store Interaction - Datafile Cache**
*   **Task 6.1 (SRC/):** Analyze `coreLogic.js` (`retrieveDatafile`). Document how it checks `datafileFromKV` config and interacts with `kvStore` (likely `get`) using the `optly_sdk_datafile` key format.
*   **Task 6.2 (src-v2/):** Analyze `services/implementations/DatafileService.ts` (`getDatafile`, `setDatafile`). Document how it checks `datafileFromKV` config and interacts with `IStorageAdapter` using the `DATAFILE_PREFIX`. Note the in-memory cache layer.
*   **Task 6.3 (Compare):** Compare the datafile caching logic, configuration flags, and storage interaction between SRC/ and src-v2/.

**Slice 7: KV Store Interaction - Flag Key Filtering**
*   **Task 7.1 (SRC/):** Analyze `coreLogic.js` (`determineFlagsToDecide`, `retrieveFlagKeys`). Document how it checks `enableFlagsFromKV` config and interacts with `kvStore` (`get`) using the `optly_flagKeys` key format.
*   **Task 7.2 (src-v2/):** Analyze `services/implementations/DatafileService.ts` (`getFlagKeys`, `setFlagKeys`) and potentially `DecisionService.ts` usage. Document how it checks `enableFlagsFromKV` config and interacts with `IStorageAdapter` using `FLAG_KEYS_PREFIX`. Note the integration with `FlagStorageService.ts`.
*   **Task 7.3 (Compare):** Compare the flag key filtering logic, configuration flags, and storage interaction between SRC/ and src-v2/.

**Slice 8: KV Store Interaction - User Profile Service (UPS)**
*   **Task 8.1 (SRC/):** Analyze `_optimizely_/userProfileService.js`. Document its `lookup` and `save` methods, how it interacts with `kvStore` (confirm namespace `OPTLY_HYBRID_AGENT_UPS_KV`), and how it's integrated into `optimizelyProvider.js`. Validate against Unified Guide Section 7.
*   **Task 8.2 (src-v2/):** *Verify implementation status.* Analyze if UPS is implemented in `services/implementations/DecisionService.ts` or elsewhere, potentially using `IStorageAdapter`. Document the findings. If implemented, detail its logic. If not, state the parity gap based on code.
*   **Task 8.3 (Compare):** Compare the implementation status and logic (if present in v2) of the User Profile Service for sticky bucketing.

**Slice 9: Cookie Management & Stickiness**
*   **Task 9.1 (SRC/):** Analyze `_helpers_/optimizelyHelper.js` (`parseCookies`, `getCookieValueByName`, `createCookie`, `serializeDecisions`, `deserializeDecisions`) and `coreLogic.js` (`handleCookieDecisions`, `setResponseCookies`). Document how visitor ID and decisions are read from/written to cookies using `_config_/cookieOptions.js`. Validate against Unified Guide Section 8.
*   **Task 9.2 (src-v2/):** Analyze `utils/CookieUtils.ts` and `services/implementations/CookieService.ts`. Document the implementation of cookie parsing, generation, decision serialization/deserialization. Analyze integration in `RequestHandler.ts` (`getVisitorId`, `createJsonResponse`, `addCookiesToResponse`). *Acknowledge documented parity gaps and verify current code status.*
*   **Task 9.3 (Compare):** Compare cookie handling logic, formats, configuration, and the state of sticky bucketing implementation between SRC/ and src-v2/.

**Slice 10: API Router & Endpoints**
*   **Task 10.1 (SRC/):** Analyze `_api_/apiRouter.js` and handler files (`datafile.js`, `flagKeys.js`, `sdk.js`, `variationChanges.js`). Document the available endpoints, their purpose (KV/SDK management), methods, and parameters.
*   **Task 10.2 (src-v2/):** Analyze `services/implementations/ApiRouter.ts`. Document the available endpoints (`/api/datafile`, `/api/flagkeys`, `/api/sdk`, `/api/variations`, `/api/admin/*`, `/api/decide`, `/api/decide-all`, `/api/decide-for-keys`, `/api/decide-options`, forced variation endpoints, `/api/debug`). Document their purpose, methods, parameters, and integration with services like `DatafileService`.
*   **Task 10.3 (Compare):** Compare the API endpoints offered by SRC/ and src-v2/, noting additions or changes in v2.

**Slice 11: CDN Adapter Implementation (v2 Only)**
*   **Task 11.1 (src-v2/):** Analyze `adapters/interfaces/` (IEnvironmentAdapter, IStorageAdapter, IRequestAdapter, IResponseAdapter, ILoggerAdapter). Document the contracts.
*   **Task 11.2 (src-v2/):** Analyze `adapters/implementations/` (cloudflare, vercel, fastly). Document how each adapter implementation fulfills the interface contracts for its specific CDN environment. Validate against `cdn-adapters.md`.
*   **Task 11.3 (src-v2/):** Analyze `adapters/factories/`. Document how the factories instantiate the correct adapters.

**Slice 12: Metrics System Implementation (v2 Only)**
*   **Task 12.1 (src-v2/):** Analyze `adapters/interfaces/IMetricsAdapter.ts` and `adapters/implementations/cloudflare/CloudflareMetricsAdapter.ts`. Document the interface, implementation modes (Analytics Engine vs Logging), tracked metrics (cross-reference with `metrics.md`), and how it's integrated (e.g., in `RequestHandler`, `ApiRouter`). Validate code against `metrics.md`.

---

## Phase 1: SRC/ Codebase Analysis & Implementation Documentation

*(Executing Task 1.1, 2.1, 3.1, 4.1, 5.1, 6.1, 7.1, 8.1, 9.1, 10.1)*

**SRC/ Validated Implementation Documentation**

**1. Overview**

*   **Language:** JavaScript (ES Modules)
*   **Core Files:** `index.js` (entry), `coreLogic.js` (main processing), `_optimizely_/optimizelyProvider.js` (SDK interaction), `_config_/requestConfig.js` (config parsing), `_helpers_/optimizelyHelper.js` (utilities), `_api_/apiRouter.js` (API endpoints).
*   **Architecture:** Monolithic structure with helper modules. Lacks the explicit adapter pattern of v2. Relies heavily on `coreLogic.js` for request processing.

**2. Request Routing & Mode Determination (`index.js`, `coreLogic.js`)**

*   The primary entry point (`index.js` for Cloudflare) receives the `request`, `env`, `ctx`.
*   It initializes `AbstractionHelper`, `Logger`, and checks if the request path matches API routes (`optlyHelper.routeMatches`).
*   API requests (`/v1/api/...`) are routed to `_api_/apiRouter.js`.
*   Non-API requests proceed to core Optimizely handling if the `X-Optimizely-Enable-FEX` header is 'true' and an `sdkKey` is found (header or query param).
*   If Optimizely handling is triggered, `initializeCoreLogic` creates instances of `OptimizelyProvider`, `CoreLogic`, and the appropriate (statically chosen based on `defaultSettings.cdnProvider`, likely `CloudflareAdapter` in this context) `cdnAdapter`.
*   `coreLogic.processRequest` is the main handler. It uses `request.method` (`httpMethod`) to differentiate logic:
    *   **GET:** Assumed to be **Edge Mode**. Proceeds with decision logic relevant to content serving/forwarding.
    *   **POST:** Assumed to be **Agent Mode** (unless specific API paths like `/v1/datafile` which are handled earlier). Routed through `handlePostOperations`.

**3. Configuration (`_config_/requestConfig.js`)**

*   **Instantiation:** `RequestConfig` is instantiated within `coreLogic.processRequest`.
*   **Initialization (`initialize`):** Orchestrates loading from headers, query params, and body (for POST).
*   **Priority (Validated):** Code confirms the priority:
    1.  `initializeFromHeaders`: Reads headers like `X-Optimizely-SDK-Key`, `X-Optimizely-Attributes` (parses JSON), `X-Optimizely-Decide-Options` (parses JSON), boolean flags. Sets internal properties (`this.sdkKey`, `this.attributes`, etc.).
    2.  `initializeFromQueryParams`: Reads `URL.searchParams`. It *only* updates internal properties *if* `this.settings.prioritizeHeadersOverQueryParams` is false OR the property wasn't already set by headers. This confirms **Headers > Query Params** precedence.
    3.  `initializeFromBody`: Reads `request.body` (if POST and JSON). It *only* updates internal properties *if* the property wasn't already set by headers or query params. This confirms **Query Params > Body** precedence.
*   **Supported Keys:** Parses a wide range of keys corresponding to the matrix in the Unified Guide (e.g., `sdkKey`, `visitorId`, `attributes`, `flagKeys`, `eventKey`, `eventTags`, boolean flags like `decideAll`, `trimmedDecisions`, `setResponseHeaders`, `enableFlagsFromKV`).
*   **Parsing:** Uses `JSON.parse` for headers/query params expected to be JSON (attributes, eventTags, decideOptions). Uses simple string comparison (`=== 'true'`) or `parseBoolean` helper for boolean flags.
*   **Metadata:** Tracks the source of key values (`sdkKeyFrom`, `visitorIdFrom`, etc.) in `configMetadata` if `enableResponseMetadata` is true.

**4. GET Request Handling / Edge Mode (`coreLogic.js`)**

*   **Flow:** `processRequest` (for GET) -> `initializeOptimizely` -> `determineFlagsToDecide` -> `optimizelyExecute` (`decide`) -> `findMatchingConfig` -> `prepareResponse` -> either `handleOriginForwarding` or `prepareLocalResponse`.
*   **`cdnVariationSettings` (Validated):**
    *   Read from `variables.cdnVariationSettings` within the `OptimizelyDecision` object returned by the SDK's `decide` call inside `findMatchingConfig`. This confirms it is treated as a **flag variable**.
    *   `findMatchingConfig` iterates through decisions, parses the `cdnVariationSettings` variable (if present), and compares the `cdnExperimentURL` property against the incoming `requestURL`. It handles normalization (trailing slashes, extra slashes) and optionally ignores query parameters.
    *   If a match is found, the corresponding `cdnConfig` object (containing `cdnResponseURL`, `forwardRequestToOrigin`, `cacheRequestToOrigin`, `cacheKey`, `cacheTTL`, etc.) is returned and stored in `this.cdnExperimentSettings`.
*   **Content Fetching vs Forwarding:**
    *   `prepareResponse` calls `shouldForwardToOrigin` which checks `this.cdnExperimentSettings.forwardRequestToOrigin === 'true'`.
    *   If true -> `handleOriginForwarding`: Clones the request, sets Optimizely headers/cookies (`X-Optimizely-Visitor-Id`, `X-Optimizely-Decision`, etc.), potentially modifies the target URL to `cdnResponseURL` (if present), and fetches using `fetch`. It includes logic for caching the *origin's* response using `cache.put` if `cacheRequestToOrigin` is true.
    *   If false -> `prepareLocalResponse`: This path seems intended for scenarios where content is fetched *directly* based on `cdnResponseURL` (not forwarding the original request). However, the code within `prepareLocalResponse` primarily formats a JSON response containing the Optimizely decisions, *not* fetching content from `cdnResponseURL`. There appears to be a **gap or misinterpretation in the provided v1 code** compared to the Unified Guide's description of `cdnResponseURL`'s role in *serving* content directly from the edge in this path. The `fetchAndProcessRequest` method in the `CloudflareAdapter` *does* fetch from `cdnResponseURL` if `forwardRequestToOrigin` is false, suggesting the primary fetching logic resides in the adapter, not `prepareLocalResponse`. `prepareLocalResponse` seems more geared towards Agent Mode responses.
*   **Caching:**
    *   Caching logic primarily resides within the `cdnAdapter` (`CloudflareAdapter` in this context), specifically in `handleFetchFromOrigin`.
    *   It uses the standard `caches.default` API (`cache.match`, `cache.put`).
    *   The cache key is generated by `generateCacheKey` based on `cdnSettings.cacheKey` ('VARIATION_KEY' or custom string) and the `originUrl` (which might be `cdnResponseURL`).
    *   `cacheTTL` from `cdnVariationSettings` controls the `expirationTtl` for `cache.put`.

**5. POST Request Handling / Agent Mode (`coreLogic.js`, `_api_/apiRouter.js`)**

*   **Flow:** `processRequest` (for POST) -> `initializeOptimizely` -> `determineFlagsToDecide` (less relevant for POST) -> `optimizelyExecute` (`handlePostOperations`) -> response formatting.
*   **`handlePostOperations`:** Contains a `switch` based on `this.pathName`:
    *   `/v1/decide`: Calls `optimizelyProvider.decide`.
    *   `/v1/track`: Calls `optimizelyProvider.track`.
    *   `/v1/datafile`: Calls `optimizelyProvider.datafile`.
    *   `/v1/config`: Calls `optimizelyProvider.config`.
    *   `/v1/batch`, `/v1/send-odp-event`: Placeholder calls.
*   **Response:** Returns JSON containing decisions or tracking confirmation.
*   **`cdnVariationSettings`:** Not used in the POST request flow.
*   **API Endpoints (`_api_/`):**
    *   `apiRouter.js` handles paths starting with `/v1/api/`.
    *   `datafile.js`: Handles GET/POST for `/v1/api/datafiles/:key` (interacts with `kvStore` for datafile).
    *   `flagKeys.js`: Handles GET/POST for `/v1/api/flag_keys` (interacts with `kvStore` for flag keys).
    *   `sdk.js`: Handles GET for `/v1/api/sdk/:sdk_url` (fetches JS SDK, stores in KV).
    *   `variationChanges.js`: Handles GET/POST for `/v1/api/variation_changes/:experiment_id/:api_token` (fetches experiment variations from Optimizely API, stores changes in KV).

**6. Optimizely SDK Initialization & Usage (`_optimizely_/optimizelyProvider.js`)**

*   **Initialization (`initializeOptimizely`):**
    *   Uses `createInstance` from `@optimizely/optimizely-sdk`.
    *   Takes datafile object, visitorId, attributes, etc.
    *   Configures a `userProfileService` if `this.kvStoreUserProfileEnabled` is true, wrapping `UserProfileService.js`.
    *   Creates and stores the `optimizelyClient` instance (globally cached based on `sdkKey`).
    *   Creates the `optimizelyUserContext` using `client.createUserContext`.
*   **Decisions (`decide`):** Iterates through flag keys, calls `optimizelyUserContext.decide`, handles forced decisions (reading from `flagsToForce` argument passed from `coreLogic`).
*   **Tracking (`track`):** Calls `optimizelyUserContext.trackEvent`.
*   **Datafile/Config Access:** Provides methods (`datafile`, `config`) to access data from the initialized client.

**7. KV Store Interaction (`coreLogic.js`, `_optimizely_/optimizelyProvider.js`, `_api_/`, `UserProfileService.js`)**

*   **Datafile Cache (`retrieveDatafile` in `coreLogic`):** Checks `requestConfig.datafileFromKV`. If true, calls `cdnAdapter.getDatafileFromKV` which interacts with `kvStore.get(sdkKey)`. Uses `kv_key_optly_sdk_datafile` implicitly via adapter/settings.
*   **Flag Key Filtering (`retrieveFlagKeys` in `coreLogic`):** Checks `requestConfig.enableFlagsFromKV`. If true, calls `cdnAdapter.getFlagsFromKV` which interacts with `kvStore.get(defaultSettings.kv_key_optly_flagKeys)`.
*   **User Profile Service (`UserProfileService.js`):**
    *   Instantiated in `optimizelyProvider.initializeOptimizely` if enabled.
    *   Uses `kvStore` passed to its constructor.
    *   `lookup` method calls `kvStore.get` with key format `optly-ups-${sdkKey}-${visitorId}`.
    *   `save` method calls `kvStore.put` with the same key format.
*   **API Endpoints:** `datafile.js` and `flagKeys.js` use `kvStore.get/put` for managing datafile/flagkey lists via API calls.

**8. Cookie Management & Stickiness (`_helpers_/optimizelyHelper.js`, `coreLogic.js`)**

*   **Reading:** `coreLogic.handleCookieDecisions` uses `optlyHelper.getCookieValueByName` to read `decisionsCookieName` and `visitorIdCookieName` from `requestConfig.headerCookiesString`. It then uses `optlyHelper.deserializeDecisions` to parse the decision cookie.
*   **Writing:**
    *   `coreLogic.prepareLocalResponse` and `handleOriginForwarding` call `setResponseCookies`.
    *   `setResponseCookies` uses `optlyHelper.createCookie` to generate `Set-Cookie` strings for visitor ID and serialized decisions (using `optlyHelper.serializeDecisions`).
    *   It uses `cdnAdapter.cookiesToSetResponse.push` or similar mechanisms (depending on adapter details) to add `Set-Cookie` headers to the outgoing response.
*   **Options:** `_config_/cookieOptions.js` defines default cookie attributes (path, expiry, secure, httpOnly, sameSite). `optlyHelper.createCookie` uses these defaults.
*   **Stickiness:** Implemented via `validStoredDecisions` being passed to `optimizelyProvider.decide` as `flagsToForce`, which prevents re-bucketing for flags found in the valid cookie decisions.

**9. Discrepancies vs Unified Guide:**

*   The logic in `coreLogic.prepareLocalResponse` seems misaligned with the description of Edge Mode serving content directly via `cdnResponseURL`. It primarily formats a JSON decision response. The actual fetching seems to happen in the adapter (`CloudflareAdapter.fetchAndProcessRequest`). This suggests the core logic might be more focused on decision orchestration, relying on the adapter for fetch/forward implementation details.

---

## Phase 2: src-v2/ Codebase Analysis & Implementation Documentation

*(Executing Task 1.2, 2.2, 3.2, 4.2, 5.2, 6.2, 7.2, 8.2, 9.2, 10.2, 11.1-11.3, 12.1)*

**src-v2/ Validated Implementation Documentation**

**1. Overview**

*   **Language:** TypeScript
*   **Architecture:** Modular, Adapter-based, Dependency Injection via Composition Roots.
*   **Core Components:** `RequestHandler`, Services (`DecisionService`, `EventService`, `CacheService`, `ConfigurationService`, `CookieService`, `FlagStorageService`, `ApiRouter`), Adapters (`IRequestAdapter`, `IResponseAdapter`, `IStorageAdapter`, `IEnvironmentAdapter`, `ILoggerAdapter`, `IMetricsAdapter`), Composition Roots (`cloudflareComposition.ts`, etc.).
*   **Entry Points:** `index.ts` (Cloudflare), `vercel.ts`, `fastly.js`.

**2. Request Routing & Mode Determination (`composition/*.ts`, `RequestHandler.ts`)**

*   Platform-specific entry points (`index.ts`, etc.) call the corresponding composition root function (e.g., `handleCloudflareWorkerRequest` in `cloudflareComposition.ts`).
*   The composition root (`composeCloudflareApplication`, etc.) uses an `AdapterFactory` to create platform-specific adapters and injects them into services.
*   It instantiates the main `RequestHandler`.
*   `RequestHandler.handleRequest` receives the `IRequestAdapter`.
*   **API Routing:** It checks if `url.pathname` starts with `/api/`. If yes, and `ApiRouter` is injected, it delegates the request to `apiRouter.routeApiRequest`.
*   **Pixel Tracking:** It checks if `url.pathname` ends with `/track.gif` and routes to `handlePixelTrackingRequest`.
*   **Mode Determination:** For non-API, non-pixel requests:
    *   It extracts user context (`getVisitorId`, `extractAttributes`).
    *   If `request.method` is 'POST', it calls `handleAgentModeRequest`.
    *   If `request.method` is 'GET', it calls `handleEdgeModeRequest`.

**3. Configuration (`ConfigurationService.ts`)**

*   **Instantiation:** Created in the composition root and injected where needed.
*   **Initialization (`initialize`):** Called by `RequestHandler`. Orchestrates loading from headers, query, and body.
*   **Priority (Validated):**
    1.  `initializeFromHeaders`: Reads headers, uses mapping (`settings.sdkKeyHeader`, etc.), converts names to camelCase (`convertHeaderToCamelCase`), parses JSON/booleans.
    2.  `initializeFromQueryParams`: Reads `URLSearchParams`. Only updates config if `settings.prioritizeHeadersOverQueryParams` is false OR config value is currently undefined. Handles JSON/boolean/comma-separated lists.
    3.  `initializeFromBody`: Reads body via `request.getBodyJson` (if POST/PUT and JSON content type). Only updates config if value is currently undefined.
    *   This confirms the **Headers > Query > Body** precedence.
*   **Supported Keys:** Implements parsing for a wide range of keys defined in `OptimizelyConfigOptions` interface, aligning well with `docs/configuration-options.md`.
*   **Validation (`validate`, `getValidationRules`):** Implements detailed validation rules (type, required, min/max length, pattern, allowed values, custom validators like `validateAttributesStructure`). Returns `ValidationResult` with issues and severity.
*   **Metadata (`getMetadata`):** Tracks config sources (`sdkKeyFrom`, etc.) and validation results if `enableResponseMetadata` is true.

**4. GET Request Handling / Edge Mode (`RequestHandler.ts`, `EdgeModeIntegration.ts`, specific services)**

*   **Flow:** `RequestHandler.handleEdgeModeRequest` -> `EdgeModeIntegration.processEdgeModeRequest` -> Pipeline: `shouldHandleRequest` -> `findMatch` -> `prepareContent` -> `forwardRequest`/`fetchContent`.
*   **`EdgeModeIntegration.processEdgeModeRequest`:** Orchestrates the pipeline.
*   **Eligibility (`EdgeModeHandler.shouldHandleRequest`):** *Currently uses hardcoded mock settings*. It does **not** fetch settings from a datafile or API dynamically based on the request or user context in the provided code. This is a **MAJOR GAP** compared to v1's dynamic behavior.
*   **URL Matching (`URLMatcher.ts`, `EdgeModeHandler.findMatchingConfig`):** `EdgeModeIntegration` calls `URLMatcher.findMatch` which uses the `URLMatcher` instance to compare the request URL against `cdnExperimentURL` or `pathRegex` from the (currently mock) `variationSettings`. Handles path normalization and query parameter options (`requiredQueryParams`, `ignoreQueryParams`).
*   **`cdnVariationSettings` (Validated):**
    *   The `RequestHandler` *does not* read `cdnVariationSettings` from Optimizely decisions for GET requests.
    *   `EdgeModeHandler.shouldHandleRequest` uses *mocked/hardcoded* settings.
    *   `EdgeModeHandler.findMatchingConfig` also uses these mocked settings passed to it.
    *   **Conclusion:** The dynamic, decision-based `cdnVariationSettings` mechanism described for v1 and the Unified Guide is **NOT IMPLEMENTED** in the provided src-v2/ code. The v2 documentation mentioning it as a *body parameter* seems incorrect for GET requests and likely refers to a different, possibly agent-mode configuration or an intended but unimplemented feature. The core Edge Mode dynamic routing based on flag variables is missing.
*   **Content Fetching vs Forwarding:**
    *   `EdgeModeHandler.prepareContent` determines this based on the (mocked) settings' `forwardRequestToOrigin` property.
    *   If true -> `EdgeModeIntegration` calls `RequestForwarder.forwardRequest`.
    *   If false -> `EdgeModeIntegration` calls `ContentFetcher.fetchContent` using the `cdnResponseURL` from the (mocked) settings.
*   **Caching (`CacheManager.ts`):**
    *   `EdgeModeIntegration` uses `CacheManager` to check cache before forwarding/fetching and store results after.
    *   Uses `CacheManager.generateCacheKey` which can incorporate settings.
    *   Leverages `ICacheService` (backed by `IStorageAdapter`).
*   **Transformation (`ContentTransformer.ts`):** `EdgeModeIntegration` calls `ContentTransformer.transformWithFunction` if `transformContent` is present in the (mocked) settings. Includes basic safety checks but notes need for a proper sandbox.

**5. POST Request Handling / Agent Mode (`RequestHandler.ts`)**

*   **Flow:** `handleAgentModeRequest` -> Parses config using `getRequestConfig` (which uses `ConfigurationService`) -> Routes based on `path` -> Calls `DecisionService` or `EventService`.
*   **Endpoints:** Handles `/decide`, `/decide-all`, `/decide-for-keys`, `/track`.
*   **SDK Interaction:** Uses `this.decisionService.decide`, `this.decisionService.decideAll`, `this.eventService.trackEvent`.
*   **Response:** Formats JSON response using `createJsonResponse`, including headers/cookies based on config.
*   **`cdnVariationSettings`:** Not used.
*   **Parity:** Appears functionally similar to v1 Agent Mode, but uses the more structured v2 services.

**6. Optimizely SDK Initialization & Usage (`DecisionService.ts`)**

*   **Initialization (`getOptimizelyClient`):**
    *   Uses `createInstance` from `@optimizely/optimizely-sdk`.
    *   Fetches datafile via `IConfigService`.
    *   **Client Caching:** Implements in-memory caching (`clientCache`) based on `sdkKey` and datafile `revision`. Includes cache size limit (`maxCacheSize`) and LRU-like eviction (`cleanupCaches`).
    *   Creates structured logger adapter (`createOptimizelyLoggerAdapter`).
    *   Sets `clientEngine`, `clientVersion`. Includes error handler.
*   **User Context (`getUserContext`):**
    *   Calls `client.createUserContext(userId, attributes)`.
    *   Implements in-memory caching (`userContextCache`) with TTL (`userContextCacheTtl`). Clears cache on datafile update (`clearUserContextsForSdkKey`).
    *   Adds `currentTime` attribute (`processAttributes`).
*   **Decisions (`decide`, `decideAll`):** Uses the cached/created `OptimizelySDKUserContext` instance's `decide`, `decideAll`, `decideForKeys` methods. Includes detailed metrics tracking using `IMetricsAdapter`.
*   **Forced Decisions:** Includes stubs/integration points for `setForcedVariation`/`getForcedVariation` but the core logic seems incomplete or reliant on specific SDK features being present on the context/client. Tests (`forced-decisions.test.ts`) primarily mock the behavior. The `applyForcedVariations` helper uses `client.setForcedVariation`. Integration needs validation.
*   **Tracking:** Responsibility moved to `IEventService`.

**7. KV Store Interaction (`DatafileService.ts`, `FlagStorageService.ts`, Adapter Implementations)**

*   **Datafile Cache (`DatafileService.getDatafile`):** Checks `config.datafileFromKV`. Uses `IStorageAdapter.get` with `DATAFILE_PREFIX`. Includes in-memory caching layer. Fetches from CDN (`fetchDatafileFromCDN`) as fallback. `setDatafile` writes to storage.
*   **Flag Key Filtering (`DatafileService.getFlagKeys`):** Checks `config.enableFlagsFromKV`. Uses `IFlagStorageService.getFlagKeys` (if available) or falls back to `IStorageAdapter.get` with `FLAG_KEYS_PREFIX`. Includes in-memory caching. `setFlagKeys` writes to storage.
*   **Flag Storage (`FlagStorageService.ts`):** Dedicated service using `IStorageAdapter` for flag-specific data (flags, decisions, keys) using v1 key formats (`flag:`, `flag-decision:`, etc.). Includes memory caching and optional periodic cleanup (`startPeriodicCleanup`, `purgeExpiredEntries`).
*   **User Profile Service (UPS):** **Not implemented** in the provided v2 services (`DecisionService`, etc.). This confirms the parity gap noted in `testing-source-of-truth.md`. Stickiness relies solely on cookies in the current v2 code.

**8. Cookie Management & Stickiness (`CookieUtils.ts`, `CookieService.ts`, `RequestHandler.ts`)**

*   **Utilities (`CookieUtils.ts`):** Provides functions for parsing (`parseCookie`), creating (`createCookie`), serializing/deserializing decisions (`serializeDecisions`, `deserializeDecisions` - uses JSON + Base64), creating specific cookie objects (`createDecisionsCookie`, `createVisitorIdCookie`).
*   **Service (`CookieService.ts`):** Implements `ICookieService`. Uses `CookieUtils` to get decisions/visitorId from `IRequestAdapter` headers (`getDecisionsFromCookies`, `getVisitorIdFromCookies`) and create cookie objects/headers (`createDecisionsCookie`, `createVisitorIdCookie`, `createSetCookieHeaders`). Includes logic to apply config options (`applyCookieOptionsFromConfig`).
*   **Integration (`RequestHandler.ts`):**
    *   Uses `CookieService.getVisitorIdFromCookies` in `getVisitorId`.
    *   Uses `CookieService.getDecisionsFromCookies` in `handleAgentModeRequest`/`decideForFlag` for *reading* sticky decisions.
    *   Uses `CookieService.createVisitorIdCookie`, `createDecisionsCookie`, `createSetCookieHeaders` via `addCookiesToResponse` helper for *writing* cookies based on config (`setResponseCookies`).
*   **Stickiness:** Basic cookie-based sticky bucketing is implemented by reading previous decisions (`getDecisionsFromCookies`) and potentially using them in `decideForFlag` (though the provided `decideForFlag` stub doesn't explicitly show using the cookie decision). Writing decision cookies (`addCookiesToResponse`) enables persistence for subsequent requests. *Full end-to-end validation of sticky bucketing behavior using cookies is needed.*

**9. API Router & Endpoints (`ApiRouter.ts`)**

*   **Implementation:** `ApiRouter.routeApiRequest` handles requests starting with `/api/`.
*   **Endpoints:**
    *   `/api/datafile` (GET/POST/PUT - Requires Admin for write): Interacts with `DatafileService.getDatafile`/`saveDatafile`.
    *   `/api/flagkeys` (GET/POST/PUT - Requires Admin for write): Interacts with `DatafileService.getFlagKeys`/`saveFlagKeys`.
    *   `/api/sdk` (GET): Returns hardcoded agent info (uses `ConfigService` for version etc.).
    *   `/api/variations` (GET/POST/PUT - Requires Admin for write): **Not implemented** (returns 501).
    *   `/api/admin/cache/clear` (POST - Requires Admin): Placeholder logs cache clear.
    *   `/api/admin/status` (GET - Requires Admin): Returns basic status.
    *   `/api/decide` (POST): Calls `DecisionService.getDecision`.
    *   `/api/decide-all` (POST): Calls `DecisionService.decideAll` (or fallback).
    *   `/api/decide-for-keys` (POST): Calls `DecisionService.decideAll` with specific keys.
    *   `/api/decide-options` (GET/POST): Returns static list of OptimizelyDecideOption enums.
    *   `/api/(set|get|remove)-forced-variation` (POST/GET/DELETE): Interacts with `DecisionService` methods (if available/implemented).
    *   `/api/debug` (POST): Returns debug info about the request config.
*   **Auth:** Basic admin check using `X-Admin-Token` header compared against `ConfigService.getAdminToken()`.
*   **Comparison:** v2 has more structured API endpoints, including dedicated decision and forced variation endpoints, compared to v1's KV/SDK management focus.

**10. CDN Adapters (`adapters/`)**

*   **Interfaces:** Define contracts for abstracting Request, Response, Storage, Environment, Logger, Metrics.
*   **Implementations:** Provide concrete classes for Cloudflare, Vercel, Fastly. They wrap native CDN objects/APIs (e.g., `CF.KVNamespace`, `env` bindings, `ctx.waitUntil`).
*   **Factories:** Instantiate the correct adapter based on the environment context passed during composition.
*   **Validation:** Code implements the patterns described in `cdn-adapters.md`.

**11. Metrics System (`IMetricsAdapter`, `CloudflareMetricsAdapter.ts`)**

*   **Interface:** Defines standard methods (`incrementCounter`, `setGauge`, `recordHistogram`, `startTimer`, etc.).
*   **Implementation (`CloudflareMetricsAdapter`):**
    *   Supports two modes: Logging (fallback) and Analytics Engine.
    *   Uses `env.ANALYTICS_ENGINE` binding if available.
    *   Formats metric names with a prefix (`optimizely_edge_`).
    *   Formats tags.
    *   Calls `analyticsEngine.writeDataPoint` with appropriate indexes (`counter`, `gauge`, `histogram`, `timer`).
    *   Includes methods for configuration and enable/disable.
*   **Integration:** Injected into `RequestHandler`, `ApiRouter`, `DatafileService`, `EdgeModeIntegration`. Used to track request durations, counts, errors, cache status, datafile operations, etc.
*   **Validation:** Code implements the features described in `metrics.md`. *However, the known issue about it failing to record needs investigation.*

**12. Discrepancies vs Documentation:**

*   **`cdnVariationSettings`:** The most significant discrepancy. The v2 code **does not** implement the dynamic Edge Mode routing based on reading this variable from Optimizely decisions, unlike v1. The v2 docs mentioning it as a body parameter remain unexplained by the code for GET requests.
*   **User Profile Service:** Not implemented in v2 services, despite being an SDK option. Stickiness relies solely on cookies.
*   **Full Config Parity:** `ConfigurationService` supports many, but perhaps not *all*, configuration options detailed in the original `requestConfig.js` or the Unified Guide matrix. A detailed comparison would be needed to confirm 100% coverage.

---

## Phase 3: Comparative Functional Analysis (Validated)

**1. Confirmed New Features/Enhancements in src-v2/**

*   **TypeScript Implementation:** Provides static typing, improving code maintainability and reducing runtime errors.
*   **Modular Architecture:** Clear separation of concerns using Services (Decision, Event, Cache, Config, Cookie, FlagStorage, API) and Adapters (Request, Response, Storage, Environment, Logger, Metrics). Promotes testability and extensibility.
*   **Multi-CDN Support:** Explicit adapter implementations and factories for Cloudflare, Vercel, and Fastly, enabling deployment across different edge platforms.
*   **Composition Roots:** Platform-specific wiring of dependencies (`composition/*.ts`), optimizing bundle size for each target CDN.
*   **Dedicated Configuration Service (`ConfigurationService.ts`):** Centralized and more robust handling of configuration loading, precedence, and validation compared to v1's `requestConfig.js`. Includes detailed validation rules.
*   **Dedicated Cookie Service (`CookieService.ts`):** Centralized logic for cookie parsing, creation, and management, using shared utilities (`CookieUtils.ts`).
*   **Dedicated Flag Storage Service (`FlagStorageService.ts`):** Specialized service for flag/decision KV operations, including memory caching and cleanup logic.
*   **Metrics System (`IMetricsAdapter`, `CloudflareMetricsAdapter`):** Built-in support for operational metrics tracking, compatible with Cloudflare Analytics Engine or logging.
*   **Expanded API Endpoints (`ApiRouter.ts`):** Includes dedicated endpoints for decisions (`/api/decide*`), forced variations, debug info, and admin status, beyond v1's KV/SDK management endpoints.
*   **Improved SDK Integration:** Uses the modern `createUserContext` pattern. Includes client caching based on datafile revision. Provides a structured logger adapter for the SDK.

**2. Verified Functional Parity/Deviations/Gaps (src-v2/ vs SRC/)**

*   **Configuration Loading:**
    *   *Parity:* Both implement Headers > Query > Body precedence. Both parse JSON and boolean values.
    *   *Difference:* v2 uses a dedicated `ConfigurationService` with explicit validation rules, potentially offering more robustness. v2 might not support *every single* config key from v1's `requestConfig.js` (requires detailed key-by-key check).
*   **Agent Mode (POST):**
    *   *Parity:* Both serve as a serverless SDK interface, accepting config via Headers/Query/Body, calling Optimizely `decide`/`track`, and returning JSON.
    *   *Difference:* v2 uses dedicated `DecisionService` and `EventService`.
*   **Edge Mode (GET):**
    *   *Deviation/GAP:* **v2 Lacks Dynamic `cdnVariationSettings` Handling.** v1 reads `cdnVariationSettings` from *flag variables* in the Optimizely decision to dynamically route/fetch/cache content. The analyzed v2 code **does not implement this**. Its `EdgeModeHandler` uses hardcoded mock settings, and there's no logic to read this variable from decisions in the GET request path. This is a major functional gap for the primary v1 Edge Mode use case.
    *   *Difference:* v2 has a more explicit pipeline (`EdgeModeIntegration`) involving separate services for URL matching, fetching, caching, transformation, and forwarding, which is more modular but currently lacks the dynamic configuration core to v1's Edge Mode.
*   **SDK Initialization:**
    *   *Difference:* v2 uses `createUserContext`. v2 implements client caching based on datafile revision.
*   **KV - Datafile Caching:**
    *   *Parity:* Both support caching datafile in KV via a config flag (`datafileFromKV`).
    *   *Difference:* v2 uses `DatafileService` and `IStorageAdapter`, includes an in-memory cache layer.
*   **KV - Flag Key Filtering:**
    *   *Parity:* Both support filtering decisions based on keys in KV via a config flag (`enableFlagsFromKV`).
    *   *Difference:* v2 uses `DatafileService`/`FlagStorageService` and `IStorageAdapter`.
*   **KV - User Profile Service:**
    *   *GAP:* **v1 implements UPS using KV for sticky bucketing. v2 does NOT implement UPS via KV.** v2 relies solely on cookies for stickiness.
*   **Cookie Management:**
    *   *Parity (Basic):* Both read/write visitor ID cookies. Both serialize/deserialize decisions for cookies.
    *   *Difference:* v2 centralizes logic in `CookieService` and `CookieUtils`. v1 has helpers spread out.
    *   *Gap/Status:* v2 implements cookie *reading* for sticky bucketing, but full end-to-end validation is needed. v2 correctly *writes* decision and visitorId cookies.
*   **API Endpoints:**
    *   *Difference:* v2 offers a more comprehensive set of API endpoints via `ApiRouter.ts` (decisions, forced variations, debug, admin) compared to v1's focus on KV/SDK management in `_api_/`.

**3. Migration Considerations**

*   **Edge Mode Rework:** The lack of dynamic `cdnVariationSettings` handling in v2 is the **most significant barrier** to migrating v1 Edge Mode use cases. This functionality needs to be implemented in v2 to achieve parity. The current v2 Edge Mode pipeline (using `EdgeModeIntegration`) needs to be adapted to read and act upon decision variables dynamically.
*   **User Profile Service:** If KV-based sticky bucketing (beyond simple cookie stickiness) is required, the User Profile Service logic from v1 needs to be ported to v2, likely using `IStorageAdapter`.
*   **Configuration:** While precedence is similar, review all config keys used in v1 (`requestConfig.js`) and ensure they are supported or have equivalents in v2's `ConfigurationService`. Adapt any configuration inputs (e.g., deployment environment variables, request parameters).
*   **Deployment:** v2 requires separate builds (`npm run build:cloudflare`, etc.) and deployment strategies for each target CDN due to the adapter pattern, unlike v1's potentially more generic approach.
*   **API Endpoints:** If using the internal management APIs (`/v1/api/*`), note the changes in v2's `ApiRouter.ts` (different paths, potentially different request/response formats).
*   **TypeScript:** Migration involves adapting JavaScript code to TypeScript, potentially requiring type definitions and refactoring.
*   **Metrics:** Leverage the new v2 metrics system for monitoring (requires setup, e.g., Cloudflare Analytics Engine).
*   **Dependencies:** Review and manage dependencies specific to v2 and the target CDN environment.

---
This completes the analysis based on the provided code and documentation. The key takeaway is the functional gap in v2's Edge Mode regarding dynamic `cdnVariationSettings` handling, which is critical for achieving parity with v1's primary use case. The User Profile Service gap is also notable for advanced sticky bucketing scenarios.