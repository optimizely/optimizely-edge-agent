#!/usr/bin/env node

/**
 * @fileinfo
 * type: "utility-script"
 * purpose: "framework-update-wrapper"
 * version: "1.0"
 * status: "Active"
 * description: "Wrapper script that calls the main get-ai-workflow.js in the installer directory"
 * ai_instructions: "This is a wrapper script - the main implementation is in the installer directory"
 * related_files: ["../../AI-workflow-v2/installer/get-ai-workflow.js"]
 * dateCreated: "2025-03-20"
 * lastUpdated: "2025-03-20"
 */

/**
 * This is a wrapper script that calls the main get-ai-workflow.js in the installer directory.
 * The main implementation is maintained in the installer directory to prevent conflicts with user files.
 *
 * This wrapper exists to maintain backward compatibility for users who might run
 * the script from this location.
 */

import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

// Get the path to the current script
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Calculate the path to the installer script
// We need to look for it in the installer directory
const potentialInstallerPath = path.resolve(
  __dirname,
  "../installer/get-ai-workflow.js",
);

// Check if the installer path exists
if (fs.existsSync(potentialInstallerPath)) {
  console.log(`Running installer from: ${potentialInstallerPath}`);

  // Execute the installer script with the same arguments
  try {
    execSync(
      `node "${potentialInstallerPath}" ${process.argv.slice(2).join(" ")}`,
      {
        stdio: "inherit",
      },
    );
  } catch (error) {
    console.error("Error executing installer script:", error.message);
    process.exit(1);
  }
} else {
  console.error(
    "Error: Could not find the installer script at:",
    potentialInstallerPath,
  );
  console.error(
    "Please make sure the AI Workflow Framework is properly installed.",
  );
  process.exit(1);
}
