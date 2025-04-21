# v2 Service Interactions

_Last Updated: 2025-04-18_

## Overview

The v2 implementation introduces a comprehensive service-oriented architecture where specialized services interact to process requests. This document analyzes the service composition and interaction patterns throughout the request handling flow.

## Service Composition

The `RequestHandler` serves as the central orchestrator, composed with a collection of specialized services via constructor injection:

```typescript
constructor(
  decisionService: IDecisionService,
  eventService: IEventService,
  logger: ILoggerAdapter,
  cacheService: ICacheService,
  edgeModeIntegration?: IEdgeModeIntegration,
  metrics?: IMetricsAdapter,
  cookieService?: ICookieService,
  flagStorage?: IFlagStorageService,
  configurationService?: IConfigurationService,
  cleanupConfig?: {
    triggerIntervalMs?: number;
    triggerProbability?: number;
    requestTriggeringEnabled?: boolean;
  },
  apiRouter?: ApiRouter
) {
  // Service initialization
}
```

This composition pattern offers several key benefits:
1. **Dependency Inversion**: The `RequestHandler` depends on abstractions (interfaces) rather than concrete implementations
2. **Testability**: Services can be easily mocked for unit testing
3. **Flexibility**: Services can be replaced or modified without changing the `RequestHandler`
4. **Feature Discovery**: Optional services can be discovered and used when available

## Core Services and Their Interfaces

| Service | Interface | Responsibility |
|---------|-----------|----------------|
| **DecisionService** | `IDecisionService` | Handles Optimizely SDK feature flag decisions and user context management |
| **EventService** | `IEventService` | Manages tracking events for conversions, impressions, and analytics |
| **CacheService** | `ICacheService` | Provides caching operations for responses, content, and decisions |
| **EdgeModeHandler** | `IEdgeModeHandler` | Processes URL-based content delivery and transformations |
| **LoggerAdapter** | `ILoggerAdapter` | Structured logging with component tagging and context |
| **MetricsAdapter** | `IMetricsAdapter` | Collects performance and operational metrics |
| **CookieService** | `ICookieService` | Manages cookie operations, persistence, and retrieval |
| **FlagStorageService** | `IFlagStorageService` | KV operations specific to feature flag decision persistence |
| **ConfigurationService** | `IConfigurationService` | Extracts, validates and manages configuration values |
| **ApiRouter** | `IApiRouter` | Routes API requests to the appropriate handlers |

## Service Communication Patterns

### 1. Request-Response Interaction

The primary interaction pattern is request-response, where the `RequestHandler` calls a service method and receives a response:

```typescript
// Decision Service interaction
const decisions = await this.decisionService.decide(userContext, flagKey, options);

// Event Service interaction
await this.eventService.trackEvent(userContext, eventKey, eventTags);

// Cache Service interaction
const cachedContent = await this.cacheService.get(cacheKey);
if (!cachedContent) {
  // Fetch content
  await this.cacheService.set(cacheKey, content, ttl);
}
```

This pattern maintains clear service boundaries and simplifies the reasoning about control flow.

### 2. Factory-Based Instantiation

Services are typically instantiated by factory functions in the composition root:

```typescript
// In compositionRoot.ts
function createRequestHandler(env, adapters) {
  const logger = createLoggerAdapter(env, adapters);
  const metrics = createMetricsAdapter(env, adapters);
  const decisionService = createDecisionService(env, adapters, logger, metrics);
  const eventService = createEventService(env, adapters, logger, metrics);
  // ...other services

  return new RequestHandler(
    decisionService,
    eventService,
    logger,
    cacheService,
    edgeModeIntegration,
    metrics,
    // ...other services
  );
}
```

This factory pattern ensures services are initialized with their required dependencies.

### 3. Adapter-Based Platform Abstraction

Platform-specific operations are abstracted through adapter interfaces:

```typescript
// Request handling with adapters
async handleRequest(requestAdapter: IRequestAdapter): Promise<ResponseResult> {
  // Use adapter methods instead of platform-specific code
  const method = requestAdapter.getMethod();
  const url = requestAdapter.getUrl();
  const headers = requestAdapter.getHeaders();
  
  // Platform-agnostic processing
}
```

This adapter pattern enables the service layer to remain platform-agnostic.

## Service Interaction Flow Stages

### 1. Request Initialization and Classification

```typescript
// Start with metrics and logging
const requestTimer = this.metrics?.startTimer('request_duration', {...});
this.metrics?.incrementCounter('requests_total', 1, {...});
this.logger.info(`Handling ${method} request ${requestId}...`);

// Request classification
if (path.endsWith('/track.gif')) {
  // Pixel tracking flow
} else if (path.startsWith('/api/')) {
  // API request flow
} else {
  // Standard request flow
}
```

### 2. User Context Extraction

```typescript
// Extract user context using multiple services
const userId = await this.getVisitorId(requestAdapter);
const userContext: OptimizelyUserContext = {
  userId,
  attributes: await this.extractAttributes(requestAdapter),
};
```

### 3. Mode-Specific Processing

The flow branches based on HTTP method:

```typescript
if (method === 'POST') {
  // Agent Mode (SDK operations)
  result = await this.handleAgentModeRequest(requestAdapter, requestId, userContext);
  this.metrics?.incrementCounter('agent_mode_requests', 1);
} else if (method === 'GET') {
  // Edge Mode (content delivery)
  result = await this.handleEdgeModeRequest(requestAdapter, requestId, userContext);
  this.metrics?.incrementCounter('edge_mode_requests', 1);
}
```

### 4. Agent Mode Service Interactions

```typescript
// Inside handleAgentModeRequest
private async handleAgentModeRequest(
  requestAdapter: IRequestAdapter,
  requestId: string,
  userContext: OptimizelyUserContext
): Promise<ResponseResult> {
  // Extract operation from path
  const path = requestAdapter.getUrl().pathname;
  
  // Get configuration
  const config = await this.getRequestConfig(requestAdapter);
  
  // Process based on operation
  switch(path) {
    case '/v1/decide':
      // Decision Service interaction
      const flagKey = requestAdapter.getBody().flagKey;
      const options = requestAdapter.getBody().options || [];
      const decision = await this.decisionService.decide(userContext, flagKey, options);
      return this.createJsonResponse(requestId, 200, { decisions: [decision] }, userContext);
      
    case '/v1/decide-all':
      // Decision Service interaction for all flags
      const allDecisions = await this.decisionService.decideAll(userContext, options);
      return this.createJsonResponse(requestId, 200, { decisions: allDecisions }, userContext);
      
    case '/v1/track':
      // Event Service interaction
      const eventKey = requestAdapter.getBody().eventKey;
      const eventTags = requestAdapter.getBody().eventTags || {};
      await this.eventService.trackEvent(userContext, eventKey, eventTags);
      return this.createJsonResponse(requestId, 200, { tracked: true }, userContext);
      
    // Other operations...
  }
}
```

### 5. Edge Mode Service Interactions

```typescript
// Inside handleEdgeModeRequest
private async handleEdgeModeRequest(
  requestAdapter: IRequestAdapter,
  requestId: string,
  userContext: OptimizelyUserContext
): Promise<ResponseResult> {
  // 1. Decision Service interaction
  const decisions = await this.decisionService.getAllDecisions(userContext);
  
  // 2. URL Matching interaction
  const matchingConfig = await this.findMatchingConfig(url.toString(), decisions);
  
  if (matchingConfig) {
    if (matchingConfig.forwardRequestToOrigin === 'true') {
      // 3. Content Forwarding interaction
      return await this.createForwardResponse(
        requestAdapter, 
        requestId, 
        userContext, 
        matchingConfig
      );
    } else {
      // 4. Direct Content interaction
      return await this.createContentResponse(
        requestAdapter, 
        requestId, 
        userContext, 
        matchingConfig
      );
    }
  }
  
  // No match found
  return this.createErrorResponse(requestId, 404, 'Not Found');
}
```

### 6. Edge Mode Content Delivery

```typescript
// Inside createContentResponse
private async createContentResponse(
  requestAdapter: IRequestAdapter,
  requestId: string,
  userContext: OptimizelyUserContext,
  matchingConfig: Record<string, any>
): Promise<ResponseResult> {
  // 1. Cache Service interaction
  const cacheKey = this.generateCacheKey(matchingConfig, userContext);
  const cachedContent = await this.cacheService.get(cacheKey);
  
  if (cachedContent) {
    // Use cached content
    this.metrics?.incrementCounter('cache_hit', 1, { type: 'content' });
  } else {
    // 2. Edge Mode Handler interaction
    const content = await this.edgeModeIntegration.fetchContent(
      matchingConfig.cdnResponseURL,
      requestAdapter
    );
    
    // 3. Content Transformation (if needed)
    if (matchingConfig.transformContent) {
      content = await this.edgeModeIntegration.transformContent(
        content,
        matchingConfig.transformContent
      );
    }
    
    // 4. Cache the content
    if (parseInt(matchingConfig.cacheTTL) > 0) {
      await this.cacheService.set(cacheKey, content, parseInt(matchingConfig.cacheTTL));
    }
  }
  
  // 5. Cookie Service interaction
  const responseHeaders = this.createResponseHeaders(userContext, decisions, matchingConfig);
  if (this.cookieService) {
    this.cookieService.addDecisionsToCookies(userContext, decisions, responseHeaders);
  }
  
  return { status: 200, body: content, headers: responseHeaders };
}
```

### 7. API Request Routing

```typescript
// Inside handleRequest for API paths
if (path.startsWith('/api/')) {
  if (this.apiRouter) {
    try {
      // ApiRouter interaction
      const result = await this.apiRouter.routeApiRequest(requestAdapter);
      result.headers['X-Request-ID'] = requestId;
      return result;
    } catch (error) {
      this.logger.error(`Error calling ApiRouter`, error);
      this.metrics?.incrementCounter('api_errors_total', 1, {...});
      return { status: 500, body: JSON.stringify({ error: '...' }), ... };
    }
  }
}
```

## Inter-Service Context Passing

Context is passed between services in several ways:

1. **UserContext Object**: Contains visitor ID and attributes
   ```typescript
   interface OptimizelyUserContext {
     userId: string;
     attributes: Record<string, any>;
   }
   ```

2. **Request ID**: Used for tracking operations across services
   ```typescript
   const requestId = uuidv4();
   // Passed to all handler methods and included in responses
   ```

3. **Configuration**: Shared configuration passed to multiple services
   ```typescript
   const config = await this.getRequestConfig(requestAdapter);
   // Passed to decision service, event service, etc.
   ```

4. **Response Headers**: Accumulate information from multiple services
   ```typescript
   const responseHeaders = this.createResponseHeaders(userContext, decisions, config);
   this.addDecisionHeadersToResponse(decisions, config, responseHeaders);
   this.addCacheControlHeaders(config, responseHeaders);
   this.addCustomHeadersFromConfig(config, responseHeaders);
   if (this.cookieService) {
     this.addCookiesToResponse(userContext, decisions, config, responseHeaders);
   }
   ```

## Comparison with v1

| Aspect | v1 Implementation | v2 Implementation |
|--------|-------------------|-------------------|
| **Architecture** | Monolithic CoreLogic class | Service-oriented with interfaces |
| **Service Boundaries** | Blurred, tightly coupled | Clear, well-defined interfaces |
| **Dependency Management** | Direct instantiation | Constructor injection |
| **Platform Integration** | Direct adapter usage | Adapter interfaces |
| **Error Handling** | Per-method, inconsistent | Service-level with metrics |
| **Testability** | Limited due to coupling | Highly testable with interfaces |
| **Extensibility** | Requires CoreLogic changes | Add new service implementations |

## Key Benefits of v2 Service Architecture

1. **Separation of Concerns**: Each service has a single responsibility
2. **Interface-Based Design**: Services depend on abstractions, not implementations
3. **Improved Testability**: Services can be tested in isolation
4. **Flexible Configuration**: Optional services can be conditionally included
5. **Enhanced Observability**: Each service reports metrics and logs consistently
6. **Clear Error Boundaries**: Services handle and report errors at their boundaries

The v2 service-oriented architecture represents a significant improvement in code organization, maintainability, and extensibility compared to v1's monolithic approach.