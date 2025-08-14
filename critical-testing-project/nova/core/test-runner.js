/**
 * NOVA Test Runner - Core Orchestrator
 * No mocks, only real HTTP requests to live endpoints
 */

const fs = require('fs').promises;
const path = require('path');
const { HttpClient } = require('./http-client');
const { ResultCapture } = require('./result-capture');
const { Validator } = require('./validator');
const { Reporter } = require('./reporter');

class TestRunner {
  constructor(options = {}) {
    this.environment = options.environment || 'local';
    this.suite = options.suite || 'quick';
    this.adapter = options.adapter;
    this.sessionId = options.sessionId || this.generateSessionId();
    this.verbose = options.verbose || false;
    this.dryRun = options.dryRun || false;
    this.continueOnFailure = options.continueOnFailure !== false;
    
    // Load configurations
    this.config = this.loadConfigurations();
    
    // Initialize components
    this.httpClient = new HttpClient(this.config);
    this.resultCapture = new ResultCapture(this.sessionId, this.config);
    this.validator = new Validator(this.config);
    this.reporter = new Reporter(this.sessionId, this.config);
    
    // Test results
    this.results = {
      sessionId: this.sessionId,
      environment: this.environment,
      adapter: this.adapter || this.config.env.adapter,
      suite: this.suite,
      startTime: null,
      endTime: null,
      tests: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0
      }
    };
  }

  loadConfigurations() {
    const configDir = path.join(__dirname, '..', 'config');
    
    // Load all config files
    const environments = require(path.join(configDir, 'environments.json'));
    const adapters = require(path.join(configDir, 'adapters.json'));
    const suites = require(path.join(configDir, 'test-suites.json'));
    const credentials = this.loadCredentials(configDir);
    
    // Get specific configurations
    const env = environments.environments[this.environment];
    if (!env) {
      throw new Error(`Unknown environment: ${this.environment}`);
    }
    
    const adapter = this.adapter || env.adapter;
    const adapterConfig = adapters.adapters[adapter];
    if (!adapterConfig) {
      throw new Error(`Unknown adapter: ${adapter}`);
    }
    
    const suite = suites.suites[this.suite];
    if (!suite) {
      throw new Error(`Unknown suite: ${this.suite}`);
    }
    
    return {
      env,
      adapter: adapterConfig,
      suite,
      credentials,
      adapters,
      suites
    };
  }

  loadCredentials(configDir) {
    try {
      // Try to load from file first
      return require(path.join(configDir, 'credentials.json'));
    } catch (e) {
      // Fall back to environment variables and defaults
      return {
        sdkKey: process.env.SDK_KEY || '8mR1pGh8u2ztUP8GqjmQq',
        flagKey: process.env.FLAG_KEY || 'test-flag',
        adminToken: process.env.ADMIN_TOKEN || 'dev-admin-token',
        visitorId: process.env.VISITOR_ID || 'nova-test-user'
      };
    }
  }

  generateSessionId() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}-${random}`;
  }

  async run() {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`NOVA Test Runner - Session ${this.sessionId}`);
    console.log(`Environment: ${this.config.env.name} (${this.config.env.url})`);
    console.log(`Adapter: ${this.config.adapter.name}`);
    console.log(`Test Suite: ${this.config.suite.name}`);
    console.log(`${'='.repeat(60)}\n`);

    if (this.dryRun) {
      console.log('DRY RUN MODE - No actual requests will be made\n');
    }

    this.results.startTime = new Date().toISOString();

    try {
      // Verify environment is accessible
      await this.verifyEnvironment();

      // Load and run test suite
      const tests = await this.loadTests();
      
      for (const test of tests) {
        const result = await this.runTest(test);
        this.results.tests.push(result);
        
        if (result.status === 'passed') {
          this.results.summary.passed++;
        } else if (result.status === 'failed') {
          this.results.summary.failed++;
          if (!this.continueOnFailure) {
            console.error(`\n❌ Test failed. Stopping execution.`);
            break;
          }
        } else if (result.status === 'skipped') {
          this.results.summary.skipped++;
        }
        
        this.results.summary.total++;
      }

    } catch (error) {
      console.error(`\n❌ Fatal error: ${error.message}`);
      this.results.error = error.message;
    }

    this.results.endTime = new Date().toISOString();

    // Generate reports
    await this.generateReports();

    // Print summary
    this.printSummary();

    return this.results;
  }

  async verifyEnvironment() {
    if (this.dryRun) return;

    console.log(`Verifying environment connectivity...`);
    
    try {
      const response = await this.httpClient.request({
        method: 'GET',
        url: `${this.config.env.url}/api/test`,
        headers: {}
      });

      if (response.status !== 200) {
        throw new Error(`Environment health check failed: ${response.status}`);
      }

      console.log(`✅ Environment is accessible\n`);
    } catch (error) {
      throw new Error(`Cannot connect to environment: ${error.message}`);
    }
  }

  async loadTests() {
    const tests = [];
    const testPatterns = this.config.suite.tests;

    for (const pattern of testPatterns) {
      if (pattern === '*') {
        // Load all tests
        tests.push(...await this.loadAllTests());
      } else {
        // Load specific test
        const test = await this.loadTest(pattern);
        if (test) {
          tests.push(test);
        }
      }
    }

    console.log(`Loaded ${tests.length} tests\n`);
    return tests;
  }

  async loadTest(testId) {
    const [category, ...parts] = testId.split('.');
    const testName = parts.join('.');
    
    try {
      const suitePath = path.join(__dirname, '..', 'suites', 
        category === 'agent' ? 'agent-mode' :
        category === 'edge' ? 'edge-mode' :
        category === 'adapter' ? 'adapter-specific' :
        category === 'regression' ? 'regression' : category
      );

      // Load the suite module
      const suiteModule = require(path.join(suitePath, `${parts[0]}.suite.js`));
      
      // Find the specific test
      const test = suiteModule.tests.find(t => t.id === testId);
      if (!test) {
        console.warn(`⚠️  Test not found: ${testId}`);
        return null;
      }

      return test;
    } catch (error) {
      console.warn(`⚠️  Could not load test ${testId}: ${error.message}`);
      return null;
    }
  }

  async loadAllTests() {
    const tests = [];
    const suitesDir = path.join(__dirname, '..', 'suites');
    
    const categories = ['agent-mode', 'edge-mode', 'adapter-specific', 'regression'];
    
    for (const category of categories) {
      const categoryDir = path.join(suitesDir, category);
      
      try {
        const files = await fs.readdir(categoryDir);
        
        for (const file of files) {
          if (file.endsWith('.suite.js')) {
            const suiteModule = require(path.join(categoryDir, file));
            tests.push(...suiteModule.tests);
          }
        }
      } catch (error) {
        // Category might not exist
      }
    }

    return tests;
  }

  async runTest(test) {
    const startTime = Date.now();
    const result = {
      id: test.id,
      name: test.name,
      description: test.description,
      status: 'pending',
      duration: 0,
      request: null,
      response: null,
      validation: null,
      error: null
    };

    console.log(`Running: ${test.name}`);

    if (this.dryRun) {
      result.status = 'skipped';
      result.reason = 'Dry run mode';
      console.log(`  ⏭️  Skipped (dry run)\n`);
      return result;
    }

    try {
      // Prepare test context
      const context = {
        env: this.config.env,
        adapter: this.config.adapter,
        credentials: this.config.credentials,
        httpClient: this.httpClient,
        validator: this.validator
      };

      // Execute test
      const testResult = await test.execute(context);
      
      // Capture results
      result.request = testResult.request;
      result.response = testResult.response;
      result.validation = testResult.validation;

      // Validate response
      if (testResult.validation && testResult.validation.passed) {
        result.status = 'passed';
        console.log(`  ✅ Passed\n`);
      } else {
        result.status = 'failed';
        result.error = testResult.validation?.errors || ['Validation failed'];
        console.log(`  ❌ Failed: ${result.error.join(', ')}\n`);
      }

      // Capture evidence
      await this.resultCapture.capture(test.id, testResult);

    } catch (error) {
      result.status = 'failed';
      result.error = error.message;
      console.log(`  ❌ Error: ${error.message}\n`);
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  async generateReports() {
    console.log(`\nGenerating reports...`);
    
    try {
      // Save raw results
      await this.resultCapture.saveResults(this.results);
      
      // Generate HTML report
      await this.reporter.generateHtmlReport(this.results);
      
      // Generate JSON report
      await this.reporter.generateJsonReport(this.results);
      
      // Generate comparison if baseline exists
      if (this.config.baselineSession) {
        await this.reporter.generateComparison(this.config.baselineSession, this.sessionId);
      }
      
      console.log(`✅ Reports generated in nova/results/sessions/${this.sessionId}/\n`);
    } catch (error) {
      console.error(`⚠️  Failed to generate reports: ${error.message}\n`);
    }
  }

  printSummary() {
    const { summary } = this.results;
    const duration = this.results.endTime ? 
      (new Date(this.results.endTime) - new Date(this.results.startTime)) / 1000 : 0;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Test Summary`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Total:   ${summary.total}`);
    console.log(`Passed:  ${summary.passed} ✅`);
    console.log(`Failed:  ${summary.failed} ❌`);
    console.log(`Skipped: ${summary.skipped} ⏭️`);
    console.log(`Duration: ${duration.toFixed(2)}s`);
    console.log(`${'='.repeat(60)}\n`);

    // Exit code based on results
    if (summary.failed > 0) {
      process.exit(1);
    }
  }
}

module.exports = { TestRunner };