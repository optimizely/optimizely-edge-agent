# Config Endpoint Postman Collection Update

## Overview

This document provides the complete JSON structure needed to add all the Config endpoint tests to the Optimizely Edge Agent v2 Postman collection. The Config endpoint provides dynamic access to OptimizelyConfig data with extensive query parameter support.

## Authentication Requirements

**CRITICAL**: All Config endpoint requests require admin token authentication.

### Required Headers for ALL Config Requests:
- `X-Optimizely-Enable-FEX: true`
- `X-Optimizely-Admin-Token: {{adminToken}}`

### SDK Key Options:
1. Header: `X-Optimizely-SDK-Key: {{sdkKey}}`
2. Query Parameter: `?sdkKey={{sdkKey}}`

## Collection Variables Required

Add these to your Postman environment:

```json
{
  "baseUrl": "https://your-edge-agent-deployment.workers.dev",
  "sdkKey": "your_optimizely_sdk_key",
  "adminToken": "your_admin_token_here",
  "testFeatureKey": "demo_flag_key",
  "testExperimentKey": "test_flag_experiment",
  "testFeatureId": "45932",
  "testExperimentId": "9300002165680"
}
```

## Complete Config Endpoint Tests Structure

I've started adding the Config endpoint tests folder to the collection. The complete structure should include:

### ⚙️ Config Endpoint Tests
- **01. Basic Operations** ✅ (Added)
- **02. Format Variations** (To be added)
- **03. Include Filtering** (To be added)
- **04. Exclude Filtering** (To be added)
- **05. Combined Filtering** (To be added)
- **06. Specific Resources** (To be added)
- **07. Lookup Operations** (To be added)
- **08. Reverse Lookups** (To be added)
- **09. Complex Queries** (To be added)
- **10. Error Cases** (To be added)
- **11. Edge Cases** (To be added)

## Requests Added to Basic Operations Folder:

1. ✅ **GET Basic Config - Full Response**
   - URL: `{{baseUrl}}/api/config?sdkKey={{sdkKey}}`
   - Tests: Status 200, JSON response, metadata presence, config data presence

2. ✅ **GET Basic Config - Summary Only**
   - URL: `{{baseUrl}}/api/config?sdkKey={{sdkKey}}&summary=true`
   - Tests: Summary structure validation

3. ✅ **GET Basic Config - SDK Key in Header**
   - URL: `{{baseUrl}}/api/config`
   - Uses SDK key in header instead of query parameter

4. ✅ **GET Basic Config - No Metadata**
   - URL: `{{baseUrl}}/api/config?sdkKey={{sdkKey}}&metadata=false`
   - Tests: Confirms metadata exclusion

## Remaining Requests to Add

### 02. Format Variations
```json
{
  "name": "02. Format Variations",
  "item": [
    {
      "name": "GET Config - Full Format",
      "request": {
        "method": "GET",
        "header": [
          {"key": "X-Optimizely-Enable-FEX", "value": "true"},
          {"key": "X-Optimizely-Admin-Token", "value": "{{adminToken}}"}
        ],
        "url": {
          "raw": "{{baseUrl}}/api/config?sdkKey={{sdkKey}}&format=full",
          "query": [
            {"key": "sdkKey", "value": "{{sdkKey}}"},
            {"key": "format", "value": "full", "description": "📝 Full detail level"}
          ]
        }
      }
    },
    {
      "name": "GET Config - Minimal Format",
      "request": {
        "method": "GET",
        "header": [
          {"key": "X-Optimizely-Enable-FEX", "value": "true"},
          {"key": "X-Optimizely-Admin-Token", "value": "{{adminToken}}"}
        ],
        "url": {
          "raw": "{{baseUrl}}/api/config?sdkKey={{sdkKey}}&format=minimal",
          "query": [
            {"key": "sdkKey", "value": "{{sdkKey}}"},
            {"key": "format", "value": "minimal", "description": "📝 Minimal detail level"}
          ]
        }
      }
    }
  ]
}
```

### 03. Include Filtering (Single Resources)
```json
{
  "name": "03. Include Filtering",
  "item": [
    {
      "name": "GET Config - Features Only",
      "request": {
        "method": "GET",
        "header": [
          {"key": "X-Optimizely-Enable-FEX", "value": "true"},
          {"key": "X-Optimizely-Admin-Token", "value": "{{adminToken}}"}
        ],
        "url": {
          "raw": "{{baseUrl}}/api/config?sdkKey={{sdkKey}}&include=features",
          "query": [
            {"key": "sdkKey", "value": "{{sdkKey}}"},
            {"key": "include", "value": "features", "description": "📝 Only include features"}
          ]
        }
      }
    },
    {
      "name": "GET Config - Experiments Only",
      "request": {
        "method": "GET",
        "header": [
          {"key": "X-Optimizely-Enable-FEX", "value": "true"},
          {"key": "X-Optimizely-Admin-Token", "value": "{{adminToken}}"}
        ],
        "url": {
          "raw": "{{baseUrl}}/api/config?sdkKey={{sdkKey}}&include=experiments",
          "query": [
            {"key": "sdkKey", "value": "{{sdkKey}}"},
            {"key": "include", "value": "experiments", "description": "📝 Only include experiments"}
          ]
        }
      }
    },
    {
      "name": "GET Config - Audiences Only",
      "request": {
        "method": "GET",
        "header": [
          {"key": "X-Optimizely-Enable-FEX", "value": "true"},
          {"key": "X-Optimizely-Admin-Token", "value": "{{adminToken}}"}
        ],
        "url": {
          "raw": "{{baseUrl}}/api/config?sdkKey={{sdkKey}}&include=audiences",
          "query": [
            {"key": "sdkKey", "value": "{{sdkKey}}"},
            {"key": "include", "value": "audiences", "description": "📝 Only include audiences"}
          ]
        }
      }
    },
    {
      "name": "GET Config - Events Only",
      "request": {
        "method": "GET",
        "header": [
          {"key": "X-Optimizely-Enable-FEX", "value": "true"},
          {"key": "X-Optimizely-Admin-Token", "value": "{{adminToken}}"}
        ],
        "url": {
          "raw": "{{baseUrl}}/api/config?sdkKey={{sdkKey}}&include=events",
          "query": [
            {"key": "sdkKey", "value": "{{sdkKey}}"},
            {"key": "include", "value": "events", "description": "📝 Only include events"}
          ]
        }
      }
    },
    {
      "name": "GET Config - Attributes Only",
      "request": {
        "method": "GET",
        "header": [
          {"key": "X-Optimizely-Enable-FEX", "value": "true"},
          {"key": "X-Optimizely-Admin-Token", "value": "{{adminToken}}"}
        ],
        "url": {
          "raw": "{{baseUrl}}/api/config?sdkKey={{sdkKey}}&include=attributes",
          "query": [
            {"key": "sdkKey", "value": "{{sdkKey}}"},
            {"key": "include", "value": "attributes", "description": "📝 Only include attributes"}
          ]
        }
      }
    },
    {
      "name": "GET Config - Features and Experiments",
      "request": {
        "method": "GET",
        "header": [
          {"key": "X-Optimizely-Enable-FEX", "value": "true"},
          {"key": "X-Optimizely-Admin-Token", "value": "{{adminToken}}"}
        ],
        "url": {
          "raw": "{{baseUrl}}/api/config?sdkKey={{sdkKey}}&include=features,experiments",
          "query": [
            {"key": "sdkKey", "value": "{{sdkKey}}"},
            {"key": "include", "value": "features,experiments", "description": "📝 Include multiple resources"}
          ]
        }
      }
    }
  ]
}
```

### 04. Exclude Filtering
```json
{
  "name": "04. Exclude Filtering",
  "item": [
    {
      "name": "GET Config - Exclude Audiences",
      "request": {
        "method": "GET",
        "header": [
          {"key": "X-Optimizely-Enable-FEX", "value": "true"},
          {"key": "X-Optimizely-Admin-Token", "value": "{{adminToken}}"}
        ],
        "url": {
          "raw": "{{baseUrl}}/api/config?sdkKey={{sdkKey}}&exclude=audiences",
          "query": [
            {"key": "sdkKey", "value": "{{sdkKey}}"},
            {"key": "exclude", "value": "audiences", "description": "📝 Exclude audiences from response"}
          ]
        }
      }
    },
    {
      "name": "GET Config - Exclude Events and Audiences",
      "request": {
        "method": "GET",
        "header": [
          {"key": "X-Optimizely-Enable-FEX", "value": "true"},
          {"key": "X-Optimizely-Admin-Token", "value": "{{adminToken}}"}
        ],
        "url": {
          "raw": "{{baseUrl}}/api/config?sdkKey={{sdkKey}}&exclude=audiences,events",
          "query": [
            {"key": "sdkKey", "value": "{{sdkKey}}"},
            {"key": "exclude", "value": "audiences,events", "description": "📝 Exclude multiple resources"}
          ]
        }
      }
    }
  ]
}
```

### 06. Specific Resources
```json
{
  "name": "06. Specific Resources",
  "item": [
    {
      "name": "GET Config - Specific Feature",
      "request": {
        "method": "GET",
        "header": [
          {"key": "X-Optimizely-Enable-FEX", "value": "true"},
          {"key": "X-Optimizely-Admin-Token", "value": "{{adminToken}}"}
        ],
        "url": {
          "raw": "{{baseUrl}}/api/config?sdkKey={{sdkKey}}&featureKey={{testFeatureKey}}",
          "query": [
            {"key": "sdkKey", "value": "{{sdkKey}}"},
            {"key": "featureKey", "value": "{{testFeatureKey}}", "description": "📝 Get specific feature by key"}
          ]
        }
      }
    },
    {
      "name": "GET Config - Specific Experiment",
      "request": {
        "method": "GET",
        "header": [
          {"key": "X-Optimizely-Enable-FEX", "value": "true"},
          {"key": "X-Optimizely-Admin-Token", "value": "{{adminToken}}"}
        ],
        "url": {
          "raw": "{{baseUrl}}/api/config?sdkKey={{sdkKey}}&experimentKey={{testExperimentKey}}",
          "query": [
            {"key": "sdkKey", "value": "{{sdkKey}}"},
            {"key": "experimentKey", "value": "{{testExperimentKey}}", "description": "📝 Get specific experiment by key"}
          ]
        }
      }
    }
  ]
}
```

### 07. Lookup Operations
```json
{
  "name": "07. Lookup Operations",
  "item": [
    {
      "name": "GET Config - Lookup Feature by Key",
      "request": {
        "method": "GET",
        "header": [
          {"key": "X-Optimizely-Enable-FEX", "value": "true"},
          {"key": "X-Optimizely-Admin-Token", "value": "{{adminToken}}"}
        ],
        "url": {
          "raw": "{{baseUrl}}/api/config?sdkKey={{sdkKey}}&lookup=key&value={{testFeatureKey}}&type=feature",
          "query": [
            {"key": "sdkKey", "value": "{{sdkKey}}"},
            {"key": "lookup", "value": "key", "description": "📝 Lookup method"},
            {"key": "value", "value": "{{testFeatureKey}}", "description": "📝 Value to search for"},
            {"key": "type", "value": "feature", "description": "📝 Resource type"}
          ]
        }
      }
    },
    {
      "name": "GET Config - Lookup Feature by ID",
      "request": {
        "method": "GET",
        "header": [
          {"key": "X-Optimizely-Enable-FEX", "value": "true"},
          {"key": "X-Optimizely-Admin-Token", "value": "{{adminToken}}"}
        ],
        "url": {
          "raw": "{{baseUrl}}/api/config?sdkKey={{sdkKey}}&lookup=id&value={{testFeatureId}}&type=feature",
          "query": [
            {"key": "sdkKey", "value": "{{sdkKey}}"},
            {"key": "lookup", "value": "id", "description": "📝 Lookup by ID"},
            {"key": "value", "value": "{{testFeatureId}}", "description": "📝 Feature ID to search for"},
            {"key": "type", "value": "feature", "description": "📝 Resource type"}
          ]
        }
      }
    }
  ]
}
```

### 10. Error Cases
```json
{
  "name": "10. Error Cases",
  "item": [
    {
      "name": "GET Config - No Admin Token (401 Error)",
      "event": [
        {
          "listen": "test",
          "script": {
            "exec": [
              "pm.test(\"Missing admin token should return 401\", function () {",
              "    pm.response.to.have.status(401);",
              "});",
              "",
              "pm.test(\"Error message should mention admin token\", function () {",
              "    const response = pm.response.json();",
              "    pm.expect(response.error).to.include(\"Admin token required\");",
              "});"
            ],
            "type": "text/javascript"
          }
        }
      ],
      "request": {
        "method": "GET",
        "header": [
          {"key": "X-Optimizely-Enable-FEX", "value": "true"}
        ],
        "url": {
          "raw": "{{baseUrl}}/api/config?sdkKey={{sdkKey}}",
          "query": [
            {"key": "sdkKey", "value": "{{sdkKey}}"}
          ]
        }
      }
    },
    {
      "name": "GET Config - Invalid Admin Token (401 Error)",
      "event": [
        {
          "listen": "test",
          "script": {
            "exec": [
              "pm.test(\"Invalid admin token should return 401\", function () {",
              "    pm.response.to.have.status(401);",
              "});"
            ],
            "type": "text/javascript"
          }
        }
      ],
      "request": {
        "method": "GET",
        "header": [
          {"key": "X-Optimizely-Enable-FEX", "value": "true"},
          {"key": "X-Optimizely-Admin-Token", "value": "invalid_token"}
        ],
        "url": {
          "raw": "{{baseUrl}}/api/config?sdkKey={{sdkKey}}",
          "query": [
            {"key": "sdkKey", "value": "{{sdkKey}}"}
          ]
        }
      }
    },
    {
      "name": "GET Config - No SDK Key (400 Error)",
      "event": [
        {
          "listen": "test",
          "script": {
            "exec": [
              "pm.test(\"Missing SDK key should return 400\", function () {",
              "    pm.response.to.have.status(400);",
              "});",
              "",
              "pm.test(\"Error message should mention SDK key\", function () {",
              "    const response = pm.response.json();",
              "    pm.expect(response.error).to.include(\"SDK key is required\");",
              "});"
            ],
            "type": "text/javascript"
          }
        }
      ],
      "request": {
        "method": "GET",
        "header": [
          {"key": "X-Optimizely-Enable-FEX", "value": "true"},
          {"key": "X-Optimizely-Admin-Token", "value": "{{adminToken}}"}
        ],
        "url": {
          "raw": "{{baseUrl}}/api/config"
        }
      }
    },
    {
      "name": "POST Config - Wrong Method (405 Error)",
      "event": [
        {
          "listen": "test",
          "script": {
            "exec": [
              "pm.test(\"Wrong method should return 405\", function () {",
              "    pm.response.to.have.status(405);",
              "});",
              "",
              "pm.test(\"Error message should mention method not allowed\", function () {",
              "    const response = pm.response.json();",
              "    pm.expect(response.error).to.include(\"Method not allowed\");",
              "});"
            ],
            "type": "text/javascript"
          }
        }
      ],
      "request": {
        "method": "POST",
        "header": [
          {"key": "X-Optimizely-Enable-FEX", "value": "true"},
          {"key": "X-Optimizely-Admin-Token", "value": "{{adminToken}}"}
        ],
        "url": {
          "raw": "{{baseUrl}}/api/config?sdkKey={{sdkKey}}",
          "query": [
            {"key": "sdkKey", "value": "{{sdkKey}}"}
          ]
        }
      }
    }
  ]
}
```

## Standard Test Scripts for Config Endpoints

Add these test scripts to validate the Config endpoint responses:

### Basic Success Tests
```javascript
// Basic response validation
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Response is JSON", function () {
    pm.response.to.be.json;
});

// Metadata validation (when metadata=true or not specified)
if (!pm.request.url.query.get("metadata") || pm.request.url.query.get("metadata") === "true") {
    pm.test("Response contains metadata", function () {
        const response = pm.response.json();
        pm.expect(response).to.have.property('metadata');
        pm.expect(response.metadata).to.have.property('revision');
        pm.expect(response.metadata).to.have.property('sdkKey');
        pm.expect(response.metadata).to.have.property('timestamp');
    });
}

// Summary mode validation
if (pm.request.url.query.get("summary") === "true") {
    pm.test("Summary response structure", function () {
        const response = pm.response.json();
        pm.expect(response).to.have.property('summary');
        pm.expect(response.summary).to.have.property('totalFeatures');
        pm.expect(response.summary).to.have.property('totalExperiments');
    });
}

// Feature-specific validation
if (pm.request.url.query.get("include") === "features" || pm.request.url.query.get("featureKey")) {
    pm.test("Features are present", function () {
        const response = pm.response.json();
        pm.expect(response).to.satisfy(function(res) {
            return res.features || res.feature;
        });
    });
}
```

### Error Case Tests
```javascript
// Test for authentication errors
if (!pm.request.headers.get("X-Optimizely-Admin-Token")) {
    pm.test("Missing admin token should return 401", function () {
        pm.response.to.have.status(401);
    });
    
    pm.test("Error message should mention admin token", function () {
        const response = pm.response.json();
        pm.expect(response.error).to.include("Admin token required");
    });
}

// Test for missing SDK key
if (!pm.request.url.query.get("sdkKey") && !pm.request.headers.get("X-Optimizely-SDK-Key")) {
    pm.test("Missing SDK key should return 400", function () {
        pm.response.to.have.status(400);
    });
}

// General error validation
pm.test("Error responses have error property", function () {
    if (pm.response.code >= 400) {
        pm.expect(pm.response.json()).to.have.property('error');
    }
});
```

## Implementation Status

✅ **Completed:**
- Basic Operations folder (4 requests) added to collection
- Authentication requirements documented
- Test scripts for basic operations

⏳ **Remaining Work:**
- Format Variations (2 requests)
- Include Filtering (6 requests)
- Exclude Filtering (2 requests)
- Combined Filtering (3 requests)
- Specific Resources (2 requests)
- Lookup Operations (4 requests)
- Reverse Lookups (2 requests)
- Complex Queries (3 requests)
- Error Cases (4 requests)
- Edge Cases (3 requests)

**Total: ~35 additional requests needed**

## Key Features Covered

1. **Authentication:** Admin token + SDK key requirements
2. **Response Control:** Summary mode, metadata inclusion/exclusion, format levels
3. **Content Filtering:** Include/exclude specific resource types
4. **Resource Lookups:** ID/key lookups and reverse lookups
5. **Error Handling:** Authentication failures, missing parameters, wrong methods
6. **Edge Cases:** Parameter combinations and contradictory settings

## Security Notes

- All requests require admin token authentication
- SDK key must be provided via header or query parameter
- Environment variables protect sensitive tokens
- Error responses properly handle authentication failures

This comprehensive test suite will ensure complete coverage of the Config endpoint functionality with proper authentication and error handling. 