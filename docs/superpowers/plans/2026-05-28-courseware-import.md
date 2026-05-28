# Courseware Import System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create an import script that copies HTML courseware with its referenced assets into isolated subdirectories, fixing the resource-missing and filename-conflict problems permanently.

**Architecture:** A standalone Node.js CLI script (`scripts/import-courseware.ts`) that parses source HTML for relative-path resource references, copies HTML as `index.html` into a new subdirectory under `public/courseware/`, and copies only the referenced resource files. The existing Vite plugin auto-regenerates the manifest. A fix to `toIdFromRelativePath()` adds content-hash suffixes to prevent ID collisions from Chinese filenames.

**Tech Stack:** Node.js (fs, path, crypto), TypeScript, tsx runner

---

### File Map

| File | Responsibility |
|------|---------------|
| `scripts/import-courseware.ts` | **Create** — CLI script: parse args, detect resources, copy files |
| `scripts/resource-manifest.ts:39-47` | **Modify** — Fix `toIdFromRelativePath()` to use content hash suffix |
| `scripts/resource-manifest.ts:16` | **Modify** — Change `createItems` to skip `index.html` files in subdirectories (avoid picking up courseware's own index.html as a separate entry) |
| `package.json:6-13` | **Modify** — Add `import:courseware` npm script |
| `public/courseware/*` | **Restructure** — Migrate existing flat HTML files into subdirectories via the new script |

---

### Task 1: Fix Manifest ID Collision

**Files:**
- Modify: `scripts/resource-manifest.ts:1-2` (add crypto import)
- Modify: `scripts/resource-manifest.ts:39-47` (rewrite `toIdFromRelativePath`)

- [ ] **Step 1: Add crypto import and fix `toIdFromRelativePath`**

At line 1, change:
```typescript
import fs from 'node:fs';
import path from 'node:path';
```
to:
```typescript
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
```

Replace lines 39-47 (`toIdFromRelativePath` function) with:
```typescript
function toIdFromRelativePath(relativePath: string, prefix = 'resource'): string {
  const base = relativePath
    .replace(/\.[^/.]+$/, '')
    .replace(/[\\/]+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  const hash = crypto.createHash('md5').update(relativePath).digest('hex').slice(0, 6);
  return `${prefix}-${base}-${hash}`;
}
```

Then update `createItems` (line 80) to pass the correct prefix:
```typescript
return {
  id: toIdFromRelativePath(relative, 'courseware'),
  title: toTitleFromFilename(path.basename(filePath)),
  path: publicPath,
};
```

And line 98-99 to pass prefixes per type:
```typescript
const manifest: ResourceManifest = {
  generatedAt: new Date().toISOString(),
  courseware: createItems(publicRoot, coursewareRoot, COURSEWARE_EXTENSIONS, 'courseware'),
  images: createItems(publicRoot, imagesRoot, IMAGE_EXTENSIONS, 'images'),
};
```

Update `createItems` signature to accept prefix:
```typescript
function createItems(publicRoot: string, baseDirectory: string, extensions: Set<string>, prefix: string): ManifestItem[] {
```

- [ ] **Step 2: Run dev server and verify manifest generates without errors**

Run: `npm run dev`
Expected: Server starts, `public/resource-manifest.json` is regenerated with hash-suffixed IDs.

- [ ] **Step 3: Verify no duplicate IDs in manifest**

Run: `cat public/resource-manifest.json | python3 -c "import json,sys; d=json.load(sys.stdin); ids=[i['id'] for i in d['courseware']]; print('DUPLICATE' if len(ids)!=len(set(ids)) else 'OK')"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add scripts/resource-manifest.ts
git commit -m "fix: add content-hash suffix to manifest IDs to prevent collisions"
```

---

### Task 2: Fix Manifest Picking Up Subdirectory index.html Files

After migration, each courseware subdirectory will have an `index.html`. The current `walkFiles` + `createItems` logic will list these as separate courseware entries (e.g. `/courseware/ai-physics/index.html` alongside the directory-level entry). We need to skip `index.html` files that are inside subdirectories — only include top-level HTML files or files with non-index names.

**Files:**
- Modify: `scripts/resource-manifest.ts` — update `createItems` to filter out `index.html` files in subdirectories

- [ ] **Step 1: Add filter in `createItems` to skip `index.html` inside subdirectories**

In `createItems`, after the `files.filter(...)` line, add a filter to exclude `index.html` files that are not direct children of the base directory:

```typescript
function createItems(publicRoot: string, baseDirectory: string, extensions: Set<string>, prefix: string): ManifestItem[] {
  const files = walkFiles(baseDirectory)
    .filter((filePath) => extensions.has(path.extname(filePath).toLowerCase()))
    .filter((filePath) => {
      // Skip index.html files inside subdirectories (courseware subdirs use index.html as entry point)
      const relative = path.relative(baseDirectory, filePath);
      const parts = relative.split(path.sep);
      if (path.basename(filePath) === 'index.html' && parts.length > 1) {
        return false;
      }
      return true;
    })
    .sort((a, b) => a.localeCompare(b));

  return files.map((filePath) => {
    const publicPath = toPublicWebPath(publicRoot, filePath);
    const relative = path.relative(publicRoot, filePath).split(path.sep).join('/');
    return {
      id: toIdFromRelativePath(relative, prefix),
      title: toTitleFromFilename(path.basename(filePath)),
      path: publicPath,
    };
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/resource-manifest.ts
git commit -m "fix: skip index.html in subdirectories from courseware manifest"
```

---

### Task 3: Create Import Script

**Files:**
- Create: `scripts/import-courseware.ts`

- [ ] **Step 1: Write the import script**

Create `scripts/import-courseware.ts`:

```typescript
import crypto from 'node:crypto';
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
  // Match src, href, data-src attribute values and CSS url() references
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

  // Filter: only relative paths (not absolute, not protocol, not data URI, not hash-only)
  const relativePaths: string[] = [];
  for (const p of allPaths) {
    if (
      p &&
      !p.startsWith('http://') &&
      !p.startsWith('https://') &&
      !p.startsWith('//') &&
      !p.startsWith('data:') &&
      !p.startsWith('#') &&
      !p.startsWith('/') &&
      !p.startsWith('mailto:') &&
      !p.startsWith('tel:') &&
      !p.startsWith('javascript:')
    ) {
      relativePaths.push(p);
    }
  }

  // De-duplicate and extract unique directory prefixes (e.g. "assets/foo.png" -> "assets")
  return [...allPaths];
}

function findResourceDirectories(relativePaths: string[]): string[] {
  const dirs = new Set<string>();
  for (const p of relativePaths) {
    // Only consider paths that look like file references with subdirectories
    const parts = p.split('/').filter(Boolean);
    if (parts.length > 1) {
      dirs.add(parts[0]);
    }
  }
  return [...dirs];
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
      console.error(`Error: Target directory already exists: ${targetDir}`);
      console.error('Use --force to overwrite.');
      process.exit(1);
    }
    fs.rmSync(targetDir, { recursive: true, force: true });
    console.log(`Removed existing directory: ${targetDir}`);
  }

  // Create target directory
  fs.mkdirSync(targetDir, { recursive: true });

  // Read HTML and detect resource references
  const htmlContent = fs.readFileSync(sourceAbs, 'utf-8');
  const relativePaths = extractRelativePaths(htmlContent);
  const resourceDirs = findResourceDirectories(relativePaths);

  // Copy HTML as index.html
  const targetIndexHtml = path.join(targetDir, 'index.html');
  fs.copyFileSync(sourceAbs, targetIndexHtml);
  console.log(`Copied HTML: ${sourceFilename} -> ${path.relative(projectRoot, targetIndexHtml)}`);

  // Copy referenced resource directories/files
  let copiedCount = 0;
  const missing: string[] = [];

  for (const relPath of relativePaths) {
    const sourceFile = path.resolve(sourceDir, relPath);
    const targetFile = path.join(targetDir, relPath);

    if (fs.existsSync(sourceFile)) {
      // Ensure parent directory exists
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
  console.log(`  HTML:     index.html`);
  console.log(`  Resources: ${copiedCount} files copied`);

  if (missing.length > 0) {
    console.log(`\n  ⚠ Warning: ${missing.length} referenced resource(s) not found at source:`);
    for (const m of missing) {
      console.log(`    - ${m}`);
    }
  }

  console.log(`\n  Access URL: /courseware/${dirName}/`);
}

// --- Entry point ---
const { sourcePath, name, force } = parseArgs(process.argv);
importCourseware(sourcePath, name, force);
```

- [ ] **Step 2: Test with an existing HTML file**

Run: `npx tsx scripts/import-courseware.ts "/Users/hl/Projects/CopyClaw/backend/data/web_report/7班8班物理成绩对比分析报告0320-0512-2.html" --name test-import`
Expected: Creates `public/courseware/test-import/index.html` with referenced assets copied, prints file count and access URL.

- [ ] **Step 3: Verify the copied files load correctly in browser**

Open `http://localhost:5173/courseware/test-import/` in browser.
Expected: Page loads with all images visible.

- [ ] **Step 4: Clean up test import**

Run: `rm -rf public/courseware/test-import`

- [ ] **Step 5: Commit**

```bash
git add scripts/import-courseware.ts
git commit -m "feat: add courseware import script with asset auto-detection"
```

---

### Task 4: Add npm Script

**Files:**
- Modify: `package.json:6-13`

- [ ] **Step 1: Add `import:courseware` script**

In `package.json`, inside `"scripts"`, add after the `lint` line:
```json
"import:courseware": "tsx scripts/import-courseware.ts",
```

- [ ] **Step 2: Verify npm script works**

Run: `npm run import:courseware -- "/Users/hl/Projects/CopyClaw/backend/data/web_report/7班8班物理成绩对比分析报告0320-0512-2.html" --name test-npm`
Expected: Same result as direct tsx invocation.

- [ ] **Step 3: Clean up**

Run: `rm -rf public/courseware/test-npm`

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "feat: add import:courseware npm script"
```

---

### Task 5: Migrate Existing Courseware to Subdirectories

This is the final step — remove the flat HTML files and shared `assets/` from `public/courseware/`, then re-import each one through the script.

**Files:**
- Delete: `public/courseware/*.html` (flat files)
- Delete: `public/courseware/assets/` (shared assets directory)

- [ ] **Step 1: Import each existing courseware using the script**

Run these commands sequentially:

```bash
# From the CopyClaw source (has assets alongside HTML)
npx tsx scripts/import-courseware.ts "/Users/hl/Projects/CopyClaw/backend/data/web_report/用-ai-工具从零构建物理仿真实验.html" --name ai-build-physics-sim

npx tsx scripts/import-courseware.ts "/Users/hl/Projects/CopyClaw/backend/data/web_report/用-ai-工具从零构建物理仿真实验.web-report.html" --name ai-build-physics-sim-report

npx tsx scripts/import-courseware.ts "/Users/hl/Projects/CopyClaw/backend/data/web_report/7班8班物理成绩对比分析报告0320-0512-2.html" --name class-7-8-compare
```

- [ ] **Step 2: Move AI_Physics.html into its own subdirectory**

`AI_Physics.html` (81 MB) is a standalone self-contained file (images are likely base64 inlined). Move it directly:

```bash
mkdir -p public/courseware/ai-physics
mv "public/courseware/AI_Physics.html" public/courseware/ai-physics/index.html
```

- [ ] **Step 3: Move ai赋能智启物理.html into its own subdirectory**

This file may reference the shared `assets/` directory. Check if its resources were already copied by the other imports, then move:

```bash
# Check what resources it references
grep -o 'src="[^"]*"' "public/courseware/ai赋能智启物理.html" | head -20
```

Then import from source or manually move. If it was originally from the same CopyClaw directory and its assets were already copied:

```bash
npx tsx scripts/import-courseware.ts "/Users/hl/Projects/CopyClaw/backend/data/web_report/ai赋能智启物理.html" --name ai-fu-zhi-qi-wu-li
```

If the source file doesn't exist at that path, it may have been the original file before the session. In that case, move it manually and copy relevant assets from the existing shared `assets/`:

```bash
mkdir -p public/courseware/ai-fu-zhi-qi-wu-li
mv "public/courseware/ai赋能智启物理.html" public/courseware/ai-fu-zhi-qi-wu-li/index.html
# Copy assets it references from the shared assets/ directory
```

- [ ] **Step 4: Remove old flat HTML files and shared assets/ directory**

After confirming all subdirectories are created and working:

```bash
rm "public/courseware/7班8班物理成绩对比分析报告0320-0512-2.html"
rm "public/courseware/用-ai-工具从零构建物理仿真实验.html"
rm "public/courseware/用-ai-工具从零构建物理仿真实验.web-report.html"
rm -rf "public/courseware/assets"
```

- [ ] **Step 5: Verify manifest regenerated correctly**

Run: `cat public/resource-manifest.json | python3 -c "import json,sys; d=json.load(sys.stdin); [print(f\"{i['id']} -> {i['path']}\") for i in d['courseware']]"`
Expected: Each courseware has a unique ID and points to a subdirectory path like `/courseware/ai-physics/index.html` (which won't appear because Task 2 filtered it out — the path should be the directory URL).

**Important check:** Since Task 2 filters out `index.html` in subdirectories, and the only HTML files left will be inside subdirectories, the manifest courseware list will be **empty**. This needs a different approach — see Step 6.

- [ ] **Step 6: Adjust manifest logic — courseware entries should be the directory, not the file**

The manifest should represent each subdirectory as a courseware entry, not individual HTML files. Update `createItems` in `resource-manifest.ts` to detect directories containing `index.html`:

Replace the courseware generation in `generateResourceManifest` with a new function:

```typescript
function createCoursewareItems(publicRoot: string, coursewareRoot: string): ManifestItem[] {
  if (!fs.existsSync(coursewareRoot)) return [];

  const entries = fs.readdirSync(coursewareRoot, { withFileTypes: true });
  const items: ManifestItem[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const indexPath = path.join(coursewareRoot, entry.name, 'index.html');
    if (!fs.existsSync(indexPath)) continue;

    const publicDirPath = `/${path.relative(publicRoot, coursewareRoot).split(path.sep).join('/')}/${entry.name}`;
    const relative = `${path.relative(publicRoot, coursewareRoot).split(path.sep).join('/')}/${entry.name}/index.html`;
    items.push({
      id: toIdFromRelativePath(relative, 'courseware'),
      title: toTitleFromFilename(entry.name),
      path: `${publicDirPath}/`,
    });
  }

  return items.sort((a, b) => a.id.localeCompare(b.id));
}
```

Then update `generateResourceManifest`:
```typescript
const manifest: ResourceManifest = {
  generatedAt: new Date().toISOString(),
  courseware: createCoursewareItems(publicRoot, coursewareRoot),
  images: createItems(publicRoot, imagesRoot, IMAGE_EXTENSIONS, 'images'),
};
```

And revert the `createItems` function to its simpler form (remove the index.html filter from Task 2, since `createItems` is only used for images now):
```typescript
function createItems(publicRoot: string, baseDirectory: string, extensions: Set<string>, prefix: string): ManifestItem[] {
  const files = walkFiles(baseDirectory)
    .filter((filePath) => extensions.has(path.extname(filePath).toLowerCase()))
    .sort((a, b) => a.localeCompare(b));

  return files.map((filePath) => {
    const publicPath = toPublicWebPath(publicRoot, filePath);
    const relative = path.relative(publicRoot, filePath).split(path.sep).join('/');
    return {
      id: toIdFromRelativePath(relative, prefix),
      title: toTitleFromFilename(path.basename(filePath)),
      path: publicPath,
    };
  });
}
```

- [ ] **Step 7: Verify dev server shows all courseware**

Run: `npm run dev` (restart if already running)
Open: `http://localhost:5173/` → Courseware tab
Expected: 5 courseware cards, each linking to `/courseware/<name>/`, all with unique IDs.

- [ ] **Step 8: Verify each courseware page loads correctly**

Open each courseware URL in browser tabs, confirm images render:
- `/courseware/ai-physics/`
- `/courseware/ai-build-physics-sim/`
- `/courseware/ai-build-physics-sim-report/`
- `/courseware/class-7-8-compare/`
- `/courseware/ai-fu-zhi-qi-wu-li/`

- [ ] **Step 9: Commit**

```bash
git add scripts/resource-manifest.ts public/courseware/
git commit -m "feat: migrate courseware to subdirectory structure with import script"
```
