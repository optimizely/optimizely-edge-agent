# Configuration Guide

## Overview

The Optimizely Edge Agent v2 provides a flexible, multi-source configuration system that allows you to customize behavior through environment variables, request parameters, headers, and cookies. This guide covers all configuration aspects to help you optimize your Edge Agent deployment.

## Configuration Philosophy

The Edge Agent follows these configuration principles:

1. **Secure by Default** - Minimal required configuration with secure defaults
2. **Platform Agnostic** - Configuration works across all supported platforms
3. **Override Hierarchy** - Clear precedence rules for configuration sources
4. **Runtime Flexibility** - Many settings can be changed per-request
5. **Type Safety** - TypeScript interfaces ensure configuration validity

## Quick Start

### Minimal Configuration

```typescript
// Required: Just provide your SDK key
const config = {
  sdkKey: 'your-optimizely-sdk-key'
};

// That's it! The Edge Agent will use secure defaults for everything else
```

### Common Configuration

```typescript
// Typical production configuration
const config = {
  // Required
  sdkKey: process.env.OPTIMIZELY_SDK_KEY,
  
  // Recommended
  environment: 'production',
  logLevel: 'warn',
  
  // Performance
  cacheTimeSeconds: 300,
  enableAutoDatafileUpdates: true,
  
  // Features
  enableEdgeMode: true,
  enableAgentMode: true
};
```

## Configuration Sources

The Edge Agent accepts configuration from multiple sources, applied in this precedence order (highest to lowest):

1. **Request Headers** - Per-request overrides
2. **Query Parameters** - URL-based configuration
3. **Cookies** - User-specific settings
4. **Environment Variables** - Deployment-wide defaults
5. **Default Values** - Built-in secure defaults

```typescript
// Example: SDK key can come from multiple sources
// Priority: Header > Query > Cookie > Environment > Default

// 1. Header (highest priority)
X-Optimizely-SDK-Key: prod-sdk-key

// 2. Query parameter
?optimizely_sdk_key=prod-sdk-key

// 3. Cookie
optimizely_sdk_key=prod-sdk-key

// 4. Environment variable
OPTIMIZELY_SDK_KEY=prod-sdk-key
```

## Configuration Categories

### 🔑 Core Configuration
Essential settings for basic operation:
- SDK Key and authentication
- Environment and deployment settings
- Logging and debugging options

[Learn more →](./environment-variables.md)

### 🎯 SDK Configuration
Optimizely SDK behavior customization:
- Decision options and algorithms
- Event batching and dispatching
- Datafile synchronization
- User profile services

[Learn more →](./sdk-configuration.md)

### 💾 Cache Configuration
Performance optimization through caching:
- Multi-level cache hierarchy
- TTL and invalidation strategies
- Platform-specific cache backends
- Cache key generation

[Learn more →](./cache-configuration.md)

### 🌐 Edge Mode Configuration
Content delivery and transformation:
- URL pattern matching
- Content transformation rules
- Cookie-based variations
- Response modifications

[Learn more →](./edge-mode-configuration.md)

### 🚀 Agent Mode Configuration
API endpoint and service settings:
- Endpoint routing
- Request handling options
- Batch operations
- Response formatting

[Learn more →](./agent-mode-configuration.md)

### 🔒 Security Configuration
Security hardening options:
- Authentication methods
- CORS policies
- Rate limiting rules
- Secret management

[Learn more →](./security-configuration.md)

## Configuration Examples

### Platform-Specific Configuration

#### Cloudflare Workers
```toml
# wrangler.toml
[env.production.vars]
OPTIMIZELY_SDK_KEY = "your-sdk-key"
OPTIMIZELY_ENVIRONMENT = "production"
LOG_LEVEL = "warn"
CACHE_TIME_SECONDS = "300"
```

#### Fastly Compute@Edge
```toml
# fastly.toml
[setup.config_stores.optimizely_config]
items = [
  { key = "sdk_key", value = "your-sdk-key" },
  { key = "environment", value = "production" },
  { key = "cache_time", value = "300" }
]
```

#### Vercel Edge Functions
```json
// vercel.json
{
  "env": {
    "OPTIMIZELY_SDK_KEY": "your-sdk-key",
    "OPTIMIZELY_ENVIRONMENT": "production",
    "LOG_LEVEL": "warn"
  }
}
```

### Request-Level Configuration

```typescript
// Override configuration per-request using headers
fetch('https://example.com/api/decide', {
  headers: {
    'X-Optimizely-SDK-Key': 'test-sdk-key',
    'X-Optimizely-Force-Decision': 'variation_1',
    'X-Enable-Debug': 'true'
  }
});

// Or use query parameters
fetch('https://example.com/page?optimizely_force_variation=treatment&optimizely_debug=true');
```

## Configuration Validation

The Edge Agent validates configuration at multiple stages:

```typescript
// From: /src-v2/services/implementations/ConfigurationService.ts
class ConfigurationService {
  private validateConfig(config: Partial<OptimizelyConfig>): void {
    // Required field validation
    if (!config.sdkKey) {
      throw new Error('SDK key is required');
    }
    
    // Type validation
    if (config.cacheTimeSeconds && typeof config.cacheTimeSeconds !== 'number') {
      throw new Error('cacheTimeSeconds must be a number');
    }
    
    // Range validation
    if (config.logLevel && !['debug', 'info', 'warn', 'error'].includes(config.logLevel)) {
      throw new Error('Invalid log level');
    }
  }
}
```

## Configuration Debugging

Enable configuration debugging to see how settings are resolved:

```typescript
// Enable debug mode
const config = {
  sdkKey: 'your-key',
  debug: true,
  logLevel: 'debug'
};

// Debug output will show:
// [DEBUG] Configuration sources:
// - Environment: { sdkKey: 'env-key', cacheTime: 300 }
// - Query: { debug: true }
// - Headers: { sdkKey: 'header-key' }
// - Merged: { sdkKey: 'header-key', cacheTime: 300, debug: true }
```

## Best Practices

### 1. Use Environment Variables for Defaults
```bash
# Set deployment-wide defaults
export OPTIMIZELY_SDK_KEY="prod-key"
export OPTIMIZELY_CACHE_TIME="300"
export OPTIMIZELY_LOG_LEVEL="warn"
```

### 2. Override Sparingly
Only override configuration when necessary:
```typescript
// Good: Override for testing
if (isTestEnvironment) {
  headers['X-Optimizely-SDK-Key'] = 'test-key';
}

// Bad: Hardcoding overrides
headers['X-Optimizely-SDK-Key'] = 'prod-key'; // Use env var instead
```

### 3. Validate Early
```typescript
// Validate configuration during initialization
try {
  const config = await configService.getConfiguration(request);
  validateConfiguration(config);
} catch (error) {
  logger.error('Invalid configuration', error);
  return errorResponse(400, 'Configuration error');
}
```

### 4. Document Custom Configuration
```typescript
// Document any custom configuration clearly
interface CustomConfig extends OptimizelyConfig {
  // Custom timeout for third-party service calls
  thirdPartyTimeout?: number; // milliseconds, default: 5000
}
```

## Troubleshooting

### Configuration Not Applied
1. Check configuration source precedence
2. Verify environment variable names
3. Enable debug logging
4. Check for validation errors

### Performance Issues
1. Review cache configuration
2. Check datafile update frequency
3. Optimize decision options
4. Monitor configuration overhead

### Security Concerns
1. Never expose SDK keys in client code
2. Use environment variables for secrets
3. Implement proper CORS policies
4. Enable rate limiting

## Next Steps

- [Configuration Sources](./configuration-sources.md) - Detailed source documentation
- [Environment Variables](./environment-variables.md) - Complete variable reference
- [SDK Configuration](./sdk-configuration.md) - Optimizely SDK settings
- [Platform Guides](/docs-sot/deployment/) - Platform-specific setup

## Reference Implementation

Key configuration files in the codebase:
- `/src-v2/services/implementations/ConfigurationService.ts` - Main configuration service
- `/src-v2/services/implementations/ConfigService.ts` - Runtime configuration
- `/src-v2/services/interfaces/IConfigurationService.ts` - Configuration interfaces
- `/src-v2/utils/sdkConfigUtils.ts` - SDK configuration utilities