/**
 * Combined entry point for Cloudflare Worker.
 * 
 * Serves as a replacement for the router.js to avoid dynamic imports
 * which are problematic in the Cloudflare Workers environment.
 */

// Import v1 handler
import v1Handler from './src/index.js';

// Import v2 handler directly
import { handleWorkerRequest as v2Handler } from './dist/composition/cloudflareComposition.js';

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
    
    // Force v2 routing based on wrangler.toml configuration
    // This ensures the v2 implementation is used when specified
    const target = (env.ROUTING_TARGET || '').toLowerCase() === 'v2' ? 'v2' : 'v1';

    console.log(`[Router] Routing target: ${target}`);
    
    // Log environment only when debugging
    if (env.LOG_LEVEL === 'debug') {
      // Redact sensitive information
      const safeEnv = {...env};
      delete safeEnv.ANALYTICS_ENGINE; // Remove sensitive bindings
      console.log(`[Router] Environment vars: ${JSON.stringify(safeEnv)}`);
    }

    try {
      if (target === 'v2') {
        console.log(`[Router] Using v2 handler for path: ${url.pathname}`);
        return await v2Handler(request, env, ctx);
      } else {
        // Default to v1 handler
        console.log(`[Router] Using v1 handler for path: ${url.pathname}`);
        return await v1Handler.fetch(request, env, ctx);
      }
    } catch (error) {
      console.error('[Router] Error handling request:', error);
      console.error('[Router] Error stack:', error.stack);
      
      return new Response(JSON.stringify({ 
        message: "Error handling request",
        error: error.message,
        stack: error.stack 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
}; 