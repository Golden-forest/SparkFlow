import type {
    ExperimentMetadata,
    ExperimentConfig2D,
    DisplayValue,
    MonitorSchema,
    ControlSchema,
} from '@/experiments/base';
import { ExperimentBase2D, registerExperiment2D } from '@/experiments/base';
import { ExperimentCategory } from '@/utils/constants';
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
    createInitialState,
    step,
    type CircuitParams,
    type CircuitState,
    type SwitchMode,
} from './RCCircuitPhysics';
// Phase 3: import CircuitView2D React 子树
import { CircuitView2D } from './CircuitView2D';

/**
 * 电容充放电（RC 一阶电路）实验
 *
 * 物理模块见 ./RCCircuitPhysics.ts（RK4 积分）。
 * 本类负责：
 * - 声明 metadata + 参数 schema（驱动 ExperimentWorkbench 的声明式 UI）
 * - 每帧把 parameters 同步到 physicsState 并调用 step()
 * - 提供 getDisplayData / getMonitorSchema（Monitor 面板 + 图表）
 * - 在 setupScene 内挂载一个占位 div，Phase 3 会替换为 React 子树（CircuitView2D）
 *
 * 关键约束（spec §6.7）：切换 switchMode 时**不重置** U_C，
 * 只切换 mode；电流/电荷由物理模块从 U_C 自然推出。
 */
const metadata: ExperimentMetadata = {
    id: 'capacitor-charge-discharge',
    name: 'Capacitor Charge/Discharge',
    category: ExperimentCategory.Electromagnetism,
    description:
        'Investigate RC charging/discharging transients, time constants, and capacitor behavior',
    difficulty: 'intermediate',
    duration: 25,
    keywords: [
        'capacitor',
        'RC circuit',
        'charging',
        'discharging',
        'time constant',
        'transient',
    ],
    thumbnail: '/thumbnails/capacitor-charge-discharge.png',
    renderMode: '2d',
};

const config: ExperimentConfig2D = {
    parameters: [
        {
            key: 'resistance',
            label: 'Resistance',
            type: 'number',
            defaultValue: 5,
            min: 1,
            max: 50,
            step: 1,
            unit: 'k\u03A9',
        },
        {
            key: 'capacitance',
            label: 'Capacitance',
            type: 'number',
            defaultValue: 200,
            min: 100,
            max: 5000,
            step: 100,
            unit: '\u00B5F',
        },
        {
            key: 'sourceVoltage',
            label: 'Source Voltage',
            type: 'number',
            defaultValue: 6,
            min: 1,
            max: 12,
            step: 0.5,
            unit: 'V',
        },
        // switchMode 不在控制面板显示（由电路图上的 SPDT 开关点击控制），
        // 但必须留在 config.parameters 里，否则 setParameter 的白名单会拒绝。
        {
            key: 'switchMode',
            label: 'Switch',
            type: 'select',
            defaultValue: 'disconnected',
            options: [
                { value: 'disconnected', label: 'Disconnected' },
                { value: 'charging', label: 'Charging' },
                { value: 'discharging', label: 'Discharging' },
            ],
        },
        {
            key: 'showField3D',
            label: 'Show 3D View',
            type: 'boolean',
            defaultValue: false,
        },
        {
            key: 'showLabels',
            label: 'Show Labels',
            type: 'boolean',
            defaultValue: false,
        },
    ],
};

@registerExperiment2D('capacitor-charge-discharge')
export class CapacitorExperiment extends ExperimentBase2D {
    readonly metadata = metadata;
    readonly config = config;

    private physicsState: CircuitState;
    /**
     * Phase 3 接入点：React root for CircuitView2D。
     * Phase 2 仅创建空 root（render null），dispose 时 unmount。
     * 这样脚手架完整，Phase 3 只需把 render(null) 改为 render(<CircuitView2D ... />)。
     */
    private reactRoot: Root | null = null;
    /**
     * React 子树挂载容器。Phase 2 暂时显示占位文本。
     * Phase 3 起作为 CircuitView2D 的宿主。
     */
    private circuitViewContainer: HTMLDivElement | null = null;

    constructor() {
        super();
        this.physicsState = createInitialState();
    }

    // --- Lifecycle ---

    /**
     * Phase 3：挂载 CircuitView2D React 子树（替代 Phase 2 的占位 div）。
     *
     * 渲染契约（双 rAF 架构）：
     * - ExperimentCanvas2D 跑一个 rAF → store.tick → experiment.update()（物理推进）
     * - CircuitView2D 跑独立的 rAF（视图自驱，每帧从 getPhysicsState()/getParams()
     *   读取最新状态，并用 DOM mutation 更新粒子位置）
     * - 两个 rAF 频率相同（均由浏览器 vsync 驱动）但相互独立，可能有 1 帧以内的
     *   相位差；对教学仿真精度无影响。视图不订阅物理层事件。
     */
    protected async setupScene(): Promise<void> {
        // 防御性清理：若之前已有 React root（重新 init 场景），先 unmount 避免泄漏
        if (this.reactRoot) {
            this.reactRoot.unmount();
            this.reactRoot = null;
        }
        if (!this.container) return;
        this.container.replaceChildren();

        this.circuitViewContainer = document.createElement('div');
        this.circuitViewContainer.style.width = '100%';
        this.circuitViewContainer.style.height = '100%';
        this.container.appendChild(this.circuitViewContainer);

        // 挂载 CircuitView2D React 子树（用 createElement，避免 .ts 文件内的 JSX 语法）
        this.reactRoot = createRoot(this.circuitViewContainer);
        this.reactRoot.render(React.createElement(CircuitView2D, { experiment: this }));
    }

    /**
     * 每帧物理推进。
     * - dt clamp 到 1/30s，避免标签页失焦后大步长破坏 RK4 精度
     * - 每帧从 parameters 读取 switchMode 并同步到 physicsState.mode（spec §6.7：
     *   切换 mode 时不重置 U_C，只切换 mode）
     */
    update(deltaTime: number): void {
        if (!this.isRunning) return;
        const clampedDt = Math.min(deltaTime, 1 / 30);
        const params = this.getParams();
        const mode = this.getParameter('switchMode') as SwitchMode;
        // 仅切换 mode，保留 voltage/current/charge/time（spec §6.7）
        this.physicsState = { ...this.physicsState, mode };
        this.physicsState = step(this.physicsState, params, clampedDt);
    }

    override reset(): void {
        this.physicsState = createInitialState();
        super.reset();
    }

    override dispose(): void {
        if (this.reactRoot) {
            // React 18 在 StrictMode 下可能在我们调用 dispose() 时仍在渲染子树
            // （useEffect cleanup 在 commit 阶段同步执行，而子树的渲染可能尚未完成）
            // 同步调用 unmount() 会触发 "synchronously unmount a root while React
            // was already rendering" 错误。延后到微任务中执行可避开渲染阶段。
            const root = this.reactRoot;
            this.reactRoot = null;
            queueMicrotask(() => {
                try {
                    root.unmount();
                } catch {
                    // 容错：root 可能已被卸载（如父组件已 unmount）
                }
            });
        }
        this.circuitViewContainer = null;
        this.physicsState = createInitialState();
        super.dispose();
    }

    /**
     * 参数变更入口。
     * switchMode 变更时不在此 mutate voltage——update() 每帧从 parameters 同步 mode，
     * 由物理模块自然演化电流/电荷（spec §6.7）。
     */
    override setParameter(key: string, value: number | string | boolean): void {
        super.setParameter(key, value);
    }

    // --- Data Output ---

    getDisplayData(): Record<string, DisplayValue> {
        return {
            voltage: {
                label: 'Capacitor Voltage',
                value: this.physicsState.voltage.toFixed(3),
                unit: 'V',
            },
            current: {
                label: 'Circuit Current',
                value: (this.physicsState.current * 1000).toFixed(3),
                unit: 'mA',
            },
            charge: {
                label: 'Capacitor Charge',
                value: (this.physicsState.charge * 1e6).toFixed(3),
                unit: '\u00B5C',
            },
            time: {
                label: 'Time',
                value: this.physicsState.time.toFixed(2),
                unit: 's',
            },
            resistance: {
                label: 'Resistance',
                value: this.getSafeNumber('resistance', 5, 1, 50).toString(),
                unit: 'k\u03A9',
            },
            capacitance: {
                label: 'Capacitance',
                value: this.getSafeNumber('capacitance', 200, 100, 5000).toString(),
                unit: '\u00B5F',
            },
            sourceVolt: {
                label: 'Source Voltage',
                value: this.getSafeNumber('sourceVoltage', 6, 1, 12).toFixed(1),
                unit: 'V',
            },
            loadResistance: {
                label: 'Load Resistance',
                value: '5.0',
                unit: 'k\u03A9',
            },
        };
    }

    /**
     * 控制面板 schema：从 config.parameters 里隐藏 switchMode。
     * switchMode 由电路图上的 SPDT 开关点击控制（不在 UI 面板显示），
     * 但保留在 config.parameters 里以便 setParameter 接受它。
     */
    override getControlSchema(): ControlSchema {
        return {
            title: 'Controls',
            parameters: this.config.parameters.filter((p) => p.key !== 'switchMode'),
        };
    }

    getMonitorSchema(): MonitorSchema {
        return {
            title: 'Monitor',
            quantities: [
                { key: 'voltage', label: 'Voltage U_C', unit: 'V', color: '#22D3EE', yMin: 0, yMax: 6 },
                { key: 'current', label: 'Current i', unit: 'mA', color: '#F97316', yMin: -1, yMax: 3.5 },
                { key: 'charge', label: 'Charge Q', unit: '\u00B5C', color: '#34D399', yMin: 0, yMax: 1300 },
            ],
            defaultSelected: ['voltage', 'current', 'charge'],
            sampleIntervalMs: 50,
            maxHistoryLength: 1000,
        };
    }

    // --- Public accessors for the React view (Phase 3) ---

    /**
     * Phase 3：暴露当前物理状态（只读）给 CircuitView2D。
     * 视图每帧从该 getter 读取最新 physicsState，无需事件订阅。
     */
    getPhysicsState(): Readonly<CircuitState> {
        return this.physicsState;
    }

    /**
     * Phase 3：暴露当前参数集合（只读）给 CircuitView2D。
     * 由视图读取以驱动元件渲染（如滑动变阻器滑片位置）。
     */
    getParams(): CircuitParams {
        return {
            resistance: this.getSafeNumber('resistance', 5, 1, 50),
            capacitance: this.getSafeNumber('capacitance', 200, 100, 5000),
            sourceVoltage: this.getSafeNumber('sourceVoltage', 6, 1, 12),
            loadResistance: 5, // 灯泡固定阻值 5kΩ，不作为可调参数暴露
        };
    }

    // --- Private Helpers ---
}
