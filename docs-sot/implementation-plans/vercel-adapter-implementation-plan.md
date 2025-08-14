# Vercel Adapter Implementation Plan

## Status: IN PROGRESS
Last Updated: 2025-01-06

## Overview
This document tracks the implementation of missing components for the Vercel adapter to achieve parity with Cloudflare. The Vercel adapter is currently 83% complete (5/6 adapters implemented).

## Current Status
- ✅ **VercelEnvironmentAdapter** - Implemented
- ✅ **VercelLoggerAdapter** - Implemented  
- ❌ **VercelMetricsAdapter** - MISSING (Priority 1)
- ✅ **VercelRequestAdapter** - Implemented
- ✅ **VercelResponseAdapter** - Implemented
- ✅ **VercelStorageAdapter** - Implemented (needs real KV integration)

## Implementation Requirements

### 1. Metrics Implementation Strategy

#### Challenge: No Native Analytics Engine
Unlike Cloudflare's Analytics Engine, Vercel does not provide a native API for custom metrics ingestion.

#### Recommended Solution: Template-Based Metrics Adapters
We will create reusable metrics adapters that work with popular monitoring platforms. This approach provides:

1. **Template Pattern with PrometheusMetricsAdapter**
   - Serves as a foundation for other adapters
   - Demonstrates best practices for metrics collection
   - Shows batching, buffering, and error handling

2. **Production-Ready Adapters**
   - **DataDogMetricsAdapter** - Direct integration with DataDog API
   - **NewRelicMetricsAdapter** - Direct integration with New Relic API
   - **PrometheusMetricsAdapter** - Push Gateway integration (template)

3. **Shared Components**
   - BaseMetricsAdapter for common functionality
   - MetricBuffer for batching and timing
   - Compression utilities for efficient transmission

#### Implementation Approach
```typescript
// Factory will select the appropriate adapter based on configuration
export class VercelAdapterFactory {
  createMetricsAdapter(): IMetricsAdapter | undefined {
    const metricsProvider = this.environmentAdapter.getVariable('METRICS_PROVIDER');
    
    switch (metricsProvider) {
      case 'prometheus':
        return new PrometheusMetricsAdapter(this.logger, this.environmentAdapter);
      case 'datadog':
        return new DataDogMetricsAdapter(this.logger, this.environmentAdapter);
      case 'newrelic':
        return new NewRelicMetricsAdapter(this.logger, this.environmentAdapter);
      default:
        this.logger.warn(`Unknown metrics provider: ${metricsProvider}`);
        return undefined;
    }
  }
}
```

See `metrics-adapters-implementation-strategy.md` for detailed implementation of each adapter.

### 2. Storage Integration Requirements

#### Current State
- Generic `VercelKVNamespace` interface implemented
- Needs integration with actual Vercel KV service

#### Required Updates
1. **Install Vercel KV Client**
   ```bash
   npm install @vercel/kv
   ```

2. **Update VercelStorageAdapter**
   - Replace generic interface with `@vercel/kv` client
   - Handle Redis-style operations
   - Map KV operations to Redis commands

3. **Environment Setup**
   - `KV_REST_API_URL` - Vercel KV endpoint
   - `KV_REST_API_TOKEN` - Authentication token
   - Configure in Vercel dashboard

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
OPTIMIZELY_METRICS_GLOBAL_DIMENSIONS={"environment":"production","region":"us-east-1"}

# Metrics Provider Selection
METRICS_PROVIDER=datadog  # Options: prometheus, datadog, newrelic

# Provider-Specific Configuration
# For Prometheus:
PROMETHEUS_PUSH_GATEWAY_URL=http://prometheus-pushgateway:9091
PROMETHEUS_JOB_NAME=optimizely_edge_agent

# For DataDog:
DD_API_KEY=your-datadog-api-key
DD_SITE=datadoghq.com
DD_ENV=production
DD_SERVICE=optimizely-edge-agent

# For New Relic:
NEW_RELIC_LICENSE_KEY=your-license-key
NEW_RELIC_REGION=US

# Storage
KV_REST_API_URL=https://example-kv.vercel-storage.com
KV_REST_API_TOKEN=your-kv-token

# Optimizely Configuration
DEFAULT_SDK_KEY=your-sdk-key
ADMIN_TOKEN=your-admin-token
OPTIMIZELY_DISABLE_AUTO_FLAG_EXTRACTION=false
```

### 4. Deployment Requirements

#### Local Development
1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Set up local environment**
   ```bash
   vercel env pull .env.local
   ```

3. **Run locally**
   ```bash
   vercel dev
   ```

#### Production Deployment
1. **Configure Vercel project**
   - Create/link Vercel project
   - Set up environment variables
   - Configure KV storage

2. **Deploy**
   ```bash
   vercel --prod
   ```

## Implementation Steps

### Phase 1: Metrics Adapter (Day 1)
- [ ] Create `VercelMetricsAdapter.ts`
- [ ] Implement metric collection methods
- [ ] Add external service integration
- [ ] Update `VercelAdapterFactory` to create metrics adapter
- [ ] Write unit tests

### Phase 2: Storage Integration (Day 1-2)
- [ ] Install `@vercel/kv` package
- [ ] Update `VercelStorageAdapter` to use real KV client
- [ ] Handle Redis command mapping
- [ ] Test KV operations
- [ ] Update error handling

### Phase 3: Composition Updates (Day 2)
- [ ] Update `vercelComposition.ts` to use metrics adapter
- [ ] Add metrics to service initialization
- [ ] Test complete request flow
- [ ] Verify all services work together

### Phase 4: Testing & Validation (Day 2-3)
- [ ] Set up Vercel KV instance
- [ ] Configure test environment
- [ ] Run integration tests
- [ ] Deploy to Vercel preview
- [ ] Validate metrics collection
- [ ] Load testing

### Phase 5: Documentation (Day 3)
- [ ] Update adapter documentation
- [ ] Create deployment guide
- [ ] Document metrics configuration
- [ ] Add troubleshooting section

## Success Criteria

1. **Metrics Collection**
   - All metric types working (counter, gauge, histogram, etc.)
   - Metrics successfully sent to external service
   - Sampling and dimensions supported

2. **Storage Operations**
   - Datafile caching works
   - User profiles persist correctly
   - TTL and metadata supported

3. **Feature Parity**
   - All Cloudflare features work on Vercel
   - Performance is comparable
   - Error handling is robust

4. **Deployment**
   - Deploys successfully to Vercel
   - Environment variables configured
   - Monitoring and logs accessible

## Risks & Mitigations

1. **Risk**: External metrics service latency
   - **Mitigation**: Implement async flushing, batching, and circuit breaker

2. **Risk**: Vercel KV rate limits
   - **Mitigation**: Implement caching layer, request coalescing

3. **Risk**: Cold start performance
   - **Mitigation**: Optimize initialization, use edge config for static data

## Accomplishments Tracker

### Completed ✅
- ✅ Researched Vercel metrics options
- ✅ Identified external service approach for metrics
- ✅ Created implementation plan
- ✅ Documented environment variables
- ✅ **Created shared metrics components (BaseMetricsAdapter, MetricBuffer, RetryManager, CircuitBreaker)**
- ✅ **Implemented PrometheusMetricsAdapter with full production features**
- ✅ **Implemented DataDogMetricsAdapter with full production features**
- ✅ **Implemented NewRelicMetricsAdapter with full production features**
- ✅ **Updated VercelAdapterFactory to create metrics adapters based on METRICS_PROVIDER**
- ✅ **Updated VercelStorageAdapter for real Vercel KV integration**
- ✅ **Updated vercelComposition.ts to use metrics adapters**
- ✅ **Created comprehensive test script for local validation**

### In Progress 🔄
- 🔄 Testing and validation with test script

### Ready for Deployment 🚀
- ⏳ Set up Vercel KV in Vercel project
- ⏳ Configure environment variables in Vercel dashboard
- ⏳ Deploy to Vercel Edge Functions
- ⏳ Production testing and validation

### Next Immediate Steps
1. **Run the test script**: `node test-vercel-adapter.js`
2. **Install @vercel/kv package**: `npm install @vercel/kv`
3. **Set up Vercel project and KV storage**
4. **Configure metrics provider (DataDog, New Relic, or Prometheus)**
5. **Deploy and test in production**

## Next Steps
1. Begin implementing `VercelMetricsAdapter.ts`
2. Set up test metrics endpoint for development
3. Configure Vercel KV in test project
4. Start integration testing