# SDK Information API

Get information about the Edge Agent deployment.

## Overview

The `/api/sdk` endpoint provides metadata about the Edge Agent instance including:
- **Version information** - Edge Agent version number
- **Environment details** - Deployment environment name
- **CDN provider** - Which CDN platform is hosting the agent
- **Agent identification** - Standard agent name

This endpoint is useful for:
- **Debugging** - Verify which version is deployed
- **Monitoring** - Track deployments across environments
- **Integration** - Identify agent capabilities
- **Support** - Provide version info for troubleshooting

## Authentication

**Required Headers:**
```http
X-Optimizely-Enable-FEX: true
```

Note: SDK key is not required for this informational endpoint.

## GET /api/sdk

Retrieve Edge Agent information.

### Method Requirement

**Only GET method is supported**.

### Response Format

**Success Response (200):**
```json
{
  "name": "optimizely-edge-agent",
  "version": "2.0.0",
  "environment": "production",
  "cdnProvider": "cloudflare"
}
```

### Response Fields

| Field | Type | Description | Example Values |
|-------|------|-------------|----------------|
| `name` | string | Agent identifier | `"optimizely-edge-agent"` |
| `version` | string | Edge Agent version | `"2.0.0"`, `"2.1.0-beta"` |
| `environment` | string | Deployment environment | `"production"`, `"staging"`, `"development"` |
| `cdnProvider` | string | CDN platform | `"cloudflare"`, `"fastly"`, `"vercel"`, `"akamai"` |

### Error Responses

**405 Method Not Allowed:**
```json
{
  "error": "Method not allowed"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Error processing SDK info request"
}
```

## Examples

### Basic Request
```bash
curl -X GET "https://your-deployment/api/sdk" \
  -H "X-Optimizely-Enable-FEX: true"
```

### Check Version in Script
```javascript
async function getEdgeAgentInfo() {
  const response = await fetch('/api/sdk', {
    headers: {
      'X-Optimizely-Enable-FEX': 'true'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get SDK info: ${response.status}`);
  }
  
  const info = await response.json();
  console.log(`Edge Agent v${info.version} on ${info.cdnProvider}`);
  return info;
}
```

### Version Compatibility Check
```javascript
const MINIMUM_VERSION = '2.0.0';

async function checkCompatibility() {
  try {
    const info = await getEdgeAgentInfo();
    const version = info.version || 'unknown';
    
    if (version === 'unknown') {
      console.warn('Unable to determine Edge Agent version');
      return false;
    }
    
    // Simple version comparison (for semantic versions)
    const current = version.split('.').map(Number);
    const required = MINIMUM_VERSION.split('.').map(Number);
    
    for (let i = 0; i < required.length; i++) {
      if (current[i] > required[i]) return true;
      if (current[i] < required[i]) return false;
    }
    
    return true;
  } catch (error) {
    console.error('Version check failed:', error);
    return false;
  }
}
```

### Multi-Environment Monitoring
```javascript
const environments = [
  { name: 'Production', url: 'https://prod.example.com' },
  { name: 'Staging', url: 'https://staging.example.com' },
  { name: 'Development', url: 'https://dev.example.com' }
];

async function checkAllEnvironments() {
  const results = await Promise.all(
    environments.map(async (env) => {
      try {
        const response = await fetch(`${env.url}/api/sdk`, {
          headers: { 'X-Optimizely-Enable-FEX': 'true' }
        });
        const info = await response.json();
        return {
          ...env,
          ...info,
          status: 'online'
        };
      } catch (error) {
        return {
          ...env,
          status: 'offline',
          error: error.message
        };
      }
    })
  );
  
  // Display results
  console.table(results);
  
  // Check for version mismatches
  const versions = results
    .filter(r => r.status === 'online')
    .map(r => r.version);
  const uniqueVersions = [...new Set(versions)];
  
  if (uniqueVersions.length > 1) {
    console.warn('Version mismatch detected:', uniqueVersions);
  }
  
  return results;
}
```

## Use Cases

### 1. Deployment Verification
Verify successful deployment after updates:
```bash
#!/bin/bash
# deployment-check.sh

EXPECTED_VERSION="2.1.0"
ENDPOINT="https://your-deployment/api/sdk"

RESPONSE=$(curl -s -H "X-Optimizely-Enable-FEX: true" "$ENDPOINT")
ACTUAL_VERSION=$(echo "$RESPONSE" | jq -r '.version')

if [ "$ACTUAL_VERSION" = "$EXPECTED_VERSION" ]; then
  echo "✅ Deployment successful: v$ACTUAL_VERSION"
else
  echo "❌ Version mismatch: expected v$EXPECTED_VERSION, got v$ACTUAL_VERSION"
  exit 1
fi
```

### 2. Health Check Integration
Include in health check endpoints:
```javascript
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    dependencies: {}
  };
  
  try {
    // Check Edge Agent
    const edgeAgent = await fetch('http://localhost:8787/api/sdk', {
      headers: { 'X-Optimizely-Enable-FEX': 'true' }
    }).then(r => r.json());
    
    health.dependencies.edgeAgent = {
      status: 'healthy',
      version: edgeAgent.version,
      environment: edgeAgent.environment
    };
  } catch (error) {
    health.dependencies.edgeAgent = {
      status: 'unhealthy',
      error: error.message
    };
    health.status = 'degraded';
  }
  
  res.json(health);
});
```

### 3. Client Initialization
Use version info for client configuration:
```javascript
class OptimizelyClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.agentInfo = null;
  }
  
  async initialize() {
    // Get agent info first
    const response = await fetch(`${this.baseUrl}/api/sdk`, {
      headers: { 'X-Optimizely-Enable-FEX': 'true' }
    });
    
    this.agentInfo = await response.json();
    
    // Configure client based on version
    if (this.agentInfo.version.startsWith('2.')) {
      this.apiVersion = 'v2';
      this.features = ['decide', 'forced-variations', 'debug'];
    } else {
      this.apiVersion = 'v1';
      this.features = ['decide'];
    }
    
    console.log(`Connected to Edge Agent ${this.agentInfo.version}`);
  }
  
  supportsFeature(feature) {
    return this.features.includes(feature);
  }
}
```

## Configuration

The values returned by this endpoint are typically set via environment variables:

| Environment Variable | Response Field | Default |
|---------------------|----------------|---------|
| `OPTIMIZELY_EDGE_AGENT_VERSION` | `version` | `"unknown"` |
| `OPTIMIZELY_ENVIRONMENT` | `environment` | `"unknown"` |
| `OPTIMIZELY_CDN_PROVIDER` | `cdnProvider` | Auto-detected or `"unknown"` |

### CDN Auto-Detection

The Edge Agent attempts to auto-detect the CDN provider based on:
- Request headers specific to each CDN
- Environment variables
- Runtime context

Supported auto-detection for:
- Cloudflare Workers
- Fastly Compute@Edge
- Vercel Edge Functions
- AWS CloudFront (Lambda@Edge)
- Akamai EdgeWorkers

## Best Practices

### 1. Cache the Response
The SDK info rarely changes:
```javascript
let cachedInfo = null;
let cacheTime = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

async function getCachedSdkInfo() {
  if (cachedInfo && Date.now() - cacheTime < CACHE_DURATION) {
    return cachedInfo;
  }
  
  const response = await fetch('/api/sdk', {
    headers: { 'X-Optimizely-Enable-FEX': 'true' }
  });
  
  cachedInfo = await response.json();
  cacheTime = Date.now();
  
  return cachedInfo;
}
```

### 2. Include in Error Reports
Add version info to error tracking:
```javascript
window.addEventListener('error', async (event) => {
  const errorReport = {
    message: event.error.message,
    stack: event.error.stack,
    timestamp: new Date().toISOString(),
    context: {
      url: window.location.href,
      userAgent: navigator.userAgent
    }
  };
  
  try {
    const sdkInfo = await getCachedSdkInfo();
    errorReport.context.edgeAgent = sdkInfo;
  } catch (e) {
    errorReport.context.edgeAgent = { error: 'Failed to fetch' };
  }
  
  // Send to error tracking service
  sendErrorReport(errorReport);
});
```

### 3. Version-Specific Logic
Handle different versions gracefully:
```javascript
async function makeDecision(flagKey, userId, attributes) {
  const info = await getCachedSdkInfo();
  const majorVersion = parseInt(info.version.split('.')[0]);
  
  if (majorVersion >= 2) {
    // Use v2 endpoints
    return fetch('/api/decide', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Optimizely-Enable-FEX': 'true',
        'X-Optimizely-SDK-Key': SDK_KEY
      },
      body: JSON.stringify({ flagKey, userId, attributes })
    });
  } else {
    // Fall back to v1 patterns
    return fetch(`/decide?flagKey=${flagKey}&userId=${userId}`, {
      headers: {
        'X-Optimizely-Enable-FEX': 'true',
        'X-Optimizely-SDK-Key': SDK_KEY
      }
    });
  }
}
```

## Related Endpoints

- **[Debug API](../admin/debug.md)** - Detailed configuration information
- **[Admin Status](../admin/)** - Service health and status
- **[Authentication](../authentication.md)** - API authentication setup

---

**Implementation Source**: `/src-v2/services/implementations/ApiRouter.ts:930-988`  
**Last Updated**: 2025-05-28