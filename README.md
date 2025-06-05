# Optimizely Edge Agent v2

A **TypeScript-based edge computing solution** that delivers A/B testing and feature flagging capabilities directly at the CDN edge, providing ultra-low latency decisions and seamless content personalization.

## 🚀 Key Features

### **Dual Operating Modes**
- **Edge Mode**: Automatic request interception for transparent content personalization
- **Agent Mode**: RESTful API endpoints for programmatic feature flag decisions

### **Universal CDN Support**
- **Cloudflare Workers** - Native Workers runtime support
- **Vercel Edge Functions** - Next.js middleware integration
- **Fastly Compute@Edge** - WebAssembly-optimized deployment
- **Extensible Architecture** - Plugin system for additional platforms

### **Enterprise-Grade Capabilities**
- **Sub-50ms Decision Times** - Cached decisions at the edge
- **Automatic Failover** - Graceful degradation and error recovery
- **Real-time Configuration** - Dynamic updates without redeployment
- **Comprehensive Metrics** - Built-in observability and monitoring
- **Security-First Design** - Request validation and content protection

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Architecture Overview](#architecture-overview)
- [Operating Modes](#operating-modes)
- [API Reference](#api-reference)
- [Platform Deployment](#platform-deployment)
- [Configuration](#configuration)
- [Documentation](#documentation)
- [Contributing](#contributing)

## 🏃 Quick Start

### 1. **Choose Your Platform**

```bash
# Cloudflare Workers
npm create cloudflare@latest my-edge-agent -- --template=optimizely-edge-agent

# Vercel Edge Functions  
npx create-next-app@latest my-edge-agent --template=optimizely-edge-agent

# Fastly Compute@Edge
fastly compute init --from=optimizely/edge-agent-template
```

### 2. **Basic Configuration**

```typescript
// Minimal required configuration
const config = {
  sdkKey: 'your-optimizely-sdk-key',  // Required
  enableEdgeMode: true,               // Enable automatic request handling
  enableAgentMode: true               // Enable API endpoints
};
```

### 3. **Deploy and Test**

```bash
# Test a decision API call
curl -X POST https://your-domain.com/api/decide \
  -H "Content-Type: application/json" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: your-sdk-key" \
  -d '{"userId": "user123", "flagKey": "my_feature"}'

# Test automatic edge mode (GET request)
curl https://your-domain.com/your-page
# → Automatically applies variations based on URL patterns
```

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Optimizely Edge Agent v2                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐              ┌─────────────────────────┐   │
│  │   Edge Mode     │              │      Agent Mode         │   │
│  │                 │              │                         │   │
│  │ • URL Matching  │              │ • REST API Endpoints    │   │
│  │ • Auto Decisions│              │ • /api/decide          │   │
│  │ • Content Trans │              │ • /api/datafile        │   │
│  │ • Cache Control │              │ • /api/admin/*         │   │
│  └─────────────────┘              └─────────────────────────┘   │
│           │                                    │                 │
│  ┌────────┴────────────────────────────────────┴────────────┐   │
│  │              Core Services Layer                         │   │
│  │                                                          │   │
│  │ ┌─────────────┐ ┌──────────────┐ ┌─────────────────────┐ │   │
│  │ │ Decision    │ │ Configuration│ │    Storage          │ │   │
│  │ │ Service     │ │ Service      │ │    Service          │ │   │
│  │ └─────────────┘ └──────────────┘ └─────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────┘   │
│           │                                    │                 │
│  ┌────────┴────────────────────────────────────┴────────────┐   │
│  │              Platform Adapters                           │   │
│  │                                                          │   │
│  │ ┌─────────────┐ ┌──────────────┐ ┌─────────────────────┐ │   │
│  │ │ Cloudflare  │ │    Vercel    │ │      Fastly         │ │   │
│  │ │  Workers    │ │ Edge Functions│ │  Compute@Edge       │ │   │
│  │ └─────────────┘ └──────────────┘ └─────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## 🔄 Operating Modes

### **Edge Mode** - Automatic Request Handling

Transparently intercepts web requests and serves content based on experimentation decisions:

```javascript
// Edge mode intercepts requests and uses cdnVariationSettings to determine content source
// Example cdnVariationSettings from a feature flag variable:
{
  "cdnVariationSettings": {
    "cdnExperimentURL": "https://example.com/home",      // URL pattern to match
    "cdnResponseURL": "https://example.com/home-variant", // Alternative content source
    "cacheKey": "home_variant_a",                         // Cache identifier
    "cacheTTL": 3600,                                     // Cache duration in seconds
    "forwardRequestToOrigin": "true",                     // Whether to fetch from origin
    "cacheRequestToOrigin": "true",                       // Whether to cache origin response
    "isControlVariation": "false"                         // Control vs treatment indicator
  }
}
```

**When a user visits `yoursite.com/home`:**
1. Edge Agent intercepts the request
2. Evaluates the relevant feature flag(s) for this URL
3. Retrieves the `cdnVariationSettings` from the decision
4. Based on settings, either:
   - Serves content from cache (if available and not expired)
   - Fetches content from the configured `cdnResponseURL`
   - Forwards to origin server if `forwardRequestToOrigin` is true
5. Caches the response according to `cacheTTL` settings

**Key Point**: Edge Mode does NOT transform content. It determines which content to serve (origin vs alternative URLs) based on the `cdnVariationSettings` variable in your feature flags.

### **Agent Mode** - REST API Endpoints

Programmatic access for applications and services:

```bash
# Single flag decision
POST /api/decide
{
  "flagKey": "checkout_flow",
  "userId": "user123",
  "attributes": { "plan": "premium" }
}

# Multiple flag decisions  
POST /api/decide-for-keys
{
  "flagKeys": ["feature_a", "feature_b", "feature_c"],
  "userId": "user123"
}

# All flags decision
POST /api/decide-all
{
  "userId": "user123",
  "decideOptions": ["ENABLED_FLAGS_ONLY"]
}
```

## 📡 API Reference

### **Decision Endpoints**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/decide` | GET/POST | Single feature flag decision |
| `/api/decide-all` | GET/POST | All feature flags decisions |
| `/api/decide-for-keys` | GET/POST | Multiple specific flags decisions |
| `/api/decide-options` | GET/POST | Available decision options |

### **Data Management**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/datafile` | GET/PUT/POST | Optimizely datafile management |
| `/api/flagkeys` | GET/PUT/POST | Feature flag keys management |
| `/api/sdk` | GET | SDK and version information |

### **Administration**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/set-forced-variation` | POST/PUT | Force specific variations |
| `/api/get-forced-variation` | GET/POST | Retrieve forced variations |
| `/api/debug` | POST | Debug configuration and state |

**Complete API documentation**: [`/docs-sot/api/`](./docs-sot/api/README.md)

## 🚀 Platform Deployment

### **Cloudflare Workers**

```bash
# Deploy to Cloudflare
npx wrangler deploy

# Configure environment variables
npx wrangler secret put OPTIMIZELY_SDK_KEY
npx wrangler secret put OPTIMIZELY_ADMIN_TOKEN
```

**Features**: KV Store integration, Analytics Engine metrics, global edge network

### **Vercel Edge Functions**

```typescript
// middleware.ts
import { createVercelHandler } from '@optimizely/edge-agent';

export default async function middleware(request: NextRequest) {
  const handler = createVercelHandler(process.env);
  return await handler.handleRequest(request);
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)']
};
```

**Features**: Next.js integration, Edge Config, global edge deployment

### **Fastly Compute@Edge**

```bash
# Deploy to Fastly
fastly compute publish

# Configure secrets
fastly secret-store create --name optimizely-secrets
fastly secret-store-entry create --store-id=<store-id> --name=sdk-key
```

**Features**: WebAssembly performance, advanced VCL integration, enterprise features

**Complete deployment guides**: [`/docs-sot/cdn-adapters/`](./docs-sot/cdn-adapters/README.md)

## ⚙️ Configuration

### **Environment Variables**

```bash
# Required
OPTIMIZELY_SDK_KEY=your-sdk-key

# Optional - Feature Control  
OPTIMIZELY_ENABLE_EDGE_MODE=true
OPTIMIZELY_ENABLE_AGENT_MODE=true
OPTIMIZELY_LOG_LEVEL=warn

# Optional - Performance
OPTIMIZELY_CACHE_TTL=300
OPTIMIZELY_AUTO_DATAFILE_UPDATES=true

# Optional - Security
OPTIMIZELY_ADMIN_TOKEN=your-admin-token
OPTIMIZELY_ENABLE_DEBUG_HEADERS=false
```

### **Multi-Source Configuration**

Configuration precedence (highest to lowest):
1. **HTTP Headers** - `X-Optimizely-SDK-Key: override-key`
2. **Query Parameters** - `?sdkKey=test-key`  
3. **Request Body** - `{"sdkKey": "body-key"}`
4. **Environment Variables** - `OPTIMIZELY_SDK_KEY=env-key`
5. **Default Values** - Built-in secure defaults

**Complete configuration guide**: [`/docs-sot/configuration/`](./docs-sot/configuration/README.md)

## 📊 Monitoring & Metrics

### **Built-in Metrics**

**Universal Support**: **DataDog**, **New Relic**, **Prometheus** adapters available for Vercel & Fastly.

- **Request Metrics**: API calls, durations, success rates
- **Decision Metrics**: Flag evaluations, bucketing performance  
- **Cache Metrics**: Hit/miss rates, storage efficiency
- **Error Metrics**: Classified errors with detailed context

### **Platform Integration**

```env
# Quick Setup - Choose your provider
METRICS_PROVIDER=datadog  # Options: prometheus, datadog, newrelic

# DataDog (Recommended)
DD_API_KEY=your-api-key
DD_ENV=production

# New Relic
NEW_RELIC_LICENSE_KEY=your-license-key

# Prometheus  
PROMETHEUS_PUSH_GATEWAY_URL=http://your-pushgateway:9091
```

```typescript
// Universal metrics interface works across all providers
metrics.recordTiming('decision_duration', 45);
metrics.incrementCounter('api_requests', { endpoint: 'decide' });
metrics.setGauge('cache.hit_rate', 0.95);
```

**Complete metrics documentation**: [`/docs-sot/metrics/`](./docs-sot/metrics/README.md)

## 📚 Documentation

### **Complete Documentation Set**

Our comprehensive documentation covers every aspect of the Edge Agent:

| Category | Status | Description |
|----------|---------|-------------|
| **[API Reference](./docs-sot/api/README.md)** | ✅ Complete | All endpoints, parameters, examples |
| **[Architecture](./docs-sot/architecture/README.md)** | ✅ Complete | System design, request lifecycle |
| **[CDN Adapters](./docs-sot/cdn-adapters/README.md)** | ✅ Complete | Platform-specific deployment |
| **[Configuration](./docs-sot/configuration/README.md)** | ✅ Complete | All settings and options |
| **[Metrics](./docs-sot/metrics/README.md)** | ✅ Complete | Monitoring and observability |

### **Getting Started Guides**

- **[Quick Start Guide](./docs-sot/quick-start/README.md)** - Get running in 5 minutes
- **[Migration Guide](./docs-sot/MIGRATION_PLAN.md)** - Upgrade from v1 to v2
- **[Troubleshooting](./docs-sot/README.md#troubleshooting)** - Common issues and solutions

### **Developer Resources**

- **[Development Guide](./docs-sot/README.md#development)** - Local setup and contribution
- **[Examples](./docs-sot/api/examples/README.md)** - Real-world implementation patterns
- **[Security Guide](./docs-sot/configuration/security-configuration.md)** - Best practices and considerations

## 🔧 Development

### **Local Development**

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e

# Build for all platforms
npm run build
npm run build:cloudflare
npm run build:vercel  
npm run build:fastly
```

### **Testing**

```bash
# Test against live deployment
curl -X POST https://your-deployment.com/api/decide \
  -H "Content-Type: application/json" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: your-key" \
  -d '{"userId": "test", "flagKey": "test_flag"}'
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for:

- Code style and standards
- Testing requirements  
- Pull request process
- Issue reporting guidelines

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## 🆘 Support

- **Documentation**: [Complete docs in `/docs-sot/`](./docs-sot/README.md)
- **Issues**: [GitHub Issues](https://github.com/optimizely/edge-agent/issues)
- **Discussions**: [GitHub Discussions](https://github.com/optimizely/edge-agent/discussions)

---

**Ready to get started?** Jump to our [Quick Start Guide](./docs-sot/quick-start/README.md) or explore the [complete documentation](./docs-sot/README.md) for in-depth guidance.