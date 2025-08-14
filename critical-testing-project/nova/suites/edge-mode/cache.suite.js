module.exports = {
  name: 'Edge Mode - Cache',
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
    }
  ]
};

