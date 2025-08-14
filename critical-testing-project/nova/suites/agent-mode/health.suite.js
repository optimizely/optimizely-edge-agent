/**
 * Agent Mode - Health Check Test Suite
 */

module.exports = {
  name: 'Agent Mode - Health',
  tests: [
    {
      id: 'agent.health',
      name: 'Health Endpoint',
      description: 'Validate /api/test returns 200 with JSON',
      async execute(context) {
        const { env, httpClient, validator } = context;

        const response = await httpClient.request({
          method: 'GET',
          url: `${env.url}/api/test`,
          headers: { 'Accept': 'application/json' }
        });

        const validation = validator.validate(response, {
          status: 200,
          requiredHeaders: ['content-type'],
          custom: (resp) => {
            try {
              const body = typeof resp.body === 'string' ? JSON.parse(resp.body) : resp.json || {};
              return body && body.status === 'ok' ? true : 'Missing status ok';
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

