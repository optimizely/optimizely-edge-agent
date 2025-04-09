#!/usr/bin/env node

/**
 * @fileinfo
 * type: "utility-script"
 * purpose: "metadata-management"
 * version: "1.0"
 * status: "Active"
 * description: "Scans and updates timestamp metadata in markdown files across the framework"
 * ai_instructions: "Use this script to ensure all framework documents have correct timestamp metadata"
 * related_files: ["./ai-tools/date-utils.js", "../guidelines/framework-rules/700-date-handling.md"]
 * functions: ["updateTimestamps", "scanDirectory", "processFile"]
 * usage_examples: ["node tools/update-timestamps.js"]
 * tags: ["metadata", "timestamps", "maintenance", "documentation"]
 * priority: "high"
 * audience: "ai-human"
 * dateCreated: "2025-03-22"
 * lastUpdated: "2025-03-22"
 */

/**
 * Script to scan and update timestamps in markdown files across the framework
 *
 * This script:
 * 1. Recursively scans all markdown files in the framework
 * 2. Checks for proper timestamp metadata (dateCreated and lastUpdated)
 * 3. Updates or adds timestamp metadata where missing
 * 4. Preserves dateCreated if it exists
 * 5. Always updates lastUpdated to current date
 * 6. Provides a report of updated files
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { formatDate, getCurrentDate } from "./ai-tools/date-utils.js";

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Terminal colors for visual feedback
const COLORS = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
};

// Main function
async function updateTimestamps() {
  console.log(
    `${COLORS.bright}${COLORS.cyan}AI Workflow Framework Timestamp Updater${COLORS.reset}`,
  );

  const baseDir = path.join(__dirname, "..");
  console.log(`${COLORS.dim}Base directory: ${baseDir}${COLORS.reset}`);

  // Define markdown file extensions to process
  const markdownExtensions = [".md", ".mdx", ".mdc"];

  // Define directories to exclude
  const excludeDirs = [
    ".git",
    ".github",
    "node_modules",
    ".vscode",
    ".cursor",
    "dist",
    "build",
  ];

  const stats = {
    scanned: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    missingDateCreated: 0,
    missingLastUpdated: 0,
  };

  // Get current date for timestamp updates
  const updateMetadataDate = formatDate();

  // Scan the directories
  await scanDirectory(
    baseDir,
    markdownExtensions,
    excludeDirs,
    updateMetadataDate,
    stats,
  );

  // Print summary
  console.log(`\n${COLORS.bright}${COLORS.cyan}Summary:${COLORS.reset}`);
  console.log(`${COLORS.green}Files scanned: ${stats.scanned}${COLORS.reset}`);
  console.log(`${COLORS.green}Files updated: ${stats.updated}${COLORS.reset}`);
  console.log(`${COLORS.yellow}Files skipped: ${stats.skipped}${COLORS.reset}`);
  console.log(`${COLORS.red}Errors: ${stats.errors}${COLORS.reset}`);
  console.log(
    `${COLORS.yellow}Files missing dateCreated: ${stats.missingDateCreated}${COLORS.reset}`,
  );
  console.log(
    `${COLORS.yellow}Files missing lastUpdated: ${stats.missingLastUpdated}${COLORS.reset}`,
  );

  console.log(`\n${COLORS.green}Timestamp update complete.${COLORS.reset}`);
}

/**
 * Recursively scan directory for markdown files
 * @param {string} dirPath - Directory path to scan
 * @param {Array<string>} markdownExtensions - List of markdown file extensions
 * @param {Array<string>} excludeDirs - Directories to exclude
 * @param {Function} updateMetadataDate - Function to update metadata
 * @param {Object} stats - Statistics tracking object
 */
async function scanDirectory(
  dirPath,
  markdownExtensions,
  excludeDirs,
  updateMetadataDate,
  stats,
) {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      // Skip excluded directories
      if (entry.isDirectory() && !excludeDirs.includes(entry.name)) {
        await scanDirectory(
          fullPath,
          markdownExtensions,
          excludeDirs,
          updateMetadataDate,
          stats,
        );
      } else if (
        entry.isFile() &&
        markdownExtensions.includes(path.extname(entry.name).toLowerCase())
      ) {
        await processFile(fullPath, updateMetadataDate, stats, dirPath);
      }
    }
  } catch (error) {
    console.error(
      `${COLORS.red}Error scanning directory ${dirPath}: ${error.message}${COLORS.reset}`,
    );
    stats.errors++;
  }
}

/**
 * Process a markdown file to update timestamps
 * @param {string} filePath - Path to markdown file
 * @param {string} updateMetadataDate - Current date for timestamp update
 * @param {Object} stats - Statistics tracking object
 * @param {string} baseDir - Base directory for relative path calculation
 */
async function processFile(filePath, updateMetadataDate, stats, baseDir) {
  try {
    stats.scanned++;
    const relativePath = path.relative(baseDir, filePath);

    // Read file content
    const content = fs.readFileSync(filePath, "utf8");

    // Skip files that don't have YAML frontmatter
    if (!content.startsWith("---")) {
      console.log(
        `${COLORS.yellow}Skipping (no frontmatter): ${relativePath}${COLORS.reset}`,
      );
      stats.skipped++;
      return;
    }

    // Check if file has timestamp metadata
    const hasDateCreated = content.includes("dateCreated:");
    const hasLastUpdated = content.includes("lastUpdated:");

    // If both timestamps exist, update lastUpdated
    if (hasDateCreated && hasLastUpdated) {
      const updatedContent = updateTimestampInFile(content, updateMetadataDate);

      // Only write if content changed
      if (updatedContent !== content) {
        fs.writeFileSync(filePath, updatedContent, "utf8");
        console.log(`${COLORS.green}Updated: ${relativePath}${COLORS.reset}`);
        stats.updated++;
      } else {
        console.log(
          `${COLORS.dim}No change needed: ${relativePath}${COLORS.reset}`,
        );
      }
    }
    // If missing either timestamp, add it
    else {
      const updatedContent = updateTimestampInFile(content, updateMetadataDate);
      fs.writeFileSync(filePath, updatedContent, "utf8");
      console.log(
        `${COLORS.blue}Created timestamps: ${relativePath}${COLORS.reset}`,
      );
      stats.created++;
    }
  } catch (error) {
    console.error(
      `${COLORS.red}Error processing file ${filePath}: ${error.message}${COLORS.reset}`,
    );
    stats.errors++;
  }
}

/**
 * Update timestamp in file content
 * @param {string} content - Original file content
 * @param {string} date - Current date for timestamp update
 * @returns {string} - Updated content
 */
function updateTimestampInFile(content, date) {
  // Find the position of YAML frontmatter
  const frontmatterStart = content.indexOf("---");
  const frontmatterEnd = content.indexOf("---", frontmatterStart + 3);

  if (frontmatterStart === -1 || frontmatterEnd === -1) {
    return content; // No valid frontmatter found
  }

  const frontmatter = content.substring(frontmatterStart, frontmatterEnd + 3);
  const hasDateCreated = frontmatter.includes("dateCreated:");
  const hasLastUpdated = frontmatter.includes("lastUpdated:");

  let updatedFrontmatter = frontmatter;

  // Add or update lastUpdated
  if (hasLastUpdated) {
    updatedFrontmatter = updatedFrontmatter.replace(
      /lastUpdated: "[^"]*"/,
      `lastUpdated: "${date}"`,
    );
  } else {
    // Add before the closing --- if not present
    updatedFrontmatter = updatedFrontmatter.replace(
      /---\s*$/,
      `lastUpdated: "${date}"\n---`,
    );
  }

  // Add dateCreated if missing
  if (!hasDateCreated) {
    // Add before lastUpdated
    updatedFrontmatter = updatedFrontmatter.replace(
      /lastUpdated: "[^"]*"/,
      `dateCreated: "${date}"\nlastUpdated: "${date}"`,
    );
  }

  return content.replace(frontmatter, updatedFrontmatter);
}

// Run the main function
updateTimestamps().catch((error) => {
  console.error(`${COLORS.red}Error: ${error.message}${COLORS.reset}`);
  process.exit(1);
});
