import { NextRequest } from 'next/server';
import optimizelyHandler from '@optimizely/optimizely-edge-agent/vercel/function';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  return optimizelyHandler(request);
}
