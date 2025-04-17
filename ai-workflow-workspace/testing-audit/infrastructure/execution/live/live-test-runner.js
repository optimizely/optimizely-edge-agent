/**
 * @fileoverview Live Environment Test Runner
 * 
 * This module provides functionality to execute tests against the live Cloudflare Workers
 * environment with full integration of verification criteria, logging, evidence collection,
 * and verification systems. It extends the functionality of the local test runner to allow
 * for controlled testing against the production environment.
 * 
 * Created as part of the Testing Audit Reconciliation project (testing-audit-reconciliation-04-10-2025)
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { IntegratedTestRunner } = require('../../integrated-test-runner');
const { VerificationHooks } = require('../../verification/verification-hooks');
const { ManifestGenerator } = require('../../manifest/manifest-generator');
const { LocalTestRunner, TEST_EXECUTION_ORDER } = require('../local-test-runner');

/**
 * Default configuration for live test runner
 */
const DEFAULT_CONFIG = {
  testScriptsPath: path.join(process.cwd(), 'final-tests-validation', 'test-scripts'),
  outputPath: path.join(process.cwd(), 'ai-workflow-workspace', 'testing-audit', 'results', 'live'),
  manifestPath: path.join(process.cwd(), 'ai-workflow-workspace', 'testing-audit', 'manifest', 'live'),
  verificationCriteriaPath: path.join(process.cwd(), 'ai-workflow-workspace', 'testing-audit', 'verification-criteria'),
  compareWithLocal: true,
  liveEnvironment: {
    mode: 'live',
    url: process.env.CLOUDFLARE_WORKER_URL || 'https://edge-agent.optimizely.com',
    apiKey: process.env.OPTIMIZELY_SDK_KEY || '',
    enableRateLimiting: true,
    requestDelay: 500, // ms between requests to avoid rate limiting
    enableSafeMode: true, // Prevents destructive operations
    captureAllHeaders: true,
    maxConcurrentRequests: 1
  },
  createReports: true,
  saveEvidence: true,
  verifyResults: true,
  abortOnFailure: false,
  generateManifest: true,
  followDependencies: true,
  createComparisonReports: true
};

/**
 * Class for live test execution with verification and local comparison
 */
class LiveTestRunner extends LocalTestRunner {
  /**
   * Create a new LiveTestRunner instance
   * @param {object} config - Configuration options
   */
  constructor(config = {}) {
    // Merge default config with provided config
    const mergedConfig = {
      ...DEFAULT_CONFIG,
      ...config,
      liveEnvironment: {
        ...DEFAULT_CONFIG.liveEnvironment,
        ...(config.liveEnvironment || {})
      }
    };
    
    // Call parent constructor with merged config
    super(mergedConfig);
    
    // Add live-specific properties
    this.testRunId = uuidv4();
    this.liveResults = {};
    this.localResults = {};
    this.comparisonResults = {};
    this.rateLimiters = {
      lastRequestTime: 0,
      pendingRequests: 0
    };
  }

  /**
   * Override initialize to add live-specific setup
   */
  async initialize() {
    if (this.initialized) return;

    // Call parent initialize
    await super.initialize();

    // Create live-specific directories
    await this._ensureLiveDirectories();

    // Validate environment variables
    this._validateEnvironmentConfig();

    console.log(`Initialized LiveTestRunner (Run ID: ${this.testRunId})`);
    console.log(`Live environment URL: ${this._maskUrl(this.config.liveEnvironment.url)}`);
    console.log(`SDK Key: ${this._maskKey(this.config.liveEnvironment.apiKey)}`);
    console.log(`Rate limiting: ${this.config.liveEnvironment.enableRateLimiting ? 'Enabled' : 'Disabled'}`);
    
    return this.testRunId;
  }

  /**
   * Run a test against the live environment
   * @param {string} testName - The name of the test to run
   * @param {object} options - Additional runtime options
   * @returns {object} Test result
   */
  async runLiveTest(testName, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    // Check if test exists
    if (!this.testFiles[testName]) {
      throw new Error(`Test file not found: ${testName}`);
    }

    const testFile = this.testFiles[testName];
    const testId = testName.replace(/\.js$/, '');

    console.log(`Running live test: ${testName}`);
    console.log(`Test file path: ${testFile.path}`);

    try {
      // Merge configuration with runtime options
      const runConfig = {
        ...this.config,
        ...options
      };

      // Enforce rate limiting if enabled
      if (runConfig.liveEnvironment.enableRateLimiting) {
        await this._enforceRateLimit();
      }

      // Create test runner instance
      const testRunner = new IntegratedTestRunner(testId, {
        loggerConfig: {
          logToConsole: true,
          logFilePath: path.join(this.config.outputPath, 'logs', `${testId}-${this.testRunId}.log`)
        },
        evidenceConfig: {
          basePath: path.join(this.config.outputPath, 'evidence', testId, this.testRunId),
          saveArtifacts: runConfig.saveEvidence
        },
        wrapperConfig: {
          captureConsoleLogs: true,
          captureNetworkRequests: true
        },
        createReports: runConfig.createReports,
        verifyIntegrity: runConfig.verifyResults,
        integrateWithRegistry: true
      });

      // Initialize the test runner
      await testRunner.initialize({
        testId,
        runId: this.testRunId,
        environment: runConfig.liveEnvironment,
        verificationCriteria: this.verificationCriteria[testId] || null
      });

      // Import the test module
      let testModule;
      try {
        testModule = require(testFile.path);
      } catch (err) {
        console.error(`Error importing test module ${testName}:`, err);
        throw new Error(`Failed to import test module: ${err.message}`);
      }

      // Find the main test function
      const testFunction = testModule.runTest || testModule.main || testModule.test || testModule.default;
      
      if (!testFunction || typeof testFunction !== 'function') {
        throw new Error(`No valid test function found in ${testName}`);
      }

      // Run the test against the live environment
      const testResult = await testRunner.runTest(async (testContext) => {
        // Add verification criteria to test context
        testContext.verificationCriteria = this.verificationCriteria[testId] || null;
        
        // Configure for live environment
        testContext.environment = runConfig.liveEnvironment;
        testContext.isLiveEnvironment = true;
        testContext.baseUrl = runConfig.liveEnvironment.url;
        testContext.sdkKey = runConfig.liveEnvironment.apiKey;
        
        // Add safety hooks for live environment
        if (runConfig.liveEnvironment.enableSafeMode) {
          testContext.safeMode = true;
          testContext.preventDestructiveOperations = true;
        }
        
        // Call the actual test function
        return await testFunction(testContext);
      }, runConfig.liveEnvironment);

      // Generate manifest
      let manifestResult = null;
      if (runConfig.generateManifest) {
        try {
          manifestResult = await this.manifestGenerator.generateFromRunnerResult(testResult, 'live');
          console.log(`Generated live test manifest: ${manifestResult.path}`);
        } catch (manifestErr) {
          console.error(`Error generating manifest for ${testName}:`, manifestErr);
        }
      }

      // Store test results
      this.liveResults[testName] = {
        success: testResult.success,
        time: new Date().toISOString(),
        runId: this.testRunId,
        result: testResult,
        manifestPath: manifestResult ? manifestResult.path : null
      };

      return {
        testName,
        success: testResult.success,
        runId: this.testRunId,
        result: testResult,
        manifestPath: manifestResult ? manifestResult.path : null
      };

    } catch (err) {
      console.error(`Error running live test ${testName}:`, err);
      
      // Store failure result
      this.liveResults[testName] = {
        success: false,
        time: new Date().toISOString(),
        runId: this.testRunId,
        error: err.message,
        stack: err.stack
      };
      
      return {
        testName,
        success: false,
        runId: this.testRunId,
        error: err.message
      };
    }
  }

  /**
   * Run a test in both local and live environments and compare results
   * @param {string} testName - The name of the test to run
   * @param {object} options - Additional runtime options
   * @returns {object} Comparison result
   */
  async runComparisonTest(testName, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    console.log(`Running comparison test for: ${testName}`);
    console.log('Step 1: Running in local environment...');

    // Run in local environment
    const localResult = await super.runTest(testName, options);
    this.localResults[testName] = localResult;

    console.log('Step 2: Running in live environment...');

    // Run in live environment
    const liveResult = await this.runLiveTest(testName, options);
    
    console.log('Step 3: Comparing results...');

    // Compare results and generate comparison report
    const comparisonResult = await this._compareResults(testName, localResult, liveResult);
    this.comparisonResults[testName] = comparisonResult;

    return {
      testName,
      localSuccess: localResult.success,
      liveSuccess: liveResult.success,
      comparisonMatch: comparisonResult.match,
      discrepancies: comparisonResult.discrepancies,
      runId: this.testRunId,
      comparisonReportPath: comparisonResult.reportPath
    };
  }

  /**
   * Run all tests in both local and live environments and compare results
   * @param {object} options - Additional runtime options
   * @returns {object} Suite results
   */
  async runAllComparisonTests(options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    console.log(`Running all comparison tests (Run ID: ${this.testRunId})`);
    
    const startTime = new Date();
    const results = {
      runId: this.testRunId,
      startTime: startTime.toISOString(),
      endTime: null,
      duration: 0,
      testsRun: 0,
      matchingResults: 0,
      discrepancies: 0,
      errors: 0,
      results: {},
      consolidatedReportPath: null
    };

    // Merge configuration with runtime options
    const runConfig = {
      ...this.config,
      ...options
    };
    
    // Determine test execution order
    const executionOrder = TEST_EXECUTION_ORDER.filter(testName => this.testFiles[testName]);
    
    // Run each test in order
    for (const testName of executionOrder) {
      console.log(`\n${'='.repeat(80)}\nRunning comparison test [${results.testsRun + 1}/${executionOrder.length}]: ${testName}\n${'='.repeat(80)}\n`);
      
      // Run the comparison test
      let comparisonResult;
      try {
        comparisonResult = await this.runComparisonTest(testName, runConfig);
        results.results[testName] = comparisonResult;
        results.testsRun++;
        
        // Update counters
        if (comparisonResult.comparisonMatch) {
          results.matchingResults++;
        } else if (comparisonResult.localSuccess && comparisonResult.liveSuccess) {
          results.discrepancies++;
        } else {
          results.errors++;
        }
      } catch (err) {
        console.error(`Error running comparison test for ${testName}:`, err);
        results.results[testName] = {
          testName,
          error: err.message,
          runId: this.testRunId
        };
        results.testsRun++;
        results.errors++;
      }
      
      // Abort on failure if configured
      if (runConfig.abortOnFailure && 
          (!comparisonResult || !comparisonResult.localSuccess || !comparisonResult.liveSuccess)) {
        console.log(`Test ${testName} failed in one or both environments, aborting test suite execution`);
        break;
      }
    }
    
    // Calculate duration
    const endTime = new Date();
    results.endTime = endTime.toISOString();
    results.duration = endTime - startTime;
    
    // Generate consolidated comparison report
    if (runConfig.createComparisonReports) {
      try {
        const reportPath = await this._generateConsolidatedComparisonReport(results);
        results.consolidatedReportPath = reportPath;
        console.log(`Generated consolidated comparison report: ${reportPath}`);
      } catch (reportErr) {
        console.error('Error generating consolidated comparison report:', reportErr);
      }
    }
    
    // Generate summary
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Comparison Test Suite Execution Summary (Run ID: ${this.testRunId})`);
    console.log(`${'='.repeat(80)}`);
    console.log(`Tests Run: ${results.testsRun}/${executionOrder.length}`);
    console.log(`Matching Results: ${results.matchingResults}`);
    console.log(`Discrepancies: ${results.discrepancies}`);
    console.log(`Errors: ${results.errors}`);
    console.log(`Duration: ${results.duration}ms`);
    console.log(`Start Time: ${results.startTime}`);
    console.log(`End Time: ${results.endTime}`);
    
    if (results.consolidatedReportPath) {
      console.log(`Consolidated Comparison Report: ${results.consolidatedReportPath}`);
    }
    
    return results;
  }

  /**
   * Create live-specific directories
   * @private
   */
  async _ensureLiveDirectories() {
    const directories = [
      this.config.outputPath,
      path.join(this.config.outputPath, 'logs'),
      path.join(this.config.outputPath, 'evidence'),
      path.join(this.config.outputPath, 'reports'),
      path.join(this.config.outputPath, 'comparisons'),
      this.config.manifestPath
    ];
    
    for (const dir of directories) {
      try {
        await fs.promises.mkdir(dir, { recursive: true });
      } catch (err) {
        console.error(`Error creating directory ${dir}:`, err);
      }
    }
  }

  /**
   * Validate environment configuration
   * @private
   */
  _validateEnvironmentConfig() {
    // Check for essential configuration
    if (!this.config.liveEnvironment.url) {
      console.warn('Live environment URL not specified. Using default: https://edge-agent.optimizely.com');
      this.config.liveEnvironment.url = 'https://edge-agent.optimizely.com';
    }
    
    if (!this.config.liveEnvironment.apiKey) {
      console.warn('SDK Key not specified. Live tests may fail without valid authentication.');
    }
    
    // Validate URL format
    try {
      new URL(this.config.liveEnvironment.url);
    } catch (err) {
      throw new Error(`Invalid live environment URL: ${this.config.liveEnvironment.url}`);
    }
    
    // Validate rate limiting configuration
    if (this.config.liveEnvironment.enableRateLimiting) {
      if (this.config.liveEnvironment.requestDelay < 100) {
        console.warn('Request delay is very low. This might trigger rate limiting.');
      }
    }
  }

  /**
   * Enforce rate limiting between requests
   * @private
   */
  async _enforceRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.rateLimiters.lastRequestTime;
    const delay = this.config.liveEnvironment.requestDelay;
    
    if (timeSinceLastRequest < delay) {
      const waitTime = delay - timeSinceLastRequest;
      console.log(`Rate limiting: Waiting ${waitTime}ms before next request...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.rateLimiters.lastRequestTime = Date.now();
  }

  /**
   * Compare local and live test results
   * @param {string} testName - Test name
   * @param {object} localResult - Local test result
   * @param {object} liveResult - Live test result
   * @returns {object} Comparison result
   * @private
   */
  async _compareResults(testName, localResult, liveResult) {
    const testId = testName.replace(/\.js$/, '');
    const comparisonResult = {
      testName,
      testId,
      runId: this.testRunId,
      localSuccess: localResult.success,
      liveSuccess: liveResult.success,
      match: false,
      discrepancies: [],
      reportPath: null,
      timestamp: new Date().toISOString()
    };
    
    // Basic success comparison
    if (localResult.success !== liveResult.success) {
      comparisonResult.discrepancies.push({
        type: 'success_mismatch',
        description: `Test success status differs: Local=${localResult.success}, Live=${liveResult.success}`,
        severity: 'high'
      });
    }
    
    // Compare result details if both tests ran successfully
    if (localResult.success && liveResult.success) {
      // Extract and compare response data
      const localResponses = this._extractResponses(localResult);
      const liveResponses = this._extractResponses(liveResult);
      
      // Compare response counts
      if (localResponses.length !== liveResponses.length) {
        comparisonResult.discrepancies.push({
          type: 'response_count_mismatch',
          description: `Response count differs: Local=${localResponses.length}, Live=${liveResponses.length}`,
          severity: 'medium'
        });
      }
      
      // Compare individual responses
      const minResponses = Math.min(localResponses.length, liveResponses.length);
      for (let i = 0; i < minResponses; i++) {
        const localResponse = localResponses[i];
        const liveResponse = liveResponses[i];
        
        // Compare status codes
        if (localResponse.status !== liveResponse.status) {
          comparisonResult.discrepancies.push({
            type: 'status_code_mismatch',
            description: `Status code mismatch in response ${i+1}: Local=${localResponse.status}, Live=${liveResponse.status}`,
            severity: 'medium',
            responseIndex: i
          });
        }
        
        // Compare response bodies (if they exist and are JSON)
        if (localResponse.body && liveResponse.body) {
          try {
            const localBody = typeof localResponse.body === 'string' ? JSON.parse(localResponse.body) : localResponse.body;
            const liveBody = typeof liveResponse.body === 'string' ? JSON.parse(liveResponse.body) : liveResponse.body;
            
            // Compare response structures
            const bodyDiffs = this._compareObjects(localBody, liveBody);
            if (bodyDiffs.length > 0) {
              comparisonResult.discrepancies.push({
                type: 'response_body_mismatch',
                description: `Response body differences in response ${i+1}`,
                severity: 'high',
                responseIndex: i,
                differences: bodyDiffs
              });
            }
          } catch (err) {
            // If JSON parsing fails, compare as strings
            if (localResponse.body !== liveResponse.body) {
              comparisonResult.discrepancies.push({
                type: 'response_body_mismatch',
                description: `Non-JSON response body mismatch in response ${i+1}`,
                severity: 'medium',
                responseIndex: i
              });
            }
          }
        }
      }
    }
    
    // Set match status based on discrepancies
    comparisonResult.match = comparisonResult.discrepancies.length === 0;
    
    // Generate comparison report
    if (this.config.createComparisonReports) {
      const reportPath = path.join(
        this.config.outputPath,
        'comparisons',
        `${testId}-comparison-${this.testRunId}.json`
      );
      
      const reportData = {
        ...comparisonResult,
        timestamp: new Date().toISOString(),
        localResult: {
          success: localResult.success,
          manifestPath: localResult.manifestPath
        },
        liveResult: {
          success: liveResult.success,
          manifestPath: liveResult.manifestPath
        }
      };
      
      try {
        await fs.promises.writeFile(reportPath, JSON.stringify(reportData, null, 2));
        comparisonResult.reportPath = reportPath;
      } catch (err) {
        console.error(`Error writing comparison report for ${testName}:`, err);
      }
    }
    
    return comparisonResult;
  }

  /**
   * Generate a consolidated comparison report
   * @param {object} results - All test results
   * @returns {string} Path to report
   * @private
   */
  async _generateConsolidatedComparisonReport(results) {
    const reportPath = path.join(
      this.config.outputPath,
      'comparisons',
      `consolidated-comparison-${this.testRunId}.json`
    );
    
    const reportData = {
      runId: this.testRunId,
      timestamp: new Date().toISOString(),
      summary: {
        testsRun: results.testsRun,
        matchingResults: results.matchingResults,
        discrepancies: results.discrepancies,
        errors: results.errors,
        startTime: results.startTime,
        endTime: results.endTime,
        duration: results.duration
      },
      testResults: {}
    };
    
    // Add individual test results
    for (const [testName, result] of Object.entries(results.results)) {
      reportData.testResults[testName] = {
        match: result.comparisonMatch,
        localSuccess: result.localSuccess,
        liveSuccess: result.liveSuccess,
        discrepancyCount: result.discrepancies ? result.discrepancies.length : 0,
        reportPath: result.comparisonReportPath
      };
    }
    
    try {
      await fs.promises.writeFile(reportPath, JSON.stringify(reportData, null, 2));
      return reportPath;
    } catch (err) {
      console.error('Error writing consolidated comparison report:', err);
      throw err;
    }
  }

  /**
   * Extract response data from test results
   * @param {object} result - Test result
   * @returns {Array} List of responses
   * @private
   */
  _extractResponses(result) {
    const responses = [];
    
    if (!result || !result.result || !result.result.evidence) {
      return responses;
    }
    
    // Look for network responses in evidence
    const networkEvidence = result.result.evidence.filter(e => 
      e.type === 'network' && e.data && e.data.response
    );
    
    // Extract response data
    for (const evidence of networkEvidence) {
      responses.push({
        url: evidence.data.request ? evidence.data.request.url : 'unknown',
        method: evidence.data.request ? evidence.data.request.method : 'unknown',
        status: evidence.data.response.status,
        statusText: evidence.data.response.statusText,
        headers: evidence.data.response.headers,
        body: evidence.data.response.body,
        timestamp: evidence.timestamp
      });
    }
    
    return responses;
  }

  /**
   * Compare two objects and return differences
   * @param {object} obj1 - First object
   * @param {object} obj2 - Second object
   * @param {string} path - Current path (for recursion)
   * @returns {Array} List of differences
   * @private
   */
  _compareObjects(obj1, obj2, path = '') {
    const differences = [];
    
    // Handle null/undefined cases
    if (obj1 === null && obj2 === null) return differences;
    if (obj1 === undefined && obj2 === undefined) return differences;
    if (obj1 === null && obj2 !== null) return [{ path: path || 'root', local: null, live: obj2 }];
    if (obj1 !== null && obj2 === null) return [{ path: path || 'root', local: obj1, live: null }];
    if (obj1 === undefined && obj2 !== undefined) return [{ path: path || 'root', local: undefined, live: obj2 }];
    if (obj1 !== undefined && obj2 === undefined) return [{ path: path || 'root', local: obj1, live: undefined }];
    
    // Handle different types
    if (typeof obj1 !== typeof obj2) {
      return [{ 
        path: path || 'root', 
        local: { type: typeof obj1, value: obj1 }, 
        live: { type: typeof obj2, value: obj2 } 
      }];
    }
    
    // Handle arrays
    if (Array.isArray(obj1) && Array.isArray(obj2)) {
      // Different lengths
      if (obj1.length !== obj2.length) {
        differences.push({ 
          path: path || 'root', 
          difference: 'array_length', 
          local: obj1.length, 
          live: obj2.length 
        });
      }
      
      // Compare elements
      const minLength = Math.min(obj1.length, obj2.length);
      for (let i = 0; i < minLength; i++) {
        const nestedPath = path ? `${path}[${i}]` : `[${i}]`;
        const nestedDiffs = this._compareObjects(obj1[i], obj2[i], nestedPath);
        differences.push(...nestedDiffs);
      }
      
      return differences;
    }
    
    // Handle objects (non-array)
    if (typeof obj1 === 'object' && typeof obj2 === 'object') {
      const obj1Keys = Object.keys(obj1);
      const obj2Keys = Object.keys(obj2);
      
      // Check for missing keys
      for (const key of obj1Keys) {
        if (!obj2Keys.includes(key)) {
          differences.push({ 
            path: path ? `${path}.${key}` : key, 
            difference: 'key_missing_in_live', 
            local: obj1[key], 
            live: undefined 
          });
        }
      }
      
      for (const key of obj2Keys) {
        if (!obj1Keys.includes(key)) {
          differences.push({ 
            path: path ? `${path}.${key}` : key, 
            difference: 'key_missing_in_local', 
            local: undefined, 
            live: obj2[key] 
          });
        }
      }
      
      // Check values for common keys
      for (const key of obj1Keys) {
        if (obj2Keys.includes(key)) {
          const nestedPath = path ? `${path}.${key}` : key;
          const nestedDiffs = this._compareObjects(obj1[key], obj2[key], nestedPath);
          differences.push(...nestedDiffs);
        }
      }
      
      return differences;
    }
    
    // Handle primitive values
    if (obj1 !== obj2) {
      differences.push({ 
        path: path || 'root', 
        local: obj1, 
        live: obj2 
      });
    }
    
    return differences;
  }

  /**
   * Mask sensitive information in URLs
   * @param {string} url - URL to mask
   * @returns {string} Masked URL
   * @private
   */
  _maskUrl(url) {
    if (!url) return 'undefined';
    return url.replace(/(\?|&)([^=&]+)=([^&]*)/g, (match, prefix, key, value) => {
      // Mask sensitive query parameters
      if (['key', 'token', 'api_key', 'apikey', 'sdk_key', 'sdkkey'].includes(key.toLowerCase())) {
        return `${prefix}${key}=***masked***`;
      }
      return match;
    });
  }

  /**
   * Mask sensitive key information
   * @param {string} key - Key to mask
   * @returns {string} Masked key
   * @private
   */
  _maskKey(key) {
    if (!key) return 'undefined';
    if (key.length <= 8) return '***masked***';
    return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
  }
}

module.exports = {
  LiveTestRunner,
  TEST_EXECUTION_ORDER
}; 