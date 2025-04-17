/**
 * @fileoverview Integrated Test Runner
 * 
 * This module provides a unified runner that integrates the structured logging framework
 * with the evidence storage system. It enables running tests with comprehensive logging
 * and evidence collection, ensuring all test executions are properly documented and verified.
 * 
 * Created as part of the Testing Audit Reconciliation project (testing-audit-reconciliation-04-10-2025)
 */

const { TestLogger } = require('./logging/logger');
const { TestWrapper } = require('./logging/test-wrapper');
const { EvidenceStorage, RESULT_TYPES } = require('../evidence/evidence-storage');
const path = require('path');
const fs = require('fs');

/**
 * Default configuration for the integrated test runner
 */
const DEFAULT_CONFIG = {
  loggerConfig: {},
  evidenceConfig: {},
  wrapperConfig: {},
  createReports: true,
  verifyIntegrity: true,
  integrateWithRegistry: true
};

/**
 * Integrated test runner that combines logging and evidence collection
 */
class IntegratedTestRunner {
  /**
   * Create a new IntegratedTestRunner instance
   * @param {string} testId - The identifier for the test
   * @param {object} config - Configuration options
   */
  constructor(testId, config = {}) {
    this.testId = testId;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = null;
    this.evidence = null;
    this.wrapper = null;
    this.initialized = false;
    this.results = {
      testId: this.testId,
      runId: null,
      success: false,
      assertions: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0
      },
      cloudflareEvidence: false,
      startTime: null,
      endTime: null,
      duration: 0,
      logPath: null,
      evidencePath: null,
      reportPath: null
    };
  }

  /**
   * Initialize the test runner
   * @param {object} environment - Environment information (optional)
   */
  async initialize(environment = {}) {
    try {
      // Create evidence storage
      this.evidence = new EvidenceStorage(this.testId, this.config.evidenceConfig);
      await this.evidence.initialize(environment);
      
      // Create test wrapper with logger
      this.wrapper = new TestWrapper(this.testId, {
        ...this.config.wrapperConfig,
        loggerConfig: this.config.loggerConfig
      });
      
      // Get logger from wrapper after initialization
      const wrapperCtx = await this.wrapper.initialize(environment);
      this.logger = wrapperCtx.logger;
      
      // Store initialization details
      this.results.runId = this.evidence.runId;
      this.results.startTime = new Date().toISOString();
      this.results.logPath = this.logger.logFilePath;
      this.results.evidencePath = this.evidence.metadataFilePath;
      
      this.initialized = true;
      
      return {
        testId: this.testId,
        runId: this.results.runId,
        logger: this.logger,
        evidence: this.evidence,
        wrapper: this.wrapper
      };
    } catch (err) {
      console.error('Failed to initialize integrated test runner:', err);
      throw err;
    }
  }

  /**
   * Run a test function with integrated logging and evidence collection
   * @param {Function} testFn - The test function to run
   * @param {object} environment - Environment information (optional)
   * @returns {object} The test results
   */
  async runTest(testFn, environment = {}) {
    if (!this.initialized) {
      await this.initialize(environment);
    }
    
    if (!testFn || typeof testFn !== 'function') {
      throw new Error('Test function is required');
    }
    
    try {
      // Run the test with the wrapper
      const wrapperResult = await this.wrapper.runTest(async (test) => {
        return await testFn({
          ...test,
          evidence: this.evidence,
          storeEvidence: async (data, description, type = 'DATA') => {
            if (type === 'NETWORK') {
              return await this.evidence.storeNetworkArtifact(data, description);
            } else if (type === 'SCREENSHOT') {
              return await this.evidence.storeScreenshotArtifact(data, description);
            } else {
              return await this.evidence.storeDataArtifact(data, description);
            }
          }
        });
      }, environment);
      
      // Synchronize data between wrapper and evidence
      this.evidence.updateSummary({
        assertions: wrapperResult.assertions,
        steps: wrapperResult.steps,
        errors: wrapperResult.errors,
        warnings: wrapperResult.warnings,
        duration: wrapperResult.duration,
        cloudflareEvidence: wrapperResult.cloudflareEvidence
      });
      
      // Determine overall test result
      const testResult = wrapperResult.passed ? RESULT_TYPES.PASS : RESULT_TYPES.FAIL;
      
      // Finalize evidence
      const evidenceResult = await this.evidence.finalize(testResult, wrapperResult.duration);
      
      // Store results
      this.results.success = wrapperResult.passed;
      this.results.assertions = wrapperResult.assertions;
      this.results.cloudflareEvidence = wrapperResult.cloudflareEvidence;
      this.results.endTime = new Date().toISOString();
      this.results.duration = wrapperResult.duration;
      
      // Create integrated report if enabled
      if (this.config.createReports) {
        this.results.reportPath = await this._createReport(wrapperResult);
      }
      
      // Verify integrity if enabled
      if (this.config.verifyIntegrity) {
        const verificationResult = await EvidenceStorage.verifyEvidence(this.evidence.metadataFilePath);
        this.results.verified = verificationResult.verified;
        this.results.verificationErrors = verificationResult.errors;
      }
      
      return {
        ...this.results,
        testResult: wrapperResult.result
      };
      
    } catch (err) {
      console.error('Test execution failed:', err);
      
      // Try to finalize everything in case of error
      try {
        if (this.evidence) {
          await this.evidence.finalize(RESULT_TYPES.ERROR);
        }
      } catch (finalizeErr) {
        console.error('Failed to finalize evidence:', finalizeErr);
      }
      
      // Return error result
      this.results.success = false;
      this.results.endTime = new Date().toISOString();
      this.results.duration = this.results.startTime ? new Date() - new Date(this.results.startTime) : 0;
      this.results.error = err.message;
      this.results.stack = err.stack;
      
      return this.results;
    }
  }

  /**
   * Create an integrated test report
   * @private
   * @param {object} testResult - The test result from the wrapper
   * @returns {string} Path to the report file
   */
  async _createReport(testResult) {
    try {
      // Determine report path
      const dateStr = new Date().toISOString().split('T')[0];
      const reportDir = path.join(
        process.cwd(),
        'ai-workflow-workspace',
        'testing-audit',
        'reports',
        dateStr
      );
      
      // Create directory if needed
      if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
      }
      
      // Create report
      const report = {
        testId: this.testId,
        runId: this.results.runId,
        timestamp: new Date().toISOString(),
        success: this.results.success,
        duration: this.results.duration,
        assertions: this.results.assertions,
        cloudflareEvidence: this.results.cloudflareEvidence,
        logPath: path.relative(process.cwd(), this.results.logPath),
        evidencePath: path.relative(process.cwd(), this.results.evidencePath),
        result: testResult.result
      };
      
      // Write report JSON
      const reportPath = path.join(reportDir, `${this.testId}-${this.results.runId}.json`);
      await fs.promises.writeFile(reportPath, JSON.stringify(report, null, 2));
      
      // Write report markdown
      const markdownPath = path.join(reportDir, `${this.testId}-${this.results.runId}.md`);
      const markdown = this._generateMarkdownReport(report);
      await fs.promises.writeFile(markdownPath, markdown);
      
      return reportPath;
      
    } catch (err) {
      console.error('Failed to create test report:', err);
      return null;
    }
  }

  /**
   * Generate a markdown report
   * @private
   * @param {object} report - The report data
   * @returns {string} Markdown report
   */
  _generateMarkdownReport(report) {
    const { testId, runId, timestamp, success, duration, assertions, cloudflareEvidence, logPath, evidencePath } = report;
    
    let markdown = `# Test Report: ${testId}\n\n`;
    
    markdown += `## Overview\n\n`;
    markdown += `- **Test ID:** ${testId}\n`;
    markdown += `- **Run ID:** ${runId}\n`;
    markdown += `- **Timestamp:** ${timestamp}\n`;
    markdown += `- **Result:** ${success ? '✅ PASS' : '❌ FAIL'}\n`;
    markdown += `- **Duration:** ${duration}ms\n\n`;
    
    markdown += `## Assertions\n\n`;
    markdown += `- **Total:** ${assertions.total}\n`;
    markdown += `- **Passed:** ${assertions.passed}\n`;
    markdown += `- **Failed:** ${assertions.failed}\n`;
    markdown += `- **Skipped:** ${assertions.skipped}\n\n`;
    
    markdown += `## Cloudflare Verification\n\n`;
    markdown += cloudflareEvidence 
      ? `✅ Test execution verified against Cloudflare infrastructure (cf-ray headers found)\n\n`
      : `❌ No Cloudflare infrastructure verification evidence found\n\n`;
    
    markdown += `## Artifacts\n\n`;
    markdown += `- **Log File:** [${logPath}](${logPath})\n`;
    markdown += `- **Evidence Metadata:** [${evidencePath}](${evidencePath})\n\n`;
    
    markdown += `## Verification\n\n`;
    markdown += `This report was generated by the IntegratedTestRunner as part of the Edge Agent Testing Audit Reconciliation project.\n`;
    
    return markdown;
  }

  /**
   * Find test reports by test ID
   * @param {string} testId - Test ID to search for
   * @param {object} options - Search options
   * @returns {array} Matching test reports
   */
  static async findReportsByTestId(testId, options = {}) {
    const results = [];
    const basePath = path.join(process.cwd(), 'ai-workflow-workspace', 'testing-audit', 'reports');
    
    try {
      // Get date directories
      const dateDirs = await fs.promises.readdir(basePath);
      
      // Sort by date (newest first)
      dateDirs.sort().reverse();
      
      // Process each date directory
      for (const dateDir of dateDirs) {
        const dirPath = path.join(basePath, dateDir);
        
        try {
          const stats = await fs.promises.stat(dirPath);
          if (!stats.isDirectory()) continue;
          
          // Get report files
          const files = await fs.promises.readdir(dirPath);
          
          // Find matching report files
          for (const file of files) {
            if (!file.endsWith('.json')) continue;
            if (!file.startsWith(`${testId}-`)) continue;
            
            try {
              const reportPath = path.join(dirPath, file);
              const reportContent = await fs.promises.readFile(reportPath, 'utf8');
              const report = JSON.parse(reportContent);
              
              results.push(report);
              
              // Limit results if needed
              if (options.limit && results.length >= options.limit) {
                break;
              }
            } catch (err) {
              console.error(`Error processing report file ${file}:`, err);
            }
          }
          
          // Stop if we have enough results
          if (options.limit && results.length >= options.limit) {
            break;
          }
        } catch (err) {
          console.error(`Error processing directory ${dateDir}:`, err);
        }
      }
      
    } catch (err) {
      console.error('Error finding test reports:', err);
    }
    
    return results;
  }
}

module.exports = {
  IntegratedTestRunner
}; 