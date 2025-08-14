// Vercel Edge Function entry point for Optimizely Edge Agent v2
export const config = { runtime: 'edge' };

import { handleVercelEdgeRequest } from '../src-v2/vercel';

export default (req: Request) => {
  return handleVercelEdgeRequest(req, process.env as any, { waitUntil: (p: Promise<any>) => p });
};