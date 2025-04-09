/**
 * @fileinfo
 * type: "utility-script"
 * purpose: "path-handling"
 * version: "1.0"
 * status: "Active"
 * description: "Path utilities for the AI Workflow Framework providing cross-platform path resolution"
 * ai_instructions: "Use these utilities for all path operations in the framework to ensure consistency across platforms"
 * related_files: ["./date-utils.js"]
 * functions: ["getFrameworkRoot", "getAbsolutePath", "getPlanPath"]
 * usage_examples: ["import { getAbsolutePath } from './tools/ai-tools/path-utils.js';"]
 * tags: ["utilities", "path-handling", "cross-platform"]
 * priority: "high"
 * audience: "ai-human"
 * dateCreated: "2025-03-25"
 * lastUpdated: "2025-03-25"
 */

import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import dateUtils from "./date-utils.js";

// Create ESM replacements for __dirname and __filename
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Gets the absolute path to the framework root directory
 * Works regardless of where the framework is installed
 * @returns {string} Absolute path to framework root
 */
export function getFrameworkRoot() {
  // Start from the current file's directory
  let currentDir = __dirname;

  // Navigate up to find the framework root (where package.json exists)
  while (currentDir !== path.parse(currentDir).root) {
    // Check if this is the framework root (has package.json)
    const packagePath = path.join(currentDir, "..", "..", "package.json");
    if (fs.existsSync(packagePath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
        // Verify this is our framework's package.json
        if (pkg.name === "ai-workflow") {
          return path.dirname(packagePath);
        }
      } catch (e) {
        // Continue looking if this isn't the right package.json
      }
    }

    // Move up one directory
    const parentDir = path.dirname(path.dirname(currentDir));
    if (parentDir === currentDir) {
      break; // Avoid infinite loop
    }
    currentDir = parentDir;
  }

  // If we couldn't find it, default to two directories up from this file
  // which should work in most installation scenarios
  return path.resolve(__dirname, "..", "..");
}

/**
 * Gets the workspace directory path
 * @returns {string} Absolute path to workspace directory
 */
export function getWorkspaceRoot() {
  const frameworkRoot = getFrameworkRoot();
  const workspacePath = path.join(
    path.dirname(frameworkRoot),
    "ai-workflow-workspace",
  );

  // Ensure the workspace directory exists
  if (!fs.existsSync(workspacePath)) {
    fs.mkdirSync(workspacePath, { recursive: true });
  }

  return workspacePath;
}

/**
 * Resolves a path relative to the framework root to an absolute path
 * @param {...string} pathSegments - Path segments to join
 * @returns {string} Absolute path
 */
export function getAbsolutePath(...pathSegments) {
  return path.join(getFrameworkRoot(), ...pathSegments);
}

/**
 * Resolves a path relative to the workspace root to an absolute path
 * @param {...string} pathSegments - Path segments to join
 * @returns {string} Absolute path
 */
export function getWorkspacePath(...pathSegments) {
  return path.join(getWorkspaceRoot(), ...pathSegments);
}

/**
 * Gets the absolute path to a plan directory
 * Creates the directory if it doesn't exist
 * @param {string} planName - Name of the plan
 * @param {string} [dateStr] - Optional date string (defaults to current date)
 * @returns {string} Absolute path to the plan directory
 */
export function getPlanPath(planName, dateStr) {
  // Use provided date or get current date
  const formattedDate = dateStr || dateUtils.formatDate();

  // Create plan directory name following the convention
  const planDirName = `plan-${planName
    .replace(/\s+/g, "-")
    .toLowerCase()}-${formattedDate}`;

  // Get absolute path to plans directory in workspace
  const plansDir = getWorkspacePath("plans");

  // Make sure plans directory exists
  if (!fs.existsSync(plansDir)) {
    fs.mkdirSync(plansDir, { recursive: true });
  }

  // Get absolute path to specific plan directory
  const planPath = path.join(plansDir, planDirName);

  return planPath;
}

/**
 * Gets the templates directory path in workspace
 * @returns {string} Absolute path to templates directory
 */
export function getTemplatesPath(...pathSegments) {
  return getWorkspacePath("templates", ...pathSegments);
}

// Create a default export with all functions
const pathUtils = {
  getFrameworkRoot,
  getWorkspaceRoot,
  getAbsolutePath,
  getWorkspacePath,
  getPlanPath,
  getTemplatesPath,
};

export default pathUtils;
