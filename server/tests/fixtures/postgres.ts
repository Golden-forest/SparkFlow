import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { randomBytes } from 'node:crypto';
import { Pool } from 'pg';
const run = promisify(execFile);
export async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No local port available.');
  const port = address.port;
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}
async function binaries(): Promise<string> {
  const candidates = [process.env.POSTGRES_BIN, process.env.PG_BIN, '/opt/homebrew/opt/postgresql@15/bin', '/opt/homebrew/opt/postgresql@16/bin', '/usr/lib/postgresql/18/bin', '/usr/lib/postgresql/17/bin', '/usr/lib/postgresql/16/bin', '/usr/lib/postgresql/15/bin'];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try { await access(join(candidate, 'initdb')); return candidate; } catch { /* Try next installed version. */ }
  }
  throw new Error('Install PostgreSQL binaries or set PG_BIN. Integration tests never skip database isolation checks.');
}
export async function startPostgres() {
  if (process.env.NODE_ENV === 'production') throw new Error('Test databases cannot run in production mode.');
  const bin = await binaries();
  const directory = await mkdtemp(join(tmpdir(), 'sparkflow-account-test-'));
  const data = join(directory, 'data');
  const port = await freePort();
  let started = false;
  const close = async () => {
    if (started) await run(join(bin, 'pg_ctl'), ['-D', data, '-m', 'immediate', '-w', 'stop']);
    started = false;
    await rm(directory, { recursive: true, force: true });
  };
  try {
    await run(join(bin, 'initdb'), ['-D', data, '--auth-local=trust', '--auth-host=trust', '-U', 'fixture_admin', '--no-locale', '-E', 'UTF8']);
    await run(join(bin, 'pg_ctl'), ['-D', data, '-l', join(directory, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port} -k ${directory}`, '-w', 'start']);
    started = true;
    const admin = new Pool({ connectionString: `postgresql://fixture_admin@127.0.0.1:${port}/postgres`, max: 1 });
    const appRole = 'sparkflow_test_app';
    const migrationRole = 'sparkflow_test_migrator';
    const password = randomBytes(32).toString('hex');
    try {
      await admin.query(`CREATE ROLE ${appRole} LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION PASSWORD '${password}'`);
      await admin.query(`CREATE ROLE ${migrationRole} LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION PASSWORD '${password}'`);
      await admin.query(`CREATE DATABASE sparkflow_accounts OWNER ${migrationRole}`);
    } finally { await admin.end(); }
    return { appRole, migrationRole, adminURL: `postgresql://fixture_admin@127.0.0.1:${port}/sparkflow_accounts`, databaseURL: `postgresql://${appRole}:${password}@127.0.0.1:${port}/sparkflow_accounts`, migrationURL: `postgresql://${migrationRole}:${password}@127.0.0.1:${port}/sparkflow_accounts`, close };
  } catch (error) { await close(); throw error; }
}
