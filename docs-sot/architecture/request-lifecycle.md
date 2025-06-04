# Request Lifecycle

This document details the complete lifecycle of a request through the Optimizely Edge Agent v2, from initial receipt to final response. Understanding this flow is crucial for debugging, performance optimization, and extending the system.

## Request Flow Overview

```
┌─────────────────┐
│ Incoming Request│
└────────┬────────┘
         │
    ┌────▼────┐
    │Platform │     ┌──────────────────┐
    │ Entry   │────▶│ Error Boundary   │
    │ Point   │     │ (try/catch)      │
    └────┬────┘     └──────────────────┘
         │
┌────────▼────────┐
│ Adapter Creation│
│ - Request       │
│ - Response      │
│ - Environment   │
└────────┬────────┘
         │
┌────────▼────────┐
│Service Creation │
│(Composition Root)│
└────────┬────────┘
         │
┌────────▼────────┐
│ RequestHandler  │
│  Entry Point    │
└────────┬────────┘
         │
┌────────▼────────┐     ┌─────────────┐
│ Configuration   │────▶│ Validation  │
│ Initialization  │     │ & Defaults  │
└────────┬────────┘     └─────────────┘
         │
┌────────▼────────┐
│ Route Decision  │
│ Edge vs Agent   │
└───┬─────────┬───┘
    │         │
    │    ┌────▼────┐
    │    │ Agent   │
    │    │ Mode    │
    │    └────┬────┘
    │         │
┌───▼───┐ ┌──▼───┐
│ Edge  │ │ API  │
│ Mode  │ │Router│
└───┬───┘ └──┬───┘
    │        │
┌───▼────────▼───┐
│Response Creation│
└────────┬────────┘
         │
┌────────▼────────┐
│Platform Response│
└─────────────────┘
```

## Detailed Request Phases

### Phase 1: Platform Entry

Each platform has its own entry point:

#### Cloudflare Workers

```typescript
// index.ts
export default {
  async fetch(
    request: Request,
    env: CloudflareEnvironment,
    ctx: ExecutionContext
  ): Promise<Response> {
    return handleRequest(request, env, ctx);
  }
};
```

#### Fastly Compute@Edge

```typescript
// index.ts
addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request, fastlyEnv));
});
```

#### Vercel Edge Functions

```typescript
// index.ts
export default async function handler(
  request: Request,
  context: RequestContext
): Promise<Response> {
  return handleRequest(request, vercelEnv, context);
}
```

### Phase 2: Error Boundary

All requests are wrapped in error handling:

```typescript
async function handleRequest(
  request: Request,
  env: Environment,
  ctx: Context
): Promise<Response> {
  const requestId = generateRequestId();
  
  try {
    // Main request processing
    return await processRequest(request, env, ctx, requestId);
  } catch (error) {
    // Global error handler
    return handleError(error, requestId);
  }
}

function handleError(error: unknown, requestId: string): Response {
  const logger = new ConsoleLoggerAdapter();
  logger.error(`Request ${requestId} failed`, error);
  
  return new Response(
    JSON.stringify({
      error: 'Internal Server Error',
      requestId,
      timestamp: new Date().toISOString()
    }),
    {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId
      }
    }
  );
}
```

### Phase 3: Adapter Creation

Platform-specific implementations are wrapped in adapters:

```typescript
async function processRequest(
  request: Request,
  env: Environment,
  ctx: Context,
  requestId: string
): Promise<Response> {
  // Create platform adapters
  const requestAdapter = AdapterFactory.createRequestAdapter(request, ctx);
  const responseAdapter = AdapterFactory.createResponseAdapter();
  const environmentAdapter = AdapterFactory.createEnvironmentAdapter(env);
  const loggerAdapter = new CloudflareLoggerAdapter(
    env.LOG_LEVEL || 'info',
    { requestId }
  );
  
  // Log request details
  loggerAdapter.info('Request received', {
    method: requestAdapter.getMethod(),
    url: requestAdapter.getUrl().toString(),
    headers: Object.fromEntries(requestAdapter.getHeaders())
  });
  
  // Continue processing...
}
```

### Phase 4: Service Composition

Services are created and wired together:

```typescript
// In compositionRoot.ts
const services = await createServices(
  requestAdapter,
  responseAdapter,
  environmentAdapter,
  loggerAdapter,
  requestId
);

async function createServices(...): Promise<ServiceContainer> {
  // Create core services
  const cacheService = new CacheService(loggerAdapter);
  const datafileService = new DatafileService(
    environmentAdapter,
    loggerAdapter,
    cacheService,
    storageAdapter
  );
  const configService = new ConfigurationService(
    datafileService,
    loggerAdapter
  );
  
  // Create request handler with all dependencies
  return new RequestHandler(
    decisionService,
    eventService,
    loggerAdapter,
    cacheService,
    edgeModeIntegration,
    metricsAdapter,
    cookieService,
    flagStorageService,
    configService,
    apiRouter
  );
}
```

### Phase 5: Request Handler Entry

The RequestHandler orchestrates the request:

```typescript
// RequestHandler.handleRequest()
async handleRequest(
  requestAdapter: IRequestAdapter
): Promise<ResponseResult> {
  const requestTimer = this.metrics?.startTimer('request_duration');
  
  try {
    // Initialize configuration from request
    await this.configurationService.initialize(requestAdapter);
    
    // Get request details
    const method = requestAdapter.getMethod();
    const url = requestAdapter.getUrl();
    const path = url.pathname;
    
    // Log request
    this.logger.info('Processing request', {
      method,
      path,
      query: Object.fromEntries(url.searchParams)
    });
    
    // Continue to routing...
  } finally {
    requestTimer?.stop();
  }
}
```

### Phase 6: Configuration Resolution

Configuration is extracted from multiple sources:

```typescript
// ConfigurationService.initialize()
async initialize(requestAdapter: IRequestAdapter): Promise<void> {
  // Extract from headers (highest priority)
  this.extractFromHeaders(requestAdapter);
  
  // Extract from query parameters
  this.extractFromQuery(requestAdapter.getUrl());
  
  // Extract from body (lowest priority)
  const body = await requestAdapter.getBody();
  if (body) {
    this.extractFromBody(body);
  }
  
  // Apply defaults
  this.applyDefaults();
  
  // Validate configuration
  const validation = this.validate();
  if (!validation.isValid) {
    throw new ConfigurationError(validation.errors);
  }
}
```

Parameter precedence: Headers → Query → Body → Defaults

### Phase 7: Route Decision

Determine Edge Mode vs Agent Mode:

```typescript
// RequestHandler routing logic
private async routeRequest(
  requestAdapter: IRequestAdapter
): Promise<ResponseResult> {
  const path = requestAdapter.getUrl().pathname;
  const method = requestAdapter.getMethod();
  
  // Check if FEX is enabled
  if (!this.configurationService.getEnableFex()) {
    return this.createBypassResponse();
  }
  
  // API paths always use Agent Mode
  if (path.startsWith('/api/')) {
    return this.handleAgentMode(requestAdapter);
  }
  
  // POST to non-API = Agent Mode
  if (method === 'POST' && !path.startsWith('/api/')) {
    return this.createErrorResponse(
      'POST requests to non-API paths are not supported'
    );
  }
  
  // GET to non-API = Edge Mode
  return this.handleEdgeMode(requestAdapter);
}
```

### Phase 8A: Agent Mode Processing

API requests are routed through ApiRouter:

```typescript
private async handleAgentMode(
  requestAdapter: IRequestAdapter
): Promise<ResponseResult> {
  if (!this.apiRouter) {
    return this.createErrorResponse(
      'API mode not available - Decision service not configured'
    );
  }
  
  // ApiRouter handles all /api/* endpoints
  return this.apiRouter.handleRequest(requestAdapter);
}

// In ApiRouter
async handleRequest(
  requestAdapter: IRequestAdapter
): Promise<ResponseResult> {
  const path = requestAdapter.getUrl().pathname;
  
  // Route to specific handler
  if (path.endsWith('/api/decide')) {
    return this.handleDecideRequest(requestAdapter);
  } else if (path.endsWith('/api/datafile')) {
    return this.handleDatafileRequest(requestAdapter);
  } else if (path.endsWith('/api/forced-variation')) {
    return this.handleForcedVariationRequest(requestAdapter);
  }
  // ... more endpoints
  
  return this.createNotFoundResponse();
}
```

### Phase 8B: Edge Mode Processing

Content delivery with experimentation:

```typescript
private async handleEdgeMode(
  requestAdapter: IRequestAdapter
): Promise<ResponseResult> {
  if (!this.edgeModeIntegration) {
    // No Edge Mode configured, pass through
    return this.createPassthroughResponse();
  }
  
  // Get user context from cookies
  const userContext = await this.getUserContext(requestAdapter);
  
  // Process through Edge Mode pipeline
  return this.edgeModeIntegration.processRequest(
    requestAdapter,
    userContext
  );
}

// In EdgeModeIntegration
async processRequest(
  requestAdapter: IRequestAdapter,
  userContext: UserContext
): Promise<ResponseResult> {
  // 1. Check if request should be handled
  const shouldHandle = await this.shouldHandleRequest(
    requestAdapter,
    userContext
  );
  
  if (!shouldHandle) {
    return this.createPassthroughResponse();
  }
  
  // 2. Get variation assignment
  const decision = await this.getDecision(userContext);
  
  // 3. Match URL patterns
  const matchResult = await this.matchUrl(
    requestAdapter.getUrl(),
    decision.variables
  );
  
  // 4. Fetch and transform content
  const content = await this.fetchContent(matchResult.url);
  const transformed = await this.transformContent(
    content,
    decision,
    matchResult
  );
  
  // 5. Create response with headers/cookies
  return this.createEdgeResponse(transformed, decision);
}
```

### Phase 9: Response Creation

Build the final response:

```typescript
private createResponse(
  status: number,
  body: any,
  options?: ResponseOptions
): ResponseResult {
  // Serialize body if needed
  const serializedBody = typeof body === 'string' 
    ? body 
    : JSON.stringify(body);
  
  // Build headers
  const headers: Record<string, string> = {
    'Content-Type': options?.contentType || 'application/json',
    'X-Request-ID': this.requestId,
    'X-Implementation-Version': 'v2',
    ...options?.headers
  };
  
  // Add debug headers if enabled
  if (this.configurationService.getEnableDebugHeaders()) {
    headers['X-Debug-Config'] = JSON.stringify(
      this.configurationService.getMetadata()
    );
  }
  
  // Add cookies
  if (options?.cookies) {
    headers['Set-Cookie'] = this.cookieService.serialize(
      options.cookies
    );
  }
  
  return {
    status,
    body: serializedBody,
    headers
  };
}
```

### Phase 10: Platform Response

Convert to platform-specific response:

```typescript
// Back in platform entry point
const result = await requestHandler.handleRequest(requestAdapter);

// Convert to platform response
return new Response(result.body, {
  status: result.status,
  headers: result.headers
});
```

## Request Timing Breakdown

Typical request timing for different scenarios:

### API Decision Request (~50-100ms)
```
Platform Entry       ├─ 1ms
Adapter Creation     ├─ 2ms
Service Creation     ├─ 5ms
Config Resolution    ├─ 3ms
Route Decision       ├─ 1ms
SDK Initialization   ├─ 20ms (cached: 2ms)
Decision Calculation ├─ 10ms
Response Creation    ├─ 2ms
Platform Response    └─ 1ms
```

### Edge Mode Request (~100-200ms)
```
Platform Entry       ├─ 1ms
Adapter Creation     ├─ 2ms
Service Creation     ├─ 5ms
Config Resolution    ├─ 3ms
Route Decision       ├─ 1ms
Decision Lookup      ├─ 15ms
URL Matching         ├─ 5ms
Content Fetch        ├─ 50-150ms
Content Transform    ├─ 10ms
Response Creation    ├─ 3ms
Platform Response    └─ 1ms
```

## Error Handling Throughout Lifecycle

Errors are handled at multiple levels:

### Service-Level Errors
```typescript
// In DecisionService
try {
  const client = await this.getClient(sdkKey);
  return await client.decide(flagKey, userContext);
} catch (error) {
  this.logger.error('Decision failed', error);
  return this.createDefaultDecision(flagKey);
}
```

### Request-Level Errors
```typescript
// In RequestHandler
try {
  return await this.processRequest(requestAdapter);
} catch (error) {
  if (error instanceof ConfigurationError) {
    return this.createErrorResponse(400, error.message);
  }
  throw error; // Re-throw to global handler
}
```

### Global Error Handler
```typescript
// At platform entry
catch (error) {
  // Log error with context
  logger.error('Unhandled error', {
    error,
    request: {
      method: request.method,
      url: request.url,
      headers: Object.fromEntries(request.headers)
    }
  });
  
  // Return safe error response
  return new Response('Internal Server Error', { 
    status: 500 
  });
}
```

## Performance Optimizations

### 1. Service Caching
Services are created once per request and reused:

```typescript
class ServiceContainer {
  private services = new Map<string, any>();
  
  getService<T>(key: string, factory: () => T): T {
    if (!this.services.has(key)) {
      this.services.set(key, factory());
    }
    return this.services.get(key);
  }
}
```

### 2. Lazy Initialization
Services initialized only when needed:

```typescript
private _decisionService?: IDecisionService;
get decisionService(): IDecisionService {
  if (!this._decisionService) {
    this._decisionService = this.createDecisionService();
  }
  return this._decisionService;
}
```

### 3. Request Batching
Multiple operations batched when possible:

```typescript
// Parallel configuration extraction
const [headers, query, body] = await Promise.all([
  this.extractHeaders(request),
  this.extractQuery(request.url),
  this.extractBody(request)
]);
```

### 4. Early Termination
Exit early when possible:

```typescript
// Skip processing if FEX disabled
if (!config.enableFex) {
  return createBypassResponse();
}

// Skip Edge Mode if no integration
if (!edgeModeIntegration) {
  return createPassthroughResponse();
}
```

## Monitoring Request Lifecycle

### Request Tracing

```typescript
class RequestTracer {
  private spans: TraceSpan[] = [];
  
  startSpan(name: string): TraceSpan {
    const span = {
      name,
      startTime: Date.now(),
      endTime: 0,
      duration: 0
    };
    this.spans.push(span);
    return span;
  }
  
  endSpan(span: TraceSpan): void {
    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
  }
  
  getTrace(): RequestTrace {
    return {
      requestId: this.requestId,
      totalDuration: this.getTotalDuration(),
      spans: this.spans
    };
  }
}
```

### Metrics Collection

Key metrics collected throughout lifecycle:

- Request count by endpoint
- Request duration by phase
- Error rates by type
- Cache hit rates
- SDK initialization time
- Decision calculation time
- Content fetch duration

## Debugging Request Issues

### Enable Debug Mode

```http
X-Optimizely-Enable-Debug-Headers: true
```

Response includes:
```json
{
  "result": "...",
  "_debug": {
    "requestId": "uuid",
    "config": {
      "sdkKey": "***",
      "visitorId": "user123",
      "source": "header"
    },
    "timing": {
      "total": 85,
      "phases": {
        "config": 3,
        "decision": 45,
        "response": 2
      }
    }
  }
}
```

### Request ID Tracking

Every request gets a unique ID:
```typescript
const requestId = uuidv4();
logger.child({ requestId });
```

Use for tracing through logs:
```
grep "request-id-here" logs.txt
```

## Next Steps

- For data flow details: [Data Flow](./data-flow.md)
- For deployment specifics: [Deployment Architecture](./deployment-architecture.md)
- For service details: [Service Architecture](./service-architecture.md)
- For troubleshooting: [Troubleshooting Guide](../troubleshooting/)

---

**Implementation References**:
- Request handler: `/src-v2/services/implementations/RequestHandler.ts`
- API router: `/src-v2/services/implementations/ApiRouter.ts`
- Edge mode: `/src-v2/services/implementations/EdgeModeIntegration.ts`
- Platform entries: `/src-v2/index.ts`, `/src-v2/composition/`

**Related Documentation**:
- [System Overview](./system-overview.md)
- [Composition Root](./composition-root.md)
- [Adapter Pattern](./adapter-pattern.md)

**Last Updated**: 2025-05-29