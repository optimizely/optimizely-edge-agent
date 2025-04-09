# Hybrid Edge Serverless Agent

## Introduction

Welcome to the Hybrid Edge Serverless Agent repository. This project leverages the power of edge computing to perform A/B testing directly at the edge, reducing dependency on central servers and enhancing the efficiency of content delivery. The Hybrid Edge Serverless Agent, developed by Optimizely, is designed to be a comprehensive, ready-to-deploy solution that incorporates caching, cookie management, visitor ID creation and management, with persistence. This repository contains the code and documentation necessary to implement and manage the edge worker for your A/B testing needs.

## Latest Updates

🚀 **April 6, 2024**: Added comprehensive metrics system with Cloudflare Analytics Engine integration:
- Request tracking with detailed dimensions
- Performance monitoring for key operations
- Cache hit/miss tracking
- Error rate monitoring with classification

🚀 **November 26, 2023**: Completed major enhancements to Edge Mode content delivery:
- Enhanced content type detection and handling
- Improved caching with metadata preservation
- Robust origin request forwarding
- Secure content transformation capabilities
- Advanced header management
- Comprehensive error handling and recovery

✅ **All Optimizely SDK integration tests are passing** (Updated: April 4, 2025)

The integration with the Optimizely Feature Experimentation SDK has been thoroughly tested and verified in the Cloudflare Workers environment. For detailed test results and verification commands, please see:

- [Test Results Documentation](src-v2/docs/test-results.md) - Comprehensive test status and verification commands
- [Testing Patterns Guide](src-v2/docs/optimizely-testing-patterns.md) - Established patterns for SDK testing

## Features

- **Edge-Based A/B Testing**: Perform A/B tests directly at the edge, reducing latency and improving user experience.
- **Multi-CDN Support**: Native support for Cloudflare Workers, Vercel Edge Functions, and Fastly Compute@Edge environments.
- **CDN Agnostic Architecture**: Designed with a modular adapter system to work with any CDN provider, ensuring broad compatibility.
- **Advanced Content Delivery**: Content type detection, secure transformations, and intelligent caching for optimal delivery.
- **Comprehensive Metrics**: Built-in metrics tracking for performance, request patterns, and system health with Cloudflare Analytics Engine integration.
- **Comprehensive Functionality**: Includes caching, cookie management, visitor ID creation, and persistence.
- **Dynamic Configuration**: Easily update A/B test parameters without redeploying the worker.
- **REST API Integration**: Supports advanced management of experimentation flags and datafiles via a REST API.
- **Security-Focused Design**: Protected content transformation, sanitized request handling, and proper header management.

## Architecture Overview

### Modules and Components

- **OptimizelyProvider**: Manages interactions with the Optimizely FX SDK, handling decision-making, event dispatch, and other SDK operations.
- **CoreLogic**: Central processing unit of the edge worker, managing request processing and coordinating with the OptimizelyProvider.
- **AbstractionHelper**: Provides helper functions and logic to abstract methods and CDN specific fucntionality between CDN providers
- **CDN Adapters**: Modules tailored for each CDN provider, ensuring optimal integration and functionality, including KV Store abstraction.
- **RequestConfig**: Manages and applies settings from request headers, query parameters, or POST body content.
- **OptimizelyHelper**: Provides utility functions for cookie serialization, user profile management, and flag updates.
- **MetricsAdapter**: Records operational metrics for monitoring, performance tracking, and system health assessment.

### Handling GET Requests (Edge Mode)

GET requests utilize a configuration object named `cdnVariationSettings` for each variation. This configuration determines how the edge worker processes these requests, including content fetching, caching, and integration with broader testing strategies.

Example configuration:
```javascript
const cdnVariationSettings = {
  // Core URL patterns
  "cdnExperimentURL": "https://apidev.expedge.com",
  "cdnResponseURL": "https://apidev.expedge.com/ui-elements",
  
  // Caching configuration
  "cacheKey": "VARIATION_KEY",
  "cacheTTL": "3600",
  
  // Request handling
  "forwardRequestToOrigin": "false",
  "cacheRequestToOrigin": "true",
  
  // Variation flags
  "isControlVariation": "true",
  
  // Advanced URL handling
  "pathRegex": "^/products/[0-9]+$",
  "ignoreQueryParams": "false",
  "requiredQueryParams": "campaign,source",
  
  // Response customization
  "responseHeaders": "{\"X-Variation\": \"test-variation\", \"X-Cache-Control\": \"max-age=3600\"}",
  "transformContent": "result = content.replace('Original', 'Variation');"
}
```

### Handling POST Requests (Agent Mode)

POST requests activate the serverless functionality of the edge worker, operating independently of `cdnVariationSettings`. These requests are processed directly by the edge worker, functioning as a serverless edge microservice with endpoints for:

- `/decide` - Make a single flag decision
- `/decide-all` - Make decisions for multiple flags
- `/track` - Track events with rich metadata
- `/set-forced-variation` - Force specific variations for testing
- `/get-forced-variation` - Retrieve currently forced variations

### REST API and KV Store Integration

The edge worker includes a REST API for interacting with the KV store, enabling advanced management of experimentation flags and datafiles. It supports storing and automatic updating of the datafile via webhooks and can load the datafile directly from the KV store or download it from the Optimizely CDN.

### Metrics System

The Edge Agent includes a comprehensive metrics system for monitoring performance and operational metrics:

- **Request Metrics**: Tracks API requests, durations, and error rates with detailed dimensions
- **Cache Metrics**: Monitors cache hits/misses for datafiles and flag keys
- **Performance Metrics**: Tracks operation durations across components
- **Error Metrics**: Classifies and counts errors by type and source

In Cloudflare environments, metrics are recorded to the Analytics Engine when available, providing detailed dashboards for monitoring and analysis. In other environments or when Analytics Engine is unavailable, metrics are logged to the console.

For detailed information, see the [Metrics Documentation](src-v2/docs/metrics.md).

## Benefits of Edge-Based A/B Testing

- **Immediate Decision Making**: Reduces latency by making decisions at the edge.
- **Scalability and Efficiency**: Naturally scales with traffic increases, managing load without significant infrastructure changes.
- **Reduced Costs**: Lowers bandwidth costs and operational overhead by reducing data transfers to and from the origin server.
- **Enhanced Performance**: Provides lower latency and higher throughput by processing data at the edge.
- **Content Optimization**: Transforms and optimizes content delivery right at the edge.

## Comparison with Traditional Server-Based Architectures

The Hybrid Edge Serverless Agent offers significant improvements over traditional server setups:
- **Infrastructure Simplicity**: Reduces complexity and cost associated with maintaining traditional servers.
- **Operational Efficiency**: Decentralizes decision-making processes, enhancing system responsiveness.
- **Enhanced Performance**: Processes data at the edge, providing lower latency and higher throughput.
- **Reduced Origin Load**: Caches and serves content at the edge, significantly reducing origin server load.

## Development and Testing

### Running Tests

Run the Optimizely SDK integration tests with:

```bash
# Run all Optimizely tests
npx vitest run src-v2/tests/services/optimizely

# Run specific test files
npx vitest run src-v2/tests/services/optimizely/config.test.ts

# Run metrics tests
npx vitest run src-v2/tests/metrics

# Run integration tests against a live deployment
npm run test:integration
```

For more detailed test commands and considerations, see the [Test Results Documentation](src-v2/docs/test-results.md).

### Working with Metrics

The Edge Agent provides a metrics system that tracks various operational metrics. When developing locally or in environments without Cloudflare Analytics Engine, metrics are logged to the console. In Cloudflare environments with Analytics Engine, metrics are recorded for real-time monitoring.

To enable metrics in your Cloudflare deployment, make sure your wrangler.toml includes:

```toml
analytics_engine_datasets = [
  { binding = "ANALYTICS_ENGINE", dataset = "optimizely_edge_agent_metrics" }
]
```

For detailed information about available metrics and how to use them, see the [Metrics Documentation](src-v2/docs/metrics.md).

## Conclusion

The Hybrid Edge Serverless Agent merges advanced A/B testing capabilities with the efficiency of edge computing, providing businesses with a powerful tool to optimize user experiences in real-time. This innovative approach accelerates experimentation, enhances performance, and simplifies infrastructure requirements, making it an indispensable solution for modern digital enterprises.

## Getting Started

To get started with the Hybrid Edge Serverless Agent, refer to the [Setup Guide](SETUP.md) for installation and configuration instructions.

## Contributing

We welcome contributions from the community. Please read our [Contributing Guide](CONTRIBUTING.md) for guidelines on how to contribute to this project.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE.md) file for details.

For more detailed information, refer to the [Detailed Architecture and Operational Guide](docs/ARCHITECTURE.md).

---

Feel free to reach out with any questions or feedback. We hope you find the Hybrid Edge Serverless Agent to be a valuable addition to your A/B testing toolkit.
