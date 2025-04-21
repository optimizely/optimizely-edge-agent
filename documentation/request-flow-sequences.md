# Request Flow Sequences: Optimizely Edge Agent v1 vs. v2

This document illustrates the typical request handling sequences for both Edge Mode (GET requests) and Agent Mode (POST requests) in v1 and v2 architectures.

## v1 Request Flow

### v1 Edge Mode (GET Request)

```mermaid
sequenceDiagram
    participant Client
    participant Platform (CDN)
    participant CoreLogic
    participant ConfigHelpers
    participant OptlyHelpers
    participant CDNAdapter
    participant OptlySDK
    participant KVStore

    Client->>Platform: GET /path
    Platform->>CoreLogic: processRequest(req, env, ctx)
    CoreLogic->>ConfigHelpers: Extract/Merge Config
    ConfigHelpers-->>CoreLogic: requestConfig
    CoreLogic->>CDNAdapter: Initialize
    CDNAdapter-->>CoreLogic: adapterInstance
    CoreLogic->>OptlyHelpers: retrieveDatafile(config)
    OptlyHelpers->>KVStore: Get Cached Datafile?
    KVStore-->>OptlyHelpers: Cached Datafile / Null
    alt No Cache or Expired
        OptlyHelpers->>Platform: Fetch Datafile from Origin/URL
        Platform-->>OptlyHelpers: Fresh Datafile
        OptlyHelpers->>KVStore: Save Datafile
        KVStore-->>OptlyHelpers: OK
    end
    OptlyHelpers-->>CoreLogic: datafile
    CoreLogic->>OptlyHelpers: initializeOptimizely(datafile, config)
    OptlyHelpers->>OptlySDK: createInstance(...)
    OptlySDK-->>OptlyHelpers: optimizelyClient
    OptlyHelpers-->>CoreLogic: optimizelyClient
    CoreLogic->>CoreLogic: Determine Mode (Edge)
    CoreLogic->>OptlyHelpers: findMatchingConfig(url, config)
    OptlyHelpers-->>CoreLogic: cdnVariationSettings / Null
    alt Matching Config Found
        CoreLogic->>CDNAdapter: Check Cache(cacheKey)
        CDNAdapter->>KVStore: Get(cacheKey)
        KVStore-->>CDNAdapter: Cached Response / Null
        alt Cache Hit
            CDNAdapter-->>CoreLogic: Cached Response
            CoreLogic->>Platform: Return Cached Response
        else Cache Miss
            CDNAdapter-->>CoreLogic: Null
            CoreLogic->>CDNAdapter: Fetch Content(originUrl)
            CDNAdapter->>Platform: Fetch(originUrl)
            Platform-->>CDNAdapter: Origin Response
            CoreLogic->>CoreLogic: Transform Content (if needed)
            CoreLogic->>CDNAdapter: Save Cache(cacheKey, response, ttl)
            CDNAdapter->>KVStore: Put(cacheKey, response, ttl)
            KVStore-->>CDNAdapter: OK
            CDNAdapter-->>CoreLogic: OK
            CoreLogic->>Platform: Return Transformed/Origin Response
        end
    else No Matching Config
        CoreLogic->>CDNAdapter: Forward Request to Origin
        CDNAdapter->>Platform: Fetch(originalUrl)
        Platform-->>CDNAdapter: Origin Response
        CDNAdapter-->>CoreLogic: Origin Response
        CoreLogic->>Platform: Return Origin Response
    end
```

### v1 Agent Mode (POST Request)

```mermaid
sequenceDiagram
    participant Client
    participant Platform (CDN)
    participant CoreLogic
    participant ConfigHelpers
    participant OptlyHelpers
    participant OptlySDK

    Client->>Platform: POST /decide (or /track)
    Platform->>CoreLogic: processRequest(req, env, ctx)
    CoreLogic->>ConfigHelpers: Extract/Merge Config & Body
    ConfigHelpers-->>CoreLogic: requestConfig, body
    CoreLogic->>OptlyHelpers: retrieveDatafile(config)
    OptlyHelpers-->>CoreLogic: datafile
    CoreLogic->>OptlyHelpers: initializeOptimizely(datafile, config, body.userId, body.attributes)
    OptlyHelpers->>OptlySDK: createInstance(...)
    OptlySDK-->>OptlyHelpers: optimizelyClient
    OptlyHelpers-->>CoreLogic: optimizelyClient
    CoreLogic->>CoreLogic: Determine Mode (Agent)
    alt Request is /decide
        CoreLogic->>OptlyHelpers: decide(flagKeys, forcedDecisions)
        OptlyHelpers->>OptlySDK: userContext.decide(flagKey)
        OptlySDK-->>OptlyHelpers: decision
        OptlyHelpers-->>CoreLogic: decisions
        CoreLogic->>CoreLogic: Format Response
        CoreLogic->>Platform: Return JSON Response (Decisions)
    else Request is /track
        CoreLogic->>OptlyHelpers: track(eventKey, attributes, eventTags)
        OptlyHelpers->>OptlySDK: userContext.trackEvent(...)
        OptlySDK-->>OptlyHelpers: result
        CoreLogic->>CoreLogic: Format Response (e.g., 204 No Content)
        CoreLogic->>Platform: Return Response
    end
```

## v2 Request Flow

### v2 Edge Mode (GET Request)

```mermaid
sequenceDiagram
    participant Client
    participant PlatformAdapter (IRequest/IResponse/IEnv)
    participant RequestHandler
    participant ConfigService
    participant EdgeModeHandler
    participant DecisionService
    participant CacheService
    participant DatafileService
    participant Logger
    participant Metrics
    participant StorageAdapter (KV)
    participant OptlySDK

    Client->>PlatformAdapter: GET /path
    PlatformAdapter->>RequestHandler: handleRequest(req)
    RequestHandler->>ConfigService: getConfig(req)
    ConfigService->>PlatformAdapter: Get Headers/Query/Body
    PlatformAdapter-->>ConfigService: Request Data
    ConfigService-->>RequestHandler: config
    RequestHandler->>Logger: Log Request Start
    RequestHandler->>Metrics: Increment Request Counter
    RequestHandler->>RequestHandler: Determine Mode (Edge)
    RequestHandler->>EdgeModeHandler: handleEdgeRequest(req, config)
    EdgeModeHandler->>DecisionService: getDecision(userId, flagKey, ...)
    DecisionService->>ConfigService: getDatafile(sdkKey)
    ConfigService->>DatafileService: getDatafile(sdkKey)
    DatafileService->>StorageAdapter: Get Datafile from KV?
    StorageAdapter-->>DatafileService: Cached Datafile / Null
    alt Datafile Cache Miss
        DatafileService->>PlatformAdapter: Fetch Datafile from CDN
        PlatformAdapter-->>DatafileService: Fresh Datafile
        DatafileService->>StorageAdapter: Put Datafile
        StorageAdapter-->>DatafileService: OK
    end
    DatafileService-->>ConfigService: Datafile
    ConfigService-->>DecisionService: Datafile
    DecisionService->>OptlySDK: createInstance / getUserContext
    OptlySDK-->>DecisionService: sdkUserContext
    DecisionService->>OptlySDK: sdkUserContext.decide(...)
    OptlySDK-->>DecisionService: decision
    DecisionService-->>EdgeModeHandler: decision (cdnVariationSettings)
    EdgeModeHandler->>CacheService: getCachedResponse(cacheKey)
    CacheService->>StorageAdapter: Get Response from KV?
    StorageAdapter-->>CacheService: Cached Response / Null
    alt Cache Hit
        CacheService-->>EdgeModeHandler: Cached Response
        EdgeModeHandler-->>RequestHandler: Cached Response
    else Cache Miss
        CacheService-->>EdgeModeHandler: Null
        EdgeModeHandler->>PlatformAdapter: Fetch Content from Origin
        PlatformAdapter-->>EdgeModeHandler: Origin Response
        EdgeModeHandler->>EdgeModeHandler: Transform Content (if needed)
        EdgeModeHandler->>CacheService: setCachedResponse(cacheKey, response, ttl)
        CacheService->>StorageAdapter: Put Response
        StorageAdapter-->>CacheService: OK
        EdgeModeHandler-->>RequestHandler: Transformed/Origin Response
    end
    RequestHandler->>Metrics: Record Duration, Status
    RequestHandler->>PlatformAdapter: formatResponse(response)
    PlatformAdapter-->>Client: HTTP Response
```

### v2 Agent Mode (POST Request)

```mermaid
sequenceDiagram
    participant Client
    participant PlatformAdapter (IRequest/IResponse/IEnv)
    participant RequestHandler
    participant ConfigService
    participant DecisionService
    participant EventService
    participant ApiRouter
    participant Logger
    participant Metrics
    participant OptlySDK

    Client->>PlatformAdapter: POST /decide (or /track, /api/*)
    PlatformAdapter->>RequestHandler: handleRequest(req)
    RequestHandler->>ConfigService: getConfig(req)
    ConfigService-->>RequestHandler: config
    RequestHandler->>Logger: Log Request Start
    RequestHandler->>Metrics: Increment Request Counter
    RequestHandler->>RequestHandler: Determine Mode (Agent/API)
    alt Request is Agent Mode (/decide, /track)
        RequestHandler->>DecisionService: decide / decideAll (userId, attributes, flagKeys)
        DecisionService->>ConfigService: getDatafile(sdkKey)
        ConfigService-->>DecisionService: Datafile
        DecisionService->>OptlySDK: createInstance / getUserContext
        OptlySDK-->>DecisionService: sdkUserContext
        DecisionService->>OptlySDK: sdkUserContext.decide / decideAll
        OptlySDK-->>DecisionService: decisions
        DecisionService-->>RequestHandler: decisions
        RequestHandler->>RequestHandler: Format JSON Response
        RequestHandler->>EventService: trackEvent (if decision event enabled)
        EventService->>PlatformAdapter: waitUntil(logEvent(...))
        PlatformAdapter-->>EventService: OK
    else Request is API Mode (/api/*)
        RequestHandler->>ApiRouter: routeApiRequest(req, config)
        ApiRouter->>ApiRouter: Determine Endpoint Handler
        alt /api/datafile
            ApiRouter->>DatafileService: getDatafile / setDatafile
            DatafileService-->>ApiRouter: result
        else /api/flagkeys
             ApiRouter->>DatafileService: getFlagKeys / setFlagKeys
             DatafileService-->>ApiRouter: result
        else /api/decide (Specific SDK operation)
             ApiRouter->>DecisionService: getDecision / setForcedVariation
             DecisionService-->>ApiRouter: result
        else Other API endpoints
             ApiRouter->>RelevantService: ...
             RelevantService-->>ApiRouter: result
        end
        ApiRouter-->>RequestHandler: API Result / Error
        RequestHandler->>RequestHandler: Format JSON Response
    end
    RequestHandler->>Metrics: Record Duration, Status
    RequestHandler->>PlatformAdapter: formatResponse(response)
    PlatformAdapter-->>Client: HTTP Response
```
