# 部署指南 (Cloudflare Pages)

> **AI 助手请先完整阅读本文档，再执行任何部署操作。**
> 项目部署在 Cloudflare Pages，项目名 `sparkflow`，线上地址 https://sparkflow-840.pages.dev

---

## 部署目标

- **平台**：Cloudflare Pages
- **项目名**：`sparkflow`
- **生产域名**：https://sparkflow-840.pages.dev
- **GitHub 仓库**：https://github.com/Golden-forest/SparkFlow
- **本地代理**：`127.0.0.1:7897`（git 已配置，访问 github.com 必需）

## 核心原则

**只有 `dist/` 目录的内容会部署到线上。** 任何对源文件的修改，必须先经过 build 进入 `dist/`，否则线上不会变化。

## 标准部署流程

### 情况 1：只改了 React 代码（`src/` 下）

最简单的情况，直接两条命令：

```bash
npm run build
npx wrangler pages deploy dist --project-name=sparkflow
```

### 情况 2：改了/加了图片或纹理（`public/images/`、`public/textures/`）

也是直接两条命令——`vite.config.ts` 的 `resourceManifestPlugin` 会在 build 时自动扫描 `public/images/` 和 `public/courseware/`，重新生成 `resource-manifest.json`：

```bash
npm run build
npx wrangler pages deploy dist --project-name=sparkflow
```

### 情况 3：改了/加了课件 HTML（`public/courseware/`）⚠️

**这是唯一需要额外步骤的情况。** 课件源文件不在 `public/` 里，必须先 import。

#### 加新课件
```bash
npx tsx scripts/import-courseware.ts /path/to/source.html --name <dir-name>
```

#### 改已有课件（覆盖）
```bash
npx tsx scripts/import-courseware.ts /path/to/source.html --name <existing-name> --force
```

#### 然后才部署
```bash
npm run build
npx wrangler pages deploy dist --project-name=sparkflow
```

> **重要**：import 脚本会自动外置 base64 内联资源到 `assets/inline-*.{ext}`，并校验单文件 ≤ 20MB（Cloudflare Pages 限制 25MB）。不要绕过脚本手动改 `public/courseware/`。

## 部署前检查清单

部署前 AI 必须确认以下事项：

- [ ] **TypeScript 无报错**：build 命令是 `tsc -b && vite build`，TS 严格模式有类型错误会直接 fail。可以提前跑 `npx tsc --noEmit` 检查。
- [ ] **未追踪的大文件**：检查 `public/` 下是否有超过 20MB 的文件，超过会部署失败。
- [ ] **wrangler 登录状态**：跑 `npx wrangler whoami` 确认已登录（账号 `2664375181@qq.com`）。失效时跑 `npx wrangler login`。
- [ ] **git 工作区状态**：部署与 git 状态无关，但建议先 commit，便于追溯线上对应哪个版本。

## 部署后验证

部署完成后，验证以下端点返回 200：

```bash
# 首页
curl -s -o /dev/null -w "%{http_code}" https://sparkflow-840.pages.dev/

# 任一课件目录式 URL（应返回课件 HTML，不是 SPA index.html）
curl -s -o /dev/null -w "%{http_code}" https://sparkflow-840.pages.dev/courseware/ai-physics/

# SPA 任意路由（应返回 200 + index.html）
curl -s -o /dev/null -w "%{http_code}" https://sparkflow-840.pages.dev/any-spa-route
```

刚部署完 CDN 边缘传播需要 1-2 分钟，期间可能返回 522/524，等一会儿再测。

## 常见问题

### Q: 部署失败提示 "Project not found"
项目未创建。先跑 `npx wrangler pages project create sparkflow --production-branch=main`。

### Q: build 报 TS 错误
`tsc -b` 是 build 的一部分。修掉类型错误再 build，**不要**用 `--no-verify` 跳过。

### Q: `git push` 连不上 GitHub
本地 git 已配置代理 `127.0.0.1:7897`。如果代理端口变了：
```bash
git config --global http.proxy http://127.0.0.1:<new-port>
git config --global https.proxy http://127.0.0.1:<new-port>
```

### Q: wrangler 提示未授权
```bash
npx wrangler login
```
浏览器会弹出 Cloudflare 授权页，点允许即可。

### Q: 想本地预览不部署
```bash
npx wrangler pages dev dist --project-name=sparkflow
```
启动本地模拟 Cloudflare 环境的服务器（包含 `_redirects` 规则）。

## 路由机制（`public/_redirects`）

Cloudflare Pages 通过 `public/_redirects` 文件处理路由（Vite 构建时会拷贝到 `dist/_redirects`）：

```
/courseware/*  /courseware/:splat/index.html  200
/*             /index.html                    200
```

- 第一条：`/courseware/foo/` → `/courseware/foo/index.html`（课件目录式 URL）
- 第二条：所有未命中的路径返回 SPA 入口（React Router 接管）

修改路由规则需编辑 `public/_redirects` 并重新 build + deploy。

## 目录大小参考

| 目录 | 用途 | 是否 git 追踪 |
|---|---|---|
| `src/` | React 源代码 | ✅ |
| `public/courseware/` | 课件 HTML + 外置 assets | ✅ |
| `public/images/` | 图片资源 | ❌（gitignore，自动生成） |
| `public/resource-manifest.json` | 资源清单 | ❌（gitignore，build 时生成） |
| `public/_redirects` | Cloudflare 路由规则 | ✅ |
| `dist/` | 构建产物 | ❌（gitignore） |
| `node_modules/` | 依赖 | ❌（gitignore） |

## 完整一条命令部署（仅适用 React/图片改动）

如果想省事，可以在 `package.json` 的 `scripts` 加：

```json
"deploy": "npm run build && wrangler pages deploy dist --project-name=sparkflow"
```

之后 `npm run deploy` 一条命令搞定。但**课件改动仍需手动 import 后再 deploy**。
