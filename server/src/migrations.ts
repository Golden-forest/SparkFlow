import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { databaseURL, roleName } from './config.js';

export async function migrate(connectionString: string, appRole: string, directory = fileURLToPath(new URL(import.meta.url.endsWith('.ts') ? '../migrations/' : '../../migrations/', import.meta.url))): Promise<void> {
  const pool = new Pool({ connectionString: databaseURL(connectionString), max: 1, options: '-c search_path=auth,pg_catalog', connectionTimeoutMillis: 5000 });
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(hashtext('sparkflow_account_migrations'))");
    const current = (await client.query('SELECT current_user AS name, rolsuper, rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];
    if (!current || current.name === roleName(appRole) || current.rolsuper || current.rolbypassrls) throw new Error('Use a separate, non-superuser migration role.');
    await client.query('CREATE SCHEMA IF NOT EXISTS auth');
    await client.query('CREATE TABLE IF NOT EXISTS auth.schema_migrations(version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
    const files = (await readdir(directory)).filter(name => /^\d{4}_[a-z0-9_-]+\.sql$/.test(name)).sort();
    if (!files.length) throw new Error('Versioned migrations are missing.');
    for (const file of files) {
      const sql = await readFile(`${directory}/${file}`, 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const applied = (await client.query('SELECT checksum FROM auth.schema_migrations WHERE version=$1', [file])).rows[0];
      if (applied) {
        if (applied.checksum !== checksum) throw new Error('An applied migration was modified. Add a new migration instead.');
        continue;
      }
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO auth.schema_migrations(version,checksum) VALUES($1,$2)', [file, checksum]);
        await client.query('COMMIT');
      } catch (error) { await client.query('ROLLBACK'); throw error; }
    }
    const identifier = `"${roleName(appRole)}"`;
    await client.query(`GRANT USAGE ON SCHEMA auth, app TO ${identifier}`);
    for (const table of ['user', 'session', 'account', 'verification', 'rateLimit']) await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON auth."${table}" TO ${identifier}`);
    await client.query(`GRANT SELECT, INSERT, DELETE ON app.notes TO ${identifier}`);
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtext('sparkflow_account_migrations'))").catch(() => undefined);
    client.release();
    await pool.end();
  }
}
