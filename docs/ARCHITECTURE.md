To add the original document to the Detailed Architecture and Operational Guide page, you can create a markdown file named `ARCHITECTURE.md` in the `docs` directory of your repository and copy the original document's content into that file. Here’s how you can structure the `ARCHITECTURE.md` file:

1. Create a `docs` directory in your repository if it doesn't already exist.
2. Inside the `docs` directory, create a new file named `ARCHITECTURE.md`.
3. Copy and paste the original document content into the `ARCHITECTURE.md` file.

Here is a step-by-step guide with the original document content formatted for Markdown:

### Step-by-Step Guide

1. **Create the `docs` Directory:**
   - In the root directory of your repository, create a new folder named `docs`.

2. **Create the `ARCHITECTURE.md` File:**
   - Inside the `docs` directory, create a new file named `ARCHITECTURE.md`.

3. **Copy and Paste the Content:**
   - Open the `ARCHITECTURE.md` file in a text editor and paste the following content:

```markdown
# Hybrid Edge Serverless Agent: Detailed Architecture and Operational Guide

## Introduction

In the rapidly evolving landscape of web technologies, Content Delivery Networks (CDNs) play a pivotal role in delivering content efficiently across the globe. By caching content at geographically dispersed edge servers, CDNs significantly reduce latency and enhance user experience. The Optimizely Hybrid Edge Serverless Agent, an innovative technology, leverages this infrastructure to perform A/B testing directly at the edge, minimizing the dependency on central servers for decision-making. This edge worker is designed to provide a comprehensive, ready-to-deploy solution that incorporates caching, cookie management, visitor ID creation, and management, with persistence, enabling customers to quickly implement a robust A/B testing framework.

## Comprehensive Architecture Overview

The architecture of the Hybrid Edge Serverless Agent supports both GET and POST HTTP request methods, adapting its functionality to different operational needs within a CDN-agnostic framework.

### Modules and Components

- **OptimizelyProvider**: Initializes and manages interactions with the Optimizely FX SDK, handling decision making, event dispatch, and other SDK operations.
- **CoreLogic**: Acts as the central processing unit of the edge worker, managing request processing and coordinating between the edge worker and the OptimizelyProvider.
- **CDN Adapters**: Tailored modules for each CDN provider, ensuring optimal integration and functionality specific to each CDN's capabilities.
- **RequestConfig**: Manages and applies settings from request headers, query parameters, or POST body content across all system components.
- **OptimizelyHelper**: Provides utility functions for cookie serialization, user profile management, and flag updates based on the latest datafile.

### Handling GET Requests

GET requests require a Feature Experimentation variable named `cdnVariationSettings` that must be configured for each variation:

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

### Understanding the cdnVariationSettings Configuration

The `cdnVariationSettings` FEX flag variable plays a crucial role in the operation of the Hybrid Edge Serverless Agent, particularly when handling GET requests. This configuration dictates how the edge worker processes these requests, determining not only how content is fetched and served but also how it integrates with broader testing strategies. Below, we delve into each component of the `cdnVariationSettings` and its importance:

- **cdnExperimentURL**: This URL is critical as it serves as the identifier for the edge worker to match incoming GET requests against specific A/B tests. When a request URL matches the `cdnExperimentURL`, it triggers the decision-making process to determine which variation of content should be delivered to the user. This ensures that only relevant traffic is subjected to the experiment, maintaining efficiency, and focusing on resource utilization.
- **cdnResponseURL**: Once a request matches an experiment, the `cdnResponseURL` specifies where the variant content is fetched from. This URL is essential for retrieving the appropriate variation content that will be returned in the response to the end-user. It enables the edge worker to directly fetch and deliver customized content based on the experiment's outcomes, ensuring users receive the most relevant experience.
- **cacheKey**: The `cacheKey` setting is pivotal in managing how responses are cached. If set to `VARIATION_KEY`, the edge worker constructs a cache key by appending the combination of the test's flag key and variation key to the `cdnExperimentURL`. This approach ensures that each variation is cached uniquely, allowing for efficient retrieval on subsequent requests that qualify for the same variation. If a different value is provided, it will be used as the cache key, offering flexibility in defining cache strategies.
- **forwardRequestToOrigin**: This setting controls whether the request, along with its decision data (such as headers or cookies), should be forwarded to the origin server. This is particularly useful for testing backend services or for scenarios where the decision needs to be made at the edge, but the content generation or further processing is handled at the origin. This capability allows the edge worker to act as a smart proxy, which can make decisions and then pass those along to the origin, enriching the backends' context about the user's experience.
- **cacheRequestToOrigin**: When enabled, this setting directs the edge worker to cache the fetched or generated content for future requests. This minimizes the number of trips back to the origin server for subsequent requests by different users who qualify for the same experiment and variation, significantly enhancing performance and reducing load on the origin.
- **isControlVariation**: Identifies whether the settings correspond to the control group in an A/B test. This is crucial for analyzing the effectiveness of variations against a baseline, ensuring that the control variation is treated distinctly, and results are measured accurately.

Each of these settings in the `cdnVariationSettings` not only optimizes the delivery and effectiveness of A/B tests at the edge but also ensures that resources are used judiciously, and user experiences are personalized without unnecessary latency or overhead. This comprehensive approach allows businesses to implement robust, scalable, and efficient A/B testing strategies directly at the edge.

### Simplifying A/B Testing at the Edge with Hybrid Edge Serverless Agent and cdnVariationSettings

The Optimizely Hybrid Edge Serverless Agent, enhanced by the `cdnVariationSettings` configuration JSON object, revolutionizes the execution of A/B tests at the edge. This innovative approach eliminates the complexities traditionally associated with deploying and managing edge-based A/B tests, particularly concerning worker redeployment and content caching management.

#### Streamlined A/B Testing Deployment

One of the core advantages of using the edge worker with the `cdnVariationSettings` is the ability to initiate and modify A/B tests without the need for redeploying the workers. Changes to testing parameters, such as targeting different user segments or varying content delivery, can be dynamically updated in the JSON configuration object. This flexibility allows customers to quickly adapt their strategies based on real-time insights and changing business needs without the downtime typically associated with deploying new code or configurations at the edge.

#### Automated Content Caching Management

The `cdnVariationSettings` also simplifies the management of content caching on a per-variation basis. By specifying parameters like `cdnResponseURL` and `cacheKey`, customers can define how each variation should be cached at the edge. This setup ensures that:

- **Variation-Specific Caching**: Each test variation has its unique cache, determined by the `cacheKey` configuration. This method ensures that users consistently receive the correct version of the content as per the test's segmentation rules, maintaining the integrity of the A/B test results.
- **Efficient Resource Utilization**: Caching content directly at the edge reduces the need for repeated queries back to the origin servers for the same content, thus optimizing bandwidth and reducing server load. This efficiency is particularly crucial during high-traffic periods or for resource-intensive content.
- **Rapid Content Delivery**: Serving cached content from edge locations closest to the users not only speeds up content delivery but also enhances the user experience by providing faster response times. This immediate responsiveness is vital in maintaining engagement and reducing bounce rates during A/B tests.

### Operational Benefits

By centralizing the control of A/B test variations through the `cdnVariationSettings` within the edge worker, businesses gain significant operational advantages:

- **No Redeployment Required**: Updates to A/B tests, including pausing, stopping, or tweaking variations, do not require worker redeployment. This capability significantly reduces the operational overhead and accelerates the pace of experimentation.
- **Decentralized Decision Making**: Decisions about which content variation to serve are made directly at the edge, closer to the user. This decentralization not only improves performance but also enables more granular and accurate testing based on real-time user interaction data.
- **Scalability and Flexibility**: The system easily scales to handle increased traffic and more complex testing scenarios without additional strain on central infrastructure, thanks to the distributed nature of edge computing.

By leveraging the `cdnVariationSettings` within the Hybrid Edge Serverless Agent, companies can deploy robust, flexible, and efficient A/B testing strategies at the edge. This approach not only simplifies the technical management of such tests but also accelerates the iterative process of improving and personalizing user experiences across digital platforms.

### Sequence of Operations

The sequence of operations for GET requests in the edge worker involves:

1. **Request Evaluation**: Upon receiving a GET request, the edge worker evaluates if the request matches conditions in the `cdnExperimentURL`.
2. **Decision Making**: If a match is found, the edge worker utilizes the

 OptimizelyProvider to determine the appropriate variation based on user cookies and experiment configuration.
3. **Content Fetching and Caching**: Based on the `cdnResponseURL` and caching directives (`cacheRequestToOrigin`), the edge worker either fetches the variation content from the specified URL or retrieves it from the cache.
4. **Response Modification**: The response is modified to include headers or cookies reflecting the decision, ensuring consistency in the user experience across multiple requests.
5. **Forwarding and Caching Logic**: If `forwardRequestToOrigin` is true, the request is forwarded to the origin server with modified headers and cookies. If not, the response is served directly from the edge cache to minimize latency.

### Handling POST Requests

POST requests activate the serverless functionality of the edge worker, operating independently of `cdnVariationSettings`:

1. **Request Processing**: POST requests are processed directly by the edge worker.
2. **Agent Functionality**: It functions as a serverless edge microservice, interfacing with the backend via the Optimizely FX API (Application Programming Interfaces).
3. **Response Management**: Responses are returned directly to the requester, ensuring efficient handling of dynamic content requests.

### REST API and KV Store Integration

The edge worker incorporates a REST API for interacting with the KV store, enabling advanced management of experimentation flags and datafiles:

- **Flag Key Management**: Stores a subset of flag keys from the datafile to control which experiments are activated during GET request evaluations.
- **Datafile Management**: Supports storing and automatic updating of the datafile in the KV store via webhooks when modifications occur. The edge worker can load the datafile directly from the KV store or download it from the Optimizely CDN.

### Benefits of Edge-Based A/B Testing

Implementing A/B testing at the edge offers multiple technical advantages:

- **Immediate Decision Making**: Reduces latency by making decisions at the point of contact, avoiding back-and-forth with central servers.
- **Scalability and Efficiency**: Naturally scales with traffic increases, managing load without significant infrastructure changes.
- **Reduced Costs**: Lowers bandwidth costs and operational overhead by reducing data transfers to and from the origin server.

### Comparison with Traditional Server-Based Architectures

Utilizing an edge-based serverless architecture offers significant improvements over traditional server setups like Kubernetes or EC2 instances:

- **Infrastructure Simplicity**: Reduces the complexity and cost associated with maintaining and scaling traditional servers.
- **Enhanced Performance**: Provides lower latency and higher throughput by processing data at the edge.
- **Operational Efficiency**: Decentralizes decision-making processes, enhancing overall system responsiveness and efficiency.

### Comprehensive List of Tests by Request Type

The type of tests that can be performed using the Hybrid Edge Serverless Agent depends on whether they are initiated through GET or POST requests. Each request type supports different testing methodologies and strategies, tailored to the capabilities and scenarios best suited for each.

#### Tests for GET Requests

- **URL-Based Targeting Tests**: Tests where the content or experience varies based on the specific URL visited by the user.
- **User Segmentation Tests**: Segmenting users based on criteria like geography, device type, or session activity and delivering tailored content accordingly.
- **Behavioral Targeting Tests**: Dynamic content changes based on user interaction patterns or historical behavior.
- **Performance Tests**: Variations in CDN configurations or file sizes to evaluate performance impacts on user experience.
- **Visual and UX Design Experiments**: Variations in layout, color schemes, or navigation elements to test visual appeal and usability.
- **Content Personalization Tests**: Customizing content such as text, images, or offers based on user data or past interactions.

#### Tests for POST Requests

- **Backend Functional Tests**: Evaluating different algorithms or backend services without altering the user-facing elements of the application.
- **API Behavior Tests**: Testing how different API responses affect app behavior or server-side processing.
- **Dynamic Content Generation Tests**: Generating different responses from the server based on the input received from POST requests.
- **Capacity and Stress Tests**: Understanding how systems perform under varying loads by simulating different traffic patterns or data inputs through POST requests.
- **Security and Robustness Tests**: Verifying how changes in security settings or request handling rules impact system stability and security.

### Benefits of Caching Variation Content at the Edge in A/B Testing

Caching variation content at the edge brings several significant benefits, especially in the context of A/B testing:

- **Improved Performance**: Caching content close to the user reduces the distance data travels, decreasing load times and improving overall website performance. This is crucial in A/B testing where the goal is to provide a seamless user experience across variations.
- **Reduced Server Load**: By caching content at the edge, requests for repeated content are served directly from the cache rather than hitting the origin server each time. This reduces the load on central servers, enabling them to handle other critical operations more efficiently.
- **Cost Efficiency**: Reducing the number of requests to the origin server not only minimizes bandwidth costs but also reduces the computational load, which can translate into lower operating costs for large-scale deployments.
- **Scalability**: Edge caching makes it easier to scale applications as the user base grows. Since the edge handles much of the content delivery, applications can support more users without a proportional increase in origin server resources.
- **Reliability and Uptime**: With content cached at multiple edge locations, the impact of a single point of failure is minimized. This redundancy increases the overall reliability of the application and ensures higher uptime, which is vital during A/B tests to maintain test integrity.
- **Quick Iteration on Experiments**: Faster content delivery allows for quicker feedback on test variations. Marketers and developers can iterate more rapidly, adapting to user responses and refining strategies in near-real time.
- **Consistency in User Experience**: Edge caching ensures that once a user is bucketed into a variation, they continue to receive the same version throughout the test duration, enhancing the consistency of the experimental data.

These benefits demonstrate why caching variation content at the edge is integral to conducting efficient, effective, and scalable A/B tests, making it a preferred strategy for businesses focused on optimizing user experiences through rapid experimentation and personalization.

### Conclusion

The Optimizely Hybrid Edge Serverless Agent merges advanced A/B testing capabilities with the efficiency of edge computing, providing businesses with a powerful tool to optimize user experiences in real-time. This innovative approach accelerates experimentation, enhances performance, and simplifies infrastructure requirements, making it an indispensable solution for modern digital enterprises.
```
