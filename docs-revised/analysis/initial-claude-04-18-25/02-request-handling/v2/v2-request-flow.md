# v2 Request Handling Flow

_Last Updated: 2025-04-18_

## Overview

The v2 implementation introduces a service-oriented architecture for request handling. At its core is `RequestHandler.ts`, which implements the `IRequestHandler` interface and coordinates a collection of specialized services.

## Entry Point

Request flow begins in the `handleRequest` method which accepts:
- `requestAdapter` - A platform-agnostic wrapper for the incoming request

## Key Components in Request Processing

| Component | Responsibility |
|-----------|---------------|
| **RequestHandler** | Central orchestrator that delegates to specialized services |
| **IRequestAdapter** | Platform-agnostic abstraction of the request |
| **DecisionService** | Handles Optimizely SDK decision operations |
| **EventService** | Manages tracking and conversion events |
| **EdgeModeHandler** | Processes GET requests matched to URL patterns |
| **ApiRouter** | Routes API endpoints to appropriate handlers |
| **CacheService** | Handles caching of responses and content |
| **LoggerAdapter** | Structured logging with component tagging |
| **MetricsAdapter** | Collects operational and performance metrics |

## Service Composition

The RequestHandler is composed with its dependencies via constructor injection:

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
  // Initialization logic
}
```

This pattern allows for clear separation of concerns and facilitates testing by enabling mock service injection.

## Request Flow Stages

1. **Initial Classification**
   - Generate request ID
   - Start metrics timer
   - Determine request type (method, path)

2. **Request Routing**
   - Handle special pixel tracking requests
   - Route API requests through ApiRouter
   - Extract user context (visitor ID, attributes)

3. **Mode Selection**
   - POST → Agent Mode (SDK operations)
   - GET → Edge Mode (content delivery)

4. **Mode-Specific Processing**
   - Agent Mode: Delegate to `handleAgentModeRequest`
   - Edge Mode: Delegate to `handleEdgeModeRequest`

5. **Response Creation**
   - Add standard headers (X-Implementation-Version, X-Request-ID)
   - Stop metrics timer
   - Trigger cleanup if needed

6. **Error Handling**
   - Catch errors at the handler level
   - Log structured error info
   - Track error metrics
   - Return standardized error response

## Agent Mode Processing

Agent Mode handles SDK operations via the DecisionService and EventService:

```typescript
private async handleAgentModeRequest(
  requestAdapter: IRequestAdapter,
  requestId: string,
  userContext: OptimizelyUserContext
): Promise<ResponseResult> {
  // Extract path, body, and config
  // Process decide, decideAll, decideForKeys, track, etc.
  // Return JSON response
}
```

## Edge Mode Processing

Edge Mode integrates with the EdgeModeHandler service for URL-based content delivery:

```typescript
private async handleEdgeModeRequest(
  requestAdapter: IRequestAdapter,
  requestId: string,
  userContext: OptimizelyUserContext
): Promise<ResponseResult> {
  // Find matching configuration
  // If found, either:
  //   - Forward to origin via createForwardResponse
  //   - Serve direct content via createContentResponse
  // If no match, return 404 Not Found
}
```

The EdgeModeHandler itself contains specialized logic for URL matching, content preparation, and transformation.