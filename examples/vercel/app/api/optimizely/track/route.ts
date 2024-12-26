import { NextRequest } from 'next/server';
import { handler as optimizelyHandler } from 'optimizely-edge-agent/vercel/function';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  return optimizelyHandler(request);
}
