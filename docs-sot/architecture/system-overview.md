# System Overview

The Optimizely Edge Agent v2 is a sophisticated edge computing application that enables feature flagging and experimentation at the network edge. This document provides a comprehensive overview of the system architecture, component relationships, and design decisions.

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Client Applications                            │
│                    (Web, Mobile, Server-side, IoT)                      │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │ HTTP Requests
                                  ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                          Edge Network Layer                              │
│  ┌─────────────┐      ┌──────────────┐      ┌─────────────────┐       │
│  │  Cloudflare │      │    Fastly    │      │     Vercel      │       │
│  │   Workers   │      │ Compute@Edge │      │ Edge Functions  │       │
│  └──────┬──────┘      └──────┬───────┘      └────────┬────────┘       │
│         │                     │                        │                │
│         └─────────────────────┴────────────────────────┘                │
│                               │                                         │
└───────────────────────────────┼─────────────────────────────────────────┘
                                │
                                ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                      Optimizely Edge Agent v2                           │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      Platform Adapter Layer                       │  │
│  │  Request │ Response │ Storage │ Environment │ Logger │ Metrics   │  │
│  └──────────────────────────────┬───────────────────────────────────┘  │
│                                 │                                       │
│  ┌──────────────────────────────┴───────────────────────────────────┐  │
│  │                        Request Handler                            │  │
│  │                 (Main Orchestration Layer)                        │  │
│  └──────────┬────────────────────────────────────┬──────────────────┘  │
│             │                                    │                      │
│         Edge Mode                           Agent Mode                  │
│             │                                    │                      │
│  ┌──────────┴───────────┐          ┌───────────┴──────────────────┐   │
│  │   EdgeModeHandler    │          │         ApiRouter            │   │
│  │  ┌───────────────┐  │          │  ┌────────────────────────┐  │   │
│  │  │ URL Matcher   │  │          │  │ /api/decide           │  │   │
│  │  │ Content Fetch │  │          │  │ /api/datafile         │  │   │
│  │  │ Transform     │  │          │  │ /api/forced-variation │  │   │
│  │  └───────────────┘  │          │  │ /api/admin/*          │  │   │
│  └──────────────────────┘          │  └────────────────────────┘  │   │
│                                    └──────────────────────────────┘   │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      Core Services Layer                          │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌──────────────┐ ┌───────────┐ │  │
│  │  │  Decision   │ │   Config    │ │   Datafile   │ │   Cache   │ │  │
│  │  │  Service    │ │  Service    │ │   Service    │ │  Service  │ │  │
│  │  └─────────────┘ └─────────────┘ └──────────────┘ └───────────┘ │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌──────────────┐ ┌───────────┐ │  │
│  │  │   Cookie    │ │   Event     │ │ UserProfile  │ │   Flag    │ │  │
│  │  │  Service    │ │ Dispatcher  │ │   Service    │ │  Storage  │ │  │
│  │  └─────────────┘ └─────────────┘ └──────────────┘ └───────────┘ │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    Optimizely SDK Integration                     │  │
│  │                  (@optimizely/optimizely-sdk)                     │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                │
                                ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                         External Services                                │
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────────────┐ │
│  │ Optimizely CDN  │  │  Origin Servers  │  │ Analytics/Monitoring  │ │
│  │  (Datafiles)    │  │ (Edge Content)   │  │    (Metrics)         │ │
│  └─────────────────┘  └──────────────────┘  └───────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

## Component Descriptions

### Platform Adapter Layer

The platform adapter layer abstracts platform-specific APIs into common interfaces:

- **IRequestAdapter**: Normalizes HTTP request handling across platforms
- **IResponseAdapter**: Standardizes response creation
- **IStorageAdapter**: Provides key-value storage abstraction
- **IEnvironmentAdapter**: Access to environment variables and platform features
- **ILoggerAdapter**: Consistent logging interface
- **IMetricsAdapter**: Platform-specific metrics collection

### Request Handler

The central orchestrator that:
1. Receives incoming requests through platform adapters
2. Determines routing (Edge Mode vs Agent Mode)
3. Coordinates service interactions
4. Generates appropriate responses
5. Handles errors and edge cases

**Source**: `/src-v2/services/implementations/RequestHandler.ts`

### Edge Mode vs Agent Mode

The system operates in two distinct modes:

#### Edge Mode
- **Trigger**: GET requests to non-API paths
- **Purpose**: Content delivery with experimentation
- **Features**:
  - URL pattern matching
  - Content fetching and transformation
  - Cookie-based user identification
  - Automatic variation assignment

#### Agent Mode  
- **Trigger**: Any request to `/api/*` paths
- **Purpose**: Programmatic feature flag decisions
- **Features**:
  - RESTful API endpoints
  - Explicit decision requests
  - Administrative operations
  - Debug capabilities

### Core Services

#### DecisionService
Manages all Optimizely SDK interactions:
- Creates and caches SDK clients
- Makes feature flag decisions
- Handles forced variations
- Manages user contexts

**Source**: `/src-v2/services/implementations/DecisionService.ts`

#### ConfigurationService
Resolves configuration from multiple sources:
- HTTP headers (highest priority)
- Query parameters
- Request body
- Environment variables
- Default values (lowest priority)

**Source**: `/src-v2/services/implementations/ConfigurationService.ts`

#### DatafileService
Manages Optimizely datafiles:
- Fetches from CDN or storage
- Caches with TTL
- Validates datafile format
- Extracts flag keys

**Source**: `/src-v2/services/implementations/DatafileService.ts`

#### CacheService
Provides in-memory caching:
- LRU eviction strategy
- TTL support
- Size limits
- Cache key patterns

**Source**: `/src-v2/services/implementations/CacheService.ts`

## Data Storage

The system uses multiple storage layers:

### 1. In-Memory Cache
- **Purpose**: Fast access to frequently used data
- **Scope**: Per-worker instance
- **Duration**: Worker lifetime
- **Use Cases**: SDK clients, decisions, configurations

### 2. KV Storage
- **Purpose**: Persistent storage across workers
- **Scope**: Account/namespace level
- **Duration**: Configurable TTL
- **Use Cases**: Datafiles, user profiles, forced variations

### 3. Cookie Storage
- **Purpose**: Client-side state
- **Scope**: Per user/browser
- **Duration**: Configurable expiry
- **Use Cases**: Visitor ID, sticky decisions

## Request Processing Flow

```
1. Request Arrival
   └─→ Platform receives HTTP request
   
2. Adapter Creation
   └─→ Platform-specific adapters wrap request/response
   
3. Service Composition
   └─→ Dependency injection creates required services
   
4. Route Determination
   ├─→ API Path (/api/*) → Agent Mode
   └─→ Other Paths → Edge Mode
   
5. Mode-Specific Processing
   ├─→ Edge Mode: Pattern matching → Content fetch → Transform
   └─→ Agent Mode: API routing → Operation execution
   
6. Response Generation
   └─→ Headers, cookies, body construction
   
7. Platform Response
   └─→ Platform-specific response handling
```

## Scalability Design

The architecture is designed for horizontal scalability:

### Stateless Workers
- No shared memory between requests
- All state in external storage
- Parallel request processing

### Distributed Caching
- Worker-level caches for performance
- KV storage for shared state
- Cache invalidation strategies

### Load Distribution
- Automatic by edge platform
- Geographic distribution
- Failover capabilities

## Security Boundaries

```
┌─────────────────────────┐
│   Untrusted Input       │
│   (Client Requests)     │
└───────────┬─────────────┘
            │ Validation
┌───────────▼─────────────┐
│   Platform Adapters     │
│   (Input Sanitization)  │
└───────────┬─────────────┘
            │ Type-safe
┌───────────▼─────────────┐
│   Service Layer         │
│   (Business Logic)      │
└───────────┬─────────────┘
            │ Controlled
┌───────────▼─────────────┐
│   External Services     │
│   (CDN, Origin, etc.)   │
└─────────────────────────┘
```

## Performance Optimizations

### Caching Strategy
1. **Decision Cache**: Avoid repeated SDK calculations
2. **Datafile Cache**: Reduce CDN requests
3. **Configuration Cache**: Minimize parsing overhead
4. **Client Cache**: Reuse SDK instances

### Lazy Loading
- Services created on-demand
- SDK clients initialized when needed
- Deferred expensive operations

### Efficient Serialization
- Minimal JSON parsing
- Streaming responses where possible
- Binary data handling for metrics

## Monitoring and Observability

The system provides comprehensive monitoring through:

### Metrics Collection
- Request duration and throughput
- Decision performance
- Cache hit rates
- Error frequencies

### Logging
- Structured logging with levels
- Request tracing with IDs
- Error context capture
- Performance profiling

### Health Checks
- Platform-native health endpoints
- Service availability checks
- Dependency status monitoring

## Platform-Specific Considerations

### Cloudflare Workers
- **Limits**: 128MB memory, 50ms CPU time
- **Features**: Workers KV, Durable Objects
- **Optimization**: Minimal bundle size

### Fastly Compute@Edge
- **Limits**: 128MB memory, 60s timeout
- **Features**: Dictionary API, Backend definitions
- **Optimization**: WASM compilation

### Vercel Edge Functions
- **Limits**: 128MB memory, 30s timeout
- **Features**: Edge Config, KV storage
- **Optimization**: Tree shaking

## Next Steps

- For service details: [Service Architecture](./service-architecture.md)
- For platform abstraction: [Adapter Pattern](./adapter-pattern.md)
- For request flow: [Request Lifecycle](./request-lifecycle.md)
- For deployment: [Deployment Architecture](./deployment-architecture.md)

---

**Related Documentation**: 
- [Architecture README](./README.md)
- [Composition Root](./composition-root.md)
- [Data Flow](./data-flow.md)

**Implementation Reference**: `/src-v2/`  
**Last Updated**: 2025-05-29