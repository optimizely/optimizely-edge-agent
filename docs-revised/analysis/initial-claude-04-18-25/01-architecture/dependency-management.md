# Dependency Management & Injection Comparison

_Last Updated: 2025-04-18_

## v1 – Manual Instantiation

*All dependencies are passed into `CoreLogic` via its constructor or set later with setters.*

```typescript
// src/coreLogic.js (simplified)
constructor(optimizelyProvider, env, ctx, sdkKey, abstractionHelper, kvStore, kvStoreUserProfile, logger) {
  this.optimizelyProvider = optimizelyProvider;
  this.abstractionHelper = abstractionHelper;
  this.kvStore = kvStore;
  this.logger = logger;
  // ...remaining assignments
}
```

Characteristics:

| Aspect | Details |
|--------|---------|
| **Creation Site** | Dependencies created **at call sites** (e.g., Cloudflare worker entry) and threaded down. |
| **Coupling** | `CoreLogic` **knows concrete implementations** (CloudflareAdapter) via setters. |
| **Lifecycle** | No central lifecycle management; objects live as long as request scope. |
| **Testability** | Mocks must be manually constructed and injected for each test. |

## v2 – Composition Root & Factories

`compositionRoot.ts` centrally orchestrates creation and wiring of **adapters** and **services**.

```typescript
const cloudflareFactory = new CloudflareAdapterFactory(inputs);
const logger = cloudflareFactory.createLoggerAdapter();
const storageAdapter = cloudflareFactory.createStorageAdapter(CONFIG_KV_BINDING_NAME);
// ...
const cacheService = new CacheService(storageAdapter, logger);
const requestHandler = new RequestHandler(
  decisionService,
  eventService,
  logger,
  cacheService,
  // ...
);
```

Characteristics:

| Aspect | Details |
|--------|---------|
| **Creation Site** | Single Composition Root chooses factory based on CDN type and **builds object graph**. |
| **Inversion of Control** | Application code receives fully‑formed services via **constructor injection**. |
| **Lifecycle** | Composition Root controls instance scope (per request or global singleton depending on CDN platform). |
| **Testability** | Interfaces (`ILoggerAdapter`, `IStorageAdapter`, etc.) make mocking straightforward; tests instantiate RequestHandler with stubs. |

## Key Differences

| Dimension | v1 | v2 |
|-----------|----|----|
| Central DI point | _None_ | `compositionRoot.ts` |
| Dependency visibility | `CoreLogic` creates/sets adapters directly | Services receive **abstract interfaces** only |
| Adapter selection | Hard‑coded in request entry | Factory pattern, configurable |
| Extensibility | Adding new CDN touches CoreLogic | Implement new factory + adapters, minimal changes elsewhere |

## Advantages of v2 Approach

1. **Separation of Concerns** – Business logic (services) unaware of platform.
2. **Easier Testing** – Mock interfaces without heavy setup.
3. **Scalability** – Adding logging/metrics adapters requires wiring only in Composition Root.
4. **Maintainability** – Smaller files, limited responsibilities.
