# Cloudflare Infrastructure Testing Plan

This document outlines the detailed steps required to properly test the Optimizely Edge Agent implementation using real Cloudflare infrastructure. This infrastructure testing is **required** for proper verification.

## Prerequisites

1. **Cloudflare Account Setup**
   - Active Cloudflare account with Workers access
   - Workers Unlimited plan (required for KV namespaces)
   - Appropriate access permissions

2. **Development Environment**
   - Node.js installed
   - npm installed
   - Wrangler CLI installed (`npm install -g wrangler`)
   - Git clone of the Optimizely Edge Agent repository

## Cloudflare Workers Setup

### Step 1: Authenticate Wrangler

```bash
# Log in to Cloudflare with your account
wrangler login
```

### Step 2: Create KV Namespaces

KV namespaces are required for the Edge Agent to store datafiles and flag keys.

```bash
# Create KV namespaces for testing
wrangler kv:namespace create "TEST_OPTIMIZELY_DATAFILES"
wrangler kv:namespace create "TEST_OPTIMIZELY_FLAGS"
wrangler kv:namespace create "TEST_OPTIMIZELY_CACHE"
```

Take note of the namespace IDs returned from these commands.

### Step 3: Configure wrangler.toml

Edit the `wrangler.toml` file to include the test environment and KV namespace bindings:

```toml
[env.test]
name = "optimizely-edge-agent-test"
workers_dev = true
compatibility_date = "2023-01-01"

kv_namespaces = [
  { binding = "OPTIMIZELY_DATAFILES", id = "YOUR_DATAFILES_NAMESPACE_ID" },
  { binding = "OPTIMIZELY_FLAGS", id = "YOUR_FLAGS_NAMESPACE_ID" },
  { binding = "OPTIMIZELY_CACHE", id = "YOUR_CACHE_NAMESPACE_ID" }
]
```

### Step 4: Configure Environment Variables

```bash
# Set the admin token for secure API endpoints
wrangler secret put OPTIMIZELY_ADMIN_TOKEN --env test
```

When prompted, enter a secure token value that will be used for admin authentication.

## Deployment and Initial Verification

### Step 1: Build the Implementation

```bash
# Build the Cloudflare-specific implementation
npm run build:cloudflare
```

### Step 2: Deploy to Cloudflare Workers

```bash
# Deploy to the test environment
wrangler deploy --env test
```

This will deploy your worker and provide a URL for testing.

### Step 3: Verify Deployment

Make a simple HTTP request to the deployed worker to verify it's running:

```bash
curl https://optimizely-edge-agent-test.YOUR_ACCOUNT.workers.dev/api/sdk-info
```

You should receive a valid JSON response with SDK information.

## Infrastructure Testing Scenarios

The following test scenarios MUST be executed against the deployed worker:

### 1. Datafile Storage and Retrieval Tests

```bash
# 1. Upload a test datafile with admin token
curl -X POST \
  https://optimizely-edge-agent-test.YOUR_ACCOUNT.workers.dev/api/datafile?sdkKey=test-sdk-key \
  -H 'Authorization: Bearer YOUR_ADMIN_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "version": "4",
    "rollouts": [],
    "anonymizeIP": true,
    "projectId": "12345",
    "variables": [],
    "featureFlags": [
      {
        "experimentIds": [],
        "id": "67890",
        "key": "test_flag",
        "rolloutId": "",
        "variables": []
      }
    ],
    "experiments": [],
    "audiences": [],
    "groups": [],
    "attributes": [],
    "accountId": "12345",
    "events": [],
    "revision": "1"
  }'

# 2. Retrieve the datafile
curl https://optimizely-edge-agent-test.YOUR_ACCOUNT.workers.dev/api/datafile?sdkKey=test-sdk-key

# 3. Get flag keys
curl https://optimizely-edge-agent-test.YOUR_ACCOUNT.workers.dev/api/flagkeys?sdkKey=test-sdk-key
```

### 2. KV Storage Operation Verification

These tests verify the KV storage operations work correctly:

```bash
# 1. Clear cache (requires admin token)
curl -X POST \
  https://optimizely-edge-agent-test.YOUR_ACCOUNT.workers.dev/api/admin/clear-cache?sdkKey=test-sdk-key \
  -H 'Authorization: Bearer YOUR_ADMIN_TOKEN'

# 2. Verify datafile is re-fetched after cache clear
curl https://optimizely-edge-agent-test.YOUR_ACCOUNT.workers.dev/api/datafile?sdkKey=test-sdk-key
```

### 3. Error Handling Tests

```bash
# 1. Bad request (missing SDK key)
curl https://optimizely-edge-agent-test.YOUR_ACCOUNT.workers.dev/api/datafile

# 2. Unauthorized admin access
curl -X POST \
  https://optimizely-edge-agent-test.YOUR_ACCOUNT.workers.dev/api/admin/clear-cache?sdkKey=test-sdk-key \
  -H 'Authorization: Bearer WRONG_TOKEN'
  
# 3. Not found SDK key
curl https://optimizely-edge-agent-test.YOUR_ACCOUNT.workers.dev/api/datafile?sdkKey=non-existent-key
```

### 4. Performance Tests

```bash
# 1. Measure response time with cache hit
time curl https://optimizely-edge-agent-test.YOUR_ACCOUNT.workers.dev/api/datafile?sdkKey=test-sdk-key

# 2. Load test with multiple concurrent requests
for i in {1..10}; do
  curl https://optimizely-edge-agent-test.YOUR_ACCOUNT.workers.dev/api/datafile?sdkKey=test-sdk-key &
done
wait
```

## Advanced Infrastructure Testing

### 1. Create Node.js Test Script

Create a file called `infrastructure-test.js`:

```javascript
const fetch = require('node-fetch');

const WORKER_URL = 'https://optimizely-edge-agent-test.YOUR_ACCOUNT.workers.dev';
const ADMIN_TOKEN = 'YOUR_ADMIN_TOKEN';
const TEST_SDK_KEY = 'test-sdk-key';

// Test datafile response time with multiple requests
async function testDatafilePerformance(requestCount = 20) {
  console.log(`Testing datafile performance with ${requestCount} sequential requests...`);
  
  const startTime = Date.now();
  for (let i = 0; i < requestCount; i++) {
    const response = await fetch(`${WORKER_URL}/api/datafile?sdkKey=${TEST_SDK_KEY}`);
    if (!response.ok) {
      console.error(`Request ${i} failed: ${response.status}`);
    }
  }
  const endTime = Date.now();
  
  const totalTime = endTime - startTime;
  const avgTime = totalTime / requestCount;
  
  console.log(`Total time: ${totalTime}ms`);
  console.log(`Average response time: ${avgTime}ms`);
  
  return { totalTime, avgTime };
}

// Test KV operations
async function testKVOperations() {
  console.log('Testing KV operations...');
  
  // 1. Update datafile
  const updateResponse = await fetch(
    `${WORKER_URL}/api/datafile?sdkKey=${TEST_SDK_KEY}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version: "4",
        projectId: "12345",
        featureFlags: [
          { id: "67890", key: "test_flag_updated" }
        ],
        revision: String(Date.now())
      })
    }
  );
  
  console.log(`Update datafile: ${updateResponse.status}`);
  
  // 2. Get updated datafile
  const getResponse = await fetch(`${WORKER_URL}/api/datafile?sdkKey=${TEST_SDK_KEY}`);
  const datafile = await getResponse.json();
  
  console.log('Updated datafile received:');
  console.log(JSON.stringify(datafile, null, 2));
  
  return { success: updateResponse.ok && getResponse.ok, datafile };
}

// Run all tests
async function runAllTests() {
  try {
    // Test 1: Datafile Performance
    const perfResults = await testDatafilePerformance();
    console.log('\n----------------------------\n');
    
    // Test 2: KV Operations
    const kvResults = await testKVOperations();
    console.log('\n----------------------------\n');
    
    // Summary
    console.log('INFRASTRUCTURE TEST RESULTS:');
    console.log(`Performance: ${perfResults.avgTime < 100 ? 'PASS' : 'FAIL'} (${perfResults.avgTime}ms avg)`);
    console.log(`KV Operations: ${kvResults.success ? 'PASS' : 'FAIL'}`);
  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

// Run tests
runAllTests();
```

Execute with:

```bash
node infrastructure-test.js
```

## Verification Requirements

The infrastructure testing is considered successful when:

1. **Deployment Verification**
   - Worker successfully deploys without errors
   - Worker responds to basic API requests

2. **KV Storage Verification**
   - Datafiles can be stored and retrieved
   - Flag keys can be extracted and retrieved
   - Cache operations work correctly

3. **Performance Verification**
   - Average response time for datafile retrieval < 100ms (cached)
   - Average response time for datafile retrieval < 300ms (uncached)
   - Can handle multiple concurrent requests

4. **Error Handling Verification**
   - Returns appropriate error responses for invalid requests
   - Handles authentication failures correctly
   - Recovers from KV operation failures

## Documentation of Results

Create a file called `infrastructure-test-results.md` to document the results of your testing:

```markdown
# Infrastructure Testing Results

## Deployment Information
- Worker URL: https://optimizely-edge-agent-test.YOUR_ACCOUNT.workers.dev
- Deployment Date: [DATE]
- Wrangler Version: [VERSION]

## Test Results

### Datafile Storage and Retrieval
- Upload Test: [PASS/FAIL]
- Retrieval Test: [PASS/FAIL]
- Flag Keys Test: [PASS/FAIL]

### KV Storage Operations
- Clear Cache Test: [PASS/FAIL]
- Cache Invalidation Test: [PASS/FAIL]

### Error Handling
- Missing SDK Key Test: [PASS/FAIL]
- Unauthorized Access Test: [PASS/FAIL]
- Not Found SDK Key Test: [PASS/FAIL]

### Performance
- Average Response Time (Cached): [TIME]ms
- Average Response Time (Uncached): [TIME]ms
- Concurrent Request Test: [PASS/FAIL]

## Issues Identified
- [List any issues discovered during testing]

## Conclusion
[Overall assessment of the infrastructure testing]
```

## Conclusion

This infrastructure testing plan provides a comprehensive approach to verify the Optimizely Edge Agent implementation on real Cloudflare infrastructure. Following this plan ensures that the implementation works correctly in a production-like environment, with actual KV storage operations and realistic performance characteristics.

The verification phase CANNOT be considered complete until these infrastructure tests have been executed and documented. 