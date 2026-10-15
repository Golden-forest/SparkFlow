# 账户基座：开发与复用

## 已实现的边界

账户前端位于 `src/platform/account`，独立服务位于 `server`，不导入物理实验。Better Auth 版本精确锁定；会话保存在 PostgreSQL，浏览器使用 HttpOnly Cookie，不在 localStorage 保存令牌。已实现注册、邮箱确认、登录、会话恢复、退出、密码恢复、修改密码、退出其他设备和个人资料。

私人笔记是用户归属数据的最小示例：API 从服务端会话取得用户 ID，不接受客户端指定归属；PostgreSQL 进一步执行强制行级安全。列表展示最近 100 条，业务项目可以按实际需求扩展分页。现有物理实验仍按原路由访问，评分区的本地评分数据没有自动迁移为个人账户数据。

没有配置公开 API 地址时，账户页明确显示尚未连接服务；不会生成虚假用户。生产服务要求 HTTPS、真实 TLS SMTP、独立随机密钥及受限数据库角色，配置不完整则启动失败。代码接入不等于正式域名、真实邮件或服务器部署已完成。

## 安装与验收

```bash
nvm use
npm ci
npm run setup:accounts
npm run test:e2e:install
npm run verify
```

`npm run verify` 包含前后端类型检查、单元/物理/门禁/实际 PostgreSQL 测试、两套依赖审计、构建、实验浏览器测试和完整账户浏览器测试。任意必需步骤失败均返回非零。账户测试需要受支持的 PostgreSQL 原生工具 `initdb`、`pg_ctl`；测试使用独立临时集群，不连接开发或生产数据库。脚本尝试本机安装路径；也可以通过 `POSTGRES_BIN` 指定包含这些工具的目录。CI 使用 `pg_config --bindir` 设置路径，不能以跳过实际数据库测试代替通过。

独立检查：

```bash
npm run test:accounts
npm run test:e2e:accounts
npm run build:accounts
npm run security
```

浏览器账户验收启动真实临时数据库、Node HTTP API、SMTP 收信器和 React 前端，邮件由 Nodemailer 发送到本机 SMTP。测试邮箱读取服务只存在于 `server/tests`，生产编译不包含它。固定端口为 API 3100、邮件读取 3101、SMTP 1025、前端 4175，独立资源探针使用 `localhost:4176`；遇到端口占用则失败，不复用其他服务。测试遵守实际登录限流，运行需要数分钟。

## 本地正常开发

先按[数据库与部署说明](../deploy/accounts/README.md)建立独立开发数据库、迁移角色及应用角色。复制 `server/.env.example` 到忽略的 `server/.env` 并填写数据库和开发 SMTP；开发仅允许回环地址。迁移环境由操作员单独保管，不能给运行服务设置迁移凭据。执行一次版本化迁移后启动账户 API：

```bash
cp server/migration.env.example server/.env.migration
# Fill in the separate migration credentials before running the next command.
cd server
node --env-file=.env.migration --import tsx scripts/migrate.ts
cd ..
npm run dev:accounts
```

迁移命令从操作员环境读取 `MIGRATION_DATABASE_URL` 与 `DATABASE_APP_ROLE`，不会自动载入运行服务的 `.env`。需要从独立文件载入时，可使用 Node 的 `--env-file`，不要用 shell 执行未经审查的配置文件。

前端复制 `.env.example` 到 `.env.local`，使用：

```dotenv
VITE_ACCOUNT_API_URL=http://127.0.0.1:3100
VITE_CONTENT_BASE_URL=http://localhost:4176
```

API 的 `APP_ORIGIN` 设置为 `http://127.0.0.1:5173`，在另一个终端启动前端：

```bash
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

资源需由独立的本地静态服务在 `localhost:4176` 提供，保留 `/courseware/`、`/simcanvas/`、`/rating/`、`/images/` 的目录结构。不同端口不隔离 Cookie，因此资源使用不同 hostname。若只运行自动化账户验收，无需手工准备开发数据库、SMTP 或资源服务，fixture 会创建并关闭这些测试资源。

## 给新项目加业务页

挂载现有账户路由，再使用通用会话布局保护业务路由；不用改登录注册页面，也不必使用物理项目的页面外观：

```tsx
import { Route, Routes } from 'react-router-dom';
import AccountRoutes from './platform/account/AccountRoutes';
import { AccountSessionLayout, RequireAccount } from './platform/account/AccountSessionLayout';

export function ApplicationRoutes() {
  return <Routes>
    <Route path="/account/*" element={<AccountRoutes />} />
    <Route element={<AccountSessionLayout />}>
      <Route element={<RequireAccount />}>
        <Route path="/dashboard" element={<Dashboard />} />
      </Route>
    </Route>
  </Routes>;
}
```

业务页使用 `useAccount()` 读取会话，API 使用服务端会话和数据库权限检查。前端保护仅负责导航及体验；服务端不能依赖它判断用户是否有权读取记录。新增用户数据时参考 `server/src/app.ts`、`server/src/database.ts` 和 `server/migrations/0002_notes.sql`，通过新迁移扩展结构，不修改已执行过的 SQL。

复用时保留 `src/platform/account`、它依赖的 `src/platform/request.ts`、`server`、验证和部署配置，沿用 React Router 与 Tailwind；替换业务页即可。每个独立软件默认使用自己的应用配置、数据库、密钥和允许来源。在服务器环境通过 `APP_NAME` 设置应用名称。跨产品统一账号或 SSO 不属于默认行为，需要独立设计。

## 生产配置与发布产物

公开前端配置仅包含来源地址；数据库、SMTP 与签名秘密只能进入后端运行环境。推荐同一注册域下的三个 HTTPS hostname，例如 `lab`、`lab-api`、`lab-content`。账户 Cookie 保持 API 主机专属；资源源不加入账户 API 的可信来源。

```bash
VITE_ACCOUNT_API_URL=https://lab-api.heyflint.cn VITE_APP_ORIGIN=https://lab.heyflint.cn VITE_CONTENT_BASE_URL=https://lab-content.heyflint.cn npm run build
VITE_ACCOUNT_API_URL=https://lab-api.heyflint.cn VITE_APP_ORIGIN=https://lab.heyflint.cn VITE_CONTENT_BASE_URL=https://lab-content.heyflint.cn npm run build:content
```

这些是候选域名的构建示例，没有执行 DNS 配置或发布。生产构建拒绝资源与账户 API/前端共用 hostname，即使端口不同；基于公共后缀表验证三者同站点，包含 `co.uk` 与私有 `pages.dev` 等规则。移除账户产物中的课件目录，并拒绝其他未经隔离的 HTML。`dist` 与 `dist-content` 发布到独立 Pages 项目，不能把裸课件目录直接公开。旧课件路径通过 `_redirects` 转到资源源。

资源站点保留独立共享码门禁，显式配置 `AUTH_GATE_ENABLED=true`、独立 `AUTH_SECRET`、`AUTH_CODE_HASH`，以及精确的 `AUTH_FRAME_ORIGIN`。资源主机需与前端同站点，让 SameSite=Lax 门禁 Cookie 能用于 iframe 和凭据读取。先在资源源顶层页面解锁，再返回应用刷新；未授权 JSON 返回 401。跨源嵌入使用 CSP 准确允许前端，不允许账户 Cookie 共享到资源源。来自独立资源源的 iframe 可以使用自身存储；原同源嵌入仍保持严格 sandbox。

实际部署、备份、恢复和回滚步骤见[部署材料](../deploy/accounts/README.md)。腾讯云当前已完成只读容量与既有服务检查；安装 PostgreSQL、新增服务、修改 Caddy、DNS 与发布前端仍需操作授权。正式验收还需真实 HTTPS、发信及两用户测试，并确认原 CameraAI 的 IP:8443 入口正常。
