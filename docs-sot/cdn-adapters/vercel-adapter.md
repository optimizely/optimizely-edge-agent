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

The Vercel storage adapter provides intelligent storage management with automatic KV detection and graceful fallback to memory storage for development.

```typescript
// From: /src-v2/adapters/implementations/vercel/VercelStorageAdapter.ts
export class VercelStorageAdapter implements IStorageAdapter {
  private kv: any;
  private memoryStore: Map<string, { value: string; expiry?: number }>;

  constructor(kvClient: any) {
    this.kv = kvClient;
    this.memoryStore = new Map();
  }

  // Storage method that works with both KV and memory
  async get(key: string, type: 'text' | 'json' | 'arrayBuffer' = 'text'): Promise<any> {
    try {
      let result: any;
      
      if (this.kv === null) {
        // Use memory store for development
        const stored = this.memoryStore.get(key);
        if (!stored) return null;
        
        // Check expiry
        if (stored.expiry && Date.now() > stored.expiry) {
          this.memoryStore.delete(key);
          return null;
        }
        
        result = stored.value;
      } else {
        // Use real Vercel KV
        result = await this.kv.get(key);
      }
      
      return this.parseResult(result, type);
    } catch (error) {
      console.error(`Error fetching key ${key}:`, error);
      return null;
    }
  }

  async put(key: string, value: any, options: StorageOptions = {}): Promise<void> {
    try {
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);

      if (this.kv === null) {
        // Use memory store for development
        const expiry = options.expirationTtl 
          ? Date.now() + (options.expirationTtl * 1000)
          : undefined;
        
        this.memoryStore.set(key, { value: stringValue, expiry });
      } else {
        // Use real Vercel KV
        const kvOptions: any = {};
        if (options.expirationTtl) {
          kvOptions.ex = options.expirationTtl; // Redis EX option for TTL
        }
        
        await this.kv.set(key, stringValue, kvOptions);
      }
    } catch (error) {
      console.error(`Error storing key ${key}:`, error);
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      if (this.kv === null) {
        this.memoryStore.delete(key);
      } else {
        await this.kv.del(key);
      }
    } catch (error) {
      console.error(`Error deleting key ${key}:`, error);
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      if (this.kv === null) {
        const stored = this.memoryStore.get(key);
        if (!stored) return false;
        
        // Check if expired
        if (stored.expiry && Date.now() > stored.expiry) {
          this.memoryStore.delete(key);
          return false;
        }
        return true;
      } else {
        const result = await this.kv.exists(key);
        return result === 1;
      }
    } catch (error) {
      console.error(`Error checking existence of key ${key}:`, error);
      return false;
    }
  }

  private parseResult(result: any, type: 'text' | 'json' | 'arrayBuffer'): any {
    if (result === null) return null;

    switch (type) {
      case 'text':
        return result;
      case 'json':
        try {
          return JSON.parse(result);
        } catch (e) {
          console.error('Error parsing JSON:', e);
          return null;
        }
      case 'arrayBuffer':
        return Buffer.from(result);
      default:
        return result;
    }
  }
}

// Factory function for creating storage adapter with automatic KV detection
export function createVercelKVAdapter(): VercelStorageAdapter {
  try {
    // Check for KV environment variables
    const kvUrl = process.env.KV_URL || process.env.KV_REST_API_URL;
    const kvToken = process.env.KV_REST_API_TOKEN;
    
    if (kvUrl && kvToken) {
      try {
        // Import and use real Vercel KV
        const { kv } = require('@vercel/kv');
        console.log('[VercelKV] Using real Vercel KV storage');
        return new VercelStorageAdapter(kv);
      } catch (importError) {
        console.warn('[VercelKV] @vercel/kv package not available, falling back to memory');
      }
    } else {
      console.log('[VercelKV] No KV credentials found, using memory storage');
    }
  } catch (error) {
    console.warn('[VercelKV] Error setting up KV, falling back to memory:', error);
  }
  
  // Fallback to memory storage
  return new VercelStorageAdapter(null);
}
```

### KV Environment Detection

The adapter factory automatically detects Vercel KV availability:

```typescript
// From: /src-v2/adapters/factories/VercelAdapterFactory.ts
export class VercelAdapterFactory {
  createStorageAdapter(bindingName: string): IStorageAdapter {
    try {
      const envAdapter = this.getEnvironmentAdapter();
      const kvUrl = envAdapter.getVariable('KV_URL') || envAdapter.getVariable('KV_REST_API_URL');
      const kvToken = envAdapter.getVariable('KV_REST_API_TOKEN');
      
      if (kvUrl && kvToken) {
        try {
          const { kv } = require('@vercel/kv');
          this.getLoggerAdapter().info('Using real Vercel KV storage');
          return new VercelStorageAdapter(kv);
        } catch (importError) {
          this.getLoggerAdapter().warn('KV credentials found but @vercel/kv package not available');
          return new VercelStorageAdapter(null);
        }
      }
      
      this.getLoggerAdapter().info('No KV credentials found, using memory storage');
      return new VercelStorageAdapter(null);
    } catch (error) {
      this.getLoggerAdapter().error('Error creating storage adapter', error as Error);
      return new VercelStorageAdapter(null);
    }
  }
}
```

### Set-Cookie Header Handling

The Vercel composition layer properly handles multiple Set-Cookie headers that would otherwise cause Edge Runtime errors:

```typescript
// From: /src-v2/composition/vercelComposition.ts
export async function handleVercelEdgeRequest(request: Request, env: VercelEnv, ctx: VercelExecutionContext): Promise<Response> {
  try {
    // ... request handling ...
    
    // Handle headers properly, especially Set-Cookie which may contain newlines
    const responseHeaders = new Headers();
    
    for (const [name, value] of Object.entries(result.headers)) {
      if (name.toLowerCase() === 'set-cookie' && value.includes('\n')) {
        // Split Set-Cookie header by newlines and append each cookie separately
        const cookieValues = value.split('\n');
        for (const cookieValue of cookieValues) {
          if (cookieValue.trim()) {
            responseHeaders.append('Set-Cookie', cookieValue.trim());
          }
        }
      } else {
        responseHeaders.set(name, value);
      }
    }
    
    return new Response(result.body, {
      status: result.status,
      headers: responseHeaders
    });
  } catch (error) {
    // Error handling...
  }
}
```

This fix ensures that multiple cookies (visitor ID and decisions) are properly formatted for Vercel Edge Runtime.

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
    "OPTIMIZELY_SDK_KEY": "@optimizely-sdk-key"
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

```json
// package.vercel.json - Vercel-specific dependencies
{
  "name": "optly-edge-agent-vercel",
  "version": "1.0.0",
  "private": true,
  "engines": {
    "node": "18.x"
  },
  "scripts": {
    "build:vercel": "tsc -p tsconfig.vercel.json",
    "deploy": "vercel deploy",
    "deploy:production": "vercel deploy --prod"
  },
  "dependencies": {
    "@optimizely/optimizely-sdk": "^5.3.4",
    "@vercel/kv": "^3.0.0",
    "@vercel/edge-config": "^1.4.0",
    "@types/uuid": "^10.0.0",
    "uuid": "^11.1.0",
    "node-fetch": "^2.6.7"
  },
  "devDependencies": {
    "@types/node": "^20.12.11",
    "@types/node-fetch": "^2.6.2",
    "@vercel/node": "^3.0.7",
    "typescript": "^5.4.5"
  }
}
```

**Note**: KV environment variables (`KV_URL`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`) are automatically managed by Vercel when you create a KV database and don't need to be manually configured in `vercel.json`.

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
LOG_LEVEL=debug

# For real KV in development (optional)
KV_URL=redis://localhost:6379  # Or actual Vercel KV URL
KV_REST_API_URL=https://kv-url.redis.vercel-storage.com
KV_REST_API_TOKEN=your-kv-token

# .env.production (production)
# Set via Vercel Dashboard or CLI
vercel env add OPTIMIZELY_SDK_KEY production
vercel env add KV_URL production                    # Automatically set when KV created
vercel env add KV_REST_API_URL production          # Automatically set when KV created  
vercel env add KV_REST_API_TOKEN production        # Automatically set when KV created
```

#### KV Environment Variables

| Variable | Purpose | Auto-Generated | Required |
|----------|---------|----------------|----------|
| `KV_URL` | Redis connection string | ✅ Yes | For real KV |
| `KV_REST_API_URL` | REST API endpoint | ✅ Yes | For real KV |
| `KV_REST_API_TOKEN` | Auth token | ✅ Yes | For real KV |
| `KV_REST_API_READ_ONLY_TOKEN` | Read-only token | ✅ Yes | Optional |

**Note**: When you create a Vercel KV database, these environment variables are automatically generated and linked to your project.

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

## Testing and QA Features

### Forced Decisions

The Vercel adapter fully supports forced decisions for testing and QA scenarios. This allows you to override normal feature flag bucketing to test specific variations.

#### Using Forced Decisions with Vercel Edge Functions

```typescript
// Example: Vercel Edge Function with forced decisions
export default async function handler(request: Request) {
  const url = new URL(request.url);
  
  // Example 1: Force variation via headers (highest precedence)
  const headers = new Headers();
  headers.set('X-Optimizely-Force-Variation', 'treatment');
  headers.set('X-Optimizely-SDK-Key', process.env.OPTIMIZELY_SDK_KEY!);
  headers.set('X-Optimizely-Enable-FEX', 'true');
  
  // Example 2: Force variation via query parameters
  const forceVariation = url.searchParams.get('forceVariation');
  if (forceVariation) {
    // Query param will be used if no header is set
  }
  
  // Example 3: Force variation in request body
  const body = {
    flagKey: 'checkout_flow',
    userId: 'test_user',
    forcedVariationKey: 'express_checkout',
    forcedRuleKey: 'experiment_123'
  };
  
  // Make decision request
  const response = await fetch(new URL('/api/decide', url.origin), {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  
  return response;
}
```

#### Testing Script for Vercel

```bash
#!/bin/bash
# Test forced decisions on Vercel deployment

VERCEL_URL="https://your-app.vercel.app"
SDK_KEY="your-sdk-key"

# Test 1: Force variation via header
echo "Testing forced variation via header..."
curl -X POST "$VERCEL_URL/api/decide" \
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
curl -X GET "$VERCEL_URL/api/decide?\
flagKey=checkout_flow&\
userId=qa_tester_001&\
forceVariation=control&\
sdkKey=$SDK_KEY" \
  -H "X-Optimizely-Enable-FEX: true"

# Test 3: Force variation via request body
echo -e "\n\nTesting forced variation via request body..."
curl -X POST "$VERCEL_URL/api/decide" \
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
curl -X POST "$VERCEL_URL/api/decide?forceVariation=query_variation" \
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

#### Next.js Middleware with Forced Decisions

```typescript
// middleware.ts - Testing variations in Next.js
import { NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  
  // Check for QA testing parameters
  const forceVariation = url.searchParams.get('_optimizely_force');
  const qaUserId = url.searchParams.get('_qa_user');
  
  if (forceVariation && qaUserId) {
    // Create decision request with forced variation
    const decisionUrl = new URL('/api/decide', request.url);
    const response = await fetch(decisionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Optimizely-Enable-FEX': 'true',
        'X-Optimizely-SDK-Key': process.env.OPTIMIZELY_SDK_KEY!,
        'X-Optimizely-Force-Variation': forceVariation
      },
      body: JSON.stringify({
        flagKey: 'homepage_redesign',
        userId: qaUserId
      })
    });
    
    const decision = await response.json();
    
    // Route to test variation
    if (decision.variationKey) {
      url.pathname = `/test/${decision.variationKey}${url.pathname}`;
      return NextResponse.rewrite(url);
    }
  }
  
  return NextResponse.next();
}
```

#### QA Dashboard Component

```typescript
// app/qa-dashboard/page.tsx
'use client';

import { useState } from 'react';

export default function QADashboard() {
  const [userId, setUserId] = useState('qa_tester_001');
  const [flagKey, setFlagKey] = useState('checkout_flow');
  const [variation, setVariation] = useState('treatment');
  const [result, setResult] = useState<any>(null);
  
  const testForcedDecision = async () => {
    const response = await fetch('/api/decide', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Optimizely-Enable-FEX': 'true',
        'X-Optimizely-Force-Variation': variation
      },
      body: JSON.stringify({ flagKey, userId })
    });
    
    const decision = await response.json();
    setResult(decision);
  };
  
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">QA Testing Dashboard</h1>
      
      <div className="space-y-4">
        <input
          type="text"
          placeholder="User ID"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="border p-2"
        />
        
        <input
          type="text"
          placeholder="Flag Key"
          value={flagKey}
          onChange={(e) => setFlagKey(e.target.value)}
          className="border p-2"
        />
        
        <select
          value={variation}
          onChange={(e) => setVariation(e.target.value)}
          className="border p-2"
        >
          <option value="control">Control</option>
          <option value="treatment">Treatment</option>
          <option value="variant_a">Variant A</option>
          <option value="variant_b">Variant B</option>
        </select>
        
        <button
          onClick={testForcedDecision}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Test Forced Decision
        </button>
        
        {result && (
          <pre className="bg-gray-100 p-4 rounded">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
```

#### Environment-Based Force Decisions

```typescript
// Use Edge Config for QA overrides
import { get } from '@vercel/edge-config';

async function getQAOverrides(userId: string): Promise<Record<string, string>> {
  // Check Edge Config for QA overrides
  const overrides = await get<Record<string, any>>(`qa_overrides_${userId}`);
  return overrides || {};
}

export async function applyQAOverrides(
  request: Request,
  userId: string
): Promise<Request> {
  const overrides = await getQAOverrides(userId);
  
  if (Object.keys(overrides).length > 0) {
    const headers = new Headers(request.headers);
    
    // Apply first override as forced variation
    const [flagKey, variation] = Object.entries(overrides)[0];
    headers.set('X-Optimizely-Force-Variation', variation);
    
    return new Request(request, { headers });
  }
  
  return request;
}
```

#### Automated Testing

```typescript
// __tests__/forced-decisions.test.ts
import { describe, test, expect } from 'vitest';

describe('Vercel Forced Decisions', () => {
  const baseUrl = process.env.VERCEL_URL || 'http://localhost:3000';
  
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
  
  test('should apply forced decisions in middleware', async () => {
    const response = await fetch(
      `${baseUrl}/test-page?_optimizely_force=treatment&_qa_user=test123`
    );
    
    // Check that we were routed to treatment variation
    expect(response.headers.get('x-middleware-rewrite')).toContain('/test/treatment');
  });
});
```

## See Also

- [Vercel Edge Functions Documentation](https://vercel.com/docs/functions/edge-functions)
- [Edge Config Documentation](https://vercel.com/docs/storage/edge-config)
- [Vercel KV Documentation](https://vercel.com/docs/storage/vercel-kv)
- [Next.js Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware)
- [API Decision Endpoints](../api/decisions/decide.md)
- [Adapter Development Guide](./adapter-development.md)
- Implementation: `/src-v2/adapters/implementations/vercel/`