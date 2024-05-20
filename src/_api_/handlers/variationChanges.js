/**
 * @module VariationChanges
 */

import { logger } from '../../_helpers_/optimizelyHelper.js';

/**
 * Fetches and updates the variation changes from the Optimizely API.
 * @param {Request} request - The incoming request object.
 * @returns {Promise<Response>} - A promise that resolves to the response object.
 */
const handleVariationChanges = async (request) => {
    const baseUrl = 'https://api.optimizely.com/v2/experiments/';
    const experimentId = request.params.experiment_id;
    const bearerToken = request.params.api_token;
    const apiUrl = baseUrl + experimentId;
  
    /**
     * Processes the response from the Optimizely API.
     * @param {Response} response - The response object from the API.
     * @returns {Promise<string>} - A promise that resolves to the stringified JSON or text content.
     */
    async function processResponse(response) {
      const { headers } = response;
      const contentType = headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const data = await response.json();
        const variation = data.variations[1];
        const changes = variation.actions[0].changes;
        return JSON.stringify(changes);
      }
      return response.text();
    }
  
    const initJSON = {
      headers: {
        "content-type": "application/json;charset=UTF-8",
        "Authorization": "Bearer " + bearerToken,
      },
    };
  
    try {
      const apiResponse = await fetch(apiUrl, initJSON);
      const changes = await processResponse(apiResponse);
      await OPTLY_HYBRID_AGENT_KV.put("optly_variation_changes", changes);
  
      const headers = {
        "Access-Control-Allow-Origin": "*",
        "Content-type": "application/json; charset=UTF-8",
      };
  
      return new Response(`Variation changes updated to:\n\n${changes}`, { headers });
    } catch (error) {
      logger().error("Error in handleVariationChanges:", error);
      return new Response("Error updating variation changes", { status: 500 });
    }
  };
  
  export default handleVariationChanges;