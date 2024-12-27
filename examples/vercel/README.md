# Optimizely Edge Agent - Vercel Example

This example demonstrates how to integrate the Optimizely Edge Agent with a Next.js application deployed on Vercel.

## Features
- Edge Middleware integration for A/B testing
- Vercel KV for user profile storage
- API routes for Optimizely event tracking
- Example feature flag implementation

## Implementation Details

### Middleware Integration
The Edge Middleware (`middleware.ts`) uses the optimizely-edge-agent's middleware handler to process incoming requests:

```typescript
import optimizelyMiddleware from '@optimizely/optimizely-edge-agent/vercel/middleware';

export async function middleware(request: NextRequest) {
  const response = await optimizelyMiddleware(request);
  return response || NextResponse.next();
}
```

### Event Tracking
The API route (`app/api/optimizely/track/route.ts`) uses the optimizely-edge-agent's function handler for event tracking:

```typescript
import optimizelyHandler from 'optimizely-edge-agent/vercel/function';

export async function POST(request: NextRequest) {
  return optimizelyHandler(request);
}
```

## Getting Started

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables:
   ```bash
   cp .env.example .env.local
   ```
4. Update `.env.local` with your Optimizely SDK Key and other configuration
5. Run the development server:
   ```bash
   npm run dev
   ```

## Configuration
Required environment variables:
- `OPTIMIZELY_SDK_KEY`: Your Optimizely SDK key

Optional KV configuration:
- `KV_URL`: Vercel KV URL
- `KV_REST_API_URL`: Vercel KV REST API URL
- `KV_REST_API_TOKEN`: Vercel KV REST API Token

## Project Structure
- `/middleware.ts` - Edge middleware configuration
- `/app/` - Next.js application routes and components
- `/app/api/optimizely/` - API routes for event tracking
