/**
 * Visual Progress Indicators Utility
 *
 * This utility provides functions for generating visual progress indicators
 * such as progress bars, status indicators, and other visual elements
 * to enhance progress reporting in the AI Workflow Framework.
 *
 * Usage:
 *   import {
 *     createProgressBar,
 *     createStatusBadge,
 *     formatPercentage,
 *     createTimeline
 *   } from './tools/ai-tools/progress-indicators.js';
 *
 * Integration with AI Workflow Framework:
 *   This utility is part of the visual progress indicators enhancement for
 *   the AI Workflow v2 framework. See guidelines/framework-rules/450-visual-indicators.md
 *   for more information on visual indicator usage.
 */

/**
 * Terminal color codes for styling outputs
 * @type {Object}
 */
const colors = {
  reset: "\x1b[0m",
  // Foreground colors
  black: "\x1b[30m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
  // Background colors
  bgBlack: "\x1b[40m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m",
  bgMagenta: "\x1b[45m",
  bgCyan: "\x1b[46m",
  bgWhite: "\x1b[47m",
  // Styles
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  italic: "\x1b[3m",
  underline: "\x1b[4m",
};

/**
 * Status indicators with their symbols and colors
 * @type {Object}
 */
const statusIndicators = {
  // Standard status states
  notStarted: { symbol: "⏹️", label: "Not Started", color: "gray" },
  planning: { symbol: "🟡", label: "Planning", color: "yellow" },
  inProgress: { symbol: "🔄", label: "In Progress", color: "blue" },
  review: { symbol: "🔍", label: "Review", color: "cyan" },
  completed: { symbol: "✅", label: "Completed", color: "green" },
  blocked: { symbol: "⚠️", label: "Blocked", color: "red" },
  archived: { symbol: "⚫", label: "Archived", color: "gray" },

  // Risk levels
  lowRisk: { symbol: "🟢", label: "Low Risk", color: "green" },
  mediumRisk: { symbol: "🟡", label: "Medium Risk", color: "yellow" },
  highRisk: { symbol: "🔴", label: "High Risk", color: "red" },

  // Verification states
  verified: { symbol: "✓", label: "Verified", color: "green" },
  needsReview: { symbol: "⚠️", label: "Needs Review", color: "yellow" },
  rejected: { symbol: "❌", label: "Rejected", color: "red" },

  // Other indicators
  warning: { symbol: "⚠️", label: "Warning", color: "yellow" },
  error: { symbol: "❌", label: "Error", color: "red" },
  info: { symbol: "ℹ️", label: "Info", color: "blue" },
  success: { symbol: "✅", label: "Success", color: "green" },
};

/**
 * Check if color output is supported
 * @type {Boolean}
 */
const supportsColor = process.stdout.isTTY;

/**
 * Check if Unicode is supported
 * @type {Boolean}
 */
const supportsUnicode = (() => {
  try {
    return (
      process.env.TERM !== "linux" &&
      !process.env.CI &&
      process.platform !== "win32"
    );
  } catch (e) {
    return false;
  }
})();

/**
 * Apply color to text if supported
 * @param {string} text - Text to color
 * @param {string} color - Color to apply from colors object
 * @returns {string} - Colored text or original text
 */
export function colorize(text, color) {
  if (!supportsColor || !colors[color]) return text;
  return `${colors[color]}${text}${colors.reset}`;
}

/**
 * Create a progress bar with customizable appearance
 * @param {number} value - Current progress value (0-100)
 * @param {Object} options - Configuration options
 * @param {number} options.width - Width of the progress bar in characters (default: 10)
 * @param {string} options.completeChar - Character for completed progress (default: █)
 * @param {string} options.incompleteChar - Character for incomplete progress (default: ░)
 * @param {boolean} options.showPercentage - Whether to show percentage (default: false)
 * @param {string} options.color - Color for the completed portion (default: none)
 * @returns {string} - Formatted progress bar
 */
export function createProgressBar(value, options = {}) {
  // Default options
  const {
    width = 10,
    completeChar = supportsUnicode ? "█" : "#",
    incompleteChar = supportsUnicode ? "░" : "-",
    showPercentage = false,
    color = "green",
  } = options;

  // Validate value
  const percentage = Math.max(0, Math.min(100, value));

  // Calculate the number of complete characters
  const completeLength = Math.round((percentage / 100) * width);
  const incompleteLength = width - completeLength;

  // Create the progress bar
  let bar = "";

  // Add complete characters
  if (completeLength > 0) {
    const completeSection = completeChar.repeat(completeLength);
    bar += colorize(completeSection, color);
  }

  // Add incomplete characters
  if (incompleteLength > 0) {
    const incompleteSection = incompleteChar.repeat(incompleteLength);
    bar += supportsColor ? incompleteSection : incompleteSection;
  }

  // Add percentage if requested
  if (showPercentage) {
    bar = `[${bar}] ${percentage}%`;
  } else {
    bar = `[${bar}]`;
  }

  return bar;
}

/**
 * Create a status badge with appropriate icon and color
 * @param {string} status - Status key from statusIndicators
 * @param {Object} options - Configuration options
 * @param {boolean} options.iconOnly - Only show the icon (default: false)
 * @param {boolean} options.labelOnly - Only show the label (default: false)
 * @param {boolean} options.useColor - Apply color to the output (default: true)
 * @returns {string} - Formatted status badge
 */
export function createStatusBadge(status, options = {}) {
  const { iconOnly = false, labelOnly = false, useColor = true } = options;

  // Get the status indicator or fallback to info
  const indicator = statusIndicators[status] || statusIndicators.info;

  // Format based on options
  if (iconOnly) {
    return indicator.symbol;
  }

  if (labelOnly) {
    return useColor
      ? colorize(indicator.label, indicator.color)
      : indicator.label;
  }

  // Return full badge
  return useColor
    ? `${indicator.symbol} ${colorize(indicator.label, indicator.color)}`
    : `${indicator.symbol} ${indicator.label}`;
}

/**
 * Format a percentage with appropriate styling
 * @param {number} value - Percentage value (0-100)
 * @param {Object} options - Configuration options
 * @param {boolean} options.showSymbol - Show percentage symbol (default: true)
 * @param {boolean} options.colorize - Apply color based on value (default: true)
 * @returns {string} - Formatted percentage
 */
export function formatPercentage(value, options = {}) {
  const { showSymbol = true, colorize: useColorize = true } = options;

  // Validate and format value
  const percentage = Math.max(0, Math.min(100, value));
  const formattedValue = showSymbol ? `${percentage}%` : `${percentage}`;

  // Determine color based on percentage
  let color = "gray";
  if (percentage >= 100) {
    color = "green";
  } else if (percentage >= 75) {
    color = "cyan";
  } else if (percentage >= 50) {
    color = "blue";
  } else if (percentage >= 25) {
    color = "yellow";
  } else if (percentage > 0) {
    color = "red";
  }

  return useColorize && supportsColor
    ? colorize(formattedValue, color)
    : formattedValue;
}

/**
 * Create a visual timeline representation
 * @param {Array} items - Array of timeline items with name and status
 * @param {Object} options - Configuration options
 * @param {boolean} options.useColor - Apply color to the output (default: true)
 * @param {boolean} options.compact - Use compact format (default: false)
 * @returns {string} - Formatted timeline
 */
export function createTimeline(items, options = {}) {
  const { useColor = true, compact = false } = options;

  if (!items || !items.length) return "";

  const lines = [];

  if (compact) {
    // Compact timeline: Items on a single line with icons
    const timelineItems = items.map(
      (item) =>
        `${createStatusBadge(item.status, {
          iconOnly: true,
        })} ${item.name}`,
    );
    lines.push(timelineItems.join(" → "));
  } else {
    // Standard timeline: Items with status badges on separate lines
    lines.push("Timeline:");
    items.forEach((item, index) => {
      const isLast = index === items.length - 1;
      const prefix = isLast ? "└─" : "├─";
      const status = createStatusBadge(item.status, { useColor });
      const date = item.date ? ` (${item.date})` : "";
      lines.push(`${prefix} ${status}: ${item.name}${date}`);
    });
  }

  return lines.join("\n");
}

/**
 * Create a visual representation of completion progress for phases/steps
 * @param {Object} data - Data with phases or steps and their completion status
 * @param {Object} options - Configuration options
 * @param {boolean} options.useColor - Apply color to the output (default: true)
 * @param {boolean} options.showDetails - Show detailed status per item (default: true)
 * @returns {string} - Formatted completion timeline
 */
export function createCompletionTimeline(data, options = {}) {
  const { useColor = true, showDetails = true } = options;

  if (!data || !data.items || !data.items.length) return "";

  const { title = "Completion Status", items } = data;
  const totalItems = items.length;
  const completedItems = items.filter(
    (item) => item.status === "completed",
  ).length;
  const completionPercentage = (completedItems / totalItems) * 100;

  const lines = [];
  lines.push(`## ${title}`);
  lines.push("");
  lines.push(
    `Overall: ${createProgressBar(completionPercentage, {
      width: 20,
      showPercentage: true,
    })}`,
  );
  lines.push("");

  if (showDetails) {
    items.forEach((item) => {
      const statusBadge = createStatusBadge(item.status, { useColor });
      const progressBar = item.progress
        ? ` ${createProgressBar(item.progress, { width: 10 })}`
        : "";
      lines.push(`${statusBadge} ${item.name}${progressBar}`);
    });
  }

  return lines.join("\n");
}

/**
 * Create a visual heatmap of completion status
 * @param {Array} items - Array of items with completion status/percentage
 * @param {Object} options - Configuration options
 * @param {number} options.columns - Number of columns in the heatmap (default: 10)
 * @param {boolean} options.useColor - Apply color to the output (default: true)
 * @param {boolean} options.showLabels - Show labels for each item (default: false)
 * @returns {string} - Formatted heatmap
 */
export function createCompletionHeatmap(items, options = {}) {
  const { columns = 10, useColor = true, showLabels = false } = options;

  if (!items || !items.length) return "";

  const rows = Math.ceil(items.length / columns);
  const lines = [];

  for (let row = 0; row < rows; row++) {
    let rowOutput = "";
    for (let col = 0; col < columns; col++) {
      const index = row * columns + col;
      if (index < items.length) {
        const item = items[index];

        // Determine the symbol based on status or percentage
        let symbol;
        let color;

        if (item.status) {
          const indicator =
            statusIndicators[item.status] || statusIndicators.info;
          symbol = indicator.symbol;
          color = indicator.color;
        } else if (item.percentage !== undefined) {
          // Use blocks based on percentage
          if (item.percentage >= 100) {
            symbol = "█";
            color = "green";
          } else if (item.percentage >= 75) {
            symbol = "▓";
            color = "cyan";
          } else if (item.percentage >= 50) {
            symbol = "▒";
            color = "blue";
          } else if (item.percentage >= 25) {
            symbol = "░";
            color = "yellow";
          } else {
            symbol = "·";
            color = "gray";
          }
        } else {
          symbol = "·";
          color = "gray";
        }

        // Add the symbol with optional coloring
        rowOutput += useColor ? colorize(symbol, color) : symbol;

        // Add space between cells
        if (col < columns - 1) rowOutput += " ";
      }
    }
    lines.push(rowOutput);

    // Add labels if requested
    if (showLabels) {
      let labelRow = "";
      for (let col = 0; col < columns; col++) {
        const index = row * columns + col;
        if (index < items.length) {
          const item = items[index];
          const label = item.label || item.name || index.toString();
          // Pad label to 3 characters
          const paddedLabel = label.substring(0, 3).padEnd(3, " ");
          labelRow += paddedLabel;

          // Add space between cells
          if (col < columns - 1) labelRow += " ";
        }
      }
      lines.push(labelRow);
      lines.push(""); // Empty line after labels
    }
  }

  return lines.join("\n");
}

/**
 * Get the available status indicators
 * @returns {Object} - Status indicators
 */
export function getStatusIndicators() {
  return { ...statusIndicators };
}

/**
 * Format a status object into a string with visual indicators
 * @param {Object} statusObject - Status object with status, progress, etc.
 * @returns {string} - Formatted status string
 */
export function formatStatusObject(statusObject) {
  if (!statusObject) return "";

  let result = "";

  // Progress bar
  if (statusObject.progress !== undefined) {
    result += `Progress: ${createProgressBar(statusObject.progress, {
      width: 10,
      showPercentage: true,
    })} `;
  }

  // Status badge
  if (statusObject.status) {
    result += `Status: ${createStatusBadge(statusObject.status)} `;
  }

  // Completion count
  if (
    statusObject.completed !== undefined &&
    statusObject.total !== undefined
  ) {
    const percentage = (statusObject.completed / statusObject.total) * 100;
    result += `Completion: [${statusObject.completed}/${
      statusObject.total
    }] ${formatPercentage(percentage)} `;
  }

  return result;
}

// Create a default export with all functions
const progressIndicators = {
  createProgressBar,
  createStatusBadge,
  formatPercentage,
  createTimeline,
  createCompletionTimeline,
  createCompletionHeatmap,
  formatStatusObject,
  getStatusIndicators,
  colorize,
};

export default progressIndicators;
