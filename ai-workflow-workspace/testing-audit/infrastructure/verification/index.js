/**
 * @fileoverview Verification Hooks System - Main Export
 * 
 * This module exports all verification-related components for easier importing.
 * 
 * Created as part of the Testing Audit Reconciliation project (testing-audit-reconciliation-04-10-2025)
 */

const { VerificationHooks, VERIFICATION_STATUS, VERIFICATION_TYPES } = require('./verification-hooks');
const { VerifiedTestRunner } = require('./verified-test-runner');

module.exports = {
  // Core verification hooks
  VerificationHooks,
  VERIFICATION_STATUS,
  VERIFICATION_TYPES,
  
  // Integrated test runner with verification
  VerifiedTestRunner,
  
  // Example/test implementation
  runTestWithVerification: require('./test-verification-hooks').runTestWithVerification
}; 