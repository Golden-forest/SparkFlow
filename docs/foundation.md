# 可复用应用基座

## 当前结论

项目已具备可复用的工程能力和独立账户模块，物理实验与账户代码保持分离。注册、登录、恢复密码、资料和用户数据权限已有真实服务实现；正式服务器、域名与邮件配置尚未启用。共享授权码继续作为独立站点门禁，个人账户通过自己的会话和数据库权限隔离数据。

| 能力 | 状态 | 位置 / 说明 |
|---|---|---|
| 实验插件、参数面板、监控 | 已有 | `src/experiments/base`、`src/components/experiment` |
| 统一页面路由、按页面加载 | 已补齐 | `src/App.tsx` |
| 未知路径、渲染错误恢复 | 已补齐 | `src/platform/StatusPage.tsx`、`ErrorBoundary.tsx` |
| 容错的浏览器偏好存储 | 已补齐 | `src/platform/browser-storage.ts` |
| JSON 请求、资源结构校验、加载重试 | 已补齐 | `src/platform/request.ts`、`resource-manifest.ts` |
| 服务端授权码期限、退出、来源检查 | 已补齐 | `functions/_middleware.ts`；共享访问控制 |
| 可重复的安装、类型、单元、浏览器检查 | 已补齐 | `package-lock.json`、`npm run verify` |
| 注册、个人登录、找回密码、会话恢复与撤销 | 已实现 | `src/platform/account`、`server`；Better Auth 1.7.7 |
| 用户资料、用户数据隔离、数据库迁移 | 已实现 | 受限数据库角色、版本化迁移、强制 RLS 和双用户测试 |
| 通用业务路由保护 | 已实现 | `AccountSessionLayout` + `RequireAccount`，不依赖物理页面 |
| 课件源隔离与域名配置检查 | 已实现 | 账户构建移除 HTML 资源，检查主机与 Cookie 同站点关系 |
| 邮件发送与完整本地账户链路 | 已实现并验证 | 真实本机 SMTP/数据库/HTTP；生产送达仍需实际配置 |
| 正式云服务器账户服务 | 待部署授权与配置 | 服务器只读巡检完成；备案、HTTPS 与生产 SMTP 待核实 |

## 开发与验证

使用 Node.js 22.12+；`.nvmrc` 选择 Node 22。`npm ci` 按锁文件安装，TypeScript 工具脚本通过 `tsx` 运行。

```bash
nvm use
npm ci
npm run setup:accounts
npm run test:e2e:install
npm run dev
```

规范检查入口：

```bash
npm run verify
```

该命令按顺序执行前后端 lint/类型检查、单元/物理/门禁/实际 PostgreSQL 账户测试、两套依赖安全审计、前后端构建与两套浏览器测试，任何必需环节失败均返回非零。安全审计需要访问 npm registry，并在发现高危及以上风险或服务请求失败时阻止验收。实验浏览器测试预览生产构建；账户测试运行真实临时数据库、HTTP API、SMTP 收信器及开发前端，保持实际限流。两者使用固定英语与独立端口，不复用已有服务器。CI 在 PR 和主分支执行同一入口，原站点部署仅使用验证作业产出的构建文件。账户与资源正式部署另按[部署材料](../deploy/accounts/README.md)执行。

开发时可单独运行：

```bash
npm run lint
npm run typecheck
npm test
npm run security
npm run build
npm run test:e2e
npm run test:e2e:accounts
```

首次安装 Chromium 可能需要网络。若本机已有 Chrome，可临时使用 `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`；CI 仍安装固定版本 Chromium。`npm run preview` 仅预览静态构建，不运行 Pages Functions；共享授权码中间件另有服务端测试。

工程和账户变更均有自动化及桌面/手机浏览器检查，最终结果记录于[任务进度](agent-work/reusable-foundation/progress.md)。原有依赖审计从 21 项告警降为 0，现有框架主版本保持不变，账户依赖精确锁定；原有用户改动保留。本机使用 Node 25，远程 Node 22 CI 与真实 Cloudflare 部署尚未执行。实验与 Three.js 的延迟加载文件仍有体积告警，未来可按实验进一步拆分。

## 通用能力与业务代码的边界

`src/platform` 不导入物理实验，可作为同技术栈新项目的通用模块。请求必须在进入组件状态前解码验证，异步任务负责自己的错误、取消和重试；React 错误边界只能处理渲染及懒加载失败。偏好存储失败可以回退，评分等用户记录保存失败必须明确提示并允许导出。

业务代码使用统一会话模块，权限在 API 和数据库执行，不能依赖隐藏按钮或前端路由。当前隐藏评分入口和自选评分者身份仍不是权限控制，本地评分未自动转换为个人账户数据。账户模板默认每个应用有独立配置、数据库与密钥；组织、支付和跨产品 SSO 需要根据实际业务设计。

## 账户基座与生产启用

用户已确认 Cloudflare 前端与腾讯云独立 Node/TypeScript + Better Auth + PostgreSQL 方案，并授权 SSH 只读巡检；[服务器评估](agent-work/reusable-foundation/server-assessment.md)确认当前有约 6.4 GB 可用内存、45 GB 剩余磁盘及正常运行的 CameraAI。独立账户模块已经实现，复用方法见[账户指南](accounts.md)。服务器安装、新服务、DNS/Caddy 与发布尚未执行。

本地验收覆盖邮箱确认、登录/退出、刷新恢复会话、失败与过期状态、恢复及修改密码、资料、保护路由、退出其他设备与两个用户的数据隔离。生产启用仍需真实发信服务、可信 HTTPS、备案状态核查、异机备份与恢复，以及实际生产环境的两用户复测。邮件目前为进程内异步队列，异常退出可能丢待发邮件；支持重发，不能宣称持久送达保证。

## 课件与账户隔离

账户启用后，课件、仿真、评分 HTML 和图片从主应用构建产物移除，旧路径跳到独立资源源。配置检查要求资源与 API/前端使用不同 hostname，且在同一个 HTTPS 站点；端口不同不足以隔离 Cookie。未启用账户的原站点仍保留当前资源行为。

资源源不加入账户 API 的可信来源，账户 Cookie 仅属于 API 主机。独立资源 iframe 可使用自己的存储，浏览器源隔离阻止其读取主应用；原同源 iframe 保持严格 sandbox。资源共享码门禁通过精确 CSP `frame-ancestors`/CORS 允许前端，不能直接复制原 SAMEORIGIN 头。部署前仍需逐页验证已有课件的源迁移兼容性。本轮未改变线上域名或资源访问权限。

## 共享授权码的配置

敏感值只存于 `.dev.vars` 或 Cloudflare Secrets，不得放入 `VITE_*` 变量；Vite 变量会进入浏览器构建。参考 `.dev.vars.example`。

- 受保护站点的 Production 和 Preview 都应设置 `AUTH_GATE_ENABLED=true`，缺失或非法配置返回 503。
- `AUTH_CODE_HASH` 为授权码的 64 位小写 SHA-256 十六进制摘要；`AUTH_SECRET` 使用 `openssl rand -hex 32` 生成。
- 为保留已有开发行为，没有开关且两个值都未配置时为公开模式；不要在受保护生产环境依赖该默认行为。
- 新 Cookie 在服务端验证 30 天有效期。更换摘要或密钥会使所有旧 Cookie 失效；更新旧中间件后访问者需要重新输入授权码。
- `POST /__auth/logout` 且来源为本站会清除当前浏览器 Cookie。复制过的无状态令牌直到到期或全局轮换仍可使用；不能按个人撤销。
- 本地单元测试不能证明 Cloudflare Dashboard 的配置正确。上线前需核对 Pages Functions 的 Fail closed 设置和授权码入口的分布式限流规则；本轮未修改这些账户设置。

Cloudflare `_headers` 只覆盖静态响应；中间件另行给受保护响应设置私有禁止缓存及安全头，参见 [Cloudflare Headers](https://developers.cloudflare.com/pages/configuration/headers/)。
