# Request Parameters Reference

## Overview

Request parameters allow per-request configuration of the Optimizely Edge Agent. Parameters can be provided via HTTP headers, query parameters, or request body, with a clear precedence order.

## Parameter Precedence

Parameters are resolved in this order (first found wins):
1. **HTTP Headers** (highest priority)
2. **URL Query Parameters**
3. **Request Body** (lowest priority)

## Core Parameters

### User Identification

| Parameter | Header | Query | Body | Description |
|-----------|--------|-------|------|-------------|
| `userId` / `visitorId` | `X-Optimizely-Visitor-Id` | `?userId=` or `?visitorId=` | `{ "userId": "..." }` | Unique user identifier |
| `overrideVisitorId` | `X-Optimizely-Override-Visitor-Id` | `?overrideVisitorId=true` | `{ "overrideVisitorId": true }` | Generate new visitor ID |

### SDK Configuration

| Parameter | Header | Query | Body | Description |
|-----------|--------|-------|------|-------------|
| `sdkKey` | `X-Optimizely-SDK-Key` | `?sdkKey=` | `{ "sdkKey": "..." }` | Optimizely SDK key |
| `enableFex` | `X-Optimizely-Enable-FEX` | `?enableFex=true` | `{ "enableFex": true }` | Enable Feature Experimentation |

### Decision Parameters

| Parameter | Header | Query | Body | Description |
|-----------|--------|-------|------|-------------|
| `flagKey` | `X-Optimizely-Flag-Key` | `?flagKey=` | `{ "flagKey": "..." }` | Single flag key for /decide |
| `flagKeys` | `X-Optimizely-Flag-Keys` | `?flagKeys=flag1,flag2` | `{ "flagKeys": [...] }` | Multiple flags for /decide-for-keys |
| `attributes` | `X-Optimizely-Attributes` | `?attributes={"key":"value"}` | `{ "attributes": {...} }` | User targeting attributes |
| `forcedDecisions` | `X-Optimizely-Forced-Decisions` | `?forced_decisions={"flag":{"variationKey":"on"}}` | `{ "forcedDecisions": {...} }` | Force specific variations |

### Decision Options

| Parameter | Header | Query | Body | Description |
|-----------|--------|-------|------|-------------|
| `decideOptions` | `X-Optimizely-Decide-Options` | `?decideOptions=INCLUDE_REASONS` | `{ "decideOptions": [...] }` | Decision behavior options |
| `trimmedDecisions` | `X-Optimizely-Trimmed-Decisions` | `?trimmedDecisions=true` | `{ "trimmedDecisions": true }` | Return minimal response |

Individual decide options can also be set as booleans:
- `includeReasons`
- `excludeVariables` 
- `enabledFlagsOnly`
- `disableDecisionEvent`
- `ignoreUserProfileService`

## Forced Decisions

Force specific variations for testing, QA, or debugging purposes. Forced decisions override normal bucketing logic.

### Format Options

#### Object Format
```json
{
  "forcedDecisions": {
    "flag1": { "variationKey": "treatment" },
    "flag2": { "variationKey": "control" }
  }
}
```

#### Array Format
```json
{
  "forcedDecisions": [
    { "flagKey": "flag1", "variationKey": "treatment" },
    { "flagKey": "flag2", "variationKey": "control" }
  ]
}
```

### Examples

#### Via Header
```bash
curl -X POST /api/decide \
  -H 'X-Optimizely-Forced-Decisions: {"test-flag":{"variationKey":"on"}}'
```

#### Via Query Parameter
```bash
curl -X POST '/api/decide?forced_decisions={"test-flag":{"variationKey":"on"}}'
```

#### Via Request Body
```json
{
  "flagKey": "test-flag",
  "userId": "user123",
  "forcedDecisions": {
    "test-flag": {
      "variationKey": "on"
    }
  }
}
```

## Response Control

| Parameter | Header | Query | Body | Default | Description |
|-----------|--------|-------|------|---------|-------------|
| `setResponseHeaders` | `X-Optimizely-Set-Response-Headers` | `?setResponseHeaders=false` | `{ "setResponseHeaders": false }` | `true` | Include decision headers |
| `setResponseCookies` | `X-Optimizely-Set-Response-Cookies` | `?setResponseCookies=false` | `{ "setResponseCookies": false }` | `true` | Set decision cookies |
| `enableResponseMetadata` | `X-Optimizely-Enable-Response-Metadata` | `?enableResponseMetadata=true` | `{ "enableResponseMetadata": true }` | `false` | Include metadata |

## Cache Control

| Parameter | Header | Query | Body | Description |
|-----------|--------|-------|------|-------------|
| `overrideCache` | `X-Optimizely-Override-Cache` | `?overrideCache=true` | `{ "overrideCache": true }` | Force cache refresh |
| `cacheControl` | `X-Optimizely-Cache-Control` | `?cacheControl=no-cache` | `{ "cacheControl": "no-cache" }` | Cache directive |

## Data Source Control

| Parameter | Header | Query | Body | Description |
|-----------|--------|-------|------|-------------|
| `datafileFromKV` | `X-Optimizely-Datafile-From-KV` | `?datafileFromKV=true` | `{ "datafileFromKV": true }` | Use KV-stored datafile |
| `enableFlagsFromKV` | `X-Optimizely-Enable-Flags-From-KV` | `?enableFlagsFromKV=true` | `{ "enableFlagsFromKV": true }` | Enable KV flag storage |

## Edge Mode Parameters

| Parameter | Header | Query | Body | Description |
|-----------|--------|-------|------|-------------|
| `serverMode` | `X-Optimizely-Server-Mode` | `?serverMode=edge` | `{ "serverMode": "edge" }` | Set operation mode |
| `cdnVariationSettings` | `X-Optimizely-CDN-Variation-Settings` | N/A | `{ "cdnVariationSettings": {...} }` | CDN configuration |

## Debug Parameters

| Parameter | Header | Query | Body | Description |
|-----------|--------|-------|------|-------------|
| `enableDebugHeaders` | `X-Optimizely-Enable-Debug-Headers` | `?enableDebugHeaders=true` | `{ "enableDebugHeaders": true }` | Enable debug info |
| `clientEngine` | `X-Optimizely-Client-Engine` | `?clientEngine=my-app` | `{ "clientEngine": "my-app" }` | Client identifier |
| `clientVersion` | `X-Optimizely-Client-Version` | `?clientVersion=1.0.0` | `{ "clientVersion": "1.0.0" }` | Client version |

## Example: Complete Request

```bash
curl -X POST https://edge.example.com/api/decide \
  -H "Content-Type: application/json" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: your-sdk-key" \
  -H "X-Optimizely-Enable-Response-Metadata: true" \
  -H 'X-Optimizely-Forced-Decisions: {"checkout_flow":{"variationKey":"express"}}' \
  -d '{
    "flagKey": "checkout_flow",
    "userId": "user123",
    "attributes": {
      "country": "US",
      "is_premium": true
    },
    "decideOptions": ["INCLUDE_REASONS"],
    "trimmedDecisions": false
  }'
```

## Parameter Type Conversion

### Boolean Parameters
- Accepted values: `true`, `false`, `"true"`, `"false"`, `1`, `0`
- Case insensitive

### Array Parameters
- Query: Comma-separated values (`?flags=flag1,flag2,flag3`)
- Header/Body: JSON arrays (`["flag1", "flag2", "flag3"]`)

### Object Parameters
- Must be valid JSON
- Query parameters should be URL-encoded
- Headers should be properly escaped

## Security Considerations

1. **Never expose SDK keys in client-side code**
2. **Use HTTPS for all API requests**
3. **Validate and sanitize all user inputs**
4. **Be cautious with forced decisions in production**
5. **Implement proper access controls for admin operations**

---

**Implementation Source**: `/src-v2/services/implementations/ConfigurationService.ts`  
**Last Updated**: 2025-06-04