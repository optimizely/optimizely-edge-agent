# Configureation settings for Optimizely Edge Agent
Configuration settings
----------------------

How to configure and customize Optimizely Edge Agent.

> 👍
> 
> Beta
> 
> 
> ----------
> 
> Optimizely Edge Agent is in beta. Apply on the [Optimizely beta signup page](https://www.optimizely.com/beta) or contact your Customer Success Manager.

Optimizely Edge Agent is a versatile solution that lets you configure and customize your experimentation and personalization efforts. The agent operates in the following two modes:

*   Edge mode for handling `GET` requests.
*   Agent mode for handling `POST` requests.

See the [Two modes of Optimizely Edge Agent](https://docs.developers.optimizely.com/feature-experimentation/docs/introduction-to-optimizely-edge-agent#two-modes-of-optimizely-edge-agent) documentation for more.

You can configure the Optimizely Edge Agent using three different methods:

*   **HTTP Headers** – Pass configuration settings as HTTP headers in the request, supported for edge mode (`GET` requests) and agent mode (`POST` requests).
*   **Query Parameters** – Pass configuration settings as query parameters in the request URL, supported for edge mode and agent mode.
*   **JSON Body (agent mode only)** – Pass configuration settings as a JSON object in the request body, supported for agent mode.

When Optimizely Edge Agent processes a request, it reads the configuration settings in the following order of priority:

1.  **HTTP Headers** – The agent first checks for configuration settings in the HTTP headers. If it finds a setting in the headers, that setting takes precedence over the same setting defined in query parameters or the JSON body.
2.  **Query Parameters** – If it does not find a configuration setting in the HTTP headers, the agent checks the query parameters. If it finds a setting in the query parameters not defined in the headers, it uses that setting.
3.  **JSON Body (agent mode only)** – If it does not find a configuration setting in the headers or query parameters, the agent looks for it in the JSON body of the request.

By following this order, Optimizely Edge Agent lets you have granular control over the configuration settings so you can override settings at various levels based on their specific requirements.

The `requestConfig.js` module reads and sets the necessary configuration settings that Optimizely Edge Agent uses to operate. It handles the extraction and parsing of configuration settings from the request's headers, query parameters, and JSON body (in agent mode).

In addition to the standard configuration settings, you can add any custom configuration settings you want to use in your specific implementation. The `requestConfig` object accessible in every handler and module throughout Optimizely Edge Agent automatically contains these custom settings.

This lets you have flexibility and extensibility to define and utilize their own configuration settings based on their specific requirements. The `requestConfig` object acts as a centralized repository for all configuration settings, making it convenient to access and use them in various parts of the codebase.

To add custom configuration settings, you can include them in the request's headers, query parameters, or JSON body (in agent mode), following the same format as the standard configuration settings. The `requestConfig.js` module automatically extracts and parses these custom settings, making them readily available in the `requestConfig` object.

With this capability, Optimizely Edge Agent lets you tailor the behavior and functionality of your implementation according to your specific needs for customization and adaptability.

The `requestConfig.js` module performs the following tasks:

1.  Initializes the request configuration based on headers, query parameters, and the JSON body for `POST` requests in agent mode.
2.  Defines the set of supported query parameters for configuration.
3.  Initializes metadata configuration for logging and debugging purposes.
4.  Initializes configuration settings from HTTP headers.
5.  Initializes configuration settings from URL query parameters.
6.  Loads the request body and initializes configuration settings from it, if the request method is `POST` and the content type is JSON (agent mode).

By centralizing the configuration handling in the `requestConfig.js` module, Optimizely Edge Agent ensures consistent and efficient settings management across different modes and request methods.

The following table provides an overview of the available configuration settings for Optimizely Edge Agent.



* Setting: sdkKey
  * Description: The datafile SDK key for the Optimizely project.
  * Headers: Yes
  * Query Parameters: Yes
  * JSON Body: Yes
* Setting: overrideCache
  * Description: Indicates whether to override the cache.
  * Headers: Yes
  * Query Parameters: Yes
  * JSON Body: Yes
* Setting: overrideVisitorId
  * Description: Indicates whether to override the visitor ID. Every request generates a new visitor ID. Used for development and testing.
  * Headers: Yes
  * Query Parameters: Yes
  * JSON Body: Yes
* Setting: attributes
  * Description: Custom attributes and audience conditions for the visitor.
  * Headers: Yes
  * Query Parameters: No
  * JSON Body: Yes
* Setting: eventTags
  * Description: Event tags for tracking and reporting.
  * Headers: Yes
  * Query Parameters: No
  * JSON Body: Yes
* Setting: datafileAccessToken
  * Description: Access token for retrieving the datafile.
  * Headers: Yes
  * Query Parameters: No
  * JSON Body: No
* Setting: enableOptimizelyHeader
  * Description: Indicates whether to enable Optimizely Experimentation.
  * Headers: Yes
  * Query Parameters: No
  * JSON Body: No
* Setting: decideOptions
  * Description: Options for the decide function.
  * Headers: Yes
  * Query Parameters: No
  * JSON Body: No
* Setting: visitorId
  * Description: The visitor ID for the request.
  * Headers: Yes
  * Query Parameters: Yes
  * JSON Body: Yes
* Setting: trimmedDecisions
  * Description: Indicates whether to trim the decisions.
  * Headers: Yes
  * Query Parameters: Yes
  * JSON Body: Yes
* Setting: enableFlagsFromKV
  * Description: Indicates whether to enable feature flags from the key-value store.
  * Headers: Yes
  * Query Parameters: No
  * JSON Body: Yes
* Setting: eventKey
  * Description: The event key for tracking and reporting.
  * Headers: Yes
  * Query Parameters: Yes
  * JSON Body: Yes
* Setting: datafileFromKV
  * Description: Indicates whether to retrieve the datafile from the key-value store.
  * Headers: Yes
  * Query Parameters: No
  * JSON Body: Yes
* Setting: enableRespMetadataHeader
  * Description: Indicates whether to enable response metadata.
  * Headers: Yes
  * Query Parameters: No
  * JSON Body: No
* Setting: setResponseCookies
  * Description: Indicates whether to set response cookies with bucketing decisions.
  * Headers: Yes
  * Query Parameters: Yes
  * JSON Body: Yes
* Setting: setResponseHeaders
  * Description: Indicates whether to set response headers with bucketing decisions.
  * Headers: Yes
  * Query Parameters: Yes
  * JSON Body: Yes
* Setting: setRequestHeaders
  * Description: Indicates whether to set request headers with bucketing decisions.
  * Headers: Yes
  * Query Parameters: Yes
  * JSON Body: Yes
* Setting: setRequestCookies
  * Description: Indicates whether to set request cookies with bucketing decisions.
  * Headers: Yes
  * Query Parameters: Yes
  * JSON Body: Yes
* Setting: serverMode
  * Description: The server mode for the agent (Edge or Agent).
  * Headers: No
  * Query Parameters: Yes
  * JSON Body: No
* Setting: flagKeys
  * Description: The specific flag keys to evaluate.
  * Headers: No
  * Query Parameters: Yes (multi-valued)
  * JSON Body: Yes
* Setting: enableResponseMetadata
  * Description: Indicates whether to enable response metadata.
  * Headers: Yes
  * Query Parameters: Yes
  * JSON Body: Yes
* Setting: decideAll
  * Description: Indicates whether to evaluate all flag keys.
  * Headers: No
  * Query Parameters: Yes
  * JSON Body: Yes
* Setting: disableDecisionEvent
  * Description: Indicates whether to disable the decision event.
  * Headers: No
  * Query Parameters: Yes
  * JSON Body: Yes
* Setting: enabledFlagsOnly
  * Description: Indicates whether to return only enabled flag keys.
  * Headers: No
  * Query Parameters: Yes
  * JSON Body: Yes
* Setting: includeReasons
  * Description: Indicates whether to include reasons for flag decisions.
  * Headers: No
  * Query Parameters: Yes
  * JSON Body: Yes
* Setting: ignoreUserProfileService
  * Description: Indicates whether to ignore the user profile service.
  * Headers: No
  * Query Parameters: Yes
  * JSON Body: Yes
* Setting: excludeVariables
  * Description: Indicates whether to exclude variables from the response.
  * Headers: Yes
  * Query Parameters: Yes
  * JSON Body: Yes
* Setting: forcedDecisions
  * Description: Forced decisions for specific flag keys.
  * Headers: No
  * Query Parameters: No
  * JSON Body: Yes


Updated about 2 months ago

* * *

*   [Table of Contents](#)
*   *   [Configuration methods](#configuration-methods)
    *   [Priority of configuration settings](#priority-of-configuration-settings)
    *   [`requestConfig.js` module](#requestconfigjs-module)
    *   [Configuration settings](#configuration-settings)