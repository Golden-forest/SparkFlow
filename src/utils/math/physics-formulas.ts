import { PHYSICS_CONSTANTS } from '../constants';

/**
 * 物理公式计算函数
 */

// 库仑力计算 F = k * q1 * q2 / r²
export function coulombForce(
    q1: number,
    q2: number,
    distance: number
): number {
    if (distance === 0) return Infinity;
    return (PHYSICS_CONSTANTS.COULOMB_CONSTANT * q1 * q2) / (distance * distance);
}

// 库仑势能 U = k * q1 * q2 / r
export function coulombPotential(
    q1: number,
    q2: number,
    distance: number
): number {
    if (distance === 0) return Infinity;
    return (PHYSICS_CONSTANTS.COULOMB_CONSTANT * q1 * q2) / distance;
}

// 氢原子能级 E_n = -13.6 eV / n²
export function hydrogenEnergyLevel(n: number): number {
    const RYDBERG_ENERGY = 13.6; // eV
    return -RYDBERG_ENERGY / (n * n);
}

// 光子能量 E = h * f = h * c / λ
export function photonEnergy(wavelength: number): number {
    const { PLANCK_CONSTANT, SPEED_OF_LIGHT } = PHYSICS_CONSTANTS;
    return (PLANCK_CONSTANT * SPEED_OF_LIGHT) / wavelength;
}

// 德布罗意波长 λ = h / p
export function deBroglieWavelength(momentum: number): number {
    return PHYSICS_CONSTANTS.PLANCK_CONSTANT / momentum;
}

// 动能 KE = 0.5 * m * v²
export function kineticEnergy(mass: number, velocity: number): number {
    return 0.5 * mass * velocity * velocity;
}

// 根据动能计算速度
export function velocityFromKE(mass: number, kineticEnergy: number): number {
    return Math.sqrt((2 * kineticEnergy) / mass);
}

// eV转焦耳
export function evToJoule(ev: number): number {
    return ev * PHYSICS_CONSTANTS.EV_TO_JOULE;
}

// 焦耳转eV
export function jouleToEv(joule: number): number {
    return joule / PHYSICS_CONSTANTS.EV_TO_JOULE;
}
