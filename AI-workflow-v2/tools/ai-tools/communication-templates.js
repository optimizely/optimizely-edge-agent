/**
 * Communication Templates Utility
 *
 * A utility for generating standardized communication formats for AI assistants,
 * including clarification requests, uncertainty handling, and explanations.
 *
 * @module communication-templates
 * @requires progress-indicators
 */

import progressIndicators from "./progress-indicators.js";

/**
 * Implementation modes
 * @type {Object}
 */
export const IMPLEMENTATION_MODES = {
  MANUAL: "manual",
  SEMI: "semi",
  AUTO: "auto",
};

/**
 * Template types
 * @type {Object}
 */
export const TEMPLATE_TYPES = {
  CLARIFICATION: "clarification",
  UNCERTAINTY: "uncertainty",
  EXPLANATION: "explanation",
  STATUS: "status",
};

/**
 * Confidence levels for uncertainty communication
 * @type {Object}
 */
export const CONFIDENCE_LEVELS = {
  VERY_LOW: {
    name: "Very Low",
    range: [0, 20],
    symbol: "🔴",
    description: "Highly ambiguous or novel areas",
  },
  LOW: {
    name: "Low",
    range: [20, 50],
    symbol: "🟠",
    description: "Areas with significant ambiguity or complexity",
  },
  MEDIUM: {
    name: "Medium",
    range: [50, 80],
    symbol: "🟡",
    description: "Partially understood areas with some ambiguity",
  },
  HIGH: {
    name: "High",
    range: [80, 100],
    symbol: "🟢",
    description: "Well-understood areas with clear requirements",
  },
};

/**
 * Format helpers for consistent text formatting
 * @type {Object}
 */
export const FORMAT_HELPERS = {
  /**
   * Format a list of items
   * @param {Array} items - Array of items to format
   * @param {string} prefix - Prefix for each item
   * @returns {string} - Formatted list
   */
  formatList: (items, prefix = "-") => {
    if (!items || !Array.isArray(items) || items.length === 0) {
      return "";
    }
    return items.map((item) => `${prefix} ${item}`).join("\n");
  },

  /**
   * Format a list of numbered items
   * @param {Array} items - Array of items to format
   * @returns {string} - Formatted numbered list
   */
  formatNumberedList: (items) => {
    if (!items || !Array.isArray(items) || items.length === 0) {
      return "";
    }
    return items.map((item, index) => `${index + 1}. ${item}`).join("\n");
  },

  /**
   * Get confidence level indicator based on confidence percentage
   * @param {number} confidence - Confidence percentage (0-100)
   * @returns {Object} - Confidence level object
   */
  getConfidenceLevel: (confidence) => {
    if (typeof confidence !== "number" || confidence < 0 || confidence > 100) {
      throw new Error("Confidence must be a number between 0 and 100");
    }

    for (const [key, level] of Object.entries(CONFIDENCE_LEVELS)) {
      if (confidence >= level.range[0] && confidence <= level.range[1]) {
        return {
          ...level,
          key,
          value: confidence,
        };
      }
    }

    return CONFIDENCE_LEVELS.MEDIUM;
  },

  /**
   * Format confidence level for display
   * @param {number} confidence - Confidence percentage (0-100)
   * @returns {string} - Formatted confidence level
   */
  formatConfidence: (confidence) => {
    const level = FORMAT_HELPERS.getConfidenceLevel(confidence);
    return `${level.symbol} ${level.name} (${confidence}%)`;
  },
};

/**
 * Generate a clarification request template
 * @param {Object} options - Template options
 * @param {string} options.type - Clarification type ('scope', 'technical', 'requirements', 'dependency', 'priority')
 * @param {string} options.question - Specific question being asked
 * @param {string} options.context - Relevant context
 * @param {Array} options.options - Available options
 * @param {string} [options.recommendation] - Recommended option
 * @param {string} [options.currentUnderstanding] - Current understanding of the situation
 * @param {string} [options.impact] - Impact of the clarification
 * @param {string} options.mode - Implementation mode
 * @returns {string} - Formatted clarification request
 */
export function generateClarificationRequest(options) {
  const {
    type,
    question,
    context,
    options: choices,
    recommendation,
    currentUnderstanding,
    impact,
    mode = IMPLEMENTATION_MODES.MANUAL,
  } = options;

  // Determine template based on mode
  if (mode === IMPLEMENTATION_MODES.AUTO) {
    return generateAutoClarification(options);
  } else if (mode === IMPLEMENTATION_MODES.SEMI) {
    return generateSemiClarification(options);
  }

  // Default to manual mode (most detailed)
  let templateTitle = "Clarification Request";
  if (type) {
    const typeMap = {
      scope: "Scope Clarification Needed",
      technical: "Technical Direction Clarification",
      requirements: "Requirements Clarification",
      dependency: "Dependency Clarification",
      priority: "Priority Clarification",
    };
    templateTitle = typeMap[type] || templateTitle;
  }

  let template = `### ${templateTitle}\n`;
  template += `**Question**: ${question}\n`;

  if (context) {
    template += `**Context**: ${context}\n`;
  }

  if (currentUnderstanding) {
    template += `**Current Understanding**: ${currentUnderstanding}\n`;
  }

  if (impact) {
    template += `**Impact on Implementation**: ${impact}\n`;
  }

  if (choices && Array.isArray(choices) && choices.length > 0) {
    template += `**Options**:\n`;
    choices.forEach((option, index) => {
      template += `${index + 1}. ${option}\n`;
    });
  }

  if (recommendation) {
    template += `**Recommendation**: ${recommendation}\n`;
  }

  return template;
}

/**
 * Generate a clarification request for semi-automatic mode
 * @param {Object} options - Template options
 * @returns {string} - Formatted clarification request
 */
function generateSemiClarification(options) {
  const { type, question, context, options: choices, recommendation } = options;

  let component = type
    ? type.charAt(0).toUpperCase() + type.slice(1)
    : "Component";
  let template = `### ${component} Clarification\n`;
  template += `**Question**: ${question}\n`;

  if (context) {
    template += `**Key Context**: ${context}\n`;
  }

  if (choices && Array.isArray(choices) && choices.length > 0) {
    template += `**Options**:\n`;
    choices.forEach((option, index) => {
      template += `${index + 1}. ${option}\n`;
    });
  }

  if (recommendation) {
    template += `**Recommendation**: ${recommendation}\n\n`;
    template += `I'll proceed with this recommendation unless directed otherwise.`;
  }

  return template;
}

/**
 * Generate a clarification request for automatic mode
 * @param {Object} options - Template options
 * @returns {string} - Formatted clarification request
 */
function generateAutoClarification(options) {
  const { question, recommendation } = options;

  let template = `**CLARIFICATION NEEDED**: ${question}\n`;

  if (recommendation) {
    template += `**DEFAULT APPROACH**: I'll proceed with ${recommendation} unless instructed otherwise.`;
  }

  return template;
}

/**
 * Generate an uncertainty handling template
 * @param {Object} options - Template options
 * @param {number} options.confidence - Confidence percentage (0-100)
 * @param {string} options.topic - Topic or area of uncertainty
 * @param {string} options.reasoning - Reasoning for the confidence level
 * @param {Array} options.approaches - Possible approaches
 * @param {string} [options.recommendedApproach] - Recommended approach
 * @param {Array} [options.questions] - Questions to help resolve uncertainty
 * @param {string} options.mode - Implementation mode
 * @returns {string} - Formatted uncertainty handling template
 */
export function generateUncertaintyHandling(options) {
  const {
    confidence,
    topic,
    reasoning,
    approaches,
    recommendedApproach,
    questions,
    mode = IMPLEMENTATION_MODES.MANUAL,
  } = options;

  // Determine template based on mode
  if (mode === IMPLEMENTATION_MODES.AUTO) {
    return generateAutoUncertainty(options);
  } else if (mode === IMPLEMENTATION_MODES.SEMI) {
    return generateSemiUncertainty(options);
  }

  // Default to manual mode (most detailed)
  const confidenceFormatted = FORMAT_HELPERS.formatConfidence(confidence);
  let template = `### Uncertainty Handling: ${topic}\n`;
  template += `**Confidence Level**: ${confidenceFormatted}\n`;
  template += `**Reasoning**: ${reasoning}\n`;

  if (approaches && Array.isArray(approaches) && approaches.length > 0) {
    template += `**Possible Approaches**:\n`;
    approaches.forEach((approach, index) => {
      template += `${index + 1}. ${approach}\n`;
    });
  }

  if (recommendedApproach) {
    template += `**Recommended Approach**: ${recommendedApproach}\n`;
  }

  if (questions && Array.isArray(questions) && questions.length > 0) {
    template += `**Questions to Resolve Uncertainty**:\n`;
    questions.forEach((question, index) => {
      template += `${index + 1}. ${question}\n`;
    });
  }

  return template;
}

/**
 * Generate an uncertainty handling template for semi-automatic mode
 * @param {Object} options - Template options
 * @returns {string} - Formatted uncertainty handling template
 */
function generateSemiUncertainty(options) {
  const { confidence, topic, reasoning, recommendedApproach, questions } =
    options;

  const confidenceFormatted = FORMAT_HELPERS.formatConfidence(confidence);
  let template = `### Uncertainty: ${topic}\n`;
  template += `**Confidence**: ${confidenceFormatted}\n`;
  template += `**Key Concern**: ${reasoning}\n`;

  if (recommendedApproach) {
    template += `**Proposed Approach**: ${recommendedApproach}\n`;
  }

  if (questions && Array.isArray(questions) && questions.length > 0) {
    template += `**Clarifying Questions**:\n`;
    template += FORMAT_HELPERS.formatNumberedList(questions);
  }

  return template;
}

/**
 * Generate an uncertainty handling template for automatic mode
 * @param {Object} options - Template options
 * @returns {string} - Formatted uncertainty handling template
 */
function generateAutoUncertainty(options) {
  const { confidence, topic, recommendedApproach } = options;

  const confidenceFormatted = FORMAT_HELPERS.formatConfidence(confidence);
  let template = `**UNCERTAINTY**: ${topic} (${confidenceFormatted})\n`;

  if (recommendedApproach) {
    template += `**APPROACH**: ${recommendedApproach}`;
  }

  return template;
}

/**
 * Generate an explanation template
 * @param {Object} options - Template options
 * @param {string} options.topic - Topic to explain
 * @param {string} options.explanation - Main explanation content
 * @param {Array} [options.examples] - Examples to illustrate
 * @param {Array} [options.alternatives] - Alternative approaches
 * @param {string} [options.reasoning] - Reasoning behind the explanation
 * @param {string} options.mode - Implementation mode
 * @returns {string} - Formatted explanation template
 */
export function generateExplanation(options) {
  const {
    topic,
    explanation,
    examples,
    alternatives,
    reasoning,
    mode = IMPLEMENTATION_MODES.MANUAL,
  } = options;

  // Determine template based on mode
  if (mode === IMPLEMENTATION_MODES.AUTO) {
    return generateAutoExplanation(options);
  } else if (mode === IMPLEMENTATION_MODES.SEMI) {
    return generateSemiExplanation(options);
  }

  // Default to manual mode (most detailed)
  let template = `### Explanation: ${topic}\n`;
  template += `${explanation}\n`;

  if (reasoning) {
    template += `**Reasoning**: ${reasoning}\n`;
  }

  if (examples && Array.isArray(examples) && examples.length > 0) {
    template += `**Examples**:\n`;
    examples.forEach((example, index) => {
      template += `${index + 1}. ${example}\n`;
    });
  }

  if (alternatives && Array.isArray(alternatives) && alternatives.length > 0) {
    template += `**Alternatives Considered**:\n`;
    alternatives.forEach((alternative, index) => {
      template += `${index + 1}. ${alternative}\n`;
    });
  }

  return template;
}

/**
 * Generate an explanation template for semi-automatic mode
 * @param {Object} options - Template options
 * @returns {string} - Formatted explanation template
 */
function generateSemiExplanation(options) {
  const { topic, explanation, examples } = options;

  let template = `### ${topic}\n`;
  template += `${explanation}\n`;

  if (examples && Array.isArray(examples) && examples.length > 0) {
    template += `**Example**:\n`;
    template += `${examples[0]}\n`;
  }

  return template;
}

/**
 * Generate an explanation template for automatic mode
 * @param {Object} options - Template options
 * @returns {string} - Formatted explanation template
 */
function generateAutoExplanation(options) {
  const { topic, explanation } = options;

  return `**${topic}**: ${explanation}`;
}

/**
 * Generate a status update template
 * @param {Object} options - Template options
 * @param {string} options.status - Current status ('in_progress', 'completed', 'blocked', 'planning')
 * @param {number} options.progress - Progress percentage (0-100)
 * @param {string} options.component - Component or phase being worked on
 * @param {Array} options.completedSteps - Completed steps
 * @param {string} options.currentStep - Current step
 * @param {Array} options.remainingSteps - Remaining steps
 * @param {Array} [options.issues] - Issues or blockers
 * @param {string} options.mode - Implementation mode
 * @returns {string} - Formatted status update template
 */
export function generateStatusUpdate(options) {
  const {
    status,
    progress,
    component,
    completedSteps,
    currentStep,
    remainingSteps,
    issues,
    mode = IMPLEMENTATION_MODES.MANUAL,
  } = options;

  // Create progress bar
  const progressBar = progressIndicators.createProgressBar(progress, {
    width: 20,
    showPercentage: true,
  });

  const progressText = `${
    component || "Implementation"
  } Progress: ${progressBar}`;

  // Determine template based on mode
  if (mode === IMPLEMENTATION_MODES.AUTO) {
    return generateAutoStatus(options, progressBar, progressText);
  } else if (mode === IMPLEMENTATION_MODES.SEMI) {
    return generateSemiStatus(options, progressBar, progressText);
  }

  // Default to manual mode (most detailed)
  const statusMap = {
    in_progress: "🔄 In Progress",
    completed: "✅ Completed",
    blocked: "⚠️ Blocked",
    planning: "🟡 Planning",
  };
  const statusDisplay = statusMap[status] || status;

  let template = `## Status Update: ${component || "Implementation"}\n`;
  template += `**Status**: ${statusDisplay}\n`;
  template += `**Progress**: ${progressBar}\n`;
  template += `\n`;

  if (
    completedSteps &&
    Array.isArray(completedSteps) &&
    completedSteps.length > 0
  ) {
    template += `**Completed Steps**:\n`;
    completedSteps.forEach((step) => {
      template += `✅ ${step}\n`;
    });
    template += `\n`;
  }

  if (currentStep) {
    template += `**Current Step**: 🔄 ${currentStep}\n\n`;
  }

  if (
    remainingSteps &&
    Array.isArray(remainingSteps) &&
    remainingSteps.length > 0
  ) {
    template += `**Remaining Steps**:\n`;
    remainingSteps.forEach((step) => {
      template += `⏹️ ${step}\n`;
    });
    template += `\n`;
  }

  if (issues && Array.isArray(issues) && issues.length > 0) {
    template += `**Issues/Blockers**:\n`;
    issues.forEach((issue) => {
      template += `⚠️ ${issue}\n`;
    });
  }

  return template;
}

/**
 * Generate a status update template for semi-automatic mode
 * @param {Object} options - Template options
 * @param {string} progressBar - Formatted progress bar
 * @param {string} progressText - Formatted progress text
 * @returns {string} - Formatted status update template
 */
function generateSemiStatus(options, progressBar, progressText) {
  const { status, currentStep, issues } = options;

  const statusMap = {
    in_progress: "🔄 In Progress",
    completed: "✅ Completed",
    blocked: "⚠️ Blocked",
    planning: "🟡 Planning",
  };
  const statusDisplay = statusMap[status] || status;

  let template = `### Status Update\n`;
  template += `${progressText}\n`;
  template += `**Status**: ${statusDisplay}\n`;

  if (currentStep) {
    template += `**Current**: ${currentStep}\n`;
  }

  if (issues && Array.isArray(issues) && issues.length > 0) {
    template += `**Issues**: ${issues[0]}${
      issues.length > 1 ? ` (+ ${issues.length - 1} more)` : ""
    }\n`;
  }

  return template;
}

/**
 * Generate a status update template for automatic mode
 * @param {Object} options - Template options
 * @param {string} progressBar - Formatted progress bar
 * @param {string} progressText - Formatted progress text
 * @returns {string} - Formatted status update template
 */
function generateAutoStatus(options, progressBar, progressText) {
  const { status, currentStep } = options;

  const statusMap = {
    in_progress: "🔄",
    completed: "✅",
    blocked: "⚠️",
    planning: "🟡",
  };
  const statusSymbol = statusMap[status] || "";

  let template = `${statusSymbol} ${progressText}`;

  if (currentStep) {
    template += ` | ${currentStep}`;
  }

  return template;
}

/**
 * Generate a memory refresh template
 * @param {Object} options - Template options
 * @param {string} options.originalTask - Original task description
 * @param {Array} options.inScope - In-scope items
 * @param {Array} options.outOfScope - Out-of-scope items
 * @param {Array} options.completedSteps - Completed steps
 * @param {string} options.currentStep - Current step
 * @param {Array} options.remainingSteps - Remaining steps
 * @param {number} options.progress - Progress percentage (0-100)
 * @param {string} options.mode - Implementation mode
 * @returns {string} - Formatted memory refresh template
 */
export function generateMemoryRefresh(options) {
  const {
    originalTask,
    inScope,
    outOfScope,
    completedSteps,
    currentStep,
    remainingSteps,
    progress,
    mode = IMPLEMENTATION_MODES.MANUAL,
  } = options;

  // Create progress bar
  const progressBar = progressIndicators.createProgressBar(progress, {
    width: 20,
    showPercentage: true,
  });

  // Format step lists
  const completedStepsList =
    completedSteps && Array.isArray(completedSteps)
      ? completedSteps.map((step) => `✅ ${step}`).join("\n")
      : "";

  const currentStepItem = currentStep ? `🔄 ${currentStep}` : "";

  const remainingStepsList =
    remainingSteps && Array.isArray(remainingSteps)
      ? remainingSteps.map((step) => `⏹️ ${step}`).join("\n")
      : "";

  // Format scope lists
  const inScopeList =
    inScope && Array.isArray(inScope)
      ? inScope.map((item) => `✅ ${item}`).join("\n")
      : "";

  const outOfScopeList =
    outOfScope && Array.isArray(outOfScope)
      ? outOfScope.map((item) => `❌ ${item}`).join("\n")
      : "";

  // Determine template based on mode
  if (mode === IMPLEMENTATION_MODES.AUTO) {
    return generateAutoMemoryRefresh(options, progressBar);
  } else if (mode === IMPLEMENTATION_MODES.SEMI) {
    return generateSemiMemoryRefresh(
      options,
      progressBar,
      inScopeList,
      outOfScopeList,
      completedStepsList,
      currentStepItem,
      remainingStepsList,
    );
  }

  // Default to manual mode (most detailed)
  let template = `### Implementation Memory Refresh\n`;
  template += `**Original Task**: ${originalTask}\n\n`;

  template += `**Scope Boundaries**:\n`;
  if (inScopeList) {
    template += `**IN SCOPE**:\n${inScopeList}\n\n`;
  }
  if (outOfScopeList) {
    template += `**OUT OF SCOPE**:\n${outOfScopeList}\n\n`;
  }

  template += `**Progress Summary**:\n`;
  if (completedStepsList) {
    template += `**Completed**:\n${completedStepsList}\n\n`;
  }
  if (currentStepItem) {
    template += `**Current**:\n${currentStepItem}\n\n`;
  }
  if (remainingStepsList) {
    template += `**Remaining**:\n${remainingStepsList}\n\n`;
  }

  template += `**Progress**: ${progressBar}\n\n`;
  template += `**Focus Commitment**: I will maintain strict focus on the current step without expanding scope.`;

  return template;
}

/**
 * Generate a memory refresh template for semi-automatic mode
 * @param {Object} options - Template options
 * @param {string} progressBar - Formatted progress bar
 * @param {string} inScope - Formatted in-scope items
 * @param {string} outOfScope - Formatted out-of-scope items
 * @param {string} completedStepsList - Formatted completed steps
 * @param {string} currentStepItem - Formatted current step
 * @param {string} remainingStepsList - Formatted remaining steps
 * @returns {string} - Formatted memory refresh template
 */
function generateSemiMemoryRefresh(
  options,
  progressBar,
  inScope,
  outOfScope,
  completedStepsList,
  currentStepItem,
  remainingStepsList,
) {
  const { originalTask } = options;

  let template = `### Memory Refresh\n`;
  template += `**Task**: ${originalTask}\n\n`;

  template += `**Scope**: ${
    inScope ? "In: " + inScope.split("\n")[0] + "..." : ""
  } ${outOfScope ? "Out: " + outOfScope.split("\n")[0] + "..." : ""}\n\n`;

  template += `**Progress**: ${progressBar}\n`;
  if (currentStepItem) {
    template += `**Current**: ${currentStepItem}\n`;
  }

  return template;
}

/**
 * Generate a memory refresh template for automatic mode
 * @param {Object} options - Template options
 * @param {string} progressBar - Formatted progress bar
 * @returns {string} - Formatted memory refresh template
 */
function generateAutoMemoryRefresh(options, progressBar) {
  const { currentStep } = options;

  let template = `🔄 **MEMORY REFRESH**: ${progressBar}`;

  if (currentStep) {
    template += ` | Current: ${currentStep}`;
  }

  return template;
}

/**
 * Generate a template based on type
 * @param {string} type - Template type
 * @param {Object} options - Template options
 * @returns {string} - Formatted template
 */
export function generateTemplate(type, options) {
  switch (type) {
    case TEMPLATE_TYPES.CLARIFICATION:
      return generateClarificationRequest(options);
    case TEMPLATE_TYPES.UNCERTAINTY:
      return generateUncertaintyHandling(options);
    case TEMPLATE_TYPES.EXPLANATION:
      return generateExplanation(options);
    case TEMPLATE_TYPES.STATUS:
      return generateStatusUpdate(options);
    default:
      throw new Error(`Unknown template type: ${type}`);
  }
}

/**
 * Default export with all functions for convenient imports
 */
export default {
  generateClarificationRequest,
  generateUncertaintyHandling,
  generateExplanation,
  generateStatusUpdate,
  generateMemoryRefresh,
  generateTemplate,
  IMPLEMENTATION_MODES,
  TEMPLATE_TYPES,
  CONFIDENCE_LEVELS,
  FORMAT_HELPERS,
};
