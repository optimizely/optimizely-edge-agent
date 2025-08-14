
# Optimizely Edge Agent V2 Feature Parity Project: Context Guide

## 1. Project Overview

The Optimizely Edge Agent is a sophisticated edge computing solution designed to run on CDN platforms (Cloudflare Workers, Vercel Edge Functions, Fastly Compute@Edge) that enables high-performance feature experimentation and A/B testing directly at the network edge. This project focuses on ensuring feature parity between:

- **Original Implementation** (`/src` directory - JavaScript)
- **New Implementation** (`/src-v2` directory - TypeScript)

The v2 implementation represents a major architectural improvement (moving from monolithic to service-oriented architecture) but several critical features need verification and completion to achieve full parity with v1.

## 2. Project Environment Setup

### WSL 2 Path Considerations

When running in WSL 2, use this path format to navigate to the project:
```bash
cd /mnt/c/Users/LAH/Documents/__Development/Optimizely/optimizely-edge-agent/optimizely-edge-agent/
```

### Development Environment

- **Testing Server**: Wrangler dev is used for local testing on port 8787
- **Command**: `wrangler dev --local --inspector-port=9229 --port=8787`
- **Code Changes**: Are automatically detected and applied
- **Testing Approach**: Use curl commands against the local server (port 8787)

## 3. Core Concepts & Operating Modes

The Edge Agent operates in two distinct modes:

### Edge Mode (GET Requests)
- Acts as an intelligent edge-side SDK integrated into content delivery
- Intercepts GET requests to specified URLs
- Makes Optimizely decisions before serving content
- Can fetch content from different origins or modify responses based on experiment variations
- Uses `cdnVariationSettings` to control how content is fetched, cached, and delivered
- Manages cookies for sticky bucketing

### Agent Mode (POST Requests)
- Acts as a serverless API endpoint to the Optimizely SDK
- Handles explicit POST requests to API endpoints (e.g., `/api/decide`, `/api/track`)
- Processes parameters from headers, query string, and request body
- Returns JSON objects with decision results or tracking confirmations

## 4. Feature Parity Status & Critical Gaps

Based on the critical testing analysis, these are the key areas requiring attention:

1. **Edge Mode (G1)**: ✅ DONE - EdgeModeHandler properly implements cdnVariationSettings

2. **KV User Profile Service (G2)**: ⚠️ PARTIAL - Implementation exists but not properly connected in composition roots
   - Needs proper integration in all composition files

3. **Event Dispatching (G3)**: 🔄 IN PROGRESS
   - Well-developed but requires completion and testing for Vercel/Fastly
   - Documentation needs completion

4. **Configuration Parity (G4)**: ⚠️ PARTIAL
   - FEX header support complete
   - Header aliases and complex object parsing need work

5. **API Endpoints (G7, G8)**: ⚠️ PARTIAL
   - Most endpoints resolved
   - Some specific endpoints still pending decisions

6. **Metrics System (G10)**: ❌ NOT WORKING
   - Code is well-implemented but Analytics Engine integration is failing
   - Configuration in wrangler.toml likely needs fixes

## 5. Implementation Progress Tracking

To track implementation progress:

1. **Review Implementation Plan**:
   - File: `critical-testing-project/edge-agent-v2-implementation-plan.md`
   - Contains a step-by-step plan with phases, status markers, and test validation steps

2. **Test Against Implementation Plan**:
   - Each section in the implementation plan includes test commands
   - Execute these commands against the local Wrangler server to verify functionality
   - Update the "Implementation Status Tracking" table at the end of the plan

3. **Verify Feature Parity**:
   - Reference `critical-testing-project/edge-agent-v2-completion-analysis.md`
   - Contains detailed analysis of feature status and needed improvements

## 6. Key Files & Code Structure

### V2 Architecture (TypeScript)

The v2 implementation uses a service-oriented architecture with dependency injection:

- **Core Services**:
  - `RequestHandler`: Main entry point processing HTTP requests
  - `EdgeModeHandler`: Handles Edge Mode (GET requests)
  - `ApiRouter`: Routes API requests to appropriate handlers
  - `ConfigurationService`: Parses configuration from requests
  - `DecisionService`: Interfaces with the Optimizely SDK
  - `EventDispatcher`: Handles event dispatching to Optimizely

- **Adapter System**:
  - Uses interfaces (`IRequestAdapter`, `IResponseAdapter`, etc.) to abstract platform-specific code
  - Implementation-specific adapters for different CDNs (Cloudflare, Vercel, Fastly)
  - Allows platform-agnostic core logic

- **Composition Root**:
  - Wires together services and adapters
  - Key file: `src-v2/composition/cloudflareComposition.ts`

### V1 Architecture (JavaScript)

- Monolithic design centered around `coreLogic.js`
- Direct dependencies with less formal structure
- Implementation-specific adapters with conditional logic

## 7. Testing Methodology

To validate feature parity:

1. **Component Testing**:
   - Test specific features (Edge Mode, Agent Mode, KV integration) independently
   - Use curl commands provided in `edge-agent-v2-implementation-plan.md`

2. **API Endpoint Testing**:
   - Test all API endpoints listed in `edge-agent-v2-api-endpoint-reference.md`
   - Validate parameter handling (Headers, Query, Body)
   - Ensure all supported configuration options work across both implementations

3. **Edge Case Testing**:
   - Test error handling, invalid inputs
   - Verify proper handling of missing or optional parameters
   - Test with real SDK keys (`8mR1pGh8u2ztUP8GqjmQq`)

## 8. Critical Parameters & Configuration

The Edge Agent accepts parameters from multiple sources in this order of precedence:
1. **HTTP Headers** (highest priority)
2. **URL Query Parameters** (medium priority)
3. **Request Body** (lowest priority, POST/PUT only)

Key parameters include:
- `sdkKey`: Required Optimizely SDK key
- `visitorId`/`userId`: User identifier for consistent bucketing
- `flagKey`/`flagKeys`: Feature flag(s) to evaluate
- `attributes`: User attributes for targeting
- `decideOptions`: Options controlling decision behavior

For complete configuration reference, see `edge-agent-v2-interaction-guide.md`.

## 9. Key Documents Reference Guide

| Document | Purpose | Use For |
|----------|---------|---------|
| `edge-agent-v2-api-endpoint-reference.md` | Comprehensive API endpoints documentation | Understanding the REST API interface |
| `edge-agent-v2-interaction-guide.md` | Guide for interacting with the Edge Agent | Learning how to structure requests and handle parameters |
| `edge-agent-v2-completion-analysis.md` | Analysis of feature completeness | Understanding gaps and implementation status |
| `edge-agent-v2-implementation-plan.md` | Step-by-step implementation plan | Following the implementation progress and testing steps |
| `architecture-v1-v2-comparison.md` | Architecture comparison | Understanding key differences between implementations |
| `00-v1-edge-agent-reference.md` | V1 reference documentation | Learning about original features and behavior |
| `01-v2-implementation-reference-summary.md` | V2 implementation summary | Understanding the new architecture and capabilities |
| `apiRouter-handling.md` | Documentation on API routing | Learning about request handling and parameter processing |

## 10. Implementation Workflow

When implementing a feature:

1. **Understand the feature** in v1 (reference `00-v1-edge-agent-reference.md`)
2. **Find the corresponding component** in v2 (use architecture docs)
3. **Check implementation status** in completion analysis
4. **Review specific implementation plan** for that feature
5. **Make necessary code changes** to complete the feature
6. **Test with provided curl commands** against the local server
7. **Update status in implementation plan** documentation
8. **Verify integration** with other components

## 11. Example Testing Commands

```bash
# Test API functionality
curl -X POST http://localhost:8787/api/decide \
  -H "Content-Type: application/json" \
  -H "X-Optimizely-Enable-FEX: true" \
  -d '{"sdkKey": "8mR1pGh8u2ztUP8GqjmQq", "userId": "test_user_123", "flagKey": "test-flag"}'

# Test Edge Mode functionality
curl -X GET "http://localhost:8787/products?id=123" \
  -H "X-Optimizely-SDK-Key: 8mR1pGh8u2ztUP8GqjmQq" \
  -H "X-Optimizely-Visitor-Id: test_user_123"

# Test KV Profile Service (sticky bucketing)
curl -X POST http://localhost:8787/api/decide \
  -H "X-Optimizely-SDK-Key: 8mR1pGh8u2ztUP8GqjmQq" \
  -H "X-Optimizely-Visitor-Id: sticky_test_user" \
  -d '{"flagKey": "test-flag"}'
```

## 12. Project Goals & Success Criteria

The project will be considered successful when:

1. All critical gaps identified in the completion analysis are resolved
2. API endpoints maintain consistent behavior with v1
3. Edge Mode properly processes `cdnVariationSettings` and serves content accordingly
4. KV User Profile Service provides proper sticky bucketing
5. Event dispatching works correctly across all CDN environments
6. Configuration options have proper parity with v1
7. All tests in the implementation plan pass consistently

## 13. Maintaining Progress Context

To maintain context between sessions, always:

1. Document the **current phase** you're working on in the implementation plan
2. Update the **status markers** in the implementation plan
3. Note any **unexpected issues** that arise during testing
4. Document the **last completed successful test** to resume from that point

## 14. Final Notes

- The v2 implementation is a significant architectural improvement over v1
- The TypeScript interfaces provide better type safety and testability
- The adapter pattern allows easier extension to additional CDN environments
- Focus on ensuring that behavioral equivalence is maintained even with architectural differences
- Keep the implementation plan updated as the source of truth for progress tracking

This context document should provide any AI agent with the necessary understanding to continue the feature parity work effectively. If anything is unclear, refer to the specific documents referenced in the guide for more detailed information.
