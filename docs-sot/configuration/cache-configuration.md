# Cache Configuration

## Overview

The Edge Agent v2 implements a sophisticated multi-level caching system to optimize performance and reduce latency. This document covers cache configuration options, strategies, and best practices for each caching layer.

## Cache Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Multi-Level Cache Hierarchy                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Request ──▶ L1: Memory ──▶ L2: Worker ──▶ L3: KV ──▶ L4: CDN ──▶ Origin│
│              (fastest)                                    (slowest)      │
│                                                                          │
│  Cache Characteristics:                                                  │
│  ┌────────────┬──────────┬────────────┬─────────────┬────────────┐    │
│  │   Level    │ Latency  │   Scope    │     TTL     │  Capacity  │    │
│  ├────────────┼──────────┼────────────┼─────────────┼────────────┤    │
│  │ L1: Memory │  <1ms    │  Request   │  5 minutes  │    10MB    │    │
│  │ L2: Worker │  1-5ms   │  Worker    │  1 hour     │   128MB    │    │
│  │ L3: KV     │  10-50ms │  Region    │  24 hours   │    1GB     │    │
│  │ L4: CDN    │  50-200ms│  Global    │  7 days     │  Unlimited │    │
│  └────────────┴──────────┴────────────┴─────────────┴────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Cache Levels

### L1: Memory Cache

In-request memory cache for immediate reuse:

```typescript
// From: /src-v2/services/implementations/CacheManager.ts
interface MemoryCacheConfig {
  enabled: boolean;          // Default: true
  maxSize: number;          // Default: 10485760 (10MB)
  ttl: number;              // Default: 300 (5 minutes)
  maxItems: number;         // Default: 1000
}

// Configuration
export MEMORY_CACHE_ENABLED="true"
export MEMORY_CACHE_MAX_SIZE="20971520"  # 20MB
export MEMORY_CACHE_TTL="600"            # 10 minutes
```

### L2: Worker Cache

Platform-specific worker-level cache:

```typescript
interface WorkerCacheConfig {
  enabled: boolean;          // Default: true
  ttl: number;              // Default: 3600 (1 hour)
  staleWhileRevalidate: number; // Default: 86400 (24 hours)
}

// Cloudflare Cache API
const cache = caches.default;
await cache.put(request, response);

// Configuration
export WORKER_CACHE_ENABLED="true"
export WORKER_CACHE_TTL="7200"  # 2 hours
```

### L3: KV Storage Cache

Distributed key-value storage:

```typescript
interface KVCacheConfig {
  enabled: boolean;          // Default: true
  namespace: string;        // Platform-specific
  ttl: number;              // Default: 86400 (24 hours)
  prefix: string;           // Default: 'optimizely'
}

// Platform-specific KV bindings
// Cloudflare: KV namespace
// Fastly: Edge Dictionary
// Vercel: Edge Config

// Configuration
export KV_CACHE_ENABLED="true"
export KV_CACHE_NAMESPACE="OPTIMIZELY_CACHE"
export KV_CACHE_TTL="172800"  # 48 hours
```

### L4: CDN Cache

Edge CDN cache for global distribution:

```typescript
interface CDNCacheConfig {
  enabled: boolean;          // Default: true
  ttl: number;              // Default: 604800 (7 days)
  vary: string[];           // Default: ['Accept', 'X-Optimizely-SDK-Key']
  surrogateControl: boolean; // Default: true
}

// Cache headers
Cache-Control: public, max-age=300, s-maxage=3600
Surrogate-Control: max-age=86400
CDN-Cache-Control: max-age=604800
```

## Cache Key Strategies

### Key Generation

```typescript
// From: /src-v2/services/implementations/CacheService.ts
class CacheService {
  generateCacheKey(components: CacheKeyComponents): string {
    const parts = [
      this.config.prefix,
      components.type,
      components.sdkKey,
      components.identifier,
      this.hashAttributes(components.attributes)
    ].filter(Boolean);
    
    return parts.join(':');
  }
  
  private hashAttributes(attributes?: Record<string, any>): string {
    if (!attributes || Object.keys(attributes).length === 0) {
      return '';
    }
    
    // Stable hash of attributes
    const sorted = Object.keys(attributes).sort().map(key => 
      `${key}=${JSON.stringify(attributes[key])}`
    ).join('&');
    
    return this.sha256(sorted).substring(0, 8);
  }
}
```

### Key Patterns

```typescript
// Datafile cache keys
optimizely:datafile:{sdkKey}
optimizely:datafile:{sdkKey}:metadata

// Decision cache keys  
optimizely:decision:{sdkKey}:{userId}:{flagKey}:{attributeHash}
optimizely:decision:batch:{sdkKey}:{userId}:{flagKeysHash}

// User profile keys
optimizely:profile:{sdkKey}:{userId}

// Feature flag keys
optimizely:flags:{sdkKey}
optimizely:flag:{sdkKey}:{flagKey}
```

## Cache Configuration Options

### Global Cache Settings

```typescript
interface GlobalCacheConfig {
  // Master switch
  enableCache: boolean;                // Default: true
  
  // Cache key prefix
  cacheKeyPrefix: string;             // Default: 'optimizely'
  
  // Default TTLs (seconds)
  defaultTTL: number;                 // Default: 300
  datafileTTL: number;               // Default: 300
  decisionTTL: number;               // Default: 60
  profileTTL: number;                // Default: 2592000 (30 days)
  
  // Cache strategies
  cacheStrategy: 'aggressive' | 'balanced' | 'conservative';
  
  // Invalidation
  enableAutoInvalidation: boolean;    // Default: true
  invalidationDelay: number;          // Default: 1000 (ms)
}
```

### Strategy Presets

```typescript
// Aggressive caching (best performance)
const aggressiveCache = {
  defaultTTL: 3600,        // 1 hour
  datafileTTL: 86400,      // 24 hours
  decisionTTL: 300,        // 5 minutes
  staleWhileRevalidate: true,
  backgroundRefresh: true
};

// Balanced caching (default)
const balancedCache = {
  defaultTTL: 300,         // 5 minutes
  datafileTTL: 300,        // 5 minutes
  decisionTTL: 60,         // 1 minute
  staleWhileRevalidate: false,
  backgroundRefresh: false
};

// Conservative caching (freshest data)
const conservativeCache = {
  defaultTTL: 60,          // 1 minute
  datafileTTL: 60,         // 1 minute
  decisionTTL: 0,          // No caching
  staleWhileRevalidate: false,
  backgroundRefresh: false
};
```

## Cache Headers

### Request Cache Control

```typescript
// From: /src-v2/services/implementations/CacheService.ts
class CacheService {
  getCacheHeaders(config: CacheConfig): Record<string, string> {
    const headers: Record<string, string> = {};
    
    // Public caching
    if (config.enableCache) {
      headers['Cache-Control'] = `public, max-age=${config.defaultTTL}`;
      
      // CDN-specific headers
      if (config.enableCDNCache) {
        headers['Surrogate-Control'] = `max-age=${config.cdnTTL}`;
        headers['CDN-Cache-Control'] = `max-age=${config.cdnTTL}`;
      }
      
      // Vary headers for cache segmentation
      headers['Vary'] = config.varyHeaders.join(', ');
    } else {
      headers['Cache-Control'] = 'no-store, no-cache, must-revalidate';
      headers['Pragma'] = 'no-cache';
    }
    
    return headers;
  }
}
```

### Response Headers

```typescript
// Cacheable response
Cache-Control: public, max-age=300, s-maxage=3600, stale-while-revalidate=86400
ETag: "686897696a7c876b7e"
Last-Modified: Wed, 01 Jan 2025 00:00:00 GMT
Vary: Accept, X-Optimizely-SDK-Key

// Non-cacheable response  
Cache-Control: no-store, no-cache, must-revalidate, private
Pragma: no-cache
Expires: 0
```

## Cache Invalidation

### Invalidation Strategies

```typescript
// From: /src-v2/services/implementations/CacheManager.ts
class CacheManager {
  // Time-based invalidation (TTL)
  async getWithTTL(key: string): Promise<CachedItem | null> {
    const item = await this.storage.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expiresAt) {
      await this.storage.delete(key);
      return null;
    }
    
    return item;
  }
  
  // Event-based invalidation
  async handleDatafileUpdate(sdkKey: string): Promise<void> {
    // Invalidate all related caches
    const patterns = [
      `optimizely:datafile:${sdkKey}*`,
      `optimizely:decision:${sdkKey}*`,
      `optimizely:flags:${sdkKey}*`
    ];
    
    for (const pattern of patterns) {
      await this.invalidatePattern(pattern);
    }
  }
  
  // Manual invalidation
  async purgeCache(options: PurgeOptions): Promise<void> {
    if (options.all) {
      await this.storage.clear();
    } else if (options.pattern) {
      await this.invalidatePattern(options.pattern);
    } else if (options.key) {
      await this.storage.delete(options.key);
    }
  }
}
```

### Invalidation Triggers

```typescript
// Webhook-based invalidation
app.post('/webhook/datafile-updated', async (req, res) => {
  const { sdkKey } = req.body;
  await cacheManager.handleDatafileUpdate(sdkKey);
  res.status(200).send('Cache invalidated');
});

// API-based invalidation
app.post('/api/cache/purge', authenticate, async (req, res) => {
  await cacheManager.purgeCache(req.body);
  res.status(200).send('Cache purged');
});
```

## Performance Optimization

### Cache Warming

```typescript
// From: /src-v2/services/implementations/CacheService.ts
class CacheService {
  async warmCache(config: WarmCacheConfig): Promise<void> {
    // Pre-fetch critical data
    const tasks = [];
    
    // Warm datafile cache
    if (config.warmDatafile) {
      tasks.push(this.datafileService.getDatafile(config.sdkKey));
    }
    
    // Warm decision cache for VIP users
    if (config.vipUsers) {
      for (const userId of config.vipUsers) {
        for (const flagKey of config.criticalFlags) {
          tasks.push(this.decisionService.decide(userId, flagKey));
        }
      }
    }
    
    await Promise.all(tasks);
  }
}
```

### Stale-While-Revalidate

```typescript
class CacheService {
  async getWithSWR(key: string): Promise<any> {
    const cached = await this.get(key);
    
    if (!cached) {
      // Cache miss - fetch and cache
      return await this.fetchAndCache(key);
    }
    
    if (cached.expiresAt > Date.now()) {
      // Fresh cache - return immediately
      return cached.value;
    }
    
    if (cached.staleUntil > Date.now()) {
      // Stale but usable - return and refresh in background
      this.refreshInBackground(key);
      return cached.value;
    }
    
    // Too stale - must refresh
    return await this.fetchAndCache(key);
  }
}
```

## Platform-Specific Configuration

### Cloudflare Workers

```toml
# wrangler.toml
[env.production]
kv_namespaces = [
  { binding = "CACHE_KV", id = "your-kv-id" }
]

[env.production.vars]
CACHE_STRATEGY = "aggressive"
KV_CACHE_TTL = "86400"
WORKER_CACHE_TTL = "3600"
```

### Fastly Compute@Edge

```toml
# fastly.toml
[setup.dictionaries]
[setup.dictionaries.cache_config]
items = [
  { key = "strategy", value = "balanced" },
  { key = "ttl_default", value = "300" },
  { key = "ttl_datafile", value = "3600" }
]
```

### Vercel Edge Functions

```json
// vercel.json
{
  "functions": {
    "api/optimizely/**": {
      "runtime": "edge",
      "regions": ["iad1"],
      "memory": 1024
    }
  },
  "env": {
    "EDGE_CONFIG": "your-edge-config-url",
    "CACHE_STRATEGY": "balanced"
  }
}
```

## Monitoring and Debugging

### Cache Metrics

```typescript
// From: /src-v2/adapters/interfaces/IMetricsAdapter.ts
interface CacheMetrics {
  // Hit rates
  'cache.hit': number;
  'cache.miss': number;
  'cache.hit.rate': number;
  
  // Latency
  'cache.read.latency': number;
  'cache.write.latency': number;
  
  // Size
  'cache.size.bytes': number;
  'cache.entries.count': number;
  
  // Errors
  'cache.error.read': number;
  'cache.error.write': number;
}
```

### Debug Headers

```bash
# Enable cache debugging
curl -H "X-Cache-Debug: true" https://example.com/api/decide

# Response headers
X-Cache: HIT
X-Cache-Key: optimizely:decision:sdk123:user456:checkout:a1b2c3d4
X-Cache-TTL: 300
X-Cache-Age: 120
```

## Best Practices

### 1. Choose Appropriate TTLs

```typescript
// Static content - long TTL
const staticTTL = 86400; // 24 hours

// Dynamic decisions - short TTL
const decisionTTL = 60; // 1 minute

// User profiles - very long TTL
const profileTTL = 2592000; // 30 days
```

### 2. Implement Cache Bypass

```typescript
// Allow cache bypass for testing
if (request.headers['Cache-Control'] === 'no-cache' || 
    request.headers['X-Cache-Bypass'] === 'true') {
  return await fetchFromOrigin();
}
```

### 3. Monitor Cache Performance

```typescript
// Track cache effectiveness
const hitRate = (cacheHits / (cacheHits + cacheMisses)) * 100;
if (hitRate < 80) {
  logger.warn('Low cache hit rate', { hitRate });
}
```

## Troubleshooting

### Low Hit Rates
- Check cache key generation
- Verify TTL settings
- Look for cache bypass headers
- Monitor invalidation frequency

### Stale Data
- Reduce TTL values
- Enable auto-invalidation
- Implement webhook updates
- Use stale-while-revalidate

### Performance Issues
- Enable all cache levels
- Increase cache sizes
- Optimize cache keys
- Pre-warm critical paths

## See Also

- [Performance Guide](/docs-sot/operations/performance.md) - Performance optimization
- [Monitoring Guide](/docs-sot/operations/monitoring.md) - Cache monitoring
- [Platform Guides](/docs-sot/deployment/) - Platform-specific caching
- Implementation: `/src-v2/services/implementations/CacheManager.ts`