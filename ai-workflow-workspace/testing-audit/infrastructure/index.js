/**
 * @fileoverview Testing Audit Infrastructure - Main Export
 * 
 * This module exports all infrastructure-related components from the testing audit
 * project, including logging, verification, and manifest generators.
 * 
 * Created as part of the Testing Audit Reconciliation project (testing-audit-reconciliation-04-10-2025)
 */

// Export logging components
const { TestLogger, LOG_LEVELS, EVENT_TYPES } = require('./logging/logger');
const { TestWrapper } = require('./logging/test-wrapper');

// Export verification components
const { VerificationHooks, VERIFICATION_STATUS, VERIFICATION_TYPES } = require('./verification/verification-hooks');
const { VerifiedTestRunner } = require('./verification/verified-test-runner');

// Export manifest components
const { ManifestGenerator, MANIFEST_STATUS } = require('./manifest/manifest-generator');

// Export integrated test runner
const { IntegratedTestRunner } = require('./integrated-test-runner');

module.exports = {
  // Test logging
  TestLogger,
  TestWrapper,
  LOG_LEVELS,
  EVENT_TYPES,
  
  // Verification
  VerificationHooks,
  VerifiedTestRunner,
  VERIFICATION_STATUS,
  VERIFICATION_TYPES,
  
  // Manifest generation
  ManifestGenerator,
  MANIFEST_STATUS,
  
  // Integrated test runner
  IntegratedTestRunner
}; 