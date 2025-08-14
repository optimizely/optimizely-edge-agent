// Vercel serverless function entry point for Edge Agent v2
const { handleVercelEdgeRequest } = require('../dist/vercel/composition/vercelComposition');

module.exports = async (req, res) => {
  try {
    // Basic debug info
    console.log('Edge Agent request:', req.method, req.url);
    console.log('ADMIN_TOKEN env var:', process.env.ADMIN_TOKEN ? 'present' : 'missing');
    console.log('OPTIMIZELY_SDK_KEY env var:', process.env.OPTIMIZELY_SDK_KEY ? `${process.env.OPTIMIZELY_SDK_KEY.substring(0, 4)}...` : 'NOT SET');
    
    // Test if the module can be loaded
    if (!handleVercelEdgeRequest) {
      throw new Error('handleVercelEdgeRequest is not available');
    }
    
    // Convert Vercel request to Fetch API Request
    const url = `https://${req.headers.host}${req.url}`;
    const request = new Request(url, {
      method: req.method,
      headers: req.headers,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
    });

    console.log('Calling handleVercelEdgeRequest...');
    
    // Call the Edge Agent handler
    const response = await handleVercelEdgeRequest(
      request,
      process.env,
      {} // No ExecutionContext in Vercel
    );

    console.log('Got response:', response.status);

    // Convert Response to Vercel response
    const text = await response.text();
    res.status(response.status);
    
    // Copy headers
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });
    
    res.send(text);
  } catch (error) {
    console.error('Edge Agent error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message,
      stack: error.stack,
      requirePath: '../dist/vercel/composition/vercelComposition'
    });
  }
};