/**
 * @fileoverview Test Run Manifest Generator
 * 
 * This module provides functionality to generate comprehensive test run manifests
 * that consolidate information from the logging, evidence storage, and verification
 * systems into a single, structured document. The manifest serves as proof of test
 * execution and can be used for reporting, reconciliation, and audit purposes.
 * 
 * Created as part of the Testing Audit Reconciliation project (testing-audit-reconciliation-04-10-2025)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { TestLogger } = require('../logging/logger');
const { EvidenceStorage } = require('../../evidence/evidence-storage');
const { VerificationHooks } = require('../verification/verification-hooks');

/**
 * Default configuration for manifest generator
 */
const DEFAULT_CONFIG = {
  basePath: path.join(process.cwd(), 'ai-workflow-workspace', 'testing-audit', 'manifest'),
  includeLogSummary: true,
  includeEvidenceSummary: true,
  includeVerificationResults: true,
  includeTimeline: true,
  includeSystemInfo: true,
  createDirectory: true,
  signManifest: true
};

/**
 * Manifest status values
 */
const MANIFEST_STATUS = {
  COMPLETE: 'COMPLETE',
  PARTIAL: 'PARTIAL',
  ERROR: 'ERROR'
};

/**
 * Class to generate test run manifests
 */
class ManifestGenerator {
  /**
   * Create a new ManifestGenerator
   * @param {object} config - Configuration options
   */
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initialized = false;
    this.basePath = this.config.basePath;
  }

  /**
   * Initialize the manifest generator
   */
  async initialize() {
    if (this.initialized) return;

    // Create base directory if needed
    if (this.config.createDirectory) {
      try {
        await fs.promises.mkdir(this.basePath, { recursive: true });
      } catch (err) {
        console.error(`Error creating manifest directory ${this.basePath}:`, err);
        throw err;
      }
    }

    this.initialized = true;
  }

  /**
   * Generate a manifest from a test run
   * @param {object} testRunData - Data from the test run
   * @param {string} testRunData.testId - Test identifier
   * @param {string} testRunData.runId - Run identifier
   * @param {object} testRunData.loggerResult - Result from the TestLogger
   * @param {object} testRunData.evidenceResult - Result from the EvidenceStorage
   * @param {object} testRunData.verificationResult - Result from the VerificationHooks
   * @param {object} testRunData.testResult - Overall test result
   * @param {string} outputPath - Custom output path (optional)
   * @returns {object} The generated manifest and its path
   */
  async generateManifest(testRunData, outputPath = null) {
    if (!this.initialized) {
      await this.initialize();
    }

    // Validate required data
    if (!testRunData || !testRunData.testId || !testRunData.runId) {
      throw new Error('Test ID and Run ID are required for manifest generation');
    }

    try {
      // Generate timestamp and ID
      const timestamp = new Date().toISOString();
      const manifestId = uuidv4();
      
      // Begin constructing manifest
      const manifest = {
        manifestId,
        manifestVersion: '1.0.0',
        generatedAt: timestamp,
        testId: testRunData.testId,
        runId: testRunData.runId,
        status: MANIFEST_STATUS.COMPLETE,
        testExecutionSummary: {
          startTime: this._extractStartTime(testRunData),
          endTime: this._extractEndTime(testRunData),
          duration: this._extractDuration(testRunData),
          result: this._extractResult(testRunData),
          success: this._extractSuccess(testRunData)
        }
      };

      // Add system information
      if (this.config.includeSystemInfo) {
        manifest.systemInfo = this._generateSystemInfo();
      }

      // Add log summary if requested and available
      if (this.config.includeLogSummary && testRunData.loggerResult) {
        manifest.logSummary = await this._generateLogSummary(testRunData.loggerResult);
      }

      // Add evidence summary if requested and available
      if (this.config.includeEvidenceSummary && testRunData.evidenceResult) {
        manifest.evidenceSummary = await this._generateEvidenceSummary(testRunData.evidenceResult);
      }

      // Add verification results if requested and available
      if (this.config.includeVerificationResults && testRunData.verificationResult) {
        manifest.verificationResults = await this._generateVerificationSummary(testRunData.verificationResult);
      }

      // Add execution timeline if requested
      if (this.config.includeTimeline) {
        manifest.timeline = await this._generateTimeline(testRunData);
      }

      // Add references to artifacts and logs
      manifest.references = this._generateReferences(testRunData);

      // Sign the manifest if requested
      if (this.config.signManifest) {
        manifest.signature = this._signManifest(manifest);
      }

      // Determine output path if not provided
      if (!outputPath) {
        const dateStr = timestamp.split('T')[0];
        const dirPath = path.join(this.basePath, dateStr);
        
        // Ensure directory exists
        await fs.promises.mkdir(dirPath, { recursive: true });
        
        outputPath = path.join(dirPath, `${testRunData.testId}-${testRunData.runId}-manifest.json`);
      }

      // Write manifest to file
      await fs.promises.writeFile(outputPath, JSON.stringify(manifest, null, 2));

      // Create a markdown summary version
      const markdownPath = outputPath.replace(/\.json$/, '.md');
      const markdownContent = this._generateMarkdownSummary(manifest);
      await fs.promises.writeFile(markdownPath, markdownContent);

      return {
        manifest,
        path: outputPath,
        markdownPath
      };
    } catch (err) {
      console.error('Error generating manifest:', err);
      const errorManifest = {
        manifestId: uuidv4(),
        manifestVersion: '1.0.0',
        generatedAt: new Date().toISOString(),
        testId: testRunData.testId,
        runId: testRunData.runId,
        status: MANIFEST_STATUS.ERROR,
        error: {
          message: err.message,
          stack: err.stack
        }
      };

      // Try to write error manifest
      try {
        const dateStr = new Date().toISOString().split('T')[0];
        const dirPath = path.join(this.basePath, dateStr);
        await fs.promises.mkdir(dirPath, { recursive: true });
        const errorPath = path.join(dirPath, `${testRunData.testId}-${testRunData.runId}-manifest-error.json`);
        await fs.promises.writeFile(errorPath, JSON.stringify(errorManifest, null, 2));
        return {
          manifest: errorManifest,
          path: errorPath,
          error: err
        };
      } catch (writeErr) {
        console.error('Failed to write error manifest:', writeErr);
        throw err; // Re-throw the original error
      }
    }
  }

  /**
   * Generate a manifest using an IntegratedTestRunner result
   * @param {object} runnerResult - Result from IntegratedTestRunner.runTest()
   * @param {string} outputPath - Custom output path (optional)
   * @returns {object} The generated manifest and its path
   */
  async generateFromRunnerResult(runnerResult, outputPath = null) {
    if (!runnerResult) {
      throw new Error('Runner result is required for manifest generation');
    }

    // Extract relevant information from runner result
    const testRunData = {
      testId: runnerResult.testId,
      runId: runnerResult.runId,
      loggerResult: {
        logFilePath: runnerResult.logFilePath
      },
      evidenceResult: {
        evidencePath: runnerResult.evidencePath,
        artifacts: runnerResult.testResult?.evidenceFiles || []
      },
      verificationResult: {
        status: runnerResult.verificationStatus,
        verifications: runnerResult.verifications || {}
      },
      testResult: {
        success: runnerResult.success,
        assertions: runnerResult.assertions,
        duration: runnerResult.duration,
        cloudflareEvidence: runnerResult.cloudflareEvidence
      }
    };

    // Generate manifest
    return await this.generateManifest(testRunData, outputPath);
  }

  /**
   * Generate from a VerifiedTestRunner result
   * @param {object} verifiedResult - Result from VerifiedTestRunner.runTest()
   * @param {string} outputPath - Custom output path (optional)
   * @returns {object} The generated manifest and its path
   */
  async generateFromVerifiedResult(verifiedResult, outputPath = null) {
    if (!verifiedResult) {
      throw new Error('Verified result is required for manifest generation');
    }

    // VerifiedTestRunner already contains all the necessary data
    return await this.generateFromRunnerResult(verifiedResult, outputPath);
  }

  /**
   * Find manifest by test ID
   * @param {string} testId - Test ID to search for
   * @param {object} options - Search options
   * @returns {array} Array of matching manifests
   */
  async findManifestsByTestId(testId, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    const results = [];

    try {
      // List directories in manifest base path (should be dates)
      const dateDirs = await fs.promises.readdir(this.basePath);
      
      // Sort by date (newest first)
      dateDirs.sort().reverse();
      
      // Process each date directory
      for (const dateDir of dateDirs) {
        const dirPath = path.join(this.basePath, dateDir);
        
        try {
          const stats = await fs.promises.stat(dirPath);
          if (!stats.isDirectory()) continue;
          
          // List manifest files
          const files = await fs.promises.readdir(dirPath);
          
          // Find matching manifest files
          for (const file of files) {
            if (!file.endsWith('.json')) continue;
            if (!file.startsWith(`${testId}-`)) continue;
            
            try {
              const manifestPath = path.join(dirPath, file);
              const manifestContent = await fs.promises.readFile(manifestPath, 'utf8');
              const manifest = JSON.parse(manifestContent);
              
              // Verify integrity if manifest is signed
              if (manifest.signature) {
                const isValid = this._verifyManifestSignature(manifest);
                manifest.signatureVerified = isValid;
              }
              
              results.push({
                manifest,
                path: manifestPath
              });
              
              // Limit results if needed
              if (options.limit && results.length >= options.limit) {
                break;
              }
            } catch (err) {
              console.error(`Error processing manifest file ${file}:`, err);
            }
          }
          
          // Stop if we have enough results
          if (options.limit && results.length >= options.limit) {
            break;
          }
        } catch (err) {
          console.error(`Error processing directory ${dateDir}:`, err);
        }
      }
    } catch (err) {
      console.error('Error finding manifests:', err);
    }

    return results;
  }

  /**
   * Generate a consolidated report for multiple test runs
   * @param {array} testIds - Array of test IDs to include
   * @param {string} reportName - Name for the consolidated report
   * @param {string} outputPath - Custom output path (optional)
   * @returns {object} The generated report and its path
   */
  async generateConsolidatedReport(testIds, reportName, outputPath = null) {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!testIds || !Array.isArray(testIds) || testIds.length === 0) {
      throw new Error('At least one test ID is required for consolidated report');
    }

    try {
      // Generate timestamp and ID
      const timestamp = new Date().toISOString();
      const reportId = uuidv4();
      
      // Create basic report structure
      const report = {
        reportId,
        reportName: reportName || 'Consolidated Test Report',
        generatedAt: timestamp,
        testIds: testIds,
        tests: [],
        summary: {
          totalTests: 0,
          passed: 0,
          failed: 0,
          errors: 0,
          verificationPassed: 0,
          cloudflareEvidence: 0
        }
      };

      // Find manifests for each test ID
      for (const testId of testIds) {
        const manifests = await this.findManifestsByTestId(testId, { limit: 5 });
        
        if (manifests.length > 0) {
          // Get the most recent manifest
          const mostRecent = manifests[0];
          report.tests.push({
            testId,
            manifestId: mostRecent.manifest.manifestId,
            manifestPath: mostRecent.path,
            result: mostRecent.manifest.testExecutionSummary?.result || 'UNKNOWN',
            success: mostRecent.manifest.testExecutionSummary?.success || false,
            verificationStatus: mostRecent.manifest.verificationResults?.status || 'UNKNOWN',
            cloudflareEvidence: mostRecent.manifest.evidenceSummary?.cloudflareEvidence || false,
            executedAt: mostRecent.manifest.testExecutionSummary?.endTime || mostRecent.manifest.generatedAt
          });
          
          // Update summary
          report.summary.totalTests++;
          if (mostRecent.manifest.testExecutionSummary?.success) {
            report.summary.passed++;
          } else if (mostRecent.manifest.status === MANIFEST_STATUS.ERROR) {
            report.summary.errors++;
          } else {
            report.summary.failed++;
          }
          
          if (mostRecent.manifest.verificationResults?.status === 'PASS') {
            report.summary.verificationPassed++;
          }
          
          if (mostRecent.manifest.evidenceSummary?.cloudflareEvidence) {
            report.summary.cloudflareEvidence++;
          }
        }
      }

      // Add system information
      if (this.config.includeSystemInfo) {
        report.systemInfo = this._generateSystemInfo();
      }

      // Sign the report
      if (this.config.signManifest) {
        report.signature = this._signManifest(report);
      }

      // Determine output path if not provided
      if (!outputPath) {
        const dateStr = timestamp.split('T')[0];
        const dirPath = path.join(this.basePath, dateStr);
        
        // Ensure directory exists
        await fs.promises.mkdir(dirPath, { recursive: true });
        
        const safeReportName = (reportName || 'consolidated-report')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');
          
        outputPath = path.join(dirPath, `${safeReportName}-${reportId.split('-')[0]}.json`);
      }

      // Write report to file
      await fs.promises.writeFile(outputPath, JSON.stringify(report, null, 2));

      // Create a markdown summary version
      const markdownPath = outputPath.replace(/\.json$/, '.md');
      const markdownContent = this._generateConsolidatedMarkdown(report);
      await fs.promises.writeFile(markdownPath, markdownContent);

      return {
        report,
        path: outputPath,
        markdownPath
      };
    } catch (err) {
      console.error('Error generating consolidated report:', err);
      throw err;
    }
  }

  /**
   * Extract the start time from test run data
   * @private
   * @param {object} testRunData - Test run data
   * @returns {string} Start time in ISO 8601 format
   */
  _extractStartTime(testRunData) {
    // Try to get the start time from different sources
    if (testRunData.testResult && testRunData.testResult.startTime) {
      return testRunData.testResult.startTime;
    }
    
    if (testRunData.loggerResult && testRunData.loggerResult.startTime) {
      return testRunData.loggerResult.startTime;
    }
    
    if (testRunData.evidenceResult && testRunData.evidenceResult.startTime) {
      return testRunData.evidenceResult.startTime;
    }
    
    // Default to current time if not found
    return new Date().toISOString();
  }

  /**
   * Extract the end time from test run data
   * @private
   * @param {object} testRunData - Test run data
   * @returns {string} End time in ISO 8601 format
   */
  _extractEndTime(testRunData) {
    // Try to get the end time from different sources
    if (testRunData.testResult && testRunData.testResult.endTime) {
      return testRunData.testResult.endTime;
    }
    
    if (testRunData.loggerResult && testRunData.loggerResult.endTime) {
      return testRunData.loggerResult.endTime;
    }
    
    if (testRunData.evidenceResult && testRunData.evidenceResult.endTime) {
      return testRunData.evidenceResult.endTime;
    }
    
    // Default to current time if not found
    return new Date().toISOString();
  }

  /**
   * Extract the test duration from test run data
   * @private
   * @param {object} testRunData - Test run data
   * @returns {number} Duration in milliseconds
   */
  _extractDuration(testRunData) {
    // Try to get the duration from different sources
    if (testRunData.testResult && testRunData.testResult.duration) {
      return testRunData.testResult.duration;
    }
    
    // Calculate from start and end time if available
    const startTime = this._extractStartTime(testRunData);
    const endTime = this._extractEndTime(testRunData);
    
    if (startTime && endTime) {
      return new Date(endTime) - new Date(startTime);
    }
    
    return 0;
  }

  /**
   * Extract the test result from test run data
   * @private
   * @param {object} testRunData - Test run data
   * @returns {string} Test result
   */
  _extractResult(testRunData) {
    // Look for explicit result first
    if (testRunData.testResult && testRunData.testResult.result) {
      return testRunData.testResult.result;
    }
    
    // Fall back to success status
    if (testRunData.testResult && typeof testRunData.testResult.success === 'boolean') {
      return testRunData.testResult.success ? 'PASS' : 'FAIL';
    }
    
    // Look for verification status
    if (testRunData.verificationResult && testRunData.verificationResult.status) {
      // Map verification status to test result
      const status = testRunData.verificationResult.status;
      if (status === 'PASS') return 'PASS';
      if (status === 'FAIL' || status === 'ERROR') return 'FAIL';
      if (status === 'WARNING') return 'WARNING';
      return status;
    }
    
    return 'UNKNOWN';
  }

  /**
   * Extract success status from test run data
   * @private
   * @param {object} testRunData - Test run data
   * @returns {boolean} Success status
   */
  _extractSuccess(testRunData) {
    if (testRunData.testResult && typeof testRunData.testResult.success === 'boolean') {
      return testRunData.testResult.success;
    }
    
    // Determine from result
    const result = this._extractResult(testRunData);
    return result === 'PASS';
  }

  /**
   * Generate system information for the manifest
   * @private
   * @returns {object} System information
   */
  _generateSystemInfo() {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      hostname: require('os').hostname(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generate a log summary from logger result
   * @private
   * @param {object} loggerResult - Logger result
   * @returns {object} Log summary
   */
  async _generateLogSummary(loggerResult) {
    const summary = {
      logFilePath: loggerResult.logFilePath,
      eventsCount: 0,
      errorCount: 0,
      warningCount: 0,
      integrityVerified: false
    };
    
    try {
      // Check if log file exists and is readable
      if (loggerResult.logFilePath && fs.existsSync(loggerResult.logFilePath)) {
        // Verify log integrity
        const verification = await TestLogger.verifyLogIntegrity(loggerResult.logFilePath);
        
        summary.eventsCount = verification.eventCount;
        summary.integrityVerified = verification.verified;
        
        // Count errors and warnings if possible
        if (loggerResult.errors) {
          summary.errorCount = loggerResult.errors;
        }
        
        if (loggerResult.warnings) {
          summary.warningCount = loggerResult.warnings;
        }
      }
    } catch (err) {
      console.error('Error generating log summary:', err);
      summary.error = err.message;
    }
    
    return summary;
  }

  /**
   * Generate an evidence summary from evidence result
   * @private
   * @param {object} evidenceResult - Evidence result
   * @returns {object} Evidence summary
   */
  async _generateEvidenceSummary(evidenceResult) {
    const summary = {
      evidenceMetadataPath: evidenceResult.metadataPath || evidenceResult.evidencePath,
      artifactCount: 0,
      cloudflareEvidence: false,
      integrityVerified: false
    };
    
    try {
      // Check if evidence metadata file exists
      if (summary.evidenceMetadataPath && fs.existsSync(summary.evidenceMetadataPath)) {
        // Try to verify evidence integrity
        const verification = await EvidenceStorage.verifyEvidence(summary.evidenceMetadataPath);
        
        summary.artifactCount = verification.artifactsTotal;
        summary.integrityVerified = verification.verified;
        
        // Check for cloudflare evidence
        if (evidenceResult.cloudflareEvidence !== undefined) {
          summary.cloudflareEvidence = evidenceResult.cloudflareEvidence;
        } else if (verification.metadata && verification.metadata.summary) {
          summary.cloudflareEvidence = verification.metadata.summary.cloudflareEvidence;
        }
      }
      
      // Count artifacts from evidence result if available
      if (evidenceResult.artifacts && Array.isArray(evidenceResult.artifacts)) {
        summary.artifactCount = evidenceResult.artifacts.length;
      }
    } catch (err) {
      console.error('Error generating evidence summary:', err);
      summary.error = err.message;
    }
    
    return summary;
  }

  /**
   * Generate a verification summary from verification result
   * @private
   * @param {object} verificationResult - Verification result
   * @returns {object} Verification summary
   */
  async _generateVerificationSummary(verificationResult) {
    // If verificationResult is already in the right format, use it directly
    if (verificationResult.status && verificationResult.verifications) {
      return {
        status: verificationResult.status,
        timestamp: verificationResult.timestamp,
        verifications: verificationResult.verifications
      };
    }
    
    // Otherwise, construct a basic summary
    return {
      status: verificationResult.status || 'UNKNOWN',
      timestamp: verificationResult.timestamp || new Date().toISOString(),
      verifications: verificationResult.verifications || {}
    };
  }

  /**
   * Generate a timeline of test execution
   * @private
   * @param {object} testRunData - Test run data
   * @returns {array} Timeline events
   */
  async _generateTimeline(testRunData) {
    const timeline = [];
    
    try {
      // Start event
      timeline.push({
        timestamp: this._extractStartTime(testRunData),
        event: 'TEST_START',
        details: `Test execution started: ${testRunData.testId}`
      });
      
      // Add verification events if available
      if (testRunData.verificationResult && testRunData.verificationResult.verifications) {
        for (const [type, verification] of Object.entries(testRunData.verificationResult.verifications)) {
          if (verification.timestamp) {
            timeline.push({
              timestamp: verification.timestamp,
              event: `VERIFICATION_${type}`,
              status: verification.status,
              details: verification.details
            });
          }
        }
      }
      
      // End event
      timeline.push({
        timestamp: this._extractEndTime(testRunData),
        event: 'TEST_END',
        status: this._extractResult(testRunData),
        details: `Test execution completed: ${testRunData.testId}`
      });
      
      // Sort timeline by timestamp
      timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    } catch (err) {
      console.error('Error generating timeline:', err);
      timeline.push({
        timestamp: new Date().toISOString(),
        event: 'ERROR',
        details: `Error generating timeline: ${err.message}`
      });
    }
    
    return timeline;
  }

  /**
   * Generate references to artifacts and logs
   * @private
   * @param {object} testRunData - Test run data
   * @returns {object} References to artifacts and logs
   */
  _generateReferences(testRunData) {
    const references = {
      logs: {},
      evidence: {},
      verification: {}
    };
    
    // Add log references
    if (testRunData.loggerResult && testRunData.loggerResult.logFilePath) {
      references.logs.logFile = testRunData.loggerResult.logFilePath;
    }
    
    // Add evidence references
    if (testRunData.evidenceResult) {
      if (testRunData.evidenceResult.metadataPath || testRunData.evidenceResult.evidencePath) {
        references.evidence.metadataFile = testRunData.evidenceResult.metadataPath || testRunData.evidenceResult.evidencePath;
      }
      
      // Add artifact references if available
      if (testRunData.evidenceResult.artifacts && Array.isArray(testRunData.evidenceResult.artifacts)) {
        references.evidence.artifacts = testRunData.evidenceResult.artifacts.map(artifact => ({
          id: artifact.id,
          type: artifact.type,
          path: artifact.path,
          description: artifact.description
        }));
      }
    }
    
    // Add verification references
    if (testRunData.verificationResult && testRunData.verificationResult.verificationId) {
      references.verification.verificationId = testRunData.verificationResult.verificationId;
    }
    
    return references;
  }

  /**
   * Sign the manifest using SHA-256
   * @private
   * @param {object} manifest - The manifest to sign
   * @returns {object} Signature information
   */
  _signManifest(manifest) {
    // Create a deep copy of the manifest without the signature field
    const manifestCopy = JSON.parse(JSON.stringify(manifest));
    delete manifestCopy.signature;
    
    // Generate hash
    const hash = crypto.createHash('sha256')
      .update(JSON.stringify(manifestCopy))
      .digest('hex');
    
    // Return signature information
    return {
      algorithm: 'SHA-256',
      hash,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Verify a manifest signature
   * @private
   * @param {object} manifest - The manifest to verify
   * @returns {boolean} True if signature is valid
   */
  _verifyManifestSignature(manifest) {
    try {
      if (!manifest.signature || !manifest.signature.hash) {
        return false;
      }
      
      // Create a deep copy of the manifest without the signature field
      const manifestCopy = JSON.parse(JSON.stringify(manifest));
      delete manifestCopy.signature;
      
      // Calculate expected hash
      const expectedHash = crypto.createHash('sha256')
        .update(JSON.stringify(manifestCopy))
        .digest('hex');
      
      // Verify hash matches
      return manifest.signature.hash === expectedHash;
    } catch (err) {
      console.error('Error verifying manifest signature:', err);
      return false;
    }
  }

  /**
   * Generate markdown summary of a manifest
   * @private
   * @param {object} manifest - The manifest
   * @returns {string} Markdown summary
   */
  _generateMarkdownSummary(manifest) {
    let markdown = `# Test Manifest: ${manifest.testId}\n\n`;
    
    markdown += `## Overview\n\n`;
    markdown += `- **Test ID:** ${manifest.testId}\n`;
    markdown += `- **Run ID:** ${manifest.runId}\n`;
    markdown += `- **Manifest ID:** ${manifest.manifestId}\n`;
    markdown += `- **Generated:** ${manifest.generatedAt}\n`;
    markdown += `- **Status:** ${manifest.status}\n\n`;
    
    markdown += `## Test Execution Summary\n\n`;
    markdown += `- **Start Time:** ${manifest.testExecutionSummary.startTime}\n`;
    markdown += `- **End Time:** ${manifest.testExecutionSummary.endTime}\n`;
    markdown += `- **Duration:** ${manifest.testExecutionSummary.duration} ms\n`;
    markdown += `- **Result:** ${manifest.testExecutionSummary.result}\n`;
    markdown += `- **Success:** ${manifest.testExecutionSummary.success}\n\n`;
    
    if (manifest.logSummary) {
      markdown += `## Log Summary\n\n`;
      markdown += `- **Events:** ${manifest.logSummary.eventsCount}\n`;
      markdown += `- **Errors:** ${manifest.logSummary.errorCount}\n`;
      markdown += `- **Warnings:** ${manifest.logSummary.warningCount}\n`;
      markdown += `- **Integrity Verified:** ${manifest.logSummary.integrityVerified}\n`;
      markdown += `- **Log File:** \`${manifest.logSummary.logFilePath}\`\n\n`;
    }
    
    if (manifest.evidenceSummary) {
      markdown += `## Evidence Summary\n\n`;
      markdown += `- **Artifacts:** ${manifest.evidenceSummary.artifactCount}\n`;
      markdown += `- **Cloudflare Evidence:** ${manifest.evidenceSummary.cloudflareEvidence}\n`;
      markdown += `- **Integrity Verified:** ${manifest.evidenceSummary.integrityVerified}\n`;
      markdown += `- **Metadata File:** \`${manifest.evidenceSummary.evidenceMetadataPath}\`\n\n`;
    }
    
    if (manifest.verificationResults) {
      markdown += `## Verification Results\n\n`;
      markdown += `- **Status:** ${manifest.verificationResults.status}\n`;
      
      if (manifest.verificationResults.verifications) {
        markdown += `\n### Verification Details\n\n`;
        markdown += `| Type | Status | Details |\n`;
        markdown += `|------|--------|--------|\n`;
        
        for (const [type, verification] of Object.entries(manifest.verificationResults.verifications)) {
          markdown += `| ${type} | ${verification.status} | ${verification.details || 'N/A'} |\n`;
        }
        
        markdown += `\n`;
      }
    }
    
    if (manifest.timeline && manifest.timeline.length > 0) {
      markdown += `## Execution Timeline\n\n`;
      markdown += `| Timestamp | Event | Status | Details |\n`;
      markdown += `|-----------|-------|--------|--------|\n`;
      
      for (const event of manifest.timeline) {
        markdown += `| ${event.timestamp} | ${event.event} | ${event.status || 'N/A'} | ${event.details || 'N/A'} |\n`;
      }
      
      markdown += `\n`;
    }
    
    if (manifest.systemInfo) {
      markdown += `## System Information\n\n`;
      markdown += `- **Node Version:** ${manifest.systemInfo.nodeVersion}\n`;
      markdown += `- **Platform:** ${manifest.systemInfo.platform}\n`;
      markdown += `- **Architecture:** ${manifest.systemInfo.arch}\n`;
      markdown += `- **Hostname:** ${manifest.systemInfo.hostname}\n\n`;
    }
    
    if (manifest.signature) {
      markdown += `## Manifest Integrity\n\n`;
      markdown += `- **Signature Algorithm:** ${manifest.signature.algorithm}\n`;
      markdown += `- **Signature Hash:** ${manifest.signature.hash}\n`;
      markdown += `- **Signed At:** ${manifest.signature.timestamp}\n\n`;
    }
    
    markdown += `---\n\n`;
    markdown += `*This manifest was generated by the ManifestGenerator as part of the Edge Agent Testing Audit Reconciliation project.*\n`;
    
    return markdown;
  }

  /**
   * Generate markdown summary of a consolidated report
   * @private
   * @param {object} report - The consolidated report
   * @returns {string} Markdown summary
   */
  _generateConsolidatedMarkdown(report) {
    let markdown = `# ${report.reportName}\n\n`;
    
    markdown += `## Overview\n\n`;
    markdown += `- **Report ID:** ${report.reportId}\n`;
    markdown += `- **Generated:** ${report.generatedAt}\n`;
    markdown += `- **Total Tests:** ${report.summary.totalTests}\n\n`;
    
    markdown += `## Summary\n\n`;
    markdown += `- **Passed:** ${report.summary.passed}\n`;
    markdown += `- **Failed:** ${report.summary.failed}\n`;
    markdown += `- **Errors:** ${report.summary.errors}\n`;
    markdown += `- **Verification Passed:** ${report.summary.verificationPassed}\n`;
    markdown += `- **Cloudflare Evidence:** ${report.summary.cloudflareEvidence}\n\n`;
    
    if (report.tests && report.tests.length > 0) {
      markdown += `## Test Results\n\n`;
      markdown += `| Test ID | Result | Verification | Cloudflare Evidence | Executed At |\n`;
      markdown += `|---------|--------|--------------|-------------------|-------------|\n`;
      
      for (const test of report.tests) {
        markdown += `| ${test.testId} | ${test.success ? '✅ PASS' : '❌ FAIL'} | ${test.verificationStatus} | ${test.cloudflareEvidence ? '✅ YES' : '❌ NO'} | ${test.executedAt} |\n`;
      }
      
      markdown += `\n`;
      
      markdown += `## Test Details\n\n`;
      
      for (const test of report.tests) {
        markdown += `### ${test.testId}\n\n`;
        markdown += `- **Manifest ID:** ${test.manifestId}\n`;
        markdown += `- **Result:** ${test.result}\n`;
        markdown += `- **Success:** ${test.success}\n`;
        markdown += `- **Verification Status:** ${test.verificationStatus}\n`;
        markdown += `- **Cloudflare Evidence:** ${test.cloudflareEvidence}\n`;
        markdown += `- **Executed At:** ${test.executedAt}\n`;
        markdown += `- **Manifest Path:** \`${test.manifestPath}\`\n\n`;
      }
    }
    
    if (report.systemInfo) {
      markdown += `## System Information\n\n`;
      markdown += `- **Node Version:** ${report.systemInfo.nodeVersion}\n`;
      markdown += `- **Platform:** ${report.systemInfo.platform}\n`;
      markdown += `- **Architecture:** ${report.systemInfo.arch}\n`;
      markdown += `- **Hostname:** ${report.systemInfo.hostname}\n\n`;
    }
    
    if (report.signature) {
      markdown += `## Report Integrity\n\n`;
      markdown += `- **Signature Algorithm:** ${report.signature.algorithm}\n`;
      markdown += `- **Signature Hash:** ${report.signature.hash}\n`;
      markdown += `- **Signed At:** ${report.signature.timestamp}\n\n`;
    }
    
    markdown += `---\n\n`;
    markdown += `*This report was generated by the ManifestGenerator as part of the Edge Agent Testing Audit Reconciliation project.*\n`;
    
    return markdown;
  }
}

module.exports = {
  ManifestGenerator,
  MANIFEST_STATUS
}; 