import * as THREE from 'three';
import {
  projectilePosition,
  projectileVelocity,
  kineticEnergy,
  gravitationalPotentialEnergy,
  mechanicalEnergy,
} from '@/utils/math/physics-formulas';
import { EARTH_GRAVITY } from '@/utils/constants';

/**
 * 抛体运动物理计算模块
 *
 * 提供抛体运动的物理状态管理和数据计算
 * 使用理想化模型，忽略空气阻力
 */

export interface ProjectileState {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  acceleration: THREE.Vector3;
  mass: number;
  time: number;
}

export interface ProjectileData {
  kineticEnergy: number;
  potentialEnergy: number;
  mechanicalEnergy: number;
  height: number;
  speed: number;
}

/**
 * 创建初始抛体状态
 *
 * @param v0 - 初速度矢量 (m/s)
 * @param mass - 质量 (kg, 默认1)
 * @param startPos - 初始位置 (默认原点)
 * @returns 初始抛体状态
 */
export function createInitialProjectile(
  v0: THREE.Vector3,
  mass: number = 1,
  startPos: THREE.Vector3 = new THREE.Vector3(0, 0, 0)
): ProjectileState {
  return {
    position: startPos.clone(),
    velocity: v0.clone(),
    acceleration: new THREE.Vector3(0, 0, -EARTH_GRAVITY),
    mass,
    time: 0,
  };
}

/**
 * 更新抛体状态
 *
 * 使用理想化模型，无空气阻力
 * 基于物理公式计算新位置和速度
 *
 * @param state - 当前状态
 * @param deltaTime - 时间步长 (秒)
 * @returns 更新后的状态
 */
export function updateProjectile(
  state: ProjectileState,
  deltaTime: number
): ProjectileState {
  const newTime = state.time + deltaTime;

  // 使用公式计算新位置和速度
  // 注意：projectilePosition 和 projectileVelocity 从 t=0 开始计算
  // 我们需要从初始速度和时间计算当前位置
  const displacement = projectilePosition(deltaTime, state.velocity, EARTH_GRAVITY);
  const newPosition = state.position.clone().add(displacement);
  const newVelocity = projectileVelocity(deltaTime, state.velocity, EARTH_GRAVITY);

  return {
    ...state,
    position: newPosition,
    velocity: newVelocity,
    acceleration: new THREE.Vector3(0, 0, -EARTH_GRAVITY),
    time: newTime,
  };
}

/**
 * 计算抛体物理量数据
 *
 * @param state - 抛体状态
 * @returns 物理量数据（能量、高度、速度）
 */
export function calculateProjectileData(state: ProjectileState): ProjectileData {
  const speed = state.velocity.length();
  const height = state.position.z;
  const kineticEnergy_val = kineticEnergy(state.mass, speed);
  const potentialEnergy_val = gravitationalPotentialEnergy(state.mass, height, EARTH_GRAVITY);

  return {
    kineticEnergy: kineticEnergy_val,
    potentialEnergy: potentialEnergy_val,
    mechanicalEnergy: mechanicalEnergy(kineticEnergy_val, potentialEnergy_val),
    height,
    speed,
  };
}

/**
 * 判断抛体是否落地
 *
 * @param state - 抛体状态
 * @param groundLevel - 地面高度 (默认0)
 * @returns 是否落地
 */
export function isLanded(state: ProjectileState, groundLevel: number = 0): boolean {
  return state.position.z <= groundLevel;
}
