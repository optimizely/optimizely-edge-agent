import { NextRequest } from 'next/server';

declare const optimizelyHandler: (request: NextRequest) => Promise<Response>;
export default optimizelyHandler;
