// Direct test of Vercel handler without dev server
const { handleVercelEdgeRequest } = require('./dist/vercel/composition/vercelComposition');
const http = require('http');

// Mock environment variables
const mockEnv = {
  DEFAULT_SDK_KEY: '8mR1pGh8u2ztUP8GqjmQq',
  ADMIN_TOKEN: 'dev-admin-token',
  ENVIRONMENT: 'development',
  LOG_LEVEL: 'debug',
  ROUTING_TARGET: 'v2'
};

// Create a simple HTTP server
const server = http.createServer(async (req, res) => {
  try {
    // Build the full URL
    const url = `http://localhost:9797${req.url}`;
    
    // Collect request body if present
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', async () => {
      // Create a Fetch API Request
      const headers = {};
      for (const [key, value] of Object.entries(req.headers)) {
        headers[key] = value;
      }
      
      const request = new Request(url, {
        method: req.method,
        headers: headers,
        body: (req.method !== 'GET' && req.method !== 'HEAD' && body) ? body : undefined,
      });
      
      console.log(`[Test Server] ${req.method} ${req.url}`);
      
      // Call the Vercel handler
      const response = await handleVercelEdgeRequest(
        request,
        mockEnv,
        {} // No ExecutionContext
      );
      
      // Send the response
      res.statusCode = response.status;
      response.headers.forEach((value, key) => {
        res.setHeader(key, value);
      });
      
      const responseBody = await response.text();
      res.end(responseBody);
    });
  } catch (error) {
    console.error('[Test Server] Error:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: error.message }));
  }
});

server.listen(9797, () => {
  console.log('Vercel adapter test server running on http://localhost:9797');
  console.log('Testing with SDK key:', mockEnv.DEFAULT_SDK_KEY);
  console.log('Ready for requests...');
});