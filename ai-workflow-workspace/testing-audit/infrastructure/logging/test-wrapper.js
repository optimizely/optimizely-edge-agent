/**
 * @fileoverview Test Wrapper for Edge Agent Test Scripts
 * 
 * This module provides a wrapper for test scripts to easily integrate with the
 * structured logging framework. It captures test execution details, logs HTTP requests
 * and responses, and ensures proper integrity verification.
 * 
 * Created as part of the Testing Audit Reconciliation project (testing-audit-reconciliation-04-10-2025)
 */

const { TestLogger } = require('./logger');
const fetch = require('node-fetch');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * Default configuration for the test wrapper
 */
const DEFAULT_CONFIG = {
  captureConsole: true,
  interceptFetch: true,
  captureAssertions: true,
  verifyIntegrity: true,
  createEvidenceDirectory: true,
  evidenceBasePath: path.join(process.cwd(), 'ai-workflow-workspace', 'testing-audit', 'evidence'),
  loggerConfig: {}
};

/**
 * Wrapper for test scripts to integrate with the structured logging framework
 */
class TestWrapper {
  /**
   * Create a new TestWrapper
   * @param {string} testId - The identifier for the test being executed
   * @param {object} config - Configuration options
   */
  constructor(testId, config = {}) {
    this.testId = testId;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = new TestLogger(testId, this.config.loggerConfig);
    this.startTime = null;
    this.originalConsole = { 
      log: console.log, 
      warn: console.warn, 
      error: console.error, 
      info: console.info,
      debug: console.debug
    };
    this.originalFetch = global.fetch;
    this.evidencePath = null;
    this.evidenceFiles = [];
    this.testResult = {
      passed: false,
      assertions: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0
      },
      steps: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0
      },
      errors: 0,
      warnings: 0,
      duration: 0,
      cloudflareEvidence: false
    };
  }

  /**
   * Initialize the test wrapper
   * @param {object} environmentInfo - Information about the test environment (optional)
   */
  async initialize(environmentInfo = {}) {
    this.startTime = new Date();
    
    // Initialize the logger
    await this.logger.initialize();
    
    // Create evidence directory
    if (this.config.createEvidenceDirectory) {
      const dateStr = this.startTime.toISOString().split('T')[0];
      const evidenceDir = path.join(this.config.evidenceBasePath, dateStr, this.testId, this.logger.runId);
      await this._ensureDirectoryExists(evidenceDir);
      this.evidencePath = evidenceDir;
    }
    
    // Intercept console methods if enabled
    if (this.config.captureConsole) {
      this._interceptConsole();
    }
    
    // Intercept fetch if enabled
    if (this.config.interceptFetch) {
      this._interceptFetch();
    }
    
    // Log environment information
    const fullEnvInfo = {
      ...environmentInfo,
      nodeVersion: process.version,
      platform: process.platform,
      timestamp: this.startTime.toISOString(),
      runId: this.logger.runId
    };
    
    this.logger.log('ENVIRONMENT', 'INFO', 'Test environment information', fullEnvInfo);
    
    return {
      testId: this.testId,
      runId: this.logger.runId,
      evidencePath: this.evidencePath,
      logger: this.logger
    };
  }

  /**
   * Run a test function with full logging and evidence collection
   * @param {Function} testFn - The test function to run
   * @param {object} environmentInfo - Information about the test environment (optional)
   * @returns {object} The test results
   */
  async runTest(testFn, environmentInfo = {}) {
    if (!testFn || typeof testFn !== 'function') {
      throw new Error('Test function is required');
    }
    
    // Initialize
    await this.initialize(environmentInfo);
    
    try {
      // Run the test function
      this.logger.step('test-wrapper', 'PENDING', `Starting test execution: ${this.testId}`);
      
      const result = await testFn({
        logger: this.logger,
        assert: this._createAssertWrapper(),
        step: this._createStepWrapper(),
        evidence: this._createEvidenceWrapper(),
        testId: this.testId,
        runId: this.logger.runId
      });
      
      // Calculate duration
      const endTime = new Date();
      const duration = endTime - this.startTime;
      this.testResult.duration = duration;
      
      // Determine if test passed overall
      const stepsFailed = this.testResult.steps.failed > 0;
      const assertionsFailed = this.testResult.assertions.failed > 0;
      const errorsOccurred = this.testResult.errors > 0;
      
      this.testResult.passed = !stepsFailed && !assertionsFailed && !errorsOccurred;
      
      const finalStatus = this.testResult.passed ? 'PASS' : 'FAIL';
      
      // Log final step
      this.logger.step('test-wrapper', finalStatus, `Test execution completed in ${duration}ms`);
      
      // Generate evidence summary file
      if (this.evidencePath) {
        await this._generateEvidenceSummary();
      }
      
      // Finalize logger
      await this.logger.finalize(finalStatus, 
        `Test execution completed with result: ${finalStatus} (${this.testResult.assertions.passed}/${this.testResult.assertions.total} assertions passed)`);
      
      // Restore original console and fetch
      if (this.config.captureConsole) {
        this._restoreConsole();
      }
      
      if (this.config.interceptFetch) {
        this._restoreFetch();
      }
      
      // Return test result
      return {
        ...this.testResult,
        runId: this.logger.runId,
        testId: this.testId,
        evidencePath: this.evidencePath,
        logFilePath: this.logger.logFilePath,
        result
      };
      
    } catch (err) {
      // Log the error
      this.logger.error(`Unhandled error in test: ${err.message}`, err);
      this.testResult.errors++;
      
      // Finalize logger
      await this.logger.finalize('ERROR', 
        `Test execution failed with error: ${err.message}`);
      
      // Restore original console and fetch
      if (this.config.captureConsole) {
        this._restoreConsole();
      }
      
      if (this.config.interceptFetch) {
        this._restoreFetch();
      }
      
      // Rethrow to caller
      throw err;
    }
  }

  /**
   * Create a wrapper for assertions to capture in the logger
   * @private
   * @returns {object} The assert wrapper 
   */
  _createAssertWrapper() {
    const self = this;
    
    return {
      /**
       * Assert that a condition is true
       * @param {boolean} condition - The condition to check
       * @param {string} message - The assertion message
       * @param {any} expected - The expected value (optional)
       * @param {any} actual - The actual value (optional)
       */
      isTrue: (condition, message, expected = true, actual = condition) => {
        self.testResult.assertions.total++;
        
        if (condition) {
          self.testResult.assertions.passed++;
          self.logger.assertion('assert', 'PASS', message, expected, actual);
          return true;
        } else {
          self.testResult.assertions.failed++;
          self.logger.assertion('assert', 'FAIL', message, expected, actual);
          return false;
        }
      },
      
      /**
       * Assert that a condition is false
       * @param {boolean} condition - The condition to check
       * @param {string} message - The assertion message
       */
      isFalse: (condition, message) => {
        return self._createAssertWrapper().isTrue(!condition, message, false, condition);
      },
      
      /**
       * Assert that two values are equal
       * @param {any} actual - The actual value
       * @param {any} expected - The expected value
       * @param {string} message - The assertion message
       */
      equal: (actual, expected, message) => {
        let isEqual;
        
        if (typeof actual === 'object' && typeof expected === 'object') {
          isEqual = JSON.stringify(actual) === JSON.stringify(expected);
        } else {
          isEqual = actual === expected;
        }
        
        return self._createAssertWrapper().isTrue(isEqual, message, expected, actual);
      },
      
      /**
       * Explicitly mark a test as passed
       * @param {string} message - The assertion message
       * @param {any} expected - The expected value (optional)
       * @param {any} actual - The actual value (optional)
       */
      pass: (message, expected, actual) => {
        self.testResult.assertions.total++;
        self.testResult.assertions.passed++;
        self.logger.assertion('assert', 'PASS', message, expected, actual);
        return true;
      },
      
      /**
       * Explicitly mark a test as failed
       * @param {string} message - The assertion message
       * @param {any} expected - The expected value (optional)
       * @param {any} actual - The actual value (optional)
       */
      fail: (message, expected, actual) => {
        self.testResult.assertions.total++;
        self.testResult.assertions.failed++;
        self.logger.assertion('assert', 'FAIL', message, expected, actual);
        return false;
      },
      
      /**
       * Skip an assertion
       * @param {string} message - The assertion message
       */
      skip: (message) => {
        self.testResult.assertions.total++;
        self.testResult.assertions.skipped++;
        self.logger.assertion('assert', 'SKIPPED', message);
        return true;
      }
    };
  }

  /**
   * Create a wrapper for test steps to capture in the logger
   * @private
   * @returns {object} The step wrapper
   */
  _createStepWrapper() {
    const self = this;
    
    return {
      /**
       * Log a test step
       * @param {string} component - The component being tested
       * @param {string} status - The step status (PASS/FAIL/SKIPPED/PENDING)
       * @param {string} message - The step description
       */
      log: (component, status, message) => {
        self.testResult.steps.total++;
        
        switch (status) {
          case 'PASS':
            self.testResult.steps.passed++;
            break;
          case 'FAIL':
            self.testResult.steps.failed++;
            break;
          case 'SKIPPED':
            self.testResult.steps.skipped++;
            break;
        }
        
        return self.logger.step(component, status, message);
      },
      
      /**
       * Start a test step (logs as PENDING)
       * @param {string} component - The component being tested
       * @param {string} message - The step description
       * @returns {Function} A function to complete the step
       */
      start: (component, message) => {
        const startTime = Date.now();
        self.logger.step(component, 'PENDING', `Starting: ${message}`);
        
        return {
          pass: (completionMessage = 'completed successfully') => {
            const duration = Date.now() - startTime;
            return self._createStepWrapper().log(
              component, 
              'PASS', 
              `${message} - ${completionMessage} (${duration}ms)`
            );
          },
          
          fail: (completionMessage = 'failed') => {
            const duration = Date.now() - startTime;
            return self._createStepWrapper().log(
              component, 
              'FAIL', 
              `${message} - ${completionMessage} (${duration}ms)`
            );
          },
          
          skip: (completionMessage = 'skipped') => {
            return self._createStepWrapper().log(
              component, 
              'SKIPPED', 
              `${message} - ${completionMessage}`
            );
          }
        };
      }
    };
  }

  /**
   * Create a wrapper for collecting evidence
   * @private
   * @returns {object} The evidence wrapper
   */
  _createEvidenceWrapper() {
    const self = this;
    
    return {
      /**
       * Save evidence to file
       * @param {string} name - Evidence name/description 
       * @param {any} content - Evidence content
       * @param {string} format - File format (default: 'json')
       * @returns {string} Path to saved evidence file
       */
      save: (name, content, format = 'json') => {
        if (!self.evidencePath) {
          throw new Error('Evidence directory not initialized');
        }
        
        try {
          // Create a safe filename
          const safeName = name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
          
          const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/g, '');
          const fileName = `${safeName}-${timestamp}.${format}`;
          const filePath = path.join(self.evidencePath, fileName);
          
          // Convert content based on format
          let fileContent;
          if (format === 'json') {
            fileContent = JSON.stringify(content, null, 2);
          } else if (typeof content === 'object') {
            fileContent = JSON.stringify(content, null, 2);
          } else {
            fileContent = content.toString();
          }
          
          // Write the file
          fs.writeFileSync(filePath, fileContent);
          
          // Calculate file hash
          const fileHash = crypto.createHash('sha256')
            .update(fileContent)
            .digest('hex');
          
          // Add to evidence list
          const evidenceEntry = {
            name,
            fileName,
            filePath,
            timestamp: new Date().toISOString(),
            hash: fileHash,
            format
          };
          
          self.evidenceFiles.push(evidenceEntry);
          
          // Log evidence collection
          self.logger.log('INFO', 'INFO', `Collected evidence: ${name}`, {
            component: 'evidence-collector',
            artifactRef: filePath,
            hash: fileHash
          });
          
          return filePath;
          
        } catch (err) {
          self.logger.error(`Failed to save evidence: ${err.message}`, err);
          return null;
        }
      },
      
      /**
       * Capture current test state as evidence
       * @param {string} name - Evidence name/description
       * @returns {string} Path to saved evidence file
       */
      captureState: (name) => {
        return self._createEvidenceWrapper().save(`${name}-state`, {
          testId: self.testId,
          runId: self.logger.runId,
          timestamp: new Date().toISOString(),
          testResult: self.testResult,
          evidenceFiles: self.evidenceFiles
        });
      }
    };
  }

  /**
   * Intercept console methods to log them
   * @private
   */
  _interceptConsole() {
    const self = this;
    
    // Override console.log
    console.log = function() {
      self.originalConsole.log.apply(console, arguments);
      const message = Array.from(arguments).map(arg => {
        return typeof arg === 'object' ? JSON.stringify(arg) : arg;
      }).join(' ');
      self.logger.log('INFO', 'INFO', message, { component: 'console' });
    };
    
    // Override console.warn
    console.warn = function() {
      self.originalConsole.warn.apply(console, arguments);
      const message = Array.from(arguments).map(arg => {
        return typeof arg === 'object' ? JSON.stringify(arg) : arg;
      }).join(' ');
      self.logger.log('WARNING', 'WARNING', message, { component: 'console' });
      self.testResult.warnings++;
    };
    
    // Override console.error
    console.error = function() {
      self.originalConsole.error.apply(console, arguments);
      const message = Array.from(arguments).map(arg => {
        return typeof arg === 'object' ? JSON.stringify(arg) : arg;
      }).join(' ');
      self.logger.log('ERROR', 'ERROR', message, { component: 'console' });
      self.testResult.errors++;
    };
  }

  /**
   * Restore original console methods
   * @private
   */
  _restoreConsole() {
    console.log = this.originalConsole.log;
    console.warn = this.originalConsole.warn;
    console.error = this.originalConsole.error;
  }

  /**
   * Intercept fetch to log HTTP requests and responses
   * @private
   */
  _interceptFetch() {
    const self = this;
    
    global.fetch = async function(url, options = {}) {
      const startTime = Date.now();
      const reqMethod = (options.method || 'GET').toUpperCase();
      const reqHeaders = options.headers || {};
      const reqBody = options.body || null;
      
      // Log the request
      self.logger.httpRequest(reqMethod, url, reqHeaders, reqBody);
      
      try {
        // Make the actual request
        const response = await self.originalFetch(url, options);
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        // Clone the response so we can read the body
        const clonedResponse = response.clone();
        
        // Get response headers
        const respHeaders = {};
        clonedResponse.headers.forEach((value, name) => {
          respHeaders[name] = value;
        });
        
        // Check for Cloudflare headers as evidence
        if (respHeaders['cf-ray']) {
          self.testResult.cloudflareEvidence = true;
        }
        
        let respBody;
        try {
          if (clonedResponse.headers.get('content-type')?.includes('application/json')) {
            respBody = await clonedResponse.json();
          } else {
            respBody = await clonedResponse.text();
          }
        } catch (err) {
          respBody = `[Error reading response body: ${err.message}]`;
        }
        
        // Log the response
        self.logger.httpResponse(
          clonedResponse.status,
          respHeaders,
          respBody,
          duration
        );
        
        // Save response as evidence if it's a Cloudflare response
        if (respHeaders['cf-ray'] && self.evidencePath) {
          const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/g, '');
          const urlParts = new URL(url);
          const urlPath = urlParts.pathname.replace(/\//g, '-');
          const fileName = `cf-response${urlPath}-${timestamp}.json`;
          const filePath = path.join(self.evidencePath, fileName);
          
          const evidenceContent = {
            url,
            method: reqMethod,
            requestHeaders: reqHeaders,
            requestBody: reqBody,
            responseStatus: clonedResponse.status,
            responseHeaders: respHeaders,
            responseBody: respBody,
            duration,
            timestamp: new Date().toISOString(),
            cfRay: respHeaders['cf-ray']
          };
          
          // Write to file
          fs.writeFileSync(filePath, JSON.stringify(evidenceContent, null, 2));
          
          // Add to evidence list
          self.evidenceFiles.push({
            name: `Cloudflare Response (${reqMethod} ${urlParts.pathname})`,
            fileName,
            filePath,
            timestamp: new Date().toISOString(),
            hash: crypto.createHash('sha256').update(JSON.stringify(evidenceContent)).digest('hex'),
            format: 'json'
          });
        }
        
        return response;
        
      } catch (err) {
        // Log the error
        self.logger.error(`Fetch error: ${err.message}`, err);
        self.testResult.errors++;
        throw err;
      }
    };
  }

  /**
   * Restore original fetch
   * @private
   */
  _restoreFetch() {
    global.fetch = this.originalFetch;
  }

  /**
   * Ensure a directory exists
   * @private
   * @param {string} dirPath - Directory path
   */
  async _ensureDirectoryExists(dirPath) {
    try {
      await fs.promises.mkdir(dirPath, { recursive: true });
    } catch (err) {
      console.error(`Error creating directory ${dirPath}:`, err);
      throw err;
    }
  }

  /**
   * Generate an evidence summary file
   * @private
   */
  async _generateEvidenceSummary() {
    try {
      const summary = {
        testId: this.testId,
        runId: this.logger.runId,
        timestamp: new Date().toISOString(),
        testResult: this.testResult,
        evidenceFiles: this.evidenceFiles,
        logFilePath: this.logger.logFilePath
      };
      
      const summaryPath = path.join(this.evidencePath, 'evidence-summary.json');
      
      // Write summary file
      await fs.promises.writeFile(
        summaryPath,
        JSON.stringify(summary, null, 2)
      );
      
      // Also create a readable markdown version
      const markdownSummary = this._generateMarkdownSummary(summary);
      const markdownPath = path.join(this.evidencePath, 'evidence-summary.md');
      
      await fs.promises.writeFile(markdownPath, markdownSummary);
      
      return summaryPath;
      
    } catch (err) {
      console.error('Error generating evidence summary:', err);
      return null;
    }
  }

  /**
   * Generate a markdown evidence summary
   * @private
   * @param {object} summary - The evidence summary
   * @returns {string} Markdown formatted summary
   */
  _generateMarkdownSummary(summary) {
    const { testId, runId, timestamp, testResult, evidenceFiles, logFilePath } = summary;
    
    let markdown = `# Test Evidence Summary\n\n`;
    
    markdown += `## Test Information\n\n`;
    markdown += `- **Test ID:** ${testId}\n`;
    markdown += `- **Run ID:** ${runId}\n`;
    markdown += `- **Timestamp:** ${timestamp}\n`;
    markdown += `- **Result:** ${testResult.passed ? '✅ PASS' : '❌ FAIL'}\n`;
    markdown += `- **Duration:** ${testResult.duration}ms\n\n`;
    
    markdown += `## Test Results\n\n`;
    markdown += `### Assertions\n\n`;
    markdown += `- Total: ${testResult.assertions.total}\n`;
    markdown += `- Passed: ${testResult.assertions.passed}\n`;
    markdown += `- Failed: ${testResult.assertions.failed}\n`;
    markdown += `- Skipped: ${testResult.assertions.skipped}\n\n`;
    
    markdown += `### Steps\n\n`;
    markdown += `- Total: ${testResult.steps.total}\n`;
    markdown += `- Passed: ${testResult.steps.passed}\n`;
    markdown += `- Failed: ${testResult.steps.failed}\n`;
    markdown += `- Skipped: ${testResult.steps.skipped}\n\n`;
    
    markdown += `### Issues\n\n`;
    markdown += `- Errors: ${testResult.errors}\n`;
    markdown += `- Warnings: ${testResult.warnings}\n\n`;
    
    markdown += `### Cloudflare Verification\n\n`;
    markdown += testResult.cloudflareEvidence 
      ? `✅ Test execution verified against Cloudflare infrastructure (cf-ray headers found)\n\n`
      : `❌ No Cloudflare infrastructure verification evidence found\n\n`;
    
    markdown += `## Evidence Files\n\n`;
    markdown += `### Log File\n\n`;
    markdown += `- ${logFilePath}\n\n`;
    
    markdown += `### Evidence Files\n\n`;
    
    if (evidenceFiles.length === 0) {
      markdown += `No evidence files collected.\n\n`;
    } else {
      markdown += `| Name | File | Timestamp | Hash |\n`;
      markdown += `|------|------|-----------|------|\n`;
      
      evidenceFiles.forEach(file => {
        markdown += `| ${file.name} | ${file.fileName} | ${file.timestamp} | ${file.hash.substring(0, 8)}... |\n`;
      });
      
      markdown += `\n`;
    }
    
    markdown += `## Verification\n\n`;
    markdown += `This evidence summary was generated automatically by the TestWrapper utility as part of the Edge Agent Testing Audit Reconciliation project.\n`;
    markdown += `The integrity of these log files can be verified using the TestLogger.verifyLogIntegrity() method.\n`;
    
    return markdown;
  }
}

module.exports = {
  TestWrapper
}; 