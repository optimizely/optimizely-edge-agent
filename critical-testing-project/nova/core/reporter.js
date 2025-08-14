/**
 * NOVA Reporter - Report generation
 */

const fs = require('fs').promises;
const path = require('path');

class Reporter {
  constructor(sessionId, config) {
    this.sessionId = sessionId;
    this.config = config;
    this.reportsDir = path.join(__dirname, '..', 'results', 'reports');
  }

  /**
   * Generate HTML report
   */
  async generateHtmlReport(results) {
    const html = this.buildHtmlReport(results);
    const reportFile = path.join(this.reportsDir, `${this.sessionId}.html`);
    await fs.writeFile(reportFile, html);
    return reportFile;
  }

  /**
   * Generate JSON report
   */
  async generateJsonReport(results) {
    const reportFile = path.join(this.reportsDir, `${this.sessionId}.json`);
    await fs.writeFile(reportFile, JSON.stringify(results, null, 2));
    return reportFile;
  }

  /**
   * Generate comparison report
   */
  async generateComparison(baselineId, currentId) {
    const { ResultCapture } = require('./result-capture');
    const capture = new ResultCapture(this.sessionId, this.config);
    
    const comparison = await capture.compareSessions(baselineId, currentId);
    
    // Save comparison JSON
    const comparisonFile = path.join(
      __dirname, '..', 'results', 'comparisons',
      `${baselineId}-vs-${currentId}.json`
    );
    await fs.writeFile(comparisonFile, JSON.stringify(comparison, null, 2));
    
    // Generate comparison HTML
    const html = this.buildComparisonHtml(comparison);
    const htmlFile = path.join(
      __dirname, '..', 'results', 'comparisons',
      `${baselineId}-vs-${currentId}.html`
    );
    await fs.writeFile(htmlFile, html);
    
    return { json: comparisonFile, html: htmlFile };
  }

  /**
   * Build HTML report
   */
  buildHtmlReport(results) {
    const passRate = results.summary.total > 0 ? 
      ((results.summary.passed / results.summary.total) * 100).toFixed(1) : 0;
    
    const statusColor = results.summary.failed === 0 ? '#28a745' : '#dc3545';
    
    return `<!DOCTYPE html>
<html>
<head>
    <title>NOVA Test Report - ${this.sessionId}</title>
    <meta charset="utf-8">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            padding: 30px;
        }
        h1 {
            color: #333;
            border-bottom: 2px solid #007bff;
            padding-bottom: 10px;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin: 30px 0;
        }
        .summary-card {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 6px;
            text-align: center;
        }
        .summary-card h3 {
            margin: 0 0 10px 0;
            color: #666;
            font-size: 14px;
            text-transform: uppercase;
        }
        .summary-card .value {
            font-size: 32px;
            font-weight: bold;
            color: #333;
        }
        .summary-card.passed { border-left: 4px solid #28a745; }
        .summary-card.failed { border-left: 4px solid #dc3545; }
        .summary-card.skipped { border-left: 4px solid #ffc107; }
        .test-list {
            margin-top: 30px;
        }
        .test-item {
            background: #fff;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            margin-bottom: 10px;
            padding: 15px;
            display: flex;
            align-items: center;
            transition: all 0.2s;
        }
        .test-item:hover {
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .test-item.passed { border-left: 4px solid #28a745; }
        .test-item.failed { border-left: 4px solid #dc3545; }
        .test-item.skipped { border-left: 4px solid #ffc107; }
        .test-status {
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 15px;
            font-size: 18px;
        }
        .test-details {
            flex: 1;
        }
        .test-name {
            font-weight: 600;
            color: #333;
            margin-bottom: 4px;
        }
        .test-description {
            color: #666;
            font-size: 14px;
        }
        .test-duration {
            color: #999;
            font-size: 12px;
            margin-left: auto;
        }
        .error-details {
            background: #f8d7da;
            color: #721c24;
            padding: 10px;
            border-radius: 4px;
            margin-top: 10px;
            font-size: 14px;
        }
        .metadata {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 6px;
            margin-bottom: 30px;
        }
        .metadata-item {
            display: flex;
            padding: 5px 0;
        }
        .metadata-label {
            font-weight: 600;
            width: 150px;
            color: #666;
        }
        .metadata-value {
            color: #333;
        }
        .pass-rate {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            background: ${statusColor};
            color: white;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>NOVA Test Report</h1>
        
        <div class="metadata">
            <div class="metadata-item">
                <span class="metadata-label">Session ID:</span>
                <span class="metadata-value">${results.sessionId}</span>
            </div>
            <div class="metadata-item">
                <span class="metadata-label">Environment:</span>
                <span class="metadata-value">${results.environment}</span>
            </div>
            <div class="metadata-item">
                <span class="metadata-label">Adapter:</span>
                <span class="metadata-value">${results.adapter}</span>
            </div>
            <div class="metadata-item">
                <span class="metadata-label">Test Suite:</span>
                <span class="metadata-value">${results.suite}</span>
            </div>
            <div class="metadata-item">
                <span class="metadata-label">Start Time:</span>
                <span class="metadata-value">${new Date(results.startTime).toLocaleString()}</span>
            </div>
            <div class="metadata-item">
                <span class="metadata-label">Pass Rate:</span>
                <span class="metadata-value">
                    <span class="pass-rate">${passRate}%</span>
                </span>
            </div>
        </div>
        
        <div class="summary">
            <div class="summary-card">
                <h3>Total Tests</h3>
                <div class="value">${results.summary.total}</div>
            </div>
            <div class="summary-card passed">
                <h3>Passed</h3>
                <div class="value">${results.summary.passed}</div>
            </div>
            <div class="summary-card failed">
                <h3>Failed</h3>
                <div class="value">${results.summary.failed}</div>
            </div>
            <div class="summary-card skipped">
                <h3>Skipped</h3>
                <div class="value">${results.summary.skipped}</div>
            </div>
        </div>
        
        <div class="test-list">
            <h2>Test Results</h2>
            ${results.tests.map(test => `
                <div class="test-item ${test.status}">
                    <div class="test-status">
                        ${test.status === 'passed' ? '✅' : 
                          test.status === 'failed' ? '❌' : '⏭️'}
                    </div>
                    <div class="test-details">
                        <div class="test-name">${test.name}</div>
                        <div class="test-description">${test.description || test.id}</div>
                        ${test.error ? `
                            <div class="error-details">
                                ${Array.isArray(test.error) ? test.error.join('<br>') : test.error}
                            </div>
                        ` : ''}
                    </div>
                    ${test.duration ? `
                        <div class="test-duration">${test.duration}ms</div>
                    ` : ''}
                </div>
            `).join('')}
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Build comparison HTML report
   */
  buildComparisonHtml(comparison) {
    return `<!DOCTYPE html>
<html>
<head>
    <title>NOVA Comparison Report</title>
    <meta charset="utf-8">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            padding: 30px;
        }
        h1, h2 {
            color: #333;
        }
        .section {
            margin: 30px 0;
        }
        .change-item {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 4px;
            margin-bottom: 10px;
            border-left: 4px solid #007bff;
        }
        .improvement {
            border-left-color: #28a745;
            background: #d4edda;
        }
        .regression {
            border-left-color: #dc3545;
            background: #f8d7da;
        }
        .change-type {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 3px;
            background: #007bff;
            color: white;
            font-size: 12px;
            margin-right: 10px;
        }
        .comparison-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin: 20px 0;
        }
        .comparison-card {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 6px;
        }
        .comparison-card h3 {
            margin-top: 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>NOVA Comparison Report</h1>
        
        <div class="comparison-grid">
            <div class="comparison-card">
                <h3>Baseline</h3>
                <div>Session: ${comparison.baselineId}</div>
            </div>
            <div class="comparison-card">
                <h3>Current</h3>
                <div>Session: ${comparison.currentId}</div>
            </div>
        </div>
        
        ${comparison.improvements.length > 0 ? `
            <div class="section">
                <h2>✅ Improvements (${comparison.improvements.length})</h2>
                ${comparison.improvements.map(change => `
                    <div class="change-item improvement">
                        <strong>${change.name}</strong><br>
                        ${change.baseline} → ${change.current}
                    </div>
                `).join('')}
            </div>
        ` : ''}
        
        ${comparison.regressions.length > 0 ? `
            <div class="section">
                <h2>❌ Regressions (${comparison.regressions.length})</h2>
                ${comparison.regressions.map(change => `
                    <div class="change-item regression">
                        <strong>${change.name}</strong><br>
                        ${change.baseline} → ${change.current}
                    </div>
                `).join('')}
            </div>
        ` : ''}
        
        ${comparison.changes.length > 0 ? `
            <div class="section">
                <h2>📝 Other Changes (${comparison.changes.length})</h2>
                ${comparison.changes.map(change => `
                    <div class="change-item">
                        <span class="change-type">${change.type}</span>
                        <strong>${change.name}</strong><br>
                        ${change.baseline || ''} ${change.current ? '→ ' + change.current : ''}
                        ${change.change || ''}
                    </div>
                `).join('')}
            </div>
        ` : ''}
    </div>
</body>
</html>`;
  }
}

module.exports = { Reporter };