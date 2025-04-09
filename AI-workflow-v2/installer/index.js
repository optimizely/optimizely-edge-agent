#!/usr/bin/env node

/**
 * Entry point for the AI Workflow Framework V2 installer
 * This simply calls the get-ai-workflow.js script with the same arguments
 */

import { fileURLToPath } from "url";
import path from "path";
import { execSync } from "child_process";

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the get-ai-workflow.js script
const installer = path.join(__dirname, "get-ai-workflow.js");

// Pass all command line arguments to the installer script
const args = process.argv.slice(2).join(" ");

try {
  execSync(`node "${installer}" ${args}`, { stdio: "inherit" });
} catch (error) {
  console.error("Error running installer:", error.message);
  process.exit(1);
}
