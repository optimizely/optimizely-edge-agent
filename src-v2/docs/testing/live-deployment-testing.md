# Live Deployment Testing Guide

## Overview

This guide explains how to run the Optimizely Edge Agent integration tests against a live Cloudflare Workers deployment. While most development and CI/CD testing uses mock environments, testing against a real deployment is critical for final verification of the implementation's functionality.

## Prerequisites

Before running tests against a live deployment, ensure you have:

1. A deployed Cloudflare Workers instance of the Optimizely Edge Agent
2. Access to a valid Optimizely SDK key
3. Feature flags and experiments configured in your Optimizely project
4. Node.js and npm installed on your local machine

## Setting Up the Test Environment

The tests require specific environment variables to connect to your deployment and project:

| Variable | Description | Example |
|----------|-------------|---------|
| `EDGE_AGENT_URL` | URL of your Cloudflare Workers deployment | `https://optimizely-edge-agent.my-account.workers.dev` |
| `SDK_KEY` | Valid Optimizely SDK key with access to your project | `FVxxxxxxxxxxxxxxxxxxxxxP` |
| `FEATURE_KEYS` | Comma-separated list of feature flag keys to test | `my_flag,homepage_flag,pricing_test` |
| `EXPERIMENT_KEYS` | Comma-separated list of experiment keys to test | `ab_test_1,checkout_experiment` |

### Feature Flags and Experiments Setup

For comprehensive testing, ensure your Optimizely project includes:

1. **Feature Flags**: At least 2-3 feature flags with different configurations
    - Flags with simple boolean variations
    - Flags with variables (string, number, JSON, etc.)
    - Flags with audience targeting rules

2. **Experiments**: At least 1-2 experiments
    - With multiple variations
    - With metrics configured
    - With audience targeting (optional)

## Running the Tests

### Running All Tests

```bash
# Set environment variables
export EDGE_AGENT_URL=https://your-worker.workers.dev
export SDK_KEY=your-sdk-key
export FEATURE_KEYS=flag1,flag2,flag3
export EXPERIMENT_KEYS=exp1,exp2

# Run tests
npm run test:integration
```

### Running Specific Tests

You can choose to run only Edge Mode or Agent Mode tests:

```bash
# Edge Mode tests only
npm run test:integration -- --edge-only

# Agent Mode tests only
npm run test:integration -- --agent-only
```

## Test Categories

The tests verify different aspects of the Edge Agent functionality:

### Agent Mode Tests (POST Requests)

- **Feature Flag Decisions**: Test basic flag decisions
- **Experiment Decisions**: Test experiment variation assignments
- **Batch Decisions**: Test retrieving decisions for multiple flags
- **Decision Options**: Test includeReasons, excludeVariables, etc.
- **Forced Variations**: Test setting and getting forced variations
- **Audience Targeting**: Test attribute-based targeting
- **Event Tracking**: Test conversion event tracking
- **Request Configuration**: Test configuration from headers, URL, and body
- **Error Handling**: Test graceful error responses

### Edge Mode Tests (GET Requests)

- **URL Matching**: Test matching against cdnExperimentURL patterns
- **Variation Serving**: Test serving different content variations
- **Caching**: Test caching behavior based on cacheKey and cacheTTL
- **Visitor Identification**: Test visitor bucketing and persistence
- **Response Headers**: Test response headers and cookies
- **Forwarding**: Test forwarding requests to origin

## Troubleshooting

### Common Issues

1. **Authentication Errors**:
   - Verify your SDK key is valid and active
   - Check SDK key permissions (read/write access to flags)

2. **Missing Flags/Experiments**:
   - Ensure FEATURE_KEYS and EXPERIMENT_KEYS match actual keys in your project

3. **Network Issues**:
   - Verify your EDGE_AGENT_URL is accessible
   - Check network firewall settings

4. **Test Failures**:
   - Review test output for specific error messages
   - Verify your Edge Agent implementation matches feature parity requirements

### Debug Mode

For more detailed logging during tests:

```bash
# Enable debug logging
export DEBUG=optimizely:*
npm run test:integration
```

## Continuous Integration

For CI/CD pipelines, create a dedicated test environment with:

1. A dedicated Cloudflare Workers deployment
2. A dedicated Optimizely project with standard test flags
3. Automated environment variable configuration

## Best Practices

1. **Test Isolation**: Use unique visitor IDs for each test to avoid interference
2. **Test Coverage**: Ensure tests cover all critical functionality paths
3. **Regular Testing**: Run live tests before each production deployment
4. **Monitoring**: Monitor test results over time to detect regressions
5. **Environment Parity**: Make test environments match production configuration

## Next Steps

After verifying functionality with live tests:

1. Document any identified issues or limitations
2. Update the implementation based on test results
3. Create a final verification report comparing the implementation against requirements
4. Develop deployment documentation for production use 