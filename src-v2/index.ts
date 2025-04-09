import { handleWorkerRequest } from "./composition/cloudflareComposition";
import { CloudflareEnv, CloudflareExecutionContext } from "./adapters/implementations/cloudflare/CloudflareEnvironmentAdapter";

/**
 * Cloudflare Worker Entry Point (v2 Implementation)
 *
 * Listens for incoming fetch events and delegates handling to the Cloudflare-specific composition.
 */
export default {
  async fetch(
    request: Request,
    env: CloudflareEnv,
    ctx: CloudflareExecutionContext
  ): Promise<Response> {
    // Delegate the entire request handling to the Cloudflare-specific composition's entry point
    return handleWorkerRequest(request, env, ctx);
  },
}; 