import { createServer, type IncomingMessage } from 'node:http';
import type { ServerConfig } from './config.js';

const MAX_BODY_BYTES = 16_384;
async function readBody(incoming: IncomingMessage): Promise<Buffer | undefined> {
  if (Number(incoming.headers['content-length']) > MAX_BODY_BYTES) throw new RangeError('Request too large.');
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of incoming) {
    length += chunk.length;
    if (length > MAX_BODY_BYTES) throw new RangeError('Request too large.');
    chunks.push(Buffer.from(chunk));
  }
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

export function createHTTPServer(config: ServerConfig, handler: (request: Request) => Promise<Response>) {
  const server = createServer({ maxHeaderSize: 16_384 }, async (incoming, outgoing) => {
    try {
      const headers = new Headers();
      for (const [name, value] of Object.entries(incoming.headers)) {
        if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
      }
      // Public URL comes only from configured origin, never client-controlled Host/proxy headers.
      if (config.mode !== 'production' || !headers.get('x-real-ip')) headers.set('x-real-ip', incoming.socket.remoteAddress ?? '127.0.0.1');
      const path = incoming.url ?? '/';
      if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Invalid request target.');
      const url = new URL(path, config.authBaseURL);
      if (url.origin !== config.authBaseURL) throw new Error('Invalid request target origin.');
      const body = await readBody(incoming);
      const request = new Request(url, {
        method: incoming.method, headers, body: body ? new Uint8Array(body) : undefined,
      });
      const response = await handler(request);
      outgoing.statusCode = response.status;
      response.headers.forEach((value, name) => { if (name !== 'set-cookie') outgoing.setHeader(name, value); });
      const cookies = response.headers.getSetCookie();
      if (cookies.length) outgoing.setHeader('Set-Cookie', cookies);
      outgoing.end(incoming.method === 'HEAD' ? undefined : Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      outgoing.writeHead(error instanceof RangeError ? 413 : 400, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      outgoing.end(JSON.stringify({ error: error instanceof RangeError ? 'payload_too_large' : 'invalid_request' }));
    }
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.timeout = 20_000;
  return server;
}
