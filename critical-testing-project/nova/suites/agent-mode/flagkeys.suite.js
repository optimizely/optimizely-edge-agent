/**
 * Agent Mode - Flag Keys (v2)
 */

module.exports = {
  name: 'Agent Mode - Flag Keys',
  tests: [
    {
      id: 'agent.flagkeys.basic',
      name: 'Fetch Flag Keys',
      description: 'GET /api/flagkeys returns list of flags',
      async execute(context) {
        const { env, credentials, httpClient, validator } = context;

        const response = await httpClient.request({
          method: 'GET',
          url: `${env.url}/api/flagkeys`,
          headers: {
            'Accept': 'application/json',
            'X-Optimizely-Enable-FEX': 'true',
            'X-Optimizely-SDK-Key': credentials.sdkKey
          }
        });

        const validation = validator.validate(response, {
          status: 200,
          requiredHeaders: ['content-type'],
          custom: (resp) => {
            try {
              const body = typeof resp.body === 'string' ? JSON.parse(resp.body) : resp.json;
              // Accept either array of strings or object with keys property
              if (Array.isArray(body)) return true;
              if (body && Array.isArray(body.flagKeys)) return true;
              return 'Unexpected flag keys response';
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

