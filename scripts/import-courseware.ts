import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Files larger than this will fail import (Cloudflare Pages single-file limit is 25MB; keep margin)
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

// --- CLI argument parsing ---
function parseArgs(argv: string[]): { sourcePath: string; name?: string; force?: boolean } {
  const args = argv.slice(2);
  const positional: string[] = [];
  let name: string | undefined;
  let force = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' && args[i + 1]) {
      name = args[++i];
    } else if (args[i] === '--force') {
      force = true;
    } else if (!args[i].startsWith('--')) {
      positional.push(args[i]);
    }
  }

  if (positional.length !== 1) {
    console.error('Usage: npx tsx scripts/import-courseware.ts <source.html> [--name <dir-name>] [--force]');
    process.exit(1);
  }

  return { sourcePath: positional[0], name, force };
}

// --- Directory name generation ---
function toDirName(filename: string): string {
  const withoutExt = filename.replace(/\.[^.]+$/, '');
  return withoutExt
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-zA-Z0-9\u4e00-\u9fff-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

// --- Extract and externalize base64 data URIs ---
// Replaces `data:<mime>;base64,<payload>` with `assets/inline-<sha1>.<ext>` files.
// Returns the rewritten HTML. Inline <svg>...</svg> elements are preserved.
function externalizeDataUris(htmlContent: string, targetDir: string): { html: string; extracted: number } {
  const assetsDir = path.join(targetDir, 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });

  // MIME -> extension map
  const mimeToExt: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/bmp': 'bmp',
    'image/x-icon': 'ico',
    'image/svg+xml': 'svg',
    'application/font-woff': 'woff',
    'application/font-woff2': 'woff2',
    'application/x-font-ttf': 'ttf',
    'application/x-font-otf': 'otf',
    'font/ttf': 'ttf',
    'font/otf': 'otf',
    'font/woff': 'woff',
    'font/woff2': 'woff2',
    'application/pdf': 'pdf',
    'video/mp4': 'mp4',
    'audio/mpeg': 'mp3',
  };

  // Match data URIs with optional surrounding quotes: "data:..." or 'data:...'
  // Pattern captures the data URI itself (without quotes).
  const dataUriPattern = /data:([a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)/g;

  let extracted = 0;
  const rewritten = htmlContent.replace(dataUriPattern, (fullMatch, mime: string, b64: string) => {
    const ext = mimeToExt[mime.toLowerCase()];
    if (!ext) {
      // Unknown MIME: keep the original data URI untouched
      return fullMatch;
    }

    const cleanB64 = b64.replace(/\s+/g, '');
    const buffer = Buffer.from(cleanB64, 'base64');
    const hash = crypto.createHash('sha1').update(buffer).digest('hex').slice(0, 12);
    const filename = `inline-${hash}.${ext}`;
    const filePath = path.join(assetsDir, filename);

    // Dedupe: only write if not already present
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, buffer);
    }

    extracted++;
    return `assets/${filename}`;
  });

  // Remove empty assets dir if nothing was extracted
  if (extracted === 0) {
    fs.rmSync(assetsDir, { recursive: true, force: true });
  }

  return { html: rewritten, extracted };
}

// --- Enforce max file size across an imported directory ---
function enforceMaxSize(dir: string, limit: number): void {
  const oversized: Array<{ file: string; sizeMB: number }> = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    // entry.parentPath is available in Node 20.6+
    const fullPath = path.join(entry.parentPath ?? dir, entry.name);
    const stat = fs.statSync(fullPath);
    if (stat.size > limit) {
      oversized.push({ file: path.relative(dir, fullPath), sizeMB: stat.size / (1024 * 1024) });
    }
  }
  if (oversized.length > 0) {
    console.error(`\n  Error: ${oversized.length} file(s) exceed ${limit / (1024 * 1024)}MB limit:`);
    for (const o of oversized) {
      console.error(`    - ${o.file} (${o.sizeMB.toFixed(1)} MB)`);
    }
    console.error('  Externalize inline data or split the asset, then re-run import.');
    process.exit(1);
  }
}

// --- Relative path detection from HTML ---
function extractRelativePaths(htmlContent: string): string[] {
  const attrPattern = /(?:src|href|data-src)\s*=\s*["']([^"']+)["']/gi;
  const urlPattern = /url\(\s*["']?([^"')]+)["']?\s*\)/gi;
  const allPaths: Set<string> = new Set();

  let match: RegExpExecArray | null;
  while ((match = attrPattern.exec(htmlContent)) !== null) {
    allPaths.add(match[1]);
  }
  while ((match = urlPattern.exec(htmlContent)) !== null) {
    allPaths.add(match[1]);
  }

  const skipPrefixes = ['http://', 'https://', '//', 'data:', '#', '/', 'mailto:', 'tel:', 'javascript:'];
  return [...allPaths].filter(
    (p) => p && !skipPrefixes.some((prefix) => p.startsWith(prefix)),
  );
}

// --- Main import logic ---
function importCourseware(sourcePath: string, nameOverride: string | undefined, force: boolean): void {
  const projectRoot = process.cwd();
  const sourceAbs = path.resolve(sourcePath);
  const sourceDir = path.dirname(sourceAbs);
  const sourceFilename = path.basename(sourceAbs);

  // Validate
  if (!fs.existsSync(sourceAbs)) {
    console.error(`Error: Source file not found: ${sourceAbs}`);
    process.exit(1);
  }

  const ext = path.extname(sourceAbs).toLowerCase();
  if (ext !== '.html' && ext !== '.htm') {
    console.error(`Error: Source file is not an HTML file: ${sourceAbs}`);
    process.exit(1);
  }

  // Generate target directory name
  const dirName = nameOverride || toDirName(sourceFilename);
  const coursewareRoot = path.resolve(projectRoot, 'public', 'courseware');
  const targetDir = path.join(coursewareRoot, dirName);

  // Conflict handling
  if (fs.existsSync(targetDir)) {
    if (!force) {
      console.error(`Error: Target directory already exists: courseware/${dirName}`);
      console.error('Use --force to overwrite.');
      process.exit(1);
    }
    fs.rmSync(targetDir, { recursive: true, force: true });
    console.log(`Removed existing directory: courseware/${dirName}`);
  }

  // Create target directory
  fs.mkdirSync(targetDir, { recursive: true });

  // Read HTML and externalize inline base64 data URIs
  const htmlContent = fs.readFileSync(sourceAbs, 'utf-8');
  const { html: rewrittenHtml, extracted: externalizedCount } = externalizeDataUris(htmlContent, targetDir);

  // Write index.html (with data URIs replaced by asset references)
  const targetIndexHtml = path.join(targetDir, 'index.html');
  fs.writeFileSync(targetIndexHtml, rewrittenHtml, 'utf-8');
  console.log(`Wrote HTML: ${sourceFilename} -> courseware/${dirName}/index.html`);
  if (externalizedCount > 0) {
    console.log(`  Externalized ${externalizedCount} inline base64 resource(s) -> assets/`);
  }

  // Detect referenced resource files from the REWRITTEN HTML (so asset paths win)
  const relativePaths = extractRelativePaths(rewrittenHtml);

  // Copy referenced resource files (skip the ones we just created under assets/)
  let copiedCount = 0;
  const missing: string[] = [];

  for (const relPath of relativePaths) {
    // Skip our own generated asset references
    if (relPath.startsWith('assets/inline-')) continue;

    const sourceFile = path.resolve(sourceDir, relPath);
    const targetFile = path.join(targetDir, relPath);

    if (fs.existsSync(sourceFile)) {
      fs.mkdirSync(path.dirname(targetFile), { recursive: true });
      fs.copyFileSync(sourceFile, targetFile);
      copiedCount++;
    } else {
      missing.push(relPath);
    }
  }

  // Enforce max single-file size (catches oversized imports before they hit Pages limit)
  enforceMaxSize(targetDir, MAX_FILE_SIZE);

  // Report
  console.log(`\nImport complete:`);
  console.log(`  Directory: courseware/${dirName}/`);
  console.log(`  HTML:       index.html`);
  console.log(`  Resources:  ${copiedCount} file(s) copied`);
  console.log(`  Externalized: ${externalizedCount} inline asset(s)`);

  if (missing.length > 0) {
    console.log(`\n  Warning: ${missing.length} referenced resource(s) not found at source:`);
    for (const m of missing) {
      console.log(`    - ${m}`);
    }
  }

  console.log(`\n  Access URL: /courseware/${dirName}/`);
}

// --- Entry point ---
const { sourcePath, name, force } = parseArgs(process.argv);
importCourseware(sourcePath, name, force);
