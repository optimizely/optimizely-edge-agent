// Direct test server for Vercel Edge Function
const http = require('http');
const { handleVercelEdgeRequest } = require('./dist/vercel/composition/vercelComposition');

// Mock environment variables
const mockEnv = {
  DEFAULT_SDK_KEY: '8mR1pGh8u2ztUP8GqjmQq',
  ADMIN_TOKEN: 'dev-admin-token',
  ENVIRONMENT: 'development',
  LOG_LEVEL: 'debug',
  ROUTING_TARGET: 'v2'
};

const server = http.createServer(async (req, res) => {
  try {
    const url = `http://localhost:8789${req.url}`;
    
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', async () => {
      const headers = {};
      for (const [key, value] of Object.entries(req.headers)) {
        headers[key] = value;
      }
      
      const request = new Request(url, {
        method: req.method,
        headers: headers,
        body: (req.method !== 'GET' && req.method !== 'HEAD' && body) ? body : undefined,
      });
      
      console.log(`[Vercel Edge Test] ${req.method} ${req.url}`);
      
      const response = await handleVercelEdgeRequest(
        request,
        mockEnv,
        { waitUntil: (p) => p }
      );
      
      res.statusCode = response.status;
      response.headers.forEach((value, key) => {
        res.setHeader(key, value);
      });
      
      const responseBody = await response.text();
      res.end(responseBody);
    });
  } catch (error) {
    console.error('[Vercel Edge Test] Error:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: error.message }));
  }
});

server.listen(8789, () => {
  console.log('✅ Vercel Edge Function test server running on http://localhost:8789');
  console.log('SDK key:', mockEnv.DEFAULT_SDK_KEY);
});