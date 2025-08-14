#!/usr/bin/env node

/**
 * Edge Mode Final Test Runner
 * Executes comprehensive Edge Mode tests with edge_mode_final_test flag
 */

const path = require('path');
const fs = require('fs');

// Add nova core to path
const novaPath = path.join(__dirname, '..');
const { TestRunner } = require(path.join(novaPath, 'core', 'TestRunner'));
const { ConsoleReporter } = require(path.join(novaPath, 'core', 'ConsoleReporter'));
const { JSONReporter } = require(path.join(novaPath, 'core', 'JSONReporter'));

async function runEdgeModeFinalTests() {
  console.log('🚀 Starting Edge Mode Final Tests with edge_mode_final_test flag');
  console.log('=' .repeat(60));
  
  // Check if server is running
  try {
    const response = await fetch('http://localhost:8787/api/test', {
      headers: { 'X-Optimizely-SDK-Key': '8mR1pGh8u2ztUP8GqjmQq' }
    });
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }
    console.log('✅ Server is running at http://localhost:8787\n');
  } catch (error) {
    console.error('❌ Server is not running!');
    console.error('Please start the server with: wrangler dev --local');
    process.exit(1);
  }

  // Load test suite
  const testSuite = require('../tests/edge-mode-final.test.js');
  
  // Create reporters
  const consoleReporter = new ConsoleReporter({ verbose: true });
  const jsonReporter = new JSONReporter({
    outputPath: path.join(novaPath, 'results', `edge-mode-final-${Date.now()}.json`)
  });

  // Create and run test runner
  const runner = new TestRunner({
    reporters: [consoleReporter, jsonReporter],
    continueOnFailure: true,
    timeout: 10000
  });

  console.log(`📋 Running ${testSuite.tests.length} Edge Mode tests`);
  console.log(`🎯 Flag: edge_mode_final_test`);
  console.log(`🔑 SDK Key: 8mR1pGh8u2ztUP8GqjmQq`);
  console.log('=' .repeat(60));

  const results = await runner.run(testSuite);

  // Generate summary
  console.log('\n' + '=' .repeat(60));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('=' .repeat(60));
  
  const passed = results.tests.filter(t => t.passed).length;
  const failed = results.tests.filter(t => !t.passed).length;
  const passRate = ((passed / results.tests.length) * 100).toFixed(1);

  console.log(`Total Tests: ${results.tests.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Pass Rate: ${passRate}%`);
  
  if (failed > 0) {
    console.log('\n❌ FAILED TESTS:');
    results.tests.filter(t => !t.passed).forEach(test => {
      console.log(`  - ${test.id}: ${test.name}`);
      if (test.error) {
        console.log(`    Error: ${test.error}`);
      }
    });
  }

  // Edge Mode specific validations
  console.log('\n' + '=' .repeat(60));
  console.log('🎯 EDGE MODE VALIDATION SUMMARY');
  console.log('=' .repeat(60));

  const checks = {
    'Flag Configuration': results.tests.find(t => t.id === 'edge.final.setup')?.passed,
    'Forced Decisions': results.tests.filter(t => t.id.includes('forced')).every(t => t.passed),
    'Content Fetching': results.tests.find(t => t.id === 'edge.final.content.validation')?.passed,
    'Visitor Stickiness': results.tests.find(t => t.id === 'edge.final.stickiness')?.passed,
    'Cache Behavior': results.tests.find(t => t.id === 'edge.final.cache.performance')?.passed,
    'Cookie Persistence': results.tests.find(t => t.id === 'edge.final.cookie.persistence')?.passed,
    'Origin Fallback': results.tests.find(t => t.id === 'edge.final.fallback')?.passed
  };

  Object.entries(checks).forEach(([feature, status]) => {
    const icon = status ? '✅' : '❌';
    console.log(`${icon} ${feature}: ${status ? 'WORKING' : 'NOT WORKING'}`);
  });

  // Save detailed report
  const reportPath = path.join(novaPath, 'results', `edge-mode-final-report-${Date.now()}.md`);
  const report = generateDetailedReport(results, checks);
  fs.writeFileSync(reportPath, report);
  console.log(`\n📝 Detailed report saved to: ${reportPath}`);

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

function generateDetailedReport(results, checks) {
  const now = new Date().toISOString();
  const passed = results.tests.filter(t => t.passed).length;
  const failed = results.tests.filter(t => !t.passed).length;
  const passRate = ((passed / results.tests.length) * 100).toFixed(1);

  let report = `# Edge Mode Final Test Report\n\n`;
  report += `**Date**: ${now}\n`;
  report += `**Flag**: edge_mode_final_test\n`;
  report += `**SDK Key**: 8mR1pGh8u2ztUP8GqjmQq\n`;
  report += `**Server**: http://localhost:8787\n\n`;
  
  report += `## Summary\n\n`;
  report += `- Total Tests: ${results.tests.length}\n`;
  report += `- Passed: ${passed} ✅\n`;
  report += `- Failed: ${failed} ❌\n`;
  report += `- Pass Rate: ${passRate}%\n\n`;

  report += `## Feature Validation\n\n`;
  Object.entries(checks).forEach(([feature, status]) => {
    report += `- ${feature}: ${status ? '✅ WORKING' : '❌ NOT WORKING'}\n`;
  });

  report += `\n## Test Details\n\n`;
  results.tests.forEach(test => {
    const icon = test.passed ? '✅' : '❌';
    report += `### ${icon} ${test.name}\n`;
    report += `- **ID**: ${test.id}\n`;
    report += `- **Status**: ${test.passed ? 'PASSED' : 'FAILED'}\n`;
    report += `- **Duration**: ${test.duration}ms\n`;
    
    if (!test.passed && test.error) {
      report += `- **Error**: ${test.error}\n`;
    }
    
    if (!test.passed && test.details) {
      report += `- **Details**: ${JSON.stringify(test.details, null, 2)}\n`;
    }
    
    report += `\n`;
  });

  return report;
}

// Run the tests
runEdgeModeFinalTests().catch(console.error);