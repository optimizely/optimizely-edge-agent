# Component Relationship Diagrams

_Last Updated: 2025-04-18_

## v1 – Monolithic Structure

```mermaid
classDiagram
    class CoreLogic {
        +processRequest()
        +optimizelyExecute()
        +prepareFinalResponse()
    }
    CoreLogic --> RequestConfig
    CoreLogic --> OptimizelyProvider
    CoreLogic --> CDNAdapter
    CoreLogic --> EventListeners

    class RequestConfig
    class OptimizelyProvider
    class CDNAdapter
    class EventListeners
```

## v2 – Service‑Oriented Structure

```mermaid
classDiagram
    class CompositionRoot {
        +composeApplication()
    }
    CompositionRoot --> IRequestHandler
    CompositionRoot --> IEnvironmentAdapter
    CompositionRoot --> ILoggerAdapter
    CompositionRoot --> IStorageAdapter

    class RequestHandler {
        +handle()
    }
    RequestHandler --> DecisionService
    RequestHandler --> CacheService
    RequestHandler --> EventService
    RequestHandler --> ApiRouter

    class DecisionService
    class CacheService
    class EventService
    class ApiRouter
    class ConfigService

    DecisionService --> ConfigService
```

### Observations

1. **v1** collapses all dependencies into `CoreLogic`, resulting in a dense cluster with many outgoing arrows.
2. **v2** delegates responsibilities to small services, each arrow representing a bounded contract (interface).
3. CompositionRoot clearly defines adapter boundaries, enabling CDN‑specific injection at startup.
