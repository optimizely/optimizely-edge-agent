# Fastly Adapter - Quick Action Plan

## Immediate Actions Required (Day 1)

### 1. Copy Missing Components from Vercel
```bash
# These files can be largely reused with minor adaptations
cp src-v2/composition/vercelComposition.ts src-v2/composition/fastlyComposition.ts
# Then modify for Fastly-specific needs
```

### 2. Create FastlyMetricsAdapter
```typescript
// src-v2/adapters/implementations/fastly/FastlyMetricsAdapter.ts
import { BaseMetricsAdapter } from '../metrics/BaseMetricsAdapter';
import { ILoggerAdapter } from '../../interfaces/ILoggerAdapter';
import { IEnvironmentAdapter } from '../../interfaces/IEnvironmentAdapter';

export class FastlyMetricsAdapter extends BaseMetricsAdapter {
  constructor(logger: ILoggerAdapter, environmentAdapter: IEnvironmentAdapter) {
    super(logger, environmentAdapter);
  }
  
  async flush(): Promise<void> {
    // Implement Fastly-specific flush logic
    // Send to Fastly Real-time Analytics or logging endpoint
  }
}
```

### 3. Update FastlyStorageAdapter for Real Implementation
```typescript
// Update src-v2/adapters/implementations/fastly/FastlyStorageAdapter.ts
import { ObjectStore } from '@fastly/js-compute';

export class FastlyStorageAdapter implements IStorageAdapter {
  private store: ObjectStore;
  
  constructor(storeName: string) {
    this.store = new ObjectStore(storeName);
  }
  // ... implement real methods
}
```

## Critical Updates to fastlyComposition.ts

### Add These Imports
```typescript
import { EdgeModeIntegration } from '../services/implementations/EdgeModeIntegration';
import { EdgeModeHandler } from '../services/implementations/EdgeModeHandler';
import { URLMatcher } from '../services/implementations/URLMatcher';
import { ContentFetcher } from '../services/implementations/ContentFetcher';
import { ContentTransformer } from '../services/implementations/ContentTransformer';
import { RequestForwarder } from '../services/implementations/RequestForwarder';
import { ApiRouter } from '../services/implementations/ApiRouter';
import { CookieService } from '../services/implementations/CookieService';
import { KVUserProfileService } from '../services/storage/KVUserProfileService';
import { OptimizelyUserProfileServiceAdapter } from '../services/storage/OptimizelyUserProfileServiceAdapter';
import { FastlyMetricsAdapter } from '../adapters/implementations/fastly/FastlyMetricsAdapter';
```

### Add Edge Mode Setup (Copy from Vercel)
```typescript
// Create Edge Mode components
const urlMatcher = new URLMatcher(logger);
const edgeModeHandler = new EdgeModeHandler(
  logger,
  cacheService,
  createResponseAdapter,
  decisionService,
  configService,
  defaultSdkKey,
  undefined, // devContentBaseUrl
  'fastly' // cdnProvider
);

const contentFetcher = new ContentFetcher(
  logger,
  createResponseAdapter,
  cacheService,
  undefined // devContentBaseUrl
);

const contentTransformer = new ContentTransformer(logger);
const requestForwarder = new RequestForwarder(logger, createResponseAdapter);

const edgeModeIntegration = new EdgeModeIntegration(
  urlMatcher,
  edgeModeHandler,
  contentFetcher,
  cacheService,
  contentTransformer,
  requestForwarder,
  logger,
  decisionService,
  configService,
  metricsAdapter
);
```

### Add API Router
```typescript
const apiRouter = new ApiRouter(
  decisionService,
  datafileService,
  configService,
  eventService,
  logger,
  flagStorageService,
  storageAdapter,
  metricsAdapter
);
```

### Update RequestHandler Creation
```typescript
const requestHandler = new RequestHandler(
  decisionService,
  eventService,
  logger,
  cacheService,
  edgeModeIntegration, // Add this
  metricsAdapter,      // Add this
  cookieService,       // Add this
  flagStorageService,  // Add this
  configService,       // Add this
  undefined,           // cleanupConfig
  apiRouter           // Add this
);
```

## SDK Import Fix (Apply Vercel Learning)
```typescript
// In DecisionService.ts and other files using Optimizely SDK
import * as optimizely from '@optimizely/optimizely-sdk/lite';
// NOT: import * as optimizely from '@optimizely/optimizely-sdk';
```

## Compression Headers Fix (Apply Vercel Learning)
In ContentFetcher, remove problematic headers:
```typescript
const problematicHeaders = ['content-encoding', 'transfer-encoding', 'content-length'];
fetchResponse.headers.forEach((value, key) => {
  if (!problematicHeaders.includes(key.toLowerCase())) {
    responseAdapter.setHeader(key, value);
  }
});
```

## FEX Gating Logic (Copy from Vercel)
```typescript
// Add to handleFastlyComputeRequest
const url = new URL(request.url);
const fexHeaderValue = request.headers.get('X-Optimizely-Enable-FEX');
const fexQueryParam = url.searchParams.get('enable_fex') || 
                     url.searchParams.get('enable_optimizely') ||
                     url.searchParams.get('optimizely_enabled');

const fexEnabled = (fexHeaderValue === 'true' || fexHeaderValue === '1') ||
                  (fexQueryParam === 'true' || fexQueryParam === '1');

if (!fexEnabled) {
  // Bypass Optimizely processing
  // Return default content or proxy to origin
}
```

## Create fastly.toml
```toml
manifest_version = 3
name = "optimizely-edge-agent"
authors = ["your-email@example.com"]
description = "Optimizely Edge Agent for Fastly Compute@Edge"
service_id = "YOUR_SERVICE_ID"

[local_server]
  [local_server.backends]
    [local_server.backends.origin]
      url = "https://simone-coelho.github.io"
  
  [local_server.object_stores]
    [local_server.object_stores.optimizely_data]

[setup]
  [setup.backends]
    [setup.backends.origin]
      address = "simone-coelho.github.io"
      port = 443
      override_host = "simone-coelho.github.io"
  
  [setup.object_stores]
    [setup.object_stores.optimizely_data]
```

## Update package.json Scripts
```json
{
  "scripts": {
    "build:fastly": "tsc -p tsconfig.fastly.json && webpack --config webpack.fastly.js",
    "dev:fastly": "fastly compute serve --watch",
    "deploy:fastly": "npm run build:fastly && fastly compute deploy",
    "test:fastly": "npm run build:fastly && fastly compute serve"
  }
}
```

## Environment Variables (.env.fastly)
```env
# Optimizely
DEFAULT_SDK_KEY=8mR1pGh8u2ztUP8GqjmQq
ADMIN_TOKEN=dev-admin-token

# Fastly
FASTLY_SERVICE_ID=your-service-id
FASTLY_OBJECT_STORE_NAME=optimizely_data

# Metrics
OPTIMIZELY_METRICS_ENABLED=true
FASTLY_LOG_ENDPOINT=https://logs.example.com/fastly

# Logging
LOG_LEVEL=info
```

## Testing Checklist
- [ ] Build completes: `npm run build:fastly`
- [ ] Local dev works: `fastly compute serve`
- [ ] API endpoints respond: `/api/test`, `/api/decide`
- [ ] Edge Mode fetches from GitHub Pages
- [ ] Cookies are set and read correctly
- [ ] Metrics are logged
- [ ] Deploy succeeds: `fastly compute deploy`

## Known Issues to Watch For
1. **WASM Memory**: Monitor memory usage, may need to optimize
2. **Async Operations**: Fastly has different async patterns
3. **Fetch API**: May behave differently than standard
4. **Object Store**: Different API than KV stores
5. **Build Size**: WASM builds can be large

## Quick Validation Test
```bash
# After implementation, test with:
curl -H "X-Optimizely-Enable-FEX: true" \
     -H "X-Optimizely-SDK-Key: 8mR1pGh8u2ztUP8GqjmQq" \
     "https://your-service.edgecompute.app/?enable_optimizely=true"

# Should return content from GitHub Pages, not error
```

## Time Estimate
- **Minimum Viable**: 3-4 days (copy & adapt from Vercel)
- **Full Parity**: 11-15 days (with testing and optimization)
- **Production Ready**: 15-20 days (with monitoring and documentation)