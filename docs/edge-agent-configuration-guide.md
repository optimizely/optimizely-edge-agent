# Optimizely Edge Agent Configuration Guide

This guide provides detailed instructions for configuring and deploying the Optimizely Edge Agent on supported edge computing platforms.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Configuration Options](#configuration-options)
4. [Deployment](#deployment)
   - [Cloudflare Workers](#cloudflare-workers)
   - [Vercel Edge Functions](#vercel-edge-functions)
   - [Fastly Compute@Edge](#fastly-computeedge)
5. [API Reference](#api-reference)
6. [Troubleshooting](#troubleshooting)
7. [Advanced Configuration](#advanced-configuration)

## Overview

The Optimizely Edge Agent is a platform-agnostic implementation of Optimizely designed to run on edge computing platforms. It supports:

- Feature flags and experiments at the edge
- Fast, low-latency decisions with local evaluation
- Automatic datafile synchronization
- Multiple deployment platforms

The Edge Agent uses an adapter pattern to abstract away platform-specific code, allowing it to run across multiple edge computing environments including Cloudflare Workers, Vercel Edge Functions, and Fastly Compute@Edge.

## Prerequisites

Before deploying the Edge Agent, you'll need:

- An Optimizely account with at least one project and SDK key
- Access to your chosen edge computing platform (Cloudflare, Vercel, or Fastly)
- Node.js v16 or later for local development
- The platform-specific CLI tools:
  - Cloudflare: [Wrangler CLI](https://developers.cloudflare.com/workers/cli-wrangler/install-update)
  - Vercel: [Vercel CLI](https://vercel.com/docs/cli)
  - Fastly: [Fastly CLI](https://developer.fastly.com/reference/cli)

## Configuration Options

The Edge Agent supports the following configuration options:

| Option | Description | Default | Required |
|--------|-------------|---------|----------|
| `SDK_KEY` | Your Optimizely SDK key | None | Yes |
| `ENVIRONMENT` | Environment name (e.g. production, staging) | `"production"` | No |
| `LOG_LEVEL` | Logging level (debug, info, warn, error) | `"info"` | No |
| `DATAFILE_CDN_URL` | URL to fetch datafiles from | Optimizely CDN | No |
| `DATAFILE_POLL_INTERVAL` | Interval (ms) to check for datafile updates | `300000` (5 minutes) | No |
| `ADMIN_TOKEN` | Secret token for admin operations | None | Yes (for admin operations) |
| `CACHE_TTL` | Cache time-to-live in seconds | `300` (5 minutes) | No |

### Environment Variables vs. Platform Configuration

Configuration can be provided through:

1. Environment variables
2. Platform-specific configuration (e.g., Cloudflare Workers KV)
3. Runtime configuration API

## Deployment

### Cloudflare Workers

#### Step 1: Prepare your wrangler.toml

Create a `wrangler.toml` file based on the template:

```toml
name = "optimizely-edge-agent"
main = "dist/index.js"
compatibility_date = "2023-10-10"

[vars]
SDK_KEY = "your-sdk-key"
ENVIRONMENT = "production"
LOG_LEVEL = "info"

# Optional: Create a KV namespace for caching
[[kv_namespaces]]
binding = "OPTLY_HYBRID_AGENT_KV"
id = "your-kv-namespace-id"

# Secrets (add via wrangler secret put)
# - ADMIN_TOKEN
```

#### Step 2: Set up secrets

```sh
wrangler secret put ADMIN_TOKEN
```

#### Step 3: Deploy to Cloudflare

```sh
npm run build:cloudflare
wrangler publish
```

### Vercel Edge Functions

#### Step 1: Project setup

Create a Vercel configuration file (.vercel/project.json):

```json
{
  "buildCommand": "npm run build:vercel",
  "outputDirectory": "dist",
  "framework": null,
  "devCommand": "npm run dev:vercel"
}
```

#### Step 2: Environment Variables

Add the required environment variables in the Vercel dashboard or via the CLI:

```sh
vercel env add SDK_KEY
vercel env add ADMIN_TOKEN
```

#### Step 3: Deploy to Vercel

```sh
npm run build:vercel
vercel deploy --prod
```

### Fastly Compute@Edge

#### Step 1: Project setup

Create a `fastly.toml` file:

```toml
[setup]
name = "optimizely-edge-agent"
description = "Optimizely Edge Agent for Fastly Compute@Edge"

[scripts]
build = "npm run build:fastly"

[local_server]
  [local_server.backends]
  [local_server.backends.optimizely_cdn]
    url = "https://cdn.optimizely.com"

[[kv_stores]]
name = "optly_edge_agent_kv"
```

#### Step 2: Configuration

Configure your backend and dictionaries:

```sh
fastly backend create --name=optimizely_cdn --address=cdn.optimizely.com
fastly dictionary create --name=edge_agent_config
fastly dictionary-item create --dictionary-name=edge_agent_config --key=SDK_KEY --value=your-sdk-key
fastly dictionary-item create --dictionary-name=edge_agent_config --key=ADMIN_TOKEN --value=your-admin-token
```

#### Step 3: Deploy to Fastly

```sh
npm run build:fastly
fastly compute publish
```

## API Reference

The Edge Agent exposes the following API endpoints:

### Datafile API

- `GET /api/datafile?sdkKey=<sdk-key>` - Retrieve a datafile
- `POST /api/datafile?sdkKey=<sdk-key>` - Update a datafile (requires admin token)

### Flag Keys API

- `GET /api/flagkeys?sdkKey=<sdk-key>` - Get all feature flag keys
- `POST /api/flagkeys?sdkKey=<sdk-key>` - Update feature flag keys (requires admin token)

### SDK Info API

- `GET /api/sdk` - Get SDK information (version, environment, provider)

### Admin API

- `POST /api/admin/cache/clear` - Clear the cache (requires admin token)

See the complete [API documentation](./api-endpoints.md) for more details.

## Troubleshooting

### Common Issues

1. **Datafile not found errors**
   - Verify your SDK key is correct
   - Check the Optimizely project is active
   - Ensure the Edge Agent can reach the Optimizely CDN

2. **Authentication errors**
   - Verify your ADMIN_TOKEN is set correctly
   - Ensure you're using the correct Authorization header format

3. **Cache issues**
   - Use the cache clear endpoint to reset the cache
   - Check platform-specific storage limits

### Logging

Adjust the LOG_LEVEL environment variable to get more detailed logs:

- `error` - Only critical errors
- `warn` - Warnings and errors
- `info` - General information (default)
- `debug` - Detailed debugging information

## Advanced Configuration

### Custom Datafile Polling

You can customize how often the Edge Agent checks for datafile updates:

```
DATAFILE_POLL_INTERVAL=600000  # Check every 10 minutes (in milliseconds)
```

### Custom CDN URL

If you're hosting datafiles elsewhere, specify a custom CDN URL:

```
DATAFILE_CDN_URL=https://your-custom-cdn.com/datafiles/
```

### Advanced Caching

Control cache TTLs for different resources:

```
CACHE_TTL=600           # Default cache TTL (10 minutes)
DATAFILE_CACHE_TTL=300  # Datafile cache TTL (5 minutes)
FLAGKEYS_CACHE_TTL=600  # Flag keys cache TTL (10 minutes)
```

### Custom Headers

Configure custom response headers:

```
CORS_ALLOW_ORIGIN=*
CACHE_CONTROL_HEADER=public, max-age=300
```

For more advanced configuration options, see the [Advanced Configuration Guide](./advanced-configuration.md). 