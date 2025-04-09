#!/usr/bin/env node

/**
 * Script to download and update AI Workflow V2 framework files
 * Clones the repository and sets up the project structure with support for force refresh, verbose, and update modes
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import os from "os";
import { fileURLToPath, pathToFileURL } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Terminal colors and symbols
const COLORS = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
};

const SYMBOLS = {
  success: "✓",
  error: "✗",
  warning: "⚠",
  info: "ℹ",
  add: "➕",
  start: "▶",
  complete: "✅",
  debug: "🔍",
  progress: "⏳",
};

// Logger implementation
const log = {
  info: (message) =>
    console.log(`${COLORS.blue}${SYMBOLS.info} ${COLORS.reset}${message}`),
  success: (message) =>
    console.log(`${COLORS.green}${SYMBOLS.success} ${COLORS.reset}${message}`),
  warning: (message) =>
    console.log(`${COLORS.yellow}${SYMBOLS.warning} ${COLORS.reset}${message}`),
  error: (message) =>
    console.error(`${COLORS.red}${SYMBOLS.error} ${COLORS.reset}${message}`),
  title: (message) =>
    console.log(
      `\n${COLORS.bright}${COLORS.cyan}${message}${COLORS.reset}\n${
        COLORS.dim
      }${"=".repeat(message.length)}${COLORS.reset}\n`,
    ),
  add: (message) =>
    console.log(`${COLORS.green}${SYMBOLS.add} ${COLORS.reset}${message}`),
  debug: (message) => {
    if (verbose)
      console.log(
        `${COLORS.magenta}${SYMBOLS.debug} ${COLORS.dim}${message}${COLORS.reset}`,
      );
  },
  startOperation: (message) => {
    if (verbose)
      console.log(
        `\n${COLORS.cyan}${SYMBOLS.start} ${COLORS.bright}STARTED: ${message}${COLORS.reset}`,
      );
  },
  completeOperation: (message) => {
    if (verbose)
      console.log(
        `${COLORS.green}${SYMBOLS.complete} ${COLORS.bright}COMPLETED: ${message}${COLORS.reset}\n`,
      );
  },
  progress: (message) => {
    if (verbose)
      console.log(
        `${COLORS.yellow}${SYMBOLS.progress} ${COLORS.reset}${message}`,
      );
  },
};

// Configuration
const REPO_URL = "https://github.com/sjhernandez/ai-workflow.git";
const REPO_BRANCH = "v3";
const TEMP_CLONE_DIR = path.join(os.tmpdir(), `ai-workflow-temp-${Date.now()}`);

// Parse command-line flags
const forceRefresh =
  process.argv.includes("--force-refresh") || process.argv.includes("-f");
const verbose =
  process.argv.includes("--verbose") || process.argv.includes("-v");
const update = process.argv.includes("--update") || process.argv.includes("-u");

// Enhance the import.meta checks with detailed path diagnostics
function logPathDetails(title, pathToLog) {
  if (!verbose) return;

  console.log(
    `\n${COLORS.cyan}${SYMBOLS.debug} ${COLORS.bright}PATH DETAILS: ${title}${COLORS.reset}`,
  );
  try {
    console.log(`${COLORS.dim}Raw path: ${pathToLog}${COLORS.reset}`);
    console.log(
      `${COLORS.dim}Resolved: ${path.resolve(pathToLog)}${COLORS.reset}`,
    );
    console.log(
      `${COLORS.dim}Normalized: ${path.normalize(pathToLog)}${COLORS.reset}`,
    );
    console.log(
      `${COLORS.dim}Is absolute: ${path.isAbsolute(pathToLog)}${COLORS.reset}`,
    );
    console.log(
      `${COLORS.dim}Directory: ${path.dirname(pathToLog)}${COLORS.reset}`,
    );
    console.log(
      `${COLORS.dim}Basename: ${path.basename(pathToLog)}${COLORS.reset}`,
    );
    console.log(
      `${COLORS.dim}Extension: ${path.extname(pathToLog)}${COLORS.reset}`,
    );

    const fileUrl = pathToFileURL(pathToLog).href;
    console.log(`${COLORS.dim}As file URL: ${fileUrl}${COLORS.reset}`);

    // Check file/directory existence
    const exists = fs.existsSync(pathToLog);
    console.log(`${COLORS.dim}Exists: ${exists}${COLORS.reset}`);

    if (exists) {
      const stats = fs.statSync(pathToLog);
      console.log(
        `${COLORS.dim}Is directory: ${stats.isDirectory()}${COLORS.reset}`,
      );
      console.log(`${COLORS.dim}Is file: ${stats.isFile()}${COLORS.reset}`);
      console.log(`${COLORS.dim}Size: ${stats.size} bytes${COLORS.reset}`);
      console.log(
        `${COLORS.dim}Permissions: ${stats.mode.toString(8)}${COLORS.reset}`,
      );
      console.log(`${COLORS.dim}Last modified: ${stats.mtime}${COLORS.reset}`);
    }
  } catch (error) {
    console.log(
      `${COLORS.red}Error analyzing path: ${error.message}${COLORS.reset}`,
    );
  }
  console.log("");
}

// Add platform-specific info right after the verbose flag detection
if (verbose) {
  log.debug("=== DETAILED ENVIRONMENT INFORMATION ===");
  log.debug(`Node.js version: ${process.version}`);
  log.debug(`Platform: ${process.platform} (${os.platform()} ${os.release()})`);
  log.debug(`Architecture: ${process.arch}`);
  log.debug(`Process ID: ${process.pid}`);
  log.debug(`Working directory: ${process.cwd()}`);
  log.debug(`Script path: ${__filename}`);
  log.debug(`Script directory: ${__dirname}`);
  log.debug(`Command arguments: ${JSON.stringify(process.argv)}`);
  log.debug(`Temp directory: ${os.tmpdir()}`);
  log.debug(`Home directory: ${os.homedir()}`);
  log.debug(`OS type: ${os.type()}`);
  log.debug(`OS platform: ${os.platform()}`);
  log.debug(`OS release: ${os.release()}`);
  log.debug(`Path separator: ${path.sep}`);
  log.debug(`Path delimiter: ${path.delimiter}`);
  log.debug(`Line ending: ${JSON.stringify(os.EOL)}`);
  log.debug(`Import meta URL: ${import.meta.url}`);
  log.debug(`Package type: ${process.env.npm_package_type || "unknown"}`);
  log.debug("=======================================");

  logPathDetails("Current script", __filename);
  logPathDetails("Current directory", __dirname);
  logPathDetails("Working directory", process.cwd());
  logPathDetails("Temp directory", os.tmpdir());
  logPathDetails("Temp clone directory", TEMP_CLONE_DIR);
}

// Enhance the findRepoRoot function with better path diagnostics
function findRepoRoot() {
  log.startOperation("Finding Git repository root");

  let currentDir = process.cwd();
  log.debug(`Starting repository search from: ${currentDir}`);
  logPathDetails("Starting directory", currentDir);

  let steps = 0;
  const maxSteps = 10; // Safety limit for deep directory traversal

  while (currentDir !== path.parse(currentDir).root && steps < maxSteps) {
    const gitDir = path.join(currentDir, ".git");
    log.debug(`Checking for .git directory at: ${gitDir}`);

    if (fs.existsSync(gitDir)) {
      if (verbose) {
        log.info(`Git repository root found at: ${currentDir}`);
        log.debug(`Identified by presence of .git directory: ${gitDir}`);
        logPathDetails("Repository root", currentDir);
        log.debug(
          `Git directory stats: ${JSON.stringify(fs.statSync(gitDir))}`,
        );
      }
      log.completeOperation("Repository root detection");
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);
    if (verbose) {
      log.debug(
        `No .git directory in ${currentDir}, moving up to ${parentDir}`,
      );

      // Detect potential path resolution issues
      if (parentDir === currentDir) {
        log.warning(
          `Path resolution issue: dirname(${currentDir}) returned the same path`,
        );
      }
    }

    currentDir = parentDir;
    steps++;
  }

  if (steps >= maxSteps) {
    log.warning(`Reached maximum directory traversal steps (${maxSteps})`);
  }

  log.warning("No Git repository found. Using current directory.");
  log.debug(`Current directory: ${process.cwd()}`);
  logPathDetails("Fallback directory", process.cwd());

  log.completeOperation("Repository root detection");
  return process.cwd();
}

// Enhance getAllFiles function with more debug info
function getAllFiles(dir, files = [], depth = 0) {
  const maxDepth = 50; // Increased safety limit for recursion depth for deeply nested directories

  if (depth > maxDepth) {
    if (verbose)
      log.warning(`Reached maximum recursion depth (${maxDepth}) at ${dir}`);
    return files;
  }

  if (!fs.existsSync(dir)) {
    if (verbose) log.debug(`Directory does not exist: ${dir}`);
    return files;
  }

  if (verbose) {
    log.debug(`Scanning directory: ${dir} (depth: ${depth})`);
    if (depth === 0) logPathDetails("Root scan directory", dir);
  }

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    if (verbose && depth === 0)
      log.debug(`Found ${entries.length} entries in root directory`);

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (verbose && (depth === 0 || depth === 1)) {
          log.debug(`Found subdirectory: ${entry.name} at ${fullPath}`);
        }

        // Special debug information for nested directories to help troubleshoot
        if (
          entry.name === "extensions" ||
          entry.name === "repository-profiles" ||
          entry.name === "custom-rules"
        ) {
          if (verbose) {
            log.debug(
              `IMPORTANT DIRECTORY FOUND: ${entry.name} at ${fullPath}`,
            );
            try {
              const subdirEntries = fs.readdirSync(fullPath);
              log.debug(
                `Contents of ${entry.name}: ${subdirEntries.join(", ")}`,
              );
            } catch (err) {
              log.debug(`Error reading directory contents: ${err.message}`);
            }
          }
        }

        // Process subdirectory recursively
        getAllFiles(fullPath, files, depth + 1);
      } else {
        files.push(fullPath);
        if (verbose && files.length % 100 === 0) {
          log.debug(
            `File scan progress: ${files.length} files found so far...`,
          );
        }
      }
    }
  } catch (error) {
    if (verbose) {
      log.error(`Error reading directory ${dir}: ${error.message}`);
      log.debug(`Error stack: ${error.stack}`);
    }
  }

  return files;
}

// Copy AI-workflow-v2 to root
function copyAIWorkflowV2(sourceDir, repoRoot) {
  const sourcePath = path.join(sourceDir, "AI-workflow-v2");
  const destPath = path.join(repoRoot, "AI-workflow-v2");

  log.title("Copying AI-workflow-v2 to Project Root");
  log.startOperation("Preparing AI-workflow-v2 copy operation");

  logPathDetails("Source directory", sourcePath);
  logPathDetails("Destination directory", destPath);

  if (verbose) {
    log.info(`Source path: ${sourcePath}`);
    log.info(`Destination path: ${destPath}`);
    log.debug(`Repository root: ${repoRoot}`);
    log.debug(
      `Source directory size: ${
        fs.existsSync(sourcePath)
          ? fs.readdirSync(sourcePath).length + " items"
          : "not found"
      }`,
    );
    log.debug(`Destination exists: ${fs.existsSync(destPath)}`);

    // Check if source path is accessible
    try {
      const sourceStat = fs.existsSync(sourcePath)
        ? fs.statSync(sourcePath)
        : null;
      log.debug(
        `Source path stats: ${
          sourceStat ? JSON.stringify(sourceStat) : "path doesn't exist"
        }`,
      );
    } catch (error) {
      log.debug(`Error accessing source path: ${error.message}`);
    }

    // Check if destination path is accessible
    try {
      const destStat = fs.existsSync(destPath) ? fs.statSync(destPath) : null;
      log.debug(
        `Destination path stats: ${
          destStat ? JSON.stringify(destStat) : "path doesn't exist"
        }`,
      );
    } catch (error) {
      log.debug(`Error accessing destination path: ${error.message}`);
    }
  }

  if (!fs.existsSync(sourcePath)) {
    log.error(`Source AI-workflow-v2 not found at: ${sourcePath}`);
    log.debug(`Absolute path: ${path.resolve(sourcePath)}`);
    log.debug(`Path as URL: ${pathToFileURL(sourcePath).href}`);

    // Check parent directory contents
    const parentDir = path.dirname(sourcePath);
    log.debug(`Parent directory: ${parentDir}`);
    if (fs.existsSync(parentDir)) {
      try {
        const parentContents = fs.readdirSync(parentDir);
        log.debug(`Parent directory contents: ${parentContents.join(", ")}`);

        // Check if maybe case sensitivity is the issue
        const lowerCaseMatch = parentContents.find(
          (item) => item.toLowerCase() === "ai-workflow-v2",
        );
        if (lowerCaseMatch && lowerCaseMatch !== "AI-workflow-v2") {
          log.debug(
            `Found possible case mismatch: ${lowerCaseMatch} instead of AI-workflow-v2`,
          );
        }
      } catch (error) {
        log.debug(`Error reading parent directory: ${error.message}`);
      }
    } else {
      log.debug(`Parent directory does not exist`);
    }

    log.completeOperation("AI-workflow-v2 copy preparation (failed)");
    return false;
  }

  // Handle force refresh
  if (forceRefresh && fs.existsSync(destPath)) {
    log.warning(
      `Force refresh: removing existing AI-workflow-v2 at ${destPath}`,
    );
    log.debug(`Deleting directory: ${destPath}`);
    fs.rmSync(destPath, { recursive: true, force: true });
    log.debug(`Deletion completed successfully`);
  }

  log.completeOperation("AI-workflow-v2 copy preparation");

  const isCleanInstall = !fs.existsSync(destPath);
  log.startOperation(
    `${isCleanInstall ? "Full installation" : "Update"} of AI-workflow-v2`,
  );

  log.progress("Scanning source files...");
  const files = getAllFiles(sourcePath);
  log.debug(`Found ${files.length} files to process`);

  let copyCount = 0;
  let preservedCount = 0;

  if (isCleanInstall) {
    log.info("No existing AI-workflow-v2 found - performing full copy");
    log.debug(`Creating directory: ${destPath}`);
    fs.mkdirSync(destPath, { recursive: true });

    let processedCount = 0;
    const totalFiles = files.length;

    files.forEach((file) => {
      try {
        const relativePath = path.relative(sourcePath, file);
        const destFile = path.join(destPath, relativePath);
        const destDir = path.dirname(destFile);

        processedCount++;

        // More verbose logging
        if ((verbose && processedCount % 100 === 0) || processedCount < 5) {
          log.debug(
            `Processing file ${processedCount}/${totalFiles}: ${relativePath}`,
          );
          log.debug(`  Source: ${file}`);
          log.debug(`  Destination: ${destFile}`);
          log.debug(`  Destination dir: ${destDir}`);
        }

        if (!fs.existsSync(destDir)) {
          try {
            fs.mkdirSync(destDir, { recursive: true });
            if (verbose && processedCount < 5)
              log.debug(`  Created directory: ${destDir}`);
          } catch (dirError) {
            log.error(
              `Failed to create directory ${destDir}: ${dirError.message}`,
            );
            throw dirError;
          }
        }

        try {
          fs.copyFileSync(file, destFile);
          if (verbose) log.add(`Copied: ${relativePath}`);
          copyCount++;
        } catch (copyError) {
          log.error(
            `Failed to copy ${file} to ${destFile}: ${copyError.message}`,
          );
          throw copyError;
        }
      } catch (error) {
        log.error(`Error processing file: ${error.message}`);
        if (verbose) log.debug(`Error stack: ${error.stack}`);
      }
    });
    log.success(`Copied ${copyCount} files to ${destPath}`);
  } else {
    log.info(
      update
        ? "Updating existing AI-workflow-v2"
        : "Performing non-destructive update",
    );

    let processedCount = 0;
    const totalFiles = files.length;

    files.forEach((file) => {
      const relativePath = path.relative(sourcePath, file);
      const destFile = path.join(destPath, relativePath);
      const destDir = path.dirname(destFile);

      processedCount++;
      if (verbose && processedCount % 20 === 0) {
        log.progress(`Processing files... (${processedCount}/${totalFiles})`);
      }

      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      if (!fs.existsSync(destFile) || update) {
        fs.copyFileSync(file, destFile);
        if (verbose)
          log.add(
            update ? `Updated: ${relativePath}` : `Added: ${relativePath}`,
          );
        copyCount++;
      } else if (verbose) {
        log.info(`Preserved: ${relativePath}`);
        preservedCount++;
      }
    });
    log.success(
      `Update complete: ${copyCount} files ${
        update ? "updated" : "added"
      }, ${preservedCount} preserved`,
    );
  }

  log.completeOperation(
    `AI-workflow-v2 ${isCleanInstall ? "installation" : "update"}`,
  );
  return true;
}

// Copy workspace contents
function copyWorkspaceToRoot(sourceDir, repoRoot) {
  const sourceWorkspacePath = path.join(
    sourceDir,
    "AI-workflow-v2",
    "ai-workflow-workspace",
  );
  const destWorkspacePath = path.join(repoRoot, "ai-workflow-workspace");

  log.title("Copying ai-workflow-workspace to Project Root");
  log.startOperation("Preparing ai-workflow-workspace copy operation");

  if (verbose) {
    log.info(`Source path: ${sourceWorkspacePath}`);
    log.info(`Destination path: ${destWorkspacePath}`);
    log.debug(
      `Source directory size: ${
        fs.existsSync(sourceWorkspacePath)
          ? fs.readdirSync(sourceWorkspacePath).length + " items"
          : "not found"
      }`,
    );
    log.debug(`Destination exists: ${fs.existsSync(destWorkspacePath)}`);
  }

  if (!fs.existsSync(sourceWorkspacePath)) {
    log.error(`Source workspace not found at: ${sourceWorkspacePath}`);
    log.debug(
      `Directory contents of ${path.dirname(sourceWorkspacePath)}: ${
        fs.existsSync(path.dirname(sourceWorkspacePath))
          ? fs.readdirSync(path.dirname(sourceWorkspacePath)).join(", ")
          : "parent directory not found"
      }`,
    );
    log.completeOperation("ai-workflow-workspace copy preparation (failed)");
    return false;
  }

  // Handle force refresh - MODIFIED to preserve custom user content
  if (forceRefresh && fs.existsSync(destWorkspacePath)) {
    log.warning(
      `Force refresh requested for workspace at ${destWorkspacePath}`,
    );

    // Instead of deleting the entire directory, selectively delete only framework files
    // but preserve custom user content in important directories
    const defaultFiles = [
      "README.md",
      "plans/README.md",
      "plans/plan-registry.md",
      "plans/implementation-log.md",
      "archives/README.md",
      "examples/README.md",
      "outputs/README.md",
      "temp/README.md",
      "temp/temp-cleanup-spec.md",
      "extensions/README.md",
      "extensions/custom-rules/README.md",
      "extensions/custom-rules/rule-template.md",
      "extensions/integration-points/README.md",
      "extensions/integration-points/integration-template.md",
      "extensions/repository-profiles/README.md",
      "extensions/repository-profiles/profile-template.md",
    ];

    // Delete only the framework files, not custom user content
    log.debug(
      `Selectively removing framework files while preserving custom content`,
    );

    // First ensure the base directory exists
    if (!fs.existsSync(destWorkspacePath)) {
      fs.mkdirSync(destWorkspacePath, { recursive: true });
    }

    // Process each default file
    let deletedCount = 0;
    defaultFiles.forEach((filePath) => {
      const fullPath = path.join(destWorkspacePath, filePath);
      // Only delete if it's a default file
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        if (verbose) log.debug(`Removing default file: ${filePath}`);
        try {
          fs.unlinkSync(fullPath);
          deletedCount++;
        } catch (err) {
          log.debug(`Error removing ${filePath}: ${err.message}`);
        }
      }

      // Ensure the directory exists for the new file
      const dirPath = path.dirname(fullPath);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    });

    log.debug(
      `Removed ${deletedCount} default framework files while preserving custom content`,
    );
    log.warning(
      `Force refresh completed: Custom content in workspace directories has been PRESERVED`,
    );
  }

  log.completeOperation("ai-workflow-workspace copy preparation");

  const isCleanInstall = !fs.existsSync(destWorkspacePath);
  log.startOperation(
    `${
      isCleanInstall ? "Full installation" : "Update"
    } of ai-workflow-workspace`,
  );

  // IMPORTANT: Display very clear warning about update mode and its risks
  if (update && !isCleanInstall) {
    log.warning("⚠️ !!! IMPORTANT WARNING !!! ⚠️");
    log.warning(
      "--update flag detected: This will OVERWRITE existing workspace files!",
    );
    log.warning(
      "Your custom files in ai-workflow-workspace may be REPLACED without recovery option.",
    );
    log.warning(
      "----------------------------------------------------------------",
    );
    log.warning("If you want to preserve your existing files:");
    log.warning("1. Press Ctrl+C NOW to abort");
    log.warning("2. Run WITHOUT the --update flag to only add new files");
    log.warning(
      "----------------------------------------------------------------",
    );

    // Always pause for 5 seconds to give user time to abort
    log.warning(
      "Waiting 5 seconds before continuing... Press Ctrl+C to abort immediately.",
    );
    try {
      execSync("sleep 5", { stdio: "inherit" });
    } catch (e) {
      // Handle Windows which doesn't have sleep
      const startTime = Date.now();
      while (Date.now() - startTime < 5000) {
        // Wait for 5 seconds
      }
    }
  }

  log.progress("Scanning workspace files...");
  const files = getAllFiles(sourceWorkspacePath);
  log.debug(`Found ${files.length} files to process`);

  let copyCount = 0;
  let preservedCount = 0;
  let skippedCount = 0;

  if (isCleanInstall) {
    log.info("No existing workspace found - performing full copy");
    log.debug(`Creating directory: ${destWorkspacePath}`);
    fs.mkdirSync(destWorkspacePath, { recursive: true });

    let processedCount = 0;
    const totalFiles = files.length;

    files.forEach((file) => {
      const relativePath = path.relative(sourceWorkspacePath, file);
      const destFile = path.join(destWorkspacePath, relativePath);
      const destDir = path.dirname(destFile);

      processedCount++;
      if (verbose && processedCount % 20 === 0) {
        log.progress(
          `Copying workspace files... (${processedCount}/${totalFiles})`,
        );
      }

      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      fs.copyFileSync(file, destFile);
      if (verbose) log.add(`Copied: ${relativePath}`);
      copyCount++;
    });
    log.success(`Copied ${copyCount} files to ${destWorkspacePath}`);
  } else {
    // Much clearer message about what will happen
    if (update) {
      log.info(
        "Update mode: New files will be added and existing files will be OVERWRITTEN",
      );
    } else {
      log.info(
        "✓ NON-DESTRUCTIVE MODE: Only new files will be added, ALL existing customer files will be preserved",
      );
    }

    let processedCount = 0;
    const totalFiles = files.length;

    // Create base directory if it doesn't exist
    if (!fs.existsSync(destWorkspacePath)) {
      fs.mkdirSync(destWorkspacePath, { recursive: true });
    }

    // Detect and log user-modified directories for extra protection
    const userImportantDirs = [
      "extensions/repository-profiles",
      "extensions/custom-rules",
      "plans",
    ];

    let userCustomDirectories = [];

    // Check for custom content in important directories
    userImportantDirs.forEach((dirPath) => {
      const fullPath = path.join(destWorkspacePath, dirPath);
      if (fs.existsSync(fullPath)) {
        try {
          // If this directory has content beyond the default files, consider it user-modified
          const dirContents = fs.readdirSync(fullPath);
          const hasCustomContent = dirContents.some((item) => {
            // Check if this is not a default item from the framework
            const itemPath = path.join(fullPath, item);
            if (fs.statSync(itemPath).isDirectory()) {
              // Any subdirectory is considered custom content
              userCustomDirectories.push(path.join(dirPath, item));
              return true;
            }
            // For special directories, consider anything not README.md or template files
            if (
              dirPath.includes("repository-profiles") ||
              dirPath.includes("custom-rules")
            ) {
              if (item !== "README.md" && !item.includes("template")) {
                return true;
              }
            }
            return false;
          });

          if (hasCustomContent && verbose) {
            log.info(
              `🔒 Detected custom user content in ${dirPath} - This will be preserved`,
            );
          }
        } catch (err) {
          if (verbose)
            log.debug(`Error checking directory ${dirPath}: ${err.message}`);
        }
      }
    });

    if (userCustomDirectories.length > 0 && verbose) {
      log.info(
        `🔒 Found ${userCustomDirectories.length} custom directories that will be protected:`,
      );
      userCustomDirectories.forEach((dir) => {
        log.info(`   - ${dir}`);
      });
    }

    files.forEach((file) => {
      const relativePath = path.relative(sourceWorkspacePath, file);
      const destFile = path.join(destWorkspacePath, relativePath);
      const destDir = path.dirname(destFile);

      processedCount++;
      if (verbose && processedCount % 20 === 0) {
        log.progress(
          `Processing workspace files... (${processedCount}/${totalFiles})`,
        );
      }

      // Special protection for user custom directories
      let isProtectedUserContent = false;
      for (const userDir of userCustomDirectories) {
        if (relativePath.startsWith(userDir)) {
          isProtectedUserContent = true;
          break;
        }
      }

      // Create directory structure if needed, but don't overwrite existing directories
      if (!fs.existsSync(destDir)) {
        try {
          fs.mkdirSync(destDir, { recursive: true });
          if (verbose) log.debug(`Created directory: ${destDir}`);
        } catch (dirError) {
          if (dirError.code !== "EEXIST") {
            log.error(
              `Failed to create directory ${destDir}: ${dirError.message}`,
            );
          }
        }
      }

      // CRITICAL FIX: Always check if the file exists before deciding what to do
      const fileExists = fs.existsSync(destFile);

      // Special handling for user custom content - never overwrite, even with update flag
      if (isProtectedUserContent && fileExists) {
        if (verbose) log.info(`🔒 Protected custom content: ${relativePath}`);
        preservedCount++;
      } else if (!fileExists) {
        // File doesn't exist - always safe to copy
        try {
          fs.copyFileSync(file, destFile);
          if (verbose) log.add(`Added new file: ${relativePath}`);
          copyCount++;
        } catch (copyError) {
          log.error(
            `Failed to copy ${file} to ${destFile}: ${copyError.message}`,
          );
        }
      } else if (update) {
        // File exists AND update flag is set - overwrite only in this case
        try {
          fs.copyFileSync(file, destFile);
          if (verbose) log.add(`Overwrote existing file: ${relativePath}`);
          copyCount++;
        } catch (copyError) {
          log.error(`Failed to overwrite ${destFile}: ${copyError.message}`);
        }
      } else {
        // File exists but update flag NOT set - NEVER overwrite customer files
        preservedCount++;
        if (verbose) log.info(`Preserved customer file: ${relativePath}`);
      }
    });

    // Emphasize protection of customer files in the output message
    if (update) {
      log.success(
        `Update complete: ${copyCount} files added or updated (overwritten)`,
      );
      if (preservedCount > 0) {
        const protectedMessage =
          userCustomDirectories.length > 0
            ? `(including ${userCustomDirectories.length} protected custom directories)`
            : "";
        log.warning(
          `Note: ${preservedCount} customer files were preserved ${protectedMessage}. Use --update only when needed.`,
        );
      }
    } else {
      log.success(
        `✓ NON-DESTRUCTIVE UPDATE COMPLETE: ${copyCount} new files added`,
      );
      if (preservedCount > 0) {
        const protectedMessage =
          userCustomDirectories.length > 0
            ? `(including ${userCustomDirectories.length} custom directories)`
            : "";
        log.success(
          `✓ PROTECTED: ${preservedCount} existing customer files were preserved ${protectedMessage}`,
        );
      }
    }
  }

  log.completeOperation(
    `ai-workflow-workspace ${isCleanInstall ? "installation" : "update"}`,
  );
  return true;
}

// Copy and rename framework rules
function copyRulesToCursor(sourceDir, repoRoot) {
  const rulesSourceDir = path.join(
    sourceDir,
    "AI-workflow-v2",
    "framework-rules",
  );
  const rulesDestDir = path.join(repoRoot, ".cursor", "rules");

  log.title("Copying Framework Rules to .cursor/rules");
  log.startOperation("Preparing rules copy operation");

  if (verbose) {
    log.info(`Source: ${rulesSourceDir}, Destination: ${rulesDestDir}`);
    log.debug(`Source directory exists: ${fs.existsSync(rulesSourceDir)}`);
    log.debug(`Destination directory exists: ${fs.existsSync(rulesDestDir)}`);
  }

  if (!fs.existsSync(rulesSourceDir)) {
    log.error(`Rules source directory not found: ${rulesSourceDir}`);
    log.debug(
      `Parent directory contents: ${
        fs.existsSync(path.dirname(rulesSourceDir))
          ? fs.readdirSync(path.dirname(rulesSourceDir)).join(", ")
          : "parent directory not found"
      }`,
    );
    log.completeOperation("Rules copy preparation (failed)");
    return false;
  }

  if (!fs.existsSync(rulesDestDir)) {
    log.debug(`Creating rules directory: ${rulesDestDir}`);
    fs.mkdirSync(rulesDestDir, { recursive: true });
    if (verbose) log.info(`Created rules directory: ${rulesDestDir}`);
  }

  if (forceRefresh && fs.existsSync(rulesDestDir)) {
    log.warning(`Force refresh: removing existing rules in ${rulesDestDir}`);
    const existingRules = fs
      .readdirSync(rulesDestDir)
      .filter((file) => file.endsWith(".mdc"));

    log.debug(`Found ${existingRules.length} existing .mdc files to remove`);
    existingRules.forEach((file) => {
      if (verbose) log.debug(`Removing file: ${file}`);
      fs.unlinkSync(path.join(rulesDestDir, file));
    });
    log.debug(`Removed ${existingRules.length} existing rule files`);
  }

  log.completeOperation("Rules copy preparation");
  log.startOperation("Copying framework rules to Cursor using numbered system");

  try {
    // Get all files in the source directory
    const files = fs.readdirSync(rulesSourceDir);

    // Filter for numbered rule files only (files that start with numbers like 100-)
    const numberedRuleFiles = files.filter((file) => {
      // Match pattern like 100-implementation-process.md
      return /^\d{3}-.*\.md$/.test(file) && file !== "README.md";
    });

    if (verbose) {
      log.debug(
        `Found ${numberedRuleFiles.length} numbered rule files to process`,
      );
      if (numberedRuleFiles.length > 0) {
        log.debug(
          `First few rule files: ${numberedRuleFiles.slice(0, 3).join(", ")}`,
        );
      }
    }

    // Copy each numbered rule file to the destination
    let copiedCount = 0;

    numberedRuleFiles.forEach((file) => {
      const sourcePath = path.join(rulesSourceDir, file);
      // Convert .md to .mdc for Cursor rules
      const destPath = path.join(rulesDestDir, file.replace(".md", ".mdc"));

      try {
        fs.copyFileSync(sourcePath, destPath);
        copiedCount++;
        if (verbose) {
          log.add(`Copied rule: ${file} → ${path.basename(destPath)}`);
        }
      } catch (error) {
        log.error(`Error copying rule file ${file}: ${error.message}`);
      }
    });

    // Additionally copy 175-rule-index.md as 175-rule-index.mdc if it exists
    const ruleIndexPath = path.join(rulesSourceDir, "175-rule-index.md");
    if (fs.existsSync(ruleIndexPath)) {
      const indexDestPath = path.join(rulesDestDir, "175-rule-index.mdc");
      try {
        fs.copyFileSync(ruleIndexPath, indexDestPath);
        if (verbose) {
          log.add(`Also copied rule index as 175-rule-index.mdc`);
        }
        copiedCount++;
      } catch (error) {
        log.error(`Error copying rule index: ${error.message}`);
      }
    } else {
      if (verbose) log.debug(`Rule index not found at: ${ruleIndexPath}`);
    }

    log.success(
      `Cursor rules updated: ${copiedCount} numbered rule files copied to ${rulesDestDir}`,
    );
  } catch (error) {
    log.error(`Error processing rules directory: ${error.message}`);
    if (verbose) log.debug(`Error stack: ${error.stack}`);
    log.completeOperation("Framework rules copy (failed)");
    return false;
  }

  log.completeOperation("Framework rules copy");
  return true;
}

// Update .gitignore to include AI-workflow-v2 if not present
function updateGitignore(repoRoot) {
  const gitignorePath = path.join(repoRoot, ".gitignore");
  const entry = "AI-workflow-v2/";

  log.title("Updating .gitignore");
  log.startOperation(".gitignore update");

  if (verbose) {
    log.debug(`Gitignore path: ${gitignorePath}`);
    log.debug(`Entry to add: ${entry}`);
    log.debug(`File exists: ${fs.existsSync(gitignorePath)}`);
  }

  if (fs.existsSync(gitignorePath)) {
    const gitignoreContent = fs.readFileSync(gitignorePath, "utf8");
    if (verbose) log.debug(`.gitignore size: ${gitignoreContent.length} bytes`);

    if (!gitignoreContent.includes(entry)) {
      log.debug(`Entry not found, adding: ${entry}`);
      fs.appendFileSync(gitignorePath, `\n${entry}\n`);
      log.success(`Added ${entry} to .gitignore`);
    } else {
      log.info(`${entry} already exists in .gitignore`);
      if (verbose) log.debug(`No changes needed to .gitignore`);
    }
  } else {
    log.debug(`No .gitignore found, creating new file with entry: ${entry}`);
    fs.writeFileSync(gitignorePath, `${entry}\n`);
    log.success(`Created .gitignore with ${entry}`);
  }

  log.completeOperation(".gitignore update");
}

// Main execution function
async function main() {
  try {
    log.title("AI Workflow V2 Installer");
    log.debug(`Node.js version: ${process.version}`);
    log.debug(`Platform: ${process.platform}-${process.arch}`);
    log.debug(`Working directory: ${process.cwd()}`);
    log.debug(`Command arguments: ${process.argv.join(" ")}`);
    log.debug(
      `Flags: force=${forceRefresh}, verbose=${verbose}, update=${update}`,
    );

    const REPO_ROOT = findRepoRoot();
    const AI_WORKFLOW_DEST_DIR = path.join(REPO_ROOT, "AI-workflow-v2");

    if (verbose) {
      log.info(`Repository root: ${REPO_ROOT}`);
      log.info(`Temporary clone directory: ${TEMP_CLONE_DIR}`);
      log.info(`Target AI Workflow directory: ${AI_WORKFLOW_DEST_DIR}`);
      log.debug(`Temp directory in: ${os.tmpdir()}`);
    }

    log.startOperation("Preparing temporary directory");
    if (fs.existsSync(TEMP_CLONE_DIR)) {
      log.debug(`Cleaning up existing temp directory: ${TEMP_CLONE_DIR}`);
      fs.rmSync(TEMP_CLONE_DIR, { recursive: true, force: true });
      log.debug(`Existing temporary directory removed successfully`);
    }
    log.completeOperation("Temporary directory preparation");

    log.startOperation(`Cloning repository from GitHub`);
    log.info(
      `Cloning ${REPO_URL} (branch: ${REPO_BRANCH}) to ${TEMP_CLONE_DIR}`,
    );

    try {
      execSync(`git clone -b ${REPO_BRANCH} ${REPO_URL} ${TEMP_CLONE_DIR}`, {
        stdio: verbose ? "inherit" : "pipe",
      });
      log.success("Repository cloned successfully");
      log.debug(`Clone completed in: ${path.resolve(TEMP_CLONE_DIR)}`);

      if (verbose) {
        const fileCount = fs.readdirSync(TEMP_CLONE_DIR).length;
        log.debug(`Cloned directory contains ${fileCount} items at top level`);
      }
    } catch (error) {
      log.error(`Git clone failed: ${error.message}`);
      log.debug(`Exit code: ${error.status}`);
      if (error.stderr) log.debug(`Error output: ${error.stderr.toString()}`);
      throw error;
    }
    log.completeOperation("Repository cloning");

    // Copy AI-workflow-v2 and proceed only if successful
    if (copyAIWorkflowV2(TEMP_CLONE_DIR, REPO_ROOT)) {
      // Copy workspace and proceed only if successful
      if (copyWorkspaceToRoot(TEMP_CLONE_DIR, REPO_ROOT)) {
        // Copy rules and update .gitignore
        copyRulesToCursor(TEMP_CLONE_DIR, REPO_ROOT);
        updateGitignore(REPO_ROOT);

        log.startOperation("Cleaning up temporary files");
        log.debug(`Removing temporary directory: ${TEMP_CLONE_DIR}`);
        fs.rmSync(TEMP_CLONE_DIR, { recursive: true, force: true });
        log.completeOperation("Temporary files cleanup");

        log.title("Installation Summary");
        log.success("AI Workflow V2 installation completed successfully!");
        log.info(`Framework files installed to: ${AI_WORKFLOW_DEST_DIR}`);
        log.info(
          `Workspace files installed to: ${path.join(
            REPO_ROOT,
            "ai-workflow-workspace",
          )}`,
        );
        log.info(
          `Cursor rules installed to: ${path.join(
            REPO_ROOT,
            ".cursor",
            "rules",
          )}`,
        );
        log.info(".gitignore updated to ignore framework files");

        if (verbose) {
          log.debug("Installation completed with verbose logging enabled");
          log.debug(
            `Total installation time: ${(
              (Date.now() - parseInt(TEMP_CLONE_DIR.split("-").pop())) /
              1000
            ).toFixed(2)} seconds`,
          );
        }
      } else {
        log.error("Failed to copy workspace contents.");
        log.debug("Installation aborted due to workspace copy failure");
        process.exit(1);
      }
    } else {
      log.error("Failed to copy AI-workflow-v2.");
      log.debug("Installation aborted due to framework copy failure");
      process.exit(1);
    }
  } catch (error) {
    log.error("An error occurred during installation:");
    if (verbose) {
      log.debug(`Error type: ${error.name}`);
      log.debug(`Error message: ${error.message}`);
      log.debug(`Stack trace: ${error.stack}`);
    }
    console.error(error);
    process.exit(1);
  }
}

export { main };

// More robust way to detect if this file is being run directly in ESM context
// This handles various ways Node.js might be invoking the script
function isRunAsMainModule() {
  if (typeof process === "undefined") return false;

  const scriptPath = import.meta.url;
  if (!scriptPath) return false;

  // Try to match against process.argv[1]
  if (process.argv[1]) {
    // Convert file:// URL to path for proper comparison
    const scriptPathNormalized = scriptPath.replace(/^file:\/\//, "");
    // Check if process.argv[1] is at the end of the script path
    if (scriptPathNormalized.endsWith(process.argv[1])) return true;

    // On some systems, the full path might be in process.argv[1]
    try {
      const fileUrl = new URL(`file://${process.argv[1]}`);
      if (scriptPath === fileUrl.href) return true;
    } catch (e) {
      // Ignore errors in URL parsing
    }
  }

  // Check if import.meta.url resembles the main module path
  return process.argv.some(
    (arg) =>
      scriptPath.includes(arg) && (arg.endsWith(".js") || arg.endsWith(".mjs")),
  );
}

// Run the main function if this file is being run directly
if (isRunAsMainModule()) {
  main();
}
