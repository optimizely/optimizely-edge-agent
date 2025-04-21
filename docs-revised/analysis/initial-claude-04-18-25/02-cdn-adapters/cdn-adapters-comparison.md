# CDN Adapters Comparison

*Last Updated: April 18, 2025*

## Overview

This document provides a comparative analysis of the various CDN adapters implemented in the Optimizely Edge Agent. The Edge Agent supports multiple CDN providers, each with its own adapter implementation to handle the specifics of the CDN environment.

## Supported CDN Providers

The Edge Agent supports the following CDN providers:

1. **Cloudflare** - `src/cdn-adapters/cloudflare/`
2. **Vercel** - `src/cdn-adapters/vercel/`
3. **Fastly** - `src/cdn-adapters/fastly/`
4. **CloudFront** - `src/cdn-adapters/cloudfront/`
5. **Akamai** - `src/cdn-adapters/akamai/`

## Common Architecture

All CDN adapters follow a similar architecture pattern:

1. **Adapter Class** - Main class that handles request processing, caching, and response generation
2. **KV Interface** - Class that provides a common interface for key-value storage operations
3. **Entry Point** - Main entry point for the CDN worker/function that initializes the adapter

### Standard Components

Each adapter typically includes:

1. **Request Processing** - Methods to handle incoming requests
2. **Caching Logic** - Implementation of caching strategies
3. **Origin Communication** - Logic for fetching content from origin servers
4. **Event Handling** - Collection and dispatch of analytics events
5. **Cookie/Header Management** - Utilities for managing cookies and headers

## Comparative Analysis

### 1. Entry Point Structure

The entry points for different CDN adapters have slight variations based on the CDN platform:

#### Cloudflare Entry Point

```javascript
export default {
  async fetch(request, env, ctx) {
    // Initialize
    // Process request
    // Return response
  },
  initializeCoreLogic(sdkKey, request, env, ctx, abstractionHelper) {
    // Initialize components
  }
};
```

#### Vercel Entry Point

```javascript
export default async function handler(request) {
  const env = {}; // Initialize env object
  // Process similar to Cloudflare
  // Return NextResponse
}

function initializeCoreLogic(sdkKey, request, env, abstractionHelper) {
  // Initialize components
}
```

### 2. Adapter Implementation 

All adapters implement similar core methods but with platform-specific variations:

| Method | Cloudflare | Fastly | Vercel |
|--------|------------|--------|--------|
| Main Request Handler | `fetchHandler()` | `_fetch()` | `handler()` |
| Process Request | `fetchAndProcessRequest()` | `fetchAndProcessRequest()` | `fetchAndProcessRequest()` |
| Cache Key Generation | `generateCacheKey()` | `generateCacheKey()` | `generateCacheKey()` |
| Origin Fetching | `fetchFromOriginOrCDN()` | `fetchFromOrigin()` | `fetchFromOrigin()` |
| Event Dispatching | `dispatchConsolidatedEvents()` | `dispatchConsolidatedEvents()` | Similar implementation |

### 3. Key Differences

#### Caching Implementation

**Cloudflare:**
```javascript
generateCacheKey(cdnSettings, originUrl) {
  let cacheKeyUrl = this.abstractionHelper.abstractRequest.getNewURL(originUrl);
  // Add flagKey and variationKey as query parameters
  if (cdnSettings.cacheKey === 'VARIATION_KEY') {
    cacheKeyUrl.searchParams.set('flagKey', cdnSettings.flagKey);
    cacheKeyUrl.searchParams.set('variationKey', cdnSettings.variationKey);
  } else {
    cacheKeyUrl.searchParams.set('cacheKey', cdnSettings.cacheKey);
  }
  return cacheKeyUrl.href;
}
```

**Fastly:**
```javascript
generateCacheKey(cdnSettings, originUrl) {
  let cacheKeyUrl = new URL(originUrl);
  // Ensure that the pathname ends properly before appending
  let basePath = cacheKeyUrl.pathname.endsWith('/') ? cacheKeyUrl.pathname.slice(0, -1) : cacheKeyUrl.pathname;
  
  if (cdnSettings.cacheKey === 'VARIATION_KEY') {
    cacheKeyUrl.pathname = `${basePath}/${cdnSettings.flagKey}-${cdnSettings.variationKey}`;
  } else {
    cacheKeyUrl.pathname = `${basePath}/${cdnSettings.cacheKey}`;
  }
  
  return cacheKeyUrl.href;
}
```

#### KV Store Implementation

**Cloudflare KV Interface:**
```javascript
async get(key) {
  try {
    const value = await this.kvNamespace.get(`${this.nsPrefix}:${key}`);
    return value;
  } catch (error) {
    this.logger.error(`Error getting value for key ${key}:`, error);
    return null;
  }
}
```

**Vercel KV Interface:**
```javascript
async get(key) {
  try {
    const value = await EDGE_KV.get(`${this.kvNamespace}:${key}`);
    return value !== null ? value.toString() : null;
  } catch (error) {
    logger().error(`Error getting value for key ${key}:`, error);
    return null;
  }
}
```

### 4. Platform-Specific Features

#### Cloudflare-Specific

- Uses Cloudflare's `waitUntil` for asynchronous operations like caching
- Includes `caches.default` for Cloudflare's cache storage
- Handles Cloudflare Workers execution context

#### Vercel-Specific

- Uses Next.js `NextResponse` for response formatting
- Handles Vercel's Edge Runtime environment
- Different error handling approach tailored to Vercel

#### Fastly-Specific

- Custom implementation of cache key generation with pathname manipulation
- Different approach to request cloning and handling
- Specific error handling for Fastly's Compute@Edge platform

## Abstraction Layer

A key architectural pattern across all adapters is the use of an abstraction layer to standardize interactions:

```javascript
// Initialization of abstraction helper
abstractionHelper = getAbstractionHelper(request, env, ctx, logger);

// Standard methods across platforms
_abstractRequest = abstractionHelper.abstractRequest;
_request = abstractionHelper.request;
_env = abstractionHelper.env;
```

This abstraction layer allows the core logic to remain CDN-agnostic while each adapter handles platform-specific details.

## Key Design Patterns

1. **Adapter Pattern** - Each CDN adapter implements a common interface while handling platform-specific details
2. **Facade Pattern** - The abstraction layer provides a simplified interface to the complex CDN environments
3. **Strategy Pattern** - Different strategies for request handling, caching, and event processing can be selected at runtime
4. **Factory Pattern** - Creation of response objects and other components follows factory patterns

## Performance Considerations

All adapters implement performance optimizations specific to their platforms:

- **Cloudflare** - Optimized for Cloudflare Workers with efficient caching
- **Fastly** - Tailored for Compute@Edge with pathname-based cache keys
- **Vercel** - Designed for Edge Functions with NextJS integration

## Extensibility

The event listener system allows for extension points across all adapters:

```javascript
this.eventListenersResult = await this.eventListeners.trigger(
  'beforeProcessingRequest',
  request,
  this.coreLogic.requestConfig
);
```

These extension points enable customization of behavior without modifying the core adapter code.

## Conclusion

The multi-adapter approach allows the Optimizely Edge Agent to support a wide range of CDN platforms while maintaining a consistent core logic. Each adapter implements the necessary platform-specific code while adhering to a common architectural pattern.

This design enables deploying the same feature experimentation capabilities across different CDN environments, providing flexibility in infrastructure choices while maintaining functional consistency.