# Introduction to Optimizely Edge Agent
How Optimizely Edge Agent integrates edge computing and serverless architecture to enable seamless feature experimentation and A/B testing across various platforms.

> 👍
> 
> Beta
> 
> 
> ----------
> 
> Optimizely Edge Agent is in beta. Apply on the [Optimizely beta signup page](https://www.optimizely.com/beta) or contact your Customer Success Manager.

Optimizely Edge Agent combines the capabilities of [Optimizely's Feature Experimentation edge starter kit SDKs](https://docs.developers.optimizely.com/feature-experimentation/docs/get-started-edge-functions) with the versatility and scalability of [Optimizely Feature Experimentation Agent](https://docs.developers.optimizely.com/feature-experimentation/docs/optimizely-agent). This hybrid approach lets you seamlessly conduct targeted deliveries and experiments across various platforms and architectures, using the advantages of [edge computing](https://docs.developers.optimizely.com/feature-experimentation/docs/content-delivery-networks#edge-computing) and [serverless infrastructure](https://en.wikipedia.org/wiki/Serverless_computing).

Optimizely Edge Agent operates in two distinct modes (edge or agent), depending on the type of request it receives.

With `Get` requests, Optimizely Edge Agent operates as an edge SDK. It makes decisions at the edge before forwarding requests to the origin or retrieving content from the origin. It also provides automated [datafile](https://docs.developers.optimizely.com/feature-experimentation/docs/manage-config-datafile) management, including support for key-value (KV) stores. In this mode, the agent can handle tasks including:

*   Fetching content from the origin.
*   Caching content.
*   Returning content based on experiment and variation cache keys.
*   Managing cookie serialization.
*   Generating user IDs.
*   Embedding decisions in headers.

In Edge mode, Optimizely Edge Agent offers the following:

*   **Persistent cookie for sticky bucketing** – Optimizely Edge Agent can use a persistent cookie like the [Feature Experimentation SDK's user profile service](https://docs.developers.optimizely.com/feature-experimentation/docs/ensure-consistent-visitor-bucketing). This ensures that users consistently receive the same variation of an experiment across multiple visits for a seamless user experience.
    
*   **KV store user profile support** – Edge mode supports a KV store user profile, permitting advanced user targeting and personalization. This lets you store and retrieve user-specific data, enhancing the accuracy and relevance of experimentation decisions.
    
*   **Datafile management** – Hyrbid Serverless Agent can fetch the datafile from the Optimizely CDN and cache it for improved performance, or it can retrieve the datafile from the KV store. Optimizely Edge Agent includes a built-in API to listen to webhooks and automatically update the KV store, ensuring availability of the latest experiment configurations.
    
*   **Automated decision reconciliation** – Optimizely Edge Agent automatically reconciles previous bucketing decisions with the running active experiments included in the datafile. If it cannot match the serialized cookie decisions or decisions stored in the KV user profile storage to a running experiment, it removes those decisions from the cookie or KV store and includes new decisions when they are made. This automated process simplifies the management of sticky bucketing and ensures that it only considers relevant and active experiments.
    
*   **Flexible configuration** – You can configure Optimizely Edge Agent using headers and query parameters for both Edge and Agent modes.
    

With `POST` requests, Optimizely Edge Agent operates in as Optimizely Agent. In this mode, you can interact with an Optimizely Feature Experimentation SDK that functions as a serverless server within your content delivery network (CDN).

Optimizely Edge Agent offers the following:

*   **Serverless architecture** – Agent mode uses serverless architecture, eliminating the need for you to manage infrastructure or scaling. It automatically scales to handle varying traffic levels and ensures optimal performance without manual intervention.
    
*   **Remote decision making** – You can obtain experimentation decisions remotely by interacting with the Feature Experimentation SDK through Optimizely Edge Agent. This lets you access the full functionality of the Optimizely Feature Experimentation platform without embedding the SDK directly into your applications.
    
*   **Flexible configuration** – Optimizely Edge Agent is configurable using headers and query parameters for both Edge and Agent modes. Additionally, it supports JSON body payloads for `POST` requests in agent mode.
    

Updated about 2 months ago

* * *

*   [Table of Contents](#)
*   *   [Two modes of Optimizely Edge Agent](#two-modes-of-optimizely-edge-agent)
        *   [Edge mode (`GET` requests)](#edge-mode-get-requests)
        *   [Agent mode (`POST` requests)](#agent-mode-post-requests)