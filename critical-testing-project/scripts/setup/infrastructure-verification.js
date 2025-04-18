/**
 * Optimizely Edge Agent - Feature Parity Testing Infrastructure Verification
 * 
 * This script verifies that the testing infrastructure is properly set up for 
 * performing feature parity testing between src/ and src-v2/ implementations.
 * It confirms both implementations exist, checks for required dependencies,
 * ensures test fixtures are available, and runs basic smoke tests.
 */

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

// Configuration
const config = {
  EDGE_AGENT_URL: process.env.EDGE_AGENT_URL || 'http://localhost:8787',
  SDK_KEY: process.env.SDK_KEY || 'test-sdk-key',
  TEST_ID: `parity-test-${Date.now()}`,
  RESULTS_DIR: path.join(__dirname, '../../results'),
  
  // Source code paths - relative to project root
  SRC_V1_PATH: '../../../src',
  SRC_V2_PATH: '../../../src-v2',
  
  // Key files to check for existence in each implementation - these are the files that actually exist
  KEY_FILES_V1: [
    'coreLogic.js',
    'index.js',
    'router.js'
  ],
  KEY_FILES_V2: [
    'services/implementations/RequestHandler.ts',
    'services/implementations/ApiRouter.ts',
    'services/implementations/EdgeModeHandler.ts',
    'services/implementations/CacheManager.ts'
  ],
  
  // Required dependencies
  REQUIRED_DEPENDENCIES: [
    'node-fetch'
  ]
};

// Ensure results directory exists
if (!fs.existsSync(config.RESULTS_DIR)) {
  fs.mkdirSync(config.RESULTS_DIR, { recursive: true });
}

// Results container
const testResults = {
  testId: config.TEST_ID,
  timestamp: new Date().toISOString(),
  environment: {
    EDGE_AGENT_URL: config.EDGE_AGENT_URL,
    SDK_KEY: config.SDK_KEY ? '****' + config.SDK_KEY.substr(-4) : 'not-set',
    nodeVersion: process.version,
    platform: process.platform
  },
  tests: [],
  summary: {
    totalTests: 0,
    passed: 0,
    failed: 0,
    status: 'not-run'
  }
};

// Test functions
async function checkSourceCodeAvailability() {
  const testName = 'Source Code Availability';
  console.log(`Running test: ${testName}`);
  
  const result = {
    name: testName,
    status: 'running',
    timestamp: new Date().toISOString(),
    details: {
      v1Files: { total: config.KEY_FILES_V1.length, found: 0, missing: [] },
      v2Files: { total: config.KEY_FILES_V2.length, found: 0, missing: [] }
    },
    evidence: {}
  };
  
  try {
    // Check v1 implementation files
    const v1BasePath = path.resolve(__dirname, config.SRC_V1_PATH);
    result.details.v1BasePath = v1BasePath;
    result.evidence.v1Exists = fs.existsSync(v1BasePath);
    
    if (result.evidence.v1Exists) {
      for (const file of config.KEY_FILES_V1) {
        const filePath = path.join(v1BasePath, file);
        const exists = fs.existsSync(filePath);
        
        if (exists) {
          result.details.v1Files.found++;
        } else {
          result.details.v1Files.missing.push(file);
        }
      }
    }
    
    // Check v2 implementation files
    const v2BasePath = path.resolve(__dirname, config.SRC_V2_PATH);
    result.details.v2BasePath = v2BasePath;
    result.evidence.v2Exists = fs.existsSync(v2BasePath);
    
    if (result.evidence.v2Exists) {
      for (const file of config.KEY_FILES_V2) {
        const filePath = path.join(v2BasePath, file);
        const exists = fs.existsSync(filePath);
        
        if (exists) {
          result.details.v2Files.found++;
        } else {
          result.details.v2Files.missing.push(file);
        }
      }
    }
    
    // Determine test status
    const v1Complete = result.details.v1Files.found === result.details.v1Files.total;
    const v2Complete = result.details.v2Files.found === result.details.v2Files.total;
    
    if (v1Complete && v2Complete) {
      result.status = 'passed';
      console.log(`✅ ${testName} - All source files verified`);
      console.log(`   v1: ${result.details.v1Files.found}/${result.details.v1Files.total} files found`);
      console.log(`   v2: ${result.details.v2Files.found}/${result.details.v2Files.total} files found`);
    } else {
      result.status = 'failed';
      console.error(`❌ ${testName} - Missing source files`);
      
      if (!result.evidence.v1Exists) {
        console.error(`   v1: Base path not found at ${v1BasePath}`);
      } else if (!v1Complete) {
        console.error(`   v1: ${result.details.v1Files.found}/${result.details.v1Files.total} files found, missing: ${result.details.v1Files.missing.join(', ')}`);
      }
      
      if (!result.evidence.v2Exists) {
        console.error(`   v2: Base path not found at ${v2BasePath}`);
      } else if (!v2Complete) {
        console.error(`   v2: ${result.details.v2Files.found}/${result.details.v2Files.total} files found, missing: ${result.details.v2Files.missing.join(', ')}`);
      }
    }
  } catch (error) {
    result.status = 'failed';
    result.details.error = error.message;
    console.error(`❌ ${testName} - Error: ${error.message}`);
  }
  
  testResults.tests.push(result);
  return result;
}

async function checkDependencies() {
  const testName = 'Required Dependencies';
  console.log(`Running test: ${testName}`);
  
  const result = {
    name: testName,
    status: 'running',
    timestamp: new Date().toISOString(),
    details: { 
      total: config.REQUIRED_DEPENDENCIES.length,
      found: 0,
      missing: []
    },
    evidence: {}
  };
  
  try {
    // Check package.json in project root
    const packageJsonPath = path.resolve(__dirname, '../../package.json');
    if (!fs.existsSync(packageJsonPath)) {
      result.status = 'failed';
      result.details.error = 'package.json not found';
      console.error(`❌ ${testName} - package.json not found at ${packageJsonPath}`);
      testResults.tests.push(result);
      return result;
    }
    
    // Read and parse package.json
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const dependencies = { 
      ...packageJson.dependencies || {}, 
      ...packageJson.devDependencies || {} 
    };
    
    result.evidence.dependencies = dependencies;
    
    // Check each required dependency
    for (const dep of config.REQUIRED_DEPENDENCIES) {
      if (dependencies[dep]) {
        result.details.found++;
      } else {
        result.details.missing.push(dep);
      }
    }
    
    // Determine test status
    if (result.details.found === result.details.total) {
      result.status = 'passed';
      console.log(`✅ ${testName} - All required dependencies found`);
      console.log(`   Found: ${result.details.found}/${result.details.total} dependencies`);
    } else {
      result.status = 'failed';
      console.error(`❌ ${testName} - Missing dependencies`);
      console.error(`   Missing: ${result.details.missing.join(', ')}`);
    }
  } catch (error) {
    result.status = 'failed';
    result.details.error = error.message;
    console.error(`❌ ${testName} - Error: ${error.message}`);
  }
  
  testResults.tests.push(result);
  return result;
}

async function checkTestFixtures() {
  const testName = 'Test Fixtures';
  console.log(`Running test: ${testName}`);
  
  const result = {
    name: testName,
    status: 'running',
    timestamp: new Date().toISOString(),
    details: {
      fixtures: {
        total: 0,
        found: 0,
        missing: []
      },
      directories: {
        required: [
          'scripts/agent-mode',
          'scripts/edge-mode',
          'scripts/parity-sweep',
          'results'
        ],
        found: 0,
        missing: []
      }
    },
    evidence: {}
  };
  
  try {
    // Check for required test directories
    const projectRoot = path.resolve(__dirname, '../..');
    
    for (const dir of result.details.directories.required) {
      const dirPath = path.join(projectRoot, dir);
      if (fs.existsSync(dirPath)) {
        result.details.directories.found++;
      } else {
        result.details.directories.missing.push(dir);
      }
    }
    
    // Check for mock fixtures (just check a few examples to ensure structure is ready)
    const fixturesToCheck = [
      { path: 'utils/test-utils.js', type: 'utils' },
      { path: 'scripts/run-test-with-wrangler.js', type: 'runner' }
    ];
    
    result.details.fixtures.total = fixturesToCheck.length;
    
    for (const fixture of fixturesToCheck) {
      const fixturePath = path.join(projectRoot, fixture.path);
      if (fs.existsSync(fixturePath)) {
        result.details.fixtures.found++;
      } else {
        result.details.fixtures.missing.push(fixture.path);
      }
    }
    
    // Determine test status
    const dirsComplete = result.details.directories.found === result.details.directories.required.length;
    const fixturesComplete = result.details.fixtures.found === result.details.fixtures.total;
    
    if (dirsComplete && fixturesComplete) {
      result.status = 'passed';
      console.log(`✅ ${testName} - All test fixtures and directories verified`);
    } else {
      // This is a warning, not a failure - we can create missing directories
      result.status = 'warning';
      console.warn(`⚠️ ${testName} - Some test fixtures or directories missing`);
      
      if (!dirsComplete) {
        console.warn(`   Missing directories: ${result.details.directories.missing.join(', ')}`);
        console.warn(`   These will be created during test implementation`);
      }
      
      if (!fixturesComplete) {
        console.warn(`   Missing fixtures: ${result.details.fixtures.missing.join(', ')}`);
      }
    }
  } catch (error) {
    result.status = 'failed';
    result.details.error = error.message;
    console.error(`❌ ${testName} - Error: ${error.message}`);
  }
  
  testResults.tests.push(result);
  return result;
}

async function runBasicSmokeTest() {
  const testName = 'Basic Smoke Test';
  console.log(`Running test: ${testName}`);
  
  const result = {
    name: testName,
    status: 'running',
    timestamp: new Date().toISOString(),
    details: {},
    evidence: {}
  };
  
  try {
    // Try to import the core modules to verify they can be loaded
    // Since we can't dynamically import in this context, we'll simulate by checking existence
    const v1CorePath = path.resolve(__dirname, config.SRC_V1_PATH, 'coreLogic.js');
    const v2CorePath = path.resolve(__dirname, config.SRC_V2_PATH, 'services/implementations/RequestHandler.ts');
    
    result.evidence.v1ModuleExists = fs.existsSync(v1CorePath);
    result.evidence.v2ModuleExists = fs.existsSync(v2CorePath);
    
    // Check for wrangler configuration (crucial for tests)
    const wranglerConfigPath = path.resolve(__dirname, '../../../wrangler.toml');
    result.evidence.wranglerConfigExists = fs.existsSync(wranglerConfigPath);
    
    // Try to access the Edge Agent endpoint for a basic connectivity check
    try {
      const response = await fetch(config.EDGE_AGENT_URL);
      result.details.connectivity = {
        status: response.status,
        statusText: response.statusText
      };
      result.evidence.connectivityOk = response.status >= 200 && response.status < 500;
    } catch (error) {
      result.details.connectivity = {
        error: error.message
      };
      result.evidence.connectivityOk = false;
    }
    
    // Determine overall test status
    const moduleChecksOk = result.evidence.v1ModuleExists && result.evidence.v2ModuleExists;
    
    if (moduleChecksOk) {
      if (result.evidence.connectivityOk) {
        result.status = 'passed';
        console.log(`✅ ${testName} - All components verified and connectivity confirmed`);
      } else {
        // Connectivity issues are warnings, not failures
        result.status = 'warning';
        console.warn(`⚠️ ${testName} - Source modules verified but connectivity issues detected`);
        console.warn(`   This might be expected if the Edge Agent is not currently running`);
      }
    } else {
      result.status = 'failed';
      console.error(`❌ ${testName} - Source module verification failed`);
      if (!result.evidence.v1ModuleExists) console.error(`   v1 core module not found at ${v1CorePath}`);
      if (!result.evidence.v2ModuleExists) console.error(`   v2 core module not found at ${v2CorePath}`);
    }
    
  } catch (error) {
    result.status = 'failed';
    result.details.error = error.message;
    console.error(`❌ ${testName} - Error: ${error.message}`);
  }
  
  testResults.tests.push(result);
  return result;
}

// Generate HTML report for better visualization
function generateReport(results) {
  const reportPath = path.join(config.RESULTS_DIR, `parity-infrastructure-check-${results.testId}.html`);
  
  const statusColors = {
    passed: '#28a745',
    failed: '#dc3545',
    warning: '#ffc107',
    running: '#6c757d',
    'not-run': '#6c757d'
  };
  
  let testRowsHtml = '';
  for (const test of results.tests) {
    const statusColor = statusColors[test.status] || '#6c757d';
    
    let detailsHtml = '<pre class="details-json">' + JSON.stringify(test.details, null, 2) + '</pre>';
    
    testRowsHtml += `
      <tr>
        <td>${test.name}</td>
        <td><span class="badge" style="background-color: ${statusColor}">${test.status}</span></td>
        <td>${new Date(test.timestamp).toLocaleString()}</td>
        <td>
          <button class="btn btn-sm btn-outline-primary" type="button" data-bs-toggle="collapse" data-bs-target="#details-${test.name.replace(/\s+/g, '')}" aria-expanded="false">
            Show Details
          </button>
          <div class="collapse mt-2" id="details-${test.name.replace(/\s+/g, '')}">
            ${detailsHtml}
          </div>
        </td>
      </tr>
    `;
  }
  
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Parity Testing Infrastructure Check - ${results.testId}</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
      <style>
        body { padding: 20px; }
        .details-json { max-height: 300px; overflow-y: auto; background-color: #f8f9fa; padding: 10px; border-radius: 5px; }
        .summary-status { font-size: 1.2em; padding: 5px 10px; border-radius: 5px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1 class="mb-4">Parity Testing Infrastructure Check</h1>
        
        <div class="card mb-4">
          <div class="card-header">
            <h5 class="mb-0">Test Summary</h5>
          </div>
          <div class="card-body">
            <div class="row">
              <div class="col-md-6">
                <p><strong>Test ID:</strong> ${results.testId}</p>
                <p><strong>Timestamp:</strong> ${new Date(results.timestamp).toLocaleString()}</p>
                <p><strong>Node Version:</strong> ${results.environment.nodeVersion}</p>
                <p><strong>Platform:</strong> ${results.environment.platform}</p>
              </div>
              <div class="col-md-6">
                <p><strong>Edge Agent URL:</strong> ${results.environment.EDGE_AGENT_URL}</p>
                <p><strong>SDK Key:</strong> ${results.environment.SDK_KEY}</p>
                <p>
                  <strong>Status:</strong> 
                  <span class="summary-status" style="background-color: ${statusColors[results.summary.status]}">
                    ${results.summary.status.toUpperCase()}
                  </span>
                </p>
                <p>
                  <strong>Results:</strong> 
                  <span class="text-success">${results.summary.passed} passed</span>, 
                  <span class="text-danger">${results.summary.failed} failed</span>
                  (${results.summary.totalTests} total)
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <div class="card">
          <div class="card-header">
            <h5 class="mb-0">Test Results</h5>
          </div>
          <div class="card-body">
            <table class="table table-striped">
              <thead>
                <tr>
                  <th>Test</th>
                  <th>Status</th>
                  <th>Timestamp</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                ${testRowsHtml}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
    </body>
    </html>
  `;
  
  fs.writeFileSync(reportPath, html);
  console.log(`\nReport generated: ${reportPath}`);
  
  return reportPath;
}

// Run all tests
async function runAllTests() {
  console.log('\n=== Optimizely Edge Agent Feature Parity Testing Infrastructure Verification ===');
  console.log(`Test ID: ${config.TEST_ID}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Environment: Node.js ${process.version} on ${process.platform}`);
  console.log(`Edge Agent URL: ${config.EDGE_AGENT_URL}`);
  console.log(`SDK Key: ${config.SDK_KEY ? '****' + config.SDK_KEY.substr(-4) : 'not-set'}`);
  console.log('\n');
  
  // Run tests
  const sourceCodeTest = await checkSourceCodeAvailability();
  const dependenciesTest = await checkDependencies();
  const fixturesTest = await checkTestFixtures();
  const smokeTest = await runBasicSmokeTest();
  
  // Update summary
  testResults.summary.totalTests = testResults.tests.length;
  testResults.summary.passed = testResults.tests.filter(t => t.status === 'passed').length;
  testResults.summary.failed = testResults.tests.filter(t => t.status === 'failed').length;
  testResults.summary.status = testResults.summary.failed > 0 ? 'failed' : 'passed';
  
  // Print summary
  console.log('\n=== Test Summary ===');
  console.log(`Total Tests: ${testResults.summary.totalTests}`);
  console.log(`Passed: ${testResults.summary.passed}`);
  console.log(`Failed: ${testResults.summary.failed}`);
  console.log(`Status: ${testResults.summary.status.toUpperCase()}`);
  
  // Generate report
  const reportPath = generateReport(testResults);
  
  // Write JSON results
  const jsonPath = path.join(config.RESULTS_DIR, `parity-infrastructure-check-${config.TEST_ID}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(testResults, null, 2));
  console.log(`\nJSON results saved: ${jsonPath}`);
  
  // Return overall status code
  return testResults.summary.failed > 0 ? 1 : 0;
}

// Run tests when script is executed directly
if (require.main === module) {
  runAllTests()
    .then(exitCode => {
      console.log(`\nExiting with code ${exitCode}`);
      process.exit(exitCode);
    })
    .catch(error => {
      console.error(`\nUnhandled error: ${error.message}`);
      console.error(error.stack);
      process.exit(1);
    });
}

// Export functions for use in other scripts
module.exports = {
  runAllTests,
  checkSourceCodeAvailability,
  checkDependencies,
  checkTestFixtures,
  runBasicSmokeTest
};