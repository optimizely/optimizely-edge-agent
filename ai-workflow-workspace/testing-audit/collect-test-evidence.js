/**
 * @fileoverview Test Evidence Collection Script
 * 
 * This script executes all test adapters and collects evidence into a single report.
 * It uses absolute paths to avoid path resolution issues.
 * 
 * Created as part of the Testing Audit Reconciliation project (testing-audit-reconciliation-04-10-2025)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get the project root directory
const projectRoot = process.cwd();
console.log(`Project root: ${projectRoot}`);

// Define paths using absolute paths
const adaptersDir = path.join(projectRoot, 'ai-workflow-workspace', 'testing-audit', 'adapters');
const evidenceDir = path.join(projectRoot, 'ai-workflow-workspace', 'testing-audit', 'evidence', 'results');
const runnerScript = path.join(projectRoot, 'ai-workflow-workspace', 'testing-audit', 'infrastructure', 'cli', 'run-single-test.js');

// Create timestamp for this test run
const now = new Date();
const timestamp = now.toISOString().replace(/:/g, '-').replace(/\..+/, '');

// Create evidence directory if it doesn't exist
if (!fs.existsSync(evidenceDir)) {
  fs.mkdirSync(evidenceDir, { recursive: true });
}

// Create a directory for this test run
const testRunDir = path.join(evidenceDir, timestamp);
if (!fs.existsSync(testRunDir)) {
  fs.mkdirSync(testRunDir, { recursive: true });
}

// Create a report file
const reportPath = path.join(testRunDir, 'test-execution-report.md');

// Initialize report
let report = `# Optimizely Edge Agent Test Execution Report

**Date:** ${now.toDateString()}
**Time:** ${now.toTimeString()}
**Environment:** Local (Wrangler)
**Base URL:** http://localhost:8787

## Test Results Summary

| Test | Status | Evidence |
| ---- | ------ | -------- |
`;

// Get all test adapters
const adapterFiles = fs.readdirSync(adaptersDir)
  .filter(file => file.endsWith('-adapter.js'));

console.log(`Found ${adapterFiles.length} test adapters to execute`);

// Execute each adapter
for (const adapterFile of adapterFiles) {
  console.log(`\n-------------------------------------------------`);
  console.log(`Executing test adapter: ${adapterFile}`);
  console.log(`-------------------------------------------------`);
  
  const adapterPath = path.join(adaptersDir, adapterFile);
  const adapterName = adapterFile.replace('.js', '');
  const logFile = path.join(testRunDir, `${adapterName}-log.txt`);
  const resultFile = path.join(testRunDir, `${adapterName}-result.json`);
  
  try {
    // Execute the test adapter and capture output
    const command = `node "${runnerScript}" "${adapterPath}"`;
    console.log(`Executing command: ${command}`);
    
    // Execute command and redirect output to log file
    const output = execSync(command, { encoding: 'utf8' });
    fs.writeFileSync(logFile, output);
    
    // Check if test was successful by reading the result.json file
    const testResultPath = path.join(projectRoot, 'test-result.json');
    if (fs.existsSync(testResultPath)) {
      // Copy the result file to the evidence directory
      const resultContent = fs.readFileSync(testResultPath, 'utf8');
      fs.writeFileSync(resultFile, resultContent);
      
      // Parse the result to determine success/failure
      const result = JSON.parse(resultContent);
      const status = result.success ? '✅ PASSED' : '❌ FAILED';
      
      // Add to report
      report += `| ${adapterName} | ${status} | [Log](${path.relative(evidenceDir, logFile)}) [Result](${path.relative(evidenceDir, resultFile)}) |\n`;
      
      console.log(`Test completed with status: ${status}`);
    } else {
      report += `| ${adapterName} | ⚠️ UNKNOWN | [Log](${path.relative(evidenceDir, logFile)}) |\n`;
      console.log('Test completed but no result file was found');
    }
  } catch (error) {
    // Log the error and continue with the next test
    console.error(`Error executing adapter ${adapterFile}:`, error.message);
    fs.writeFileSync(logFile, `Error executing test: ${error.message}\n${error.stack}`);
    report += `| ${adapterName} | ❌ ERROR | [Log](${path.relative(evidenceDir, logFile)}) |\n`;
  }
}

// Add the execution summary to the report
report += `
## Execution Summary

* **Total Tests:** ${adapterFiles.length}
* **Execution Time:** ${Math.round((new Date() - now) / 1000)} seconds
* **Evidence Location:** \`${testRunDir}\`

## Next Steps

1. Review the test results and evidence
2. Analyze any discrepancies between local and live environments
3. Update the test adapters as needed
4. Generate a comprehensive comparison report
`;

// Save the report
fs.writeFileSync(reportPath, report);

// Also save a copy of the report as the latest report
fs.writeFileSync(path.join(evidenceDir, 'latest-test-execution-report.md'), report);

console.log(`\n=================================================`);
console.log(`Test execution completed`);
console.log(`-------------------------------------------------`);
console.log(`Report saved to: ${reportPath}`);
console.log(`Latest report: ${path.join(evidenceDir, 'latest-test-execution-report.md')}`);
console.log(`=================================================`); 