import { loadConfig } from './config.js';
import { createPool, verifyApplicationRole } from './database.js';
import { createMailer } from './mail.js';
import { createApplication } from './app.js';
import { createHTTPServer } from './http.js';

async function main() {
  const config = loadConfig();
  const pool = createPool(config);
  const mailer = createMailer(config);
  let server: ReturnType<typeof createHTTPServer> | undefined;
  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    try {
      if (server?.listening) await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()));
      await mailer.drain();
    } finally {
      mailer.close();
      await pool.end();
    }
  };
  try {
    await verifyApplicationRole(pool, config.appRole);
    await mailer.verify();
    const app = createApplication(config, pool, mailer);
    await app.ready();
    server = createHTTPServer(config, app.handler);
    await new Promise<void>((resolve, reject) => {
      server!.once('error', reject);
      server!.listen(config.port, '127.0.0.1', () => { server!.off('error', reject); resolve(); });
    });
    console.log('Account API is ready on the loopback interface.');
    const stop = () => { void shutdown().catch(() => { console.error('Account API shutdown failed.'); process.exitCode = 1; }); };
    server.on('error', stop);
    process.once('SIGTERM', stop);
    process.once('SIGINT', stop);
  } catch {
    await shutdown();
    throw new Error('Account API startup failed. Verify server, database and mail configuration.');
  }
}
void main().catch(() => {
  console.error('Account API startup failed. Verify server, database and mail configuration.');
  process.exitCode = 1;
});
