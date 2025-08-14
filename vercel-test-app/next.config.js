/** @type {import('next').NextConfig} */
const nextConfig = {
  // The middleware now uses standard Node.js runtime due to SDK limitations

  // Environment variables that should be available in the browser
  env: {
    NEXT_PUBLIC_OPTIMIZELY_SDK_KEY: process.env.OPTIMIZELY_SDK_KEY,
  },

  // Redirect root to home for cleaner URLs
  async redirects() {
    return [
      {
        source: '/origin',
        destination: '/origin/home',
        permanent: false,
      },
    ];
  },

  // Headers for CORS support when used as origin
  async headers() {
    return [
      {
        source: '/origin/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, HEAD, OPTIONS',
          },
          {
            key: 'X-Optimizely-Origin-Server',
            value: 'vercel-test-app',
          },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, X-Optimizely-SDK-Key, X-Optimizely-Admin-Token',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;