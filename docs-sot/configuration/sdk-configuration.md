# SDK Configuration

## Overview

The Optimizely SDK is at the heart of the Edge Agent's decision-making capabilities. This document covers all SDK-related configuration options, from initialization parameters to advanced decision options and event handling.

## SDK Initialization

### Basic Configuration

```typescript
// From: /src-v2/services/implementations/DecisionService.ts
const sdkConfig = {
  sdkKey: config.sdkKey,
  datafile: await this.datafileService.getDatafile(config.sdkKey),
  userProfileService: this.userProfileService,
  eventDispatcher: this.eventDispatcher,
  logger: this.logger,
  errorHandler: this.errorHandler,
  defaultDecideOptions: this.getDefaultDecideOptions(config)
};

const optimizelyClient = optimizely.createInstance(sdkConfig);
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `sdkKey` | string | required | Your Optimizely SDK key |
| `datafile` | object | auto-fetch | Project configuration datafile |
| `userProfileService` | object | KV-backed | User profile persistence |
| `eventDispatcher` | object | HTTP dispatcher | Event sending implementation |
| `logger` | object | platform logger | Logging implementation |
| `errorHandler` | object | default | Error handling implementation |
| `defaultDecideOptions` | string[] | [] | Default options for decide calls |

## Decide Options

### Available Options

```typescript
// From: /src-v2/utils/sdkConfigUtils.ts
export enum OptimizelyDecideOption {
  DISABLE_DECISION_EVENT = 'DISABLE_DECISION_EVENT',
  ENABLED_FLAGS_ONLY = 'ENABLED_FLAGS_ONLY', 
  IGNORE_USER_PROFILE_SERVICE = 'IGNORE_USER_PROFILE_SERVICE',
  INCLUDE_REASONS = 'INCLUDE_REASONS',
  EXCLUDE_VARIABLES = 'EXCLUDE_VARIABLES'
}
```

### Option Descriptions

#### DISABLE_DECISION_EVENT
Prevents sending decision events to Optimizely for this decision:
```typescript
// Use when you need the decision but don't want to track it
const decision = await client.decide(userId, flagKey, {
  decideOptions: ['DISABLE_DECISION_EVENT']
});
```

#### ENABLED_FLAGS_ONLY
Only returns decisions for flags that are enabled:
```typescript
// Filter out disabled flags
const decisions = await client.decideAll(userId, {
  decideOptions: ['ENABLED_FLAGS_ONLY']
});
// Returns only flags where enabled=true
```

#### IGNORE_USER_PROFILE_SERVICE
Bypasses user profile service for this decision:
```typescript
// Fresh decision without stored user data
const decision = await client.decide(userId, flagKey, {
  decideOptions: ['IGNORE_USER_PROFILE_SERVICE']
});
```

#### INCLUDE_REASONS
Includes detailed reasons for the decision:
```typescript
// Get decision reasoning for debugging
const decision = await client.decide(userId, flagKey, {
  decideOptions: ['INCLUDE_REASONS']
});
console.log(decision.reasons); // Array of reason strings
```

#### EXCLUDE_VARIABLES
Excludes variable values from the response:
```typescript
// Get decision without variable values (smaller payload)
const decision = await client.decide(userId, flagKey, {
  decideOptions: ['EXCLUDE_VARIABLES']
});
// decision.variables will be empty
```

### Setting Default Options

```typescript
// Via environment variable
export OPTIMIZELY_DECIDE_OPTIONS="DISABLE_DECISION_EVENT,INCLUDE_REASONS"

// Via configuration
const config = {
  defaultDecideOptions: ['DISABLE_DECISION_EVENT', 'INCLUDE_REASONS']
};

// Via request header
headers['X-Optimizely-Decide-Options'] = 'ENABLED_FLAGS_ONLY,EXCLUDE_VARIABLES';
```

## Datafile Management

### Datafile Configuration

```typescript
// From: /src-v2/services/implementations/DatafileService.ts
interface DatafileConfig {
  // URL template for fetching datafiles
  datafileUrlTemplate: string; // Default: 'https://cdn.optimizely.com/datafiles/{sdkKey}.json'
  
  // Auto-update configuration
  enableAutoDatafileUpdates: boolean; // Default: true
  datafileUpdateInterval: number; // Default: 300000 (5 minutes)
  
  // Caching
  datafileCacheTime: number; // Default: 300 (seconds)
  enableDatafileCache: boolean; // Default: true
  
  // Validation
  validateDatafileSignature: boolean; // Default: false
}
```

### Custom Datafile Sources

```typescript
// Use custom CDN
const config = {
  datafileUrlTemplate: 'https://custom-cdn.com/optimizely/{sdkKey}.json'
};

// Use local datafile
const config = {
  datafileUrlTemplate: 'file:///opt/datafiles/{sdkKey}.json'
};

// Use versioned datafiles
const config = {
  datafileUrlTemplate: 'https://cdn.com/datafiles/{sdkKey}/v{version}.json'
};
```

### Datafile Update Strategies

```typescript
// From: /src-v2/services/implementations/DatafileService.ts
class DatafileService {
  // Polling strategy
  private async startPolling(sdkKey: string): Promise<void> {
    if (!this.config.enableAutoDatafileUpdates) return;
    
    setInterval(async () => {
      try {
        const newDatafile = await this.fetchDatafile(sdkKey);
        if (this.hasDatafileChanged(newDatafile)) {
          await this.updateDatafile(sdkKey, newDatafile);
          this.emit('datafileUpdated', { sdkKey, datafile: newDatafile });
        }
      } catch (error) {
        this.logger.error('Datafile update failed', error);
      }
    }, this.config.datafileUpdateInterval);
  }
  
  // Webhook strategy (platform-specific)
  async handleDatafileWebhook(sdkKey: string): Promise<void> {
    const newDatafile = await this.fetchDatafile(sdkKey);
    await this.updateDatafile(sdkKey, newDatafile);
  }
}
```

## User Profile Service

### Configuration Options

```typescript
// From: /src-v2/services/storage/OptimizelyUserProfileServiceAdapter.ts
interface UserProfileServiceConfig {
  // Storage backend
  storageBackend: 'kv' | 'memory' | 'custom'; // Default: 'kv'
  
  // KV namespace (platform-specific)
  kvNamespace?: string; // Default: 'OPTIMIZELY_USER_PROFILES'
  
  // TTL for user profiles
  profileTTL: number; // Default: 2592000 (30 days)
  
  // Batch operations
  enableBatchOperations: boolean; // Default: true
  batchSize: number; // Default: 100
}
```

### Custom User Profile Service

```typescript
// Implement custom user profile service
class CustomUserProfileService implements UserProfileService {
  async lookup(userId: string): Promise<UserProfile | null> {
    // Custom lookup logic
    const profile = await customDatabase.getProfile(userId);
    return profile ? {
      user_id: userId,
      experiment_bucket_map: profile.experiments
    } : null;
  }
  
  async save(userProfile: UserProfile): Promise<void> {
    // Custom save logic
    await customDatabase.saveProfile(userProfile.user_id, {
      experiments: userProfile.experiment_bucket_map
    });
  }
}

// Use in configuration
const config = {
  userProfileService: new CustomUserProfileService()
};
```

## Event Dispatcher Configuration

### Event Batching

```typescript
// From: /src-v2/services/implementations/EventDispatcher.ts
interface EventDispatcherConfig {
  // Batching configuration
  eventBatchSize: number; // Default: 10
  eventFlushInterval: number; // Default: 1000 (ms)
  
  // Event endpoint
  eventEndpoint: string; // Default: 'https://logx.optimizely.com/v1/events'
  
  // Retry configuration
  maxRetries: number; // Default: 3
  retryDelay: number; // Default: 1000 (ms)
  
  // Queue configuration  
  maxQueueSize: number; // Default: 1000
  dropEventsOnFull: boolean; // Default: false
}
```

### Custom Event Dispatcher

```typescript
// Implement custom event dispatcher
class CustomEventDispatcher implements EventDispatcher {
  private queue: OptimizelyEvent[] = [];
  
  async dispatchEvent(event: OptimizelyEvent): Promise<void> {
    this.queue.push(event);
    
    if (this.shouldFlush()) {
      await this.flush();
    }
  }
  
  private async flush(): Promise<void> {
    const events = this.queue.splice(0, this.config.eventBatchSize);
    
    try {
      await fetch(this.config.eventEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Optimizely-SDK-Key': this.config.sdkKey
        },
        body: JSON.stringify({ events })
      });
    } catch (error) {
      // Handle error with retry logic
      await this.retryEvents(events);
    }
  }
}
```

## Decision Context Enhancement

### Automatic Attributes

```typescript
// From: /src-v2/services/implementations/DecisionService.ts
class DecisionService {
  private enhanceUserAttributes(attributes: Record<string, any>): Record<string, any> {
    return {
      ...attributes,
      // Automatic timestamp
      $opt_request_timestamp: Date.now(),
      
      // Platform information
      $opt_edge_platform: this.platform,
      $opt_edge_region: this.region,
      
      // Request context
      $opt_user_agent: this.request.headers['user-agent'],
      $opt_ip_country: this.request.headers['cf-ipcountry'],
      
      // Performance metrics
      $opt_request_time: this.requestStartTime
    };
  }
}
```

### Custom Attribute Providers

```typescript
interface AttributeProvider {
  getAttributes(userId: string): Promise<Record<string, any>>;
}

class GeolocationAttributeProvider implements AttributeProvider {
  async getAttributes(userId: string): Promise<Record<string, any>> {
    const ip = this.request.headers['x-forwarded-for'];
    const geo = await this.geoService.lookup(ip);
    
    return {
      country: geo.country,
      region: geo.region,
      city: geo.city,
      timezone: geo.timezone
    };
  }
}
```

## Forced Decisions

### Configuration

```typescript
// From: /src-v2/services/implementations/DecisionService.ts
interface ForcedDecisionConfig {
  // Enable forced decisions
  enableForcedDecisions: boolean; // Default: true
  
  // Sources for forced decisions
  forcedDecisionSources: string[]; // Default: ['header', 'query', 'cookie']
  
  // Validation
  validateForcedVariations: boolean; // Default: true
}
```

### Setting Forced Decisions

```typescript
// Via header
headers['X-Optimizely-Force-Decision'] = JSON.stringify({
  'checkout_flow': 'new_design',
  'pricing_page': 'variant_b'
});

// Via query parameter
?optimizely_force_decision=checkout_flow:new_design

// Via cookie
document.cookie = 'optimizely_force_variation=treatment_a';

// Programmatically
client.setForcedDecision({
  flagKey: 'checkout_flow',
  ruleKey: 'targeted_delivery'
}, {
  variationKey: 'new_design'
});
```

## Performance Optimization

### SDK Optimization Config

```typescript
interface PerformanceConfig {
  // Decision caching
  enableDecisionCache: boolean; // Default: true
  decisionCacheTTL: number; // Default: 60000 (ms)
  
  // Lazy loading
  lazyLoadDatafile: boolean; // Default: false
  
  // Request coalescing
  coalesceDecisionRequests: boolean; // Default: true
  coalescingWindow: number; // Default: 10 (ms)
  
  // Memory management
  maxCachedDecisions: number; // Default: 1000
  enableMemoryPressureHandling: boolean; // Default: true
}
```

### Caching Strategies

```typescript
// From: /src-v2/services/implementations/DecisionService.ts
class DecisionService {
  private decisionCache = new Map<string, CachedDecision>();
  
  async decide(userId: string, flagKey: string, options?: DecideOptions): Promise<OptimizelyDecision> {
    const cacheKey = this.getCacheKey(userId, flagKey, options);
    
    // Check cache
    const cached = this.decisionCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      this.metrics.increment('decision.cache.hit');
      return cached.decision;
    }
    
    // Make decision
    const decision = await this.client.decide(userId, flagKey, options);
    
    // Cache result
    if (this.config.enableDecisionCache) {
      this.decisionCache.set(cacheKey, {
        decision,
        expiresAt: Date.now() + this.config.decisionCacheTTL
      });
    }
    
    return decision;
  }
}
```

## Monitoring and Debugging

### Debug Configuration

```typescript
interface DebugConfig {
  // Enable SDK debug mode
  enableDebugLogging: boolean; // Default: false
  
  // Log decision details
  logDecisionDetails: boolean; // Default: false
  
  // Include evaluation reasons
  alwaysIncludeReasons: boolean; // Default: false
  
  // Trace user journey
  enableUserTracing: boolean; // Default: false
  traceSampleRate: number; // Default: 0.01 (1%)
}
```

### Debug Headers

```bash
# Enable debug mode for request
curl -H "X-Enable-Debug: true" \
     -H "X-Optimizely-Log-Level: debug" \
     -H "X-Include-Decision-Reasons: true" \
     https://example.com/api/decide
```

## Best Practices

### 1. Optimize Decide Options

```typescript
// Production: Minimize overhead
const productionOptions = [
  'DISABLE_DECISION_EVENT', // If not tracking
  'EXCLUDE_VARIABLES'       // If not using variables
];

// Development: Maximum information
const developmentOptions = [
  'INCLUDE_REASONS',
  'IGNORE_USER_PROFILE_SERVICE' // Fresh decisions
];
```

### 2. Configure Event Batching

```typescript
// High-traffic sites
const config = {
  eventBatchSize: 100,      // Larger batches
  eventFlushInterval: 5000  // Less frequent flushes
};

// Low-traffic or real-time needs
const config = {
  eventBatchSize: 1,       // Send immediately
  eventFlushInterval: 100  // Quick flushes
};
```

### 3. Implement Graceful Degradation

```typescript
class ResilientDecisionService {
  async decide(userId: string, flagKey: string): Promise<OptimizelyDecision> {
    try {
      return await this.client.decide(userId, flagKey);
    } catch (error) {
      this.logger.error('Decision failed', error);
      
      // Return default variation
      return {
        enabled: false,
        variationKey: 'control',
        flagKey,
        userContext: { userId },
        reasons: ['Error: Fallback to control']
      };
    }
  }
}
```

## See Also

- [Environment Variables](./environment-variables.md) - SDK-related environment variables
- [Cache Configuration](./cache-configuration.md) - Decision caching strategies
- [API Reference](/docs-sot/api/decisions/) - Decision API documentation
- Implementation: `/src-v2/services/implementations/DecisionService.ts`