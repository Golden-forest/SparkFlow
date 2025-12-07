/**
 * 氢原子能级跃迁物理计算模块
 */

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

// 激发模式
export type ExcitationMode = 'photon' | 'electron' | 'spontaneous';

// 原子类型
export type AtomType = 'single' | 'group';

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
    const colors: Record<number, string> = {
        1: '#ff4444', // 基态 - 红色
        2: '#ff8800', // 第一激发态 - 橙色
        3: '#ffcc00', // 第二激发态 - 黄色
        4: '#44ff44', // 绿色
        5: '#4488ff', // 蓝色
        6: '#8844ff', // 紫色
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
    if (wavelength < 380) return '#8b00ff'; // 紫外
    if (wavelength < 450) return '#4b0082'; // 紫
    if (wavelength < 495) return '#0000ff'; // 蓝
    if (wavelength < 570) return '#00ff00'; // 绿
    if (wavelength < 590) return '#ffff00'; // 黄
    if (wavelength < 620) return '#ff7f00'; // 橙
    if (wavelength < 750) return '#ff0000'; // 红
    return '#8b0000'; // 红外
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
