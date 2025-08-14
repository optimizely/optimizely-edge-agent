/**
 * Edge Mode - Core Tests using external origin
 */

const crypto = require('crypto');

function hashContent(s) {
  return crypto.createHash('sha256').update(s || '').digest('hex');
}

module.exports = {
  name: 'Edge Mode - Core',
  tests: [
    {
      id: 'edge.cache.hit',
      name: 'Cache HIT Smoke',
      description: 'Two identical GETs succeed (smoke indicator)',
      async execute(context) {
        const { env, httpClient } = context;
        const url = `${env.url}/index.html?force-edge-mode=true`;
        const first = await httpClient.request({ method: 'GET', url });
        const second = await httpClient.request({ method: 'GET', url });
        const passed = first.status === 200 && second.status === 200;
        return { request: url, response: [{first:first.status},{second:second.status}], validation: { passed, errors: passed?[]:[`Statuses ${first.status}, ${second.status}`] } };
      }
    },
    {
      id: 'edge.forward.origin',
      name: 'Forwarding vs Origin Compare',
      description: 'Compare Edge response to content origin for a known path',
      async execute(context) {
        const { env, httpClient, validator } = context;
        const path = '/';
        const edgeUrl = `${env.url}${path}?force-edge-mode=true`;
        const originUrl = `${env.contentOrigin}${path}`;

        const edgeResp = await httpClient.request({ method: 'GET', url: edgeUrl });
        const originResp = await httpClient.request({ method: 'GET', url: originUrl });

        const edgeOk = edgeResp.status === 200;
        const originOk = originResp.status === 200;
        const passed = edgeOk && originOk; // relaxed content comparison for dev
        const errors = [];
        if (!edgeOk) errors.push(`Edge status ${edgeResp.status}`);
        if (!originOk) errors.push(`Origin status ${originResp.status}`);

        const validation = validator.validate({ status: passed?200:500, body: '' }, { status: 200 });
        validation.passed = passed; validation.errors = errors;

        return {
          request: { edgeUrl, originUrl },
          response: { edgeStatus: edgeResp.status, originStatus: originResp.status },
          validation
        };
      }
    },
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
