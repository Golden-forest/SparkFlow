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
// H 型双支路拓扑：
//   左导线（x=120）垂直分三段，承载 SPDT 开关三个接点
//   右导线（x=680）垂直连续，把上/中/下三个水平支路连成一个公共节点
//
//   y=100  上支路：上接点 ●── 电池 ── 右上节点 ●
//   y=220  中支路：公共端 ●── C ── R ── 右中节点 ●
//   y=340  下支路：下接点 ●── 灯泡 ── 右下节点 ●
//
// 充电（S 拨上）：电池→右上→右导线→右中→R→C→公共端→上接点→电池  τ=RC
// 放电（S 拨下）：C→R→右中→右导线→右下→灯泡→下接点→开关→公共端→C  τ=(R+R_L)C
const VIEW_W = 800;
const VIEW_H = 500;

const LOOP = {
    left: 120,
    right: 680,
    top: 100,        // 上支路 y
    mid: 220,        // 中支路 y（开关公共端）
    bottom: 340,     // 下支路 y
};

// 电池：上支路水平放置（正极长线、负极短线）
const BATTERY = {
    cx: 320,                  // 电池中心 x
    y: LOOP.top,              // = 100
    plusLen: 36,              // 正极长线半长（水平）
    minusLen: 18,             // 负极短线半长（水平）
    gap: 14,                  // 正负极垂直间距
};

// 单刀双掷开关：左导线中段（公共端在中支路 y）
const SWITCH = {
    x: LOOP.left,             // = 120
    yPivot: LOOP.mid,         // = 220（公共端/铰链）
    contactChargeY: LOOP.top, // = 100（上接点，充电）
    contactDischargeY: LOOP.bottom, // = 340（下接点，放电）
    leverMaxLen: 120,         // 拨杆最大长度（点到点的距离）
};

// 电容：中支路水平放置（极板垂直，左板连公共端方向，右板连 R 方向）
const CAPACITOR = {
    cx: 280,                  // 电容中心 x（位于公共端和 R 之间偏左）
    y: LOOP.mid,              // = 220
    plateHalfHeight: 22,      // 极板半高（垂直方向）
    gap: 14,                  // 两板水平间距
};

// 滑动变阻器：中支路水平放置（电容右侧 → 右节点）
const RHEOSTAT = {
    xStart: 380,
    xEnd: 600,
    y: LOOP.mid,             // = 220
    totalLength: 600 - 380,  // 220
    bodyHeight: 18,
    knobRadius: 10,
};

// 小灯泡：下支路中央
const BULB = {
    cx: 360,
    cy: LOOP.bottom,         // = 340
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
 * 充电路径 path（粒子沿此流动）：
 * 上接点(120,100) → 电池负极(304,100) → 电池正极(356,100)
 * → 右上节点(680,100) → 右导线下行 → 右中节点(680,220)
 * → R右端(600,220) → R左端(380,220) → C右板(287,220) → C左板(273,220)
 * → 公共端(120,220) → 拨杆向上 → 上接点(120,100)
 *
 * 电流方向（正）：电池+ → 右节点 → R → C → 开关 → 电池-
 * 粒子流向（与电流同向）：从电池+ 出发，沿回路顺时针走
 */
const CHARGING_LOOP_D = [
    // 从电池正极出发（右上节点方向）
    `M ${BATTERY.cx + BATTERY.plusLen} ${BATTERY.y}`,
    // 沿上支路向右到右上节点
    `L ${LOOP.right} ${LOOP.top}`,
    // 右导线下行到中支路
    `L ${LOOP.right} ${LOOP.mid}`,
    // 中支路向左：右中节点 → R 右端 → R 左端 → C 右板 → C 左板 → 公共端
    `L ${RHEOSTAT.xEnd} ${RHEOSTAT.y}`,
    `L ${RHEOSTAT.xStart} ${RHEOSTAT.y}`,
    `L ${CAPACITOR.cx + CAPACITOR.gap / 2} ${CAPACITOR.y}`,
    `L ${CAPACITOR.cx - CAPACITOR.gap / 2} ${CAPACITOR.y}`,
    `L ${SWITCH.x} ${SWITCH.yPivot}`,
    // 开关拨杆向上（公共端 → 上接点）
    `L ${SWITCH.x} ${SWITCH.contactChargeY}`,
    // 上支路向左：上接点 → 电池负极
    `L ${BATTERY.cx - BATTERY.minusLen} ${BATTERY.y}`,
    // 电池内部：负极 → 正极（粒子穿过电池）
    `L ${BATTERY.cx + BATTERY.plusLen} ${BATTERY.y}`,
    'Z',
].join(' ');

/**
 * 放电路径 path（粒子沿此流动）：
 * C左板(273,220) → 公共端(120,220) → 拨杆向下 → 下接点(120,340)
 * → 灯泡左端(338,340) → 灯泡右端(382,340) → 右下节点(680,340)
 * → 右导线上行 → 右中节点(680,220) → R右端(600,220) → R左端(380,220)
 * → C右板(287,220) → C左板(273,220)
 *
 * 电流方向：C+（右板）→ R → 右节点 → 灯泡 → 下接点 → 开关 → 公共端 → C-（左板）
 * 粒子流向（与电流同向）：从 C 右板出发，向右经 R、下行经灯泡、回到 C 左板
 */
const DISCHARGING_LOOP_D = [
    // 从 C 右板出发
    `M ${CAPACITOR.cx + CAPACITOR.gap / 2} ${CAPACITOR.y}`,
    // 中支路向右：C 右板 → R 左端 → R 右端 → 右中节点
    `L ${RHEOSTAT.xStart} ${RHEOSTAT.y}`,
    `L ${RHEOSTAT.xEnd} ${RHEOSTAT.y}`,
    `L ${LOOP.right} ${LOOP.mid}`,
    // 右导线下行到下支路
    `L ${LOOP.right} ${LOOP.bottom}`,
    // 下支路向左：右下节点 → 灯泡右端 → 灯泡左端 → 下接点
    `L ${BULB.cx + BULB.radius} ${BULB.cy}`,
    `L ${BULB.cx - BULB.radius} ${BULB.cy}`,
    `L ${SWITCH.x} ${SWITCH.contactDischargeY}`,
    // 开关拨杆向上（下接点 → 公共端）
    `L ${SWITCH.x} ${SWITCH.yPivot}`,
    // 中支路向右：公共端 → C 左板
    `L ${CAPACITOR.cx - CAPACITOR.gap / 2} ${CAPACITOR.y}`,
    // 电容内部：左板 → 右板（粒子穿过电容，等效于位移电流）
    `L ${CAPACITOR.cx + CAPACITOR.gap / 2} ${CAPACITOR.y}`,
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

                {/* ===== 单刀双掷开关（左导线，公共端在中支路 y=220） ===== */}
                <g>
                    {/* 上接点（充电触点，y=100）—— 可点击 */}
                    <circle
                        cx={SWITCH.x}
                        cy={SWITCH.contactChargeY}
                        r={6}
                        fill={state.mode === 'charging' ? COLORS.wireHighlight : '#0D1117'}
                        stroke={state.mode === 'charging' ? COLORS.wireHighlight : COLORS.wireBroken}
                        strokeWidth={2}
                        style={{ cursor: 'pointer' }}
                        onClick={() => experiment.setParameter('switchMode', 'charging')}
                    />
                    {/* 下接点（放电触点，y=340）—— 可点击 */}
                    <circle
                        cx={SWITCH.x}
                        cy={SWITCH.contactDischargeY}
                        r={6}
                        fill={state.mode === 'discharging' ? COLORS.wireHighlightDischarge : '#0D1117'}
                        stroke={state.mode === 'discharging' ? COLORS.wireHighlightDischarge : COLORS.wireBroken}
                        strokeWidth={2}
                        style={{ cursor: 'pointer' }}
                        onClick={() => experiment.setParameter('switchMode', 'discharging')}
                    />
                    {/* 公共端/铰链（中支路 y=220）—— 点击断开 */}
                    <circle
                        cx={SWITCH.x}
                        cy={SWITCH.yPivot}
                        r={5}
                        fill={state.mode === 'charging' ? COLORS.wireHighlight
                            : state.mode === 'discharging' ? COLORS.wireHighlightDischarge
                            : COLORS.wireBroken}
                        style={{ cursor: 'pointer' }}
                        onClick={() => experiment.setParameter('switchMode', 'disconnected')}
                    />
                    {/* 拨杆：根据 mode 决定指向 */}
                    {state.mode === 'disconnected' ? (
                        <line
                            x1={SWITCH.x}
                            y1={SWITCH.yPivot}
                            x2={SWITCH.x + 36}
                            y2={SWITCH.yPivot}
                            stroke={COLORS.wireBroken}
                            strokeWidth={3.5}
                            strokeLinecap="round"
                        />
                    ) : state.mode === 'charging' ? (
                        <line
                            x1={SWITCH.x}
                            y1={SWITCH.yPivot}
                            x2={SWITCH.x}
                            y2={SWITCH.contactChargeY}
                            stroke={COLORS.wireHighlight}
                            strokeWidth={3.5}
                            strokeLinecap="round"
                        />
                    ) : (
                        <line
                            x1={SWITCH.x}
                            y1={SWITCH.yPivot}
                            x2={SWITCH.x}
                            y2={SWITCH.contactDischargeY}
                            stroke={COLORS.wireHighlightDischarge}
                            strokeWidth={3.5}
                            strokeLinecap="round"
                        />
                    )}
                    {/* 开关模式标签 */}
                    {showLabels && (
                        <text
                            x={SWITCH.x - 12}
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
                </g>

                {/* ===== 导线（H 型拓扑） ===== */}
                {/* 拓扑说明：
                     上支路（y=100）：上接点(120) → 电池负极(304) | 电池正极(356) → 右上节点(680)
                     中支路（y=220）：公共端(120) → C左板(273) | C右板(287) → R左端(380) | R右端(600) → 右中节点(680)
                     下支路（y=340）：下接点(120) → 灯泡左端(338) | 灯泡右端(382) → 右下节点(680)
                     右导线（x=680）：连续，连接 右上/右中/右下 三个节点（无元件） */}
                <g>
                    {/* === 上支路 === */}
                    {/* W1-top: 上接点 → 电池负极（充电时高亮） */}
                    <line
                        x1={SWITCH.x} y1={SWITCH.contactChargeY}
                        x2={BATTERY.cx - BATTERY.minusLen} y2={BATTERY.y}
                        stroke={state.mode === 'charging' ? COLORS.wireHighlight : COLORS.wire}
                        strokeWidth={3}
                        strokeLinecap="round"
                        opacity={state.mode === 'charging' ? 0.95 : 0.5}
                    />
                    {/* W1-bot: 电池正极 → 右上节点（充电时高亮） */}
                    <line
                        x1={BATTERY.cx + BATTERY.plusLen} y1={BATTERY.y}
                        x2={LOOP.right} y2={LOOP.top}
                        stroke={state.mode === 'charging' ? COLORS.wireHighlight : COLORS.wire}
                        strokeWidth={3}
                        strokeLinecap="round"
                        opacity={state.mode === 'charging' ? 0.95 : 0.5}
                    />

                    {/* === 中支路 === */}
                    {/* W2a: 公共端 → C 左板（充电和放电都走，是开关闭合后的必经段） */}
                    <line
                        x1={SWITCH.x} y1={SWITCH.yPivot}
                        x2={CAPACITOR.cx - CAPACITOR.gap / 2} y2={CAPACITOR.y}
                        stroke={state.mode === 'charging' ? COLORS.wireHighlight
                            : state.mode === 'discharging' ? COLORS.wireHighlightDischarge
                            : COLORS.wire}
                        strokeWidth={3}
                        strokeLinecap="round"
                        opacity={state.mode !== 'disconnected' ? 0.95 : 0.5}
                    />
                    {/* W2b: C 右板 → R 左端（充电放电都走，公共段） */}
                    <line
                        x1={CAPACITOR.cx + CAPACITOR.gap / 2} y1={CAPACITOR.y}
                        x2={RHEOSTAT.xStart} y2={RHEOSTAT.y}
                        stroke={state.mode === 'charging' ? COLORS.wireHighlight
                            : state.mode === 'discharging' ? COLORS.wireHighlightDischarge
                            : COLORS.wire}
                        strokeWidth={3}
                        strokeLinecap="round"
                        opacity={state.mode !== 'disconnected' ? 0.95 : 0.5}
                    />
                    {/* W2c: R 右端 → 右中节点（充电放电都走，公共段） */}
                    <line
                        x1={RHEOSTAT.xEnd} y1={RHEOSTAT.y}
                        x2={LOOP.right} y2={LOOP.mid}
                        stroke={state.mode === 'charging' ? COLORS.wireHighlight
                            : state.mode === 'discharging' ? COLORS.wireHighlightDischarge
                            : COLORS.wire}
                        strokeWidth={3}
                        strokeLinecap="round"
                        opacity={state.mode !== 'disconnected' ? 0.95 : 0.5}
                    />

                    {/* === 右导线（连续，无元件）=== */}
                    {/* W3-top: 右上节点 → 右中节点（充电时上段高亮，放电时下段高亮，整体连续） */}
                    <line
                        x1={LOOP.right} y1={LOOP.top}
                        x2={LOOP.right} y2={LOOP.mid}
                        stroke={state.mode === 'charging' ? COLORS.wireHighlight
                            : state.mode === 'discharging' ? COLORS.wireHighlightDischarge
                            : COLORS.wire}
                        strokeWidth={3}
                        strokeLinecap="round"
                        opacity={state.mode !== 'disconnected' ? 0.95 : 0.5}
                    />
                    {/* W3-bot: 右中节点 → 右下节点（放电时高亮，因为电流要经此到灯泡） */}
                    <line
                        x1={LOOP.right} y1={LOOP.mid}
                        x2={LOOP.right} y2={LOOP.bottom}
                        stroke={state.mode === 'discharging' ? COLORS.wireHighlightDischarge : COLORS.wire}
                        strokeWidth={3}
                        strokeLinecap="round"
                        opacity={state.mode === 'discharging' ? 0.95
                            : state.mode === 'charging' ? 0.4 : 0.5}
                    />

                    {/* === 下支路 === */}
                    {/* W4-left: 下接点 → 灯泡左端（放电时高亮） */}
                    <line
                        x1={SWITCH.x} y1={SWITCH.contactDischargeY}
                        x2={BULB.cx - BULB.radius} y2={BULB.cy}
                        stroke={state.mode === 'discharging' ? COLORS.wireHighlightDischarge : COLORS.wire}
                        strokeWidth={3}
                        strokeLinecap="round"
                        opacity={state.mode === 'discharging' ? 0.95 : 0.3}
                    />
                    {/* W4-right: 灯泡右端 → 右下节点（放电时高亮） */}
                    <line
                        x1={BULB.cx + BULB.radius} y1={BULB.cy}
                        x2={LOOP.right} y2={LOOP.bottom}
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

                {/* ===== 电池（上支路水平放置，正极长线在右、负极短线在左） ===== */}
                <g>
                    {/* 红色长线 = 正极（右侧，朝右上节点方向） */}
                    <line
                        x1={BATTERY.cx}
                        y1={BATTERY.y - BATTERY.gap / 2}
                        x2={BATTERY.cx + BATTERY.plusLen}
                        y2={BATTERY.y - BATTERY.gap / 2}
                        stroke={COLORS.positive}
                        strokeWidth={4}
                        strokeLinecap="round"
                    />
                    {/* 蓝色短线 = 负极（左侧，朝上接点方向） */}
                    <line
                        x1={BATTERY.cx - BATTERY.minusLen}
                        y1={BATTERY.y + BATTERY.gap / 2}
                        x2={BATTERY.cx + BATTERY.minusLen}
                        y2={BATTERY.y + BATTERY.gap / 2}
                        stroke={COLORS.negative}
                        strokeWidth={4}
                        strokeLinecap="round"
                    />
                    {/* 电池极性符号 */}
                    {showLabels && (
                        <>
                            <text
                                x={BATTERY.cx + BATTERY.plusLen + 10}
                                y={BATTERY.y - BATTERY.gap / 2 + 5}
                                fontFamily="ui-monospace, monospace"
                                fontSize={14}
                                fontWeight={700}
                                fill={COLORS.positive}
                            >
                                +
                            </text>
                            <text
                                x={BATTERY.cx - BATTERY.minusLen - 14}
                                y={BATTERY.y + BATTERY.gap / 2 + 5}
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
                            x={BATTERY.cx}
                            y={BATTERY.y - 32}
                            text={`U₀ = ${params.sourceVoltage.toFixed(1)} V`}
                            fill={COLORS.accent}
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

                {/* ===== 电容（中支路水平放置，极板垂直） ===== */}
                {/* 左板接公共端（充电时为负板/蓝），右板接 R（充电时为正板/红） */}
                <g>
                    {/* 左板（垂直线） */}
                    <line
                        x1={CAPACITOR.cx - CAPACITOR.gap / 2}
                        y1={CAPACITOR.y - CAPACITOR.plateHalfHeight}
                        x2={CAPACITOR.cx - CAPACITOR.gap / 2}
                        y2={CAPACITOR.y + CAPACITOR.plateHalfHeight}
                        stroke={COLORS.negative}
                        strokeWidth={4}
                        strokeLinecap="round"
                    />
                    {/* 右板（垂直线） */}
                    <line
                        x1={CAPACITOR.cx + CAPACITOR.gap / 2}
                        y1={CAPACITOR.y - CAPACITOR.plateHalfHeight}
                        x2={CAPACITOR.cx + CAPACITOR.gap / 2}
                        y2={CAPACITOR.y + CAPACITOR.plateHalfHeight}
                        stroke={COLORS.positive}
                        strokeWidth={4}
                        strokeLinecap="round"
                    />
                    {/* 极板电荷点阵（左板 −、右板 +） */}
                    {(() => {
                        const symbols: ReactElement[] = [];
                        const { cols, rows, spacing } = CHARGE_GRID;
                        // 左板（− 号，垂直排布在左板左侧）
                        const yStartLeft = CAPACITOR.y - ((rows - 1) * spacing) / 2;
                        const xLeft = CAPACITOR.cx - CAPACITOR.gap / 2 - 12;
                        // 右板（+ 号，垂直排布在右板右侧）
                        const yStartRight = CAPACITOR.y - ((rows - 1) * spacing) / 2;
                        const xRight = CAPACITOR.cx + CAPACITOR.gap / 2 + 12;
                        for (let c = 0; c < cols; c++) {
                            for (let r = 0; r < rows; r++) {
                                const idx = c * rows + r;
                                const yL = yStartLeft + r * spacing - c * 2;
                                const yR = yStartRight + r * spacing - c * 2;
                                if (idx < chargeDots) {
                                    symbols.push(
                                        <text
                                            key={`n-${idx}`}
                                            x={xLeft}
                                            y={yL + 4}
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
                                    symbols.push(
                                        <text
                                            key={`p-${idx}`}
                                            x={xRight}
                                            y={yR + 4}
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
                                }
                            }
                        }
                        return <g style={{ pointerEvents: 'none' }}>{symbols}</g>;
                    })()}
                    {/* 电容数值标签 */}
                    {showLabels && (
                        <>
                            <ValueTag
                                x={CAPACITOR.cx}
                                y={CAPACITOR.y - CAPACITOR.plateHalfHeight - 24}
                                text={`C = ${params.capacitance} μF`}
                                fill={COLORS.accent}
                            />
                            <ValueTag
                                x={CAPACITOR.cx}
                                y={CAPACITOR.y + CAPACITOR.plateHalfHeight + 22}
                                text={`U_C = ${formatVoltage(state.voltage)} V`}
                                fill={COLORS.accent}
                            />
                        </>
                    )}
                </g>

                {/* ===== 电流数值标签（中支路下方，避免与 R/C 重叠） ===== */}
                {showLabels && (
                    <ValueTag
                        x={(RHEOSTAT.xStart + RHEOSTAT.xEnd) / 2}
                        y={RHEOSTAT.y + RHEOSTAT.bodyHeight + 32}
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
