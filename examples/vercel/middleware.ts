import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { middleware as optimizelyMiddleware } from '@optimizely/optimizely-edge-agent/vercel';

export async function middleware(request: NextRequest) {
  // Skip API routes
  if (request.nextUrl.pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  try {
    // Process the request through the Optimizely Edge Agent middleware
    const response = await optimizelyMiddleware(request);
    return response || NextResponse.next();
  } catch (error) {
    console.error('Optimizely Edge Agent error:', error);
    return NextResponse.next();
  }
}

export const config = {
  // Match all request paths except for API routes and static files
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
