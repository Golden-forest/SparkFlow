import { startPostgres } from './fixtures/postgres.js';
import { startTestSMTP } from './fixtures/smtp.js';
import { loadConfig } from '../src/config.js';
import { migrate } from '../src/migrations.js';
import { createPool, verifyApplicationRole } from '../src/database.js';
import { createMailer } from '../src/mail.js';
import { createApplication } from '../src/app.js';
import { createHTTPServer } from '../src/http.js';

if (process.env.NODE_ENV === 'production') throw new Error('The browser test fixture cannot run in production.');
process.env.NODE_ENV = 'test';
let postgres: Awaited<ReturnType<typeof startPostgres>> | undefined;
let smtp: Awaited<ReturnType<typeof startTestSMTP>> | undefined;
let pool: ReturnType<typeof createPool> | undefined;
let mailer: ReturnType<typeof createMailer> | undefined;
let server: ReturnType<typeof createHTTPServer> | undefined;
let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  let cleanupFailed = false;
  try {
    if (server?.listening) {
      const closed = new Promise<void>(resolve => server!.close(() => resolve()));
      server.closeAllConnections();
      await closed;
    }
    await mailer?.drain();
  } finally {
    mailer?.close();
    // Stop the owned DB even if an SMTP or pool socket delays its close callback.
    const results = await Promise.allSettled([pool?.end(), smtp?.close(), postgres?.close()]);
    cleanupFailed = results.some(result => result.status === 'rejected');
  }
  if (cleanupFailed) throw new Error('Disposable fixture cleanup failed.');
}
try {
  postgres = await startPostgres();
  smtp = await startTestSMTP();
  const config = loadConfig({ NODE_ENV: 'test', APP_NAME: 'Spark Flow', AUTH_BASE_URL: 'http://127.0.0.1:3100', APP_ORIGIN: 'http://127.0.0.1:4175',
    AUTH_SECRET: 'browser-fixture-only-secret-at-least-32-characters', DATABASE_URL: postgres.databaseURL,
    DATABASE_APP_ROLE: postgres.appRole, SMTP_HOST: '127.0.0.1', SMTP_PORT: '1025', SMTP_SECURE: 'false', SMTP_FROM: 'accounts@example.test',
  });
  pool = createPool(config); mailer = createMailer(config);
  await migrate(postgres.migrationURL, postgres.appRole);
  await verifyApplicationRole(pool, postgres.appRole);
  await mailer.verify();
  const app = createApplication(config, pool, mailer);
  await app.ready();
  server = createHTTPServer(config, app.handler);
  await new Promise<void>((resolve, reject) => {
    server!.once('error', reject);
    server!.listen(3100, '127.0.0.1', () => { server!.off('error', reject); resolve(); });
  });
  console.log('Disposable account browser fixture ready.');
  process.once('SIGTERM', () => { void shutdown(); });
  process.once('SIGINT', () => { void shutdown(); });
} catch (error) {
  await shutdown();
  throw error;
}
