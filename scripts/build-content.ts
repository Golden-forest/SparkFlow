import fs from 'node:fs';
import path from 'node:path';
import { CONTENT_DIRECTORIES, accountBuildOrigins } from './account-build';
import { loadEnv } from 'vite';

const projectRoot = process.cwd();
const env = { ...loadEnv('production', projectRoot, ''), ...process.env };
const origins = accountBuildOrigins(env);
if (!origins) throw new Error('Configure account and resource origins before building the protected resource bundle.');
const destination = path.resolve(projectRoot, 'dist-content');
// Only this generated directory is replaced; never mutate public source files.
fs.rmSync(destination, { recursive: true, force: true });
fs.mkdirSync(destination, { recursive: true });
for (const directory of CONTENT_DIRECTORIES) {
  const source = path.join(projectRoot, 'public', directory);
  if (fs.existsSync(source)) fs.cpSync(source, path.join(destination, directory), { recursive: true });
}
fs.copyFileSync(path.join(projectRoot, 'public', '_headers'), path.join(destination, '_headers'));
fs.writeFileSync(path.join(destination, 'index.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Teaching resources</title></head><body><main><h1>Resource access ready</h1><p>Return to the application and reload the resource gallery.</p><a href="${origins.app}/">Back to the application</a></main></body></html>`);
console.log('Protected resource bundle prepared in dist-content. Configure its shared gate before deployment.');
