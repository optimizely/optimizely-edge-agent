// Simple test function to debug Vercel deployment
module.exports = async (req, res) => {
  try {
    res.status(200).json({
      message: 'Test function working',
      method: req.method,
      url: req.url,
      headers: Object.keys(req.headers),
      env: {
        hasSDKKey: !!process.env.OPTIMIZELY_SDK_KEY,
        nodeVersion: process.version
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Test function failed',
      message: error.message,
      stack: error.stack
    });
  }
};