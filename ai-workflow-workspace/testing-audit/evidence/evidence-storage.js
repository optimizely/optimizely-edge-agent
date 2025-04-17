/**
 * @fileoverview Evidence Storage Utility
 * 
 * This module provides utilities for storing, retrieving, and verifying test evidence
 * according to the schema defined in evidence-schema.md. It handles integrity verification
 * and maintains the evidence registry.
 * 
 * Created as part of the Testing Audit Reconciliation project (testing-audit-reconciliation-04-10-2025)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

/**
 * Default configuration for the evidence storage
 */
const DEFAULT_CONFIG = {
  basePath: path.join(process.cwd(), 'ai-workflow-workspace', 'testing-audit', 'evidence'),
  verifyIntegrity: true,
  createDirectories: true
};

/**
 * Artifact types
 */
const ARTIFACT_TYPES = {
  NETWORK: 'NETWORK',
  SCREENSHOT: 'SCREENSHOT',
  LOG: 'LOG',
  ASSERTION: 'ASSERTION',
  DATA: 'DATA'
};

/**
 * Result types
 */
const RESULT_TYPES = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  ERROR: 'ERROR',
  SKIPPED: 'SKIPPED'
};

/**
 * Class to manage evidence storage for a test run
 */
class EvidenceStorage {
  /**
   * Create a new EvidenceStorage instance
   * @param {string} testId - The identifier for the test
   * @param {object} config - Configuration options
   */
  constructor(testId, config = {}) {
    this.testId = testId;
    this.runId = uuidv4();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initialized = false;
    this.startTime = null;
    this.artifacts = [];
    this.environment = {};
    this.summary = {
      assertions: { total: 0, passed: 0, failed: 0, skipped: 0 },
      steps: { total: 0, passed: 0, failed: 0, skipped: 0 },
      duration: 0,
      errors: 0,
      warnings: 0,
      cloudflareEvidence: false
    };
    this.metadataFilePath = null;
  }

  /**
   * Initialize the evidence storage
   * @param {object} environment - Environment information (optional)
   */
  async initialize(environment = {}) {
    if (this.initialized) return;
    
    this.startTime = new Date();
    this.environment = {
      nodeVersion: process.version,
      platform: process.platform,
      ...environment
    };
    
    // Create directory structure
    const dateStr = this.startTime.toISOString().split('T')[0];
    const paths = {
      metadata: path.join(this.config.basePath, 'metadata', dateStr),
      artifacts: path.join(this.config.basePath, 'artifacts', dateStr, this.testId, this.runId),
      screenshots: path.join(this.config.basePath, 'screenshots', dateStr, this.testId, this.runId),
      network: path.join(this.config.basePath, 'network', dateStr, this.testId, this.runId),
      registry: path.join(this.config.basePath, 'registry')
    };
    
    if (this.config.createDirectories) {
      for (const dir of Object.values(paths)) {
        await this._ensureDirectoryExists(dir);
      }
    }
    
    // Create metadata file path
    this.metadataFilePath = path.join(
      paths.metadata,
      `${this.testId}-${this.runId}-metadata.json`
    );
    
    // Save paths for later use
    this.paths = paths;
    
    // Save initial metadata
    await this._saveMetadata();
    
    this.initialized = true;
    
    return {
      testId: this.testId,
      runId: this.runId,
      startTime: this.startTime.toISOString(),
      paths: this.paths
    };
  }

  /**
   * Store a network artifact (HTTP request/response)
   * @param {object} data - Network data
   * @param {string} description - Description of the network artifact
   * @returns {object} The stored artifact
   */
  async storeNetworkArtifact(data, description) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const timestamp = new Date();
    const formattedTime = timestamp.toISOString()
      .replace(/:/g, '-')
      .replace(/\..+/g, '');
    
    const requestId = uuidv4().split('-')[0];
    const fileName = `${formattedTime}-request-${requestId}.har`;
    const filePath = path.join(this.paths.network, fileName);
    
    // Prepare artifact data
    const artifactData = {
      testId: this.testId,
      runId: this.runId,
      requestId,
      timestamp: timestamp.toISOString(),
      url: data.url || '',
      method: data.method || 'GET',
      statusCode: data.statusCode || 0,
      cloudflare: {
        cfRay: data.cfRay || null,
        cacheStatus: data.cacheStatus || null
      },
      harContent: data.harContent || data
    };
    
    // Check for Cloudflare evidence
    if (data.cfRay || (data.headers && data.headers['cf-ray'])) {
      this.summary.cloudflareEvidence = true;
    }
    
    // Calculate hash
    const contentStr = JSON.stringify(artifactData);
    const hash = crypto.createHash('sha256').update(contentStr).digest('hex');
    
    // Store file
    await fs.promises.writeFile(filePath, contentStr);
    
    // Create artifact entry
    const artifact = {
      id: uuidv4(),
      type: ARTIFACT_TYPES.NETWORK,
      path: path.relative(this.config.basePath, filePath),
      description: description || `HTTP ${data.method || 'GET'} ${data.url || ''}`,
      timestamp: timestamp.toISOString(),
      hash,
      metadata: {
        url: data.url || '',
        method: data.method || 'GET',
        statusCode: data.statusCode || 0,
        cfRay: data.cfRay || (data.headers && data.headers['cf-ray']) || null
      }
    };
    
    // Add to artifacts list
    this.artifacts.push(artifact);
    
    // Update metadata
    await this._saveMetadata();
    
    return artifact;
  }

  /**
   * Store a screenshot artifact
   * @param {Buffer|string} imageData - The screenshot data (Buffer or base64 string)
   * @param {string} description - Description of the screenshot
   * @param {string} context - Context information (what was being tested)
   * @returns {object} The stored artifact
   */
  async storeScreenshotArtifact(imageData, description, context = '') {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const timestamp = new Date();
    const formattedTime = timestamp.toISOString()
      .replace(/:/g, '-')
      .replace(/\..+/g, '');
    
    const safeDesc = (description || 'screenshot')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    
    const fileName = `${formattedTime}-${safeDesc}.png`;
    const filePath = path.join(this.paths.screenshots, fileName);
    
    // Convert to buffer if needed
    let buffer = imageData;
    if (typeof imageData === 'string') {
      // Check if it's a base64 string
      if (imageData.startsWith('data:image/png;base64,')) {
        buffer = Buffer.from(imageData.split(',')[1], 'base64');
      } else if (imageData.match(/^[A-Za-z0-9+/=]+$/)) {
        buffer = Buffer.from(imageData, 'base64');
      } else {
        // Assume it's file path
        buffer = await fs.promises.readFile(imageData);
      }
    }
    
    // Calculate hash
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    
    // Store file
    await fs.promises.writeFile(filePath, buffer);
    
    // Create artifact entry
    const artifact = {
      id: uuidv4(),
      type: ARTIFACT_TYPES.SCREENSHOT,
      path: path.relative(this.config.basePath, filePath),
      description: description || 'Screenshot',
      timestamp: timestamp.toISOString(),
      hash,
      metadata: {
        context,
        size: buffer.length
      }
    };
    
    // Add to artifacts list
    this.artifacts.push(artifact);
    
    // Update metadata
    await this._saveMetadata();
    
    return artifact;
  }

  /**
   * Store a data artifact
   * @param {object|string} data - The data to store
   * @param {string} description - Description of the data
   * @param {string} contentType - Content type of the data
   * @returns {object} The stored artifact
   */
  async storeDataArtifact(data, description, contentType = 'application/json') {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const timestamp = new Date();
    const formattedTime = timestamp.toISOString()
      .replace(/:/g, '-')
      .replace(/\..+/g, '');
    
    const safeDesc = (description || 'data')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    
    const fileName = `${formattedTime}-${safeDesc}.json`;
    const filePath = path.join(this.paths.artifacts, fileName);
    
    // Prepare artifact data
    const artifactData = {
      testId: this.testId,
      runId: this.runId,
      artifactId: uuidv4().split('-')[0],
      timestamp: timestamp.toISOString(),
      description,
      contentType,
      data
    };
    
    // Calculate hash
    const contentStr = JSON.stringify(artifactData);
    const hash = crypto.createHash('sha256').update(contentStr).digest('hex');
    
    // Store file
    await fs.promises.writeFile(filePath, contentStr);
    
    // Create artifact entry
    const artifact = {
      id: artifactData.artifactId,
      type: ARTIFACT_TYPES.DATA,
      path: path.relative(this.config.basePath, filePath),
      description: description || 'Data Artifact',
      timestamp: timestamp.toISOString(),
      hash,
      metadata: {
        contentType
      }
    };
    
    // Add to artifacts list
    this.artifacts.push(artifact);
    
    // Update metadata
    await this._saveMetadata();
    
    return artifact;
  }

  /**
   * Store an assertion artifact
   * @param {object} assertion - The assertion data
   * @returns {object} The stored artifact
   */
  async storeAssertionArtifact(assertion) {
    // Update summary data
    this.summary.assertions.total++;
    if (assertion.status === 'PASS') {
      this.summary.assertions.passed++;
    } else if (assertion.status === 'FAIL') {
      this.summary.assertions.failed++;
    } else if (assertion.status === 'SKIPPED') {
      this.summary.assertions.skipped++;
    }
    
    // Store as data artifact
    return await this.storeDataArtifact(
      assertion,
      assertion.message || 'Assertion',
      'application/json'
    );
  }

  /**
   * Update the test summary
   * @param {object} summary - Summary data to update
   */
  async updateSummary(summary) {
    this.summary = {
      ...this.summary,
      ...summary
    };
    
    // Update metadata
    await this._saveMetadata();
  }

  /**
   * Finalize the evidence collection
   * @param {string} result - Overall test result (PASS/FAIL/ERROR/SKIPPED)
   * @param {number} duration - Test duration in milliseconds (optional)
   */
  async finalize(result, duration = null) {
    if (!this.initialized) {
      return;
    }
    
    const endTime = new Date();
    
    // Calculate duration if not provided
    if (duration === null && this.startTime) {
      duration = endTime - this.startTime;
    }
    
    // Update summary
    this.summary.duration = duration || 0;
    
    // Create final metadata
    const metadata = {
      testId: this.testId,
      runId: this.runId,
      startTime: this.startTime.toISOString(),
      endTime: endTime.toISOString(),
      result,
      environment: this.environment,
      summary: this.summary,
      artifacts: this.artifacts
    };
    
    // Calculate integrity hash
    const artifactHashes = this.artifacts.map(a => a.hash).join('');
    const evidenceHash = crypto.createHash('sha256').update(artifactHashes).digest('hex');
    
    metadata.integrityData = {
      evidenceHash,
      signatureTimestamp: endTime.toISOString()
    };
    
    // Save final metadata
    await fs.promises.writeFile(
      this.metadataFilePath,
      JSON.stringify(metadata, null, 2)
    );
    
    // Update registry
    await this._updateRegistry(result, endTime);
    
    // Return final metadata
    return {
      testId: this.testId,
      runId: this.runId,
      result,
      startTime: this.startTime.toISOString(),
      endTime: endTime.toISOString(),
      duration,
      artifactCount: this.artifacts.length,
      metadataPath: this.metadataFilePath
    };
  }

  /**
   * Verify the integrity of stored evidence
   * @param {string} metadataPath - Path to metadata file (optional)
   * @returns {object} Verification result
   */
  static async verifyEvidence(metadataPath) {
    const result = {
      verified: false,
      errors: [],
      metadata: null,
      artifactsVerified: 0,
      artifactsTotal: 0
    };
    
    try {
      // Read metadata file
      const metadataContent = await fs.promises.readFile(metadataPath, 'utf8');
      const metadata = JSON.parse(metadataContent);
      result.metadata = metadata;
      
      // Get artifacts
      const artifacts = metadata.artifacts || [];
      result.artifactsTotal = artifacts.length;
      
      // Verify each artifact
      const basePath = path.join(process.cwd(), 'ai-workflow-workspace', 'testing-audit', 'evidence');
      let artifactHashes = '';
      
      for (const artifact of artifacts) {
        try {
          const artifactPath = path.join(basePath, artifact.path);
          
          // Read artifact file
          const artifactContent = await fs.promises.readFile(artifactPath);
          
          // Calculate hash
          const calculatedHash = crypto.createHash('sha256')
            .update(artifactContent)
            .digest('hex');
          
          // Verify hash
          if (calculatedHash !== artifact.hash) {
            result.errors.push(`Hash mismatch for artifact ${artifact.id}: calculated ${calculatedHash}, expected ${artifact.hash}`);
          } else {
            result.artifactsVerified++;
            artifactHashes += artifact.hash;
          }
        } catch (err) {
          result.errors.push(`Error verifying artifact ${artifact.id}: ${err.message}`);
        }
      }
      
      // Verify evidence hash
      const calculatedEvidenceHash = crypto.createHash('sha256')
        .update(artifactHashes)
        .digest('hex');
      
      if (calculatedEvidenceHash !== metadata.integrityData.evidenceHash) {
        result.errors.push(`Evidence hash mismatch: calculated ${calculatedEvidenceHash}, expected ${metadata.integrityData.evidenceHash}`);
      }
      
      // Set verification result
      result.verified = result.errors.length === 0;
      
    } catch (err) {
      result.errors.push(`Error verifying evidence: ${err.message}`);
    }
    
    return result;
  }

  /**
   * Find evidence by test ID
   * @param {string} testId - Test ID to search for
   * @param {object} options - Search options
   * @returns {array} Matching evidence entries
   */
  static async findEvidenceByTestId(testId, options = {}) {
    const results = [];
    const basePath = path.join(process.cwd(), 'ai-workflow-workspace', 'testing-audit', 'evidence');
    const registryPath = path.join(basePath, 'registry');
    
    try {
      // Get registry files
      const registryFiles = await fs.promises.readdir(registryPath);
      
      // Sort by date (newest first)
      registryFiles.sort().reverse();
      
      // Process each registry file
      for (const fileName of registryFiles) {
        if (!fileName.endsWith('-registry.json')) continue;
        
        try {
          const registryContent = await fs.promises.readFile(
            path.join(registryPath, fileName),
            'utf8'
          );
          
          const registry = JSON.parse(registryContent);
          const entries = registry.entries || [];
          
          // Find matching entries
          const matchingEntries = entries.filter(entry => entry.testId === testId);
          
          // Add to results
          results.push(...matchingEntries);
          
          // Limit results if needed
          if (options.limit && results.length >= options.limit) {
            break;
          }
        } catch (err) {
          console.error(`Error processing registry file ${fileName}:`, err);
        }
      }
      
    } catch (err) {
      console.error('Error finding evidence:', err);
    }
    
    return results;
  }

  /**
   * Get summary of evidence by date
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {object} Evidence summary
   */
  static async getEvidenceSummaryByDate(date) {
    const basePath = path.join(process.cwd(), 'ai-workflow-workspace', 'testing-audit', 'evidence');
    const registryPath = path.join(basePath, 'registry', `${date}-registry.json`);
    
    try {
      // Read registry file
      const registryContent = await fs.promises.readFile(registryPath, 'utf8');
      return JSON.parse(registryContent);
    } catch (err) {
      console.error(`Error getting evidence summary for ${date}:`, err);
      return null;
    }
  }

  /**
   * Ensure a directory exists
   * @private
   * @param {string} dirPath - Directory path
   */
  async _ensureDirectoryExists(dirPath) {
    try {
      await fs.promises.mkdir(dirPath, { recursive: true });
    } catch (err) {
      console.error(`Error creating directory ${dirPath}:`, err);
      throw err;
    }
  }

  /**
   * Save metadata
   * @private
   */
  async _saveMetadata() {
    try {
      // Create metadata
      const metadata = {
        testId: this.testId,
        runId: this.runId,
        startTime: this.startTime.toISOString(),
        endTime: null,
        result: null,
        environment: this.environment,
        summary: this.summary,
        artifacts: this.artifacts,
        integrityData: {
          evidenceHash: null,
          signatureTimestamp: new Date().toISOString()
        }
      };
      
      // Save metadata
      await fs.promises.writeFile(
        this.metadataFilePath,
        JSON.stringify(metadata, null, 2)
      );
      
    } catch (err) {
      console.error('Error saving metadata:', err);
    }
  }

  /**
   * Update the registry
   * @private
   * @param {string} result - Test result
   * @param {Date} endTime - End time
   */
  async _updateRegistry(result, endTime) {
    try {
      const dateStr = this.startTime.toISOString().split('T')[0];
      const registryPath = path.join(this.config.basePath, 'registry', `${dateStr}-registry.json`);
      
      // Create registry entry
      const entry = {
        testId: this.testId,
        runId: this.runId,
        startTime: this.startTime.toISOString(),
        endTime: endTime.toISOString(),
        result,
        metadataPath: path.relative(this.config.basePath, this.metadataFilePath),
        artifactCount: this.artifacts.length
      };
      
      // Read existing registry or create new one
      let registry = {
        date: dateStr,
        entries: [],
        summary: {
          totalRuns: 0,
          passed: 0,
          failed: 0,
          errors: 0,
          skipped: 0,
          totalArtifacts: 0
        },
        integrityHash: null
      };
      
      if (fs.existsSync(registryPath)) {
        try {
          const registryContent = await fs.promises.readFile(registryPath, 'utf8');
          registry = JSON.parse(registryContent);
        } catch (err) {
          console.error('Error reading registry:', err);
        }
      }
      
      // Add entry or update existing one
      const existingIndex = registry.entries.findIndex(e => e.runId === this.runId);
      
      if (existingIndex >= 0) {
        registry.entries[existingIndex] = entry;
      } else {
        registry.entries.push(entry);
      }
      
      // Update summary
      registry.summary.totalRuns = registry.entries.length;
      registry.summary.passed = registry.entries.filter(e => e.result === RESULT_TYPES.PASS).length;
      registry.summary.failed = registry.entries.filter(e => e.result === RESULT_TYPES.FAIL).length;
      registry.summary.errors = registry.entries.filter(e => e.result === RESULT_TYPES.ERROR).length;
      registry.summary.skipped = registry.entries.filter(e => e.result === RESULT_TYPES.SKIPPED).length;
      registry.summary.totalArtifacts = registry.entries.reduce((sum, e) => sum + e.artifactCount, 0);
      
      // Calculate integrity hash
      const entriesStr = JSON.stringify(registry.entries);
      registry.integrityHash = crypto.createHash('sha256').update(entriesStr).digest('hex');
      
      // Save registry
      await fs.promises.writeFile(
        registryPath,
        JSON.stringify(registry, null, 2)
      );
      
    } catch (err) {
      console.error('Error updating registry:', err);
    }
  }
}

module.exports = {
  EvidenceStorage,
  ARTIFACT_TYPES,
  RESULT_TYPES
}; 