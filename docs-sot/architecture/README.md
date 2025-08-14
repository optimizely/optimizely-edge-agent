# Architecture

The Optimizely Edge Agent v2 is built on a modern, modular architecture designed for edge computing environments. This guide explains the system design, component relationships, and architectural decisions that enable high-performance feature flagging and experimentation at the edge.

## Overview

The v2 architecture represents a complete redesign from v1, introducing:
- **Platform Abstraction Layer**: Seamless deployment across Cloudflare, Fastly, and Vercel
- **Service-Oriented Architecture**: Clear separation of concerns with interface-based design
- **Dependency Injection**: Flexible composition and testability
- **Type-Safe Implementation**: Full TypeScript with comprehensive type definitions
- **Edge-First Design**: Optimized for distributed edge computing constraints

## Quick Navigation

| Document | Description |
|----------|-------------|
| [System Overview](./system-overview.md) | Complete system architecture and component relationships |
| [Composition Root](./composition-root.md) | Dependency injection and service wiring |
| [Service Architecture](./service-architecture.md) | Core services and their responsibilities |
| [Adapter Pattern](./adapter-pattern.md) | Platform abstraction and adapter design |
| [Request Lifecycle](./request-lifecycle.md) | Request processing flow from entry to response |
| [Data Flow](./data-flow.md) | How data moves through the system |
| [Deployment Architecture](./deployment-architecture.md) | Platform-specific deployment patterns |

## Core Architecture Principles

### 1. Interface-First Design
Every major component is defined by an interface, enabling:
- Platform-specific implementations without changing core logic
- Easy testing through mock implementations
- Clear contracts between components
- Future extensibility

```typescript
// Example: Storage abstraction
interface IStorageAdapter {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: StorageOptions): Promise<void>;
  delete(key: string): Promise<void>;
}
```

### 2. Platform Abstraction
The architecture abstracts platform differences through adapters:

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
│  (RequestHandler, DecisionService, ApiRouter, etc.)          │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │ Adapter Interfaces │
                    └─────────┬─────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────┴────────┐ ┌─────────┴────────┐ ┌─────────┴────────┐
│   Cloudflare   │ │      Fastly      │ │     Vercel       │
│    Adapters    │ │     Adapters     │ │    Adapters      │
└────────────────┘ └──────────────────┘ └──────────────────┘
```

### 3. Service-Oriented Architecture
Core functionality is organized into focused services:

- **RequestHandler**: Orchestrates request processing
- **DecisionService**: Manages Optimizely SDK interactions
- **ConfigurationService**: Handles configuration resolution
- **DatafileService**: Manages datafile operations
- **ApiRouter**: Routes API requests to handlers
- **EdgeModeHandler**: Processes edge mode requests
- **CacheService**: Provides caching capabilities

### 4. Composition Root Pattern
All dependency wiring happens in a single location per platform:

```typescript
// Simplified example from compositionRoot.ts
export function createServices(
  env: CloudflareEnvironment,
  ctx: ExecutionContext
): ServiceContainer {
  // Create adapters
  const requestAdapter = new CloudflareRequestAdapter(request);
  const storageAdapter = new CloudflareStorageAdapter(env.KV_STORAGE);
  
  // Create services with dependencies
  const configService = new ConfigurationService(datafileService, logger);
  const decisionService = new DecisionService(configService, logger);
  
  // Return composed application
  return new RequestHandler(decisionService, logger);
}
```

## Key Architectural Differences from v1

| Aspect | v1 | v2 |
|--------|----|----|
| **Language** | JavaScript | TypeScript |
| **Architecture** | Monolithic with CDN adapters | Service-oriented with DI |
| **Platform Support** | Adapter files | Interface-based abstraction |
| **Configuration** | Scattered helpers | Centralized ConfigurationService |
| **Type Safety** | Runtime checks only | Compile-time type safety |
| **Testing** | Limited mocking | Full DI enables comprehensive testing |
| **Code Organization** | Feature-based folders | Layer-based with clear boundaries |

## Component Overview

```
src-v2/
├── adapters/           # Platform-specific implementations
│   ├── interfaces/     # Adapter contracts
│   └── implementations/
│       ├── cloudflare/
│       ├── fastly/
│       └── vercel/
├── services/          # Core business logic
│   ├── interfaces/    # Service contracts
│   └── implementations/
├── composition/       # Platform-specific wiring
│   ├── cloudflareComposition.ts
│   ├── fastlyComposition.ts
│   └── vercelComposition.ts
├── utils/            # Shared utilities
└── index.ts          # Main entry point
```

## Request Flow Overview

```
Request → Platform Adapter → RequestHandler → Route Determination
                                    ↓
                          ┌─────────┴──────────┐
                          │                    │
                     Edge Mode            Agent Mode
                          │                    │
                   EdgeModeHandler        ApiRouter
                          │                    │
                   Content Delivery      API Operations
                          │                    │
                          └─────────┬──────────┘
                                    ↓
                            Response Generation
```

## Performance Considerations

The architecture is optimized for edge computing:

1. **Minimal Cold Start**: Service creation is lightweight
2. **Efficient Caching**: Multi-level caching strategy
3. **Lazy Loading**: Services created only when needed
4. **Stateless Design**: No persistent state between requests
5. **Platform Optimizations**: Leverages platform-specific features

## Security Architecture

Security is built into the architecture:

- **Input Validation**: At adapter boundaries
- **Type Safety**: TypeScript prevents many vulnerabilities
- **Secure Defaults**: Conservative configuration defaults
- **Authentication**: Pluggable auth through adapters
- **Audit Logging**: Comprehensive logging through ILoggerAdapter

## Extensibility Points

The architecture provides several extension mechanisms:

1. **Custom Adapters**: Implement adapter interfaces for new platforms
2. **Service Decorators**: Wrap services for additional functionality
3. **Middleware Pipeline**: Add processing steps in RequestHandler
4. **Event System**: Hook into decision and tracking events
5. **Custom Storage**: Implement IStorageAdapter for different backends

## Next Steps

- For system design details: [System Overview](./system-overview.md)
- For service details: [Service Architecture](./service-architecture.md)
- For platform specifics: [Adapter Pattern](./adapter-pattern.md)
- For request processing: [Request Lifecycle](./request-lifecycle.md)

---

**Implementation Source**: `/src-v2/`  
**Architecture Diagrams**: See individual topic documents  
**Last Updated**: 2025-05-29