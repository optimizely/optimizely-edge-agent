/**
 * AI Workflow Framework - AI Tools
 *
 * This module exports AI-specific utilities for the framework.
 */

/**
 * Get all AI tools as an object
 * @returns {Promise<Object>} Object containing all AI tool modules
 */
export async function getAITools() {
  const tools = {
    tokenize: await import("./tokenize.js"),
    progressIndicators: await import("./progress-indicators.js"),
    dateUtils: await import("./date-utils.js"),
    pathUtils: await import("./path-utils.js"),
    fileUtils: await import("./file-utils.js"),
    communicationTemplates: await import("./communication-templates.js"),
    contextManager: await import("./context-manager.js"),
  };

  return tools;
}

// Individual exports for direct access
export { default as tokenize } from "./tokenize.js";
export { default as progressIndicators } from "./progress-indicators.js";
export { default as dateUtils } from "./date-utils.js";
export { default as pathUtils } from "./path-utils.js";
export { default as fileUtils } from "./file-utils.js";
export { default as communicationTemplates } from "./communication-templates.js";
export { default as contextManager } from "./context-manager.js";

// Default export for ESM
export default getAITools;
