# Adapter Pattern

The adapter pattern is fundamental to the Optimizely Edge Agent v2's platform independence. This document explains how adapters abstract platform-specific implementations behind common interfaces, enabling seamless deployment across different edge computing platforms.

## Overview

The adapter pattern provides:
- **Platform Abstraction**: Hide platform-specific APIs behind common interfaces
- **Pluggability**: Easy addition of new platforms without changing core logic
- **Testability**: Mock adapters for unit testing
- **Type Safety**: TypeScript interfaces ensure correct implementations
- **Flexibility**: Platform-specific optimizations without affecting portability

## Adapter Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Core Application Logic                       │
│              (Platform-agnostic business logic)                  │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                   ┌──────────▼──────────┐
                   │  Adapter Interfaces │
                   │   (Contracts)        │
                   └──────────┬──────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────▼────────┐  ┌────────▼────────┐  ┌────────▼────────┐
│   Cloudflare   │  │     Fastly      │  │     Vercel      │
│ Implementation │  │ Implementation  │  │ Implementation  │
└────────────────┘  └─────────────────┘  └─────────────────┘
        │                     │                     │
┌───────▼────────┐  ┌────────▼────────┐  ┌────────▼────────┐
│ Workers API    │  │ Compute@Edge    │  │ Edge Runtime    │
└────────────────┘  └─────────────────┘  └─────────────────┘
```

## Core Adapter Interfaces

### IRequestAdapter

Abstracts HTTP request handling across platforms:

```typescript
export interface IRequestAdapter {
  /**
   * Get the HTTP method
   */
  getMethod(): string;

  /**
   * Get the request URL
   */
  getUrl(): URL;

  /**
   * Get a specific header value
   */
  getHeader(name: string): string | null;

  /**
   * Get all headers
   */
  getHeaders(): Headers;

  /**
   * Get the request body as JSON
   */
  getBody<T = any>(): Promise<T | null>;

  /**
   * Get raw body as text
   */
  getBodyText(): Promise<string>;

  /**
   * Get client IP address
   */
  getClientIp(): string | null;

  /**
   * Get cookies
   */
  getCookies(): Record<string, string>;

  /**
   * Platform-specific context
   */
  getPlatformContext(): any;
}
```

**Implementations**:
- `/src-v2/adapters/implementations/cloudflare/CloudflareRequestAdapter.ts`
- `/src-v2/adapters/implementations/fastly/FastlyRequestAdapter.ts`
- `/src-v2/adapters/implementations/vercel/VercelRequestAdapter.ts`

### IResponseAdapter

Standardizes response creation:

```typescript
export interface IResponseAdapter {
  /**
   * Create a response
   */
  createResponse(
    body: string | ReadableStream | ArrayBuffer,
    options?: ResponseOptions
  ): Response;

  /**
   * Set response headers
   */
  setHeaders(headers: Record<string, string>): void;

  /**
   * Set cookies
   */
  setCookies(cookies: Cookie[]): void;

  /**
   * Stream response body
   */
  streamResponse(
    stream: ReadableStream,
    options?: ResponseOptions
  ): Response;
}

interface ResponseOptions {
  status?: number;
  statusText?: string;
  headers?: HeadersInit;
}

interface Cookie {
  name: string;
  value: string;
  options?: CookieOptions;
}
```

### IStorageAdapter

Provides key-value storage abstraction:

```typescript
export interface IStorageAdapter {
  /**
   * Get value by key
   */
  get(key: string): Promise<string | null>;

  /**
   * Get with metadata
   */
  getWithMetadata<T = any>(
    key: string
  ): Promise<{ value: string | null; metadata?: T }>;

  /**
   * Set value with optional TTL
   */
  put(
    key: string,
    value: string,
    options?: StorageOptions
  ): Promise<void>;

  /**
   * Delete value
   */
  delete(key: string): Promise<void>;

  /**
   * List keys by prefix
   */
  list(options?: ListOptions): Promise<StorageListResult>;
}

interface StorageOptions {
  expirationTtl?: number;
  metadata?: Record<string, any>;
}
```

### IEnvironmentAdapter

Accesses environment variables and platform features:

```typescript
export interface IEnvironmentAdapter {
  /**
   * Get environment variable
   */
  getVariable(name: string): string | undefined;

  /**
   * Get all variables with prefix
   */
  getVariablesWithPrefix(prefix: string): Record<string, string>;

  /**
   * Platform-specific bindings
   */
  getBinding<T = any>(name: string): T | undefined;

  /**
   * Platform capabilities
   */
  getCapabilities(): PlatformCapabilities;
}

interface PlatformCapabilities {
  hasKVStorage: boolean;
  hasDurableObjects: boolean;
  hasWebSockets: boolean;
  maxWorkerMemory: number;
  maxRequestSize: number;
  maxResponseSize: number;
}
```

### ILoggerAdapter

Provides consistent logging across platforms:

```typescript
export interface ILoggerAdapter {
  /**
   * Log levels
   */
  debug(message: string, context?: any): void;
  info(message: string, context?: any): void;
  warn(message: string, context?: any): void;
  error(message: string, error?: any, context?: any): void;

  /**
   * Structured logging
   */
  log(level: LogLevel, message: string, context?: any): void;

  /**
   * Create child logger with context
   */
  child(context: Record<string, any>): ILoggerAdapter;

  /**
   * Flush logs (if buffered)
   */
  flush(): Promise<void>;
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
```

### IMetricsAdapter

Abstracts metrics collection:

```typescript
export interface IMetricsAdapter {
  /**
   * Increment counter
   */
  incrementCounter(
    name: string,
    value?: number,
    tags?: MetricTags,
    options?: MetricOptions
  ): void;

  /**
   * Record histogram value
   */
  recordHistogram(
    name: string,
    value: number,
    tags?: MetricTags,
    options?: MetricOptions
  ): void;

  /**
   * Start a timer
   */
  startTimer(
    name: string,
    tags?: MetricTags,
    options?: MetricOptions
  ): TimerMetric;

  /**
   * Set gauge value
   */
  setGauge(
    name: string,
    value: number,
    tags?: MetricTags,
    options?: MetricOptions
  ): void;
}
```

## Platform-Specific Implementations

### Cloudflare Workers

```typescript
export class CloudflareRequestAdapter implements IRequestAdapter {
  constructor(
    private request: Request,
    private ctx: ExecutionContext
  ) {}

  getMethod(): string {
    return this.request.method;
  }

  getUrl(): URL {
    return new URL(this.request.url);
  }

  getHeader(name: string): string | null {
    return this.request.headers.get(name);
  }

  async getBody<T>(): Promise<T | null> {
    try {
      const text = await this.request.text();
      return text ? JSON.parse(text) : null;
    } catch {
      return null;
    }
  }

  getClientIp(): string | null {
    // Cloudflare-specific CF-Connecting-IP header
    return this.request.headers.get('CF-Connecting-IP') || 
           this.request.headers.get('X-Forwarded-For')?.split(',')[0] || 
           null;
  }

  getPlatformContext(): ExecutionContext {
    return this.ctx;
  }
}
```

### Fastly Compute@Edge

```typescript
export class FastlyRequestAdapter implements IRequestAdapter {
  constructor(private request: Request) {}

  getMethod(): string {
    return this.request.method;
  }

  getClientIp(): string | null {
    // Fastly-specific client IP access
    const clientInfo = this.request.headers.get('Fastly-Client-IP');
    return clientInfo || null;
  }

  getCookies(): Record<string, string> {
    // Fastly cookie parsing
    const cookieHeader = this.request.headers.get('Cookie');
    return this.parseCookies(cookieHeader || '');
  }

  // Platform-specific optimizations
  async getBody<T>(): Promise<T | null> {
    // Fastly-optimized body reading
    const body = await this.request.body;
    return body ? JSON.parse(body) : null;
  }
}
```

### Vercel Edge Functions

```typescript
export class VercelRequestAdapter implements IRequestAdapter {
  constructor(
    private request: Request,
    private event: RequestEvent
  ) {}

  getMethod(): string {
    return this.request.method;
  }

  getClientIp(): string | null {
    // Vercel-specific IP detection
    return this.event.request.ip || 
           this.request.headers.get('X-Real-IP') || 
           null;
  }

  getPlatformContext(): RequestEvent {
    // Vercel-specific context
    return this.event;
  }

  // Vercel-specific features
  getGeoLocation(): GeoLocation | null {
    return this.event.request.geo || null;
  }
}
```

## Adapter Factory Pattern

Creating adapters based on platform detection:

```typescript
export class AdapterFactory {
  static createRequestAdapter(
    request: Request,
    context: any
  ): IRequestAdapter {
    // Detect platform
    if (globalThis.Worker && context?.waitUntil) {
      // Cloudflare Workers
      return new CloudflareRequestAdapter(request, context);
    } else if (globalThis.fastly) {
      // Fastly Compute@Edge
      return new FastlyRequestAdapter(request);
    } else if (process.env.VERCEL) {
      // Vercel Edge Functions
      return new VercelRequestAdapter(request, context);
    } else {
      // Default/test adapter
      return new StandardRequestAdapter(request);
    }
  }

  static createStorageAdapter(env: any): IStorageAdapter | undefined {
    if (env.KV_STORAGE) {
      // Cloudflare KV
      return new CloudflareStorageAdapter(env.KV_STORAGE);
    } else if (env.FASTLY_KV) {
      // Fastly KV Store
      return new FastlyStorageAdapter(env.FASTLY_KV);
    } else if (env.VERCEL_KV_URL) {
      // Vercel KV
      return new VercelStorageAdapter(env.VERCEL_KV_URL);
    }
    return undefined;
  }
}
```

## Creating Custom Adapters

### Step 1: Implement the Interface

```typescript
export class CustomStorageAdapter implements IStorageAdapter {
  constructor(private client: CustomStorageClient) {}

  async get(key: string): Promise<string | null> {
    try {
      const result = await this.client.fetch(key);
      return result.value;
    } catch (error) {
      if (error.code === 'NOT_FOUND') {
        return null;
      }
      throw error;
    }
  }

  async put(
    key: string,
    value: string,
    options?: StorageOptions
  ): Promise<void> {
    await this.client.store(key, value, {
      ttl: options?.expirationTtl,
      meta: options?.metadata
    });
  }

  // ... implement other methods
}
```

### Step 2: Register in Factory

```typescript
export class CustomAdapterFactory extends AdapterFactory {
  static createStorageAdapter(env: any): IStorageAdapter | undefined {
    if (env.CUSTOM_STORAGE) {
      return new CustomStorageAdapter(env.CUSTOM_STORAGE);
    }
    return super.createStorageAdapter(env);
  }
}
```

### Step 3: Use in Composition

```typescript
// In custom composition root
const storageAdapter = CustomAdapterFactory.createStorageAdapter(env);
const services = createServices(storageAdapter, /* other adapters */);
```

## Testing with Adapters

### Mock Adapters

```typescript
export class MockRequestAdapter implements IRequestAdapter {
  constructor(private config: MockRequestConfig) {}

  getMethod(): string {
    return this.config.method || 'GET';
  }

  getUrl(): URL {
    return new URL(this.config.url || 'http://test.local/');
  }

  getHeader(name: string): string | null {
    return this.config.headers?.[name] || null;
  }

  async getBody<T>(): Promise<T | null> {
    return this.config.body || null;
  }

  // Easy test setup
  static create(overrides?: Partial<MockRequestConfig>) {
    return new MockRequestAdapter({
      method: 'GET',
      url: 'http://test.local/',
      headers: {},
      body: null,
      ...overrides
    });
  }
}
```

### Testing Platform-Specific Behavior

```typescript
describe('Platform Adapters', () => {
  it('should handle Cloudflare-specific features', () => {
    const ctx = { waitUntil: jest.fn() };
    const adapter = new CloudflareRequestAdapter(request, ctx);
    
    // Test platform-specific behavior
    const platformCtx = adapter.getPlatformContext();
    platformCtx.waitUntil(Promise.resolve());
    
    expect(ctx.waitUntil).toHaveBeenCalled();
  });

  it('should handle Fastly-specific features', () => {
    const adapter = new FastlyRequestAdapter(request);
    
    // Test Fastly-specific client IP
    request.headers.set('Fastly-Client-IP', '192.168.1.1');
    expect(adapter.getClientIp()).toBe('192.168.1.1');
  });
});
```

## Adapter Best Practices

### 1. Interface Segregation

Keep adapter interfaces focused:

```typescript
// ✅ Good - Focused interfaces
interface IStorageAdapter { /* storage methods */ }
interface ICacheAdapter { /* cache methods */ }

// ❌ Bad - Too broad
interface IDataAdapter { 
  /* storage + cache + database methods */ 
}
```

### 2. Platform Feature Detection

```typescript
class PlatformAwareAdapter {
  private capabilities: PlatformCapabilities;

  constructor(env: IEnvironmentAdapter) {
    this.capabilities = env.getCapabilities();
  }

  async store(key: string, value: string): Promise<void> {
    if (this.capabilities.hasKVStorage) {
      // Use native KV storage
      await this.kvStore.put(key, value);
    } else {
      // Fall back to alternative
      await this.httpCache.set(key, value);
    }
  }
}
```

### 3. Error Handling

```typescript
class ResilientStorageAdapter implements IStorageAdapter {
  async get(key: string): Promise<string | null> {
    try {
      return await this.primary.get(key);
    } catch (error) {
      // Log but don't fail
      this.logger.warn('Primary storage failed', error);
      
      // Try fallback
      if (this.fallback) {
        return await this.fallback.get(key);
      }
      
      return null;
    }
  }
}
```

### 4. Performance Optimization

```typescript
class OptimizedRequestAdapter implements IRequestAdapter {
  private bodyCache: any;
  private headersCache: Headers;

  async getBody<T>(): Promise<T | null> {
    // Cache parsed body
    if (this.bodyCache === undefined) {
      try {
        const text = await this.request.text();
        this.bodyCache = text ? JSON.parse(text) : null;
      } catch {
        this.bodyCache = null;
      }
    }
    return this.bodyCache;
  }

  getHeaders(): Headers {
    // Cache headers object
    if (!this.headersCache) {
      this.headersCache = new Headers(this.request.headers);
    }
    return this.headersCache;
  }
}
```

## Platform Migration Guide

### Moving from Cloudflare to Vercel

```typescript
// Before (Cloudflare-specific)
const kv = env.KV_STORAGE;
await kv.put('key', 'value');

// After (Platform-agnostic)
const storage = storageAdapter; // IStorageAdapter
await storage.put('key', 'value');
```

### Supporting Multiple Platforms

```typescript
// Platform-agnostic service
class DataService {
  constructor(
    private storage: IStorageAdapter,
    private logger: ILoggerAdapter
  ) {}

  async saveData(key: string, data: any): Promise<void> {
    // Works on any platform
    const serialized = JSON.stringify(data);
    await this.storage.put(key, serialized);
    this.logger.info('Data saved', { key });
  }
}
```

## Performance Considerations

### Adapter Overhead

Keep adapters lightweight:

```typescript
class MinimalAdapter implements IRequestAdapter {
  // Direct property access, no computation
  getMethod(): string {
    return this.request.method;
  }

  // Lazy parsing only when needed
  private _url?: URL;
  getUrl(): URL {
    if (!this._url) {
      this._url = new URL(this.request.url);
    }
    return this._url;
  }
}
```

### Platform-Specific Optimizations

```typescript
class CloudflareOptimizedStorage implements IStorageAdapter {
  async put(
    key: string,
    value: string,
    options?: StorageOptions
  ): Promise<void> {
    // Use Cloudflare-specific bulk operations
    if (this.pendingWrites.length >= 10) {
      await this.flushBulkWrites();
    }
    
    this.pendingWrites.push({ key, value, options });
  }

  private async flushBulkWrites(): Promise<void> {
    // Cloudflare KV bulk write
    const operations = this.pendingWrites.map(write => ({
      key: write.key,
      value: write.value,
      expiration: write.options?.expirationTtl
    }));
    
    await this.kv.putBulk(operations);
    this.pendingWrites = [];
  }
}
```

## Next Steps

- For request processing: [Request Lifecycle](./request-lifecycle.md)
- For data flow: [Data Flow](./data-flow.md)
- For deployment: [Deployment Architecture](./deployment-architecture.md)
- For service integration: [Service Architecture](./service-architecture.md)

---

**Implementation References**:
- Adapter interfaces: `/src-v2/adapters/interfaces/`
- Cloudflare adapters: `/src-v2/adapters/implementations/cloudflare/`
- Fastly adapters: `/src-v2/adapters/implementations/fastly/`
- Vercel adapters: `/src-v2/adapters/implementations/vercel/`
- Adapter tests: `/src-v2/tests/adapters/`

**Related Documentation**:
- [System Overview](./system-overview.md)
- [Composition Root](./composition-root.md)

**Last Updated**: 2025-05-29