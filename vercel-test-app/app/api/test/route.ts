import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Test API is working',
    runtime: 'nodejs',
    env: {
      hasSDKKey: !!process.env.OPTIMIZELY_SDK_KEY,
      nodeVersion: process.version
    }
  });
}