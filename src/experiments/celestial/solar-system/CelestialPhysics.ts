/**
 * @deprecated 此文件已弃用
 *
 * ⚠️ 警告：此文件包含的物理计算函数已不再使用
 *
 * 天体运动实验已经重构，现在使用可视化数据驱动的简化方案。
 * 行星和卫星的运动现在通过简单的三角函数计算，直接基于 VisualData 中定义的参数。
 *
 * 废弃原因：
 * - Planet.ts 和 Satellite.ts 不再使用这些物理计算函数
 * - 复杂的物理计算（万有引力、轨道力学）对于可视化演示来说过于复杂
 * - 新方案使用简化的速度系数和轨道半径，更适合教学演示
 *
 * 替代方案：
 * - 使用 VisualData.ts 中的可视化参数
 * - Planet.ts 和 Satellite.ts 中的 update() 方法使用简单的三角函数
 *
 * 保留此文件仅用于：
 * - 参考实际的物理常数（G, AU 等）
 * - 真实天体数据（质量、半径等）的教学参考
 * - 未来如果需要更精确的物理模拟时可以恢复使用
 *
 * @see VisualData.ts - 当前使用的可视化数据
 * @see Planet.ts - 简化的行星运动实现
 * @see Satellite.ts - 简化的卫星运动实现
 *
 * @deprecated since 2025-01-18 - 天体运动实验重构
 */

import * as THREE from 'three';

// 物理常数
/** @deprecated 物理常数已不再在模拟中使用，仅保留用于参考 */
export const G = 6.67430e-11; // 引力常数 (m³ kg⁻¹ s⁻²)
/** @deprecated 天文单位已不再在模拟中使用，仅保留用于参考 */
export const AU = 1.496e11; // 天文单位 (m)

// 缩放因子，将实际距离缩小到Three.js场景中合适的大小
/** @deprecated 缩放因子已不再在模拟中使用，仅保留用于参考 */
export const SCALE_FACTOR = 1e-9;

// 时间缩放因子，加速模拟
/** @deprecated 时间缩放因子已不再在模拟中使用，仅保留用于参考 */
export const TIME_SCALE = 1e7;

// 行星参数接口
/** @deprecated 此接口已不再使用，请使用 VisualData.ts 中的 VisualPlanetParams */
export interface PlanetParams {
    name: string;
    radius: number; // 实际半径 (m)
    mass: number; // 质量 (kg)
    color: string;
    orbitalRadius: number; // 轨道半径 (m)
    orbitalSpeed: number; // 轨道速度 (m/s)
    rotationSpeed: number; // 自转速度 (rad/s)
}

// 卫星参数接口
/** @deprecated 此接口已不再使用，请使用 VisualData.ts 中的 VisualSatelliteParams */
export interface SatelliteParams {
    name: string;
    radius: number;
    mass: number;
    color: string;
    orbitalRadius: number;
    orbitalSpeed: number;
    inclination: number; // 轨道倾角 (rad)
}

// 太阳系行星参数
/** @deprecated 此常量已不再使用，请使用 VisualData.ts 中的 PLANETS */
export const PLANETS: PlanetParams[] = [
    {
        name: '水星',
        radius: 2.4397e6,
        mass: 3.3011e23,
        color: '#8C7853',
        orbitalRadius: 5.7909e10,
        orbitalSpeed: 4.736e4,
        rotationSpeed: 6.139e-7
    },
    {
        name: '金星',
        radius: 6.0518e6,
        mass: 4.8675e24,
        color: '#FFC649',
        orbitalRadius: 1.0821e11,
        orbitalSpeed: 3.502e4,
        rotationSpeed: -2.99e-7 // 反向自转
    },
    {
        name: '地球',
        radius: 6.371e6,
        mass: 5.97237e24,
        color: '#4169E1',
        orbitalRadius: 1.496e11,
        orbitalSpeed: 2.978e4,
        rotationSpeed: 7.2921159e-5
    },
    {
        name: '火星',
        radius: 3.3895e6,
        mass: 6.39e23,
        color: '#CD5C5C',
        orbitalRadius: 2.2794e11,
        orbitalSpeed: 2.407e4,
        rotationSpeed: 7.088e-5
    },
    {
        name: '木星',
        radius: 6.9911e7,
        mass: 1.8982e27,
        color: '#D8CA9D',
        orbitalRadius: 7.7834e11,
        orbitalSpeed: 1.307e4,
        rotationSpeed: 1.758e-4
    },
    {
        name: '土星',
        radius: 5.8232e7,
        mass: 5.6834e26,
        color: '#FAD5A5',
        orbitalRadius: 1.427e12,
        orbitalSpeed: 9.69e3,
        rotationSpeed: 1.638e-4
    },
    {
        name: '天王星',
        radius: 2.5362e7,
        mass: 8.681e25,
        color: '#4FD0E7',
        orbitalRadius: 2.871e12,
        orbitalSpeed: 6.81e3,
        rotationSpeed: 1.48e-4
    },
    {
        name: '海王星',
        radius: 2.4622e7,
        mass: 1.02413e26,
        color: '#4169E1',
        orbitalRadius: 4.495e12,
        orbitalSpeed: 5.43e3,
        rotationSpeed: 1.27e-4
    }
];

// 地球卫星参数
/** @deprecated 此常量已不再使用，请使用 VisualData.ts 中的 SATELLITES */
export const SATELLITES: SatelliteParams[] = [
    {
        name: '国际空间站',
        radius: 10,
        mass: 4.2e5,
        color: '#FFFFFF',
        orbitalRadius: 4.20e5 + 6.371e6,
        orbitalSpeed: 7.66e3,
        inclination: 0.908 // 约52度
    },
    {
        name: 'GPS卫星',
        radius: 5,
        mass: 8.4e2,
        color: '#FF0000',
        orbitalRadius: 2.65e7,
        orbitalSpeed: 3.87e3,
        inclination: 0.958 // 约55度
    },
    {
        name: '同步卫星',
        radius: 8,
        mass: 2.0e3,
        color: '#00FF00',
        orbitalRadius: 4.2164e7,
        orbitalSpeed: 3.07e3,
        inclination: 0 // 赤道轨道
    },
    {
        name: '极地卫星',
        radius: 6,
        mass: 1.5e3,
        color: '#0000FF',
        orbitalRadius: 7.0e6,
        orbitalSpeed: 7.5e3,
        inclination: Math.PI / 2 // 90度
    }
];

/**
 * 计算两个天体之间的万有引力
 * @deprecated 此函数已不再使用，仅保留用于参考
 * @param m1 第一个天体的质量
 * @param m2 第二个天体的质量
 * @param r 两个天体之间的距离向量
 * @returns 万有引力向量
 */
export function calculateGravitationalForce(
    m1: number,
    m2: number,
    r: THREE.Vector3
): THREE.Vector3 {
    const distance = r.length();
    if (distance === 0) return new THREE.Vector3(0, 0, 0);
    
    const forceMagnitude = G * m1 * m2 / (distance * distance);
    const forceDirection = r.clone().normalize().multiplyScalar(-1);
    
    return forceDirection.multiplyScalar(forceMagnitude);
}

/**
 * 计算轨道位置
 * @deprecated 此函数已不再使用，Planet.update() 使用简化版本
 * @param radius 轨道半径
 * @param speed 轨道速度
 * @param time 时间
 * @returns 轨道位置
 */
export function calculateOrbitalPosition(
    radius: number,
    speed: number,
    time: number
): THREE.Vector3 {
    const angle = speed * time / radius;
    return new THREE.Vector3(
        Math.cos(angle) * radius,
        0,
        Math.sin(angle) * radius
    );
}

/**
 * 计算带有倾角的轨道位置
 * @deprecated 此函数已不再使用，Satellite.update() 使用简化版本
 * @param radius 轨道半径
 * @param speed 轨道速度
 * @param time 时间
 * @param inclination 轨道倾角
 * @returns 轨道位置
 */
export function calculateInclinedOrbitalPosition(
    radius: number,
    speed: number,
    time: number,
    inclination: number
): THREE.Vector3 {
    const angle = speed * time / radius;
    
    // 先计算赤道平面上的位置
    const pos = new THREE.Vector3(
        Math.cos(angle) * radius,
        0,
        Math.sin(angle) * radius
    );
    
    // 绕x轴旋转，应用倾角
    return pos.applyAxisAngle(new THREE.Vector3(1, 0, 0), inclination);
}

/**
 * 将实际距离转换为Three.js场景中的距离
 * @deprecated 此函数已不再使用，缩放因子已弃用
 * @param distance 实际距离 (m)
 * @returns 缩放后的距离
 */
export function scaleDistance(distance: number): number {
    return distance * SCALE_FACTOR;
}

/**
 * 将实际时间转换为Three.js场景中的时间
 * @deprecated 此函数已不再使用，时间缩放已弃用
 * @param time 实际时间 (s)
 * @returns 缩放后的时间
 */
export function scaleTime(time: number): number {
    return time * TIME_SCALE;
}

/**
 * 计算同步轨道半径
 * @deprecated 此函数已不再使用，仅保留用于物理参考
 * @param centralMass 中心天体质量
 * @param rotationPeriod 中心天体自转周期
 * @returns 同步轨道半径
 */
export function calculateSynchronousOrbitRadius(
    centralMass: number,
    rotationPeriod: number
): number {
    return Math.pow((G * centralMass * rotationPeriod * rotationPeriod) / (4 * Math.PI * Math.PI), 1/3);
}
