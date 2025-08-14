# CDN Adapters for Optimizely Edge Agent

This documentation explains how to use the Optimizely Edge Agent with different CDN providers.

## Overview

The Optimizely Edge Agent has been designed to work with multiple CDN environments, providing a consistent interface for feature experimentation at the edge. Currently, the following CDN adapters are supported:

1. **Cloudflare** - For Cloudflare Workers
2. **Vercel** - For Vercel Edge Functions
3. **Fastly** - For Fastly Compute@Edge

Each adapter implements the same set of interfaces, allowing the core logic to be CDN-agnostic while providing platform-specific optimizations.

## Adapter Architecture

The adapter system consists of four primary interfaces:

1. **Environment Adapter** (`IEnvironmentAdapter`) - Provides access to environment variables and execution context.
2. **Storage Adapter** (`IStorageAdapter`) - Provides a consistent interface for key-value storage operations.
3. **Request Adapter** (`IRequestAdapter`) - Normalizes HTTP request handling across platforms.
4. **Logger Adapter** (`ILoggerAdapter`) - Provides consistent logging capabilities.

Each CDN implementation includes an adapter factory that creates the appropriate adapter instances for its environment.

## Using with Cloudflare Workers

The Cloudflare adapter is the default implementation. To use it, import and use the entry point in your Cloudflare Worker script:

```js
import { handleWorkerRequest } from "./src-v2";

export default {
  async fetch(request, env, ctx) {
    return handleWorkerRequest(request, env, ctx);
  }
};
```

The Cloudflare adapter requires:
- A standard Cloudflare `Request` object
- The `env` object containing environment variables and bindings
- The `ctx` execution context

## Using with Vercel Edge Functions

To use the Optimizely Edge Agent with Vercel Edge Functions:

```js
import { handleVercelEdgeRequest } from "./src-v2/compositionRoot";

export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  // Create Vercel environment and context objects
  const vercelEnv = {
    // Environment variables and bindings
    // Example: KV_STORE: process.env.KV_STORE
  };
  
  const vercelContext = {
    // Context for handling background tasks
    waitUntil: (promise) => {
      // Vercel-specific implementation
    }
  };

  return handleVercelEdgeRequest(request, vercelEnv, vercelContext);
}
```

## Using with Fastly Compute@Edge

To use the Optimizely Edge Agent with Fastly Compute@Edge:

```js
import { handleFastlyComputeRequest } from "./src-v2/compositionRoot";

addEventListener("fetch", (event) => {
  // Create Fastly environment and context objects
  const fastlyEnv = {
    // Environment variables and bindings
  };
  
  const fastlyContext = {
    waitUntil: (promise) => {
      event.waitUntil(promise);
    }
  };

  event.respondWith(
    handleFastlyComputeRequest(event.request, fastlyEnv, fastlyContext)
  );
});
```

## Adapter Configuration

Each adapter may require specific configuration depending on the CDN provider:

### Cloudflare Configuration

Cloudflare requires a KV namespace binding named `OPTLY_HYBRID_AGENT_KV` in your `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "OPTLY_HYBRID_AGENT_KV"
id = "your-kv-namespace-id"
```

### Vercel Configuration

For Vercel, you'll need to set up environment variables and potentially KV store connections using Vercel's platform-specific methods.

### Fastly Configuration

Fastly configuration will depend on your specific Compute@Edge setup, including dictionaries or other storage mechanisms.

## Testing Adapters

Each adapter implementation can be tested in its native environment:

1. Cloudflare: Deploy to Cloudflare Workers and test with real requests
2. Vercel: Deploy to Vercel Edge Functions and test with real requests
3. Fastly: Deploy to Fastly Compute@Edge and test with real requests

For development and testing documentation, refer to:
- [Optimizely Testing Patterns](./optimizely-testing-patterns.md)
- [Test Results Documentation](./test-results.md)

## Extended Adapter Functionality

All adapters implement the core interfaces, but each may provide additional functionality specific to its environment:

- **Cloudflare**: Optimized for Workers KV and Durable Objects
- **Vercel**: Integration with Vercel KV store and project configuration
- **Fastly**: Support for Fastly's specific edge capabilities

Refer to each adapter's implementation for details on platform-specific optimizations.

## Troubleshooting

Common issues and solutions:

1. **Storage Binding Missing**: Ensure the KV namespace or equivalent storage mechanism is correctly bound
2. **Environment Variables**: Verify that required environment variables are set
3. **Request Format**: Confirm the request object matches the expected format for each platform

For more detailed troubleshooting, see [Testing Troubleshooting](./testing-troubleshooting.md).

## Future Adapter Support

The adapter system is designed to be extensible. Additional CDN providers may be supported in the future by implementing the appropriate adapter interfaces. 