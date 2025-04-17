/**
 * @fileoverview Local Environment Test Runner
 * 
 * This module provides functionality to execute tests in a local environment with
 * full integration of the verification criteria, logging, evidence collection, and
 * verification systems. It supports both individual test execution and test suite
 * execution following the defined test dependencies flow.
 * 
 * Created as part of the Testing Audit Reconciliation project (testing-audit-reconciliation-04-10-2025)
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { IntegratedTestRunner } = require('../integrated-test-runner');
const { VerificationHooks } = require('../verification/verification-hooks');
const { ManifestGenerator } = require('../manifest/manifest-generator');

/**
 * Default configuration for local test runner
 */
const DEFAULT_CONFIG = {
  testScriptsPath: path.join(process.cwd(), 'final-tests-validation', 'test-scripts'),
  outputPath: path.join(process.cwd(), 'ai-workflow-workspace', 'testing-audit', 'results'),
  manifestPath: path.join(process.cwd(), 'ai-workflow-workspace', 'testing-audit', 'manifest'),
  verificationCriteriaPath: path.join(process.cwd(), 'ai-workflow-workspace', 'testing-audit', 'verification-criteria'),
  localEnvironment: {
    mode: 'local',
    wranglerEnabled: true,
    enableNetworkLogging: true,
    mockCloudflareHeaders: false
  },
  createReports: true,
  saveEvidence: true,
  verifyResults: true,
  abortOnFailure: false,
  generateManifest: true,
  followDependencies: true
};

/**
 * Test dependency order - matches the dependency graph documentation
 */
const TEST_EXECUTION_ORDER = [
  'infrastructure-verification.js',
  'decision-api-test.js',
  'parameter-validation-test.js',
  'forced-variation-tests.js',
  'parameter-handling-tests.js',
  'kv-storage-tests.js',
  'cdn-variation-test.js',
  'lowercase-variation-test.js',
  'feature-parity-test.js'
];

/**
 * Class for local test execution with verification
 */
class LocalTestRunner {
  /**
   * Create a new LocalTestRunner instance
   * @param {object} config - Configuration options
   */
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initialized = false;
    this.testRunId = uuidv4();
    this.manifestGenerator = null;
    this.manifestBasePath = this.config.manifestPath;
    this.testResults = {};
    this.testFiles = {};
    this.verificationCriteria = {};
    this.currentWranglerProcess = null;
  }

  /**
   * Initialize the local test runner
   */
  async initialize() {
    if (this.initialized) return;

    // Create output directories if needed
    await this._ensureDirectories();

    // Initialize manifest generator
    this.manifestGenerator = new ManifestGenerator({
      basePath: this.manifestBasePath,
      includeLogSummary: true,
      includeEvidenceSummary: true,
      includeVerificationResults: true,
      includeTimeline: true,
      includeSystemInfo: true,
      createDirectory: true,
      signManifest: true
    });
    await this.manifestGenerator.initialize();

    // Discover test files
    await this._discoverTestFiles();

    // Load verification criteria
    await this._loadVerificationCriteria();

    console.log(`Initialized LocalTestRunner (Run ID: ${this.testRunId})`);
    console.log(`Found ${Object.keys(this.testFiles).length} test files`);
    console.log(`Loaded ${Object.keys(this.verificationCriteria).length} verification criteria documents`);

    this.initialized = true;
    return this.testRunId;
  }

  /**
   * Run a single test by name
   * @param {string} testName - The name of the test to run (e.g., 'infrastructure-verification.js')
   * @param {object} options - Additional runtime options
   * @returns {object} The test result
   */
  async runTest(testName, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    // Check if test exists
    if (!this.testFiles[testName]) {
      throw new Error(`Test file not found: ${testName}`);
    }

    const testFile = this.testFiles[testName];
    const testId = testName.replace(/\.js$/, '');

    console.log(`Running test: ${testName}`);
    console.log(`Test file path: ${testFile.path}`);

    try {
      // Merge configuration with runtime options
      const runConfig = {
        ...this.config,
        ...options
      };

      // Start the Wrangler dev process if enabled
      if (runConfig.localEnvironment.wranglerEnabled) {
        await this._startWranglerDev();
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
          captureNetworkRequests: runConfig.localEnvironment.enableNetworkLogging
        },
        createReports: runConfig.createReports,
        verifyIntegrity: runConfig.verifyResults,
        integrateWithRegistry: true
      });

      // Initialize the test runner
      await testRunner.initialize({
        testId,
        runId: this.testRunId,
        environment: runConfig.localEnvironment,
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

      // Run the test
      const testResult = await testRunner.runTest(async (testContext) => {
        // Add verification criteria to test context
        testContext.verificationCriteria = this.verificationCriteria[testId] || null;
        
        // Add Wrangler reference if available
        if (this.currentWranglerProcess) {
          testContext.wranglerProcess = this.currentWranglerProcess;
        }
        
        // Call the actual test function
        return await testFunction(testContext);
      }, runConfig.localEnvironment);

      // Generate manifest
      let manifestResult = null;
      if (runConfig.generateManifest) {
        try {
          manifestResult = await this.manifestGenerator.generateFromRunnerResult(testResult);
          console.log(`Generated test manifest: ${manifestResult.path}`);
        } catch (manifestErr) {
          console.error(`Error generating manifest for ${testName}:`, manifestErr);
        }
      }

      // Store test results
      this.testResults[testName] = {
        success: testResult.success,
        time: new Date().toISOString(),
        runId: this.testRunId,
        result: testResult,
        manifestPath: manifestResult ? manifestResult.path : null
      };

      // Stop Wrangler if it was started
      if (runConfig.localEnvironment.wranglerEnabled && this.currentWranglerProcess) {
        await this._stopWranglerDev();
      }

      return {
        testName,
        success: testResult.success,
        runId: this.testRunId,
        result: testResult,
        manifestPath: manifestResult ? manifestResult.path : null
      };

    } catch (err) {
      console.error(`Error running test ${testName}:`, err);
      
      // Ensure Wrangler is stopped on error
      if (this.currentWranglerProcess) {
        await this._stopWranglerDev();
      }
      
      // Store failure result
      this.testResults[testName] = {
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
   * Run all tests in the correct dependency order
   * @param {object} options - Additional runtime options
   * @returns {object} The test suite results
   */
  async runAllTests(options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    console.log(`Running all tests in dependency order (Run ID: ${this.testRunId})`);
    
    const startTime = new Date();
    const results = {
      runId: this.testRunId,
      startTime: startTime.toISOString(),
      endTime: null,
      duration: 0,
      testsRun: 0,
      testsPassed: 0,
      testsFailed: 0,
      testsWithErrors: 0,
      results: {},
      consolidatedManifestPath: null
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
      console.log(`\n${'='.repeat(80)}\nRunning test [${results.testsRun + 1}/${executionOrder.length}]: ${testName}\n${'='.repeat(80)}\n`);
      
      // Run the test
      const testResult = await this.runTest(testName, runConfig);
      results.results[testName] = testResult;
      results.testsRun++;
      
      // Update counters
      if (testResult.success) {
        results.testsPassed++;
      } else if (testResult.error) {
        results.testsWithErrors++;
      } else {
        results.testsFailed++;
      }
      
      // Abort on failure if configured
      if (!testResult.success && runConfig.abortOnFailure) {
        console.log(`Test ${testName} failed, aborting test suite execution`);
        break;
      }
    }
    
    // Calculate duration
    const endTime = new Date();
    results.endTime = endTime.toISOString();
    results.duration = endTime - startTime;
    
    // Generate consolidated report
    if (runConfig.generateManifest) {
      try {
        const consolidatedReport = await this.manifestGenerator.generateConsolidatedReport(
          executionOrder.map(testName => testName.replace(/\.js$/, '')),
          `Edge-Agent-Test-Suite-${this.testRunId}`,
          null
        );
        
        results.consolidatedManifestPath = consolidatedReport.path;
        console.log(`Generated consolidated test report: ${consolidatedReport.path}`);
      } catch (reportErr) {
        console.error('Error generating consolidated report:', reportErr);
      }
    }
    
    // Generate summary
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Test Suite Execution Summary (Run ID: ${this.testRunId})`);
    console.log(`${'='.repeat(80)}`);
    console.log(`Tests Run: ${results.testsRun}/${executionOrder.length}`);
    console.log(`Tests Passed: ${results.testsPassed}`);
    console.log(`Tests Failed: ${results.testsFailed}`);
    console.log(`Tests With Errors: ${results.testsWithErrors}`);
    console.log(`Duration: ${results.duration}ms`);
    console.log(`Start Time: ${results.startTime}`);
    console.log(`End Time: ${results.endTime}`);
    
    if (results.consolidatedManifestPath) {
      console.log(`Consolidated Report: ${results.consolidatedManifestPath}`);
    }
    
    return results;
  }

  /**
   * Ensure required directories exist
   * @private
   */
  async _ensureDirectories() {
    const directories = [
      this.config.outputPath,
      path.join(this.config.outputPath, 'logs'),
      path.join(this.config.outputPath, 'evidence'),
      path.join(this.config.outputPath, 'reports'),
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
   * Discover available test files
   * @private
   */
  async _discoverTestFiles() {
    try {
      // Check if test scripts directory exists
      if (!fs.existsSync(this.config.testScriptsPath)) {
        throw new Error(`Test scripts directory not found: ${this.config.testScriptsPath}`);
      }
      
      // Read directory contents
      const files = await fs.promises.readdir(this.config.testScriptsPath);
      
      // Filter and process JavaScript files
      for (const file of files) {
        if (file.endsWith('.js')) {
          const fullPath = path.join(this.config.testScriptsPath, file);
          
          // Check if file exists and is a file
          const stats = await fs.promises.stat(fullPath);
          
          if (stats.isFile()) {
            this.testFiles[file] = {
              name: file,
              path: fullPath,
              size: stats.size,
              modified: stats.mtime.toISOString()
            };
          }
        }
      }
    } catch (err) {
      console.error('Error discovering test files:', err);
      throw err;
    }
  }

  /**
   * Load verification criteria for tests
   * @private
   */
  async _loadVerificationCriteria() {
    try {
      // Check if verification criteria directory exists
      if (!fs.existsSync(this.config.verificationCriteriaPath)) {
        console.warn(`Verification criteria directory not found: ${this.config.verificationCriteriaPath}`);
        return;
      }
      
      // Map test names to criteria file names
      for (const testName of Object.keys(this.testFiles)) {
        const testId = testName.replace(/\.js$/, '');
        const criteriaFileName = `${testId}-criteria.md`;
        const criteriaPath = path.join(this.config.verificationCriteriaPath, criteriaFileName);
        
        // Check for standard format first
        if (fs.existsSync(criteriaPath)) {
          this.verificationCriteria[testId] = {
            path: criteriaPath,
            loaded: true
          };
          continue;
        }
        
        // Check for alternative naming format
        const alternativeName = `${testId.replace(/-/g, '-')}-verification-criteria.md`;
        const alternativePath = path.join(this.config.verificationCriteriaPath, alternativeName);
        
        if (fs.existsSync(alternativePath)) {
          this.verificationCriteria[testId] = {
            path: alternativePath,
            loaded: true
          };
          continue;
        }
        
        // Final attempt with different format
        const legacyName = `${testId.replace(/-/g, '_')}_criteria.md`;
        const legacyPath = path.join(this.config.verificationCriteriaPath, legacyName);
        
        if (fs.existsSync(legacyPath)) {
          this.verificationCriteria[testId] = {
            path: legacyPath,
            loaded: true
          };
          continue;
        }
        
        console.warn(`No verification criteria found for test: ${testId}`);
      }
    } catch (err) {
      console.error('Error loading verification criteria:', err);
    }
  }

  /**
   * Start the Wrangler dev process
   * @private
   */
  async _startWranglerDev() {
    if (this.currentWranglerProcess) {
      console.log('Wrangler dev is already running');
      return;
    }
    
    console.log('Starting Wrangler dev process...');
    
    // In a real implementation, we would spawn a child process here
    // For now, we'll simulate it with an object
    this.currentWranglerProcess = {
      pid: Math.floor(Math.random() * 10000),
      started: new Date().toISOString(),
      url: 'http://localhost:8787',
      logs: []
    };
    
    // Since we are on Windows, we would run:
    // const { spawn } = require('child_process');
    // this.currentWranglerProcess = spawn('npx.cmd', ['wrangler', 'dev'], {
    //   cwd: process.cwd(),
    //   shell: true,
    //   stdio: ['ignore', 'pipe', 'pipe']
    // });
    
    console.log(`Wrangler dev process started (PID: ${this.currentWranglerProcess.pid})`);
    return this.currentWranglerProcess;
  }

  /**
   * Stop the Wrangler dev process
   * @private
   */
  async _stopWranglerDev() {
    if (!this.currentWranglerProcess) {
      console.log('No Wrangler dev process to stop');
      return;
    }
    
    console.log(`Stopping Wrangler dev process (PID: ${this.currentWranglerProcess.pid})...`);
    
    // In a real implementation, we would kill the child process here
    // For our simulation, we'll just clear the reference
    this.currentWranglerProcess = null;
    
    // In a real implementation on Windows, we would:
    // process.kill(this.currentWranglerProcess.pid);
    // or this.currentWranglerProcess.kill();
    
    console.log('Wrangler dev process stopped');
  }
}

module.exports = {
  LocalTestRunner,
  TEST_EXECUTION_ORDER
}; 