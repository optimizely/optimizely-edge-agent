# Parameter Validation Test Results

Test Date: Invalid Date

## Summary

- Edge Agent URL: `https://edge-agent-test.expedge.workers.dev`
- SDK Key: `8mR1pGh8u2ztUP8GqjmQq`
- Results: 1/6 tests passed (17%)

## Test Results

### Other

#### Environment Variables - ✅ PASS

Verify that environment variables are properly resolved

**Details:**

```
{
  "resolvedEdgeAgentUrl": "https://edge-agent-test.expedge.workers.dev",
  "resolvedSdkKey": "8mR1pGh8u2ztUP8GqjmQq",
  "envEdgeAgentUrl": "https://edge-agent-test.expedge.workers.dev",
  "envSdkKey": "8mR1pGh8u2ztUP8GqjmQq",
  "usingDefaults": false
}
```

### Header Parameters

#### Header Parameters - ❌ FAIL

Verify that the Edge Agent correctly processes HTTP header parameters

**Details:**

```
{
  "responses": [
    {
      "name": "SDK Key Header",
      "status": 200,
      "isCloudflare": true,
      "headers": {
        "X-Optimizely-SDK-Key": "8mR1pGh8u2ztUP8GqjmQq"
      },
      "body": {
        "name": "optimizely-edge-agent",
        "version": "v2",
        "environment": "test",
        "cdnProvider": "cloudflare"
      }
    },
    {
      "name": "User ID Header",
      "status": 501,
      "isCloudflare": true,
      "headers": {
        "X-Optimizely-SDK-Key": "8mR1pGh8u2ztUP8GqjmQq",
        "X-Optimizely-Visitor-Id": "test-user-329450",
        "Content-Type": "application/json"
      },
      "body": {
        "error": "API request handling not implemented in RequestHandler",
        "path": "/api/decide"
      }
    },
    {
      "name": "Custom Headers",
      "status": 501,
      "isCloudflare": true,
      "headers": {
        "X-Optimizely-SDK-Key": "8mR1pGh8u2ztUP8GqjmQq",
        "X-Optimizely-Visitor-Id": "test-user-329450",
        "X-Optimizely-Context-Type": "browser",
        "X-Optimizely-Skip-Activation": "true",
        "Content-Type": "application/json"
      },
      "body": {
        "error": "API request handling not implemented in RequestHandler",
        "path": "/api/decide"
      }
    }
  ],
  "allCloudflare": true
}
```

**Error:**

```
One or more header parameter tests failed
```

### Query Parameters

#### Query Parameters - ❌ FAIL

Verify that the Edge Agent correctly processes query parameters

**Details:**

```
{
  "responses": [
    {
      "name": "SDK Key Query Parameter",
      "status": 200,
      "isCloudflare": true,
      "url": "https://edge-agent-test.expedge.workers.dev/api/sdk?optimizely_sdk_key=8mR1pGh8u2ztUP8GqjmQq",
      "body": {
        "name": "optimizely-edge-agent",
        "version": "v2",
        "environment": "test",
        "cdnProvider": "cloudflare"
      }
    },
    {
      "name": "User ID Query Parameter",
      "status": 501,
      "isCloudflare": true,
      "url": "https://edge-agent-test.expedge.workers.dev/api/decide?optimizely_sdk_key=8mR1pGh8u2ztUP8GqjmQq&optimizely_user_id=test-user-329450",
      "body": {
        "error": "API request handling not implemented in RequestHandler",
        "path": "/api/decide"
      }
    },
    {
      "name": "Skip Activation Query Parameter",
      "status": 501,
      "isCloudflare": true,
      "url": "https://edge-agent-test.expedge.workers.dev/api/decide?optimizely_sdk_key=8mR1pGh8u2ztUP8GqjmQq&optimizely_user_id=test-user-329450&optimizely_skip_activation=true",
      "body": {
        "error": "API request handling not implemented in RequestHandler",
        "path": "/api/decide"
      }
    }
  ],
  "allCloudflare": true
}
```

**Error:**

```
One or more query parameter tests failed
```

### JSON Body Parameters

#### JSON Body Parameters - ❌ FAIL

Verify that the Edge Agent correctly processes JSON body parameters

**Details:**

```
{
  "responses": [
    {
      "name": "Basic JSON Body",
      "status": 501,
      "isCloudflare": true,
      "requestBody": "{\"userId\":\"test-user-329450\",\"key\":\"test-flag\"}",
      "responseBody": {
        "error": "API request handling not implemented in RequestHandler",
        "path": "/api/decide"
      }
    },
    {
      "name": "JSON Body with Attributes",
      "status": 501,
      "isCloudflare": true,
      "requestBody": "{\"userId\":\"test-user-329450\",\"key\":\"test-flag\",\"attributes\":{\"browser\":\"Chrome\",\"location\":\"US\"}}",
      "responseBody": {
        "error": "API request handling not implemented in RequestHandler",
        "path": "/api/decide"
      }
    },
    {
      "name": "JSON Body with Options",
      "status": 501,
      "isCloudflare": true,
      "requestBody": "{\"userId\":\"test-user-329450\",\"key\":\"test-flag\",\"options\":{\"includeReasons\":true,\"skipActivation\":true}}",
      "responseBody": {
        "error": "API request handling not implemented in RequestHandler",
        "path": "/api/decide"
      }
    }
  ],
  "allCloudflare": true
}
```

**Error:**

```
One or more JSON body parameter tests failed
```

### Parameter Precedence

#### Parameter Precedence - ❌ FAIL

Verify that the Edge Agent correctly handles parameter precedence

**Details:**

```
{
  "responses": [
    {
      "name": "Header vs Query Parameter",
      "status": 501,
      "isCloudflare": true,
      "headers": {
        "X-Optimizely-SDK-Key": "8mR1pGh8u2ztUP8GqjmQq",
        "X-Optimizely-Visitor-Id": "header-user",
        "Content-Type": "application/json"
      },
      "queryParams": {
        "optimizely_user_id": "query-user"
      },
      "requestBody": {
        "key": "test-flag"
      },
      "responseBody": {
        "error": "API request handling not implemented in RequestHandler",
        "path": "/api/decide"
      },
      "expectedSource": "header"
    },
    {
      "name": "Header vs JSON Body",
      "status": 501,
      "isCloudflare": true,
      "headers": {
        "X-Optimizely-SDK-Key": "8mR1pGh8u2ztUP8GqjmQq",
        "X-Optimizely-Visitor-Id": "header-user",
        "Content-Type": "application/json"
      },
      "requestBody": {
        "userId": "body-user",
        "key": "test-flag"
      },
      "responseBody": {
        "error": "API request handling not implemented in RequestHandler",
        "path": "/api/decide"
      },
      "expectedSource": "header"
    },
    {
      "name": "Query Parameter vs JSON Body",
      "status": 501,
      "isCloudflare": true,
      "headers": {
        "X-Optimizely-SDK-Key": "8mR1pGh8u2ztUP8GqjmQq",
        "Content-Type": "application/json"
      },
      "queryParams": {
        "optimizely_user_id": "query-user"
      },
      "requestBody": {
        "userId": "body-user",
        "key": "test-flag"
      },
      "responseBody": {
        "error": "API request handling not implemented in RequestHandler",
        "path": "/api/decide"
      },
      "expectedSource": "query"
    }
  ],
  "allCloudflare": true
}
```

**Error:**

```
One or more parameter precedence tests failed
```

### Parameter Format Variations

#### Parameter Format Variations - ❌ FAIL

Verify that the Edge Agent handles different parameter format variations

**Details:**

```
{
  "responses": [
    {
      "name": "Boolean as String",
      "status": 501,
      "isCloudflare": true,
      "requestBody": {
        "userId": "test-user-329450",
        "key": "test-flag",
        "options": {
          "skipActivation": "true"
        }
      },
      "responseBody": {
        "error": "API request handling not implemented in RequestHandler",
        "path": "/api/decide"
      }
    },
    {
      "name": "Boolean as Boolean",
      "status": 501,
      "isCloudflare": true,
      "requestBody": {
        "userId": "test-user-329450",
        "key": "test-flag",
        "options": {
          "skipActivation": true
        }
      },
      "responseBody": {
        "error": "API request handling not implemented in RequestHandler",
        "path": "/api/decide"
      }
    },
    {
      "name": "Empty Attributes",
      "status": 501,
      "isCloudflare": true,
      "requestBody": {
        "userId": "test-user-329450",
        "key": "test-flag",
        "attributes": {}
      },
      "responseBody": {
        "error": "API request handling not implemented in RequestHandler",
        "path": "/api/decide"
      }
    },
    {
      "name": "Null Attributes",
      "status": 501,
      "isCloudflare": true,
      "requestBody": {
        "userId": "test-user-329450",
        "key": "test-flag",
        "attributes": null
      },
      "responseBody": {
        "error": "API request handling not implemented in RequestHandler",
        "path": "/api/decide"
      }
    }
  ],
  "allCloudflare": true
}
```

**Error:**

```
One or more parameter format variation tests failed
```

