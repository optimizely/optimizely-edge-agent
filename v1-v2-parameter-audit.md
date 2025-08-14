# V1 vs V2 Parameter Support Audit

## Parameters Found in V1 (from requestConfig.js)

### Headers Support
| V1 Parameter | V1 Header | V2 Status | Notes |
|-------------|-----------|-----------|-------|
| sdkKey | X-Optimizely-SDK-Key | ✅ Supported | x-optimizely-sdk-key |
| overrideCache | X-Optimizely-Override-Cache-Header | ✅ Supported | x-optimizely-override-cache |
| overrideVisitorId | X-Optimizely-Override-Visitor-Id | ✅ FIXED | Was missing, now added |
| attributes | X-Optimizely-Attributes-Header | ✅ Supported | x-optimizely-attributes |
| eventTags | X-Optimizely-Event-Tags-Header | ❓ CHECK | Need to verify |
| datafileAccessToken | X-Optimizely-Datafile-Access-Token | ✅ Supported | x-optimizely-datafile-access-token |
| optimizelyEnabled | X-Optimizely-Enable-FEX | ✅ Supported | x-optimizely-enable-fex (renamed to enableFex) |
| decideOptions | X-Optimizely-Decide-Options | ✅ Supported | x-optimizely-decide-options |
| visitorId | X-Optimizely-Visitor-Id | ✅ Supported | x-optimizely-visitor-id |
| trimmedDecisions | X-Optimizely-Trimmed-Decisions | ✅ Supported | x-optimizely-trimmed-decisions |
| enableFlagsFromKV | X-Optimizely-Flags-KV | ✅ Supported | x-optimizely-flags-from-kv |
| enableDatafileFromKV | X-Optimizely-Datafile-KV | ❓ CHECK | datafile_from_kv? |
| enableResponseMetadata | X-Optimizely-Enable-Response-Metadata | ❓ CHECK | Need to verify |
| eventKey | X-Optimizely-Event-Key | ✅ Supported | x-optimizely-event-key |
| setResponseHeaders | X-Optimizely-Set-Response-Headers | ✅ Supported | x-optimizely-set-response-headers |
| setResponseCookies | X-Optimizely-Set-Response-Cookies | ✅ Supported | x-optimizely-set-response-cookies |
| setRequestHeaders | X-Optimizely-Set-Request-Headers | ✅ Supported | x-optimizely-set-request-headers |
| setRequestCookies | X-Optimizely-Set-Request-Cookies | ✅ Supported | x-optimizely-set-request-cookies |

### Query Parameters Support
| V1 Parameter | V1 Query Param | V2 Status | Notes |
|-------------|----------------|-----------|-------|
| serverMode | serverMode | ✅ Supported | server_mode |
| visitorId | visitorId | ✅ Supported | visitor_id |
| keys/flagKeys | keys | ❓ CHECK | Need to verify |
| sdkKey | sdkKey | ✅ Supported | sdk_key |
| decideAll | decideAll | ✅ Supported | decide_all |
| trimmedDecisions | trimmedDecisions | ✅ Supported | trimmed_decisions |
| disableDecisionEvent | DISABLE_DECISION_EVENT | ✅ Supported | disable_decision_event |
| enabledFlagsOnly | ENABLED_FLAGS_ONLY | ✅ Supported | enabled_flags_only |
| includeReasons | INCLUDE_REASONS | ✅ Supported | include_reasons |
| ignoreUserProfileService | IGNORE_USER_PROFILE_SERVICE | ✅ Supported | ignore_user_profile_service |
| excludeVariables | EXCLUDE_VARIABLES | ✅ Supported | exclude_variables |
| overrideVisitorId | overrideVisitorId | ✅ FIXED | Was missing, now added |
| enableResponseMetadata | enableResponseMetadata | ❓ CHECK | enable_response_metadata? |
| enableDatafileFromKV | enableDatafileFromKV | ✅ Supported | datafile_from_kv |
| enableFlagsFromKV | enableFlagsFromKV | ✅ Supported | flags_from_kv |
| eventKey | eventKey | ✅ Supported | event_key |
| overrideCache | overrideCache | ✅ Supported | override_cache |
| setRequestHeaders | setRequestHeader | ✅ Supported | set_request_headers |
| setRequestCookies | setRequestCookies | ✅ Supported | set_request_cookies |
| setResponseHeaders | setResponseHeaders | ✅ Supported | set_response_headers |
| setResponseCookies | setResponseCookies | ✅ Supported | set_response_cookies |

### Body Parameters Support
| V1 Parameter | V2 Status | Notes |
|--------------|-----------|-------|
| visitorId | ✅ Supported | visitor_id |
| overrideVisitorId | ✅ FIXED | Was missing, now added |
| overrideCache | ✅ Supported | override_cache |
| flagKeys | ❓ CHECK | Need to verify |
| sdkKey | ✅ Supported | sdk_key |
| eventKey | ✅ Supported | event_key |
| attributes | ✅ Supported | attributes |
| eventTags | ❓ CHECK | Need to verify |
| enableResponseMetadata | ❓ CHECK | enable_response_metadata? |
| forcedDecisions | ✅ Supported | forced_decisions |
| enableFlagsFromKV | ✅ Supported | flags_from_kv |
| datafileFromKV | ✅ Supported | datafile_from_kv |
| decideAll | ✅ Supported | decide_all |
| disableDecisionEvent | ✅ Supported | disable_decision_event |
| enabledFlagsOnly | ✅ Supported | enabled_flags_only |
| includeReasons | ✅ Supported | include_reasons |
| ignoreUserProfileService | ✅ Supported | ignore_user_profile_service |
| excludeVariables | ✅ Supported | exclude_variables |
| trimmedDecisions | ✅ Supported | trimmed_decisions |
| setRequestHeaders | ✅ Supported | set_request_headers |
| setResponseHeaders | ✅ Supported | set_response_headers |
| setRequestCookies | ✅ Supported | set_request_cookies |
| setResponseCookies | ✅ Supported | set_response_cookies |

## Parameters that Need Verification

1. **eventTags** - Need to check if it's being extracted from all three sources
2. **enableDatafileFromKV** header - May be using wrong header name  
3. **enableResponseMetadata** - Need to verify extraction from all sources
4. **keys/flagKeys** - Query parameter for multiple flag keys
5. **eventTags** - Body parameter support

## Issues Found and Fixed

1. **overrideVisitorId** - Was completely missing from:
   - ConfigurationService header extraction ✅ FIXED
   - ConfigurationService query param extraction ✅ FIXED
   - ConfigurationService body extraction ✅ FIXED
   - RequestHandler legacy extraction was incomplete ✅ FIXED