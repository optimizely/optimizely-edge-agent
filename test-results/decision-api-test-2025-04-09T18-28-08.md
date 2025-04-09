# Decision API Test Results

Test Date: Invalid Date

## Summary

- Edge Agent URL: `https://edge-agent-test.expedge.workers.dev`
- SDK Key: `8mR1pGh8u2ztUP8GqjmQq`
- Feature Keys: `test-flag`, `homepage-test`, `product-test`
- Experiment Keys: `ab-test-1`, `feature-test-1`
- Results: 1/7 tests passed (14%)

## Test Results

### Other

#### Environment Variables - ✅ PASS

Verify that environment variables are properly resolved

**Details:**

```
{
  "resolvedEdgeAgentUrl": "https://edge-agent-test.expedge.workers.dev",
  "resolvedSdkKey": "8mR1pGh8u2ztUP8GqjmQq",
  "resolvedFeatureKeys": [
    "test-flag",
    "homepage-test",
    "product-test"
  ],
  "resolvedExperimentKeys": [
    "ab-test-1",
    "feature-test-1"
  ],
  "envEdgeAgentUrl": "https://edge-agent-test.expedge.workers.dev",
  "envSdkKey": "8mR1pGh8u2ztUP8GqjmQq",
  "envFeatureKeys": "(not set)",
  "envExperimentKeys": "(not set)",
  "usingDefaults": false
}
```

### /api/decide

#### Feature Flag Decisions - ❌ FAIL

Verify that the Edge Agent can provide feature flag decisions

**Details:**

```
{
  "testUser": {
    "userId": "test-user-981249",
    "attributes": {
      "browser": "Chrome",
      "location": "US"
    }
  },
  "responses": [
    {
      "featureKey": "test-flag",
      "status": 501,
      "isCloudflare": true,
      "decision": {
        "error": "API request handling not implemented in RequestHandler",
        "path": "/api/decide"
      }
    },
    {
      "featureKey": "homepage-test",
      "status": 501,
      "isCloudflare": true,
      "decision": {
        "error": "API request handling not implemented in RequestHandler",
        "path": "/api/decide"
      }
    },
    {
      "featureKey": "product-test",
      "status": 501,
      "isCloudflare": true,
      "decision": {
        "error": "API request handling not implemented in RequestHandler",
        "path": "/api/decide"
      }
    }
  ]
}
```

**Error:**

```
One or more flag decisions failed
```

#### Experiment Decisions - ❌ FAIL

Verify that the Edge Agent can provide experiment variation decisions

**Details:**

```
{
  "testUser": {
    "userId": "test-user-981249",
    "attributes": {
      "browser": "Chrome",
      "location": "US"
    }
  },
  "responses": [
    {
      "experimentKey": "ab-test-1",
      "status": 501,
      "isCloudflare": true,
      "decision": {
        "error": "API request handling not implemented in RequestHandler",
        "path": "/api/decide"
      }
    },
    {
      "experimentKey": "feature-test-1",
      "status": 501,
      "isCloudflare": true,
      "decision": {
        "error": "API request handling not implemented in RequestHandler",
        "path": "/api/decide"
      }
    }
  ]
}
```

**Error:**

```
One or more experiment decisions failed
```

#### User Targeting - ❌ FAIL

Verify that the Edge Agent handles user targeting with different attributes

**Details:**

```
{
  "testFeatureKey": "test-flag",
  "testExperimentKey": "ab-test-1",
  "responses": [
    {
      "userId": "test-user-981249",
      "attributes": {
        "browser": "Chrome",
        "location": "US"
      },
      "featureDecision": {
        "error": "API request handling not implemented in RequestHandler",
        "path": "/api/decide"
      },
      "experimentDecision": {
        "error": "API request handling not implemented in RequestHandler",
        "path": "/api/decide"
      }
    },
    {
      "userId": "test-user-225740",
      "attributes": {
        "browser": "Firefox",
        "location": "UK"
      },
      "featureDecision": {
        "error": "API request handling not implemented in RequestHandler",
        "path": "/api/decide"
      },
      "experimentDecision": {
        "error": "API request handling not implemented in RequestHandler",
        "path": "/api/decide"
      }
    }
  ]
}
```

**Error:**

```
One or more user targeting tests failed
```

#### Decision Options - ❌ FAIL

Verify that the Edge Agent supports decision options parameters

**Details:**

```
{
  "testUser": {
    "userId": "test-user-981249",
    "attributes": {
      "browser": "Chrome",
      "location": "US"
    }
  },
  "testFeatureKey": "test-flag",
  "responses": [
    {
      "testCase": "Include Reasons",
      "options": {
        "includeReasons": true
      },
      "status": 501,
      "isCloudflare": true,
      "decision": {
        "error": "API request handling not implemented in RequestHandler",
        "path": "/api/decide"
      }
    },
    {
      "testCase": "Enable Debug",
      "options": {
        "enableDebug": true
      },
      "status": 501,
      "isCloudflare": true,
      "decision": {
        "error": "API request handling not implemented in RequestHandler",
        "path": "/api/decide"
      }
    },
    {
      "testCase": "Multiple Options",
      "options": {
        "includeReasons": true,
        "enableDebug": true
      },
      "status": 501,
      "isCloudflare": true,
      "decision": {
        "error": "API request handling not implemented in RequestHandler",
        "path": "/api/decide"
      }
    }
  ]
}
```

**Error:**

```
One or more decision options tests failed
```

### /api/decide-all

#### Decide All Endpoint - ❌ FAIL

Verify that the decide-all endpoint returns decisions for all features

**Details:**

```
{
  "testUser": {
    "userId": "test-user-981249",
    "attributes": {
      "browser": "Chrome",
      "location": "US"
    }
  },
  "response": {
    "status": 501,
    "isCloudflare": true
  },
  "hasAllFeatures": false
}
```

**Error:**

```
Decide-all endpoint failed
```

### /api/decide-for-keys

#### Decide For Keys Endpoint - ❌ FAIL

Verify that the decide-for-keys endpoint returns decisions for specified keys

**Details:**

```
{
  "testUser": {
    "userId": "test-user-981249",
    "attributes": {
      "browser": "Chrome",
      "location": "US"
    }
  },
  "requestedKeys": [
    "test-flag",
    "homepage-test",
    "product-test"
  ],
  "response": {
    "status": 501,
    "isCloudflare": true
  },
  "hasAllRequestedKeys": false
}
```

**Error:**

```
Decide-for-keys endpoint failed
```

