/**
 * 电容充放电（RC 一阶电路）物理模块
 *
 * 高中物理范围的一阶 RC 电路仿真：
 * - 充电: U_C(t) = U₀(1 - e^(-t/RC)), i(t) = (U₀ - U_C)/R
 * - 放电: U_C(t) = U_C(0)·e^(-t/RC),         i(t) = -U_C/R
 * - 断开: U_C 保持不变, i = 0
 *
 * 单位约定（接口契约，不可变）：
 * - CircuitParams.resistance    : kΩ  （显示单位）
 * - CircuitParams.capacitance   : μF  （显示单位）
 * - CircuitParams.sourceVoltage : V
 * - CircuitState.voltage        : V    (U_C)
 * - CircuitState.current        : A    (i，内部 SI)
 * - CircuitState.charge         : C    (Q)
 * - CircuitState.time           : s
 *
 * 内部 SI 换算在 step() 内部完成：
 *   R_Ω = resistance × 1000
 *   C_F = capacitance × 1e-6
 *   τ = R_Ω × C_F
 *
 * 时间积分采用经典 4 阶 Runge-Kutta（RK4）。
 *
 * 设计原则：
 * - 纯函数，零 React / Three.js 依赖
 * - 不可变：step 总是返回新的 CircuitState
 * - 防御性：非法参数不抛异常，直接保持当前状态
 */

export type SwitchMode = 'charging' | 'discharging' | 'disconnected';

export interface CircuitState {
    mode: SwitchMode;
    /** 电容两端电压 U_C，单位 V */
    voltage: number;
    /** 回路电流 i，单位 A；充电为正、放电为负、断开为 0 */
    current: number;
    /** 电容极板电荷 Q = C × U_C，单位 C */
    charge: number;
    /** 仿真累计时间，单位 s */
    time: number;
}

export interface CircuitParams {
    /** 电阻 R，单位 kΩ（显示单位） */
    resistance: number;
    /** 电容 C，单位 μF（显示单位） */
    capacitance: number;
    /** 电源电动势 U₀，单位 V */
    sourceVoltage: number;
}

/**
 * 创建初始状态：开关断开、电容无电荷、电流为零、时间为零。
 */
export function createInitialState(): CircuitState {
    return {
        mode: 'disconnected',
        voltage: 0,
        current: 0,
        charge: 0,
        time: 0,
    };
}

/**
 * 计算时间常数 τ = RC（单位：秒）。
 * 入参使用显示单位（kΩ / μF），内部换算为 SI。
 *
 * τ = (resistance × 1000 Ω) × (capacitance × 1e-6 F)
 *   = resistance × capacitance × 1e-3 s
 *
 * 例：R=10kΩ, C=1000μF → 10 × 1000 × 1e-3 = 10 s
 */
export function analyzeTimeConstant(params: CircuitParams): number {
    const tau = params.resistance * params.capacitance * 1e-3;
    return tau;
}

/**
 * 校验参数是否合法（有限正数）。
 */
function isValidParam(value: number): boolean {
    return Number.isFinite(value) && value > 0;
}

/**
 * 单步推进：用 RK4 积分 U_C 的一阶线性 ODE，再由 U_C 推出 i 和 Q。
 *
 * ODE:
 *   charging     : dU/dt = (U₀ - U) / τ
 *   discharging  : dU/dt = -U / τ
 *   disconnected : dU/dt = 0
 *
 * 电流（按高中物理符号约定，以充电电流方向为正）：
 *   charging     : i = (U₀ - U_next) / R_Ω     (≥ 0)
 *   discharging  : i = -U_next / R_Ω            (≤ 0)
 *   disconnected : i = 0
 *
 * 电荷：Q_next = C_F × U_next
 *
 * 若参数非法（NaN / Infinity / ≤ 0），返回当前状态的副本并将电流置 0，
 * 保持电压不变，避免 NaN 在调用方传播。
 */
export function step(state: CircuitState, params: CircuitParams, dt: number): CircuitState {
    // 防御性：时间步非法时直接返回当前状态副本
    if (!Number.isFinite(dt) || dt <= 0) {
        return { ...state, current: 0 };
    }

    // 防御性：R / C / U₀ 非法时保持电压不变、电流为 0
    if (
        !isValidParam(params.resistance) ||
        !isValidParam(params.capacitance) ||
        !isValidParam(params.sourceVoltage)
    ) {
        return { ...state, current: 0 };
    }

    const R_ohm = params.resistance * 1000;       // kΩ → Ω
    const C_farad = params.capacitance * 1e-6;    // μF → F
    const tau = R_ohm * C_farad;                  // 秒
    const U0 = params.sourceVoltage;

    // τ 为 0 在这里理论上不可能（已由 isValidParam 过滤），但稳健起见再做一次
    if (!(tau > 0)) {
        return { ...state, current: 0 };
    }

    const U = state.voltage;

    // 根据 mode 选择 dU/dt = f(U)
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

    // RK4 标准形式（自治一阶 ODE，因 f 不显含 t）
    const k1 = deriv(U);
    const k2 = deriv(U + (dt / 2) * k1);
    const k3 = deriv(U + (dt / 2) * k2);
    const k4 = deriv(U + dt * k3);

    const U_next = U + (dt / 6) * (k1 + 2 * k2 + 2 * k3 + k4);

    // 数值稳健性：再次校验，避免极端参数下的浮点异常
    if (!Number.isFinite(U_next)) {
        return { ...state, current: 0 };
    }

    // 由 U_next 推出 i_next（符号约定见上文）
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

    const charge_next = C_farad * U_next;

    return {
        mode: state.mode,
        voltage: U_next,
        current: current_next,
        charge: charge_next,
        time: state.time + dt,
    };
}
