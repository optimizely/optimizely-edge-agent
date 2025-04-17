/**
 * @fileoverview Manifest Generator System - Main Export
 * 
 * This module exports all manifest-related components for easier importing.
 * 
 * Created as part of the Testing Audit Reconciliation project (testing-audit-reconciliation-04-10-2025)
 */

const { ManifestGenerator, MANIFEST_STATUS } = require('./manifest-generator');

module.exports = {
  // Core manifest generator
  ManifestGenerator,
  MANIFEST_STATUS,
  
  // Example/test implementation
  runSampleTestAndGenerateManifest: require('./test-manifest-generator').runSampleTestAndGenerateManifest,
  runVerifiedTestAndGenerateManifest: require('./test-manifest-generator').runVerifiedTestAndGenerateManifest,
  generateConsolidatedReport: require('./test-manifest-generator').generateConsolidatedReport
}; 