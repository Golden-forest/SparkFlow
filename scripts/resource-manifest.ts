import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface ManifestItem {
  id: string;
  title: string;
  path: string;
}

export interface ResourceManifest {
  generatedAt: string;
  courseware: ManifestItem[];
  images: ManifestItem[];
}

const COURSEWARE_EXTENSIONS = new Set(['.html', '.htm']);
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

export function generateResourceManifest(projectRoot: string): ResourceManifest {
  const publicRoot = path.resolve(projectRoot, 'public');
  const coursewareRoot = path.resolve(publicRoot, 'courseware');
  const imagesRoot = path.resolve(publicRoot, 'images');

  ensureDirectory(publicRoot);
  ensureDirectory(coursewareRoot);
  ensureDirectory(imagesRoot);

  const manifest: ResourceManifest = {
    generatedAt: new Date().toISOString(),
    courseware: createItems(publicRoot, coursewareRoot, COURSEWARE_EXTENSIONS, 'courseware'),
    images: createItems(publicRoot, imagesRoot, IMAGE_EXTENSIONS, 'images'),
  };

  const outputPath = path.resolve(publicRoot, 'resource-manifest.json');
  fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2), 'utf-8');
  return manifest;
}
