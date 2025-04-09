/**
 * Top-level router for Cloudflare Worker.
 *
 * Determines which implementation (v1 or v2) to route the request to based
 * on the ROUTING_TARGET environment variable.
 *
 * ROUTING_TARGET = 'v1' -> Routes to src/index.js
 * ROUTING_TARGET = 'v2' -> Routes to dist/v2/index.js (compiled from src-v2/index.ts)
 * Default: v1
 */

// Import v1 handler statically as it's plain JS
import v1Handler from './index.js';

// v2 handler needs to be imported dynamically AFTER build
// Using a dynamic import within the fetch handler itself

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Handle special case for test endpoint
    if (url.pathname === '/api/test') {
      return new Response(JSON.stringify({
        status: 'ok',
        message: 'Test endpoint is working!',
        environment: env.ENVIRONMENT || 'unknown',
        routingTarget: env.ROUTING_TARGET || 'v1',
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const target = env.ROUTING_TARGET || 'v1'; // Default to v1

    console.log(`[Router] Routing target: ${target}`);
    console.log(`[Router] Environment vars: ${JSON.stringify(env)}`);

    if (target === 'v2') {
      try {
        console.log('[Router] Trying to import v2 handler...');
        // Dynamically import the v2 handler (compiled TypeScript)
        // This assumes the build (`tsc`) has run successfully
        const v2Handler = await import('./v2/index.js');
        console.log('[Router] V2 handler imported:', v2Handler);
        
        if (v2Handler.default && typeof v2Handler.default.fetch === 'function') {
          console.log('[Router] Delegating to v2 handler...');
          return v2Handler.default.fetch(request, env, ctx);
        } else {
          console.error('[Router] Failed to load valid v2 handler from dist/v2/index.js', v2Handler);
          throw new Error('Invalid v2 handler structure.');
        }
      } catch (error) {
        console.error('[Router] Error importing or executing v2 handler:', error);
        console.error('[Router] Error stack:', error.stack);
        
        // Fallback or specific error handling?
        // For now, return a 500 error indicating v2 failure
        return new Response(JSON.stringify({ 
          message: "Failed to load V2 implementation",
          error: error.message,
          stack: error.stack 
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } else {
      // Default to v1 handler
      console.log('[Router] Delegating to v1 handler...');
      return v1Handler.fetch(request, env, ctx);
    }
  },
}; 