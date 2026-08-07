# 电容充放电实验 — 单刀双掷开关拓扑重构设计规格

> 状态: **v1.0（待审阅）**
> 创建日期: 2026-08-07
> 前置文档: `docs/superpowers/specs/2026-08-06-capacitor-rc-circuit-design.md` (v2.0)
> 关联代码: `src/experiments/electromagnetism/capacitor-charge-discharge/`

---

## 1. 背景与动机

### 1.1 问题陈述

v2.0 实现采用**单回路拓扑**：电源、开关、变阻器 R、电容 C 串联在单一矩形回路中。放电时物理引擎复用同一 R 形成闭合回路（`current = -U_C / R`），但存在两个根本性问题：

1. **电路拓扑不真实**：真实高中物理 RC 实验使用**单刀双掷开关**实现充放电切换，放电支路应有独立的用电器（如小灯泡），而非直接短路电容
2. **视觉表达错误**：2D 视图中开关向右闭合后右接点悬空，无导线连接到电容；粒子沿同一矩形回路流动，放电时会经过电池位置（物理上不正确）

### 1.2 目标

将电路拓扑从单回路重构为**双支路 H 型**结构：
- **充电支路**：电源 → 变阻器 R → 电容 C → 开关掷 1 → 电源负极
- **放电支路**：电容 C → 变阻器 R → 开关掷 2 → 小灯泡 R_L → 电容负极（电源不接入）
- **断开状态**：开关居中，电路开路

R 始终串联在主回路中（无论充放电），灯泡 R_L 仅在放电时接入。

---

## 2. 电路拓扑设计

### 2.1 完整拓扑图

**物理接线规则**（高中实验标准接法）：

- **R 和 C 始终串联**，作为不可拆分的公共支路（R 上端 = 节点 A，C 下端 = 节点 B）
- **节点 A**（R 上端）连接到：电源正极（U₀+）和灯泡的一端
- **节点 B**（C 下端）连接到：**开关公共端**（始终连通）
- **开关掷 1** 连接到：电源负极（U₀-）
- **开关掷 2** 连接到：灯泡的另一端

```
              节点A
               │
      ┌────────┴────────┐
      │                  │
 [电源 U₀+]         [灯泡 R_L]
      │                  │
 [电源 U₀-]              │
      │                  │
  [开关掷1]          [灯泡下端]
                        │
      ┌─────────[开关]──┤  （掷2 接灯泡下端）
      │          公共端  │
      │             │    │
      │         节点B ←──┘
      │             │
      │        [电容 C 下板]
      │             │
      │        [电容 C 上板]
      │             │
      └─→ [R 变阻器] ←┘ （R 上端 = 节点A）
```

**充电模式**（开关 → 掷 1）：

```
  U₀+ → 节点A → R → C上板 → C → C下板 → 节点B → 开关公共端 → 掷1 → U₀-

  闭合回路：电源 + R + C
  灯泡两端都连节点A，等电位 → 无电流流过灯泡
  τ_充 = R × C
```

**放电模式**（开关 → 掷 2）：

```
  C+ → R → 节点A → 灯泡 → 灯泡下端 → 掷2 → 开关公共端 → 节点B → C-

  闭合回路：C + R + 灯泡 R_L（R 与 R_L 串联）
  电源正负极均不在回路中（U₀+ 连节点A，U₀- 连掷1，但掷1 未接通）
  τ_放 = (R + R_L) × C
```

**断开模式**（开关居中）：

```
  开关公共端未连接掷1 也未连接掷2 → 节点B 悬空 → 开路
  U_C 保持当前值不变
```

### 2.2 关键性质

| 性质 | 说明 |
|------|------|
| R 始终串联 | 无论充放电，R 都在闭合回路中 |
| 灯泡等电位旁路（充电时） | 灯泡两端都连节点A，无压降，不亮 |
| 电源完全隔离（放电时） | 放电回路不含电源，U₀ 不影响放电过程 |
| τ_放 > τ_充 | 放电回路多了 R_L，τ 更大，放电更慢 |

### 2.3 时间常数对比

| 参数 | 默认值 | 充电 τ | 放电 τ |
|------|--------|--------|--------|
| R=10kΩ, C=1000μF, R_L=5kΩ | | 10s | 15s |
| R=1kΩ, C=100μF, R_L=5kΩ（最小 C） | | 0.1s | 0.6s |
| R=50kΩ, C=5000μF, R_L=5kΩ（最大） | | 250s | 275s |

放电始终比充电慢（多了 R_L 的贡献），视觉上灯泡逐渐变暗的过程清晰可见。

---

## 3. 物理引擎变更

### 3.1 CircuitParams 接口（新增 loadResistance）

```typescript
export interface CircuitParams {
    resistance: number;      // kΩ（变阻器，可调 1-50）
    capacitance: number;     // μF（可调 100-5000）
    sourceVoltage: number;   // V（可调 1-12）
    loadResistance: number;  // kΩ（灯泡固定 5kΩ，不可调）
}
```

### 3.2 ODE 修改

```
charging:     dU/dt = (U₀ - U) / (R_Ω × C_F)
              τ_充 = R_Ω × C_F

discharging:  dU/dt = -U / ((R_Ω + R_L_Ω) × C_F)
              τ_放 = (R_Ω + R_L_Ω) × C_F

disconnected: dU/dt = 0
```

### 3.3 电流计算

```typescript
charging:     i = (U₀ - U_next) / R_Ω
              （电流仅流过 R，方向：正）

discharging:  i = -U_next / (R_Ω + R_L_Ω)
              （电流流过 R + R_L 串联，方向：负）

disconnected: i = 0
```

### 3.4 analyzeTimeConstant 函数

```typescript
// 充电时间常数
export function analyzeTimeConstant(params: CircuitParams): number {
    return params.resistance * params.capacitance * 1e-3;
}

// 放电时间常数（新增）
export function analyzeDischargeTimeConstant(params: CircuitParams): number {
    return (params.resistance + params.loadResistance) * params.capacitance * 1e-3;
}
```

### 3.5 RK4 积分

保持不变（四阶 Runge-Kutta），仅 `deriv` 函数的 τ 计算分支不同。

### 3.6 SwitchMode 类型

保持不变：`'charging' | 'discharging' | 'disconnected'`

---

## 4. 2D 视图布局重构

### 4.1 坐标系统

viewBox 保持 `800 × 500`。

### 4.2 H 型双支路布局

**布局策略**：将物理拓扑映射到视觉上直观的 H 型结构。

- **顶部水平段**（y=80）：充电支路 — 含电源 U₀ 和变阻器 R
- **右侧垂直段**（x=680）：公共支路 — 含电容 C（R 和 C 串联在右上→右下）
- **左侧垂直段**（x=120）：开关区 — 开关位于中央，掷 1 向上接充电回路，掷 2 向下接放电回路
- **底部水平段**（y=320）：放电支路 — 含小灯泡 R_L

```
         x=120                                    x=680

         [掷1接点]                         ┌──[R 变阻器]──┐
y=100       ●                                │              │
         \  │                              [电池 U₀]    [电容 C]
          \ │                               │              │
y=180   ──[开关铰链]── (水平拨杆)             │              │
          /  │                              │              │
y=240      ●                                │              │
         [掷2接点]                          │              │
            │                               │              │
            └───[小灯泡 R_L]─────────────────┘              │
            │                                               │
y=320   ┌───┴───────────────────────────────────────────────┘
        └──────────────（底部公共回路）─────────────────────┘
```

**具体坐标常量**（SVG 坐标，原点左上角）：

```typescript
const LOOP = {
    left: 120,
    right: 680,
    top: 100,         // 上支路（充电回路）y
    bottom: 320,      // 下支路（放电回路）y
};

// 电源：左上区域，垂直放置
const BATTERY = { x: 280, yTop: 100, yBottom: 160 };

// 滑动变阻器：上支路水平放置，R 右端连电容上板
const RHEOSTAT = { xStart: 380, xEnd: 580, y: LOOP.top };

// 电容：右侧垂直放置，上板连 R 右端，下板连开关公共端
const CAPACITOR = { x: LOOP.right, yTop: 180, yBottom: 260 };

// 单刀双掷开关：左侧中央，铰链=公共端（连电容下板）
const SWITCH = {
    x: LOOP.left,
    yPivot: 200,      // 铰链（公共端）
    length: 40,
    contactCharge: { x: LOOP.left, y: 100 },   // 掷1（向上，接充电回路顶部）
    contactDischarge: { x: LOOP.left, y: 300 }, // 掷2（向下，接放电回路）
};

// 小灯泡：下支路水平放置
const BULB = { cx: 350, cy: LOOP.bottom, radius: 22 };
```

**导线连接关系**（与 §2.1 拓扑一致）：

| 导线 | 起点 | 终点 | 说明 |
|------|------|------|------|
| W1 | 掷1接点 (120,100) | 电池正极 (280,100) | 充电回路：开关→电源 |
| W2 | 电池负极 (280,160) | R 左端 (380,100) | 充电回路：电源→R（经折线） |
| W3 | R 右端 (580,100) | 电容上板 (680,180) | 公共支路：R→C |
| W4 | 电容下板 (680,260) | 开关铰链 (120,200) | 公共支路：C→开关公共端 |
| W5 | 掷2接点 (120,300) | 灯泡左端 (328,320) | 放电回路：开关→灯泡 |
| W6 | 灯泡右端 (372,320) | 节点A (R 左端附近) | 放电回路：灯泡→节点A |

**注意**：W6 是放电回路的关键——灯泡右端连回节点 A（R 左端 / 电池正极），使放电电流经过 R 回到电容上板。充电时这条线也存在但无电流（两端等电位）。

### 4.3 开关渲染（单刀双掷三接点）

| mode | 拨杆指向 | 颜色 |
|------|----------|------|
| `disconnected` | 水平向右（悬空） | `#64748B` 灰 |
| `charging` | 向上接点 (120, 100) | `#22D3EE` 青 |
| `discharging` | 向下接点 (120, 300) | `#F97316` 橙 |

### 4.4 导线高亮规则

| 导线 | 充电 | 放电 | 断开 |
|------|------|------|------|
| W1（掷1→电源正极） | **青色** | 灰色 50% | 灰色 |
| W2（电源负极→R 左端） | **青色** | **橙色**（放电也流经 R） | 灰色 |
| W3（R 右端→电容上板） | **青色** | **橙色** | 灰色 |
| W4（电容下板→开关铰链） | **青色** | **橙色** | 灰色 |
| W5（掷2→灯泡左端） | 灰色 | **橙色** | 灰色 |
| W6（灯泡右端→节点A） | 灰色（等电位无电流） | **橙色** | 灰色 |

### 4.5 小灯泡渲染

**灯泡图标**（SVG）：
- 灯泡外形：圆形 `<circle>` + 灯丝（两条交叉线）
- 灯座：底部小矩形
- 颜色随电流变化：
  - 不亮（i=0）：`#475569` 深灰
  - 最大亮度（|i|=i_max）：`#FBBF24` 暖金色 + 光晕

**光晕效果**：
- 用 SVG `<filter>` 的 `feGaussianBlur` 实现外发光
- 多层叠加：外层大半径低 opacity + 内层小半径高 opacity
- 亮度 = `Math.min(|i| / i_max_discharge, 1)`

**i_max_discharge 计算**：
```typescript
// 放电瞬间最大电流（U_C 最大时）
const i_max_discharge = params.sourceVoltage / (R_Ω + R_L_Ω);
const brightness = Math.min(Math.abs(state.current) / i_max_discharge, 1);
```

### 4.6 粒子系统变更

**双路径**：
- 充电路径：上矩形回路 path（电池→R→电容→开关→电池）
- 放电路径：下回路 path（电容→开关→灯泡→公共段→R→电容）

**粒子颜色随 mode 切换**：
- 充电：青色 `#22D3EE`
- 放电：橙色 `#F97316`
- 断开：冻结，保持当前颜色

**方向**：
- 充电：顺时针（正向电流）
- 放电：逆时针（反向电流）

### 4.7 公式卡片更新

| mode | 公式 | τ 显示 |
|------|------|--------|
| charging | `U_C(t) = U₀(1 − e^(−t/RC))` | `τ_充 = RC = X.XX s` |
| discharging | `U_C(t) = U_C(0)·e^(−t/(R+R_L)C)` | `τ_放 = (R+R_L)C = X.XX s` |
| disconnected | `U_C(t) = const` | — |

---

## 5. 不变的部分

以下部分**不修改**，保持 v2.0 实现不变：

- ✅ **3D 视图**（Capacitor3DView.ts + Capacitor3DCanvas.tsx）：只渲染电容本身（两板 + 板间电场），不受外电路拓扑影响
- ✅ **RK4 积分算法**：仅修改 `deriv` 函数中 τ 的计算
- ✅ **双 rAF 架构**：ExperimentCanvas2D rAF（物理）+ CircuitView2D rAF（视图）
- ✅ **Monitor 图表**：电压/电流/电荷曲线，颜色和数据源不变
- ✅ **参数滑块**：resistance / capacitance / sourceVoltage（不新增 UI 控件，loadResistance 为内部固定值）
- ✅ **dt 钳制**（1/30s）和防御性检查
- ✅ **dispose 异步卸载**（queueMicrotask）
- ✅ **SwitchMode 类型**（3 个值）
- ✅ **ExperimentBase2D 生命周期**
- ✅ **对象池模式**（3D 视图）
- ✅ **Set 去重 dispose**（3D 视图）

---

## 6. 数据契约变更

### 6.1 getDisplayData() 更新

新增 `loadResistance` 显示项：

```typescript
loadResistance: {
    label: 'Load Resistance',
    value: '5.0',  // 固定值
    unit: 'kΩ',
},
```

### 6.2 getParams() 更新

```typescript
getParams(): CircuitParams {
    return {
        resistance: this.getSafeNumber('resistance', 10, 1, 50),
        capacitance: this.getSafeNumber('capacitance', 1000, 100, 5000),
        sourceVoltage: this.getSafeNumber('sourceVoltage', 6, 1, 12),
        loadResistance: 5,  // 固定值，不作为可调参数暴露
    };
}
```

### 6.3 Monitor Schema

不变（voltage / current / charge 三个量，颜色和单位不变）。

---

## 7. 实现范围

### 7.1 需修改的文件

| 文件 | 改动量 | 说明 |
|------|--------|------|
| `RCCircuitPhysics.ts` | 中 | 新增 loadResistance 参数，修改 ODE 的 τ 计算 |
| `CircuitView2D.tsx` | 大 | 2D 布局从单矩形重构为 H 型双支路，新增灯泡渲染，新增双粒子路径 |
| `CapacitorExperiment.ts` | 小 | getParams() 增加 loadResistance，getDisplayData() 增加灯泡阻值显示 |

### 7.2 不需修改的文件

- `Capacitor3DView.ts`（3D 只渲染电容本身）
- `Capacitor3DCanvas.tsx`（R3F 包装）
- `index.ts`（导出不变）
- `RCCircuitPhysics.test.ts`（需新增测试用例，但现有测试结构不变）

### 7.3 需新增的测试

- 放电时 τ = (R + R_L) × C 验证
- 放电末态 U_C → 0 验证
- 充电末态 U_C → U₀ 验证
- 灯泡阻值正确传入物理引擎验证

---

## 8. 验收标准

### 8.1 物理正确性

- [ ] 充电时 U_C 单调递增趋向 U₀（误差 < 0.01V）
- [ ] 放电时 U_C 单调递减趋向 0（误差 < 0.01V）
- [ ] 充电 τ = R × C（达到 63.2% 的时间）
- [ ] 放电 τ = (R + R_L) × C（衰减到 36.8% 的时间）
- [ ] 切换 mode 时 U_C 连续不跳变

### 8.2 视觉正确性

- [ ] 开关拨杆随 mode 切换指向（上=充电，下=放电，水平=断开）
- [ ] 充电时上支路（电池→R→电容）青色高亮，灯泡灰色不亮
- [ ] 放电时下支路（电容→灯泡→R）橙色高亮，电池段灰色
- [ ] 灯泡亮度随放电电流大小变化（开始最亮，逐渐变暗）
- [ ] 粒子充电时走上回路（青色顺时针），放电时走下回路（橙色逆时针）
- [ ] 断开时所有动画冻结，U_C 保持不变

### 8.3 工程质量

- [ ] `npx tsc --noEmit` 零错误
- [ ] `npx tsx --test RCCircuitPhysics.test.ts` 全部通过
- [ ] `npm run build` 成功
- [ ] 浏览器 Console 无错误/警告（排除已知的 recharts 项目级问题）
- [ ] 物理引擎无 NaN 输出（防御性检查有效）

---

## 9. 风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| 双 path 粒子系统增加复杂度 | 中 | 粒子池复用，仅切换 path 引用 |
| H 型布局坐标重算可能引入错误 | 低 | 用常量定义所有节点坐标，集中管理 |
| 灯泡光晕 SVG filter 性能 | 低 | 仅在放电模式下启用 filter，其他模式跳过 |
| 放电 τ 计算（R+R_L）容易遗漏 | 中 | 单元测试覆盖，公式卡片明确显示 |

---

## 10. 未来扩展

本次重构为以下扩展预留空间：
- **LC 振荡**：将灯泡替换为电感 L，观察振荡现象
- **RLC 阻尼**：在放电支路同时串联 R_L 和 L
- **可调灯泡**：将 loadResistance 暴露为 UI 滑块（当前固定 5kΩ）

---

## 变更记录

| 日期 | 版本 | 说明 |
|------|------|------|
| 2026-08-07 | v1.0 | 初版：单刀双掷开关拓扑重构设计 |
