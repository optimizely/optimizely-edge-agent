# Agent Mode Configuration

## Overview

Agent Mode provides RESTful API endpoints for programmatic access to Optimizely decisions and data. This document covers API configuration, endpoint settings, request handling options, and security configurations for Agent Mode.

## Agent Mode Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Agent Mode API Architecture                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  API Request ──▶ Router ──▶ Handler ──▶ Service ──▶ Response           │
│                    │           │           │                             │
│                    ▼           ▼           ▼                             │
│              Path Matching  Validation  Business Logic                   │
│               & Routing    & Auth      & Decisions                      │
│                                                                          │
│  Available Endpoints:                                                    │
│  ┌─────────────────┬─────────────────────┬─────────────────┐          │
│  │    Endpoint     │     Purpose         │    Method      │          │
│  ├─────────────────┼─────────────────────┼─────────────────┤          │
│  │ /decide         │ Single decision     │ POST          │          │
│  │ /decide-batch   │ Multiple decisions  │ POST          │          │
│  │ /datafile       │ Get datafile        │ GET           │          │
│  │ /flag-keys      │ List flag keys      │ GET           │          │
│  │ /track          │ Track events        │ POST          │          │
│  │ /health         │ Health check        │ GET           │          │
│  └─────────────────┴─────────────────────┴─────────────────┘          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Basic Configuration

### Enabling Agent Mode

```typescript
// Environment variables
export ENABLE_AGENT_MODE="true"
export AGENT_MODE_PREFIX="/api/v1"

// Configuration object
const config = {
  enableAgentMode: true,
  agentModeConfig: {
    // API prefix
    apiPrefix: '/api/v1',
    
    // Enable specific endpoints
    endpoints: {
      decide: true,
      decideBatch: true,
      datafile: true,
      flagKeys: true,
      track: true,
      health: true
    },
    
    // Request limits
    maxRequestSize: 1048576,  // 1MB
    maxBatchSize: 50
  }
};
```

## Endpoint Configuration

### Decide Endpoint

```typescript
// From: /src-v2/services/implementations/ApiRouter.ts
interface DecideEndpointConfig {
  // Enable endpoint
  enabled: boolean;              // Default: true
  
  // Path configuration
  path: string;                  // Default: '/decide'
  
  // Request validation
  requireUserId: boolean;        // Default: true
  requireFlagKey: boolean;       // Default: true
  
  // Response options
  includeReasons: boolean;       // Default: false
  includeEventData: boolean;     // Default: false
  
  // Performance
  enableCache: boolean;          // Default: true
  cacheTTL: number;             // Default: 60
}

// Request format
{
  "userId": "user_123",
  "flagKey": "checkout_flow",
  "attributes": {
    "plan": "premium",
    "country": "US"
  },
  "decideOptions": ["INCLUDE_REASONS"]
}

// Response format
{
  "enabled": true,
  "variationKey": "treatment",
  "ruleKey": "targeted_delivery",
  "flagKey": "checkout_flow",
  "userContext": {
    "userId": "user_123",
    "attributes": { "plan": "premium", "country": "US" }
  },
  "reasons": ["User meets targeting conditions"]
}
```

### Batch Decide Endpoint

```typescript
interface BatchDecideConfig {
  enabled: boolean;              // Default: true
  path: string;                  // Default: '/decide-batch'
  maxBatchSize: number;         // Default: 50
  parallelProcessing: boolean;   // Default: true
}

// Request format
{
  "userId": "user_123",
  "attributes": { "plan": "premium" },
  "decisions": [
    { "flagKey": "feature_1" },
    { "flagKey": "feature_2", "decideOptions": ["ENABLED_FLAGS_ONLY"] }
  ]
}

// Response format
{
  "decisions": {
    "feature_1": {
      "enabled": true,
      "variationKey": "variant_a"
    },
    "feature_2": {
      "enabled": false,
      "variationKey": "control"
    }
  }
}
```

### Datafile Endpoint

```typescript
interface DatafileEndpointConfig {
  enabled: boolean;              // Default: true
  path: string;                  // Default: '/datafile'
  
  // Access control
  requireAuth: boolean;          // Default: false
  allowedSdkKeys: string[];     // Default: all
  
  // Response options
  includeMetadata: boolean;      // Default: false
  minify: boolean;              // Default: false
  
  // Caching
  cacheTTL: number;             // Default: 300
  etag: boolean;                // Default: true
}

// Request
GET /api/v1/datafile?sdkKey=your-sdk-key

// Response headers
Content-Type: application/json
Cache-Control: public, max-age=300
ETag: "686897696a7c876b7e"
```

### Flag Keys Endpoint

```typescript
interface FlagKeysEndpointConfig {
  enabled: boolean;              // Default: true
  path: string;                  // Default: '/flag-keys'
  
  // Filtering
  allowFiltering: boolean;       // Default: true
  filterParams: string[];        // Default: ['enabled', 'type']
  
  // Response format
  includeMetadata: boolean;      // Default: false
  groupByType: boolean;          // Default: false
}

// Request
GET /api/v1/flag-keys?enabled=true&type=feature

// Response
{
  "flagKeys": [
    "checkout_flow",
    "pricing_page",
    "recommendation_engine"
  ],
  "count": 3
}
```

### Track Endpoint

```typescript
interface TrackEndpointConfig {
  enabled: boolean;              // Default: true
  path: string;                  // Default: '/track'
  
  // Event validation
  requireEventKey: boolean;      // Default: true
  validateEventTypes: boolean;   // Default: true
  
  // Batching
  allowBatch: boolean;          // Default: true
  maxBatchSize: number;         // Default: 100
  
  // Processing
  async: boolean;               // Default: true
  queueSize: number;            // Default: 10000
}

// Request format
{
  "userId": "user_123",
  "eventKey": "purchase_completed",
  "eventTags": {
    "value": 99.99,
    "currency": "USD"
  },
  "attributes": {
    "source": "mobile_app"
  }
}
```

## Request Handling

### Request Validation

```typescript
// From: /src-v2/services/implementations/ApiRouter.ts
interface RequestValidation {
  // Size limits
  maxRequestSize: number;        // Default: 1048576 (1MB)
  maxJsonDepth: number;         // Default: 10
  
  // Content validation
  requireContentType: boolean;   // Default: true
  allowedContentTypes: string[]; // Default: ['application/json']
  
  // Parameter validation
  validateRequired: boolean;     // Default: true
  sanitizeInput: boolean;       // Default: true
  
  // Schema validation
  enableSchemaValidation: boolean; // Default: false
  schemaVersion: string;         // Default: 'v1'
}

// Validation implementation
class RequestValidator {
  validate(request: IRequestAdapter): ValidationResult {
    // Check content type
    const contentType = request.getHeader('content-type');
    if (!this.isValidContentType(contentType)) {
      return { valid: false, error: 'Invalid content type' };
    }
    
    // Check request size
    if (request.contentLength > this.config.maxRequestSize) {
      return { valid: false, error: 'Request too large' };
    }
    
    // Validate JSON structure
    try {
      const body = JSON.parse(request.body);
      this.validateJsonDepth(body, 0);
    } catch (error) {
      return { valid: false, error: 'Invalid JSON' };
    }
    
    return { valid: true };
  }
}
```

### Error Handling

```typescript
interface ErrorHandlingConfig {
  // Error response format
  includeStackTrace: boolean;    // Default: false (true in dev)
  includeRequestId: boolean;     // Default: true
  
  // Error codes
  useStandardCodes: boolean;     // Default: true
  customErrorCodes: Record<string, number>;
  
  // Logging
  logErrors: boolean;           // Default: true
  logLevel: 'error' | 'warn';   // Default: 'error'
}

// Standard error response
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Missing required field: userId",
    "details": {
      "field": "userId",
      "provided": null
    },
    "requestId": "req_123456",
    "timestamp": "2025-01-20T10:30:00Z"
  }
}
```

## Response Configuration

### Response Format

```typescript
interface ResponseConfig {
  // Format options
  prettyPrint: boolean;         // Default: false
  includeMetadata: boolean;     // Default: false
  
  // Compression
  enableCompression: boolean;   // Default: true
  compressionThreshold: number; // Default: 1024 bytes
  
  // Headers
  includeVersionHeader: boolean; // Default: true
  customHeaders: Record<string, string>;
}

// Response with metadata
{
  "data": {
    "enabled": true,
    "variationKey": "treatment"
  },
  "metadata": {
    "sdkKey": "sdk_123",
    "timestamp": "2025-01-20T10:30:00Z",
    "processingTime": 23,
    "cacheHit": true
  }
}
```

### CORS Configuration

```typescript
interface CORSConfig {
  // Enable CORS
  enabled: boolean;             // Default: true
  
  // Allowed origins
  allowedOrigins: string[];     // Default: ['*']
  allowCredentials: boolean;    // Default: false
  
  // Allowed methods
  allowedMethods: string[];     // Default: ['GET', 'POST', 'OPTIONS']
  
  // Allowed headers
  allowedHeaders: string[];     // Default: ['Content-Type', 'X-Optimizely-SDK-Key']
  exposedHeaders: string[];     // Default: ['X-Request-Id']
  
  // Preflight
  maxAge: number;              // Default: 86400 (24 hours)
}

// CORS headers
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, X-Optimizely-SDK-Key
Access-Control-Max-Age: 86400
```

## Authentication & Security

### Authentication Configuration

```typescript
interface AuthConfig {
  // Enable authentication
  enabled: boolean;             // Default: false
  
  // Auth methods
  methods: ('apikey' | 'bearer' | 'custom')[];
  
  // API key settings
  apiKeyHeader: string;         // Default: 'X-API-Key'
  apiKeyParam: string;         // Default: 'api_key'
  
  // Token settings
  bearerTokenHeader: string;    // Default: 'Authorization'
  tokenValidation: 'local' | 'remote';
  
  // Whitelisting
  whitelist: string[];         // Whitelisted IPs/origins
}

// Authentication implementation
class AuthHandler {
  async authenticate(request: IRequestAdapter): Promise<AuthResult> {
    // Check API key
    const apiKey = request.getHeader(this.config.apiKeyHeader) || 
                  request.getQueryParam(this.config.apiKeyParam);
    
    if (apiKey && await this.validateApiKey(apiKey)) {
      return { authenticated: true, method: 'apikey' };
    }
    
    // Check bearer token
    const authHeader = request.getHeader('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      if (await this.validateToken(token)) {
        return { authenticated: true, method: 'bearer' };
      }
    }
    
    return { authenticated: false };
  }
}
```

### Rate Limiting

```typescript
interface RateLimitConfig {
  // Enable rate limiting
  enabled: boolean;             // Default: true
  
  // Limits
  requestsPerMinute: number;    // Default: 1000
  requestsPerHour: number;      // Default: 10000
  
  // Burst allowance
  burstSize: number;           // Default: 50
  
  // Key extraction
  keyBy: 'ip' | 'apikey' | 'user' | 'custom';
  
  // Response
  includeHeaders: boolean;      // Default: true
  customMessage: string;
}

// Rate limit headers
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 950
X-RateLimit-Reset: 1642694400
```

## Performance Configuration

### Request Queuing

```typescript
interface QueueConfig {
  // Enable queuing
  enableQueuing: boolean;       // Default: true
  
  // Queue settings
  maxQueueSize: number;        // Default: 1000
  queueTimeout: number;        // Default: 30000 (30s)
  
  // Processing
  concurrency: number;         // Default: 10
  batchProcessing: boolean;    // Default: true
}
```

### Connection Pooling

```typescript
interface ConnectionPoolConfig {
  // Pool settings
  maxConnections: number;      // Default: 50
  minConnections: number;      // Default: 10
  
  // Timeouts
  connectionTimeout: number;   // Default: 5000 (5s)
  idleTimeout: number;        // Default: 60000 (60s)
  
  // Keep-alive
  keepAlive: boolean;         // Default: true
  keepAliveTimeout: number;   // Default: 5000 (5s)
}
```

## Monitoring Configuration

### Metrics Collection

```typescript
interface MetricsConfig {
  // Enable metrics
  enabled: boolean;            // Default: true
  
  // Metrics to collect
  collectLatency: boolean;     // Default: true
  collectErrors: boolean;      // Default: true
  collectThroughput: boolean;  // Default: true
  
  // Aggregation
  aggregationInterval: number; // Default: 60000 (1 minute)
  
  // Export
  exportFormat: 'prometheus' | 'statsd' | 'custom';
}
```

### Health Check

```typescript
interface HealthCheckConfig {
  // Path
  path: string;               // Default: '/health'
  
  // Checks to perform
  checks: {
    datafile: boolean;        // Default: true
    sdk: boolean;            // Default: true
    storage: boolean;        // Default: true
    dependencies: boolean;   // Default: true
  };
  
  // Response detail
  detailed: boolean;         // Default: false
  includeVersion: boolean;   // Default: true
}

// Health check response
{
  "status": "healthy",
  "version": "2.0.0",
  "uptime": 3600,
  "checks": {
    "datafile": { "status": "healthy", "latency": 5 },
    "sdk": { "status": "healthy", "initialized": true },
    "storage": { "status": "healthy", "available": true }
  }
}
```

## Best Practices

### 1. Secure Your API

```typescript
// Always use authentication in production
const config = {
  auth: {
    enabled: true,
    methods: ['apikey'],
    apiKeyHeader: 'X-API-Key'
  },
  cors: {
    allowedOrigins: ['https://app.example.com'],
    allowCredentials: true
  }
};
```

### 2. Implement Proper Error Handling

```typescript
try {
  const result = await handler.process(request);
  return response.json(result);
} catch (error) {
  logger.error('Request failed', { error, requestId });
  return response.json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An error occurred processing your request',
      requestId
    }
  }, 500);
}
```

### 3. Monitor Performance

```typescript
// Track API metrics
metrics.timing('api.request.duration', duration, {
  endpoint: request.path,
  method: request.method,
  status: response.status
});
```

## See Also

- [API Reference](/docs-sot/api/) - Complete API documentation
- [Security Configuration](./security-configuration.md) - Security best practices
- [Edge Mode Configuration](./edge-mode-configuration.md) - Edge mode settings
- Implementation: `/src-v2/services/implementations/ApiRouter.ts`