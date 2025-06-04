# Error Handling

Understanding error responses from the Optimizely Edge Agent API.

## Overview

The Edge Agent API returns standard HTTP status codes and JSON error responses. All error responses follow a simple, consistent format.

## Error Response Format

Error responses use a simple JSON structure:

```json
{
  "error": "Error message describing the issue"
}
```

Note: The current implementation does **not** include:
- Error codes (beyond HTTP status)
- Request IDs
- Timestamps
- Detailed error objects
- Stack traces

## HTTP Status Codes

### 2xx Success

| Status | Meaning | Usage |
|--------|---------|-------|
| 200 | OK | Request succeeded |

### 4xx Client Errors

| Status | Error Messages | Common Causes |
|--------|----------------|---------------|
| 400 | **Bad Request** | Missing required parameters or invalid data |
| | "SDK key is required" | No SDK key in headers, query, or body |
| | "Missing userId or visitorId" | User identification required but not provided |
| | "Missing flagKey" | Flag key parameter required but not provided |
| | "Invalid request body" | Malformed JSON or missing required fields |
| | "KV storage is not enabled" | Feature requested but not configured |
| 403 | **Forbidden** | Authentication/authorization failure |
| | "Unauthorized" | Missing or invalid admin token for write operations |
| 404 | **Not Found** | Requested resource doesn't exist |
| | "Datafile not found" | No datafile for the SDK key |
| | "Flag keys not found" | No flag keys for the SDK key |
| | "Unknown admin endpoint" | Invalid admin API path |

### 5xx Server Errors

| Status | Error Messages | Common Causes |
|--------|----------------|---------------|
| 500 | **Internal Server Error** | Unexpected errors |
| | "Error processing [endpoint] request" | General processing failure |
| | "Error accessing KV storage" | Storage backend failure |
| | "User context creation failed" | SDK initialization error |
| | "Failed to [operation]" | Specific operation failure |

## Common Error Scenarios

### Missing Required Header

```bash
curl -X POST "https://your-deployment/api/decide" \
  -H "Content-Type: application/json" \
  -d '{"flagKey": "feature", "userId": "user123"}'
```

**Response (400):**
```json
{
  "error": "SDK key is required"
}
```

Note: The Edge Agent is disabled by default. All API requests require the `X-Optimizely-Enable-FEX: true` header, but if missing, requests pass through without Optimizely processing rather than returning an error.

### Missing SDK Key

```bash
curl -X POST "https://your-deployment/api/decide" \
  -H "X-Optimizely-Enable-FEX: true" \
  -d '{"flagKey": "feature", "userId": "user123"}'
```

**Response (400):**
```json
{
  "error": "SDK key is required"
}
```

### Unauthorized Access

```bash
curl -X PUT "https://your-deployment/api/datafile?sdkKey=valid-key" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "Content-Type: application/json" \
  -d '{"revision": "123"}'
```

**Response (403):**
```json
{
  "error": "Unauthorized"
}
```

### Resource Not Found

```bash
curl -X GET "https://your-deployment/api/datafile?sdkKey=invalid-key" \
  -H "X-Optimizely-Enable-FEX: true"
```

**Response (404):**
```json
{
  "error": "Datafile not found for the provided SDK key."
}
```

### KV Storage Not Enabled

```bash
curl -X GET "https://your-deployment/api/datafile?sdkKey=valid-key&datafileFromKV=true" \
  -H "X-Optimizely-Enable-FEX: true"
```

**Response (400):**
```json
{
  "error": "KV storage is not enabled for datafiles. Please enable it in configuration to use this feature."
}
```

## Error Handling by Endpoint

### `/api/datafile`

| Method | Error | Status | Message |
|--------|-------|--------|---------|
| GET/POST/PUT | Missing SDK key | 400 | "SDK key is required" |
| GET | KV not enabled | 400 | "KV storage is not enabled for datafiles..." |
| GET | Not found in KV | 404 | "Datafile not found in KV storage..." |
| GET | Not found | 404 | "Datafile not found for the provided SDK key." |
| POST/PUT | Unauthorized | 403 | "Unauthorized" |
| POST/PUT | Invalid body | 400 | "Invalid request body..." |
| ALL | Processing error | 500 | "Error processing datafile request" |

### `/api/decide`

| Error | Status | Message |
|-------|--------|---------|
| Missing user ID | 400 | "userId is required (can also be provided as visitorId...)" |
| Missing flag key | 400 | "flagKey parameter is required..." |
| Flag disabled | 404 | "Flag disabled for user" (with ENABLED_FLAGS_ONLY) |
| Decision error | 500 | "Error getting decision" |
| Processing error | 500 | "Error processing decide request" |

### `/api/decide-all`

| Error | Status | Message |
|-------|--------|---------|
| Missing user ID | 400 | "userId is required..." |
| Missing SDK key | 400 | "sdkKey is required" |
| Decision error | 500 | "Error getting decisions for all flags" |
| Processing error | 500 | "Error processing decide-all request" |

### `/api/decide-for-keys`

| Error | Status | Message |
|-------|--------|---------|
| Missing user ID | 400 | "userId is required..." |
| Missing SDK key | 400 | "sdkKey is required" |
| Missing/invalid keys | 400 | "flagKeys or keys is required and must be an array" |
| Decision error | 500 | "Error getting decisions for keys" |
| Processing error | 500 | "Error processing decide-for-keys request" |

### Forced Variation Endpoints

| Endpoint | Error | Status | Message |
|----------|-------|--------|---------|
| `/api/set-forced-variation` | Missing body | 400 | "Missing request body" |
| | Missing user | 400 | "Missing userId or visitorId" |
| | Missing flag | 400 | "Missing flagKey" |
| | Missing variation | 400 | "Missing variationKey" |
| | Context error | 500 | "User context creation failed" |
| `/api/remove-forced-variation` | Similar patterns | 400/500 | Similar messages |

## Client Error Handling

### Basic Error Handler

```javascript
async function makeApiRequest(endpoint, options) {
  try {
    const response = await fetch(endpoint, options);
    
    if (!response.ok) {
      const error = await response.json();
      
      switch (response.status) {
        case 400:
          console.error('Bad request:', error.error);
          // Handle missing parameters
          break;
        case 403:
          console.error('Unauthorized:', error.error);
          // Handle auth failure
          break;
        case 404:
          console.error('Not found:', error.error);
          // Handle missing resource
          break;
        case 500:
          console.error('Server error:', error.error);
          // Handle server failure
          break;
      }
      
      throw new Error(error.error);
    }
    
    return response.json();
  } catch (error) {
    console.error('Request failed:', error);
    throw error;
  }
}
```

### Retry Logic for Server Errors

```javascript
async function requestWithRetry(endpoint, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(endpoint, options);
      
      if (response.ok) {
        return response.json();
      }
      
      // Only retry on 500 errors
      if (response.status >= 500 && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000; // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // Don't retry client errors
      const error = await response.json();
      throw new Error(error.error);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      // Network error - retry
      const delay = Math.pow(2, i) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

### Graceful Degradation

```javascript
class OptimizelyClient {
  async getDecision(flagKey, userId, defaultValue = false) {
    try {
      const response = await fetch('/api/decide', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Optimizely-Enable-FEX': 'true',
          'X-Optimizely-SDK-Key': this.sdkKey
        },
        body: JSON.stringify({ flagKey, userId })
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.error(`Decision failed: ${error.error}`);
        return { enabled: defaultValue };
      }
      
      return response.json();
    } catch (error) {
      // Network or parsing error
      console.error('Decision request failed:', error);
      return { enabled: defaultValue };
    }
  }
}
```

## Debugging Errors

### Using Verbose Logging

Enable debug logging by setting the log level:
```javascript
// The Edge Agent respects log levels but doesn't have a debug endpoint
const headers = {
  'X-Optimizely-Enable-FEX': 'true',
  'X-Optimizely-SDK-Key': 'your-key'
};
```

### Common Troubleshooting

1. **"SDK key is required"**
   - Check headers: `X-Optimizely-SDK-Key`
   - Check query: `?sdkKey=your-key`
   - Check body: `{ "sdkKey": "your-key" }`

2. **"Unauthorized"**
   - Verify admin token is set
   - Check header: `X-Optimizely-Admin-Token`
   - Ensure token matches server configuration

3. **"Datafile not found"**
   - Verify SDK key is correct
   - Check if datafile exists in CDN
   - Try refreshing: `?operation=refresh`

4. **KV Storage Errors**
   - Ensure KV namespace is bound
   - Check platform configuration
   - Verify KV is enabled in settings

## Metrics and Monitoring

The Edge Agent tracks errors via metrics:

```typescript
// Error counters tracked in implementation
this.metrics?.incrementCounter('api_errors_total', 1, {
  endpoint: '/api/endpoint',
  method: 'POST',
  error_type: 'missing_sdk_key'
});
```

Monitor these metrics in your platform's dashboard:
- `api_errors_total` - Total errors by endpoint and type
- `datafile_requests_total` - Datafile request metrics
- `decide_requests_total` - Decision request metrics

## See Also

- [API Reference](./README.md) - Complete API documentation
- [Authentication](./authentication.md) - Authentication setup
- [Debugging Guide](../troubleshooting/) - Detailed troubleshooting

---

**Implementation Reference**: `/src-v2/services/implementations/ApiRouter.ts`  
**Last Updated**: 2025-05-30