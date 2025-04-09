/**
 * AI Workflow Framework Tools
 *
 * This module exports all framework tools with ES Modules.
 */

/**
 * Get all tools as an object
 * @returns {Promise<Object>} Object containing all tool modules
 */
export async function getTools() {
  const tools = {
    copyRulesToCursor: await import("./copy-rules-to-cursor.js"),
    tempCleanup: await import("./temp-cleanup.js"),
    updateTimestamps: await import("./update-timestamps.js"),
    readmeTimestampGenerator: await import("./readme-timestamp-generator.js"),
    convertRules: await import("./convert-rules.js"),
    getAIWorkflow: await import("./get-ai-workflow.js"),
  };

  return tools;
}

// Default export for ESM
export default getTools;

// Individual exports for direct access
export { default as copyRulesToCursor } from "./copy-rules-to-cursor.js";
export { default as tempCleanup } from "./temp-cleanup.js";
export { default as updateTimestamps } from "./update-timestamps.js";
export { default as readmeTimestampGenerator } from "./readme-timestamp-generator.js";
export { default as convertRules } from "./convert-rules.js";
export { default as getAIWorkflow } from "./get-ai-workflow.js";
