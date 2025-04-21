# CDN Adapter Integration Points

_Last Updated: 2025-04-18_

## Overview

The v1 codebase implements an Adapter pattern for CDN integration, primarily through the `CloudflareAdapter` class. This document maps the key integration points between CoreLogic and the CDN adapter.

## Adapter Design

The `CloudflareAdapter` class serves as a bridge between the core business logic and platform-specific APIs:

```javascript
class CloudflareAdapter {
  constructor(coreLogic, optimizelyProvider, sdkKey, abstractionHelper, kvStore, kvStoreUserProfile, logger, pagesUrl) {
    this.pagesUrl = pagesUrl;
    this.sdkKey = sdkKey;
    this.logger = logger;
    this.kvStore = kvStore || undefined;
    this.coreLogic = coreLogic;
    // ...more initialization
  }
  
  // CDN-specific methods
  async fetchHandler(request, env, ctx) {...}
  async getDatafile(sdkKey, ttl = 3600) {...}
  async getDatafileFromKV(sdkKey, kvStore) {...}
  async getNewResponseObject(responseBody, contentType, stringifyResult = true, status = 200) {...}
  // ...more methods
}
```

## Integration Points

### 1. Adapter Initialization & Injection

The adapter is created in the entry point and passed to CoreLogic:

```javascript
// In index.entry.js
const coreLogic = new CoreLogic(
  optimizelyProvider,
  env,
  ctx,
  sdkKey,
  abstractionHelper,
  env.OPTIMIZELY_KV,
  env.OPTIMIZELY_USER_PROFILE,
  logger
);

// Injection via setter pattern
coreLogic.setCdnAdapter(cloudflareAdapter);
```

### 2. Datafile Retrieval

CoreLogic uses the adapter to fetch datafiles from KV storage or CDN:

```javascript
// In CoreLogic.js - retrieveDatafile method
if (requestConfig.datafileFromKV) {
  const datafile = await this.cdnAdapter.getDatafileFromKV(requestConfig.sdkKey, this.kvStore);
  // ...
}

const datafileFromCDN = await this.cdnAdapter.getDatafile(requestConfig.sdkKey, 600);
```

### 3. Response Creation

The adapter creates platform-specific response objects:

```javascript
// In CoreLogic.js - various response creation points
reqResponse = await this.cdnAdapter.getNewResponseObject(optlyResponse, 'application/json', true);
```

### 4. Error Response Generation

Error responses also leverage the adapter:

```javascript
// In CoreLogic.js - catch block
return {
  reqResponse: await this.cdnAdapter.getNewResponseObject(
    `Internal Server Error: ${error.message}`,
    'text/html',
    false,
    500
  ),
  // ...
}
```

### 5. Content Fetching

For Edge mode, the adapter fetches content from the origin server:

```javascript
// In CloudflareAdapter.js
async fetchFromOriginOrCDN(input, options = {}) {
  // Parse URL, rewrite if needed
  // ...
  const response = await AbstractRequest.fetchRequest(urlToFetch, options);
  return response;
}
```

### 6. Caching Operations

The adapter handles all caching operations:

```javascript
// In CloudflareAdapter.js
async cacheResponse(ctx, cache, cacheKey, responseToCache, cacheTTL = null) {
  try {
    // Use ctx.waitUntil to handle cache operations asynchronously
    ctx.waitUntil(cache.put(cacheKey, responseToCache.clone()));
    // ...
  } catch (error) {
    this.logger.error('Error during caching operation:', error);
  }
}
```

### 7. Request/Response Modification

Cookies and headers are managed through adapter methods:

```javascript
// In CloudflareAdapter.js
setResponseCookie(response, name, value, options = cookieDefaultOptions) {...}
setRequestCookie(request, name, value, options = cookieDefaultOptions) {...}
setMultipleResponseHeaders(response, headers) {...}
```

## Implementation Pattern

The adapter design follows a hybrid pattern:

1. **Setter Injection** - Adapters are set after CoreLogic creation
2. **Bidirectional References** - CoreLogic references adapter and adapter references CoreLogic
3. **Platform Abstraction** - Basic request/response abstractions hide platform differences

```javascript
// Bidirectional references
// 1. CoreLogic references the adapter
coreLogic.setCdnAdapter(cloudflareAdapter);

// 2. Adapter references CoreLogic
constructor(coreLogic, ...) {
  this.coreLogic = coreLogic;
  // ...
}
```

## Entry Point Integration

The Worker entry point ties everything together:

```javascript
// In cloudflare/index.entry.js
export default {
  async fetch(request, env, ctx) {
    try {
      // Initialize components
      const logger = new Logger();
      const abstractionHelper = new CloudflareAbstractionHelper(request, env, ctx);
      const optimizelyProvider = new OptimizelyProvider(logger);
      const coreLogic = new CoreLogic(...);
      const cloudflareAdapter = new CloudflareAdapter(coreLogic, ...);
      
      // Set bidirectional references
      coreLogic.setCdnAdapter(cloudflareAdapter);
      
      // Handle request via adapter's fetchHandler
      return await cloudflareAdapter.fetchHandler(request, env, ctx);
    } catch (error) {
      // ...error handling
    }
  }
};
```

## Design Limitations

1. **Tight Coupling** - Bidirectional references create coupling between CoreLogic and adapter
2. **Direct Dependencies** - CoreLogic calls adapter methods directly rather than through an interface
3. **Mixed Responsibilities** - Adapter both creates response objects and fetches content

## Summary

The v1 CDN adapter implementation provides separation between business logic and platform specifics, but still exhibits tight coupling through bidirectional references and direct method calls. The adapter handles:

1. Datafile retrieval (KV and CDN)
2. Response object creation
3. Error response formatting
4. Origin content fetching
5. Cache operations
6. Request/response modification

This approach allows for different CDN platforms while centralizing platform-specific code.