interface ResourceEntry {
  id: string;
  title: string;
  path: string;
  category?: string;
}

export interface ResourceManifest {
  courseware: ResourceEntry[];
  simcanvas: ResourceEntry[];
  images: ResourceEntry[];
}

function isResourcePath(path: string, kind: keyof ResourceManifest): boolean {
  if (path.includes('\\') || [...path].some((character) => character.charCodeAt(0) < 32)) return false;
  try {
    const url = new URL(path, 'https://app.invalid');
    if (url.username || url.password) return false;
    if (path.startsWith(`/${kind}/`)) {
      return url.origin === 'https://app.invalid' && url.pathname.startsWith(`/${kind}/`);
    }
    // Gallery (simcanvas) cards may also point at the paper-lab artifacts
    // served from /rating/ — same static public/ content, different directory.
    if (kind === 'simcanvas' && path.startsWith('/rating/')) {
      return url.origin === 'https://app.invalid' && url.pathname.startsWith('/rating/');
    }
    // Sidecar metadata already supports external gallery pages.
    return kind !== 'images' && /^https?:\/\//.test(path)
      && (url.protocol === 'https:' || url.protocol === 'http:');
  } catch {
    return false;
  }
}

export function decodeResourceManifest(value: unknown): ResourceManifest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid resource manifest.');
  const input = value as Record<string, unknown>;
  const decodeEntries = (key: keyof ResourceManifest): ResourceEntry[] => {
    const entries = input[key];
    if (!Array.isArray(entries)) throw new Error('Invalid resource list.');
    return entries.map((entry: unknown) => {
      if (!entry || typeof entry !== 'object') throw new Error('Invalid resource.');
      const item = entry as Record<string, unknown>;
      if (typeof item.id !== 'string' || typeof item.title !== 'string'
        || typeof item.path !== 'string' || !isResourcePath(item.path, key)
        || (item.category !== undefined && typeof item.category !== 'string')) {
        throw new Error('Invalid resource metadata.');
      }
      return { id: item.id, title: item.title, path: item.path, category: item.category as string | undefined };
    });
  };
  return { courseware: decodeEntries('courseware'), simcanvas: decodeEntries('simcanvas'), images: decodeEntries('images') };
}
