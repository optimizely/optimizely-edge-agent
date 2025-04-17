/**
 * @fileoverview Verification Hooks for Test Scripts
 * 
 * This module provides verification hooks that can be integrated into test scripts
 * to ensure test integrity, execution validation, and proper evidence collection.
 * It works with the TestLogger and EvidenceStorage systems to provide a comprehensive
 * verification framework.
 * 
 * Created as part of the Testing Audit Reconciliation project (testing-audit-reconciliation-04-10-2025)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { TestLogger } = require('../logging/logger');
const { EvidenceStorage } = require('../../evidence/evidence-storage');

/**
 * Default configuration for verification hooks
 */
const DEFAULT_CONFIG = {
  verifyIntegrity: true,
  verifyCloudflare: true,
  requireTimestampUTC: true,
  requireSignatures: true,
  evidenceThreshold: 3, // Minimum number of evidence artifacts required
  cloudflareEvidenceRequired: true,
  validateExecutionChain: true
};

/**
 * Status indicators for verification results
 */
const VERIFICATION_STATUS = {
  PENDING: 'PENDING',
  PASS: 'PASS',
  FAIL: 'FAIL',
  WARNING: 'WARNING',
  ERROR: 'ERROR'
};

/**
 * Verification types
 */
const VERIFICATION_TYPES = {
  INTEGRITY: 'INTEGRITY',
  CLOUDFLARE: 'CLOUDFLARE',
  TIMESTAMP: 'TIMESTAMP',
  SIGNATURE: 'SIGNATURE',
  EVIDENCE: 'EVIDENCE',
  EXECUTION: 'EXECUTION'
};

/**
 * Class to manage verification hooks for test scripts
 */
class VerificationHooks {
  /**
   * Create a new VerificationHooks instance
   * @param {object} testContext - Context from test runner (logger, evidence, etc.)
   * @param {object} config - Configuration options
   */
  constructor(testContext, config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.testContext = testContext;
    this.verifications = {};
    this.verificationResults = [];
    this.initialized = false;
    this.verificationId = uuidv4();

    // Initialize verification records for each type
    Object.values(VERIFICATION_TYPES).forEach(type => {
      this.verifications[type] = {
        status: VERIFICATION_STATUS.PENDING,
        timestamp: null,
        details: null,
        evidence: []
      };
    });
  }

  /**
   * Initialize the verification hooks
   */
  async initialize() {
    if (this.initialized) return;

    // Log initialization
    if (this.testContext.logger) {
      this.testContext.logger.log('INFO', 'INFO', 'Initializing verification hooks', {
        component: 'verification-hooks',
        verificationId: this.verificationId,
        configuredChecks: Object.keys(this.config).filter(key => this.config[key] === true)
      });
    }

    // Store verification initialization as evidence
    if (this.testContext.evidence) {
      await this.testContext.evidence.storeDataArtifact({
        verificationId: this.verificationId,
        timestamp: new Date().toISOString(),
        configuration: this.config,
        verifications: this.verifications
      }, 'Verification Hooks Initialization');
    }

    this.initialized = true;
    return this.verificationId;
  }

  /**
   * Pre-execution verification hook - runs before test execution
   */
  async preExecution() {
    if (!this.initialized) {
      await this.initialize();
    }

    // Log pre-execution verification
    if (this.testContext.logger) {
      this.testContext.logger.log('INFO', 'INFO', 'Running pre-execution verification checks', {
        component: 'verification-hooks',
        verificationId: this.verificationId,
        timestamp: new Date().toISOString()
      });
    }

    // Create verification record
    const preExecutionRecord = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      phase: 'pre-execution',
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        hostname: require('os').hostname()
      }
    };

    // Add verification signature
    preExecutionRecord.signature = this._generateSignature(preExecutionRecord);

    // Store as evidence
    if (this.testContext.evidence) {
      const artifact = await this.testContext.evidence.storeDataArtifact(
        preExecutionRecord,
        'Pre-Execution Verification Record'
      );
      this.verificationResults.push({
        phase: 'pre-execution',
        artifact: artifact.id,
        timestamp: preExecutionRecord.timestamp
      });
    }

    return preExecutionRecord;
  }

  /**
   * Verify timestamps are in UTC and properly formatted
   * @param {string} timestamp - Timestamp to verify
   * @returns {boolean} True if timestamp is valid
   */
  verifyTimestamp(timestamp) {
    if (!this.config.requireTimestampUTC) {
      return true;
    }

    try {
      // Check ISO8601 format with UTC timezone (must end with Z)
      const isValid = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(timestamp);
      
      // Update verification status
      this.verifications[VERIFICATION_TYPES.TIMESTAMP] = {
        status: isValid ? VERIFICATION_STATUS.PASS : VERIFICATION_STATUS.FAIL,
        timestamp: new Date().toISOString(),
        details: isValid ? 'Valid UTC ISO8601 timestamp' : 'Invalid timestamp format, must be UTC ISO8601'
      };

      // Log result
      if (this.testContext.logger) {
        this.testContext.logger.log(
          isValid ? 'INFO' : 'ERROR',
          isValid ? 'INFO' : 'ERROR',
          `Timestamp verification ${isValid ? 'passed' : 'failed'}: ${timestamp}`,
          {
            component: 'verification-hooks',
            verificationId: this.verificationId,
            verificationType: VERIFICATION_TYPES.TIMESTAMP,
            timestamp: new Date().toISOString(),
            isValid
          }
        );
      }

      return isValid;
    } catch (err) {
      this.verifications[VERIFICATION_TYPES.TIMESTAMP] = {
        status: VERIFICATION_STATUS.ERROR,
        timestamp: new Date().toISOString(),
        details: `Error verifying timestamp: ${err.message}`
      };
      return false;
    }
  }

  /**
   * Verify Cloudflare evidence exists in HTTP responses
   * @param {object} responseData - HTTP response data
   * @returns {boolean} True if valid Cloudflare evidence found
   */
  verifyCloudflare(responseData) {
    if (!this.config.verifyCloudflare) {
      return true;
    }

    try {
      const headers = responseData.headers || {};
      const hasCfRay = !!headers['cf-ray'];
      
      // Check for other Cloudflare indicators
      const hasCfCache = !!headers['cf-cache-status'];
      const hasCfWorker = !!headers['cf-worker'];
      
      // At least cf-ray must be present
      const isValid = hasCfRay;
      
      // Update verification status
      this.verifications[VERIFICATION_TYPES.CLOUDFLARE] = {
        status: isValid ? VERIFICATION_STATUS.PASS : VERIFICATION_STATUS.FAIL,
        timestamp: new Date().toISOString(),
        details: isValid 
          ? `Valid Cloudflare evidence found: cf-ray=${headers['cf-ray']}` 
          : 'No Cloudflare evidence found in response headers'
      };

      // Store evidence
      if (this.testContext.evidence && isValid) {
        this.testContext.evidence.storeDataArtifact({
          timestamp: new Date().toISOString(),
          verificationType: VERIFICATION_TYPES.CLOUDFLARE,
          headers: {
            'cf-ray': headers['cf-ray'],
            'cf-cache-status': headers['cf-cache-status'],
            'cf-worker': headers['cf-worker']
          }
        }, 'Cloudflare Verification Evidence');
      }

      // Log result
      if (this.testContext.logger) {
        this.testContext.logger.log(
          isValid ? 'INFO' : (this.config.cloudflareEvidenceRequired ? 'ERROR' : 'WARNING'),
          isValid ? 'INFO' : (this.config.cloudflareEvidenceRequired ? 'ERROR' : 'WARNING'),
          `Cloudflare verification ${isValid ? 'passed' : 'failed'}`,
          {
            component: 'verification-hooks',
            verificationId: this.verificationId,
            verificationType: VERIFICATION_TYPES.CLOUDFLARE,
            cfRay: headers['cf-ray'] || null,
            isValid
          }
        );
      }

      return isValid || !this.config.cloudflareEvidenceRequired;
    } catch (err) {
      this.verifications[VERIFICATION_TYPES.CLOUDFLARE] = {
        status: VERIFICATION_STATUS.ERROR,
        timestamp: new Date().toISOString(),
        details: `Error verifying Cloudflare evidence: ${err.message}`
      };
      return !this.config.cloudflareEvidenceRequired;
    }
  }

  /**
   * Verify cryptographic signatures of artifacts
   * @param {object} artifact - The artifact to verify
   * @returns {boolean} True if signature is valid
   */
  verifySignature(artifact) {
    if (!this.config.requireSignatures) {
      return true;
    }

    try {
      const { signature, ...contentWithoutSignature } = artifact;
      
      if (!signature) {
        // Update verification status
        this.verifications[VERIFICATION_TYPES.SIGNATURE] = {
          status: VERIFICATION_STATUS.FAIL,
          timestamp: new Date().toISOString(),
          details: 'No signature found in artifact'
        };
        return false;
      }
      
      // Calculate expected signature
      const expectedSignature = this._generateSignature(contentWithoutSignature);
      const isValid = signature === expectedSignature;
      
      // Update verification status
      this.verifications[VERIFICATION_TYPES.SIGNATURE] = {
        status: isValid ? VERIFICATION_STATUS.PASS : VERIFICATION_STATUS.FAIL,
        timestamp: new Date().toISOString(),
        details: isValid 
          ? 'Valid signature found'
          : 'Invalid signature - potential tampering detected'
      };

      // Log result
      if (this.testContext.logger) {
        this.testContext.logger.log(
          isValid ? 'INFO' : 'ERROR',
          isValid ? 'INFO' : 'ERROR',
          `Signature verification ${isValid ? 'passed' : 'failed'}`,
          {
            component: 'verification-hooks',
            verificationId: this.verificationId,
            verificationType: VERIFICATION_TYPES.SIGNATURE,
            artifactId: artifact.id || 'unknown',
            isValid
          }
        );
      }

      return isValid;
    } catch (err) {
      this.verifications[VERIFICATION_TYPES.SIGNATURE] = {
        status: VERIFICATION_STATUS.ERROR,
        timestamp: new Date().toISOString(),
        details: `Error verifying signature: ${err.message}`
      };
      return false;
    }
  }

  /**
   * Verify the integrity of the logger's event chain
   * @returns {boolean} True if log integrity is verified
   */
  async verifyLogIntegrity() {
    if (!this.config.verifyIntegrity) {
      return true;
    }

    try {
      if (!this.testContext.logger || !this.testContext.logger.logFilePath) {
        this.verifications[VERIFICATION_TYPES.INTEGRITY] = {
          status: VERIFICATION_STATUS.ERROR,
          timestamp: new Date().toISOString(),
          details: 'No log file available for integrity verification'
        };
        return false;
      }

      // Use the TestLogger's static method to verify integrity
      const verificationResult = await TestLogger.verifyLogIntegrity(
        this.testContext.logger.logFilePath
      );
      
      const isValid = verificationResult.verified;
      
      // Update verification status
      this.verifications[VERIFICATION_TYPES.INTEGRITY] = {
        status: isValid ? VERIFICATION_STATUS.PASS : VERIFICATION_STATUS.FAIL,
        timestamp: new Date().toISOString(),
        details: isValid 
          ? `Log integrity verified: ${verificationResult.eventCount} events`
          : `Log integrity verification failed: ${verificationResult.errors.join('; ')}`
      };

      // Store evidence
      if (this.testContext.evidence) {
        await this.testContext.evidence.storeDataArtifact({
          timestamp: new Date().toISOString(),
          verificationType: VERIFICATION_TYPES.INTEGRITY,
          result: verificationResult
        }, 'Log Integrity Verification Result');
      }

      // Log result
      if (this.testContext.logger) {
        this.testContext.logger.log(
          isValid ? 'INFO' : 'ERROR',
          isValid ? 'INFO' : 'ERROR',
          `Log integrity verification ${isValid ? 'passed' : 'failed'}`,
          {
            component: 'verification-hooks',
            verificationId: this.verificationId,
            verificationType: VERIFICATION_TYPES.INTEGRITY,
            eventCount: verificationResult.eventCount,
            isValid
          }
        );
      }

      return isValid;
    } catch (err) {
      this.verifications[VERIFICATION_TYPES.INTEGRITY] = {
        status: VERIFICATION_STATUS.ERROR,
        timestamp: new Date().toISOString(),
        details: `Error verifying log integrity: ${err.message}`
      };
      return false;
    }
  }

  /**
   * Verify evidence collection meets minimum requirements
   * @returns {boolean} True if sufficient evidence exists
   */
  async verifyEvidenceCollection() {
    try {
      if (!this.testContext.evidence) {
        this.verifications[VERIFICATION_TYPES.EVIDENCE] = {
          status: VERIFICATION_STATUS.ERROR,
          timestamp: new Date().toISOString(),
          details: 'No evidence storage available for verification'
        };
        return false;
      }

      // Count artifacts
      const artifactCount = this.testContext.evidence.artifacts.length;
      const hasSufficientEvidence = artifactCount >= this.config.evidenceThreshold;
      
      // Check Cloudflare evidence if required
      const hasCloudflareEvidence = this.testContext.evidence.summary.cloudflareEvidence;
      const cloudflareResult = !this.config.cloudflareEvidenceRequired || hasCloudflareEvidence;
      
      // Both criteria must be met
      const isValid = hasSufficientEvidence && cloudflareResult;
      
      // Get status based on results
      let status;
      if (isValid) {
        status = VERIFICATION_STATUS.PASS;
      } else if (!hasSufficientEvidence) {
        status = VERIFICATION_STATUS.FAIL;
      } else {
        status = this.config.cloudflareEvidenceRequired ? VERIFICATION_STATUS.FAIL : VERIFICATION_STATUS.WARNING;
      }
      
      // Update verification status
      this.verifications[VERIFICATION_TYPES.EVIDENCE] = {
        status,
        timestamp: new Date().toISOString(),
        details: isValid
          ? `Evidence verification passed: ${artifactCount} artifacts collected`
          : `Evidence verification ${status}: ${artifactCount}/${this.config.evidenceThreshold} artifacts collected, Cloudflare evidence: ${hasCloudflareEvidence}`
      };

      // Log result
      if (this.testContext.logger) {
        this.testContext.logger.log(
          status === VERIFICATION_STATUS.PASS ? 'INFO' : (status === VERIFICATION_STATUS.WARNING ? 'WARNING' : 'ERROR'),
          status === VERIFICATION_STATUS.PASS ? 'INFO' : (status === VERIFICATION_STATUS.WARNING ? 'WARNING' : 'ERROR'),
          `Evidence collection verification ${status.toLowerCase()}`,
          {
            component: 'verification-hooks',
            verificationId: this.verificationId,
            verificationType: VERIFICATION_TYPES.EVIDENCE,
            artifactCount,
            hasCloudflareEvidence,
            threshold: this.config.evidenceThreshold,
            status
          }
        );
      }

      return status !== VERIFICATION_STATUS.FAIL;
    } catch (err) {
      this.verifications[VERIFICATION_TYPES.EVIDENCE] = {
        status: VERIFICATION_STATUS.ERROR,
        timestamp: new Date().toISOString(),
        details: `Error verifying evidence collection: ${err.message}`
      };
      return false;
    }
  }

  /**
   * Verify the execution chain (that test was executed in the proper environment)
   * @returns {boolean} True if execution chain is valid
   */
  async verifyExecutionChain() {
    if (!this.config.validateExecutionChain) {
      return true;
    }

    try {
      // Verify test has both logger and evidence components
      const hasLogger = !!this.testContext.logger && !!this.testContext.logger.runId;
      const hasEvidence = !!this.testContext.evidence && !!this.testContext.evidence.runId;
      
      // Check that runIds match between systems
      let runIdsMatch = false;
      if (hasLogger && hasEvidence) {
        runIdsMatch = this.testContext.logger.runId === this.testContext.evidence.runId;
      }
      
      // Verify test has proper verification hooks initialization
      const hasVerificationInit = this.initialized;
      
      // All criteria must be met
      const isValid = hasLogger && hasEvidence && runIdsMatch && hasVerificationInit;
      
      // Update verification status
      this.verifications[VERIFICATION_TYPES.EXECUTION] = {
        status: isValid ? VERIFICATION_STATUS.PASS : VERIFICATION_STATUS.FAIL,
        timestamp: new Date().toISOString(),
        details: isValid
          ? 'Execution chain verification passed: All components properly integrated'
          : `Execution chain verification failed: ${!hasLogger ? 'Missing logger; ' : ''}${!hasEvidence ? 'Missing evidence; ' : ''}${!runIdsMatch ? 'Run ID mismatch; ' : ''}${!hasVerificationInit ? 'Verification not initialized; ' : ''}`
      };

      // Store evidence
      if (this.testContext.evidence) {
        await this.testContext.evidence.storeDataArtifact({
          timestamp: new Date().toISOString(),
          verificationType: VERIFICATION_TYPES.EXECUTION,
          executionDetails: {
            hasLogger,
            hasEvidence,
            runIdsMatch,
            hasVerificationInit,
            loggerRunId: hasLogger ? this.testContext.logger.runId : null,
            evidenceRunId: hasEvidence ? this.testContext.evidence.runId : null
          }
        }, 'Execution Chain Verification Result');
      }

      // Log result
      if (this.testContext.logger) {
        this.testContext.logger.log(
          isValid ? 'INFO' : 'ERROR',
          isValid ? 'INFO' : 'ERROR',
          `Execution chain verification ${isValid ? 'passed' : 'failed'}`,
          {
            component: 'verification-hooks',
            verificationId: this.verificationId,
            verificationType: VERIFICATION_TYPES.EXECUTION,
            isValid
          }
        );
      }

      return isValid;
    } catch (err) {
      this.verifications[VERIFICATION_TYPES.EXECUTION] = {
        status: VERIFICATION_STATUS.ERROR,
        timestamp: new Date().toISOString(),
        details: `Error verifying execution chain: ${err.message}`
      };
      return false;
    }
  }

  /**
   * Post-execution verification hook - runs after test execution
   * Performs comprehensive verification of logs, evidence, and execution
   */
  async postExecution() {
    if (!this.initialized) {
      await this.initialize();
    }

    // Log post-execution verification
    if (this.testContext.logger) {
      this.testContext.logger.log('INFO', 'INFO', 'Running post-execution verification checks', {
        component: 'verification-hooks',
        verificationId: this.verificationId,
        timestamp: new Date().toISOString()
      });
    }

    // Run all verification checks
    const logIntegrityResult = await this.verifyLogIntegrity();
    const evidenceResult = await this.verifyEvidenceCollection();
    const executionChainResult = await this.verifyExecutionChain();

    // Create verification record
    const postExecutionRecord = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      phase: 'post-execution',
      verifications: this.verifications,
      overallStatus: this._determineOverallStatus()
    };

    // Add verification signature
    postExecutionRecord.signature = this._generateSignature(postExecutionRecord);

    // Store as evidence
    if (this.testContext.evidence) {
      const artifact = await this.testContext.evidence.storeDataArtifact(
        postExecutionRecord,
        'Post-Execution Verification Record'
      );
      this.verificationResults.push({
        phase: 'post-execution',
        artifact: artifact.id,
        timestamp: postExecutionRecord.timestamp
      });
    }

    return {
      status: postExecutionRecord.overallStatus,
      verifications: this.verifications,
      timestamp: postExecutionRecord.timestamp
    };
  }

  /**
   * Determine the overall verification status
   * @private
   * @returns {string} The overall status
   */
  _determineOverallStatus() {
    const statuses = Object.values(this.verifications).map(v => v.status);
    
    if (statuses.includes(VERIFICATION_STATUS.ERROR)) {
      return VERIFICATION_STATUS.ERROR;
    }
    
    if (statuses.includes(VERIFICATION_STATUS.FAIL)) {
      return VERIFICATION_STATUS.FAIL;
    }
    
    if (statuses.includes(VERIFICATION_STATUS.WARNING)) {
      return VERIFICATION_STATUS.WARNING;
    }
    
    if (statuses.every(s => s === VERIFICATION_STATUS.PASS)) {
      return VERIFICATION_STATUS.PASS;
    }
    
    return VERIFICATION_STATUS.PENDING;
  }

  /**
   * Generate a cryptographic signature for an object
   * @private
   * @param {object} data - The data to sign
   * @returns {string} The generated signature
   */
  _generateSignature(data) {
    const contentStr = JSON.stringify(data);
    return crypto.createHash('sha256').update(contentStr).digest('hex');
  }
}

module.exports = {
  VerificationHooks,
  VERIFICATION_STATUS,
  VERIFICATION_TYPES
}; 