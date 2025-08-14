# Metrics Adapters Setup Guide

## Overview

The Optimizely Edge Agent v2 supports three production-ready metrics adapters for collecting and sending metrics to external monitoring services. This guide provides step-by-step instructions for setting up each adapter.

## Supported Metrics Providers

| Provider | Best For | Complexity | Cost |
|----------|----------|------------|------|
| **DataDog** | Production environments | Medium | $$ |
| **New Relic** | APM & monitoring | Medium | $$ |
| **Prometheus** | Self-hosted/on-premise | High | Free |

## General Configuration

### 1. Enable Metrics Collection

All adapters require these base environment variables:

```env
# Enable metrics
OPTIMIZELY_METRICS_ENABLED=true

# Metrics configuration
OPTIMIZELY_METRICS_PREFIX=optly_edge
OPTIMIZELY_METRICS_SAMPLING_RATE=1.0
OPTIMIZELY_METRICS_MAX_DIMENSIONS=10
OPTIMIZELY_METRICS_ENABLE_HISTOGRAMS=true
OPTIMIZELY_METRICS_GLOBAL_DIMENSIONS={"environment":"production","region":"us-east-1"}

# Adapter selection
METRICS_PROVIDER=datadog  # Options: prometheus, datadog, newrelic
```

### 2. How Metrics Are Collected

The adapters collect these metric types:
- **Counters**: Request counts, errors, events
- **Gauges**: Current values like CPU usage, active connections
- **Histograms**: Response times, payload sizes
- **Timers**: Operation durations
- **Sets**: Unique values like user IDs, experiment IDs

---

## DataDog Setup (Recommended)

### 1. Create DataDog Account & API Key

1. **Sign up**: Go to [DataDog](https://www.datadoghq.com/) and create an account
2. **Get API Key**: 
   - Go to Organization Settings → API Keys
   - Click "New Key"
   - Name it "Optimizely Edge Agent"
   - Copy the key

### 2. Environment Variables

```env
# Required
DD_API_KEY=your-datadog-api-key-here

# Optional (with defaults)
DD_SITE=datadoghq.com          # For US1, use datadoghq.eu for EU
DD_ENV=production              # Environment tag
DD_SERVICE=optimizely-edge-agent  # Service name
DD_VERSION=1.0.0              # Version tag

# Metrics provider selection
METRICS_PROVIDER=datadog
```

### 3. DataDog Site Configuration

Choose the correct site based on your DataDog region:

| Region | DD_SITE Value | API Endpoint |
|--------|---------------|--------------|
| US1 | `datadoghq.com` | `https://api.datadoghq.com` |
| US3 | `us3.datadoghq.com` | `https://api.us3.datadoghq.com` |
| US5 | `us5.datadoghq.com` | `https://api.us5.datadoghq.com` |
| EU | `datadoghq.eu` | `https://api.datadoghq.eu` |
| AP1 | `ap1.datadoghq.com` | `https://api.ap1.datadoghq.com` |

### 4. Vercel Configuration

In your Vercel project:

1. Go to Project Settings → Environment Variables
2. Add the variables:

```
DD_API_KEY=your-actual-api-key
DD_SITE=datadoghq.com
DD_ENV=production
DD_SERVICE=optimizely-edge-agent
METRICS_PROVIDER=datadog
OPTIMIZELY_METRICS_ENABLED=true
```

### 5. Verify Setup

After deployment, check DataDog for metrics under:
- **Metrics Explorer** → Search for `optly_edge.*`
- **Service Map** → Look for `optimizely-edge-agent`

---

## New Relic Setup

### 1. Create New Relic Account & License Key

1. **Sign up**: Go to [New Relic](https://newrelic.com/) and create an account
2. **Get License Key**:
   - Go to Account Settings → API Keys
   - Look for "Ingest - License" key
   - Copy the key (starts with "eu01xx" or similar)

### 2. Environment Variables

```env
# Required
NEW_RELIC_LICENSE_KEY=your-license-key-here

# Optional (with defaults)
NEW_RELIC_REGION=US               # Options: US, EU
NEW_RELIC_APP_NAME=optimizely-edge-agent
NEW_RELIC_ENVIRONMENT=production

# Metrics provider selection
METRICS_PROVIDER=newrelic
```

### 3. Region Configuration

| Region | NEW_RELIC_REGION | API Endpoint |
|--------|------------------|--------------|
| US | `US` | `https://metric-api.newrelic.com` |
| EU | `EU` | `https://metric-api.eu.newrelic.com` |

### 4. Vercel Configuration

In your Vercel project:

```
NEW_RELIC_LICENSE_KEY=your-actual-license-key
NEW_RELIC_REGION=US
NEW_RELIC_APP_NAME=optimizely-edge-agent
METRICS_PROVIDER=newrelic
OPTIMIZELY_METRICS_ENABLED=true
```

### 5. Verify Setup

After deployment, check New Relic:
- **Explorer** → Search for your service
- **Metrics & Events** → Query `SELECT * FROM Metric WHERE appName = 'optimizely-edge-agent'`

---

## Prometheus Setup (Advanced)

### 1. Deploy Prometheus Push Gateway

Prometheus requires a Push Gateway for edge/serverless environments:

```yaml
# docker-compose.yml
version: '3.8'
services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml

  pushgateway:
    image: prom/pushgateway:latest
    ports:
      - "9091:9091"
```

### 2. Prometheus Configuration

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'pushgateway'
    static_configs:
      - targets: ['pushgateway:9091']
```

### 3. Environment Variables

```env
# Required
PROMETHEUS_PUSH_GATEWAY_URL=http://your-pushgateway:9091

# Optional
PROMETHEUS_JOB_NAME=optimizely_edge_agent
PROMETHEUS_INSTANCE_ID=edge_worker_1

# Metrics provider selection
METRICS_PROVIDER=prometheus
```

### 4. Vercel Configuration

For Vercel, you'll need a publicly accessible Push Gateway:

```
PROMETHEUS_PUSH_GATEWAY_URL=https://your-pushgateway.example.com
PROMETHEUS_JOB_NAME=vercel_edge_agent
METRICS_PROVIDER=prometheus
OPTIMIZELY_METRICS_ENABLED=true
```

### 5. Verify Setup

- Check Push Gateway: `http://your-pushgateway:9091/metrics`
- Check Prometheus: `http://your-prometheus:9090/targets`
- Query metrics: `{job="optimizely_edge_agent"}`

---

## Environment Variable Reference

### Core Metrics Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPTIMIZELY_METRICS_ENABLED` | No | `true` | Enable/disable metrics collection |
| `OPTIMIZELY_METRICS_PREFIX` | No | `optly_edge` | Prefix for all metric names |
| `OPTIMIZELY_METRICS_SAMPLING_RATE` | No | `1.0` | Sampling rate (0.0-1.0) |
| `OPTIMIZELY_METRICS_MAX_DIMENSIONS` | No | `10` | Max tags per metric |
| `OPTIMIZELY_METRICS_ENABLE_HISTOGRAMS` | No | `true` | Enable histogram metrics |
| `OPTIMIZELY_METRICS_GLOBAL_DIMENSIONS` | No | `{}` | JSON object of global tags |

### Provider Selection

| Variable | Required | Options | Description |
|----------|----------|---------|-------------|
| `METRICS_PROVIDER` | **Yes** | `prometheus`, `datadog`, `newrelic` | Which adapter to use |

### DataDog Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DD_API_KEY` | **Yes** | - | DataDog API key |
| `DD_SITE` | No | `datadoghq.com` | DataDog site/region |
| `DD_ENV` | No | `production` | Environment tag |
| `DD_SERVICE` | No | `optimizely-edge-agent` | Service name |
| `DD_VERSION` | No | `1.0.0` | Version tag |

### New Relic Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEW_RELIC_LICENSE_KEY` | **Yes** | - | New Relic license key |
| `NEW_RELIC_REGION` | No | `US` | Region (`US` or `EU`) |
| `NEW_RELIC_APP_NAME` | No | `optimizely-edge-agent` | Application name |
| `NEW_RELIC_ENVIRONMENT` | No | `production` | Environment name |

### Prometheus Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PROMETHEUS_PUSH_GATEWAY_URL` | **Yes** | - | Push Gateway URL |
| `PROMETHEUS_JOB_NAME` | No | `optimizely_edge_agent` | Job name |
| `PROMETHEUS_INSTANCE_ID` | No | Auto-generated | Instance identifier |

---

## Troubleshooting

### Common Issues

#### 1. Metrics Not Appearing

**Check**:
- `OPTIMIZELY_METRICS_ENABLED=true`
- Correct `METRICS_PROVIDER` value
- API keys are valid
- Network connectivity

**Debug**:
```env
LOG_LEVEL=debug
```

#### 2. DataDog 403 Errors

**Causes**:
- Invalid API key
- Wrong region/site configuration
- API key doesn't have metrics permissions

#### 3. New Relic 403 Errors

**Causes**:
- Invalid license key
- Wrong region configuration
- License key is Browser/Mobile type (need Ingest - License)

#### 4. Prometheus Push Gateway Errors

**Causes**:
- Push Gateway not accessible
- Network firewall blocking
- Push Gateway not configured in Prometheus

### Testing Metrics

Use the test script to verify configuration:

```bash
# Set your environment variables
export METRICS_PROVIDER=datadog
export DD_API_KEY=your-key
export OPTIMIZELY_METRICS_ENABLED=true

# Run test
node test-vercel-adapter.js
```

### Monitoring Performance

All adapters include:
- **Batching**: Reduces API calls
- **Compression**: Reduces payload size
- **Retry Logic**: Handles temporary failures
- **Circuit Breaker**: Prevents cascading failures

Monitor adapter health through logs:
```
[INFO] Metrics adapter successfully created and configured
[DEBUG] Successfully sent 50 metrics to DataDog
[WARN] Circuit breaker is open - metrics disabled temporarily
```

---

## Best Practices

### 1. Environment-Specific Configuration

Use different configurations per environment:

```env
# Production
OPTIMIZELY_METRICS_SAMPLING_RATE=1.0
DD_ENV=production

# Staging
OPTIMIZELY_METRICS_SAMPLING_RATE=0.1
DD_ENV=staging

# Development  
OPTIMIZELY_METRICS_ENABLED=false
```

### 2. Cost Optimization

- Use sampling in high-traffic environments
- Monitor your metrics usage in provider dashboards
- Consider different providers for different environments

### 3. Security

- Store API keys as environment variables, never in code
- Use different API keys per environment
- Rotate API keys regularly
- Monitor for unauthorized usage

### 4. Monitoring

Set up alerts for:
- High error rates in metrics submission
- Circuit breaker activation
- Unusual metric patterns

---

## Support

For issues with specific providers:
- **DataDog**: [DataDog Support](https://docs.datadoghq.com/help/)
- **New Relic**: [New Relic Support](https://docs.newrelic.com/)
- **Prometheus**: [Prometheus Documentation](https://prometheus.io/docs/)

For Edge Agent specific issues, check the logs and ensure environment variables are correctly configured.