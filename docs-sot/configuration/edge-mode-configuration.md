# Edge Mode Configuration

## Overview

Edge Mode enables the Optimizely Edge Agent to intercept and modify content delivery at the edge, providing personalized experiences without client-side code. This document covers all Edge Mode configuration options, URL matching patterns, and content transformation rules.

## Edge Mode Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Edge Mode Request Flow                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Request ──▶ URL Matcher ──▶ Decision Engine ──▶ Content Transform ──▶ Response │
│                   │                 │                    │                      │
│                   ▼                 ▼                    ▼                      │
│            Pattern Rules      User Context        Transformation             │
│              Matching          Decisions             Rules                   │
│                                                                          │
│  Configuration Points:                                                   │
│  ┌─────────────────┬────────────────────┬─────────────────────┐       │
│  │  URL Patterns   │  Decision Rules    │  Transform Rules    │       │
│  ├─────────────────┼────────────────────┼─────────────────────┤       │
│  │ • Path matching │ • Flag mappings    │ • Content replace   │       │
│  │ • Query params  │ • User attributes  │ • Header injection  │       │
│  │ • Headers       │ • Forced decisions │ • Cookie setting    │       │
│  └─────────────────┴────────────────────┴─────────────────────┘       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
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
  transform?: boolean;      // Enable content transformation
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

## Content Transformation

### Transformation Rules

```typescript
// From: /src-v2/services/implementations/ContentTransformer.ts
interface TransformationRule {
  // What to find
  search: string | RegExp;
  
  // What to replace with
  replace: string | ((match: string, decision: OptimizelyDecision) => string);
  
  // Conditions
  condition?: (decision: OptimizelyDecision) => boolean;
  
  // Options
  options?: {
    caseSensitive: boolean;
    multiline: boolean;
    limit: number;  // Max replacements
  };
}
```

### Placeholder Syntax

```typescript
// Simple placeholders
const content = `
  <div class="{{optimizely:homepage_hero}}">
    {{optimizely:welcome_message}}
  </div>
`;

// With defaults
const content = `
  {{optimizely:cta_text|default:Click Here}}
`;

// Conditional content
const content = `
  {{#optimizely:show_banner}}
    <div class="banner">Special Offer!</div>
  {{/optimizely:show_banner}}
`;

// Variable injection
const content = `
  <script>
    window.optimizely = {
      decisions: {{optimizely:decisions:json}}
    };
  </script>
`;
```

### Transformation Configuration

```typescript
interface TransformConfig {
  // Enable transformations
  enableTransformations: boolean;  // Default: true
  
  // Placeholder format
  placeholderFormat: 'double-curly' | 'single-curly' | 'square';
  
  // Transform options
  transformOptions: {
    // Process JavaScript
    transformScripts: boolean;     // Default: false
    
    // Process styles
    transformStyles: boolean;      // Default: true
    
    // Process meta tags
    transformMeta: boolean;        // Default: true
    
    // Custom processors
    processors: TransformProcessor[];
  };
}

// Custom processor example
class CustomTransformProcessor implements TransformProcessor {
  process(content: string, decisions: Map<string, OptimizelyDecision>): string {
    // Custom transformation logic
    return content.replace(/\{\{price:(\w+)\}\}/g, (match, flagKey) => {
      const decision = decisions.get(flagKey);
      return decision?.variables?.price || '0.00';
    });
  }
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

### Streaming Transformations

```typescript
interface StreamingConfig {
  // Enable streaming
  enableStreaming: boolean;        // Default: true
  
  // Buffer size
  bufferSize: number;             // Default: 16384 (16KB)
  
  // Chunk processing
  processChunks: boolean;         // Default: true
  
  // Head injection
  injectInHead: boolean;          // Default: true
  headInjectionTimeout: number;   // Default: 100ms
}

// Streaming transformation
class StreamingTransformer {
  transform(stream: ReadableStream, decisions: Map<string, OptimizelyDecision>): ReadableStream {
    return stream.pipeThrough(new TransformStream({
      transform: (chunk, controller) => {
        const text = new TextDecoder().decode(chunk);
        const transformed = this.transformContent(text, decisions);
        controller.enqueue(new TextEncoder().encode(transformed));
      }
    }));
  }
}
```

### Edge Mode Cache

```typescript
interface EdgeModeCacheConfig {
  // Cache transformed content
  cacheTransformed: boolean;      // Default: true
  
  // Cache key includes
  cacheKeyFactors: string[];      // Default: ['url', 'variations']
  
  // Vary headers
  varyHeaders: string[];          // Default: ['Cookie', 'Accept']
  
  // Edge-specific TTL
  edgeCacheTTL: number;          // Default: 300 (5 minutes)
}
```

## Security Configuration

### Content Security

```typescript
interface EdgeSecurityConfig {
  // CSP handling
  updateCSP: boolean;             // Default: true
  cspNonce: boolean;             // Default: true
  
  // Script injection
  allowScriptInjection: boolean;  // Default: false
  trustedScripts: string[];      // Allowed script sources
  
  // Transform validation
  validateTransforms: boolean;    // Default: true
  maxTransformSize: number;      // Default: 10485760 (10MB)
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