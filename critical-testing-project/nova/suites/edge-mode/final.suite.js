/**
 * Edge Mode Final Test Suite - Using edge_mode_final_test flag
 */

module.exports = {
  name: 'Edge Mode - Final',
  tests: [
    {
      id: 'edge.final.setup',
      name: 'Edge Mode Setup Verification',
      description: 'Verify edge_mode_final_test flag exists in datafile',
      async execute(context) {
        const { env, credentials, httpClient, validator } = context;
        
        const response = await httpClient.request({
          method: 'GET',
          url: `${env.url}/api/datafile`,
          headers: {
            'X-Optimizely-SDK-Key': credentials.sdkKey,
            'X-Optimizely-Enable-Debug-Headers': 'false'
          }
        });
        
        const validation = validator.validate(response, { 
          status: 200,
          custom: (res) => {
            const datafile = res.data;
            const flag = datafile.featureFlags?.find(f => f.key === 'edge_mode_final_test');
            
            if (!flag) {
              return { passed: false, message: 'Flag edge_mode_final_test not found in datafile' };
            }
            
            const hasVariations = flag.experimentIds && flag.experimentIds.length > 0;
            if (!hasVariations) {
              return { passed: false, message: 'Flag exists but has no variations configured' };
            }
            
            return { passed: true, message: `Flag configured with ${flag.experimentIds.length} experiment(s)` };
          }
        });
        
        return { request: response.request, response, validation };
      }
    },

    {
      id: 'edge.final.forced.control',
      name: 'Edge Mode - Force Control Variation',
      description: 'Test forcing control variation and content fetch',
      async execute(context) {
        const { env, credentials, httpClient, validator } = context;
        const forced = { edge_mode_final_test: { variationKey: 'control' } };
        
        const response = await httpClient.request({
          method: 'GET',
          url: `${env.url}/`,
          headers: {
            'X-Optimizely-SDK-Key': credentials.sdkKey,
            'X-Optimizely-Enable-FEX': 'true',
            'X-Optimizely-Forced-Decisions': JSON.stringify(forced),
            'X-Optimizely-Enable-Debug-Headers': 'false'
          }
        });
        
        const validation = validator.validate(response, {
          status: 200,
          headers: { 'x-optimizely-variation': 'control' },
          bodyContains: ['Purple Theme', 'Control Variation']
        });
        
        return { request: response.request, response, validation };
      }
    },

    {
      id: 'edge.final.forced.a',
      name: 'Edge Mode - Force Variation A',
      description: 'Test forcing variation A and content fetch',
      async execute(context) {
        const { env, credentials, httpClient, validator } = context;
        const forced = { edge_mode_final_test: { variationKey: 'a' } };
        
        const response = await httpClient.request({
          method: 'GET',
          url: `${env.url}/`,
          headers: {
            'X-Optimizely-SDK-Key': credentials.sdkKey,
            'X-Optimizely-Enable-FEX': 'true',
            'X-Optimizely-Forced-Decisions': JSON.stringify(forced),
            'X-Optimizely-Enable-Debug-Headers': 'false'
          }
        });
        
        const validation = validator.validate(response, {
          status: 200,
          headers: { 'x-optimizely-variation': 'a' },
          bodyContains: ['Pink Theme', 'Variation A']
        });
        
        return { request: response.request, response, validation };
      }
    },

    {
      id: 'edge.final.forced.b',
      name: 'Edge Mode - Force Variation B',
      description: 'Test forcing variation B and content fetch',
      async execute(context) {
        const { env, credentials, httpClient, validator } = context;
        const forced = { edge_mode_final_test: { variationKey: 'b' } };
        
        const response = await httpClient.request({
          method: 'GET',
          url: `${env.url}/`,
          headers: {
            'X-Optimizely-SDK-Key': credentials.sdkKey,
            'X-Optimizely-Enable-FEX': 'true',
            'X-Optimizely-Forced-Decisions': JSON.stringify(forced),
            'X-Optimizely-Enable-Debug-Headers': 'false'
          }
        });
        
        const validation = validator.validate(response, {
          status: 200,
          headers: { 'x-optimizely-variation': 'b' },
          bodyContains: ['Ocean Theme', 'Variation B']
        });
        
        return { request: response.request, response, validation };
      }
    },

    {
      id: 'edge.final.stickiness',
      name: 'Edge Mode - Visitor Stickiness',
      description: 'Test that same user gets same variation',
      async execute(context) {
        const { env, credentials, httpClient, validator } = context;
        const userId = `sticky-test-${Date.now()}`;
        
        // First request
        const response1 = await httpClient.request({
          method: 'GET',
          url: `${env.url}/?userId=${userId}`,
          headers: {
            'X-Optimizely-SDK-Key': credentials.sdkKey,
            'X-Optimizely-Enable-FEX': 'true',
            'X-Optimizely-Enable-Debug-Headers': 'false'
          }
        });
        
        const variation1 = response1.headers['x-optimizely-variation'];
        const cookies = response1.headers['set-cookie'];
        
        // Second request with cookies
        const response2 = await httpClient.request({
          method: 'GET',
          url: `${env.url}/?userId=${userId}`,
          headers: {
            'X-Optimizely-SDK-Key': credentials.sdkKey,
            'X-Optimizely-Enable-FEX': 'true',
            'X-Optimizely-Enable-Debug-Headers': 'false',
            'Cookie': Array.isArray(cookies) ? cookies.join('; ') : cookies
          }
        });
        
        const variation2 = response2.headers['x-optimizely-variation'];
        
        const validation = validator.validate(response2, {
          custom: () => {
            if (variation1 !== variation2) {
              return {
                passed: false,
                message: `Variation changed: ${variation1} -> ${variation2}`
              };
            }
            return {
              passed: true,
              message: `Variation consistent: ${variation1}`
            };
          }
        });
        
        return { request: response2.request, response: response2, validation };
      }
    },

    {
      id: 'edge.final.cache.performance',
      name: 'Edge Mode - Cache Performance',
      description: 'Test cache hit/miss headers',
      async execute(context) {
        const { env, credentials, httpClient, validator } = context;
        const userId = `cache-test-${Date.now()}`;
        
        // First request - should be cache miss
        const response1 = await httpClient.request({
          method: 'GET',
          url: `${env.url}/?userId=${userId}`,
          headers: {
            'X-Optimizely-SDK-Key': credentials.sdkKey,
            'X-Optimizely-Enable-FEX': 'true',
            'X-Optimizely-Enable-Debug-Headers': 'false'
          }
        });
        
        const cache1 = response1.headers['x-optimizely-cache'];
        const variation = response1.headers['x-optimizely-variation'];
        
        // Second request - should be cache hit
        const response2 = await httpClient.request({
          method: 'GET',
          url: `${env.url}/?userId=${userId}`,
          headers: {
            'X-Optimizely-SDK-Key': credentials.sdkKey,
            'X-Optimizely-Enable-FEX': 'true'
          }
        });
        
        const cache2 = response2.headers['x-optimizely-cache'];
        
        const validation = validator.validate(response2, {
          headers: {
            'x-optimizely-variation': variation
          },
          custom: () => {
            // First request should be MISS or undefined
            const firstOk = !cache1 || cache1 === 'MISS';
            // Second request should be HIT
            const secondOk = cache2 === 'HIT';
            
            if (!firstOk || !secondOk) {
              return {
                passed: false,
                message: `Cache headers incorrect. First: ${cache1}, Second: ${cache2}`
              };
            }
            
            return {
              passed: true,
              message: `Cache working: First=${cache1 || 'MISS'}, Second=${cache2}`
            };
          }
        });
        
        return { request: response2.request, response: response2, validation };
      }
    },

    {
      id: 'edge.final.attributes',
      name: 'Edge Mode - Attribute-based Targeting',
      description: 'Test variation assignment with custom attributes',
      async execute(context) {
        const { env, credentials, httpClient, validator } = context;
        
        const response = await httpClient.request({
          method: 'GET',
          url: `${env.url}/?userId=attribute-test-${Date.now()}`,
          headers: {
            'X-Optimizely-SDK-Key': credentials.sdkKey,
            'X-Optimizely-Enable-FEX': 'true',
            'X-Optimizely-Enable-Debug-Headers': 'false',
            'X-Optimizely-Attributes': JSON.stringify({
              country: 'US',
              plan_type: 'premium',
              ab_test_group: 'treatment'
            })
          }
        });
        
        const validation = validator.validate(response, {
          status: 200,
          custom: (res) => {
            const variation = res.headers['x-optimizely-variation'];
            if (!variation || !['control', 'a', 'b'].includes(variation)) {
              return {
                passed: false,
                message: `Invalid variation: ${variation}`
              };
            }
            return {
              passed: true,
              message: `Got variation: ${variation}`
            };
          }
        });
        
        return { request: response.request, response, validation };
      }
    },

    {
      id: 'edge.final.cookie.persistence',
      name: 'Edge Mode - Cookie Persistence',
      description: 'Test optimizely_visitor cookie',
      async execute(context) {
        const { env, credentials, httpClient, validator } = context;
        const userId = `cookie-test-${Date.now()}`;
        
        // Set cookie
        const response1 = await httpClient.request({
          method: 'GET',
          url: `${env.url}/?userId=${userId}`,
          headers: {
            'X-Optimizely-SDK-Key': credentials.sdkKey,
            'X-Optimizely-Enable-FEX': 'true',
            'X-Optimizely-Enable-Debug-Headers': 'false'
          }
        });
        
        const cookies = response1.headers['set-cookie'];
        const variation1 = response1.headers['x-optimizely-variation'];
        
        if (!cookies) {
          return {
            request: response1.request,
            response: response1,
            validation: {
              passed: false,
              message: 'No cookies set'
            }
          };
        }
        
        const cookieStr = Array.isArray(cookies) ? cookies.join('; ') : cookies;
        
        // Read cookie
        const response2 = await httpClient.request({
          method: 'GET',
          url: `${env.url}/`,
          headers: {
            'X-Optimizely-SDK-Key': credentials.sdkKey,
            'X-Optimizely-Enable-FEX': 'true',
            'X-Optimizely-Enable-Debug-Headers': 'false',
            'Cookie': cookieStr
          }
        });
        
        const variation2 = response2.headers['x-optimizely-variation'];
        
        const validation = validator.validate(response2, {
          custom: () => {
            const hasOptimizelyVisitor = cookieStr.includes('optimizely_visitor');
            
            if (!hasOptimizelyVisitor) {
              return {
                passed: false,
                message: 'optimizely_visitor cookie not set'
              };
            }
            
            if (variation1 !== variation2) {
              return {
                passed: false,
                message: `Variation changed despite cookie: ${variation1} -> ${variation2}`
              };
            }
            
            return {
              passed: true,
              message: 'Cookie persistence working'
            };
          }
        });
        
        return { request: response2.request, response: response2, validation };
      }
    },

    {
      id: 'edge.final.content.validation',
      name: 'Edge Mode - Content URL Validation',
      description: 'Verify correct GitHub Pages URLs',
      async execute(context) {
        const { env, credentials, httpClient, validator } = context;
        
        const response = await httpClient.request({
          method: 'GET',
          url: `${env.url}/api/decide?flagKey=edge_mode_final_test&userId=content-test-${Date.now()}`,
          headers: {
            'X-Optimizely-SDK-Key': credentials.sdkKey,
            'X-Optimizely-Enable-FEX': 'true',
            'X-Optimizely-Enable-Debug-Headers': 'false'
          }
        });
        
        const validation = validator.validate(response, {
          status: 200,
          custom: (res) => {
            const decision = res.data;
            
            if (!decision.enabled) {
              return {
                passed: false,
                message: 'Flag not enabled for user'
              };
            }
            
            const cdnSettings = decision.variables?.cdnVariationSettings;
            if (!cdnSettings) {
              return {
                passed: false,
                message: 'No cdnVariationSettings in response'
              };
            }
            
            const contentUrl = cdnSettings.contentUrl;
            const expectedBase = 'https://simone-coelho.github.io/optimizely-edge-mode-demo';
            
            if (!contentUrl || !contentUrl.startsWith(expectedBase)) {
              return {
                passed: false,
                message: `Invalid content URL: ${contentUrl}`
              };
            }
            
            return {
              passed: true,
              message: `Valid content URL: ${contentUrl}`
            };
          }
        });
        
        return { request: response.request, response, validation };
      }
    },

    {
      id: 'edge.final.fallback',
      name: 'Edge Mode - Origin Fallback',
      description: 'Test fallback when Edge Mode disabled',
      async execute(context) {
        const { env, credentials, httpClient, validator } = context;
        
        const response = await httpClient.request({
          method: 'GET',
          url: `${env.url}/?userId=fallback-test-${Date.now()}`,
          headers: {
            'X-Optimizely-SDK-Key': credentials.sdkKey,
            'X-Optimizely-Enable-FEX': 'false',  // Explicitly disable
            'X-Optimizely-Enable-Debug-Headers': 'false'
          }
        });
        
        const validation = validator.validate(response, {
          status: 200,
          custom: (res) => {
            const mode = res.headers['x-optimizely-mode'];
            const body = res.body;
            
            // Should not be in edge mode
            if (mode === 'edge') {
              return {
                passed: false,
                message: 'Edge mode active when it should be disabled'
              };
            }
            
            // Should not contain variation content
            const hasVariationContent = 
              body.includes('Purple Theme') ||
              body.includes('Pink Theme') ||
              body.includes('Ocean Theme');
            
            if (hasVariationContent) {
              return {
                passed: false,
                message: 'Variation content present when Edge Mode disabled'
              };
            }
            
            return {
              passed: true,
              message: 'Correctly fell back to origin'
            };
          }
        });
        
        return { request: response.request, response, validation };
      }
    }
  ]
};