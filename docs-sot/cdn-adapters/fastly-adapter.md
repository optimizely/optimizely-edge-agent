# Fastly Compute@Edge Adapter

## Overview

The Fastly Compute@Edge adapter enables the Optimizely Edge Agent to run on Fastly's edge cloud platform. This adapter leverages WebAssembly (WASM) for secure execution, Config Store for configuration management, and Fastly's powerful edge computing capabilities.

## Platform Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      Fastly Compute@Edge Architecture                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Edge POPs (80+)           Compute Services          Storage Layer      │
│  ┌──────────────┐         ┌─────────────┐         ┌────────────────┐  │
│  │  Compute@Edge│         │   Edge      │         │  Config Store  │  │
│  │     (WASM)   │◄────────│   Agent     │────────▶│  (Edge Dict)   │  │
│  │              │         │             │         └────────────────┘  │
│  └──────────────┘         └─────────────┘         ┌────────────────┐  │
│         │                        │                 │  Object Store  │  │
│         ▼                        ▼                 │   (Coming)     │  │
│  ┌──────────────┐         ┌─────────────┐         └────────────────┘  │
│  │   Backends   │         │  Real-time  │         ┌────────────────┐  │
│  │   (Origins)  │         │    Stats    │         │  Edge Rate     │  │
│  └──────────────┘         └─────────────┘         │   Limiting     │  │
│                                                    └────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Adapter Implementation

### FastlyRequestAdapter

```typescript
// From: /src-v2/adapters/implementations/fastly/FastlyRequestAdapter.ts
export class FastlyRequestAdapter implements IRequestAdapter {
  private _url: URL;
  private _headers: Headers;
  private _body: ReadableStream | null = null;
  
  constructor(private event: FetchEvent) {
    this._url = new URL(event.request.url);
    this._headers = new Headers();
    
    // Convert Fastly headers to standard Headers
    for (const [key, value] of Object.entries(event.request.headers)) {
      this._headers.set(key, value);
    }
  }
  
  get url(): URL {
    return this._url;
  }
  
  get method(): string {
    return this.event.request.method;
  }
  
  get headers(): Headers {
    return this._headers;
  }
  
  get body(): ReadableStream | null {
    return this._body;
  }
  
  getHeader(name: string): string | null {
    return this._headers.get(name);
  }
  
  getAllHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    this._headers.forEach((value, key) => {
      headers[key] = value;
    });
    return headers;
  }
  
  async getBody(): Promise<string> {
    if (!this.event.request.body) return '';
    
    try {
      // Fastly-specific body reading
      const bodyBuffer = await this.event.request.arrayBuffer();
      return new TextDecoder().decode(bodyBuffer);
    } catch (error) {
      console.error('Failed to read body:', error);
      return '';
    }
  }
  
  getQueryParam(name: string): string | null {
    return this._url.searchParams.get(name);
  }
  
  getAllQueryParams(): Record<string, string> {
    const params: Record<string, string> = {};
    this._url.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    return params;
  }
  
  getCookie(name: string): string | null {
    const cookieHeader = this.getHeader('cookie');
    if (!cookieHeader) return null;
    
    const cookies = this.parseCookies(cookieHeader);
    return cookies[name] || null;
  }
  
  getAllCookies(): Record<string, string> {
    const cookieHeader = this.getHeader('cookie') || '';
    return this.parseCookies(cookieHeader);
  }
  
  private parseCookies(cookieStr: string): Record<string, string> {
    return cookieStr.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      if (key) acc[key] = decodeURIComponent(value || '');
      return acc;
    }, {} as Record<string, string>);
  }
  
  clone(): IRequestAdapter {
    // Fastly requests can't be cloned directly
    return new FastlyRequestAdapter(this.event);
  }
}
```

### FastlyStorageAdapter

```typescript
// From: /src-v2/adapters/implementations/fastly/FastlyStorageAdapter.ts
import { ConfigStore } from 'fastly:config-store';
import { SecretStore } from 'fastly:secret-store';

export class FastlyStorageAdapter implements IStorageAdapter {
  private configStore: ConfigStore;
  private secretStore?: SecretStore;
  
  constructor(
    configStoreName: string,
    private logger: ILoggerAdapter,
    secretStoreName?: string
  ) {
    this.configStore = new ConfigStore(configStoreName);
    
    if (secretStoreName) {
      this.secretStore = new SecretStore(secretStoreName);
    }
  }
  
  async get(key: string): Promise<string | null> {
    try {
      // Check if it's a secret key
      if (key.startsWith('secret:') && this.secretStore) {
        const secretKey = key.substring(7);
        const secret = this.secretStore.get(secretKey);
        return secret ? secret.plaintext() : null;
      }
      
      // Regular config store get
      const value = this.configStore.get(key);
      
      if (value) {
        this.logger.debug(`Config store hit for key: ${key}`);
        return value;
      } else {
        this.logger.debug(`Config store miss for key: ${key}`);
        return null;
      }
    } catch (error) {
      this.logger.error(`Config store get error for key: ${key}`, error as Error);
      return null;
    }
  }
  
  async getWithMetadata<T = any>(key: string): Promise<{ value: string | null; metadata: T | null }> {
    // Config Store doesn't support metadata, simulate with JSON
    const value = await this.get(key);
    if (!value) return { value: null, metadata: null };
    
    try {
      const data = JSON.parse(value);
      if (data._metadata && data._value !== undefined) {
        return {
          value: JSON.stringify(data._value),
          metadata: data._metadata as T
        };
      }
    } catch {
      // Not a metadata entry
    }
    
    return { value, metadata: null };
  }
  
  async put(key: string, value: string, options?: StorageOptions): Promise<void> {
    // Config Store is read-only at runtime
    // This would typically be done during deployment
    this.logger.warn(`Config store put not supported at runtime for key: ${key}`);
    
    // For development/testing, you might use a different approach
    if (process.env.FASTLY_ENV === 'development') {
      // Use in-memory cache or alternative storage
      this.devCache.set(key, { value, options });
    }
  }
  
  async delete(key: string): Promise<void> {
    // Config Store is read-only at runtime
    this.logger.warn(`Config store delete not supported at runtime for key: ${key}`);
  }
  
  async list(options?: ListOptions): Promise<ListResult> {
    // List all keys in config store
    const allKeys: string[] = [];
    
    // Note: Fastly doesn't provide a native list operation
    // You would need to maintain a key index
    const keyIndex = this.configStore.get('_key_index');
    if (keyIndex) {
      const keys = JSON.parse(keyIndex) as string[];
      
      const filteredKeys = keys
        .filter(key => !options?.prefix || key.startsWith(options.prefix))
        .slice(0, options?.limit || 1000);
      
      return {
        keys: filteredKeys.map(name => ({ name })),
        complete: true
      };
    }
    
    return { keys: [], complete: true };
  }
  
  // Development cache for testing
  private devCache = new Map<string, any>();
}
```

### FastlyEnvironmentAdapter

```typescript
// From: /src-v2/adapters/implementations/fastly/FastlyEnvironmentAdapter.ts
import { env } from 'fastly:env';

export class FastlyEnvironmentAdapter implements IEnvironmentAdapter {
  private envVars: Record<string, string> = {};
  
  constructor(private configStore?: ConfigStore) {
    // Load environment variables from Fastly env
    this.loadEnvironmentVariables();
  }
  
  private loadEnvironmentVariables(): void {
    // Fastly exposes env vars through the env import
    try {
      // Get all environment variables
      for (const key in env) {
        if (typeof env[key] === 'string') {
          this.envVars[key] = env[key];
        }
      }
    } catch (error) {
      console.error('Failed to load environment variables:', error);
    }
    
    // Also load from config store if available
    if (this.configStore) {
      try {
        const configEnv = this.configStore.get('_environment');
        if (configEnv) {
          const parsed = JSON.parse(configEnv);
          Object.assign(this.envVars, parsed);
        }
      } catch (error) {
        console.error('Failed to load config store environment:', error);
      }
    }
  }
  
  get(key: string): string | undefined {
    return this.envVars[key];
  }
  
  getRequired(key: string): string {
    const value = this.get(key);
    if (!value) {
      throw new Error(`Required environment variable '${key}' is not set`);
    }
    return value;
  }
  
  getAll(): Record<string, string> {
    return { ...this.envVars };
  }
}
```

## Fastly-Specific Features

### Config Store (Edge Dictionary)

```typescript
// Using Config Store for configuration
import { ConfigStore } from 'fastly:config-store';

class FastlyConfigService {
  private store: ConfigStore;
  
  constructor(storeName: string = 'optimizely_config') {
    this.store = new ConfigStore(storeName);
  }
  
  getConfig<T>(key: string, defaultValue?: T): T | undefined {
    const value = this.store.get(key);
    if (!value) return defaultValue;
    
    try {
      return JSON.parse(value) as T;
    } catch {
      // Return as string if not JSON
      return value as unknown as T;
    }
  }
  
  getAllConfig(): Record<string, any> {
    const config: Record<string, any> = {};
    
    // Get known configuration keys
    const configKeys = [
      'sdk_key',
      'environment',
      'cache_ttl',
      'log_level',
      'feature_flags'
    ];
    
    for (const key of configKeys) {
      const value = this.getConfig(key);
      if (value !== undefined) {
        config[key] = value;
      }
    }
    
    return config;
  }
}
```

### Backend Configuration

```typescript
// Backend management for origin requests
import { Backend } from 'fastly:backend';

class FastlyBackendService {
  async fetchFromOrigin(
    backendName: string,
    request: Request
  ): Promise<Response> {
    try {
      // Create backend request
      const backendRequest = new Request(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        backend: backendName // Fastly-specific
      });
      
      // Add backend-specific headers
      backendRequest.headers.set('X-Forwarded-For', request.headers.get('Fastly-Client-IP') || '');
      backendRequest.headers.set('X-Forwarded-Proto', 'https');
      
      // Fetch from backend
      const response = await fetch(backendRequest);
      
      // Handle backend errors
      if (!response.ok) {
        console.error(`Backend ${backendName} returned ${response.status}`);
      }
      
      return response;
    } catch (error) {
      console.error(`Backend ${backendName} failed:`, error);
      throw error;
    }
  }
  
  // Health check for backends
  async checkBackendHealth(backendName: string): Promise<boolean> {
    try {
      const healthRequest = new Request('https://backend/health', {
        method: 'GET',
        backend: backendName
      });
      
      const response = await fetch(healthRequest);
      return response.ok;
    } catch {
      return false;
    }
  }
}
```

### Geolocation

```typescript
// Fastly geolocation features
import { geolocation } from 'fastly:geolocation';

class FastlyGeolocationService {
  getLocationData(clientIp: string): LocationData {
    try {
      const geo = geolocation(clientIp);
      
      return {
        country: geo.country_code,
        region: geo.region,
        city: geo.city,
        latitude: geo.latitude,
        longitude: geo.longitude,
        timezone: geo.timezone,
        continentCode: geo.continent_code,
        asn: geo.as_number,
        asName: geo.as_name
      };
    } catch (error) {
      console.error('Geolocation lookup failed:', error);
      return {
        country: 'XX',
        region: '',
        city: '',
        latitude: 0,
        longitude: 0
      };
    }
  }
  
  // Use geo data for decisions
  getOptimizelyAttributes(clientIp: string): Record<string, any> {
    const geo = this.getLocationData(clientIp);
    
    return {
      $opt_geo_country: geo.country,
      $opt_geo_region: geo.region,
      $opt_geo_city: geo.city,
      $opt_geo_continent: geo.continentCode,
      $opt_geo_timezone: geo.timezone
    };
  }
}
```

### Device Detection

```typescript
// Fastly device detection
import { device } from 'fastly:device';

class FastlyDeviceDetection {
  getDeviceInfo(userAgent: string): DeviceInfo {
    try {
      const deviceInfo = device(userAgent);
      
      return {
        type: deviceInfo.type, // desktop, mobile, tablet
        name: deviceInfo.name,
        brand: deviceInfo.brand,
        model: deviceInfo.model,
        os: {
          name: deviceInfo.os.name,
          version: deviceInfo.os.version
        },
        browser: {
          name: deviceInfo.browser.name,
          version: deviceInfo.browser.version
        }
      };
    } catch (error) {
      console.error('Device detection failed:', error);
      return { type: 'unknown' };
    }
  }
  
  getOptimizelyAttributes(userAgent: string): Record<string, any> {
    const device = this.getDeviceInfo(userAgent);
    
    return {
      $opt_device_type: device.type,
      $opt_device_brand: device.brand,
      $opt_os_name: device.os?.name,
      $opt_browser_name: device.browser?.name
    };
  }
}
```

## Configuration

### Fastly Service Configuration

```toml
# fastly.toml
manifest_version = 3
name = "optimizely-edge-agent"
description = "Optimizely Edge Agent on Fastly Compute@Edge"
authors = ["your-team@example.com"]
language = "javascript"
service_id = "YOUR_SERVICE_ID"

[local_server]
  [local_server.backends]
    [local_server.backends.optimizely_api]
      url = "https://api.optimizely.com"
    [local_server.backends.optimizely_cdn]
      url = "https://cdn.optimizely.com"

  [local_server.config_stores]
    [local_server.config_stores.optimizely_config]
      file = "./config/local.json"
      format = "json"

[setup]
  [setup.backends]
    [setup.backends.optimizely_api]
      address = "api.optimizely.com"
      port = 443
      use_ssl = true
      ssl_cert_hostname = "api.optimizely.com"
      override_host = "api.optimizely.com"
      
    [setup.backends.optimizely_cdn]
      address = "cdn.optimizely.com"
      port = 443
      use_ssl = true
      ssl_cert_hostname = "cdn.optimizely.com"
      override_host = "cdn.optimizely.com"

  [setup.config_stores]
    [setup.config_stores.optimizely_config]
      items = [
        { key = "sdk_key", value = "YOUR_SDK_KEY" },
        { key = "environment", value = "production" },
        { key = "cache_ttl", value = "300" },
        { key = "log_level", value = "info" },
        { key = "_key_index", value = "[\"sdk_key\",\"environment\",\"cache_ttl\",\"log_level\"]" }
      ]

  [setup.secret_stores]
    [setup.secret_stores.optimizely_secrets]
      entries = [
        { key = "api_key", secret = "YOUR_API_KEY" }
      ]

[scripts]
  build = "npm run build:fastly"
  
[environments]
  [environments.staging]
    service_id = "STAGING_SERVICE_ID"
  [environments.production]
    service_id = "PRODUCTION_SERVICE_ID"
```

### Build Configuration

```javascript
// webpack.config.fastly.js
const path = require('path');
const webpack = require('webpack');

module.exports = {
  target: 'webworker',
  entry: './src-v2/fastly.js',
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, 'dist/fastly'),
    libraryTarget: 'this',
  },
  mode: 'production',
  optimization: {
    minimize: true,
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      'fastly:env': path.resolve(__dirname, 'node_modules/@fastly/js-compute/dist/fastly-env.js'),
      'fastly:config-store': path.resolve(__dirname, 'node_modules/@fastly/js-compute/dist/fastly-config-store.js'),
      'fastly:secret-store': path.resolve(__dirname, 'node_modules/@fastly/js-compute/dist/fastly-secret-store.js'),
      'fastly:geolocation': path.resolve(__dirname, 'node_modules/@fastly/js-compute/dist/fastly-geolocation.js'),
      'fastly:device': path.resolve(__dirname, 'node_modules/@fastly/js-compute/dist/fastly-device.js'),
    }
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [
    new webpack.ProvidePlugin({
      URL: ['url', 'URL'],
      URLSearchParams: ['url', 'URLSearchParams'],
    }),
  ],
};
```

## Performance Optimization

### Edge Caching

```typescript
// Fastly edge caching
class FastlyCacheService {
  setCacheHeaders(response: Response, ttl: number = 300): Response {
    const headers = new Headers(response.headers);
    
    // Surrogate-Control for Fastly edge
    headers.set('Surrogate-Control', `max-age=${ttl}`);
    
    // Cache-Control for browser
    headers.set('Cache-Control', 'public, max-age=60');
    
    // Surrogate-Key for cache invalidation
    headers.set('Surrogate-Key', 'optimizely decisions');
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
  
  // Generate cache key
  generateCacheKey(request: Request): string {
    const url = new URL(request.url);
    const userId = request.headers.get('X-User-ID') || 'anonymous';
    
    // Include important vary factors
    const factors = [
      url.pathname,
      url.searchParams.toString(),
      userId,
      request.headers.get('X-Feature-Flags') || ''
    ];
    
    return factors.join(':');
  }
}
```

### Request Collapsing

```typescript
// Prevent duplicate backend requests
class RequestCollapser {
  private pending = new Map<string, Promise<Response>>();
  
  async fetch(
    key: string, 
    fetcher: () => Promise<Response>
  ): Promise<Response> {
    // Check if request is in flight
    const existing = this.pending.get(key);
    if (existing) {
      console.log(`Request collapsed for key: ${key}`);
      return existing.then(r => r.clone());
    }
    
    // Start new request
    const promise = fetcher()
      .then(response => {
        this.pending.delete(key);
        return response;
      })
      .catch(error => {
        this.pending.delete(key);
        throw error;
      });
    
    this.pending.set(key, promise);
    return promise;
  }
}
```

## Deployment

### Build and Package

```bash
# Install dependencies
npm install

# Build for Fastly
npm run build:fastly

# Test locally
fastly compute serve

# Validate package
fastly compute validate
```

### Deployment Commands

```bash
# Deploy to staging
fastly compute publish --environment=staging

# Deploy to production
fastly compute publish --environment=production

# Update config store
fastly config-store-entry create \
  --store-id=STORE_ID \
  --key=feature_flags \
  --value='{"new_checkout": true}'

# Update secret store
fastly secret-store-entry create \
  --store-id=SECRET_STORE_ID \
  --key=api_key \
  --stdin < api_key.txt
```

### CI/CD Pipeline

```yaml
# .github/workflows/fastly-deploy.yml
name: Deploy to Fastly

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install Fastly CLI
        run: |
          wget https://github.com/fastly/cli/releases/download/v8.0.0/fastly_8.0.0_linux_amd64.deb
          sudo dpkg -i fastly_8.0.0_linux_amd64.deb
          
      - name: Install dependencies
        run: npm ci
        
      - name: Build
        run: npm run build:fastly
        
      - name: Deploy to Fastly
        env:
          FASTLY_API_TOKEN: ${{ secrets.FASTLY_API_TOKEN }}
        run: |
          fastly compute publish \
            --token=$FASTLY_API_TOKEN \
            --environment=production
```

## Monitoring and Debugging

### Real-time Analytics

```typescript
// Fastly real-time analytics integration
class FastlyAnalytics {
  logDecision(decision: OptimizelyDecision, timing: number): void {
    // Log to Fastly real-time analytics
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      type: 'decision',
      flag_key: decision.flagKey,
      variation: decision.variationKey,
      enabled: decision.enabled,
      user_id: decision.userContext.userId,
      timing_ms: timing,
      edge_pop: fastly.env.get('FASTLY_POP'),
      region: fastly.env.get('FASTLY_REGION')
    }));
  }
  
  logError(error: Error, context: any): void {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      type: 'error',
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      context,
      edge_pop: fastly.env.get('FASTLY_POP')
    }));
  }
}
```

### Edge Debugging

```typescript
// Debug helpers for Fastly
class FastlyDebugger {
  addDebugHeaders(response: Response, context: any): Response {
    const headers = new Headers(response.headers);
    
    // Add Fastly-specific debug headers
    headers.set('X-Fastly-POP', fastly.env.get('FASTLY_POP') || 'unknown');
    headers.set('X-Fastly-Region', fastly.env.get('FASTLY_REGION') || 'unknown');
    headers.set('X-Compute-Debug', JSON.stringify(context));
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
  
  // Time execution
  async timeExecution<T>(
    name: string, 
    fn: () => Promise<T>
  ): Promise<{ result: T; timing: number }> {
    const start = Date.now();
    const result = await fn();
    const timing = Date.now() - start;
    
    console.log(`Timing: ${name} took ${timing}ms`);
    
    return { result, timing };
  }
}
```

## Best Practices

### 1. Efficient Config Store Usage

```typescript
// Cache config store reads
class CachedConfigStore {
  private cache = new Map<string, any>();
  
  get(key: string): any {
    // Check cache first
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }
    
    // Read from config store
    const value = this.store.get(key);
    if (value) {
      this.cache.set(key, value);
    }
    
    return value;
  }
}
```

### 2. Handle WASM Constraints

```typescript
// Work within WASM memory limits
class MemoryManager {
  private usage = 0;
  private limit = 128 * 1024 * 1024; // 128MB
  
  canAllocate(bytes: number): boolean {
    return this.usage + bytes < this.limit;
  }
  
  allocate(bytes: number): void {
    if (!this.canAllocate(bytes)) {
      throw new Error('Memory limit exceeded');
    }
    this.usage += bytes;
  }
}
```

### 3. Optimize Backend Requests

```typescript
// Batch backend requests when possible
class BackendBatcher {
  async fetchMultiple(requests: BackendRequest[]): Promise<Response[]> {
    // Group by backend
    const grouped = this.groupByBackend(requests);
    
    // Fetch in parallel
    const promises = Object.entries(grouped).map(([backend, reqs]) =>
      Promise.all(reqs.map(req => this.fetchSingle(backend, req)))
    );
    
    const results = await Promise.all(promises);
    return results.flat();
  }
}
```

## Troubleshooting

### Common Issues

1. **Config Store Limits**
   ```typescript
   // Handle config store size limits
   function splitLargeConfig(key: string, data: any): void {
     const json = JSON.stringify(data);
     const chunks = Math.ceil(json.length / 1000);
     
     for (let i = 0; i < chunks; i++) {
       const chunk = json.slice(i * 1000, (i + 1) * 1000);
       configStore.set(`${key}_${i}`, chunk);
     }
     
     configStore.set(`${key}_chunks`, chunks.toString());
   }
   ```

2. **WASM Performance**
   ```typescript
   // Monitor CPU usage
   const startCpu = process.cpuUsage();
   // ... operation ...
   const endCpu = process.cpuUsage(startCpu);
   
   if (endCpu.user > 40000) { // 40ms
     console.warn('High CPU usage detected');
   }
   ```

3. **Backend Timeouts**
   ```typescript
   // Implement timeout handling
   async function fetchWithTimeout(
     request: Request, 
     timeout: number = 5000
   ): Promise<Response> {
     const controller = new AbortController();
     const timer = setTimeout(() => controller.abort(), timeout);
     
     try {
       return await fetch(request, { signal: controller.signal });
     } finally {
       clearTimeout(timer);
     }
   }
   ```

## Testing and QA Features

### Forced Decisions

The Fastly adapter fully supports forced decisions for testing and QA scenarios. This allows you to override normal feature flag bucketing to test specific variations.

#### Using Forced Decisions with Fastly Compute@Edge

```typescript
// Example: Fastly Compute@Edge with forced decisions
import { Router } from "@fastly/expressly";

const router = new Router();

router.post("/api/decide", async (req, res) => {
  // Example 1: Force variation via headers (highest precedence)
  const forceVariation = req.headers.get('X-Optimizely-Force-Variation');
  
  // Example 2: Force variation via query parameters
  const url = new URL(req.url);
  const queryForceVariation = url.searchParams.get('forceVariation');
  
  // Example 3: Force variation in request body
  const body = await req.json();
  const bodyForceVariation = body.forcedVariationKey;
  
  // Apply precedence: headers > query > body
  const finalForceVariation = forceVariation || queryForceVariation || bodyForceVariation;
  
  if (finalForceVariation) {
    // Add to decision request
    req.headers.set('X-Optimizely-Force-Variation', finalForceVariation);
  }
  
  // Forward to decision service
  const response = await handleDecision(req);
  res.send(response);
});
```

#### Testing Script for Fastly

```bash
#!/bin/bash
# Test forced decisions on Fastly Compute@Edge deployment

FASTLY_URL="https://your-service.edgecompute.app"
SDK_KEY="your-sdk-key"

# Test 1: Force variation via header
echo "Testing forced variation via header..."
curl -X POST "$FASTLY_URL/api/decide" \
  -H "Content-Type: application/json" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: $SDK_KEY" \
  -H "X-Optimizely-Force-Variation: treatment" \
  -d '{
    "flagKey": "checkout_flow",
    "userId": "qa_tester_001"
  }'

# Test 2: Force variation via query parameter
echo -e "\n\nTesting forced variation via query parameter..."
curl -X GET "$FASTLY_URL/api/decide?\
flagKey=checkout_flow&\
userId=qa_tester_001&\
forceVariation=control&\
sdkKey=$SDK_KEY" \
  -H "X-Optimizely-Enable-FEX: true"

# Test 3: Force variation via request body
echo -e "\n\nTesting forced variation via request body..."
curl -X POST "$FASTLY_URL/api/decide" \
  -H "Content-Type: application/json" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: $SDK_KEY" \
  -d '{
    "flagKey": "checkout_flow",
    "userId": "qa_tester_001",
    "forcedVariationKey": "express_checkout"
  }'

# Test 4: Test precedence (header should win)
echo -e "\n\nTesting precedence (header > query > body)..."
curl -X POST "$FASTLY_URL/api/decide?forceVariation=query_variation" \
  -H "Content-Type: application/json" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: $SDK_KEY" \
  -H "X-Optimizely-Force-Variation: header_variation" \
  -d '{
    "flagKey": "checkout_flow",
    "userId": "qa_tester_001",
    "forcedVariationKey": "body_variation"
  }'
```

#### VCL Integration for QA Testing

```vcl
# fastly.vcl - Add QA override support
sub vcl_recv {
  # Check for QA test user
  if (req.http.Cookie ~ "qa_user_id=") {
    set req.http.X-QA-User = regsub(req.http.Cookie, 
      ".*qa_user_id=([^;]+).*", "\1");
  }
  
  # Apply QA overrides from Config Store
  if (req.http.X-QA-User) {
    declare local var.qa_override STRING;
    set var.qa_override = config_store.get(
      concat("qa_override_", req.http.X-QA-User)
    );
    
    if (var.qa_override) {
      set req.http.X-Optimizely-Force-Variation = var.qa_override;
    }
  }
}
```

#### Config Store Based QA Overrides

```typescript
// Manage QA overrides in Config Store
class FastlyQAManager {
  async setQAOverride(
    userId: string, 
    flagKey: string, 
    variation: string
  ): Promise<void> {
    const key = `qa_override_${userId}_${flagKey}`;
    
    // Update Config Store via API
    const response = await fetch(
      `https://api.fastly.com/config-stores/${STORE_ID}/items/${key}`,
      {
        method: 'PUT',
        headers: {
          'Fastly-Key': process.env.FASTLY_API_TOKEN,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          item_value: variation,
          item_key: key 
        })
      }
    );
    
    if (!response.ok) {
      throw new Error('Failed to set QA override');
    }
  }
  
  async getQAOverrides(userId: string): Promise<Record<string, string>> {
    const prefix = `qa_override_${userId}_`;
    
    // List all items with prefix
    const response = await fetch(
      `https://api.fastly.com/config-stores/${STORE_ID}/items`,
      {
        headers: {
          'Fastly-Key': process.env.FASTLY_API_TOKEN
        }
      }
    );
    
    const items = await response.json();
    const overrides: Record<string, string> = {};
    
    for (const item of items) {
      if (item.item_key.startsWith(prefix)) {
        const flagKey = item.item_key.replace(prefix, '');
        overrides[flagKey] = item.item_value;
      }
    }
    
    return overrides;
  }
}
```

#### Edge Testing Dashboard

```typescript
// Fastly edge testing dashboard handler
router.get("/qa-dashboard", async (req, res) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>QA Testing Dashboard</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        .form-group { margin-bottom: 15px; }
        input, select, button { padding: 5px 10px; }
        .result { background: #f0f0f0; padding: 10px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <h1>Fastly Edge Agent QA Dashboard</h1>
      
      <div class="form-group">
        <label>User ID: <input type="text" id="userId" value="qa_tester_001"></label>
      </div>
      
      <div class="form-group">
        <label>Flag Key: <input type="text" id="flagKey" value="checkout_flow"></label>
      </div>
      
      <div class="form-group">
        <label>Force Variation: 
          <select id="variation">
            <option value="">None</option>
            <option value="control">Control</option>
            <option value="treatment">Treatment</option>
            <option value="variant_a">Variant A</option>
            <option value="variant_b">Variant B</option>
          </select>
        </label>
      </div>
      
      <button onclick="testDecision()">Test Decision</button>
      
      <div id="result" class="result" style="display:none;"></div>
      
      <script>
        async function testDecision() {
          const userId = document.getElementById('userId').value;
          const flagKey = document.getElementById('flagKey').value;
          const variation = document.getElementById('variation').value;
          
          const headers = {
            'Content-Type': 'application/json',
            'X-Optimizely-Enable-FEX': 'true'
          };
          
          if (variation) {
            headers['X-Optimizely-Force-Variation'] = variation;
          }
          
          const response = await fetch('/api/decide', {
            method: 'POST',
            headers,
            body: JSON.stringify({ flagKey, userId })
          });
          
          const decision = await response.json();
          
          document.getElementById('result').style.display = 'block';
          document.getElementById('result').innerHTML = 
            '<pre>' + JSON.stringify(decision, null, 2) + '</pre>';
        }
      </script>
    </body>
    </html>
  `;
  
  res.status(200).set('Content-Type', 'text/html').send(html);
});
```

#### Automated Testing

```javascript
// test/fastly-forced-decisions.test.js
const { describe, test, expect } = require('@jest/globals');

describe('Fastly Forced Decisions', () => {
  const baseUrl = 'https://test.edgecompute.app';
  
  test('should respect forced variation from header', async () => {
    const response = await fetch(`${baseUrl}/api/decide`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Optimizely-Enable-FEX': 'true',
        'X-Optimizely-SDK-Key': 'test-key',
        'X-Optimizely-Force-Variation': 'variant_b'
      },
      body: JSON.stringify({
        flagKey: 'test_feature',
        userId: 'test_user'
      })
    });
    
    const decision = await response.json();
    expect(decision.variationKey).toBe('variant_b');
  });
  
  test('should handle forced decisions with real-time stats', async () => {
    // Test that forced decisions are tracked correctly
    const response = await fetch(`${baseUrl}/api/decide`, {
      method: 'POST',
      headers: {
        'X-Optimizely-Force-Variation': 'treatment',
        'X-Optimizely-Enable-FEX': 'true'
      },
      body: JSON.stringify({
        flagKey: 'test_flag',
        userId: 'stats_test_user'
      })
    });
    
    // Check that stats include forced decision indicator
    const stats = response.headers.get('X-Stats-Forced');
    expect(stats).toBe('true');
  });
});
```

## See Also

- [Fastly Compute@Edge Documentation](https://docs.fastly.com/products/compute-at-edge)
- [Fastly JavaScript SDK](https://github.com/fastly/js-compute-runtime)
- [Config Store Guide](https://docs.fastly.com/en/guides/working-with-config-stores)
- [API Decision Endpoints](../api/decisions/decide.md)
- [Adapter Development Guide](./adapter-development.md)
- Implementation: `/src-v2/adapters/implementations/fastly/`