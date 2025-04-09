#!/usr/bin/env node

/**
 * @fileinfo
 * type: "utility-script"
 * purpose: "metadata-creation"
 * version: "1.0"
 * status: "Active"
 * description: "Generates timestamp metadata for new files and README templates"
 * ai_instructions: "Use this script when creating new documentation files to ensure proper metadata"
 * related_files: ["./ai-tools/date-utils.js", "./update-timestamps.js"]
 * functions: ["generateTimestampMetadata"]
 * usage_examples: ["node tools/readme-timestamp-generator.js > new-file.md"]
 * tags: ["metadata", "timestamps", "documentation", "templates"]
 * priority: "medium"
 * audience: "ai-human"
 * dateCreated: "2025-03-22"
 * lastUpdated: "2025-03-22"
 */

/**
 * Script to generate timestamp metadata for new files
 *
 * Usage:
 * - Pipe output to a new file: node tools/readme-timestamp-generator.js > new-file.md
 * - Or import in another ESM file: import { generateTimestampMetadata } from './readme-timestamp-generator.js';
 */

import { fileURLToPath } from "url";
import path from "path";
import { formatDate } from "./ai-tools/date-utils.js";

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Generates timestamp metadata for a new file
 * @param {Object} options - Options for metadata generation
 * @param {string} options.type - Document type (default: "documentation")
 * @param {string} options.purpose - Document purpose (default: "guide")
 * @param {string} options.description - Document description
 * @returns {string} YAML frontmatter with timestamp metadata
 */
export function generateTimestampMetadata(options = {}) {
  const today = formatDate();

  // Default options
  const defaultOptions = {
    type: "documentation",
    purpose: "guide",
    version: "1.0",
    status: "Draft",
    description: "Document description",
    tags: ["documentation"],
    audience: "ai-human",
  };

  // Merge provided options with defaults
  const config = { ...defaultOptions, ...options };

  // Create the YAML frontmatter
  const metadata = `---
type: "${config.type}"
purpose: "${config.purpose}"
version: "${config.version}"
status: "${config.status}"
description: "${config.description}"
tags: ${
    Array.isArray(config.tags)
      ? JSON.stringify(config.tags)
      : `["${config.tags}"]`
  }
audience: "${config.audience}"
dateCreated: "${today}"
lastUpdated: "${today}"
---

# Title

Content goes here.
`;

  return metadata;
}

// Run the script if called directly
const isMainModule = import.meta.url.startsWith("file:");
if (isMainModule) {
  try {
    const metadata = generateTimestampMetadata();
    console.log(metadata);
  } catch (error) {
    console.error(`Error generating metadata: ${error.message}`);
    process.exit(1);
  }
}

// Default export for convenience
export default {
  generateTimestampMetadata,
};
