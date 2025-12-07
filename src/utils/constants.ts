// 物理常数
export const PHYSICS_CONSTANTS = {
    // 基本物理常数
    SPEED_OF_LIGHT: 299792458, // m/s
    PLANCK_CONSTANT: 6.62607015e-34, // J⋅s
    ELEMENTARY_CHARGE: 1.602176634e-19, // C
    ELECTRON_MASS: 9.1093837015e-31, // kg
    PROTON_MASS: 1.67262192369e-27, // kg
    COULOMB_CONSTANT: 8.9875517923e9, // N⋅m²/C²

    // 原子物理相关
    BOHR_RADIUS: 5.29177210903e-11, // m
    RYDBERG_CONSTANT: 1.0973731568160e7, // m⁻¹
    FINE_STRUCTURE_CONSTANT: 7.2973525693e-3,

    // 单位转换
    EV_TO_JOULE: 1.602176634e-19,
    AMU_TO_KG: 1.66053906660e-27,
} as const;

// 实验类别枚举
export const ExperimentCategory = {
    Mechanics: 'mechanics',
    Electromagnetism: 'electromagnetism',
    Optics: 'optics',
    AtomicPhysics: 'atomic',
    Thermodynamics: 'thermodynamics',
} as const;

export type ExperimentCategory = typeof ExperimentCategory[keyof typeof ExperimentCategory];

// 实验难度
export type ExperimentDifficulty = 'basic' | 'intermediate' | 'advanced';

// 仿真状态
export const SimulationState = {
    Idle: 'idle',
    Running: 'running',
    Paused: 'paused',
    Completed: 'completed',
} as const;

export type SimulationState = typeof SimulationState[keyof typeof SimulationState];
