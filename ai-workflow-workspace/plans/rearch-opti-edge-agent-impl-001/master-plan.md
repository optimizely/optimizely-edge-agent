---
type: "plan"
purpose: "unified-architecture-and-implementation"
category: "Architecture Implementation"
version: "1.0.0"
status: "Active"
description: "Comprehensive plan for the Optimizely Edge Agent architecture redesign and implementation"
planId: "rearch-opti-edge-agent-impl-001"
implementationMode: "@mode:assisted"
dateCreated: "2023-04-04"
lastUpdated: "2025-04-11"
related_files: [
  "docs/architecture/01-principles.md", 
  "docs/architecture/02-components.md", 
  "docs/architecture/03-abstraction-interfaces.md", 
  "docs/architecture/04-state-management.md", 
  "docs/architecture/05-dependencies.md", 
  "docs/architecture/06-implementation-isolation.md",
  "../edge-agent-feature-parity-002/plan.md",
  "../edge-agent-feature-parity-002/feature-parity-gap-analysis.md"
]
---

# Master Plan: Optimizely Edge Agent Architecture Redesign and Implementation

**Plan ID:** `rearch-opti-edge-agent-impl-001`

## ⚠️ CRITICAL UPDATE: Feature Parity Gaps Identified (2025-04-07)

During comprehensive review and testing, we identified significant feature parity gaps between the original Edge Agent implementation and our reimplementation. A dedicated implementation plan ([edge-agent-feature-parity-002](../edge-agent-feature-parity-002/plan.md)) has been created to address these gaps in parallel with this plan.

The following critical features are missing from our current implementation:

- **Cookie Management & Decision Persistence**: Sticky bucketing via cookies not implemented
- **Response Headers**: Configuration-driven response header handling incomplete
- **KV Storage Integration**: Flag and datafile storage in KV not implemented
- **Configuration Options**: Many options from original `requestConfig.js` missing
- **Visitor ID Management**: Visitor ID precedence rules and persistence incomplete

For detailed analysis with code comparisons and specific evidence of these feature parity gaps, see the [feature parity gap analysis](../edge-agent-feature-parity-002/feature-parity-gap-analysis.md) document.

This plan will continue to focus on the core architecture implementation while the feature parity plan addresses these specific gaps to ensure complete compatibility with the original implementation.

## Plan Structure Note

This master plan is a unified document that combines:
1. The architecture redesign proposal (originally in `docs/new-architecture-gemini/plan.md`)
2. The practical implementation plan (originally in `ai-workflow-workspace-Max/plans/rearch-opti-edge-agent-impl-001/plan.md`)

The document is structured to provide both the architectural vision and the concrete implementation steps.

## PART 1: ARCHITECTURE REDESIGN PROPOSAL

### 1. Overview

This part details the plan for analyzing the current Optimizely Edge Agent architecture and proposes a refined design focusing on simplicity, performance, maintainability, and adherence to modern architectural principles.

### 2. Scope Definition 

#### 2.1 In-Scope

-   Comprehensive analysis of the existing `optimizely-edge-agent` codebase (`src/` directory and related documentation).
-   Identification and documentation of architectural weaknesses (complexity, coupling, performance bottlenecks, maintainability issues).
-   Proposal of a new, simplified, and performant architecture.
-   Documentation of the proposed architecture, covering:
    -   Core principles (e.g., SOLID, modularity).
    -   Component breakdown and responsibilities.
    -   Improved abstraction layers (CDN, KV Store).
    -   Dependency management strategy.
    -   State management strategy.
    -   Data flow diagrams.
-   Storage of all proposal documents within a dedicated directory.
-   Adherence to the AI Workflow Framework throughout the process.

#### 2.2 Out-of-Scope

-   Detailed implementation specifics for non-core features unless architecturally significant.
-   Quantitative performance benchmarking (focus is on architectural design for performance).
-   Refactoring of the *existing* codebase (analysis only).

### 3. Mode Selection

-   **Selected Mode:** Initially `@mode:manual`, transitioned to `@mode:assisted`
-   **Justification:** The task involves complex architectural analysis and design, requiring oversight, detailed documentation, and verification. Transitioning to assisted mode allows for more efficient implementation with appropriate checkpoints.

### 4. Architecture Analysis Phases

**Phase 1: ANALYSIS (Completed)**
-   Analysis of the core codebase components
-   Identification of architectural weaknesses
-   Documentation of pain points

**Phase 2: ARCHITECTURE DESIGN (Completed)**
-   Definition of architecture principles
-   Design of core components and interactions
-   Design of abstraction interfaces
-   Development of state management strategy
-   Definition of dependency management approach

### 5. Proposed Architecture Principles

The proposed architecture is designed based on the following core principles:

1.  **Modularity & Single Responsibility Principle (SRP):** Break down large components into smaller, focused modules each handling a single, well-defined responsibility.
2.  **Clear Abstraction Layers:** Define explicit, robust interfaces for abstracting environment differences. Ensure core logic interacts only with these interfaces.
3.  **Explicit Dependency Management:** Utilize clear dependency injection rather than relying on global state or manual instance passing.
4.  **Stateless Core Logic:** Design the core request processing flow to be as stateless as possible, receiving necessary context per request.
5.  **Decoupling:** Reduce tight coupling between modules. Use events or intermediate interfaces where appropriate.
6.  **Testability:** Design components with testability in mind.
7.  **Configuration Management:** Centralize and simplify configuration loading and access.
8.  **Performance by Design:** Simplify logic flows, reduce unnecessary object creation, and optimize external interactions.

### 6. Proposed Core Components

Based on the analysis and principles, the new architecture decomposes responsibilities into the following core components:

1.  **Request Router:** Minimal entry point routing requests to Experimentation Pipeline, API Handler, or Passthrough.
2.  **Request Handler:** Orchestrates the A/B testing flow (config, parse, decide, respond) with stateless pipeline design.
3.  **API Handler:** Routes and delegates API requests to specific service modules.
4.  **Configuration Service:** Manages configuration loading and access.
5.  **Request Parser/Context:** Parses request details into a standardized context object.
6.  **Decision Engine:** Performs decisions based on context and flags.
7.  **Optimizely Provider:** Manages Optimizely SDK instance and operations.
8.  **Response Builder/Modifier:** Constructs/modifies HTTP responses.
9.  **CDN Adapter Interface:** Defines contract for CDN-specific operations.
10. **CDN Adapter Implementations:** Implements the CDN interface for specific providers.
11. **KV Store Interface:** Defines contract for basic KV operations.
12. **KV Store Implementations:** Implements KV interface for specific providers.
13. **User Profile Service:** Manages user profile persistence.
14. **Helper Modules:** Focused utility functions.

### 7. Proposed Abstraction Layer

The abstraction layer consists of the following interfaces:

1.  **`EnvironmentAdapter`:** Abstracts access to environment specifics.
2.  **`RequestAdapter`:** Standardizes access to request details.
3.  **`ResponseAdapter`:** Abstracts response creation and modification.
4.  **`KVStoreAdapter`:** Defines the contract for KV operations.
5.  **`CacheAdapter`:** Abstracts edge caching operations.
6.  **`EventDispatcherAdapter`:** Abstracts asynchronous event dispatch.

Each interface has corresponding implementations for different CDN providers.

### 8. State Management Strategy

The architecture adopts a stateless approach:

1.  **Stateless Core Components:** Components operate statelessly, receiving data via parameters.
2.  **Request Context Object:** A comprehensive context object contains parsed request details.
3.  **Explicit Context Passing:** Context is passed explicitly through the component chain.
4.  **Dependency Injection:** Services and adapters are instantiated and injected appropriately.
5.  **Immutability:** Immutable data structures are used for context and configuration.

## PART 2: IMPLEMENTATION PLAN

### 9. Implementation Phases Overview

The implementation follows a four-phase approach with a revised sequencing strategy (updated April 5, 2023):

| Phase | Description | Status | Notes |
|-------|-------------|--------|-------|
| 1     | Core Infrastructure | 100% Complete | Phase 1 test verification completed |
| 2     | Feature Parity (Basic) - Cloudflare | 100% Complete | Core API endpoints and Edge Mode functionality implemented |
| 3     | Feature Parity (Basic) - Additional CDNs | Not Started | Will replicate Cloudflare pattern to Vercel, Fastly |
| 4     | Feature Parity (Complete) | In Progress | 10% complete, addressed in [dedicated plan](../edge-agent-feature-parity-002/plan.md) |
| 5     | Enhanced Features | Not Started | |

> **Implementation Strategy Update (April 5, 2023):** Based on project requirements and efficiency considerations, we've revised our approach to focus on completing the Cloudflare implementation first, before extending to other CDNs. This focus enables us to perfect a single implementation pattern before replication, aligns with the original project's Cloudflare-first approach, and provides a clear reference implementation for verification.

> **Feature Parity Update (April 7, 2025):** Significant feature parity gaps have been identified between the original implementation and our reimplementation. A [dedicated plan](../edge-agent-feature-parity-002/plan.md) has been created to address these gaps in parallel with this plan.

### 10. Phase 1: Core Infrastructure Implementation (COMPLETED)

#### 10.1 Project Structure (Complete)
- Created `src-v2` directory structure
- Set up build configuration
- Configured testing framework
- Added npm scripts

#### 10.2 Interface Definitions (Complete)
- Implemented base interfaces:
  - `IRequestAdapter`
  - `IStorageAdapter`
  - `IEnvironmentAdapter`
  - `ILoggerAdapter`
- Implemented core service interfaces:
  - `IConfigService`
  - `IDecisionService`
  - `IEventDispatcher`
  - `IRequestHandler`

#### 10.3 Adapter Implementations

**Cloudflare Adapters (Complete)**
- Implemented `CloudflareRequestAdapter`
- Implemented `CloudflareStorageAdapter`
- Implemented `CloudflareEnvironmentAdapter`
- Implemented `CloudflareLoggerAdapter`
- Created adapter factory for Cloudflare

**Vercel Adapters (Complete)**
- Implemented `VercelRequestAdapter`
- Implemented `VercelStorageAdapter`
- Implemented `VercelEnvironmentAdapter`
- Implemented `VercelLoggerAdapter`
- Created adapter factory for Vercel

**Fastly Adapters (Complete)**
- Implemented `FastlyRequestAdapter`
- Implemented `FastlyStorageAdapter`
- Implemented `FastlyEnvironmentAdapter`
- Implemented `FastlyLoggerAdapter`
- Created adapter factory for Fastly

#### 10.4 Core Service Implementation (Basic implementations complete)
- Implemented `ConfigService` (basic)
- Implemented `DecisionService` (basic)
- Implemented `EventDispatcher` (basic)
- Implemented `RequestHandler` pipeline (basic)

#### 10.5 Dependency Injection Setup (Complete)
- Implemented composition root pattern
- Created factory methods for services and adapters
- Implemented entry points for different CDN environments

#### 10.6 End-to-End Integration (Complete)
- Created minimal request handling flow
- Implemented feature detection routing
- Configured logging with version tagging

### 11. Phase 2: Cloudflare Feature Parity Implementation (IN PROGRESS)

#### 11.1 Cloudflare Adapter Enhancement
- Thoroughly enhance Cloudflare-specific adapters
- Complete CloudflareStorageAdapter KV operations
- Optimize CloudflareRequestAdapter for all edge cases
- Refine CloudflareEnvironmentAdapter functionality
- Enhance CloudflareLoggerAdapter with additional features

#### 11.2 Experimentation Services (Cloudflare-focused)
- Implement complete `DecisionService` for Cloudflare
- Create user context extraction
- Implement attribute processing
- Implement audience targeting

#### 11.3 Core API Endpoints (Cloudflare-focused)
- Implement API router
- Implement experiment activation endpoints
- Implement datafile fetch endpoints
- Implement status endpoint

#### 11.4 Cloudflare-Specific Caching Implementation
- Implement caching strategies optimized for Cloudflare KV
- Configure TTL settings
- Implement cache invalidation

#### 11.5 Cloudflare Implementation Verification
- Create comprehensive Cloudflare-specific tests
- Verify functionality in Cloudflare development environment
- Compare performance with original implementation

### 12. Phase 3: Additional CDN Implementation

#### 12.1 Vercel Implementation
- Apply the verified Cloudflare pattern to Vercel
- Enhance Vercel adapters based on lessons learned
- Optimize for Vercel-specific capabilities
- Verify functionality in Vercel environment

#### 12.2 Fastly Implementation
- Apply the verified Cloudflare pattern to Fastly
- Enhance Fastly adapters based on lessons learned
- Optimize for Fastly-specific capabilities
- Verify functionality in Fastly environment

### 13. Testing Strategy

#### 13.1 Cloudflare-First Testing Approach
- Complete and thorough testing of Cloudflare implementation first
- Use Cloudflare implementation as the reference for other CDNs
- Create reusable test patterns that can be applied to all CDNs

#### 13.2 Unit Testing
- Component unit tests
- Interface testing via mocks
- Service testing with adapter mocks

#### 13.3 Integration Testing
- End-to-end request flow verification
- Comparison with original implementation
- Performance testing

#### 13.4 CDN Adapter Testing
- Testing in actual deployment environments per CDN provider
- Verification of CDN-specific behavior

### 14. Migration Plan

#### 14.1 Production Rollout Strategy
1. Deploy both implementations to production
2. Direct non-critical SDK keys to the new implementation
3. Gradually increase traffic to the new implementation
4. Monitor for discrepancies or performance issues
5. Complete migration when stability is confirmed

#### 14.2 Fallback Strategy
- Quick rollback capability
- Maintain original implementation until full migration
- Monitoring thresholds for automatic fallback

### 15. Success Criteria
1. All features from original implementation available
2. Performance meets or exceeds original implementation
3. Code maintainability improved
4. 100% of traffic can be served by new implementation

### 16. Current Status and Next Steps

**Current Status:**
- Phase 1 (Core Infrastructure) is 100% complete with test verification
- Phase 2 (API Endpoints & Edge Mode) is 100% complete for Cloudflare implementation
- Feature Parity Gaps identified and a dedicated plan created ([edge-agent-feature-parity-002](../edge-agent-feature-parity-002/plan.md))

**Next Steps:**
1. Continue with the original plan:
   - Implement metrics tracking for API endpoint usage/latency/errors
   - Create end-to-end tests for API & Edge Mode
   - Standardize error responses and add validation
   - Create comprehensive API documentation
2. Address Feature Parity Gaps (via [edge-agent-feature-parity-002](../edge-agent-feature-parity-002/plan.md)):
   - Implement Cookie Management & Decision Persistence
   - Implement Response Headers 
   - Implement KV Storage Integration
   - Add Configuration Options
   - Implement Visitor ID Management
3. Once feature parity is achieved:
   - Apply the verified pattern to Vercel implementation
   - Apply the verified pattern to Fastly implementation 