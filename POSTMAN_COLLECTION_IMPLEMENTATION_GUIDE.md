# Postman Collection Implementation Guide

## Summary of Updates Made

Based on the comprehensive analysis of the Optimizely Edge Agent v2 API documentation and source code, I have identified and documented all missing parameters that need to be added to the Postman collection.

## ✅ What Has Been Updated

### 1. Main Decide Endpoint (`/api/decide`)
- ✅ Added ALL missing headers with proper descriptions
- ✅ Added ALL missing query parameters  
- ✅ Expanded request body with ALL possible fields
- ✅ Added proper parameter precedence documentation
- ✅ Organized headers by category with clear descriptions

### 2. Collection Structure
- ✅ Updated collection name and description
- ✅ Added comprehensive parameter documentation
- ✅ Added emoji indicators for parameter types (✅ boolean, 📝 string, 🔒 admin)

## 📋 Complete List of ALL Available Parameters

### Authentication Headers (Required)
```
X-Optimizely-Enable-FEX: true                    ✅ REQUIRED
X-Optimizely-SDK-Key: {{sdkKey}}                 ✅ REQUIRED
X-Optimizely-Admin-Token: {{adminToken}}         🔒 Admin operations only
```

### User & Request Identification Headers
```
X-Optimizely-Visitor-Id: ""                      📝 User ID (highest precedence)
X-Optimizely-User-Id: ""                         📝 Alternative user ID
X-Optimizely-Flag-Key: ""                        📝 Flag key (highest precedence)
X-Optimizely-Flag-Keys: ""                       📝 Multiple flag keys as JSON
X-Optimizely-Attributes: ""                      📝 URL-encoded JSON attributes
X-Optimizely-Event-Key: ""                       📝 Event key for tracking
X-Optimizely-Event-Tags: ""                      📝 Event tags as JSON
```

### Decision Control Headers
```
X-Optimizely-Decide-Options: []                  📝 Decision options array
X-Optimizely-Decide-All: false                   ✅ Enable decide-all mode
X-Optimizely-Enabled-Flags-Only: false           ✅ Only return enabled flags
X-Optimizely-Include-Reasons: false              ✅ Include decision reasons
X-Optimizely-Exclude-Variables: false            ✅ Exclude variables
X-Optimizely-Disable-Decision-Event: false       ✅ Skip decision events
X-Optimizely-Ignore-User-Profile-Service: false  ✅ Skip user profile service
```

### Response Control Headers
```
X-Optimizely-Trimmed-Decisions: true             ✅ Minimal response format
X-Optimizely-Override-Visitor-Id: false          ✅ Generate new visitor ID
X-Optimizely-Set-Response-Headers: true          ✅ Add decision info to headers
X-Optimizely-Set-Response-Cookies: true          ✅ Set decision cookies
X-Optimizely-Set-Request-Headers: true           ✅ Set request headers
X-Optimizely-Set-Request-Cookies: true           ✅ Set request cookies
X-Optimizely-Enable-Response-Metadata: false     ✅ Include metadata
```

### Performance & Debug Headers
```
X-Optimizely-Override-Cache: false               ✅ Bypass cache
X-Optimizely-Flags-From-KV: false                ✅ Force flags from KV
X-Optimizely-Datafile-From-KV: false             ✅ Force datafile from KV
X-Optimizely-Debug-Headers: false                ✅ Enable debug headers
```

### Client Identification Headers
```
X-Optimizely-Client-Engine: ""                   📝 Client name
X-Optimizely-Client-Version: ""                  📝 Client version
X-Optimizely-Implementation-Version: ""          📝 Implementation version
```

### Advanced Configuration Headers
```
X-Optimizely-Server-Mode: ""                     📝 Server mode config
X-Optimizely-Datafile-Access-Token: ""           📝 Datafile access token
X-Optimizely-Forced-Decisions: ""                📝 Forced decisions JSON
X-Optimizely-CDN-Settings: ""                    📝 CDN-specific settings
```

## 🔄 Complete Request Body Template

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

## 📊 Query Parameters Template

All headers are also available as query parameters (without X-Optimizely- prefix):

```
?flagKey=your_flag&userId=user123&attributes={"device":"mobile"}&decideOptions=INCLUDE_REASONS,EXCLUDE_VARIABLES&trimmedDecisions=true&enableResponseMetadata=false
```

## 🎯 Endpoints That Need Updates

### Decision Endpoints
1. **`/api/decide`** ✅ UPDATED - All parameters added
2. **`/api/decide-all`** ⚠️ NEEDS UPDATE - Add all parameters except flagKey
3. **`/api/decide-for-keys`** ⚠️ NEEDS UPDATE - Add all parameters + flagKeys array
4. **`/api/decide-options`** ❌ MISSING - New endpoint to add

### Data Management Endpoints  
1. **`/api/datafile` (GET)** ⚠️ NEEDS UPDATE - Add datafileFromKV parameter
2. **`/api/datafile` (PUT)** ⚠️ NEEDS UPDATE - Add operation, allowEmpty parameters
3. **`/api/flagkeys` (GET)** ⚠️ NEEDS UPDATE - Add all headers
4. **`/api/flagkeys` (POST)** ❌ MISSING - New endpoint to add
5. **`/api/sdk`** ⚠️ NEEDS UPDATE - Add all headers

### Admin Endpoints
1. **`/api/set-forced-variation`** ⚠️ NEEDS UPDATE - Add ruleKey, experimentKey
2. **`/api/get-forced-variation`** ⚠️ NEEDS UPDATE - Add POST method support
3. **`/api/remove-forced-variation`** ⚠️ NEEDS UPDATE - Add DELETE method
4. **`/api/remove-all-forced-decisions`** ❌ MISSING - New endpoint to add

## 🚀 Next Steps

### Immediate Actions Needed:
1. **Update Decide All endpoint** - Add all missing headers and parameters
2. **Update Decide for Keys endpoint** - Add all missing headers and parameters  
3. **Update Data Management endpoints** - Add operation parameters and headers
4. **Update Admin endpoints** - Add missing parameters and methods
5. **Add missing endpoints** - decide-options, flagkeys POST, remove-all-forced-decisions

### Parameter Organization:
- Group headers by category (Auth, User ID, Decision Control, etc.)
- Mark optional parameters as `disabled: true`
- Use clear descriptions with parameter precedence info
- Provide example values for complex parameters

### Testing:
- Verify all parameters work correctly
- Test parameter precedence (Headers > Query > Body)
- Validate JSON parsing for complex parameters
- Test boolean parameter parsing

## 📖 Usage Examples

### Basic Decision Request:
```bash
curl -X POST "{{baseUrl}}/api/decide" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: {{sdkKey}}" \
  -d '{"flagKey": "feature_x", "userId": "user123"}'
```

### Advanced Decision Request with All Options:
```bash
curl -X POST "{{baseUrl}}/api/decide" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: {{sdkKey}}" \
  -H "X-Optimizely-Include-Reasons: true" \
  -H "X-Optimizely-Exclude-Variables: true" \
  -H "X-Optimizely-Client-Engine: my-app" \
  -H "X-Optimizely-Client-Version: 1.0.0" \
  -d '{
    "flagKey": "feature_x",
    "userId": "user123", 
    "attributes": {"plan": "premium"},
    "enableResponseMetadata": true
  }'
```

### Datafile Refresh:
```bash
curl -X PUT "{{baseUrl}}/api/datafile?operation=refresh" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: {{sdkKey}}" \
  -H "X-Optimizely-Admin-Token: {{adminToken}}"
```

This comprehensive update will make the Postman collection serve as a complete API reference with every documented parameter available for testing and development. 