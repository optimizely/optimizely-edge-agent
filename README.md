
# Optimizely Edge Agent

## Introduction

Welcome to the Optimizely Edge Agent repository. This project leverages the power of edge computing to perform A/B testing directly at the edge, reducing dependency on central servers and enhancing the efficiency of content delivery. The Optimizely Edge Agent, developed by Optimizely, is designed to be a comprehensive, ready-to-deploy solution that incorporates caching, cookie management, visitor ID creation and management, with persistence. This repository contains the code and documentation necessary to implement and manage the edge worker for your A/B testing needs.

## Features

- **Edge-Based A/B Testing**: Perform A/B tests directly at the edge, reducing latency and improving user experience.
- **CDN Agnostic**: Designed to work with any CDN provider, ensuring broad compatibility.
- **Comprehensive Functionality**: Includes caching, cookie management, visitor ID creation, and persistence.
- **Dynamic Configuration**: Easily update A/B test parameters without redeploying the worker.
- **REST API Integration**: Supports advanced management of experimentation flags and datafiles via a REST API.

## Architecture Overview

### Modules and Components

- **OptimizelyProvider**: Manages interactions with the Optimizely FX SDK, handling decision-making, event dispatch, and other SDK operations.
- **CoreLogic**: Central processing unit of the edge worker, managing request processing and coordinating with the OptimizelyProvider.
- **AbstractionHelper**: Provides helper functions and logic to abstract methods and CDN specific fucntionality between CDN providers
- **CDN Adapters**: Modules tailored for each CDN provider, ensuring optimal integration and functionality, including KV Store abstraction.
- **RequestConfig**: Manages and applies settings from request headers, query parameters, or POST body content.
- **OptimizelyHelper**: Provides utility functions for cookie serialization, user profile management, and flag updates.

### Handling GET Requests

GET requests utilize a configuration object named `cdnVariationSettings` for each variation. This configuration determines how the edge worker processes these requests, including content fetching, caching, and integration with broader testing strategies.

Example configuration:
```javascript
const cdnVariationSettings = {
  "cdnExperimentURL": "https://apidev.expedge.com",
  "cdnResponseURL": "https://apidev.expedge.com/ui-elements",
  "cacheKey": "VARIATION_KEY",
  "forwardRequestToOrigin": "false",
  "cacheRequestToOrigin": "true",
  "isControlVariation": "true"
}
```

### Handling POST Requests

POST requests activate the serverless functionality of the edge worker, operating independently of `cdnVariationSettings`. These requests are processed directly by the edge worker, functioning as a serverless edge microservice.

### REST API and KV Store Integration

The edge worker includes a REST API for interacting with the KV store, enabling advanced management of experimentation flags and datafiles. It supports storing and automatic updating of the datafile via webhooks and can load the datafile directly from the KV store or download it from the Optimizely CDN.

## Benefits of Edge-Based A/B Testing

- **Immediate Decision Making**: Reduces latency by making decisions at the edge.
- **Scalability and Efficiency**: Naturally scales with traffic increases, managing load without significant infrastructure changes.
- **Reduced Costs**: Lowers bandwidth costs and operational overhead by reducing data transfers to and from the origin server.
- **Enhanced Performance**: Provides lower latency and higher throughput by processing data at the edge.

## Comparison with Traditional Server-Based Architectures

The Optimizely Edge Agent offers significant improvements over traditional server setups:
- **Infrastructure Simplicity**: Reduces complexity and cost associated with maintaining traditional servers.
- **Operational Efficiency**: Decentralizes decision-making processes, enhancing system responsiveness.
- **Enhanced Performance**: Processes data at the edge, providing lower latency and higher throughput.

## Conclusion

The Optimizely Edge Agent merges advanced A/B testing capabilities with the efficiency of edge computing, providing businesses with a powerful tool to optimize user experiences in real-time. This innovative approach accelerates experimentation, enhances performance, and simplifies infrastructure requirements, making it an indispensable solution for modern digital enterprises.

## Getting Started

To get started with the Optimizely Edge Agent, refer to the [Developer Documentation](https://docs.developers.optimizely.com/feature-experimentation/docs/introduction-to-optimizely-edge-agent) for installation and configuration instructions.

## Contributing

We welcome contributions from the community. Please read our [Contributing Guide](CONTRIBUTING.md) for guidelines on how to contribute to this project.

## License

This project is licensed under the Apache License. See the [LICENSE](LICENSE.md) file for details.

For more detailed information, refer to the [Detailed Architecture and Operational Guide](docs/ARCHITECTURE.md).

---

Feel free to reach out with any questions or feedback. We hope you find the Optimizely Edge Agent to be a valuable addition to your A/B testing toolkit.
