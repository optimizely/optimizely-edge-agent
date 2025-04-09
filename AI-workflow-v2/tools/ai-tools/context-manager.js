/**
 * Context Manager Utility
 *
 * A utility for managing AI assistant context windows, including context size estimation,
 * compression utilities, and state management functions.
 *
 * @module context-manager
 * @requires tokenize
 */

import tokenize from "./tokenize.js";

/**
 * Default context budget allocation by category
 * @type {Object}
 */
const DEFAULT_CONTEXT_BUDGET = {
  planDefinition: 0.25, // 25% - Core requirements and plan structure
  implementationState: 0.2, // 20% - Current status and progress
  currentFocus: 0.35, // 35% - Active implementation details
  supportingContent: 0.15, // 15% - References and guidelines
  reservedSpace: 0.05, // 5%  - Buffer for unexpected needs
};

/**
 * Priority levels for content
 * @type {Object}
 */
const PRIORITY_LEVELS = {
  CRITICAL: "critical",
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
  PERIPHERAL: "peripheral",
};

/**
 * Estimates token usage for a piece of content
 * @param {string} content - The content to estimate
 * @returns {number} - Estimated token count
 */
export function estimateTokens(content) {
  return tokenize.estimateTokenCount(content);
}

/**
 * Calculates context budget allocation based on total available tokens
 * @param {number} totalTokens - Total available context tokens
 * @param {Object} [budgetAllocation=DEFAULT_CONTEXT_BUDGET] - Custom budget allocation
 * @returns {Object} - Token budget for each category
 */
export function calculateContextBudget(
  totalTokens,
  budgetAllocation = DEFAULT_CONTEXT_BUDGET,
) {
  const budget = {};

  for (const [category, percentage] of Object.entries(budgetAllocation)) {
    budget[category] = Math.floor(totalTokens * percentage);
  }

  return budget;
}

/**
 * Creates a context state object for tracking implementation context
 * @param {Object} options - Configuration options
 * @param {number} [options.totalTokens=16000] - Total available context tokens
 * @param {Object} [options.budgetAllocation] - Custom budget allocation
 * @param {string} [options.implementationMode='manual'] - Implementation mode (manual, semi, auto)
 * @returns {Object} - Context state object
 */
export function createContextState(options = {}) {
  const {
    totalTokens = 16000,
    budgetAllocation = DEFAULT_CONTEXT_BUDGET,
    implementationMode = "manual",
  } = options;

  const budget = calculateContextBudget(totalTokens, budgetAllocation);

  return {
    totalTokens,
    budget,
    implementationMode,
    usage: {
      planDefinition: 0,
      implementationState: 0,
      currentFocus: 0,
      supportingContent: 0,
      reservedSpace: 0,
    },
    content: {
      planDefinition: "",
      implementationState: "",
      currentFocus: "",
      supportingContent: "",
    },
  };
}

/**
 * Updates a section of the context state with new content
 * @param {Object} contextState - Current context state
 * @param {string} category - Category to update
 * @param {string} content - New content
 * @param {boolean} [append=false] - Whether to append or replace content
 * @returns {Object} - Updated context state
 */
export function updateContextSection(
  contextState,
  category,
  content,
  append = false,
) {
  if (!contextState.content.hasOwnProperty(category)) {
    throw new Error(`Invalid context category: ${category}`);
  }

  const newContent = append
    ? contextState.content[category] + "\n\n" + content
    : content;

  const newTokens = estimateTokens(newContent);

  contextState.content[category] = newContent;
  contextState.usage[category] = newTokens;

  return contextState;
}

/**
 * Checks if adding content would exceed the budget for a category
 * @param {Object} contextState - Current context state
 * @param {string} category - Category to check
 * @param {string} content - Content to add
 * @returns {boolean} - Whether adding the content would exceed the budget
 */
export function wouldExceedBudget(contextState, category, content) {
  if (!contextState.content.hasOwnProperty(category)) {
    throw new Error(`Invalid context category: ${category}`);
  }

  const contentTokens = estimateTokens(content);

  // If appending, calculate total tokens
  const totalTokens = contextState.usage[category] + contentTokens;

  return totalTokens > contextState.budget[category];
}

/**
 * Get the total token usage across all categories
 * @param {Object} contextState - Current context state
 * @returns {number} - Total tokens used
 */
export function getTotalUsage(contextState) {
  return Object.values(contextState.usage).reduce(
    (total, usage) => total + usage,
    0,
  );
}

/**
 * Get the remaining token budget
 * @param {Object} contextState - Current context state
 * @returns {number} - Remaining tokens
 */
export function getRemainingBudget(contextState) {
  return contextState.totalTokens - getTotalUsage(contextState);
}

/**
 * Checks if the context state is approaching capacity
 * @param {Object} contextState - Current context state
 * @param {number} [thresholdPercentage=90] - Threshold percentage
 * @returns {boolean} - Whether context is approaching capacity
 */
export function isApproachingCapacity(contextState, thresholdPercentage = 90) {
  const usagePercentage =
    (getTotalUsage(contextState) / contextState.totalTokens) * 100;
  return usagePercentage >= thresholdPercentage;
}

/**
 * Compresses context based on priority levels
 * @param {Object} contextState - Current context state
 * @param {number} [targetReduction=0.3] - Target reduction percentage (0-1)
 * @returns {Object} - Compressed context state
 */
export function compressContext(contextState, targetReduction = 0.3) {
  const clonedState = JSON.parse(JSON.stringify(contextState));
  const currentTotal = getTotalUsage(clonedState);
  const targetTotal = currentTotal * (1 - targetReduction);

  // Compression strategy based on implementation mode
  const compressionStrategy = getCompressionStrategy(
    clonedState.implementationMode,
  );

  // Apply different compression levels based on the implementation mode
  for (const [category, compressionLevel] of Object.entries(
    compressionStrategy,
  )) {
    if (!clonedState.content[category]) continue;

    clonedState.content[category] = applyCompression(
      clonedState.content[category],
      compressionLevel,
    );

    clonedState.usage[category] = estimateTokens(clonedState.content[category]);
  }

  return clonedState;
}

/**
 * Get compression strategy based on implementation mode
 * @param {string} mode - Implementation mode
 * @returns {Object} - Compression strategy
 */
export function getCompressionStrategy(mode) {
  const strategies = {
    manual: {
      planDefinition: 0.2, // 20% reduction
      implementationState: 0.1, // 10% reduction
      currentFocus: 0.05, // 5% reduction
      supportingContent: 0.4, // 40% reduction
    },
    semi: {
      planDefinition: 0.3, // 30% reduction
      implementationState: 0.2, // 20% reduction
      currentFocus: 0.1, // 10% reduction
      supportingContent: 0.5, // 50% reduction
    },
    auto: {
      planDefinition: 0.4, // 40% reduction
      implementationState: 0.3, // 30% reduction
      currentFocus: 0.15, // 15% reduction
      supportingContent: 0.6, // 60% reduction
    },
  };

  return strategies[mode] || strategies.manual;
}

/**
 * Apply compression to content based on compression level
 * @param {string} content - Content to compress
 * @param {number} compressionLevel - Compression level (0-1)
 * @returns {string} - Compressed content
 */
export function applyCompression(content, compressionLevel) {
  // Simple compression strategy: if level is high enough, apply more aggressive summarization
  if (compressionLevel >= 0.5) {
    // Extract section headers and create a high-level summary
    const sections = content.match(/##+ [^\n]+/g) || [];
    const firstParagraph = content.split("\n\n")[0] || "";

    return `${firstParagraph}\n\nSections: ${sections.join(", ")}`;
  } else if (compressionLevel >= 0.3) {
    // Keep first paragraph of each section
    const sections = content.split(/##+ [^\n]+/g).filter(Boolean);
    const headers = content.match(/##+ [^\n]+/g) || [];

    let result = "";
    for (let i = 0; i < Math.min(headers.length, sections.length); i++) {
      const sectionContent = sections[i].split("\n\n")[0] || "";
      result += `${headers[i]}\n${sectionContent}\n\n`;
    }

    return result;
  } else if (compressionLevel > 0) {
    // Remove code examples and detailed lists
    let compressed = content
      .replace(/```[\s\S]*?```/g, "[CODE EXAMPLE]")
      .replace(/\n- .+(?:\n  .+)*/g, (match) => {
        const items = match.split("\n- ").filter(Boolean);
        if (items.length <= 3) return match;
        return `\n- ${items[0]}\n- ${items[1]}\n- ...and ${
          items.length - 2
        } more items`;
      });

    return compressed;
  }

  return content;
}

/**
 * Generate a context snapshot with priority-based content
 * @param {Object} contextState - Current context state
 * @returns {string} - Formatted context snapshot
 */
export function generateContextSnapshot(contextState) {
  const { content, usage, budget } = contextState;

  // Calculate usage percentages
  const usagePercentages = {};
  for (const [category, tokens] of Object.entries(usage)) {
    usagePercentages[category] = Math.round((tokens / budget[category]) * 100);
  }

  const totalUsage = getTotalUsage(contextState);
  const totalPercentage = Math.round(
    (totalUsage / contextState.totalTokens) * 100,
  );

  // Generate progress bar for total usage
  const progressBar = generateProgressBar(totalPercentage);

  return `## Context Snapshot
  
**Total Context Usage**: ${progressBar} ${totalPercentage}% (${totalUsage}/${
    contextState.totalTokens
  } tokens)

### Category Usage
- Plan Definition: ${usagePercentages.planDefinition}% (${
    usage.planDefinition
  }/${budget.planDefinition} tokens)
- Implementation State: ${usagePercentages.implementationState}% (${
    usage.implementationState
  }/${budget.implementationState} tokens)
- Current Focus: ${usagePercentages.currentFocus}% (${usage.currentFocus}/${
    budget.currentFocus
  } tokens)
- Supporting Content: ${usagePercentages.supportingContent}% (${
    usage.supportingContent
  }/${budget.supportingContent} tokens)

### Context Management Recommendations
${getContextRecommendations(contextState)}
`;
}

/**
 * Generate recommendations based on context state
 * @param {Object} contextState - Current context state
 * @returns {string} - Formatted recommendations
 */
export function getContextRecommendations(contextState) {
  const { usage, budget } = contextState;
  const recommendations = [];

  // Check each category for potential issues
  for (const [category, tokens] of Object.entries(usage)) {
    const percentage = (tokens / budget[category]) * 100;

    if (percentage > 90) {
      recommendations.push(
        `- **${formatCategoryName(
          category,
        )}**: Exceeded 90% of budget. Consider compressing this section.`,
      );
    } else if (percentage > 70) {
      recommendations.push(
        `- **${formatCategoryName(
          category,
        )}**: Approaching capacity. Monitor this section.`,
      );
    }
  }

  // Add overall recommendation if needed
  const totalUsage = getTotalUsage(contextState);
  const totalPercentage = (totalUsage / contextState.totalTokens) * 100;

  if (totalPercentage > 90) {
    recommendations.push(
      "- **CRITICAL**: Total context approaching maximum capacity. Aggressive compression recommended.",
    );
  } else if (totalPercentage > 70) {
    recommendations.push(
      "- **WARNING**: Context usage is high. Consider compression strategies.",
    );
  }

  return recommendations.length > 0
    ? recommendations.join("\n")
    : "- No critical issues detected.";
}

/**
 * Format category name for display
 * @param {string} category - Category name in camelCase
 * @returns {string} - Formatted category name
 */
export function formatCategoryName(category) {
  return category
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase());
}

/**
 * Generate a progress bar
 * @param {number} percentage - Percentage (0-100)
 * @returns {string} - ASCII progress bar
 */
export function generateProgressBar(percentage) {
  const width = 10;
  const filledWidth = Math.round((percentage / 100) * width);
  const emptyWidth = width - filledWidth;

  const filled = "█".repeat(filledWidth);
  const empty = "░".repeat(emptyWidth);

  return `[${filled}${empty}]`;
}

/**
 * Create a memory refresh block with compressed state information
 * @param {Object} contextState - Current context state
 * @param {Object} options - Options for memory refresh
 * @param {string} options.originalTask - Original implementation goal
 * @param {Object} options.scopeBoundaries - Scope boundaries object
 * @param {string[]} options.completedSteps - List of completed steps
 * @param {string} options.currentStep - Current step
 * @param {string[]} options.remainingSteps - List of remaining steps
 * @returns {string} - Formatted memory refresh block
 */
export function createMemoryRefresh(contextState, options) {
  const {
    originalTask,
    scopeBoundaries,
    completedSteps,
    currentStep,
    remainingSteps,
  } = options;

  // Calculate progress percentage
  const totalSteps = completedSteps.length + 1 + remainingSteps.length;
  const completedPercentage = Math.round(
    (completedSteps.length / totalSteps) * 100,
  );
  const progressBar = generateProgressBar(completedPercentage);

  // Format scope boundaries
  const inScopeItems = scopeBoundaries.inScope
    .map((item) => `✅ ${item}`)
    .join("\n- ");
  const outOfScopeItems = scopeBoundaries.outOfScope
    .map((item) => `❌ ${item}`)
    .join("\n- ");

  // Format steps based on numbers
  const completedStepsList = completedSteps
    .map((step) => `✅ ${step}`)
    .join("\n- ");
  const currentStepItem = `🔄 ${currentStep}`;
  const remainingStepsList = remainingSteps
    .map((step) => `⏹️ ${step}`)
    .join("\n- ");

  return `### Implementation Memory Refresh
**Original Task**: ${originalTask}

**Scope Boundaries**:
- IN SCOPE: 
  - ${inScopeItems}
- OUT OF SCOPE: 
  - ${outOfScopeItems}

**Progress Summary**:
- Completed: 
  - ${completedStepsList}
- Current: 
  - ${currentStepItem}
- Remaining: 
  - ${remainingStepsList}

**Progress**: ${progressBar} ${completedPercentage}%

**Focus Commitment**: I will maintain strict focus on the current step without expanding scope.
`;
}

/**
 * Creates a state snapshot for implementation tracking
 * @param {Object} options - Configuration options
 * @param {Array} options.completedSteps - List of completed steps
 * @param {string} options.currentStep - Current step in progress
 * @param {Array} options.modifiedFiles - List of modified files
 * @param {string} options.currentFocus - Description of current focus
 * @param {number} options.progressPercentage - Progress percentage (0-100)
 * @param {Object} options.planAlignment - Plan alignment information
 * @returns {string} - Formatted state snapshot
 */
export function createStateSnapshot(options) {
  const {
    completedSteps,
    currentStep,
    modifiedFiles,
    currentFocus,
    progressPercentage,
    planAlignment,
  } = options;

  const progressBar = generateProgressBar(progressPercentage);

  // Format steps with status indicators
  const stepsWithStatus = completedSteps
    .map((step) => `  - ✅ ${step}`)
    .concat([`  - 🔄 ${currentStep}`])
    .join("\n");

  // Format modified files list
  const filesList =
    modifiedFiles && modifiedFiles.length > 0
      ? modifiedFiles.map((file) => `  - ${file}`).join("\n")
      : "  - None";

  // Determine alignment status
  const alignmentStatus = planAlignment.deviationAssessment
    .toLowerCase()
    .includes("no deviation")
    ? "✓ ALIGNED WITH PLAN"
    : "⚠️ POTENTIAL DEVIATION DETECTED";

  // Build the state snapshot
  return `### Implementation State Snapshot
**Current State**:
- Completed Steps:
${stepsWithStatus}
- Modified Files:
${filesList}
- Current Focus: 🔄 ${currentFocus}
**Progress**: ${progressBar} ${progressPercentage}%
**Plan Alignment Check**:
- Original Plan: ${planAlignment.originalPlan}
- Actual Changes: ${planAlignment.actualChanges}
- Deviation Assessment: ${planAlignment.deviationAssessment}
**State Verification**: ${alignmentStatus}
`;
}

/**
 * Prioritize content based on context stage
 * @param {Object} content - Content object with keys by type
 * @param {string} currentFocus - Current implementation focus
 * @returns {Object} - Prioritized content with priorities assigned
 */
export function prioritizeContent(content, currentFocus) {
  const prioritized = {};

  // Set default priorities
  for (const [key, value] of Object.entries(content)) {
    prioritized[key] = {
      content: value,
      priority: PRIORITY_LEVELS.MEDIUM,
    };
  }

  // Adjust priorities based on current focus
  if (content.scopeBoundaries) {
    prioritized.scopeBoundaries.priority = PRIORITY_LEVELS.CRITICAL;
  }

  if (content.currentStep) {
    prioritized.currentStep.priority = PRIORITY_LEVELS.CRITICAL;
  }

  if (content.progressTracking) {
    prioritized.progressTracking.priority = PRIORITY_LEVELS.HIGH;
  }

  // Prioritize content related to current focus
  for (const [key, value] of Object.entries(prioritized)) {
    if (key.toLowerCase().includes(currentFocus.toLowerCase())) {
      // Increase priority of anything related to current focus
      if (value.priority === PRIORITY_LEVELS.MEDIUM) {
        value.priority = PRIORITY_LEVELS.HIGH;
      } else if (value.priority === PRIORITY_LEVELS.LOW) {
        value.priority = PRIORITY_LEVELS.MEDIUM;
      }
    }
  }

  return prioritized;
}

// Export constants for external use
export { DEFAULT_CONTEXT_BUDGET, PRIORITY_LEVELS };

// Default export for backward compatibility
export default {
  estimateTokens,
  calculateContextBudget,
  createContextState,
  updateContextSection,
  wouldExceedBudget,
  getTotalUsage,
  getRemainingBudget,
  isApproachingCapacity,
  compressContext,
  getCompressionStrategy,
  applyCompression,
  generateContextSnapshot,
  getContextRecommendations,
  formatCategoryName,
  generateProgressBar,
  createMemoryRefresh,
  createStateSnapshot,
  prioritizeContent,
  DEFAULT_CONTEXT_BUDGET,
  PRIORITY_LEVELS,
};
