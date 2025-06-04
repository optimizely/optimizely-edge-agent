# Deployment Architecture

## Overview

The Edge Agent v2 supports deployment across multiple edge computing platforms, each with unique characteristics and requirements. This document details the deployment architecture, platform-specific considerations, and best practices for production deployments.

## Deployment Targets

### Platform Support Matrix

| Platform | Runtime | Build Output | Deployment Method | KV Storage |
|----------|---------|--------------|-------------------|------------|
| Cloudflare Workers | V8 Isolates | ES Modules | Wrangler CLI | Workers KV |
| Fastly Compute@Edge | WebAssembly | WASM Bundle | Fastly CLI | Config Store |
| Vercel Edge Functions | Edge Runtime | ES Modules | Vercel CLI | Edge Config |
| AWS CloudFront | Lambda@Edge | CommonJS | AWS CLI | DynamoDB |
| Akamai EdgeWorkers | V8 Isolates | ES Modules | Akamai CLI | EdgeKV |

## Build Architecture

### Multi-Platform Build System

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Build Pipeline Architecture                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Source Code                Build Process              Platform Bundles  │
│  ┌──────────┐              ┌─────────────┐            ┌──────────────┐ │
│  │TypeScript│              │  TypeScript │            │  Cloudflare  │ │
│  │   Code   │─────────────▶│  Compiler   │───────────▶│  Bundle      │ │
│  └──────────┘              └─────────────┘            └──────────────┘ │
│       │                           │                     ┌──────────────┐ │
│       │                    ┌─────────────┐            │   Fastly     │ │
│       │                    │   Rollup    │───────────▶│  Bundle      │ │
│       ├────────────────────│   Bundler   │            └──────────────┘ │
│       │                    └─────────────┘             ┌──────────────┐ │
│       │                           │                    │   Vercel     │ │
│       │                    ┌─────────────┐            │  Bundle      │ │
│       └────────────────────│  Platform   │───────────▶└──────────────┘ │
│                            │  Adapters   │                              │
│                            └─────────────┘                              │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Build Configuration

#### TypeScript Configurations
```json
// From: /tsconfig.cloudflare.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "target": "ES2021",
    "lib": ["ES2021", "WebWorker"],
    "types": ["@cloudflare/workers-types"]
  },
  "include": ["src-v2/**/*"],
  "exclude": ["src-v2/**/*.test.ts"]
}
```

#### Build Scripts
```json
// From: /package.json
{
  "scripts": {
    "build:cloudflare": "tsc -p tsconfig.cloudflare.json && rollup -c rollup.cloudflare.config.js",
    "build:fastly": "tsc -p tsconfig.fastly.json && fastly compute build",
    "build:vercel": "tsc -p tsconfig.vercel.json && vercel build",
    "build:all": "npm run build:cloudflare && npm run build:fastly && npm run build:vercel"
  }
}
```

## Platform-Specific Deployments

### Cloudflare Workers

#### Deployment Configuration
```toml
# From: /wrangler.toml.template
name = "optimizely-edge-agent"
main = "dist/cloudflare/index.js"
compatibility_date = "2024-01-01"

[env.production]
vars = { LOG_LEVEL = "info" }
kv_namespaces = [
  { binding = "OPTIMIZELY_KV", id = "your-kv-namespace-id" }
]

[[routes]]
pattern = "example.com/optimizely/*"
zone_name = "example.com"

[build]
command = "npm run build:cloudflare"
```

#### Deployment Process
```bash
# Build and deploy
npm run build:cloudflare
wrangler publish --env production

# Verify deployment
wrangler tail --env production
```

### Fastly Compute@Edge

#### Service Configuration
```toml
# From: /fastly.toml
manifest_version = 2
name = "optimizely-edge-agent"
service_id = "your-service-id"

[scripts]
build = "npm run build:fastly"

[setup]
[setup.backends]
[setup.backends.optimizely]
address = "cdn.optimizely.com"
port = 443

[setup.config_stores]
[setup.config_stores.optimizely_config]
items = [
  { key = "sdk_key", value = "your-sdk-key" },
  { key = "environment", value = "production" }
]
```

#### Deployment Commands
```bash
# Build WASM bundle
fastly compute build

# Deploy to Fastly
fastly compute deploy

# Monitor logs
fastly log-tail --service-id=your-service-id
```

### Vercel Edge Functions

#### Configuration
```json
// From: /vercel.json
{
  "functions": {
    "api/optimizely/**/*.ts": {
      "runtime": "edge",
      "maxDuration": 30
    }
  },
  "rewrites": [
    {
      "source": "/optimizely/:path*",
      "destination": "/api/optimizely"
    }
  ]
}
```

#### Environment Setup
```typescript
// From: /src-v2/vercel.ts
import { createRequestHandler } from './composition/vercelComposition';

export default async function handler(request: Request) {
  const requestHandler = await createRequestHandler(
    request,
    process.env
  );
  
  return requestHandler.handleRequest();
}

export const config = {
  runtime: 'edge',
  regions: ['iad1', 'sfo1', 'fra1']
};
```

## Infrastructure Architecture

### Global Distribution

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     Global Deployment Architecture                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  North America              Europe                   Asia Pacific        │
│  ┌────────────┐            ┌────────────┐          ┌────────────┐      │
│  │  US-East   │            │  EU-West   │          │  AP-East   │      │
│  │  Workers   │◄──────────▶│  Workers   │◄────────▶│  Workers   │      │
│  └────────────┘            └────────────┘          └────────────┘      │
│        │                          │                        │             │
│        ▼                          ▼                        ▼             │
│  ┌────────────┐            ┌────────────┐          ┌────────────┐      │
│  │  Regional  │            │  Regional  │          │  Regional  │      │
│  │  KV Store  │            │  KV Store  │          │  KV Store  │      │
│  └────────────┘            └────────────┘          └────────────┘      │
│        │                          │                        │             │
│        └──────────────────────────┴────────────────────────┘             │
│                                   ▼                                      │
│                          ┌─────────────────┐                            │
│                          │  Global Config  │                            │
│                          │   Repository    │                            │
│                          └─────────────────┘                            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### High Availability Setup

```typescript
// From: /src-v2/services/implementations/RequestHandler.ts
class RequestHandler {
  private readonly fallbackChain = [
    { name: 'primary', url: 'https://primary.optimizely.com' },
    { name: 'secondary', url: 'https://secondary.optimizely.com' },
    { name: 'cache', url: null } // Use cached data
  ];
  
  async handleRequestWithFailover(request: IRequestAdapter): Promise<IResponseAdapter> {
    for (const endpoint of this.fallbackChain) {
      try {
        if (endpoint.url) {
          return await this.handleExternalRequest(endpoint.url, request);
        } else {
          return await this.handleCachedRequest(request);
        }
      } catch (error) {
        this.logger.error(`Failed with ${endpoint.name}`, error);
        continue;
      }
    }
    
    throw new Error('All endpoints failed');
  }
}
```

## Deployment Strategies

### Blue-Green Deployment

```typescript
// Traffic splitting configuration
export const deploymentConfig = {
  blue: {
    version: '2.1.0',
    weight: 90,
    endpoints: ['https://blue.edge.optimizely.com']
  },
  green: {
    version: '2.2.0',
    weight: 10,
    endpoints: ['https://green.edge.optimizely.com']
  }
};

// Route based on weight
function getDeployment(): string {
  const random = Math.random() * 100;
  return random < deploymentConfig.blue.weight ? 'blue' : 'green';
}
```

### Canary Releases

```typescript
// From: /src-v2/services/implementations/ConfigService.ts
interface CanaryConfig {
  enabled: boolean;
  percentage: number;
  features: string[];
  userGroups: string[];
}

class ConfigService {
  async shouldUseCanary(userId: string): Promise<boolean> {
    const canaryConfig = await this.getCanaryConfig();
    
    if (!canaryConfig.enabled) return false;
    
    // Check user group
    if (canaryConfig.userGroups.includes(userId)) return true;
    
    // Check percentage rollout
    const hash = this.hashUserId(userId);
    return (hash % 100) < canaryConfig.percentage;
  }
}
```

## Monitoring and Observability

### Metrics Collection

```typescript
// From: /src-v2/adapters/implementations/cloudflare/CloudflareMetricsAdapter.ts
export class CloudflareMetricsAdapter implements IMetricsAdapter {
  constructor(
    private analytics: AnalyticsEngine,
    private env: CloudflareEnvironment
  ) {}
  
  async reportDeploymentMetrics() {
    this.analytics.writeDataPoint({
      dataset: 'deployments',
      point: {
        timestamp: Date.now(),
        fields: {
          version: process.env.DEPLOYMENT_VERSION,
          region: process.env.CF_REGION,
          success_rate: this.calculateSuccessRate(),
          latency_p99: this.getLatencyPercentile(99)
        }
      }
    });
  }
}
```

### Health Checks

```typescript
// From: /src-v2/services/implementations/ApiRouter.ts
async handleHealthCheck(): Promise<IResponseAdapter> {
  const health = {
    status: 'healthy',
    version: process.env.DEPLOYMENT_VERSION,
    timestamp: Date.now(),
    checks: {
      datafile: await this.checkDatafileAccess(),
      storage: await this.checkStorageAccess(),
      sdk: await this.checkSDKInitialization()
    }
  };
  
  const allHealthy = Object.values(health.checks).every(check => check.healthy);
  
  return this.responseAdapter.json(health, allHealthy ? 200 : 503);
}
```

## Security Considerations

### Environment Isolation

```typescript
// From: /src-v2/adapters/implementations/cloudflare/CloudflareEnvironmentAdapter.ts
export class CloudflareEnvironmentAdapter implements IEnvironmentAdapter {
  private readonly secrets: Set<string> = new Set([
    'OPTIMIZELY_SDK_KEY',
    'API_KEY',
    'WEBHOOK_SECRET'
  ]);
  
  get(key: string): string | undefined {
    const value = this.env[key];
    
    // Prevent secret leakage in logs
    if (this.secrets.has(key) && value) {
      this.logger.debug(`Accessed secret: ${key}`);
      return value;
    }
    
    return value;
  }
}
```

### Network Security

```yaml
# Cloudflare security rules
rules:
  - name: "Block non-HTTPS"
    expression: 'http.request.uri.scheme eq "http"'
    action: block
    
  - name: "Rate limiting"
    expression: 'http.request.uri.path contains "/api/"'
    action: rate_limit
    rate_limit:
      requests_per_minute: 1000
      
  - name: "Geographic restrictions"
    expression: 'ip.geoip.country in {"CN" "RU"}'
    action: challenge
```

## Performance Optimization

### Cold Start Mitigation

```typescript
// From: /src-v2/index.ts
// Pre-warm critical paths
const warmupTasks = [
  () => import('./services/implementations/DecisionService'),
  () => import('./services/implementations/DatafileService'),
  () => fetch('https://cdn.optimizely.com/health')
];

// Execute warmup in background
Promise.all(warmupTasks.map(task => task().catch(() => {})));

// Export handler immediately
export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext) {
    return handleRequest(request, env, ctx);
  }
};
```

### Resource Limits

```typescript
// Platform-specific limits
export const PLATFORM_LIMITS = {
  cloudflare: {
    cpu_ms: 50,
    memory_mb: 128,
    subrequests: 50,
    script_size_mb: 1
  },
  fastly: {
    cpu_ms: 100,
    memory_mb: 128,
    subrequests: 20,
    response_size_mb: 50
  },
  vercel: {
    cpu_ms: 1000,
    memory_mb: 1024,
    duration_s: 30,
    payload_mb: 5
  }
};
```

## Deployment Checklist

### Pre-Deployment
- [ ] Run test suite: `npm test`
- [ ] Build all platforms: `npm run build:all`
- [ ] Validate configurations
- [ ] Check secret management
- [ ] Review security rules

### Deployment
- [ ] Deploy to staging environment
- [ ] Run integration tests
- [ ] Monitor metrics and logs
- [ ] Gradual traffic rollout
- [ ] Verify health checks

### Post-Deployment
- [ ] Monitor error rates
- [ ] Check performance metrics
- [ ] Validate cache behavior
- [ ] Review security alerts
- [ ] Document deployment

## Rollback Procedures

```bash
# Cloudflare rollback
wrangler rollback --env production

# Fastly rollback
fastly service-version activate --version 123

# Vercel rollback
vercel rollback optimizely-edge-agent.vercel.app
```

## See Also

- [System Overview](./system-overview.md) - Overall architecture
- [Platform Adapters](./adapter-pattern.md) - Platform abstraction details
- [Configuration Guide](/docs-sot/configuration/deployment-config.md) - Deployment configuration
- [Operations Guide](/docs-sot/operations/deployment-guide.md) - Operational procedures

## Implementation References

- `/wrangler.toml.template` - Cloudflare deployment template
- `/fastly.toml` - Fastly service configuration
- `/vercel.json` - Vercel deployment settings
- `/src-v2/composition/` - Platform-specific compositions
- `/scripts/deploy/` - Deployment automation scripts