# Data Flow Architecture

## Overview

The Edge Agent v2 implements a sophisticated data flow architecture that manages data movement through multiple layers, from initial request to final response. This document details how data flows through the system, transformation points, and optimization strategies.

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Data Flow Overview                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Request Data                     Processing                   Response  │
│  ┌──────────┐                  ┌─────────────┐              ┌────────┐ │
│  │ Headers  │ ──┐              │ Transform   │              │ Headers│ │
│  │ Body     │   │              │ Validate    │              │ Body   │ │
│  │ Query    │   ├──Extract────▶│ Enrich      │──Generate───▶│ Status │ │
│  │ Cookies  │   │              │ Decide      │              │ Cache  │ │
│  │ Path     │ ──┘              │ Cache       │              └────────┘ │
│  └──────────┘                  └─────────────┘                         │
│                                                                          │
│  Storage Layer                  Decision Layer              Output Layer │
│  ┌──────────┐                  ┌─────────────┐              ┌────────┐ │
│  │ KV Store │◄─────Read────────│ Optimizely  │              │ Events │ │
│  │ Cache    │                  │ SDK         │──────────────▶│ Metrics│ │
│  │ CDN      │─────Write───────▶│ Rules       │              │ Logs   │ │
│  └──────────┘                  └─────────────┘              └────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Data Categories

### 1. Request Data

#### Headers
```typescript
// From: /src-v2/adapters/interfaces/IRequestAdapter.ts
interface IRequestAdapter {
  getHeader(name: string): string | null;
  getAllHeaders(): Record<string, string>;
}

// Data flow: Headers → Adapter → Services
const sdkKey = requestAdapter.getHeader('X-Optimizely-SDK-Key');
const userId = requestAdapter.getHeader('X-Optimizely-User-Id');
```

#### Query Parameters
```typescript
// From: /src-v2/services/implementations/ConfigurationService.ts
private extractFromQuery(url: URL): Partial<OptimizelyConfig> {
  const params = url.searchParams;
  const config: Partial<OptimizelyConfig> = {};
  
  if (params.has('optimizely_decide')) {
    config.optimizely_decide = params.getAll('optimizely_decide');
  }
  
  return config;
}
```

#### Request Body
```typescript
// From: /src-v2/services/implementations/ApiRouter.ts
async handleDecideRequest(request: IRequestAdapter): Promise<any> {
  const body = await request.getBody();
  const { userId, userAttributes, decideOptions } = JSON.parse(body);
  
  // Data transformation
  const decisions = await this.decisionService.decide({
    userId,
    attributes: userAttributes,
    options: decideOptions
  });
}
```

### 2. Configuration Data

#### Environment Variables
```typescript
// From: /src-v2/adapters/interfaces/IEnvironmentAdapter.ts
interface IEnvironmentAdapter {
  get(key: string): string | undefined;
  getRequired(key: string): string;
}

// Data flow: Environment → Adapter → Configuration
const sdkKey = env.getRequired('OPTIMIZELY_SDK_KEY');
const datafileUrl = env.get('OPTIMIZELY_DATAFILE_URL');
```

#### Merged Configuration
```typescript
// From: /src-v2/services/implementations/ConfigurationService.ts
async getConfiguration(request: IRequestAdapter): Promise<MergedConfig> {
  // Data flows from multiple sources
  const envConfig = this.getEnvironmentConfig();
  const queryConfig = this.extractFromQuery(request.url);
  const headerConfig = this.extractFromHeaders(request);
  const cookieConfig = await this.extractFromCookies(request);
  
  // Merge with precedence
  return this.mergeConfigurations({
    ...envConfig,
    ...cookieConfig,
    ...queryConfig,
    ...headerConfig
  });
}
```

### 3. Decision Data

#### User Context Flow
```typescript
// From: /src-v2/services/implementations/DecisionService.ts
async decide(context: DecisionContext): Promise<OptimizelyDecision> {
  // User data enrichment
  const enrichedContext = {
    ...context,
    attributes: {
      ...context.attributes,
      ...await this.getStoredAttributes(context.userId),
      $opt_request_timestamp: Date.now()
    }
  };
  
  // Decision computation
  const decision = await this.optimizelyClient.decide(
    enrichedContext.userId,
    enrichedContext.flagKey,
    enrichedContext.attributes
  );
  
  // Store decision data
  await this.storeDecision(context.userId, decision);
  
  return decision;
}
```

#### Datafile Flow
```typescript
// From: /src-v2/services/implementations/DatafileService.ts
private async fetchDatafile(sdkKey: string): Promise<any> {
  // Check cache layers
  const cachedDatafile = await this.checkCache(sdkKey);
  if (cachedDatafile) return cachedDatafile;
  
  // Fetch from CDN
  const datafile = await this.contentFetcher.fetch(
    `https://cdn.optimizely.com/datafiles/${sdkKey}.json`
  );
  
  // Store in cache layers
  await this.storeInCache(sdkKey, datafile);
  
  return datafile;
}
```

## Data Transformation Points

### 1. Input Transformation

```typescript
// From: /src-v2/services/utils/extractAttributes.ts
export function extractAttributes(
  headers: Record<string, string>,
  query: URLSearchParams,
  cookies: Record<string, string>
): UserAttributes {
  const attributes: UserAttributes = {};
  
  // Transform header attributes
  Object.entries(headers).forEach(([key, value]) => {
    if (key.toLowerCase().startsWith('x-optimizely-attribute-')) {
      const attrName = key.substring(23);
      attributes[attrName] = parseAttributeValue(value);
    }
  });
  
  // Transform query attributes
  query.forEach((value, key) => {
    if (key.startsWith('optimizely_attribute_')) {
      attributes[key.substring(21)] = parseAttributeValue(value);
    }
  });
  
  return attributes;
}
```

### 2. Decision Transformation

```typescript
// From: /src-v2/services/implementations/DecisionService.ts
private transformDecision(
  sdkDecision: OptimizelyDecision,
  context: DecisionContext
): TransformedDecision {
  return {
    variationKey: sdkDecision.variationKey,
    enabled: sdkDecision.enabled,
    variables: sdkDecision.variables,
    ruleKey: sdkDecision.ruleKey,
    flagKey: context.flagKey,
    userContext: {
      userId: context.userId,
      attributes: context.attributes
    },
    reasons: sdkDecision.reasons,
    timestamp: Date.now()
  };
}
```

### 3. Response Transformation

```typescript
// From: /src-v2/services/implementations/ContentTransformer.ts
async transform(
  content: string,
  decisions: Map<string, OptimizelyDecision>
): Promise<string> {
  let transformedContent = content;
  
  // Replace placeholders with decision values
  decisions.forEach((decision, flagKey) => {
    const placeholder = `{{optimizely:${flagKey}}}`;
    const value = decision.enabled ? decision.variationKey : 'control';
    transformedContent = transformedContent.replace(
      new RegExp(placeholder, 'g'),
      value
    );
  });
  
  return transformedContent;
}
```

## Cache Data Flow

### Multi-Level Cache Strategy

```typescript
// From: /src-v2/services/implementations/CacheManager.ts
class CacheManager implements ICacheManager {
  private cacheHierarchy = [
    { name: 'memory', ttl: 300 },      // 5 minutes
    { name: 'worker', ttl: 3600 },     // 1 hour
    { name: 'kv', ttl: 86400 },        // 24 hours
    { name: 'cdn', ttl: 604800 }       // 7 days
  ];
  
  async get(key: string): Promise<any> {
    // Try each cache level
    for (const cache of this.cacheHierarchy) {
      const value = await this.getFromCache(cache.name, key);
      if (value) {
        // Promote to higher cache levels
        await this.promoteToHigherCaches(cache.name, key, value);
        return value;
      }
    }
    return null;
  }
  
  async set(key: string, value: any): Promise<void> {
    // Write to all cache levels
    await Promise.all(
      this.cacheHierarchy.map(cache => 
        this.setInCache(cache.name, key, value, cache.ttl)
      )
    );
  }
}
```

## Event Data Flow

### Event Collection
```typescript
// From: /src-v2/services/implementations/EventDispatcher.ts
async dispatch(event: OptimizelyEvent): Promise<void> {
  // Enrich event data
  const enrichedEvent = {
    ...event,
    timestamp: Date.now(),
    sessionId: this.getSessionId(),
    environment: this.environment
  };
  
  // Queue for batching
  this.eventQueue.push(enrichedEvent);
  
  // Dispatch when batch is ready
  if (this.shouldDispatch()) {
    await this.dispatchBatch();
  }
}
```

### Metrics Flow
```typescript
// From: /src-v2/adapters/interfaces/IMetricsAdapter.ts
interface IMetricsAdapter {
  increment(metric: string, tags?: Record<string, string>): void;
  gauge(metric: string, value: number, tags?: Record<string, string>): void;
  timing(metric: string, duration: number, tags?: Record<string, string>): void;
}

// Usage in request flow
metricsAdapter.timing('decision.latency', duration, {
  flagKey: decision.flagKey,
  variation: decision.variationKey
});
```

## Data Security

### Sensitive Data Handling

```typescript
// From: /src-v2/services/implementations/ConfigService.ts
private sanitizeConfig(config: any): any {
  const sanitized = { ...config };
  
  // Remove sensitive fields
  delete sanitized.sdkKey;
  delete sanitized.apiKey;
  
  // Mask user IDs in logs
  if (sanitized.userId) {
    sanitized.userId = this.maskUserId(sanitized.userId);
  }
  
  return sanitized;
}
```

### Data Validation

```typescript
// From: /src-v2/services/implementations/DatafileService.ts
private validateDatafile(datafile: any): boolean {
  // Schema validation
  if (!datafile.version || !datafile.projectId) {
    return false;
  }
  
  // Signature verification
  if (this.config.validateSignature) {
    return this.verifySignature(datafile);
  }
  
  return true;
}
```

## Performance Optimizations

### Data Streaming
```typescript
// From: /src-v2/services/implementations/ContentFetcher.ts
async fetchStream(url: string): Promise<ReadableStream> {
  const response = await fetch(url);
  
  // Stream transformation
  return response.body.pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        // Process chunk without loading entire response
        const processed = this.processChunk(chunk);
        controller.enqueue(processed);
      }
    })
  );
}
```

### Lazy Loading
```typescript
// From: /src-v2/services/implementations/DatafileService.ts
private datafileCache = new Map<string, Promise<any>>();

async getDatafile(sdkKey: string): Promise<any> {
  // Return existing promise if already fetching
  if (this.datafileCache.has(sdkKey)) {
    return this.datafileCache.get(sdkKey);
  }
  
  // Create new fetch promise
  const fetchPromise = this.fetchDatafile(sdkKey);
  this.datafileCache.set(sdkKey, fetchPromise);
  
  return fetchPromise;
}
```

## Data Flow Monitoring

### Flow Tracing
```typescript
// From: /src-v2/services/implementations/RequestHandler.ts
async handleRequest(request: IRequestAdapter): Promise<IResponseAdapter> {
  const traceId = this.generateTraceId();
  
  // Inject trace ID into data flow
  this.logger.info('Request started', { traceId });
  
  try {
    // Track data through each stage
    const config = await this.trackStage('config', traceId, 
      () => this.configService.getConfiguration(request)
    );
    
    const decision = await this.trackStage('decision', traceId,
      () => this.decisionService.decide(config)
    );
    
    const response = await this.trackStage('response', traceId,
      () => this.buildResponse(decision)
    );
    
    return response;
  } finally {
    this.logger.info('Request completed', { traceId });
  }
}
```

## Best Practices

### 1. Data Minimization
- Only collect necessary data
- Remove unused attributes before processing
- Compress large payloads

### 2. Flow Control
- Implement backpressure for streaming
- Use circuit breakers for external calls
- Queue events for batch processing

### 3. Data Consistency
- Use versioning for cache keys
- Implement cache invalidation strategies
- Maintain data integrity across layers

## See Also

- [Request Lifecycle](./request-lifecycle.md) - Complete request processing flow
- [Service Architecture](./service-architecture.md) - Service data contracts
- [Cache Strategy](/docs-sot/configuration/cache-strategy.md) - Caching implementation details
- [Security](/docs-sot/security/data-security.md) - Data security practices

## Implementation References

- `/src-v2/services/implementations/DatafileService.ts` - Datafile management
- `/src-v2/services/implementations/CacheManager.ts` - Cache hierarchy
- `/src-v2/services/implementations/EventDispatcher.ts` - Event flow
- `/src-v2/services/utils/extractAttributes.ts` - Data extraction utilities