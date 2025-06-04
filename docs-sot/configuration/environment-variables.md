# Environment Variables Reference

## Overview

Environment variables provide deployment-wide configuration for the Optimizely Edge Agent v2. This document details all supported environment variables, their purposes, and platform-specific configuration methods.

## Required Variables

### OPTIMIZELY_SDK_KEY

**Type**: `string`  
**Required**: Yes  
**Description**: Your Optimizely project's SDK key  
**Security**: Keep this value secret and never commit to version control

```bash
# Example
export OPTIMIZELY_SDK_KEY="your-project-sdk-key"
```

## Core Configuration Variables

### OPTIMIZELY_ENVIRONMENT

**Type**: `string`  
**Default**: `'production'`  
**Description**: Deployment environment identifier  
**Values**: `development`, `staging`, `production`, or custom

```bash
export OPTIMIZELY_ENVIRONMENT="production"
```

### LOG_LEVEL

**Type**: `string`  
**Default**: `'warn'`  
**Description**: Logging verbosity level  
**Values**: `debug`, `info`, `warn`, `error`

```bash
export LOG_LEVEL="info"  # Recommended for production
export LOG_LEVEL="debug" # For troubleshooting
```

### OPTIMIZELY_DATAFILE_URL

**Type**: `string`  
**Default**: `'https://cdn.optimizely.com/datafiles/{sdkKey}.json'`  
**Description**: Custom datafile URL template. Use `{sdkKey}` as placeholder

```bash
# Use custom CDN
export OPTIMIZELY_DATAFILE_URL="https://custom-cdn.com/optimizely/{sdkKey}.json"

# Use local datafile
export OPTIMIZELY_DATAFILE_URL="file:///opt/datafiles/{sdkKey}.json"
```

## Feature Toggle Variables

### ENABLE_EDGE_MODE

**Type**: `boolean`  
**Default**: `true`  
**Description**: Enable edge content delivery mode

```bash
export ENABLE_EDGE_MODE="true"  # Enable content transformation
export ENABLE_EDGE_MODE="false" # API-only mode
```

### ENABLE_AGENT_MODE

**Type**: `boolean`  
**Default**: `true`  
**Description**: Enable agent API endpoints

```bash
export ENABLE_AGENT_MODE="true"  # Enable API endpoints
export ENABLE_AGENT_MODE="false" # Edge-only mode
```

### ENABLE_DECIDE_ENDPOINT

**Type**: `boolean`  
**Default**: `true`  
**Description**: Enable the /decide API endpoint

```bash
export ENABLE_DECIDE_ENDPOINT="false" # Disable decision API
```

## Cache Configuration Variables

### CACHE_TIME_SECONDS

**Type**: `number`  
**Default**: `300` (5 minutes)  
**Description**: Default cache TTL in seconds

```bash
export CACHE_TIME_SECONDS="600"  # 10 minutes
export CACHE_TIME_SECONDS="0"    # Disable caching
```

### DATAFILE_CACHE_TIME

**Type**: `number`  
**Default**: `300` (5 minutes)  
**Description**: Datafile-specific cache TTL

```bash
export DATAFILE_CACHE_TIME="3600" # 1 hour
```

### ENABLE_KV_CACHE

**Type**: `boolean`  
**Default**: `true`  
**Description**: Enable platform KV storage for caching

```bash
export ENABLE_KV_CACHE="false" # Memory-only caching
```

### CACHE_KEY_PREFIX

**Type**: `string`  
**Default**: `'optimizely'`  
**Description**: Prefix for all cache keys

```bash
export CACHE_KEY_PREFIX="opt_prod" # Environment-specific prefix
```

## SDK Configuration Variables

### OPTIMIZELY_DECIDE_OPTIONS

**Type**: `string` (comma-separated)  
**Default**: `''`  
**Description**: Default decide options for all decisions  
**Values**: `DISABLE_DECISION_EVENT`, `ENABLED_FLAGS_ONLY`, `EXCLUDE_VARIABLES`, etc.

```bash
# Single option
export OPTIMIZELY_DECIDE_OPTIONS="DISABLE_DECISION_EVENT"

# Multiple options
export OPTIMIZELY_DECIDE_OPTIONS="DISABLE_DECISION_EVENT,ENABLED_FLAGS_ONLY"
```

### EVENT_BATCH_SIZE

**Type**: `number`  
**Default**: `10`  
**Description**: Number of events to batch before sending

```bash
export EVENT_BATCH_SIZE="50" # Larger batches for high traffic
```

### EVENT_FLUSH_INTERVAL

**Type**: `number`  
**Default**: `1000` (1 second)  
**Description**: Maximum time in ms before flushing events

```bash
export EVENT_FLUSH_INTERVAL="5000" # 5 seconds
```

## Performance Variables

### MAX_CONCURRENT_REQUESTS

**Type**: `number`  
**Default**: `10`  
**Description**: Maximum concurrent outbound requests

```bash
export MAX_CONCURRENT_REQUESTS="20" # Higher for edge locations
```

### REQUEST_TIMEOUT_MS

**Type**: `number`  
**Default**: `5000` (5 seconds)  
**Description**: Timeout for external requests in milliseconds

```bash
export REQUEST_TIMEOUT_MS="3000" # Faster timeout
```

### ENABLE_REQUEST_COALESCING

**Type**: `boolean`  
**Default**: `true`  
**Description**: Combine duplicate requests

```bash
export ENABLE_REQUEST_COALESCING="false" # Disable for debugging
```

## Security Variables

### ALLOWED_ORIGINS

**Type**: `string` (comma-separated)  
**Default**: `'*'`  
**Description**: CORS allowed origins

```bash
# Single origin
export ALLOWED_ORIGINS="https://example.com"

# Multiple origins
export ALLOWED_ORIGINS="https://example.com,https://app.example.com"

# Wildcard subdomain
export ALLOWED_ORIGINS="https://*.example.com"
```

### ENABLE_AUTH

**Type**: `boolean`  
**Default**: `false`  
**Description**: Enable authentication for API endpoints

```bash
export ENABLE_AUTH="true"
export AUTH_TOKEN="secret-token" # When auth is enabled
```

### RATE_LIMIT_REQUESTS

**Type**: `number`  
**Default**: `1000`  
**Description**: Requests per minute per IP

```bash
export RATE_LIMIT_REQUESTS="100" # Strict rate limiting
```

## Platform-Specific Variables

### Cloudflare Workers

Additional Cloudflare-specific variables:

```bash
# Analytics
export CF_ANALYTICS_TOKEN="your-analytics-token"

# Durable Objects (if used)
export DURABLE_OBJECT_NAMESPACE="optimizely_state"

# Zone ID for cache purging
export CF_ZONE_ID="your-zone-id"
```

### Fastly Compute@Edge

Fastly-specific variables:

```bash
# Backend configuration
export FASTLY_BACKEND_NAME="optimizely_api"

# Dictionary name for config
export FASTLY_CONFIG_DICT="optimizely_config"

# Service ID
export FASTLY_SERVICE_ID="your-service-id"
```

### Vercel Edge Functions

Vercel-specific variables:

```bash
# Edge Config
export EDGE_CONFIG="https://edge-config.vercel.com/your-config"

# Region preference
export VERCEL_REGION="iad1"

# Function timeout
export VERCEL_FUNCTION_TIMEOUT="30"
```

## Development Variables

### DEBUG

**Type**: `boolean`  
**Default**: `false`  
**Description**: Enable debug mode with verbose logging

```bash
export DEBUG="true"
export DEBUG_NAMESPACE="optimizely:*" # Specific debug namespaces
```

### MOCK_SDK_RESPONSES

**Type**: `boolean`  
**Default**: `false`  
**Description**: Use mock responses for testing

```bash
export MOCK_SDK_RESPONSES="true"
export MOCK_VARIATION="treatment_a" # Default mock variation
```

### DISABLE_TELEMETRY

**Type**: `boolean`  
**Default**: `false`  
**Description**: Disable analytics and telemetry

```bash
export DISABLE_TELEMETRY="true" # For development/testing
```

## Configuration Examples

### Development Environment

```bash
# .env.development
OPTIMIZELY_SDK_KEY="dev-sdk-key"
OPTIMIZELY_ENVIRONMENT="development"
LOG_LEVEL="debug"
DEBUG="true"
CACHE_TIME_SECONDS="0"
MOCK_SDK_RESPONSES="true"
DISABLE_TELEMETRY="true"
```

### Production Environment

```bash
# .env.production
OPTIMIZELY_SDK_KEY="${SECRET_SDK_KEY}"
OPTIMIZELY_ENVIRONMENT="production"
LOG_LEVEL="warn"
CACHE_TIME_SECONDS="300"
ENABLE_KV_CACHE="true"
RATE_LIMIT_REQUESTS="1000"
ALLOWED_ORIGINS="https://app.example.com"
```

### Testing Environment

```bash
# .env.test
OPTIMIZELY_SDK_KEY="test-sdk-key"
OPTIMIZELY_ENVIRONMENT="test"
LOG_LEVEL="info"
CACHE_TIME_SECONDS="60"
ENABLE_AUTH="true"
AUTH_TOKEN="test-token"
```

## Platform Configuration

### Cloudflare Workers (wrangler.toml)

```toml
name = "optimizely-edge-agent"

[env.production]
vars = { 
  OPTIMIZELY_ENVIRONMENT = "production",
  LOG_LEVEL = "warn",
  CACHE_TIME_SECONDS = "300"
}

[env.production.secrets]
# Set via wrangler secret
# wrangler secret put OPTIMIZELY_SDK_KEY
```

### Fastly Compute@Edge (fastly.toml)

```toml
[setup.config_stores.env_vars]
items = [
  { key = "OPTIMIZELY_SDK_KEY", value = "your-sdk-key" },
  { key = "OPTIMIZELY_ENVIRONMENT", value = "production" },
  { key = "LOG_LEVEL", value = "warn" },
  { key = "CACHE_TIME_SECONDS", value = "300" }
]
```

### Vercel Edge Functions (vercel.json)

```json
{
  "env": {
    "OPTIMIZELY_ENVIRONMENT": "production",
    "LOG_LEVEL": "warn",
    "CACHE_TIME_SECONDS": "300"
  },
  "build": {
    "env": {
      "OPTIMIZELY_SDK_KEY": "@optimizely-sdk-key"
    }
  }
}
```

## Best Practices

### 1. Use Secrets Management

```bash
# Don't do this
export OPTIMIZELY_SDK_KEY="actual-key-value"

# Do this instead
export OPTIMIZELY_SDK_KEY="${SECRET_OPTIMIZELY_SDK_KEY}"
```

### 2. Environment-Specific Configs

```bash
# Use environment prefixes
export PROD_OPTIMIZELY_SDK_KEY="prod-key"
export DEV_OPTIMIZELY_SDK_KEY="dev-key"

# Select based on environment
if [ "$ENVIRONMENT" = "production" ]; then
  export OPTIMIZELY_SDK_KEY="$PROD_OPTIMIZELY_SDK_KEY"
else
  export OPTIMIZELY_SDK_KEY="$DEV_OPTIMIZELY_SDK_KEY"
fi
```

### 3. Validate Required Variables

```typescript
// From: /src-v2/adapters/implementations/CloudflareEnvironmentAdapter.ts
export class CloudflareEnvironmentAdapter implements IEnvironmentAdapter {
  getRequired(key: string): string {
    const value = this.env[key];
    if (!value) {
      throw new Error(`Required environment variable ${key} is not set`);
    }
    return value;
  }
}
```

### 4. Document Custom Variables

```typescript
// Document any custom environment variables
interface CustomEnvironment {
  // Feature flag for new checkout flow
  ENABLE_NEW_CHECKOUT?: string;
  
  // Third-party service URL
  PAYMENT_SERVICE_URL?: string;
}
```

## Troubleshooting

### Variable Not Working

1. Check variable name spelling and case
2. Verify platform-specific configuration
3. Check precedence (might be overridden)
4. Enable debug logging to see values

### Performance Issues

1. Increase cache times
2. Enable request coalescing
3. Adjust batch sizes
4. Monitor timeout settings

### Security Concerns

1. Never log SDK keys
2. Use platform secret management
3. Restrict CORS origins
4. Enable rate limiting

## See Also

- [Configuration Sources](./configuration-sources.md) - How configuration is resolved
- [Platform Deployment](/docs-sot/deployment/) - Platform-specific setup
- [Security Configuration](./security-configuration.md) - Security best practices
- Implementation: `/src-v2/adapters/interfaces/IEnvironmentAdapter.ts`