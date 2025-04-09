#!/usr/bin/env node

/**
 * Temporary Files Cleanup Utility
 *
 * This utility identifies and cleans up temporary files in the .temp directory that are
 * older than a specified threshold. It supports dry-run mode, file pattern filtering,
 * and detailed logging.
 *
 * Usage:
 *   node tools/temp-cleanup.js [options]
 *
 * Options:
 *   --age <days>         Age threshold in days (default: 30)
 *   --pattern <pattern>  File pattern to include (default: *)
 *   --exclude <pattern>  File pattern to exclude (default: README.md)
 *   --dry-run            Preview without deleting (default: true)
 *   --force              Delete without confirmation
 *   --verbose            Show detailed output
 *   --help               Display this help information
 *
 * Examples:
 *   node tools/temp-cleanup.js                   # Preview files older than 30 days
 *   node tools/temp-cleanup.js --age 7 --force   # Delete files older than 7 days without prompt
 *   node tools/temp-cleanup.js --pattern "*.md"  # Only process markdown files
 *
 * Integration with AI Workflow Framework:
 *   This utility is part of the temporary files management enhancement for the
 *   AI Workflow v2 framework. See guidelines/framework-rules/750-temporary-files.md
 *   for more information on temporary file management.
 */

import { promises as fs } from "fs";
import path from "path";
import readline from "readline";
import { fileURLToPath } from "url";

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants
const DEFAULT_AGE_DAYS = 30;
const ALWAYS_PRESERVE = ["README.md"];
const TEMP_DIR = path.join(process.cwd(), "AI-workflow-v2", ".temp");

// Terminal colors for formatted output
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
  bold: "\x1b[1m",
};

// Check if color output is supported
const useColors = process.stdout.isTTY;

/**
 * Apply color to text if colors are supported
 * @param {string} text - Text to color
 * @param {string} color - Color to apply
 * @returns {string} - Colored text or original text
 */
function colorize(text, color) {
  if (!useColors || !colors[color]) return text;
  return `${colors[color]}${text}${colors.reset}`;
}

/**
 * Parse command line arguments
 * @returns {object} - Parsed options
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    age: DEFAULT_AGE_DAYS,
    pattern: "*",
    exclude: "README.md",
    dryRun: true,
    force: false,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--help") {
      showHelp();
      process.exit(0);
    } else if (arg === "--age" && args[i + 1]) {
      options.age = parseInt(args[++i], 10);
    } else if (arg === "--pattern" && args[i + 1]) {
      options.pattern = args[++i];
    } else if (arg === "--exclude" && args[i + 1]) {
      options.exclude = args[++i];
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--force") {
      options.force = true;
      options.dryRun = false;
    } else if (arg === "--verbose") {
      options.verbose = true;
    }
  }

  return options;
}

/**
 * Display help information
 */
function showHelp() {
  console.log(`
${colorize("Temporary Files Cleanup Utility", "bold")}

Usage: node tools/temp-cleanup.js [options]

Options:
  --age <days>         Age threshold in days (default: 30)
  --pattern <pattern>  File pattern to include (default: *)
  --exclude <pattern>  File pattern to exclude (default: README.md)
  --dry-run            Preview without deleting (default: true)
  --force              Delete without confirmation
  --verbose            Show detailed output
  --help               Display this help information

Examples:
  node tools/temp-cleanup.js                   # Preview files older than 30 days
  node tools/temp-cleanup.js --age 7 --force   # Delete files older than 7 days without prompt
  node tools/temp-cleanup.js --pattern "*.md"  # Only process markdown files
  `);
}

/**
 * Check if a file matches the pattern
 * @param {string} filePath - Path to the file
 * @param {string} pattern - Pattern to match
 * @returns {boolean} - Whether the file matches the pattern
 */
function matchesPattern(filePath, pattern) {
  // Simple pattern matching for now - can be enhanced with micromatch/minimatch
  if (pattern === "*") return true;

  // Basic extension matching
  if (pattern.startsWith("*.")) {
    const ext = pattern.slice(1); // get *.md -> .md
    return filePath.endsWith(ext);
  }

  return filePath.includes(pattern);
}

/**
 * Check if a file should be excluded
 * @param {string} filePath - Path to the file
 * @param {string} exclude - Pattern to exclude
 * @returns {boolean} - Whether the file should be excluded
 */
function shouldExclude(filePath, exclude) {
  const fileName = path.basename(filePath);

  // Always preserve README.md
  if (ALWAYS_PRESERVE.includes(fileName)) return true;

  // Check explicit exclude pattern
  if (exclude === fileName) return true;

  return false;
}

/**
 * Format file size for display
 * @param {number} bytes - File size in bytes
 * @returns {string} - Formatted file size
 */
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Format duration for display
 * @param {number} days - Duration in days
 * @returns {string} - Formatted duration
 */
function formatDuration(days) {
  if (days < 1) return `${Math.round(days * 24)} hours`;
  if (days === 1) return "1 day";
  if (days < 7) return `${days} days`;
  if (days < 30) return `${Math.round(days / 7)} weeks`;
  if (days < 365) return `${Math.round(days / 30)} months`;
  return `${Math.round(days / 365)} years`;
}

/**
 * Scan a directory recursively for files
 * @param {string} dir - Directory to scan
 * @param {object} options - Scan options
 * @returns {Promise<Array>} - List of files with metadata
 */
async function scanDirectory(dir, options) {
  const results = [];
  const threshold = Date.now() - options.age * 24 * 60 * 60 * 1000;

  async function scan(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        await scan(entryPath);
      } else {
        // Skip files that should be excluded
        if (shouldExclude(entryPath, options.exclude)) {
          if (options.verbose) {
            results.push({
              path: entryPath,
              preserve: true,
              reason: "Excluded by pattern",
            });
          }
          continue;
        }

        // Skip files that don't match the pattern
        if (!matchesPattern(entryPath, options.pattern)) {
          continue;
        }

        // Get file stats
        const stats = await fs.stat(entryPath);
        const modifiedDays = (Date.now() - stats.mtime) / (24 * 60 * 60 * 1000);

        // Check if file is older than threshold
        if (stats.mtime.getTime() < threshold) {
          results.push({
            path: entryPath,
            size: stats.size,
            modified: stats.mtime,
            age: modifiedDays,
            preserve: false,
          });
        } else if (options.verbose) {
          results.push({
            path: entryPath,
            size: stats.size,
            modified: stats.mtime,
            age: modifiedDays,
            preserve: true,
            reason: "Not old enough",
          });
        }
      }
    }
  }

  await scan(dir);
  return results;
}

/**
 * Display the list of files to be processed
 * @param {Array} files - List of files with metadata
 * @param {object} options - Display options
 */
function displayFileList(files, options) {
  const filesToDelete = files.filter((file) => !file.preserve);
  const filesToPreserve = files.filter((file) => file.preserve);

  console.log(colorize("\nFiles to be deleted:", "bold"));
  if (filesToDelete.length === 0) {
    console.log(colorize("  No files to delete", "gray"));
  } else {
    for (const file of filesToDelete) {
      const relativePath = path.relative(TEMP_DIR, file.path);
      const age = formatDuration(file.age);
      const size = formatSize(file.size);
      console.log(`  ${colorize(relativePath, "red")} (${age} old, ${size})`);
    }
  }

  if (options.verbose && filesToPreserve.length > 0) {
    console.log(colorize("\nFiles to preserve:", "bold"));
    for (const file of filesToPreserve) {
      const relativePath = path.relative(TEMP_DIR, file.path);
      const reason = file.reason || "Unknown reason";
      console.log(`  ${colorize(relativePath, "green")} (${reason})`);
    }
  }
}

/**
 * Display summary of the cleanup operation
 * @param {Array} files - List of files with metadata
 */
function displaySummary(files) {
  const filesToDelete = files.filter((file) => !file.preserve);
  const totalSize = filesToDelete.reduce((sum, file) => sum + file.size, 0);

  console.log(colorize("\nSummary:", "bold"));
  console.log(`  Total files scanned: ${files.length}`);
  console.log(`  Files to delete: ${filesToDelete.length}`);
  console.log(`  Space to reclaim: ${formatSize(totalSize)}`);
}

/**
 * Delete files from the list
 * @param {Array} files - List of files to delete
 * @returns {Promise<Array>} - List of deleted files
 */
async function deleteFiles(files) {
  const filesToDelete = files.filter((file) => !file.preserve);
  const deletedFiles = [];

  for (const file of filesToDelete) {
    try {
      await fs.unlink(file.path);
      deletedFiles.push(file);
      console.log(
        `  Deleted: ${colorize(path.relative(TEMP_DIR, file.path), "red")}`,
      );
    } catch (error) {
      console.error(
        `  Error deleting ${path.relative(TEMP_DIR, file.path)}: ${
          error.message
        }`,
      );
    }
  }

  return deletedFiles;
}

/**
 * Prompt for confirmation before deletion
 * @returns {Promise<boolean>} - Whether to proceed with deletion
 */
async function confirmDeletion() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(
      colorize("\nProceed with deletion? (y/N) ", "yellow"),
      (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === "y");
      },
    );
  });
}

/**
 * Main function
 */
async function main() {
  try {
    // Parse command line arguments
    const options = parseArgs();

    console.log(colorize("\nTemporary Files Cleanup Utility", "bold"));
    console.log(colorize("=================================", "bold"));
    console.log(`Directory: ${TEMP_DIR}`);
    console.log(`Age threshold: ${options.age} days`);
    console.log(`File pattern: ${options.pattern}`);
    console.log(`Exclude pattern: ${options.exclude}`);
    console.log(
      `Mode: ${
        options.dryRun
          ? colorize("DRY RUN", "yellow")
          : colorize("DELETE", "red")
      }`,
    );

    // Check if .temp directory exists
    try {
      await fs.access(TEMP_DIR);
    } catch (error) {
      console.error(
        colorize(
          `\nError: The .temp directory does not exist at ${TEMP_DIR}`,
          "red",
        ),
      );
      process.exit(1);
    }

    // Scan directory for files
    console.log(colorize("\nScanning for files...", "blue"));
    const files = await scanDirectory(TEMP_DIR, options);

    // Display file list
    displayFileList(files, options);

    // Display summary
    displaySummary(files);

    // If dry run, exit here
    if (options.dryRun) {
      console.log(
        colorize("\nDry run complete. No files were deleted.", "yellow"),
      );
      console.log(`Run with --force to actually delete the files.`);
      return;
    }

    // Get confirmation before deletion
    const filesToDelete = files.filter((file) => !file.preserve);
    if (filesToDelete.length === 0) {
      console.log(colorize("\nNo files to delete.", "green"));
      return;
    }

    let proceed = options.force;
    if (!proceed) {
      proceed = await confirmDeletion();
    }

    if (proceed) {
      console.log(colorize("\nDeleting files...", "blue"));
      const deletedFiles = await deleteFiles(filesToDelete);
      console.log(
        colorize(
          `\nCleanup complete. Deleted ${deletedFiles.length} files.`,
          "green",
        ),
      );
    } else {
      console.log(
        colorize("\nOperation cancelled. No files were deleted.", "yellow"),
      );
    }
  } catch (error) {
    console.error(colorize(`\nError: ${error.message}`, "red"));
    process.exit(1);
  }
}

// Run the main function
main();
