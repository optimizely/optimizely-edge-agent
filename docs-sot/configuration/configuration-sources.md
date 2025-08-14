# Configuration Sources

## Overview

The Optimizely Edge Agent v2 supports multiple configuration sources, allowing flexible deployment scenarios and runtime customization. This document details each configuration source, how they work together, and best practices for their use.

## Source Precedence

Configuration sources are merged in a specific order, with later sources overriding earlier ones:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      Configuration Source Precedence                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Lowest     ┌─────────────┐                          Highest           │
│  Priority   │  Defaults   │                          Priority           │
│     ┌───────┴─────────────┴────────┐                    │              │
│     ▼                               ▼                    ▼              │
│  Built-in ──▶ Environment ──▶ Cookies ──▶ Query ──▶ Headers           │
│  Defaults     Variables                  Params                        │
│                                                                          │
│  Example: SDK Key Resolution                                            │
│  ┌────────────────────────────────────────────────────────────┐       │
│  │ 1. Default: undefined                                       │       │
│  │ 2. Env: OPTIMIZELY_SDK_KEY = "prod-key"                   │       │
│  │ 3. Cookie: optimizely_sdk_key = "user-key"                │       │
│  │ 4. Query: ?optimizely_sdk_key=test-key                    │       │
│  │ 5. Header: X-Optimizely-SDK-Key: debug-key                │       │
│  │                                                             │       │
│  │ Result: "debug-key" (header wins)                          │       │
│  └────────────────────────────────────────────────────────────┘       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Configuration Sources

### 1. Built-in Defaults

Hard-coded default values that ensure the Edge Agent works out-of-the-box:

```typescript
// From: /src-v2/services/implementations/ConfigurationService.ts
private readonly DEFAULT_CONFIG: Partial<OptimizelyConfig> = {
  logLevel: 'warn',
  cacheTimeSeconds: 300,
  enableAutoDatafileUpdates: true,
  datafileUrlTemplate: 'https://cdn.optimizely.com/datafiles/{sdkKey}.json',
  eventUrlTemplate: 'https://logx.optimizely.com/v1/events',
  enableEdgeMode: true,
  enableAgentMode: true,
  decideBatchSize: 10,
  eventBatchSize: 10,
  eventFlushInterval: 1000
};
```

### 2. Environment Variables

Deployment-wide configuration set at the platform level:

```typescript
// From: /src-v2/services/implementations/ConfigurationService.ts
private getEnvironmentConfig(): Partial<OptimizelyConfig> {
  const config: Partial<OptimizelyConfig> = {};
  
  // Core settings
  if (this.env.get('OPTIMIZELY_SDK_KEY')) {
    config.sdkKey = this.env.get('OPTIMIZELY_SDK_KEY');
  }
  
  // Logging
  if (this.env.get('LOG_LEVEL')) {
    config.logLevel = this.env.get('LOG_LEVEL') as LogLevel;
  }
  
  // Caching
  if (this.env.get('CACHE_TIME_SECONDS')) {
    config.cacheTimeSeconds = parseInt(this.env.get('CACHE_TIME_SECONDS')!, 10);
  }
  
  // Features
  if (this.env.get('ENABLE_EDGE_MODE')) {
    config.enableEdgeMode = this.env.get('ENABLE_EDGE_MODE') === 'true';
  }
  
  return config;
}
```

#### Common Environment Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `OPTIMIZELY_SDK_KEY` | string | required | Your Optimizely SDK key |
| `OPTIMIZELY_ENVIRONMENT` | string | 'production' | Deployment environment |
| `LOG_LEVEL` | string | 'warn' | Logging verbosity (debug/info/warn/error) |
| `CACHE_TIME_SECONDS` | number | 300 | Default cache TTL in seconds |
| `ENABLE_EDGE_MODE` | boolean | true | Enable edge content delivery |
| `ENABLE_AGENT_MODE` | boolean | true | Enable API endpoints |
| `DATAFILE_URL_TEMPLATE` | string | CDN URL | Custom datafile URL template |

### 3. Cookie Configuration

User-specific settings stored in browser cookies:

```typescript
// From: /src-v2/services/implementations/ConfigurationService.ts
private async extractFromCookies(request: IRequestAdapter): Promise<Partial<OptimizelyConfig>> {
  const cookieHeader = request.getHeader('cookie');
  if (!cookieHeader) return {};
  
  const cookies = this.parseCookies(cookieHeader);
  const config: Partial<OptimizelyConfig> = {};
  
  // SDK key from cookie (useful for testing)
  if (cookies['optimizely_sdk_key']) {
    config.sdkKey = cookies['optimizely_sdk_key'];
  }
  
  // Forced variations
  if (cookies['optimizely_force_variation']) {
    config.forcedVariation = cookies['optimizely_force_variation'];
  }
  
  // User ID persistence
  if (cookies['optimizely_user_id']) {
    config.defaultUserId = cookies['optimizely_user_id'];
  }
  
  // Debug mode
  if (cookies['optimizely_debug'] === 'true') {
    config.debug = true;
    config.logLevel = 'debug';
  }
  
  return config;
}
```

#### Cookie Naming Convention

| Cookie Name | Purpose | Example |
|-------------|---------|---------|
| `optimizely_user_id` | Persistent user ID | `user_123456` |
| `optimizely_force_variation` | Force specific variation | `treatment_a` |
| `optimizely_debug` | Enable debug mode | `true` |
| `optimizely_attributes_*` | User attributes | `optimizely_attributes_plan=pro` |

### 4. Query Parameters

URL-based configuration for easy testing and sharing:

```typescript
// From: /src-v2/services/implementations/ConfigurationService.ts
private extractFromQuery(url: URL): Partial<OptimizelyConfig> {
  const params = url.searchParams;
  const config: Partial<OptimizelyConfig> = {};
  
  // Basic parameters
  if (params.has('optimizely_sdk_key')) {
    config.sdkKey = params.get('optimizely_sdk_key')!;
  }
  
  // Decision options (can be multiple)
  if (params.has('optimizely_decide')) {
    config.decideOptions = params.getAll('optimizely_decide');
  }
  
  // Forced decisions
  if (params.has('optimizely_force_decision')) {
    const forced = params.get('optimizely_force_decision')!;
    const [flagKey, variation] = forced.split(':');
    config.forcedDecisions = { [flagKey]: variation };
  }
  
  // User attributes
  params.forEach((value, key) => {
    if (key.startsWith('optimizely_attribute_')) {
      const attrName = key.substring(21);
      if (!config.attributes) config.attributes = {};
      config.attributes[attrName] = this.parseAttributeValue(value);
    }
  });
  
  return config;
}
```

#### Query Parameter Examples

```bash
# Force a variation
?optimizely_force_decision=checkout_flow:new_design

# Set user attributes
?optimizely_attribute_plan=enterprise&optimizely_attribute_country=US

# Enable debug mode
?optimizely_debug=true&optimizely_log_level=debug

# Multiple decide options
?optimizely_decide=DISABLE_DECISION_EVENT&optimizely_decide=ENABLED_FLAGS_ONLY
```

### 5. Request Headers

Per-request configuration with highest precedence:

```typescript
// From: /src-v2/services/implementations/ConfigurationService.ts
private extractFromHeaders(request: IRequestAdapter): Partial<OptimizelyConfig> {
  const config: Partial<OptimizelyConfig> = {};
  
  // Core headers
  const sdkKey = request.getHeader('X-Optimizely-SDK-Key');
  if (sdkKey) config.sdkKey = sdkKey;
  
  // User identification
  const userId = request.getHeader('X-Optimizely-User-Id');
  if (userId) config.defaultUserId = userId;
  
  // Decision options
  const decideOptions = request.getHeader('X-Optimizely-Decide-Options');
  if (decideOptions) {
    config.decideOptions = decideOptions.split(',').map(opt => opt.trim());
  }
  
  // Forced decisions
  const forcedDecisions = request.getHeader('X-Optimizely-Force-Decisions');
  if (forcedDecisions) {
    config.forcedDecisions = JSON.parse(forcedDecisions);
  }
  
  // Debug mode
  if (request.getHeader('X-Enable-Debug') === 'true') {
    config.debug = true;
    config.logLevel = 'debug';
  }
  
  return config;
}
```

#### Standard Headers

| Header | Purpose | Example |
|--------|---------|---------|
| `X-Optimizely-SDK-Key` | Override SDK key | `prod_sdk_key_123` |
| `X-Optimizely-User-Id` | Set user ID | `user_789` |
| `X-Optimizely-Decide-Options` | Decision options | `DISABLE_DECISION_EVENT,EXCLUDE_VARIABLES` |
| `X-Optimizely-Force-Decisions` | Force decisions | `{"banner":"variant_b"}` |
| `X-Optimizely-Attributes` | User attributes | `{"plan":"pro","region":"US"}` |
| `X-Enable-Debug` | Enable debugging | `true` |

## Configuration Merging

The configuration service merges sources using a deep merge strategy:

```typescript
// From: /src-v2/services/implementations/ConfigurationService.ts
private mergeConfigurations(...configs: Partial<OptimizelyConfig>[]): OptimizelyConfig {
  const merged: any = {};
  
  for (const config of configs) {
    for (const [key, value] of Object.entries(config)) {
      if (value === undefined) continue;
      
      if (typeof value === 'object' && !Array.isArray(value)) {
        // Deep merge objects
        merged[key] = { ...merged[key], ...value };
      } else {
        // Override primitive values and arrays
        merged[key] = value;
      }
    }
  }
  
  return merged;
}
```

### Merge Examples

```typescript
// Environment config
const envConfig = {
  sdkKey: 'env-key',
  logLevel: 'info',
  attributes: { source: 'server' }
};

// Query config
const queryConfig = {
  logLevel: 'debug',
  attributes: { plan: 'pro' }
};

// Merged result
const merged = {
  sdkKey: 'env-key',        // from env
  logLevel: 'debug',        // from query (override)
  attributes: {             // deep merged
    source: 'server',       // from env
    plan: 'pro'            // from query
  }
};
```

## Best Practices

### 1. Use Appropriate Sources

```typescript
// ✅ Good: Environment variables for deployment config
process.env.OPTIMIZELY_SDK_KEY = 'production-key';
process.env.LOG_LEVEL = 'warn';

// ✅ Good: Headers for per-request overrides
headers['X-Optimizely-User-Id'] = authenticatedUserId;

// ❌ Bad: Query parameters for sensitive data
url += '?optimizely_sdk_key=secret-key'; // Exposed in URLs
```

### 2. Validate Configuration

```typescript
// Validate merged configuration
class ConfigurationService {
  async getConfiguration(request: IRequestAdapter): Promise<OptimizelyConfig> {
    const merged = await this.mergeAllSources(request);
    
    // Validate required fields
    if (!merged.sdkKey) {
      throw new ConfigurationError('SDK key is required');
    }
    
    // Validate types
    if (merged.cacheTimeSeconds && typeof merged.cacheTimeSeconds !== 'number') {
      throw new ConfigurationError('cacheTimeSeconds must be a number');
    }
    
    return merged;
  }
}
```

### 3. Document Custom Configuration

```typescript
// Document any custom configuration sources
interface CustomConfig extends OptimizelyConfig {
  // Custom header for A/B test enrollment
  'X-AB-Test-Group'?: string;
  
  // Custom cookie for feature flags
  'feature_flags'?: string;
}
```

### 4. Security Considerations

```typescript
// Sanitize configuration before logging
function sanitizeConfig(config: OptimizelyConfig): any {
  const sanitized = { ...config };
  
  // Remove sensitive values
  if (sanitized.sdkKey) {
    sanitized.sdkKey = sanitized.sdkKey.substring(0, 4) + '...';
  }
  
  // Remove auth tokens
  delete sanitized.authToken;
  
  return sanitized;
}
```

## Debugging Configuration

Enable configuration debugging to understand source resolution:

```typescript
// Enable debug logging
const config = {
  debug: true,
  logLevel: 'debug'
};

// Logs will show:
// [DEBUG] Configuration source: environment
// [DEBUG] Environment config: { sdkKey: '***', logLevel: 'info' }
// [DEBUG] Configuration source: query
// [DEBUG] Query config: { debug: true, logLevel: 'debug' }
// [DEBUG] Final merged config: { sdkKey: '***', logLevel: 'debug', debug: true }
```

## Platform-Specific Considerations

### Cloudflare Workers
- Environment variables via `wrangler.toml` or dashboard
- Headers and cookies fully supported
- Query parameters preserved through redirects

### Fastly Compute@Edge
- Config store for environment-like settings
- Headers may need special handling
- Cookie parsing requires manual implementation

### Vercel Edge Functions
- Environment variables via `vercel.json` or dashboard
- Full Node.js-like header and cookie APIs
- Query parameters via standard URL parsing

## See Also

- [Environment Variables](./environment-variables.md) - Detailed environment variable reference
- [SDK Configuration](./sdk-configuration.md) - SDK-specific settings
- [Security Configuration](./security-configuration.md) - Security best practices
- [Configuration Service Implementation](/src-v2/services/implementations/ConfigurationService.ts)