// File: api/index.ts
import { app } from '../src/index';

async function handler(request: Request): Promise<Response> {
    return app.handle(request);
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
