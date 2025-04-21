# v2 Request Handling Sequence Diagram

_Last Updated: 2025-04-18_

The following sequence diagram illustrates the service interactions during request handling in the v2 architecture.

```mermaid
sequenceDiagram
    participant Client
    participant Entry as CDN Entry Point
    participant RH as RequestHandler
    participant RA as RequestAdapter
    participant AR as ApiRouter
    participant DS as DecisionService
    participant ES as EventService
    participant EMH as EdgeModeHandler
    participant CS as CacheService
    participant M as MetricsAdapter
    participant L as LoggerAdapter

    Client->>Entry: HTTP Request
    Entry->>RA: Create RequestAdapter
    Entry->>RH: handleRequest(requestAdapter)
    
    activate RH
    
    %% Request metrics & ID creation
    RH->>RH: Generate requestId
    RH->>M: startTimer('request_duration')
    RH->>M: incrementCounter('requests_total')
    RH->>L: info("Handling request")
    
    %% Request classification
    RH->>RA: getMethod()
    RA-->>RH: "GET" or "POST"
    RH->>RA: getUrl()
    RA-->>RH: url
    
    alt Is pixel tracking request
        RH->>RH: handlePixelTrackingRequest()
        RH->>ES: trackEvent()
    else Is API request
        RH->>RH: Detect API request
        
        alt ApiRouter available
            RH->>AR: routeApiRequest(requestAdapter)
            AR->>AR: Route to appropriate handler
            AR-->>RH: API response
        else ApiRouter not available
            RH->>RH: Create 501 Not Implemented response
        end
    else Standard request processing
        %% Extract user context
        RH->>RH: getVisitorId(requestAdapter)
        RH->>RH: extractAttributes(requestAdapter)
        
        alt method === "POST"
            %% Agent Mode
            RH->>M: incrementCounter('agent_mode_requests')
            RH->>RH: handleAgentModeRequest()
            
            RH->>RA: getPath()
            RA-->>RH: path
            
            alt path is /v1/decide
                RH->>DS: decide(userContext, flagKeys)
                DS-->>RH: decisions
            else path is /v1/decide-all
                RH->>DS: decideAll(userContext)
                DS-->>RH: allDecisions
            else path is /v1/decide-for-keys
                RH->>DS: decideForKeys(userContext, keys)
                DS-->>RH: decisions
            else path is /v1/track
                RH->>ES: trackEvent(userContext, eventKey)
                ES-->>RH: result
            end
            
            RH->>RH: createJsonResponse()
        else method === "GET"
            %% Edge Mode
            RH->>M: incrementCounter('edge_mode_requests')
            RH->>RH: handleEdgeModeRequest()
            
            %% Find matching URL config
            RH->>DS: getAllDecisions(userContext)
            DS-->>RH: decisions
            RH->>RH: findMatchingConfig(url, decisions)
            
            alt matchingConfig found
                alt forwardRequestToOrigin === true
                    RH->>RH: createForwardResponse()
                    
                    %% Check cache first
                    RH->>CS: get(cacheKey)
                    
                    alt Cache hit
                        CS-->>RH: cachedResponse
                    else Cache miss
                        RH->>EMH: forwardToOrigin(requestAdapter, matchingConfig)
                        EMH->>EMH: fetchFromOrigin(request)
                        EMH-->>RH: response
                        
                        alt cacheRequestToOrigin === true
                            RH->>CS: set(cacheKey, response)
                        end
                    end
                else Direct content delivery
                    RH->>RH: createContentResponse()
                    
                    RH->>EMH: prepareContent(settings, userContext, request)
                    EMH->>EMH: fetchContent(cdnResponseURL, request)
                    EMH-->>RH: contentResult
                    
                    alt Has transformation function
                        RH->>EMH: transformContent(content, transformFn)
                        EMH-->>RH: transformedContent
                    end
                end
            else No matching config
                RH->>RH: createErrorResponse(404, "Not Found")
            end
        end
    end
    
    %% Finalize response
    RH->>M: incrementCounter('response_status')
    RH->>M: stopTimer('request_duration')
    
    %% Optional cleanup
    RH->>RH: triggerCleanupIfNeeded()
    
    RH-->>Entry: ResponseResult
    deactivate RH
    
    Entry-->>Client: HTTP Response
```

## Decision Points

The v2 architecture introduces a clear set of decision points:

1. **Initial Request Classification**
   ```typescript
   if (path.endsWith('/track.gif')) {
     // Handle pixel tracking
   } else if (path.startsWith('/api/')) {
     // Route through ApiRouter
   } else {
     // Standard request processing
   }
   ```

2. **Mode Selection**
   ```typescript
   if (method === 'POST') {
     // Agent Mode (SDK operations)
     result = await this.handleAgentModeRequest(requestAdapter, requestId, userContext);
   } else if (method === 'GET') {
     // Edge Mode (content delivery)
     result = await this.handleEdgeModeRequest(requestAdapter, requestId, userContext);
   } else {
     // Unsupported methods
     result = this.createErrorResponse(requestId, 405, 'Method Not Allowed');
   }
   ```

3. **Agent Mode Operation Routing**
   ```typescript
   switch (path) {
     case '/v1/decide':
       // Handle decide
       break;
     case '/v1/decide-all':
       // Handle decideAll
       break;
     case '/v1/decide-for-keys':
       // Handle decideForKeys
       break;
     case '/v1/track':
       // Handle track
       break;
     // ...other operations
   }
   ```

4. **Edge Mode Content Delivery**
   ```typescript
   const matchingConfig = await this.findMatchingConfig(url.toString(), decisions);
   
   if (matchingConfig) {
     if (matchingConfig.forwardRequestToOrigin) {
       // Forward to origin
       return this.createForwardResponse(requestAdapter, requestId, userContext, matchingConfig);
     } else {
       // Direct content delivery
       return this.createContentResponse(requestAdapter, requestId, userContext, matchingConfig);
     }
   } else {
     // No matching configuration
     return this.createErrorResponse(requestId, 404, 'Not Found');
   }
   ```

This layered decision-making structure enables clear separation of concerns and makes the request flow more maintainable.

## Key Benefits of v2 Sequence

1. **Clear Service Boundaries** - Each service is responsible for a specific part of the request processing
2. **Injectable Services** - Any service can be replaced with a mock for testing
3. **Comprehensive Metrics** - Metrics are collected at key points in the request lifecycle
4. **Structured Logging** - Each component logs with its own prefix and structured data
5. **Consistent Error Handling** - Errors are caught at the handler level and processed uniformly