/**
 * Edge Mode - Forced Decision Basic Test Suite
 */

module.exports = {
  name: 'Edge Mode - Forced',
  tests: [
    {
      id: 'edge.forced.on',
      name: 'Forced Decision ON (API)',
      description: 'GET /api/decide with forced on variation',
      async execute(context) {
        const { env, credentials, httpClient, validator } = context;
        const forced = {}; forced[credentials.flagKey] = { variationKey: 'on' };
        const response = await httpClient.request({
          method: 'GET',
          url: `${env.url}/api/decide?flagKey=${encodeURIComponent(credentials.flagKey)}&userId=edge-forced-on`,
          headers: {
            'Accept': 'application/json',
            'X-Optimizely-SDK-Key': credentials.sdkKey,
            'X-Optimizely-Enable-FEX': 'true',
            'X-Optimizely-Forced-Decisions': JSON.stringify(forced)
          }
        });
        const validation = validator.validate(response, { status: 200, requiredHeaders: ['content-type'] });
        return { request: response.request, response, validation };
      }
    },
    {
      id: 'edge.forced.off',
      name: 'Forced Decision OFF (API)',
      description: 'GET /api/decide with forced off variation',
      async execute(context) {
        const { env, credentials, httpClient, validator } = context;
        const forced = {}; forced[credentials.flagKey] = { variationKey: 'off' };
        const response = await httpClient.request({
          method: 'GET',
          url: `${env.url}/api/decide?flagKey=${encodeURIComponent(credentials.flagKey)}&userId=edge-forced-off`,
          headers: {
            'Accept': 'application/json',
            'X-Optimizely-SDK-Key': credentials.sdkKey,
            'X-Optimizely-Enable-FEX': 'true',
            'X-Optimizely-Forced-Decisions': JSON.stringify(forced)
          }
        });
        const validation = validator.validate(response, { status: 200, requiredHeaders: ['content-type'] });
        return { request: response.request, response, validation };
      }
    },
    {
      id: 'edge.forced.basic',
      name: 'Forced Decision Basic',
      description: 'API GET with forced decision header should reflect variation',
      async execute(context) {
        const { env, credentials, httpClient, validator } = context;

        const forced = {};
        forced[credentials.flagKey] = { variationKey: 'on' };

        const url = `${env.url}/api/decide?flagKey=${encodeURIComponent(credentials.flagKey)}&userId=edge-user-1`;
        const response = await httpClient.request({
          method: 'GET',
          url,
          headers: {
            'Accept': 'application/json',
            'X-Optimizely-SDK-Key': credentials.sdkKey,
            'X-Optimizely-Enable-FEX': 'true',
            'X-Optimizely-Forced-Decisions': JSON.stringify(forced)
          }
        });

        const validation = validator.validate(response, {
          status: 200,
          requiredHeaders: ['content-type', 'x-optimizely-edge-decisions'],
          custom: (resp) => {
            try {
              const body = typeof resp.body === 'string' ? JSON.parse(resp.body) : resp.json || {};
              return body && typeof body.variationKey === 'string' ? true : 'Missing variationKey in body';
            } catch {
              return 'Invalid JSON body';
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
    }
  ]
};
