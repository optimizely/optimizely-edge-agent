/**
 * Agent Mode - Event Tracking (v2 pixel endpoint)
 */

module.exports = {
  name: 'Agent Mode - Track',
  tests: [
    {
      id: 'agent.track.basic',
      name: 'Basic Event Track',
      description: 'Track conversion event via POST /track.gif',
      async execute(context) {
        const { env, credentials, httpClient, validator } = context;

        const response = await httpClient.request({
          method: 'POST',
          url: `${env.url}/track.gif`,
          headers: {
            'Content-Type': 'application/json',
            'X-Optimizely-Enable-FEX': 'true',
            'X-Optimizely-SDK-Key': credentials.sdkKey
          },
          body: {
            eventKey: 'purchase',
            userId: credentials.visitorId || 'nova-test-user',
            eventTags: { value: 1.23 }
          }
        });

        const validation = validator.validate(response, {
          status: 200,
          requiredHeaders: ['content-type'],
          custom: (resp) => {
            // track.gif usually returns image/gif or a small payload
            const ct = (resp.headers && (resp.headers['content-type'] || resp.headers['Content-Type'])) || '';
            return ct.includes('gif') || ct.includes('application/json') ? true : 'Unexpected content-type';
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

