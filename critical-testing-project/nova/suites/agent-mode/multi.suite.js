/**
 * Agent Mode - Multi-flag endpoints (v2)
 */

module.exports = {
  name: 'Agent Mode - Multi Flag',
  tests: [
    {
      id: 'agent.decide-all.basic',
      name: 'Decide All Flags',
      description: 'POST /api/decide-all returns decisions for all flags',
      async execute(context) {
        const { env, credentials, httpClient, validator } = context;

        const response = await httpClient.request({
          method: 'POST',
          url: `${env.url}/api/decide-all`,
          headers: {
            'Content-Type': 'application/json',
            'X-Optimizely-Enable-FEX': 'true',
            'X-Optimizely-SDK-Key': credentials.sdkKey,
            'X-Optimizely-Enable-Response-Metadata': 'false'
          },
          body: {
            userId: credentials.visitorId || 'nova-test-user',
            decideOptions: ['EXCLUDE_VARIABLES']
          }
        });

        const validation = validator.validate(response, {
          status: 200,
          requiredHeaders: ['content-type'],
          custom: (resp) => {
            try {
              const body = typeof resp.body === 'string' ? JSON.parse(resp.body) : resp.json || {};
              return Array.isArray(body) ? true : 'Decide-all should return array of decisions';
            } catch { return 'Invalid JSON body'; }
          }
        });

        return { request: response.request, response, validation };
      }
    },
    {
      id: 'agent.decide-for-keys.basic',
      name: 'Decide For Keys',
      description: 'POST /api/decide-for-keys returns decisions for specific keys',
      async execute(context) {
        const { env, credentials, httpClient, validator } = context;

        const response = await httpClient.request({
          method: 'POST',
          url: `${env.url}/api/decide-for-keys`,
          headers: {
            'Content-Type': 'application/json',
            'X-Optimizely-Enable-FEX': 'true',
            'X-Optimizely-SDK-Key': credentials.sdkKey,
            'X-Optimizely-Enable-Response-Metadata': 'false'
          },
          body: {
            userId: credentials.visitorId || 'nova-test-user',
            flagKeys: [credentials.flagKey]
          }
        });

        const validation = validator.validate(response, {
          status: 200,
          requiredHeaders: ['content-type'],
          custom: (resp) => {
            try {
              const body = typeof resp.body === 'string' ? JSON.parse(resp.body) : resp.json || {};
              if (!Array.isArray(body)) return 'Expected array of decisions';
              return body.some(d => d.flagKey === credentials.flagKey) ? true : 'Requested flagKey not present';
            } catch { return 'Invalid JSON body'; }
          }
        });

        return { request: response.request, response, validation };
      }
    }
  ]
};

