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

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants
const FRAMEWORK_ROOT = path.join(process.cwd());
const DEFAULT_SOURCE_DIR = path.join(
  FRAMEWORK_ROOT,
  "guidelines",
  "framework-rules",
);
const DEFAULT_TARGET_DIR = path.join(process.cwd(), ".cursor", "rules");

// Path mapping for different locations
const PATH_MAPPING = {
  // When in guidelines/framework-rules, paths start with ../../
  // When in .cursor/rules, paths need to be relative to workspace root
  "../../": "AI-workflow-v2/",
  "../": "AI-workflow-v2/guidelines/",
};

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
 * @param {string} filePath - Path to the file
 * @param {boolean} isTarget - Whether this is a target (cursor rules) file
 * @param {object} options - Configuration options
 * @returns {Promise<object>} - Results of the update
 */
async function updatePaths(filePath, isTarget, options) {
  try {
    const content = await fs.readFile(filePath, "utf8");
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
      path: filePath,
      originalContent: content,
      updatedContent,
      changes,
      hasChanges: content !== updatedContent,
    };
  } catch (error) {
    console.error(`Error processing ${filePath}: ${error.message}`);
    return {
      path: filePath,
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
 * Main function
 */
async function main() {
  try {
    // Parse command line arguments
    const options = parseArgs();

    console.log("\nCopy Rules to Cursor");
    console.log("===================");
    console.log(`Source directory: ${options.sourceDir}`);
    console.log(`Target directory: ${options.targetDir}`);
    console.log(`Mode: ${options.dryRun ? "DRY RUN" : "UPDATE"}`);

    // Check if directories exist
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

    // Process source directory
    console.log("\nProcessing source directory...");
    const sourceResults = await processDirectory(
      options.sourceDir,
      false,
      options,
    );

    // Process target directory
    console.log("\nProcessing target directory...");
    const targetResults = await processDirectory(
      options.targetDir,
      true,
      options,
    );

    // Copy updated files to target if they don't exist
    if (!options.dryRun) {
      console.log("\nCopying missing files to target directory...");

      for (const result of sourceResults) {
        const sourceFile = path.basename(result.path);
        const targetFile = sourceFile.replace(".md", ".mdc");
        const targetPath = path.join(options.targetDir, targetFile);

        try {
          await fs.access(targetPath);
          // File exists, skip
        } catch (error) {
          // File doesn't exist, copy it
          console.log(`  Copying ${sourceFile} to ${targetFile}`);

          // Get the content (original or updated)
          const content = result.hasChanges
            ? result.updatedContent
            : result.originalContent;

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
      }
    }

    // Generate summary
    const sourceChanges = sourceResults.filter((r) => r.hasChanges).length;
    const targetChanges = targetResults.filter((r) => r.hasChanges).length;

    console.log("\nSummary:");
    console.log(`  Source files processed: ${sourceResults.length}`);
    console.log(`  Source files with changes: ${sourceChanges}`);
    console.log(`  Target files processed: ${targetResults.length}`);
    console.log(`  Target files with changes: ${targetChanges}`);

    if (options.dryRun) {
      console.log("\nThis was a dry run. No files were modified.");
      console.log("Run without --dry-run to apply changes.");
    } else {
      console.log("\nPath updates complete.");
    }
  } catch (error) {
    console.error(`\nError: ${error.message}`);
    process.exit(1);
  }
}

// Run the main function
main();
