/**
 * Run All Tests
 * 
 * This script runs all the test scripts in sequence and updates the execution plan
 * with the results.
 * 
 * Usage:
 *   node run-all-tests.js
 * 
 * Environment variables:
 *   EDGE_AGENT_URL - URL of the Edge Agent deployment (required)
 *   SDK_KEY - SDK key to use for testing (required)
 *   LOG_LEVEL - Level of logging detail (default: info)
 *   SKIP_TESTS - Comma-separated list of test numbers to skip
 *   RUN_ONLY - Comma-separated list of test numbers to run (ignores SKIP_TESTS)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { markdownTable } = require('markdown-table');

// Configuration
const CONFIG = {
  // Required environment variables
  edgeAgentUrl: process.env.EDGE_AGENT_URL || 'https://edge-agent-test.expedge.workers.dev',
  sdkKey: process.env.SDK_KEY || '8mR1pGh8u2ztUP8GqjmQq',
  
  // Optional configuration
  logLevel: process.env.LOG_LEVEL || 'info', // 'debug', 'info', 'warn', 'error'
  executionPlanPath: '../execution-plan.md',
  resultDir: '../test-results',
  
  // Test execution
  skipTests: process.env.SKIP_TESTS ? process.env.SKIP_TESTS.split(',').map(Number) : [],
  runOnly: process.env.RUN_ONLY ? process.env.RUN_ONLY.split(',').map(Number) : [],
  
  // Test scripts to run
  testScripts: [
    {
      id: 1,
      name: 'Infrastructure Verification',
      script: 'infrastructure-verification.js',
      description: 'Verifies basic connectivity and infrastructure setup'
    },
    {
      id: 2,
      name: 'CDN Variation Settings',
      script: 'cdn-variation-test.js',
      description: 'Tests CDN variation settings functionality'
    },
    {
      id: 3,
      name: 'Decision API',
      script: 'decision-api-test.js',
      description: 'Tests decision API endpoints'
    },
    {
      id: 4,
      name: 'Parameter Validation',
      script: 'parameter-validation-test.js',
      description: 'Tests parameter handling and validation'
    },
    {
      id: 5,
      name: 'Feature Parity',
      script: 'feature-parity-test.js',
      description: 'Verifies feature parity with original implementation'
    }
  ]
};

// Validation timestamps for unique filenames
const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
const testId = `run-all-tests-${timestamp}`;

// Initialize logging
const logger = {
  debug: (msg, data) => CONFIG.logLevel === 'debug' && console.log(`[DEBUG] ${msg}`, data ? JSON.stringify(data) : ''),
  info: (msg, data) => ['debug', 'info'].includes(CONFIG.logLevel) && console.log(`[INFO] ${msg}`, data ? JSON.stringify(data) : ''),
  warn: (msg, data) => ['debug', 'info', 'warn'].includes(CONFIG.logLevel) && console.warn(`[WARN] ${msg}`, data ? JSON.stringify(data) : ''),
  error: (msg, data) => console.error(`[ERROR] ${msg}`, data ? JSON.stringify(data) : '')
};

// Results storage
const testResults = {
  timestamp: timestamp,
  testId: testId,
  environment: {
    edgeAgentUrl: CONFIG.edgeAgentUrl,
    sdkKey: CONFIG.sdkKey,
    nodeVersion: process.version
  },
  results: []
};

/**
 * Save test results to a file
 */
function saveResults() {
  try {
    // Ensure the directory exists
    if (!fs.existsSync(CONFIG.resultDir)) {
      fs.mkdirSync(CONFIG.resultDir, { recursive: true });
    }
    
    // Write results to file
    const filePath = path.join(CONFIG.resultDir, `${testId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(testResults, null, 2));
    logger.info(`Results saved to ${filePath}`);
    
    // Write summary to markdown file
    const summaryPath = path.join(CONFIG.resultDir, `${testId}.md`);
    const summary = generateMarkdownSummary();
    fs.writeFileSync(summaryPath, summary);
    logger.info(`Summary saved to ${summaryPath}`);
    
    return filePath;
  } catch (error) {
    logger.error('Failed to save results');
    console.error(error);
    return null;
  }
}

/**
 * Generate a markdown summary of test results
 */
function generateMarkdownSummary() {
  const passCount = testResults.results.filter(r => r.status === 'PASS').length;
  const failCount = testResults.results.filter(r => r.status === 'FAIL').length;
  const skipCount = testResults.results.filter(r => r.status === 'SKIP').length;
  const totalCount = testResults.results.length;
  
  let markdown = `# Test Execution Summary\n\n`;
  markdown += `Test Date: ${new Date(timestamp).toLocaleString()}\n\n`;
  markdown += `## Summary\n\n`;
  markdown += `- Edge Agent URL: \`${CONFIG.edgeAgentUrl}\`\n`;
  markdown += `- SDK Key: \`${CONFIG.sdkKey}\`\n`;
  markdown += `- Results: ${passCount}/${totalCount} tests passed, ${failCount} failed, ${skipCount} skipped\n\n`;
  
  // Create a table of results
  const tableRows = [
    ['ID', 'Test', 'Status', 'Duration', 'Notes']
  ];
  
  testResults.results.forEach(result => {
    tableRows.push([
      result.id.toString(),
      result.name,
      getStatusIcon(result.status),
      result.duration ? `${(result.duration / 1000).toFixed(2)}s` : '-',
      result.notes || '-'
    ]);
  });
  
  markdown += markdownTable(tableRows) + '\n\n';
  
  markdown += `## Details\n\n`;
  
  testResults.results.forEach(result => {
    markdown += `### ${result.id}. ${result.name}\n\n`;
    markdown += `- **Status**: ${getStatusIcon(result.status)}\n`;
    markdown += `- **Description**: ${result.description}\n`;
    markdown += `- **Duration**: ${result.duration ? `${(result.duration / 1000).toFixed(2)} seconds` : 'N/A'}\n`;
    
    if (result.notes) {
      markdown += `- **Notes**: ${result.notes}\n`;
    }
    
    if (result.output) {
      markdown += `\n**Output**:\n\n`;
      markdown += `\`\`\`\n${result.output.trim()}\n\`\`\`\n\n`;
    }
    
    if (result.error) {
      markdown += `\n**Error**:\n\n`;
      markdown += `\`\`\`\n${result.error}\n\`\`\`\n\n`;
    }
    
    markdown += '\n';
  });
  
  return markdown;
}

/**
 * Get status icon for display
 */
function getStatusIcon(status) {
  switch (status) {
    case 'PASS': return '✅ PASS';
    case 'FAIL': return '❌ FAIL';
    case 'SKIP': return '⏭️ SKIP';
    case 'RUNNING': return '🔄 RUNNING';
    default: return status;
  }
}

/**
 * Update the execution plan with test results
 */
function updateExecutionPlan() {
  try {
    const planPath = path.resolve(__dirname, CONFIG.executionPlanPath);
    
    if (!fs.existsSync(planPath)) {
      logger.error(`Execution plan not found at ${planPath}`);
      return;
    }
    
    let content = fs.readFileSync(planPath, 'utf8');
    
    // Map our test scripts to their corresponding sections in the execution plan
    const mappings = [
      { 
        id: 1, 
        regex: /(- \[ \] \*\*1\.1 Basic Connectivity\*\*) ⏳/g,
        replacement: `$1 ${getScriptResult(1) === 'PASS' ? '✅' : '❌'}`
      },
      { 
        id: 1, 
        regex: /(- \[ \] \*\*1\.2 SDK Key Validation\*\*) ⏳/g,
        replacement: `$1 ${getScriptResult(1) === 'PASS' ? '✅' : '❌'}`
      },
      { 
        id: 2, 
        regex: /(- \[ \] \*\*3\.1 URL Pattern Matching\*\*) ⏳/g,
        replacement: `$1 ${getScriptResult(2) === 'PASS' ? '✅' : '❌'}`
      },
      { 
        id: 2, 
        regex: /(- \[ \] \*\*3\.2 Origin Request Forwarding\*\*) ⏳/g,
        replacement: `$1 ${getScriptResult(2) === 'PASS' ? '✅' : '❌'}`
      },
      { 
        id: 2, 
        regex: /(- \[ \] \*\*3\.3 Content Transformation\*\*) ⏳/g,
        replacement: `$1 ${getScriptResult(2) === 'PASS' ? '✅' : '❌'}`
      },
      { 
        id: 2, 
        regex: /(- \[ \] \*\*4\.1 Basic Caching\*\*) ⏳/g,
        replacement: `$1 ${getScriptResult(2) === 'PASS' ? '✅' : '❌'}`
      },
      { 
        id: 2, 
        regex: /(- \[ \] \*\*4\.2 Cache Key Variations\*\*) ⏳/g,
        replacement: `$1 ${getScriptResult(2) === 'PASS' ? '✅' : '❌'}`
      },
      { 
        id: 2, 
        regex: /(- \[ \] \*\*4\.3 Cache Configuration\*\*) ⏳/g,
        replacement: `$1 ${getScriptResult(2) === 'PASS' ? '✅' : '❌'}`
      },
      { 
        id: 3, 
        regex: /(- \[ \] \*\*2\.1 Feature Flag Decisions\*\*) ⏳/g,
        replacement: `$1 ${getScriptResult(3) === 'PASS' ? '✅' : '❌'}`
      },
      { 
        id: 3, 
        regex: /(- \[ \] \*\*2\.2 Experiment Decisions\*\*) ⏳/g,
        replacement: `$1 ${getScriptResult(3) === 'PASS' ? '✅' : '❌'}`
      },
      { 
        id: 3, 
        regex: /(- \[ \] \*\*2\.3 Forced Variations\*\*) ⏳/g,
        replacement: `$1 ${getScriptResult(3) === 'PASS' ? '✅' : '❌'}`
      },
      { 
        id: 3, 
        regex: /(- \[ \] \*\*5\.3 Decision Endpoints\*\*) ⏳/g,
        replacement: `$1 ${getScriptResult(3) === 'PASS' ? '✅' : '❌'}`
      },
      { 
        id: 4, 
        regex: /(- \[ \] \*\*6\.1 Header Parameters\*\*) ⏳/g,
        replacement: `$1 ${getScriptResult(4) === 'PASS' ? '✅' : '❌'}`
      },
      { 
        id: 4, 
        regex: /(- \[ \] \*\*6\.2 Query Parameters\*\*) ⏳/g,
        replacement: `$1 ${getScriptResult(4) === 'PASS' ? '✅' : '❌'}`
      },
      { 
        id: 4, 
        regex: /(- \[ \] \*\*6\.3 JSON Body Parameters\*\*) ⏳/g,
        replacement: `$1 ${getScriptResult(4) === 'PASS' ? '✅' : '❌'}`
      },
      { 
        id: 5, 
        regex: /(- \[ \] \*\*7\.1 Core Feature Verification\*\*) ⏳/g,
        replacement: `$1 ${getScriptResult(5) === 'PASS' ? '✅' : '❌'}`
      },
      { 
        id: 5, 
        regex: /(- \[ \] \*\*7\.2 Side-by-Side Comparison\*\*) ⏳/g,
        replacement: `$1 ${getScriptResult(5) === 'PASS' ? '✅' : '❌'}`
      }
    ];
    
    // Update the test execution history
    let historyTable = '| Date | Test ID | Status | Tester | Notes |\n|------|---------|--------|--------|-------|\n';
    testResults.results.forEach(result => {
      historyTable += `| ${new Date(timestamp).toISOString().split('T')[0]} | ${result.id} | ${getStatusIcon(result.status)} | ${process.env.USER || 'AI'} | ${result.notes || '-'} |\n`;
    });
    
    // Replace the existing table
    content = content.replace(/\| Date \| Test ID \| Status \| Tester \| Notes \|[\s\S]*?\n\n/, historyTable + '\n\n');
    
    // Apply all mappings
    mappings.forEach(mapping => {
      if (wasScriptRun(mapping.id)) {
        content = content.replace(mapping.regex, mapping.replacement);
      }
    });
    
    // Write updated plan back to file
    fs.writeFileSync(planPath, content);
    logger.info(`Updated execution plan at ${planPath}`);
  } catch (error) {
    logger.error('Failed to update execution plan');
    console.error(error);
  }
}

/**
 * Get the result of a specific test script
 */
function getScriptResult(id) {
  const result = testResults.results.find(r => r.id === id);
  return result ? result.status : 'SKIP';
}

/**
 * Check if a script was run
 */
function wasScriptRun(id) {
  return testResults.results.some(r => r.id === id && r.status !== 'SKIP');
}

/**
 * Run a single test script
 */
async function runTestScript(script) {
  logger.info(`Running test script: ${script.name} (${script.script})`);
  
  // Record the test as running
  const result = {
    id: script.id,
    name: script.name,
    description: script.description,
    script: script.script,
    status: 'RUNNING',
    startTime: Date.now()
  };
  
  testResults.results.push(result);
  
  try {
    // Set environment variables for the test
    const env = {
      ...process.env,
      EDGE_AGENT_URL: CONFIG.edgeAgentUrl,
      SDK_KEY: CONFIG.sdkKey,
      LOG_LEVEL: CONFIG.logLevel
    };
    
    // Run the test script
    const output = execSync(`node ${script.script}`, {
      cwd: __dirname,
      env,
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    // Update the result
    result.status = 'PASS';
    result.output = output;
    result.endTime = Date.now();
    result.duration = result.endTime - result.startTime;
    
    logger.info(`✅ PASS: ${script.name}`);
  } catch (error) {
    // Update the result
    result.status = 'FAIL';
    result.output = error.stdout;
    result.error = error.message;
    result.endTime = Date.now();
    result.duration = result.endTime - result.startTime;
    
    logger.error(`❌ FAIL: ${script.name}`);
    logger.debug(error.message);
  }
}

/**
 * Main test runner
 */
async function runTests() {
  logger.info(`Starting test execution`, {
    edgeAgentUrl: CONFIG.edgeAgentUrl,
    sdkKey: CONFIG.sdkKey,
    skipTests: CONFIG.skipTests,
    runOnly: CONFIG.runOnly
  });
  
  // Filter scripts to run
  const scriptsToRun = CONFIG.testScripts.filter(script => {
    // If runOnly is specified, only run those scripts
    if (CONFIG.runOnly.length > 0) {
      return CONFIG.runOnly.includes(script.id);
    }
    
    // Otherwise, run all scripts except those in skipTests
    return !CONFIG.skipTests.includes(script.id);
  });
  
  // Add skipped scripts to results
  CONFIG.testScripts.forEach(script => {
    if (!scriptsToRun.some(s => s.id === script.id)) {
      testResults.results.push({
        id: script.id,
        name: script.name,
        description: script.description,
        script: script.script,
        status: 'SKIP',
        notes: 'Skipped based on configuration'
      });
    }
  });
  
  // Run each script sequentially
  for (const script of scriptsToRun) {
    await runTestScript(script);
  }
  
  // Save results and update execution plan
  saveResults();
  updateExecutionPlan();
  
  // Determine overall success
  const allPassed = testResults.results
    .filter(r => r.status !== 'SKIP')
    .every(r => r.status === 'PASS');
    
  const passCount = testResults.results.filter(r => r.status === 'PASS').length;
  const totalRun = testResults.results.filter(r => r.status !== 'SKIP').length;
  
  logger.info(`Test execution complete: ${passCount}/${totalRun} tests passed`);
  
  return allPassed;
}

// Run the tests
runTests()
  .then(success => {
    if (success) {
      logger.info('All tests passed successfully! 🎉');
      process.exit(0);
    } else {
      logger.error('Some tests failed. See results for details.');
      process.exit(1);
    }
  })
  .catch(error => {
    logger.error('Test execution failed');
    console.error(error);
    process.exit(1);
  }); 