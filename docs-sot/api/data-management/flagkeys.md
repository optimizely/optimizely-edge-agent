# Flag Keys Management API

Manage feature flag keys through the Edge Agent v2 API.

## Overview

The flag keys endpoint provides comprehensive flag key management capabilities including:
- **Automatic extraction** from datafiles (configurable)
- **Manual management** via API endpoints
- **Multiple source retrieval** (KV storage, CDN) with intelligent fallback
- **Administrative updates** with proper authentication

## Key Concepts

### Automatic Flag Key Extraction

The Edge Agent can **automatically extract and update flag keys** whenever a datafile is saved or updated:

- **Enabled by default**: `autoExtractFlagKeys: true`
- **Disable with environment variable**: `OPTIMIZELY_DISABLE_AUTO_FLAG_EXTRACTION=true`
- **Triggered on**: Datafile save operations (`PUT /api/datafile`)

**How it works:**
1. When a datafile is saved/updated
2. System extracts all `featureFlags[].key` and `experiments[].key` from the datafile
3. Automatically calls `setFlagKeys()` with the extracted keys
4. Updates KV storage with the current flag keys

### Manual Flag Key Management

You can also **manually control flag keys** independent of datafiles:
- Set custom flag key lists via API
- Override automatic extraction
- Manage flag keys without updating datafiles

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

## GET /api/flagkeys

Retrieve the current flag keys for your SDK key with intelligent source selection.

### Parameters

| Parameter | Source | Required | Description |
|-----------|---------|----------|-------------|
| `sdkKey` | Header: `X-Optimizely-SDK-Key`<br>Query: `sdkKey` | ✅ Yes | Your Optimizely SDK key |
| `flagsFromKV` | Query: `flagsFromKV=true` | ❌ No | Force retrieval from KV storage only |

### Source Prioritization Logic

The endpoint automatically selects the best source for flag keys:

1. **Explicit KV Request** (`?flagsFromKV=true`): KV storage only
2. **KV Enabled Configuration**: Try KV first, fallback to datafile extraction
3. **KV Disabled Configuration**: Extract from datafile/CDN only

### Response Format

**Success Response (200):**
```json
{
  "flagKeys": [
    "feature-flag-1",
    "experiment-flag-2", 
    "rollout-flag-3"
  ]
}
```

### Examples

#### Basic Flag Keys Retrieval
```bash
curl -X GET "https://your-deployment/api/flagkeys" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: your-sdk-key"
```

#### Force KV Storage Retrieval
```bash
curl -X GET "https://your-deployment/api/flagkeys?flagsFromKV=true" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: your-sdk-key"
```

## PUT /api/flagkeys

**Manually override** the flag keys list for your SDK key.

⚠️ **Important**: This **overrides automatic extraction**. If you manually set flag keys, they won't be automatically updated when datafiles change (unless you re-enable auto-extraction).

### Request Body Format

```json
{
  "flagKeys": [
    "your-flag-1",
    "your-flag-2",
    "your-flag-3"
  ]
}
```

### Parameters

| Parameter | Source | Required | Description |
|-----------|---------|----------|-------------|
| `sdkKey` | Header: `X-Optimizely-SDK-Key` | ✅ Yes | Your Optimizely SDK key |
| `flagKeys` | Request Body | ✅ Yes | Array of flag key strings |

### Examples

#### Manually Set Flag Keys (Override Auto-Extraction)
```bash
curl -X PUT "https://your-deployment/api/flagkeys" \
  -H "Content-Type: application/json" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: your-sdk-key" \
  -H "X-Optimizely-Admin-Token: your-admin-token" \
  -d '{
    "flagKeys": [
      "feature-payment-gateway",
      "experiment-checkout-flow",
      "rollout-new-ui"
    ]
  }'
```

#### Clear All Flag Keys
```bash
curl -X PUT "https://your-deployment/api/flagkeys" \
  -H "Content-Type: application/json" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: your-sdk-key" \
  -H "X-Optimizely-Admin-Token: your-admin-token" \
  -d '{
    "flagKeys": []
  }'
```

## POST /api/flagkeys

Create or update flag keys list (same functionality as PUT).

### Examples

#### Create Initial Flag Keys
```bash
curl -X POST "https://your-deployment/api/flagkeys" \
  -H "Content-Type: application/json" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: your-sdk-key" \
  -H "X-Optimizely-Admin-Token: your-admin-token" \
  -d '{
    "flagKeys": [
      "welcome-flow",
      "premium-features", 
      "beta-testing"
    ]
  }'
```

## Configuration Options

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OPTIMIZELY_DISABLE_AUTO_FLAG_EXTRACTION` | `false` | Set to `true` to disable automatic flag key extraction from datafiles |
| `OPTIMIZELY_ENABLE_FLAGS_FROM_KV` | `false` | Set to `true` to enable KV storage for flag keys |

### Auto-Extraction Behavior

#### Enabled (Default)
```bash
# Auto-extraction enabled
OPTIMIZELY_DISABLE_AUTO_FLAG_EXTRACTION=false  # or unset

# When you update a datafile:
curl -X PUT "/api/datafile?operation=refresh" \
  -H "X-Optimizely-SDK-Key: your-sdk-key"

# Flag keys are automatically extracted and updated
# GET /api/flagkeys returns the extracted keys
```

#### Disabled 
```bash
# Auto-extraction disabled  
OPTIMIZELY_DISABLE_AUTO_FLAG_EXTRACTION=true

# When you update a datafile:
curl -X PUT "/api/datafile?operation=refresh" \
  -H "X-Optimizely-SDK-Key: your-sdk-key"

# Flag keys are NOT automatically updated
# You must manually manage flag keys via PUT /api/flagkeys
```

## Use Cases and Workflows

### 1. **Automatic Management (Recommended)**
**Best for**: Most use cases where you want flag keys to stay in sync with datafiles

```bash
# 1. Enable auto-extraction (default)
export OPTIMIZELY_DISABLE_AUTO_FLAG_EXTRACTION=false

# 2. Update datafile - flag keys auto-update
curl -X PUT "/api/datafile?operation=refresh" \
  -H "X-Optimizely-SDK-Key: your-sdk-key"

# 3. Flag keys are automatically current
curl -X GET "/api/flagkeys" \
  -H "X-Optimizely-SDK-Key: your-sdk-key"
```

### 2. **Manual Control**
**Best for**: Curated flag lists, staging environments, or custom flag management

```bash
# 1. Disable auto-extraction
export OPTIMIZELY_DISABLE_AUTO_FLAG_EXTRACTION=true

# 2. Manually control which flags are active
curl -X PUT "/api/flagkeys" \
  -H "X-Optimizely-SDK-Key: your-sdk-key" \
  -H "X-Optimizely-Admin-Token: your-admin-token" \
  -d '{"flagKeys": ["prod-ready-flag-1", "tested-flag-2"]}'

# 3. Datafile updates won't change your curated list
curl -X PUT "/api/datafile?operation=refresh" \
  -H "X-Optimizely-SDK-Key: your-sdk-key"
# Flag keys remain unchanged
```

### 3. **Hybrid Approach**
**Best for**: Flexibility to switch between auto and manual as needed

```bash
# Start with auto-extraction
export OPTIMIZELY_DISABLE_AUTO_FLAG_EXTRACTION=false

# Let system auto-manage during development
curl -X PUT "/api/datafile?operation=refresh"

# Switch to manual for production deployment
export OPTIMIZELY_DISABLE_AUTO_FLAG_EXTRACTION=true

# Set production-ready flags only
curl -X PUT "/api/flagkeys" \
  -d '{"flagKeys": ["stable-feature-1", "tested-feature-2"]}'
```

## Error Responses

### 400 Bad Request - Missing SDK Key
```json
{
  "error": "SDK key is required"
}
```

### 400 Bad Request - Invalid Request Body
```json
{
  "error": "Invalid request body. Expected { flagKeys: string[] }"
}
```

### 400 Bad Request - KV Not Enabled
```json
{
  "error": "KV storage is not enabled for flag keys. Please enable it in configuration to use this feature."
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthorized"
}
```

### 404 Not Found - KV Storage
```json
{
  "error": "Flag keys not found in KV storage for the provided SDK key."
}
```

### 404 Not Found - Default Source
```json
{
  "error": "Flag keys not found for the provided SDK key."
}
```

### 500 Internal Server Error
```json
{
  "error": "Error accessing KV storage: [specific error message]"
}
```

## Best Practices

### Recommended Workflows

#### Development/Staging
```bash
# Use auto-extraction for easy development
export OPTIMIZELY_DISABLE_AUTO_FLAG_EXTRACTION=false

# Flags stay in sync with datafile changes automatically
curl -X PUT "/api/datafile?operation=refresh"
```

#### Production
```bash
# Use manual control for production stability
export OPTIMIZELY_DISABLE_AUTO_FLAG_EXTRACTION=true

# Manually control which flags are live
curl -X PUT "/api/flagkeys" \
  -d '{"flagKeys": ["production-ready-flags-only"]}'
```

#### Monitoring
```bash
# Check current flag configuration
curl -X GET "/api/flagkeys" -H "X-Optimizely-SDK-Key: your-key"

# Verify auto-extraction status in logs
# Look for: "auto flag key extraction enabled/disabled"
```

### Flag Key Naming Conventions
- Use descriptive, kebab-case names: `feature-payment-gateway`
- Include context: `experiment-checkout-v2`, `rollout-new-dashboard`
- Avoid special characters and spaces

## Related Endpoints

- **[Datafile Management](./datafile.md)** - Manage datafiles (triggers auto-extraction)
- **[Decision Making](../decisions/)** - Use flag keys to make decisions
- **[Debug Information](../admin/debug.md)** - Debug flag key configuration

## Troubleshooting

### Flag Keys Not Updating Automatically
```bash
# Check if auto-extraction is enabled
# Look for this log: "auto flag key extraction enabled"

# If disabled, enable it:
export OPTIMIZELY_DISABLE_AUTO_FLAG_EXTRACTION=false

# Restart your Edge Agent deployment
```

### Flag Keys Out of Sync with Datafile
```bash
# Force re-extraction by refreshing datafile
curl -X PUT "/api/datafile?operation=refresh" \
  -H "X-Optimizely-SDK-Key: your-sdk-key"

# This will trigger auto-extraction if enabled
```

### Manual Override Not Working
```bash
# Ensure you're using admin authentication
curl -X PUT "/api/flagkeys" \
  -H "X-Optimizely-Admin-Token: your-admin-token" \
  -d '{"flagKeys": ["your-flags"]}'

# Check that auto-extraction is disabled if you want permanent manual control
export OPTIMIZELY_DISABLE_AUTO_FLAG_EXTRACTION=true
```

---

**Implementation Source**: 
- Flag Keys API: `/src-v2/services/implementations/ApiRouter.ts:750-899`
- Auto-Extraction: `/src-v2/services/implementations/DatafileService.ts:262-273`
- Configuration: `/src-v2/compositionRoot.ts`

**Last Updated**: 2025-05-27