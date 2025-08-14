# Edge Mode Configuration

## Overview

Edge Mode enables the Optimizely Edge Agent to intercept requests and serve different content variants based on experimentation decisions. Rather than transforming content, it determines which content source to use (origin server vs alternative URLs) based on the `cdnVariationSettings` configuration. This document covers all Edge Mode configuration options, URL matching patterns, and content routing rules.

## Edge Mode Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Edge Mode Request Flow                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Request ──▶ URL Matcher ──▶ Decision Engine ──▶ Content Router ──▶ Response │
│                   │                 │                    │                   │
│                   ▼                 ▼                    ▼                   │
│            Pattern Rules      User Context        cdnVariationSettings      │
│              Matching          Decisions           Content Source           │
│                                                                              │
│  Configuration Points:                                                       │
│  ┌─────────────────┬────────────────────┬─────────────────────┐           │
│  │  URL Patterns   │  Decision Rules    │  Content Routing    │           │
│  ├─────────────────┼────────────────────┼─────────────────────┤           │
│  │ • Path matching │ • Flag mappings    │ • Origin vs CDN     │           │
│  │ • Query params  │ • User attributes  │ • Cache control     │           │
│  │ • Headers       │ • Forced decisions │ • Response URLs     │           │
│  └─────────────────┴────────────────────┴─────────────────────┘           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Basic Configuration

### Enabling Edge Mode

```typescript
// Environment variable
export ENABLE_EDGE_MODE="true"

// Configuration object
const config = {
  enableEdgeMode: true,
  edgeModeConfig: {
    // URL patterns to intercept
    urlPatterns: [
      '/*',           // All paths
      '/products/*',  // Products section
      '/checkout'     // Specific page
    ],
    
    // Exclude patterns
    excludePatterns: [
      '/api/*',       // API routes
      '/admin/*',     // Admin section
      '*.json'        // JSON files
    ]
  }
};
```

## URL Matching Configuration

### Pattern Syntax

```typescript
// From: /src-v2/services/implementations/URLMatcher.ts
interface URLPattern {
  pattern: string;           // Pattern to match
  flags?: string[];         // Feature flags to evaluate
  cache?: number;          // Cache TTL override
}

// Pattern examples
const patterns: URLPattern[] = [
  // Exact match
  { pattern: '/home', flags: ['homepage_redesign'] },
  
  // Wildcard match
  { pattern: '/products/*', flags: ['product_recommendations'] },
  
  // Parameter match
  { pattern: '/user/:id', flags: ['user_profile_v2'] },
  
  // Regex match
  { pattern: /^\/blog\/\d{4}\/\d{2}\/.*/, flags: ['blog_layout'] },
  
  // Query parameter match
  { pattern: '/*?preview=true', flags: ['preview_mode'], cache: 0 }
];
```

### Advanced Matching

```typescript
// From: /src-v2/services/implementations/EdgeModeHandler.ts
interface AdvancedMatchConfig {
  // Match conditions
  conditions: {
    path?: string | RegExp;
    method?: string[];
    headers?: Record<string, string | RegExp>;
    query?: Record<string, string | RegExp>;
    cookies?: Record<string, string | RegExp>;
  };
  
  // Actions when matched
  actions: {
    evaluate: string[];        // Feature flags to evaluate
    transform: boolean;        // Apply transformations
    headers: Record<string, string>; // Add headers
    cookies: CookieConfig[];   // Set cookies
  };
}

// Example configuration
const advancedConfig: AdvancedMatchConfig[] = [
  {
    conditions: {
      path: '/checkout',
      method: ['GET', 'POST'],
      cookies: { session: /.+/ }  // Has session cookie
    },
    actions: {
      evaluate: ['checkout_flow_v2', 'payment_options'],
      transform: true,
      headers: {
        'X-Checkout-Version': 'v2'
      }
    }
  }
];
```

## Content Routing with cdnVariationSettings

### Overview

Edge Mode uses the `cdnVariationSettings` variable from feature flags to determine content routing. This is NOT content transformation - it's intelligent content source selection.

### cdnVariationSettings Structure

```javascript
// From feature flag variable configuration
{
  "cdnVariationSettings": {
    "cdnExperimentURL": "https://example.com/products/*",    // URL pattern to intercept
    "cdnResponseURL": "https://example.com/products-v2/*",   // Alternative content source
    "cacheKey": "products_experiment_v2",                     // Unique cache identifier
    "cacheTTL": 3600,                                         // Cache duration in seconds
    "forwardRequestToOrigin": "true",                         // Fetch from origin if true
    "cacheRequestToOrigin": "true",                           // Cache the origin response
    "isControlVariation": "false"                             // Indicates control/treatment
  }
}
```

### Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `cdnExperimentURL` | string | URL pattern that triggers this experiment |
| `cdnResponseURL` | string | Alternative content source URL |
| `cacheKey` | string | Unique identifier for caching this variation |
| `cacheTTL` | number | Time-to-live for cached content (seconds) |
| `forwardRequestToOrigin` | string | "true" to fetch from origin, "false" to use cdnResponseURL |
| `cacheRequestToOrigin` | string | "true" to cache the fetched content |
| `isControlVariation` | string | "true" for control, "false" for treatment |

### Content Routing Logic

```typescript
// Simplified routing logic in EdgeModeHandler
async function routeContent(request: Request, cdnSettings: CdnVariationSettings) {
  // Check cache first
  const cachedContent = await cache.get(cdnSettings.cacheKey);
  if (cachedContent && !isExpired(cachedContent, cdnSettings.cacheTTL)) {
    return cachedContent;
  }
  
  // Determine content source
  let contentUrl: string;
  if (cdnSettings.forwardRequestToOrigin === "true") {
    // Use original request URL (origin)
    contentUrl = request.url;
  } else {
    // Use alternative content source
    contentUrl = cdnSettings.cdnResponseURL;
  }
  
  // Fetch content
  const response = await fetch(contentUrl);
  
  // Cache if configured
  if (cdnSettings.cacheRequestToOrigin === "true") {
    await cache.put(cdnSettings.cacheKey, response, {
      expirationTtl: cdnSettings.cacheTTL
    });
  }
  
  return response;
}
```

## Cookie Configuration

### Cookie-Based Variations

```typescript
// From: /src-v2/services/implementations/CookieService.ts
interface EdgeModeCookieConfig {
  // Cookie settings
  cookiePrefix: string;           // Default: 'optimizely_'
  cookieDomain: string;          // Default: current domain
  cookiePath: string;            // Default: '/'
  cookieSecure: boolean;         // Default: true
  cookieSameSite: 'strict' | 'lax' | 'none'; // Default: 'lax'
  cookieMaxAge: number;          // Default: 7776000 (90 days)
  
  // Variation persistence
  persistVariations: boolean;     // Default: true
  variationCookieName: string;   // Default: 'optimizely_variations'
  
  // User identification
  userIdCookieName: string;      // Default: 'optimizely_user_id'
  generateUserId: boolean;       // Default: true
}
```

### Setting Variation Cookies

```typescript
// Automatic cookie setting
class EdgeModeHandler {
  async handleRequest(request: IRequestAdapter): Promise<IResponseAdapter> {
    const decisions = await this.evaluateFlags(request);
    const response = await this.fetchContent(request);
    
    // Set variation cookies
    for (const [flagKey, decision] of decisions) {
      if (this.config.persistVariations) {
        response.setCookie({
          name: `${this.config.cookiePrefix}${flagKey}`,
          value: decision.variationKey,
          maxAge: this.config.cookieMaxAge,
          path: this.config.cookiePath,
          secure: this.config.cookieSecure,
          sameSite: this.config.cookieSameSite
        });
      }
    }
    
    return response;
  }
}
```

## Response Modification

### Header Injection

```typescript
interface HeaderInjectionConfig {
  // Decision headers
  injectDecisionHeaders: boolean;  // Default: false
  decisionHeaderPrefix: string;    // Default: 'X-Optimizely-'
  
  // Debug headers
  injectDebugHeaders: boolean;     // Default: false in production
  
  // Custom headers
  customHeaders: Record<string, string | ((decision: OptimizelyDecision) => string)>;
}

// Example configuration
const headerConfig: HeaderInjectionConfig = {
  injectDecisionHeaders: true,
  customHeaders: {
    'X-Experiment-Id': (decision) => decision.ruleKey || 'default',
    'X-Cache-Vary': 'optimizely-variations'
  }
};
```

### Response Headers

```typescript
// Headers set by Edge Mode
X-Optimizely-Decision-checkout_flow: new_design
X-Optimizely-User-Id: user_123456
X-Optimizely-Cache-Hit: true
X-Edge-Mode: active
Vary: Cookie, X-Optimizely-User-Id
```

## Performance Configuration

### Caching Strategy

```typescript
interface EdgeCacheConfig {
  // Cache configuration from cdnVariationSettings
  useCdnCache: boolean;           // Default: true
  
  // Cache key generation
  cacheKeyFactors: string[];      // Default: ['url', 'userId', 'flagKey']
  
  // Cache headers
  varyHeaders: string[];          // Default: ['Cookie', 'X-Optimizely-User-Id']
  
  // Default TTL if not specified in cdnVariationSettings
  defaultCacheTTL: number;        // Default: 300 (5 minutes)
}

// Cache implementation
class EdgeCacheManager {
  async getCachedResponse(cacheKey: string, cacheTTL: number): Promise<Response | null> {
    const cached = await cache.match(cacheKey);
    if (!cached) return null;
    
    const age = Date.now() - cached.headers.get('X-Cache-Time');
    if (age > cacheTTL * 1000) {
      await cache.delete(cacheKey);
      return null;
    }
    
    return cached;
  }
  
  async cacheResponse(cacheKey: string, response: Response, cacheTTL: number): Promise<void> {
    const headers = new Headers(response.headers);
    headers.set('X-Cache-Time', Date.now().toString());
    headers.set('Cache-Control', `public, max-age=${cacheTTL}`);
    
    const cachedResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
    
    await cache.put(cacheKey, cachedResponse);
  }
}
```

## Security Configuration

### Content Security

```typescript
interface EdgeSecurityConfig {
  // CSP handling
  updateCSP: boolean;             // Default: true
  cspNonce: boolean;             // Default: true
  
  // Trusted sources
  trustedOrigins: string[];       // Allowed content sources
  allowedResponseURLs: string[];  // Validated cdnResponseURL patterns
  
  // Request validation
  validateRequests: boolean;      // Default: true
  maxResponseSize: number;        // Default: 10485760 (10MB)
}
```

### Request Validation

```typescript
// Validate edge mode requests
class EdgeModeValidator {
  validate(request: IRequestAdapter): ValidationResult {
    // Check allowed methods
    if (!this.config.allowedMethods.includes(request.method)) {
      return { valid: false, reason: 'Method not allowed' };
    }
    
    // Check content type
    const contentType = request.getHeader('content-type');
    if (!this.isAllowedContentType(contentType)) {
      return { valid: false, reason: 'Content type not supported' };
    }
    
    // Check request size
    if (request.contentLength > this.config.maxRequestSize) {
      return { valid: false, reason: 'Request too large' };
    }
    
    return { valid: true };
  }
}
```

## Edge Mode Examples

### E-commerce Personalization

```typescript
const ecommerceConfig = {
  urlPatterns: [
    {
      pattern: '/products/*',
      flags: ['product_recommendations', 'pricing_test'],
      transform: true
    },
    {
      pattern: '/checkout',
      flags: ['checkout_flow', 'payment_options'],
      transform: true,
      cache: 0  // Don't cache checkout
    }
  ],
  
  transformations: [
    {
      search: '{{price}}',
      replace: (match, decision) => {
        const pricing = decision.variables.pricing;
        return `$${pricing.amount}`;
      }
    }
  ]
};
```

### Content Site Optimization

```typescript
const contentConfig = {
  urlPatterns: [
    {
      pattern: '/blog/*',
      flags: ['blog_layout', 'related_articles'],
      transform: true,
      cache: 3600  // 1 hour
    }
  ],
  
  cookieConfig: {
    persistVariations: true,
    variationCookieName: 'blog_preferences'
  },
  
  headerInjection: {
    customHeaders: {
      'X-Content-Version': (decision) => decision.variationKey
    }
  }
};
```

## Monitoring and Debugging

### Debug Mode

```typescript
// Enable edge mode debugging
export EDGE_MODE_DEBUG="true"

// Debug headers in response
X-Edge-Transform-Time: 23ms
X-Edge-Decisions: checkout_flow:variant_b,hero_banner:control
X-Edge-Cache-Status: HIT
X-Edge-Transform-Count: 5
```

### Metrics

```typescript
interface EdgeModeMetrics {
  'edge.request.total': number;
  'edge.transform.duration': number;
  'edge.transform.count': number;
  'edge.cache.hit.rate': number;
  'edge.error.transform': number;
}
```

## Best Practices

### 1. Optimize Pattern Matching

```typescript
// ✅ Efficient patterns
const patterns = [
  '/products/*',     // Simple wildcard
  '/api/v1/*'       // Clear prefix
];

// ❌ Inefficient patterns
const patterns = [
  '/**/products/**',  // Complex wildcards
  /.*products.*/      // Broad regex
];
```

### 2. Cache Transformed Content

```typescript
// Cache based on variations
const cacheKey = generateCacheKey({
  url: request.url,
  variations: Array.from(decisions.values()).map(d => d.variationKey),
  userId: userId
});
```

### 3. Handle Errors Gracefully

```typescript
try {
  const transformed = await transformer.transform(content, decisions);
  return transformed;
} catch (error) {
  logger.error('Transform failed', error);
  // Return original content
  return content;
}
```

## See Also

- [URL Matcher Implementation](/src-v2/services/implementations/URLMatcher.ts)
- [Content Transformer](/src-v2/services/implementations/ContentTransformer.ts)
- [Edge Mode Handler](/src-v2/services/implementations/EdgeModeHandler.ts)
- [Agent Mode Configuration](./agent-mode-configuration.md) - API mode configuration