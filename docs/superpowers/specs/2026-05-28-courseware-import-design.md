# Courseware Import System Design

## Problem

When copying HTML courseware files from external locations into `public/courseware/`, associated image resources (referenced via relative paths like `assets/xxx.png`) must also be copied. Currently this is a fully manual process that is easy to forget, and causes:

1. **Missing images** — HTML copied but assets directory left behind
2. **Filename conflicts** — multiple HTML files sharing a single `assets/` directory; same-named files overwrite each other
3. **ID collisions** — `toIdFromRelativePath()` strips Chinese characters, causing different Chinese-named files to produce identical manifest IDs

## Solution: Subdirectory Isolation + Import Script

### Directory Structure

Each courseware lives in its own subdirectory. The HTML is renamed to `index.html`, and its resource directories are preserved alongside it.

```
public/courseware/
├── ai-physics/
│   ├── index.html
│   └── assets/
├── ai-build-physics-sim/
│   ├── index.html
│   └── assets/
├── class-7-8-compare/
│   ├── index.html
│   └── assets/
└── ai-build-physics-sim-report/
    ├── index.html
    └── assets/
```

Access URL: `/courseware/ai-physics/` — no filename needed since it is `index.html`.

### Subdirectory Name Generation

Derived from the source HTML filename:
1. Strip extension (`.html`, `.htm`)
2. Convert to kebab-case: lowercase, replace spaces/non-alphanumeric with hyphens, collapse consecutive hyphens
3. Chinese characters are transliterated (pinyin) or removed; fallback to a short hash suffix for uniqueness

Examples:
- `AI_Physics.html` → `ai-physics`
- `用-ai-工具从零构建物理仿真实验.html` → `yong-ai-gong-ju-cong-ling-gou-jian-wu-li-fang-zhen-shi-yan` or `ai-build-physics-sim`
- `7班8班物理成绩对比分析报告0320-0512-2.html` → `class-7-8-compare`

The script should allow an optional `--name` flag to override the auto-generated directory name.

### Import Script: `scripts/import-courseware.ts`

**Usage:**
```bash
npx tsx scripts/import-courseware.ts <source-html-path> [--name <dir-name>] [--force]
```

**Behavior:**

1. **Validate input** — confirm the source file exists and is an HTML file
2. **Generate target directory name** from source filename (or use `--name` override)
3. **Create target directory** at `public/courseware/<dir-name>/`
4. **Detect referenced resources** — parse the HTML for relative-path references in `src`, `href`, `data-src`, CSS `url()`, and `<link>` attributes
5. **Copy HTML** as `index.html` to the target directory
6. **Copy only referenced resources** — for each detected relative path, locate the file relative to the source HTML's directory and copy it, preserving subdirectory structure
7. **Report** — print what was copied and warn about any referenced files that could not be found at the source
8. **Conflict handling** — if target directory already exists:
   - Without `--force`: abort with error
   - With `--force`: overwrite (delete existing directory first)

**Implementation details:**

- Use a simple regex-based HTML parser (no heavy DOM library needed in Node.js) to extract `src`, `href`, `data-src`, and CSS `url()` values
- Filter to relative paths only (not starting with `http://`, `https://`, `//`, `data:`, or `/`)
- Resolve paths relative to the source HTML's parent directory
- Copy files using `fs.cpSync` with recursive flag for directories
- The Vite `resourceManifestPlugin` will automatically detect the new files and regenerate `resource-manifest.json`

### Manifest ID Fix

Update `toIdFromRelativePath()` in `scripts/resource-manifest.ts` to handle Chinese characters. Use a content-based hash suffix to guarantee uniqueness:

```typescript
function toIdFromRelativePath(relative: string): string {
  // Keep ASCII alphanumerics and hyphens as before
  const base = relative
    .replace(/\.[^.]+$/, '')          // remove extension
    .split(/[/\\]/).join('-')
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  // Append short hash of original path to prevent collisions
  const hash = createHash('md5').update(relative).digest('hex').slice(0, 6);
  return `courseware-${base}-${hash}`;
}
```

### Existing Courseware Migration

Migrate the current flat structure to subdirectories:

| Current file | Target directory |
|---|---|
| `AI_Physics.html` | `ai-physics/index.html` |
| `用-ai-工具从零构建物理仿真实验.html` | `ai-build-physics-sim/index.html` |
| `用-ai-工具从零构建物理仿真实验.web-report.html` | `ai-build-physics-sim-report/index.html` |
| `7班8班物理成绩对比分析报告0320-0512-2.html` | `class-7-8-compare/index.html` |
| `ai赋能智启物理.html` | `ai-neng-fu-zhi-qi-wu-li/index.html` |

The shared `assets/` directory will be split: each resource file goes into the subdirectory of the courseware(s) that reference it. Duplicated files across multiple courseware are acceptable since each subdirectory is self-contained.

### npm Script

Add to `package.json`:
```json
{
  "scripts": {
    "import:courseware": "tsx scripts/import-courseware.ts"
  }
}
```

Usage: `npm run import:courseware -- /path/to/report.html`

## Scope

- In scope: import script, manifest ID fix, existing courseware migration
- Out of scope: courseware deletion, courseware metadata editing (title/description), thumbnail generation
