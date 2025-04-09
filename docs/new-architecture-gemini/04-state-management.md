---
type: "documentation"
purpose: "architecture-state-management"
category: "Architecture Proposal"
version: "1.0.0"
status: "Draft"
description: "Details the proposed state management strategy for the Optimizely Edge Agent re-architecture."
planId: "rearch-opti-edge-agent-001"
dateCreated: "[Current Date]" # Please replace with the actual date
lastUpdated: "[Current Date]" # Please replace with the actual date
related_files: ["../plan.md", "01-principles.md", "02-components.md", "03-abstraction-interfaces.md", "05-dependencies.md"]
---

# Proposed State Management Strategy

**Plan ID:** `rearch-opti-edge-agent-001`

## 1. Introduction

This document details the state management strategy for the proposed Optimizely Edge Agent re-architecture, addressing the reliance on instance variables in the current design (`plan.md`, section 8). The core principle is to favor **stateless components** and manage request-specific information through an **explicit Request Context Object**.

## 2. Core Strategy: Request Context Object

Instead of storing request-specific data (like visitor ID, parsed configuration, decisions) in instance variables of orchestrating classes (`CoreLogic`, `CloudflareAdapter`), this data will be gathered and held within a dedicated `RequestContext` object.

### 2.1 Creation

-   The `RequestContext` object will be created early in the request lifecycle, primarily by the `Request Parser/Context` component.
-   It will gather information by interacting with the `RequestAdapter` (for URL, headers, cookies, body), `Configuration Service` (for merged static/dynamic config), and potentially helper modules (e.g., `CookieHelper` for visitor ID generation/extraction).

### 2.2 Structure (Illustrative)

```typescript
// Example structure - final fields TBD
interface RequestContext {
    readonly originalRequest: Request; // Reference provided by RequestAdapter
    readonly url: URL;
    readonly method: string;
    readonly clientIp?: string;

    readonly visitorId: string;
    readonly sdkKey?: string; // SDK Key for this request

    readonly config: Readonly<MergedConfiguration>; // Unified view of settings
    readonly attributes: Readonly<Record<string, any>>; // User attributes
    readonly decideOptions: Readonly<string[]>; // Optimizely decide options

    readonly flagsToDecide?: Readonly<string[]>; // Explicit flags requested
    readonly forcedDecisions?: Readonly<ForcedDecision[]>; // Explicit forced decisions
    readonly storedDecisions?: Readonly<Decision[]>; // Valid decisions from cookies

    // Add other relevant request-scoped data as needed
}

// Helper types (examples)
interface MergedConfiguration { /* ... combined settings ... */ }
interface ForcedDecision { flagKey: string; ruleKey?: string; variationKey: string; }
interface Decision { /* ... structure from Optimizely SDK ... */ }
```

### 2.3 Immutability

The `RequestContext` object should be treated as **immutable** after creation. If subsequent steps need to add derived information (like the results from the `DecisionEngine`), they should ideally create a new object or a wrapper containing the original context and the new data, rather than modifying the original context in place. This prevents side effects and makes data flow clearer.

### 2.4 Usage

-   The `RequestContext` object is passed explicitly as a parameter to methods in the components that need request-specific data (e.g., `DecisionEngine.decide(context)`, `ResponseBuilder.build(context, decisions, content)`).
-   Components read the necessary information directly from the context object.

## 3. Benefits

-   **Explicitness:** Makes data dependencies clear – components declare what context they need.
-   **Statelessness:** Allows core logic components (`RequestHandler`, `DecisionEngine`, etc.) to be largely stateless, simplifying their design and testing.
-   **Testability:** Easier to unit test components by constructing mock `RequestContext` objects.
-   **Concurrency Safety:** Reduces potential issues related to shared mutable state if the edge environment handles requests concurrently.
-   **Readability:** Improves understanding of data flow through the request lifecycle.

## 4. Comparison to Current Approach

This contrasts with the current approach where state (e.g., `this.allDecisions`, `this.cdnExperimentSettings`, `this.isPostMethod`) is stored in instance variables of `CoreLogic` and potentially `CloudflareAdapter`, making the state implicit and tied to the instance lifecycle. 