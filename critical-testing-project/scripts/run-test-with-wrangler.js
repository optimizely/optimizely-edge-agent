/**
 * Optimizely Edge Agent - Test Runner with Wrangler
 * 
 * This script starts a local Wrangler dev server and runs tests against it,
 * capturing logs and test results.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuration
const config = {
  WRANGLER_COMMAND: 'wrangler',
  WRANGLER_PORT: 8787,
  INSPECTOR_PORT: 9229,
  LOG_FILE: path.join(__dirname, '../results/wrangler-logs.txt'),
  ENV_VARS: {
    EDGE_AGENT_URL: `http://localhost:8787`,
    SDK_KEY: process.env.SDK_KEY || 'test-sdk-key' // Should be overridden by real key
  }
};

// Ensure logs directory exists
if (!fs.existsSync(path.dirname(config.LOG_FILE))) {
  fs.mkdirSync(path.dirname(config.LOG_FILE), { recursive: true });
}

/**
 * Start Wrangler dev server and return the process
 */
function startWranglerDev() {
  console.log('Starting Wrangler dev server...');
  
  const wranglerArgs = [
    'dev',
    '--local',
    `--port=${config.WRANGLER_PORT}`,
    `--inspector-port=${config.INSPECTOR_PORT}`
  ];
  
  console.log(`Running: ${config.WRANGLER_COMMAND} ${wranglerArgs.join(' ')}`);
  
  // Create log file stream
  const logStream = fs.createWriteStream(config.LOG_FILE, { flags: 'w' });
  logStream.write(`=== Wrangler Dev Log - ${new Date().toISOString()} ===\n\n`);
  
  // Start wrangler process
  const wranglerProcess = spawn(config.WRANGLER_COMMAND, wranglerArgs, {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true
  });
  
  // Pipe stdout and stderr to both console and log file
  wranglerProcess.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(output);
    logStream.write(`[stdout] ${output}`);
  });
  
  wranglerProcess.stderr.on('data', (data) => {
    const output = data.toString();
    console.error(output);
    logStream.write(`[stderr] ${output}`);
  });
  
  wranglerProcess.on('error', (error) => {
    console.error(`Wrangler process error: ${error.message}`);
    logStream.write(`[error] ${error.message}\n`);
  });
  
  wranglerProcess.on('close', (code) => {
    console.log(`Wrangler process exited with code ${code}`);
    logStream.write(`[close] Process exited with code ${code}\n`);
    logStream.end();
  });
  
  // Wait for server to start (looking for the "Ready" message)
  return new Promise((resolve, reject) => {
    let serverStarted = false;
    
    const timeout = setTimeout(() => {
      if (!serverStarted) {
        reject(new Error('Wrangler server startup timed out'));
      }
    }, 30000); // 30 seconds timeout
    
    wranglerProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Ready') || output.includes('listening')) {
        serverStarted = true;
        clearTimeout(timeout);
        
        // Wait a bit more to ensure full initialization
        setTimeout(() => {
          console.log('Wrangler dev server is ready!');
          resolve(wranglerProcess);
        }, 2000);
      }
    });
    
    wranglerProcess.on('error', () => {
      clearTimeout(timeout);
      reject(new Error('Wrangler process failed to start'));
    });
    
    wranglerProcess.on('close', (code) => {
      if (!serverStarted) {
        clearTimeout(timeout);
        reject(new Error(`Wrangler process exited with code ${code} before server started`));
      }
    });
  });
}

/**
 * Run a test script against the Wrangler dev server
 */
async function runTest(testScript, additionalEnv = {}) {
  console.log(`Running test: ${testScript}`);
  
  // Merge base env with additional env
  const env = {
    ...process.env,
    ...config.ENV_VARS,
    ...additionalEnv
  };
  
  return new Promise((resolve, reject) => {
    const testProcess = spawn('node', [testScript], {
      stdio: 'inherit',
      env
    });
    
    testProcess.on('error', (error) => {
      reject(new Error(`Test process error: ${error.message}`));
    });
    
    testProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Test exited with code ${code}`));
      }
    });
  });
}

/**
 * Run multiple tests in sequence
 */
async function runTestSequence(testScripts, additionalEnv = {}) {
  const results = [];
  
  for (const testScript of testScripts) {
    try {
      await runTest(testScript, additionalEnv);
      results.push({ script: testScript, success: true });
    } catch (error) {
      console.error(`Test ${testScript} failed: ${error.message}`);
      results.push({ script: testScript, success: false, error: error.message });
    }
  }
  
  return results;
}

/**
 * Main function to start server and run tests
 */
async function main() {
  let wranglerProcess;
  
  try {
    // Start Wrangler dev server
    wranglerProcess = await startWranglerDev();
    
    // Define tests to run
    const testScripts = [
      path.join(__dirname, 'infrastructure/infrastructure-verification.js')
      // Add more test scripts here as they are created
    ];
    
    // Run tests
    console.log('Starting test execution...');
    const results = await runTestSequence(testScripts);
    
    // Print summary
    console.log('\n=== Test Summary ===');
    const passed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    console.log(`Total: ${results.length}, Passed: ${passed}, Failed: ${failed}`);
    
    results.forEach(result => {
      const status = result.success ? '✅ PASSED' : '❌ FAILED';
      console.log(`${status}: ${result.script}`);
      if (!result.success) {
        console.log(`  Error: ${result.error}`);
      }
    });
    
    // Save summary to file
    const summaryFile = path.join(__dirname, '../results/test-summary.json');
    fs.writeFileSync(summaryFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      total: results.length,
      passed,
      failed,
      results
    }, null, 2));
    
    console.log(`\nTest summary saved to: ${summaryFile}`);
    console.log(`Wrangler logs saved to: ${config.LOG_FILE}`);
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    // Cleanup: stop Wrangler dev server
    if (wranglerProcess) {
      console.log('Stopping Wrangler dev server...');
      wranglerProcess.kill();
    }
  }
}

// Run if called directly
if (require.main === module) {
  main()
    .then(() => {
      console.log('Tests completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('Unhandled error:', error);
      process.exit(1);
    });
} 