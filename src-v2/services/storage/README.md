# Storage Services for Optimizely Edge Agent v2

This directory contains the storage services used by the Optimizely Edge Agent v2, including the User Profile Service which is critical for sticky bucketing functionality.

## KVUserProfileService

The `KVUserProfileService` provides persistent storage for user bucketing decisions, ensuring that users receive consistent variations across requests - a feature known as "sticky bucketing."

### Features

- Stores user bucketing decisions in Cloudflare KV storage
- Provides an in-memory LRU cache for performance
- Supports configurable TTL for entries
- Thread-safe for concurrent access
- Compatible with the Optimizely SDK's User Profile Service interface

### Configuration Options

- `keyPrefix`: String prefix for KV storage keys (default: 'optly_ups_')
- `ttl`: Time-to-live in seconds for KV entries (default: 30 days)
- `maxCacheSize`: Maximum number of entries in the memory cache (default: 100)
- `sdkKey`: The Optimizely SDK key (required)

### Implementation Details

The service stores user profiles in the following format:

```typescript
interface UserProfileData {
  user_id?: string;
  experiment_bucket_map?: Record<string, ExperimentBucketMap>;
}

interface ExperimentBucketMap {
  variation_id?: string;
  variation_key?: string;
  rule_key?: string;
}
```

Data is stored in Cloudflare KV with keys in the format: `{keyPrefix}:{sdkKey}:{userId}`

### OptimizelyUserProfileServiceAdapter

This adapter bridges the gap between our `KVUserProfileService` and the Optimizely SDK's expectations:

- The SDK expects synchronous lookup/save methods
- Our KV operations are asynchronous due to the Cloudflare Workers environment
- The adapter maintains an in-memory cache for immediate synchronous access
- It performs asynchronous updates in the background to maintain consistency

## Prerequisites

Before using these services, you must set up the appropriate KV namespaces in your Cloudflare account:

1. Create a KV namespace named `OPTLY_HYBRID_AGENT_UPS_KV`
2. Add the namespace ID to your wrangler.toml configuration
3. See the [KV Namespace Setup Guide](../../docs/kv-namespace-setup-guide.md) for detailed instructions

## Usage

To use the KV User Profile Service:

1. Create the service in your composition root:

```typescript
const kvUserProfileService = new KVUserProfileService(
  storageAdapter,
  logger,
  {
    keyPrefix: 'optly_ups_',
    ttl: 2592000, // 30 days in seconds
    maxCacheSize: 100,
    sdkKey: 'your-sdk-key'
  }
);

const userProfileServiceAdapter = new OptimizelyUserProfileServiceAdapter(
  kvUserProfileService,
  logger
);

// Inject into DecisionService
const decisionService = new DecisionService(
  configService, 
  logger, 
  metricsAdapter,
  undefined, // defaultSdkKey (optional)
  userProfileServiceAdapter.getSDKUserProfileService()
);
```

## Testing

You can verify the User Profile Service is working by:

1. Making a request for a feature flag decision with a specific user ID
2. Making a second request with the same user ID
3. Confirming that both requests return the same variation
4. Checking the KV storage to see the stored user profile

### Test via curl

```bash
# First request
curl -X POST http://localhost:8787/decide \
  -H "X-Optimizely-SDK-Key: 8mR1pGh8u2ztUP8GqjmQq" \
  -H "X-Optimizely-Visitor-Id: test_user_123" \
  -d '{"flagKey": "test-flag"}'

# Second request should return the same variation
curl -X POST http://localhost:8787/decide \
  -H "X-Optimizely-SDK-Key: 8mR1pGh8u2ztUP8GqjmQq" \
  -H "X-Optimizely-Visitor-Id: test_user_123" \
  -d '{"flagKey": "test-flag"}'
```