# Administrative API Endpoints

Administrative and debugging endpoints for the Edge Agent.

## Overview

Administrative endpoints provide:
- **Forced variations** for testing and QA
- **Debug information** for troubleshooting
- **Cache management** operations
- **Status monitoring** capabilities

## Available Endpoints

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| [`/api/debug`](./debug.md) | POST | Debug configuration and parameters | FEX only |
| [`/api/set-forced-variation`](./forced-variations.md#postput-apiset-forced-variation) | POST/PUT | Set forced variation | Admin token* |
| [`/api/get-forced-variation`](./forced-variations.md#getpost-apiget-forced-variation) | GET/POST | Get forced variation | FEX only |
| [`/api/remove-forced-variation`](./forced-variations.md#postdelete-apiremove-forced-variation) | POST/DELETE | Remove forced variation | Admin token* |
| [`/api/remove-all-forced-decisions`](./forced-variations.md#postdelete-apiremove-all-forced-decisions) | POST/DELETE | Remove all forced decisions | Admin token* |
| `/api/admin/cache/clear` | POST | Clear cache | Admin token |
| `/api/admin/status` | GET | Service status | Admin token |

*Admin token may be required depending on deployment configuration.

## Authentication

### Basic Requirements
All admin endpoints require:
```http
X-Optimizely-Enable-FEX: true
```

### Admin Token
Write operations typically require:
```http
X-Optimizely-Admin-Token: your-admin-token
```

The admin token is configured via environment variable:
```bash
OPTIMIZELY_ADMIN_TOKEN=your-secure-token
```

## Common Use Cases

### 1. Debugging Integration Issues
Use the debug endpoint to understand parameter resolution:
```bash
curl -X POST "https://your-deployment/api/debug" \
  -H "Content-Type: application/json" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: your-sdk-key" \
  -d '{
    "flagKey": "test_flag",
    "userId": "test_user"
  }'
```

### 2. QA Testing with Forced Variations
Set specific variations for testing:
```bash
# Force a variation
curl -X POST "https://your-deployment/api/set-forced-variation" \
  -H "Content-Type: application/json" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: your-sdk-key" \
  -H "X-Optimizely-Admin-Token: admin-token" \
  -d '{
    "userId": "qa_tester",
    "flagKey": "new_feature",
    "variationKey": "treatment"
  }'

# Test the feature...

# Remove forced variation
curl -X POST "https://your-deployment/api/remove-forced-variation" \
  -H "Content-Type: application/json" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: your-sdk-key" \
  -H "X-Optimizely-Admin-Token: admin-token" \
  -d '{
    "userId": "qa_tester",
    "flagKey": "new_feature"
  }'
```

### 3. Cache Management
Clear cached data when needed:
```bash
curl -X POST "https://your-deployment/api/admin/cache/clear" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-Admin-Token: admin-token"
```

### 4. Health Monitoring
Check service status:
```bash
curl -X GET "https://your-deployment/api/admin/status" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-Admin-Token: admin-token"
```

Response:
```json
{
  "timestamp": "2025-05-28T12:00:00Z",
  "uptime": "healthy",
  "version": "2.0.0",
  "environment": "production",
  "cdnProvider": "cloudflare"
}
```

## Security Considerations

### Admin Token Protection
- Use strong, randomly generated tokens
- Rotate tokens regularly
- Never expose tokens in client-side code
- Use HTTPS for all admin operations

### Access Control
- Limit admin endpoint access by IP if possible
- Monitor admin endpoint usage
- Log all administrative actions
- Consider separate admin tokens for different operations

### Environment Separation
- Use different admin tokens per environment
- Disable debug endpoints in production if not needed
- Implement rate limiting for admin endpoints

## Error Handling

### Common Admin Errors

| Status | Error | Description |
|--------|-------|-------------|
| 403 | Unauthorized | Invalid or missing admin token |
| 405 | Method not allowed | Wrong HTTP method |
| 501 | Not implemented | Feature not available |
| 503 | Service unavailable | Service not ready |

### Troubleshooting

1. **403 Unauthorized**
   ```bash
   # Check admin token is set
   echo $OPTIMIZELY_ADMIN_TOKEN
   
   # Verify header is included
   curl -I -X POST "https://your-deployment/api/admin/status" \
     -H "X-Optimizely-Enable-FEX: true" \
     -H "X-Optimizely-Admin-Token: $ADMIN_TOKEN"
   ```

2. **501 Not Implemented**
   - Feature may not be available in your CDN environment
   - Check deployment configuration
   - Verify service initialization

## Best Practices

### 1. Use Debug Endpoint First
Always start troubleshooting with the debug endpoint to understand the current configuration.

### 2. Document Forced Variations
Keep track of any forced variations in your test plans and ensure they're removed after testing.

### 3. Automate Admin Tasks
Create scripts for common admin operations:
```javascript
// admin-tools.js
class EdgeAgentAdmin {
  constructor(baseUrl, adminToken) {
    this.baseUrl = baseUrl;
    this.adminToken = adminToken;
  }
  
  async clearCache() {
    const response = await fetch(`${this.baseUrl}/api/admin/cache/clear`, {
      method: 'POST',
      headers: {
        'X-Optimizely-Enable-FEX': 'true',
        'X-Optimizely-Admin-Token': this.adminToken
      }
    });
    return response.json();
  }
  
  async getStatus() {
    const response = await fetch(`${this.baseUrl}/api/admin/status`, {
      headers: {
        'X-Optimizely-Enable-FEX': 'true',
        'X-Optimizely-Admin-Token': this.adminToken
      }
    });
    return response.json();
  }
}
```

### 4. Monitor Admin Usage
Log and alert on admin endpoint usage:
- Track who is using admin endpoints
- Alert on unexpected admin operations
- Review admin logs regularly

## Related Documentation

- [API Authentication](../authentication.md) - General authentication guide
- [Decision Endpoints](../decisions/) - Feature flag decisions
- [Data Management](../data-management/) - Datafile and flag operations
- [Troubleshooting](../../troubleshooting/) - Common issues and solutions

---

**Last Updated**: 2025-05-28