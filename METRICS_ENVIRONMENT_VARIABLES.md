# Metrics Environment Variables Configuration

This document describes the new environment variable configuration support for the Optimizely Edge Agent metrics system.

## Overview

The Optimizely Edge Agent now supports configuring metrics behavior through environment variables, allowing for more flexible deployment and runtime configuration without requiring code changes.

## Available Environment Variables

### Core Metrics Configuration

| Environment Variable | Type | Default | Description |
|---------------------|------|---------|-------------|
| `OPTIMIZELY_METRICS_ENABLED` | boolean | `true` (if Analytics Engine available) | Enable/disable metrics collection entirely |
| `OPTIMIZELY_METRICS_PREFIX` | string | `"optimizely_edge_"` | Prefix for all metric names |
| `OPTIMIZELY_METRICS_SAMPLING_RATE` | number | `1.0` | Sampling rate for metrics (0.0 to 1.0) |
| `OPTIMIZELY_METRICS_MAX_DIMENSIONS` | number | `20` | Maximum number of dimensions/tags per metric |
| `OPTIMIZELY_METRICS_ENABLE_HISTOGRAMS` | boolean | `true` | Enable histogram metric types |
| `OPTIMIZELY_METRICS_GLOBAL_DIMENSIONS` | JSON string | `{}` | Global dimensions added to all metrics |

## Configuration in wrangler.toml

### Development Environment

```toml
[vars]
# Metrics configuration
OPTIMIZELY_METRICS_ENABLED = "true"
OPTIMIZELY_METRICS_PREFIX = "optimizely_edge_"
OPTIMIZELY_METRICS_SAMPLING_RATE = "1.0"
OPTIMIZELY_METRICS_MAX_DIMENSIONS = "20"
OPTIMIZELY_METRICS_ENABLE_HISTOGRAMS = "true"
OPTIMIZELY_METRICS_GLOBAL_DIMENSIONS = "{\"environment\":\"development\",\"service\":\"edge-agent\"}"
```

### Production Environment

```toml
[env.production.vars]
# Metrics configuration for production
OPTIMIZELY_METRICS_ENABLED = "true"
OPTIMIZELY_METRICS_PREFIX = "optimizely_prod_"
OPTIMIZELY_METRICS_SAMPLING_RATE = "0.1"  # Sample 10% of metrics
OPTIMIZELY_METRICS_MAX_DIMENSIONS = "15"
OPTIMIZELY_METRICS_ENABLE_HISTOGRAMS = "true"
OPTIMIZELY_METRICS_GLOBAL_DIMENSIONS = "{\"environment\":\"production\",\"service\":\"edge-agent\",\"datacenter\":\"us-west\"}"
```

### Test Environment

```toml
[env.test.vars]
# Metrics configuration for testing
OPTIMIZELY_METRICS_ENABLED = "true"
OPTIMIZELY_METRICS_PREFIX = "optimizely_test_"
OPTIMIZELY_METRICS_SAMPLING_RATE = "1.0"
OPTIMIZELY_METRICS_MAX_DIMENSIONS = "25"
OPTIMIZELY_METRICS_ENABLE_HISTOGRAMS = "true"
OPTIMIZELY_METRICS_GLOBAL_DIMENSIONS = "{\"environment\":\"test\",\"service\":\"edge-agent\"}"
```

## Configuration Precedence

The metrics configuration follows this precedence order (highest to lowest):

1. **Runtime Configuration** - Configuration passed directly to the `CloudflareMetricsAdapter` constructor
2. **Environment Variables** - Configuration from the environment variables listed above
3. **Default Values** - Built-in default values

This means environment variables will override defaults, but runtime configuration will override environment variables if provided.

## Usage Examples

### Disabling Metrics

To completely disable metrics collection:

```toml
[vars]
OPTIMIZELY_METRICS_ENABLED = "false"
```

Even if the Analytics Engine is available, setting this to `"false"` will disable all metrics collection.

### Custom Sampling for High-Traffic Environments

To reduce metrics volume in high-traffic environments:

```toml
[vars]
OPTIMIZELY_METRICS_SAMPLING_RATE = "0.05"  # Sample only 5% of metrics
```

### Environment-Specific Prefixes

Different environments can use different prefixes:

```toml
# Development
[vars]
OPTIMIZELY_METRICS_PREFIX = "dev_optimizely_"

# Production
[env.production.vars]
OPTIMIZELY_METRICS_PREFIX = "prod_optimizely_"

# Staging
[env.staging.vars]
OPTIMIZELY_METRICS_PREFIX = "staging_optimizely_"
```

### Global Dimensions

Add environment-specific dimensions to all metrics:

```toml
[vars]
OPTIMIZELY_METRICS_GLOBAL_DIMENSIONS = "{\"environment\":\"production\",\"region\":\"us-west-2\",\"cluster\":\"main\"}"
```

These dimensions will be automatically added to every metric recorded.

## Backward Compatibility

This implementation maintains full backward compatibility:

- **Existing Code**: All existing code that creates `CloudflareMetricsAdapter` instances will continue to work without changes
- **Runtime Configuration**: Runtime configuration passed to the constructor still works and takes precedence over environment variables
- **Default Behavior**: If no environment variables are set, the adapter behaves exactly as before

## Environment Variable Validation

The system includes validation for environment variables:

- **Boolean values**: Accepts `"true"` or `"false"` (case-insensitive)
- **Numeric values**: Validates ranges (e.g., sampling rate must be 0.0-1.0)
- **JSON values**: Validates JSON syntax for global dimensions
- **Error handling**: Invalid values log warnings and fall back to defaults

## Monitoring and Debugging

The metrics adapter logs its configuration at startup:

```
[CloudflareMetricsAdapter] Initialized with prefix: optimizely_edge_, enabled: true
[CloudflareMetricsAdapter] Environment configuration loaded: {"enabled":true,"prefix":"optimizely_edge_",...}
```

Use `LOG_LEVEL = "debug"` to see detailed configuration loading information.

## Migration Guide

### From Runtime Configuration to Environment Variables

**Before** (runtime configuration):
```typescript
const metricsAdapter = new CloudflareMetricsAdapter(
  logger,
  'custom_prefix_',
  analyticsEngine,
  {
    enabled: true,
    defaultSamplingRate: 0.1,
    maxDimensions: 15
  }
);
```

**After** (environment variables):
```toml
# In wrangler.toml
[vars]
OPTIMIZELY_METRICS_ENABLED = "true"
OPTIMIZELY_METRICS_PREFIX = "custom_prefix_"
OPTIMIZELY_METRICS_SAMPLING_RATE = "0.1"
OPTIMIZELY_METRICS_MAX_DIMENSIONS = "15"
```

```typescript
// Simplified code - configuration comes from environment
const metricsAdapter = new CloudflareMetricsAdapter(
  logger,
  'default_prefix_', // Will be overridden by env var
  analyticsEngine,
  undefined, // No runtime config needed
  environmentAdapter // Pass environment adapter
);
```

## Best Practices

1. **Use Environment Variables for Environment-Specific Configuration**: Sampling rates, prefixes, and global dimensions
2. **Keep Runtime Configuration for Dynamic Settings**: Settings that need to change based on runtime conditions
3. **Set Reasonable Sampling Rates**: Use lower sampling rates in high-traffic production environments
4. **Include Environment Information**: Add environment, region, or cluster information to global dimensions
5. **Monitor Configuration**: Check logs to ensure environment variables are being read correctly

## Troubleshooting

### Metrics Not Being Recorded

1. Check `OPTIMIZELY_METRICS_ENABLED` is set to `"true"`
2. Verify Analytics Engine binding is configured correctly
3. Check sampling rate isn't excluding all metrics
4. Review logs for configuration errors

### Invalid Configuration

- Invalid boolean values default to `false`
- Invalid numeric values log warnings and use defaults
- Invalid JSON in global dimensions logs warnings and uses empty object
- Check worker logs for configuration validation messages 