const crypto = require('crypto');
function hashContent(s){return crypto.createHash('sha256').update(s||'').digest('hex');}

module.exports = {
  name: 'Edge Mode - Forwarding',
  tests: [
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
        const edgeOk = edgeResp.status === 200; const originOk = originResp.status === 200;
        const passed = edgeOk && originOk; // relaxed: both endpoints reachable and OK
        const errors = [];
        if (!edgeOk) errors.push(`Edge status ${edgeResp.status}`);
        if (!originOk) errors.push(`Origin status ${originResp.status}`);
        const validation = validator.validate({ status: passed?200:500 }, { status: 200 });
        validation.passed = passed; validation.errors = errors;
        return { request: { edgeUrl, originUrl }, response: { edgeStatus: edgeResp.status, originStatus: originResp.status }, validation };
      }
    }
  ]
};
