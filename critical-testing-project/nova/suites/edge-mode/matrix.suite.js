/**
 * Edge Mode - Combination Matrix (v2)
 */

module.exports = {
  name: 'Edge Mode - Matrix',
  tests: [
    {
      id: 'edge.matrix.headers',
      name: 'Header Variations',
      description: 'Validate combinations of FEX + Visitor + Forced headers',
      async execute(context) {
        const { env, credentials, httpClient, validator } = context;
        const forced = {}; forced[credentials.flagKey] = { variationKey: 'on' };

        const cases = [
          { name: 'all-headers', headers: { 'X-Optimizely-Enable-FEX': 'true', 'X-Optimizely-SDK-Key': credentials.sdkKey, 'X-Optimizely-Visitor-ID': 'edge-h-1', 'X-Optimizely-Forced-Decisions': JSON.stringify(forced) } },
          { name: 'no-forced', headers: { 'X-Optimizely-Enable-FEX': 'true', 'X-Optimizely-SDK-Key': credentials.sdkKey, 'X-Optimizely-Visitor-ID': 'edge-h-2' } },
        ];
        const results = [];
        const errors = [];

        for (const c of cases) {
          const url = `${env.url}/api/decide?flagKey=${encodeURIComponent(credentials.flagKey)}&userId=${encodeURIComponent(c.headers['X-Optimizely-Visitor-ID'])}`;
          const response = await httpClient.request({ method: 'GET', url, headers: c.headers });
          results.push({ case: c.name, status: response.status });
          if (response.status !== 200) errors.push(`${c.name}: ${response.status}`);
        }

        return { request: 'edge.matrix.headers', response: results, validation: { passed: errors.length === 0, errors, summary: results } };
      }
    },
    {
      id: 'edge.matrix.cookies',
      name: 'Cookie Presence',
      description: 'Validate Set-Cookie visitor and decisions presence',
      async execute(context) {
        const { env, credentials, httpClient } = context;
        const headers = { 'X-Optimizely-Enable-FEX': 'true', 'X-Optimizely-SDK-Key': credentials.sdkKey, 'X-Optimizely-Visitor-ID': 'edge-cookie-1' };
        const response = await httpClient.request({ method: 'GET', url: `${env.url}/api/decide?flagKey=${credentials.flagKey}&userId=edge-cookie-1`, headers });
        const setCookie = response.headers && (response.headers['set-cookie'] || response.headers['Set-Cookie']);
        const passed = response.status === 200 && !!setCookie;
        return { request: response.request, response, validation: { passed, errors: passed ? [] : ['Missing Set-Cookie'] } };
      }
    },
    {
      id: 'edge.matrix.cache',
      name: 'Cache Behavior (basic)',
      description: 'Two identical Edge GETs should both succeed (basic smoke)',
      async execute(context) {
        const { env } = context;
        // Non-API path to exercise Edge pipeline
        const first = await context.httpClient.request({ method: 'GET', url: `${env.url}/?force-edge-mode=true` });
        const second = await context.httpClient.request({ method: 'GET', url: `${env.url}/?force-edge-mode=true` });
        const passed = first.status === 200 && second.status === 200;
        return { request: 'edge.cache.double-get', response: [{ first: first.status }, { second: second.status }], validation: { passed, errors: passed ? [] : ['Non-200 on repeated GET'] } };
      }
    },
    {
      id: 'edge.matrix.forwarding',
      name: 'Forwarding Mode (basic)',
      description: 'Forwarding smoke: default route returns 200',
      async execute(context) {
        const { env } = context;
        const response = await context.httpClient.request({ method: 'GET', url: `${env.url}/path-not-api` });
        return { request: response.request, response, validation: { passed: response.status === 200, errors: response.status === 200 ? [] : [`Status ${response.status}`] } };
      }
    }
  ]
};

