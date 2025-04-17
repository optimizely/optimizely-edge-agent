/**
 * @fileoverview Structured Test Logging Framework
 * 
 * This module provides a structured logging framework for the Edge Agent testing infrastructure.
 * It implements the schema defined in log-schema.md and provides utilities for generating,
 * storing, and verifying log entries with cryptographic integrity.
 * 
 * Created as part of the Testing Audit Reconciliation project (testing-audit-reconciliation-04-10-2025)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

/**
 * Default configuration for the logger
 */
const DEFAULT_CONFIG = {
  basePath: path.join(process.cwd(), 'ai-workflow-workspace', 'testing-audit', 'infrastructure', 'logging'),
  logLevel: 'INFO',
  enableConsoleOutput: true,
  createDirectories: true,
  verifyIntegrity: true
};

/**
 * Event levels ranked by severity
 */
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARNING: 2,
  ERROR: 3,
  CRITICAL: 4
};

/**
 * Valid event types as defined in the schema
 */
const EVENT_TYPES = [
  'TEST_START',
  'TEST_END',
  'TEST_STEP',
  'ASSERTION',
  'HTTP_REQUEST',
  'HTTP_RESPONSE',
  'SDK_OPERATION',
  'ENVIRONMENT',
  'ERROR',
  'WARNING',
  'INFO',
  'DEBUG'
];

/**
 * Class to manage a test logging session
 */
class TestLogger {
  /**
   * Create a new TestLogger
   * @param {string} testId - The identifier for the test being executed
   * @param {object} config - Configuration options
   */
  constructor(testId, config = {}) {
    this.testId = testId;
    this.runId = uuidv4();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initialized = false;
    this.logFilePath = null;
    this.previousEventHash = null;
    this.eventCount = 0;
    this.startTime = null;
    this.logFileStream = null;
    this.manifestData = {
      runId: this.runId,
      testId: this.testId,
      startTime: null,
      endTime: null,
      firstEventHash: null,
      lastEventHash: null,
      eventCount: 0,
      logFilePath: null
    };
  }

  /**
   * Initialize the logger
   */
  async initialize() {
    if (this.initialized) return;
    
    this.startTime = new Date();
    this.manifestData.startTime = this.startTime.toISOString();
    
    // Create storage directory structure
    const dateStr = this.startTime.toISOString().split('T')[0];
    const storagePath = path.join(this.config.basePath, 'storage', dateStr);
    const manifestPath = path.join(this.config.basePath, 'manifest');
    
    if (this.config.createDirectories) {
      await this._ensureDirectoryExists(storagePath);
      await this._ensureDirectoryExists(manifestPath);
    }
    
    // Create log file
    this.logFilePath = path.join(storagePath, `${this.testId}-${this.runId}.log`);
    this.manifestData.logFilePath = this.logFilePath;
    
    // Open log file stream
    this.logFileStream = fs.createWriteStream(this.logFilePath, { flags: 'a' });
    
    // Log start event
    this.log('TEST_START', 'INFO', `Starting test execution: ${this.testId}`, {
      component: 'test-logger'
    });
    
    this.initialized = true;
  }

  /**
   * Log an event
   * @param {string} eventType - Type of event
   * @param {string} level - Severity level
   * @param {string} message - Event message
   * @param {object} metadata - Additional event metadata
   * @returns {object} The created log event
   */
  log(eventType, level, message, metadata = {}) {
    if (!this.initialized) {
      // Auto-initialize if needed
      if (!this.initializing) {
        this.initializing = true;
        this.initialize().then(() => {
          this.initializing = false;
        });
      }
      console.warn('Logger not yet initialized, queueing log event');
      return null;
    }

    // Validate inputs
    if (!EVENT_TYPES.includes(eventType)) {
      throw new Error(`Invalid event type: ${eventType}`);
    }
    
    if (!Object.keys(LOG_LEVELS).includes(level)) {
      throw new Error(`Invalid log level: ${level}`);
    }
    
    // Skip if below configured log level
    if (LOG_LEVELS[level] < LOG_LEVELS[this.config.logLevel]) {
      return null;
    }

    const timestamp = new Date().toISOString();
    
    // Create the log event (without integrity data)
    const logEvent = {
      eventId: uuidv4(),
      timestamp,
      testId: this.testId,
      runId: this.runId,
      eventType,
      level,
      message,
      metadata: { ...metadata }
    };
    
    // Calculate current event hash
    const eventForHashing = JSON.stringify(logEvent);
    const currentHash = crypto.createHash('sha256').update(eventForHashing).digest('hex');
    
    // Add integrity data
    logEvent.integrityData = {
      previousEventHash: this.previousEventHash || '0'.repeat(64), // Initial event has all zeros
      currentHash,
      signatureTimestamp: new Date().toISOString()
    };
    
    // Update state for next event
    this.previousEventHash = currentHash;
    this.eventCount++;
    
    // Update manifest data
    this.manifestData.eventCount = this.eventCount;
    if (this.eventCount === 1) {
      this.manifestData.firstEventHash = currentHash;
    }
    this.manifestData.lastEventHash = currentHash;
    
    // Write to file
    this._writeLogEvent(logEvent);
    
    // Console output if enabled
    if (this.config.enableConsoleOutput) {
      this._consoleOutput(logEvent);
    }
    
    return logEvent;
  }

  /**
   * Log an assertion result
   * @param {string} component - Component being tested
   * @param {string} status - Result status (PASS/FAIL/SKIPPED)
   * @param {string} message - Assertion description
   * @param {any} expectedValue - Expected value
   * @param {any} actualValue - Actual value received
   * @returns {object} The created log event
   */
  assertion(component, status, message, expectedValue, actualValue) {
    const level = status === 'PASS' ? 'INFO' : 'ERROR';
    return this.log('ASSERTION', level, message, {
      component,
      status,
      expectedValue,
      actualValue
    });
  }

  /**
   * Log an HTTP request
   * @param {string} method - HTTP method
   * @param {string} url - Request URL
   * @param {object} headers - Request headers
   * @param {string} body - Request body (optional)
   * @returns {object} The created log event
   */
  httpRequest(method, url, headers, body = null) {
    const metadata = {
      component: 'http-client',
      httpMethod: method,
      httpUrl: url,
      httpHeaders: headers
    };
    
    if (body !== null) {
      // Store body as artifact if large
      if (typeof body === 'string' && body.length > 1000) {
        const artifactPath = this._storeArtifact('request', body);
        metadata.artifactRef = artifactPath;
      } else {
        metadata.body = body;
      }
    }
    
    return this.log('HTTP_REQUEST', 'INFO', `HTTP ${method} ${url}`, metadata);
  }

  /**
   * Log an HTTP response
   * @param {number} statusCode - HTTP status code
   * @param {object} headers - Response headers
   * @param {string|object} body - Response body (optional)
   * @param {number} duration - Request duration in ms (optional)
   * @returns {object} The created log event
   */
  httpResponse(statusCode, headers, body = null, duration = null) {
    const level = statusCode < 400 ? 'INFO' : 'ERROR';
    
    const metadata = {
      component: 'http-client',
      httpStatusCode: statusCode,
      httpHeaders: headers
    };
    
    if (duration !== null) {
      metadata.duration = duration;
    }
    
    // Extract Cloudflare-specific headers if present
    if (headers && headers['cf-ray']) {
      metadata.cfRay = headers['cf-ray'];
    }
    
    if (body !== null) {
      // Store body as artifact if large
      if ((typeof body === 'string' && body.length > 1000) || 
          (typeof body === 'object' && JSON.stringify(body).length > 1000)) {
        const artifactPath = this._storeArtifact('response', 
          typeof body === 'string' ? body : JSON.stringify(body));
        metadata.artifactRef = artifactPath;
      } else {
        metadata.body = body;
      }
    }
    
    return this.log('HTTP_RESPONSE', level, `HTTP Response: ${statusCode}`, metadata);
  }

  /**
   * Log a test step
   * @param {string} component - Component being tested
   * @param {string} status - Result status (PASS/FAIL/SKIPPED/PENDING)
   * @param {string} message - Step description
   * @returns {object} The created log event
   */
  step(component, status, message) {
    const level = status === 'FAIL' ? 'ERROR' : 'INFO';
    return this.log('TEST_STEP', level, message, {
      component,
      status
    });
  }

  /**
   * Log an error
   * @param {string} message - Error message
   * @param {Error} error - Error object (optional)
   * @returns {object} The created log event
   */
  error(message, error = null) {
    const metadata = {
      component: 'test-execution'
    };
    
    if (error && error.stack) {
      metadata.stackTrace = error.stack;
    }
    
    return this.log('ERROR', 'ERROR', message, metadata);
  }

  /**
   * Finalize the log session and close resources
   * @param {string} status - Final test status (PASS/FAIL/ERROR)
   * @param {string} message - Completion message
   */
  async finalize(status = 'COMPLETE', message = 'Test execution completed') {
    if (!this.initialized) return;
    
    // Log end event
    const endTime = new Date();
    const duration = endTime - this.startTime;
    
    this.log('TEST_END', 'INFO', message, {
      component: 'test-logger',
      status,
      duration
    });
    
    // Update manifest
    this.manifestData.endTime = endTime.toISOString();
    
    // Write manifest file
    await this._writeManifest();
    
    // Close file stream
    if (this.logFileStream) {
      this.logFileStream.end();
      this.logFileStream = null;
    }
    
    this.initialized = false;
  }

  /**
   * Verify the integrity of a log file
   * @param {string} logFilePath - Path to the log file
   * @returns {object} Verification result
   */
  static async verifyLogIntegrity(logFilePath) {
    const result = {
      verified: false,
      errors: [],
      eventCount: 0,
      firstEventHash: null,
      lastEventHash: null
    };
    
    try {
      // Read log file line by line
      const fileContent = await fs.promises.readFile(logFilePath, 'utf8');
      const lines = fileContent.split('\n').filter(line => line.trim());
      
      let previousHash = '0'.repeat(64); // Initial hash for first event
      
      for (let i = 0; i < lines.length; i++) {
        try {
          const event = JSON.parse(lines[i]);
          result.eventCount++;
          
          if (i === 0) {
            result.firstEventHash = event.integrityData.currentHash;
          }
          
          if (i === lines.length - 1) {
            result.lastEventHash = event.integrityData.currentHash;
          }
          
          // Verify previous hash reference
          if (event.integrityData.previousEventHash !== previousHash) {
            result.errors.push(`Chain broken at event ${i+1} (${event.eventId}): expected previous hash ${previousHash}, got ${event.integrityData.previousEventHash}`);
          }
          
          // Verify current hash
          const eventForHashing = { ...event };
          delete eventForHashing.integrityData;
          const calculatedHash = crypto.createHash('sha256')
            .update(JSON.stringify(eventForHashing))
            .digest('hex');
          
          if (calculatedHash !== event.integrityData.currentHash) {
            result.errors.push(`Hash mismatch at event ${i+1} (${event.eventId}): calculated ${calculatedHash}, recorded ${event.integrityData.currentHash}`);
          }
          
          // Update for next iteration
          previousHash = event.integrityData.currentHash;
          
        } catch (err) {
          result.errors.push(`Error parsing line ${i+1}: ${err.message}`);
        }
      }
      
      result.verified = result.errors.length === 0;
      
    } catch (err) {
      result.errors.push(`Failed to read log file: ${err.message}`);
    }
    
    return result;
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
   * Write a log event to the file
   * @private
   * @param {object} event - Log event to write
   */
  _writeLogEvent(event) {
    if (!this.logFileStream) {
      console.error('Log file stream not initialized');
      return;
    }
    
    try {
      this.logFileStream.write(JSON.stringify(event) + '\n');
    } catch (err) {
      console.error('Error writing to log file:', err);
    }
  }

  /**
   * Store an artifact and return reference path
   * @private
   * @param {string} type - Artifact type
   * @param {string} content - Artifact content
   * @returns {string} Path to the stored artifact
   */
  _storeArtifact(type, content) {
    try {
      const artifactId = uuidv4();
      const dateStr = new Date().toISOString().split('T')[0];
      const artifactDir = path.join(
        this.config.basePath, 
        'storage', 
        dateStr, 
        'artifacts', 
        this.runId
      );
      
      if (!fs.existsSync(artifactDir)) {
        fs.mkdirSync(artifactDir, { recursive: true });
      }
      
      const artifactPath = path.join(artifactDir, `${type}-${artifactId}.dat`);
      fs.writeFileSync(artifactPath, content);
      
      return artifactPath;
    } catch (err) {
      console.error('Error storing artifact:', err);
      return null;
    }
  }

  /**
   * Output a log event to the console
   * @private
   * @param {object} event - Log event to output
   */
  _consoleOutput(event) {
    const timestamp = new Date(event.timestamp).toISOString();
    let prefix = '';
    
    switch (event.level) {
      case 'DEBUG':
        prefix = '\x1b[34mDEBUG\x1b[0m'; // Blue
        break;
      case 'INFO':
        prefix = '\x1b[32mINFO\x1b[0m';  // Green
        break;
      case 'WARNING':
        prefix = '\x1b[33mWARN\x1b[0m';  // Yellow
        break;
      case 'ERROR':
        prefix = '\x1b[31mERROR\x1b[0m'; // Red
        break;
      case 'CRITICAL':
        prefix = '\x1b[41m\x1b[37mCRIT\x1b[0m'; // White on red
        break;
    }
    
    console.log(`[${timestamp}] ${prefix} [${event.eventType}] ${event.message}`);
  }

  /**
   * Write the manifest file
   * @private
   */
  async _writeManifest() {
    try {
      const dateStr = this.startTime.toISOString().split('T')[0];
      const manifestFilePath = path.join(
        this.config.basePath,
        'manifest',
        `${dateStr}-manifest.json`
      );
      
      // Check if manifest file exists and read it
      let manifestFile = [];
      
      if (fs.existsSync(manifestFilePath)) {
        const content = await fs.promises.readFile(manifestFilePath, 'utf8');
        try {
          manifestFile = JSON.parse(content);
        } catch (err) {
          console.error('Error parsing existing manifest:', err);
          manifestFile = [];
        }
      }
      
      // Add or update this run's entry
      const existingIndex = manifestFile.findIndex(entry => entry.runId === this.runId);
      
      if (existingIndex >= 0) {
        manifestFile[existingIndex] = this.manifestData;
      } else {
        manifestFile.push(this.manifestData);
      }
      
      // Calculate manifest integrity hash
      const manifestHash = crypto.createHash('sha256')
        .update(JSON.stringify(manifestFile))
        .digest('hex');
      
      // Write updated manifest with hash
      const manifestWithHash = {
        entries: manifestFile,
        integrityHash: manifestHash,
        lastUpdated: new Date().toISOString()
      };
      
      await fs.promises.writeFile(
        manifestFilePath,
        JSON.stringify(manifestWithHash, null, 2)
      );
      
    } catch (err) {
      console.error('Error writing manifest:', err);
    }
  }
}

module.exports = {
  TestLogger,
  LOG_LEVELS,
  EVENT_TYPES
}; 