# API Authentication Guide

Configure authentication and authorization for Edge Agent API access.

## Overview

The Edge Agent uses a simple authentication approach with three main components:
1. **FEX Enablement** - Controls whether Optimizely processing occurs
2. **SDK Key** - Project identification (minimal validation)
3. **Admin Token** - Administrative operations authorization

## Required for Optimizely Processing

### 1. FEX Enablement Header

**To enable Optimizely processing:**
```http
X-Optimizely-Enable-FEX: true
```

**Behavior when missing or false:**
- Requests are processed normally but bypass Optimizely logic
- Returns 200 response with bypass information
- **No error is returned** - this is graceful degradation

```json
{
  "bypass": true,
  "message": "Optimizely processing bypassed because X-Optimizely-Enable-FEX is false"
}
```

### 2. SDK Key

**Required for all Optimizely operations:**

SDK keys are accepted from multiple sources (in precedence order):
1. Header: `X-Optimizely-SDK-Key` or `x-optimizely-sdk-key`
2. Query parameter: `?sdkKey=your-key`
3. Request body: `{ "sdkKey": "your-key" }`

**Example:**
```bash
# Via header (recommended)
curl -X GET "https://your-deployment/api/datafile" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: your-sdk-key"

# Via query parameter
curl -X GET "https://your-deployment/api/datafile?sdkKey=your-sdk-key" \
  -H "X-Optimizely-Enable-FEX: true"
```

**SDK Key Validation:**
- Only checks if present (not null/empty)
- Must be a non-empty string
- Whitespace is trimmed
- **No format, length, or content validation**
- **No authentication against Optimizely services at API layer**

## Admin Operations

### Admin Token

**Required for write operations:**

```http
X-Optimizely-Admin-Token: your-admin-token
```

**Configuration:**
Set via environment variable:
```bash
ADMIN_TOKEN=your-secure-admin-token
```

**Endpoints requiring admin token:**
- `PUT/POST /api/datafile`
- `PUT/POST /api/flagkeys`
- `POST /api/set-forced-variation`
- `POST /api/remove-forced-variation`
- `POST /api/remove-all-forced-decisions`
- All `/api/admin/*` endpoints

**Admin Token Validation:**
From `ApiRouter.ts`:
```typescript
private async isAdminRequest(requestAdapter: IRequestAdapter): Promise<boolean> {
  const adminToken = requestAdapter.getHeader('X-Optimizely-Admin-Token');
  const configToken = this.configService.getAdminToken();
  
  if (!adminToken || !configToken) {
    return false;
  }
  
  return adminToken === configToken;
}
```

Simple string comparison - no sophisticated validation.

## Authentication Patterns

### Basic API Request

```javascript
const headers = {
  'Content-Type': 'application/json',
  'X-Optimizely-Enable-FEX': 'true',
  'X-Optimizely-SDK-Key': SDK_KEY
};

const response = await fetch('/api/decide', {
  method: 'POST',
  headers,
  body: JSON.stringify({
    flagKey: 'feature_x',
    userId: 'user123'
  })
});
```

### Admin Operation

```javascript
const adminHeaders = {
  'Content-Type': 'application/json',
  'X-Optimizely-Enable-FEX': 'true',
  'X-Optimizely-SDK-Key': SDK_KEY,
  'X-Optimizely-Admin-Token': ADMIN_TOKEN
};

const response = await fetch('/api/datafile?operation=refresh', {
  method: 'PUT',
  headers: adminHeaders
});
```

### Client with Full Headers

```javascript
class OptimizelyClient {
  constructor(config) {
    this.baseUrl = config.baseUrl;
    this.sdkKey = config.sdkKey;
    this.adminToken = config.adminToken;
  }
  
  getHeaders(includeAdmin = false) {
    const headers = {
      'Content-Type': 'application/json',
      'X-Optimizely-Enable-FEX': 'true',
      'X-Optimizely-SDK-Key': this.sdkKey
    };
    
    if (includeAdmin && this.adminToken) {
      headers['X-Optimizely-Admin-Token'] = this.adminToken;
    }
    
    return headers;
  }
  
  async decide(flagKey, userId, attributes) {
    const response = await fetch(`${this.baseUrl}/api/decide`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ flagKey, userId, attributes })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error);
    }
    
    return response.json();
  }
  
  async refreshDatafile() {
    const response = await fetch(`${this.baseUrl}/api/datafile?operation=refresh`, {
      method: 'PUT',
      headers: this.getHeaders(true) // Include admin token
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error);
    }
    
    return response.json();
  }
}
```

## Error Responses

### Common Authentication Errors

| Error Response | Status | Cause | Solution |
|---------------|--------|--------|----------|
| `{"error": "SDK key is required"}` | 400 | Missing SDK key | Add SDK key via header, query, or body |
| `{"error": "Unauthorized"}` | 403 | Missing/invalid admin token | Check admin token is correct |
| `{"bypass": true, "message": "..."}` | 200 | FEX header missing/false | Not an error - bypass mode |

### No Authentication Errors

The Edge Agent does **not** return these errors:
- Invalid SDK key format errors
- SDK key authentication failures
- Expired token errors
- JWT validation errors

## Security Considerations

### 1. SDK Key Handling

From the implementation:
```typescript
// SDK keys are masked in logs for security
sdkKey: sdkKey ? `${sdkKey.substring(0, 4)}...` : undefined
```

SDK keys are treated as sensitive but validation is minimal.

### 2. Admin Token Security

```javascript
// Environment variables (recommended)
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

// Secure secret management (better)
const ADMIN_TOKEN = await secretManager.getSecret('optimizely-admin-token');
```

### 3. HTTPS Required

Always use HTTPS in production:
```javascript
if (window.location.protocol !== 'https:' && !isDevelopment) {
  throw new Error('HTTPS required for Optimizely API access');
}
```

## Environment Configuration

### Required Environment Variables

```bash
# Admin token for write operations
ADMIN_TOKEN=your-secure-admin-token

# Optional environment identification
ENVIRONMENT=production
CDN_PROVIDER=cloudflare
```

### Platform-Specific Setup

**Cloudflare Workers:**
```toml
# wrangler.toml
[env.production.vars]
ADMIN_TOKEN = "your-token"
```

**Fastly Compute@Edge:**
```toml
# fastly.toml
[setup.config_stores.optimizely_config]
items = { ADMIN_TOKEN = "your-token" }
```

**Vercel Edge Functions:**
```json
{
  "env": {
    "ADMIN_TOKEN": "your-token"
  }
}
```

## Debugging Authentication

### Check Configuration

```bash
# Verify admin token is set (returns sanitized info)
curl -X GET "https://your-deployment/api/admin/status" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-Admin-Token: your-token"
```

### Common Issues

1. **FEX Bypass Mode**
   - Ensure header: `X-Optimizely-Enable-FEX: true`
   - Check for typos in header name

2. **SDK Key Not Found**
   - Verify header: `X-Optimizely-SDK-Key: your-key`
   - Check precedence: header > query > body
   - Ensure key is not empty string

3. **Admin Operations Fail**
   - Verify admin token is set in environment
   - Check header: `X-Optimizely-Admin-Token: your-token`
   - Ensure exact string match

## Metrics and Monitoring

The Edge Agent tracks authentication metrics:

```typescript
// Error tracking from ApiRouter.ts
this.metrics?.incrementCounter('api_errors_total', 1, {
  endpoint: '/api/endpoint',
  method: 'POST',
  error_type: 'missing_sdk_key'
});
```

Monitor these authentication-related metrics:
- `api_errors_total` with `error_type: 'missing_sdk_key'`
- Admin operation success/failure rates

## See Also

- [API Reference](./README.md) - Complete endpoint documentation
- [Error Handling](./error-handling.md) - Authentication error responses
- [Quick Start](./quick-start.md) - First API calls
- [Configuration](../configuration/) - Environment setup

---

**Implementation References**:
- API Router: `/src-v2/services/implementations/ApiRouter.ts:3789-3805`
- Config Service: `/src-v2/services/implementations/ConfigService.ts:137-148`

**Last Updated**: 2025-05-30