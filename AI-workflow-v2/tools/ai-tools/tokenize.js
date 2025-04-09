/**
 * Token Management Utility
 *
 * This utility provides functions for estimating token usage, optimizing content
 * for token efficiency, and managing token budgets within the AI Workflow Framework.
 *
 * Usage:
 *   import {
 *     estimateTokens,
 *     optimizeContent,
 *     allocateTokenBudget,
 *     analyzeBudgetUsage
 *   } from './tools/ai-tools/tokenize.js';
 *
 * Integration with AI Workflow Framework:
 *   This utility is part of the token management enhancement for the
 *   AI Workflow v2 framework. See guidelines/framework-rules/350-token-efficiency.md
 *   for more information on token efficiency guidelines.
 */

/**
 * Simple token estimation based on whitespace + punctuation
 * This is a basic approximation, as actual tokenization varies by model
 * @param {string} text - Text to estimate tokens for
 * @returns {number} - Estimated token count
 */
function estimateTokensSimple(text) {
  if (!text) return 0;

  // Normalize whitespace and remove excess spaces
  const normalizedText = text.replace(/\s+/g, " ").trim();

  // Simple word count (splitting on whitespace)
  const words = normalizedText.split(/\s+/).length;

  // Count punctuation marks as additional tokens
  const punctuationCount = (normalizedText.match(/[.,!?;:()[\]{}'"]/g) || [])
    .length;

  // Common tokenization ratio: about 4/3 tokens per word for English text
  return Math.ceil(words * 1.33) + punctuationCount;
}

/**
 * More accurate token estimation using character-based heuristics
 * Still an approximation, but closer to how tokenizers work
 * @param {string} text - Text to estimate tokens for
 * @returns {number} - Estimated token count
 */
function estimateTokensAccurate(text) {
  if (!text) return 0;

  // Remove excess whitespace
  const normalizedText = text.replace(/\s+/g, " ").trim();

  // Character count (starting point)
  const charCount = normalizedText.length;

  // Calculate token estimate based on character count
  // English text averages ~4 chars per token
  let tokenEstimate = charCount / 4;

  // Adjust for code/markup which typically has more tokens
  if (
    normalizedText.includes("```") ||
    normalizedText.includes("</") ||
    normalizedText.includes("/>")
  ) {
    tokenEstimate *= 1.2; // 20% more tokens for code/markup
  }

  // Adjust for heavy use of special characters
  const specialCharCount = (normalizedText.match(/[^a-zA-Z0-9\s]/g) || [])
    .length;
  const specialCharRatio = specialCharCount / charCount;
  if (specialCharRatio > 0.1) {
    // More than 10% special chars
    tokenEstimate *= 1 + specialCharRatio; // Proportionally increase
  }

  return Math.ceil(tokenEstimate);
}

/**
 * Most accurate estimation that mimics real tokenizers, using subword patterns
 * @param {string} text - Text to estimate tokens for
 * @param {Object} options - Configuration options
 * @returns {number} - Estimated token count
 */
function estimateTokensAdvanced(text, options = {}) {
  if (!text) return 0;

  const { model = "default" } = options;

  // Model-specific adjustments
  const modelFactors = {
    "gpt-3.5": 1.0,
    "gpt-4": 1.0,
    claude: 1.1, // Claude tends to use ~10% more tokens for the same text
    default: 1.0,
  };

  const factor = modelFactors[model] || modelFactors.default;

  // Start with accurate estimate
  let tokens = estimateTokensAccurate(text);

  // Apply model-specific factor
  tokens = Math.ceil(tokens * factor);

  // Adjustments for common token-expensive patterns
  if (text.includes("```json") || text.includes("```javascript")) {
    tokens += 10; // JSON and JavaScript blocks often tokenize inefficiently
  }

  // Adjustments for large numbers of newlines
  const newlineCount = (text.match(/\n/g) || []).length;
  if (newlineCount > 20) {
    tokens += Math.floor(newlineCount / 5); // Every 5 newlines add ~1 token beyond normal
  }

  return tokens;
}

/**
 * Main token estimation function that chooses the appropriate method
 * @param {string} text - Text to estimate tokens for
 * @param {Object} options - Configuration options
 * @param {string} options.mode - Estimation mode ('simple', 'accurate', 'advanced')
 * @param {string} options.model - Target model for estimation
 * @returns {number} - Estimated token count
 */
export function estimateTokens(text, options = {}) {
  const { mode = "accurate", model = "default" } = options;

  if (mode === "simple") {
    return estimateTokensSimple(text);
  } else if (mode === "advanced") {
    return estimateTokensAdvanced(text, { model });
  } else {
    // Default to accurate
    return estimateTokensAccurate(text);
  }
}

/**
 * Estimate tokens for a markdown document, with section breakdowns
 * @param {string} markdownText - Markdown text to analyze
 * @param {Object} options - Configuration options
 * @returns {Object} - Token breakdown by section
 */
export function analyzeMarkdownTokens(markdownText, options = {}) {
  if (!markdownText) {
    return {
      total: 0,
      sections: [],
    };
  }

  // Extract sections based on headings
  const sections = [];
  let currentHeading = "Frontmatter";
  let currentContent = "";
  let inFrontmatter = false;
  let frontmatterContent = "";

  // Split the document into lines
  const lines = markdownText.split("\n");

  // Process each line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for frontmatter
    if (i === 0 && line.trim() === "---") {
      inFrontmatter = true;
      continue;
    }

    if (inFrontmatter) {
      if (line.trim() === "---") {
        // End of frontmatter
        inFrontmatter = false;
        sections.push({
          title: "Frontmatter",
          content: frontmatterContent,
          tokens: estimateTokens(frontmatterContent, options),
        });
      } else {
        frontmatterContent += line + "\n";
      }
      continue;
    }

    // Check for headings
    if (line.match(/^#{1,6}\s/)) {
      // Save previous section
      if (currentContent.trim()) {
        sections.push({
          title: currentHeading,
          content: currentContent,
          tokens: estimateTokens(currentContent, options),
        });
      }

      // Start new section
      currentHeading = line.replace(/^#{1,6}\s/, "").trim();
      currentContent = line + "\n";
    } else {
      currentContent += line + "\n";
    }
  }

  // Add the final section
  if (currentContent.trim()) {
    sections.push({
      title: currentHeading,
      content: currentContent,
      tokens: estimateTokens(currentContent, options),
    });
  }

  // Calculate total tokens
  const total = sections.reduce((sum, section) => sum + section.tokens, 0);

  return {
    total,
    sections,
  };
}

/**
 * Optimize content for token efficiency
 * @param {string} text - Text to optimize
 * @param {Object} options - Configuration options
 * @returns {Object} - Optimized text and token savings
 */
export function optimizeContent(text, options = {}) {
  if (!text) {
    return {
      optimized: "",
      original: "",
      tokensBefore: 0,
      tokensAfter: 0,
      tokensSaved: 0,
      optimizations: [],
    };
  }

  const {
    aggressiveness = "medium",
    mode = "accurate",
    targetModel = "default",
  } = options;

  // Copy original text
  let optimized = text;
  const original = text;
  const optimizations = [];

  // Estimate initial tokens
  const tokensBefore = estimateTokens(original, {
    mode,
    model: targetModel,
  });

  // Utility function to apply and track optimizations
  function applyOptimization(name, description, transformFn) {
    const before = optimized;
    optimized = transformFn(optimized);
    const changed = before !== optimized;

    if (changed) {
      optimizations.push({
        name,
        description,
        applied: true,
      });
    }

    return changed;
  }

  // Remove redundant whitespace
  applyOptimization(
    "whitespace-normalization",
    "Normalize whitespace and remove redundant blank lines",
    (text) => {
      // Remove excess blank lines (more than 2 in a row)
      let result = text.replace(/\n{3,}/g, "\n\n");
      // Trim whitespace from end of lines
      result = result.replace(/[ \t]+$/gm, "");
      return result;
    },
  );

  // Remove redundant punctuation based on aggressiveness
  if (aggressiveness === "high") {
    applyOptimization(
      "punctuation-reduction",
      "Remove redundant punctuation marks",
      (text) => {
        // Replace multiple punctuation with single
        return text.replace(/([.!?]){2,}/g, "$1");
      },
    );
  }

  // Apply more aggressive transformations if requested
  if (aggressiveness === "high") {
    // Shorten separators like "-----" to "--"
    applyOptimization(
      "separator-shortening",
      "Shorten markdown separators",
      (text) => {
        return text.replace(/([#-*=])\1{3,}/g, "$1$1");
      },
    );

    // Convert bullet lists with long items to more concise forms
    applyOptimization(
      "list-condensing",
      "Condense verbose bullet lists",
      (text) => {
        return text.replace(
          /^\s*([-*+])\s+It is important to note that\b/gm,
          "$1 Note:",
        );
      },
    );
  }

  // Estimate final tokens
  const tokensAfter = estimateTokens(optimized, {
    mode,
    model: targetModel,
  });

  return {
    optimized,
    original,
    tokensBefore,
    tokensAfter,
    tokensSaved: tokensBefore - tokensAfter,
    optimizations,
  };
}

/**
 * Allocate token budget across multiple sections based on importance
 * @param {number} totalBudget - Total token budget to allocate
 * @param {Array} sections - Array of sections with importance weights
 * @returns {Object} - Budget allocation by section
 */
export function allocateTokenBudget(totalBudget, sections) {
  if (!Array.isArray(sections) || sections.length === 0) {
    return { total: totalBudget, sections: [] };
  }

  // Calculate total weight
  const totalWeight = sections.reduce(
    (sum, section) => sum + (section.weight || 1),
    0,
  );

  // Calculate base allocation without considering minimums
  const baseAllocations = sections.map((section) => {
    const weight = section.weight || 1;
    const rawAllocation = (weight / totalWeight) * totalBudget;
    return {
      ...section,
      rawAllocation,
    };
  });

  // Check if we need to handle minimum allocations
  const sectionsWithMinimums = baseAllocations.filter(
    (section) => section.minimum !== undefined && section.minimum > 0,
  );

  if (sectionsWithMinimums.length > 0) {
    // Calculate total minimum requirements
    const totalMinimum = sectionsWithMinimums.reduce(
      (sum, section) => sum + section.minimum,
      0,
    );

    // Check if minimum requirements exceed total budget
    if (totalMinimum > totalBudget) {
      // If minimums exceed budget, allocate proportionally to minimums
      return {
        total: totalBudget,
        sections: sections.map((section) => {
          const minimum = section.minimum || 0;
          return {
            ...section,
            allocation: minimum ? (minimum / totalMinimum) * totalBudget : 0,
          };
        }),
        warning: "Minimum requirements exceed total budget",
      };
    }

    // Reserve minimum allocations and distribute remaining budget
    const reservedBudget = totalMinimum;
    const remainingBudget = totalBudget - reservedBudget;

    // Recalculate weights for the remaining sections after minimums
    const remainingSections = baseAllocations.map((section) => {
      if (section.minimum !== undefined && section.minimum > 0) {
        return {
          ...section,
          effectiveWeight: 0, // Already allocated minimum
        };
      } else {
        return {
          ...section,
          effectiveWeight: section.weight || 1,
        };
      }
    });

    const totalRemainingWeight = remainingSections.reduce(
      (sum, section) => sum + section.effectiveWeight,
      0,
    );

    // Calculate final allocations
    return {
      total: totalBudget,
      sections: remainingSections.map((section) => {
        if (section.minimum !== undefined && section.minimum > 0) {
          return {
            ...section,
            allocation: section.minimum,
          };
        } else if (totalRemainingWeight > 0) {
          return {
            ...section,
            allocation:
              (section.effectiveWeight / totalRemainingWeight) *
              remainingBudget,
          };
        } else {
          return {
            ...section,
            allocation: 0,
          };
        }
      }),
    };
  } else {
    // Simple case: no minimum requirements
    return {
      total: totalBudget,
      sections: baseAllocations.map((section) => ({
        ...section,
        allocation: section.rawAllocation,
      })),
    };
  }
}

/**
 * Analyze the actual token usage compared to budget
 * @param {string|Array} content - Content to analyze (string or array of section objects)
 * @param {Object} budgetAllocation - Budget allocation from allocateTokenBudget
 * @param {Object} options - Configuration options
 * @returns {Object} - Analysis of budget usage
 */
export function analyzeBudgetUsage(content, budgetAllocation, options = {}) {
  const { mode = "accurate", model = "default" } = options;

  // Single string content
  if (typeof content === "string") {
    const totalTokens = estimateTokens(content, { mode, model });
    const totalBudget = budgetAllocation.total || 0;

    return {
      total: {
        budget: totalBudget,
        used: totalTokens,
        remaining: Math.max(0, totalBudget - totalTokens),
        overBudget: Math.max(0, totalTokens - totalBudget),
        percentUsed: totalBudget ? (totalTokens / totalBudget) * 100 : 100,
      },
      sections: [],
    };
  }

  // Array of section objects
  if (Array.isArray(content)) {
    const totalBudget = budgetAllocation.total || 0;
    let totalUsed = 0;

    const sectionAnalysis = content.map((section) => {
      // Find corresponding budget section
      const budgetSection = budgetAllocation.sections.find(
        (s) => s.id === section.id || s.title === section.title,
      );

      const sectionBudget = budgetSection ? budgetSection.allocation : 0;
      const sectionTokens = estimateTokens(section.content, { mode, model });
      totalUsed += sectionTokens;

      return {
        title: section.title,
        id: section.id,
        budget: sectionBudget,
        used: sectionTokens,
        remaining: Math.max(0, sectionBudget - sectionTokens),
        overBudget: Math.max(0, sectionTokens - sectionBudget),
        percentUsed: sectionBudget
          ? (sectionTokens / sectionBudget) * 100
          : 100,
      };
    });

    return {
      total: {
        budget: totalBudget,
        used: totalUsed,
        remaining: Math.max(0, totalBudget - totalUsed),
        overBudget: Math.max(0, totalUsed - totalBudget),
        percentUsed: totalBudget ? (totalUsed / totalBudget) * 100 : 100,
      },
      sections: sectionAnalysis,
    };
  }

  return {
    total: {
      budget: 0,
      used: 0,
      remaining: 0,
      overBudget: 0,
      percentUsed: 0,
    },
    sections: [],
  };
}

/**
 * Format a token usage analysis into a readable summary
 * @param {Object} usage - Token usage analysis from analyzeBudgetUsage
 * @returns {string} - Formatted summary
 */
export function formatTokenUsageSummary(usage) {
  if (!usage || !usage.total) {
    return "No token usage data available.";
  }

  const { total, sections } = usage;
  const { budget, used, remaining, overBudget, percentUsed } = total;

  // Format the status indicator
  let statusIndicator = "✅";
  if (percentUsed > 90 && percentUsed <= 100) {
    statusIndicator = "⚠️";
  } else if (percentUsed > 100) {
    statusIndicator = "❌";
  }

  let summary = `## Token Usage Summary\n\n`;
  summary += `${statusIndicator} **Overall**: ${used.toLocaleString()} / ${budget.toLocaleString()} tokens (${percentUsed.toFixed(
    1,
  )}%)\n\n`;

  if (sections && sections.length > 0) {
    summary += `### Section Breakdown\n\n`;
    for (const section of sections) {
      let sectionIndicator = "✅";
      if (section.percentUsed > 90 && section.percentUsed <= 100) {
        sectionIndicator = "⚠️";
      } else if (section.percentUsed > 100) {
        sectionIndicator = "❌";
      }

      summary += `${sectionIndicator} **${
        section.title
      }**: ${section.used.toLocaleString()} / ${section.budget.toLocaleString()} tokens (${section.percentUsed.toFixed(
        1,
      )}%)\n`;
    }
  }

  return summary;
}

/**
 * Generate suggestions for improving token efficiency
 * @param {string} content - Content to analyze
 * @param {Object} options - Configuration options
 * @returns {Array} - Array of suggestions
 */
export function generateTokenEfficiencySuggestions(content, options = {}) {
  if (!content) return [];

  const suggestions = [];

  // Check for redundant blank lines
  const blankLineMatches = content.match(/\n{3,}/g);
  if (blankLineMatches && blankLineMatches.length > 5) {
    suggestions.push({
      type: "blank-lines",
      title: "Reduce blank lines",
      description: `Found ${blankLineMatches.length} instances of multiple blank lines. Consolidate to single line breaks.`,
      priority: "high",
    });
  }

  // Check for ASCII art or excessive separators
  const separatorMatches = content.match(/[=\-*]{5,}/g);
  if (separatorMatches && separatorMatches.length > 3) {
    suggestions.push({
      type: "separators",
      title: "Simplify separators",
      description: `Found ${separatorMatches.length} long separators. Simplify or remove unnecessary separators.`,
      priority: "medium",
    });
  }

  // Check for long bullet lists
  const bulletListItems = (content.match(/^\s*[-*+]\s+.+$/gm) || []).length;
  if (bulletListItems > 20) {
    suggestions.push({
      type: "bullet-lists",
      title: "Consider condensing bullet lists",
      description: `Found ${bulletListItems} bullet list items. Consider condensing or using more concise formatting.`,
      priority: "medium",
    });
  }

  // Check for very long paragraphs
  const longParagraphs = (content.match(/[^\n]{500,}/g) || []).length;
  if (longParagraphs > 0) {
    suggestions.push({
      type: "long-paragraphs",
      title: "Optimize long paragraphs",
      description: `Found ${longParagraphs} very long paragraphs (500+ characters). Consider breaking these into smaller paragraphs or using more concise language.`,
      priority: "medium",
    });
  }

  // Check for repetitive text patterns
  const contentLowercase = content.toLowerCase();
  const commonPhrases = [
    "it is important to note that",
    "it should be noted that",
    "please note that",
    "it is worth mentioning that",
    "it is recommended that",
    "it is suggested that",
  ];

  for (const phrase of commonPhrases) {
    const count = (contentLowercase.match(new RegExp(phrase, "g")) || [])
      .length;
    if (count >= 2) {
      suggestions.push({
        type: "repetitive-phrases",
        title: "Remove repetitive phrases",
        description: `The phrase "${phrase}" appears ${count} times. Consider removing or shortening these introductory phrases.`,
        priority: "low",
      });
    }
  }

  return suggestions;
}

// Create a default export with all functions
const tokenize = {
  estimateTokens,
  analyzeMarkdownTokens,
  optimizeContent,
  allocateTokenBudget,
  analyzeBudgetUsage,
  formatTokenUsageSummary,
  generateTokenEfficiencySuggestions,
};

export default tokenize;
