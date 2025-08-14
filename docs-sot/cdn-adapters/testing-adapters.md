# Testing Adapters Guide

## Overview

This guide covers comprehensive testing strategies for CDN adapters, including unit testing, integration testing, and cross-platform validation. Proper testing ensures adapters work correctly across all supported platforms.

## Testing Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Adapter Testing Stack                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Unit Tests              Integration Tests        Platform Tests         │
│  ┌──────────────┐       ┌─────────────────┐     ┌──────────────┐      │
│  │ • Interfaces │       │ • Service Tests │     │ • Cloudflare │      │
│  │ • Mocking    │──────▶│ • E2E Flows     │────▶│ • Fastly     │      │
│  │ • Isolation  │       │ • API Tests     │     │ • Vercel     │      │
│  └──────────────┘       └─────────────────┘     └──────────────┘      │
│                                                                          │
│  Test Utilities          Test Environments       Test Reporting          │
│  ┌──────────────┐       ┌─────────────────┐     ┌──────────────┐      │
│  │ Mock Adapters│       │ Local Dev      │     │ Coverage     │      │
│  │ Fixtures     │       │ CI/CD          │     │ Performance  │      │
│  │ Helpers      │       │ Production     │     │ Compatibility│      │
│  └──────────────┘       └─────────────────┘     └──────────────┘      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Unit Testing Adapters

### Testing Individual Adapters

```typescript
// From: /src-v2/tests/adapters/cloudflare/CloudflareAdapter.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CloudflareRequestAdapter } from '../../../adapters/implementations/cloudflare/CloudflareRequestAdapter';

describe('CloudflareRequestAdapter', () => {
  let mockRequest: Request;
  let adapter: CloudflareRequestAdapter;
  
  beforeEach(() => {
    mockRequest = new Request('https://example.com/test?foo=bar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Custom-Header': 'test-value',
        'Cookie': 'session=abc123; user=john'
      },
      body: JSON.stringify({ data: 'test' })
    });
    
    adapter = new CloudflareRequestAdapter(mockRequest);
  });
  
  describe('URL handling', () => {
    it('should parse URL correctly', () => {
      expect(adapter.url.hostname).toBe('example.com');
      expect(adapter.url.pathname).toBe('/test');
    });
    
    it('should handle query parameters', () => {
      expect(adapter.getQueryParam('foo')).toBe('bar');
      expect(adapter.getQueryParam('missing')).toBeNull();
    });
    
    it('should return all query parameters', () => {
      const params = adapter.getAllQueryParams();
      expect(params).toEqual({ foo: 'bar' });
    });
  });
  
  describe('Header handling', () => {
    it('should get individual headers', () => {
      expect(adapter.getHeader('content-type')).toBe('application/json');
      expect(adapter.getHeader('x-custom-header')).toBe('test-value');
      expect(adapter.getHeader('missing')).toBeNull();
    });
    
    it('should return all headers', () => {
      const headers = adapter.getAllHeaders();
      expect(headers['content-type']).toBe('application/json');
      expect(headers['x-custom-header']).toBe('test-value');
    });
  });
  
  describe('Cookie handling', () => {
    it('should parse cookies correctly', () => {
      expect(adapter.getCookie('session')).toBe('abc123');
      expect(adapter.getCookie('user')).toBe('john');
      expect(adapter.getCookie('missing')).toBeNull();
    });
    
    it('should handle URL-encoded cookie values', () => {
      const requestWithEncodedCookie = new Request('https://example.com', {
        headers: {
          'Cookie': 'data=hello%20world'
        }
      });
      
      const adapter = new CloudflareRequestAdapter(requestWithEncodedCookie);
      expect(adapter.getCookie('data')).toBe('hello world');
    });
  });
  
  describe('Body handling', () => {
    it('should read request body', async () => {
      const body = await adapter.getBody();
      expect(JSON.parse(body)).toEqual({ data: 'test' });
    });
    
    it('should handle empty body', async () => {
      const emptyRequest = new Request('https://example.com');
      const emptyAdapter = new CloudflareRequestAdapter(emptyRequest);
      
      const body = await emptyAdapter.getBody();
      expect(body).toBe('');
    });
  });
  
  describe('Request cloning', () => {
    it('should clone request adapter', () => {
      const cloned = adapter.clone();
      
      expect(cloned.url.href).toBe(adapter.url.href);
      expect(cloned.method).toBe(adapter.method);
      expect(cloned.getHeader('content-type')).toBe('application/json');
    });
  });
});
```

### Testing Storage Adapters

```typescript
// Testing storage adapter with mocked KV
describe('CloudflareStorageAdapter', () => {
  let mockKV: MockKVNamespace;
  let adapter: CloudflareStorageAdapter;
  let logger: MockLoggerAdapter;
  
  beforeEach(() => {
    mockKV = new MockKVNamespace();
    logger = new MockLoggerAdapter();
    adapter = new CloudflareStorageAdapter(mockKV, logger);
  });
  
  describe('get operations', () => {
    it('should get existing value', async () => {
      await mockKV.put('test-key', 'test-value');
      
      const value = await adapter.get('test-key');
      expect(value).toBe('test-value');
      expect(logger.logs).toContainEqual({
        level: 'debug',
        message: 'KV hit for key: test-key'
      });
    });
    
    it('should return null for missing key', async () => {
      const value = await adapter.get('missing-key');
      expect(value).toBeNull();
      expect(logger.logs).toContainEqual({
        level: 'debug',
        message: 'KV miss for key: missing-key'
      });
    });
    
    it('should handle KV errors gracefully', async () => {
      mockKV.simulateError = true;
      
      const value = await adapter.get('error-key');
      expect(value).toBeNull();
      expect(logger.logs).toContainEqual({
        level: 'error',
        message: 'KV get error for key: error-key'
      });
    });
  });
  
  describe('put operations', () => {
    it('should store value with TTL', async () => {
      await adapter.put('ttl-key', 'value', { 
        expirationTtl: 300 
      });
      
      const stored = mockKV.store.get('ttl-key');
      expect(stored?.value).toBe('value');
      expect(stored?.expirationTtl).toBe(300);
    });
    
    it('should store metadata', async () => {
      await adapter.put('meta-key', 'value', {
        metadata: { version: 1, type: 'test' }
      });
      
      const result = await adapter.getWithMetadata('meta-key');
      expect(result.value).toBe('value');
      expect(result.metadata).toEqual({ version: 1, type: 'test' });
    });
  });
  
  describe('list operations', () => {
    beforeEach(async () => {
      await adapter.put('prefix:1', 'value1');
      await adapter.put('prefix:2', 'value2');
      await adapter.put('other:1', 'value3');
    });
    
    it('should list keys with prefix', async () => {
      const result = await adapter.list({ prefix: 'prefix:' });
      
      expect(result.keys).toHaveLength(2);
      expect(result.keys.map(k => k.name)).toContain('prefix:1');
      expect(result.keys.map(k => k.name)).toContain('prefix:2');
    });
    
    it('should respect limit', async () => {
      const result = await adapter.list({ 
        prefix: 'prefix:', 
        limit: 1 
      });
      
      expect(result.keys).toHaveLength(1);
      expect(result.complete).toBe(false);
    });
  });
});
```

## Mock Adapters

### Creating Mock Adapters

```typescript
// From: /src-v2/tests/test-utils/MockStorageAdapter.ts
export class MockStorageAdapter implements IStorageAdapter {
  private store = new Map<string, StoredValue>();
  public simulateError = false;
  public simulateLatency = 0;
  
  async get(key: string): Promise<string | null> {
    if (this.simulateLatency) {
      await this.delay(this.simulateLatency);
    }
    
    if (this.simulateError) {
      throw new Error('Simulated storage error');
    }
    
    const stored = this.store.get(key);
    if (!stored) return null;
    
    // Check expiration
    if (stored.expiresAt && stored.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    
    return stored.value;
  }
  
  async put(key: string, value: string, options?: StorageOptions): Promise<void> {
    if (this.simulateError) {
      throw new Error('Simulated storage error');
    }
    
    const stored: StoredValue = {
      value,
      metadata: options?.metadata,
      putAt: Date.now()
    };
    
    if (options?.expirationTtl) {
      stored.expiresAt = Date.now() + (options.expirationTtl * 1000);
    }
    
    this.store.set(key, stored);
  }
  
  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
  
  async list(options?: ListOptions): Promise<ListResult> {
    const keys = Array.from(this.store.keys())
      .filter(key => !options?.prefix || key.startsWith(options.prefix))
      .sort()
      .slice(0, options?.limit || 1000);
    
    return {
      keys: keys.map(name => ({ 
        name,
        metadata: this.store.get(name)?.metadata 
      })),
      complete: keys.length < (options?.limit || 1000)
    };
  }
  
  // Test utilities
  clear(): void {
    this.store.clear();
  }
  
  size(): number {
    return this.store.size;
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

interface StoredValue {
  value: string;
  metadata?: any;
  putAt: number;
  expiresAt?: number;
}
```

### Mock Request Builder

```typescript
// Test utility for building requests
export class MockRequestBuilder {
  private url = 'https://example.com';
  private method = 'GET';
  private headers = new Headers();
  private body: BodyInit | null = null;
  
  withUrl(url: string): this {
    this.url = url;
    return this;
  }
  
  withMethod(method: string): this {
    this.method = method;
    return this;
  }
  
  withHeader(name: string, value: string): this {
    this.headers.set(name, value);
    return this;
  }
  
  withHeaders(headers: Record<string, string>): this {
    Object.entries(headers).forEach(([name, value]) => {
      this.headers.set(name, value);
    });
    return this;
  }
  
  withCookie(name: string, value: string): this {
    const existing = this.headers.get('Cookie') || '';
    const cookies = existing ? `${existing}; ${name}=${value}` : `${name}=${value}`;
    this.headers.set('Cookie', cookies);
    return this;
  }
  
  withBody(body: any): this {
    if (typeof body === 'object') {
      this.body = JSON.stringify(body);
      this.headers.set('Content-Type', 'application/json');
    } else {
      this.body = body;
    }
    return this;
  }
  
  withQuery(params: Record<string, string>): this {
    const url = new URL(this.url);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    this.url = url.toString();
    return this;
  }
  
  build(): Request {
    return new Request(this.url, {
      method: this.method,
      headers: this.headers,
      body: this.body
    });
  }
}

// Usage
const request = new MockRequestBuilder()
  .withUrl('https://api.example.com/decide')
  .withMethod('POST')
  .withHeader('X-SDK-Key', 'test-key')
  .withCookie('userId', 'test-user')
  .withBody({ flagKey: 'test-flag' })
  .build();
```

## Integration Testing

### Service Integration Tests

```typescript
// Testing service with real adapters
describe('DecisionService Integration', () => {
  let service: DecisionService;
  let storage: IStorageAdapter;
  let logger: ILoggerAdapter;
  
  beforeEach(() => {
    storage = new MockStorageAdapter();
    logger = new MockLoggerAdapter();
    
    service = new DecisionService(
      new DatafileService(storage, logger),
      storage,
      logger,
      new MockMetricsAdapter()
    );
  });
  
  it('should make decisions with caching', async () => {
    // Store datafile
    const datafile = createTestDatafile();
    await storage.put('datafile:test-key', JSON.stringify(datafile));
    
    // First decision - cache miss
    const decision1 = await service.decide({
      sdkKey: 'test-key',
      userId: 'user-123',
      flagKey: 'test-flag'
    });
    
    expect(decision1.enabled).toBe(true);
    expect(decision1.variationKey).toBe('treatment');
    
    // Second decision - cache hit
    const decision2 = await service.decide({
      sdkKey: 'test-key',
      userId: 'user-123',
      flagKey: 'test-flag'
    });
    
    expect(decision2).toEqual(decision1);
    
    // Verify caching
    const logs = (logger as MockLoggerAdapter).logs;
    expect(logs).toContainEqual({
      level: 'debug',
      message: expect.stringContaining('Cache hit')
    });
  });
});
```

### End-to-End Testing

```typescript
// Full request flow testing
describe('Edge Agent E2E', () => {
  let handler: RequestHandler;
  
  beforeEach(() => {
    const factory = new TestAdapterFactory();
    handler = createTestHandler(factory);
  });
  
  it('should handle decide request end-to-end', async () => {
    const request = new MockRequestBuilder()
      .withUrl('https://example.com/api/decide')
      .withMethod('POST')
      .withHeader('X-SDK-Key', 'test-sdk-key')
      .withBody({
        userId: 'test-user',
        flagKey: 'checkout_flow',
        attributes: {
          plan: 'premium'
        }
      })
      .build();
    
    const response = await handler.handleRequest(
      new TestRequestAdapter(request)
    );
    
    expect(response.status).toBe(200);
    
    const body = await response.json();
    expect(body).toMatchObject({
      enabled: expect.any(Boolean),
      variationKey: expect.any(String),
      flagKey: 'checkout_flow',
      userContext: {
        userId: 'test-user',
        attributes: {
          plan: 'premium'
        }
      }
    });
  });
  
  it('should handle errors gracefully', async () => {
    const request = new MockRequestBuilder()
      .withUrl('https://example.com/api/decide')
      .withMethod('POST')
      .withBody({ invalid: 'payload' })
      .build();
    
    const response = await handler.handleRequest(
      new TestRequestAdapter(request)
    );
    
    expect(response.status).toBe(400);
    
    const error = await response.json();
    expect(error).toMatchObject({
      error: {
        code: 'INVALID_REQUEST',
        message: expect.any(String)
      }
    });
  });
});
```

## Platform-Specific Testing

### Testing Across Platforms

```typescript
// Cross-platform test suite
describe.each([
  ['cloudflare', CloudflareAdapterFactory],
  ['fastly', FastlyAdapterFactory],
  ['vercel', VercelAdapterFactory]
])('%s platform', (platform, AdapterFactory) => {
  let factory: any;
  
  beforeEach(() => {
    factory = new AdapterFactory(getMockConfig(platform));
  });
  
  describe('Request handling', () => {
    it('should handle requests consistently', async () => {
      const request = createPlatformRequest(platform, {
        url: 'https://example.com/test',
        method: 'GET',
        headers: { 'X-Test': 'value' }
      });
      
      const adapter = factory.createRequestAdapter(request);
      
      expect(adapter.url.href).toBe('https://example.com/test');
      expect(adapter.method).toBe('GET');
      expect(adapter.getHeader('x-test')).toBe('value');
    });
  });
  
  describe('Storage operations', () => {
    it('should perform storage operations', async () => {
      const storage = factory.createStorageAdapter();
      
      await storage.put('test-key', 'test-value');
      const value = await storage.get('test-key');
      
      expect(value).toBe('test-value');
    });
  });
  
  describe('Platform features', () => {
    it.runIf(platform === 'cloudflare')(
      'should access Cloudflare-specific features',
      async () => {
        const env = factory.getEnvironment();
        expect(env.OPTIMIZELY_KV).toBeDefined();
      }
    );
    
    it.runIf(platform === 'fastly')(
      'should access Fastly-specific features',
      async () => {
        const configStore = factory.getConfigStore();
        expect(configStore).toBeDefined();
      }
    );
    
    it.runIf(platform === 'vercel')(
      'should access Vercel-specific features',
      async () => {
        const edgeConfig = factory.getEdgeConfig();
        expect(edgeConfig).toBeDefined();
      }
    );
  });
});
```

### Platform Test Environments

```typescript
// Platform-specific test setup
export function setupPlatformTest(platform: string): TestEnvironment {
  switch (platform) {
    case 'cloudflare':
      return new CloudflareTestEnvironment();
    case 'fastly':
      return new FastlyTestEnvironment();
    case 'vercel':
      return new VercelTestEnvironment();
    default:
      throw new Error(`Unknown platform: ${platform}`);
  }
}

// Cloudflare test environment
class CloudflareTestEnvironment implements TestEnvironment {
  private miniflare: Miniflare;
  
  async setup(): Promise<void> {
    this.miniflare = new Miniflare({
      script: `
        export default {
          async fetch(request, env, ctx) {
            // Test worker script
          }
        }
      `,
      kvNamespaces: ['OPTIMIZELY_KV'],
      bindings: {
        OPTIMIZELY_SDK_KEY: 'test-key'
      }
    });
  }
  
  async teardown(): Promise<void> {
    await this.miniflare.dispose();
  }
  
  async fetch(request: Request): Promise<Response> {
    return this.miniflare.dispatchFetch(request);
  }
}
```

## Performance Testing

### Benchmarking Adapters

```typescript
// Adapter performance benchmarks
describe('Adapter Performance', () => {
  const iterations = 1000;
  
  bench('RequestAdapter.getHeader', async () => {
    const request = new Request('https://example.com', {
      headers: {
        'X-Test-1': 'value1',
        'X-Test-2': 'value2',
        'X-Test-3': 'value3'
      }
    });
    
    const adapter = new CloudflareRequestAdapter(request);
    
    for (let i = 0; i < iterations; i++) {
      adapter.getHeader('X-Test-2');
    }
  });
  
  bench('StorageAdapter.get', async () => {
    const storage = new MockStorageAdapter();
    await storage.put('test-key', 'test-value');
    
    for (let i = 0; i < iterations; i++) {
      await storage.get('test-key');
    }
  });
  
  bench('Parse cookies', () => {
    const cookieString = 'session=abc123; user=john; preferences=theme%3Ddark';
    const adapter = new TestRequestAdapter();
    
    for (let i = 0; i < iterations; i++) {
      adapter.parseCookies(cookieString);
    }
  });
});
```

### Load Testing

```typescript
// Concurrent request testing
describe('Load Testing', () => {
  it('should handle concurrent requests', async () => {
    const handler = createTestHandler();
    const concurrency = 100;
    
    const requests = Array.from({ length: concurrency }, (_, i) => 
      new MockRequestBuilder()
        .withUrl(`https://example.com/api/decide`)
        .withBody({
          userId: `user-${i}`,
          flagKey: 'test-flag'
        })
        .build()
    );
    
    const start = Date.now();
    
    const responses = await Promise.all(
      requests.map(req => 
        handler.handleRequest(new TestRequestAdapter(req))
      )
    );
    
    const duration = Date.now() - start;
    
    // All requests should succeed
    expect(responses.every(r => r.status === 200)).toBe(true);
    
    // Should complete within reasonable time
    expect(duration).toBeLessThan(5000); // 5 seconds for 100 requests
    
    console.log(`Handled ${concurrency} requests in ${duration}ms`);
    console.log(`Average: ${duration / concurrency}ms per request`);
  });
});
```

## Test Configuration

### Vitest Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'edge-runtime',
    include: ['src-v2/tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src-v2/tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData/**'
      ]
    },
    benchmark: {
      include: ['src-v2/tests/**/*.bench.ts']
    }
  },
  resolve: {
    alias: {
      '@': '/src-v2',
      '@adapters': '/src-v2/adapters',
      '@services': '/src-v2/services',
      '@test-utils': '/src-v2/tests/test-utils'
    }
  }
});
```

### Platform-Specific Test Scripts

```json
// package.json
{
  "scripts": {
    "test": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:cloudflare": "TEST_PLATFORM=cloudflare vitest",
    "test:fastly": "TEST_PLATFORM=fastly vitest",
    "test:vercel": "TEST_PLATFORM=vercel vitest",
    "test:all-platforms": "npm run test:cloudflare && npm run test:fastly && npm run test:vercel",
    "test:integration": "vitest run src-v2/tests/integration",
    "test:unit": "vitest run src-v2/tests/unit",
    "test:bench": "vitest bench",
    "test:e2e": "playwright test"
  }
}
```

## CI/CD Testing

### GitHub Actions Workflow

```yaml
# .github/workflows/test-adapters.yml
name: Test Adapters

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        platform: [cloudflare, fastly, vercel]
        node: [18, 20]
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node }}
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run linter
        run: npm run lint
        
      - name: Run type checking
        run: npm run typecheck:${{ matrix.platform }}
        
      - name: Run unit tests
        run: npm run test:unit -- --reporter=json --outputFile=test-results-unit.json
        env:
          TEST_PLATFORM: ${{ matrix.platform }}
          
      - name: Run integration tests
        run: npm run test:integration -- --reporter=json --outputFile=test-results-integration.json
        env:
          TEST_PLATFORM: ${{ matrix.platform }}
          
      - name: Run benchmarks
        run: npm run test:bench -- --reporter=json --outputFile=bench-results.json
        
      - name: Upload test results
        uses: actions/upload-artifact@v3
        with:
          name: test-results-${{ matrix.platform }}-node${{ matrix.node }}
          path: |
            test-results-*.json
            bench-results.json
            coverage/
            
  cross-platform:
    needs: test
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run cross-platform tests
        run: npm run test:all-platforms
        
      - name: Generate compatibility report
        run: npm run report:compatibility
```

## Testing Best Practices

### 1. Test Isolation

```typescript
// Always clean up after tests
describe('Service Tests', () => {
  let service: MyService;
  let cleanup: (() => void)[] = [];
  
  beforeEach(() => {
    service = new MyService();
    cleanup = [];
  });
  
  afterEach(() => {
    // Run all cleanup functions
    cleanup.forEach(fn => fn());
    cleanup = [];
  });
  
  it('should test something', async () => {
    // Register cleanup
    const timer = setInterval(() => {}, 1000);
    cleanup.push(() => clearInterval(timer));
    
    // Test logic
  });
});
```

### 2. Platform Detection

```typescript
// Conditionally run platform-specific tests
const isPlatform = (name: string): boolean => {
  return process.env.TEST_PLATFORM === name;
};

describe.skipIf(!isPlatform('cloudflare'))(
  'Cloudflare-specific tests',
  () => {
    // Tests that only run for Cloudflare
  }
);
```

### 3. Mock Data Consistency

```typescript
// Centralized test data
export const TEST_DATA = {
  users: {
    standard: { id: 'user-123', attributes: { plan: 'free' } },
    premium: { id: 'user-456', attributes: { plan: 'premium' } }
  },
  
  flags: {
    simple: { key: 'simple-flag', variations: ['control', 'treatment'] },
    complex: { key: 'complex-flag', variations: ['a', 'b', 'c'] }
  },
  
  datafiles: {
    minimal: createMinimalDatafile(),
    full: createFullDatafile()
  }
};
```

## Debugging Tests

### Test Utilities

```typescript
// Debug helper for tests
export class TestDebugger {
  private logs: any[] = [];
  
  log(category: string, data: any): void {
    this.logs.push({
      timestamp: Date.now(),
      category,
      data
    });
  }
  
  getLogs(category?: string): any[] {
    if (category) {
      return this.logs.filter(log => log.category === category);
    }
    return this.logs;
  }
  
  printLogs(): void {
    console.log('=== Test Debug Logs ===');
    this.logs.forEach(log => {
      console.log(`[${new Date(log.timestamp).toISOString()}] ${log.category}:`);
      console.log(JSON.stringify(log.data, null, 2));
    });
  }
  
  clear(): void {
    this.logs = [];
  }
}

// Usage in tests
it('should debug complex flow', async () => {
  const debugger = new TestDebugger();
  
  try {
    // Test logic with debugging
    debugger.log('request', { url: '/api/decide' });
    const result = await service.process();
    debugger.log('result', result);
    
    expect(result).toBeDefined();
  } catch (error) {
    debugger.log('error', error);
    debugger.printLogs();
    throw error;
  }
});
```

## Test Coverage

### Coverage Requirements

```typescript
// Ensure comprehensive coverage
export const COVERAGE_THRESHOLDS = {
  global: {
    statements: 80,
    branches: 75,
    functions: 80,
    lines: 80
  },
  'src-v2/adapters/': {
    statements: 90,
    branches: 85,
    functions: 90,
    lines: 90
  },
  'src-v2/services/': {
    statements: 85,
    branches: 80,
    functions: 85,
    lines: 85
  }
};
```

### Coverage Reports

```bash
# Generate coverage report
npm run test:coverage

# View coverage in browser
npm run coverage:open

# Check coverage thresholds
npm run coverage:check
```

## See Also

- [Adapter Development](./adapter-development.md) - Building testable adapters
- [Mock Adapters](/src-v2/tests/test-utils/) - Test utility implementations
- [Platform Guides](./README.md#platform-specific-features) - Platform testing details
- [CI/CD Setup](/docs-sot/development/ci-cd.md) - Continuous integration configuration