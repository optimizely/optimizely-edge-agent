# CDN Adapters Guide

## Overview

The Optimizely Edge Agent v2 uses a sophisticated adapter pattern to provide platform-agnostic functionality across multiple CDN and edge computing platforms. This guide covers the adapter architecture, supported platforms, and how to implement custom adapters.

## Adapter Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          CDN Adapter Architecture                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Application Layer          Adapter Layer           Platform Layer       │
│  ┌──────────────┐         ┌─────────────┐         ┌────────────────┐  │
│  │   Services    │         │  Interfaces │         │   Cloudflare   │  │
│  │              │◄────────▶│             │◄────────▶│    Workers     │  │
│  │ - Decision   │         │ - Request   │         └────────────────┘  │
│  │ - Cache      │         │ - Response  │         ┌────────────────┐  │
│  │ - Storage    │         │ - Storage   │◄────────▶│     Fastly     │  │
│  │ - Config     │         │ - Logger    │         │  Compute@Edge  │  │
│  │              │         │ - Metrics   │         └────────────────┘  │
│  └──────────────┘         │ - Env       │         ┌────────────────┐  │
│                            └─────────────┘◄────────▶│     Vercel     │  │
│                                                    │ Edge Functions │  │
│                                                    └────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Supported Platforms

### Platform Comparison

| Feature | Cloudflare Workers | Fastly Compute@Edge | Vercel Edge Functions |
|---------|-------------------|---------------------|---------------------|
| **Runtime** | V8 Isolates | WebAssembly | Edge Runtime |
| **Language** | JavaScript/TypeScript | Multiple (via WASM) | JavaScript/TypeScript |
| **Cold Start** | ~0ms | ~50ms | ~150ms |
| **Memory Limit** | 128MB | 128MB | 1-2GB |
| **CPU Time** | 50ms (paid: 30s) | 50ms | 1000ms |
| **KV Storage** | Workers KV | Config Store | Edge Config |
| **Request Size** | 100MB | 8MB | 4.5MB |
| **Global Locations** | 275+ | 80+ | 20+ |

### Quick Platform Selection

```typescript
// Choose based on your needs:

// Cloudflare - Best for global scale and performance
if (requirements.includes('global-scale', 'low-latency', 'high-traffic')) {
  platform = 'cloudflare';
}

// Fastly - Best for enterprise features and customization
if (requirements.includes('enterprise', 'custom-vcl', 'advanced-caching')) {
  platform = 'fastly';
}

// Vercel - Best for Next.js integration and developer experience
if (requirements.includes('nextjs', 'serverless', 'easy-deployment')) {
  platform = 'vercel';
}
```

## Core Adapter Interfaces

### Request Adapter
Abstracts HTTP request handling across platforms:

```typescript
// From: /src-v2/adapters/interfaces/IRequestAdapter.ts
interface IRequestAdapter {
  readonly url: URL;
  readonly method: string;
  readonly headers: Headers;
  
  getHeader(name: string): string | null;
  getAllHeaders(): Record<string, string>;
  getBody(): Promise<string>;
  getQueryParam(name: string): string | null;
  getCookie(name: string): string | null;
}
```

### Response Adapter
Provides platform-agnostic response building:

```typescript
// From: /src-v2/adapters/interfaces/IResponseAdapter.ts
interface IResponseAdapter {
  setStatus(status: number): IResponseAdapter;
  setHeader(name: string, value: string): IResponseAdapter;
  setCookie(cookie: CookieOptions): IResponseAdapter;
  setBody(body: string | ReadableStream): IResponseAdapter;
  json(data: any, status?: number): IResponseAdapter;
  build(): Response;
}
```

### Storage Adapter
Unified interface for platform KV stores:

```typescript
// From: /src-v2/adapters/interfaces/IStorageAdapter.ts
interface IStorageAdapter {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: StorageOptions): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix?: string): Promise<string[]>;
}
```

## Quick Start

### 1. Cloudflare Workers

```typescript
// Install dependencies
npm install @optimizely/edge-agent

// Create handler (index.ts)
import { createCloudflareHandler } from '@optimizely/edge-agent';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const handler = createCloudflareHandler(env, ctx);
    return handler.handleRequest(request);
  }
};

// Deploy
npm run build:cloudflare
wrangler publish
```

### 2. Fastly Compute@Edge

```javascript
// Create handler (index.js)
import { createFastlyHandler } from '@optimizely/edge-agent';

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event));
});

async function handleRequest(event) {
  const handler = createFastlyHandler(event);
  return handler.handleRequest(event.request);
}

// Deploy
npm run build:fastly
fastly compute publish
```

### 3. Vercel Edge Functions

```typescript
// Create handler (api/optimizely.ts)
import { createVercelHandler } from '@optimizely/edge-agent';

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  const handler = createVercelHandler(process.env);
  return handler.handleRequest(request);
}

// Deploy
npm run build:vercel
vercel deploy
```

## Adapter Development

### Creating Custom Adapters

To support a new platform, implement all required interfaces:

```typescript
// 1. Implement Request Adapter
export class CustomRequestAdapter implements IRequestAdapter {
  constructor(private nativeRequest: CustomRequest) {}
  
  get url(): URL {
    return new URL(this.nativeRequest.url);
  }
  
  getHeader(name: string): string | null {
    return this.nativeRequest.headers[name] || null;
  }
  
  // ... implement all interface methods
}

// 2. Implement other adapters (Response, Storage, etc.)

// 3. Create factory
export class CustomAdapterFactory {
  createRequestAdapter(request: CustomRequest): IRequestAdapter {
    return new CustomRequestAdapter(request);
  }
  
  // ... create other adapters
}

// 4. Create composition
export function createCustomHandler(config: CustomConfig) {
  const factory = new CustomAdapterFactory();
  // Wire up services with adapters
  return new RequestHandler(/* services */);
}
```

## Platform-Specific Features

### Cloudflare Workers
- **Workers KV**: Distributed key-value storage
- **Durable Objects**: Stateful serverless computing
- **Analytics Engine**: Real-time analytics
- **Cache API**: Programmatic cache control

[Learn more →](./cloudflare-adapter.md)

### Fastly Compute@Edge
- **Edge Dictionary**: Configuration storage
- **Backend definitions**: Origin server configuration
- **VCL compatibility**: Custom logic integration
- **Real-time analytics**: Built-in metrics

[Learn more →](./fastly-adapter.md)

### Vercel Edge Functions
- **Edge Config**: Dynamic configuration
- **Edge Runtime**: Node.js-compatible APIs
- **ISR Integration**: Incremental Static Regeneration
- **Analytics**: Web Vitals and custom events

[Learn more →](./vercel-adapter.md)

## Performance Considerations

### Cold Start Optimization

```typescript
// Pre-initialize services
const services = await initializeServices();

// Export handler immediately
export default {
  fetch: (request, env, ctx) => 
    handleRequest(request, env, ctx, services)
};
```

### Platform Limits

```typescript
// Respect platform constraints
const PLATFORM_LIMITS = {
  cloudflare: {
    cpuTime: 50, // milliseconds
    memory: 128, // MB
    scriptSize: 1, // MB
  },
  fastly: {
    cpuTime: 50,
    memory: 128,
    packageSize: 100, // MB
  },
  vercel: {
    cpuTime: 1000,
    memory: 1024,
    functionSize: 50, // MB
  }
};
```

## Testing Adapters

### Unit Testing

```typescript
// Use mock adapters for testing
import { MockRequestAdapter, MockStorageAdapter } from '@optimizely/edge-agent/testing';

describe('MyService', () => {
  it('handles requests', async () => {
    const request = new MockRequestAdapter({
      url: 'https://example.com',
      headers: { 'X-Test': 'value' }
    });
    
    const storage = new MockStorageAdapter();
    const service = new MyService(storage);
    
    const result = await service.process(request);
    expect(result).toBeDefined();
  });
});
```

### Integration Testing

Each platform provides local development environments:
- **Cloudflare**: `wrangler dev`
- **Fastly**: `fastly compute serve`
- **Vercel**: `vercel dev`

## Migration Guide

Moving between platforms? Our adapters make it seamless:

```typescript
// Before (Cloudflare-specific)
const value = await env.KV_NAMESPACE.get(key);

// After (Platform-agnostic)
const value = await storageAdapter.get(key);
```

[Full migration guide →](./platform-migration.md)

## Best Practices

### 1. Use Dependency Injection
```typescript
// Good: Accept interfaces, not implementations
class MyService {
  constructor(
    private storage: IStorageAdapter,
    private logger: ILoggerAdapter
  ) {}
}
```

### 2. Handle Platform Differences
```typescript
// Check capabilities at runtime
if (this.platform.supports('durableObjects')) {
  // Use Durable Objects
} else {
  // Fall back to KV storage
}
```

### 3. Test Across Platforms
```bash
# Run tests for all platforms
npm run test:cloudflare
npm run test:fastly
npm run test:vercel
```

## Troubleshooting

### Common Issues

1. **Type Errors**: Ensure platform types are installed
   ```bash
   npm install --save-dev @cloudflare/workers-types
   ```

2. **Build Failures**: Check platform-specific TypeScript config
   ```json
   // tsconfig.cloudflare.json
   {
     "compilerOptions": {
       "types": ["@cloudflare/workers-types"]
     }
   }
   ```

3. **Runtime Errors**: Validate adapter implementation
   ```typescript
   // Add runtime checks
   if (!this.storage) {
     throw new Error('Storage adapter not initialized');
   }
   ```

## Next Steps

- [Develop Custom Adapters](./adapter-development.md) - Build your own platform adapter
- [Testing Adapters Guide](./testing-adapters.md) - Comprehensive testing strategies
- [Edge Mode Testing Guide](./edge-mode-testing-guide.md) - Testing Edge Mode across platforms
- [Cloudflare Guide](./cloudflare-adapter.md) - Deep dive into Cloudflare
- [Fastly Guide](./fastly-adapter.md) - Master Fastly Compute@Edge
- [Vercel Guide](./vercel-adapter.md) - Optimize for Vercel
- [Performance Guide](./performance-optimization.md) - Platform-specific tuning

## Implementation References

- `/src-v2/adapters/interfaces/` - All adapter interfaces
- `/src-v2/adapters/implementations/` - Platform implementations
- `/src-v2/composition/` - Platform-specific compositions
- `/src-v2/tests/adapters/` - Adapter test suites