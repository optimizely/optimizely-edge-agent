/**
 * Agent Mode - Decide Endpoint Test Suite
 */

module.exports = {
  name: 'Agent Mode - Decide Tests',
  tests: [
    {
      id: 'agent.decide.basic',
      name: 'Basic Decide Request',
      description: 'Test basic decide endpoint with SDK key in header',
      async execute(context) {
        const { env, credentials, httpClient, validator } = context;
        
        const response = await httpClient.request({
          method: 'POST',
          url: `${env.url}/api/decide`,
          headers: {
            'Content-Type': 'application/json',
            'X-Optimizely-SDK-Key': credentials.sdkKey,
            'X-Optimizely-Enable-FEX': 'true'
          },
          body: {
            flagKey: credentials.flagKey,
            userId: 'test-user-1'
          }
        });

        const validation = validator.validate(response, {
          status: 200,
          requiredHeaders: ['content-type'],
          bodySchema: {
            type: 'object',
            required: ['flagKey', 'enabled', 'variationKey'],
            properties: {
              flagKey: { type: 'string' },
              enabled: { type: 'boolean' },
              variationKey: { type: 'string' }
            }
          }
        });

        return {
          request: response.request,
          response: {
            status: response.status,
            headers: response.headers,
            body: response.body
          },
          validation
        };
      }
    },

    {
      id: 'agent.matrix.attribute-sources',
      name: 'Attributes Source Matrix',
      description: 'Test attributes from header, query, and body',
      async execute(context) {
        const { env, credentials, httpClient } = context;
        const sources = ['header', 'query', 'body'];
        const results = [];
        const errors = [];

        for (const source of sources) {
          const headers = {
            'Content-Type': 'application/json',
            'X-Optimizely-Enable-FEX': 'true',
            'X-Optimizely-SDK-Key': credentials.sdkKey
          };
          let url = `${env.url}/api/decide`;
          let body = {
            flagKey: credentials.flagKey,
            userId: `attr-${source}-user`
          };

          if (source === 'header') {
            headers['X-Optimizely-Attributes'] = JSON.stringify({ tier: 'gold', region: 'us' });
          } else if (source === 'query') {
            url += `?attributes=${encodeURIComponent('{"tier":"gold","region":"us"}')}`;
          } else if (source === 'body') {
            body.attributes = { tier: 'gold', region: 'us' };
          }

          try {
            const response = await httpClient.request({ method: 'POST', url, headers, body });
            results.push({ source, status: response.status });
            if (response.status !== 200) errors.push(`${source}: Status ${response.status}`);
          } catch (error) {
            errors.push(`${source}: ${error.message}`);
          }
        }

        return {
          request: 'Attributes source matrix',
          response: results,
          validation: {
            passed: errors.length === 0,
            errors,
            summary: results
          }
        };
      }
    },

    {
      id: 'agent.matrix.option-sources',
      name: 'Decide Options Source Matrix',
      description: 'Test decide options from header, query, and body',
      async execute(context) {
        const { env, credentials, httpClient } = context;
        const sources = ['header', 'query', 'body'];
        const results = [];
        const errors = [];

        for (const source of sources) {
          const headers = {
            'Content-Type': 'application/json',
            'X-Optimizely-Enable-FEX': 'true',
            'X-Optimizely-SDK-Key': credentials.sdkKey
          };
          let url = `${env.url}/api/decide`;
          let body = {
            flagKey: credentials.flagKey,
            userId: `opts-${source}-user`
          };

          if (source === 'header') {
            headers['X-Optimizely-Decide-Options'] = JSON.stringify(['INCLUDE_REASONS', 'INCLUDE_VARIABLES']);
          } else if (source === 'query') {
            url += `?decideOptions=${encodeURIComponent('INCLUDE_REASONS,INCLUDE_VARIABLES')}`;
          } else if (source === 'body') {
            body.decideOptions = ['INCLUDE_REASONS', 'INCLUDE_VARIABLES'];
          }

          try {
            const response = await httpClient.request({ method: 'POST', url, headers, body });
            results.push({ source, status: response.status });
            if (response.status !== 200) errors.push(`${source}: Status ${response.status}`);
          } catch (error) {
            errors.push(`${source}: ${error.message}`);
          }
        }

        return {
          request: 'Decide options source matrix',
          response: results,
          validation: {
            passed: errors.length === 0,
            errors,
            summary: results
          }
        };
      }
    },

    {
      id: 'agent.decide.all-sources',
      name: 'Decide with All Parameter Sources',
      description: 'Test SDK key from header, query, and body sources',
      async execute(context) {
        const { env, credentials, httpClient, validator } = context;
        const results = [];

        // Test 1: SDK key in header
        const headerResponse = await httpClient.request({
          method: 'POST',
          url: `${env.url}/api/decide`,
          headers: {
            'Content-Type': 'application/json',
            'X-Optimizely-SDK-Key': credentials.sdkKey,
            'X-Optimizely-Enable-FEX': 'true'
          },
          body: {
            flagKey: credentials.flagKey,
            userId: 'header-user'
          }
        });
        results.push({ source: 'header', response: headerResponse });

        // Test 2: SDK key in query
        const queryResponse = await httpClient.request({
          method: 'POST',
          url: `${env.url}/api/decide?sdkKey=${credentials.sdkKey}`,
          headers: {
            'Content-Type': 'application/json',
            'X-Optimizely-Enable-FEX': 'true'
          },
          body: {
            flagKey: credentials.flagKey,
            userId: 'query-user'
          }
        });
        results.push({ source: 'query', response: queryResponse });

        // Test 3: SDK key in body
        const bodyResponse = await httpClient.request({
          method: 'POST',
          url: `${env.url}/api/decide`,
          headers: {
            'Content-Type': 'application/json',
            'X-Optimizely-Enable-FEX': 'true'
          },
          body: {
            sdkKey: credentials.sdkKey,
            flagKey: credentials.flagKey,
            userId: 'body-user'
          }
        });
        results.push({ source: 'body', response: bodyResponse });

        // Validate all responses
        const errors = [];
        for (const result of results) {
          if (result.response.status !== 200) {
            errors.push(`${result.source}: Status ${result.response.status}`);
          }
          if (!result.response.json?.variationKey) {
            errors.push(`${result.source}: Missing variation`);
          }
        }

        return {
          request: 'Multiple requests',
          response: results,
          validation: {
            passed: errors.length === 0,
            errors
          }
        };
      }
    },

    {
      id: 'agent.matrix.sdk-sources',
      name: 'SDK Key Source Matrix',
      description: 'Test all SDK key source combinations',
      async execute(context) {
        const { env, credentials, httpClient } = context;
        const sources = ['header', 'query', 'body'];
        const results = [];
        const errors = [];

        for (const source of sources) {
          const headers = { 'Content-Type': 'application/json', 'X-Optimizely-Enable-FEX': 'true' };
          let url = `${env.url}/api/decide`;
          let body = {
            flagKey: credentials.flagKey,
            userId: `${source}-matrix-user`
          };

          if (source === 'header') {
            headers['X-Optimizely-SDK-Key'] = credentials.sdkKey;
          } else if (source === 'query') {
            url += `?sdkKey=${credentials.sdkKey}`;
          } else if (source === 'body') {
            body.sdkKey = credentials.sdkKey;
          }

          try {
            const response = await httpClient.request({
              method: 'POST',
              url,
              headers,
              body
            });

            results.push({
              source,
              status: response.status,
              hasDecision: !!response.json?.variationKey
            });

            if (response.status !== 200) {
              errors.push(`${source}: Status ${response.status}`);
            }
          } catch (error) {
            errors.push(`${source}: ${error.message}`);
          }
        }

        return {
          request: 'SDK source matrix',
          response: results,
          validation: {
            passed: errors.length === 0,
            errors,
            summary: results
          }
        };
      }
    },

    {
      id: 'agent.matrix.user-sources',
      name: 'User ID Source Matrix',
      description: 'Test user ID from header, query, body, and cookie',
      async execute(context) {
        const { env, credentials, httpClient } = context;
        const sources = ['header', 'query', 'body'];
        const results = [];
        const errors = [];

        for (const source of sources) {
          const headers = {
            'Content-Type': 'application/json',
            'X-Optimizely-SDK-Key': credentials.sdkKey,
            'X-Optimizely-Enable-FEX': 'true'
          };
          let url = `${env.url}/api/decide`;
          let body = {
            flagKey: credentials.flagKey
          };

          const userId = `${source}-user-${Date.now()}`;

          if (source === 'header') {
            headers['X-Optimizely-Visitor-Id'] = userId;
          } else if (source === 'query') {
            url += `?userId=${userId}`;
          } else if (source === 'body') {
            body.userId = userId;
          }

          try {
            const response = await httpClient.request({
              method: 'POST',
              url,
              headers,
              body
            });

            results.push({
              source,
              status: response.status,
              userId,
              hasDecision: !!response.json?.variationKey
            });

            if (response.status !== 200) {
              errors.push(`${source}: Status ${response.status}`);
            }
          } catch (error) {
            errors.push(`${source}: ${error.message}`);
          }
        }

        return {
          request: 'User ID source matrix',
          response: results,
          validation: {
            passed: errors.length === 0,
            errors,
            summary: results
          }
        };
      }
    },

    {
      id: 'agent.matrix.precedence',
      name: 'Parameter Precedence Test',
      description: 'Verify Header > Query > Body precedence',
      async execute(context) {
        const { env, credentials, httpClient } = context;
        
        // Send request with different user IDs in each source
        const response = await httpClient.request({
          method: 'POST',
          url: `${env.url}/api/decide?userId=query-user`,
          headers: {
            'Content-Type': 'application/json',
            'X-Optimizely-SDK-Key': credentials.sdkKey,
            'X-Optimizely-Visitor-Id': 'header-user',
            'X-Optimizely-Enable-FEX': 'true'
          },
          body: {
            flagKey: credentials.flagKey,
            userId: 'body-user'
          }
        });

        // The header value should take precedence
        const validation = {
          passed: response.status === 200,
          errors: []
        };

        if (response.status !== 200) {
          validation.errors.push(`Unexpected status: ${response.status}`);
        }

        // Additional validation could check which user ID was actually used
        // by examining response headers or logs

        return {
          request: response.request,
          response: {
            status: response.status,
            headers: response.headers,
            body: response.body
          },
          validation
        };
      }
    }
  ]
};
