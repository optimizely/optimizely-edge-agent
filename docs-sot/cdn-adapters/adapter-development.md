# Adapter Development Guide

## Overview

This guide provides comprehensive instructions for developing custom CDN adapters for the Optimizely Edge Agent v2. Whether you're adding support for a new platform or customizing existing adapters, this document covers all aspects of adapter development.

## Adapter Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Adapter Development Flow                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. Platform APIs         2. Adapter Interfaces      3. Implementation  │
│  ┌──────────────┐        ┌─────────────────┐       ┌────────────────┐ │
│  │ HTTP Request │        │ IRequestAdapter │       │ CustomRequest  │ │
│  │ HTTP Response│───────▶│ IResponseAdapter│──────▶│ CustomResponse │ │
│  │ KV Storage   │        │ IStorageAdapter │       │ CustomStorage  │ │
│  │ Logging      │        │ ILoggerAdapter  │       │ CustomLogger   │ │
│  │ Environment  │        │ IEnvAdapter     │       │ CustomEnv      │ │
│  └──────────────┘        └─────────────────┘       └────────────────┘ │
│                                                                          │
│  4. Factory Pattern       5. Composition            6. Integration      │
│  ┌──────────────┐        ┌─────────────────┐       ┌────────────────┐ │
│  │AdapterFactory│        │  Composition    │       │ Edge Agent     │ │
│  │ - create*()  │───────▶│  - Wire services│──────▶│ - Ready to use │ │
│  └──────────────┘        └─────────────────┘       └────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Required Interfaces

### 1. IRequestAdapter

Abstracts incoming HTTP requests:

```typescript
// From: /src-v2/adapters/interfaces/IRequestAdapter.ts
export interface IRequestAdapter {
  readonly url: URL;
  readonly method: string;
  readonly headers: Headers;
  readonly body?: ReadableStream<Uint8Array> | null;
  
  getHeader(name: string): string | null;
  getAllHeaders(): Record<string, string>;
  getBody(): Promise<string>;
  getQueryParam(name: string): string | null;
  getAllQueryParams(): Record<string, string>;
  getCookie(name: string): string | null;
  getAllCookies(): Record<string, string>;
  clone(): IRequestAdapter;
}

// Implementation example
export class CustomRequestAdapter implements IRequestAdapter {
  private _url: URL;
  private _headers: Headers;
  
  constructor(private nativeRequest: CustomPlatformRequest) {
    this._url = new URL(nativeRequest.url);
    this._headers = this.convertHeaders(nativeRequest.headers);
  }
  
  get url(): URL {
    return this._url;
  }
  
  get method(): string {
    return this.nativeRequest.method;
  }
  
  get headers(): Headers {
    return this._headers;
  }
  
  getHeader(name: string): string | null {
    return this._headers.get(name);
  }
  
  getAllHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    this._headers.forEach((value, key) => {
      headers[key] = value;
    });
    return headers;
  }
  
  async getBody(): Promise<string> {
    if (!this.nativeRequest.body) return '';
    
    // Platform-specific body reading
    if (typeof this.nativeRequest.body === 'string') {
      return this.nativeRequest.body;
    }
    
    // Handle streams, buffers, etc.
    return await this.readBodyStream(this.nativeRequest.body);
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
    const cookieHeader = this.getHeader('cookie');
    if (!cookieHeader) return null;
    
    const cookies = this.parseCookies(cookieHeader);
    return cookies[name] || null;
  }
  
  private parseCookies(cookieStr: string): Record<string, string> {
    return cookieStr.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      if (key) acc[key] = decodeURIComponent(value || '');
      return acc;
    }, {} as Record<string, string>);
  }
  
  clone(): IRequestAdapter {
    return new CustomRequestAdapter(this.nativeRequest.clone());
  }
}
```

### 2. IResponseAdapter

Builds platform-specific responses:

```typescript
// From: /src-v2/adapters/interfaces/IResponseAdapter.ts
export interface IResponseAdapter {
  setStatus(status: number): IResponseAdapter;
  setHeader(name: string, value: string): IResponseAdapter;
  setCookie(cookie: CookieOptions): IResponseAdapter;
  setBody(body: string | ReadableStream | ArrayBuffer): IResponseAdapter;
  json(data: any, status?: number): IResponseAdapter;
  redirect(url: string, status?: number): IResponseAdapter;
  build(): Response;
}

export interface CookieOptions {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: Date;
  maxAge?: number;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
}

// Implementation example
export class CustomResponseAdapter implements IResponseAdapter {
  private status: number = 200;
  private headers: Headers = new Headers();
  private body: BodyInit | null = null;
  
  setStatus(status: number): IResponseAdapter {
    this.status = status;
    return this;
  }
  
  setHeader(name: string, value: string): IResponseAdapter {
    this.headers.set(name, value);
    return this;
  }
  
  setCookie(cookie: CookieOptions): IResponseAdapter {
    const cookieStr = this.serializeCookie(cookie);
    this.headers.append('Set-Cookie', cookieStr);
    return this;
  }
  
  setBody(body: string | ReadableStream | ArrayBuffer): IResponseAdapter {
    this.body = body;
    return this;
  }
  
  json(data: any, status?: number): IResponseAdapter {
    if (status) this.status = status;
    this.headers.set('Content-Type', 'application/json');
    this.body = JSON.stringify(data);
    return this;
  }
  
  redirect(url: string, status: number = 302): IResponseAdapter {
    this.status = status;
    this.headers.set('Location', url);
    return this;
  }
  
  build(): Response {
    return new Response(this.body, {
      status: this.status,
      headers: this.headers
    });
  }
  
  private serializeCookie(cookie: CookieOptions): string {
    let str = `${cookie.name}=${encodeURIComponent(cookie.value)}`;
    
    if (cookie.domain) str += `; Domain=${cookie.domain}`;
    if (cookie.path) str += `; Path=${cookie.path}`;
    if (cookie.expires) str += `; Expires=${cookie.expires.toUTCString()}`;
    if (cookie.maxAge) str += `; Max-Age=${cookie.maxAge}`;
    if (cookie.secure) str += '; Secure';
    if (cookie.httpOnly) str += '; HttpOnly';
    if (cookie.sameSite) str += `; SameSite=${cookie.sameSite}`;
    
    return str;
  }
}
```

### 3. IStorageAdapter

Platform KV storage abstraction:

```typescript
// From: /src-v2/adapters/interfaces/IStorageAdapter.ts
export interface IStorageAdapter {
  get(key: string): Promise<string | null>;
  getWithMetadata<T = any>(key: string): Promise<{ value: string | null; metadata: T | null }>;
  put(key: string, value: string, options?: StorageOptions): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: ListOptions): Promise<ListResult>;
}

export interface StorageOptions {
  expirationTtl?: number;  // Seconds
  metadata?: Record<string, any>;
}

export interface ListOptions {
  prefix?: string;
  limit?: number;
  cursor?: string;
}

export interface ListResult {
  keys: Array<{ name: string; metadata?: any }>;
  cursor?: string;
  complete: boolean;
}

// Implementation example
export class CustomStorageAdapter implements IStorageAdapter {
  constructor(private kvNamespace: CustomKVNamespace) {}
  
  async get(key: string): Promise<string | null> {
    try {
      const value = await this.kvNamespace.get(key);
      return value;
    } catch (error) {
      this.handleError('get', error);
      return null;
    }
  }
  
  async getWithMetadata<T = any>(key: string): Promise<{ value: string | null; metadata: T | null }> {
    try {
      const result = await this.kvNamespace.getWithMetadata(key);
      return {
        value: result.value,
        metadata: result.metadata as T
      };
    } catch (error) {
      this.handleError('getWithMetadata', error);
      return { value: null, metadata: null };
    }
  }
  
  async put(key: string, value: string, options?: StorageOptions): Promise<void> {
    try {
      const putOptions: any = {};
      
      if (options?.expirationTtl) {
        putOptions.expirationTtl = options.expirationTtl;
      }
      
      if (options?.metadata) {
        putOptions.metadata = options.metadata;
      }
      
      await this.kvNamespace.put(key, value, putOptions);
    } catch (error) {
      this.handleError('put', error);
      throw error;
    }
  }
  
  async delete(key: string): Promise<void> {
    try {
      await this.kvNamespace.delete(key);
    } catch (error) {
      this.handleError('delete', error);
      throw error;
    }
  }
  
  async list(options?: ListOptions): Promise<ListResult> {
    try {
      const listOptions: any = {};
      
      if (options?.prefix) listOptions.prefix = options.prefix;
      if (options?.limit) listOptions.limit = options.limit;
      if (options?.cursor) listOptions.cursor = options.cursor;
      
      const result = await this.kvNamespace.list(listOptions);
      
      return {
        keys: result.keys,
        cursor: result.cursor,
        complete: result.list_complete
      };
    } catch (error) {
      this.handleError('list', error);
      throw error;
    }
  }
  
  private handleError(operation: string, error: any): void {
    console.error(`Storage operation '${operation}' failed:`, error);
  }
}
```

### 4. ILoggerAdapter

Logging abstraction:

```typescript
// From: /src-v2/adapters/interfaces/ILoggerAdapter.ts
export interface ILoggerAdapter {
  debug(message: string, context?: any): void;
  info(message: string, context?: any): void;
  warn(message: string, context?: any): void;
  error(message: string, error?: Error, context?: any): void;
}

// Implementation with structured logging
export class CustomLoggerAdapter implements ILoggerAdapter {
  constructor(
    private platform: string,
    private environment: string
  ) {}
  
  debug(message: string, context?: any): void {
    this.log('debug', message, context);
  }
  
  info(message: string, context?: any): void {
    this.log('info', message, context);
  }
  
  warn(message: string, context?: any): void {
    this.log('warn', message, context);
  }
  
  error(message: string, error?: Error, context?: any): void {
    this.log('error', message, {
      ...context,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
    });
  }
  
  private log(level: string, message: string, context?: any): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      platform: this.platform,
      environment: this.environment,
      message,
      ...context
    };
    
    // Platform-specific logging
    console.log(JSON.stringify(logEntry));
  }
}
```

### 5. IEnvironmentAdapter

Environment variable access:

```typescript
// From: /src-v2/adapters/interfaces/IEnvironmentAdapter.ts
export interface IEnvironmentAdapter {
  get(key: string): string | undefined;
  getRequired(key: string): string;
  getAll(): Record<string, string>;
}

// Implementation example
export class CustomEnvironmentAdapter implements IEnvironmentAdapter {
  constructor(private env: CustomEnvironment) {}
  
  get(key: string): string | undefined {
    return this.env[key];
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
    
    // Platform-specific environment enumeration
    for (const [key, value] of Object.entries(this.env)) {
      if (typeof value === 'string') {
        result[key] = value;
      }
    }
    
    return result;
  }
}
```

### 6. IMetricsAdapter

Metrics collection:

```typescript
// From: /src-v2/adapters/interfaces/IMetricsAdapter.ts
export interface IMetricsAdapter {
  increment(metric: string, value?: number, tags?: Record<string, string>): void;
  gauge(metric: string, value: number, tags?: Record<string, string>): void;
  timing(metric: string, duration: number, tags?: Record<string, string>): void;
  flush(): Promise<void>;
}

// Implementation with batching
export class CustomMetricsAdapter implements IMetricsAdapter {
  private buffer: MetricEntry[] = [];
  private flushInterval: number = 10000; // 10 seconds
  
  constructor(private endpoint: string) {
    this.startAutoFlush();
  }
  
  increment(metric: string, value: number = 1, tags?: Record<string, string>): void {
    this.buffer.push({
      type: 'counter',
      metric,
      value,
      tags,
      timestamp: Date.now()
    });
  }
  
  gauge(metric: string, value: number, tags?: Record<string, string>): void {
    this.buffer.push({
      type: 'gauge',
      metric,
      value,
      tags,
      timestamp: Date.now()
    });
  }
  
  timing(metric: string, duration: number, tags?: Record<string, string>): void {
    this.buffer.push({
      type: 'timing',
      metric,
      value: duration,
      tags,
      timestamp: Date.now()
    });
  }
  
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    
    const metrics = [...this.buffer];
    this.buffer = [];
    
    try {
      await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metrics })
      });
    } catch (error) {
      console.error('Failed to flush metrics:', error);
      // Re-add metrics to buffer for retry
      this.buffer.unshift(...metrics);
    }
  }
  
  private startAutoFlush(): void {
    setInterval(() => this.flush(), this.flushInterval);
  }
}

interface MetricEntry {
  type: 'counter' | 'gauge' | 'timing';
  metric: string;
  value: number;
  tags?: Record<string, string>;
  timestamp: number;
}
```

## Factory Pattern

Create a factory to instantiate all adapters:

```typescript
// From: /src-v2/adapters/factories/CustomAdapterFactory.ts
export class CustomAdapterFactory {
  constructor(private config: CustomPlatformConfig) {}
  
  createRequestAdapter(request: CustomRequest): IRequestAdapter {
    return new CustomRequestAdapter(request);
  }
  
  createResponseAdapter(): IResponseAdapter {
    return new CustomResponseAdapter();
  }
  
  createStorageAdapter(namespace: string): IStorageAdapter {
    const kvNamespace = this.config.bindings[namespace];
    if (!kvNamespace) {
      throw new Error(`KV namespace '${namespace}' not found`);
    }
    return new CustomStorageAdapter(kvNamespace);
  }
  
  createLoggerAdapter(): ILoggerAdapter {
    return new CustomLoggerAdapter(
      'custom-platform',
      this.config.environment
    );
  }
  
  createEnvironmentAdapter(): IEnvironmentAdapter {
    return new CustomEnvironmentAdapter(this.config.env);
  }
  
  createMetricsAdapter(): IMetricsAdapter {
    const endpoint = this.config.metricsEndpoint || '/metrics';
    return new CustomMetricsAdapter(endpoint);
  }
}
```

## Composition

Wire services together using adapters:

```typescript
// From: /src-v2/composition/customComposition.ts
import { CustomAdapterFactory } from '../adapters/factories/CustomAdapterFactory';
import { 
  RequestHandler,
  ConfigurationService,
  DecisionService,
  CacheManager,
  DatafileService
} from '../services/implementations';

export async function createCustomHandler(
  request: CustomRequest,
  config: CustomPlatformConfig
): Promise<RequestHandler> {
  // Create adapter factory
  const factory = new CustomAdapterFactory(config);
  
  // Create adapters
  const requestAdapter = factory.createRequestAdapter(request);
  const responseAdapter = factory.createResponseAdapter();
  const storageAdapter = factory.createStorageAdapter('OPTIMIZELY_KV');
  const logger = factory.createLoggerAdapter();
  const env = factory.createEnvironmentAdapter();
  const metrics = factory.createMetricsAdapter();
  
  // Create services with adapters
  const configService = new ConfigurationService(env, logger);
  const cacheManager = new CacheManager(storageAdapter, logger);
  const datafileService = new DatafileService(
    cacheManager,
    logger,
    metrics
  );
  
  const decisionService = new DecisionService(
    datafileService,
    storageAdapter,
    logger,
    metrics
  );
  
  // Create and return request handler
  return new RequestHandler(
    requestAdapter,
    responseAdapter,
    configService,
    decisionService,
    logger
  );
}

// Platform entry point
export default {
  async fetch(request: CustomRequest, config: CustomPlatformConfig) {
    const handler = await createCustomHandler(request, config);
    return handler.handleRequest();
  }
};
```

## Testing Adapters

### Unit Testing

```typescript
// Test individual adapter methods
describe('CustomRequestAdapter', () => {
  it('parses URL correctly', () => {
    const nativeRequest = {
      url: 'https://example.com/path?foo=bar',
      method: 'GET',
      headers: { 'content-type': 'application/json' }
    };
    
    const adapter = new CustomRequestAdapter(nativeRequest);
    
    expect(adapter.url.hostname).toBe('example.com');
    expect(adapter.url.pathname).toBe('/path');
    expect(adapter.getQueryParam('foo')).toBe('bar');
  });
  
  it('handles cookies', () => {
    const nativeRequest = {
      url: 'https://example.com',
      method: 'GET',
      headers: { 'cookie': 'session=abc123; user=john' }
    };
    
    const adapter = new CustomRequestAdapter(nativeRequest);
    
    expect(adapter.getCookie('session')).toBe('abc123');
    expect(adapter.getCookie('user')).toBe('john');
    expect(adapter.getCookie('missing')).toBeNull();
  });
});
```

### Integration Testing

```typescript
// Test adapter with services
describe('Custom Platform Integration', () => {
  let handler: RequestHandler;
  
  beforeEach(async () => {
    const request = createMockRequest();
    const config = createMockConfig();
    handler = await createCustomHandler(request, config);
  });
  
  it('processes requests end-to-end', async () => {
    const response = await handler.handleRequest();
    
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/json');
  });
});
```

### Mock Adapters

```typescript
// Create mock adapters for testing
export class MockStorageAdapter implements IStorageAdapter {
  private store = new Map<string, any>();
  
  async get(key: string): Promise<string | null> {
    return this.store.get(key) || null;
  }
  
  async put(key: string, value: string, options?: StorageOptions): Promise<void> {
    this.store.set(key, value);
    
    if (options?.expirationTtl) {
      setTimeout(() => this.store.delete(key), options.expirationTtl * 1000);
    }
  }
  
  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
  
  async list(options?: ListOptions): Promise<ListResult> {
    const keys = Array.from(this.store.keys())
      .filter(key => !options?.prefix || key.startsWith(options.prefix))
      .slice(0, options?.limit || 1000)
      .map(name => ({ name }));
    
    return { keys, complete: true };
  }
}
```

## Platform-Specific Considerations

### Performance Optimization

```typescript
// Optimize for platform constraints
export class OptimizedRequestAdapter implements IRequestAdapter {
  private _bodyCache?: string;
  private _headersCache?: Record<string, string>;
  
  async getBody(): Promise<string> {
    // Cache body to avoid multiple reads
    if (this._bodyCache !== undefined) {
      return this._bodyCache;
    }
    
    this._bodyCache = await this.readBody();
    return this._bodyCache;
  }
  
  getAllHeaders(): Record<string, string> {
    // Cache header conversion
    if (this._headersCache) {
      return this._headersCache;
    }
    
    this._headersCache = this.convertHeaders();
    return this._headersCache;
  }
}
```

### Error Handling

```typescript
// Implement robust error handling
export class ResilientStorageAdapter implements IStorageAdapter {
  async get(key: string): Promise<string | null> {
    try {
      return await this.kvNamespace.get(key);
    } catch (error) {
      // Log error but don't throw
      this.logger.error('Storage read failed', error, { key });
      
      // Try fallback if available
      if (this.fallbackStorage) {
        return this.fallbackStorage.get(key);
      }
      
      return null;
    }
  }
}
```

### Platform Features

```typescript
// Leverage platform-specific features
export class EnhancedCloudflareAdapter {
  constructor(
    private env: CloudflareEnvironment,
    private ctx: ExecutionContext
  ) {}
  
  // Use waitUntil for background tasks
  scheduleBackgroundTask(task: () => Promise<void>): void {
    this.ctx.waitUntil(task());
  }
  
  // Use Durable Objects for state
  async getStatefulStorage(id: string): Promise<DurableObjectNamespace> {
    return this.env.DURABLE_OBJECTS.get(id);
  }
}
```

## Best Practices

### 1. Interface Compliance
```typescript
// Always implement all interface methods
export class StrictAdapter implements IRequestAdapter {
  // ✅ Implement every method
  // ❌ Don't leave methods unimplemented
}
```

### 2. Type Safety
```typescript
// Use TypeScript's strict mode
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

### 3. Error Boundaries
```typescript
// Handle errors gracefully
try {
  return await this.nativeAPI.call();
} catch (error) {
  this.logger.error('Native API failed', error);
  return this.getDefaultValue();
}
```

### 4. Documentation
```typescript
/**
 * Custom storage adapter for Platform X
 * 
 * @remarks
 * This adapter uses Platform X's distributed KV store
 * with automatic replication across regions.
 * 
 * @example
 * ```typescript
 * const storage = new CustomStorageAdapter(kvNamespace);
 * await storage.put('key', 'value', { expirationTtl: 3600 });
 * ```
 */
export class CustomStorageAdapter implements IStorageAdapter {
  // Implementation
}
```

## Troubleshooting

### Common Issues

1. **Type Mismatches**
   ```typescript
   // Problem: Platform types don't match interface
   // Solution: Create type converters
   private convertHeaders(platformHeaders: any): Headers {
     const headers = new Headers();
     // Convert platform-specific format
     return headers;
   }
   ```

2. **Async/Await Issues**
   ```typescript
   // Problem: Platform APIs use callbacks
   // Solution: Promisify
   private promisify<T>(fn: (cb: (err: any, result: T) => void) => void): Promise<T> {
     return new Promise((resolve, reject) => {
       fn((err, result) => err ? reject(err) : resolve(result));
     });
   }
   ```

3. **Missing Platform Features**
   ```typescript
   // Problem: Platform doesn't support required feature
   // Solution: Polyfill or alternative implementation
   if (!globalThis.crypto) {
     globalThis.crypto = require('crypto').webcrypto;
   }
   ```

## Next Steps

- Review [Platform Migration](./platform-migration.md) for cross-platform compatibility
- Study platform-specific guides:
  - [Cloudflare Adapter](./cloudflare-adapter.md)
  - [Fastly Adapter](./fastly-adapter.md)
  - [Vercel Adapter](./vercel-adapter.md)
- Check [Testing Guide](./testing-adapters.md) for comprehensive testing strategies

## References

- `/src-v2/adapters/interfaces/` - Interface definitions
- `/src-v2/adapters/implementations/` - Reference implementations
- `/src-v2/tests/test-utils/` - Mock adapters for testing
- `/src-v2/composition/` - Platform compositions