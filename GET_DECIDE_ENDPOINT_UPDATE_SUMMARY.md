# GET /decide Endpoint Update Summary

## Issue Identified
The GET `/api/decide` endpoint in the Postman collection was missing comprehensive headers and query parameters that were available in the POST version and documented in the API source code.

## Validation
✅ **Endpoint is Valid**: The GET `/api/decide` endpoint is fully supported by the Optimizely Edge Agent v2 API:
- Source code in `ApiRouter.ts` shows path-based routing without method filtering
- Documentation in `handleDecideRequest` explicitly shows GET examples
- Both GET and POST methods use the same underlying handler

## Updates Applied

### 1. **Header Parameters Added**
Added all comprehensive headers from the POST endpoint:

**🔒 Authentication & Core:**
- `X-Optimizely-Enable-FEX` (required)
- `X-Optimizely-SDK-Key` (required) 
- `X-Optimizely-Admin-Token` (admin)

**👤 User Identification:**
- `X-Optimizely-Visitor-Id` (highest precedence)
- `X-Optimizely-User-Id` (alternative)
- `X-Optimizely-Flag-Key` (highest precedence)
- `X-Optimizely-Attributes` (JSON)
- `X-Optimizely-Event-Key`
- `X-Optimizely-Event-Tags`

**⚙️ Decision Control:**
- `X-Optimizely-Decide-Options-*` (5 individual options)
- `X-Optimizely-Trimmed-Decisions`
- `X-Optimizely-Override-Visitor-Id`

**📤 Response Control:**
- `X-Optimizely-Set-Response-Headers`
- `X-Optimizely-Set-Response-Cookies`
- `X-Optimizely-Set-Request-Headers`
- `X-Optimizely-Set-Request-Cookies`
- `X-Optimizely-Response-Metadata`

**🚀 Performance:**
- `X-Optimizely-Override-Cache`
- `X-Optimizely-Flags-From-KV`
- `X-Optimizely-Datafile-From-KV`
- `X-Optimizely-Debug-Headers`

**🔧 Client Identification:**
- `X-Optimizely-Client-Engine`
- `X-Optimizely-Client-Version`
- `X-Optimizely-Implementation-Version`

**🏗️ Advanced:**
- `X-Optimizely-Server-Mode`
- `X-Optimizely-Datafile-Access-Token`
- `X-Optimizely-Forced-Decisions`
- `X-Optimizely-CDN-Settings`

### 2. **Query Parameters Added**
Added comprehensive query parameters matching header functionality:

**📝 Core Parameters:**
- `flagKey` / `key` (required, alternative names)
- `userId` / `visitorId` (alternative user identification)
- `sdkKey` (lower precedence than header)
- `attributes` (JSON format)
- `eventKey` / `eventTags`

**⚙️ Decision Options:**
- `decideOptions` (JSON array)
- `trimmedDecisions` (boolean)
- `overrideVisitorId` (boolean)

**📤 Response/Request Control:**
- `setResponseHeaders/Cookies` (boolean)
- `setRequestHeaders/Cookies` (boolean)
- `responseMetadata` (boolean)

**🚀 Performance & Caching:**
- `overrideCache` (boolean)
- `flagsFromKV` (boolean)
- `datafileFromKV` (boolean)
- `debugHeaders` (boolean)

**🔧 Client & Advanced:**
- `clientEngine` / `clientVersion`
- `implementationVersion`
- `serverMode` (boolean)
- `datafileAccessToken`
- `forcedDecisions` (JSON)
- `cdnSettings` (JSON)

### 3. **Parameter Configuration**
- **All optional parameters disabled by default** to keep endpoint clean
- **Required parameters highlighted** with ✅ and clear descriptions
- **Admin parameters marked** with 🔒 and proper warnings
- **Parameter precedence documented** (Headers > Query > Body)

### 4. **Scripts Added**
- **Pre-request script**: Same decide options processing as POST endpoint
- **Test script**: Validates response structure and status codes

## Parameter Precedence (As Per Source Code)
Based on `ApiRouter.ts` analysis:

1. **Headers** (highest precedence)
2. **Query parameters** (medium precedence)  
3. **Request body** (lowest precedence - N/A for GET)

This matches the documented behavior in the source code where header values override query parameters.

## Collection Status
✅ **GET /decide endpoint now has full parity** with the POST endpoint
✅ **All documented API parameters included**
✅ **Proper parameter categorization and descriptions**
✅ **Consistent with source code implementation**

## Usage Examples

### Basic Usage:
```
GET /api/decide?flagKey=my_feature&userId=user123
Headers:
  X-Optimizely-Enable-FEX: true
  X-Optimizely-SDK-Key: your_sdk_key
```

### Advanced Usage:
```
GET /api/decide?flagKey=my_feature&userId=user123&attributes={"platform":"mobile"}&decideOptions=["INCLUDE_REASONS"]&responseMetadata=true
Headers:
  X-Optimizely-Enable-FEX: true
  X-Optimizely-SDK-Key: your_sdk_key
  X-Optimizely-Override-Visitor-Id: true
```

## Next Steps
The GET endpoint is now complete and ready for testing. Consider similar updates for:
- GET `/api/decide-all` 
- Other GET endpoints that may be missing comprehensive parameters 