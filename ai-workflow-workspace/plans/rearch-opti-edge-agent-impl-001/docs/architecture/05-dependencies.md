---
type: "documentation"
purpose: "architecture-dependencies"
category: "Architecture Proposal"
version: "1.0.0"
status: "Draft"
description: "Describes the proposed dependency management strategy for the Optimizely Edge Agent re-architecture."
planId: "rearch-opti-edge-agent-001"
dateCreated: "[Current Date]" # Please replace with the actual date
lastUpdated: "[Current Date]" # Please replace with the actual date
related_files: ["../plan.md", "01-principles.md", "02-components.md", "03-abstraction-interfaces.md", "04-state-management.md"]
---

# Proposed Dependency Management Strategy

**Plan ID:** `rearch-opti-edge-agent-001`

## 1. Introduction

This document outlines the strategy for managing dependencies between components in the proposed Optimizely Edge Agent re-architecture. The goal is to adhere to the principle of **Explicit Dependency Management**, making relationships between components clear, promoting decoupling, and enhancing testability.

## 2. Core Strategy: Dependency Injection (DI)

The primary mechanism for managing dependencies will be **Dependency Injection**, specifically **Constructor Injection** where practical.

### 2.1 Constructor Injection

-   Components will declare their dependencies as interfaces (e.g., `IRequestAdapter`, `IKVStoreAdapter`, `IConfigurationService`) in their constructors.
-   The responsibility of creating concrete instances (e.g., `CloudflareRequestAdapter`, `CloudflareKVAdapter`) and injecting them into dependent components lies outside the components themselves.

```typescript
// Example: DecisionEngine depending on OptimizelyProvider
import { IOptimizelyProvider } from './interfaces';
import { RequestContext } from './types'; // Assuming types are defined elsewhere

class DecisionEngine {
    private optimizelyProvider: IOptimizelyProvider;

    constructor(optimizelyProvider: IOptimizelyProvider) {
        this.optimizelyProvider = optimizelyProvider;
    }

    async decide(context: RequestContext) {
        // Use this.optimizelyProvider to interact with the SDK
        // ...
    }
}
```

### 2.2 Composition Root

-   A single location, often near the application's entry point (`index.js` or a dedicated setup module), will act as the **Composition Root**.
-   This location is responsible for:
    1.  Instantiating the concrete implementations of adapter interfaces based on the detected environment (e.g., creating `CloudflareRequestAdapter`, `CloudflareKVAdapter` if running on Cloudflare).
    2.  Instantiating the core service components (e.g., `ConfigurationService`, `DecisionEngine`, `RequestHandler`).
    3.  Injecting the adapter instances and other required services into the components that need them via their constructors.
    4.  Passing the fully configured top-level handler (e.g., `RequestHandler` or `APIHandler`) to the main request router/entry point.

```typescript
// Simplified Example in Composition Root (e.g., within index.js or a setup function)

import { CloudflareEnvironmentAdapter, CloudflareRequestAdapter, CloudflareKVAdapter, /* ... other adapters */ } from './adapters/cloudflare';
import { ConfigurationService } from './services/configService';
import { OptimizelyProvider } from './services/optimizelyProvider';
import { DecisionEngine } from './services/decisionEngine';
import { RequestHandler } from './handlers/requestHandler';
// ... other imports

function setupApplication(request: Request, env: any, ctx: any) {
    // 1. Instantiate Adapters
    const envAdapter = new CloudflareEnvironmentAdapter(env, ctx);
    const requestAdapter = new CloudflareRequestAdapter(request);
    const kvAdapter = new CloudflareKVAdapter(envAdapter);
    // ... instantiate other adapters (Response, Cache, EventDispatcher)

    // 2. Instantiate Services (injecting adapters)
    const configService = new ConfigurationService(requestAdapter, /* ... */);
    const optimizelyProvider = new OptimizelyProvider(kvAdapter, /* ... */ ); // Assuming OptlyProvider needs KV
    const decisionEngine = new DecisionEngine(optimizelyProvider);
    // ... instantiate other services

    // 3. Instantiate Top-Level Handlers (injecting services)
    const requestHandler = new RequestHandler(
        configService,
        decisionEngine,
        // ... other required services/adapters
    );

    // 4. Return handler to router
    return requestHandler; // Or potentially a router instance
}

// In main fetch handler:
// const handler = setupApplication(request, env, ctx);
// return handler.handle(request); // Or router.route(request, handler);

```

### 2.3 Benefits

-   **Decoupling:** Components depend on interfaces, not concrete implementations.
-   **Testability:** Dependencies can be easily mocked during unit testing by providing mock implementations of the interfaces.
-   **Clarity:** Dependencies are explicit in the constructor signature.
-   **Flexibility:** Easier to swap implementations (e.g., different CDN adapters) by changing the instantiation logic in the Composition Root.
-   **Centralized Wiring:** The complexity of object creation and wiring is centralized, keeping core components focused on their responsibilities.

## 3. Avoiding Service Locators and Global State

This approach explicitly avoids:

-   **Service Locator Pattern:** Where components request their dependencies from a central locator. This hides dependencies and makes testing harder.
-   **Global State/Singletons (for dependencies):** While some services like the Optimizely SDK client might be effectively singletons *per SDK key*, access should still be managed through injected providers rather than global variables to maintain testability and clarity. 