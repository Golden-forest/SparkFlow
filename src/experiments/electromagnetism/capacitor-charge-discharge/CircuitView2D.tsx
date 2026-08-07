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
import { analyzeTimeConstant, analyzeDischargeTimeConstant } from './RCCircuitPhysics';
// Phase 4: 3D 子视图（showField3D=true 时挂在 SVG 下方）
import { Capacitor3DCanvas } from './Capacitor3DCanvas';

// --- Layout constants (viewBox 800x500) ---
const VIEW_W = 800;
const VIEW_H = 500;

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
    wireHighlight: '#22D3EE',           // 充电高亮（青色）
    wireHighlightDischarge: '#F97316',  // 放电高亮（橙色）
    wireBroken: '#64748B',
    positive: '#F87171',
    negative: '#60A5FA',
    accent: '#22D3EE',
    particle: '#F97316',
    particleGlow: '#F97316',
    particleCharge: '#22D3EE',          // 充电粒子色（青）
    particleDischarge: '#F97316',       // 放电粒子色（橙）
    rheostatBody: '#334155',
    rheostatHighlight: '#22D3EE',
    rheostatKnob: '#F0F6FC',
    text: '#22D3EE',
    textDim: '#94A3B8',
    textLabel: '#CBD5E1',
    cardBg: '#0D1117',
    bulbOff: '#475569',                 // 灯泡不亮
    bulbOn: '#FBBF24',                  // 灯泡亮（暖金色）
    bulbGlow: 'rgba(251, 191, 36, 0.4)', // 灯泡光晕
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
    tauCharge: number;
    tauDischarge: number;
    visible: boolean;
}

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
    // 双 path ref（充电路径 + 放电路径，用于 getPointAtLength / getTotalLength）
    const chargingPathRef = useRef<SVGPathElement | null>(null);
    const dischargingPathRef = useRef<SVGPathElement | null>(null);
    // 当前激活的 path 长度缓存
    const chargingPathLen = useRef<number>(0);
    const dischargingPathLen = useRef<number>(0);
    // 主 <svg> 元素 ref（用于拖拽时把屏幕坐标转换为 SVG 坐标）
    const svgRef = useRef<SVGSVGElement | null>(null);
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

    const tauCharge = analyzeTimeConstant(params);
    const tauDischarge = analyzeDischargeTimeConstant(params);
    const R_ohm = params.resistance * 1000;
    const C_farad = params.capacitance * 1e-6;
    const Imax = R_ohm > 0 ? params.sourceVoltage / R_ohm : 0;
    const Qmax = C_farad * params.sourceVoltage; // 单位 C
    const Qabs = Math.abs(state.charge);
    const chargeDots = Qmax > 0 ? Math.floor((Qabs / Qmax) * (CHARGE_GRID.cols * CHARGE_GRID.rows)) : 0;

    // 灯泡亮度（放电时随电流变化）
    const R_load_ohm = params.loadResistance * 1000;
    const i_max_discharge = R_ohm + R_load_ohm > 0 ? params.sourceVoltage / (R_ohm + R_load_ohm) : 0;
    const bulbBrightness = i_max_discharge > 0
        ? Math.min(Math.abs(state.current) / i_max_discharge, 1)
        : 0;

    // 滑片 x 位置（由 params.resistance 完全决定，无内部 state）
    const knobRatio = (params.resistance - 1) / (50 - 1);
    const knobX = RHEOSTAT.xStart + knobRatio * RHEOSTAT.totalLength;

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
                <defs>
                    <filter id="bulbGlow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="4" />
                    </filter>
                </defs>

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

                {/* ===== 公式卡片（顶部） ===== */}
                <FormulaCard mode={state.mode} tauCharge={tauCharge} tauDischarge={tauDischarge} visible={showLabels} />

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

                {/* ===== 电流数值标签（电容右侧空白处，避免与灯泡/支路重叠） ===== */}
                {showLabels && (
                    <ValueTag
                        x={CAPACITOR.x + CAPACITOR.plateHalfWidth + 60}
                        y={(CAPACITOR.yTop + CAPACITOR.yBot) / 2 + 28}
                        text={`i = ${formatCurrent(state.current * 1000)} mA`}
                        fill={COLORS.particle}
                        align="end"
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
