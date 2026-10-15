import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { ServerConfig } from './config.js';
import { createAuth } from './auth.js';
import { asUser } from './database.js';
import type { Mailer } from './mail.js';

function json(value: unknown, status = 200): Response { return Response.json(value, { status }); }

function decorate(response: Response, origin: string | null, allowedOrigin: string): Response {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('Vary', 'Origin');
  if (origin === allowedOrigin) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Credentials', 'true');
  }
  return new Response(response.body, { status: response.status, headers });
}

export function createApplication(config: ServerConfig, pool: Pool, mailer: Mailer) {
  const auth = createAuth(config, pool, mailer);
  const allowedOrigins = new Set([config.appOrigin, config.authBaseURL]);
  async function handler(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const finish = (response: Response) => decorate(response, origin, config.appOrigin);
    try {
      if (origin && !allowedOrigins.has(origin)) return finish(json({ error: 'forbidden' }, 403));
      if (request.method === 'OPTIONS') {
        if (origin !== config.appOrigin) return finish(json({ error: 'forbidden' }, 403));
        const method = request.headers.get('Access-Control-Request-Method');
        const headers = request.headers.get('Access-Control-Request-Headers')?.toLowerCase().split(',').map(value => value.trim()) ?? [];
        if (!method || !['GET', 'POST', 'DELETE'].includes(method) || headers.some(header => !['content-type'].includes(header))) {
          return finish(json({ error: 'forbidden' }, 403));
        }
        return finish(new Response(null, { status: 204, headers: {
          'Access-Control-Allow-Methods': 'GET, POST, DELETE', 'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '600',
        } }));
      }
      if (!['GET', 'HEAD'].includes(request.method) && (!origin || !allowedOrigins.has(origin))) {
        return finish(json({ error: 'forbidden' }, 403));
      }
      if (url.pathname === '/api/health' && request.method === 'GET') {
        await pool.query('SELECT 1');
        return finish(json({ status: 'ok' }));
      }
      if (url.pathname.startsWith('/api/auth/')) {
        if (['/api/auth/sign-up/email', '/api/auth/update-user'].includes(url.pathname) && request.method === 'POST') {
          const payload: unknown = await request.clone().json();
          const name = payload && typeof payload === 'object' ? (payload as Record<string, unknown>).name : undefined;
          if (name !== undefined && (typeof name !== 'string' || !name.trim() || name.length > 80)) {
            return finish(json({ error: 'invalid_request' }, 400));
          }
        }
        return finish(await auth.handler(request));
      }
      if (url.pathname === '/api/notes' || url.pathname.startsWith('/api/notes/')) {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user.emailVerified) return finish(json({ error: 'unauthorized' }, 401));
        const userId = session.user.id;
        if (url.pathname === '/api/notes' && request.method === 'GET') {
          const notes = await asUser(pool, userId, async client => (await client.query(
            'SELECT id, body, created_at AS "createdAt" FROM app.notes WHERE user_id=$1 ORDER BY created_at DESC, id DESC LIMIT 100', [userId],
          )).rows);
          return finish(json({ notes }));
        }
        if (url.pathname === '/api/notes' && request.method === 'POST') {
          const payload: unknown = await request.json();
          const body = payload && typeof payload === 'object' ? (payload as Record<string, unknown>).body : undefined;
          if (typeof body !== 'string' || !body.trim() || body.trim().length > 2000) return finish(json({ error: 'invalid_request' }, 400));
          const note = await asUser(pool, userId, async client => (await client.query(
            'INSERT INTO app.notes(id,user_id,body) VALUES($1,$2,$3) RETURNING id,body,created_at AS "createdAt"', [randomUUID(), userId, body.trim()],
          )).rows[0]);
          return finish(json({ note }, 201));
        }
        const id = url.pathname.slice('/api/notes/'.length);
        if (request.method === 'DELETE' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
          const deleted = await asUser(pool, userId, client => client.query('DELETE FROM app.notes WHERE id=$1 AND user_id=$2', [id, userId]));
          return finish(deleted.rowCount ? new Response(null, { status: 204 }) : json({ error: 'not_found' }, 404));
        }
        return finish(json({ error: 'not_found' }, 404));
      }
      return finish(json({ error: 'not_found' }, 404));
    } catch (error) {
      if (error instanceof SyntaxError) return finish(json({ error: 'invalid_request' }, 400));
      // Avoid exposing SQL errors, account details, cookies or links in responses/logs.
      return finish(json({ error: 'service_unavailable' }, 503));
    }
  }
  const ready = async () => {
    const response = await handler(new Request(`${config.authBaseURL}/api/auth/get-session`));
    if (response.status !== 200) throw new Error('Authentication schema is not ready.');
  };
  return { auth, handler, ready };
}
