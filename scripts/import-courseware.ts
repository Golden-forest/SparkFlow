import fs from 'node:fs';
import path from 'node:path';

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

  // Read HTML and detect resource references
  const htmlContent = fs.readFileSync(sourceAbs, 'utf-8');
  const relativePaths = extractRelativePaths(htmlContent);

  // Copy HTML as index.html
  const targetIndexHtml = path.join(targetDir, 'index.html');
  fs.copyFileSync(sourceAbs, targetIndexHtml);
  console.log(`Copied HTML: ${sourceFilename} -> courseware/${dirName}/index.html`);

  // Copy referenced resource files
  let copiedCount = 0;
  const missing: string[] = [];

  for (const relPath of relativePaths) {
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

  // Report
  console.log(`\nImport complete:`);
  console.log(`  Directory: courseware/${dirName}/`);
  console.log(`  HTML:       index.html`);
  console.log(`  Resources:  ${copiedCount} files copied`);

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
