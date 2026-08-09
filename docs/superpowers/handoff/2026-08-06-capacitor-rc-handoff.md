# 电容充放电实验 — 上下文交接 / 快速恢复文档

> **用途**: 当主对话上下文被压缩（clear）后，subagent 通过本文档 + spec + plan 三件套即可完整恢复执行上下文。
> 创建时间: 2026-08-06
> 当前状态: **设计已完成，待执行 Phase 0**

---

## 0. 一句话恢复指令

> **当用户说"继续做电容实验"或类似话时**:
>
> 1. 读取本文件 + spec + plan（路径见下）
> 2. 用 TodoWrite 重建 6 阶段任务清单
> 3. 从 **Phase 0** 开始执行
> 4. 用 subagent-driven-development 技能（用户已指定）

---

## 1. 三件套文档路径（必读）

| 角色 | 路径 | 状态 |
|------|------|------|
| **本交接文档** | `docs/superpowers/handoff/2026-08-06-capacitor-rc-handoff.md` | 你正在读 |
| **设计规格 v2.0**（所有决策细节） | `docs/superpowers/specs/2026-08-06-capacitor-rc-circuit-design.md` | Final |
| **执行计划 v1.0**（带勾选框的任务清单） | `docs/superpowers/plans/2026-08-06-capacitor-rc-circuit.md` | 待启动 |

**执行顺序**: 先读 spec（理解 What/Why）→ 再读 plan（理解 How/Step）→ 本文档作为索引与快速恢复。

---

## 2. 用户身份与意图

- **用户**: 项目所有者，物理教学背景
- **需求**: 在 atomic_physics 项目中新增**电容充放电（RC 一阶电路）**实验
- **战略要求**:
  1. **最大化复用**（"能复制就复制，不要重新造轮子"）
  2. **物理严谨** + **高中范畴可视化**
  3. **前端精美统一协调**（与项目既有视觉完全一致）
  4. **预留扩展点**（未来可换电感变 LC 振荡）
- **电阻形态**: **滑动变阻器**（可拖拽滑片，符合高中实验台场景）

---

## 3. 7 项核心决策（已与用户确认，不可再变）

| # | 决策 | 要点 |
|---|------|------|
| 1 | **渲染模式** | `renderMode: '2d'`，走项目内置的 `ExperimentCanvas2D`（**不走双路由**，避免造轮子） |
| 2 | **物理积分** | **RK4**（4 阶 Runge-Kutta），不用欧拉法（dt=1/30s 下欧拉法不稳定） |
| 3 | **物理参数** | R: 1–50kΩ, C: 100–5000μF, U₀: 1–12V，单位 kΩ/μF/V（教学化） |
| 4 | **采样** | sampleIntervalMs=50, maxHistoryLength=1000（50s 窗口看完整周期） |
| 5 | **首页卡片配色** | `from-amber-900/20 via-yellow-900/10 to-orange-900/20`（与 `galvanic-cell` 同色系，电磁学识别） |
| 6 | **粒子方向** | 常规电流方向（正电荷流出电池正极，符合高中课本） |
| 7 | **极板电荷** | 用 SVG `<text>` 的 `+`/`−` 符号（红色/蓝色），非圆点（高中课本风格） |

---

## 4. 视觉协调性强约束（用户明确要求"精美统一协调"）

### 4.1 必须遵守的项目视觉语言
| 维度 | 规范 |
|------|------|
| **深底色** | `#0D1117`（全站） |
| **强调色** | 青 `#22D3EE` + 蓝 `#60A5FA` + 靛 `#818CF8` 渐变 |
| **毛玻璃** | `backdrop-blur-xl` + `bg-slate-900/80` |
| **圆角** | 大块 `rounded-2xl`，小块 `rounded-lg` |
| **字体** | Nunito |
| **数值文字** | `font-mono text-cyan-300` |
| **过渡** | `transition-all duration-200` |

### 4.2 电路元件语义色（跨界面呼应）
- 电池正极/电容上板/正电荷: **红 `#F87171`**
- 电池负极/电容下板/负电荷: **蓝 `#60A5FA`**
- 电流粒子/Workbench current 监控: **橙 `#F97316`**
- 电场线/Workbench voltage 监控/强调色: **青 `#22D3EE`**
- 电荷量 Workbench charge 监控: **翠绿 `#34D399`**

### 4.3 首页缩略图严格规范
- SVG 尺寸: `width="240" height="132" viewBox="0 0 240 132"`
- 容器: `<div className="relative flex h-36 w-full items-center justify-center">`
- opacity: 0.75–0.85
- 必须有 `<animate>` 动画，duration 1.4–2.8s
- 必须用 `<defs>` 定义渐变
- 与既有 16 张卡片视觉完全统一

---

## 5. 项目架构关键事实（侦察得来，不要再探查）

### 5.1 三个成熟实验的复用资产
- **Synchrotron Fields**: `src/experiments/electromagnetism/synchrotron/` — 声明式 Schema 模式参考
- **Hydrogen Atom**: `src/experiments/atomic/hydrogen-transitions/` — ExperimentBase 实现参考
- **Rutherford**: `src/experiments/atomic/rutherford-scattering/` — 双视图参考（但**本次不走双视图**）

### 5.2 ★ 关键发现：项目已有 2D 实验机制
- `IExperiment.metadata.renderMode?: '3d' | '2d'`（`IExperiment.ts:17`）
- `ExperimentView` 通过 `isExperiment2D()` 自动分流
- 2D 容器: `ExperimentCanvas2D`（`src/components/simulation/ExperimentCanvas2D.tsx`）
- 容器调用 `experiment.init(container: HTMLDivElement)`，自己跑 `requestAnimationFrame`
- **结论**: 本实验设置 `renderMode: '2d'`，在 `init()` 里 `ReactDOM.createRoot` 挂载 SVG 视图

### 5.3 注册机制（命令式，不用装饰器）
```typescript
// src/experiments/index.ts
import { CapacitorExperiment } from './electromagnetism/capacitor-charge-discharge';
ExperimentRegistry.register('capacitor-charge-discharge', CapacitorExperiment);
```

### 5.4 监控数据流（已就绪，直接复用）
```
experiment.getDisplayData()
  → ExperimentView setInterval(50ms)
  → updateMonitoringHistory(key, value)
  → simulationStore.monitoringHistory
  → ExperimentWorkbench Monitor Tab
  → QuantityChart (recharts)
```

### 5.5 ⚠️ 需要修改的共享代码（仅一处）
- `src/stores/simulationStore.ts:98` 硬编码 `.slice(-100)`
- 改为读取 `getMonitorSchema()?.maxHistoryLength ?? 100`
- 配合 `IExperiment.ts` 中 `MonitorSchema` 新增 `maxHistoryLength?: number`
- **不破坏现有实验**（默认 100）

---

## 6. 执行阶段总览（共 10h）

| Phase | 工时 | 核心交付物 | 详情 |
|-------|------|----------|------|
| **0** | 0.5h | `MonitorSchema.maxHistoryLength` 可配 | plan §Phase 0 |
| **1** | 1.5h | `RCCircuitPhysics.ts` + 8 个单元测试 | plan §Phase 1 |
| **2** | 1.5h | `CapacitorExperiment` 主类 + 注册 + 首页 SVG 卡片 | plan §Phase 2 |
| **3** | 3.5h | `CircuitView2D`（SVG 电路 + 滑动变阻器 + 粒子流 + 极板电荷 + 公式标注） | plan §Phase 3 |
| **4** | 2h | `Capacitor3DView`（3D 极板 + 电场线 + 电荷云，可选叠加） | plan §Phase 4 |
| **5** | 1h | 视觉协调检查 + e2e + 生产构建 | plan §Phase 5 |

**每个 Phase 结束都要验证**（见 plan 的"### 验证"小节）。

---

## 7. subagent 执行策略（用户已指定）

用户将使用 **subagent-driven-development** 技能执行。建议：

### 7.1 哪些 Phase 适合用 subagent 并行
- Phase 1（物理模块）与 Phase 2 的首页 SVG 缩略图（T2.4）：**可并行**
- Phase 4（3D 视图）：**可独立 subagent**

### 7.2 哪些 Phase 必须串行
- Phase 0 → Phase 1：依赖关系（先建接口，再建用接口的代码）
- Phase 1 → Phase 2：依赖关系（实验类用物理模块）
- Phase 2 → Phase 3：依赖关系（视图挂载到实验类）
- Phase 3 → Phase 4：依赖关系（3D Canvas 嵌入 2D 视图）

### 7.3 每个 subagent 的 prompt 模板
```
你是 atomic_physics 项目的 subagent，执行电容充放电实验的 Phase X。

【必读文档】
1. docs/superpowers/handoff/2026-08-06-capacitor-rc-handoff.md（总览）
2. docs/superpowers/specs/2026-08-06-capacitor-rc-circuit-design.md（设计 v2.0）
3. docs/superpowers/plans/2026-08-06-capacitor-rc-circuit.md §Phase X（本阶段任务）

【本次任务】
<具体任务描述，从 plan 的 §Phase X 复制>

【约束】
- 不修改 spec/plan 文档
- 不引入 KaTeX / gsap / cannon-es（项目已装但不用）
- 视觉必须遵守 handoff §4 视觉协调性约束
- 完成后报告：修改了哪些文件、如何验证、有何风险
```

---

## 8. 用户偏好与沟通风格

- **语言**: 中文（CLAUDE.md 全局规则）
- **UI 文案**: **英文**（项目硬规则，实验名/按钮/标签全英文，见 CLAUDE.md "UI 国际化规范"）
- **专业术语翻译**:
  - 充电 = Charging
  - 放电 = Discharging
  - 断开 = Disconnected
  - 滑动变阻器 = Rheostat / Sliding Rheostat
  - 电容器 = Capacitor
  - 时间常数 = Time Constant (τ)
- **按钮文案**: Start / Pause / Resume / Reset（项目统一）
- **响应风格**: 直接、不啰嗦、技术优先

---

## 9. 验收红线（必达）

| 维度 | 红线 |
|------|------|
| **物理正确** | τ 时刻 U_C = 0.632·U₀（误差<1%）；稳态收敛（误差<0.1%） |
| **回归不破坏** | Synchrotron / Hydrogen / Rutherford 三实验曲线图行为不变 |
| **资源管理** | 3D 视图关闭时正确 dispose；实验切换时正确 unmount React root |
| **视觉协调** | 深底 / 青蓝渐变 / 毛玻璃 / 圆角 / 字体全部对齐项目规范 |
| **TypeScript** | 严格模式编译通过 |
| **生产构建** | `npm run build` 无错误 |

---

## 10. 已知陷阱（避免重蹈覆辙）

| 陷阱 | 提醒 |
|------|------|
| Rutherford 的 `config.json` 没被代码读取 | 本实验所有配置走类的 `config` 字段，不写 JSON 文件 |
| `SideToolbar`/`BottomToolbar` 是"伪装的特化组件" | 本实验不写特化工具栏，全部用 `ExperimentWorkbench` 声明式 Schema |
| `ElectromagneticFieldView.ts` 是孤立文件 | 不要 import 它，本实验从零写 3D 视图 |
| 项目装了 gsap / cannon-es 但没人用 | 本实验也不引入，与现状一致 |
| KaTeX 没装 | 公式用 SVG `<text>` + `createTextSprite` 纯文本，不引入 KaTeX |
| 装饰器 `@registerExperiment` 存在但冗余 | 用命令式 `ExperimentRegistry.register(id, Class)`，与其他三个成熟实验一致 |

---

## 11. 快速恢复检查清单

clear 后对话开头，subagent 应该：

- [ ] 读本文件（已读）
- [ ] 读 spec v2.0（§1–§8 是核心，§9–§12 是辅助）
- [ ] 读 plan v1.0（§Phase 0–5）
- [ ] 用 TodoWrite 重建 6 阶段 todo（pending 状态）
- [ ] 调用 `superpowers:subagent-driven-development` 技能
- [ ] 从 Phase 0 开始执行

---

## 12. 变更记录

| 日期 | 变更 |
|------|------|
| 2026-08-06 | 创建。设计 v2.0 + plan v1.0 已定稿，等待用户 clear 后启动 |
