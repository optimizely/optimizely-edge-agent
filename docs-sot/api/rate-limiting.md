# Rate Limiting

## Current Status

**Rate limiting is NOT currently implemented in the Edge Agent.**

The Edge Agent codebase does not include rate limiting functionality. There are no:
- Rate limit counters or tracking
- 429 (Too Many Requests) responses
- Rate limit headers (X-RateLimit-*)
- Retry-After headers
- Rate limiting middleware or logic

## Test Reference

The codebase includes a test that checks for rate limiting implementation:

```typescript
// From src-v2/tests/integration/ApiSecurity.test.ts
it('should handle rate limiting (if implemented)', async () => {
  const requestCount = 100;
  const responses = [];
  
  for (let i = 0; i < requestCount; i++) {
    const response = await makeRequest(
      'GET', 
      `/api/datafile?sdkKey=${TEST_SDK_KEY}-${i}`
    );
    responses.push(response);
  }
  
  // If rate limiting is implemented, some later requests should be throttled
  const rateLimited = responses.some(r => r.getStatus() === 429);
  
  // Skip assertion if rate limiting is not implemented
  if (rateLimited) {
    expect(rateLimited).toBe(true);
  }
});
```

This test confirms that rate limiting is not currently implemented, as it only checks IF any 429 responses occur and skips the assertion if they don't.

## Platform Rate Limits

While the Edge Agent itself doesn't implement rate limiting, the underlying platforms have their own limits:

### Cloudflare Workers
- **Request limits**: Based on your Cloudflare plan
- **CPU time**: 50ms on free plan, 30s on paid plans
- **Subrequests**: 50 on free plan, 1000 on paid plans
- See [Cloudflare Workers Limits](https://developers.cloudflare.com/workers/platform/limits/)

### Fastly Compute@Edge
- **Execution time**: 60 seconds max
- **Memory**: 128MB
- **Request/Response size**: 16MB
- See [Fastly Compute@Edge Limits](https://docs.fastly.com/products/compute-at-edge-limits)

### Vercel Edge Functions
- **Execution time**: 30 seconds max
- **Memory**: 128MB
- **Payload size**: 4.5MB
- See [Vercel Edge Functions Limits](https://vercel.com/docs/functions/edge-functions/limitations)

## Best Practices Without Rate Limiting

Since rate limiting is not implemented, follow these practices to avoid overwhelming the service:

### 1. Client-Side Throttling

Implement your own request throttling:

```javascript
class RequestThrottler {
  constructor(maxRequests = 50, windowMs = 60000) {
    this.requests = [];
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }
  
  async throttle() {
    const now = Date.now();
    
    // Remove old requests
    this.requests = this.requests.filter(
      time => now - time < this.windowMs
    );
    
    // Check if we're at limit
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = Math.min(...this.requests);
      const waitTime = this.windowMs - (now - oldestRequest);
      
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.requests.push(now);
  }
}

// Usage
const throttler = new RequestThrottler(50, 60000);

async function makeRequest(options) {
  await throttler.throttle();
  return fetch('/api/decide', options);
}
```

### 2. Request Batching

Reduce request volume by batching:

```javascript
// Instead of multiple requests
const flags = ['flag1', 'flag2', 'flag3'];
const decisions = [];

for (const flag of flags) {
  const decision = await fetch('/api/decide', {
    body: JSON.stringify({ flagKey: flag, userId })
  });
  decisions.push(await decision.json());
}

// Use batch endpoint
const response = await fetch('/api/decide-for-keys', {
  body: JSON.stringify({ flagKeys: flags, userId })
});
const allDecisions = await response.json();
```

### 3. Response Caching

Cache responses to reduce requests:

```javascript
class DecisionCache {
  constructor(ttl = 300000) { // 5 minutes
    this.cache = new Map();
    this.ttl = ttl;
  }
  
  getCacheKey(flagKey, userId, attributes = {}) {
    return `${flagKey}:${userId}:${JSON.stringify(attributes)}`;
  }
  
  get(flagKey, userId, attributes) {
    const key = this.getCacheKey(flagKey, userId, attributes);
    const cached = this.cache.get(key);
    
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }
  
  set(flagKey, userId, attributes, data) {
    const key = this.getCacheKey(flagKey, userId, attributes);
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }
}
```

## Future Implementation Considerations

If rate limiting is added in the future, consider:

1. **Middleware Integration**: Add rate limiting middleware to the request pipeline
2. **Storage Backend**: Use KV storage or in-memory cache for counters
3. **Configuration**: Add environment variables for limits
4. **Headers**: Return standard rate limit headers
5. **Error Responses**: Return 429 status with retry information

## See Also

- [API Reference](./README.md) - Complete API documentation
- [Error Handling](./error-handling.md) - Error response formats
- [Performance](./performance.md) - Performance optimization
- [Authentication](./authentication.md) - API authentication

---

**Last Updated**: 2025-05-30