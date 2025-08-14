import { handleFastlyComputeRequest } from "./composition/fastlyComposition";
import { FastlyEnv, FastlyExecutionContext } from "./adapters/implementations/fastly/FastlyEnvironmentAdapter";

/**
 * Fastly Compute@Edge Entry Point (v2 Implementation)
 *
 * This is the main entry point for Fastly Compute@Edge.
 */
addEventListener("fetch", (event) => {
  // Create an execution context for Fastly
  const fastlyContext = {
    waitUntil: (promise) => {
      // Fastly may have different ways of handling background tasks
      // This is a placeholder implementation
      event.waitUntil(promise);
    }
  };

  // Create an environment object for Fastly
  // This would need to be populated with actual Fastly environment variables and bindings
  const fastlyEnv = {
    // Populate with environment variables and bindings
  };

  // Handle the request using our Fastly-specific composition
  event.respondWith(
    handleFastlyComputeRequest(event.request, fastlyEnv, fastlyContext)
  );
}); 