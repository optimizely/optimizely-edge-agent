# Optimizely Edge Agent: Test Coverage Map (Enhanced Examples)

This document tracks the required test coverage and identifies gaps for the Optimizely Edge Agent implementation, focusing on parameter handling and core features.

## Existing Test Coverage

| Test Category | Test File | Implementation | Status | Environment | Description |
|---------------|-----------|----------------|--------|-------------|-------------|
| Infrastructure| `infrastructure-verification.js` | `critical-testing-project` | ✅ Working | Wrangler Dev | Basic connectivity & CF env check |
| *[Populate with findings from Task 1.3]* | | | | | |

## Required Tests by Feature

### Agent Mode (POST) - Parameter Handling

| Test ID                      | Feature Area        | Scenario Description                                  | Input Method | Request Method | Key Parameters        | Expected Outcome                     | Implementation Status | Priority | Dependencies |
| :--------------------------- | :------------------ | :---------------------------------------------------- | :----------- | :------------- | :-------------------- | :----------------------------------- | :-------------------- | :------- | :----------- |
| Agent_Decide_SDKKey_Header   | Decide API          | Verify /decide processes SDK Key via Header         | Header       | POST           | `X-Optimizely-SDK-Key`| 200 OK, valid decision             | 📝 To Be Implemented  | High     | Infra        |
| Agent_Decide_SDKKey_Query    | Decide API          | Verify /decide processes SDK Key via Query          | Query        | POST           | `sdkKey`              | 200 OK, valid decision             | 📝 To Be Implemented  | High     | Infra        |
| Agent_Decide_SDKKey_Body     | Decide API          | Verify /decide processes SDK Key via Body           | Body         | POST           | `sdkKey`              | 200 OK, valid decision             | 📝 To Be Implemented  | High     | Infra        |
| Agent_Decide_SDKKey_Prec     | Decide API          | Test Header > Query > Body precedence for SDK Key     | All          | POST           | `sdkKey` (all sources)| 200 OK, uses Header value          | 📝 To Be Implemented  | High     | Above 3      |
| Agent_Decide_SDKKey_Missing  | Decide API          | Verify /decide fails (400) if SDK Key missing       | None         | POST           | `sdkKey`              | 400 Bad Request                      | 📝 To Be Implemented  | High     | Infra        |
| Agent_Decide_UserID_Header   | Decide API          | Verify /decide processes User ID via Header         | Header       | POST           | `X-Optimizely-Visitor-Id`| 200 OK, uses correct UserID        | 📝 To Be Implemented  | High     | Infra        |
| Agent_Decide_UserID_Query    | Decide API          | Verify /decide processes User ID via Query          | Query        | POST           | `userId`              | 200 OK, uses correct UserID        | 📝 To Be Implemented  | High     | Infra        |
| Agent_Decide_UserID_Body     | Decide API          | Verify /decide processes User ID via Body (`user.id`) | Body         | POST           | `user.id`             | 200 OK, uses correct UserID        | 📝 To Be Implemented  | High     | Infra        |
| Agent_Decide_UserID_Prec     | Decide API          | Test Header > Query > Body precedence for User ID     | All          | POST           | `userId` (all sources)| 200 OK, uses Header value          | 📝 To Be Implemented  | High     | Above 3      |
| Agent_Decide_Attrs_Header    | Decide API          | Verify /decide processes Attributes via Header      | Header       | POST           | `X-Optimizely-Attrs`  | 200 OK, decision reflects attrs    | 📝 To Be Implemented  | High     | Infra        |
| Agent_Decide_Attrs_Query     | Decide API          | Verify /decide processes Attributes via Query       | Query        | POST           | `attributes`          | 200 OK, decision reflects attrs    | 📝 To Be Implemented  | High     | Infra        |
| Agent_Decide_Attrs_Body      | Decide API          | Verify /decide processes Attributes via Body        | Body         | POST           | `user.attributes`     | 200 OK, decision reflects attrs    | 📝 To Be Implemented  | High     | Infra        |
| Agent_Decide_Attrs_Prec      | Decide API          | Test Attribute precedence/merge logic               | All          | POST           | `attributes`          | 200 OK, correct merge/override     | 📝 To Be Implemented  | Medium   | Above 3      |
| Agent_Track_EventKey_Header  | Track API           | Verify /track processes Event Key via Header        | Header       | POST           | `X-Optimizely-Event-Key`| 200 OK                             | 📝 To Be Implemented  | High     | Infra        |
| Agent_Track_EventKey_Query   | Track API           | Verify /track processes Event Key via Query         | Query        | POST           | `eventKey`            | 200 OK                             | 📝 To Be Implemented  | High     | Infra        |
| Agent_Track_EventKey_Body    | Track API           | Verify /track processes Event Key via Body          | Body         | POST           | `eventKey`            | 200 OK                             | 📝 To Be Implemented  | High     | Infra        |
| Agent_Track_EventKey_Missing | Track API           | Verify /track fails (400) if Event Key missing      | None         | POST           | `eventKey`            | 400 Bad Request                      | 📝 To Be Implemented  | High     | Infra        |
| Agent_Track_Tags_Header      | Track API           | Verify /track processes Event Tags via Header       | Header       | POST           | `X-Optimizely-Event-Tags`| 200 OK, tags tracked             | 📝 To Be Implemented  | Medium   | Infra        |
| Agent_Track_Tags_Query       | Track API           | Verify /track processes Event Tags via Query        | Query        | POST           | `eventTags`           | 200 OK, tags tracked             | 📝 To Be Implemented  | Medium   | Infra        |
| Agent_Track_Tags_Body        | Track API           | Verify /track processes Event Tags via Body         | Body         | POST           | `eventTags`           | 200 OK, tags tracked             | 📝 To Be Implemented  | Medium   | Infra        |
| Agent_Decide_Opt_Reasons     | Decide API Options  | Test `INCLUDE_REASONS` option via Header/Query/Body | All          | POST           | `decideOptions`       | 200 OK, reasons array in response  | 📝 To Be Implemented  | Medium   | Infra        |
| Agent_Decide_Opt_ExcludeVars | Decide API Options  | Test `EXCLUDE_VARIABLES` option via Header/Query/Body| All          | POST           | `decideOptions`       | 200 OK, variables object missing | 📝 To Be Implemented  | Medium   | Infra        |
| Agent_Decide4Keys_Body       | Decide For Keys API | Test /decide-for-keys with `flagKeys` in Body       | Body         | POST           | `flagKeys`            | 200 OK, multiple decisions       | 📝 To Be Implemented  | High     | Infra        |
| Agent_Decide4Keys_Query      | Decide For Keys API | Test /decide-for-keys with `keys` in Query          | Query        | POST           | `keys` (multiple)     | 200 OK, multiple decisions       | 📝 To Be Implemented  | High     | Infra        |

### Edge Mode (GET) - `cdnVariationSettings` & Core Logic

| Test ID                      | Feature Area         | Scenario Description                                      | Input Method | Request Method | Key Parameters         | Expected Outcome                          | Implementation Status | Priority | Dependencies |
| :--------------------------- | :------------------- | :-------------------------------------------------------- | :----------- | :------------- | :--------------------- | :---------------------------------------- | :-------------------- | :------- | :----------- |
| Edge_URLMatch_ExactPath      | URL Matching         | Test exact path match against `cdnExperimentURL`          | N/A          | GET            | `cdnExperimentURL`     | Edge Mode triggered, correct variation    | 📝 To Be Implemented  | High     | Infra        |
| Edge_URLMatch_TrailingSlash  | URL Matching         | Test path match with/without trailing slash             | N/A          | GET            | `cdnExperimentURL`     | Edge Mode triggered                       | 📝 To Be Implemented  | Medium   | Infra        |
| Edge_URLMatch_Regex          | URL Matching         | Test regex match against `pathRegex`                      | N/A          | GET            | `pathRegex`            | Edge Mode triggered                       | 📝 To Be Implemented  | High     | Infra        |
| Edge_URLMatch_ReqQuery       | URL Matching         | Test match requires `requiredQueryParams`                 | N/A          | GET            | `requiredQueryParams`  | Match only if params present              | 📝 To Be Implemented  | Medium   | Infra        |
| Edge_URLMatch_IgnoreQuery    | URL Matching         | Test match ignores `ignoreQueryParams`                    | N/A          | GET            | `ignoreQueryParams`    | Match even if ignored params differ       | 📝 To Be Implemented  | Medium   | Infra        |
| Edge_ContentFetch_Basic      | Content Fetching     | Verify content fetched from `cdnResponseURL`              | N/A          | GET            | `cdnResponseURL`       | Response body matches target URL content  | 📝 To Be Implemented  | High     | Edge_URLMatch |
| Edge_Forward_True            | Origin Forwarding    | Verify request forwarded when `forwardRequestToOrigin=true` | N/A          | GET            | `forwardRequestToOrigin`| Origin receives request                   | 📝 To Be Implemented  | High     | Edge_URLMatch |
| Edge_Forward_Headers         | Origin Forwarding    | Verify Optly headers/cookies added to forwarded request   | N/A          | GET            | `forwardRequestToOrigin`| Origin receives Optly headers/cookies     | 📝 To Be Implemented  | High     | Edge_Forward_True |
| Edge_Forward_False           | Origin Forwarding    | Verify request NOT forwarded when `forwardRequestToOrigin=false`| N/A          | GET            | `forwardRequestToOrigin`| Response served directly/from cdnRespURL| 📝 To Be Implemented  | High     | Edge_URLMatch |
| Edge_VisitorID_Cookie        | Visitor ID           | Verify visitor ID read from cookie                        | Cookie       | GET            | `optly_edge_visitor_id`| Consistent bucketing                    | 📝 To Be Implemented  | High     | Infra        |
| Edge_VisitorID_Query         | Visitor ID           | Verify visitor ID read from `visitor_id` query param      | Query        | GET            | `visitor_id`           | Consistent bucketing                    | 📝 To Be Implemented  | Medium   | Infra        |
| Edge_VisitorID_Generate      | Visitor ID           | Verify new visitor ID generated & set via Set-Cookie      | None         | GET            |                        | `Set-Cookie` header present             | 📝 To Be Implemented  | High     | Infra        |
| Edge_Audience_Attrs          | Audience Eval        | Verify audience eval uses attributes (cookie/header)      | Cookie/Hdr   | GET            | `attributes`           | Correct variation based on attributes   | 📝 To Be Implemented  | High     | Edge_VisitorID |

### Caching Logic

| Test ID                      | Feature Area         | Scenario Description                                      | Input Method | Request Method | Key Parameters         | Expected Outcome                          | Implementation Status | Priority | Dependencies |
| :--------------------------- | :------------------- | :-------------------------------------------------------- | :----------- | :------------- | :--------------------- | :---------------------------------------- | :-------------------- | :------- | :----------- |
| Cache_KeyGen_Variation       | Cache Key Generation | Verify `cacheKey='VARIATION_KEY'` generates correct key   | N/A          | GET            | `cacheKey`             | Key includes flag+variation               | 📝 To Be Implemented  | High     | Edge_URLMatch |
| Cache_KeyGen_Custom          | Cache Key Generation | Verify `cacheKey='custom'` uses custom string             | N/A          | GET            | `cacheKey`             | Key includes 'custom'                     | 📝 To Be Implemented  | Medium   | Edge_URLMatch |
| Cache_Behavior_Hit           | Cache Behavior       | Verify cache HIT for subsequent identical requests        | N/A          | GET            |                        | Cache status header indicates HIT         | 📝 To Be Implemented  | High     | Cache_KeyGen |
| Cache_Behavior_Miss          | Cache Behavior       | Verify cache MISS for first request / expired cache       | N/A          | GET            |                        | Cache status header indicates MISS        | 📝 To Be Implemented  | High     | Cache_KeyGen |
| Cache_Behavior_TTL           | Cache Behavior       | Verify `cacheTTL` setting is respected                    | N/A          | GET            | `cacheTTL`             | Cache MISS after TTL                      | 📝 To Be Implemented  | High     | Cache_Behavior_Hit |
| Cache_Behavior_OriginCache   | Cache Behavior       | Verify `cacheRequestToOrigin=true` caches origin response | N/A          | GET            | `cacheRequestToOrigin` | Subsequent requests HIT cache             | 📝 To Be Implemented  | High     | Edge_Forward_True |
| Cache_Behavior_NoOriginCache | Cache Behavior       | Verify `cacheRequestToOrigin=false` prevents origin cache | N/A          | GET            | `cacheRequestToOrigin` | Subsequent requests MISS cache            | 📝 To Be Implemented  | High     | Edge_Forward_True |
| Cache_Behavior_Override      | Cache Behavior       | Verify `overrideCache=true` bypasses cache read           | Query        | GET/POST       | `overrideCache`        | Cache status MISS even if item cached     | 📝 To Be Implemented  | Medium   | Cache_Behavior_Hit |

### Administrative API Endpoints

| Test ID                      | Feature Area         | Scenario Description                                      | Input Method | Request Method | Key Parameters         | Expected Outcome                          | Implementation Status | Priority | Dependencies |
| :--------------------------- | :------------------- | :-------------------------------------------------------- | :----------- | :------------- | :--------------------- | :---------------------------------------- | :-------------------- | :------- | :----------- |
| Admin_GetDatafile_OK         | Datafile API         | Verify `GET /api/datafile` retrieves correct datafile     | Query        | GET            | `sdkKey`               | 200 OK, correct datafile body           | 📝 To Be Implemented  | High     | Infra, Admin_PostDatafile |
| Admin_GetDatafile_404        | Datafile API         | Verify `GET /api/datafile` returns 404 if not found       | Query        | GET            | `sdkKey`               | 404 Not Found                             | 📝 To Be Implemented  | High     | Infra        |
| Admin_PostDatafile_OK        | Datafile API         | Verify `POST /api/datafile` updates datafile (Admin)      | Body         | POST           | `sdkKey`, body         | 200 OK, success=true                    | 📝 To Be Implemented  | High     | Infra        |
| Admin_PostDatafile_Auth      | Datafile API         | Verify `POST /api/datafile` requires Admin Token          | Body         | POST           | `sdkKey`, body         | 401/403 Unauthorized                    | 📝 To Be Implemented  | High     | Infra        |
| Admin_GetFlagKeys_OK         | Flag Keys API        | Verify `GET /api/flagkeys` retrieves correct keys         | Query        | GET            | `sdkKey`               | 200 OK, correct keys array              | 📝 To Be Implemented  | High     | Infra, Admin_PostFlagKeys |
| Admin_PostFlagKeys_OK        | Flag Keys API        | Verify `POST /api/flagkeys` updates keys (Admin)          | Body         | POST           | `sdkKey`, `flagKeys`   | 200 OK, success=true                    | 📝 To Be Implemented  | High     | Infra        |
| Admin_PostFlagKeys_Auth      | Flag Keys API        | Verify `POST /api/flagkeys` requires Admin Token          | Body         | POST           | `sdkKey`, `flagKeys`   | 401/403 Unauthorized                    | 📝 To Be Implemented  | High     | Infra        |
| Admin_GetSDKInfo_OK          | SDK Info API         | Verify `GET /api/sdk` returns agent info                  | N/A          | GET            |                        | 200 OK, correct agent info              | 📝 To Be Implemented  | Low      | Infra        |
| Admin_GetStatus_OK           | Admin API            | Verify `GET /api/admin/status` returns status (Admin)     | Header       | GET            | `X-Admin-Token`        | 200 OK, status object                   | 📝 To Be Implemented  | Medium   | Infra        |
| Admin_GetStatus_Auth         | Admin API            | Verify `GET /api/admin/status` requires Admin Token       | None         | GET            |                        | 401/403 Unauthorized                    | 📝 To Be Implemented  | Medium   | Infra        |
| Admin_ClearCache_OK          | Admin API            | Verify `POST /api/admin/cache/clear` clears cache (Admin) | Header       | POST           | `X-Admin-Token`        | 200 OK, subsequent requests miss cache  | 📝 To Be Implemented  | Medium   | Infra, Caching Tests |
| Admin_ClearCache_Auth        | Admin API            | Verify `POST /api/admin/cache/clear` requires Admin Token | None         | POST           |                        | 401/403 Unauthorized                    | 📝 To Be Implemented  | Medium   | Infra        |

## Test Gaps Analysis

*[This section will be populated based on Task 1.4 findings]*

*   **Initial Gap:** Lack of explicit tests for parameter precedence. (Addressed in Required Tests)
*   **Initial Gap:** Insufficient testing of `cdnVariationSettings` sub-options. (Addressed in Required Tests)
*   **Initial Gap:** Caching logic, especially key generation, needs dedicated tests. (Addressed in Required Tests)
*   **Initial Gap:** Limited testing of error conditions for different input methods. (Addressed in Required Tests)

## Testing Environment Requirements

[Existing Requirements]

## Implementation Priorities (Refined)

1.  **Phase 1**: Infrastructure verification and basic connectivity tests.
2.  **Phase 2**: Agent Mode core functionality (Decide/Track) with basic Header/Query/Body parameter handling.
3.  **Phase 3**: Edge Mode core functionality (URL Matching, Content Fetching) and basic `cdnVariationSettings`.
4.  **Phase 4**: Comprehensive parameter precedence tests for Agent Mode.
5.  **Phase 5**: Comprehensive `cdnVariationSettings` tests (Forwarding, Caching, Advanced Matching).
6.  **Phase 6**: Caching logic tests (KeyGen, TTL, Override).
7.  **Phase 7**: Administrative API endpoint tests.
8.  **Phase 8**: Advanced features (Forced Variations, User Profile Service - if applicable).