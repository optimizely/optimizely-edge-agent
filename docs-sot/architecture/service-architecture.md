# Service Architecture

The Optimizely Edge Agent v2 follows a service-oriented architecture with clearly defined interfaces and responsibilities. This document details the core services, their contracts, and interaction patterns.

## Service Layer Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Service Interfaces                        │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────────┐│
│  │IRequestHandler│ │IDecisionService│ │IConfigurationService  ││
│  └──────────────┘ └──────────────┘ └──────────────────────────┘│
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────────┐│
│  │IDatafileService│ │ICacheService │ │IEventService          ││
│  └──────────────┘ └──────────────┘ └──────────────────────────┘│
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────────┐│
│  │ICookieService │ │IUserProfileService│ │IFlagStorageService ││
│  └──────────────┘ └──────────────┘ └──────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │   Implementations       │
                    └────────────┬────────────┘
                                 │
┌─────────────────────────────────────────────────────────────────┐
│                     Service Implementations                      │
│  RequestHandler    DecisionService    ConfigurationService      │
│  DatafileService   CacheService       EventDispatcher           │
│  CookieService     KVUserProfileService  FlagStorageService     │
└─────────────────────────────────────────────────────────────────┘
```

## Core Service Interfaces

### IRequestHandler

The main entry point for all requests:

```typescript
export interface IRequestHandler {
  /**
   * Handles an incoming request and returns a response
   * @param requestAdapter - Platform-agnostic request wrapper
   * @returns Promise resolving to response data
   */
  handleRequest(requestAdapter: IRequestAdapter): Promise<ResponseResult>;
}

export interface ResponseResult {
  status: number;
  body: string;
  headers: Record<string, string>;
}
```

**Implementation**: `/src-v2/services/implementations/RequestHandler.ts`

**Responsibilities**:
- Route requests to appropriate handlers (Edge/Agent mode)
- Orchestrate service interactions
- Handle errors and generate responses
- Manage request lifecycle

### IDecisionService

Manages all Optimizely SDK interactions and decisions:

```typescript
export interface IDecisionService {
  /**
   * Make a decision for a feature flag
   */
  decide(
    flagKey: string,
    userContext: OptimizelyUserContext,
    options?: { sdkKey?: string; decideOptions?: OptimizelyDecideOption[] }
  ): Promise<OptimizelyDecision>;

  /**
   * Get all decisions for a user
   */
  getAllDecisions(
    userId: string,
    attributes?: UserAttributes,
    options?: { sdkKey?: string; decideOptions?: OptimizelyDecideOption[] }
  ): Promise<Record<string, OptimizelyDecision>>;

  /**
   * Set a forced variation for testing
   */
  setForcedVariation?(
    flagKey: string,
    userId: string,
    variationKey: string | null,
    options?: { sdkKey?: string }
  ): Promise<void>;

  /**
   * Create user context for SDK operations
   */
  createUserContext?(
    userId: string,
    attributes: Record<string, any>,
    options?: { sdkKey?: string }
  ): Promise<OptimizelyUserContext>;
}
```

**Implementation**: `/src-v2/services/implementations/DecisionService.ts`

**Responsibilities**:
- SDK client lifecycle management
- Decision caching and optimization
- User context management
- Forced variation handling
- Multi-SDK support (different SDK keys)

### IConfigurationService

Resolves configuration from multiple sources with defined precedence:

```typescript
export interface IConfigurationService {
  /**
   * Initialize configuration from request
   */
  initialize(requestAdapter: IRequestAdapter): Promise<void>;

  /**
   * Get resolved configuration
   */
  getConfig(): OptimizelyConfigOptions;

  /**
   * Get configuration metadata (sources, etc)
   */
  getMetadata(): ConfigMetadata;

  /**
   * Validate configuration
   */
  validate(): ValidationResult;

  // Specific getters for common values
  getSdkKey(): string | null;
  getVisitorId(): string | null;
  getAttributes(): Record<string, any>;
  getDecideOptions(): string[];
}
```

**Implementation**: `/src-v2/services/implementations/ConfigurationService.ts`

**Responsibilities**:
- Parameter extraction from headers, query, body
- Configuration precedence enforcement
- Validation and sanitization
- Metadata tracking for debugging
- Default value management

### IDatafileService

Manages Optimizely datafiles:

```typescript
export interface IDatafileService {
  /**
   * Get datafile for SDK key
   */
  getDatafile(
    sdkKey: string,
    options?: DatafileOptions
  ): Promise<string | null>;

  /**
   * Save datafile to storage
   */
  saveDatafile(
    sdkKey: string,
    datafile: string,
    ttl?: number
  ): Promise<void>;

  /**
   * Get flag keys for SDK
   */
  getFlagKeys(
    sdkKey: string,
    options?: FlagKeysOptions
  ): Promise<string[]>;

  /**
   * Save flag keys
   */
  saveFlagKeys(
    sdkKey: string,
    flagKeys: string[],
    ttl?: number
  ): Promise<void>;
}

interface DatafileOptions {
  useCache?: boolean;
  useKV?: boolean;
  forceRefresh?: boolean;
  requestContext?: any;
}
```

**Implementation**: `/src-v2/services/implementations/DatafileService.ts`

**Responsibilities**:
- Datafile fetching from CDN
- KV storage integration
- Cache management
- Flag key extraction
- TTL management

### ICacheService

Provides in-memory caching capabilities:

```typescript
export interface ICacheService {
  /**
   * Get value from cache
   */
  get<T>(key: string): T | undefined;

  /**
   * Set value in cache
   */
  set<T>(
    key: string, 
    value: T, 
    ttl?: number
  ): void;

  /**
   * Delete from cache
   */
  delete(key: string): boolean;

  /**
   * Clear all cache entries
   */
  clear(): void;

  /**
   * Get cache statistics
   */
  getStats(): CacheStats;
}

interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  evictions: number;
}
```

**Implementation**: `/src-v2/services/implementations/CacheService.ts`

**Responsibilities**:
- LRU cache implementation
- TTL expiration
- Size management
- Cache statistics
- Thread-safe operations

## Service Interaction Patterns

### Request Processing Chain

```
RequestHandler
    │
    ├─→ ConfigurationService.initialize()
    │       └─→ Extract parameters from request
    │
    ├─→ Route Decision (Edge vs Agent)
    │
    ├─→ Agent Mode: ApiRouter
    │       ├─→ DecisionService.decide()
    │       │       ├─→ DatafileService.getDatafile()
    │       │       ├─→ CacheService.get()
    │       │       └─→ SDK Operations
    │       └─→ Response Generation
    │
    └─→ Edge Mode: EdgeModeHandler
            ├─→ DecisionService.decide()
            ├─→ URLMatcher.match()
            └─→ ContentFetcher.fetch()
```

### Caching Strategy

```
┌─────────────────┐
│  Request Cache  │  (L1: Request-scoped)
└────────┬────────┘
         │
┌────────▼────────┐
│ Service Cache   │  (L2: Worker-scoped)
└────────┬────────┘
         │
┌────────▼────────┐
│   KV Storage    │  (L3: Distributed)
└────────┬────────┘
         │
┌────────▼────────┐
│ Origin (CDN)    │  (L4: Source)
└─────────────────┘
```

## Service Lifecycle

### Initialization Phase

```typescript
// 1. Service Creation (in composition root)
const configService = new ConfigurationService(datafileService, logger);

// 2. Service Initialization (per request)
await configService.initialize(requestAdapter);

// 3. Service Usage
const config = configService.getConfig();
```

### Request Scoped Services

Some services maintain request-scoped state:

```typescript
class ConfigurationService {
  private config: OptimizelyConfigOptions = {};
  private metadata: ConfigMetadata = {};
  private isInitialized = false;

  async initialize(requestAdapter: IRequestAdapter): Promise<void> {
    if (this.isInitialized) {
      return; // Prevent re-initialization
    }
    // Extract configuration
    this.isInitialized = true;
  }
}
```

### Singleton Services

Services like CacheService are singletons within a worker:

```typescript
class CacheService {
  private static instance: CacheService;
  private cache: Map<string, CacheEntry> = new Map();

  static getInstance(logger: ILoggerAdapter): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService(logger);
    }
    return CacheService.instance;
  }
}
```

## Error Handling Patterns

### Service-Level Error Handling

```typescript
class DecisionService {
  async decide(
    flagKey: string,
    userContext: OptimizelyUserContext,
    options?: DecideOptions
  ): Promise<OptimizelyDecision> {
    try {
      // Attempt decision
      const client = await this.getOrCreateClient(options?.sdkKey);
      return client.decide(flagKey, userContext);
    } catch (error) {
      // Log error
      this.logger.error('Decision failed', { flagKey, error });
      
      // Return default decision
      return this.createDefaultDecision(flagKey, error);
    }
  }
}
```

### Error Propagation

```
Service Error → Logged → Default Behavior → Response
                  ↓
              Metrics
                  ↓
         Error Response
```

## Service Extension Points

### Custom Service Implementation

```typescript
// Custom cache implementation
class RedisCache implements ICacheService {
  constructor(private redis: RedisClient) {}
  
  async get<T>(key: string): Promise<T | undefined> {
    const value = await this.redis.get(key);
    return value ? JSON.parse(value) : undefined;
  }
  
  // ... other methods
}

// Use in composition root
const cacheService = new RedisCache(redisClient);
```

### Service Decorators

```typescript
// Logging decorator
class LoggingDecisionService implements IDecisionService {
  constructor(
    private inner: IDecisionService,
    private logger: ILoggerAdapter
  ) {}
  
  async decide(...args): Promise<OptimizelyDecision> {
    this.logger.info('Decision requested', args);
    const result = await this.inner.decide(...args);
    this.logger.info('Decision made', result);
    return result;
  }
}
```

### Service Middleware

```typescript
// Timing middleware
class TimingMiddleware {
  constructor(private metrics: IMetricsAdapter) {}
  
  async wrap<T>(
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const timer = this.metrics.startTimer(operation);
    try {
      return await fn();
    } finally {
      timer.stop();
    }
  }
}
```

## Service Configuration

### Environment-Based Configuration

```typescript
interface ServiceConfig {
  cache: {
    defaultTTL: number;
    maxSize: number;
    enableMetrics: boolean;
  };
  decision: {
    enableCaching: boolean;
    cacheSize: number;
    defaultTimeout: number;
  };
  datafile: {
    cdnUrl: string;
    refreshInterval: number;
    enableAutoUpdate: boolean;
  };
}
```

### Dynamic Configuration

```typescript
class ConfigurableService {
  private config: ServiceConfig;
  
  updateConfig(newConfig: Partial<ServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.applyConfiguration();
  }
  
  private applyConfiguration(): void {
    // Apply new configuration
    this.cache.setMaxSize(this.config.cache.maxSize);
    this.cache.setDefaultTTL(this.config.cache.defaultTTL);
  }
}
```

## Testing Services

### Unit Testing

```typescript
describe('DecisionService', () => {
  let service: DecisionService;
  let mockConfig: MockConfigurationService;
  let mockDatafile: MockDatafileService;
  
  beforeEach(() => {
    mockConfig = new MockConfigurationService();
    mockDatafile = new MockDatafileService();
    service = new DecisionService(
      mockConfig,
      mockDatafile,
      new MockLogger(),
      new MockCache()
    );
  });
  
  it('should make decision with caching', async () => {
    // Setup
    mockDatafile.setDatafile('{"version":"4"}');
    
    // Execute
    const decision = await service.decide('flag1', { userId: 'user1' });
    
    // Verify
    expect(decision.enabled).toBe(true);
    expect(mockCache.get).toHaveBeenCalledWith('decision:flag1:user1');
  });
});
```

### Integration Testing

```typescript
describe('Service Integration', () => {
  it('should handle full request flow', async () => {
    // Create real services
    const container = createServiceContainer(testEnv);
    
    // Make request
    const response = await container.requestHandler.handleRequest(
      new MockRequestAdapter({
        method: 'POST',
        path: '/api/decide',
        body: { flagKey: 'test', userId: 'user1' }
      })
    );
    
    // Verify
    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toHaveProperty('enabled');
  });
});
```

## Performance Considerations

### Service Optimization

1. **Lazy Initialization**: Services initialized only when needed
2. **Connection Pooling**: Reuse expensive connections
3. **Batch Operations**: Group multiple operations
4. **Async Processing**: Non-blocking operations
5. **Resource Limits**: Respect platform constraints

### Memory Management

```typescript
class MemoryAwareCache implements ICacheService {
  private memoryLimit: number;
  private currentSize: number = 0;
  
  set<T>(key: string, value: T, ttl?: number): void {
    const size = this.estimateSize(value);
    
    // Evict if necessary
    while (this.currentSize + size > this.memoryLimit) {
      this.evictLRU();
    }
    
    // Add new entry
    super.set(key, value, ttl);
    this.currentSize += size;
  }
}
```

## Service Monitoring

### Health Checks

```typescript
interface IHealthCheckable {
  checkHealth(): Promise<HealthStatus>;
}

class DecisionService implements IHealthCheckable {
  async checkHealth(): Promise<HealthStatus> {
    try {
      // Check datafile availability
      const datafile = await this.datafileService.getDatafile('health-check');
      
      // Check SDK functionality
      const client = await this.createClient(datafile);
      
      return {
        status: 'healthy',
        details: { datafileVersion: datafile.version }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
}
```

### Metrics Collection

```typescript
class MetricsAwareService {
  protected recordOperation(
    operation: string,
    duration: number,
    success: boolean
  ): void {
    this.metrics?.recordHistogram(
      `service.${this.name}.${operation}.duration`,
      duration
    );
    
    this.metrics?.incrementCounter(
      `service.${this.name}.${operation}.${success ? 'success' : 'failure'}`
    );
  }
}
```

## Next Steps

- For adapter patterns: [Adapter Pattern](./adapter-pattern.md)
- For request flow: [Request Lifecycle](./request-lifecycle.md)
- For data flow: [Data Flow](./data-flow.md)
- For deployment: [Deployment Architecture](./deployment-architecture.md)

---

**Implementation References**:
- Service interfaces: `/src-v2/services/interfaces/`
- Service implementations: `/src-v2/services/implementations/`
- Service tests: `/src-v2/tests/services/`

**Related Documentation**:
- [System Overview](./system-overview.md)
- [Composition Root](./composition-root.md)

**Last Updated**: 2025-05-29