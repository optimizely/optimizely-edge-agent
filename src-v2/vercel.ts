import { handleVercelEdgeRequest as handleRequest } from "./composition/vercelComposition";
import { VercelEnv, VercelExecutionContext } from "./adapters/implementations/vercel/VercelEnvironmentAdapter";

/**
 * Vercel Edge Function Entry Point (v2 Implementation)
 *
 * Defines the export handler for Vercel Edge Functions.
 */
export const config = {
  runtime: 'edge',
};

// Re-export handleVercelEdgeRequest for use in api/index.ts
export const handleVercelEdgeRequest = handleRequest;

export default async function handler(
  request: Request,
  env: VercelEnv, // This would be replaced with Vercel's environment context
  ctx: VercelExecutionContext // This would be replaced with Vercel's execution context
): Promise<Response> {
  // Delegate the entire request handling to the Vercel-specific composition's entry point
  return handleRequest(request, env, ctx);
} 