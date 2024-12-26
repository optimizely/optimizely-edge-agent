# Edge Mode flag configuration for Optimizely Edge Agent.
> 👍
> 
> Beta
> 
> 
> ----------
> 
> Optimizely Edge Agent is in beta. Apply on the [Optimizely beta signup page](https://www.optimizely.com/beta) or contact your Customer Success Manager.

The `cdnVariationSettings` is a powerful and essential Feature Experimentation flag variable that lets you fine-tune the behavior of Optimizely Edge Agent when operating in edge mode. This configuration object handles `GET` requests for granular control over content fetching, caching, and delivery on a per-variation basis.

By using the `cdnVariationSettings`, you can optimize your edge-based experimentation and personalization efforts, delivering the right content to the right users at the right time. This level of control is beneficial for managing complex A/B tests, where each variation may have unique requirements for content sourcing, caching, and delivery.

*   **Granular control** – The `cdnVariationSettings` lets you precisely configure content handling for each variation within an experiment. This granularity ensures that each user receives the intended experience, maintaining the integrity of the A/B test results.
*   **Improved performance** – By specifying caching behavior and content sources, the `cdnVariationSettings` can enhance the performance of edge-based experiments. Caching content at the edge reduces the need for repeated origin fetches, resulting in faster delivery and improved user experience.
*   **Flexibility and scalability** – The `cdnVariationSettings` lets you adapt your experimentation strategies without needing worker redeployment. You can do rapid iteration and optimization based on real-time insights, ensuring that experiments can scale seamlessly as traffic and complexity grow.
*   **Simplified management** – `cdnVariationSettings` streamlines managing edge-based experiments. You can control content handling, caching, and delivery directly through the configuration object, reducing the need for custom coding or complex setups.

The `cdnVariationSettings` is a JSON object that consists of several properties, each serving a specific purpose in controlling the behavior of Optimizely Edge Agent for `GET` requests.

![](https://files.readme.io/61e0785-image.png)

The `cdnExperimentURL` property specifies the URL pattern that the edge worker should match against incoming `GET` requests to determine if they are part of a specific experiment. When a request URL matches the `cdnExperimentURL`, the edge worker triggers the decision-making process to determine which variation of content to deliver to the user.

**Example**

If an experiment is designed to test different hero banner images on a website's homepage, you could set the `cdnExperimentURL` to `https://www.example.com/home`. This subjects any `GET` request matching this URL to the experiment's decision-making process.

The `cdnResponseURL` property specifies the URL from which the variant content should be fetched. When a request matches an experiment based on the `cdnExperimentURL`, the edge worker uses the `cdnResponseURL` to retrieve the appropriate variation content to be returned to the user.

One benefit is that the visitor from the client browser continues to see the URL for the original content they wanted to receive in the browser. However, the CDN fetches and returns the content corresponding to the defined `responseURL`, displaying the content to the user under the original requested URL.

This technique hides the fact that the shown content corresponds to a different URL. From the user's perspective, they view the content under the original URL they requested, while in reality, the content is served from a different URL defined by the `responseURL`.

This capability is useful for testing complete page redesigns or conducting experiments where entire web pages are created for A/B tests. Use the `responseURL` to create separate page variations and serve them to different user segments without modifying the original URL.

This approach removes the need for redirect tests to improve performance and reduce latency. Instead of redirecting the user to a different URL, the edge worker fetches the content from the defined `responseURL` and displays it under the original URL, providing a smooth and efficient user experience.

**Example**

In the hero banner experiment, the `cdnResponseURL` could be:

*   Variation A – `https://www.example.com/home/heroExperiment_variationA.html`
*   Variation B – `https://www.example.com/home/heroExperiment_variationB.html`.

The edge worker fetches the corresponding banner HTML file based on the assigned variation and displays it to the user under the original requested URL. The visitor continues to see the original URL in their browser, while the content served to them comes from the defined `responseURL`.

The `cacheKey` property determines how the response content is cached at the edge. If set to "VARIATION\_KEY", the edge worker constructs a unique cache key by combining the experiment's flag key, variation key, and `cdnExperimentURL`. This ensures that it caches each variation's content separately for efficient retrieval on subsequent requests.

> 📘
> 
> should it be `VARIATION_KEY` or is the variation key something entered uniquely?
> 
> 
> --------------------------------------------------------------------------------------

**Example**

For the hero banner experiment, setting `cacheKey` to "VARIATION\_KEY" results in cache keys like `https://www.example.com/home/heroExperiment_variationA.html` and `https://www.example.com/home/heroExperiment_variationB.html`, ensuring that each variation's banner is cached independently.

The `forwardRequestToOrigin` property is a Boolean that controls whether to forward the request, along with its decision data (such as headers or cookies), to the origin server. When set to `true`, the edge worker acts as a smart proxy, making decisions at the edge and then passing the request and decision information to the origin for further processing.

**Example**

In an experiment that tests personalized product recommendations, the edge worker can make the decision based on user attributes and then forward the request to the origin, including the decided variation in the headers. The origin server then generates personalized recommendations based on the provided variation.

The `cacheRequestToOrigin` property is a Boolean that determines whether to cache the content fetched from the origin at the edge for future requests. When set to `true`, the edge worker caches the origin's response, reducing the need for repeated origin fetches for subsequent requests that qualify for the same experiment and variation.

**Example**

For a content-heavy experiment, such as testing different article layouts, enabling `cacheRequestToOrigin` ensures that the article content is cached at the edge after the first request. Subsequent users who qualify for the same variation receive the cached content, improving performance and reducing load on the origin server.

The `cacheTTL` property specifies the Time-to-Live (TTL) value, in seconds, for the cached content. This determines how long the content remains valid in the edge cache before being considered stale and requiring a fresh fetch from the origin.

**Example**

For a rapidly changing experiment, such as testing different promotional offers, setting a shorter `cacheTTL` ensures that users receive the most up-to-date content. Conversely, for experiments with static content, you can use a longer `cacheTTL` to maximize caching benefits.

The `isControlVariation` property is a Boolean that indicates whether the current variation settings represent the control group in an A/B test. This distinguishes the baseline variation from the treatment variations and accurately measures the experiment's impact.

**Example**

In the hero banner experiment, the variation with the existing banner design would be marked as the control variation (isControlVariation: "true"). In contrast, the new banner designs would be the treatment variations (isControlVariation: "false"). This distinction lets you properly analyze and compare the variations' performance against the control.

By configuring these properties in the `cdnVariationSettings`, you can precisely control how Optimizely Edge Agent handles `GET` requests for each variation within an experiment. This level of control lets you create highly targeted, performant, and scalable edge-based experiments that deliver personalized experiences to users while optimizing resource utilization and minimizing operational complexity.

![](https://files.readme.io/3853b15-image.png)

Updated about 2 months ago

* * *

*   [Table of Contents](#)
*   *   [Key benefits of `cdnVariationSettings`](#key-benefits-of-cdnvariationsettings)
    *   [Understand the `cdnVariationSettings` properties](#understand-the-cdnvariationsettings-properties)
        *   [`cdnExperimentURL`](#cdnexperimenturl)
        *   [`cdnResponseURL`](#cdnresponseurl)
        *   [`cacheKey`](#cachekey)
    *   [`forwardRequestToOrigin`](#forwardrequesttoorigin)
    *   [`cacheRequestToOrigin`](#cacherequesttoorigin)
    *   [`cacheTTL`](#cachettl)
    *   [`isControlVariation`](#iscontrolvariation)