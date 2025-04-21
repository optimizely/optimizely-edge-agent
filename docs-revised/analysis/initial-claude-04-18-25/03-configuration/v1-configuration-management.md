# Configuration Management in v1

_Last Updated: 2025-04-18_

## Overview

The v1 Optimizely Edge Agent implements configuration management through the `RequestConfig` class, which extracts, merges, and prioritizes configuration from multiple sources using a cascading priority model. The configuration system is responsible for parsing and normalizing settings that control the agent's behavior.

## Configuration Source Priority

The v1 implementation uses a strict priority order for resolving configuration values:

1. **HTTP Headers** (highest priority)
2. **URL Query Parameters** (intermediate priority)
3. **Request Body** (for POST requests)
4. **Default Values** (lowest priority)

This prioritization is controlled by the `prioritizeHeadersOverQueryParams` setting (default: `true`).

## Core Components

### RequestConfig Class

The main configuration handler is implemented in `src/_config_/requestConfig.js` and follows this initialization sequence:

```javascript
async initialize(request) {
  this.queryParameters = await this.defineQueryParameters();
  this.configMetadata = await this.initializeConfigMetadata();

  // Initialize from sources in priority order
  await this.initializeFromHeaders();
  await this.initializeFromQueryParams();

  if (this.isPostMethod) {
    await this.loadRequestBody(request);
  }
  
  // Apply defaults and update metadata
  // ... 
  return request;
}
```

### Default Settings

Default values are defined in `src/_config_/defaultSettings.js` and include:

```javascript
const defaultSettings = {
  cdnProvider: 'cloudflare',
  optlyClientEngine: 'javascript-sdk/cloudflare-agent',
  sdkKeyHeader: 'X-Optimizely-SDK-Key',
  sdkKeyQueryParameter: 'sdkKey',
  kv_namespace: 'OPTLY_HYBRID_AGENT_KV',
  kv_user_profile_enabled: false,
  logLevel: 'debug',
  // ...and many more settings
};
```

## Configuration Parameters

The system supports a wide range of configuration parameters across different categories:

### Core SDK Configuration
- `sdkKey` - Optimizely SDK key for project identification
- `visitorId` - User identifier for decision-making
- `attributes` - User attributes for targeting
- `eventTags` - Additional data for event tracking
- `decideOptions` - Options affecting feature flag decision behavior

### Request Processing Options
- `overrideCache` - Controls whether to bypass caching
- `overrideVisitorId` - Controls whether to override stored visitor IDs
- `trimmedDecisions` - Controls whether to remove user context from decisions
- `enableResponseMetadata` - Controls inclusion of debug metadata in responses

### Header & Cookie Management
- `setResponseHeaders` - Controls whether to set decision headers in response
- `setResponseCookies` - Controls whether to set decision cookies in response
- `setRequestHeaders` - Controls whether to set headers for forwarded requests
- `setRequestCookies` - Controls whether to set cookies for forwarded requests

### Advanced Features
- `enableFlagsFromKV` - Controls whether to fetch flag keys from KV storage
- `datafileFromKV` - Controls whether to fetch datafile from KV storage
- `forcedDecisions` - Allows overriding Optimizely's decision algorithm
- `eventKey` - Event identifier for tracking

## Configuration Source Mapping

### HTTP Headers

The system recognizes numerous headers with the `X-Optimizely-` prefix:

```javascript
async initializeFromHeaders() {
  this.sdkKey = this.getHeader(this.settings.sdkKeyHeader);
  this.overrideCache = this.getHeader(this.settings.overrideCacheHeader) === 'true' ? true : false;
  this.overrideVisitorId = this.parseBoolean(this.getHeader(this.settings.overrideVisitorIdHeader));
  this.attributes = this.parseJson(this.getHeader(this.settings.attributesHeader));
  this.eventTags = this.parseJson(this.getHeader(this.settings.eventTagsHeader));
  // ... many more headers processed
}
```

Key headers include:
- `X-Optimizely-SDK-Key` - SDK key
- `X-Optimizely-Visitor-Id` - Visitor identifier
- `X-Optimizely-Attributes-Header` - User attributes (JSON)
- `X-Optimizely-Event-Tags-Header` - Event tags (JSON)
- `X-Optimizely-Decide-Options` - Decision options (JSON array)

### Query Parameters

URL query parameters provide an alternative way to configure the agent:

```javascript
async initializeFromQueryParams() {
  const qp = this.url.searchParams;
  const prioritizeHeaders = this.settings.prioritizeHeadersOverQueryParams;

  // Helper function to apply priority rules
  const updateValue = (currentValue, queryParamValue, defaultValue) => {
    if (!prioritizeHeaders && queryParamValue !== null) {
      return queryParamValue;
    }
    return currentValue || queryParamValue || defaultValue;
  };

  // Apply updates with priority handling
  this.overrideVisitorId = updateValue(
    this.overrideVisitorId,
    qp.get(this.queryParameters.overrideVisitorId) === 'true',
    this.settings.defaultOverrideVisitorId
  );
  
  // ... many more parameters processed
}
```

Key query parameters include:
- `sdkKey` - SDK key
- `visitorId` - Visitor identifier
- `keys` - Flag keys to decide (can appear multiple times)
- `decideAll` - Whether to decide all flags
- `trimmedDecisions` - Whether to remove user context from decisions

### Request Body

For POST requests, the body provides the lowest-priority source for configuration:

```javascript
async initializeFromBody() {
  if (this.body) {
    this.visitorId = this.visitorId || this.body.visitorId;
    this.overrideVisitorId = this.overrideVisitorId || this.body.overrideVisitorId || this.settings.defaultOverrideVisitorId;
    this.flagKeys = this.flagKeys.length > 0 ? this.flagKeys : this.body.flagKeys;
    this.sdkKey = this.sdkKey || this.body.sdkKey;
    this.eventKey = this.eventKey || this.body.eventKey;
    // ... many more body properties processed
  }
}
```

## Metadata Tracking

The v1 implementation tracks detailed metadata about configuration sources for debugging and auditing:

```javascript
async initializeConfigMetadata() {
  return {
    visitorId: '',
    visitorIdFrom: '',
    decideOptions: [],
    attributes: {},
    attributesFrom: '',
    eventTags: {},
    eventTagsFrom: '',
    sdkKey: '',
    sdkKeyFrom: '',
    datafileFrom: '',
    // ... many more metadata fields
  };
}
```

This metadata is conditionally included in responses when `enableResponseMetadata` is enabled.

## Validation

Unlike modern implementations, the v1 configuration system has minimal validation:

```javascript
parseBoolean(value, defaultValue = false) {
  if (value === null) return defaultValue;
  return value.toLowerCase() === 'true';
}

parseJson(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch (error) {
    logger().error('Failed to parse JSON:', error);
    return error;
  }
}
```

Input validation is limited to type conversion and basic error handling, without detailed validation rules or schema enforcement.

## Integration with CoreLogic

The `RequestConfig` instance is heavily used throughout `CoreLogic.js` to influence behavior:

```javascript
// In CoreLogic.js
async processRequest(request, env, ctx) {
  // Create and initialize the request configuration
  this.requestConfig = new RequestConfig(request, env, ctx, this.cdnAdapter, this.abstractionHelper);
  await this.requestConfig.initialize(request);

  // Extract key settings from config
  this.isDecideOperation = this.getIsDecideOperation(this.requestConfig.url.pathname);
  this.isPostMethod = this.requestConfig.method === 'POST';
  this.isGetMethod = this.requestConfig.method === 'GET';
  
  // Use config throughout request processing
  if (this.requestConfig.overrideCache) {
    // Special cache handling
  }
  
  if (this.requestConfig.trimmedDecisions) {
    // Remove sensitive data from decisions
  }
  
  // ... and many more decision points based on config
}
```

The configuration directly influences core behaviors including:
- Which mode (Edge vs Agent) to use
- How to handle visitor IDs
- Whether to cache responses
- Whether to forward requests to origin
- How to format responses

## Limitations of v1 Configuration

1. **Limited Type Safety**: JavaScript's dynamic typing allows type confusion and subtle bugs
2. **Minimal Validation**: Limited validation of configuration values leads to potential runtime errors
3. **Tight Coupling**: RequestConfig is tightly coupled to CoreLogic's implementation
4. **Inconsistent Error Handling**: Validation errors are logged but may be silently ignored
5. **Testing Challenges**: The complex configuration initialization makes unit testing difficult
6. **Limited Documentation**: Many configuration options lack clear documentation on acceptable values and effects

## Key Insights

The v1 configuration management provides a flexible but complex system that:

1. Prioritizes configuration sources in a consistent order
2. Handles a wide variety of settings that control agent behavior
3. Tracks detailed metadata for debugging
4. Supports both simple and complex (JSON) configuration values
5. Has limited formal validation, relying on defensive programming
6. Is tightly integrated with the monolithic CoreLogic implementation