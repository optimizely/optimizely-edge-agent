# Infrastructure Configuration

This document contains all the infrastructure details required for live testing of the Optimizely Edge Agent.

## Deployment URLs

| Environment | URL | Description |
|-------------|-----|-------------|
| Production | `https://edge-agent-test.expedge.workers.dev` | Primary testing endpoint for Cloudflare deployment |
| Local Development | `http://localhost:8787` | Local development server (via Wrangler) |

## SDK Keys

| SDK Key | Environment | Type | Description |
|---------|-------------|------|-------------|
| `8mR1pGh8u2ztUP8GqjmQq` | Production | Primary | Main test SDK key with multiple flags and experiments |
| `invalid-sdk-key-for-testing` | N/A | Invalid | Use for negative testing scenarios |

## Feature Flag Keys

| Flag Key | SDK Key | Description |
|----------|---------|-------------|
| `test-flag` | `8mR1pGh8u2ztUP8GqjmQq` | Simple boolean flag for basic testing |
| `homepage-test` | `8mR1pGh8u2ztUP8GqjmQq` | Flag with audience targeting |
| `product-test` | `8mR1pGh8u2ztUP8GqjmQq` | Flag with attribute-based targeting |

## Experiment Keys

| Experiment Key | SDK Key | Description |
|----------------|---------|-------------|
| `ab-test-1` | `8mR1pGh8u2ztUP8GqjmQq` | A/B test with two variations |
| `feature-test-1` | `8mR1pGh8u2ztUP8GqjmQq` | Feature test with multiple variations |

## CDN Variation Settings Configuration

These settings must be configured in the Optimizely application for the SDK key:

```json
{
  "cdnTrustedOrigins": ["httpbin.org", "example.com"],
  "cdnExperimentSettings": [
    {
      "experimentKey": "ab-test-1",
      "variationSettings": [
        {
          "variationKey": "variation_1",
          "cdnVariationSettings": {
            "cdnExperimentURL": "/edge-test/forward",
            "forwardRequestToOrigin": true,
            "cacheRequestToOrigin": true,
            "cacheTTL": 300,
            "cacheKey": "VARIATION_KEY"
          }
        },
        {
          "variationKey": "variation_2",
          "cdnVariationSettings": {
            "cdnExperimentURL": "/edge-test/no-forward",
            "forwardRequestToOrigin": false
          }
        }
      ]
    },
    {
      "experimentKey": "feature-test-1",
      "variationSettings": [
        {
          "variationKey": "control",
          "cdnVariationSettings": {
            "cdnExperimentURL": "/edge-test/control",
            "forwardRequestToOrigin": true,
            "cacheRequestToOrigin": true,
            "cacheTTL": 60
          }
        },
        {
          "variationKey": "treatment",
          "cdnVariationSettings": {
            "cdnExperimentURL": "/edge-test/treatment",
            "forwardRequestToOrigin": true,
            "cacheRequestToOrigin": true,
            "cacheTTL": 60,
            "transformResponseBody": true,
            "contentString": "<div>Test Content</div>",
            "contentStringPlacement": "append",
            "contentType": "html"
          }
        }
      ]
    }
  ]
}
```

## Environment Variables

These environment variables must be set when running tests:

```bash
# Required environment variables for testing
export EDGE_AGENT_URL=https://edge-agent-test.expedge.workers.dev
export SDK_KEY=8mR1pGh8u2ztUP8GqjmQq
export FEATURE_KEYS=test-flag,homepage-test,product-test
export EXPERIMENT_KEYS=ab-test-1,feature-test-1
export ADMIN_TOKEN=secure-test-token-for-operations
```

## Cloudflare Worker Configuration

| Resource | Name | Description |
|----------|------|-------------|
| KV Namespace | `TEST_OPTIMIZELY_DATAFILES` | Stores datafiles by SDK key |
| KV Namespace | `TEST_OPTIMIZELY_FLAGS` | Stores flag settings |
| KV Namespace | `TEST_OPTIMIZELY_CACHE` | Stores cache entries |
| Analytics Engine Binding | `ANALYTICS_ENGINE` | Binding for metrics (optimizely_edge_agent_test_metrics) |

## Test Origin Configuration

For testing origin request forwarding, these endpoints are used:

| Path | Origin | Description |
|------|--------|-------------|
| `/edge-test/forward` | `https://httpbin.org/get` | Returns request info for validation |
| `/edge-test/headers` | `https://httpbin.org/headers` | Tests header forwarding |
| `/edge-test/html` | `https://example.com` | Simple HTML for content transformation tests |

## Test Tools

| Tool | Purpose | Command |
|------|---------|---------|
| cURL | Basic request testing | `curl -v -H "X-Optimizely-SDK-Key: $SDK_KEY" $EDGE_AGENT_URL/api/decide` |
| Postman | Interactive API testing | Import collection from `/test-scripts/postman-collection.json` |
| JS Test Scripts | Automated test execution | `node ./test-scripts/run-live-tests.js` |

## Setting Up Your Environment

1. Clone the repository
2. Install dependencies: `npm install`
3. Configure environment variables (see above)
4. Verify access to the test URL: `curl $EDGE_AGENT_URL/api/sdk`

## Troubleshooting

1. **Connection issues**: Ensure you have proper network access to Cloudflare Workers
2. **Authentication failures**: Verify the SDK key is correct and active
3. **Missing data**: Ensure the SDK key has the expected flags and experiments configured
4. **Cache inconsistencies**: Use the admin endpoints to clear caches if needed 