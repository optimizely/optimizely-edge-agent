import { NextRequest, NextResponse } from 'next/server';

declare const optimizelyMiddleware: (request: NextRequest) => Promise<NextResponse>;
export default optimizelyMiddleware;
