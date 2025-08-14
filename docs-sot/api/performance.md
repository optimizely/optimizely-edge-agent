# Performance Optimization

Guidelines for optimizing Edge Agent API performance.

## Overview

The Edge Agent is designed to run at the edge with minimal latency. While the codebase doesn't include explicit performance monitoring, it follows patterns optimized for edge computing environments.

## Cache Implementation

### CacheService

The Edge Agent implements caching through the `CacheService` class:

```typescript
// From src-v2/services/implementations/CacheService.ts
export class CacheService implements ICacheService {
  private readonly namespace = "optimizely-cache";
  private readonly defaultTTL = 3600; // 1 hour in seconds
```

**Key Features:**
- Default TTL: 3600 seconds (1 hour)
- Namespace: "optimizely-cache"
- Storage adapter based (platform-specific)
- Automatic expiration handling

### Cache Usage

The cache is used for:
1. **Datafiles** - Caching project configuration
2. **Decisions** - Caching feature flag decisions (when enabled)
3. **Flag Keys** - Caching available feature flags

## Platform-Specific Considerations

### Cloudflare Workers

From the codebase:
```typescript
// src-v2/adapters/implementations/cloudflare/CloudflareStorageAdapter.ts
async get(key: string, type: 'text' | 'json' = 'text'): Promise<any> {
  const value = await this.kvNamespace.get(key, { type });
  return value;
}
```

Uses Cloudflare KV for persistent storage with built-in global distribution.

### Fastly Compute@Edge

```typescript
// src-v2/adapters/implementations/fastly/FastlyStorageAdapter.ts
// Uses Fastly KV Store for edge-side storage
```

### Vercel Edge Functions

```typescript
// src-v2/adapters/implementations/vercel/VercelStorageAdapter.ts
// Uses Vercel KV (Redis-compatible) for storage
```

## Metrics Adapters

The codebase includes metrics adapters but doesn't implement comprehensive performance tracking:

```typescript
// From src-v2/adapters/interfaces/IMetricsAdapter.ts
export interface IMetricsAdapter {
  incrementCounter(name: string, tags?: MetricTags, value?: number): void;
  recordGauge(name: string, value: number, tags?: MetricTags): void;
  recordHistogram(name: string, value: number, tags?: MetricTags): void;
  startTimer(name: string, tags?: MetricTags): TimerMetric;
}
```

Available implementations:
- `StandardMetricsAdapter` - In-memory metrics
- `CloudflareMetricsAdapter` - Platform-specific
- `NoOpMetricsAdapter` - Disabled metrics

## Best Practices

### 1. Use Batch Endpoints

Instead of multiple `/api/decide` calls:
```javascript
// Use /api/decide-for-keys for multiple flags
const response = await fetch('/api/decide-for-keys', {
  method: 'POST',
  body: JSON.stringify({
    flagKeys: ['flag1', 'flag2', 'flag3'],
    userId: 'user123'
  })
});
```

### 2. Enable Caching

The Edge Agent caches datafiles and optionally decisions:
- Datafiles are cached for 1 hour by default
- Decision caching must be explicitly enabled
- Cache keys include user context for proper invalidation

### 3. Minimize Payload Size

Use available options to reduce response size:
- `trimmedDecisions: true` - Return only essential fields
- `decideOptions: ['EXCLUDE_VARIABLES']` - Skip variable values
- `enableResponseMetadata: false` - Disable metadata

### 4. Edge vs Agent Mode

**Edge Mode** (fastest):
- Uses cached datafile only
- No external API calls
- Immediate responses

**Agent Mode**:
- May fetch fresh datafile
- Supports User Profile Service
- Higher latency for cache misses

## Configuration for Performance

### Environment Variables

While the codebase doesn't define performance-specific environment variables, these general settings affect performance:

```bash
# SDK Key (required)
OPTIMIZELY_SDK_KEY=your-sdk-key

# Admin token (for cache management)
OPTIMIZELY_ADMIN_TOKEN=your-admin-token

# Platform-specific KV bindings
# Cloudflare: Configure in wrangler.toml
# Fastly: Configure in fastly.toml
# Vercel: Configure in vercel.json
```

### Request Configuration

From `ConfigurationService`:
```typescript
// Default configuration that affects performance
defaultSetResponseHeaders: true,
defaultSetResponseCookies: true,
defaultSetRequestHeaders: true,
defaultSetRequestCookies: true,
enableFlagsFromKV: false,
datafileFromKV: false,
enableResponseMetadata: false
```

## Testing Performance

The codebase includes basic performance tests:

```typescript
// From src-v2/tests/integration/ApiPerformanceTests.test.ts
describe('API Performance Tests', () => {
  // Tests focus on functional performance, not measurement
  it('should handle concurrent requests efficiently', async () => {
    // Test implementation
  });
});
```

## Client-Side Optimization

### Simple Caching Example

```javascript
class OptimizelyCache {
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
    
    if (!cached || Date.now() - cached.time > this.ttl) {
      return null;
    }
    
    return cached.data;
  }
  
  set(flagKey, userId, attributes, data) {
    const key = this.getCacheKey(flagKey, userId, attributes);
    this.cache.set(key, { data, time: Date.now() });
  }
}
```

### Request Deduplication

```javascript
class RequestDeduplicator {
  constructor() {
    this.pending = new Map();
  }
  
  async dedupe(key, requestFn) {
    if (this.pending.has(key)) {
      return this.pending.get(key);
    }
    
    const promise = requestFn()
      .finally(() => this.pending.delete(key));
    
    this.pending.set(key, promise);
    return promise;
  }
}

// Usage
const dedup = new RequestDeduplicator();
const decision = await dedup.dedupe(
  `decide:${flagKey}:${userId}`,
  () => fetchDecision(flagKey, userId)
);
```

## Platform Limits

While the Edge Agent doesn't enforce limits, the platforms do:

### Cloudflare Workers
- CPU time: 10ms-30s depending on plan
- Memory: 128MB
- Subrequests: 50-1000 depending on plan

### Fastly Compute@Edge
- Execution time: 60s max
- Memory: 128MB
- Package size: 100MB

### Vercel Edge Functions
- Execution time: 30s max
- Memory: 128MB
- Function size: 1MB

## See Also

- [Caching Configuration](../configuration/cache-configuration.md)
- [Edge Mode Configuration](../configuration/edge-mode-configuration.md)
- [Agent Mode Configuration](../configuration/agent-mode-configuration.md)
- [Platform Adapters](../cdn-adapters/)

---

**Implementation References**:
- Cache Service: `/src-v2/services/implementations/CacheService.ts`
- Metrics Adapters: `/src-v2/adapters/implementations/*MetricsAdapter.ts`
- Performance Tests: `/src-v2/tests/integration/ApiPerformanceTests.test.ts`

**Last Updated**: 2025-05-30