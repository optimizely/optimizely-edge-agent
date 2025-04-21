# v1 Request Handling Sequence Diagram

_Last Updated: 2025-04-18_

The following sequence diagram illustrates the key interactions between components during a typical request in the v1 architecture.

```mermaid
sequenceDiagram
    participant Client
    participant CW as Cloudflare Worker 
    participant CL as CoreLogic
    participant RC as RequestConfig
    participant OP as OptimizelyProvider
    participant CDA as CDN Adapter

    Client->>CW: HTTP Request
    CW->>CL: processRequest(request, env, ctx)
    
    activate CL
    CL->>RC: new RequestConfig(request, env, ctx, cdnAdapter)
    CL->>RC: initialize(request, env)
    
    %% Request classification
    CL->>CL: getIsDecideOperation(pathName)
    Note over CL: Determine operation type
    
    %% Datafile retrieval
    CL->>CL: getVisitorId(request, requestConfig)
    CL->>CDA: getDatafileFromKV(sdkKey, kvStore)
    alt KV miss
        CDA->>CDA: getDatafile(sdkKey, ttl)
    end
    CDA-->>CL: datafile
    
    %% Optimizely initialization
    CL->>OP: initializeOptimizely(datafile, visitorId, ...)
    OP-->>CL: initSuccess
    
    alt isDecideOperation
        CL->>CL: determineFlagsToDecide(requestConfig)
        Note over CL: Process stored decisions & flags
    end
    
    %% SDK operation
    CL->>CL: optimizelyExecute(filteredFlagsToDecide, flagsToForce, requestConfig)
    
    alt POST request
        CL->>OP: Track/Decide based on pathName
    else GET request
        CL->>OP: decide(flagsToDecide, flagsToForce)
    end
    OP-->>CL: SDK results
    
    %% Response formation
    alt isDecideOperation & isGetMethod
        CL->>CL: findMatchingConfig(request.url, optlyResponse, ignoreQueryParams)
        Note over CL: Check cdnVariationSettings for Edge mode
        
        alt cdnExperimentSettings found
            CL->>CL: prepareDecisions(optlyResponse, flagsToForce, validStoredDecisions, requestConfig)
            CL->>CL: prepareFinalResponse(decisions, visitorId, requestConfig, serializedDecisions)
            Note over CL: Prepare Edge mode response
        else No match
            Note over CL: Set reqResponse = "NO_MATCH"
        end
    else isPostMethod or other operations
        CL->>CDA: getNewResponseObject(optlyResponse, 'application/json', true)
        CDA-->>CL: JSON Response
    end
    
    CL-->>CW: Return response package
    deactivate CL
    
    alt Edge mode & cdnExperimentSettings
        CW->>CDA: fetchHandler(request, env, ctx)
        CDA->>CDA: fetchFromOriginOrCDN(request)
        
        alt shouldCacheResponse
            CDA->>CDA: handleFetchFromOrigin(...)
            CDA->>CDA: generateCacheKey(cdnSettings, originUrl)
            CDA->>CDA: fetchFromOriginOrCDN(requestUrl)
            CDA->>CDA: cacheResponse(ctx, cache, cacheKey, response)
        end
        CDA-->>CW: Processed response with headers/cookies
    end
    
    CW-->>Client: HTTP Response
```

## Key Decision Points

1. **Operation Type Classification**
   ```javascript
   const isDecideOperation = !['/v1/config', '/v1/datafile', '/v1/track', '/v1/batch'].includes(pathName);
   ```

2. **Response Path Selection**
   ```javascript
   if (this.shouldReturnJsonResponse(this) && !isDecideOperation) {
     // Datafile or config operation path
   } else if (this.isPostMethod && !isDecideOperation) {
     // POST method without decide operation path
   } else if (this.isDecideOperation) {
     // Decide operation path (Edge or Agent mode)
   }
   ```

3. **Edge Mode Determination**
   ```javascript
   if (this.isGetMethod && isDecideOperation) {
     this.cdnExperimentSettings = await this.findMatchingConfig(
       request.url,
       optlyResponse,
       defaultSettings.urlIgnoreQueryParameters
     );
   }
   ```

## Error Flow

The entire request flow is wrapped in a try/catch block with error handling in the catch:

```javascript
catch (error) {
  this.logger.error('Error processing request:', error.message);
  return {
    reqResponse: await this.cdnAdapter.getNewResponseObject(
      `Internal Server Error: ${error.message}`,
      'text/html',
      false,
      500
    ),
    cdnExperimentSettings: undefined,
    reqResponseObjectType: 'response',
    forwardRequestToOrigin: this.forwardRequestToOrigin,
    errorMessage: error.message,
    isError: true,
  };
}
```

This error handling ensures that failures anywhere in the process will return a properly formatted 500 response to the client.