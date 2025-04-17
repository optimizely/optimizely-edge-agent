# Optimizely Edge Agent: Critical Testing Project

## Purpose

This project is a comprehensive testing and analysis initiative aimed at ensuring complete feature parity and reliability between the original JavaScript implementation and the new TypeScript implementation of the Optimizely Edge Agent.

## Goals

1. Verify complete feature parity between original (src/) and new (src-v2/) implementations
2. Identify and document any missing functionality or technical debt
3. Establish comprehensive testing against live infrastructure using Wrangler Dev
4. Create reliable, repeatable test scripts for ongoing validation
5. Provide clear evidence and documentation of test results

## Project Structure

```
critical-testing-project/
├── README.md                      # This file
├── critical-testing-analysis.md   # Ongoing analysis document
├── docs/                          # Documentation
│   ├── architecture/              # Architecture documentation
│   ├── api/                       # API documentation
│   └── test-criteria/             # Test verification criteria
├── test-plan/                     # Test planning documents
│   ├── feature-parity-matrix.md   # Feature comparison matrix
│   └── test-coverage-map.md       # Test coverage analysis
├── scripts/                       # Test scripts
│   ├── infrastructure/            # Test infrastructure scripts
│   ├── edge-mode/                 # Edge mode test scripts (GET requests)
│   └── agent-mode/                # Agent mode test scripts (POST requests)
├── results/                       # Test results and evidence
│   └── reports/                   # Generated test reports
└── utils/                         # Utility scripts for testing
```

## Getting Started

1. Review the `critical-testing-analysis.md` for the current status and findings
2. Check the `test-plan/` directory for the comprehensive test approach
3. Use scripts in the `scripts/` directory to execute tests

## Testing Approach

This project uses a methodical, step-by-step approach to testing:

1. Each feature is tested individually against live infrastructure
2. Tests verify behavior against both the original and new implementations
3. All tests run against a Wrangler Dev environment for real-time logging
4. Test results are documented with clear evidence of behavior

## Execution

Instructions for executing the tests will be provided in the test-plan directory.

## Contributions

All analysis and test results should be documented in the appropriate files in this repository to maintain a single source of truth. 