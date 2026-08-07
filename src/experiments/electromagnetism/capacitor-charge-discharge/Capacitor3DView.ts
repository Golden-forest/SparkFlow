/**
 * Capacitor3DView — 电容充放电实验的 3D 元件视图（可选叠加子视图）
 *
 * 设计参考（spec §7）:
 * - 极板: 两个薄圆盘 CylinderGeometry，上红 +、下蓝 −
 * - 电场线: 极板间垂直 Line，数量 ∝ |Q|
 * - 关键矢量箭头: ArrowHelper，方向恒定为 + → −（向下），数量 ∝ |Q|
 * - 极板表面电荷: 小球 SphereGeometry 网格排布，数量 ∝ |Q|
 *
 * 资源管理（spec §7.3 + handoff §10）:
 * - 所有几何体/材质在构造时创建一次，update() 仅切换 visible / setDirection
 * - dispose() 通过去重 Set 递归释放（极板几何体 / 球体几何体在多个 mesh 间共享，
 *   必须确保每个资源只 dispose 一次，避免触发 WebGLRenderer 内部状态污染）。
 *
 * 调用方: Capacitor3DCanvas.tsx 通过 useState 惰性初始化持有本类实例，
 * useFrame 驱动 update()，useEffect cleanup 调用 dispose()。
 *
 * 视觉规范（spec §8 + handoff §4）:
 * - 上板/正电荷: 红 0xF87171
 * - 下板/负电荷: 蓝 0x60A5FA
 * - 电场线/箭头: 青 0x22D3EE（叠加混合，半透明）
 * - 背景: 由 Canvas style 控制（#0D1117）
 */

import * as THREE from 'three';
import type { CircuitState, CircuitParams } from './RCCircuitPhysics';

// --- 几何参数（spec §7.2） ---
const PLATE_RADIUS = 2;
const PLATE_THICKNESS = 0.1;
/** 两板之间的间距（板中心到板中心） */
const PLATE_GAP = 1.5;

// --- 对象池容量（一次创建，按 visible 切换） ---
const MAX_FIELD_LINES = 12;
const MAX_CHARGE_SPHERES = 30; // 每块板
const MAX_ARROWS = 8;

// --- 颜色（spec §8） ---
const COLOR_POSITIVE = 0xf87171; // 上板（+）
const COLOR_NEGATIVE = 0x60a5fa; // 下板（−）
const COLOR_FIELD = 0x22d3ee; // 电场线 / 箭头

// 预分配方向向量（避免 useFrame 每帧 new Vector3 造成 GC 压力）
// 电场永远从 + 板（上、红）指向 − 板（下、蓝），即向下。
// 本仿真电源电压始终 ≥ 0，Q = C·U_C ≥ 0，不存在反向充电，故无需向上方向。
const FIELD_DIR_DOWN = new THREE.Vector3(0, -1, 0);

/**
 * 简易种子随机数生成器（线性同余）。
 * 用途: 让电荷小球在板面的分布稳定（不随每帧抖动），同时避免聚集。
 */
function seededRandom(seed: number): () => number {
    let s = seed;
    return () => {
        s = (s * 9301 + 49297) % 233280;
        return s / 233280;
    };
}

export class Capacitor3DView {
    readonly group: THREE.Group;

    private readonly plateGroup: THREE.Group;
    private readonly fieldLineGroup: THREE.Group;
    private readonly chargeSphereGroup: THREE.Group;
    private readonly arrowGroup: THREE.Group;

    /** 预分配电场线池（构造时全部 invisible，update 按 fill ratio 切换 visible） */
    private fieldLines: THREE.Line[] = [];
    /** 上板表面电荷小球池 */
    private chargeSpheresTop: THREE.Mesh[] = [];
    /** 下板表面电荷小球池 */
    private chargeSpheresBot: THREE.Mesh[] = [];
    /** 矢量箭头池 */
    private arrows: THREE.ArrowHelper[] = [];

    constructor() {
        this.group = new THREE.Group();
        this.group.name = 'Capacitor3DView';

        this.plateGroup = new THREE.Group();
        this.plateGroup.name = 'Plates';
        this.fieldLineGroup = new THREE.Group();
        this.fieldLineGroup.name = 'FieldLines';
        this.chargeSphereGroup = new THREE.Group();
        this.chargeSphereGroup.name = 'ChargeSpheres';
        this.arrowGroup = new THREE.Group();
        this.arrowGroup.name = 'FieldArrows';

        this.group.add(
            this.plateGroup,
            this.fieldLineGroup,
            this.chargeSphereGroup,
            this.arrowGroup,
        );

        this.buildStaticPlates();
        this.buildFieldLinePool();
        this.buildArrowPool();
        this.buildChargeSpherePool();
    }

    // --- T4.2: 极板（静态，构造一次） ---

    /**
     * 构造两块薄圆盘极板。CylinderGeometry 默认沿 Y 轴，板面正好水平，
     * 因此无需旋转。圆盘薄（厚度 0.1），半径 2，符合 spec §7.2。
     */
    private buildStaticPlates(): void {
        const geometry = new THREE.CylinderGeometry(
            PLATE_RADIUS,
            PLATE_RADIUS,
            PLATE_THICKNESS,
            32,
        );

        // 上板（红色，正极）
        const topMaterial = new THREE.MeshStandardMaterial({
            color: COLOR_POSITIVE,
            transparent: true,
            opacity: 0.55,
            // depthWrite:false 防止半透明极板遮挡板间电场线 / 箭头
            depthWrite: false,
            metalness: 0.3,
            roughness: 0.6,
            side: THREE.DoubleSide,
        });
        const topPlate = new THREE.Mesh(geometry, topMaterial);
        topPlate.position.set(0, PLATE_GAP / 2, 0);
        topPlate.name = 'TopPlate (positive)';

        // 下板（蓝色，负极）
        const bottomMaterial = new THREE.MeshStandardMaterial({
            color: COLOR_NEGATIVE,
            transparent: true,
            opacity: 0.55,
            // depthWrite:false 防止半透明极板遮挡板间电场线 / 箭头
            depthWrite: false,
            metalness: 0.3,
            roughness: 0.6,
            side: THREE.DoubleSide,
        });
        const bottomPlate = new THREE.Mesh(geometry, bottomMaterial);
        bottomPlate.position.set(0, -PLATE_GAP / 2, 0);
        bottomPlate.name = 'BottomPlate (negative)';

        this.plateGroup.add(topPlate, bottomPlate);
    }

    // --- T4.3: 电场线池 ---

    /**
     * 构造 MAX_FIELD_LINES 条垂直电场线，分布在极板之间（半径 PLATE_RADIUS * 0.7 内）。
     * 采用网格 + 抖动分布，避免完美对齐造成的视觉僵硬。
     * 所有线构造时 invisible，update() 按 fill ratio 切换。
     */
    private buildFieldLinePool(): void {
        // 极板内侧 y 坐标（避开板厚，留 0.1 间隙）
        const yTop = PLATE_GAP / 2 - PLATE_THICKNESS / 2 - 0.05;
        const yBot = -PLATE_GAP / 2 + PLATE_THICKNESS / 2 + 0.05;
        const rMax = PLATE_RADIUS * 0.7;

        // 用 4×3 网格分布 12 条线，加微小角度抖动
        const cols = 4;
        const rows = 3;
        const rng = seededRandom(1337);
        let placed = 0;
        for (let r = 0; r < rows && placed < MAX_FIELD_LINES; r++) {
            for (let c = 0; c < cols && placed < MAX_FIELD_LINES; c++) {
                // 归一化到 [-1, 1]，再缩放到 rMax
                const nx = (c / (cols - 1)) * 2 - 1;
                const nz = (r / (rows - 1)) * 2 - 1;
                // 排除超出圆半径的点（保持电场线在板内）
                const dist = Math.sqrt(nx * nx + nz * nz);
                if (dist > 1) continue;
                // 抖动 ±0.08（避免完美对齐）
                const jitterX = (rng() - 0.5) * 0.16;
                const jitterZ = (rng() - 0.5) * 0.16;
                const x = (nx + jitterX) * rMax;
                const z = (nz + jitterZ) * rMax;

                const lineGeometry = new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(x, yBot, z),
                    new THREE.Vector3(x, yTop, z),
                ]);
                const lineMaterial = new THREE.LineBasicMaterial({
                    color: COLOR_FIELD,
                    transparent: true,
                    opacity: 0.7,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false,
                });
                const line = new THREE.Line(lineGeometry, lineMaterial);
                line.visible = false;
                line.name = `FieldLine-${placed}`;
                this.fieldLines.push(line);
                this.fieldLineGroup.add(line);
                placed++;
            }
        }
    }

    // --- T4.4: 矢量箭头池 ---

    /**
     * 构造 MAX_ARROWS 个 ArrowHelper，分布在极板中间平面（y=0）半径 0.5*PLATE_RADIUS 的圆上。
     * 默认方向 (0,-1,0)（电场从 + 板指向 − 板，即向下）。update() 仅按 fill ratio 切换 visible，
     * 方向保持不变（本仿真电源电压始终 ≥ 0，不存在反向充电）。
     */
    private buildArrowPool(): void {
        const r = PLATE_RADIUS * 0.5;
        for (let i = 0; i < MAX_ARROWS; i++) {
            const angle = (i / MAX_ARROWS) * Math.PI * 2;
            const x = Math.cos(angle) * r;
            const z = Math.sin(angle) * r;
            const arrow = new THREE.ArrowHelper(
                new THREE.Vector3(0, -1, 0),
                new THREE.Vector3(x, 0, z),
                0.8,
                COLOR_FIELD,
                0.18,
                0.1,
            );
            arrow.visible = false;
            arrow.name = `FieldArrow-${i}`;
            this.arrows.push(arrow);
            this.arrowGroup.add(arrow);
        }
    }

    // --- T4.5: 电荷小球池 ---

    /**
     * 构造每板 MAX_CHARGE_SPHERES 个小球（共 60 个），分布在内侧板面。
     * 红色（上板内侧底面）/ 蓝色（下板内侧顶面）带自发光。
     * 用 seeded random 确保分布稳定。
     */
    private buildChargeSpherePool(): void {
        const sphereGeometry = new THREE.SphereGeometry(0.08, 8, 8);
        const topMaterial = new THREE.MeshStandardMaterial({
            color: COLOR_POSITIVE,
            emissive: COLOR_POSITIVE,
            emissiveIntensity: 0.4,
        });
        const botMaterial = new THREE.MeshStandardMaterial({
            color: COLOR_NEGATIVE,
            emissive: COLOR_NEGATIVE,
            emissiveIntensity: 0.4,
        });

        // 上板内侧底面 y（紧贴上板下表面）
        const yTopSpheres = PLATE_GAP / 2 - PLATE_THICKNESS / 2 - 0.05;
        // 下板内侧顶面 y（紧贴下板上表面）
        const yBotSpheres = -PLATE_GAP / 2 + PLATE_THICKNESS / 2 + 0.05;

        const rMax = PLATE_RADIUS * 0.85;
        const rngTop = seededRandom(42);
        const rngBot = seededRandom(7);

        for (let i = 0; i < MAX_CHARGE_SPHERES; i++) {
            // 极坐标随机分布（圆盘内均匀）
            const topPoint = randomPointInDisk(rMax, rngTop);
            const topSphere = new THREE.Mesh(sphereGeometry, topMaterial);
            topSphere.position.set(topPoint.x, yTopSpheres, topPoint.z);
            topSphere.visible = false;
            topSphere.name = `ChargeTop-${i}`;
            this.chargeSpheresTop.push(topSphere);
            this.chargeSphereGroup.add(topSphere);

            const botPoint = randomPointInDisk(rMax, rngBot);
            const botSphere = new THREE.Mesh(sphereGeometry, botMaterial);
            botSphere.position.set(botPoint.x, yBotSpheres, botPoint.z);
            botSphere.visible = false;
            botSphere.name = `ChargeBot-${i}`;
            this.chargeSpheresBot.push(botSphere);
            this.chargeSphereGroup.add(botSphere);
        }
    }

    // --- 每帧更新 ---

    /**
     * 每帧由 Capacitor3DCanvas 的 useFrame 调用。
     *
     * 计算 fill ratio = |Q| / Qmax，据此切换 fieldLines / chargeSpheres / arrows 的 visible 数量。
     * 箭头方向恒定为 (0,-1,0)：电场从 + 板（上、红）指向 − 板（下、蓝），即向下。
     *
     * 注：物理上 Q = C × U_C ≥ 0（本仿真电源电压 U₀ ≥ 0，电容只能正向充电），
     * 因此无需处理反向充电的电场翻转。
     */
    update(state: CircuitState, params: CircuitParams): void {
        // Qmax = C × U₀（与 CircuitView2D chargeDots 计算一致）
        const C_farad = params.capacitance * 1e-6;
        const Qmax = C_farad * params.sourceVoltage;
        const Qabs = Math.abs(state.charge);
        const fillRatio = Qmax > 0 ? Math.min(Qabs / Qmax, 1) : 0;

        // 电场线
        const visibleLines = Math.floor(fillRatio * MAX_FIELD_LINES);
        for (let i = 0; i < this.fieldLines.length; i++) {
            this.fieldLines[i].visible = i < visibleLines;
        }

        // 电荷小球（上下板同步显示）
        const visibleSpheres = Math.floor(fillRatio * MAX_CHARGE_SPHERES);
        for (let i = 0; i < this.chargeSpheresTop.length; i++) {
            this.chargeSpheresTop[i].visible = i < visibleSpheres;
        }
        for (let i = 0; i < this.chargeSpheresBot.length; i++) {
            this.chargeSpheresBot[i].visible = i < visibleSpheres;
        }

        // 矢量箭头（方向恒定向下：+ 在上板 → 电场向下）
        const visibleArrows = Math.floor(fillRatio * MAX_ARROWS);
        // 使用模块级常量向量，避免每帧 new Vector3 造成 GC 压力
        const arrowDir = FIELD_DIR_DOWN;
        for (let i = 0; i < this.arrows.length; i++) {
            const arrow = this.arrows[i];
            arrow.visible = i < visibleArrows;
            if (arrow.visible) {
                arrow.setDirection(arrowDir);
            }
        }
    }

    /**
     * 重置所有动态元素为不可见（用于实验 reset）。
     * 极板保持可见（静态结构）。
     */
    reset(): void {
        for (const line of this.fieldLines) line.visible = false;
        for (const s of this.chargeSpheresTop) s.visible = false;
        for (const s of this.chargeSpheresBot) s.visible = false;
        for (const a of this.arrows) a.visible = false;
    }

    /**
     * 递归释放所有 Three.js 资源（geometry / material / texture）。
     * 必须在 showField3D 切换为 false 或 experiment.dispose() 时调用。
     *
     * 实现说明（C1 修复）:
     * 极板的 CylinderGeometry 被两块板共享，电荷球的 SphereGeometry 被全部 60 个球共享，
     * 球的 topMaterial / botMaterial 也分别被 30 个 mesh 共享。如果直接对每个 mesh 调用
     * dispose，会触发 N 次 'dispose' 事件并可能污染 WebGLRenderer 内部状态。
     *
     * 这里用 Set 去重：每个被共享的资源只 dispose 一次。
     * 不复用 threeUtils.disposeObject3D，因为后者无去重逻辑。
     */
    dispose(): void {
        const disposedGeometries = new Set<THREE.BufferGeometry>();
        const disposedMaterials = new Set<THREE.Material>();

        this.group.traverse((child) => {
            const obj = child as THREE.Object3D & {
                geometry?: THREE.BufferGeometry;
                material?: THREE.Material | THREE.Material[];
            };
            if (obj.geometry && !disposedGeometries.has(obj.geometry)) {
                disposedGeometries.add(obj.geometry);
                obj.geometry.dispose();
            }
            const materials = Array.isArray(obj.material)
                ? obj.material
                : obj.material
                  ? [obj.material]
                  : [];
            for (const material of materials) {
                if (!disposedMaterials.has(material)) {
                    disposedMaterials.add(material);
                    const m = material as THREE.Material & {
                        map?: THREE.Texture;
                        emissiveMap?: THREE.Texture;
                        alphaMap?: THREE.Texture;
                    };
                    m.map?.dispose();
                    m.emissiveMap?.dispose();
                    m.alphaMap?.dispose();
                    material.dispose();
                }
            }
        });

        // 清空对象池引用（mesh 本身随 group 脱离场景图后被 GC）
        this.fieldLines = [];
        this.chargeSpheresTop = [];
        this.chargeSpheresBot = [];
        this.arrows = [];
    }
}

/**
 * 在半径 rMax 的圆盘内生成均匀分布的随机点（极坐标法：r = rMax·√u）。
 * 接受一个 rng 函数以保证可复现。
 */
function randomPointInDisk(
    rMax: number,
    rng: () => number,
): { x: number; z: number } {
    const u = rng();
    const r = rMax * Math.sqrt(u);
    const theta = rng() * Math.PI * 2;
    return { x: r * Math.cos(theta), z: r * Math.sin(theta) };
}
