# Functional Parity Verification & Gap Analysis: v1 vs. v2

This document outlines the functional parity between the Optimizely Edge Agent v1 and v2 implementations and identifies key functional gaps or differences based on the analysis tasks completed (excluding deferred performance and testing tasks).

## Core Functionality Comparison

| Feature Area          | v1 Implementation Notes                                    | v2 Implementation Notes                                                                 | Parity Status & Gaps                                                                                                                                |
| :-------------------- | :--------------------------------------------------------- | :-------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Request Handling**  | Centralized in `coreLogic.js`.                             | Orchestrated by `RequestHandler`, delegates to specialized services.                    | **Mostly Parity.** v2 achieves similar outcomes via a more modular architecture.                                                                      |
| **Configuration**     | `requestConfig.js` merges sources (header>query>body).     | `ConfigurationService` uses `IRequestAdapter`, typed, validation.                       | **Improved Parity.** v2 is functionally similar but more robust, type-safe, and extensible.                                                         |
| **Edge Mode**         | Logic within `coreLogic.js`, uses `OptlyHelpers`.            | Dedicated `EdgeModeHandler`, `URLMatcher`, integrates with services.                  | **Improved Parity.** v2 provides similar Edge Mode functionality with better structure, improved URL matching, and clearer separation of concerns.       |
| **Agent Mode**        | Logic within `coreLogic.js`, uses `OptimizelyProvider`.    | `RequestHandler` delegates to `DecisionService` / `EventService`.                       | **Mostly Parity.** v2 provides SDK decision/tracking via dedicated services. **See Event Dispatching Gap.**                                           |
| **CDN Adapters**      | Basic adapter pattern (`CloudflareAdapter`).             | Expanded, interface-based adapter system (Env, Storage, Req, Resp, Metrics, Logger). | **Significant Improvement.** v2 has superior abstraction for multi-CDN support, though specific adapter implementations may vary in completeness.     |
| **Caching**           | Basic datafile caching in `OptlyHelpers`, response caching via CDN adapter. | Dedicated `CacheService` using `IStorageAdapter`, multi-level (memory+KV) caching for datafiles, flags, responses. | **Significant Improvement.** v2 offers far more robust and configurable caching for various artifacts.                                                |
| **Optimizely SDK Int.** | `OptimizelyProvider` bundles client mgmt, context, etc.    | `DecisionService` focuses on decisions, client caching. Other concerns separated.     | **Improved Parity.** v2 provides better client management and context handling. **See Event Dispatching & User Profile Gaps.**                          |
| **API Endpoints**     | `apiRouter.js` handles basic datafile/flagkey/sdk ops.     | `ApiRouter` service uses DI, adds admin auth, metrics, more endpoints (debug, decide*). | **Enhanced Parity.** v2 expands API capabilities, improves structure, adds auth and metrics, but some v1 endpoints might be changed/deprecated.           |
| **Error Handling**    | Basic try/catch, console logging, plain text errors.       | Structured logging (`ILoggerAdapter`), consistent JSON error responses, better classification. | **Significant Improvement.** v2 offers vastly superior error handling, logging, and client response consistency.                                       |
| **Event Dispatching** | Handled by `dispatchEventToOptimizely` in CDN Adapter.     | **Incomplete.** `EventDispatcher` service exists but only logs events; lacks actual dispatch logic. | **Major Functional GAP.** v2 currently cannot send tracking events to Optimizely.                                                                  |
| **User Profile Svc**  | `OptimizelyProvider` integrates optional KV-based service.   | No equivalent integration within `DecisionService`.                                     | **Functional GAP/Difference.** v2 lacks the integrated KV-based user profile persistence found in v1's provider. Logic may exist elsewhere or is missing. |
| **Forced Decisions**  | Applied via `userContext.setForcedDecision` before `decide`. | Dual application (client+context methods), dedicated API via `DecisionService`.         | **Different Implementation.** Parity exists, but v2 internal logic is complex. Dedicated API is an improvement.                                         |
| **Typing**            | JavaScript (Dynamic)                                     | TypeScript (Static)                                                                   | **Architectural Improvement.** v2 offers type safety, improving reliability.                                                                        |

## Identified Functional Gaps in v2 (Current State)

Based on the analysis, the most significant functional gaps where v2 does not currently achieve parity with v1 are:

1.  **Event Dispatching:** The `EventDispatcher` service lacks the implementation to actually batch and send tracking events to Optimizely. This is a critical missing piece for Agent Mode functionality. (**Source:** OPT-1 Analysis)
2.  **Integrated User Profile Service:** The specific KV-backed User Profile Service integrated within v1's `OptimizelyProvider` for decision persistence is not present in v2's `DecisionService`. While user profile *attributes* are handled, the persistence mechanism seems different or absent in the analyzed v2 core services. (**Source:** OPT-1 Analysis)

## Identified Areas for Review in v2

*   **Forced Decision Application Logic:** The dual mechanism (using both `client.setForcedVariation` and `userContext.setForcedDecision`) within `DecisionService.decide/decideAll` seems unnecessarily complex and potentially problematic. This should be reviewed and simplified. (**Source:** OPT-1 Analysis)

## Conclusion

v2 successfully replicates and enhances most core functionalities of v1 with a significantly improved architecture. However, critical gaps exist, most notably the lack of implemented event dispatching. The missing integrated user profile persistence also needs clarification or implementation. Addressing these gaps is essential for achieving full functional parity.