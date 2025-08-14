/**
 * NOVA Result Capture - Evidence collection and storage
 */

const fs = require('fs').promises;
const path = require('path');

class ResultCapture {
  constructor(sessionId, config) {
    this.sessionId = sessionId;
    this.config = config;
    this.resultsDir = path.join(__dirname, '..', 'results');
    this.sessionDir = path.join(this.resultsDir, 'sessions', sessionId);
    
    this.ensureDirectories();
  }

  async ensureDirectories() {
    const dirs = [
      this.resultsDir,
      path.join(this.resultsDir, 'sessions'),
      path.join(this.resultsDir, 'comparisons'),
      path.join(this.resultsDir, 'reports'),
      this.sessionDir,
      path.join(this.sessionDir, 'requests'),
      path.join(this.sessionDir, 'responses'),
      path.join(this.sessionDir, 'evidence')
    ];
    
    for (const dir of dirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (e) {
        // Directory might already exist
      }
    }
  }

  /**
   * Capture test evidence
   */
  async capture(testId, result) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const prefix = `${timestamp}-${testId.replace(/\./g, '-')}`;
    
    try {
      // Save request
      if (result.request) {
        const requestFile = path.join(this.sessionDir, 'requests', `${prefix}.json`);
        await fs.writeFile(requestFile, JSON.stringify(result.request, null, 2));
      }
      
      // Save response
      if (result.response) {
        const responseFile = path.join(this.sessionDir, 'responses', `${prefix}.json`);
        await fs.writeFile(responseFile, JSON.stringify({
          status: result.response.status,
          headers: result.response.headers,
          body: this.truncateBody(result.response.body),
          duration: result.response.duration
        }, null, 2));
        
        // Save full response body if large
        if (result.response.body && result.response.body.length > 1000) {
          const bodyFile = path.join(this.sessionDir, 'responses', `${prefix}-body.txt`);
          await fs.writeFile(bodyFile, result.response.body);
        }
      }
      
      // Save validation results
      if (result.validation) {
        const validationFile = path.join(this.sessionDir, 'evidence', `${prefix}-validation.json`);
        await fs.writeFile(validationFile, JSON.stringify(result.validation, null, 2));
      }
      
      // Save raw curl output if available
      if (result.response && result.response.raw) {
        const rawFile = path.join(this.sessionDir, 'evidence', `${prefix}-raw.txt`);
        await fs.writeFile(rawFile, result.response.raw);
      }
      
    } catch (error) {
      console.error(`Failed to capture evidence for ${testId}: ${error.message}`);
    }
  }

  /**
   * Save complete test results
   */
  async saveResults(results) {
    const summaryFile = path.join(this.sessionDir, 'summary.json');
    await fs.writeFile(summaryFile, JSON.stringify(results, null, 2));
    
    // Create a quick results file for easy viewing
    const quickFile = path.join(this.sessionDir, 'quick-results.txt');
    const quickContent = this.formatQuickResults(results);
    await fs.writeFile(quickFile, quickContent);
  }

  /**
   * Format results for quick viewing
   */
  formatQuickResults(results) {
    const lines = [];
    
    lines.push('NOVA Test Results');
    lines.push('='.repeat(60));
    lines.push(`Session ID: ${results.sessionId}`);
    lines.push(`Environment: ${results.environment}`);
    lines.push(`Adapter: ${results.adapter}`);
    lines.push(`Suite: ${results.suite}`);
    lines.push(`Start: ${results.startTime}`);
    lines.push(`End: ${results.endTime}`);
    lines.push('');
    lines.push('Summary:');
    lines.push(`  Total:   ${results.summary.total}`);
    lines.push(`  Passed:  ${results.summary.passed} ✅`);
    lines.push(`  Failed:  ${results.summary.failed} ❌`);
    lines.push(`  Skipped: ${results.summary.skipped} ⏭️`);
    lines.push('');
    lines.push('Test Results:');
    lines.push('-'.repeat(60));
    
    for (const test of results.tests) {
      const icon = test.status === 'passed' ? '✅' :
                   test.status === 'failed' ? '❌' : '⏭️';
      lines.push(`${icon} ${test.name}`);
      
      if (test.status === 'failed' && test.error) {
        const errors = Array.isArray(test.error) ? test.error : [test.error];
        for (const error of errors) {
          lines.push(`    ❌ ${error}`);
        }
      }
      
      if (test.duration) {
        lines.push(`    Duration: ${test.duration}ms`);
      }
    }
    
    return lines.join('\n');
  }

  /**
   * Load results from a session
   */
  async loadResults(sessionId) {
    const summaryFile = path.join(this.resultsDir, 'sessions', sessionId, 'summary.json');
    const content = await fs.readFile(summaryFile, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * List available sessions
   */
  async listSessions() {
    const sessionsDir = path.join(this.resultsDir, 'sessions');
    const sessions = [];
    
    try {
      const dirs = await fs.readdir(sessionsDir);
      
      for (const dir of dirs) {
        try {
          const summaryFile = path.join(sessionsDir, dir, 'summary.json');
          const content = await fs.readFile(summaryFile, 'utf-8');
          const summary = JSON.parse(content);
          
          sessions.push({
            id: dir,
            environment: summary.environment,
            adapter: summary.adapter,
            suite: summary.suite,
            startTime: summary.startTime,
            passed: summary.summary.passed,
            failed: summary.summary.failed,
            total: summary.summary.total
          });
        } catch (e) {
          // Skip invalid session directories
        }
      }
    } catch (e) {
      // No sessions yet
    }
    
    return sessions.sort((a, b) => b.startTime.localeCompare(a.startTime));
  }

  /**
   * Truncate body for summary storage
   */
  truncateBody(body, maxLength = 1000) {
    if (!body) return '';
    if (body.length <= maxLength) return body;
    return body.substring(0, maxLength) + '\n... [truncated]';
  }

  /**
   * Compare two sessions
   */
  async compareSessions(baselineId, currentId) {
    const baseline = await this.loadResults(baselineId);
    const current = await this.loadResults(currentId);
    
    const comparison = {
      baselineId,
      currentId,
      timestamp: new Date().toISOString(),
      changes: [],
      improvements: [],
      regressions: []
    };
    
    // Create test maps for easy comparison
    const baselineTests = new Map(baseline.tests.map(t => [t.id, t]));
    const currentTests = new Map(current.tests.map(t => [t.id, t]));
    
    // Check each test
    for (const [testId, baselineTest] of baselineTests) {
      const currentTest = currentTests.get(testId);
      
      if (!currentTest) {
        comparison.changes.push({
          type: 'removed',
          testId,
          name: baselineTest.name
        });
      } else {
        // Compare status
        if (baselineTest.status !== currentTest.status) {
          const change = {
            testId,
            name: currentTest.name,
            baseline: baselineTest.status,
            current: currentTest.status
          };
          
          if (baselineTest.status === 'failed' && currentTest.status === 'passed') {
            comparison.improvements.push(change);
          } else if (baselineTest.status === 'passed' && currentTest.status === 'failed') {
            comparison.regressions.push(change);
          } else {
            comparison.changes.push(change);
          }
        }
        
        // Compare duration (significant changes only)
        if (baselineTest.duration && currentTest.duration) {
          const diff = currentTest.duration - baselineTest.duration;
          const percentChange = (diff / baselineTest.duration) * 100;
          
          if (Math.abs(percentChange) > 20) {
            comparison.changes.push({
              type: 'performance',
              testId,
              name: currentTest.name,
              baseline: `${baselineTest.duration}ms`,
              current: `${currentTest.duration}ms`,
              change: `${percentChange > 0 ? '+' : ''}${percentChange.toFixed(1)}%`
            });
          }
        }
      }
    }
    
    // Check for new tests
    for (const [testId, currentTest] of currentTests) {
      if (!baselineTests.has(testId)) {
        comparison.changes.push({
          type: 'added',
          testId,
          name: currentTest.name,
          status: currentTest.status
        });
      }
    }
    
    return comparison;
  }
}

module.exports = { ResultCapture };