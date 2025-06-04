# Composition Root

The Composition Root pattern is central to the Optimizely Edge Agent v2 architecture. It provides a single location where all dependencies are wired together, enabling clean dependency injection, testability, and platform-specific customization.

## Overview

The Composition Root pattern solves several architectural challenges:
- **Dependency Management**: All service dependencies resolved in one place
- **Platform Abstraction**: Platform-specific implementations injected at runtime
- **Testability**: Easy to substitute mock implementations
- **Configuration**: Centralized configuration injection
- **Type Safety**: TypeScript ensures correct wiring at compile time

## Implementation Structure

```
src-v2/
├── compositionRoot.ts          # Main composition logic
├── composition/                # Platform-specific compositions
│   ├── cloudflareComposition.ts
│   ├── fastlyComposition.ts
│   └── vercelComposition.ts
└── index.ts                   # Entry point routing
```

## Core Composition Root

The main composition root (`/src-v2/compositionRoot.ts`) defines the service creation logic:

```typescript
export async function createRequestHandler(
  request: Request,
  env: CloudflareEnvironment,
  ctx: ExecutionContext
): Promise<RequestHandler> {
  // 1. Create platform adapters
  const environmentAdapter = new CloudflareEnvironmentAdapter(env);
  const requestAdapter = new CloudflareRequestAdapter(request, ctx);
  const responseAdapter = new CloudflareResponseAdapter();
  const loggerAdapter = new CloudflareLoggerAdapter(env.LOG_LEVEL || 'info');
  const storageAdapter = env.KV_STORAGE 
    ? new CloudflareStorageAdapter(env.KV_STORAGE, loggerAdapter)
    : undefined;
  const metricsAdapter = createMetricsAdapter(env, loggerAdapter);

  // 2. Create core services
  const cacheService = new CacheService(loggerAdapter, {
    defaultTTL: 300,
    maxSize: 100
  });

  const datafileService = new DatafileService(
    environmentAdapter,
    loggerAdapter,
    cacheService,
    storageAdapter,
    undefined, // flagStorageService
    metricsAdapter,
    datafileServiceOptions
  );

  const configurationService = new ConfigurationService(
    datafileService,
    loggerAdapter
  );

  // 3. Create decision service if available
  const decisionService = storageAdapter
    ? new DecisionService(
        configurationService,
        datafileService,
        loggerAdapter,
        cacheService,
        new KVUserProfileService(storageAdapter, loggerAdapter),
        metricsAdapter
      )
    : undefined;

  // 4. Create API router if decision service available
  const apiRouter = decisionService
    ? new ApiRouter(
        datafileService,
        cacheService,
        configurationService,
        loggerAdapter,
        metricsAdapter,
        decisionService
      )
    : undefined;

  // 5. Create edge mode services
  const edgeModeIntegration = createEdgeModeIntegration(
    /* dependencies */
  );

  // 6. Create and return request handler
  return new RequestHandler(
    decisionService!,
    eventService,
    loggerAdapter,
    cacheService,
    edgeModeIntegration,
    metricsAdapter,
    cookieService,
    flagStorage,
    configurationService,
    cleanupConfig,
    apiRouter
  );
}
```

## Platform-Specific Compositions

Each platform has its own composition file that handles platform-specific setup:

### Cloudflare Composition

```typescript
// /src-v2/composition/cloudflareComposition.ts
export default {
  async fetch(
    request: Request,
    env: CloudflareEnvironment,
    ctx: ExecutionContext
  ): Promise<Response> {
    try {
      // Create request handler with Cloudflare-specific setup
      const handler = await createRequestHandler(request, env, ctx);
      
      // Process request
      const requestAdapter = new CloudflareRequestAdapter(request, ctx);
      const result = await handler.handleRequest(requestAdapter);
      
      // Convert to Cloudflare Response
      return new Response(result.body, {
        status: result.status,
        headers: result.headers
      });
    } catch (error) {
      return new Response('Internal Server Error', { status: 500 });
    }
  }
};
```

### Fastly Composition

```typescript
// /src-v2/composition/fastlyComposition.ts
addEventListener("fetch", (event) => event.respondWith(handleRequest(event)));

async function handleRequest(event: FetchEvent): Promise<Response> {
  const env = createFastlyEnvironment();
  const handler = await createRequestHandler(
    event.request,
    env,
    event
  );
  
  // Fastly-specific processing
  return processWithFastly(handler, event);
}
```

## Dependency Injection Flow

```
┌─────────────────┐
│  Entry Point    │
│   (index.ts)    │
└────────┬────────┘
         │
         ▼
┌─────────────────────┐      ┌───────────────────┐
│ Platform Detection  │─────▶│ Platform Compose  │
└─────────────────────┘      │ (cloudflare.ts)   │
                             └─────────┬─────────┘
                                       │
                                       ▼
                            ┌──────────────────────┐
                            │  Composition Root    │
                            │ (compositionRoot.ts) │
                            └──────────┬───────────┘
                                       │
                    ┌──────────────────┴──────────────────┐
                    │                                     │
                    ▼                                     ▼
         ┌───────────────────┐                ┌────────────────────┐
         │ Create Adapters   │                │ Create Services    │
         │ - Request         │                │ - Configuration    │
         │ - Response        │                │ - Decision         │
         │ - Storage         │                │ - Cache            │
         │ - Logger          │                │ - Datafile         │
         │ - Metrics         │                │ - API Router       │
         └───────────────────┘                └────────────────────┘
                    │                                     │
                    └──────────────────┬──────────────────┘
                                       │
                                       ▼
                            ┌──────────────────────┐
                            │  RequestHandler      │
                            │  (Fully Composed)    │
                            └──────────────────────┘
```

## Service Creation Options

The composition root supports various configuration options:

### Datafile Service Options

```typescript
const datafileServiceOptions = {
  defaultTTL: 300, // 5 minutes
  cdnUrl: env.OPTIMIZELY_CDN_URL || 'https://cdn.optimizely.com',
  datafileAccessToken: env.DATAFILE_ACCESS_TOKEN,
  autoExtractFlagKeys: env.OPTIMIZELY_DISABLE_AUTO_FLAG_EXTRACTION !== 'true',
  kvStorageFallback: true
};
```

### Cache Service Options

```typescript
const cacheOptions = {
  defaultTTL: env.CACHE_DEFAULT_TTL || 300,
  maxSize: env.CACHE_MAX_SIZE || 100,
  enableMetrics: true
};
```

### Decision Service Options

```typescript
const decisionServiceOptions = {
  enableUserProfileService: storageAdapter !== undefined,
  enableCaching: true,
  cacheSize: 50,
  cacheTTL: 300
};
```

## Conditional Service Creation

Services are created conditionally based on available dependencies:

```typescript
// Only create decision service if storage is available
const decisionService = storageAdapter
  ? new DecisionService(/* deps */)
  : undefined;

// Only create API router if decision service exists
const apiRouter = decisionService
  ? new ApiRouter(/* deps */)
  : undefined;

// Only create edge mode if required services exist
const edgeModeIntegration = decisionService && contentFetcher
  ? new EdgeModeIntegration(/* deps */)
  : undefined;
```

## Environment Variable Injection

The composition root handles environment variable injection:

```typescript
function createEnvironmentConfig(env: PlatformEnvironment) {
  return {
    logLevel: env.LOG_LEVEL || 'info',
    cdnUrl: env.OPTIMIZELY_CDN_URL || 'https://cdn.optimizely.com',
    apiPathPrefix: env.API_PATH_PREFIX || '/api/',
    enableMetrics: env.ENABLE_METRICS !== 'false',
    enableDebugHeaders: env.ENABLE_DEBUG_HEADERS === 'true',
    // ... other configuration
  };
}
```

## Testing with Composition Root

The pattern enables easy testing by allowing dependency substitution:

```typescript
// Test example
describe('RequestHandler', () => {
  it('handles requests correctly', async () => {
    // Create mock dependencies
    const mockLogger = new MockLoggerAdapter();
    const mockStorage = new MockStorageAdapter();
    const mockMetrics = new MockMetricsAdapter();
    
    // Create handler with mocks
    const handler = new RequestHandler(
      new DecisionService(/* mock deps */),
      new MockEventService(),
      mockLogger,
      new CacheService(mockLogger),
      undefined, // No edge mode
      mockMetrics
    );
    
    // Test handler behavior
    const result = await handler.handleRequest(mockRequest);
    expect(result.status).toBe(200);
  });
});
```

## Factory Pattern Integration

The composition root uses factory patterns for complex object creation:

```typescript
// Metrics adapter factory
function createMetricsAdapter(
  env: PlatformEnvironment,
  logger: ILoggerAdapter
): IMetricsAdapter | undefined {
  if (!env.ANALYTICS_ENGINE) {
    return undefined;
  }
  
  return new CloudflareMetricsAdapter(
    logger,
    env.METRICS_PREFIX || 'optimizely_edge_',
    env.ANALYTICS_ENGINE,
    {
      enabled: env.METRICS_ENABLED !== 'false',
      defaultSamplingRate: parseFloat(env.METRICS_SAMPLING_RATE || '1.0')
    }
  );
}
```

## Error Handling in Composition

The composition root includes comprehensive error handling:

```typescript
export async function createRequestHandler(
  request: Request,
  env: Environment,
  ctx: ExecutionContext
): Promise<RequestHandler> {
  try {
    // Service creation logic
    return handler;
  } catch (error) {
    // Log composition errors
    const emergencyLogger = new ConsoleLoggerAdapter();
    emergencyLogger.error('Failed to create request handler', error);
    
    // Return minimal handler for error responses
    return new ErrorRequestHandler(emergencyLogger, error);
  }
}
```

## Performance Considerations

The composition root is optimized for edge environments:

1. **Lazy Service Creation**: Services created only when needed
2. **Singleton Pattern**: Reuse expensive objects within request
3. **Minimal Dependencies**: Only required services instantiated
4. **Fast Startup**: Optimized for cold start performance

## Best Practices

### 1. Single Responsibility
Each composition file should only handle wiring, not business logic:

```typescript
// ✅ Good - Only wiring
const service = new Service(dep1, dep2);

// ❌ Bad - Business logic in composition
const service = new Service(dep1, dep2);
service.initialize(); // Should be in service constructor
```

### 2. Type Safety
Leverage TypeScript for compile-time validation:

```typescript
// Type-safe service creation
function createServices<T extends PlatformEnvironment>(
  env: T
): ServiceContainer<T> {
  // TypeScript ensures correct dependencies
}
```

### 3. Clear Dependencies
Make all dependencies explicit:

```typescript
// ✅ Good - Clear dependencies
new DecisionService(
  configService,
  datafileService,
  logger,
  cache,
  userProfileService,
  metrics
);

// ❌ Bad - Hidden dependencies
new DecisionService({ env, ctx }); // What does it actually need?
```

## Platform Migration

The composition root pattern makes platform migration straightforward:

```typescript
// Original Cloudflare
const handler = createCloudflareHandler(request, env, ctx);

// Migrate to Vercel - Just change composition
const handler = createVercelHandler(request, env, ctx);

// Core services remain unchanged
```

## Next Steps

- For service details: [Service Architecture](./service-architecture.md)
- For adapter patterns: [Adapter Pattern](./adapter-pattern.md)
- For request flow: [Request Lifecycle](./request-lifecycle.md)
- For deployment: [Deployment Architecture](./deployment-architecture.md)

---

**Implementation References**:
- Main composition: `/src-v2/compositionRoot.ts`
- Cloudflare: `/src-v2/composition/cloudflareComposition.ts`
- Fastly: `/src-v2/composition/fastlyComposition.ts`
- Vercel: `/src-v2/composition/vercelComposition.ts`

**Last Updated**: 2025-05-29