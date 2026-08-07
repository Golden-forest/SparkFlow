/**
 * CircuitView2D — 电容充放电（RC）实验的 SVG 电路主视图
 *
 * 渲染策略（控制器定下，不可变）：
 * - 电路拓扑、滑动变阻器、极板电荷点阵、公式标注：用 React 声明式 SVG 渲染
 *   （数量变化频率低，可承受每帧 setState 触发的重渲染）
 * - 粒子流（每帧位置变化）：React.memo 子组件挂载一次 + 纯 DOM mutation
 *   （父组件用 ref 直接 setAttribute transform=translate(x,y)），
 *   不参与父组件 setTick 引发的 reconciliation，避免 15 个粒子 × 60fps 的 diff 开销
 *
 * 视图自驱（双 rAF 架构，与 CapacitorExperiment.setupScene 注释一致）：
 * - ExperimentCanvas2D 跑一个 rAF → store.tick → experiment.update()（物理推进）
 * - 本组件跑**独立**的 rAF，每帧从 experiment 读取最新 physicsState + params，然后：
 *   1) 用 DOM mutation 更新粒子位置（用 ref 直接 setAttribute）
 *   2) 用 setState 触发 React 重渲染（用于元件/标签/电荷点数量更新）
 * - 两个 rAF 频率相同（均由浏览器 vsync 驱动）但相互独立，可能有 1 帧以内的
 *   相位差；对教学仿真精度无影响。视图不订阅物理层事件。
 *
 * 双向同步：
 * - 滑片 cx 完全由 params.resistance 计算（无内部 state，避免循环更新）
 * - 拖拽时反算 resistance → 调 experiment.setParameter('resistance', Math.round(v))
 *   拖拽用 window 级 pointer 监听（pointerdown 时绑定，pointerup/cancel 时解绑），
 *   防止指针快速飞出滑片 circle 后丢失 move 事件
 *
 * 视觉规范（spec §8 + handoff §4）：
 * - 深底 #0D1117 + 装饰光晕
 * - 导线 stroke="#475569" strokeWidth="3"
 * - 强调色青 #22D3EE；正极/正电荷红 #F87171；负极/负电荷蓝 #60A5FA
 * - 电流粒子橙 #F97316
 * - 数值文字 font-mono fill="#22D3EE"
 * - 卡片半透明背景 fill="#0D1117" fillOpacity="0.7"
 */

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { ReactElement, PointerEvent as ReactPointerEvent } from 'react';
import type { CapacitorExperiment } from './CapacitorExperiment';
import type { CircuitState, CircuitParams, SwitchMode } from './RCCircuitPhysics';
import { analyzeTimeConstant } from './RCCircuitPhysics';
// Phase 4: 3D 子视图（showField3D=true 时挂在 SVG 下方）
import { Capacitor3DCanvas } from './Capacitor3DCanvas';

// --- Layout constants (viewBox 800x500) ---
const VIEW_W = 800;
const VIEW_H = 500;

// 矩形回路外圈坐标
const LOOP = {
    left: 120,
    right: 680,
    top: 120,
    bottom: 380,
};

// 电池位置（左导线中段）
const BATTERY = {
    x: LOOP.left,
    yTop: 220,        // 上接导线点
    yBot: 280,        // 下接导线点
    plusLen: 32,      // 红色长线半长（水平）
    minusLen: 20,     // 蓝色短线半长（水平）
};

// 开关位置（左导线上段，电池之上）
const SWITCH = {
    x: LOOP.left,
    yPivot: 165,      // 开关铰链位置
    length: 38,       // 拨杆长度
};

// 滑动变阻器（上导线中段）
const RHEOSTAT = {
    xStart: 330,
    xEnd: 530,
    y: LOOP.top,
    totalLength: 530 - 330, // 200
    bodyHeight: 16,
    knobRadius: 10,
};

// 电容（右导线中段）
const CAPACITOR = {
    x: LOOP.right,
    yTop: 240,        // 上板 y
    yBot: 290,        // 下板 y
    plateHalfWidth: 32,
};

// 极板电荷点阵（5×4 = 最多 20）
const CHARGE_GRID = {
    cols: 5,
    rows: 4,
    spacing: 11,
};

// 粒子流
const PARTICLE_COUNT = 15;
const PARTICLE_RADIUS = 4;
const PARTICLE_GLOW_RADIUS = 8;
const BASE_PARTICLE_SPEED_PX_PER_S = 320; // 在 |i| = Imax 时的速度

// 颜色（spec §6.3 / §8.1）
const COLORS = {
    bg: '#0D1117',
    wire: '#475569',
    wireHighlight: '#22D3EE',
    wireBroken: '#64748B',
    positive: '#F87171',
    negative: '#60A5FA',
    accent: '#22D3EE',
    particle: '#F97316',
    particleGlow: '#F97316',
    rheostatBody: '#334155',
    rheostatHighlight: '#22D3EE',
    rheostatKnob: '#F0F6FC',
    text: '#22D3EE',
    textDim: '#94A3B8',
    textLabel: '#CBD5E1',
    cardBg: '#0D1117',
};

// --- Helpers ---

function formatCurrent(ma: number): string {
    const abs = Math.abs(ma);
    if (abs < 0.001) return '0.00';
    if (abs < 1) return ma.toFixed(3);
    return ma.toFixed(2);
}

function formatVoltage(v: number): string {
    return v.toFixed(2);
}

function formatCharge(uc: number): string {
    return (uc * 1e6).toFixed(1);
}

/**
 * 电路回路 path（顺时针：左下 → 左上 → 右上 → 右下 → 左下 闭合）。
 * 粒子沿此 path 流动。整条路径围绕回路外圈，绕过电容极板空隙
 * （path 是回路外圈，极板在 path 内侧；视觉上粒子沿导线流动）。
 *
 * 注意：路径方向 = 充电时的常规电流方向（顺时针）。
 * direction multiplier = sign(current)：充电 current>0 → +1（顺时针）；
 * 放电 current<0 → -1（逆时针）。
 */
const CIRCUIT_LOOP_D =
    `M ${LOOP.left} ${LOOP.bottom} ` +
    `L ${LOOP.left} ${LOOP.top} ` +
    `L ${LOOP.right} ${LOOP.top} ` +
    `L ${LOOP.right} ${LOOP.bottom} ` +
    `Z`;

// --- Sub-components ---

interface ValueTagProps {
    x: number;
    y: number;
    text: string;
    fill?: string;
    align?: 'start' | 'middle' | 'end';
}

/**
 * 数值标签：font-mono 文字 + 半透明背景 rect（自适应宽度）。
 */
function ValueTag({ x, y, text, fill = COLORS.text, align = 'middle' }: ValueTagProps) {
    // 估算文字宽度（font-mono 14px ≈ 8.4 px/char）+ padding
    const padX = 8;
    const padY = 4;
    const charW = 8.4;
    const w = text.length * charW + padX * 2;
    const h = 22;
    let rx = x - w / 2;
    if (align === 'start') rx = x - padX;
    if (align === 'end') rx = x - w + padX;
    return (
        <g>
            <rect
                x={rx}
                y={y - h / 2}
                width={w}
                height={h}
                rx={6}
                fill={COLORS.cardBg}
                fillOpacity={0.78}
                stroke={COLORS.wire}
                strokeOpacity={0.4}
                strokeWidth={1}
            />
            <text
                x={x}
                y={y + 4}
                textAnchor="middle"
                fontFamily="ui-monospace, 'JetBrains Mono', Menlo, monospace"
                fontSize={13}
                fontWeight={600}
                fill={fill}
                style={{ pointerEvents: 'none' }}
            >
                {text}
            </text>
        </g>
    );
}

interface FormulaCardProps {
    mode: SwitchMode;
    tau: number;
    visible: boolean;
}

function FormulaCard({ mode, tau, visible }: FormulaCardProps) {
    if (!visible) return null;
    const tauText = `τ = RC = ${tau.toFixed(2)} s`;
    let eqnText: string;
    if (mode === 'charging') {
        eqnText = 'U_C(t) = U₀(1 − e^(−t/RC))';
    } else if (mode === 'discharging') {
        eqnText = 'U_C(t) = U_C(0)·e^(−t/RC)';
    } else {
        eqnText = 'U_C(t) = const (open circuit)';
    }
    const cardX = 250;
    const cardY = 26;
    const cardW = 380;
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

// --- Particle group (memoized to avoid reconciliation on parent re-render) ---

/**
 * 粒子组（React.memo 包裹）：
 *
 * 主组件每帧通过 setTick() 触发 React 重渲染以更新电荷点 / 标签 / 数值。
 * 如果粒子组也在主组件 JSX 中，每帧都会参与 reconciliation，使 DOM mutation
 * 优化形同虚设（每帧既做 DOM mutation 又做整树 diff）。
 *
 * 用 React.memo 包裹后，本子树只在挂载时渲染一次；粒子位置更新完全由
 * 父组件通过 ref 数组直接 setAttribute('transform', ...) 完成，React 不再介入。
 */
interface ParticleGroupProps {
    /**
     * 挂载完成后把 15 个 <g> 元素的 ref 数组回调给父组件。
     * 父组件保存到 useRef，每帧用 setAttribute('transform', ...) 移动粒子。
     */
    groupRefs: (refs: (SVGGElement | null)[]) => void;
}

const ParticleGroup = memo(function ParticleGroup({ groupRefs }: ParticleGroupProps) {
    const refsRef = useRef<(SVGGElement | null)[]>([]);
    useEffect(() => {
        groupRefs(refsRef.current);
    }, [groupRefs]);
    return (
        <g style={{ pointerEvents: 'none' }}>
            {Array.from({ length: PARTICLE_COUNT }, (_, i) => (
                <g
                    key={`particle-${i}`}
                    ref={(el) => {
                        refsRef.current[i] = el;
                    }}
                    transform="translate(0, 0)"
                >
                    {/* 外层光晕（圆心 0,0，由父 g 的 transform 平移） */}
                    <circle
                        cx={0}
                        cy={0}
                        r={PARTICLE_GLOW_RADIUS}
                        fill={COLORS.particleGlow}
                        fillOpacity={0.3}
                    />
                    {/* 实心粒子 */}
                    <circle cx={0} cy={0} r={PARTICLE_RADIUS} fill={COLORS.particle} />
                </g>
            ))}
        </g>
    );
});

// --- Main component ---

interface CircuitView2DProps {
    experiment: CapacitorExperiment;
}

export function CircuitView2D({ experiment }: CircuitView2DProps) {
    // 触发 React 重渲染的 state（每帧 setState）
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [, setTick] = useState(0);

    // 粒子位置累积（沿 path 距离，DOM mutation 不触发 React 渲染）
    const particlePositions = useRef<number[]>(
        Array.from({ length: PARTICLE_COUNT }, (_, i) => (i / PARTICLE_COUNT) * 4000),
    );
    // 上次帧时间（用于 dt 计算）
    const lastTimeRef = useRef<number>(performance.now());
    // 粒子 SVG <g> refs（由 ParticleGroup 子组件挂载后通过回调写入）
    const particleGroupRefs = useRef<(SVGGElement | null)[]>([]);
    // 闭合 path ref（用于 getPointAtLength / getTotalLength）
    const pathRef = useRef<SVGPathElement | null>(null);
    // 主 <svg> 元素 ref（用于拖拽时把屏幕坐标转换为 SVG 坐标）
    const svgRef = useRef<SVGSVGElement | null>(null);
    // 缓存 path 总长度（避免每帧重算）
    const pathLengthRef = useRef<number>(0);
    // 拖拽状态
    const dragStateRef = useRef<{ active: boolean }>({ active: false });

    // 稳定回调：把 ParticleGroup 内部的 ref 数组交给主组件。
    // useCallback 保持引用稳定，避免触发 ParticleGroup 的 useEffect 重跑。
    const handleGroupRefs = useCallback((refs: (SVGGElement | null)[]) => {
        particleGroupRefs.current = refs;
    }, []);

    // --- rAF 自驱循环 ---
    useEffect(() => {
        let rafId = 0;
        const loop = () => {
            const now = performance.now();
            const dt = Math.min((now - lastTimeRef.current) / 1000, 1 / 30);
            lastTimeRef.current = now;

            updateParticles(dt);

            // 触发 React 重渲染（用于元件/极板电荷数量/标签更新）
            setTick((t) => (t + 1) % 1_000_000);

            rafId = requestAnimationFrame(loop);
        };
        rafId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(rafId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [experiment]);

    // --- 粒子位置更新（DOM mutation） ---
    function updateParticles(dt: number) {
        const path = pathRef.current;
        if (!path) return;
        if (pathLengthRef.current === 0) {
            pathLengthRef.current = path.getTotalLength();
        }
        const totalLen = pathLengthRef.current;
        if (totalLen <= 0) return;

        const state = experiment.getPhysicsState();
        const params = experiment.getParams();

        // 计算 |i| 与 Imax 的比例
        const R_ohm = params.resistance * 1000;
        const U0 = params.sourceVoltage;
        const Imax = R_ohm > 0 ? U0 / R_ohm : 0;
        const speedFactor = Imax > 0 ? Math.abs(state.current) / Imax : 0;
        // direction: charging current>0 → +1（顺时针）；discharging current<0 → -1（逆时针）；其他 0
        const direction =
            state.mode === 'charging' && state.current > 0
                ? 1
                : state.mode === 'discharging' && state.current < 0
                  ? -1
                  : 0;

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

    // --- 拖拽：滑动变阻器（window 级 pointer 监听） ---
    // 旧实现把 pointermove/up 绑在滑片 <circle> 上，快速拖拽时指针会移出 circle 命中区域
    // 导致 move 事件停止触发、滑片卡住。改用：pointerdown 时给 window 绑定 move/up，
    // pointerup/cancel 时解绑。setPointerCapture 作为辅助，不单独依赖。
    const handleWindowPointerMove = useCallback(
        (e: PointerEvent) => {
            if (!dragStateRef.current.active) return;
            const svg = svgRef.current;
            if (!svg) return;
            // 把屏幕坐标转换为 SVG 坐标
            const pt = svg.createSVGPoint();
            pt.x = e.clientX;
            pt.y = e.clientY;
            const ctm = svg.getScreenCTM();
            if (!ctm) return;
            const svgP = pt.matrixTransform(ctm.inverse());
            // I-4: NaN 防御——SVG 未完成布局时 getScreenCTM 可能返回非有限值，
            // 导致 ratio 变 NaN、滑片回弹到 resistance=1。直接丢弃这一帧。
            if (!Number.isFinite(svgP.x)) return;
            const ratio = (svgP.x - RHEOSTAT.xStart) / RHEOSTAT.totalLength;
            const clamped = Math.min(Math.max(ratio, 0), 1);
            const newResistance = 1 + clamped * (50 - 1);
            experiment.setParameter('resistance', Math.round(newResistance));
        },
        [experiment],
    );

    const handleWindowPointerUp = useCallback(() => {
        dragStateRef.current.active = false;
        window.removeEventListener('pointermove', handleWindowPointerMove);
        window.removeEventListener('pointerup', handleWindowPointerUp);
        window.removeEventListener('pointercancel', handleWindowPointerUp);
    }, [handleWindowPointerMove]);

    function handlePointerDown(e: ReactPointerEvent<SVGElement>) {
        e.preventDefault();
        e.stopPropagation();
        // setPointerCapture 作为辅助；主要靠 window 级监听兜底（防止指针飞出 circle）
        (e.target as SVGElement).setPointerCapture?.(e.pointerId);
        dragStateRef.current.active = true;
        window.addEventListener('pointermove', handleWindowPointerMove);
        window.addEventListener('pointerup', handleWindowPointerUp);
        window.addEventListener('pointercancel', handleWindowPointerUp);
    }

    // 卸载时清理 window 监听，避免泄漏/在已卸载组件上调用 setParameter
    useEffect(() => {
        return () => {
            window.removeEventListener('pointermove', handleWindowPointerMove);
            window.removeEventListener('pointerup', handleWindowPointerUp);
            window.removeEventListener('pointercancel', handleWindowPointerUp);
        };
    }, [handleWindowPointerMove, handleWindowPointerUp]);

    // --- 读取状态（每帧重渲染都会走这里） ---
    const state: CircuitState = experiment.getPhysicsState();
    const params: CircuitParams = experiment.getParams();
    const showLabels = experiment.getParameter('showLabels') as boolean;
    const showField3D = experiment.getParameter('showField3D') as boolean;

    const tau = analyzeTimeConstant(params);
    const R_ohm = params.resistance * 1000;
    const C_farad = params.capacitance * 1e-6;
    const Imax = R_ohm > 0 ? params.sourceVoltage / R_ohm : 0;
    const Qmax = C_farad * params.sourceVoltage; // 单位 C
    const Qabs = Math.abs(state.charge);
    const chargeDots = Qmax > 0 ? Math.floor((Qabs / Qmax) * (CHARGE_GRID.cols * CHARGE_GRID.rows)) : 0;

    // 滑片 x 位置（由 params.resistance 完全决定，无内部 state）
    const knobRatio = (params.resistance - 1) / (50 - 1);
    const knobX = RHEOSTAT.xStart + knobRatio * RHEOSTAT.totalLength;

    // 开关状态视觉
    const switchActive = state.mode !== 'disconnected';
    const switchColor = switchActive ? COLORS.wireHighlight : COLORS.wireBroken;

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                height: '100%',
                background: COLORS.bg,
                overflow: 'hidden',
            }}
        >
        <div
            style={{
                position: 'relative',
                flex: showField3D ? '1 1 60%' : '1 1 auto',
                minHeight: 0,
                overflow: 'hidden',
            }}
        >
            {/* 装饰光晕：青色 + 暖金（与项目其他页面呼应） */}
            <div
                style={{
                    position: 'absolute',
                    left: '18%',
                    top: '20%',
                    width: '320px',
                    height: '320px',
                    borderRadius: '50%',
                    background:
                        'radial-gradient(circle, rgba(34,211,238,0.16) 0%, rgba(34,211,238,0) 70%)',
                    filter: 'blur(36px)',
                    pointerEvents: 'none',
                }}
            />
            <div
                style={{
                    position: 'absolute',
                    right: '14%',
                    bottom: '12%',
                    width: '300px',
                    height: '300px',
                    borderRadius: '50%',
                    background:
                        'radial-gradient(circle, rgba(251,191,36,0.10) 0%, rgba(251,191,36,0) 70%)',
                    filter: 'blur(40px)',
                    pointerEvents: 'none',
                }}
            />

            <svg
                ref={svgRef}
                viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
                preserveAspectRatio="xMidYMid meet"
                width="100%"
                height="100%"
                style={{ display: 'block' }}
            >
                {/* 隐藏的回路 path（仅用于 getPointAtLength） */}
                <path
                    ref={pathRef}
                    d={CIRCUIT_LOOP_D}
                    fill="none"
                    stroke="none"
                    style={{ visibility: 'hidden', pointerEvents: 'none' }}
                />

                {/* ===== 公式卡片（顶部） ===== */}
                <FormulaCard mode={state.mode} tau={tau} visible={showLabels} />

                {/* ===== 开关（左导线上段） ===== */}
                <g>
                    {/* 开关铰链基座 */}
                    <circle cx={SWITCH.x} cy={SWITCH.yPivot} r={4} fill={switchColor} />
                    {/* 左侧开关固定接点（朝向电池方向，y 较大） */}
                    <circle
                        cx={SWITCH.x}
                        cy={SWITCH.yPivot + SWITCH.length}
                        r={3.5}
                        fill={switchColor}
                        opacity={state.mode === 'charging' || state.mode === 'disconnected' ? 1 : 0.4}
                    />
                    {/* 右侧开关固定接点（朝向上方导线方向，y 较小） */}
                    <circle
                        cx={SWITCH.x + SWITCH.length}
                        cy={SWITCH.yPivot}
                        r={3.5}
                        fill={switchColor}
                        opacity={state.mode === 'discharging' ? 1 : 0.4}
                    />
                    {/* 拨杆：根据 mode 决定指向 */}
                    {state.mode === 'disconnected' ? (
                        // 断开：斜向上指（悬空）
                        <line
                            x1={SWITCH.x}
                            y1={SWITCH.yPivot}
                            x2={SWITCH.x + SWITCH.length * 0.85}
                            y2={SWITCH.yPivot - SWITCH.length * 0.5}
                            stroke={COLORS.wireBroken}
                            strokeWidth={3}
                            strokeLinecap="round"
                        />
                    ) : state.mode === 'charging' ? (
                        // 充电：拨杆向下接通（铰链 → 下接点，闭合充电回路）
                        <line
                            x1={SWITCH.x}
                            y1={SWITCH.yPivot}
                            x2={SWITCH.x}
                            y2={SWITCH.yPivot + SWITCH.length}
                            stroke={COLORS.wireHighlight}
                            strokeWidth={3}
                            strokeLinecap="round"
                        />
                    ) : (
                        // 放电：拨杆向右接通（铰链 → 右接点，闭合电容短路回路）
                        <line
                            x1={SWITCH.x}
                            y1={SWITCH.yPivot}
                            x2={SWITCH.x + SWITCH.length}
                            y2={SWITCH.yPivot}
                            stroke={COLORS.wireHighlight}
                            strokeWidth={3}
                            strokeLinecap="round"
                        />
                    )}
                    {/* 开关模式标签 */}
                    {showLabels && (
                        <text
                            x={SWITCH.x - 18}
                            y={SWITCH.yPivot - 10}
                            textAnchor="end"
                            fontFamily="Nunito, sans-serif"
                            fontSize={12}
                            fontWeight={700}
                            fill={switchActive ? COLORS.accent : COLORS.textDim}
                            style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}
                        >
                            {state.mode}
                        </text>
                    )}
                </g>

                {/* ===== 导线（矩形回路，分段绘制以避开电池/电容/开关空隙） ===== */}
                <g>
                    {/* 左导线：上段（top → 开关铰链上方） */}
                    <line
                        x1={LOOP.left}
                        y1={LOOP.top}
                        x2={LOOP.left}
                        y2={SWITCH.yPivot - 6}
                        stroke={COLORS.wire}
                        strokeWidth={3}
                        strokeLinecap="round"
                    />
                    {/* 左导线：铰链 → 电池上接点（充电时通断） */}
                    <line
                        x1={LOOP.left}
                        y1={SWITCH.yPivot + SWITCH.length}
                        x2={LOOP.left}
                        y2={BATTERY.yTop}
                        stroke={state.mode === 'charging' ? COLORS.wireHighlight : COLORS.wire}
                        strokeWidth={3}
                        strokeLinecap="round"
                        opacity={state.mode === 'charging' ? 0.95 : 0.6}
                    />
                    {/* 左导线：电池下接点 → 底部 */}
                    <line
                        x1={LOOP.left}
                        y1={BATTERY.yBot}
                        x2={LOOP.left}
                        y2={LOOP.bottom}
                        stroke={COLORS.wire}
                        strokeWidth={3}
                        strokeLinecap="round"
                    />
                    {/* 上导线：左 → 滑动变阻器左端 */}
                    <line
                        x1={LOOP.left}
                        y1={LOOP.top}
                        x2={RHEOSTAT.xStart}
                        y2={LOOP.top}
                        stroke={COLORS.wire}
                        strokeWidth={3}
                        strokeLinecap="round"
                    />
                    {/* 上导线：滑动变阻器右端 → 右上角 */}
                    <line
                        x1={RHEOSTAT.xEnd}
                        y1={LOOP.top}
                        x2={LOOP.right}
                        y2={LOOP.top}
                        stroke={COLORS.wire}
                        strokeWidth={3}
                        strokeLinecap="round"
                    />
                    {/* 右导线：上 → 电容上板 */}
                    <line
                        x1={LOOP.right}
                        y1={LOOP.top}
                        x2={LOOP.right}
                        y2={CAPACITOR.yTop}
                        stroke={COLORS.wire}
                        strokeWidth={3}
                        strokeLinecap="round"
                    />
                    {/* 右导线：电容下板 → 底部 */}
                    <line
                        x1={LOOP.right}
                        y1={CAPACITOR.yBot}
                        x2={LOOP.right}
                        y2={LOOP.bottom}
                        stroke={COLORS.wire}
                        strokeWidth={3}
                        strokeLinecap="round"
                    />
                    {/* 底导线：右 → 左 */}
                    <line
                        x1={LOOP.right}
                        y1={LOOP.bottom}
                        x2={LOOP.left}
                        y2={LOOP.bottom}
                        stroke={COLORS.wire}
                        strokeWidth={3}
                        strokeLinecap="round"
                    />
                </g>

                {/* ===== 电池（左导线中段） ===== */}
                <g>
                    {/* 红色长线 = 正极（上方） */}
                    <line
                        x1={BATTERY.x - BATTERY.plusLen}
                        y1={BATTERY.yTop}
                        x2={BATTERY.x + BATTERY.plusLen}
                        y2={BATTERY.yTop}
                        stroke={COLORS.positive}
                        strokeWidth={3.5}
                        strokeLinecap="round"
                    />
                    {/* 蓝色短线 = 负极（下方） */}
                    <line
                        x1={BATTERY.x - BATTERY.minusLen}
                        y1={BATTERY.yBot}
                        x2={BATTERY.x + BATTERY.minusLen}
                        y2={BATTERY.yBot}
                        stroke={COLORS.negative}
                        strokeWidth={3.5}
                        strokeLinecap="round"
                    />
                    {/* 电池极性符号 */}
                    {showLabels && (
                        <>
                            <text
                                x={BATTERY.x + BATTERY.plusLen + 8}
                                y={BATTERY.yTop + 5}
                                fontFamily="ui-monospace, monospace"
                                fontSize={14}
                                fontWeight={700}
                                fill={COLORS.positive}
                            >
                                +
                            </text>
                            <text
                                x={BATTERY.x + BATTERY.minusLen + 8}
                                y={BATTERY.yBot + 5}
                                fontFamily="ui-monospace, monospace"
                                fontSize={14}
                                fontWeight={700}
                                fill={COLORS.negative}
                            >
                                −
                            </text>
                        </>
                    )}
                    {/* U₀ 数值 */}
                    {showLabels && (
                        <ValueTag
                            x={BATTERY.x - BATTERY.plusLen - 50}
                            y={(BATTERY.yTop + BATTERY.yBot) / 2}
                            text={`U₀ = ${params.sourceVoltage.toFixed(1)} V`}
                            fill={COLORS.accent}
                            align="end"
                        />
                    )}
                </g>

                {/* ===== 滑动变阻器（上导线中段） ===== */}
                <g>
                    {/* 电阻丝底色（暗） */}
                    <rect
                        x={RHEOSTAT.xStart}
                        y={RHEOSTAT.y - RHEOSTAT.bodyHeight / 2}
                        width={RHEOSTAT.totalLength}
                        height={RHEOSTAT.bodyHeight}
                        rx={3}
                        fill={COLORS.rheostatBody}
                        stroke={COLORS.wire}
                        strokeWidth={1}
                    />
                    {/* 高亮段（左端 → 滑片） */}
                    <rect
                        x={RHEOSTAT.xStart}
                        y={RHEOSTAT.y - RHEOSTAT.bodyHeight / 2}
                        width={knobRatio * RHEOSTAT.totalLength}
                        height={RHEOSTAT.bodyHeight}
                        rx={3}
                        fill={COLORS.rheostatHighlight}
                        fillOpacity={0.85}
                    />
                    {/* 滑片连接条（垂直短线，从电阻丝上方到导线） */}
                    <line
                        x1={knobX}
                        y1={RHEOSTAT.y - RHEOSTAT.bodyHeight / 2 - 6}
                        x2={knobX}
                        y2={RHEOSTAT.y}
                        stroke={COLORS.rheostatKnob}
                        strokeWidth={2.5}
                        strokeLinecap="round"
                    />
                    {/* 滑片手柄（白色圆，可拖拽） */}
                    <circle
                        cx={knobX}
                        cy={RHEOSTAT.y - RHEOSTAT.bodyHeight / 2 - 10}
                        r={RHEOSTAT.knobRadius}
                        fill={COLORS.rheostatKnob}
                        stroke={COLORS.accent}
                        strokeWidth={1.5}
                        style={{ cursor: 'grab' }}
                        onPointerDown={handlePointerDown}
                    />
                    {/* 拖拽提示（仅在 labels 开启时） */}
                    {showLabels && (
                        <text
                            x={knobX}
                            y={RHEOSTAT.y - RHEOSTAT.bodyHeight / 2 - 28}
                            textAnchor="middle"
                            fontFamily="Nunito, sans-serif"
                            fontSize={10}
                            fill={COLORS.textDim}
                            style={{ pointerEvents: 'none', userSelect: 'none' }}
                        >
                            drag
                        </text>
                    )}
                    {/* 阻值标签（跟随滑片） */}
                    {showLabels && (
                        <ValueTag
                            x={knobX}
                            y={RHEOSTAT.y + RHEOSTAT.bodyHeight + 16}
                            text={`R = ${params.resistance} kΩ`}
                            fill={COLORS.accent}
                        />
                    )}
                </g>

                {/* ===== 电容（右导线中段） ===== */}
                <g>
                    {/* 上板（红） */}
                    <line
                        x1={CAPACITOR.x - CAPACITOR.plateHalfWidth}
                        y1={CAPACITOR.yTop}
                        x2={CAPACITOR.x + CAPACITOR.plateHalfWidth}
                        y2={CAPACITOR.yTop}
                        stroke={COLORS.positive}
                        strokeWidth={4}
                        strokeLinecap="round"
                    />
                    {/* 下板（蓝） */}
                    <line
                        x1={CAPACITOR.x - CAPACITOR.plateHalfWidth}
                        y1={CAPACITOR.yBot}
                        x2={CAPACITOR.x + CAPACITOR.plateHalfWidth}
                        y2={CAPACITOR.yBot}
                        stroke={COLORS.negative}
                        strokeWidth={4}
                        strokeLinecap="round"
                    />
                    {/* 极板电荷点阵（+ / − 符号） */}
                    {(() => {
                        const symbols: ReactElement[] = [];
                        const { cols, rows, spacing } = CHARGE_GRID;
                        const startX = CAPACITOR.x - ((cols - 1) * spacing) / 2;
                        const yPlus = CAPACITOR.yTop - 9; // 上板上方（+ 号）
                        const yMinus = CAPACITOR.yBot + 13; // 下板下方（− 号）
                        for (let r = 0; r < rows; r++) {
                            for (let c = 0; c < cols; c++) {
                                const idx = r * cols + c;
                                const x = startX + c * spacing;
                                const offset = r * 4; // 错落排布
                                if (idx < chargeDots) {
                                    symbols.push(
                                        <text
                                            key={`p-${idx}`}
                                            x={x + offset / 2}
                                            y={yPlus - r * 6}
                                            textAnchor="middle"
                                            fontFamily="ui-monospace, monospace"
                                            fontSize={12}
                                            fontWeight={700}
                                            fill={COLORS.positive}
                                            opacity={0.95}
                                        >
                                            +
                                        </text>,
                                    );
                                    symbols.push(
                                        <text
                                            key={`n-${idx}`}
                                            x={x + offset / 2}
                                            y={yMinus + r * 6}
                                            textAnchor="middle"
                                            fontFamily="ui-monospace, monospace"
                                            fontSize={12}
                                            fontWeight={700}
                                            fill={COLORS.negative}
                                            opacity={0.95}
                                        >
                                            −
                                        </text>,
                                    );
                                }
                            }
                        }
                        return <g style={{ pointerEvents: 'none' }}>{symbols}</g>;
                    })()}
                    {/* 电容数值标签 */}
                    {showLabels && (
                        <>
                            <ValueTag
                                x={CAPACITOR.x + CAPACITOR.plateHalfWidth + 60}
                                y={CAPACITOR.yTop - 2}
                                text={`C = ${params.capacitance} μF`}
                                fill={COLORS.accent}
                                align="end"
                            />
                            <ValueTag
                                x={CAPACITOR.x + CAPACITOR.plateHalfWidth + 60}
                                y={(CAPACITOR.yTop + CAPACITOR.yBot) / 2}
                                text={`U_C = ${formatVoltage(state.voltage)} V`}
                                fill={COLORS.accent}
                                align="end"
                            />
                        </>
                    )}
                </g>

                {/* ===== 电流数值标签（底导线上方） ===== */}
                {showLabels && (
                    <ValueTag
                        x={(LOOP.left + LOOP.right) / 2}
                        y={LOOP.bottom - 22}
                        text={`i = ${formatCurrent(state.current * 1000)} mA`}
                        fill={COLORS.particle}
                    />
                )}

                {/* ===== 粒子流（React.memo 子组件，挂载后不再 reconcile； */}
                {/*      位置由父组件通过 ref 直接 setAttribute('transform') 更新） ===== */}
                <ParticleGroup groupRefs={handleGroupRefs} />
            </svg>
        </div>
        {showField3D && (
            <div
                style={{
                    flex: '0 0 40%',
                    minHeight: '200px',
                    borderTop: '1px solid rgba(34, 211, 238, 0.15)',
                }}
            >
                <Capacitor3DCanvas experiment={experiment} />
            </div>
        )}
        </div>
    );
}

export default CircuitView2D;
