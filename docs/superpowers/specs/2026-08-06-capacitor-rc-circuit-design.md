# 电容充放电（RC 一阶电路）仿真实验 — 设计规格

> 状态: **Final v2.0（已二次审查定稿）**
> 创建日期: 2026-08-06
> 关联计划: `docs/superpowers/plans/2026-08-06-capacitor-rc-circuit.md`

---

## 1. 项目目标

构建一个**电容充放电（RC 一阶电路）**交互式仿真实验，作为项目首个电磁学实验。在**物理严谨性**与**高中教学可视化**之间取得平衡，同时与项目现有视觉体系**完全统一协调**，并为后续 LC 振荡、RLC 等扩展预留架构空间。

### 核心物理内容（高中范围，物理严谨）
- **充电过程**: `U_C(t) = U₀(1 - e^(-t/RC))`，`i(t) = (U₀ - U_C)/R = (U₀/R)·e^(-t/RC)`
- **放电过程**: `U_C(t) = U_C(0)·e^(-t/RC)`，`i(t) = -U_C/R`（反向，大小随时间衰减）
- **时间常数**: `τ = RC`（充放电达到 63.2% / 衰减到 36.8% 所需时间）
- **稳态**: 充电末态 `U_C → U₀, i → 0`；放电末态 `U_C → 0, i → 0`
- **电荷**: `Q = C·U_C`，始终与 U_C 同步

### 可调参数
- 滑动变阻器 R（可调阻值）
- 电容 C
- 电源电压 U₀
- 开关位置：充电 / 放电 / 断开（默认断开）

### 扩展预留
- 物理模块设计为**纯函数 + 不可变 state + 可替换 step 函数**
- `CircuitState` / `CircuitParams` 接口为 LC 振荡预留字段

---

## 2. 架构决策（已二次审查定稿）

### 2.1 ★ 渲染模式选择（重大修正）

**重大发现**: 项目 `IExperiment.metadata` 已支持 `renderMode?: '3d' | '2d'` 字段（`IExperiment.ts:17`），`ExperimentView` 通过 `isExperiment2D()` 自动分流到 `ExperimentCanvas2D`（基于 div + rAF）或 `SceneContainer`（R3F Canvas）。

**修正后的架构（不再走"双视图硬编码路由"）**：

| 设计元素 | 实现方式 | 理由 |
|---------|---------|------|
| **电路主视图**（SVG） | `renderMode: '2d'`，走 `ExperimentCanvas2D` | 项目原生支持，避免重写容器/渲染循环 |
| **3D 元件视图**（极板/电场线/电荷） | **叠加在 2D 视图之上** 或 **Workbench 切换** | 避免引入双路由复杂度，与 synchrotron `viewMode` select 模式一致 |
| **3D 渲染** | 在 2D 容器内嵌入独立 R3F Canvas（按需挂载） | `showField3D=true` 时挂载，`false` 时卸载 |

**新方案**: 单一实验类、单一路由 `/experiment/capacitor-charge-discharge`，通过 `showField3D` 控制是否在 SVG 下方/侧边叠加 R3F 3D 子视图。

> **架构简化收益**: 不再修改 `App.tsx` 路由，不再写独立 `MacroExperimentView`，完全走 `ExperimentView` 通用通道。这是项目最干净、最一致的扩展方式。

### 2.2 技术选型（最大化复用现有代码）

#### 100% 直接复用（零改动）
| 资产 | 路径 |
|------|------|
| `ExperimentBase` 基类 | `src/experiments/base/ExperimentBase.ts` |
| `IExperiment` / `IExperiment2D` 接口 | `src/experiments/base/IExperiment.ts` |
| 声明式 Schema | `ControlSchema` / `MonitorSchema` / `ParameterDefinition` |
| `ExperimentRegistry` 注册 | `src/experiments/base/ExperimentRegistry.ts` |
| `ExperimentView` 通用页面 | `src/pages/ExperimentView.tsx` |
| **`ExperimentCanvas2D` 2D 容器** | `src/components/simulation/ExperimentCanvas2D.tsx` |
| `SceneContainer` + `ExperimentScene`（3D 备用） | `src/components/simulation/` |
| `ExperimentWorkbench` 工作台 | `src/components/experiment/ExperimentWorkbench.tsx` |
| `QuantityChart` recharts 折线 | `src/components/monitoring/QuantityChart.tsx` |
| `simulationStore` Zustand | `src/stores/simulationStore.ts` |
| `threeUtils` 标签/释放 | `src/experiments/shared/utils/threeUtils.ts` |
| 视觉样式（毛玻璃、渐变、圆角） | 见 §8 |

#### 新建
- `CapacitorExperiment.ts` 主类（实现 `IExperiment2D`，`renderMode: '2d'`）
- `RCCircuitPhysics.ts` 物理模块（纯函数）
- `CircuitView2D.ts` 2D 视图（SVG 电路 + 粒子流 + 极板电荷）
- `Capacitor3DView.ts` 3D 子视图（可选叠加）
- 首页 SVG 缩略图组件

### 2.3 物理模块设计（可扩展，纯函数）

```typescript
// RCCircuitPhysics.ts
export type SwitchMode = 'charging' | 'discharging' | 'disconnected';

export interface CircuitState {
    mode: SwitchMode;
    voltage: number;     // U_C，单位 V
    current: number;     // i，单位 A（内部计算用）
    charge: number;      // Q，单位 C
    time: number;        // 累积时间 s
}

export interface CircuitParams {
    resistance: number;   // 单位 kΩ（显示）
    capacitance: number;  // 单位 μF（显示）
    sourceVoltage: number;// 单位 V
}

// 纯函数
export function createInitialState(): CircuitState;
export function step(state: CircuitState, params: CircuitParams, dt: number): CircuitState;
export function analyzeTimeConstant(params: CircuitParams): number; // τ（秒）
```

**数值方法**: 4 阶 Runge-Kutta（RK4），比欧拉法精度高一个量级，确保大 dt（1/30s）下仍正确收敛。物理模块零 Three.js 依赖。

---

## 3. 物理参数（已定稿）

| 参数 | key | min | max | step | 默认 | 单位 |
|------|-----|-----|-----|------|------|------|
| 滑动变阻器电阻 | `resistance` | 1 | 50 | 1 | 10 | kΩ |
| 电容 | `capacitance` | 100 | 5000 | 100 | 1000 | μF |
| 电源电压 | `sourceVoltage` | 1 | 12 | 0.5 | 6 | V |
| 开关位置 | `switchMode` | — | — | — | `disconnected` | select |
| 显示 3D 视图 | `showField3D` | — | — | — | `false` | boolean |
| 显示标注 | `showLabels` | — | — | — | `true` | boolean |

**单位换算（内部 SI 计算）**:
- R → Ω: `resistance × 1000`
- C → F: `capacitance × 1e-6`
- τ = RC 默认 = 10kΩ × 1000μF = **10 秒**

---

## 4. 监控量（已定稿）

| 量 | key | 内部单位 | 显示单位 | 显示换算 | 颜色 |
|----|-----|---------|---------|---------|------|
| 电容器电压 | `voltage` | V | V | 直接 | `#22d3ee` 青 |
| 电路电流 | `current` | A | mA | × 1000 | `#f97316` 橙 |
| 电容器电荷 | `charge` | C | μC | × 1e6 | `#34d399` 翠绿 |

- **采样间隔** `sampleIntervalMs`: **50ms**（20Hz）
- **最大历史点数** `maxHistoryLength`: **1000**（50s 窗口，可看完整周期）

---

## 5. simulationStore 改造（已定稿）

**当前问题**: `simulationStore.ts:98` 硬编码 `.slice(-100)`。

**改造方案**:
- `MonitorSchema` 增加可选字段 `maxHistoryLength?: number`
- `updateMonitoringHistory(key, value)` 从 schema 读取该字段，缺省 100
- 不修改 `updateMonitoringHistory` 签名，通过 `get()` 读取当前 experiment 的 schema
- 其他实验不声明 → 保持原行为（不破坏 Synchrotron/Hydrogen/Rutherford）

---

## 6. 2D 电路视图设计（SVG，已定稿）

### 6.1 ★ 容器接入（修正）

实验类设置 `metadata.renderMode = '2d'`，`ExperimentView` 自动渲染 `ExperimentCanvas2D`。
- `ExperimentCanvas2D` 调用 `experiment.init(container: HTMLDivElement)` 注入容器
- 内部使用 `requestAnimationFrame` 驱动 `store.tick(delta)`
- **实验类自行管理 SVG 渲染**: 在 `init()` 中创建 React root 或直接操作 SVG DOM

**实现策略选择**:
- **方案 A**（推荐）: 在 `init()` 中用 `ReactDOM.createRoot(container).render(<CircuitView .../>)` 挂载 React 子树，通过 `setParameter` 触发重渲染
- **方案 B**: 直接用 DOM API 构造 SVG（性能略好但代码冗长）

采用**方案 A**，保持代码清晰，性能足够。

### 6.2 整体布局

```
┌──────────────────────────────────────────────────────────────┐
│  ExperimentView Header（已有，复用）                          │
│  Back | Capacitor Charge/Discharge | Start/Pause | Reset    │
├──────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────┐  ┌─────────────┐   │
│  │  CircuitView2D（SVG 电路主区）        │  │ Workbench   │   │
│  │                                       │  │ (已复用)    │   │
│  │   ┌──[开关]──[滑动变阻器 R]──┐       │  │ ┌─────────┐ │   │
│  │   │                          │       │  │ │Controls │ │   │
│  │  [电池 U₀]                [电容 C]   │  │ │ Monitor │ │   │
│  │   │                          │       │  │ └─────────┘ │   │
│  │   └──────────────────────────┘       │  │             │   │
│  │                                       │  │ R 滑块      │   │
│  │  ●→●→● 电流粒子（沿导线流动）         │  │ C 滑块      │   │
│  │  + + +    极板上正电荷点阵            │  │ U 滑块      │   │
│  │  − − −    极板下负电荷点阵            │  │ 开关下拉    │   │
│  │                                       │  │ 3D 开关     │   │
│  │  ┌────────────────────────────────┐  │  │             │   │
│  │  │ Capacitor3DView（可选，叠加）  │  │  │ Monitor:    │   │
│  │  │  极板 / 电场线 / 电荷云        │  │  │ U_C 曲线    │   │
│  │  └────────────────────────────────┘  │  │ i 曲线      │   │
│  └──────────────────────────────────────┘  │ Q 曲线      │   │
│                                              └─────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

**说明**: 曲线图全部走 `ExperimentWorkbench` 的 Monitor Tab，电路视图不重复画图，避免视觉冗余。

### 6.3 ★ 视觉规范（与项目协调，关键修正）

**强制对齐项目既有视觉语言**:

| 元素 | 样式规范 | 参考来源 |
|------|---------|---------|
| 背景 | `#0D1117`（项目标准深底） | `ExperimentCanvas2D.tsx:67` |
| 导线 | `stroke="#475569" strokeWidth="3"` | `Home.tsx` 现有 SVG 惯例 |
| 高亮导线 | `stroke="#22D3EE"` 青（与 Workbench 强调色一致） | `ExperimentWorkbench.tsx:179` |
| 卡片/面板 | `rounded-2xl border-white/10 bg-slate-900/55 backdrop-blur` | Workbench `NumberControl` |
| 渐变文字 | `bg-gradient-to-r from-[#22D3EE] via-[#60A5FA] to-[#818CF8] bg-clip-text text-transparent` | Workbench 标题、ExperimentView 标题 |
| 强调按钮 | `bg-gradient-to-r from-sky-600 to-cyan-500 shadow-cyan-900/30` | Start 按钮 |
| 数值显示 | `font-mono text-cyan-300` | Workbench 数值 |
| 标签文字 | `text-sm font-medium text-slate-200` | Workbench label |
| 单位文字 | `text-slate-400` / `text-slate-500` | Workbench 单位 |
| 装饰光晕 | `bg-cyan-400/10 blur-3xl` | `ExperimentView.tsx:248` |

**电路元件视觉**:
| 元件 | 配色 | 说明 |
|------|------|------|
| 电池 | `+` 极 `#F87171` 红 / `−` 极 `#60A5FA` 蓝 | 红正蓝负，国际惯例 |
| 开关 | 闭合 `#22D3EE` 青 / 断开 `#64748B` 灰 | 状态色对比 |
| 滑动变阻器 | 电阻丝暗 `#334155` + 有效段亮 `#22D3EE` + 滑片 `#F0F6FC` 白 | 三层对比 |
| 电容极板 | 上板 `#F87171` 红 / 下板 `#60A5FA` 蓝 | 与电池极性一致 |
| 电流粒子 | `#F97316` 橙（与 Workbench 中 current 监控色一致） | 跨界面色彩呼应 |
| 极板 + 电荷点 | `#F87171` 红 | 极性表达 |
| 极板 − 电荷点 | `#60A5FA` 蓝 | 极性表达 |
| 公式标注 | `#22D3EE` 青 + 半透明背景 `bg-slate-900/70 backdrop-blur` | 与项目标注一致 |

### 6.4 滑动变阻器设计

```
       滑片（白色圆，可水平拖拽）
        ●
────────████████████████████░░░░░░░░░░░░░░  ← 电阻丝
       ↑─── 有效长度（亮青） ───↑
       └────── 暗灰部分 ───────┘
```

- **总长度**: 固定 SVG 像素，例如 200
- **滑片位置**: `pos = (resistance - min) / (max - min) × 总长度`
- **拖拽**: `mousedown` + `mousemove` → 反算 resistance → 调 `setParameter('resistance', newValue)`
- **双向同步**: resistance 改变（Workbench 滑块）→ 滑片位置重算（防循环：SVG 由 props 驱动，无内部状态）
- **视觉**: 滑片左侧电阻丝高亮（亮青），右侧暗（代表接入电路的有效电阻）

### 6.5 粒子流（电流可视化）

- **方向**: 常规电流方向（正电荷流出电池正极）
- **数量**: 固定 N=15 个粒子均匀分布在回路 SVG path 上
- **速度**: `v ∝ |i|`，充电初快后慢，放电初快后慢，稳态/i=0 时静止
- **方向逻辑**:
  - `sign(i) > 0`（充电）: 粒子顺时针流动
  - `sign(i) < 0`（放电）: 粒子逆时针流动
  - `i = 0`: 粒子静止
- **位置计算**: 沿 `<path d="...">` 用 `getPointAtLength(t)` 取点，每帧 `t += speed × dt`
- **视觉**: 半径 4 的橙色实心圆 + 微弱光晕（`filter: blur` 或双层圆）

### 6.6 极板电荷可视化

- 电容画为两条短水平线（极板），间距固定
- **点阵**:
  - 上板 `+` 号阵列（红色），网格排布（如 5×4 = 最多 20 个）
  - 下板 `−` 号阵列（蓝色）
  - 显示数量 = `floor(|Q| / Qmax × 20)`
- 充电过程中点逐渐出现，放电过程中点逐渐消失
- **`+` / `−` 符号用 SVG `<text>`**，比纯圆点更直观（高中课本风格）

### 6.7 开关切换

- **UI**: Workbench 的 `switchMode` select 下拉（项目既有控件，零定制）
- **三态视觉**（SVG 内）:
  - `charging`: 开关闭合，连接电池 → 电容回路
  - `discharging`: 开关切换到另一位置，连接电容短路回路
  - `disconnected`: 开关悬空，导线断开
- **状态切换语义**:
  - **电容电压必须保留**（切换时不重置 U_C）
  - `disconnected` 下 i = 0、U_C 保持
  - 充电中切放电：从当前 U_C 开始衰减
  - 放电中切充电：从当前 U_C 继续充到 U₀

---

## 7. 3D 元件视图（可选叠加，已定稿）

### 7.1 触发方式
`showField3D=true` 时在 SVG 电路图下方挂载 3D 子视图（`Capacitor3DView`）。
**架构选择**: 在 2D 容器内嵌套一个独立 R3F `<Canvas>`（不通过 `SceneContainer`，避免双 Canvas 路由复杂度），尺寸固定（如 400×300），可由 Workbench 开关显隐。

### 7.2 3D 元素

| 元素 | 实现 | 视觉 |
|------|------|------|
| **极板** | `CylinderGeometry`（薄圆盘，半径 2，厚度 0.1）× 2 | 上板红色微透明，下板蓝色微透明 |
| **电场线** | 极板间垂直 `Line`，数量 ∝ \|Q\| | `#22D3EE` 青，半透明 |
| **关键矢量箭头** | `ArrowHelper` × 4–8 个 | 与电场线同色，避免杂乱 |
| **极板表面电荷** | 小球（`SphereGeometry`，半径 0.08）网格排布 | + 红 / − 蓝，数量 ∝ \|Q\| |
| **环境光** | `ambientLight(0.28)` + `pointLight` × 2 | 与 `SceneContainer` DefaultLighting 一致 |
| **背景** | `#0D1117` | 与 2D 视图统一 |

### 7.3 资源管理
- `Capacitor3DView` 暴露 `group: THREE.Group` + `update(state, dt)` + `dispose()`
- `showField3D` 切换为 false 时调用 `dispose()` 释放资源（参考 `disposeObject3D`）
- 实验类 `dispose()` 时强制清理 3D 视图

---

## 8. ★ 视觉协调性总则（新增章节，针对"精美统一协调"要求）

### 8.1 设计语言（与项目完全一致）

| 维度 | 规范 | 参考实现 |
|------|------|---------|
| **深底色** | `#0D1117` | 全站 |
| **卡片底** | `bg-slate-900/55` + `border-white/10` + `rounded-2xl` | Workbench 控件 |
| **强调色** | 青 `#22D3EE` + 蓝 `#60A5FA` + 靛 `#818CF8` 渐变 | 全站标题、按钮 |
| **暖色对比** | 橙 `#F97316` / 红 `#F87171`（仅用于物理语义：电流/正极） | — |
| **冷色对比** | 翠绿 `#34D399`（仅用于电荷量监控）/ 蓝 `#60A5FA`（负极/电压） | — |
| **字体** | Nunito（全站已配，`Home.tsx:675`） | — |
| **圆角** | 大块 `rounded-2xl`（20px），小块 `rounded-lg`（8px） | Workbench |
| **毛玻璃** | `backdrop-blur-xl` + `bg-slate-900/80` | Header、Workbench |
| **阴影** | `shadow-[0_18px_55px_rgba(2,12,27,0.45)]` | ExperimentView Header |
| **过渡** | `transition-all duration-200` | 按钮 |
| **渐变光晕** | `blur-3xl` 装饰圆斑 | ExperimentView 主区 |

### 8.2 首页卡片视觉规范（与现有 16 张卡片完全统一）

参考 `Home.tsx:38-511` 所有缩略图组件，新增的 `CapacitorCircuitDiagram` 必须遵守：

| 维度 | 规范 |
|------|------|
| **SVG 尺寸** | `width="240" height="132" viewBox="0 0 240 132"` |
| **容器** | `<div className="relative flex h-36 w-full items-center justify-center">` |
| **opacity** | `className="overflow-visible opacity-80"`（0.75–0.85） |
| **渐变定义** | `<defs>` 内 `<linearGradient>` / `<radialGradient>` |
| **动画** | 必须含 `<animate>` 或 `<animateTransform>`，duration 1.4–2.8s |
| **配色** | 与卡片 gradient `from-amber-900/20 via-yellow-900/10 to-orange-900/20` 呼应（电容=电磁学暖金调） |

**注意**: 电容实验卡片配色由原定的 `from-blue-900/20 via-cyan-900/10 to-teal-900/20` 改为 **`from-amber-900/20 via-yellow-900/10 to-orange-900/20`**。理由：
- 蓝/青/绿冷色调已被 Hydrogen / Synchrotron / SolarSystem 等占用
- 电磁学高中实验台多为暖色（铜线、金色电池、暖光）
- 与同分类的 `galvanic-cell`（原电池）`from-amber-900/20 via-yellow-900/10 to-orange-900/20` 保持同色系，凸显"电磁学"类别识别

### 8.3 缩略图内容设计

`CapacitorCircuitDiagram` 元素：
- 中央：电容极板（两条水平短线，红色上 + 蓝色下）
- 极板间：3–4 条垂直电场线（青色虚线 + 流动动画）
- 左侧：电池简化符号（红蓝双线条）
- 右上：电阻矩形（暗色，配滑片小圆）
- 装饰：粒子小球沿导线流动（橙色，`<animate>` cx 属性）
- 渐变光晕：极板中央径向渐变（暖金色 → 透明）

### 8.4 曲线图视觉（无需定制）

`QuantityChart` 已使用 recharts 默认样式，与 Workbench 背景协调。监控量颜色（青/橙/翠绿）通过 `monitorSchema.quantities[].color` 注入，已在 §4 定稿。

---

## 9. 执行阶段（已二次审查）

| Phase | 内容 | 预估 | 交付物 |
|-------|------|------|--------|
| **0** | 改 `simulationStore` + `MonitorSchema` 支持 `maxHistoryLength` | 0.5h | 现有实验回归通过 |
| **1** | `RCCircuitPhysics.ts` RK4 + 单元测试 | 1.5h | 测试全通过 |
| **2** | `CapacitorExperiment.ts` 主类 + 注册 + 首页卡片（含 SVG 缩略图） | 1.5h | 可访问空白实验页 |
| **3** | `CircuitView2D.ts` SVG 电路图 + 滑动变阻器 + 粒子流 + 极板电荷 + 公式标注 | 3.5h | 完整教学界面 |
| **4** | `Capacitor3DView.ts` 3D 元件视图（可选叠加） | 2h | showField3D 开关生效 |
| **5** | 视觉微调 + 构建验证 + e2e 清单 | 1h | 生产构建通过 |

**总工时**: ~10h（比初版 +1.5h，主要用于视觉协调性细化）

---

## 10. 扩展性预留（LC 振荡）

- `CircuitState` 字段: `{ mode, voltage, current, charge, time }`（LC 可直接扩展 `inductorCurrent`、`magneticFlux`）
- `CircuitParams` 字段: `{ resistance, capacitance, sourceVoltage }`（LC 扩展 `inductance`）
- 未来 LC 实验: `src/experiments/electromagnetism/lc-oscillation/`，复用本目录的 `CircuitView2D` 框架
- 物理模块用 RK4，LC 二阶振荡方程同样适用，无需改数值方法

---

## 11. 风险与已知约束

1. **资源释放**: 3D 视图必须在 `showField3D=false` 与 `experiment.dispose()` 时递归释放（参考 Synchrotron）
2. **dt 钳制**: `update(dt)` 内部 `dt = Math.min(dt, 1/30)`，与 Synchrotron 一致，避免大 dt 数值爆炸
3. **避免 config.json 陷阱**: Rutherford 的 config.json 未被读取，本实验所有配置走类的 `config` 字段
4. **2D React 子树生命周期**: `init()` 用 `ReactDOM.createRoot`，`dispose()` 用 `root.unmount()`，避免内存泄漏
5. **滑动变阻器双向同步**: SVG 完全由 props 驱动（无内部状态），避免循环更新
6. **3D Canvas 嵌套**: 在 2D 容器内嵌入独立 Canvas 需确保事件不冲突（3D Canvas 限制在固定区域内）
7. **2D 容器 resize**: `ExperimentCanvas2D` 已通过 `ResizeObserver` 调用 `onResize`，SVG 应用 `viewBox` 保持响应式

---

## 12. 变更记录

| 日期 | 版本 | 变更 |
|------|------|------|
| 2026-08-06 | v0.1 | 初稿 |
| 2026-08-06 | v1.0 | 定稿：滑动变阻器、采样、单位、配色 |
| 2026-08-06 | **v2.0** | **二次审查重大修正**：<br>① 发现项目已内置 `renderMode: '2d'` 机制，改走 `ExperimentCanvas2D`（避免新增路由与 MacroExperimentView）<br>② 新增 §8 视觉协调性总则，强制对齐项目深底/青蓝渐变/毛玻璃规范<br>③ 首页卡片配色改为暖金调（与 `galvanic-cell` 电磁学同色系）<br>④ 物理积分升级为 RK4（原欧拉法在大 dt 下不收敛）<br>⑤ 缩略图规范严格对齐其他 16 张卡片的尺寸/动画/渐变要求<br>⑥ 极板电荷改用 `+`/`−` 文本符号（高中课本风格）<br>⑦ 工时 +1.5h 用于视觉协调性 |
