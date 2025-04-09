/**
 * @fileinfo
 * type: "utility-script"
 * purpose: "file-handling"
 * version: "1.0"
 * status: "Active"
 * description: "File utilities for the AI Workflow Framework providing automatic timestamp updating"
 * ai_instructions: "Use these utilities for all file operations in the framework to ensure automatic timestamp updating"
 * related_files: ["./date-utils.js", "./path-utils.js"]
 * functions: ["readFile", "writeFile", "appendFile", "copyFile", "createDirectory"]
 * usage_examples: ["import { writeFile } from './tools/ai-tools/file-utils.js';"]
 * tags: ["utilities", "file-handling", "timestamps"]
 * priority: "high"
 * audience: "ai-human"
 * dateCreated: "2025-03-25"
 * lastUpdated: "2025-03-25"
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dateUtils from "./date-utils.js";

const { updateMetadataDate, formatDate } = dateUtils;

// Create ESM replacements for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Reads a file and returns its contents
 * @param {string} filePath - Path to the file
 * @param {string} [encoding='utf8'] - File encoding
 * @returns {string|Buffer} - File contents
 */
export function readFile(filePath, encoding = "utf8") {
  return fs.readFileSync(filePath, encoding);
}

/**
 * Writes content to a file with automatic timestamp updating for markdown files
 * @param {string} filePath - Path to the file
 * @param {string|Buffer} content - Content to write
 * @param {Object} [options={}] - Options
 * @param {boolean} [options.skipTimestampUpdate=false] - Whether to skip timestamp update
 * @returns {void}
 */
export function writeFile(filePath, content, options = {}) {
  // Check if this is a markdown file and if timestamp update is needed
  const isMarkdown = /\.(md|mdx|mdc)$/i.test(filePath);
  const shouldUpdateTimestamp = !options.skipTimestampUpdate && isMarkdown;

  // Update timestamps if needed
  if (shouldUpdateTimestamp && typeof content === "string") {
    content = updateMetadataDate(content);
  }

  // Write the file
  fs.writeFileSync(filePath, content);

  return filePath;
}

/**
 * Appends content to a file
 * @param {string} filePath - Path to the file
 * @param {string|Buffer} content - Content to append
 * @returns {void}
 */
export function appendFile(filePath, content) {
  fs.appendFileSync(filePath, content);

  // If this is a markdown file, read, update timestamps, and write back
  if (/\.(md|mdx|mdc)$/i.test(filePath) && typeof content === "string") {
    const fullContent = fs.readFileSync(filePath, "utf8");
    const updatedContent = updateMetadataDate(fullContent);
    fs.writeFileSync(filePath, updatedContent);
  }

  return filePath;
}

/**
 * Copies a file with automatic timestamp updating for markdown files
 * @param {string} sourcePath - Source file path
 * @param {string} destPath - Destination file path
 * @param {Object} [options={}] - Options
 * @param {boolean} [options.skipTimestampUpdate=false] - Whether to skip timestamp update
 * @returns {void}
 */
export function copyFile(sourcePath, destPath, options = {}) {
  // Check if this is a markdown file and if timestamp update is needed
  const isMarkdown = /\.(md|mdx|mdc)$/i.test(destPath);
  const shouldUpdateTimestamp = !options.skipTimestampUpdate && isMarkdown;

  if (shouldUpdateTimestamp) {
    // Read, update timestamps, and write
    const content = fs.readFileSync(sourcePath, "utf8");
    const updatedContent = updateMetadataDate(content);
    fs.writeFileSync(destPath, updatedContent);
  } else {
    // Simple copy
    fs.copyFileSync(sourcePath, destPath);
  }

  return destPath;
}

/**
 * Creates a directory if it doesn't exist
 * @param {string} dirPath - Path to the directory
 * @param {Object} [options={}] - Options
 * @param {boolean} [options.recursive=true] - Whether to create parent directories
 * @returns {string} - Path to the created directory
 */
export function createDirectory(dirPath, options = { recursive: true }) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, options);
  }
  return dirPath;
}

/**
 * Creates a new file with front matter metadata
 * @param {string} filePath - Path to the file
 * @param {string} content - Content (without front matter)
 * @param {Object} metadata - Front matter metadata
 * @returns {string} - Path to the created file
 */
export function createFileWithMetadata(filePath, content, metadata) {
  // Ensure metadata has required timestamp fields
  const today = formatDate();
  metadata.dateCreated = metadata.dateCreated || today;
  metadata.lastUpdated = today;

  // Format front matter
  let frontMatter = "---\n";
  for (const [key, value] of Object.entries(metadata)) {
    frontMatter += `${key}: ${JSON.stringify(value)}\n`;
  }
  frontMatter += "---\n\n";

  // Combine front matter and content
  const fullContent = frontMatter + content;

  // Write the file
  fs.writeFileSync(filePath, fullContent);

  return filePath;
}

// Create a default export with all functions
const fileUtils = {
  readFile,
  writeFile,
  appendFile,
  copyFile,
  createDirectory,
  createFileWithMetadata,
};

export default fileUtils;
