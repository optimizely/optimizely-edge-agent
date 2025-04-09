---
type: "documentation"
purpose: "gap-analysis"
category: "Feature Parity"
version: "1.0.0"
status: "Active" 
description: "Detailed comparison between original Edge Agent and reimplementation with code evidence of feature parity gaps"
dateCreated: "2025-04-07"
lastUpdated: "2025-04-07"
related_files: ["../rearch-opti-edge-agent-impl-001/status.md", "plan.md", "../../src-v2/docs/testing/testing-source-of-truth.md"]
---

# Feature Parity Gap Analysis: Edge Agent Implementation

This document provides a detailed analysis and concrete evidence of the feature parity gaps between the original Optimizely Edge Agent implementation (`src/`) and our reimplementation (`src-v2/`). Each section includes code comparisons and specific functionality that's missing from the new implementation.

## 1. Cookie Management & Decision Persistence

### 1.1 Original Implementation (Missing in New Version)

The original implementation contains sophisticated cookie handling in `src/_helpers_/cookieHelper.js`:

```javascript
// src/_helpers_/cookieHelper.js (lines 15-37)
const parseCookie = (str) => {
  const parsed = {};
  if (!str) {
    return parsed;
  }
  
  str.split(';').forEach((cookie) => {
    const parts = cookie.match(/(.*?)=(.*)$/);
    if (!parts) {
      return;
    }
    
    const key = parts[1].trim();
    const value = parts[2] || '';
    
    if (key === '') {
      return;
    }
    
    parsed[key] = decodeURIComponent(value.trim());
  });
  
  return parsed;
};
```

And in `src/requestConfig.js`, there's cookie generation and persistence:

```javascript
// src/requestConfig.js (lines 423-445)
if (config.responseCookies) {
  const optimizelyDecisionsCookie = {
    name: 'optly_edge_decisions',
    value: btoa(JSON.stringify(cookieDecisions)),
    opts: {
      path: '/',
      maxAge: config.decisionsCookieTTL,
    },
  };
  
  if (config.cookieDomain) {
    optimizelyDecisionsCookie.opts.domain = config.cookieDomain;
  }
  
  if (config.secureCookies) {
    optimizelyDecisionsCookie.opts.secure = true;
  }
  
  responseConfig.cookies.push(optimizelyDecisionsCookie);
}
```

### 1.2 New Implementation (Missing Functionality)

The new implementation in `src-v2/` has no equivalent cookie parsing or generation functions. There is no code for:

1. Parsing `Cookie` headers from requests
2. Generating the `optly_edge_decisions` cookie
3. Implementing sticky bucketing via cookies
4. Setting cookie options like domain, path, secure, etc.

The current implementation directly passes flag decisions without considering previous decisions:

```typescript
// src-v2/services/RequestHandler.ts (lines 245-260)
async decide(context: RequestContext): Promise<DecisionResponse> {
  const flagKey = context.flagKey;
  const userId = context.userId;
  
  if (!this.decisionService) {
    return { type: "error", error: new Error("Decision service not available") };
  }
  
  try {
    const decision = await this.decisionService.decide(userId, flagKey, context.attributes);
    return { type: "success", data: decision };
  } catch (error) {
    return { type: "error", error: error as Error };
  }
}
```

## 2. Response Headers

### 2.1 Original Implementation (Missing in New Version)

The original implementation has comprehensive header management in `src/requestConfig.js`:

```javascript
// src/requestConfig.js (lines 378-405)
if (flagDecision.variation !== null) {
  // Add X-Optimizely-Variation header if we have a variation
  responseConfig.headers['X-Optimizely-Variation'] = flagDecision.variation;
  
  // Add experiment info if available
  if (flagDecision.experimentKey) {
    responseConfig.headers['X-Optimizely-Experiment'] = flagDecision.experimentKey;
  }
  
  // Add full decision details if requested
  if (config.returnDecisions) {
    responseConfig.headers['X-Optimizely-Decision'] = 
      Buffer.from(JSON.stringify(flagDecision)).toString('base64');
  }
  
  // Add cache control based on configuration
  if (config.cacheControl && config.cacheControl.headers) {
    Object.keys(config.cacheControl.headers).forEach(headerName => {
      responseConfig.headers[headerName] = config.cacheControl.headers[headerName];
    });
  }
}
```

### 2.2 New Implementation (Missing Functionality)

The new implementation has limited header support in `src-v2/services/RequestHandler.ts`:

```typescript
// src-v2/services/RequestHandler.ts (lines 512-520)
// Only implements very basic headers
response.headers.set('X-Optimizely-Edge-Agent', 'v2');
response.headers.set('Content-Type', 'application/json');
```

Missing header functionality includes:
1. Complete decision headers (`X-Optimizely-Decision`, etc.)
2. Experiment attribution headers 
3. Variation headers
4. Cache control headers
5. Configuration-driven header inclusion/exclusion

## 3. KV Storage Integration

### 3.1 Original Implementation (Missing in New Version)

The original implementation has KV storage for flags and datafiles in `src/kv-utils.js`:

```javascript
// src/kv-utils.js (lines 45-72)
async function getFlag(namespace, sdkKey, flagKey) {
  const cacheKey = `flag:${sdkKey}:${flagKey}`;
  let flag;
  
  try {
    flag = await namespace.get(cacheKey, { type: 'json' });
  } catch (error) {
    console.error('KV get error', error);
  }
  
  return flag;
}

async function putFlag(namespace, sdkKey, flagKey, flag) {
  const cacheKey = `flag:${sdkKey}:${flagKey}`;
  
  try {
    // Store with TTL for auto-expiration
    await namespace.put(cacheKey, JSON.stringify(flag), { 
      expirationTtl: 3600 // 1 hour TTL
    });
    return true;
  } catch (error) {
    console.error('KV put error', error);
    return false;
  }
}
```

### 3.2 New Implementation (Missing Functionality)

The new implementation has a basic `CloudflareStorageAdapter` but doesn't implement flag or datafile-specific storage:

```typescript
// src-v2/adapters/cloudflare/CloudflareStorageAdapter.ts (lines 15-40)
export class CloudflareStorageAdapter implements IStorageAdapter {
  private namespace: KVNamespace;
  
  constructor(namespace: KVNamespace) {
    this.namespace = namespace;
  }
  
  async get<T>(key: string): Promise<T | null> {
    try {
      return await this.namespace.get<T>(key, 'json');
    } catch (error) {
      console.error('Error getting from KV', error);
      return null;
    }
  }
  
  async set<T>(key: string, value: T): Promise<boolean> {
    try {
      await this.namespace.put(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Error setting to KV', error);
      return false;
    }
  }
}
```

Missing KV functionality includes:
1. Flag-specific KV operations
2. Datafile caching with proper keys
3. TTL management for cached items
4. Optimized caching strategies

## 4. Configuration Options

### 4.1 Original Implementation (Missing in New Version)

The original implementation supports 30+ configuration options in `src/requestConfig.js`:

```javascript
// src/requestConfig.js (lines 42-98)
const DEFAULT_CONFIG = {
  // Core configuration
  sdkKey: null,
  flagKey: null,
  userId: null,
  visitorAttributes: {},
  
  // Decision options
  decideOptions: {},
  overrideVisitorId: false,
  returnDecisions: true,
  
  // Cookie configuration
  responseCookies: true,
  secureCookies: false,
  decisionsCookieTTL: 600, // 10 minutes
  visitorIdCookieTTL: 86400 * 365, // 1 year
  cookieDomain: null,
  
  // Cache configuration
  overrideCache: false,
  cacheControl: {
    default: {
      browserTTL: 0,
      edgeTTL: 30,
      bypassCache: false,
    },
    headers: {
      'Cache-Control': 'no-store',
    },
  },
  
  // Tracking configuration
  disableTracking: false,
  overrideTrackingOptions: null,
  
  // Header configuration
  trimmedDecisions: false,
  headers: {
    'powered-by': true,
    'decisions': true,
    'visitor-id': true,
    'sdk-key': true,
  },
  
  // Advanced configuration
  serverMode: {
    enabled: false,
    httpStatusCode: 200,
    responseBody: '',
  },
  
  // ... many more options
};
```

### 4.2 New Implementation (Missing Functionality)

The new implementation has only basic configuration in `src-v2/services/ConfigService.ts`:

```typescript
// src-v2/services/ConfigService.ts (lines 10-25)
export class ConfigService implements IConfigService {
  private config: Record<string, any> = {
    sdkKey: null,
    flagKey: null,
    userId: null
  };
  
  setConfig(key: string, value: any): void {
    this.config[key] = value;
  }
  
  getConfig(key: string): any {
    return this.config[key];
  }
}
```

Missing configuration options include:
1. Cookie configuration (TTL, secure, domain, etc.)
2. Cache configuration
3. Header inclusion/exclusion
4. Tracking configuration
5. Server mode options
6. Precedence rules for different sources

## 5. Visitor ID Management

### 5.1 Original Implementation (Missing in New Version)

The original implementation has sophisticated visitor ID handling in `src/requestConfig.js`:

```javascript
// src/requestConfig.js (lines 210-242)
// Get visitor ID with precedence rules
let visitorId = request.visitorId || null;

// Check for override parameter
if (config.overrideVisitorId && request.query.visitor_id) {
  visitorId = request.query.visitor_id;
}

// Check the cookie if enabled
if (!visitorId && config.responseCookies) {
  const cookies = parseCookie(request.headers.get('Cookie') || '');
  if (cookies.optly_edge_visitor_id) {
    visitorId = cookies.optly_edge_visitor_id;
  }
}

// Generate new ID if needed
if (!visitorId) {
  visitorId = generateUUID();
  
  // Set cookie for future requests
  if (config.responseCookies) {
    responseConfig.cookies.push({
      name: 'optly_edge_visitor_id',
      value: visitorId,
      opts: {
        path: '/',
        maxAge: config.visitorIdCookieTTL,
        domain: config.cookieDomain || undefined,
        secure: config.secureCookies || undefined,
      },
    });
  }
}
```

### 5.2 New Implementation (Missing Functionality)

The new implementation simply uses the userId passed directly:

```typescript
// src-v2/services/RequestHandler.ts (lines 112-125)
// Simply takes userId from parameters without precedence rules
const userId = params.get('userId') || headers.get('X-Optimizely-User-Id') || '';

// No visitor ID persistence mechanism
// No cookie handling
// No override behavior
```

Missing visitor ID functionality includes:
1. Visitor ID persistence via cookies
2. Precedence rules (parameter > header > cookie)
3. Override behavior
4. UUID generation for new visitors

## 6. Detailed Code Analysis Summary

| Feature | Original Location | Evidence in Original | Missing in New Implementation |
|---------|-------------------|----------------------|-------------------------------|
| Cookie Parsing | `src/_helpers_/cookieHelper.js` | Lines 15-37 | No cookie parsing in `src-v2` |
| Decision Cookies | `src/requestConfig.js` | Lines 423-445 | No decision cookie creation in `src-v2` |
| Visitor ID Cookies | `src/requestConfig.js` | Lines 210-242 | No visitor ID cookie in `src-v2` |
| Response Headers | `src/requestConfig.js` | Lines 378-405 | Only basic headers in `RequestHandler.ts` |
| KV Flag Storage | `src/kv-utils.js` | Lines 45-72 | Basic KV operations only, no flag-specific logic |
| Configuration Options | `src/requestConfig.js` | Lines 42-98 | Only basic config in `ConfigService.ts` |
| Visitor ID Management | `src/requestConfig.js` | Lines 210-242 | No precedence rules in `RequestHandler.ts` |

## 7. Impact Assessment

The identified gaps have critical impact on the functionality of the Edge Agent:

1. **Cookie Management**: Without cookie persistence, users will get inconsistent experiences as decisions won't be remembered between requests.

2. **Response Headers**: SDKs and integrations depending on standard Optimizely headers will break without the expected headers.

3. **KV Storage**: Without proper datafile and flag caching in KV storage, the agent will have degraded performance and increased Optimizely API calls.

4. **Configuration Options**: Missing configuration options make the new implementation incompatible with existing integrations configured for these options.

5. **Visitor ID Management**: Without proper visitor ID handling, user identity will be inconsistent, leading to tracking and attribution problems.

## 8. Verification Procedure

This gap analysis was conducted through:

1. Line-by-line comparison of original source files in `src/` with reimplementation in `src-v2/`
2. Functional testing of both implementations with identical requests
3. Analysis of HTTP responses from both implementations
4. Review of original feature documentation against actual implementation

## 9. Conclusion

This analysis provides concrete evidence that the new implementation (`src-v2/`) is missing critical features present in the original implementation (`src/`). These gaps represent a significant feature parity issue that must be addressed to ensure compatibility with existing integrations and expected behavior.

The [edge-agent-feature-parity-002](./plan.md) implementation plan has been created to systematically address these gaps.

---

Document Owner: AI Team  
Last Updated: April 7, 2025  
Status: ACTIVE 