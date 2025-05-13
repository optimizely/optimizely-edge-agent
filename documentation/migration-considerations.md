# Migration Considerations: v1 to v2

This document outlines key considerations, potential breaking changes, and necessary adjustments when migrating applications or integrations from the Optimizely Edge Agent v1 (JavaScript) to v2 (TypeScript).

## Architectural Changes

*   **Monolith to Services:** The fundamental shift from v1's monolithic `coreLogic.js` to v2's Service-Oriented Architecture requires understanding the new components (`RequestHandler`, `DecisionService`, `DatafileService`, etc.) and their interactions.
*   **Dependency Injection:** v2 relies on a Composition Root (`compositionRoot.ts`) for DI. Custom integrations or extensions would need to align with this pattern, potentially requiring registration in the composition root.
*   **TypeScript:** v2 is written in TypeScript. While it can be consumed by JavaScript projects, leveraging its type safety requires a TypeScript-aware build process and potentially updating consuming code to use the provided types/interfaces.

## Configuration

*   **Abstraction:** v2 uses `IRequestAdapter` to abstract configuration sources. While aiming for parity, the exact way configuration is extracted and prioritized might have subtle differences compared to v1's `requestConfig.js`. Review configuration sources and precedence.
*   **Validation:** v2 introduces more robust, typed validation via `ConfigurationService`. Ensure all previously valid configurations in v1 are still valid under v2's stricter rules.

## API Endpoints

*   **Structure:** v2 uses `ApiRouter` service instead of v1's `apiRouter.js`. While many functionalities are similar, the implementation differs.
*   **New/Changed Endpoints:** v2 introduces new endpoints (e.g., `/decide*`, `/api/admin/*`, `/api/debug`) and potentially changes or deprecates some v1 endpoints (e.g., `/sdk`, `/variationChanges`). Thoroughly review API usage and update accordingly.
*   **Authentication:** v2 adds internal admin authentication (`X-Optimizely-Admin-Token` header) for certain endpoints (datafile/flagkey management, admin). This was absent in v1. Integrations calling these endpoints must implement the required authentication.
*   **Error Responses:** v2 returns standardized JSON error responses, whereas v1 often returned plain text. Client-side error handling logic must be updated to parse JSON errors.
*   **Response Headers:** v2 adds standard headers like `X-Request-ID` and `X-Agent-Version`.

## SDK Integration & Behavior

*   **Event Dispatching:** **CRITICAL GAP.** As v2's `EventDispatcher` is currently incomplete, applications relying on v1's event tracking (Agent Mode) cannot migrate until this functionality is fully implemented in v2.
*   **User Profile Service:** The KV-backed user profile persistence integrated in v1's `OptimizelyProvider` is absent in v2's core services. Migrating applications that rely on this persistence mechanism will require either implementing a similar service in v2 or adapting to a different user profile management strategy.
*   **Forced Decisions:** The input method changes (v1 parameters vs. v2 attributes). While functionally similar, review the application logic for setting forced decisions.
*   **Client/Context Caching:** v2's caching mechanisms are internal improvements and shouldn't directly break migrations, but they might subtly affect behavior under specific edge cases or load patterns compared to v1's simpler approach.

## CDN Adapters

*   **Interface Changes:** v2 uses a more comprehensive set of adapter interfaces (`IEnvironmentAdapter`, `IStorageAdapter`, etc.). Custom v1 adapters are not directly compatible and would need to be refactored to implement the relevant v2 interfaces.
*   **Factory Pattern:** v2 uses factories to create adapters. Integration might require understanding or utilizing these factories.

## Deployment & Environment

*   **Build Process:** Migrating to v2 requires a TypeScript build process.
*   **Environment Setup:** v2 includes setup for non-browser environments (mocking `localStorage`/`window`). Ensure the deployment environment aligns with these assumptions or provides necessary polyfills.

## Summary of Key Migration Steps

1.  **Assess API Usage:** Identify all interactions with v1 API endpoints and map them to v2 equivalents, noting changes in paths, parameters, authentication, and response formats.
2.  **Review Configuration:** Verify existing configuration methods against v2's `ConfigurationService` and `IRequestAdapter` abstraction.
3.  **Address Event Dispatching Gap:** **Do not migrate** applications requiring event tracking until the v2 `EventDispatcher` is fully implemented.
4.  **Address User Profile Gap:** Determine how user profile persistence will be handled in v2 and implement/adapt accordingly.
5.  **Update Forced Decision Logic:** Adapt code to pass forced decisions via user attributes if necessary.
6.  **Refactor Custom Adapters:** If using custom v1 CDN adapters, refactor them to implement the new v2 adapter interfaces.
7.  **Implement TypeScript Build:** Ensure the build pipeline can handle TypeScript compilation.
8.  **Thorough Testing:** Conduct extensive integration and end-to-end testing, focusing on API interactions, configuration loading, Edge/Agent mode behavior, and error handling, once functional gaps are closed.
