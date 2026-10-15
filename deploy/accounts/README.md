# 独立账户服务：部署与恢复模板

这些文件是可审查的部署材料，**不会自动安装、连接或修改服务器**。执行服务器安装、账号创建、迁移、Caddy 修改及发布前，需要明确的操作授权。它们仅为 SparkFlow 增加独立服务，不迁移或修改 CameraAI 的共享管理员登录。

## 部署边界

- Node.js **22.12+**，Better Auth 版本由 `server/package-lock.json` 锁定；API 固定监听 `127.0.0.1:3100`。
- PostgreSQL 仅监听本机；推荐 Ubuntu 24.04 官方提供的受支持版本。数据库为 `sparkflow_accounts`，迁移账户为 `sparkflow_migrator`，运行账户为 `sparkflow_app`。
- VPS 只托管 API，Caddy 将 API 域名的 `/api/*` 代理到回环地址；前端托管到独立 Cloudflare Pages 项目。`VITE_ACCOUNT_API_URL` 和 `AUTH_BASE_URL` 为 `https://api.example.com`；`VITE_APP_ORIGIN` 和 `APP_ORIGIN` 为 `https://app.example.com`，无路径、无尾随斜杠。两个域名须属于同一个站点，精确配置允许来源和 credential 请求，不使用通配符。
- 课程 HTML/仿真资源使用独立 HTTPS origin 和 **不同 hostname**：`VITE_CONTENT_BASE_URL`。它不代理账户 API、也不持有账户 cookie；不要将可能执行第三方脚本的课程内容放到账户域名下。账户 cookie 保持 host-only，不设置父域共享 cookie。不同端口不足以隔离 cookie。构建会分离这些内容；独立资源站点仍须保留已有访问控制，不应为了拆分 origin 将私有资源公开。
- 采用有公信证书的独立域名。先核验 DNS、公网 80/443、已有 Caddy 监听和证书申请条件；CameraAI 现有 8443 和自签证书不能证明新域名的 HTTPS 已就绪。
- 当前域名 ICP 备案及腾讯云接入备案状态尚未核验。现有实例位于中国大陆，公开接入前应按主体、域名及接入商情况确认并完成适用备案；DNS、证书或 IP/非标准端口可访问不代表备案已完成，参见[腾讯云备案场景](https://cloud.tencent.cn/document/product/243/18910)。
- 真实 SMTP 必须提供认证与 TLS；`SMTP_FROM` 使用供应商允许的发件地址。部署后检查 SPF/DKIM/DMARC 及邮件送达。测试收信器仅用于本地测试，不随生产构建发布。
- 本机备份只能用于快速恢复；账户数据库、备份和 SMTP 凭据均包含敏感数据，备份还必须加密复制到另一台机器或独立存储，并限制读取者。

## 一次性准备（授权后人工执行）

先检查已有服务、监听端口、磁盘和内存，再安装所需的 Node/PostgreSQL；不要升级或覆盖 CameraAI/Hermes 的依赖与服务。保持 `3100`、`5432` 不对公网开放。下列目录示例使用 root 拥有发布产物，服务用户只读：

```bash
sudo useradd --system --user-group --home-dir /nonexistent --shell /usr/sbin/nologin sparkflow-accounts
sudo install -d -o root -g root -m 0755 /opt/sparkflow/accounts/releases
sudo install -d -o root -g sparkflow-accounts -m 0750 /etc/sparkflow/accounts
sudo install -d -o postgres -g postgres -m 0700 /var/lib/sparkflow-backups
```

审查 `postgresql.conf.fragment` 和 `pg_hba.conf.fragment`，**合并到对应集群配置，不替换整个文件**。HBA 规则按首个匹配项生效，必须检查已有的宽泛规则。然后以本机 PostgreSQL 管理员执行一次 `postgres-bootstrap.sql`。它会交互式要求两个不同的密码，不在仓库或命令行中保存密码：

```bash
sudo -u postgres psql --no-psqlrc --set=ON_ERROR_STOP=1 --file=deploy/accounts/postgres-bootstrap.sql
```

数据库角色不得相互授予成员身份。应用账户必须非 superuser、非表所有者、无 `BYPASSRLS`、不能创建数据库/角色。应用数据迁移负责授权及 RLS，不应额外授予 `ALL` 来处理权限错误。连接后可核验：

```sql
SHOW listen_addresses;
SHOW password_encryption;
SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls
FROM pg_roles WHERE rolname IN ('sparkflow_app', 'sparkflow_migrator');
SELECT member::regrole, roleid::regrole FROM pg_auth_members
WHERE member = 'sparkflow_app'::regrole;
SELECT schemaname, tablename, tableowner, rowsecurity FROM pg_tables WHERE schemaname IN ('auth', 'app');
```

将 `runtime.env.example` 和 `migration.env.example` 复制到仓库之外再填写。生成独立随机 `AUTH_SECRET`，至少 32 个字符；数据库 URL 中的密码必须 URL 编码。运行环境文件为 `root:sparkflow-accounts`、`0640`；迁移环境文件只由操作员持有、`0600`，**不得进入 systemd 的运行环境**。不要把密码放进 shell 参数、工单、日志或提交。

## 发布布局与迁移

在受控构建环境运行根目录及 `server/` 的 `npm ci` 和构建。账户前端构建需显式填写公开配置（示例域名须替换）：

```bash
VITE_ACCOUNT_API_URL=https://api.example.com VITE_APP_ORIGIN=https://app.example.com VITE_CONTENT_BASE_URL=https://content.example.com npm run build
VITE_ACCOUNT_API_URL=https://api.example.com VITE_APP_ORIGIN=https://app.example.com VITE_CONTENT_BASE_URL=https://content.example.com npm run build:content
npm --prefix server ci
npm --prefix server run build
```

`npm run build` 将课程目录从账户产物删除，`npm run build:content` 单独生成 `dist-content/` 资源产物，两个命令必须使用同一组公开 origin 配置。`dist/` 和 `dist-content/` 分别发布到两个独立 Pages 项目；使用仓库的资源构建入口和访问控制配置，不能直接发布裸 `public/` 绕过访问控制。前端/资源发布需要单独授权，本目录的运维脚本不会执行这些发布。VPS 上的 API 发布目录示例：

```text
/opt/sparkflow/accounts/releases/<release>/
  server/                 # package.json、lock、dist、migrations/ SQL、production node_modules
/opt/sparkflow/accounts/current -> releases/<release>
```

构建产物由 root 拥有，不给 `sparkflow-accounts` 写权限。生产 `server/node_modules` 使用 `npm ci --omit=dev` 安装锁定版本，不在运行时安装依赖。迁移必须是明确的发布步骤：

1. 先完成全部本地/CI 检查并审查迁移 SQL，包括新的 Better Auth 版本产生的结构变化。
2. 执行并验证完整备份，记录当前发布版本及数据库迁移版本。
3. 使用独立迁移环境执行服务的编译后迁移入口；检查退出码，失败则停止发布。不要以应用角色或 systemd 服务启动过程运行迁移。
4. 更新 `current` 到已验证版本，重启账户服务并检查 `/api/health`、日志及完整注册/登录/邮件流程。

本仓库开发迁移命令为 `npm --prefix server run migrate`。生产使用编译后的入口，不需要开发依赖，也不需要 SMTP/Auth 凭据；只读取 `MIGRATION_DATABASE_URL` 和 `DATABASE_APP_ROLE`。工作目录须为发布的 `server/`，并保留 `migrations/*.sql` 原目录：

```bash
node --env-file=/path/to/operator-only/migration.env dist/scripts/migrate.js
```

不要将迁移凭据加入 systemd 服务，不用 shell `source` 执行未经审查的环境文件。

审查并安装 `sparkflow-accounts.service`。先核对 `/usr/bin/node` 版本和编译入口是否与发布产物一致：

```bash
sudo systemd-analyze verify deploy/accounts/sparkflow-accounts.service
sudo install -o root -g root -m 0644 deploy/accounts/sparkflow-accounts.service /etc/systemd/system/sparkflow-accounts.service
sudo systemctl daemon-reload
sudo systemctl enable --now sparkflow-accounts
curl --fail --silent --show-error http://127.0.0.1:3100/api/health
sudo journalctl -u sparkflow-accounts --since '10 minutes ago'
```

服务使用非特权账户、只读文件系统、私有临时目录、无 Linux capabilities，日志进入 journald；不开放额外持久写目录。`MemoryMax=512M` 是初始服务上限，需要用真实流量观察；OOM/重启时先查日志与资源，不能静默关闭限制。不要增加 `MemoryDenyWriteExecute`，Node/V8 的 JIT 需要可执行内存。

## Caddy 增量接入

只新增 `accounts.caddyfile`，替换其中的 API 示例域名，再从**现有完整 Caddyfile**导入。模板只代理 API，不托管前端或教学 HTML；课程重定向由 Pages 前端构建产物的 `_redirects` 处理。保留 CameraAI 8443 原始站点、证书及反向代理原文：

```caddyfile
# 加在现有 Caddyfile 顶层；原有 block 全部保留。
import /etc/caddy/sites-enabled/accounts.caddyfile
```

先备份并检查配置差异，再验证**合并后的完整配置**；通过后使用 reload，不停止现有 Caddy：

```bash
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
sudo systemctl reload caddy
curl --fail --silent --show-error https://api.example.com/api/health
```

确认新账户页及 CameraAI 8443 均正常。模板只信任直接连接到 Caddy 的地址，并替换传入的转发 IP 头。若以后增加 CDN/另一层代理，需要审查真实客户端 IP 与速率限制，不能盲目信任所有 `X-Forwarded-For`。

## 备份、恢复与回滚

`backup.sh` 使用 custom-format `pg_dump`、检查归档目录并生成 SHA-256，失败返回非零；不自动清理备份。客户端工具使用与服务器匹配的受支持版本，不能用较旧主版本的 `pg_dump` 备份较新服务器。它必须以可读取全部数据的操作员身份运行，**不能使用受 RLS 限制的应用账户**。即使数据库表强制 RLS，本机 postgres 管理员也可进行完整备份。

```bash
sudo -u postgres bash deploy/accounts/backup.sh /var/lib/sparkflow-backups
```

可选的 `sparkflow-accounts-backup.service`/`.timer` 每日 UTC 02:30 后随机延迟最多 15 分钟备份。授权启用前，将脚本以 root 拥有、`0755` 安装到 `/opt/sparkflow/accounts/ops/backup.sh`，备份目录仍为 postgres 拥有、`0700`；审查 timer 时区与实际低峰时间，验证 unit 后再安装并启动 timer。备份 unit 只给备份目录写权限，使用本机 peer 身份，不读取应用或迁移凭据。通过 `systemctl list-timers` 及 backup unit 的退出状态核验调度，另行配置失败告警；仅有 timer 不等于已经拥有异机备份。

为小规模服务，至少每日及每次迁移前备份，保留策略须考虑 60GB 共享磁盘；定期监控大小并由操作员执行清理。每日 dump 的潜在数据损失窗口约为一天；如果业务需要更短 RPO，应增加备份频率或实施 PostgreSQL WAL/PITR，不能把 dump 当作高可用。配置独立机器/存储的加密复制、失败告警和定期恢复演练；本模板不创建外部账号或自动传输用户数据。还须在独立安全位置保管角色定义、必要配置、锁文件与 `AUTH_SECRET`，数据库 dump 不包含整个集群的角色或 SMTP 配置。

恢复脚本默认只展示归档目录，**不写数据库**。先核验相邻 `.sha256`、可信备份来源，使用 `pg_restore --file=/private/path/review.sql ARCHIVE` 审查 SQL，再创建独立空恢复库。归档可能执行 SQL，仅恢复可信来源：

```bash
sudo -u postgres createdb --owner=sparkflow_migrator sparkflow_restore_drill
sudo -u postgres bash deploy/accounts/restore.sh /var/lib/sparkflow-backups/ARCHIVE.dump sparkflow_restore_drill
# 明确选择执行后：
sudo -u postgres bash deploy/accounts/restore.sh /var/lib/sparkflow-backups/ARCHIVE.dump sparkflow_restore_drill --apply
```

脚本拒绝生产数据库名称及非空目标，使用单事务/遇错退出，不运行 DROP/clean/create。恢复后检查表所有者、角色授权、RLS、用户数量、私有笔记和验证流程；由于备份保留原应用角色授权/策略，恢复环境必须预先具备相同角色。演练结束后删除演练数据库也需要由操作员明确执行。

代码回滚与数据库回滚是两件事。只有旧版本兼容新结构时，才能切回旧发布目录并重启账户服务；本仓库迁移不自动执行 down migration。若结构不兼容，先暂停写入，保留故障现场及当前备份，在独立数据库恢复迁移前备份并验证，确认迁移后新增数据如何保留，再另行批准连接切换。**不要直接向生产库覆盖恢复，也不要用下调依赖版本替代数据库回滚。**

## 本地真实浏览器验证

根目录 `npm run test:e2e:accounts` 使用 `playwright.account.config.ts`，会运行独立临时 PostgreSQL、真实 HTTP 账户服务、真实 SMTP 收信器及前端。账户 fixture 仅存在 `server/tests/`，生产入口没有测试邮箱读取 API。端口固定为前端 4175、API 3100、收信 API 3101、SMTP 1025；spec 内只读资源探针监听 `localhost:4176`。检测到占用即失败，不复用未知服务。

桌面/移动端分别验证注册、邮箱确认、登录与刷新、资料更新、私有笔记增删、退出及保护路由、密码恢复/旧密码失效，并用两个独立浏览器上下文验证用户隔离。真实 iframe 探针验证课程路径跳转、父页面 DOM 不能跨 origin 读取、host-only session cookie 不发送到资源 hostname。测试中的 `localhost` 与 `127.0.0.1` 同时跨站点；生产同主域的不同 hostname 属于同站点，应另行验证 HTTPS、CORS 和来源校验，不能把本地测试当作生产配置验收。测试捕获 console/page errors，保留失败截图；邮件令牌及页面内容可能出现在测试报告中，报告只能作为受限访问的短期产物。

## 官方依据

- [Better Auth 安装与迁移](https://better-auth.com/docs/installation)、[邮件/密码认证](https://better-auth.com/docs/authentication/email-password)、[安全要求](https://better-auth.com/docs/reference/security)。
- [PostgreSQL 角色](https://www.postgresql.org/docs/current/sql-createrole.html)、[连接规则](https://www.postgresql.org/docs/current/auth-pg-hba-conf.html)、[备份概述](https://www.postgresql.org/docs/current/backup.html)、[pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html)、[pg_restore](https://www.postgresql.org/docs/current/app-pgrestore.html)。
- [Caddy import](https://caddyserver.com/docs/caddyfile/directives/import)、[reverse_proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy)、[validate/reload](https://caddyserver.com/docs/command-line)。
- [systemd 服务隔离选项](https://github.com/systemd/systemd/blob/main/man/systemd.exec.xml)；目标机 Ubuntu 24.04 的实际指令支持以 `systemd-analyze verify` 为准。
