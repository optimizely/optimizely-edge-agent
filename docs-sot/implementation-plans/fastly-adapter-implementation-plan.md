# Fastly Adapter Implementation Plan

## Status: PENDING
Last Updated: 2025-01-06

## Overview
This document tracks the implementation of missing components for the Fastly adapter to achieve parity with Cloudflare. The Fastly adapter is currently 83% complete (5/6 adapters implemented).

## Current Status
- ✅ **FastlyEnvironmentAdapter** - Implemented
- ✅ **FastlyLoggerAdapter** - Implemented  
- ❌ **FastlyMetricsAdapter** - MISSING (Priority 1)
- ✅ **FastlyRequestAdapter** - Implemented
- ✅ **FastlyResponseAdapter** - Implemented
- ✅ **FastlyStorageAdapter** - Implemented (needs real Object Store integration)

## Implementation Requirements

### 1. Metrics Implementation Strategy

#### Fastly-Specific Options

1. **Fastly Real-time Analytics API** (Recommended)
   - Available for all Fastly customers
   - Provides real-time stats and historical data
   - Requires API token for access
   - Can create custom logging endpoints

2. **Fastly Logging Endpoints**
   - Configure custom log streaming
   - Send to: Datadog, New Relic, S3, BigQuery, etc.
   - Use structured logging format
   - Real-time log delivery

3. **Edge Dictionary + Backend**
   - Store aggregated metrics in Edge Dictionary
   - Periodically flush to backend service
   - Limited by dictionary size constraints

#### Implementation Approach
```typescript
export class FastlyMetricsAdapter implements IMetricsAdapter {
  private logger: ILoggerAdapter;
  private config: MetricsConfiguration;
  private metrics: any[] = [];
  private logEndpoint: string;
  
  constructor(logger: ILoggerAdapter, environmentAdapter: IEnvironmentAdapter) {
    this.logger = logger;
    this.config = extractMetricsConfig(environmentAdapter);
    this.logEndpoint = environmentAdapter.getVariable('FASTLY_LOG_ENDPOINT') || '';
  }
  
  async flush(): Promise<void> {
    if (!this.logEndpoint || this.metrics.length === 0) return;
    
    // Fastly supports custom logging endpoints
    const logData = {
      timestamp: new Date().toISOString(),
      service_id: fastly.env.get('FASTLY_SERVICE_ID'),
      metrics: this.metrics
    };
    
    // Send to configured logging endpoint
    await fetch(this.logEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logData)
    });
    
    this.metrics = [];
  }
}
```

### 2. Storage Integration Requirements

#### Current State
- Generic `FastlyKVStore` interface implemented
- Needs integration with Fastly Object Store or Config Store

#### Fastly Storage Options

1. **Fastly Object Store** (Recommended for KV operations)
   - Key-value storage at the edge
   - Read/write operations
   - TTL support
   - Suitable for user profiles

2. **Config Store (Edge Dictionaries)**
   - Read-only at runtime
   - Updated via API
   - Good for configuration data
   - Not suitable for user profiles

3. **Backend Storage**
   - Use origin server for storage
   - Higher latency but more flexible
   - Can use any database

#### Required Updates
```typescript
// Update FastlyStorageAdapter to use Object Store
import { ObjectStore } from '@fastly/js-compute';

export class FastlyStorageAdapter implements IStorageAdapter {
  private store: ObjectStore;
  
  constructor(storeName: string) {
    this.store = new ObjectStore(storeName);
  }
  
  async get(key: string, type: 'text' | 'json'): Promise<any> {
    const entry = await this.store.get(key);
    if (!entry) return null;
    
    const value = await entry.text();
    return type === 'json' ? JSON.parse(value) : value;
  }
  
  async put(key: string, value: any, options?: StoragePutOptions): Promise<void> {
    const body = typeof value === 'object' ? JSON.stringify(value) : value;
    await this.store.put(key, body);
  }
}
```

### 3. Environment Variables

#### Required Variables
```env
# Logging
LOG_LEVEL=info

# Metrics Configuration
OPTIMIZELY_METRICS_ENABLED=true
OPTIMIZELY_METRICS_PREFIX=optly
OPTIMIZELY_METRICS_SAMPLING_RATE=1.0
OPTIMIZELY_METRICS_MAX_DIMENSIONS=10
OPTIMIZELY_METRICS_ENABLE_HISTOGRAMS=true
OPTIMIZELY_METRICS_GLOBAL_DIMENSIONS={"environment":"production","pop":"IAD"}

# Fastly-Specific
FASTLY_SERVICE_ID=your-service-id
FASTLY_LOG_ENDPOINT=https://logs.example.com/fastly
FASTLY_OBJECT_STORE_NAME=optimizely-data

# Optimizely Configuration
DEFAULT_SDK_KEY=your-sdk-key
ADMIN_TOKEN=your-admin-token
OPTIMIZELY_DISABLE_AUTO_FLAG_EXTRACTION=false
```

### 4. Deployment Requirements

#### Build Configuration
1. **Update `fastly.toml`**
   ```toml
   manifest_version = 3
   name = "optimizely-edge-agent"
   
   [local_server]
   [local_server.object_stores]
   [local_server.object_stores.optimizely-data]
   
   [setup]
   [setup.object_stores]
   [setup.object_stores.optimizely-data]
   ```

2. **Webpack Configuration**
   - Target: `webworker`
   - Output: WASM-compatible bundle
   - Memory limits: 128MB

#### Deployment Steps
1. **Install Fastly CLI**
   ```bash
   brew install fastly/tap/fastly
   ```

2. **Build for Compute@Edge**
   ```bash
   npm run build:fastly
   fastly compute build
   ```

3. **Deploy**
   ```bash
   fastly compute deploy
   ```

## Implementation Steps

### Phase 1: Metrics Adapter (Day 1)
- [ ] Create `FastlyMetricsAdapter.ts`
- [ ] Implement Fastly logging integration
- [ ] Add batching for performance
- [ ] Update `FastlyAdapterFactory`
- [ ] Write unit tests

### Phase 2: Storage Integration (Day 1-2)
- [ ] Research Fastly Object Store API
- [ ] Update `FastlyStorageAdapter` for Object Store
- [ ] Implement TTL and metadata support
- [ ] Handle WASM memory constraints
- [ ] Test storage operations

### Phase 3: Platform Features (Day 2-3)
- [ ] Add geolocation support
- [ ] Implement request collapsing
- [ ] Add edge caching with Surrogate-Control
- [ ] Integrate Config Store for static data

### Phase 4: Testing & Validation (Day 3-4)
- [ ] Set up Fastly service
- [ ] Configure Object Store
- [ ] Run integration tests
- [ ] Deploy to test environment
- [ ] Validate metrics and storage
- [ ] Performance testing

### Phase 5: Documentation (Day 4)
- [ ] Update adapter documentation
- [ ] Create Fastly deployment guide
- [ ] Document WASM considerations
- [ ] Add troubleshooting section

## Success Criteria

1. **Metrics Collection**
   - Metrics successfully logged to endpoint
   - Real-time analytics integration working
   - Batching and performance optimized

2. **Storage Operations**
   - Object Store integration complete
   - User profiles persist correctly
   - Performance within WASM limits

3. **Platform Features**
   - Geolocation data available
   - Request collapsing reduces load
   - Edge caching improves performance

4. **Deployment**
   - Builds successfully as WASM
   - Deploys to Compute@Edge
   - Runs within memory limits

## Risks & Mitigations

1. **Risk**: WASM memory limits (128MB)
   - **Mitigation**: Implement aggressive caching strategies, stream processing

2. **Risk**: Object Store latency
   - **Mitigation**: Use Config Store for frequently accessed data

3. **Risk**: Complex build process
   - **Mitigation**: Create detailed build scripts and documentation

## Accomplishments Tracker

### Completed
- ✅ Created Fastly implementation plan
- ✅ Researched Fastly storage options
- ✅ Identified metrics strategies

### In Progress
- 🔄 None (pending Vercel completion)

### Pending
- ⏳ FastlyMetricsAdapter implementation
- ⏳ Object Store integration
- ⏳ Platform feature additions
- ⏳ WASM optimization
- ⏳ Testing and validation
- ⏳ Production deployment

## Next Steps
1. Complete Vercel implementation first
2. Begin FastlyMetricsAdapter after Vercel validation
3. Set up Fastly Compute@Edge test environment
4. Research Object Store API in detail