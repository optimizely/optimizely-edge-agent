# Actual API Endpoints - Extracted from ApiRouter.ts

## Overview
This document contains the actual API endpoints implemented in the v2 TypeScript codebase, extracted directly from `src-v2/services/implementations/ApiRouter.ts`.

## API Endpoints Discovered

### Core API Endpoints (Lines 233-273 in ApiRouter.ts)

#### 1. **Datafile Management**
- **Endpoint**: `/api/datafile`
- **Methods**: GET, PUT, POST
- **Handler**: `handleDatafileRequest()`
- **Documentation Reference**: Lines 325-349

**GET Behavior:**
- Retrieve datafile from KV storage or CDN
- Query parameter: `?datafileFromKV=true` (force KV-only retrieval)

**PUT/POST Behavior (Admin only):**
- Default: Save datafile JSON from request body to KV storage
- Operation modes via `?operation` parameter:
  - `?operation=refresh` - Fetch from Optimizely CDN and save to KV
  - `?operation=sync` - Alias for refresh
  - `?operation=fetch` - Alias for refresh  
  - `?operation=update` - Default behavior (save provided body)
  - `?operation=save` - Alias for update
- Empty body handling: `?allowEmpty=true` for minimal datafile structure

#### 2. **Flag Keys Management**
- **Endpoint**: `/api/flagkeys`
- **Methods**: GET, PUT, POST (inferred)
- **Handler**: `handleFlagKeysRequest()`

#### 3. **SDK Information**
- **Endpoint**: `/api/sdk`
- **Handler**: `handleSdkInfoRequest()`

#### 4. **Variations Management**
- **Endpoint**: `/api/variations`
- **Handler**: `handleVariationsRequest()`

#### 5. **Decision Endpoints**

##### Single Decision
- **Endpoint**: `/api/decide`
- **Handler**: `handleDecideRequest()`

##### All Decisions
- **Endpoint**: `/api/decide-all`
- **Handler**: `handleDecideAllRequest()`

##### Multiple Specific Flags
- **Endpoint**: `/api/decide-for-keys`
- **Handler**: `handleDecideForKeysRequest()`

##### Decision Options
- **Endpoint**: `/api/decide-options`
- **Handler**: `handleDecideOptionsRequest()`

#### 6. **Forced Variation Management**

##### Set Forced Variation
- **Endpoint**: `/api/set-forced-variation`
- **Handler**: `handleSetForcedVariationRequest()`

##### Get Forced Variation
- **Endpoint**: `/api/get-forced-variation`
- **Handler**: `handleGetForcedVariationRequest()`

##### Remove Forced Variation
- **Endpoint**: `/api/remove-forced-variation`
- **Handler**: `handleRemoveForcedVariationRequest()`

##### Remove All Forced Decisions
- **Endpoint**: `/api/remove-all-forced-decisions`
- **Handler**: `handleRemoveAllForcedDecisionsRequest()`

#### 7. **Debug Endpoint**
- **Endpoint**: `/api/debug`
- **Handler**: `handleDebugRequest()`

#### 8. **Administrative Endpoints**
- **Endpoint Pattern**: `/api/admin/*`
- **Handler**: `handleAdminRequest()`

## Technical Implementation Details

### Common Headers
- **Implementation Version**: `X-Implementation-Version: v2` (automatically added)
- **Request ID**: `X-Request-ID: {requestId}` (automatically added)
- **FEX Control**: `X-Optimizely-Enable-FEX` (required for processing)
- **Admin Token**: `X-Optimizely-Admin-Token` (required for admin operations)
- **SDK Key**: `X-Optimizely-SDK-Key` (required for most operations)

### Error Handling
- Unknown endpoints return 404 with `{ error: "Unknown endpoint" }`
- Internal errors return 500 with proper error response
- FEX disabled returns 200 with bypass message

### Metrics Tracking
All endpoints include comprehensive metrics:
- Request counters by method and endpoint
- Response status tracking
- Error counting with categorization
- Request duration timing

### Request Configuration Interface
Lines 17-55 define comprehensive `RequestConfig` interface including:
- SDK key and user context
- Header/cookie control flags
- Configuration metadata tracking
- Decision data structure

## Validation Against Documentation Claims

### `/05-22-2025_docs/flagKeys-api.md` Claims Analysis
**Claimed endpoints in documentation:**
- ❓ `GET /api/flagkeys` - **VERIFIED** (actual endpoint exists)
- ❓ `PUT /api/flagkeys` - **NEEDS VERIFICATION** (handler exists but specifics unknown)
- ❓ `GET /v1/api/flag_keys` - **NOT FOUND** (v1 legacy endpoint not implemented in v2)
- ❓ `POST /v1/api/flag_keys` - **NOT FOUND** (v1 legacy endpoint not implemented in v2)

**Next Steps Required:**
1. Examine `handleFlagKeysRequest()` implementation to verify actual behavior
2. Check if v1 legacy endpoints are handled elsewhere
3. Validate parameter handling and authentication requirements

### Key Findings
1. **Comprehensive API Surface**: 15+ distinct endpoints implemented
2. **Well-Structured Routing**: Clean endpoint-to-handler mapping
3. **Rich Documentation**: Inline JSDoc provides detailed behavior descriptions
4. **Metrics Integration**: Full observability for all endpoints
5. **Admin Security**: Proper admin token validation for administrative operations

## Next Analysis Required
1. Examine individual handler implementations for detailed parameter specifications
2. Validate authentication mechanisms and requirements
3. Document response formats and error codes
4. Cross-reference with v1 implementation for migration completeness