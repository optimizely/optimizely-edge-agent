#!/usr/bin/env node

/**
 * Copy Rules to Cursor
 *
 * This utility copies framework rules to the .cursor/rules directory, converting them to .mdc format
 * and updating relative paths to ensure references remain valid in both locations.
 *
 * Usage:
 *   node tools/copy-rules-to-cursor.js [options]
 *
 * Options:
 *   --source <dir>    Source directory of rules (default: guidelines/framework-rules)
 *   --target <dir>    Target directory for cursor rules (default: .cursor/rules)
 *   --dry-run         Preview changes without modifying files
 *   --verbose         Show detailed output
 *   --help            Display this help information
 *
 * Integration with AI Workflow Framework:
 *   This utility ensures framework rules are properly formatted and accessible to Cursor
 *   while maintaining correct path references regardless of file location.
 */

import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get ESM equivalents for __filename and __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determine the framework root path
let FRAMEWORK_ROOT;
if (__dirname.includes("AI-workflow-v2")) {
  // Running from within AI-workflow-v2 directory
  FRAMEWORK_ROOT = __dirname.substring(
    0,
    __dirname.indexOf("AI-workflow-v2") + "AI-workflow-v2".length,
  );
} else {
  // Running from outside, use current directory
  FRAMEWORK_ROOT = path.join(process.cwd(), "AI-workflow-v2");
}

// Determine the workspace root path
const WORKSPACE_ROOT = path.join(process.cwd(), "ai-workflow-workspace");

// Constants
const DEFAULT_SOURCE_DIR = path.join(FRAMEWORK_ROOT, "framework-rules");
const DEFAULT_TARGET_DIR = path.join(process.cwd(), ".cursor", "rules");
const EXTENSIONS_CUSTOM_RULES_DIR = path.join(
  WORKSPACE_ROOT,
  "extensions",
  "custom-rules",
);
const EXTENSIONS_REPOSITORY_PROFILES_DIR = path.join(
  WORKSPACE_ROOT,
  "extensions",
  "repository-profiles",
);

// Path mapping for different locations
const PATH_MAPPING = {
  // Updated path mappings for direct framework-rules structure
  "../../": "AI-workflow-v2/",
  "../": "AI-workflow-v2/",
};

// Read command line flags
const verbose = process.argv.includes("--verbose");
const forceRefresh = process.argv.includes("--force");

// Simple logging functions
function logTitle(title) {
  console.log(`\n=== ${title} ===`);
}

function logInfo(info) {
  console.log(info);
}

function logDebug(info) {
  if (verbose) {
    console.log(`DEBUG: ${info}`);
  }
}

function logSuccess(info) {
  console.log(`SUCCESS: ${info}`);
}

/**
 * Parse command line arguments
 * @returns {object} - Parsed options
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    sourceDir: DEFAULT_SOURCE_DIR,
    targetDir: DEFAULT_TARGET_DIR,
    dryRun: false,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--help") {
      showHelp();
      process.exit(0);
    } else if (arg === "--source" && args[i + 1]) {
      options.sourceDir = path.resolve(args[++i]);
    } else if (arg === "--target" && args[i + 1]) {
      options.targetDir = path.resolve(args[++i]);
    } else if (arg === "--dry-run") {
      options.dryRun = true;
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
Copy Rules to Cursor

This utility copies framework rules to the .cursor/rules directory, converting them to .mdc format
and updating relative paths to ensure references remain valid in both locations.

Usage:
  node tools/copy-rules-to-cursor.js [options]

Options:
  --source <dir>    Source directory of rules (default: guidelines/framework-rules)
  --target <dir>    Target directory for cursor rules (default: .cursor/rules)
  --dry-run         Preview changes without modifying files
  --verbose         Show detailed output
  --help            Display this help information
  `);
}

/**
 * Update paths in a file
 * @param {string|object} filePath - Path to the file or object with path and content
 * @param {boolean} isTarget - Whether this is a target (cursor rules) file
 * @param {object} options - Configuration options
 * @returns {Promise<object>} - Results of the update
 */
async function updatePaths(filePath, isTarget, options) {
  try {
    let content;
    let actualPath;

    if (typeof filePath === "string") {
      actualPath = filePath;
      content = await fs.readFile(filePath, "utf8");
    } else {
      actualPath = filePath.path;
      content = filePath.content;
    }

    let updatedContent = content;
    const changes = [];

    // Find and update paths
    for (const [oldPath, newPath] of Object.entries(PATH_MAPPING)) {
      // If updating source, replace absolute with relative
      // If updating target, replace relative with absolute
      const fromPath = isTarget ? oldPath : newPath;
      const toPath = isTarget ? newPath : oldPath;

      // Only replace within related_files and other explicit path references
      const relatedFilesRegex = new RegExp(
        `(related_files(?:[^\\[]*\\[|\\s*=\\s*\\[)[^\\]]*?)${fromPath.replace(
          /\//g,
          "\\/",
        )}([^\\]]+)`,
        "g",
      );

      // Count occurrences
      const matches = [...updatedContent.matchAll(relatedFilesRegex)];

      if (matches.length > 0) {
        // Replace paths
        updatedContent = updatedContent.replace(
          relatedFilesRegex,
          `$1${toPath}$2`,
        );

        changes.push({
          from: fromPath,
          to: toPath,
          count: matches.length,
        });
      }
    }

    return {
      path: actualPath,
      originalContent: content,
      updatedContent,
      changes,
      hasChanges: content !== updatedContent,
    };
  } catch (error) {
    console.error(
      `Error processing ${
        typeof filePath === "string" ? filePath : filePath.path
      }: ${error.message}`,
    );
    return {
      path: typeof filePath === "string" ? filePath : filePath.path,
      error: error.message,
      hasChanges: false,
    };
  }
}

/**
 * Process files in a directory
 * @param {string} directory - Directory to process
 * @param {boolean} isTarget - Whether this is a target directory
 * @param {object} options - Configuration options
 * @returns {Promise<Array>} - Results of processing
 */
async function processDirectory(directory, isTarget, options) {
  try {
    const results = [];
    const files = await fs.readdir(directory);

    for (const file of files) {
      const filePath = path.join(directory, file);
      const stats = await fs.stat(filePath);

      if ((stats.isFile() && file.endsWith(".md")) || file.endsWith(".mdc")) {
        const result = await updatePaths(filePath, isTarget, options);
        results.push(result);

        if (result.hasChanges) {
          if (!options.dryRun) {
            await fs.writeFile(filePath, result.updatedContent, "utf8");
          }

          if (options.verbose) {
            console.log(`\nFile: ${filePath}`);
            for (const change of result.changes) {
              console.log(
                `  Changed ${change.count} paths from '${change.from}' to '${change.to}'`,
              );
            }
          }
        }
      }
    }

    return results;
  } catch (error) {
    console.error(`Error processing directory ${directory}: ${error.message}`);
    return [];
  }
}

/**
 * Scan a directory recursively for markdown files
 * Returns full path and relative path from base directory
 */
async function scanDirectoryRecursively(directory, baseDir = directory) {
  try {
    const results = [];
    const entries = await fs.readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        // Only include specified folders
        const allowedFolders = [
          "enforcement",
          "protection",
          "verification",
          "core",
        ];

        // Only process allowed directories
        if (allowedFolders.includes(entry.name)) {
          const subDirResults = await scanDirectoryRecursively(
            fullPath,
            baseDir,
          );
          results.push(...subDirResults);
        }
      } else if (
        entry.isFile() &&
        entry.name.endsWith(".md") &&
        (entry.name === "rule-index.md" || // Allow rule-index.md at any level
          path.relative(baseDir, path.dirname(fullPath)).split(path.sep)[0] in
            {
              // File is inside allowed folder
              enforcement: 1,
              protection: 1,
              verification: 1,
              core: 1,
            })
      ) {
        // Calculate relative path from base directory
        const relativePath = path.relative(baseDir, fullPath);
        results.push({
          fullPath,
          relativePath,
          isRuleIndex: entry.name === "rule-index.md",
        });
      }
    }

    return results;
  } catch (error) {
    console.error(`Error scanning directory ${directory}: ${error.message}`);
    return [];
  }
}

/**
 * Find all repository profile custom rules directories
 */
async function findRepositoryProfileRules() {
  try {
    const results = [];

    // Check if repository profiles directory exists
    try {
      await fs.access(EXTENSIONS_REPOSITORY_PROFILES_DIR);
    } catch (error) {
      // Directory doesn't exist, return empty array
      return results;
    }

    const entries = await fs.readdir(EXTENSIONS_REPOSITORY_PROFILES_DIR, {
      withFileTypes: true,
    });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        // Apply ANY repository profile found without checking repo name
        const profilePath = path.join(
          EXTENSIONS_REPOSITORY_PROFILES_DIR,
          entry.name,
        );
        const customRulesPath = path.join(profilePath, "custom-rules");

        try {
          await fs.access(customRulesPath);
          const profileRules = await scanDirectoryRecursively(
            customRulesPath,
            customRulesPath,
          );

          // Log the profile being used (removed any check that would have filtered based on repo name)
          console.log(
            `  Including repository profile: ${entry.name} (all profiles take precedence)`,
          );

          // Add profile info to each result
          profileRules.forEach((rule) => {
            rule.profileName = entry.name;
          });

          results.push(...profileRules);
        } catch (error) {
          // Custom rules directory doesn't exist for this profile, skip
          continue;
        }
      }
    }

    return results;
  } catch (error) {
    console.error(`Error finding repository profile rules: ${error.message}`);
    return [];
  }
}

/**
 * Main function
 */
async function main() {
  try {
    // Parse command line arguments
    const options = parseArgs();

    console.log("\nCopy Rules to Cursor");
    console.log("===================");
    console.log(`Framework root: ${FRAMEWORK_ROOT}`);
    console.log(`Workspace root: ${WORKSPACE_ROOT}`);
    console.log(`Source directory: ${options.sourceDir}`);
    console.log(`Target directory: ${options.targetDir}`);
    console.log(`Mode: ${options.dryRun ? "DRY RUN" : "UPDATE"}`);

    // Check if source directory exists
    try {
      await fs.access(options.sourceDir);
    } catch (error) {
      console.error(
        `\nError: The source directory does not exist at ${options.sourceDir}`,
      );
      process.exit(1);
    }

    // Create target directory if it doesn't exist
    try {
      await fs.access(options.targetDir);
    } catch (error) {
      if (!options.dryRun) {
        console.log(`\nCreating target directory: ${options.targetDir}`);
        try {
          await fs.mkdir(options.targetDir, { recursive: true });
        } catch (mkdirError) {
          console.error(
            `\nError creating target directory: ${mkdirError.message}`,
          );
          process.exit(1);
        }
      } else {
        console.log(
          `\nTarget directory does not exist (would create in non-dry-run mode): ${options.targetDir}`,
        );
      }
    }

    // Collect stats for summary
    let coreRulesProcessed = 0;
    let customRulesProcessed = 0;
    let profileRulesProcessed = 0;
    let totalFilesProcessed = 0;

    // Copy updated files to target if they don't exist
    if (!options.dryRun) {
      console.log(
        "\nCopying rules to Cursor directory with preserved folder structure...",
      );

      // Process framework core rules with preserved structure
      console.log("  Processing framework core rules...");

      // UPDATED APPROACH: Focus on numbered rule files (similar to get-ai-workflow.js)
      try {
        // Get all files in the source directory
        const files = await fs.readdir(options.sourceDir);

        // Filter for numbered rule files only (files that start with numbers like 100-)
        const numberedRuleFiles = files.filter((file) => {
          // Match pattern like 100-implementation-process.md
          return /^\d{3}-.*\.md$/.test(file) && file !== "README.md";
        });

        if (verbose) {
          logDebug(
            `Found ${numberedRuleFiles.length} numbered rule files to process`,
          );
          if (numberedRuleFiles.length > 0) {
            logDebug(
              `First few rule files: ${numberedRuleFiles
                .slice(0, 3)
                .join(", ")}`,
            );
          }
        }

        // Copy each numbered rule file to the destination
        let copiedCount = 0;

        for (const file of numberedRuleFiles) {
          const sourcePath = path.join(options.sourceDir, file);
          // Convert .md to .mdc for Cursor rules
          const destPath = path.join(
            options.targetDir,
            file.replace(".md", ".mdc"),
          );

          try {
            // Read the source file
            const content = await fs.readFile(sourcePath, "utf8");

            // Update paths for the target context
            const targetResult = await updatePaths(
              { path: destPath, content },
              true,
              options,
            );

            const finalContent = targetResult.hasChanges
              ? targetResult.updatedContent
              : content;

            // Write the file
            await fs.writeFile(destPath, finalContent, "utf8");

            copiedCount++;
            if (verbose) {
              logInfo(`Copied rule: ${file} → ${path.basename(destPath)}`);
            }
          } catch (error) {
            console.error(`Error copying rule file ${file}: ${error.message}`);
          }
        }

        // Additionally copy 175-rule-index.md as 175-rule-index.mdc if it exists
        const ruleIndexPath = path.join(options.sourceDir, "175-rule-index.md");
        if (fs.existsSync(ruleIndexPath)) {
          const indexDestPath = path.join(
            options.targetDir,
            "175-rule-index.mdc",
          );
          try {
            fs.copyFileSync(ruleIndexPath, indexDestPath);
            if (verbose) {
              logInfo(`Also copied rule index as 175-rule-index.mdc`);
            }
          } catch (error) {
            console.error(`Error copying rule index: ${error.message}`);
          }
        } else {
          if (verbose) logDebug(`Rule index not found at: ${ruleIndexPath}`);
        }

        coreRulesProcessed = copiedCount;
        totalFilesProcessed += coreRulesProcessed;

        logSuccess(`Processed ${copiedCount} numbered rule files`);
      } catch (error) {
        console.error(`Error processing rules directory: ${error.message}`);
        if (verbose) logDebug(`Error stack: ${error.stack}`);
      }

      // Keep existing approach for custom rules & repository profiles
      // Process custom rules with preserved structure
      console.log("  Processing custom rules...");
      try {
        await fs.access(EXTENSIONS_CUSTOM_RULES_DIR);
        const customFiles = await scanDirectoryRecursively(
          EXTENSIONS_CUSTOM_RULES_DIR,
          EXTENSIONS_CUSTOM_RULES_DIR,
        );
        await processCopyWithStructure(customFiles, options, "custom");
        customRulesProcessed = customFiles.length;
        totalFilesProcessed += customRulesProcessed;
      } catch (error) {
        console.log(
          `  No custom rules found in ${EXTENSIONS_CUSTOM_RULES_DIR}`,
        );
      }

      // Process repository profile rules with preserved structure
      console.log("  Processing repository profile rules...");
      const repoProfileFiles = await findRepositoryProfileRules();
      await processCopyWithStructure(repoProfileFiles, options, "profiles");
      profileRulesProcessed = repoProfileFiles.length;
      totalFilesProcessed += profileRulesProcessed;
    }

    // Generate summary
    console.log("\nSummary:");
    console.log(`  Core framework rules processed: ${coreRulesProcessed}`);
    console.log(`  Custom rules processed: ${customRulesProcessed}`);
    console.log(
      `  Repository profile rules processed: ${profileRulesProcessed}`,
    );
    console.log(`  Total files processed: ${totalFilesProcessed}`);

    if (options.dryRun) {
      console.log("\nThis was a dry run. No files were modified.");
      console.log("Run without --dry-run to apply changes.");
    } else {
      console.log("\nRules copied successfully to Cursor directory.");
    }
  } catch (error) {
    console.error(`\nError: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Process copying files while preserving structure
 */
async function processCopyWithStructure(files, options, destSubfolder = "") {
  for (const fileInfo of files) {
    const { fullPath, relativePath, isRuleIndex, profileName } = fileInfo;

    // Calculate target path preserving directory structure
    let targetRelativePath = relativePath.replace(".md", ".mdc");

    // Special case for rule-index.md - place at root
    if (isRuleIndex && !destSubfolder) {
      targetRelativePath = "rule-index.mdc";
    }

    // Add subfolder prefix if specified (for custom rules and profiles)
    let targetBasePath = options.targetDir;
    if (destSubfolder) {
      targetBasePath = path.join(options.targetDir, destSubfolder);

      // For profiles, add profile name as subfolder
      if (destSubfolder === "profiles" && profileName) {
        targetBasePath = path.join(targetBasePath, profileName);
      }
    }

    const targetPath = path.join(targetBasePath, targetRelativePath);
    const targetDir = path.dirname(targetPath);

    try {
      // Create target directory if it doesn't exist
      await fs.mkdir(targetDir, { recursive: true });

      // Check if target file exists
      try {
        await fs.access(targetPath);
        // File exists, skip unless it's a rule we always want to update
        if (options.verbose) {
          console.log(`    File already exists: ${targetRelativePath}`);
        }
      } catch (error) {
        // File doesn't exist, read content and copy it
        const relativePathDisplay = profileName
          ? `${profileName}/${relativePath}`
          : relativePath;

        const targetRelativePathDisplay = path.relative(
          options.targetDir,
          targetPath,
        );
        console.log(
          `    Copying ${relativePathDisplay} to ${targetRelativePathDisplay}`,
        );

        // Read the source file
        const content = await fs.readFile(fullPath, "utf8");

        // Update paths for the target context
        const targetResult = await updatePaths(
          { path: targetPath, content },
          true,
          options,
        );

        const finalContent = targetResult.hasChanges
          ? targetResult.updatedContent
          : content;

        // Write the file
        await fs.writeFile(targetPath, finalContent, "utf8");
      }
    } catch (error) {
      console.error(`    Error copying ${relativePath}: ${error.message}`);
    }
  }
}

// Run the main function
main();
