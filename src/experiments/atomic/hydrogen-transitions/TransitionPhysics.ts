/**
 * 氢原子能级跃迁物理计算模块
 */

import * as THREE from 'three';

// 物理常量
export const PLANCK_CONSTANT = 6.626e-34; // 普朗克常量 (J·s)
export const ELECTRON_CHARGE = 1.602e-19; // 电子电荷 (C)
export const SPEED_OF_LIGHT = 3e8; // 光速 (m/s)
export const RYDBERG_ENERGY = 13.6; // 里德伯能量 (eV)

// 能级数据 (n = 1 到 6)
export interface EnergyLevel {
    n: number;           // 主量子数
    energy: number;      // 能量 (eV)
    radius: number;      // 玻尔半径倍数
    color: string;       // 显示颜色
}

// 跃迁数据
export interface Transition {
    from: number;        // 起始能级
    to: number;          // 终止能级
    deltaE: number;      // 能量差 (eV)
    wavelength: number;  // 波长 (nm)
    photonColor: string; // 光子颜色
    type: 'emission' | 'absorption';
}

// 激发模式 (保留用于兼容旧代码，推荐使用 SceneMode)
export type ExcitationMode = 'photon' | 'electron' | 'spontaneous';

// 原子类型
export type AtomType = 'single' | 'group';

// 场景模式
export type SceneMode =
    | 'stimulated-absorption'  // 受激吸收
    | 'spontaneous-emission'   // 自发辐射
    | 'stimulated-emission';   // 受激辐射

/**
 * 计算氢原子能级能量
 * E_n = -13.6 / n² eV
 */
export function calculateEnergy(n: number): number {
    return -RYDBERG_ENERGY / (n * n);
}

/**
 * 计算玻尔半径
 * r_n = n² * a₀ (a₀ ≈ 0.529 Å)
 */
export function calculateRadius(n: number): number {
    return n * n * 0.529;
}

/**
 * 获取能级颜色 (用于可视化)
 */
export function getLevelColor(n: number): string {
    // 渐变色：从内向外，暖色 -> 冷色
    const colors: Record<number, string> = {
        1: '#ff4400', // 基态 - 深橙红
        2: '#ff8800', // 橙色
        3: '#ffcc00', // 黄色
        4: '#00ff44', // 绿色
        5: '#0088ff', // 蓝色
        6: '#8800ff', // 紫色
    };
    return colors[n] || '#ffffff';
}

/**
 * 生成所有能级数据 (n = 1 到 maxN)
 */
export function generateEnergyLevels(maxN: number = 6): EnergyLevel[] {
    const levels: EnergyLevel[] = [];
    for (let n = 1; n <= maxN; n++) {
        levels.push({
            n,
            energy: calculateEnergy(n),
            radius: calculateRadius(n),
            color: getLevelColor(n),
        });
    }
    return levels;
}

/**
 * 计算跃迁波长
 * λ = hc / ΔE
 */
export function calculateWavelength(deltaE: number): number {
    // deltaE 单位是 eV，转换为 J
    const deltaJ = Math.abs(deltaE) * ELECTRON_CHARGE;
    const wavelength = (PLANCK_CONSTANT * SPEED_OF_LIGHT) / deltaJ;
    return wavelength * 1e9; // 转换为 nm
}

/**
 * 根据波长获取光子颜色
 */
export function getPhotonColor(wavelength: number): string {
    if (wavelength < 380) return '#ff00ff'; // 紫外 - 亮紫
    if (wavelength < 450) return '#8000ff'; // 紫 - 亮紫
    if (wavelength < 495) return '#00aaff'; // 蓝 - 亮蓝
    if (wavelength < 570) return '#00ff80'; // 绿 - 亮绿
    if (wavelength < 590) return '#ffff00'; // 黄 - 亮黄
    if (wavelength < 620) return '#ffaa00'; // 橙 - 亮橙
    if (wavelength < 750) return '#ff4400'; // 红 - 亮红
    return '#ff0044'; // 红外 - 亮红
}

/**
 * 计算单次跃迁
 */
export function calculateTransition(fromN: number, toN: number): Transition {
    const fromE = calculateEnergy(fromN);
    const toE = calculateEnergy(toN);
    const deltaE = fromE - toE; // 正值表示释放能量
    const wavelength = calculateWavelength(deltaE);

    return {
        from: fromN,
        to: toN,
        deltaE: Math.abs(deltaE),
        wavelength,
        photonColor: getPhotonColor(wavelength),
        type: deltaE > 0 ? 'emission' : 'absorption',
    };
}

/**
 * 计算一群原子可能产生的所有跃迁
 * 从能级 n 向下跃迁到所有更低能级
 */
export function calculateAllTransitions(maxN: number): Transition[] {
    const transitions: Transition[] = [];

    for (let from = maxN; from >= 2; from--) {
        for (let to = from - 1; to >= 1; to--) {
            transitions.push(calculateTransition(from, to));
        }
    }

    return transitions;
}

/**
 * 计算光谱线数量
 * C(n, 2) = n(n-1)/2
 */
export function calculateSpectralLineCount(n: number): number {
    return (n * (n - 1)) / 2;
}

/**
 * 检查光子能量是否能被吸收 (光子激发模式)
 * 光子能量必须精确等于能级差
 */
export function canAbsorbPhoton(
    currentLevel: number,
    photonEnergy: number,
    tolerance: number = 0.1
): number | null {
    // 检查是否能跃迁到更高能级
    for (let n = currentLevel + 1; n <= 6; n++) {
        const deltaE = calculateEnergy(n) - calculateEnergy(currentLevel);
        if (Math.abs(photonEnergy - Math.abs(deltaE)) < tolerance) {
            return n; // 返回目标能级
        }
    }

    // 检查是否能电离 (>=13.6 eV从基态)
    const ionizationEnergy = Math.abs(calculateEnergy(currentLevel));
    if (photonEnergy >= ionizationEnergy) {
        return Infinity; // 电离
    }

    return null; // 不能被吸收
}

/**
 * 检查电子碰撞能否激发 (电子碰撞模式)
 * 电子能量只需大于等于能级差
 */
export function canExciteByElectron(
    currentLevel: number,
    electronEnergy: number
): { targetLevel: number; remainingEnergy: number } | null {
    // 找到能够达到的最高能级
    let targetLevel = currentLevel;

    for (let n = currentLevel + 1; n <= 6; n++) {
        const deltaE = Math.abs(calculateEnergy(n) - calculateEnergy(currentLevel));
        if (electronEnergy >= deltaE) {
            targetLevel = n;
        }
    }

    // 检查电离
    const ionizationEnergy = Math.abs(calculateEnergy(currentLevel));
    if (electronEnergy >= ionizationEnergy) {
        return {
            targetLevel: Infinity,
            remainingEnergy: electronEnergy - ionizationEnergy,
        };
    }

    if (targetLevel > currentLevel) {
        const deltaE = Math.abs(calculateEnergy(targetLevel) - calculateEnergy(currentLevel));
        return {
            targetLevel,
            remainingEnergy: electronEnergy - deltaE,
        };
    }

    return null; // 能量不足
}

/**
 * 生成单原子自发跃迁路径
 * 随机选择一条从当前能级到基态的路径
 */
export function generateSpontaneousPath(startLevel: number): Transition[] {
    const path: Transition[] = [];
    let currentLevel = startLevel;

    while (currentLevel > 1) {
        // 随机选择一个更低的能级
        const targetLevel = Math.floor(Math.random() * (currentLevel - 1)) + 1;
        path.push(calculateTransition(currentLevel, targetLevel));
        currentLevel = targetLevel;
    }

    return path;
}

// 预计算的能级数据
export const ENERGY_LEVELS = generateEnergyLevels(6);

// 预计算的所有可能跃迁
export const ALL_TRANSITIONS = calculateAllTransitions(6);

/**
 * 获取给定场景和能级下的所有有效跃迁能量值
 * 用于能量滑块上显示标记点
 */
export function getValidTransitionEnergies(
    currentLevel: number,
    sceneMode: SceneMode
): number[] {
    const energies: number[] = [];

    if (sceneMode === 'stimulated-absorption') {
        // 受激吸收：从当前能级向上跃迁
        for (let n = currentLevel + 1; n <= 6; n++) {
            const deltaE = Math.abs(calculateEnergy(n) - calculateEnergy(currentLevel));
            energies.push(deltaE);
        }
        // 添加电离能量
        const ionizationEnergy = Math.abs(calculateEnergy(currentLevel));
        energies.push(ionizationEnergy);
    } else if (sceneMode === 'stimulated-emission') {
        // 受激辐射：从当前能级向下跃迁
        for (let n = currentLevel - 1; n >= 1; n--) {
            const deltaE = Math.abs(calculateEnergy(currentLevel) - calculateEnergy(n));
            energies.push(deltaE);
        }
    }

    // 保留两位小数并排序
    return energies
        .map(e => Math.round(e * 100) / 100)
        .sort((a, b) => a - b);
}

/**
 * 检查光子能量是否匹配某个有效跃迁能量
 * @param photonEnergy 光子能量
 * @param validEnergies 有效能量列表
 * @param tolerance 容差（eV）
 * @returns 匹配的能量值，如果不匹配返回 null
 */
export function matchValidEnergy(
    photonEnergy: number,
    validEnergies: number[],
    tolerance: number = 0.05
): number | null {
    for (const validE of validEnergies) {
        if (Math.abs(photonEnergy - validE) < tolerance) {
            return validE;
        }
    }
    return null;
}

/**
 * 根据匹配的能量值确定目标能级
 */
export function getTargetLevel(
    currentLevel: number,
    matchedEnergy: number,
    sceneMode: SceneMode
): number | null {
    if (sceneMode === 'stimulated-absorption') {
        // 向上跃迁
        for (let n = currentLevel + 1; n <= 6; n++) {
            const deltaE = Math.abs(calculateEnergy(n) - calculateEnergy(currentLevel));
            if (Math.abs(deltaE - matchedEnergy) < 0.01) {
                return n;
            }
        }
        // 检查是否是电离
        const ionizationEnergy = Math.abs(calculateEnergy(currentLevel));
        if (Math.abs(ionizationEnergy - matchedEnergy) < 0.01) {
            return Infinity;
        }
    } else if (sceneMode === 'stimulated-emission') {
        // 向下跃迁
        for (let n = currentLevel - 1; n >= 1; n--) {
            const deltaE = Math.abs(calculateEnergy(currentLevel) - calculateEnergy(n));
            if (Math.abs(deltaE - matchedEnergy) < 0.01) {
                return n;
            }
        }
    }
    return null;
}
