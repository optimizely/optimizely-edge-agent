import { NextRequest, NextResponse } from 'next/server';
// Import the pre-built Edge Agent handler
const { handleVercelEdgeRequest } = require('../../../../../dist/vercel/composition/vercelComposition.js');

// Force Node.js runtime, NOT Edge Runtime
export const runtime = 'nodejs';

// Handle all HTTP methods
export async function GET(request: NextRequest, { params }: { params: { path: string[] } }) {
  return handleRequest(request, { params });
}

export async function POST(request: NextRequest, { params }: { params: { path: string[] } }) {
  return handleRequest(request, { params });
}

export async function PUT(request: NextRequest, { params }: { params: { path: string[] } }) {
  return handleRequest(request, { params });
}

export async function DELETE(request: NextRequest, { params }: { params: { path: string[] } }) {
  return handleRequest(request, { params });
}

export async function OPTIONS(request: NextRequest, { params }: { params: { path: string[] } }) {
  return handleRequest(request, { params });
}

async function handleRequest(request: NextRequest, { params }: { params: { path: string[] } }) {
  try {
    // Get SDK key from environment
    const sdkKey = process.env.OPTIMIZELY_SDK_KEY;
    console.log('Route handler - OPTIMIZELY_SDK_KEY:', sdkKey ? `${sdkKey.substring(0, 4)}...` : 'NOT SET');
    if (!sdkKey) {
      return NextResponse.json(
        { error: 'OPTIMIZELY_SDK_KEY not configured' },
        { status: 500 }
      );
    }

    // Get the API path from params
    const apiPath = params.path?.join('/') || '';
    const url = new URL(request.url);
    
    // Create a request for the Edge Agent with the correct path
    const edgeRequest = new Request(`${url.origin}/${apiPath}${url.search}`, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });

    // Call the Edge Agent handler
    const env = {
      OPTIMIZELY_SDK_KEY: sdkKey,
      OPTIMIZELY_ADMIN_TOKEN: process.env.OPTIMIZELY_ADMIN_TOKEN,
      ...process.env
    };
    console.log('Passing to Edge Agent - OPTIMIZELY_SDK_KEY:', env.OPTIMIZELY_SDK_KEY ? `${env.OPTIMIZELY_SDK_KEY.substring(0, 4)}...` : 'NOT SET');
    
    const response = await handleVercelEdgeRequest(
      edgeRequest,
      env,
      {} // Vercel doesn't use ExecutionContext
    );
    
    return response;
  } catch (error) {
    console.error('Edge Agent error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}