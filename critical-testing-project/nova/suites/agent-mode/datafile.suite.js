/**
 * Agent Mode - Datafile (v2)
 */

module.exports = {
  name: 'Agent Mode - Datafile',
  tests: [
    {
      id: 'agent.datafile.basic',
      name: 'Fetch Datafile',
      description: 'GET /api/datafile returns JSON datafile',
      async execute(context) {
        const { env, credentials, httpClient, validator } = context;

        const response = await httpClient.request({
          method: 'GET',
          url: `${env.url}/api/datafile`,
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
              const body = typeof resp.body === 'string' ? JSON.parse(resp.body) : resp.json || {};
              // Accept either object or stringified sdk-keyed datafile structure
              return body && (body.revision !== undefined || body.projectId !== undefined || body.version !== undefined) ? true : 'Unexpected datafile shape';
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

