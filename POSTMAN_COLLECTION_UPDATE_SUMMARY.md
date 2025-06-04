# Postman Collection Update Summary

Based on comprehensive analysis of the API documentation and source code, here are ALL the missing parameters that need to be added to the Optimizely Edge Agent v2 Postman collection:

## 🔧 Core Authentication Headers (Required/Standard)

### Required Headers
- `X-Optimizely-Enable-FEX: true` ✅ (Already present)
- `X-Optimizely-SDK-Key: {{sdkKey}}` ✅ (Already present)

### Admin Headers 
- `X-Optimizely-Admin-Token: {{adminToken}}` ✅ (Present but needs to be added to more endpoints)

## 📝 User & Request Identification Headers

### Missing Headers to Add:
- `X-Optimizely-Visitor-Id: ""` - User ID via header (highest precedence)
- `X-Optimizely-User-Id: ""` - Alternative user ID header
- `X-Optimizely-Flag-Key: ""` - Flag key via header (highest precedence)
- `X-Optimizely-Flag-Keys: ""` - Multiple flag keys as JSON array
- `X-Optimizely-Attributes: ""` - URL-encoded JSON attributes
- `X-Optimizely-Event-Key: ""` - Event key for tracking
- `X-Optimizely-Event-Tags: ""` - Event tags as JSON

## 🎯 Decision Control Headers

### Missing Decision Option Headers:
- `X-Optimizely-Decide-Options: []` - Processed decide options (already handled by pre-request script)
- `X-Optimizely-Decide-All: false` - Enable decide-all mode
- `X-Optimizely-Enabled-Flags-Only: false` - Only return enabled flags
- `X-Optimizely-Include-Reasons: false` - Include decision reasons
- `X-Optimizely-Exclude-Variables: false` - Exclude variables from response
- `X-Optimizely-Disable-Decision-Event: false` - Skip sending decision events
- `X-Optimizely-Ignore-User-Profile-Service: false` - Skip user profile service

### Missing Response Control Headers:
- `X-Optimizely-Trimmed-Decisions: true` - Return minimal response format
- `X-Optimizely-Override-Visitor-Id: false` - Generate new visitor ID
- `X-Optimizely-Set-Response-Headers: true` - Add decision info to response headers
- `X-Optimizely-Set-Response-Cookies: true` - Set decision cookies
- `X-Optimizely-Set-Request-Headers: true` - Set request headers
- `X-Optimizely-Set-Request-Cookies: true` - Set request cookies
- `X-Optimizely-Enable-Response-Metadata: false` - Include metadata in response

## 🔧 Performance & Debug Headers

### Missing Performance Headers:
- `X-Optimizely-Override-Cache: false` - Bypass cache
- `X-Optimizely-Flags-From-KV: false` - Force flag retrieval from KV storage
- `X-Optimizely-Datafile-From-KV: false` - Force datafile retrieval from KV storage
- `X-Optimizely-Debug-Headers: false` - Enable debug headers in response

### Missing Client Identification Headers:
- `X-Optimizely-Client-Engine: ""` - Client name (e.g., 'my-app')
- `X-Optimizely-Client-Version: ""` - Client version
- `X-Optimizely-Implementation-Version: ""` - Implementation version identifier

## 🚀 Advanced Configuration Headers

### Missing Advanced Headers:
- `X-Optimizely-Server-Mode: ""` - Server mode configuration
- `X-Optimizely-Datafile-Access-Token: ""` - Datafile access token
- `X-Optimizely-Forced-Decisions: ""` - Forced decision overrides as JSON
- `X-Optimizely-CDN-Settings: ""` - CDN-specific settings

## 📊 Query Parameters to Add

All headers above should also be available as query parameters with the same names (minus X-Optimizely- prefix):

### Core Parameters:
- `sdkKey` ✅ (Already present)
- `flagKey` ✅ (Already present)
- `userId` ✅ (Already present)
- `visitorId` - Alternative to userId
- `key` - Alternative to flagKey
- `attributes` - User attributes as URL-encoded JSON
- `decideOptions` - Comma-separated decision options

### Missing Control Parameters:
- `trimmedDecisions=true/false`
- `overrideVisitorId=true/false`
- `setResponseHeaders=true/false`
- `setResponseCookies=true/false`
- `setRequestHeaders=true/false`
- `setRequestCookies=true/false`
- `enableResponseMetadata=true/false`
- `clientEngine=string`
- `clientVersion=string`
- `overrideCache=true/false`
- `flagsFromKV=true/false`
- `datafileFromKV=true/false`
- `serverMode=string`
- `eventKey=string`
- `eventTags=json`

## 🔄 Request Body Parameters to Add

All parameters should be available in request body for POST requests:

### Current Body (needs expansion):
```json
{
  "flagKey": "your_flag_key",
  "userId": "user123",
  "attributes": {
    "device": "mobile",
    "plan": "premium"
  }
}
```

### Complete Body with ALL Parameters:
```json
{
  "flagKey": "your_flag_key",
  "key": null,
  "userId": "user123",
  "visitorId": null,
  "sdkKey": null,
  "attributes": {
    "device": "mobile",
    "plan": "premium",
    "country": "US",
    "age": 25,
    "beta_tester": true
  },
  "decideOptions": [],
  "trimmedDecisions": null,
  "overrideVisitorId": null,
  "setResponseHeaders": null,
  "setResponseCookies": null,
  "setRequestHeaders": null,
  "setRequestCookies": null,
  "enableResponseMetadata": null,
  "clientEngine": null,
  "clientVersion": null,
  "overrideCache": null,
  "flagsFromKV": null,
  "datafileFromKV": null,
  "serverMode": null,
  "eventKey": null,
  "eventTags": null,
  "datafileAccessToken": null,
  "forcedDecisions": null,
  "cdnSettings": null
}
```

## 🔄 Specific Endpoint Updates Needed

### Decision Endpoints:
1. **`/api/decide`** - Add all parameters above
2. **`/api/decide-all`** - Add all parameters (except flagKey/key)
3. **`/api/decide-for-keys`** - Add all parameters + flagKeys array
4. **`/api/decide` (GET)** - Add all query parameters

### Data Management Endpoints:
1. **`/api/datafile` (GET)** - Add:
   - `datafileFromKV=true/false` query parameter
   - `X-Optimizely-Datafile-From-KV` header

2. **`/api/datafile` (PUT)** - Add:
   - `operation=refresh/sync/fetch/update/save` query parameter
   - `allowEmpty=true/false` query parameter
   - `X-Optimizely-Allow-Empty-Body` header
   - All configuration headers

3. **`/api/flagkeys` (GET)** - Add all configuration headers

4. **`/api/flagkeys` (POST)** - Add:
   - Request body with `{"flagKeys": ["flag1", "flag2"]}`
   - All configuration headers

5. **`/api/sdk`** - Add all headers

### Admin Endpoints:
1. **`/api/set-forced-variation`** - Add:
   - `ruleKey` parameter
   - `experimentKey` parameter
   - All identification headers

2. **`/api/get-forced-variation`** - Add:
   - All identification headers
   - Support for POST method

3. **`/api/remove-forced-variation`** - Add:
   - Support for DELETE method
   - All identification headers

4. **`/api/remove-all-forced-decisions`** - Add:
   - Support for DELETE method
   - All identification headers

## 📋 Implementation Checklist

### For Each Endpoint:
- [ ] Add ALL authentication headers (required + optional)
- [ ] Add ALL decision control headers  
- [ ] Add ALL response control headers
- [ ] Add ALL performance/debug headers
- [ ] Add ALL client identification headers
- [ ] Add ALL advanced configuration headers
- [ ] Add corresponding query parameters for ALL headers
- [ ] Expand request body to include ALL possible fields
- [ ] Mark optional parameters as `disabled: true`
- [ ] Add clear descriptions for each parameter
- [ ] Group related parameters together
- [ ] Provide example values where appropriate

### Header Organization:
1. **Required Headers** (enabled by default)
2. **User Identification** (disabled by default)
3. **Decision Options** (disabled by default, except existing decide-options)
4. **Response Control** (disabled by default)
5. **Performance & Debug** (disabled by default)
6. **Client Identification** (disabled by default)
7. **Advanced Configuration** (disabled by default)
8. **Admin Operations** (disabled by default)

### Parameter Precedence Documentation:
Include in descriptions: "Parameter precedence: Headers > Query > Body"

This comprehensive update will make the Postman collection serve as a complete API reference with every documented parameter available for testing. 