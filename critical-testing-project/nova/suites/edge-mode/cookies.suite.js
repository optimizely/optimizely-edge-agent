module.exports = {
  name: 'Edge Mode - Cookies',
  tests: [
    {
      id: 'edge.cookies.reconciliation',
      name: 'Cookies Presence',
      description: 'Decision request sets cookies when enabled',
      async execute(context) {
        const { env, credentials, httpClient } = context;
        const url = `${env.url}/api/decide?flagKey=${encodeURIComponent(credentials.flagKey)}&userId=edge-cookie-check`;
        const resp = await httpClient.request({
          method: 'GET',
          url,
          headers: { 'X-Optimizely-Enable-FEX': 'true', 'X-Optimizely-SDK-Key': credentials.sdkKey }
        });
        const setCookie = resp.headers && (resp.headers['set-cookie'] || resp.headers['Set-Cookie']);
        const passed = resp.status === 200 && !!setCookie;
        return { request: url, response: { status: resp.status, setCookie }, validation: { passed, errors: passed?[]:['Missing Set-Cookie or non-200'] } };
      }
    }
  ]
};

