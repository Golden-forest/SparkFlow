import { Pool, type PoolClient } from 'pg';
import type { ServerConfig } from './config.js';

export function createPool(config: Pick<ServerConfig, 'databaseURL' | 'poolMax'>): Pool {
  const pool = new Pool({
    connectionString: config.databaseURL, max: config.poolMax,
    connectionTimeoutMillis: 5000, idleTimeoutMillis: 30_000,
    statement_timeout: 10_000, query_timeout: 12_000,
    options: '-c search_path=auth,pg_catalog',
  });
  pool.on('error', () => { console.error('An idle database connection was lost.'); });
  return pool;
}

export async function verifyApplicationRole(pool: Pool, expectedRole: string): Promise<void> {
  const { rows } = await pool.query(`SELECT current_user AS name, session_user AS login, rolsuper, rolbypassrls, rolcreaterole, rolcreatedb, rolreplication
    FROM pg_roles WHERE rolname = current_user`);
  const role = rows[0];
  if (!role || role.name !== expectedRole || role.login !== expectedRole || role.rolsuper || role.rolbypassrls || role.rolcreaterole || role.rolcreatedb || role.rolreplication) {
    throw new Error('The application requires a restricted, non-superuser database role.');
  }
  const memberships = await pool.query('SELECT 1 FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=current_user)');
  if (memberships.rowCount) throw new Error('The dedicated application role must not have parent database roles.');
  const owners = await pool.query(`SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname IN ('auth','app') AND c.relkind IN ('r','p') AND pg_has_role(current_user,c.relowner,'MEMBER')
    UNION ALL SELECT 1 FROM pg_namespace n WHERE n.nspname IN ('auth','app')
      AND (pg_has_role(current_user,n.nspowner,'MEMBER') OR has_schema_privilege(current_user,n.oid,'CREATE'))`);
  if (owners.rowCount) throw new Error('The application role must not own, inherit ownership or create objects in application schemas.');
  await pool.query('SELECT id FROM auth."user" LIMIT 0');
  const policy = await pool.query(`SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE oid='app.notes'::regclass`);
  if (!policy.rows[0]?.relrowsecurity || !policy.rows[0]?.relforcerowsecurity) throw new Error('The notes database policies are missing.');
}

export async function asUser<T>(pool: Pool, userId: string, work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  let failure: Error | undefined;
  try {
    await client.query('BEGIN');
    // LOCAL expires at transaction end; never leak one user's context to the next pooled request.
    await client.query("SELECT set_config('app.current_user_id', $1, true)", [userId]);
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    failure = error instanceof Error ? error : new Error('Database transaction failed.');
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release(failure);
  }
}
