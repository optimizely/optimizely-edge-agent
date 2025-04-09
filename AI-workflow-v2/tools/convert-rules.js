#!/usr/bin/env node

/**
 * Simple Rule Conversion Script
 *
 * This script simply converts rules from markdown (.md) to Cursor rule format (.mdc)
 * by copying the files and changing the extension.
 *
 * Usage:
 *   node convert-rules.js [source-dir] [target-dir]
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get the repository root directory
function findRepoRoot() {
  let currentDir = process.cwd();

  while (currentDir !== path.parse(currentDir).root) {
    if (fs.existsSync(path.join(currentDir, ".git"))) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }

  console.log(
    "Warning: Couldn't find repository root. Using current directory.",
  );
  return process.cwd();
}

// Parse command line arguments
const args = process.argv.slice(2);
const REPO_ROOT = findRepoRoot();

// Set source and target directories from arguments or use defaults
const FRAMEWORK_RULES_DIR =
  args[0] ||
  path.join(REPO_ROOT, "AI-workflow-v2", "guidelines", "framework-rules");
const CURSOR_RULES_DIR = args[1] || path.join(REPO_ROOT, ".cursor", "rules");

// Ensure the cursor rules directory exists
if (!fs.existsSync(CURSOR_RULES_DIR)) {
  fs.mkdirSync(CURSOR_RULES_DIR, { recursive: true });
  console.log(`Created directory: ${CURSOR_RULES_DIR}`);
}

// Function to recursively get all files in a directory
function getAllFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      getAllFiles(fullPath, files);
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

// Convert files from MD to MDC
function convertFiles(sourceDir, targetDir) {
  console.log(`Converting files from ${sourceDir} to ${targetDir}`);

  // Check if source directory exists
  if (!fs.existsSync(sourceDir)) {
    console.error(`Error: Source directory not found: ${sourceDir}`);
    process.exit(1);
  }

  // Get all markdown files in the source directory
  const mdFiles = getAllFiles(sourceDir).filter((file) =>
    file.toLowerCase().endsWith(".md"),
  );

  if (mdFiles.length === 0) {
    console.log("No .md files found in source directory.");
    return;
  }

  let converted = 0;
  let skipped = 0;

  // Process each file
  mdFiles.forEach((file) => {
    const relativePath = path.relative(sourceDir, file);
    const fileName = path.basename(file);

    // Skip README files
    if (fileName.toLowerCase() === "readme.md") {
      console.log(`Skipping: ${fileName}`);
      skipped++;
      return;
    }

    // Create target path with .mdc extension
    const targetPath = path.join(
      targetDir,
      relativePath.replace(/\.md$/i, ".mdc"),
    );

    // Create parent directories if they don't exist
    const targetDirPath = path.dirname(targetPath);
    if (!fs.existsSync(targetDirPath)) {
      fs.mkdirSync(targetDirPath, { recursive: true });
    }

    // Copy file with new extension
    fs.copyFileSync(file, targetPath);
    console.log(`Converted: ${fileName} → ${path.basename(targetPath)}`);
    converted++;
  });

  console.log("\n=== Conversion Summary ===");
  console.log(`Total files found: ${mdFiles.length}`);
  console.log(`Converted: ${converted}`);
  console.log(`Skipped: ${skipped}`);
  console.log("Conversion complete!");
}

// Run the conversion
convertFiles(FRAMEWORK_RULES_DIR, CURSOR_RULES_DIR);
