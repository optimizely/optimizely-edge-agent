# Cloudflare Workers Adapter

## Overview

The Cloudflare Workers adapter enables the Optimizely Edge Agent to run on Cloudflare's global edge network. This adapter leverages Cloudflare's V8 isolates for near-zero cold starts, Workers KV for distributed storage, and advanced features like Durable Objects and Analytics Engine.

## ⚠️ Important Limitations

### Same-Zone Fetch Restriction

Cloudflare Workers have a critical limitation when fetching resources within the same zone:

**❌ What doesn't work:**
- Worker → Another Worker (same zone, using Routes)
- Worker → Cloudflare Pages (same zone, using Routes)
- Worker → Any workers.dev subdomain (same zone)

**✅ What works:**
- Worker → External origins (AWS, GCP, Kubernetes, any non-Cloudflare hosting)
- Worker → Worker with Custom Domains (same zone)
- Worker → Worker via Service Bindings
- Worker → Any non-Cloudflare hosted content

### Why This Matters for Edge Mode

Edge Mode relies on fetching content from origin servers. This limitation affects:

1. **Development/Testing**: When both Edge Agent and content are on Cloudflare
2. **Cloudflare-only deployments**: When customers use Cloudflare for everything

**Most production deployments fetch from external origins and are NOT affected.**

### Solutions and Workarounds

#### 1. Use Custom Domains (Recommended)

```toml
# wrangler.toml
[[routes]]
pattern = "api.example.com/*"
custom_domain = true  # This allows same-zone fetching!
```

Custom Domains can fetch from other Custom Domains in the same zone without restrictions.

#### 2. Use Service Bindings

```toml
[[services]]
binding = "CONTENT_SERVICE"
service = "pages-content-worker"
```

Service bindings provide direct Worker-to-Worker communication without network requests.

#### 3. External Origin (Most Common)

```javascript
// This always works - no restrictions!
const response = await fetch('https://origin.aws.example.com/content');
```

### Testing Configuration

For local development and testing with Cloudflare Pages:

```toml
# Development setup
[env.development]
vars = {
  # Use Custom Domain for Pages content
  DEV_CONTENT_BASE_URL = "https://content.example.com"
}

# Test with debug flag to bypass URL matching
# https://api.example.com/?force-edge-mode=true
```

## Platform Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     Cloudflare Workers Architecture                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Edge Locations (275+)          Core Services           Storage Layer   │
│  ┌──────────────┐              ┌─────────────┐        ┌──────────────┐ │
│  │   Workers    │              │   Edge      │        │  Workers KV  │ │
│  │  V8 Isolates │◄────────────▶│   Agent     │◄──────▶│ (Eventually  │ │
│  │              │              │             │        │  Consistent) │ │
│  └──────────────┘              └─────────────┘        └──────────────┘ │
│         │                              │                       │         │
│         ▼                              ▼                       ▼         │
│  ┌──────────────┐              ┌─────────────┐        ┌──────────────┐ │
│  │  Cache API   │              │  Analytics  │        │   Durable    │ │
│  │ (Edge Cache) │              │   Engine    │        │   Objects    │ │
│  └──────────────┘              └─────────────┘        └──────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Adapter Implementation

### CloudflareRequestAdapter

```typescript
// From: /src-v2/adapters/implementations/cloudflare/CloudflareRequestAdapter.ts
export class CloudflareRequestAdapter implements IRequestAdapter {
  private _url: URL;
  private _body: ReadableStream<Uint8Array> | null;
  
  constructor(private request: Request) {
    this._url = new URL(request.url);
    this._body = request.body;
  }
  
  get url(): URL {
    return this._url;
  }
  
  get method(): string {
    return this.request.method;
  }
  
  get headers(): Headers {
    return this.request.headers;
  }
  
  get body(): ReadableStream<Uint8Array> | null {
    return this._body;
  }
  
  getHeader(name: string): string | null {
    return this.request.headers.get(name);
  }
  
  getAllHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    this.request.headers.forEach((value, key) => {
      headers[key] = value;
    });
    return headers;
  }
  
  async getBody(): Promise<string> {
    if (!this._body) return '';
    
    try {
      return await this.request.text();
    } catch (error) {
      // Body already read, return empty
      return '';
    }
  }
  
  getQueryParam(name: string): string | null {
    return this._url.searchParams.get(name);
  }
  
  getAllQueryParams(): Record<string, string> {
    const params: Record<string, string> = {};
    this._url.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    return params;
  }
  
  getCookie(name: string): string | null {
    const cookieString = this.request.headers.get('Cookie');
    if (!cookieString) return null;
    
    const cookies = cookieString.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      if (key) acc[key] = decodeURIComponent(value || '');
      return acc;
    }, {} as Record<string, string>);
    
    return cookies[name] || null;
  }
  
  getAllCookies(): Record<string, string> {
    const cookieString = this.request.headers.get('Cookie') || '';
    return cookieString.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      if (key) acc[key] = decodeURIComponent(value || '');
      return acc;
    }, {} as Record<string, string>);
  }
  
  clone(): IRequestAdapter {
    return new CloudflareRequestAdapter(this.request.clone());
  }
}
```

### CloudflareStorageAdapter

```typescript
// From: /src-v2/adapters/implementations/cloudflare/CloudflareStorageAdapter.ts
export class CloudflareStorageAdapter implements IStorageAdapter {
  constructor(
    private kv: KVNamespace,
    private logger: ILoggerAdapter
  ) {}
  
  async get(key: string): Promise<string | null> {
    try {
      const value = await this.kv.get(key);
      if (value === null) {
        this.logger.debug(`KV miss for key: ${key}`);
      } else {
        this.logger.debug(`KV hit for key: ${key}`);
      }
      return value;
    } catch (error) {
      this.logger.error(`KV get error for key: ${key}`, error as Error);
      return null;
    }
  }
  
  async getWithMetadata<T = any>(key: string): Promise<{ value: string | null; metadata: T | null }> {
    try {
      const result = await this.kv.getWithMetadata<T>(key);
      return {
        value: result.value,
        metadata: result.metadata
      };
    } catch (error) {
      this.logger.error(`KV getWithMetadata error for key: ${key}`, error as Error);
      return { value: null, metadata: null };
    }
  }
  
  async put(key: string, value: string, options?: StorageOptions): Promise<void> {
    try {
      const kvOptions: KVNamespacePutOptions = {};
      
      if (options?.expirationTtl) {
        kvOptions.expirationTtl = options.expirationTtl;
      }
      
      if (options?.metadata) {
        kvOptions.metadata = options.metadata;
      }
      
      await this.kv.put(key, value, kvOptions);
      this.logger.debug(`KV put successful for key: ${key}`);
    } catch (error) {
      this.logger.error(`KV put error for key: ${key}`, error as Error);
      throw error;
    }
  }
  
  async delete(key: string): Promise<void> {
    try {
      await this.kv.delete(key);
      this.logger.debug(`KV delete successful for key: ${key}`);
    } catch (error) {
      this.logger.error(`KV delete error for key: ${key}`, error as Error);
      throw error;
    }
  }
  
  async list(options?: ListOptions): Promise<ListResult> {
    try {
      const listOptions: KVNamespaceListOptions = {};
      
      if (options?.prefix) listOptions.prefix = options.prefix;
      if (options?.limit) listOptions.limit = options.limit;
      if (options?.cursor) listOptions.cursor = options.cursor;
      
      const result = await this.kv.list(listOptions);
      
      return {
        keys: result.keys.map(key => ({
          name: key.name,
          metadata: key.metadata
        })),
        cursor: result.cursor,
        complete: result.list_complete
      };
    } catch (error) {
      this.logger.error('KV list error', error as Error);
      throw error;
    }
  }
}
```

### CloudflareEnvironmentAdapter

```typescript
// From: /src-v2/adapters/implementations/cloudflare/CloudflareEnvironmentAdapter.ts
export class CloudflareEnvironmentAdapter implements IEnvironmentAdapter {
  constructor(private env: CloudflareEnvironment) {}
  
  get(key: string): string | undefined {
    // Check environment bindings
    const value = this.env[key];
    
    // Cloudflare stores env vars as strings or bindings
    if (typeof value === 'string') {
      return value;
    }
    
    return undefined;
  }
  
  getRequired(key: string): string {
    const value = this.get(key);
    if (!value) {
      throw new Error(`Required environment variable '${key}' is not set`);
    }
    return value;
  }
  
  getAll(): Record<string, string> {
    const result: Record<string, string> = {};
    
    // Iterate through env object
    for (const [key, value] of Object.entries(this.env)) {
      // Only include string values (not KV namespaces, etc.)
      if (typeof value === 'string') {
        result[key] = value;
      }
    }
    
    return result;
  }
}
```

## Cloudflare-Specific Features

### Workers KV Integration

```typescript
// KV namespace configuration
interface CloudflareEnvironment {
  // KV namespaces
  OPTIMIZELY_KV: KVNamespace;
  USER_PROFILES: KVNamespace;
  CACHE_STORE: KVNamespace;
  
  // Environment variables
  OPTIMIZELY_SDK_KEY: string;
  ENVIRONMENT: string;
  
  // Optional bindings
  ANALYTICS?: AnalyticsEngineDataset;
  DURABLE_OBJECTS?: DurableObjectNamespace;
}

// Using KV for caching
class KVCacheService {
  constructor(private kv: KVNamespace) {}
  
  async getCachedDecision(key: string): Promise<OptimizelyDecision | null> {
    const cached = await this.kv.get(key);
    if (!cached) return null;
    
    try {
      const data = JSON.parse(cached);
      
      // Check expiration
      if (data.expiresAt < Date.now()) {
        await this.kv.delete(key);
        return null;
      }
      
      return data.decision;
    } catch (error) {
      // Invalid cache entry
      await this.kv.delete(key);
      return null;
    }
  }
  
  async cacheDecision(
    key: string, 
    decision: OptimizelyDecision, 
    ttl: number = 300
  ): Promise<void> {
    const data = {
      decision,
      expiresAt: Date.now() + (ttl * 1000),
      cachedAt: Date.now()
    };
    
    await this.kv.put(key, JSON.stringify(data), {
      expirationTtl: ttl
    });
  }
}
```

### Cache API

```typescript
// Cloudflare Cache API for HTTP caching
class CloudflareCacheService {
  private cache = caches.default;
  
  async getCachedResponse(request: Request): Promise<Response | null> {
    const cacheKey = new Request(request.url, request);
    const cached = await this.cache.match(cacheKey);
    
    if (cached) {
      // Clone response before returning
      return cached.clone();
    }
    
    return null;
  }
  
  async cacheResponse(
    request: Request, 
    response: Response, 
    ttl: number = 300
  ): Promise<void> {
    // Only cache successful responses
    if (response.status !== 200) return;
    
    const cacheKey = new Request(request.url, request);
    const responseToCache = response.clone();
    
    // Add cache headers
    const headers = new Headers(responseToCache.headers);
    headers.set('Cache-Control', `public, max-age=${ttl}`);
    headers.set('X-Cache-Status', 'HIT');
    
    const cachedResponse = new Response(responseToCache.body, {
      status: responseToCache.status,
      statusText: responseToCache.statusText,
      headers
    });
    
    await this.cache.put(cacheKey, cachedResponse);
  }
  
  async purgeCache(pattern: string): Promise<void> {
    // Note: Cache purging requires API call
    // This is a placeholder for the actual implementation
    console.log(`Would purge cache for pattern: ${pattern}`);
  }
}
```

### Analytics Engine

```typescript
// From: /src-v2/adapters/implementations/cloudflare/CloudflareMetricsAdapter.ts
export class CloudflareMetricsAdapter implements IMetricsAdapter {
  constructor(
    private analytics?: AnalyticsEngineDataset,
    private logger?: ILoggerAdapter
  ) {}
  
  increment(metric: string, value: number = 1, tags?: Record<string, string>): void {
    if (!this.analytics) return;
    
    try {
      this.analytics.writeDataPoint({
        indexes: [metric],
        doubles: [value],
        blobs: tags ? [JSON.stringify(tags)] : undefined
      });
    } catch (error) {
      this.logger?.error('Failed to write analytics', error as Error);
    }
  }
  
  gauge(metric: string, value: number, tags?: Record<string, string>): void {
    if (!this.analytics) return;
    
    try {
      this.analytics.writeDataPoint({
        indexes: [metric, 'gauge'],
        doubles: [value, Date.now()],
        blobs: tags ? [JSON.stringify(tags)] : undefined
      });
    } catch (error) {
      this.logger?.error('Failed to write gauge', error as Error);
    }
  }
  
  timing(metric: string, duration: number, tags?: Record<string, string>): void {
    if (!this.analytics) return;
    
    try {
      this.analytics.writeDataPoint({
        indexes: [metric, 'timing'],
        doubles: [duration],
        blobs: tags ? [JSON.stringify(tags)] : undefined
      });
    } catch (error) {
      this.logger?.error('Failed to write timing', error as Error);
    }
  }
  
  async flush(): Promise<void> {
    // Analytics Engine writes are automatic
    return Promise.resolve();
  }
}
```

### Durable Objects

```typescript
// Durable Objects for stateful operations
export class OptimizelyStateDurableObject {
  private state: DurableObjectState;
  private storage: DurableObjectStorage;
  
  constructor(state: DurableObjectState, env: CloudflareEnvironment) {
    this.state = state;
    this.storage = state.storage;
  }
  
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    switch (url.pathname) {
      case '/increment':
        return this.handleIncrement(request);
      case '/get':
        return this.handleGet(request);
      case '/reset':
        return this.handleReset();
      default:
        return new Response('Not found', { status: 404 });
    }
  }
  
  private async handleIncrement(request: Request): Promise<Response> {
    const { metric, value = 1 } = await request.json();
    
    const current = await this.storage.get<number>(metric) || 0;
    const updated = current + value;
    
    await this.storage.put(metric, updated);
    
    return Response.json({ metric, value: updated });
  }
  
  private async handleGet(request: Request): Promise<Response> {
    const { metric } = await request.json();
    const value = await this.storage.get<number>(metric) || 0;
    
    return Response.json({ metric, value });
  }
  
  private async handleReset(): Promise<Response> {
    await this.storage.deleteAll();
    return Response.json({ status: 'reset' });
  }
}
```

## Configuration

### Wrangler Configuration

```toml
# wrangler.toml
name = "optimizely-edge-agent"
main = "dist/cloudflare/index.js"
compatibility_date = "2024-01-01"
node_compat = true

# Development environment
[env.development]
vars = { 
  ENVIRONMENT = "development",
  LOG_LEVEL = "debug",
  OPTIMIZELY_SDK_KEY = "dev_sdk_key"
}

kv_namespaces = [
  { binding = "OPTIMIZELY_KV", id = "dev_kv_namespace_id" },
  { binding = "USER_PROFILES", id = "dev_profiles_namespace_id" }
]

# Production environment
[env.production]
vars = { 
  ENVIRONMENT = "production",
  LOG_LEVEL = "warn"
}

kv_namespaces = [
  { binding = "OPTIMIZELY_KV", id = "prod_kv_namespace_id" },
  { binding = "USER_PROFILES", id = "prod_profiles_namespace_id" }
]

analytics_engine_datasets = [
  { binding = "ANALYTICS", dataset = "optimizely_metrics" }
]

durable_objects = {
  bindings = [
    { name = "STATE", class_name = "OptimizelyStateDurableObject" }
  ]
}

# Routes
[[routes]]
pattern = "example.com/optimizely/*"
zone_name = "example.com"

[[routes]]
pattern = "api.example.com/*"
zone_name = "example.com"

# Build configuration
[build]
command = "npm run build:cloudflare"

[build.upload]
format = "modules"
main = "./dist/cloudflare/index.js"
```

### Environment Setup

```bash
# Create KV namespaces
wrangler kv:namespace create "OPTIMIZELY_KV"
wrangler kv:namespace create "USER_PROFILES"

# Set secrets (not in wrangler.toml)
wrangler secret put OPTIMIZELY_SDK_KEY

# Deploy to development
wrangler publish --env development

# Deploy to production
wrangler publish --env production
```

## Performance Optimization

### Cold Start Mitigation

```typescript
// From: /src-v2/index.ts
// Pre-initialize heavy operations
const initPromise = (async () => {
  // Pre-compile regex patterns
  const patterns = compilePatterns();
  
  // Pre-load critical modules
  await Promise.all([
    import('./services/implementations/DecisionService'),
    import('./services/implementations/DatafileService')
  ]);
  
  return { patterns };
})();

export default {
  async fetch(
    request: Request,
    env: CloudflareEnvironment,
    ctx: ExecutionContext
  ): Promise<Response> {
    // Wait for initialization
    const { patterns } = await initPromise;
    
    // Create handler with minimal overhead
    const handler = createCloudflareHandler(request, env, ctx);
    return handler.handleRequest();
  }
};
```

### Request Coalescing

```typescript
// Coalesce duplicate requests
class RequestCoalescer {
  private pending = new Map<string, Promise<Response>>();
  
  async handleRequest(
    key: string,
    handler: () => Promise<Response>
  ): Promise<Response> {
    // Check if request is already pending
    const pending = this.pending.get(key);
    if (pending) {
      return pending.clone();
    }
    
    // Create new request promise
    const promise = handler().finally(() => {
      this.pending.delete(key);
    });
    
    this.pending.set(key, promise);
    return promise;
  }
}
```

### Smart Caching

```typescript
// Multi-tier caching strategy
class CloudflareCacheStrategy {
  async get(key: string): Promise<any> {
    // L1: In-memory cache (request scope)
    const memory = this.memoryCache.get(key);
    if (memory) return memory;
    
    // L2: Cache API (edge location)
    const cached = await this.cacheAPI.match(key);
    if (cached) {
      const data = await cached.json();
      this.memoryCache.set(key, data);
      return data;
    }
    
    // L3: Workers KV (global)
    const kv = await this.kvStore.get(key);
    if (kv) {
      const data = JSON.parse(kv);
      this.memoryCache.set(key, data);
      await this.cacheAPI.put(key, Response.json(data));
      return data;
    }
    
    return null;
  }
}
```

## Deployment

### Build Process

```bash
# Install dependencies
npm install

# Build for Cloudflare
npm run build:cloudflare

# Run type checking
npm run typecheck:cloudflare

# Run tests
npm run test:cloudflare
```

### Deployment Commands

```bash
# Deploy to development
wrangler publish --env development

# Deploy to production with dry run
wrangler publish --env production --dry-run

# Deploy to production
wrangler publish --env production

# Tail logs
wrangler tail --env production

# Check metrics
wrangler analytics engine sql "SELECT * FROM optimizely_metrics"
```

### CI/CD Pipeline

```yaml
# .github/workflows/cloudflare-deploy.yml
name: Deploy to Cloudflare

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Build
        run: npm run build:cloudflare
        
      - name: Run tests
        run: npm run test:cloudflare
        
      - name: Deploy to Cloudflare
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          environment: production
```

## Monitoring and Debugging

### Logging

```typescript
// Structured logging for Cloudflare
class CloudflareLogger implements ILoggerAdapter {
  debug(message: string, context?: any): void {
    if (this.logLevel > LogLevel.DEBUG) return;
    
    console.log(JSON.stringify({
      level: 'debug',
      message,
      context,
      timestamp: new Date().toISOString(),
      rayId: this.request.headers.get('cf-ray')
    }));
  }
  
  error(message: string, error?: Error, context?: any): void {
    console.error(JSON.stringify({
      level: 'error',
      message,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined,
      context,
      timestamp: new Date().toISOString(),
      rayId: this.request.headers.get('cf-ray')
    }));
  }
}
```

### Real-time Logs

```bash
# Tail logs with filters
wrangler tail --env production --filter status:500

# Search logs
wrangler tail --env production --search "error"

# Pretty print JSON logs
wrangler tail --env production --pretty
```

### Performance Monitoring

```sql
-- Query Analytics Engine for metrics
SELECT 
  INDEX_0 as metric,
  COUNT(*) as count,
  AVG(DOUBLE_0) as avg_value,
  MAX(DOUBLE_0) as max_value,
  MIN(DOUBLE_0) as min_value
FROM optimizely_metrics
WHERE 
  TIMESTAMP >= NOW() - INTERVAL '1' HOUR
  AND INDEX_0 LIKE 'decision.%'
GROUP BY INDEX_0
ORDER BY count DESC
```

## Best Practices

### 1. Use Workers KV Efficiently

```typescript
// Batch KV operations
async function batchKVOperations(operations: KVOperation[]): Promise<void> {
  // Group by operation type
  const puts = operations.filter(op => op.type === 'put');
  const deletes = operations.filter(op => op.type === 'delete');
  
  // Execute in parallel
  await Promise.all([
    ...puts.map(op => kv.put(op.key, op.value, op.options)),
    ...deletes.map(op => kv.delete(op.key))
  ]);
}
```

### 2. Leverage Edge Locations

```typescript
// Use CF headers for geo-targeting
const country = request.headers.get('cf-ipcountry');
const colo = request.headers.get('cf-ray')?.split('-')[1];

// Make decisions based on location
if (country === 'US' && colo === 'LAX') {
  // US West Coast specific logic
}
```

### 3. Handle Rate Limits

```typescript
// Implement rate limiting
const rateLimiter = {
  async checkLimit(ip: string): Promise<boolean> {
    const key = `rate:${ip}:${Math.floor(Date.now() / 60000)}`;
    const count = await kv.get(key);
    
    if (count && parseInt(count) > 100) {
      return false; // Rate limited
    }
    
    await kv.put(key, String((parseInt(count || '0') + 1)), {
      expirationTtl: 60
    });
    
    return true;
  }
};
```

## Troubleshooting

### Common Issues

1. **KV Consistency**
   ```typescript
   // Handle eventual consistency
   const value = await kv.get(key);
   if (!value) {
     // Retry with backoff
     await new Promise(resolve => setTimeout(resolve, 100));
     return kv.get(key);
   }
   ```

2. **CPU Limits**
   ```typescript
   // Monitor CPU usage
   const start = Date.now();
   // ... operation ...
   const duration = Date.now() - start;
   if (duration > 10) {
     console.warn(`Operation took ${duration}ms`);
   }
   ```

3. **Memory Constraints**
   ```typescript
   // Avoid memory leaks
   const cache = new Map();
   
   // Limit cache size
   if (cache.size > 1000) {
     const firstKey = cache.keys().next().value;
     cache.delete(firstKey);
   }
   ```

## Testing and QA Features

### Forced Decisions

The Cloudflare adapter fully supports forced decisions for testing and QA scenarios. This allows you to override normal feature flag bucketing to test specific variations.

#### Using Forced Decisions with Cloudflare Workers

```typescript
// Example: Cloudflare Worker with forced decisions
export default {
  async fetch(request: Request, env: CloudflareEnvironment, ctx: ExecutionContext) {
    const url = new URL(request.url);
    
    // Example 1: Force variation via headers (highest precedence)
    const headers = new Headers(request.headers);
    headers.set('X-Optimizely-Force-Variation', 'treatment');
    
    // Example 2: Force variation via query parameters
    url.searchParams.set('forceVariation', 'treatment');
    
    // Example 3: Force variation in request body
    const body = {
      flagKey: 'checkout_flow',
      userId: 'test_user',
      forcedVariationKey: 'express_checkout'
    };
    
    // Make decision with forced variation
    const response = await fetch(new Request(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    }));
    
    return response;
  }
};
```

#### Testing Script for Cloudflare

```bash
#!/bin/bash
# Test forced decisions on Cloudflare Workers deployment

WORKER_URL="https://optimizely-edge-agent.your-subdomain.workers.dev"
SDK_KEY="your-sdk-key"

# Test 1: Force variation via header
echo "Testing forced variation via header..."
curl -X POST "$WORKER_URL/api/decide" \
  -H "Content-Type: application/json" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: $SDK_KEY" \
  -H "X-Optimizely-Force-Variation: treatment" \
  -d '{
    "flagKey": "checkout_flow",
    "userId": "qa_tester_001"
  }'

# Test 2: Force variation via query parameter
echo -e "\n\nTesting forced variation via query parameter..."
curl -X GET "$WORKER_URL/api/decide?\
flagKey=checkout_flow&\
userId=qa_tester_001&\
forceVariation=control&\
sdkKey=$SDK_KEY" \
  -H "X-Optimizely-Enable-FEX: true"

# Test 3: Force variation via request body
echo -e "\n\nTesting forced variation via request body..."
curl -X POST "$WORKER_URL/api/decide" \
  -H "Content-Type: application/json" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: $SDK_KEY" \
  -d '{
    "flagKey": "checkout_flow",
    "userId": "qa_tester_001",
    "forcedVariationKey": "express_checkout",
    "forcedRuleKey": "experiment_123"
  }'

# Test 4: Test precedence (header should win)
echo -e "\n\nTesting precedence (header > query > body)..."
curl -X POST "$WORKER_URL/api/decide?forceVariation=query_variation" \
  -H "Content-Type: application/json" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: $SDK_KEY" \
  -H "X-Optimizely-Force-Variation: header_variation" \
  -d '{
    "flagKey": "checkout_flow",
    "userId": "qa_tester_001",
    "forcedVariationKey": "body_variation"
  }'
```

#### QA Dashboard Integration

```typescript
// QA dashboard that uses forced decisions
class QADashboard {
  private kvStore: KVNamespace;
  
  async setQAOverride(
    userId: string, 
    flagKey: string, 
    variation: string
  ): Promise<void> {
    const key = `qa_override:${userId}:${flagKey}`;
    await this.kvStore.put(key, variation, {
      expirationTtl: 3600 // 1 hour TTL for QA overrides
    });
  }
  
  async getQAOverrides(userId: string): Promise<Record<string, string>> {
    const prefix = `qa_override:${userId}:`;
    const list = await this.kvStore.list({ prefix });
    
    const overrides: Record<string, string> = {};
    for (const key of list.keys) {
      const flagKey = key.name.replace(prefix, '');
      const variation = await this.kvStore.get(key.name);
      if (variation) {
        overrides[flagKey] = variation;
      }
    }
    
    return overrides;
  }
  
  // Apply QA overrides to requests
  async applyQAOverrides(request: Request): Promise<Request> {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    
    if (!userId) return request;
    
    const overrides = await this.getQAOverrides(userId);
    const headers = new Headers(request.headers);
    
    // Apply the first override found (simplified example)
    const [flagKey, variation] = Object.entries(overrides)[0] || [];
    if (flagKey && variation) {
      headers.set('X-Optimizely-Force-Variation', variation);
    }
    
    return new Request(request, { headers });
  }
}
```

#### Automated Testing with Forced Decisions

```typescript
// Automated test suite using forced decisions
describe('Cloudflare Edge Agent Tests', () => {
  const baseUrl = 'https://optimizely-edge-agent.workers.dev';
  
  test('should respect forced variation from header', async () => {
    const response = await fetch(`${baseUrl}/api/decide`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Optimizely-Enable-FEX': 'true',
        'X-Optimizely-SDK-Key': 'test-key',
        'X-Optimizely-Force-Variation': 'variant_b'
      },
      body: JSON.stringify({
        flagKey: 'test_feature',
        userId: 'test_user'
      })
    });
    
    const decision = await response.json();
    expect(decision.variationKey).toBe('variant_b');
  });
  
  test('should handle forced decisions in edge mode', async () => {
    // Test edge mode with forced variation
    const response = await fetch(`${baseUrl}/test-page?forceVariation=edge_variant`, {
      headers: {
        'X-Optimizely-SDK-Key': 'test-key'
      }
    });
    
    // Should serve content for forced variation
    expect(response.headers.get('X-Optimizely-Variation-Key')).toBe('edge_variant');
  });
});
```

## See Also

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Workers KV Documentation](https://developers.cloudflare.com/workers/runtime-apis/kv/)
- [Analytics Engine Documentation](https://developers.cloudflare.com/analytics/analytics-engine/)
- [Adapter Development Guide](./adapter-development.md)
- [API Decision Endpoints](../api/decisions/decide.md)
- Implementation: `/src-v2/adapters/implementations/cloudflare/`