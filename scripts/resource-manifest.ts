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
    simcanvas: createSimCanvasItems(publicRoot, simcanvasRoot),
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
