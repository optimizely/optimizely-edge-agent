# Datafile Management API

Manage Optimizely datafiles through the Edge Agent v2 API.

## Overview

The datafile endpoint provides comprehensive datafile management with:
- **Automatic CDN fetching** when no body is provided (with `?operation=refresh`)
- **Automatic flag key extraction** from datafiles (configurable)
- **KV storage management** for both datafiles and flag keys
- **Multiple operation modes** for different workflows

## Critical Behavior: Flag Key Extraction

### Flag Key Auto-Extraction Control

The `OPTIMIZELY_DISABLE_AUTO_FLAG_EXTRACTION` environment variable controls automatic flag key extraction:

**When enabled (default behavior):**
- Flag keys are automatically extracted when datafiles are saved
- Happens during CDN refresh operations and manual updates
- Keeps flag keys synchronized with datafile content

**When disabled (`OPTIMIZELY_DISABLE_AUTO_FLAG_EXTRACTION=true`):**
- Automatic flag key extraction is disabled
- Flag keys must be managed independently via `/api/flagkeys`
- Allows for curated flag lists and environment-specific control

### 🔑 **Key Understanding**

**Benefits of disabling auto-extraction:**
- **Curated flag lists**: Only expose production-ready flags
- **Environment control**: Different flag sets per environment  
- **Performance**: Optimized, smaller flag lists
- **Safety**: Prevents accidental exposure of development flags

**When auto-extraction is disabled:**
- Datafile updates do NOT update flag keys
- Use `/api/flagkeys` to manage flag keys separately
- Allows independent lifecycle management

## Authentication

**Required Headers:**
```http
X-Optimizely-Enable-FEX: true
X-Optimizely-SDK-Key: your-sdk-key
```

**Admin Operations (PUT/POST) Additionally Require:**
```http
X-Optimizely-Admin-Token: your-admin-token
```

## GET /api/datafile

Retrieve the current datafile for your SDK key.

### Parameters

| Parameter | Source | Required | Description |
|-----------|---------|----------|-------------|
| `sdkKey` | Header: `X-Optimizely-SDK-Key`<br>Query: `sdkKey` | ✅ Yes | Your Optimizely SDK key |
| `datafileFromKV` | Query: `datafileFromKV=true` | ❌ No | Force retrieval from KV storage only |

### Retrieval Sources

1. **Default behavior**: Try KV storage first, fallback to CDN
2. **With `?datafileFromKV=true`**: KV storage only (no CDN fallback)
3. **KV disabled**: Always fetch from CDN

### Response Format

**Success Response (200):**
```json
{
  "version": "4",
  "projectId": "your-project-id",
  "experiments": [...],
  "featureFlags": [...],
  "groups": [...],
  "attributes": [...],
  "audiences": [...],
  "layers": [...],
  "events": [...],
  "revision": "123"
}
```

## PUT /api/datafile

Update datafile content with optional automatic flag key extraction.

### ⚠️ **Critical Behavior**

**When auto-extraction is enabled (default):**
1. Save the datafile to KV storage
2. Extract ALL flag keys from the datafile
3. REPLACE existing flag keys in KV storage
4. Return success response

**When auto-extraction is disabled (`OPTIMIZELY_DISABLE_AUTO_FLAG_EXTRACTION=true`):**
1. Save the datafile to KV storage
2. Flag keys are NOT extracted or updated
3. Existing flag keys remain unchanged
4. Return success response

### Operation Modes

#### 1. Refresh from CDN (`?operation=refresh`)
**No request body needed** - automatically fetches from Optimizely CDN:

```bash
curl -X PUT "https://your-deployment/api/datafile?operation=refresh" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: your-sdk-key" \
  -H "X-Optimizely-Admin-Token: your-admin-token"
```

**What happens:**
1. **Fetches latest datafile** from Optimizely CDN
2. **Saves to KV storage**
3. **Extracts flag keys** (if auto-extraction enabled)
4. **Updates flag keys** in KV storage (if extracted)
5. Returns success confirmation

**Response:**
```json
{
  "success": true,
  "operation": "refresh",
  "message": "Datafile refresh completed successfully"
}
```

#### 2. Update with Custom Datafile (Default)
**Provide datafile JSON in request body**:

```bash
curl -X PUT "https://your-deployment/api/datafile" \
  -H "Content-Type: application/json" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: your-sdk-key" \
  -H "X-Optimizely-Admin-Token: your-admin-token" \
  -d @your-datafile.json
```

**What happens:**
1. **Validates provided datafile** JSON
2. **Saves to KV storage**
3. **Extracts flag keys** (if auto-extraction enabled)
4. **Updates flag keys** in KV storage (if extracted)
5. Returns success confirmation

**Response:**
```json
{
  "success": true
}
```

#### 3. Create Minimal Datafile (`?allowEmpty=true`)
**For empty/new environments**:

```bash
curl -X PUT "https://your-deployment/api/datafile?allowEmpty=true" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: your-sdk-key" \
  -H "X-Optimizely-Admin-Token: your-admin-token"
```

**What happens:**
1. **Creates minimal datafile** structure
2. **Saves to KV storage**
3. **No flag keys to extract** (empty arrays)
4. **Flag keys unchanged** (nothing to extract)
5. Returns created datafile

### Operation Summary

| Operation | Body Required | Source | Flag Keys Action |
|-----------|---------------|---------|------------------|
| `refresh` | ❌ No | CDN | Updated if auto-extraction enabled |
| `sync` | ❌ No | CDN | Updated if auto-extraction enabled |
| `fetch` | ❌ No | CDN | Updated if auto-extraction enabled |
| `update` | ✅ Yes | Request body | Updated if auto-extraction enabled |
| `save` | ✅ Yes | Request body | Updated if auto-extraction enabled |
| `allowEmpty` | ❌ No | Generated | No change (empty datafile) |

### Parameters

| Parameter | Source | Required | Description |
|-----------|---------|----------|-------------|
| `sdkKey` | Header: `X-Optimizely-SDK-Key` | ✅ Yes | Your Optimizely SDK key |
| `operation` | Query: `operation=refresh` | ❌ No | Operation mode (default: update) |
| `allowEmpty` | Query: `allowEmpty=true`<br>Header: `X-Optimizely-Allow-Empty-Body: true` | ❌ No | Allow empty body for minimal datafile |

## POST /api/datafile

Same functionality as PUT with identical operation modes and configurable flag key extraction behavior.

## Workflows and Use Cases

### Scenario 1: Keep Datafile and Flag Keys in Sync (Default)
```bash
# With auto-extraction enabled (default)
# Refresh from CDN - datafile and flag keys both updated
curl -X PUT "/api/datafile?operation=refresh" \
  -H "X-Optimizely-SDK-Key: your-sdk-key" \
  -H "X-Optimizely-Admin-Token: your-admin-token"
```

### Scenario 2: Independent Flag Key Management
```bash
# With auto-extraction disabled (OPTIMIZELY_DISABLE_AUTO_FLAG_EXTRACTION=true)
# 1. Update datafile (flag keys NOT affected)
curl -X PUT "/api/datafile?operation=refresh" \
  -H "X-Optimizely-SDK-Key: your-sdk-key" \
  -H "X-Optimizely-Admin-Token: your-admin-token"

# 2. Manage flag keys separately when needed
curl -X PUT "/api/flagkeys" \
  -H "Content-Type: application/json" \
  -H "X-Optimizely-SDK-Key: your-sdk-key" \
  -H "X-Optimizely-Admin-Token: your-admin-token" \
  -d '{"flagKeys": ["prod-flag-1", "prod-flag-2"]}'
```

### Scenario 3: Curated Production Flag Lists
```bash
# With auto-extraction disabled
# Maintain a curated list of production-ready flags

# 1. Update datafile without affecting flag keys
curl -X PUT "/api/datafile?operation=refresh" \
  -H "X-Optimizely-SDK-Key: your-sdk-key" \
  -H "X-Optimizely-Admin-Token: your-admin-token"

# 2. Update flag keys only when new flags are production-ready
curl -X PUT "/api/flagkeys" \
  -H "Content-Type: application/json" \
  -H "X-Optimizely-SDK-Key: your-sdk-key" \
  -H "X-Optimizely-Admin-Token: your-admin-token" \
  -d '{"flagKeys": ["stable-feature-1", "stable-feature-2", "new-prod-feature"]}'
```

## Error Responses

### 400 Bad Request - Missing SDK Key
```json
{
  "error": "SDK key is required"
}
```

### 400 Bad Request - Empty Body Without allowEmpty
```json
{
  "error": "Invalid request body. Provide datafile JSON, use ?operation=refresh to fetch from CDN, or use ?allowEmpty=true to create minimal datafile"
}
```

### 403 Forbidden
```json
{
  "error": "Unauthorized"
}
```

### 404 Not Found
```json
{
  "error": "Failed to refresh datafile from CDN for SDK key your-sdk-key"
}
```

### 405 Method Not Allowed
```json
{
  "error": "Method not allowed"
}
```

### 500 Internal Server Error
```json
{
  "error": "Failed to refresh datafile: [specific error message]"
}
```

## Best Practices

### Understanding Flag Key Behavior

1. **Auto-extraction is configurable** via `OPTIMIZELY_DISABLE_AUTO_FLAG_EXTRACTION`
2. **Choose your strategy based on needs**:
   - **Synchronized keys** → Keep auto-extraction enabled (default)
   - **Curated flag lists** → Disable auto-extraction, manage via `/api/flagkeys`
   - **Environment-specific flags** → Disable auto-extraction for fine control
3. **Benefits of each approach**:
   - **Auto-extraction ON**: Simple, automatic synchronization
   - **Auto-extraction OFF**: Precise control, safety, performance

### Recommended Production Workflow
```bash
# 1. Refresh datafile and flag keys together
curl -X PUT "/api/datafile?operation=refresh" \
  -H "X-Optimizely-SDK-Key: your-sdk-key" \
  -H "X-Optimizely-Admin-Token: your-admin-token"

# 2. Verify both are updated
curl -X GET "/api/datafile" -H "X-Optimizely-SDK-Key: your-sdk-key"
curl -X GET "/api/flagkeys" -H "X-Optimizely-SDK-Key: your-sdk-key"
```

### Development/Testing Workflow
```bash
# Create test environment with custom flags
# 1. Create minimal datafile
curl -X PUT "/api/datafile?allowEmpty=true" \
  -H "X-Optimizely-SDK-Key: test-sdk-key" \
  -H "X-Optimizely-Admin-Token: admin-token"

# 2. Set test flag keys
curl -X PUT "/api/flagkeys" \
  -H "Content-Type: application/json" \
  -d '{"flagKeys": ["test-flag-1", "test-flag-2"]}'
```

## Related Endpoints

- **[Flag Keys Management](./flagkeys.md)** - Manage flag keys independently
- **[Decision Making](../decisions/)** - Use datafiles and flag keys
- **[Debug Information](../admin/debug.md)** - Debug configuration

## Important Notes

### Environment Variable Control
The `OPTIMIZELY_DISABLE_AUTO_FLAG_EXTRACTION` environment variable:
- **Controls ALL automatic flag extraction** including API operations
- Affects both API endpoints and internal DatafileService operations
- When set to `true`, datafile updates do NOT update flag keys
- Enables independent lifecycle management of datafiles and flag keys

### Storage Behavior
- **KV Enabled**: Stores both datafile and extracted flag keys
- **KV Disabled**: Limited functionality, consider your deployment needs

---

**Implementation Source**: 
- Datafile API: `/src-v2/services/implementations/ApiRouter.ts:325-696`
- Environment Variable Config: `/src-v2/compositionRoot.ts`
- Service Auto-Extraction: `/src-v2/services/implementations/DatafileService.ts:262-273`

**Last Updated**: 2025-05-27