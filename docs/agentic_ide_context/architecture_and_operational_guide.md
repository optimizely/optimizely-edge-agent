# Architecture and operational guide for Optimizely Edge Agent
> 👍
> 
> Beta
> 
> 
> ----------
> 
> Optimizely Edge Agent is in beta. Apply on the [Optimizely beta signup page](https://www.optimizely.com/beta) or contact your Customer Success Manager.

Content delivery networks (CDNs) deliver content globally. By caching content in geographically dispersed edge servers, CDNs reduce latency and enhance user experience. See [Content Delivery Networks and Optimizely Feature Experimentation](https://docs.developers.optimizely.com/feature-experimentation/docs/content-delivery-networks) for more.

Optimizely Edge Agent uses this infrastructure to perform A/B testing directly at the edge, minimizing the dependency on central servers for decision-making. It is designed to provide a comprehensive, ready-to-deploy solution incorporating caching, cookie management, and visitor ID management.

The architecture of Optimizely Edge Agent permits `GET` and `POST` [HTTP request methods](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods), adapting its functionality to different operational needs within a CDN-agnostic framework. See [Introduction](https://docs.developers.optimizely.com/feature-experimentation/docs/introduction-to-hybrid-serverless-agent) for information.

*   `OptimizelyProvider` – Initializes and manages interactions with the Optimizely Feature Experimentation SDK, handling decision-making, event dispatch, and other SDK operations.
    
*   `CoreLogic` – Acts as the central processing unit of the edge worker, managing request processing and coordinating between the edge worker and the `OptimizelyProvider`.
    
*   `CDN Adapters` – Tailors modules for each CDN provider, ensuring optimal integration and functionality specific to each CDN's capabilities.
    
*   `RequestConfig` – Manages and applies settings from request headers, query parameters, or `POST` body content across all system components.
    
*   `OptimizelyHelper` – Provides utility functions for cookie serialization, user profile management, and flag updates based on the latest datafile.
    

`Get` requests require a Feature Experimentation variable named `cdnVariationSettings` to be configured for each variation. See the following code sample:

```
const cdnVariationSettings = {
  "cdnExperimentURL": "https://apidev.expedge.com",
  "cdnResponseURL": "https://apidev.expedge.com/ui-elements",
  "cacheKey": "VARIATION_KEY",
  "forwardRequestToOrigin": "false",
  "cacheRequestToOrigin": "true",
  "cacheTTL": "60000",
  "isControlVariation": "true"
}

```


The `cdnVariationSettings` Feature Experimentation flag variable plays a vital role in the operation of the Optimizely Edge Agent, particularly when handling `GET` requests. This configuration dictates how the edge worker processes these requests, determining how it fetches, serves, and integrates content with broader testing strategies. The following list describes each component of the `cdnVariationSettings`:

*   `cdnExperimentURL` – Serves as the identifier for the edge worker to match incoming `GET` requests against specific A/B tests. When a request URL matches the `cdnExperimentURL`, it triggers the decision-making process to determine which content variation should be delivered to the user. This ensures that only relevant traffic sees the experiment, maintaining efficiency and focusing on resource utilization.
*   `cdnResponseURL`– Specifies where it fetched the variant content from when a request matches an experiment. This URL retrieves the appropriate variation content that is returned in response to the end user. It enables the edge worker to directly fetch and deliver customized content based on the experiment's outcomes, ensuring users receive the most relevant experience.
*   `cacheKey` – Manages how responses are cached. If set to `VARIATION_KEY`, the edge worker constructs a cache key by appending the combination of the test's flag key and variation key to the `cdnExperimentURL`. This caches each variation uniquely, permitting efficient retrieval on subsequent requests that qualify for the same variation. If a different value is provided, it is used as the cache key, offering flexibility in defining cache strategies.
*   `forwardRequestToOrigin` – Controls whether to forward the request, along with its decision data (such as headers or cookies), to the origin server. This is useful for testing backend services or for scenarios where the decision must be made at the edge, but the origin handles content generation or further processing. This capability lets the edge worker act as a smart proxy, which can make decisions and then pass those along to the origin, enriching the backends' context about the user's experience.
*   `cacheRequestToOrigin` – Directs the edge worker to cache the fetched or generated content for future requests when enabled. This minimizes the number of trips back to the origin server for subsequent requests by different users who qualify for the same experiment and variation, enhancing performance and reducing origin load.
*   `cacheTTL`– Specifies the cache Time-to-Live (TTL) for content fetched from the origin and returned to a client, if configured.
*   `isControlVariation` – Identifies whether the settings correspond to the control group in an A/B test. Used for analyzing the effectiveness of variations against a baseline, ensuring that the control variation is treated distinctly and results are measured accurately.

Each setting in `cdnVariationSettings` optimizes the delivery and effectiveness of A/B tests at the edge and also ensures that resources are used judiciously and user experiences are personalized without unnecessary latency or overhead. This comprehensive approach lets you implement robust, scalable, and efficient A/B testing strategies directly at the edge. For information about the `cdnVariationSettings`, see [Edge Mode flag variable configuration](https://docs.developers.optimizely.com/feature-experimentation/docs/edge-mode-flag-variable-configuration).

Optimizely Edge Agent with the `cdnVariationSettings` configuration removes the complications normally associated with deploying and managing edge-based A/B tests, especially around worker redeployment and content caching management. The following are benefits of A/B testing with Optimizley Edge Agent:

*   **Streamlined A/B test deployment** – Initiate and modify A/B tests without redeploying workers. You can dynamically update changes to testing parameters, such as targeting different user segments or varying content delivery, in the JSON configuration object. This flexibility lets you adapt your strategies based on real-time insights and changing business needs without the downtime from deploying new code or configurations at the edge.
*   **Automated content caching management** – Simplify content caching management on a per-variation basis using `cdnVariationSettings`. You can specify parameters like `cdnResponseURL` and `cacheKey` to define caching for each variation at the edge. This ensures the following:
    *   **Variation-specific caching** – Assign unique caches to each test variation, determined by the `cacheKey` configuration, ensuring users consistently receive the correct content version per the test's segmentation rules, maintaining the integrity of A/B test results.
    *   **Efficient resource utilization** – Reduce repeated queries to origin servers by caching content directly at the edge, optimizing bandwidth and reducing server load, crucial during high-traffic periods or for resource-intensive content.
    *   **Rapid content delivery** – Speed up content delivery by serving cached content from edge locations closest to users, enhancing user experience with faster response times to maintain engagement and reduce bounce rates during A/B tests.
*   **No redeployment required** – Update A/B tests, including pausing, stopping, or updating variations without worker redeployment, reducing operational overhead and accelerating experimentation.
*   **Decentralized decision making** – Make decisions about which content variation to serve directly at the edge, closer to the user, improving performance and enabling more granular and accurate testing based on real-time user interaction data.
*   **Scalability and flexibility** – Scale to handle increased traffic and more complex testing scenarios without additional strain on central infrastructure, using the distributed nature of edge computing.

The sequence of operations for `GET` requests in the edge worker is as follows:

1.  **Request evaluation** – Evaluates if a `GET` request matches the conditions in the `cdnExperimentURL` upon receipt by the edge worker.
    
2.  **Decision making** – Utilizes the `OptimizelyProvider` to determine the appropriate variation based on user cookies and experiment configuration when a match is found.
    
3.  **Content fetching and caching** – Fetches the variation content from the specified URL or retrieve it from the cache based on the `cdnResponseURL` and caching directives,`cacheRequestToOrigin`.
    
4.  **Response modification** – Includes headers or cookies in the response to reflect the decision, ensuring consistency in the user experience across multiple requests.
    
5.  **Forwarding and caching logic** – Forwards the request to the origin server with modified headers and cookies if `forwardRequestToOrigin` is `true`. Otherwise, serves the response directly from the edge cache.
    

`POST` requests activate the serverless functionality of the edge worker, operating independently of `cdnVariationSettings`. The sequence of operations is as follows:

1.  **Request processing** – Processes`POST` requests directly by the edge worker.
    
2.  **Agent functionality** – Operates the Optimizely Edge Agent as a serverless edge microservice, interfacing with the backend through the Optimizely Feature Experimentation API.
    
3.  **Response management** – Returns responses directly to the requester, ensuring efficient handling of dynamic content requests.
    

Optimizely Edge Agent incorporates a REST API for interacting with the key-value (KV) store, enabling advanced management of experimentation flags and datafiles:

*   **Flag key management** – Stores a subset of flag keys from the datafile to control which experiments are activated during `GET` request evaluations.
    
*   **Datafile management** – Supports storing and automatically updating the datafile in the KV store using webhooks when modifications occur. The edge worker can load the datafile directly from the KV store or download it from the Optimizely CDN.
    

Implementing A/B testing at the edge offers multiple technical advantages:

*   **Immediate decision making** – Reduces latency by making decisions at the point of contact, avoiding back-and-forth with central servers.
    
*   **Scalability and efficiency** – Scales with traffic increases, managing load without significant infrastructure changes.
    
*   **Reduced costs** – Lowers bandwidth costs and operational overhead by reducing data transfers to and from the origin server.
    

Utilizing an edge-based serverless architecture offers significant improvements over traditional server setups like [Kubernetes](https://kubernetes.io/) or [Amazon EC2](https://aws.amazon.com/ec2/) instances:

*   **Infrastructure simplicity** – Reduces the complexity and cost of maintaining and scaling traditional servers.
    
*   **Enhanced performance** – Provides lower latency and higher throughput by processing data at the edge.
    
*   **Operational efficiency** – Decentralizes decision-making processes, enhancing overall system responsiveness and efficiency.
    

The type of experiments you can perform using Optimizely Edge Agent depends on whether they are initiated through a `GET` or `POST` request. Each request type supports different testing methodologies and strategies tailored to the capabilities and scenarios best suited for each.

*   **URL-based targeting tests** – Testing where the content or experience varies based on the specific URL visited by the user.
    
*   **User segmentation tests** – Segmenting users based on criteria like geography, device type, or session activity and delivering tailored content accordingly.
    
*   **Behavioral targeting tests** – Dynamic content changes based on user interaction patterns or historical behavior.
    
*   **Performance tests** – Variations in CDN configurations or file sizes to evaluate performance impacts on user experience.
    
*   **Visual and UX design experiments** – Variations in layout, color schemes, or menu elements to test visual appeal and usability.
    
*   **Content personalization tests** – Customizing content such as text, images, or offers based on user data or past interactions.f
    

*   **Backend functional tests** – Evaluating different algorithms or backend services without altering the user-facing elements of the application.
    
*   **API behavior tests** – Testing how different API responses affect app behavior or server-side processing.
    
*   **Dynamic content generation tests** – Generating different responses from the server based on the input received from `POST` requests.
    
*   **Capacity and stress tests** – Understanding how systems perform under varying loads by simulating different traffic patterns or data inputs through `POST` requests.
    
*   **Security and robustness tests** – Verifying how changes in security settings or request handling rules impact system stability and security.
    

Caching variation content at the edge offers significant benefits, especially in the context of A/B testing including:

*   **Improved performance** – Cache content close to the user to reduce the distance data travels, decrease load times, and improve overall website performance. This is crucial in A/B testing, which aims to provide a seamless user experience across variations.
    
*   **Reduced server load** – Serve repeated content directly from the cache at the edge rather than hitting the origin server, reducing the load on central servers and allowing them to handle other critical operations more efficiently.
    
*   **Cost efficiency** – Minimize requests to the origin server to reduce bandwidth and computational load, translating to lower operating costs for large-scale deployments.
    
*   **Scalability**– Scale applications more easily as the user base grows, with the edge handling much of the content delivery, allowing applications to sustain more users without a proportional increase in origin server resources.
    
*   **Reliability and uptime** – Cache content at multiple edge locations to minimize the impact of a single point of failure, increasing the overall reliability of the application and ensuring higher uptime to maintain test integrity during A/B tests.
    
*   **Quick iteration on experiments** – Deliver content faster to receive feedback quickly on test variations, enabling marketers and developers to iterate rapidly, adapt to user responses, and refine strategies in near-real time.
    
*   **Consistency in user experience** – Ensure that users bucketed into a variation continue to receive the same version throughout the test duration, enhancing the consistency of experimental data.
    

These benefits demonstrate why caching variation content at the edge is integral to conducting efficient, effective, and scalable A/B tests, making it a preferred strategy for businesses focused on optimizing user experiences through rapid experimentation and personalization.

Updated about 2 months ago

* * *

*   [Table of Contents](#)
*   *   [Architecture overview](#architecture-overview)
        *   [Modules and components](#modules-and-components)
    *   [`GET` requests](#get-requests)
        *   [The `cdnVariationSettings` configuration](#the-cdnvariationsettings-configuration)
    *   [Benefits of A/B testing at the edge with Optimizely Edge Agent and `cdnVariationSettings`](#benefits-of-ab-testing-at-the-edge-with-optimizely-edge-agent-and-cdnvariationsettings)
    *   [Sequence of operations](#sequence-of-operations)
        *   [`Get` requests](#get-requests-1)
        *   [`Post` requests](#post-requests)
    *   [REST API and key-value store integration](#rest-api-and-key-value-store-integration)
    *   [Benefits of edge-based A/B tests](#benefits-of-edge-based-ab-tests)
        *   [Comparison with traditional server-based architectures](#comparison-with-traditional-server-based-architectures)
    *   [Comprehensive list of experiments by request type](#comprehensive-list-of-experiments-by-request-type)
        *   [Experiments for `GET` requests](#experiments-for-get-requests)
        *   [Experiments for `POST` requests](#experiments-for-post-requests)
    *   [Benefits of caching variation content at the edge in an A/B test](#benefits-of-caching-variation-content-at-the-edge-in-an-ab-test)