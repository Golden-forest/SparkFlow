import { migrate } from '../src/migrations.js';
import { roleName } from '../src/config.js';
void migrate(process.env.MIGRATION_DATABASE_URL ?? '', roleName(process.env.DATABASE_APP_ROLE)).then(() => {
  console.log('Account database migrations completed.');
}).catch(() => {
  console.error('Account database migration failed. Verify role permissions, migration files and database connectivity.');
  process.exitCode = 1;
});
