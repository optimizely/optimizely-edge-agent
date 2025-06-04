# Metrics Environment Variables

The Optimizely Edge Agent supports configuring metrics behavior through environment variables, providing flexible deployment-time configuration without code changes.

## Available Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `OPTIMIZELY_METRICS_ENABLED` | boolean | `true`* | Enable/disable all metrics collection |
| `OPTIMIZELY_METRICS_PREFIX` | string | `optimizely_edge_` | Prefix prepended to all metric names |
| `OPTIMIZELY_METRICS_SAMPLING_RATE` | number | `1.0` | Sampling rate (0.0-1.0) for all metrics |
| `OPTIMIZELY_METRICS_MAX_DIMENSIONS` | number | `20` | Maximum dimensions/tags per metric |
| `OPTIMIZELY_METRICS_ENABLE_HISTOGRAMS` | boolean | `true` | Enable histogram metric types |
| `OPTIMIZELY_METRICS_GLOBAL_DIMENSIONS` | JSON string | `{}` | Dimensions added to all metrics |

*Default is `true` if Analytics Engine is available, `false` otherwise

## Configuration Examples

### Basic Configuration

```toml
# wrangler.toml
[vars]
OPTIMIZELY_METRICS_ENABLED = "true"
OPTIMIZELY_METRICS_PREFIX = "optimizely_edge_"
OPTIMIZELY_METRICS_SAMPLING_RATE = "1.0"
```

### Production Configuration

```toml
# wrangler.toml
[env.production.vars]
OPTIMIZELY_METRICS_ENABLED = "true"
OPTIMIZELY_METRICS_PREFIX = "prod_optimizely_"
OPTIMIZELY_METRICS_SAMPLING_RATE = "0.1"  # Sample 10% to reduce volume
OPTIMIZELY_METRICS_MAX_DIMENSIONS = "15"   # Reduce dimensions for performance
OPTIMIZELY_METRICS_GLOBAL_DIMENSIONS = "{\"environment\":\"production\",\"region\":\"us-east-1\",\"service\":\"edge-agent\"}"
```

### Development Configuration

```toml
# wrangler.toml
[vars]
OPTIMIZELY_METRICS_ENABLED = "true"
OPTIMIZELY_METRICS_PREFIX = "dev_optimizely_"
OPTIMIZELY_METRICS_SAMPLING_RATE = "1.0"  # Sample everything in dev
OPTIMIZELY_METRICS_ENABLE_HISTOGRAMS = "true"
OPTIMIZELY_METRICS_GLOBAL_DIMENSIONS = "{\"environment\":\"development\",\"developer\":\"${USER}\"}"
```

### Disabled Metrics

```toml
# wrangler.toml
[vars]
OPTIMIZELY_METRICS_ENABLED = "false"  # Completely disable metrics
```

## Global Dimensions

Global dimensions are automatically added to every metric. They must be specified as a JSON string:

```toml
OPTIMIZELY_METRICS_GLOBAL_DIMENSIONS = "{\"key1\":\"value1\",\"key2\":\"value2\"}"
```

Common global dimensions:
- `environment`: "production", "staging", "development"
- `region`: "us-east-1", "eu-west-1", etc.
- `datacenter`: "dc1", "dc2", etc.
- `service`: Service identifier
- `version`: Application version
- `cluster`: Cluster identifier

## Configuration Precedence

The metrics system follows this precedence order (highest to lowest):

1. **Runtime Configuration** - Passed to adapter constructor
2. **Environment Variables** - Set in wrangler.toml or environment
3. **Default Values** - Built-in defaults

Example showing precedence:

```typescript
// Environment variable sets prefix to "env_prefix_"
// Runtime config sets prefix to "runtime_prefix_"
const adapter = new CloudflareMetricsAdapter(
  logger,
  'default_prefix_',     // Ignored due to env var
  analyticsEngine,
  {
    prefix: 'runtime_prefix_'  // Takes precedence over env var
  },
  environmentAdapter
);
// Result: prefix = "runtime_prefix_"
```

## Validation

### Boolean Values
- Accepts: `"true"` or `"false"` (case-insensitive)
- Invalid values default to `false`

### Numeric Values
- `OPTIMIZELY_METRICS_SAMPLING_RATE`: Must be 0.0 to 1.0
- `OPTIMIZELY_METRICS_MAX_DIMENSIONS`: Must be positive integer
- Invalid values log warnings and use defaults

### JSON Values
- `OPTIMIZELY_METRICS_GLOBAL_DIMENSIONS`: Must be valid JSON object
- Invalid JSON logs warning and uses empty object `{}`

## Best Practices

1. **Use Environment-Specific Prefixes**
   ```toml
   [vars]
   OPTIMIZELY_METRICS_PREFIX = "dev_"
   
   [env.production.vars]
   OPTIMIZELY_METRICS_PREFIX = "prod_"
   ```

2. **Reduce Sampling in Production**
   ```toml
   [env.production.vars]
   OPTIMIZELY_METRICS_SAMPLING_RATE = "0.05"  # 5% sampling
   ```

3. **Include Environment Context**
   ```toml
   OPTIMIZELY_METRICS_GLOBAL_DIMENSIONS = "{\"env\":\"prod\",\"region\":\"us-east-1\"}"
   ```

4. **Disable in Tests**
   ```toml
   [env.test.vars]
   OPTIMIZELY_METRICS_ENABLED = "false"
   ```

## Troubleshooting

### Variables Not Being Applied

1. **Check environment adapter is passed**:
   ```typescript
   const adapter = new CloudflareMetricsAdapter(
     logger,
     prefix,
     analyticsEngine,
     config,
     environmentAdapter  // Required for env var support
   );
   ```

2. **Verify variable names** - They are case-sensitive

3. **Check logs** - Invalid values log warnings:
   ```
   [CloudflareMetricsAdapter] Invalid sampling rate in env var: 2.0. Using default.
   ```

### Debugging Configuration

Enable debug logging to see configuration details:

```typescript
// Set log level to debug
const logger = new CloudflareLoggerAdapter('debug');

// Logs will show:
// [CloudflareMetricsAdapter] Environment configuration loaded: {...}
```

## Migration from Runtime Configuration

### Before (Runtime Only)
```typescript
const adapter = new CloudflareMetricsAdapter(
  logger,
  'my_prefix_',
  analyticsEngine,
  {
    enabled: true,
    defaultSamplingRate: 0.1,
    globalDimensions: { env: 'prod' }
  }
);
```

### After (Environment Variables)
```toml
# wrangler.toml
[vars]
OPTIMIZELY_METRICS_ENABLED = "true"
OPTIMIZELY_METRICS_PREFIX = "my_prefix_"
OPTIMIZELY_METRICS_SAMPLING_RATE = "0.1"
OPTIMIZELY_METRICS_GLOBAL_DIMENSIONS = "{\"env\":\"prod\"}"
```

```typescript
// Simplified code
const adapter = new CloudflareMetricsAdapter(
  logger,
  'default_',  // Will be overridden by env var
  analyticsEngine,
  undefined,   // No runtime config needed
  environmentAdapter
);
```

## Platform Support

Currently, environment variable configuration is implemented for:
- ✅ **CloudflareMetricsAdapter** - Full support
- ❌ **FastlyMetricsAdapter** - Not yet implemented
- ❌ **VercelMetricsAdapter** - Not yet implemented
- ❌ **StandardMetricsAdapter** - Not yet implemented

Support for other adapters can be added by passing an environment adapter and implementing the same pattern.

## See Also

- [Metrics Overview](./README.md)
- [Platform-Specific Adapters](./platform-adapters.md)
- [Metrics Configuration Best Practices](../configuration/README.md)