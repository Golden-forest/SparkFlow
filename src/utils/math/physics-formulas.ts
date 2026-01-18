import * as THREE from 'three';
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

// ===== 运动学公式 =====

/**
 * 抛体运动位置计算（理想化模型，无空气阻力）
 * @param t - 时间（秒）
 * @param v0 - 初速度矢量
 * @param g - 重力加速度（默认9.8 m/s²）
 * @returns 位置矢量
 */
export function projectilePosition(
    t: number,
    v0: THREE.Vector3,
    g: number = 9.8
): THREE.Vector3 {
    return new THREE.Vector3(
        v0.x * t,
        v0.y * t,
        v0.z * t - 0.5 * g * t * t
    );
}

/**
 * 抛体运动速度计算
 * @param t - 时间（秒）
 * @param v0 - 初速度矢量
 * @param g - 重力加速度（默认9.8 m/s²）
 * @returns 速度矢量
 */
export function projectileVelocity(
    t: number,
    v0: THREE.Vector3,
    g: number = 9.8
): THREE.Vector3 {
    return new THREE.Vector3(v0.x, v0.y, v0.z - g * t);
}

/**
 * 圆周运动线速度
 * @param omega - 角速度（rad/s）
 * @param radius - 半径（米）
 * @returns 线速度（m/s）
 */
export function circularVelocity(omega: number, radius: number): number {
    return omega * radius;
}

/**
 * 圆周运动向心加速度
 * @param omega - 角速度（rad/s）
 * @param radius - 半径（米）
 * @returns 向心加速度（m/s²）
 */
export function centripetalAcceleration(omega: number, radius: number): number {
    return omega * omega * radius;
}

/**
 * 圆周运动向心力
 * @param mass - 质量（kg）
 * @param omega - 角速度（rad/s）
 * @param radius - 半径（米）
 * @returns 向心力（N）
 */
export function centripetalForce(mass: number, omega: number, radius: number): number {
    return mass * omega * omega * radius;
}

// ===== 简谐运动公式 =====

/**
 * 弹簧振子位移 x(t) = A * cos(ωt + φ)
 * @param t - 时间（秒）
 * @param amplitude - 振幅（米）
 * @param angularFrequency - 角频率（rad/s）
 * @param phase - 初相位（弧度，默认0）
 * @returns 位移（米）
 */
export function springOscillation(
    t: number,
    amplitude: number,
    angularFrequency: number,
    phase: number = 0
): number {
    return amplitude * Math.cos(angularFrequency * t + phase);
}

/**
 * 弹簧振子速度 v(t) = -Aω * sin(ωt + φ)
 * @param t - 时间（秒）
 * @param amplitude - 振幅（米）
 * @param angularFrequency - 角频率（rad/s）
 * @param phase - 初相位（弧度，默认0）
 * @returns 速度（m/s）
 */
export function springOscillationVelocity(
    t: number,
    amplitude: number,
    angularFrequency: number,
    phase: number = 0
): number {
    return -amplitude * angularFrequency * Math.sin(angularFrequency * t + phase);
}

/**
 * 弹簧劲度系数 ω = √(k/m)
 * @param k - 劲度系数（N/m）
 * @param m - 质量（kg）
 * @returns 角频率（rad/s）
 */
export function springAngularFrequency(k: number, m: number): number {
    return Math.sqrt(k / m);
}

/**
 * 单摆周期 T = 2π * √(L/g) （小角度近似）
 * @param length - 摆长（米）
 * @param g - 重力加速度（默认9.8 m/s²）
 * @returns 周期（秒）
 */
export function pendulumPeriod(length: number, g: number = 9.8): number {
    return 2 * Math.PI * Math.sqrt(length / g);
}

/**
 * 单摆角频率 ω = √(g/L)
 * @param length - 摆长（米）
 * @param g - 重力加速度（默认9.8 m/s²）
 * @returns 角频率（rad/s）
 */
export function pendulumAngularFrequency(length: number, g: number = 9.8): number {
    return Math.sqrt(g / length);
}

/**
 * 单摆位移（小角度近似）θ(t) = θ₀ * cos(ωt + φ)
 * @param t - 时间（秒）
 * @param initialAngle - 初始角度（弧度）
 * @param length - 摆长（米）
 * @param g - 重力加速度（默认9.8 m/s²）
 * @param phase - 初相位（弧度，默认0）
 * @returns 角位移（弧度）
 */
export function pendulumOscillation(
    t: number,
    initialAngle: number,
    length: number,
    g: number = 9.8,
    phase: number = 0
): number {
    const omega = pendulumAngularFrequency(length, g);
    return initialAngle * Math.cos(omega * t + phase);
}

// ===== 能量公式 =====

/**
 * 重力势能 Ep = mgh
 * @param mass - 质量（kg）
 * @param height - 高度（米）
 * @param g - 重力加速度（默认9.8 m/s²）
 * @returns 重力势能（焦耳）
 */
export function gravitationalPotentialEnergy(
    mass: number,
    height: number,
    g: number = 9.8
): number {
    return mass * g * height;
}

/**
 * 弹性势能 Ep = ½kx²
 * @param k - 劲度系数（N/m）
 * @param displacement - 位移（米）
 * @returns 弹性势能（焦耳）
 */
export function elasticPotentialEnergy(
    k: number,
    displacement: number
): number {
    return 0.5 * k * displacement * displacement;
}

/**
 * 机械能 E = Ek + Ep
 * @param kineticEnergy - 动能（焦耳）
 * @param potentialEnergy - 势能（焦耳）
 * @returns 机械能（焦耳）
 */
export function mechanicalEnergy(
    kineticEnergy: number,
    potentialEnergy: number
): number {
    return kineticEnergy + potentialEnergy;
}

// ===== 动量与碰撞公式 =====

/**
 * 动量 p = mv
 * @param mass - 质量（kg）
 * @param velocity - 速度（m/s）
 * @returns 动量（kg·m/s）
 */
export function momentum(mass: number, velocity: number): number {
    return mass * velocity;
}

/**
 * 一维碰撞后速度（基于恢复系数）
 * @param m1 - 物体1质量（kg）
 * @param v1 - 物体1初速度（m/s）
 * @param m2 - 物体2质量（kg）
 * @param v2 - 物体2初速度（m/s）
 * @param restitution - 恢复系数（0=完全非弹性，1=弹性碰撞）
 * @returns 碰撞后两物体的速度 { v1Final, v2Final }
 */
export function collisionVelocity(
    m1: number,
    v1: number,
    m2: number,
    v2: number,
    restitution: number
): { v1Final: number; v2Final: number } {
    const totalMass = m1 + m2;
    const v1Final = ((m1 - restitution * m2) * v1 + (1 + restitution) * m2 * v2) / totalMass;
    const v2Final = ((1 + restitution) * m1 * v1 + (m2 - restitution * m1) * v2) / totalMass;
    return { v1Final, v2Final };
}

/**
 * 碰撞后总动能
 * @param m1 - 物体1质量（kg）
 * @param v1 - 物体1速度（m/s）
 * @param m2 - 物体2质量（kg）
 * @param v2 - 物体2速度（m/s）
 * @returns 总动能（焦耳）
 */
export function kineticEnergyAfterCollision(
    m1: number,
    v1: number,
    m2: number,
    v2: number
): number {
    return kineticEnergy(m1, v1) + kineticEnergy(m2, v2);
}

/**
 * 动量损失（用于非弹性碰撞）
 * @param m1 - 物体1质量（kg）
 * @param v1_initial - 物体1初速度（m/s）
 * @param v1_final - 物体1末速度（m/s）
 * @param m2 - 物体2质量（kg）
 * @param v2_initial - 物体2初速度（m/s）
 * @param v2_final - 物体2末速度（m/s）
 * @returns 动量损失（kg·m/s）
 */
export function momentumLoss(
    m1: number,
    v1_initial: number,
    v1_final: number,
    m2: number,
    v2_initial: number,
    v2_final: number
): number {
    const p_initial = Math.abs(momentum(m1, v1_initial) + momentum(m2, v2_initial));
    const p_final = Math.abs(momentum(m1, v1_final) + momentum(m2, v2_final));
    return p_initial - p_final;
}
