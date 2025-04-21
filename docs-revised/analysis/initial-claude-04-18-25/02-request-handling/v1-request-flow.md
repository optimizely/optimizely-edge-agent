# v1 Request Handling Flow

_Last Updated: 2025-04-18_

## Overview

The v1 implementation uses `CoreLogic.js` as the central orchestrator for all request processing. A monolithic class handles the entire request lifecycle from parsing through decision-making to response generation.

## Entry Point

Request flow begins in the `processRequest` method which accepts:
- `request` - The original HTTP request 
- `env` - Environment variables and CDN bindings
- `ctx` - Execution context

## Key Components in Request Processing

| Component | Responsibility |
|-----------|---------------|
| **CoreLogic** | Main orchestrator handling the entire request flow |
| **RequestConfig** | Parses and normalizes configuration from headers, query parameters, and request body |
| **OptimizelyProvider** | Wrapper for Optimizely SDK operations like decide/track |
| **CDN Adapter** | Platform-specific operations (caching, KV storage, response creation) |

## Request Flow Stages

1. **Initialization**
   - Parse request through RequestConfig
   - Determine pathname and request type
   - Set HTTP method flags (isPostMethod, isGetMethod)

2. **Configuration & Setup**
   - Get visitor ID from cookies or query parameters
   - Retrieve datafile from KV store or CDN
   - Initialize Optimizely SDK

3. **Request Classification**
   - Determine if it's a decide operation
   - Check if it's a datafile or config operation
   - Set appropriate operation flags

4. **Decision Processing**
   - For decide operations:
     - Determine flags to decide
     - Process forced decisions
     - Handle cookie-stored decisions

5. **SDK Operation Execution**
   - Call OptimizelyProvider to execute requested operation
   - Process response from Optimizely SDK

6. **Response Generation**
   - JSON response for API operations
   - CDN content for Edge mode
   - Managed responses for Agent mode

7. **Error Handling**
   - Try/catch wraps entire process
   - CDN adapter used for error responses

## Mode Determination Logic

The Edge vs Agent mode is determined by:

```javascript
// In CoreLogic.js
const isDecideOperation = this.getIsDecideOperation(this.pathName);

// Method that determines the operation type
getIsDecideOperation(pathName) {
  if (this.isDecideOperation !== undefined) return this.isDecideOperation;
  const result = !['/v1/config', '/v1/datafile', '/v1/track', '/v1/batch'].includes(pathName);
  this.isDecideOperation = result;
  return result;
}
```

Additionally, the HTTP method influences operation type:
- **GET requests**: Edge mode for URL matching and content transformation
- **POST requests**: Agent mode for SDK operations

## CDN Adapter Integration Points

The CDN adapter is used at the following points:

1. **Datafile Retrieval**
   ```javascript
   await this.cdnAdapter.getDatafileFromKV(requestConfig.sdkKey, this.kvStore);
   await this.cdnAdapter.getDatafile(requestConfig.sdkKey, 600);
   ```

2. **Response Creation**
   ```javascript
   await this.cdnAdapter.getNewResponseObject(optlyResponse, 'application/json', true);
   ```

3. **Error Response Generation**
   ```javascript
   await this.cdnAdapter.getNewResponseObject(
     `Internal Server Error: ${error.message}`,
     'text/html',
     false,
     500
   );
   ```

4. **Origin Content Fetching** (via CDN adapter's fetchHandler)
   ```javascript
   // In CloudflareAdapter
   async fetchFromOriginOrCDN(input, options = {}) {
     // ...fetches content from origin or CDN based on URL
   }
   ```

5. **Caching Operations**
   ```javascript
   // In CloudflareAdapter
   async cacheResponse(ctx, cache, cacheKey, responseToCache, cacheTTL = null) {
     // ...caches response with waitUntil
   }
   ```