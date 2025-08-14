/**
 * Vercel Edge Mode Validation Test
 * 
 * This test validates that the Vercel adapter correctly handles Edge Mode
 * after the compression headers fix applied on 2025-08-14.
 */

const TEST_CONFIG = {
  vercelUrl: 'https://optimizely-edge-agent-3zfhww5it-simones-projects-0a246ebe.vercel.app',
  sdkKey: '8mR1pGh8u2ztUP8GqjmQq',
  flagKey: 'edge_mode_final_test',
  githubPagesUrl: 'https://simone-coelho.github.io/optimizely-edge-mode-demo'
};

module.exports = {
  id: 'vercel.edge.github.validation',
  name: 'Vercel Edge Mode GitHub Pages Validation',
  description: 'Validates that Vercel Edge Functions correctly fetch content from GitHub Pages',
  adapter: 'vercel',
  category: 'edge-mode',
  
  async execute(context) {
    const { httpClient, validator, logger } = context;
    const results = [];
    
    // Test 1: Verify Edge Mode returns GitHub Pages content
    logger.info('Test 1: Edge Mode content fetching');
    const edgeResponse = await httpClient.request({
      method: 'GET',
      url: `${TEST_CONFIG.vercelUrl}/?override_visitor_id=true&enable_optimizely=true`,
      headers: {
        'X-Optimizely-Enable-FEX': 'true',
        'Accept': 'text/html'
      }
    });
    
    const edgeValidation = validator.validate(edgeResponse, {
      status: 200,
      requiredHeaders: ['content-type', 'x-github-request-id'],
      custom: (resp) => {
        const body = resp.body || '';
        // Check for actual HTML content
        if (!body.includes('<!DOCTYPE html>')) {
          return 'Response body does not contain HTML';
        }
        // Check for expected content from GitHub Pages
        if (!body.includes('Edge Mode Demo')) {
          return 'Response does not contain expected Edge Mode Demo content';
        }
        // Ensure body is not empty or minimal
        if (body.length < 1000) {
          return `Response body too short: ${body.length} bytes (expected > 1000)`;
        }
        return true;
      }
    });
    
    results.push({
      test: 'edge-mode-content',
      passed: edgeValidation.valid,
      details: edgeValidation
    });
    
    // Test 2: Verify variation assignment works
    logger.info('Test 2: Variation assignment');
    const variations = ['variation_a', 'variation_b'];
    const visitorTests = [];
    
    for (let i = 0; i < 3; i++) {
      const visitorId = `test_visitor_${i}`;
      const varResponse = await httpClient.request({
        method: 'GET',
        url: `${TEST_CONFIG.vercelUrl}/?override_visitor_id=true&enable_optimizely=true&visitor_id=${visitorId}`,
        headers: {
          'X-Optimizely-Enable-FEX': 'true',
          'Accept': 'text/html'
        }
      });
      
      const body = varResponse.body || '';
      let assignedVariation = null;
      
      if (body.includes('Variation A')) {
        assignedVariation = 'variation_a';
      } else if (body.includes('Variation B')) {
        assignedVariation = 'variation_b';
      }
      
      visitorTests.push({
        visitorId,
        assignedVariation,
        valid: assignedVariation !== null
      });
    }
    
    const variationValidation = {
      valid: visitorTests.every(t => t.valid),
      details: visitorTests
    };
    
    results.push({
      test: 'variation-assignment',
      passed: variationValidation.valid,
      details: variationValidation
    });
    
    // Test 3: Verify decide API returns correct flag configuration
    logger.info('Test 3: Decide API flag configuration');
    const decideResponse = await httpClient.request({
      method: 'GET',
      url: `${TEST_CONFIG.vercelUrl}/api/decide?userId=test123&flagKey=${TEST_CONFIG.flagKey}`,
      headers: {
        'X-Optimizely-SDK-Key': TEST_CONFIG.sdkKey,
        'X-Optimizely-Enable-FEX': 'true',
        'Accept': 'application/json'
      }
    });
    
    const decideValidation = validator.validate(decideResponse, {
      status: 200,
      requiredHeaders: ['content-type'],
      bodySchema: {
        type: 'object',
        required: ['flagKey', 'enabled', 'variationKey', 'variables'],
        properties: {
          flagKey: { const: TEST_CONFIG.flagKey },
          enabled: { type: 'boolean' },
          variables: {
            type: 'object',
            required: ['cdnVariationSettings'],
            properties: {
              cdnVariationSettings: {
                type: 'object',
                required: ['cdnResponseURL'],
                properties: {
                  cdnResponseURL: { 
                    type: 'string',
                    pattern: TEST_CONFIG.githubPagesUrl
                  }
                }
              }
            }
          }
        }
      }
    });
    
    results.push({
      test: 'decide-api-configuration',
      passed: decideValidation.valid,
      details: decideValidation
    });
    
    // Test 4: Verify no compression headers issue
    logger.info('Test 4: Compression headers check');
    const headerCheckResponse = await httpClient.request({
      method: 'GET',
      url: `${TEST_CONFIG.vercelUrl}/?override_visitor_id=true&enable_optimizely=true`,
      headers: {
        'X-Optimizely-Enable-FEX': 'true',
        'Accept': 'text/html'
      }
    });
    
    const compressionValidation = {
      valid: true,
      issues: []
    };
    
    // Check for problematic headers that should NOT be present
    const problematicHeaders = ['content-encoding', 'transfer-encoding'];
    for (const header of problematicHeaders) {
      if (headerCheckResponse.headers[header]) {
        compressionValidation.valid = false;
        compressionValidation.issues.push(`Problematic header present: ${header}`);
      }
    }
    
    // Verify content is not compressed/corrupted
    const bodyCheck = headerCheckResponse.body || '';
    if (bodyCheck.length > 0 && bodyCheck.length < 100 && !bodyCheck.includes('<')) {
      compressionValidation.valid = false;
      compressionValidation.issues.push('Body appears corrupted or compressed');
    }
    
    results.push({
      test: 'compression-headers',
      passed: compressionValidation.valid,
      details: compressionValidation
    });
    
    // Test 5: Verify wildcard pattern matching
    logger.info('Test 5: Wildcard pattern matching');
    const paths = ['/', '/test', '/path/to/page', '/index.html'];
    const pathTests = [];
    
    for (const path of paths) {
      const pathResponse = await httpClient.request({
        method: 'GET',
        url: `${TEST_CONFIG.vercelUrl}${path}?override_visitor_id=true&enable_optimizely=true`,
        headers: {
          'X-Optimizely-Enable-FEX': 'true',
          'Accept': 'text/html'
        }
      });
      
      pathTests.push({
        path,
        matched: pathResponse.status === 200 && (pathResponse.body || '').includes('Edge Mode Demo'),
        status: pathResponse.status
      });
    }
    
    const patternValidation = {
      valid: pathTests.every(t => t.matched),
      details: pathTests
    };
    
    results.push({
      test: 'wildcard-pattern',
      passed: patternValidation.valid,
      details: patternValidation
    });
    
    // Overall result
    const allPassed = results.every(r => r.passed);
    
    return {
      passed: allPassed,
      results,
      summary: {
        total: results.length,
        passed: results.filter(r => r.passed).length,
        failed: results.filter(r => !r.passed).length,
        criticalFix: 'Compression headers issue resolved',
        deploymentUrl: TEST_CONFIG.vercelUrl,
        testedAt: new Date().toISOString()
      }
    };
  }
};