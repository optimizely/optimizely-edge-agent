# Metrics Environment Variables Quick Reference

## Core Configuration

```env
# Enable metrics collection
OPTIMIZELY_METRICS_ENABLED=true

# Choose your metrics provider (REQUIRED)
METRICS_PROVIDER=datadog  # Options: prometheus, datadog, newrelic

# Optional metrics configuration
OPTIMIZELY_METRICS_PREFIX=optly_edge
OPTIMIZELY_METRICS_SAMPLING_RATE=1.0
OPTIMIZELY_METRICS_MAX_DIMENSIONS=10
OPTIMIZELY_METRICS_ENABLE_HISTOGRAMS=true
OPTIMIZELY_METRICS_GLOBAL_DIMENSIONS={"environment":"production","region":"us-east-1"}
```

## DataDog Configuration (Recommended)

```env
# Required
DD_API_KEY=your-datadog-api-key-here

# Optional (with defaults)
DD_SITE=datadoghq.com          # Options: datadoghq.com, datadoghq.eu, us3.datadoghq.com, etc.
DD_ENV=production              # Environment tag
DD_SERVICE=optimizely-edge-agent  # Service name
DD_VERSION=1.0.0              # Version tag
```

**Where to get DD_API_KEY:**
1. Go to [DataDog](https://app.datadoghq.com/)
2. Organization Settings → API Keys
3. Click "New Key" → Name it "Optimizely Edge Agent"
4. Copy the key

## New Relic Configuration

```env
# Required
NEW_RELIC_LICENSE_KEY=your-license-key-here

# Optional (with defaults)
NEW_RELIC_REGION=US               # Options: US, EU
NEW_RELIC_APP_NAME=optimizely-edge-agent
NEW_RELIC_ENVIRONMENT=production
```

**Where to get NEW_RELIC_LICENSE_KEY:**
1. Go to [New Relic](https://one.newrelic.com/)
2. Account Settings → API Keys
3. Look for "Ingest - License" key (starts with "eu01xx" or similar)
4. Copy the key

## Prometheus Configuration

```env
# Required
PROMETHEUS_PUSH_GATEWAY_URL=http://your-pushgateway:9091

# Optional
PROMETHEUS_JOB_NAME=optimizely_edge_agent
PROMETHEUS_INSTANCE_ID=edge_worker_1
```

**Setup Required:**
You need to deploy Prometheus + Push Gateway yourself. See the setup guide for Docker Compose examples.

## Platform-Specific Examples

### Vercel Project

In your Vercel project's environment variables:

```
OPTIMIZELY_METRICS_ENABLED=true
METRICS_PROVIDER=datadog
DD_API_KEY=your-actual-api-key
DD_SITE=datadoghq.com
DD_ENV=production
DD_SERVICE=optimizely-edge-agent
```

### Cloudflare Workers (wrangler.toml)

```toml
[vars]
OPTIMIZELY_METRICS_ENABLED = "true"
METRICS_PROVIDER = "datadog"
DD_API_KEY = "your-actual-api-key"
DD_SITE = "datadoghq.com"
DD_ENV = "production"
```

### Fastly Compute@Edge

```env
OPTIMIZELY_METRICS_ENABLED=true
METRICS_PROVIDER=newrelic
NEW_RELIC_LICENSE_KEY=your-license-key
NEW_RELIC_REGION=US
NEW_RELIC_APP_NAME=optimizely-edge-agent
```

## Environment-Specific Configuration

### Development
```env
OPTIMIZELY_METRICS_ENABLED=false  # Disable in development
# OR
OPTIMIZELY_METRICS_SAMPLING_RATE=1.0  # Sample everything for testing
DD_ENV=development
```

### Staging
```env
OPTIMIZELY_METRICS_SAMPLING_RATE=0.1  # Sample 10%
DD_ENV=staging
```

### Production
```env
OPTIMIZELY_METRICS_SAMPLING_RATE=1.0  # Sample everything (or 0.1 for high traffic)
DD_ENV=production
```

## Troubleshooting

### Metrics Not Appearing?

1. **Check if enabled:**
   ```env
   OPTIMIZELY_METRICS_ENABLED=true
   ```

2. **Check provider is set:**
   ```env
   METRICS_PROVIDER=datadog  # Must be set!
   ```

3. **Check API keys:**
   - DataDog: Verify `DD_API_KEY` is correct
   - New Relic: Verify `NEW_RELIC_LICENSE_KEY` is an "Ingest - License" key
   - Prometheus: Verify Push Gateway is accessible

4. **Enable debug logging:**
   ```env
   LOG_LEVEL=debug
   ```

### Provider-Specific Issues

**DataDog 403 Errors:**
- Check API key is valid
- Verify `DD_SITE` matches your DataDog region

**New Relic 403 Errors:**
- Ensure you're using an "Ingest - License" key, not a Browser/Mobile key
- Check `NEW_RELIC_REGION` is correct (US or EU)

**Prometheus Errors:**
- Verify Push Gateway is running and accessible
- Check network connectivity from edge to Push Gateway

## Complete Example (DataDog)

```env
# Core metrics configuration
OPTIMIZELY_METRICS_ENABLED=true
METRICS_PROVIDER=datadog
OPTIMIZELY_METRICS_PREFIX=optly_edge
OPTIMIZELY_METRICS_SAMPLING_RATE=1.0

# DataDog configuration
DD_API_KEY=abcd1234567890abcd1234567890abcd
DD_SITE=datadoghq.com
DD_ENV=production
DD_SERVICE=optimizely-edge-agent
DD_VERSION=2.0.0

# Global dimensions
OPTIMIZELY_METRICS_GLOBAL_DIMENSIONS={"environment":"production","region":"us-east-1","team":"optimization"}

# Logging
LOG_LEVEL=info
```

After setting these up, deploy your edge function and check your monitoring dashboard for metrics under the `optly_edge` prefix.