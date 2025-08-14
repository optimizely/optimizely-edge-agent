import { NextRequest, NextResponse } from 'next/server';

// Import the pre-built Edge Agent handler
const { handleVercelEdgeRequest } = require('./dist/vercel/composition/vercelComposition.js');

// Force Node.js runtime, NOT Edge Runtime
export const runtime = 'nodejs';

export async function middleware(request: NextRequest) {
  // Skip API routes and static files
  const pathname = request.nextUrl.pathname;
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.includes('.') && !pathname.endsWith('.html')
  ) {
    return NextResponse.next();
  }

  // Check if Edge Mode should handle this request
  const enableFex = request.headers.get('X-Optimizely-Enable-FEX') === 'true';
  if (!enableFex) {
    return NextResponse.next();
  }

  console.log('Edge Agent request:', request.method, pathname);

  try {
    // Get SDK key from environment
    const sdkKey = process.env.OPTIMIZELY_SDK_KEY;
    console.log('Middleware - process.env:', process.env);
    console.log('Middleware - OPTIMIZELY_SDK_KEY:', sdkKey ? `${sdkKey.substring(0, 4)}...` : 'NOT SET');

    // Call the Edge Agent handler
    const env = {
      OPTIMIZELY_SDK_KEY: sdkKey || '',
      OPTIMIZELY_ADMIN_TOKEN: process.env.OPTIMIZELY_ADMIN_TOKEN || '',
      ADMIN_TOKEN: process.env.OPTIMIZELY_ADMIN_TOKEN || process.env.ADMIN_TOKEN || '',
    };
    console.log('ADMIN_TOKEN env var:', env.ADMIN_TOKEN ? 'present' : 'NOT SET');
    console.log('Calling handleVercelEdgeRequest...');

    const response = await handleVercelEdgeRequest(
      request,
      env,
      {} // Vercel doesn't use ExecutionContext
    );

    console.log('Got response:', response.status);
    return response;
  } catch (error) {
    console.error('Edge Agent error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};