/**
 * @fileinfo
 * type: "utility-script"
 * purpose: "date-handling"
 * version: "1.0"
 * status: "Active"
 * description: "Date utilities for the AI Workflow Framework providing consistent date operations"
 * ai_instructions: "Use these utilities for all date operations in the framework to ensure consistency"
 * related_files: ["./path-utils.js"]
 * functions: ["getCurrentDate", "formatDate", "updateDateReferences", "getTimestamp"]
 * usage_examples: ["import { getCurrentDate } from './tools/ai-tools/date-utils.js';"]
 * tags: ["utilities", "date-handling"]
 * priority: "high"
 * audience: "ai-human"
 * dateCreated: "2025-03-25"
 * lastUpdated: "2025-03-25"
 */

/**
 * Gets the current date information
 * @returns {Object} Object with date parts
 */
export function getCurrentDate() {
  // Always use the actual system date
  const now = new Date();

  // Get the raw year, month, and day
  const year = now.getFullYear();

  // Format values consistently
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const day = now.getDate().toString().padStart(2, "0");

  return {
    year: year.toString(),
    month: month,
    day: day,
    formatted: `${year}-${month}-${day}`,
    iso: now.toISOString(),
  };
}

/**
 * Formats a date object or string in YYYY-MM-DD format
 * @param {Date|string} [date] - Date to format (default: current date)
 * @returns {string} Formatted date string
 */
export function formatDate(date) {
  // If no date is provided, use current date
  if (!date) {
    date = new Date();
  }

  // If a string is provided, convert it to a Date object
  if (typeof date === "string") {
    date = new Date(date);
  }

  // Get the raw year, month, and day
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * Updates date references in content (e.g., copyright year)
 * @param {string} content - Content to update
 * @returns {string} Updated content
 */
export function updateDateReferences(content) {
  if (!content) return content;

  const { year } = getCurrentDate();

  // Update copyright year references
  return content.replace(/Copyright © \d{4}/g, `Copyright © ${year}`);
}

/**
 * Gets a formatted timestamp with date and time
 * @returns {string} Formatted timestamp
 */
export function getTimestamp() {
  const now = new Date();

  // Get the raw date and time components
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const day = now.getDate().toString().padStart(2, "0");
  const hours = now.getHours().toString().padStart(2, "0");
  const minutes = now.getMinutes().toString().padStart(2, "0");
  const seconds = now.getSeconds().toString().padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// Export a default object with all functions
const dateUtils = {
  getCurrentDate,
  formatDate,
  updateDateReferences,
  getTimestamp,
};

export default dateUtils;
