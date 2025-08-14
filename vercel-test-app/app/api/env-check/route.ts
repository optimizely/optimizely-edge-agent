import { NextResponse } from 'next/server';

export async function GET() {
  // Check for the OPTIMIZELY_SDK_KEY environment variable
  const sdkKey = process.env.OPTIMIZELY_SDK_KEY;
  
  return NextResponse.json({
    hasSdkKey: !!sdkKey,
    sdkKeyPrefix: sdkKey ? sdkKey.substring(0, 4) + '...' : null,
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV
  });
}