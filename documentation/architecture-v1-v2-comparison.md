# Architecture Comparison: Optimizely Edge Agent v1 vs. v2

This document compares the core architectural patterns and design philosophies of the Optimizely Edge Agent v1 (JavaScript) and v2 (TypeScript) implementations based on analysis tasks ARCH-1, CDN-1, CDN-2, and others.

## v1 Architecture (JavaScript)

*   **Core Pattern:** Largely monolithic, with most request handling logic concentrated in `src/coreLogic.js`.
*   **Structure:** Functional programming style dominates. Relies on helper modules (`_helpers_`, `_config_`, `_optimizely_`) for specific tasks.
*   **Request Flow:** A central `processRequest` function orchestrates calls to helpers for configuration, Optimizely operations, and CDN adapter interactions. Control flow is managed through conditional logic within this main function.
*   **Configuration:** Handled by `requestConfig.js`, merging sources (headers, query, body) with limited validation.
*   **CDN Integration:** Uses an adapter pattern (`cdn-adapters/`), primarily implemented for Cloudflare. `coreLogic.js` interacts directly with the configured adapter instance for platform-specific operations (request/response abstraction, KV store, event dispatch).
*   **Dependencies:** Managed implicitly through module imports. Less formal separation of concerns.
*   **Extensibility:** Limited due to the monolithic structure. Adding new features or CDN support often requires modifying `coreLogic.js`.
*   **Typing:** JavaScript (no static typing).

## v2 Architecture (TypeScript)

*   **Core Pattern:** Service-Oriented Architecture (SOA) with Dependency Injection (DI).
*   **Structure:** Object-oriented, utilizing TypeScript classes and in@builtin markdownterfaces. Clear separation of concerns into distinct services (e.g., `DecisionService`, `DatafileService`, `RequestHandler`, `ConfigurationService`, `EdgeModeHandler`, `ApiRouter`, `EventDispatcher`).
*   **Dependency Injection:** A central `compositionRoot.ts` is responsible for instantiating services and injecting dependencies (interfaces) into constructors. This promotes loose coupling and testability.
*   **Interfaces:** Extensive use of TypeScript interfaces (`IRequestHandler`, `IDecisionService`, `IConfigService`, `ICacheService`, `IEventService`, adapter interfaces, etc.) defines clear contracts between components.
*   **Request Flow:** `RequestHandler.ts` acts as the primary orchestrator, receiving requests via an `IRequestAdapter` and delegating tasks to specialized services based on the request type (Edge Mode, Agent Mode, API calls).
*   **Configuration:** Handled by `ConfigurationService` (implementing `IConfigurationService`), which uses `IRequestAdapter` to abstract access to request data sources. Provides typed configuration and improved validation.
*   **Adapter Pattern:** Significantly expanded. Uses interfaces (`IEnvironmentAdapter`, `IStorageAdapter`, `IRequestAdapter`, `IResponseAdapter`, `IMetricsAdapter`, `ILoggerAdapter`) and factories (`adapters/factories`) to abstract platform-specific details (Cloudflare, Vercel, Fastly planned). Allows for cleaner multi-CDN support.
*   **Extensibility:** High. New services or adapters can be added by implementing the required interfaces and updating the `compositionRoot.ts`.
*   **Typing:** TypeScript (strong static typing), improving code quality, maintainability, and reducing runtime errors.

## Key Differences Summary@builtin markdown

| Feature             | v1 (JavaScript)                                  | v2 (TypeScript)                                                                    | Notes                                                                    |
| :------------------ | :----------------------------------------------- | :--------------------------------------------------------------------------------- | :----------------------------------------------------------------------- |
| **Core Paradigm**   | Monolithic, Functional                           | Service-Oriented, Object-Oriented                                                  | v2 promotes modularity and separation of concerns.                       |
| **Structure**       | Central `coreLogic.js`, helper modules           | Dedicated services, Composition Root (`compositionRoot.ts`)                      | v2 is more organized and scalable.                                       |
| **Dependencies**    | Implicit module imports                          | Explicit Dependency Injection (interfaces)                                         | v2 is loosely coupled, easier to test and refactor.                      |
| **Typing**          | JavaScript (Dynamic)                             | TypeScript (Static)                                                                | v2 offers improved code quality and compile-time checks.                 |
| **CDN Adapters**    | Basic adapter pattern, primarily Cloudflare      | Expanded adapter system (Env, Storage, Request, Response, Metrics, Logger), Factories | v2 provides better abstraction and easier multi-CDN support.               |
| **Configuration**   | `requestConfig.js`, basic merging/validation     | `ConfigurationService`, `IRequestAdapter`, typed, better validation              | v2 configuration is more robust and type-safe.                           |
| **Extensibility**   | Low                                              | High                                                                               | v2 design facilitates adding new features and platform support.          |
| **Testability**     | Challenging due to coupling                      | High due to DI and interfaces (mocks can be easily injected)                       | *Based on architecture, actual test implementation deferred (TEST-1)*. |

## Conclusion

The v2 architecture represents a significant modernization and improvement over v1. Its adoption of SOA, DI, TypeScript interfaces, and an expanded adapter pattern leads to a more modular, maintainable, extensible, testable, and robust system suitable for supporting multiple CDN environments and future feature growth. While introducing more structural complexity, the benefits in terms of code quality and long-term manageability are substantial.
