# Optimizely Edge Agent (v2)

This is the re-architected version of the Optimizely Edge Agent, providing an improved modular design with adapter patterns for multi-CDN support.

## Operational Modes

The Optimizely Edge Agent operates in two distinct modes:

### 1. Edge Mode (GET Requests)

Edge Mode is activated when the agent receives GET requests. In this mode, the agent:

- Matches incoming request URLs against configured experiment URLs
- Makes variation decisions for matched requests
- Fetches, caches, and serves appropriate content variations
- Manages response headers and cookies for maintaining bucketing decisions

Key features:
- Uses `cdnVariationSettings` configuration in the Optimizely Feature Flag
- Can forward requests to origin or serve directly from the edge
- Supports content caching with configurable TTL
- Maintains visitor bucketing through cookies or headers

### 2. Agent Mode (POST Requests)

Agent Mode is activated when the agent receives POST requests. In this mode, the agent:

- Acts as a serverless API endpoint for direct Optimizely SDK operations
- Processes decision requests using the full Optimizely SDK capabilities
- Returns decision results directly to the client
- Doesn't rely on `cdnVariationSettings`

Key features:
- Supports JSON body payloads for configuration
- Allows forced decisions and custom attributes
- Enables direct access to Optimizely SDK features
- Functions as a microservice rather than a content proxy

## Architecture

The codebase follows an adapter pattern to abstract away CDN-specific implementations:

### Core Components

- **RequestHandler**: Orchestrates the overall request handling pipeline
- **DecisionService**: Interfaces with the Optimizely SDK for feature flag decisions
- **CacheService**: Manages content caching for Edge Mode responses
- **EventDispatcher**: Handles dispatching impression events to Optimizely

### Adapter Interfaces

- **IRequestAdapter**: Abstracts request handling functionality
- **IStorageAdapter**: Abstracts key-value storage functionality
- **IEnvironmentAdapter**: Abstracts environment variables and context
- **ILoggerAdapter**: Abstracts logging functionality
- **IMetricsAdapter**: Abstracts metrics tracking functionality

### CDN-Specific Implementations

- **CloudflareAdapterFactory**: Creates Cloudflare-specific adapter instances
- **VercelAdapterFactory**: Creates Vercel-specific adapter instances
- **FastlyAdapterFactory**: Creates Fastly-specific adapter instances

### Bundle Size Optimization

The architecture is designed to optimize bundle size for edge deployments with tight size constraints:

- **Separate Entry Points**: Each CDN platform has a dedicated entry point file
- **CDN-Specific Composition**: Separate composition files in `composition/` directory for each CDN provider
- **Optimized Builds**: Dedicated build configurations to create optimized bundles for each target platform

Key benefits:
- Smaller deployment bundles tailored to each platform
- No unnecessary code in the deployed bundles
- Better tree-shaking by build tools
- Particularly important for Cloudflare Workers with their 1MB size limit

To build for a specific platform:
```bash
# Build only the Cloudflare-specific bundle
npm run build:cloudflare

# Build only the Vercel-specific bundle
npm run build:vercel

# Build only the Fastly-specific bundle
npm run build:fastly
```

## Key Features

### URL Matching

The Edge Agent matches incoming request URLs against `cdnExperimentURL` patterns defined in feature flag variables.

### Visitor Identification

The Edge Agent identifies visitors using:
1. Headers (`x-visitor-id`)
2. Cookies (`optimizely_visitor_id`)
3. Query parameters (`visitor_id`)
4. Generating a UUID if none of the above exist

### Caching

Content can be cached using:
- Specialized `VARIATION_KEY` format that combines flagKey and variationKey
- Custom string cache keys
- Configurable TTL values

### Decision Making

The Edge Agent makes decisions using:
- Optimizely SDK for feature flag evaluations
- Support for custom attributes from headers, query parameters, and POST bodies
- Support for forced decisions via configuration

## Getting Started

To use this re-architected Edge Agent:

1. Configure an Optimizely Feature Flag with the `cdnVariationSettings` variable
2. Deploy the agent to your preferred CDN (Cloudflare, Vercel, or Fastly)
3. Make GET requests to matched URLs for Edge Mode or POST requests for Agent Mode

## Configuration

The `cdnVariationSettings` object is central to Edge Mode operation and should include:

- `cdnExperimentURL`: URL pattern to match against incoming requests
- `cdnResponseURL`: URL from which to fetch variation content
- `cacheKey`: Identifier for caching (special value "VARIATION_KEY" or custom string)
- `forwardRequestToOrigin`: Controls whether to forward requests to origin ("true"/"false")
- `cacheRequestToOrigin`: Controls whether to cache responses ("true"/"false")
- `cacheTTL`: Cache time-to-live in seconds
- `isControlVariation`: Identifies control variations ("true"/"false")

## Test Status

✅ **ALL OPTIMIZELY SDK INTEGRATION TESTS ARE PASSING** (Updated: April 4, 2025)

The integration with the Optimizely Feature Experimentation SDK has been thoroughly tested and verified in the Cloudflare Workers environment. For detailed test results:

- [**Test Results Documentation**](./docs/test-results.md) - Comprehensive test status with verification commands
- [**Testing Patterns Guide**](./docs/optimizely-testing-patterns.md) - Established patterns for SDK testing
- [**Full Documentation Index**](./docs/README.md) - Index of all available documentation

## Directory Structure

- `adapters/` - Environment-specific adapter implementations (Cloudflare Workers, etc.)
- `services/` - Core service implementations including Optimizely SDK integration
- `composition/` - CDN-specific composition files for bundle optimization
- `tests/` - Test suites for verifying functionality
- `docs/` - Documentation for the v2 implementation
- `index.ts` - Cloudflare Workers entry point
- `vercel.ts` - Vercel Edge Functions entry point
- `fastly.js` - Fastly Compute@Edge entry point

## Running Tests

To verify the Optimizely SDK integration:

```bash
# Run all Optimizely SDK tests
npx vitest run tests/services/optimizely

# Run specific test files
npx vitest run tests/services/optimizely/config.test.ts
npx vitest run tests/services/optimizely/event-tracking.test.ts
npx vitest run tests/services/optimizely/forced-decisions.test.ts
```

For more detailed test commands and considerations, see the [Test Results Documentation](./docs/test-results.md).

## Services

The v2 implementation includes the following key services:

- **DecisionService** - Handles feature flag decisions
- **ConfigService** - Manages Optimizely configuration (datafile)
- **EventTrackingService** - Manages event tracking and analytics

For more information about the architecture, see the main [Architecture Documentation](../docs/ARCHITECTURE.md).

## CDN Adapters

The Optimizely Edge Agent now supports multiple CDN environments:

1. **Cloudflare Workers** (default)
2. **Vercel Edge Functions**
3. **Fastly Compute@Edge**

Each adapter provides a consistent interface for feature experimentation at the edge. For detailed documentation on using the adapters, see [CDN Adapters Documentation](./docs/cdn-adapters.md). 