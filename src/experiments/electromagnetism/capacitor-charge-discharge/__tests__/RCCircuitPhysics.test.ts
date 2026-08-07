/**
 * 电容充放电（RC 一阶电路）物理模块 — 单元测试
 *
 * 使用 Node.js 内置 `node:test`（无新依赖），与同分类
 * `src/experiments/electromagnetism/synchrotron/__tests__/LorentzPhysics.test.ts`
 * 风格一致。
 *
 * 默认参数（来自规格 v2.0）：
 *   R = 10 kΩ, C = 1000 μF, U₀ = 6 V
 *   → τ = R_Ω × C_F = 10000 × 0.001 = 10 s
 *
 * 数学参考（精确解析解）：
 *   充电: U_C(t) = U₀(1 - e^(-t/τ)),   残差 = e^(-t/τ)
 *   放电: U_C(t) = U₀·e^(-t/τ),         残差 = e^(-t/τ)
 *
 *   t = τ  : U_C/U₀ = 1 - 1/e ≈ 0.6321 (充电), 1/e ≈ 0.3679 (放电)
 *   t = 5τ : 残差 e^-5 ≈ 0.00674  (0.67%)
 *   t = 7τ : 残差 e^-7 ≈ 0.000912 (< 0.1%)
 *
 * 注：规格原文写"5τ 后误差 < 0.1%"，但解析解在 5τ 的残差即 0.67%，
 * RK4 也无法改变稳态偏差。为严格满足"< 0.1%"的字面要求，
 * 充/放电稳态测试跑到 7τ（70s），同时这也是更稳健的稳态判据。
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
    analyzeTimeConstant,
    createInitialState,
    step,
    type CircuitParams,
    type CircuitState,
} from '../RCCircuitPhysics.ts';

// 默认参数：τ = 10 s
const DEFAULT_PARAMS: CircuitParams = {
    resistance: 10,      // kΩ
    capacitance: 1000,   // μF
    sourceVoltage: 6,    // V
};

/**
 * 工具：把一个状态在固定参数下连续推进 n 步，返回最终状态。
 */
function rollForward(
    initial: CircuitState,
    params: CircuitParams,
    dt: number,
    steps: number,
): CircuitState {
    let s = initial;
    for (let i = 0; i < steps; i++) {
        s = step(s, params, dt);
    }
    return s;
}

// ---------- 1. 充电稳态收敛到 U₀ ----------
test('charging reaches steady state U0 within 0.1% after 7 tau', () => {
    const tau = analyzeTimeConstant(DEFAULT_PARAMS);     // 10 s
    const dt = 0.05;                                     // s
    const steps = Math.round((7 * tau) / dt);            // 1400 步 → 70 s
    const start: CircuitState = { ...createInitialState(), mode: 'charging' };

    const end = rollForward(start, DEFAULT_PARAMS, dt, steps);

    const relError = Math.abs(DEFAULT_PARAMS.sourceVoltage - end.voltage)
        / DEFAULT_PARAMS.sourceVoltage;
    assert.ok(
        relError < 0.001,
        `充电稳态误差应 < 0.1%, 实际: ${relError.toExponential(3)}, U_C=${end.voltage}`,
    );
    assert.ok(end.current >= 0, '充电末态电流应 ≥ 0');
    assert.ok(end.current < 1e-6, `充电末态电流应趋近 0, 实际: ${end.current}`);
    assert.ok(Number.isFinite(end.charge), 'charge 应为有限值');
});

// ---------- 2. 放电稳态收敛到 0 ----------
test('discharging decays to zero within 0.1% after 7 tau', () => {
    const tau = analyzeTimeConstant(DEFAULT_PARAMS);
    const dt = 0.05;
    const steps = Math.round((7 * tau) / dt);
    const start: CircuitState = {
        mode: 'discharging',
        voltage: DEFAULT_PARAMS.sourceVoltage,
        current: 0,
        charge: 0,
        time: 0,
    };

    const end = rollForward(start, DEFAULT_PARAMS, dt, steps);

    const relError = Math.abs(end.voltage) / DEFAULT_PARAMS.sourceVoltage;
    assert.ok(
        relError < 0.001,
        `放电稳态残差应 < 0.1%, 实际: ${relError.toExponential(3)}, U_C=${end.voltage}`,
    );
    assert.ok(Math.abs(end.current) < 1e-6, `放电末态电流应趋近 0, 实际: ${end.current}`);
});

// ---------- 3. 断开状态 U_C 保持 ----------
test('disconnected mode holds voltage and charge constant with zero current', () => {
    const initialVoltage = 4.2; // V，任意中间值
    const start: CircuitState = {
        mode: 'disconnected',
        voltage: initialVoltage,
        current: 99, // 故意给一个非零初值，验证会被置零
        charge: 0,
        time: 0,
    };

    const dt = 0.05;
    const end = rollForward(start, DEFAULT_PARAMS, dt, 200); // 推进 10 s

    assert.equal(end.mode, 'disconnected');
    assert.equal(end.voltage, initialVoltage, '断开模式下 U_C 应严格保持');
    assert.equal(end.current, 0, '断开模式下电流应为 0');
    // 电荷与 U_C 同步：C_F = 1000μF = 1e-3 F, Q = C × U = 4.2e-3 C
    const expectedQ = DEFAULT_PARAMS.capacitance * 1e-6 * initialVoltage;
    assert.ok(
        Math.abs(end.charge - expectedQ) < 1e-12,
        `Q 应与 U_C 同步: 期望 ${expectedQ}, 实际 ${end.charge}`,
    );
    // 时间应正常累计（允许浮点累加误差）
    assert.ok(
        Math.abs(end.time - dt * 200) < 1e-9,
        `时间应正常累计: 期望 ${dt * 200}, 实际 ${end.time}`,
    );
});

// ---------- 4. 充电 τ 时刻 U_C ≈ 0.632 × U₀ ----------
test('charging voltage reaches ~63.2% of U0 at t = tau', () => {
    const tau = analyzeTimeConstant(DEFAULT_PARAMS); // 10 s
    const dt = 0.01;                                // 整除 τ → 1000 步
    const steps = Math.round(tau / dt);
    const start: CircuitState = { ...createInitialState(), mode: 'charging' };

    const end = rollForward(start, DEFAULT_PARAMS, dt, steps);

    const expected = 0.632 * DEFAULT_PARAMS.sourceVoltage;
    const relError = Math.abs(end.voltage - expected) / DEFAULT_PARAMS.sourceVoltage;
    assert.ok(
        relError < 0.01,
        `t=τ 时 U_C 应 ≈ 0.632 U₀ (误差 < 1%), 实际 U_C=${end.voltage}, 相对误差=${relError.toExponential(3)}`,
    );
});

// ---------- 5. 放电 τ 时刻 U_C ≈ 0.368 × U₀ ----------
test('discharging voltage decays to ~36.8% of U0 at t = tau', () => {
    const tau = analyzeTimeConstant(DEFAULT_PARAMS);
    const dt = 0.01;
    const steps = Math.round(tau / dt);
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
        `t=τ 时 U_C 应 ≈ 0.368 U₀ (误差 < 1%), 实际 U_C=${end.voltage}, 相对误差=${relError.toExponential(3)}`,
    );
});

// ---------- 6. 单位换算正确 ----------
test('analyzeTimeConstant converts kOhm/uF to seconds correctly', () => {
    // R=10kΩ, C=1000μF → 10000Ω × 0.001F = 10 s
    const tau = analyzeTimeConstant({
        resistance: 10,
        capacitance: 1000,
        sourceVoltage: 6,
    });
    assert.ok(
        Math.abs(tau - 10) < 1e-9,
        `τ 应为 10 s, 实际 ${tau}`,
    );

    // 再来一组：R=1kΩ, C=100μF → 1000Ω × 1e-4 F = 0.1 s
    const tau2 = analyzeTimeConstant({
        resistance: 1,
        capacitance: 100,
        sourceVoltage: 9,
    });
    assert.ok(Math.abs(tau2 - 0.1) < 1e-12, `τ 应为 0.1 s, 实际 ${tau2}`);
});

// ---------- 7. i 与 U_C 符号关系 ----------
test('current sign matches mode: charging>0, discharging<0, disconnected=0', () => {
    // 充电初期（U_C < U₀）: i > 0
    const chargingStart: CircuitState = {
        mode: 'charging',
        voltage: 0,
        current: 0,
        charge: 0,
        time: 0,
    };
    const chargingNext = step(chargingStart, DEFAULT_PARAMS, 0.05);
    assert.ok(
        chargingNext.current > 0,
        `充电初期 i 应 > 0, 实际 ${chargingNext.current}`,
    );

    // 放电初期（U_C > 0）: i < 0
    const dischargingStart: CircuitState = {
        mode: 'discharging',
        voltage: DEFAULT_PARAMS.sourceVoltage,
        current: 0,
        charge: 0,
        time: 0,
    };
    const dischargingNext = step(dischargingStart, DEFAULT_PARAMS, 0.05);
    assert.ok(
        dischargingNext.current < 0,
        `放电初期 i 应 < 0, 实际 ${dischargingNext.current}`,
    );

    // 断开: i === 0
    const disconnectedStart: CircuitState = {
        mode: 'disconnected',
        voltage: 3,
        current: 0,
        charge: 0,
        time: 0,
    };
    const disconnectedNext = step(disconnectedStart, DEFAULT_PARAMS, 0.05);
    assert.equal(disconnectedNext.current, 0, '断开模式 i 应 === 0');
});

// ---------- 8. 大 dt（1/30s）下不发散 ----------
test('charging stays monotonic and converges with large dt = 1/30 s', () => {
    const dt = 1 / 30;                  // ≈ 0.0333 s
    const steps = 1000;                 // ≈ 33.3 s ≈ 3.33 τ
    const start: CircuitState = { ...createInitialState(), mode: 'charging' };

    // 逐步推进并记录每步电压，验证单调性
    const voltages: number[] = [];
    let s = start;
    for (let i = 0; i < steps; i++) {
        s = step(s, DEFAULT_PARAMS, dt);
        voltages.push(s.voltage);
    }

    // (a) 无 NaN / Infinity
    assert.ok(
        voltages.every((v) => Number.isFinite(v)),
        '所有步电压应为有限值',
    );

    // (b) 单调递增（不震荡）
    for (let i = 1; i < voltages.length; i++) {
        assert.ok(
            voltages[i] >= voltages[i - 1] - 1e-12,
            `电压应单调递增: step ${i} U=${voltages[i]} < prev=${voltages[i - 1]}`,
        );
    }

    // (c) 33.3 s ≈ 3.33τ 时 U_C 应已非常接近 U₀(1 - e^-3.33) ≈ 0.965 U₀
    //     断言收敛到 U₀（误差 < 1%）
    const relError = Math.abs(DEFAULT_PARAMS.sourceVoltage - s.voltage)
        / DEFAULT_PARAMS.sourceVoltage;
    assert.ok(
        relError < 0.05, // 3.33τ 时残差 e^-3.33 ≈ 0.036，故 5% 余量
        `大 dt 下充电 3.33τ 应接近稳态 (<5% 误差), 实际 U_C=${s.voltage}, 相对误差=${relError.toExponential(3)}`,
    );

    // (d) 电压不应超过 U₀（RK4 对该线性 ODE 不会过冲，但加保护断言）
    assert.ok(
        s.voltage <= DEFAULT_PARAMS.sourceVoltage + 1e-9,
        `电压不应超过 U₀, 实际 ${s.voltage}`,
    );
});

// ---------- 额外：createInitialState 契约 ----------
test('createInitialState returns disconnected zero state', () => {
    const s = createInitialState();
    assert.equal(s.mode, 'disconnected');
    assert.equal(s.voltage, 0);
    assert.equal(s.current, 0);
    assert.equal(s.charge, 0);
    assert.equal(s.time, 0);
});

// ---------- 额外：非法参数的防御性行为 ----------
test('step is defensive against invalid params (NaN / Infinity / <= 0)', () => {
    const good: CircuitState = {
        mode: 'charging',
        voltage: 1,
        current: 0.1,
        charge: 0,
        time: 5,
    };

    // R 为 NaN
    const r1 = step(good, { ...DEFAULT_PARAMS, resistance: NaN }, 0.05);
    assert.equal(r1.voltage, good.voltage, 'R=NaN 时电压应保持');
    assert.equal(r1.current, 0, 'R=NaN 时电流应被置 0');

    // C 为 Infinity
    const r2 = step(good, { ...DEFAULT_PARAMS, capacitance: Infinity }, 0.05);
    assert.equal(r2.voltage, good.voltage, 'C=Infinity 时电压应保持');
    assert.equal(r2.current, 0);

    // U₀ ≤ 0
    const r3 = step(good, { ...DEFAULT_PARAMS, sourceVoltage: 0 }, 0.05);
    assert.equal(r3.voltage, good.voltage, 'U₀=0 被视为非法，电压应保持');
    assert.equal(r3.current, 0);

    // R ≤ 0
    const r4 = step(good, { ...DEFAULT_PARAMS, resistance: -5 }, 0.05);
    assert.equal(r4.voltage, good.voltage);
    assert.equal(r4.current, 0);

    // dt ≤ 0
    const r5 = step(good, DEFAULT_PARAMS, 0);
    assert.equal(r5.voltage, good.voltage, 'dt=0 时电压应保持');
    assert.equal(r5.current, 0);
});
