# Caching Implementation Analysis: v1 vs v2

*Last Updated: April 18, 2025*

This document provides a comparative analysis of the caching implementation between Optimizely Edge Agent v1 (JavaScript) and v2 (TypeScript) codebases, focusing on key differences in architecture, strategies, and capabilities.

## Table of Contents

- [Overview](#overview)
- [Cache Key Generation](#cache-key-generation)
- [Cache TTL Configuration](#cache-ttl-configuration)
- [Conditional Caching with cdnVariationSettings](#conditional-caching-with-cdnvariationsettings)
- [Cache Storage Mechanisms](#cache-storage-mechanisms)
- [Cache Headers Management](#cache-headers-management)
- [Cache Hit/Miss Reporting](#cachemiss-reporting)
- [Architectural Differences](#architectural-differences)
- [Migration Considerations](#migration-considerations)

## Overview

### v1 Caching Implementation

In v1, caching is implemented directly within the `CoreLogic` class and is tightly coupled with the request processing logic. The implementation is functional but lacks clear separation of concerns, with caching logic scattered across multiple methods.

Key characteristics of v1 caching:
- Embedded within the monolithic `CoreLogic` class
- Cache operations are handled alongside other edge logic
- Limited abstraction for different storage mechanisms
- Hardcoded cache invalidation and TTL logic
- Limited cache metrics collection

### v2 Caching Implementation

v2 introduces a dedicated, abstracted caching architecture with clear interfaces and separation of concerns:

1. `ICacheService` interface - Defines the contract for basic caching operations
2. `CacheService` class - Implements the cache service using a storage adapter
3. `CacheManager` class - Provides higher-level caching strategies and metrics
4. `EdgeModeHandler` - Uses the cache services for specific edge mode operations

This architecture provides better testability, flexibility, and maintainability.

## Cache Key Generation

### v1 Implementation

In v1, cache key generation is primarily handled in the `findMatchingConfig` method within `CoreLogic.js`:

```javascript
async findMatchingConfig(requestURL, decisions, ignoreQueryParameters = true) {
  // ...
  if (cdnConfig && cdnConfig.cdnExperimentURL) {
    // ...
    if (compareOriginAndPath === targetUrl || (testFlagKey && testFlagKey === flagKey)) {
      // ...
      this.setCdnConfigProperties(cdnConfig, flagKey, variationKey);
      return cdnConfig;
    }
  }
  // ...
}
```

The `cacheKey` property from `cdnVariationSettings` determines how caching works:
- When set to `"VARIATION_KEY"`, it uses a combination of flagKey and variationKey
- When set to any other string, it uses that string directly as the cache key

There's limited flexibility in cache key generation, and the logic is tightly coupled with URL matching.

### v2 Implementation

v2 provides a more sophisticated and flexible approach through the `ICacheService` interface:

```typescript
// From ICacheService.ts
generateCacheKey(baseCacheKey: string, flagKey?: string, variationKey?: string): string;
```

The `CacheService` implementation provides:
- Special handling for "VARIATION_KEY" format
- Enhanced cache key generation with performance optimizations
- Support for custom key generator functions

Additionally, the `CacheManager` class offers more advanced cache key generation:

```typescript
// From CacheManager.ts
public generateCacheKey(
  baseKey: string,
  params: Record<string, any> = {},
  options?: CacheStrategyOptions
): string {
  // Custom key generation logic with support for:
  // - Custom key generators
  // - Query parameter variation
  // - Header-based variation
  // ...
}
```

This implementation allows for more flexible and controlled cache key generation with support for:
- Varying by specific query parameters
- Varying by request headers
- Custom key generation functions

## Cache TTL Configuration

### v1 Implementation

v1 doesn't have a clear TTL configuration mechanism in the core caching logic. TTL values are typically hardcoded or set at the CDN adapter level. The `cdnVariationSettings` object doesn't include a dedicated TTL field, limiting configuration flexibility.

### v2 Implementation

v2 provides explicit TTL configuration at multiple levels:

1. In `CacheService`:
```typescript
private readonly defaultTTL = 3600; // 1 hour in seconds

async set<T = any>(cacheKey: string, value: T, ttl?: number): Promise<boolean> {
  // Calculate expiry time
  const expiryTime = ttl !== undefined && ttl > 0
    ? Date.now() + (ttl * 1000)
    : ttl === 0
      ? undefined // No expiry if ttl is 0
      : Date.now() + (this.defaultTTL * 1000); // Default expiry
  // ...
}
```

2. In `CacheManager`:
```typescript
constructor(
  cacheService: ICacheService,
  logger: ILoggerAdapter,
  defaultOptions: CacheStrategyOptions = {}
) {
  this.defaultOptions = {
    ttl: 3600, // 1 hour default TTL
    // ...
  };
}
```

This approach offers:
- Default TTL values at service level
- Per-operation TTL configuration
- TTL inheritance and override patterns
- Support for infinite cache lifetime (ttl = 0)

## Conditional Caching with cdnVariationSettings

### v1 Implementation

In v1, conditional caching based on `cdnVariationSettings` is implemented in the `CoreLogic` class:

```javascript
// Extract settings
extractCdnSettings(decisions) {
  const result = decisions.map((decision) => {
    const { flagKey, variationKey, variables } = decision;
    const settings = variables.cdnVariationSettings || {};
    const result = {
      [flagKey]: {
        [variationKey]: {
          // ...
          cacheRequestToOrigin: (settings.cacheRequestToOrigin && settings.cacheRequestToOrigin === 'true') || false,
          // ...
        },
      },
    };
    return result;
  });
  return result;
}
```

This implementation:
- Extracts caching settings from decision variables
- Converts string values to booleans
- Only supports basic true/false flag for `cacheRequestToOrigin`

### v2 Implementation

v2 provides more structured conditional caching through the `EdgeModeHandler`:

```typescript
// From EdgeModeHandler.ts
public async prepareContent(
  settings: CDNVariationSettings,
  userContext: OptimizelyUserContext,
  request: IRequestAdapter
): Promise<ContentPreparationResult> {
  // ...
  const useCache = isTrue(safeSettings.cacheRequestToOrigin); 
  // ...
  return {
    useCache,
    forwardToOrigin
  };
}
```

The advantages include:
- Clear separation between decision and execution
- Type-safe interface through `CDNVariationSettings` interface
- Preparation phase that can include complex caching decisions

## Cache Storage Mechanisms

### v1 Implementation

v1 relies on a simple Key-Value (KV) storage approach without clear abstractions:

```javascript
async retrieveDatafile(requestConfig, env) {
  // ...
  if (requestConfig.datafileFromKV) {
    const datafile = await this.cdnAdapter.getDatafileFromKV(requestConfig.sdkKey, this.kvStore);
    // ...
  }
  // ...
}
```

The implementation is limited by:
- Direct coupling to specific KV store implementations
- Mixing of caching and business logic
- Limited error handling and fallback mechanisms

### v2 Implementation

v2 introduces a storage adapter pattern that abstracts the underlying storage mechanism:

```typescript
// From CacheService.ts
constructor(storageAdapter: IStorageAdapter, logger: ILoggerAdapter) {
  if (!storageAdapter) {
    throw new Error("Storage adapter is required for CacheService");
  }
  this.storageAdapter = storageAdapter;
  this.logger = logger;
}

async get<T = any>(cacheKey: string): Promise<T | null> {
  // ...
  const cachedItemJson = await this.storageAdapter.get(storageKey, 'text');
  // ...
}
```

This approach provides:
- Abstraction over different storage backends
- Seamless support for different storage mechanisms (memory, KV, Redis, etc.)
- Clear interface for cache operations
- Better testability through adapter mocking

## Cache Headers Management

### v1 Implementation

v1 handles cache headers directly in the response preparation logic:

```javascript
async handleOriginForwarding(visitorId, serializedDecisions, requestConfig) {
  // ...
  let fetchResponse = await fetch(clonedRequest || this.request);
  // ...
}
```

The implementation has limitations:
- No consistent cache header management
- Missing standard cache control headers
- Limited control over cache metadata

### v2 Implementation

v2 provides more systematic cache header management in `EdgeModeHandler`:

```typescript
// From EdgeModeHandler.ts
public async fetchContent(
  cdnResponseURL: string,
  request: IRequestAdapter
): Promise<IResponseAdapter> {
  // ...
  // Add cache indicator
  response.setHeader('X-Edge-Cache', 'MISS');
  // ...
  
  // If cached content found
  response.setHeader('X-Edge-Cache', 'HIT');
  // ...
}
```

This provides:
- Consistent cache status indicators
- Standard cache control header support
- Preservation of cache headers from origin

## Cache Hit/Miss Reporting

### v1 Implementation

v1 has minimal cache hit/miss reporting, mostly through debug logs:

```javascript
this.logger.debug('Datafile retrieved from KV storage');
// ...
this.logger.debug('Datafile retrieved from CDN');
```

Limitations include:
- No structured metrics collection
- Debug-only visibility into cache performance
- No aggregated statistics

### v2 Implementation

v2 introduces comprehensive cache metrics through `CacheManager`:

```typescript
// From CacheManager.ts
private metrics: {
  gets: number;
  hits: number;
  sets: number;
  invalidations: number;
  getTotalTime: number;
  setTotalTime: number;
};

// Metrics collection during operations
this.metrics.gets++;
// ...
this.metrics.hits++;
// ...

// Retrieving metrics
public getMetrics(): CacheMetrics {
  const hitRate = this.metrics.gets > 0 
    ? this.metrics.hits / this.metrics.gets 
    : 0;
  
  const avgGetTime = this.metrics.gets > 0 
    ? this.metrics.getTotalTime / this.metrics.gets 
    : 0;
  
  // ...
  
  return {
    hitRate,
    gets: this.metrics.gets,
    sets: this.metrics.sets,
    invalidations: this.metrics.invalidations,
    avgGetTime,
    avgSetTime
  };
}
```

This approach provides:
- Structured metrics collection
- Cache hit rate calculation
- Performance timing metrics
- Invalidation tracking

## Architectural Differences

### v1 Architecture

- **Monolithic Design**: Caching is embedded within `CoreLogic` without clear separation
- **Limited Abstraction**: Direct coupling to specific storage implementations
- **Mixed Concerns**: Caching logic mixed with business logic
- **Fixed Strategies**: Limited ability to change caching strategies

### v2 Architecture

- **Service-Based Design**: Dedicated cache services with clear interfaces
- **Adapter Pattern**: Storage adapters for different backend implementations
- **Strategy Pattern**: Flexible caching strategies through `CacheManager`
- **Composition**: Components composed through dependency injection
- **Metrics Collection**: Built-in performance monitoring

The v2 architecture offers significant improvements:
- Better separation of concerns
- Enhanced testability
- More flexible configuration
- Improved performance monitoring
- Clear extension points

## Migration Considerations

When migrating from v1 to v2 caching implementation, consider:

1. **Configuration Mapping**: Ensure `cdnVariationSettings` properties map correctly to the new structures
2. **Key Generation**: Verify that cache key generation patterns are compatible
3. **TTL Settings**: Update TTL configuration to use the new explicit mechanisms
4. **Storage Adapters**: Implement or select appropriate storage adapters for your environment
5. **Metrics Integration**: Integrate new cache metrics with monitoring systems
6. **Conditional Logic**: Update conditional caching logic to use the new preparation phase
7. **Headers Management**: Review and update cache header management

The v2 implementation should be backward compatible with v1 caching patterns while offering new capabilities and better performance.