# Optimizely Edge Agent Configuration Options

The Optimizely Edge Agent supports a wide range of configuration options that can be provided through multiple sources:

1. **HTTP Headers** - Highest priority
2. **Query Parameters** - Overrides if headers don't provide a value
3. **Request Body** (for POST/PUT requests) - Lowest priority
4. **Default Values** - Used if no source provides a value

## Core Configuration Options

| Option | Type | Required | Description | Sources |
|--------|------|----------|-------------|---------|
| `sdkKey` | string | ✅ | Optimizely SDK key for the environment | Headers: `X-Optimizely-SDK-Key`, Query: `sdkKey`, Body |
| `visitorId` | string | | Visitor ID for decision targeting | Headers: `X-Optimizely-Visitor-Id`, Query: `visitorId`, Body |
| `userId` | string | | Alias for `visitorId` (deprecated) | Headers: `X-Optimizely-User-Id`, Query: `userId`, Body |
| `flagKey` | string | | Single flag key for decide operations | Headers: `X-Optimizely-Flag-Key`, Query: `flagKey`, Body |
| `flagKeys` | string[] | | Multiple flag keys for decide operations | Query: `keys` (can appear multiple times), Body |
| `attributes` | object | | User attributes for targeting | Headers: `X-Optimizely-Attributes`, Query: `attributes` (JSON), Body |
| `forcedDecisions` | object | | Forced decision overrides | Body only |

## Decision Options

| Option | Type | Default | Description | Sources |
|--------|------|---------|-------------|---------|
| `decideOptions` | string[] | `[]` | Options to pass to decide calls | Headers: `X-Optimizely-Decide-Options`, Query: `decideOptions`, Body |
| `decideAll` | boolean | `false` | Whether to decide all flags | Query: `decideAll`, Body |
| `enabledFlagsOnly` | boolean | `false` | Only include enabled flags in response | Query: `enabledFlagsOnly`, Body |
| `includeReasons` | boolean | `false` | Include decision reasons | Query: `includeReasons`, Body |
| `excludeVariables` | boolean | `false` | Exclude variables from decisions | Query: `excludeVariables`, Body |
| `disableDecisionEvent` | boolean | `false` | Disable decision events | Query: `disableDecisionEvent`, Body |
| `ignoreUserProfileService` | boolean | `false` | Ignore user profile service | Query: `ignoreUserProfileService`, Body |
| `trimmedDecisions` | boolean | `true` | Return trimmed decisions | Headers: `X-Optimizely-Trimmed-Decisions`, Query: `trimmedDecisions`, Body |

### Valid Decide Options

The following options can be included in the `decideOptions` array:

- `DISABLE_DECISION_EVENT` - Prevent impression events from being dispatched
- `ENABLED_FLAGS_ONLY` - Only include enabled flags in the response
- `INCLUDE_REASONS` - Include decision reasons in the response
- `EXCLUDE_VARIABLES` - Exclude variables from the response
- `IGNORE_USER_PROFILE_SERVICE` - Ignore the user profile service

These can be provided as a JSON array or comma-separated string in headers/query parameters.

## Event Tracking Options

| Option | Type | Required | Description | Sources |
|--------|------|----------|-------------|---------|
| `eventKey` | string | | Event key for tracking conversions | Headers: `X-Optimizely-Event-Key`, Query: `eventKey`, Body |
| `eventTags` | object | | Tags for tracked events | Headers: `X-Optimizely-Event-Tags`, Query: `eventTags` (JSON), Body |
| `value` | number | | Numeric value for conversion events | Query: `value`, Body |

## Response Control Options

| Option | Type | Default | Description | Sources |
|--------|------|---------|-------------|---------|
| `setResponseHeaders` | boolean | `true` | Whether to set response headers | Headers: `X-Optimizely-Set-Response-Headers`, Query: `setResponseHeaders`, Body |
| `setResponseCookies` | boolean | `true` | Whether to set response cookies | Headers: `X-Optimizely-Set-Response-Cookies`, Query: `setResponseCookies`, Body |
| `setRequestHeaders` | boolean | `true` | Whether to set request headers | Headers: `X-Optimizely-Set-Request-Headers`, Query: `setRequestHeaders`, Body |
| `setRequestCookies` | boolean | `true` | Whether to set request cookies | Headers: `X-Optimizely-Set-Request-Cookies`, Query: `setRequestCookies`, Body |

## Storage and Caching Options

| Option | Type | Default | Description | Sources |
|--------|------|---------|-------------|---------|
| `overrideCache` | boolean | `false` | Whether to override cache | Headers: `X-Optimizely-Override-Cache`, Query: `overrideCache`, Body |
| `enableFlagsFromKV` | boolean | `false` | Whether to enable flags from KV storage | Headers: `X-Optimizely-Flags-KV`, Query: `enableFlagsFromKV`, Body |
| `datafileFromKV` | boolean | `false` | Whether to retrieve datafile from KV | Headers: `X-Optimizely-Datafile-KV`, Query: `enableDatafileFromKV`, Body |

## Advanced Options

| Option | Type | Default | Description | Sources |
|--------|------|---------|-------------|---------|
| `enableResponseMetadata` | boolean | `true` | Include metadata in response | Headers: `X-Optimizely-Enable-Response-Metadata`, Query: `enableResponseMetadata`, Body |
| `datafileAccessToken` | string | | Access token for datafile retrieval | Headers: `X-Optimizely-Datafile-Access-Token`, Body |
| `serverMode` | string | | Server mode (edge or agent) | Query: `serverMode`, Body |
| `overrideVisitorId` | boolean | `false` | Override visitor ID with query parameter | Headers: `X-Optimizely-Override-Visitor-Id`, Query: `overrideVisitorId`, Body |
| `cdnVariationSettings` | object | | CDN variation settings | Body only |

## Using Configuration Options

### Examples

#### Using HTTP Headers

```http
GET /decide HTTP/1.1
Host: example.com
X-Optimizely-SDK-Key: ABC123
X-Optimizely-Visitor-Id: user-123
X-Optimizely-Flag-Key: my-feature
X-Optimizely-Attributes: {"country":"US","premium":true}
X-Optimizely-Decide-Options: ["ENABLED_FLAGS_ONLY","INCLUDE_REASONS"]
```

#### Using Query Parameters

```
GET /decide?sdkKey=ABC123&visitorId=user-123&keys=feature-1&keys=feature-2&enabledFlagsOnly=true
Host: example.com
```

#### Using Request Body (POST request)

```http
POST /decide HTTP/1.1
Host: example.com
Content-Type: application/json

{
  "sdkKey": "ABC123",
  "visitorId": "user-123",
  "flagKeys": ["feature-1", "feature-2"],
  "attributes": {
    "country": "US",
    "premium": true
  },
  "decideOptions": ["ENABLED_FLAGS_ONLY", "INCLUDE_REASONS"]
}
```

## Advanced Usage Patterns

### Forced Decisions

Forced decisions allow you to override the decision logic and force a specific variation for a flag. This is useful for testing and debugging.

```http
POST /decide HTTP/1.1
Host: example.com
Content-Type: application/json

{
  "sdkKey": "ABC123",
  "visitorId": "user-123",
  "flagKeys": ["my-feature"],
  "forcedDecisions": {
    "my-feature": {
      "variationKey": "variation-a"
    }
  }
}
```

### Complex Attributes

Attributes can be nested objects or contain arrays, but should not have circular references or be nested too deeply (max 5 levels):

```http
POST /decide HTTP/1.1
Host: example.com
Content-Type: application/json

{
  "sdkKey": "ABC123",
  "visitorId": "user-123",
  "flagKeys": ["pricing-model"],
  "attributes": {
    "user": {
      "country": "US",
      "state": "CA",
      "demographics": {
        "age": 32,
        "income_bracket": "high"
      }
    },
    "device": {
      "type": "mobile",
      "browser": "chrome",
      "version": 95
    },
    "purchase_history": [
      {"item": "shoes", "price": 89.99},
      {"item": "hat", "price": 24.99}
    ],
    "total_spent": 434.65
  }
}
```

### Event Tracking with Tags

When tracking events, you can include additional metadata as event tags:

```http
POST /track HTTP/1.1
Host: example.com
Content-Type: application/json

{
  "sdkKey": "ABC123",
  "visitorId": "user-123",
  "eventKey": "purchase",
  "eventTags": {
    "revenue": 99.99,
    "item_count": 3,
    "categories": ["clothing", "accessories"],
    "coupon_used": true
  }
}
```

### Multiple Flags with Different Options

You can request multiple flags with different options:

```
GET /decide?sdkKey=ABC123&visitorId=user-123&keys=feature-1&keys=feature-2&keys=feature-3&includeReasons=true&excludeVariables=true
Host: example.com
```

### CDN Variation Settings

For edge mode integration with a CDN:

```http
POST /decide HTTP/1.1
Host: example.com
Content-Type: application/json

{
  "sdkKey": "ABC123",
  "visitorId": "user-123",
  "serverMode": "edge",
  "cdnVariationSettings": {
    "cdnExperimentURL": "https://cdn.example.com/experiments/exp-1",
    "cdnResponseURL": "https://cdn.example.com/responses/resp-1",
    "enableURLBypassList": true,
    "bypassList": ["/api/*", "/admin/*"]
  }
}
```

## Validation and Error Handling

The Edge Agent validates all configuration options and follows these rules:

### Validation Rules

1. **Type Validation**: All options are validated for their expected types
   - `sdkKey` must be a non-empty string
   - `attributes` must be an object (not an array)
   - `flagKeys` must be an array of strings

2. **Required Fields**: Some fields are required
   - `sdkKey` is always required

3. **Value Constraints**:
   - `decideOptions` must contain only valid options
   - `serverMode` must be either "edge" or "agent"
   - URLs in `cdnVariationSettings` must be valid URLs
   - Attributes should not be nested more than 5 levels deep
   - Attributes should not contain circular references
   - String values should not exceed 10,000 characters

4. **Incompatible Options**:
   - Using both `flagKey` and `flagKeys` is not recommended (flagKey will be ignored)

### Common Issues and Resolutions

| Issue | Error Message | Resolution |
|-------|--------------|------------|
| Empty SDK Key | "SDK key is required and must be a string" | Provide a valid SDK key |
| Invalid Attributes | "Attributes must be an object" | Ensure attributes is a JSON object, not an array or primitive |
| Invalid Flag Keys | "Flag keys must be an array" | Ensure flagKeys is an array of strings |
| Invalid Decide Options | "Invalid decide options: X, Y" | Use only valid decide options |
| Too Deeply Nested Attributes | "Attributes are nested too deeply" | Flatten your attributes structure |
| Circular References | "Attributes contain circular references" | Remove circular references in your attributes |
| Very Large Values | "Attribute value exceeds maximum allowed size" | Reduce the size of your attribute values |

## Performance Considerations

1. **Request Size**: Large attribute objects or many flag keys can increase request size and processing time
2. **KV Storage**: Using `enableFlagsFromKV` and `datafileFromKV` options may add latency for KV storage access
3. **Response Headers**: Setting `setResponseHeaders` to `false` can reduce response size
4. **Trimmed Decisions**: Using `trimmedDecisions=true` reduces response size but includes less information

## Environment Variables and Defaults

You can configure some default behaviors through environment variables:

| Environment Variable | Type | Default | Description |
|----------------------|------|---------|-------------|
| `OPTIMIZELY_FLAGS_FROM_KV` | boolean | `false` | Default for enableFlagsFromKV |
| `OPTIMIZELY_DATAFILE_FROM_KV` | boolean | `false` | Default for datafileFromKV |
| `OPTIMIZELY_ENABLE_RESPONSE_METADATA` | boolean | `true` | Default for enableResponseMetadata |
| `OPTIMIZELY_PRIORITIZE_HEADERS` | boolean | `true` | Whether headers take precedence over query params |
| `OPTIMIZELY_COOKIE_EXPIRATION_DAYS` | number | `400` | Cookie expiration in days |

## Security Considerations

1. **SDK Key Protection**: The SDK key should be treated as a secret; consider using authentication methods when exposing the Edge Agent API
2. **User IDs**: Avoid using personally identifiable information (PII) in visitor IDs
3. **Attribute Limitations**: Be cautious about including sensitive data in attributes
4. **Rate Limiting**: Consider implementing rate limiting to prevent abuse

## Troubleshooting

### Request Debugging

When troubleshooting configuration issues:

1. Set `enableResponseMetadata=true` to include detailed metadata in the response
2. Check the response for validation warnings and errors
3. Use consistent casing for header names (though they're case-insensitive)
4. Ensure JSON in headers or query parameters is properly encoded

### Common HTTP Status Codes

| Status Code | Possible Cause |
|-------------|----------------|
| 400 | Invalid request (e.g., malformed JSON, invalid configuration) |
| 401 | Unauthorized (e.g., invalid SDK key) |
| 404 | Resource not found (e.g., flag key not found) |
| 500 | Server error (e.g., internal error) |

### Response Format with Errors

```json
{
  "error": "Configuration error",
  "details": "SDK key is required and must be a string",
  "metadata": {
    "validationResult": {
      "valid": false,
      "hasErrors": true,
      "issues": [
        {
          "type": "REQUIRED_FIELD_MISSING",
          "field": "sdkKey",
          "message": "SDK key is required and must be a string",
          "severity": "ERROR"
        }
      ]
    }
  }
}
``` 