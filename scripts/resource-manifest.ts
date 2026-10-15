import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface ManifestItem {
  id: string;
  title: string;
  path: string;
  category?: string;
}

export interface ResourceManifest {
  generatedAt: string;
  courseware: ManifestItem[];
  simcanvas: ManifestItem[];
  images: ManifestItem[];
}

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.avif']);

function ensureDirectory(directory: string): void {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
}

function toTitleFromFilename(filename: string): string {
  const withoutExt = filename.replace(/\.[^/.]+$/, '');
  const words = withoutExt
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  if (words.length === 0) return 'Untitled Resource';
  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

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

function walkFiles(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function toPublicWebPath(publicRoot: string, filePath: string): string {
  const relative = path.relative(publicRoot, filePath).split(path.sep).join('/');
  return `/${relative}`;
}

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

function createCoursewareItems(publicRoot: string, coursewareRoot: string): ManifestItem[] {
  return createSubdirectoryIndexItems(publicRoot, coursewareRoot, 'courseware');
}

function createSimCanvasItems(publicRoot: string, simcanvasRoot: string): ManifestItem[] {
  return createSubdirectoryIndexItems(publicRoot, simcanvasRoot, 'simcanvas');
}

/**
 * Scan `baseDirectory` for subdirectories containing an `index.html`,
 * producing one ManifestItem per such subdirectory.
 * Used by both courseware and simcanvas tabs which follow the same pattern.
 */
function createSubdirectoryIndexItems(
  publicRoot: string,
  baseDirectory: string,
  prefix: string,
): ManifestItem[] {
  if (!fs.existsSync(baseDirectory)) return [];

  const entries = fs.readdirSync(baseDirectory, { withFileTypes: true });
  const items: ManifestItem[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    // Local page (index.html) or remote link (meta.json with external path) —
    // either one makes a gallery entry.
    const indexPath = path.join(baseDirectory, entry.name, 'index.html');
    const metaPath = path.join(baseDirectory, entry.name, 'meta.json');
    if (!fs.existsSync(indexPath) && !fs.existsSync(metaPath)) continue;

    // Optional sidecar metadata (e.g. public/simcanvas/<slug>/meta.json written
    // by the sync script) overrides the filename-derived title, and may carry a
    // `path` pointing at an external URL (animations are embedded from the
    // SimCanvas server's public share route instead of local files).
    let title = toTitleFromFilename(entry.name);
    let category: string | undefined;
    let externalPath: string | undefined;
    if (fs.existsSync(metaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        if (meta.archived === true) continue; // archived: files stay, gallery hides
        if (typeof meta.title === 'string' && meta.title.trim()) title = meta.title.trim();
        if (typeof meta.category === 'string' && meta.category.trim()) category = meta.category.trim();
        if (typeof meta.path === 'string' && /^https?:\/\//.test(meta.path)) externalPath = meta.path;
      } catch {
        // malformed meta.json: fall back to filename-derived title
      }
    }

    const publicDirPath = `/${path.relative(publicRoot, baseDirectory).split(path.sep).join('/')}/${entry.name}`;
    const relative = `${path.relative(publicRoot, baseDirectory).split(path.sep).join('/')}/${entry.name}/index.html`;
    items.push({
      id: toIdFromRelativePath(relative, prefix),
      title,
      path: externalPath ?? `${publicDirPath}/`,
      ...(category ? { category } : {}),
    });
  }

  return items.sort((a, b) => a.id.localeCompare(b.id));
}

/** Short card title from a rating-manifest `bg` paragraph: cut at the first
 * design-intent marker or punctuation, e.g. "碳-14 测年想做成考古情境：…" → "碳-14 测年". */
function researchTitle(bg: string): string {
  const head = bg.split(/想做成|想做|做成|想用|想呈现|想把|想给学生|想带/)[0];
  const trimmed = head.trim().replace(/[，。：；！？、\s]+$/, '');
  if (trimmed.length >= 2 && trimmed.length <= 20) return trimmed;
  const clause = trimmed.split(/[，。：；！？]/)[0].trim();
  return (clause || trimmed).slice(0, 20) || '实验动画';
}

/** Paper-lab artifacts from public/rating/ (flat .html files, listed in
 * rating/manifest.json with task backgrounds). Surfaced as gallery cards under
 * the dedicated 论文实验 tab; kept out of the 全部 tab by Home.tsx. */
function createResearchItems(publicRoot: string): ManifestItem[] {
  const manifestPath = path.join(publicRoot, 'rating', 'manifest.json');
  if (!fs.existsSync(manifestPath)) return [];
  const rating = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as {
    rateable?: Array<{ id: string; bg: string }>;
    browse?: Array<{ id: string; bg: string }>;
  };
  const items: ManifestItem[] = [];
  const groups: Array<['artifacts' | 'browse', Array<{ id: string; bg: string }> | undefined]> = [
    ['artifacts', rating.rateable],
    ['browse', rating.browse],
  ];
  for (const [subdir, entries] of groups) {
    for (const entry of entries ?? []) {
      const file = path.join(publicRoot, 'rating', subdir, `${entry.id}.html`);
      if (!fs.existsSync(file)) continue;
      items.push({
        id: `rating-${entry.id}`,
        title: researchTitle(entry.bg ?? ''),
        path: `/rating/${subdir}/${entry.id}.html`,
        category: 'research',
      });
    }
  }
  return items;
}

export function generateResourceManifest(projectRoot: string): ResourceManifest {
  const publicRoot = path.resolve(projectRoot, 'public');
  const coursewareRoot = path.resolve(publicRoot, 'courseware');
  const simcanvasRoot = path.resolve(publicRoot, 'simcanvas');
  const imagesRoot = path.resolve(publicRoot, 'images');

  ensureDirectory(publicRoot);
  ensureDirectory(coursewareRoot);
  ensureDirectory(simcanvasRoot);
  ensureDirectory(imagesRoot);

  const manifest: ResourceManifest = {
    generatedAt: new Date().toISOString(),
    courseware: createCoursewareItems(publicRoot, coursewareRoot),
    simcanvas: [...createSimCanvasItems(publicRoot, simcanvasRoot), ...createResearchItems(publicRoot)],
    images: createItems(publicRoot, imagesRoot, IMAGE_EXTENSIONS, 'images'),
  };

  const outputPath = path.resolve(publicRoot, 'resource-manifest.json');
  fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2), 'utf-8');
  return manifest;
}

// CLI entry: regenerate public/resource-manifest.json when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const manifest = generateResourceManifest(process.cwd());
  console.log(
    `resource-manifest.json regenerated: ${manifest.courseware.length} courseware, ` +
      `${manifest.simcanvas.length} simcanvas, ${manifest.images.length} images`,
  );
}
