# 电容充放电实验 — 单刀双掷开关拓扑重构 执行计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将电容充放电实验从单回路拓扑重构为双支路 H 型结构（单刀双掷开关 + 小灯泡放电支路），使放电电流流经独立用电器而非直接短路电容。

**Architecture:** 物理引擎新增 `loadResistance` 参数，放电 τ 从 R×C 改为 (R+R_L)×C。2D 视图从单矩形回路重构为 H 型布局，新增小灯泡 SVG 组件（含光晕效果）和双粒子路径。3D 视图、ExperimentBase2D 生命周期、Monitor 图表等完全不变。

**Tech Stack:** React 18 + TypeScript + SVG（2D 视图）+ React Three Fiber（3D 视图）+ RK4 积分（物理）+ node:test（单元测试）

**Spec:** `docs/superpowers/specs/2026-08-07-capacitor-spdt-redesign.md`

---

## File Structure

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/experiments/electromagnetism/capacitor-charge-discharge/RCCircuitPhysics.ts` | 修改 | 物理引擎：新增 loadResistance 字段、放电 τ 计算、analyzeDischargeTimeConstant 函数 |
| `src/experiments/electromagnetism/capacitor-charge-discharge/__tests__/RCCircuitPhysics.test.ts` | 修改 | 测试：更新 DEFAULT_PARAMS、修正放电 τ 测试、新增灯泡阻值验证 |
| `src/experiments/electromagnetism/capacitor-charge-discharge/CapacitorExperiment.ts` | 修改 | 实验类：getParams() 加 loadResistance、getDisplayData() 加灯泡显示项 |
| `src/experiments/electromagnetism/capacitor-charge-discharge/CircuitView2D.tsx` | 修改（大） | 2D 视图：H 型布局、三接点开关、6 段导线、灯泡组件、双粒子路径 |
| `src/experiments/electromagnetism/capacitor-charge-discharge/index.ts` | 修改 | 导出 analyzeDischargeTimeConstant |

**不改的文件：** `Capacitor3DView.ts`、`Capacitor3DCanvas.tsx`（3D 只渲染电容本身，与外电路拓扑无关）。

---

## Task 1: 物理引擎 — CircuitParams 接口新增 loadResistance

**Files:**
- Modify: `src/experiments/electromagnetism/capacitor-charge-discharge/RCCircuitPhysics.ts:45-52`

- [ ] **Step 1: 修改 CircuitParams 接口，新增 loadResistance 字段**

在 `RCCircuitPhysics.ts` 第 45-52 行，把 `CircuitParams` 接口改为：

```typescript
export interface CircuitParams {
    /** 电阻 R，单位 kΩ（显示单位） */
    resistance: number;
    /** 电容 C，单位 μF（显示单位） */
    capacitance: number;
    /** 电源电动势 U₀，单位 V */
    sourceVoltage: number;
    /** 灯泡负载电阻 R_L，单位 kΩ（固定 5kΩ，不可调） */
    loadResistance: number;
}
```

- [ ] **Step 2: 更新文件头部单位约定注释（第 9-21 行区域）**

在注释中 `CircuitParams.sourceVoltage` 行之后新增一行：

```
 * - CircuitParams.loadResistance : kΩ  （灯泡内阻，固定值）
```

- [ ] **Step 3: 验证 TypeScript 编译报错（确认所有使用 CircuitParams 的地方需要更新）**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: 报错在 `CapacitorExperiment.ts:288`（getParams 缺字段）、`RCCircuitPhysics.test.ts:36`（DEFAULT_PARAMS 缺字段）。这是预期的——后续 task 会修复。

---

## Task 2: 物理引擎 — 新增 analyzeDischargeTimeConstant 函数

**Files:**
- Modify: `src/experiments/electromagnetism/capacitor-charge-discharge/RCCircuitPhysics.ts:79` 之后

- [ ] **Step 1: 在 analyzeTimeConstant 函数后（第 79 行之后）新增 analyzeDischargeTimeConstant**

```typescript
/**
 * 计算放电时间常数 τ_放 = (R + R_L) × C（单位：秒）。
 *
 * 放电回路中 R 与 R_L 串联，故总电阻 = R + R_L。
 *
 * τ_放 = (resistance + loadResistance) × 1000 Ω × capacitance × 1e-6 F
 *      = (resistance + loadResistance) × capacitance × 1e-3 s
 *
 * 例：R=10kΩ, R_L=5kΩ, C=1000μF → 15 × 1000 × 1e-3 = 15 s
 */
export function analyzeDischargeTimeConstant(params: CircuitParams): number {
    return (params.resistance + params.loadResistance) * params.capacitance * 1e-3;
}
```

- [ ] **Step 2: 在 index.ts 中导出新函数**

在 `src/experiments/electromagnetism/capacitor-charge-discharge/index.ts` 中，把现有导出：

```typescript
export type {
    CircuitState,
    CircuitParams,
    SwitchMode,
} from './RCCircuitPhysics';
```

改为（新增 loadResistance 已随 CircuitParams 类型导出，只需加函数导出）：

```typescript
export type {
    CircuitState,
    CircuitParams,
    SwitchMode,
} from './RCCircuitPhysics';
export { analyzeTimeConstant, analyzeDischargeTimeConstant } from './RCCircuitPhysics';
```

---

## Task 3: 物理引擎 — 修改 step() 函数的放电 τ 和电流计算

**Files:**
- Modify: `src/experiments/electromagnetism/capacitor-charge-discharge/RCCircuitPhysics.ts:112-172`

- [ ] **Step 1: 在 step() 的参数校验中加入 loadResistance 检查**

在第 113-119 行的防御性检查中，加入 loadResistance。把：

```typescript
    if (
        !isValidParam(params.resistance) ||
        !isValidParam(params.capacitance) ||
        !isValidParam(params.sourceVoltage)
    ) {
        return { ...state, current: 0 };
    }
```

改为：

```typescript
    if (
        !isValidParam(params.resistance) ||
        !isValidParam(params.capacitance) ||
        !isValidParam(params.sourceVoltage) ||
        !isValidParam(params.loadResistance)
    ) {
        return { ...state, current: 0 };
    }
```

- [ ] **Step 2: 新增 R_load_ohm 和 tau_discharge 变量**

在第 121-124 行（R_ohm / C_farad / tau / U0 计算区域），把：

```typescript
    const R_ohm = params.resistance * 1000;       // kΩ → Ω
    const C_farad = params.capacitance * 1e-6;    // μF → F
    const tau = R_ohm * C_farad;                  // 秒
    const U0 = params.sourceVoltage;
```

改为：

```typescript
    const R_ohm = params.resistance * 1000;           // kΩ → Ω
    const R_load_ohm = params.loadResistance * 1000;  // kΩ → Ω
    const C_farad = params.capacitance * 1e-6;        // μF → F
    const tau_charge = R_ohm * C_farad;               // 充电 τ
    const tau_discharge = (R_ohm + R_load_ohm) * C_farad; // 放电 τ
    const U0 = params.sourceVoltage;
```

- [ ] **Step 3: 修改 tau > 0 检查（第 127-129 行）**

把：

```typescript
    if (!(tau > 0)) {
        return { ...state, current: 0 };
    }
```

改为：

```typescript
    if (!(tau_charge > 0) || !(tau_discharge > 0)) {
        return { ...state, current: 0 };
    }
```

- [ ] **Step 4: 修改 deriv 闭包（第 134-144 行）**

把：

```typescript
    const deriv = (u: number): number => {
        switch (state.mode) {
            case 'charging':
                return (U0 - u) / tau;
            case 'discharging':
                return -u / tau;
            case 'disconnected':
            default:
                return 0;
        }
    };
```

改为：

```typescript
    const deriv = (u: number): number => {
        switch (state.mode) {
            case 'charging':
                return (U0 - u) / tau_charge;
            case 'discharging':
                return -u / tau_discharge;
            case 'disconnected':
            default:
                return 0;
        }
    };
```

- [ ] **Step 5: 修改 current_next 计算（第 160-172 行）**

把：

```typescript
    let current_next: number;
    switch (state.mode) {
        case 'charging':
            current_next = (U0 - U_next) / R_ohm;
            break;
        case 'discharging':
            current_next = -U_next / R_ohm;
            break;
        case 'disconnected':
        default:
            current_next = 0;
            break;
    }
```

改为：

```typescript
    let current_next: number;
    switch (state.mode) {
        case 'charging':
            current_next = (U0 - U_next) / R_ohm;
            break;
        case 'discharging':
            current_next = -U_next / (R_ohm + R_load_ohm);
            break;
        case 'disconnected':
        default:
            current_next = 0;
            break;
    }
```

- [ ] **Step 6: 更新文件头部 ODE 注释（第 88-105 行区域）**

把注释中的放电公式更新为：

```
 * ODE:
 *   charging     : dU/dt = (U₀ - U) / τ_充        （τ_充 = R × C）
 *   discharging  : dU/dt = -U / τ_放               （τ_放 = (R + R_L) × C）
 *   disconnected : dU/dt = 0
 *
 * 电流（按高中物理符号约定，以充电电流方向为正）：
 *   charging     : i = (U₀ - U_next) / R_Ω              (≥ 0)
 *   discharging  : i = -U_next / (R_Ω + R_L_Ω)          (≤ 0)
 *   disconnected : i = 0
```

---

## Task 4: 物理引擎测试 — 更新现有测试 + 新增放电 τ 测试

**Files:**
- Modify: `src/experiments/electromagnetism/capacitor-charge-discharge/__tests__/RCCircuitPhysics.test.ts`

- [ ] **Step 1: 更新 DEFAULT_PARAMS（第 36-40 行）**

把：

```typescript
const DEFAULT_PARAMS: CircuitParams = {
    resistance: 10,      // kΩ
    capacitance: 1000,   // μF
    sourceVoltage: 6,    // V
};
```

改为：

```typescript
const DEFAULT_PARAMS: CircuitParams = {
    resistance: 10,      // kΩ
    capacitance: 1000,   // μF
    sourceVoltage: 6,    // V
    loadResistance: 5,   // kΩ（灯泡固定阻值）
};
```

- [ ] **Step 2: 更新 import（第 27-33 行）加入 analyzeDischargeTimeConstant**

把：

```typescript
import {
    analyzeTimeConstant,
    createInitialState,
    step,
    type CircuitParams,
    type CircuitState,
} from '../RCCircuitPhysics.ts';
```

改为：

```typescript
import {
    analyzeTimeConstant,
    analyzeDischargeTimeConstant,
    createInitialState,
    step,
    type CircuitParams,
    type CircuitState,
} from '../RCCircuitPhysics.ts';
```

- [ ] **Step 3: 更新放电 τ 时刻测试（第 148-169 行）**

放电 τ 从 R×C=10s 变为 (R+R_L)×C=15s。把测试改为用 `analyzeDischargeTimeConstant`：

```typescript
// ---------- 5. 放电 τ 时刻 U_C ≈ 0.368 × U₀ ----------
test('discharging voltage decays to ~36.8% of U0 at t = tau_discharge', () => {
    const tauDischarge = analyzeDischargeTimeConstant(DEFAULT_PARAMS); // 15 s
    const dt = 0.01;
    const steps = Math.round(tauDischarge / dt);
    const start: CircuitState = {
        mode: 'discharging',
        voltage: DEFAULT_PARAMS.sourceVoltage,
        current: 0,
        charge: 0,
        time: 0,
    };

    const end = rollForward(start, DEFAULT_PARAMS, dt, steps);

    const expected = 0.368 * DEFAULT_PARAMS.sourceVoltage;
    const relError = Math.abs(end.voltage - expected) / DEFAULT_PARAMS.sourceVoltage;
    assert.ok(
        relError < 0.01,
        `t=τ_放 时 U_C 应 ≈ 0.368 U₀ (误差 < 1%), 实际 U_C=${end.voltage}, 相对误差=${relError.toExponential(3)}`,
    );
});
```

- [ ] **Step 4: 更新放电稳态测试（第 78-99 行）用 analyzeDischargeTimeConstant**

把第 80 行 `const tau = analyzeTimeConstant(DEFAULT_PARAMS);` 改为：

```typescript
    const tau = analyzeDischargeTimeConstant(DEFAULT_PARAMS);
```

- [ ] **Step 5: 新增放电电流流过 R+R_L 的验证测试**

在文件末尾（第 323 行后）新增：

```typescript
// ---------- 9. 放电电流流过 R + R_L 串联 ----------
test('discharging current equals -U_C / (R + R_L)', () => {
    const start: CircuitState = {
        mode: 'discharging',
        voltage: DEFAULT_PARAMS.sourceVoltage, // 6V
        current: 0,
        charge: 0,
        time: 0,
    };
    const next = step(start, DEFAULT_PARAMS, 0.001); // 极小步长，电流≈初值

    const R_total_ohm = (DEFAULT_PARAMS.resistance + DEFAULT_PARAMS.loadResistance) * 1000;
    const expectedCurrent = -DEFAULT_PARAMS.sourceVoltage / R_total_ohm;
    const relError = Math.abs(next.current - expectedCurrent) / Math.abs(expectedCurrent);
    assert.ok(
        relError < 0.01,
        `放电电流应 ≈ -U/(R+R_L) = ${expectedCurrent.toExponential(3)} A, 实际 ${next.current.toExponential(3)}, 相对误差 ${relError.toExponential(3)}`,
    );
});

// ---------- 10. analyzeDischargeTimeConstant 公式验证 ----------
test('analyzeDischargeTimeConstant computes (R+R_L)*C correctly', () => {
    // R=10kΩ, R_L=5kΩ, C=1000μF → 15 × 1000 × 1e-3 = 15 s
    const tauD = analyzeDischargeTimeConstant(DEFAULT_PARAMS);
    assert.ok(
        Math.abs(tauD - 15) < 1e-9,
        `τ_放 应为 15 s, 实际 ${tauD}`,
    );

    // 另一组：R=1kΩ, R_L=5kΩ, C=100μF → 6 × 100 × 1e-3 = 0.6 s
    const tauD2 = analyzeDischargeTimeConstant({
        resistance: 1,
        capacitance: 100,
        sourceVoltage: 9,
        loadResistance: 5,
    });
    assert.ok(Math.abs(tauD2 - 0.6) < 1e-12, `τ_放 应为 0.6 s, 实际 ${tauD2}`);
});
```

- [ ] **Step 6: 运行测试验证全部通过**

Run: `npx tsx --test src/experiments/electromagnetism/capacitor-charge-discharge/__tests__/RCCircuitPhysics.test.ts`
Expected: 所有测试通过（原有 9 个 + 新增 2 个 = 11 个）

- [ ] **Step 7: 提交物理引擎改动**

```bash
git add src/experiments/electromagnetism/capacitor-charge-discharge/RCCircuitPhysics.ts \
        src/experiments/electromagnetism/capacitor-charge-discharge/__tests__/RCCircuitPhysics.test.ts \
        src/experiments/electromagnetism/capacitor-charge-discharge/index.ts
git commit -m "feat(physics): 放电支路加入灯泡 R_L，放电 τ=(R+R_L)C"
```

---

## Task 5: 实验类 — getParams / getDisplayData 更新

**Files:**
- Modify: `src/experiments/electromagnetism/capacitor-charge-discharge/CapacitorExperiment.ts:219-293`

- [ ] **Step 1: 更新 getParams()（第 287-293 行）**

把：

```typescript
getParams(): CircuitParams {
    return {
        resistance: this.getSafeNumber('resistance', 10, 1, 50),
        capacitance: this.getSafeNumber('capacitance', 1000, 100, 5000),
        sourceVoltage: this.getSafeNumber('sourceVoltage', 6, 1, 12),
    };
}
```

改为：

```typescript
getParams(): CircuitParams {
    return {
        resistance: this.getSafeNumber('resistance', 10, 1, 50),
        capacitance: this.getSafeNumber('capacitance', 1000, 100, 5000),
        sourceVoltage: this.getSafeNumber('sourceVoltage', 6, 1, 12),
        loadResistance: 5, // 灯泡固定阻值 5kΩ，不作为可调参数暴露
    };
}
```

- [ ] **Step 2: 在 getDisplayData() 中新增 loadResistance 显示项（第 256 行之前）**

在 `sourceVolt` 项之后（第 256 行 `}` 之后）新增：

```typescript
            loadResistance: {
                label: 'Load Resistance',
                value: '5.0',
                unit: 'k\u03A9',
            },
```

- [ ] **Step 3: 验证编译通过**

Run: `npx tsc --noEmit`
Expected: 零错误

---

## Task 6: 2D 视图 — 布局常量和颜色更新

**Files:**
- Modify: `src/experiments/electromagnetism/capacitor-charge-discharge/CircuitView2D.tsx:42-152`

- [ ] **Step 1: 更新 import（第 38 行）加入 analyzeDischargeTimeConstant**

把：

```typescript
import { analyzeTimeConstant } from './RCCircuitPhysics';
```

改为：

```typescript
import { analyzeTimeConstant, analyzeDischargeTimeConstant } from './RCCircuitPhysics';
```

- [ ] **Step 2: 更新布局常量（第 47-86 行）**

把 LOOP / BATTERY / SWITCH / RHEOSTAT / CAPACITOR 常量（第 47-86 行）替换为：

```typescript
// H 型双支路布局坐标
const LOOP = {
    left: 120,
    right: 680,
    top: 100,        // 上支路（充电回路）y
    bottom: 320,     // 下支路（放电回路）y
};

// 电池：上支路水平放置
const BATTERY = {
    x: 280,
    yTop: LOOP.top,          // = 100
    yBot: LOOP.top + 60,     // = 160
    plusLen: 32,             // 红色长线半长（水平）
    minusLen: 20,            // 蓝色短线半长（水平）
};

// 单刀双掷开关：左侧中央
const SWITCH = {
    x: LOOP.left,            // = 120
    yPivot: 200,             // 铰链 y（公共端）
    length: 40,
    contactChargeY: 100,     // 掷1 接点 y（向上，接充电回路）
    contactDischargeY: 300,  // 掷2 接点 y（向下，接放电回路）
};

// 滑动变阻器：上支路水平放置
const RHEOSTAT = {
    xStart: 380,
    xEnd: 580,
    y: LOOP.top,             // = 100
    totalLength: 580 - 380,  // 200
    bodyHeight: 16,
    knobRadius: 10,
};

// 电容：右侧垂直放置
const CAPACITOR = {
    x: LOOP.right,           // = 680
    yTop: 180,               // 上板 y
    yBot: 260,               // 下板 y
    plateHalfWidth: 32,
};

// 小灯泡：下支路中央
const BULB = {
    cx: 350,
    cy: LOOP.bottom,         // = 320
    radius: 22,
    baseWidth: 30,
    baseHeight: 10,
};
```

- [ ] **Step 3: 新增橙色高亮颜色到 COLORS（第 101-119 行）**

在 COLORS 对象中加入放电高亮色：

```typescript
const COLORS = {
    bg: '#0D1117',
    wire: '#475569',
    wireHighlight: '#22D3EE',      // 充电高亮（青色）
    wireHighlightDischarge: '#F97316', // 放电高亮（橙色）
    wireBroken: '#64748B',
    positive: '#F87171',
    negative: '#60A5FA',
    accent: '#22D3EE',
    particle: '#F97316',
    particleGlow: '#F97316',
    particleCharge: '#22D3EE',     // 充电粒子色（青）
    particleDischarge: '#F97316',  // 放电粒子色（橙）
    rheostatBody: '#334155',
    rheostatHighlight: '#22D3EE',
    rheostatKnob: '#F0F6FC',
    text: '#22D3EE',
    textDim: '#94A3B8',
    textLabel: '#CBD5E1',
    cardBg: '#0D1117',
    bulbOff: '#475569',           // 灯泡不亮
    bulbOn: '#FBBF24',            // 灯泡亮（暖金色）
    bulbGlow: 'rgba(251, 191, 36, 0.4)', // 灯泡光晕
};
```

- [ ] **Step 4: 替换粒子回路 path 常量（第 138-152 行）**

把单矩形 CIRCUIT_LOOP_D 替换为两条独立 path（充电路径 + 放电路径）：

```typescript
/**
 * 充电路径 path（粒子沿此流动，充电时顺时针）：
 * 掷1接点(120,100) → 电池正极(280,100) → 电池负极(280,160) → R左端(380,100)
 * → R右端(580,100) → 电容上板(680,180) → 电容下板(680,260)
 * → 开关铰链(120,200) → 掷1接点(120,100)
 */
const CHARGING_LOOP_D = [
    `M ${SWITCH.x} ${SWITCH.contactChargeY}`,
    `L ${BATTERY.x} ${BATTERY.yTop}`,
    `L ${BATTERY.x} ${BATTERY.yBot}`,
    `L ${RHEOSTAT.xStart} ${RHEOSTAT.y}`,
    `L ${RHEOSTAT.xEnd} ${RHEOSTAT.y}`,
    `L ${LOOP.right} ${LOOP.top}`,
    `L ${CAPACITOR.x} ${CAPACITOR.yTop}`,
    `L ${CAPACITOR.x} ${CAPACITOR.yBot}`,
    `L ${LOOP.right} ${LOOP.bottom}`,
    `L ${SWITCH.x} ${SWITCH.contactDischargeY}`,
    `L ${SWITCH.x} ${SWITCH.yPivot}`,
    `L ${SWITCH.x} ${SWITCH.contactChargeY}`,
    'Z',
].join(' ');

/**
 * 放电路径 path（粒子沿此流动，放电时逆时针）：
 * 电容上板(680,180) → R右端(580,100) → R左端(380,100) → 节点A
 * → 灯泡右端(372,320) → 灯泡左端(328,320) → 掷2接点(120,300)
 * → 开关铰链(120,200) → 电容下板(680,260) → 电容上板(680,180)
 */
const DISCHARGING_LOOP_D = [
    `M ${CAPACITOR.x} ${CAPACITOR.yTop}`,
    `L ${LOOP.right} ${LOOP.top}`,
    `L ${RHEOSTAT.xEnd} ${RHEOSTAT.y}`,
    `L ${RHEOSTAT.xStart} ${RHEOSTAT.y}`,
    `L ${BATTERY.x} ${BATTERY.yTop}`,
    `L ${BULB.cx + BULB.radius} ${BULB.cy}`,
    `L ${BULB.cx - BULB.radius} ${BULB.cy}`,
    `L ${SWITCH.x} ${LOOP.bottom}`,
    `L ${SWITCH.x} ${SWITCH.contactDischargeY}`,
    `L ${SWITCH.x} ${SWITCH.yPivot}`,
    `L ${CAPACITOR.x} ${CAPACITOR.yBot}`,
    `L ${CAPACITOR.x} ${CAPACITOR.yTop}`,
    'Z',
].join(' ');
```

---

## Task 7: 2D 视图 — FormulaCard 双 τ 显示

**Files:**
- Modify: `src/experiments/electromagnetism/capacitor-charge-discharge/CircuitView2D.tsx:207-265`

- [ ] **Step 1: 更新 FormulaCardProps 接口（第 207-211 行）**

把：

```typescript
interface FormulaCardProps {
    mode: SwitchMode;
    tau: number;
    visible: boolean;
}
```

改为：

```typescript
interface FormulaCardProps {
    mode: SwitchMode;
    tauCharge: number;
    tauDischarge: number;
    visible: boolean;
}
```

- [ ] **Step 2: 更新 FormulaCard 函数体（第 213-265 行）**

把函数签名和内容改为：

```typescript
function FormulaCard({ mode, tauCharge, tauDischarge, visible }: FormulaCardProps) {
    if (!visible) return null;
    let eqnText: string;
    let tauText: string;
    if (mode === 'charging') {
        eqnText = 'U_C(t) = U₀(1 − e^(−t/RC))';
        tauText = `τ_充 = RC = ${tauCharge.toFixed(2)} s`;
    } else if (mode === 'discharging') {
        eqnText = 'U_C(t) = U_C(0)·e^(−t/(R+R_L)C)';
        tauText = `τ_放 = (R+R_L)C = ${tauDischarge.toFixed(2)} s`;
    } else {
        eqnText = 'U_C(t) = const (open circuit)';
        tauText = `τ_充 = ${tauCharge.toFixed(2)} s, τ_放 = ${tauDischarge.toFixed(2)} s`;
    }
    const cardX = 200;
    const cardY = 26;
    const cardW = 480;
    const cardH = 56;
    return (
        <g>
            <rect
                x={cardX}
                y={cardY}
                width={cardW}
                height={cardH}
                rx={10}
                fill={COLORS.cardBg}
                fillOpacity={0.78}
                stroke={COLORS.wire}
                strokeOpacity={0.4}
                strokeWidth={1}
            />
            <text
                x={cardX + cardW / 2}
                y={cardY + 23}
                textAnchor="middle"
                fontFamily="ui-monospace, 'JetBrains Mono', Menlo, monospace"
                fontSize={15}
                fontWeight={600}
                fill={COLORS.accent}
            >
                {eqnText}
            </text>
            <text
                x={cardX + cardW / 2}
                y={cardY + 44}
                textAnchor="middle"
                fontFamily="ui-monospace, 'JetBrains Mono', Menlo, monospace"
                fontSize={12}
                fill={COLORS.textLabel}
            >
                {tauText}
            </text>
        </g>
    );
}
```

---

## Task 8: 2D 视图 — 双粒子路径 ref 和 updateParticles 修改

**Files:**
- Modify: `src/experiments/electromagnetism/capacitor-charge-discharge/CircuitView2D.tsx:336-414`

- [ ] **Step 1: 替换单个 pathRef 为双 pathRef（第 337-342 行）**

把：

```typescript
    // 闭合 path ref（用于 getPointAtLength / getTotalLength）
    const pathRef = useRef<SVGPathElement | null>(null);
```

改为：

```typescript
    // 双 path ref（充电路径 + 放电路径，用于 getPointAtLength / getTotalLength）
    const chargingPathRef = useRef<SVGPathElement | null>(null);
    const dischargingPathRef = useRef<SVGPathElement | null>(null);
    // 当前激活的 path 长度缓存
    const chargingPathLen = useRef<number>(0);
    const dischargingPathLen = useRef<number>(0);
```

- [ ] **Step 2: 修改 updateParticles 函数（第 373-414 行）**

把整个 `updateParticles` 函数替换为：

```typescript
    function updateParticles(dt: number) {
        const state = experiment.getPhysicsState();
        const params = experiment.getParams();

        // 根据 mode 选择 path
        const isActiveCharge = state.mode === 'charging' && state.current > 0;
        const isActiveDischarge = state.mode === 'discharging' && state.current < 0;

        if (!isActiveCharge && !isActiveDischarge) return; // 断开或电流为 0，粒子冻结

        const pathRef = isActiveCharge ? chargingPathRef : dischargingPathRef;
        const pathLenRef = isActiveCharge ? chargingPathLen : dischargingPathLen;

        const path = pathRef.current;
        if (!path) return;
        if (pathLenRef.current === 0) {
            pathLenRef.current = path.getTotalLength();
        }
        const totalLen = pathLenRef.current;
        if (totalLen <= 0) return;

        // 计算 |i| 与 Imax 的比例
        const R_ohm = params.resistance * 1000;
        const R_load_ohm = params.loadResistance * 1000;
        const U0 = params.sourceVoltage;
        // 充电 Imax = U0/R；放电 Imax = U0/(R+R_L)
        const Imax = isActiveCharge
            ? (R_ohm > 0 ? U0 / R_ohm : 0)
            : (R_ohm + R_load_ohm > 0 ? U0 / (R_ohm + R_load_ohm) : 0);
        const speedFactor = Imax > 0 ? Math.abs(state.current) / Imax : 0;
        // direction: charging → +1（顺时针）；discharging → -1（逆时针）
        const direction = isActiveCharge ? 1 : -1;

        const speed = BASE_PARTICLE_SPEED_PX_PER_S * speedFactor * direction;

        const positions = particlePositions.current;
        const refs = particleGroupRefs.current;
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            positions[i] += speed * dt;
            // 取模到 [0, totalLen)
            let pos = positions[i] % totalLen;
            if (pos < 0) pos += totalLen;
            positions[i] = pos;
            const pt = path.getPointAtLength(pos);
            const el = refs[i];
            if (el) {
                el.setAttribute('transform', `translate(${pt.x.toFixed(2)}, ${pt.y.toFixed(2)})`);
            }
        }
    }
```

- [ ] **Step 3: 更新 SVG 中的隐藏 path 元素（原第 549-556 行）**

把单个隐藏 path：

```xml
<path
    ref={pathRef}
    d={CIRCUIT_LOOP_D}
    fill="none"
    stroke="none"
    style={{ visibility: 'hidden', pointerEvents: 'none' }}
/>
```

替换为两条隐藏 path：

```xml
{/* 隐藏的充电路径 path（仅用于 getPointAtLength） */}
<path
    ref={chargingPathRef}
    d={CHARGING_LOOP_D}
    fill="none"
    stroke="none"
    style={{ visibility: 'hidden', pointerEvents: 'none' }}
/>
{/* 隐藏的放电路径 path */}
<path
    ref={dischargingPathRef}
    d={DISCHARGING_LOOP_D}
    fill="none"
    stroke="none"
    style={{ visibility: 'hidden', pointerEvents: 'none' }}
/>
```

---

## Task 9: 2D 视图 — 开关三接点拨杆重写

**Files:**
- Modify: `src/experiments/electromagnetism/capacitor-charge-discharge/CircuitView2D.tsx:561-631`

- [ ] **Step 1: 替换开关 `<g>` 整段（原第 561-631 行）**

把整段开关渲染替换为：

```xml
{/* ===== 单刀双掷开关（左侧中央） ===== */}
<g>
    {/* 掷1 接点（上方，充电） */}
    <circle
        cx={SWITCH.x}
        cy={SWITCH.contactChargeY}
        r={3.5}
        fill={state.mode === 'charging' ? COLORS.wireHighlight : COLORS.wireBroken}
        opacity={state.mode === 'charging' ? 1 : 0.4}
    />
    {/* 掷2 接点（下方，放电） */}
    <circle
        cx={SWITCH.x}
        cy={SWITCH.contactDischargeY}
        r={3.5}
        fill={state.mode === 'discharging' ? COLORS.wireHighlightDischarge : COLORS.wireBroken}
        opacity={state.mode === 'discharging' ? 1 : 0.4}
    />
    {/* 铰链基座（公共端） */}
    <circle
        cx={SWITCH.x}
        cy={SWITCH.yPivot}
        r={4}
        fill={state.mode === 'charging' ? COLORS.wireHighlight
            : state.mode === 'discharging' ? COLORS.wireHighlightDischarge
            : COLORS.wireBroken}
    />
    {/* 拨杆：根据 mode 决定指向 */}
    {state.mode === 'disconnected' ? (
        <line
            x1={SWITCH.x}
            y1={SWITCH.yPivot}
            x2={SWITCH.x + 30}
            y2={SWITCH.yPivot}
            stroke={COLORS.wireBroken}
            strokeWidth={3}
            strokeLinecap="round"
        />
    ) : state.mode === 'charging' ? (
        <line
            x1={SWITCH.x}
            y1={SWITCH.yPivot}
            x2={SWITCH.x}
            y2={SWITCH.contactChargeY}
            stroke={COLORS.wireHighlight}
            strokeWidth={3}
            strokeLinecap="round"
        />
    ) : (
        <line
            x1={SWITCH.x}
            y1={SWITCH.yPivot}
            x2={SWITCH.x}
            y2={SWITCH.contactDischargeY}
            stroke={COLORS.wireHighlightDischarge}
            strokeWidth={3}
            strokeLinecap="round"
        />
    )}
    {/* 开关模式标签 */}
    {showLabels && (
        <text
            x={SWITCH.x - 14}
            y={SWITCH.yPivot + 4}
            textAnchor="end"
            fontFamily="Nunito, sans-serif"
            fontSize={12}
            fontWeight={700}
            fill={state.mode === 'charging' ? COLORS.wireHighlight
                : state.mode === 'discharging' ? COLORS.wireHighlightDischarge
                : COLORS.textDim}
            style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}
        >
            {state.mode}
        </text>
    )}
    {/* 接点标签 */}
    {showLabels && (
        <>
            <text
                x={SWITCH.x + 12}
                y={SWITCH.contactChargeY + 4}
                fontFamily="Nunito, sans-serif"
                fontSize={10}
                fill={COLORS.textDim}
            >
                充电
            </text>
            <text
                x={SWITCH.x + 12}
                y={SWITCH.contactDischargeY + 4}
                fontFamily="Nunito, sans-serif"
                fontSize={10}
                fill={COLORS.textDim}
            >
                放电
            </text>
        </>
    )}
</g>
```

---

## Task 10: 2D 视图 — H 型导线段重写

**Files:**
- Modify: `src/experiments/electromagnetism/capacitor-charge-discharge/CircuitView2D.tsx:633-716`

- [ ] **Step 1: 替换导线 `<g>` 整段（原第 633-716 行的单矩形 8 段导线）**

把整段导线替换为 H 型 6 段导线（W1-W6），每段根据 mode 应用高亮规则：

```xml
{/* ===== 导线（H 型 6 段，根据 mode 高亮充放电回路） ===== */}
<g>
    {/* W1: 掷1接点 → 电池正极（充电时高亮青色） */}
    <line
        x1={SWITCH.x} y1={SWITCH.contactChargeY}
        x2={BATTERY.x - BATTERY.plusLen} y2={BATTERY.yTop}
        stroke={state.mode === 'charging' ? COLORS.wireHighlight : COLORS.wire}
        strokeWidth={3}
        strokeLinecap="round"
        opacity={state.mode === 'charging' ? 0.95 : 0.5}
    />
    {/* W2: 电池负极 → R 左端（充电和放电都走此段，放电也经过 R） */}
    <line
        x1={BATTERY.x + BATTERY.plusLen} y1={BATTERY.yTop}
        x2={RHEOSTAT.xStart} y2={RHEOSTAT.y}
        stroke={state.mode === 'charging' ? COLORS.wireHighlight
            : state.mode === 'discharging' ? COLORS.wireHighlightDischarge
            : COLORS.wire}
        strokeWidth={3}
        strokeLinecap="round"
        opacity={state.mode !== 'disconnected' ? 0.95 : 0.5}
    />
    {/* W2b: 电池正极水平线 */}
    <line
        x1={BATTERY.x - BATTERY.plusLen} y1={BATTERY.yTop}
        x2={BATTERY.x + BATTERY.plusLen} y2={BATTERY.yTop}
        stroke={state.mode === 'charging' ? COLORS.wireHighlight
            : state.mode === 'discharging' ? COLORS.wireHighlightDischarge
            : COLORS.wire}
        strokeWidth={3}
        strokeLinecap="round"
        opacity={state.mode !== 'disconnected' ? 0.95 : 0.5}
    />
    {/* W2c: 电池正极 → 电池负极（垂直连接，绕过电池符号右侧） */}
    <line
        x1={BATTERY.x + BATTERY.plusLen} y1={BATTERY.yTop}
        x2={BATTERY.x + BATTERY.plusLen} y2={BATTERY.yBot}
        stroke={state.mode === 'charging' ? COLORS.wireHighlight
            : state.mode === 'discharging' ? COLORS.wireHighlightDischarge
            : COLORS.wire}
        strokeWidth={3}
        strokeLinecap="round"
        opacity={state.mode !== 'disconnected' ? 0.95 : 0.5}
    />
    {/* W2d: 电池负极水平线 */}
    <line
        x1={BATTERY.x - BATTERY.minusLen} y1={BATTERY.yBot}
        x2={BATTERY.x + BATTERY.minusLen} y2={BATTERY.yBot}
        stroke={state.mode === 'charging' ? COLORS.wireHighlight
            : state.mode === 'discharging' ? COLORS.wireHighlightDischarge
            : COLORS.wire}
        strokeWidth={3}
        strokeLinecap="round"
        opacity={state.mode !== 'disconnected' ? 0.95 : 0.5}
    />
    {/* W2e: 电池负极 → R 左端（水平向上折线） */}
    <line
        x1={BATTERY.x + BATTERY.minusLen} y1={BATTERY.yBot}
        x2={RHEOSTAT.xStart} y2={BATTERY.yBot}
        stroke={state.mode === 'charging' ? COLORS.wireHighlight
            : state.mode === 'discharging' ? COLORS.wireHighlightDischarge
            : COLORS.wire}
        strokeWidth={3}
        strokeLinecap="round"
        opacity={state.mode !== 'disconnected' ? 0.95 : 0.5}
    />
    <line
        x1={RHEOSTAT.xStart} y1={BATTERY.yBot}
        x2={RHEOSTAT.xStart} y2={RHEOSTAT.y}
        stroke={state.mode === 'charging' ? COLORS.wireHighlight
            : state.mode === 'discharging' ? COLORS.wireHighlightDischarge
            : COLORS.wire}
        strokeWidth={3}
        strokeLinecap="round"
        opacity={state.mode !== 'disconnected' ? 0.95 : 0.5}
    />
    {/* W3: R 右端 → 电容上板（公共段，充电放电都走） */}
    <line
        x1={RHEOSTAT.xEnd} y1={RHEOSTAT.y}
        x2={CAPACITOR.x} y2={RHEOSTAT.y}
        stroke={state.mode === 'charging' ? COLORS.wireHighlight
            : state.mode === 'discharging' ? COLORS.wireHighlightDischarge
            : COLORS.wire}
        strokeWidth={3}
        strokeLinecap="round"
        opacity={state.mode !== 'disconnected' ? 0.95 : 0.5}
    />
    <line
        x1={CAPACITOR.x} y1={LOOP.top}
        x2={CAPACITOR.x} y2={CAPACITOR.yTop}
        stroke={state.mode === 'charging' ? COLORS.wireHighlight
            : state.mode === 'discharging' ? COLORS.wireHighlightDischarge
            : COLORS.wire}
        strokeWidth={3}
        strokeLinecap="round"
        opacity={state.mode !== 'disconnected' ? 0.95 : 0.5}
    />
    {/* W4: 电容下板 → 开关铰链（公共段，经右侧垂直 + 底部水平） */}
    <line
        x1={CAPACITOR.x} y1={CAPACITOR.yBot}
        x2={CAPACITOR.x} y2={LOOP.bottom}
        stroke={state.mode === 'charging' ? COLORS.wireHighlight
            : state.mode === 'discharging' ? COLORS.wireHighlightDischarge
            : COLORS.wire}
        strokeWidth={3}
        strokeLinecap="round"
        opacity={state.mode !== 'disconnected' ? 0.95 : 0.5}
    />
    <line
        x1={CAPACITOR.x} y1={LOOP.bottom}
        x2={SWITCH.x} y2={LOOP.bottom}
        stroke={state.mode === 'charging' ? COLORS.wireHighlight
            : state.mode === 'discharging' ? COLORS.wireHighlightDischarge
            : COLORS.wire}
        strokeWidth={3}
        strokeLinecap="round"
        opacity={state.mode !== 'disconnected' ? 0.95 : 0.5}
    />
    <line
        x1={SWITCH.x} y1={LOOP.bottom}
        x2={SWITCH.x} y2={SWITCH.yPivot}
        stroke={state.mode === 'charging' ? COLORS.wireHighlight
            : state.mode === 'discharging' ? COLORS.wireHighlightDischarge
            : COLORS.wire}
        strokeWidth={3}
        strokeLinecap="round"
        opacity={state.mode !== 'disconnected' ? 0.95 : 0.5}
    />
    {/* W5: 掷2接点 → 灯泡（仅放电时高亮） */}
    <line
        x1={SWITCH.x} y1={SWITCH.contactDischargeY}
        x2={SWITCH.x} y2={LOOP.bottom}
        stroke={state.mode === 'discharging' ? COLORS.wireHighlightDischarge : COLORS.wire}
        strokeWidth={3}
        strokeLinecap="round"
        opacity={state.mode === 'discharging' ? 0.95 : 0.3}
    />
    <line
        x1={SWITCH.x} y1={LOOP.bottom}
        x2={BULB.cx - BULB.radius} y2={BULB.cy}
        stroke={state.mode === 'discharging' ? COLORS.wireHighlightDischarge : COLORS.wire}
        strokeWidth={3}
        strokeLinecap="round"
        opacity={state.mode === 'discharging' ? 0.95 : 0.3}
    />
    {/* W6: 灯泡右端 → 节点A（电池正极方向，仅放电时高亮） */}
    <line
        x1={BULB.cx + BULB.radius} y1={BULB.cy}
        x2={BATTERY.x + BATTERY.plusLen + 10} y2={BULB.cy}
        stroke={state.mode === 'discharging' ? COLORS.wireHighlightDischarge : COLORS.wire}
        strokeWidth={3}
        strokeLinecap="round"
        opacity={state.mode === 'discharging' ? 0.95 : 0.3}
    />
    <line
        x1={BATTERY.x + BATTERY.plusLen + 10} y1={BULB.cy}
        x2={BATTERY.x + BATTERY.plusLen + 10} y2={BATTERY.yTop}
        stroke={state.mode === 'discharging' ? COLORS.wireHighlightDischarge : COLORS.wire}
        strokeWidth={3}
        strokeLinecap="round"
        opacity={state.mode === 'discharging' ? 0.95 : 0.3}
    />
    <line
        x1={BATTERY.x + BATTERY.plusLen + 10} y1={BATTERY.yTop}
        x2={BATTERY.x + BATTERY.plusLen} y2={BATTERY.yTop}
        stroke={state.mode === 'discharging' ? COLORS.wireHighlightDischarge : COLORS.wire}
        strokeWidth={3}
        strokeLinecap="round"
        opacity={state.mode === 'discharging' ? 0.95 : 0.3}
    />
</g>
```

**注意**：放电导线段（W5/W6）从掷2接点延伸到灯泡再回到节点A。充电时这些段降为 30% opacity（几乎不可见，暗示"这条路径存在但无电流"）。

---

## Task 11: 2D 视图 — 小灯泡组件（新增）

**Files:**
- Modify: `src/experiments/electromagnetism/capacitor-charge-discharge/CircuitView2D.tsx` (新增灯泡组件 + SVG defs filter)

- [ ] **Step 1: 在 ParticleGroup 组件之前（第 266 行之前）新增 BulbLamp 子组件**

```typescript
// --- 小灯泡组件 ---

interface BulbLampProps {
    cx: number;
    cy: number;
    radius: number;
    brightness: number;  // 0..1
    active: boolean;      // 是否在放电模式
}

/**
 * 小灯泡：亮度随放电电流变化。
 * - 不亮：深灰灯泡外形 + 暗灯丝
 * - 亮：暖金色发光 + 高斯模糊光晕
 */
function BulbLamp({ cx, cy, radius, brightness, active }: BulbLampProps) {
    const bulbColor = active
        ? interpolateColor('#475569', '#FBBF24', brightness)
        : '#475569';
    const glowOpacity = active ? brightness * 0.6 : 0;
    return (
        <g style={{ pointerEvents: 'none' }}>
            {/* 光晕（仅亮时可见） */}
            {active && brightness > 0.05 && (
                <>
                    <circle cx={cx} cy={cy} r={radius * 2.2} fill="#FBBF24" opacity={glowOpacity * 0.3} filter="url(#bulbGlow)" />
                    <circle cx={cx} cy={cy} r={radius * 1.5} fill="#FBBF24" opacity={glowOpacity * 0.5} filter="url(#bulbGlow)" />
                </>
            )}
            {/* 灯泡玻璃外壳 */}
            <circle
                cx={cx}
                cy={cy}
                r={radius}
                fill={bulbColor}
                fillOpacity={active ? 0.3 + brightness * 0.5 : 0.15}
                stroke={active ? '#FBBF24' : COLORS.wire}
                strokeWidth={2}
            />
            {/* 灯丝（X 形） */}
            <line
                x1={cx - radius * 0.5} y1={cy - radius * 0.5}
                x2={cx + radius * 0.5} y2={cy + radius * 0.5}
                stroke={active ? '#FEF3C7' : COLORS.wireBroken}
                strokeWidth={1.5}
                strokeLinecap="round"
            />
            <line
                x1={cx - radius * 0.5} y1={cy + radius * 0.5}
                x2={cx + radius * 0.5} y2={cy - radius * 0.5}
                stroke={active ? '#FEF3C7' : COLORS.wireBroken}
                strokeWidth={1.5}
                strokeLinecap="round"
            />
            {/* 灯座（底部小矩形） */}
            <rect
                x={cx - 12}
                y={cy + radius - 2}
                width={24}
                height={8}
                rx={2}
                fill={COLORS.wire}
            />
        </g>
    );
}

/** 线性插值两个 hex 颜色 */
function interpolateColor(c1: string, c2: string, t: number): string {
    const parse = (hex: string) => {
        const h = hex.replace('#', '');
        return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    };
    const [r1, g1, b1] = parse(c1);
    const [r2, g2, b2] = parse(c2);
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
```

- [ ] **Step 2: 在 SVG `<defs>` 中添加高斯模糊 filter**

在 `<svg>` 开标签之后（原第 548 行之后，隐藏 path 之前）新增：

```xml
<defs>
    <filter id="bulbGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="4" />
    </filter>
</defs>
```

- [ ] **Step 3: 在导线 `<g>` 之后、电池 `<g>` 之前插入灯泡渲染**

在导线 `</g>` 之后（Task 10 替换的导线段之后）新增：

```xml
{/* ===== 小灯泡（下支路） ===== */}
<BulbLamp
    cx={BULB.cx}
    cy={BULB.cy}
    radius={BULB.radius}
    brightness={bulbBrightness}
    active={state.mode === 'discharging'}
/>
{/* 灯泡标签 */}
{showLabels && (
    <ValueTag
        x={BULB.cx}
        y={BULB.cy + BULB.radius + 24}
        text={`R_L = ${params.loadResistance} kΩ`}
        fill={state.mode === 'discharging' ? COLORS.bulbOn : COLORS.textDim}
    />
)}
```

- [ ] **Step 4: 在主组件状态计算区域新增 bulbBrightness 计算**

在 `const chargeDots = ...` 之后（约第 482 行之后）新增：

```typescript
    // 灯泡亮度（放电时随电流变化）
    const R_load_ohm = params.loadResistance * 1000;
    const i_max_discharge = R_ohm + R_load_ohm > 0 ? params.sourceVoltage / (R_ohm + R_load_ohm) : 0;
    const bulbBrightness = i_max_discharge > 0
        ? Math.min(Math.abs(state.current) / i_max_discharge, 1)
        : 0;
```

---

## Task 12: 2D 视图 — 更新 FormulaCard 调用和 tau 计算

**Files:**
- Modify: `src/experiments/electromagnetism/capacitor-charge-discharge/CircuitView2D.tsx:476-477,559`

- [ ] **Step 1: 更新 tau 计算（第 476 行）**

把：

```typescript
    const tau = analyzeTimeConstant(params);
```

改为：

```typescript
    const tauCharge = analyzeTimeConstant(params);
    const tauDischarge = analyzeDischargeTimeConstant(params);
```

- [ ] **Step 2: 更新 FormulaCard 调用（原第 559 行）**

把：

```xml
<FormulaCard mode={state.mode} tau={tau} visible={showLabels} />
```

改为：

```xml
<FormulaCard mode={state.mode} tauCharge={tauCharge} tauDischarge={tauDischarge} visible={showLabels} />
```

---

## Task 13: 编译验证 + 构建测试

**Files:** 无（仅验证）

- [ ] **Step 1: TypeScript 编译检查**

Run: `npx tsc --noEmit`
Expected: 零错误

- [ ] **Step 2: 单元测试**

Run: `npx tsx --test src/experiments/electromagnetism/capacitor-charge-discharge/__tests__/RCCircuitPhysics.test.ts`
Expected: 全部通过（11 个测试）

- [ ] **Step 3: 生产构建**

Run: `npm run build`
Expected: 成功

- [ ] **Step 4: 提交全部 2D 视图改动**

```bash
git add src/experiments/electromagnetism/capacitor-charge-discharge/CircuitView2D.tsx \
        src/experiments/electromagnetism/capacitor-charge-discharge/CapacitorExperiment.ts
git commit -m "feat(view): H 型双支路布局 + 单刀双掷开关 + 小灯泡放电支路"
```

---

## Task 14: 浏览器端到端验证

**Files:** 无（仅浏览器交互验证）

- [ ] **Step 1: 确保开发服务器运行**

Run: `curl -s http://localhost:5173 | head -5` 或 `curl -s http://localhost:5174 | head -5`
如果未运行，启动：`npm run dev`（后台）

- [ ] **Step 2: 导航到实验页面并截图初始状态**

用 Chrome DevTools MCP 导航到 `http://localhost:<port>/experiment/capacitor-charge-discharge`，截图确认：
- H 型布局正确显示（上支路有电池+R，右侧有电容，左侧有开关，下支路有灯泡）
- 开关居中（断开状态），拨杆水平向右
- 灯泡灰色不亮
- 公式卡片显示 `τ_充` 和 `τ_放` 两个值

- [ ] **Step 3: 测试充电模式**

切换 Switch 到 Charging，等待 3 秒。验证：
- 开关拨杆向上指（青色）
- 上支路（电池→R→电容）青色高亮
- 下支路（灯泡段）灰色低 opacity
- U_C 数值递增趋向 U₀
- Monitor 图表显示充电指数曲线

- [ ] **Step 4: 测试放电模式**

切换 Switch 到 Discharging，验证：
- 开关拨杆向下指（橙色）
- 下支路（掷2→灯泡→节点A）橙色高亮
- 灯泡开始最亮（暖金色），随时间逐渐变暗
- U_C 从当前值开始衰减（不重置）
- 电流为负值（反向）
- Monitor 图表显示衰减曲线

- [ ] **Step 5: 测试断开模式**

切换 Switch 到 Disconnected，验证：
- 开关拨杆水平（灰色）
- 所有导线恢复灰色
- U_C 保持当前值不变
- 灯泡不亮
- 粒子冻结

- [ ] **Step 6: 检查 Console 无错误**

用 `list_console_messages` 确认无 JavaScript 错误（recharts width/height 警告除外，这是项目级已知问题）。

- [ ] **Step 7: 最终提交（如有 fixup）**

如果浏览器测试发现问题已修复，提交修复：

```bash
git add -A
git commit -m "fix: 浏览器端到端验证修复"
```

如果一切正常无需修复，跳过此步。

---

## Self-Review

**Spec coverage check:**
- ✅ §2 拓扑设计 → Task 1-3（物理引擎 ODE/电流）
- ✅ §3 物理引擎变更 → Task 1-3（接口 + deriv + current + analyzeDischargeTimeConstant）
- ✅ §4.1 坐标系统 → Task 6（LOOP 常量）
- ✅ §4.2 H 型布局 → Task 6（所有坐标常量）
- ✅ §4.3 开关三接点 → Task 9
- ✅ §4.4 导线高亮规则 → Task 10（W1-W6 六段 + 高亮逻辑）
- ✅ §4.5 小灯泡渲染 → Task 11（BulbLamp 组件 + 光晕 filter + brightness 计算）
- ✅ §4.6 粒子双路径 → Task 8（双 pathRef + CHARGING_LOOP_D / DISCHARGING_LOOP_D）
- ✅ §4.7 公式卡片 → Task 7（双 τ 显示）+ Task 12（调用更新）
- ✅ §5 不变的部分 → 3D 视图完全不改
- ✅ §6 数据契约 → Task 5（getParams + getDisplayData）
- ✅ §7.3 测试 → Task 4
- ✅ §8 验收标准 → Task 14（浏览器端到端验证）

**Placeholder scan:** 无 TBD/TODO，每个步骤都有完整代码。

**Type consistency:** `loadResistance` 在所有 Task 中拼写一致。`analyzeDischargeTimeConstant` 函数名一致。`tauCharge` / `tauDischarge` 变量名一致。`chargingPathRef` / `dischargingPathRef` 一致。

**Scope check:** 单一聚焦目标（拓扑重构），适合单次执行。
