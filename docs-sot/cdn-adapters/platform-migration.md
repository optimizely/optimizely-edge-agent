# Platform Migration Guide

## Overview

This guide helps you migrate the Optimizely Edge Agent between different CDN platforms. The adapter architecture makes migrations straightforward, but each platform has unique characteristics that require careful consideration.

## Migration Strategy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Platform Migration Flow                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. Assessment           2. Preparation         3. Migration            │
│  ┌──────────────┐       ┌──────────────┐      ┌──────────────┐       │
│  │ Current State │       │ Code Changes │      │   Deploy &   │       │
│  │   Analysis    │──────▶│ Config Setup │─────▶│   Validate   │       │
│  │              │       │ Testing      │      │              │       │
│  └──────────────┘       └──────────────┘      └──────────────┘       │
│                                                                          │
│  4. Cutover             5. Monitoring          6. Cleanup              │
│  ┌──────────────┐       ┌──────────────┐      ┌──────────────┐       │
│  │Traffic Switch│       │ Performance  │      │ Remove Old   │       │
│  │   Gradual    │──────▶│   Metrics    │─────▶│ Platform     │       │
│  │              │       │ Error Rates  │      │              │       │
│  └──────────────┘       └──────────────┘      └──────────────┘       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Common Migration Scenarios

### Cloudflare to Fastly

#### Key Differences
| Feature | Cloudflare | Fastly |
|---------|------------|--------|
| Runtime | V8 Isolates | WebAssembly |
| Storage | Workers KV | Config Store |
| Caching | Cache API | Surrogate Control |
| Analytics | Analytics Engine | Real-time Stats |

#### Code Changes

```typescript
// Before (Cloudflare)
export default {
  async fetch(request: Request, env: CloudflareEnvironment, ctx: ExecutionContext) {
    const storage = new CloudflareStorageAdapter(env.OPTIMIZELY_KV);
    // ... handler logic
  }
};

// After (Fastly)
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event));
});

async function handleRequest(event: FetchEvent) {
  const storage = new FastlyStorageAdapter('optimizely_config');
  // ... handler logic
}
```

#### Storage Migration

```typescript
// Migrate KV data to Config Store
async function migrateKVToConfigStore(
  kvNamespace: KVNamespace,
  configStore: ConfigStore
): Promise<void> {
  // List all keys from KV
  let cursor: string | undefined;
  const keys: string[] = [];
  
  do {
    const result = await kvNamespace.list({ cursor });
    keys.push(...result.keys.map(k => k.name));
    cursor = result.cursor;
  } while (cursor);
  
  // Prepare config store entries
  const entries = await Promise.all(
    keys.map(async key => {
      const value = await kvNamespace.get(key);
      return { key, value };
    })
  );
  
  // Update config store via API
  await updateConfigStore(entries);
}
```

### Fastly to Vercel

#### Key Differences
| Feature | Fastly | Vercel |
|---------|--------|--------|
| Runtime | WebAssembly | Edge Runtime |
| Storage | Config Store | Edge Config/KV |
| Backend | Backend configs | Fetch API |
| Deployment | Service versions | Immutable deployments |

#### Code Changes

```typescript
// Before (Fastly)
import { ConfigStore } from 'fastly:config-store';

const store = new ConfigStore('optimizely_config');
const sdkKey = store.get('sdk_key');

// After (Vercel)
import { get } from '@vercel/edge-config';

const sdkKey = await get('sdk_key');
```

#### Configuration Migration

```typescript
// Export Fastly config to Vercel format
async function exportFastlyConfig(): Promise<VercelEdgeConfig> {
  const fastlyConfig = getAllConfigStoreItems();
  
  // Transform to Vercel Edge Config format
  return {
    items: fastlyConfig.map(item => ({
      key: item.key,
      value: item.value,
      description: `Migrated from Fastly ${new Date().toISOString()}`
    }))
  };
}

// Import to Vercel
async function importToVercel(config: VercelEdgeConfig): Promise<void> {
  const response = await fetch(
    `https://api.vercel.com/v1/edge-config/${EDGE_CONFIG_ID}/items`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${VERCEL_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(config)
    }
  );
  
  if (!response.ok) {
    throw new Error(`Import failed: ${response.statusText}`);
  }
}
```

### Vercel to Cloudflare

#### Key Differences
| Feature | Vercel | Cloudflare |
|---------|--------|------------|
| Runtime | Edge Runtime | V8 Isolates |
| Storage | Edge Config/KV | Workers KV |
| Routing | Middleware | Workers Routes |
| Regions | Limited | Global |

#### Code Changes

```typescript
// Before (Vercel)
export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  const kv = await import('@vercel/kv');
  const value = await kv.get('key');
  // ... handler logic
}

// After (Cloudflare)
export default {
  async fetch(request: Request, env: CloudflareEnvironment) {
    const value = await env.KV_NAMESPACE.get('key');
    // ... handler logic
  }
};
```

## Platform-Agnostic Code

### Best Practices

```typescript
// Write platform-agnostic service code
export class OptimizelyService {
  constructor(
    private storage: IStorageAdapter,
    private logger: ILoggerAdapter,
    private env: IEnvironmentAdapter
  ) {}
  
  async getDecision(userId: string, flagKey: string): Promise<Decision> {
    // This code works on any platform
    const sdkKey = this.env.getRequired('OPTIMIZELY_SDK_KEY');
    const cached = await this.storage.get(`decision:${userId}:${flagKey}`);
    
    if (cached) {
      this.logger.debug('Cache hit for decision');
      return JSON.parse(cached);
    }
    
    // ... fetch and cache decision
  }
}
```

### Adapter Abstraction

```typescript
// Platform detection and adapter selection
export function createPlatformAdapter(): AdapterSet {
  // Detect platform
  if (typeof globalThis.CloudflareEnvironment !== 'undefined') {
    return new CloudflareAdapterFactory();
  } else if (typeof fastly !== 'undefined') {
    return new FastlyAdapterFactory();
  } else if (process.env.VERCEL) {
    return new VercelAdapterFactory();
  }
  
  throw new Error('Unsupported platform');
}
```

## Migration Checklist

### Pre-Migration

- [ ] **Inventory Current Setup**
  ```typescript
  interface MigrationInventory {
    platform: 'cloudflare' | 'fastly' | 'vercel';
    services: string[];
    storage: {
      type: string;
      size: number;
      keys: number;
    };
    configuration: Record<string, any>;
    routes: string[];
    customCode: string[];
  }
  ```

- [ ] **Identify Dependencies**
  ```typescript
  // Check for platform-specific code
  const platformSpecific = [
    /CloudflareEnvironment/g,
    /fastly:/g,
    /@vercel\//g,
    /workers-types/g
  ];
  ```

- [ ] **Plan Data Migration**
  ```typescript
  interface DataMigrationPlan {
    storageItems: number;
    configItems: number;
    estimatedTime: number;
    backupLocation: string;
  }
  ```

### During Migration

- [ ] **Set Up New Platform**
  ```bash
  # Cloudflare
  wrangler init optimizely-edge-agent
  
  # Fastly
  fastly compute init
  
  # Vercel
  vercel init optimizely-edge-agent
  ```

- [ ] **Migrate Configuration**
  ```typescript
  // Generic config migrator
  class ConfigMigrator {
    async migrate(
      source: IStorageAdapter,
      target: IStorageAdapter,
      transform?: (key: string, value: string) => [string, string]
    ): Promise<void> {
      const items = await source.list();
      
      for (const item of items.keys) {
        const value = await source.get(item.name);
        if (value) {
          const [newKey, newValue] = transform 
            ? transform(item.name, value)
            : [item.name, value];
          
          await target.put(newKey, newValue);
        }
      }
    }
  }
  ```

- [ ] **Update Build Process**
  ```json
  // package.json
  {
    "scripts": {
      "build:cloudflare": "tsc -p tsconfig.cloudflare.json && wrangler build",
      "build:fastly": "webpack --config webpack.fastly.js",
      "build:vercel": "tsc -p tsconfig.vercel.json"
    }
  }
  ```

### Post-Migration

- [ ] **Validate Functionality**
  ```typescript
  // Platform validation tests
  describe('Platform Migration Validation', () => {
    test('Storage operations', async () => {
      await storage.put('test', 'value');
      const result = await storage.get('test');
      expect(result).toBe('value');
    });
    
    test('Decision making', async () => {
      const decision = await decisionService.decide(
        'test-user',
        'test-flag'
      );
      expect(decision).toBeDefined();
    });
  });
  ```

- [ ] **Monitor Performance**
  ```typescript
  // Compare metrics before/after
  interface PerformanceComparison {
    metric: string;
    before: number;
    after: number;
    change: string;
  }
  ```

## Traffic Migration Strategies

### Blue-Green Deployment

```typescript
// DNS-based traffic switching
interface BlueGreenConfig {
  blue: {
    platform: 'cloudflare';
    endpoint: 'blue.example.com';
    weight: 100;
  };
  green: {
    platform: 'vercel';
    endpoint: 'green.example.com';
    weight: 0;
  };
}

// Gradual migration
async function migrateTraffic(steps: number[]): Promise<void> {
  for (const percentage of steps) {
    await updateDNSWeights({
      blue: 100 - percentage,
      green: percentage
    });
    
    // Monitor for issues
    await sleep(300000); // 5 minutes
    
    const metrics = await getMetrics();
    if (metrics.errorRate > threshold) {
      await rollback();
      throw new Error('Migration failed');
    }
  }
}
```

### Canary Deployment

```typescript
// Header-based routing for canary
function routeRequest(request: Request): string {
  const canaryHeader = request.headers.get('X-Canary');
  const canaryPercentage = 10;
  
  if (canaryHeader === 'true') {
    return 'new-platform';
  }
  
  // Random percentage
  const random = Math.random() * 100;
  return random < canaryPercentage ? 'new-platform' : 'old-platform';
}
```

## Platform-Specific Considerations

### Storage Capacity

```typescript
// Platform storage limits
const STORAGE_LIMITS = {
  cloudflare: {
    kv: {
      valueSize: 25 * 1024 * 1024, // 25MB
      keySize: 512,
      namespace: Infinity
    }
  },
  fastly: {
    configStore: {
      valueSize: 8000, // 8KB
      keySize: 256,
      totalSize: 1024 * 1024 // 1MB
    }
  },
  vercel: {
    edgeConfig: {
      valueSize: 1024 * 1024, // 1MB
      totalSize: 512 * 1024 * 1024 // 512MB
    },
    kv: {
      valueSize: 25 * 1024 * 1024, // 25MB
      keySize: 512
    }
  }
};
```

### API Compatibility

```typescript
// Platform API differences
class PlatformCompatibility {
  // Cloudflare uses native Request/Response
  cloudflareRequest(request: Request): Request {
    return request;
  }
  
  // Fastly requires special handling
  fastlyRequest(event: FetchEvent): Request {
    return new Request(event.request.url, {
      method: event.request.method,
      headers: event.request.headers,
      body: event.request.body
    });
  }
  
  // Vercel extends Request
  vercelRequest(request: NextRequest): Request {
    return new Request(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body
    });
  }
}
```

## Rollback Strategy

### Quick Rollback

```typescript
// Implement circuit breaker for rollback
class MigrationCircuitBreaker {
  private errorCount = 0;
  private readonly threshold = 10;
  private readonly window = 60000; // 1 minute
  
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch('https://new-platform.com/health');
      
      if (!response.ok) {
        this.errorCount++;
        
        if (this.errorCount >= this.threshold) {
          await this.triggerRollback();
          return false;
        }
      } else {
        this.errorCount = 0;
      }
      
      return true;
    } catch (error) {
      this.errorCount++;
      return false;
    }
  }
  
  private async triggerRollback(): Promise<void> {
    console.error('Triggering automatic rollback');
    
    // Revert DNS
    await updateDNS({
      'example.com': 'old-platform.com'
    });
    
    // Alert team
    await sendAlert({
      severity: 'critical',
      message: 'Platform migration rolled back'
    });
  }
}
```

### Data Rollback

```typescript
// Backup and restore functionality
class DataBackup {
  async backup(storage: IStorageAdapter): Promise<string> {
    const timestamp = new Date().toISOString();
    const backupKey = `backup:${timestamp}`;
    
    const items = await storage.list();
    const data: Record<string, string> = {};
    
    for (const item of items.keys) {
      const value = await storage.get(item.name);
      if (value) {
        data[item.name] = value;
      }
    }
    
    // Store backup
    await storage.put(backupKey, JSON.stringify(data));
    
    return backupKey;
  }
  
  async restore(storage: IStorageAdapter, backupKey: string): Promise<void> {
    const backup = await storage.get(backupKey);
    if (!backup) {
      throw new Error('Backup not found');
    }
    
    const data = JSON.parse(backup);
    
    for (const [key, value] of Object.entries(data)) {
      await storage.put(key, value as string);
    }
  }
}
```

## Testing Migration

### Cross-Platform Tests

```typescript
// Run same tests on different platforms
describe('Cross-Platform Compatibility', () => {
  const platforms = ['cloudflare', 'fastly', 'vercel'];
  
  platforms.forEach(platform => {
    describe(`${platform} platform`, () => {
      let handler: any;
      
      beforeEach(() => {
        handler = createHandlerForPlatform(platform);
      });
      
      test('handles basic request', async () => {
        const request = new Request('https://example.com/api/decide');
        const response = await handler(request);
        
        expect(response.status).toBe(200);
      });
      
      test('storage operations work', async () => {
        const storage = getStorageForPlatform(platform);
        
        await storage.put('test-key', 'test-value');
        const value = await storage.get('test-key');
        
        expect(value).toBe('test-value');
      });
    });
  });
});
```

### Performance Benchmarks

```typescript
// Compare platform performance
async function benchmarkPlatforms(): Promise<BenchmarkResults> {
  const results: BenchmarkResults = {};
  
  for (const platform of ['cloudflare', 'fastly', 'vercel']) {
    const times: number[] = [];
    
    // Run multiple iterations
    for (let i = 0; i < 100; i++) {
      const start = Date.now();
      
      await fetch(`https://${platform}.example.com/api/decide`, {
        method: 'POST',
        body: JSON.stringify({
          userId: 'bench-user',
          flagKey: 'bench-flag'
        })
      });
      
      times.push(Date.now() - start);
    }
    
    results[platform] = {
      min: Math.min(...times),
      max: Math.max(...times),
      avg: times.reduce((a, b) => a + b) / times.length,
      p50: percentile(times, 50),
      p95: percentile(times, 95),
      p99: percentile(times, 99)
    };
  }
  
  return results;
}
```

## Best Practices

### 1. Maintain Platform Abstraction

```typescript
// Always use interfaces, not concrete implementations
class MyService {
  constructor(
    private storage: IStorageAdapter,  // ✅ Good
    // private kv: KVNamespace         // ❌ Bad - platform specific
  ) {}
}
```

### 2. Test on Multiple Platforms

```bash
# Run tests on all platforms
npm run test:cloudflare
npm run test:fastly  
npm run test:vercel
```

### 3. Document Platform Differences

```typescript
/**
 * Storage adapter implementation notes:
 * - Cloudflare: Uses Workers KV, eventually consistent
 * - Fastly: Uses Config Store, read-only at runtime
 * - Vercel: Uses Edge Config or KV, different APIs
 */
```

## Troubleshooting

### Common Migration Issues

1. **Storage API Differences**
   ```typescript
   // Handle platform-specific storage APIs
   try {
     // Try platform-specific API
     return await this.nativeAPI.get(key);
   } catch (error) {
     // Fall back to generic adapter
     return await this.adapter.get(key);
   }
   ```

2. **Build Configuration**
   ```typescript
   // Ensure correct TypeScript config
   {
     "compilerOptions": {
       "types": ["@cloudflare/workers-types"] // Platform-specific
     }
   }
   ```

3. **Environment Variables**
   ```typescript
   // Handle different env var access
   const getEnvVar = (key: string): string | undefined => {
     return globalThis[key] ||           // Cloudflare
            process.env[key] ||         // Node/Vercel
            fastly.env.get(key);        // Fastly
   };
   ```

## See Also

- [Adapter Development](./adapter-development.md) - Building custom adapters
- [Cloudflare Adapter](./cloudflare-adapter.md) - Cloudflare specifics
- [Fastly Adapter](./fastly-adapter.md) - Fastly specifics
- [Vercel Adapter](./vercel-adapter.md) - Vercel specifics
- [Testing Guide](./testing-adapters.md) - Cross-platform testing