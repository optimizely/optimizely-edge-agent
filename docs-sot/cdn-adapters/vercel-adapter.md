# Vercel Edge Functions Adapter

## Overview

The Vercel Edge Functions adapter enables the Optimizely Edge Agent to run on Vercel's edge network. This adapter leverages the Edge Runtime (based on Web APIs), Edge Config for dynamic configuration, and seamless integration with Next.js applications.

## Platform Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     Vercel Edge Functions Architecture                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Edge Regions (20+)        Edge Runtime           Storage Layer         │
│  ┌──────────────┐         ┌─────────────┐       ┌────────────────┐    │
│  │ Edge Function│         │   Edge      │       │  Edge Config   │    │
│  │   (V8/Node)  │◄────────│   Agent     │──────▶│  (Distributed) │    │
│  │              │         │             │       └────────────────┘    │
│  └──────────────┘         └─────────────┘       ┌────────────────┐    │
│         │                        │               │  KV Storage    │    │
│         ▼                        ▼               │   (Beta)       │    │
│  ┌──────────────┐         ┌─────────────┐       └────────────────┘    │
│  │    Next.js   │         │  Analytics  │       ┌────────────────┐    │
│  │ Integration  │         │  & Vitals   │       │     Blob       │    │
│  └──────────────┘         └─────────────┘       │   Storage      │    │
│                                                  └────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Adapter Implementation

### VercelRequestAdapter

```typescript
// From: /src-v2/adapters/implementations/vercel/VercelRequestAdapter.ts
export class VercelRequestAdapter implements IRequestAdapter {
  private _url: URL;
  private _headers: Headers;
  
  constructor(private request: Request) {
    this._url = new URL(request.url);
    this._headers = request.headers;
  }
  
  get url(): URL {
    return this._url;
  }
  
  get method(): string {
    return this.request.method;
  }
  
  get headers(): Headers {
    return this._headers;
  }
  
  get body(): ReadableStream<Uint8Array> | null {
    return this.request.body;
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
    if (!this.request.body) return '';
    
    try {
      // Clone request to avoid consuming body
      const cloned = this.request.clone();
      return await cloned.text();
    } catch (error) {
      console.error('Failed to read request body:', error);
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
    const cookieHeader = this._headers.get('cookie');
    if (!cookieHeader) return null;
    
    // Parse cookies
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      if (key) acc[key] = decodeURIComponent(value || '');
      return acc;
    }, {} as Record<string, string>);
    
    return cookies[name] || null;
  }
  
  getAllCookies(): Record<string, string> {
    const cookieHeader = this._headers.get('cookie') || '';
    return cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      if (key) acc[key] = decodeURIComponent(value || '');
      return acc;
    }, {} as Record<string, string>);
  }
  
  clone(): IRequestAdapter {
    return new VercelRequestAdapter(this.request.clone());
  }
  
  // Vercel-specific helpers
  getGeolocation(): GeolocationData | null {
    return {
      city: this.getHeader('x-vercel-ip-city') || undefined,
      country: this.getHeader('x-vercel-ip-country') || undefined,
      region: this.getHeader('x-vercel-ip-country-region') || undefined,
      latitude: this.getHeader('x-vercel-ip-latitude') || undefined,
      longitude: this.getHeader('x-vercel-ip-longitude') || undefined
    };
  }
}
```

### VercelStorageAdapter

```typescript
// From: /src-v2/adapters/implementations/vercel/VercelStorageAdapter.ts
import { get, set, del } from '@vercel/edge-config';
import { kv } from '@vercel/kv';

export class VercelStorageAdapter implements IStorageAdapter {
  private useKV: boolean;
  
  constructor(
    private logger: ILoggerAdapter,
    options?: { preferKV?: boolean }
  ) {
    // Use KV if available, otherwise fall back to Edge Config
    this.useKV = options?.preferKV && !!kv;
  }
  
  async get(key: string): Promise<string | null> {
    try {
      if (this.useKV) {
        // Use Vercel KV (Redis-compatible)
        const value = await kv.get<string>(key);
        this.logger.debug(`KV ${value ? 'hit' : 'miss'} for key: ${key}`);
        return value;
      } else {
        // Use Edge Config
        const value = await get<string>(key);
        this.logger.debug(`Edge Config ${value ? 'hit' : 'miss'} for key: ${key}`);
        return value || null;
      }
    } catch (error) {
      this.logger.error(`Storage get error for key: ${key}`, error as Error);
      return null;
    }
  }
  
  async getWithMetadata<T = any>(key: string): Promise<{ value: string | null; metadata: T | null }> {
    try {
      if (this.useKV) {
        // KV doesn't have native metadata support
        const [value, metadata] = await Promise.all([
          kv.get<string>(key),
          kv.get<T>(`${key}:metadata`)
        ]);
        
        return { value, metadata };
      } else {
        // Edge Config - simulate metadata with nested object
        const data = await get<{ value: string; metadata: T }>(key);
        if (!data) return { value: null, metadata: null };
        
        return {
          value: data.value,
          metadata: data.metadata
        };
      }
    } catch (error) {
      this.logger.error(`Storage getWithMetadata error for key: ${key}`, error as Error);
      return { value: null, metadata: null };
    }
  }
  
  async put(key: string, value: string, options?: StorageOptions): Promise<void> {
    try {
      if (this.useKV) {
        // Vercel KV with TTL support
        const kvOptions: any = {};
        if (options?.expirationTtl) {
          kvOptions.ex = options.expirationTtl;
        }
        
        await kv.set(key, value, kvOptions);
        
        // Store metadata separately
        if (options?.metadata) {
          await kv.set(`${key}:metadata`, options.metadata);
        }
      } else {
        // Edge Config is read-only at runtime
        // This would typically be updated via API
        this.logger.warn(`Edge Config is read-only. Cannot put key: ${key}`);
        
        // For development, might use in-memory fallback
        if (process.env.NODE_ENV === 'development') {
          this.devCache.set(key, { value, options });
        }
      }
      
      this.logger.debug(`Storage put successful for key: ${key}`);
    } catch (error) {
      this.logger.error(`Storage put error for key: ${key}`, error as Error);
      throw error;
    }
  }
  
  async delete(key: string): Promise<void> {
    try {
      if (this.useKV) {
        await kv.del(key);
        await kv.del(`${key}:metadata`); // Also delete metadata
      } else {
        this.logger.warn(`Edge Config is read-only. Cannot delete key: ${key}`);
      }
      
      this.logger.debug(`Storage delete successful for key: ${key}`);
    } catch (error) {
      this.logger.error(`Storage delete error for key: ${key}`, error as Error);
      throw error;
    }
  }
  
  async list(options?: ListOptions): Promise<ListResult> {
    try {
      if (this.useKV) {
        // KV supports pattern matching
        const pattern = options?.prefix ? `${options.prefix}*` : '*';
        const keys = await kv.keys(pattern);
        
        // Apply limit
        const limitedKeys = options?.limit 
          ? keys.slice(0, options.limit)
          : keys;
        
        return {
          keys: limitedKeys.map(name => ({ name })),
          complete: limitedKeys.length === keys.length
        };
      } else {
        // Edge Config - get all and filter
        const all = await get<Record<string, any>>();
        if (!all) return { keys: [], complete: true };
        
        const keys = Object.keys(all)
          .filter(key => !options?.prefix || key.startsWith(options.prefix))
          .slice(0, options?.limit || 1000)
          .map(name => ({ name }));
        
        return { keys, complete: true };
      }
    } catch (error) {
      this.logger.error('Storage list error', error as Error);
      throw error;
    }
  }
  
  // Development cache
  private devCache = new Map<string, any>();
}
```

### VercelEnvironmentAdapter

```typescript
// From: /src-v2/adapters/implementations/vercel/VercelEnvironmentAdapter.ts
export class VercelEnvironmentAdapter implements IEnvironmentAdapter {
  constructor(private env: Record<string, string | undefined> = process.env) {}
  
  get(key: string): string | undefined {
    // Check process.env
    const value = this.env[key];
    
    // Vercel automatically injects some env vars
    if (!value && key.startsWith('VERCEL_')) {
      // These are available at runtime
      return this.getVercelSystemEnv(key);
    }
    
    return value;
  }
  
  getRequired(key: string): string {
    const value = this.get(key);
    if (!value) {
      throw new Error(`Required environment variable '${key}' is not set`);
    }
    return value;
  }
  
  getAll(): Record<string, string> {
    const result: Record<string, string> = {};
    
    // Get all process.env
    for (const [key, value] of Object.entries(this.env)) {
      if (typeof value === 'string') {
        result[key] = value;
      }
    }
    
    // Add Vercel system env vars
    const vercelEnvs = [
      'VERCEL_ENV',
      'VERCEL_URL',
      'VERCEL_REGION',
      'VERCEL_GIT_COMMIT_SHA',
      'VERCEL_GIT_COMMIT_REF'
    ];
    
    for (const key of vercelEnvs) {
      const value = this.getVercelSystemEnv(key);
      if (value) result[key] = value;
    }
    
    return result;
  }
  
  private getVercelSystemEnv(key: string): string | undefined {
    // Vercel system environment variables
    // These are injected at runtime
    switch (key) {
      case 'VERCEL_ENV':
        return process.env.VERCEL_ENV; // production, preview, development
      case 'VERCEL_URL':
        return process.env.VERCEL_URL; // Deployment URL
      case 'VERCEL_REGION':
        return process.env.VERCEL_REGION; // Execution region
      default:
        return undefined;
    }
  }
}
```

## Vercel-Specific Features

### Edge Config Integration

```typescript
// Using Edge Config for dynamic configuration
import { get, getAll, has } from '@vercel/edge-config';

class VercelEdgeConfigService {
  async getOptimizelyConfig(): Promise<OptimizelyConfig> {
    // Get entire config object
    const config = await getAll();
    
    return {
      sdkKey: config?.optimizely_sdk_key as string,
      environment: config?.environment as string || 'production',
      logLevel: config?.log_level as string || 'warn',
      cacheTimeSeconds: config?.cache_ttl as number || 300,
      featureFlags: config?.feature_flags as Record<string, boolean> || {}
    };
  }
  
  async getFeatureFlag(key: string): Promise<boolean> {
    const flags = await get<Record<string, boolean>>('feature_flags');
    return flags?.[key] ?? false;
  }
  
  async updateConfig(updates: Partial<OptimizelyConfig>): Promise<void> {
    // Edge Config updates require API call
    const response = await fetch(
      `https://api.vercel.com/v1/edge-config/${process.env.EDGE_CONFIG_ID}/items`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          items: Object.entries(updates).map(([key, value]) => ({
            operation: 'upsert',
            key,
            value
          }))
        })
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to update Edge Config: ${response.statusText}`);
    }
  }
}
```

### Next.js Integration

```typescript
// Middleware integration for Next.js
// middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { createVercelHandler } from '@optimizely/edge-agent';

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};

export async function middleware(request: NextRequest) {
  // Create Optimizely handler
  const handler = createVercelHandler(process.env);
  
  // Process decision
  const decision = await handler.decide({
    flagKey: 'new_homepage_design',
    userId: request.cookies.get('userId')?.value || 'anonymous',
    attributes: {
      url: request.url,
      userAgent: request.headers.get('user-agent'),
      ...getGeolocationAttributes(request)
    }
  });
  
  // Route based on decision
  if (decision.enabled && decision.variationKey === 'redesign') {
    // Rewrite to new design
    const url = request.nextUrl.clone();
    url.pathname = `/new-design${url.pathname}`;
    return NextResponse.rewrite(url);
  }
  
  // Add decision to headers for client
  const response = NextResponse.next();
  response.headers.set('X-Optimizely-Decision', JSON.stringify(decision));
  
  return response;
}

function getGeolocationAttributes(request: NextRequest): Record<string, any> {
  return {
    country: request.geo?.country,
    region: request.geo?.region,
    city: request.geo?.city,
    latitude: request.geo?.latitude,
    longitude: request.geo?.longitude
  };
}
```

### Analytics Integration

```typescript
// Vercel Analytics and Web Vitals
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

class VercelAnalyticsAdapter {
  trackDecision(decision: OptimizelyDecision): void {
    // Track with Vercel Analytics
    if (typeof window !== 'undefined' && window.va) {
      window.va('event', {
        name: 'optimizely_decision',
        properties: {
          flagKey: decision.flagKey,
          variation: decision.variationKey,
          enabled: decision.enabled
        }
      });
    }
  }
  
  trackPerformance(metric: string, value: number): void {
    // Track custom metrics
    if (typeof window !== 'undefined' && window.va) {
      window.va('event', {
        name: 'custom_metric',
        properties: {
          metric,
          value
        }
      });
    }
  }
  
  // Server-side tracking
  async trackServerSide(event: AnalyticsEvent): Promise<void> {
    const response = await fetch('https://vitals.vercel-analytics.com/v1/vitals', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-vercel-id': process.env.VERCEL_URL || ''
      },
      body: JSON.stringify({
        ...event,
        deploymentId: process.env.VERCEL_DEPLOYMENT_ID,
        projectId: process.env.VERCEL_PROJECT_ID
      })
    });
    
    if (!response.ok) {
      console.error('Failed to track analytics:', response.statusText);
    }
  }
}
```

## Configuration

### Project Configuration

```json
// vercel.json
{
  "functions": {
    "api/optimizely/*.ts": {
      "runtime": "edge",
      "maxDuration": 30
    }
  },
  "env": {
    "OPTIMIZELY_SDK_KEY": "@optimizely-sdk-key",
    "EDGE_CONFIG": "@edge-config-default",
    "KV_URL": "@kv-url",
    "KV_REST_API_URL": "@kv-rest-api-url",
    "KV_REST_API_TOKEN": "@kv-rest-api-token",
    "KV_REST_API_READ_ONLY_TOKEN": "@kv-rest-api-read-only-token"
  },
  "rewrites": [
    {
      "source": "/api/optimizely/:path*",
      "destination": "/api/optimizely"
    }
  ],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "s-maxage=60, stale-while-revalidate=300"
        }
      ]
    }
  ]
}
```

### Edge Function Setup

```typescript
// api/optimizely/[...path].ts
import { createVercelHandler } from '@optimizely/edge-agent';

export const config = {
  runtime: 'edge',
  regions: ['iad1', 'sfo1', 'pdx1', 'fra1', 'arn1', 'hnd1'],
};

export default async function handler(request: Request) {
  try {
    // Create handler with environment
    const optimizelyHandler = await createVercelHandler({
      env: process.env,
      edgeConfig: process.env.EDGE_CONFIG,
      kvUrl: process.env.KV_URL
    });
    
    // Handle request
    return await optimizelyHandler.handleRequest(request);
  } catch (error) {
    console.error('Handler error:', error);
    
    return new Response(
      JSON.stringify({ error: 'Internal Server Error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
```

### Environment Variables

```bash
# .env.local (development)
OPTIMIZELY_SDK_KEY=dev_sdk_key
EDGE_CONFIG=https://edge-config.vercel.com/your-config-id
LOG_LEVEL=debug

# .env.production (production)
# Set via Vercel Dashboard or CLI
vercel env add OPTIMIZELY_SDK_KEY production
vercel env add EDGE_CONFIG production
vercel env add KV_URL production
```

## Performance Optimization

### Edge Caching

```typescript
// Intelligent caching with stale-while-revalidate
export function setCacheHeaders(response: Response, options: CacheOptions): Response {
  const headers = new Headers(response.headers);
  
  // Set cache headers based on content type
  if (options.type === 'decision') {
    // Short cache for decisions
    headers.set('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
  } else if (options.type === 'datafile') {
    // Longer cache for datafiles
    headers.set('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');
  } else {
    // Default cache
    headers.set('Cache-Control', 's-maxage=10, stale-while-revalidate=60');
  }
  
  // Add cache tags for purging
  headers.set('Cache-Tag', options.tags?.join(',') || 'optimizely');
  
  // Add timing header
  headers.set('Server-Timing', `total;dur=${options.duration}`);
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
```

### Regional Deployment

```typescript
// Configure regional deployments for low latency
export const config = {
  runtime: 'edge',
  regions: [
    'iad1',  // US East
    'sfo1',  // US West  
    'pdx1',  // US West
    'fra1',  // EU Central
    'arn1',  // EU North
    'hnd1',  // Asia
    'syd1',  // Oceania
    'gru1',  // South America
  ],
};

// Use regional data in decisions
function getRegionalConfig(region: string): RegionalConfig {
  const configs: Record<string, RegionalConfig> = {
    'iad1': { currency: 'USD', language: 'en-US' },
    'fra1': { currency: 'EUR', language: 'de-DE' },
    'hnd1': { currency: 'JPY', language: 'ja-JP' },
    // ... more regions
  };
  
  return configs[region] || { currency: 'USD', language: 'en-US' };
}
```

## Deployment

### Build Process

```bash
# Install dependencies
npm install

# Build for Vercel
npm run build:vercel

# Run locally
vercel dev

# Run production build locally
vercel build
vercel start
```

### Deployment Commands

```bash
# Deploy to preview
vercel

# Deploy to production
vercel --prod

# Deploy with specific configuration
vercel --prod --env LOG_LEVEL=warn --env CACHE_TTL=300

# Set environment variables
vercel env add OPTIMIZELY_SDK_KEY production
vercel env add EDGE_CONFIG production
vercel env pull .env.local
```

### CI/CD Pipeline

```yaml
# .github/workflows/vercel-deploy.yml
name: Deploy to Vercel

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
  VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Build
        run: npm run build:vercel
        
      - name: Run tests
        run: npm run test:vercel
        
      - name: Deploy to Vercel (Preview)
        if: github.event_name == 'pull_request'
        run: |
          npm i -g vercel
          vercel pull --yes --environment=preview --token=${{ secrets.VERCEL_TOKEN }}
          vercel build --token=${{ secrets.VERCEL_TOKEN }}
          vercel deploy --prebuilt --token=${{ secrets.VERCEL_TOKEN }}
          
      - name: Deploy to Vercel (Production)
        if: github.event_name == 'push' && github.ref == 'refs/heads/main'
        run: |
          npm i -g vercel
          vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}
          vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}
          vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }}
```

## Monitoring and Debugging

### Logging

```typescript
// Structured logging for Vercel
class VercelLogger implements ILoggerAdapter {
  private context: LogContext;
  
  constructor(request: Request) {
    this.context = {
      requestId: request.headers.get('x-vercel-id') || crypto.randomUUID(),
      deployment: process.env.VERCEL_URL,
      environment: process.env.VERCEL_ENV,
      region: process.env.VERCEL_REGION
    };
  }
  
  debug(message: string, data?: any): void {
    this.log('debug', message, data);
  }
  
  info(message: string, data?: any): void {
    this.log('info', message, data);
  }
  
  warn(message: string, data?: any): void {
    this.log('warn', message, data);
  }
  
  error(message: string, error?: Error, data?: any): void {
    this.log('error', message, {
      ...data,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
    });
  }
  
  private log(level: string, message: string, data?: any): void {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.context,
      ...data
    }));
  }
}
```

### Function Logs

```bash
# View logs
vercel logs

# View logs for specific deployment
vercel logs [deployment-url]

# Follow logs in real-time
vercel logs --follow

# Filter logs
vercel logs --filter "error"

# View logs for specific function
vercel logs --function api/optimizely
```

### Performance Monitoring

```typescript
// Monitor function performance
export async function trackPerformance(
  request: Request,
  handler: () => Promise<Response>
): Promise<Response> {
  const start = Date.now();
  const metrics: PerformanceMetrics = {
    coldStart: !globalThis.isWarm,
    region: process.env.VERCEL_REGION,
    environment: process.env.VERCEL_ENV
  };
  
  // Mark as warm for next invocation
  globalThis.isWarm = true;
  
  try {
    const response = await handler();
    metrics.duration = Date.now() - start;
    metrics.status = response.status;
    
    // Log metrics
    console.log('Performance:', JSON.stringify(metrics));
    
    // Add Server-Timing header
    const headers = new Headers(response.headers);
    headers.set('Server-Timing', `total;dur=${metrics.duration}`);
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  } catch (error) {
    metrics.duration = Date.now() - start;
    metrics.error = true;
    console.error('Performance error:', JSON.stringify(metrics));
    throw error;
  }
}
```

## Best Practices

### 1. Optimize Cold Starts

```typescript
// Pre-initialize outside handler
const initPromise = (async () => {
  // Pre-load modules
  const [edgeConfig, kv] = await Promise.all([
    import('@vercel/edge-config'),
    import('@vercel/kv')
  ]);
  
  // Pre-fetch config
  const config = await edgeConfig.getAll();
  
  return { edgeConfig, kv, config };
})();

export default async function handler(request: Request) {
  // Use pre-initialized resources
  const { config } = await initPromise;
  
  // Minimal work in handler
  return handleRequest(request, config);
}
```

### 2. Use Edge Config Wisely

```typescript
// Cache Edge Config reads
let configCache: any = null;
let configCacheTime = 0;
const CONFIG_CACHE_TTL = 60000; // 1 minute

async function getCachedConfig(): Promise<any> {
  const now = Date.now();
  
  if (configCache && now - configCacheTime < CONFIG_CACHE_TTL) {
    return configCache;
  }
  
  configCache = await getAll();
  configCacheTime = now;
  
  return configCache;
}
```

### 3. Handle Regional Differences

```typescript
// Adapt to regional requirements
function getRegionalSettings(request: Request): RegionalSettings {
  const region = process.env.VERCEL_REGION || 'iad1';
  const country = request.headers.get('x-vercel-ip-country');
  
  // GDPR compliance for EU
  if (['fra1', 'arn1', 'lhr1'].includes(region) || isEUCountry(country)) {
    return {
      privacy: 'strict',
      cookieConsent: true,
      dataRetention: 30 // days
    };
  }
  
  return {
    privacy: 'standard',
    cookieConsent: false,
    dataRetention: 90
  };
}
```

## Troubleshooting

### Common Issues

1. **Edge Config Not Found**
   ```typescript
   // Verify Edge Config connection
   try {
     const config = await get('test-key');
     console.log('Edge Config connected');
   } catch (error) {
     console.error('Edge Config error:', error);
     // Fall back to environment variables
   }
   ```

2. **KV Connection Issues**
   ```typescript
   // Test KV connection
   async function testKV(): Promise<boolean> {
     try {
       await kv.set('test', 'value', { ex: 10 });
       const value = await kv.get('test');
       return value === 'value';
     } catch (error) {
       console.error('KV test failed:', error);
       return false;
     }
   }
   ```

3. **Region-Specific Errors**
   ```typescript
   // Handle region-specific issues
   if (process.env.VERCEL_REGION === 'syd1') {
     // Sydney region specific handling
     // Might have different latency characteristics
   }
   ```

## See Also

- [Vercel Edge Functions Documentation](https://vercel.com/docs/functions/edge-functions)
- [Edge Config Documentation](https://vercel.com/docs/storage/edge-config)
- [Vercel KV Documentation](https://vercel.com/docs/storage/vercel-kv)
- [Next.js Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware)
- [Adapter Development Guide](./adapter-development.md)
- Implementation: `/src-v2/adapters/implementations/vercel/`