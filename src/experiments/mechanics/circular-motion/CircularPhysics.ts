import * as THREE from 'three';
import {
  circularVelocity,
  centripetalAcceleration,
  centripetalForce,
} from '@/utils/math/physics-formulas';

/**
 * 圆周运动物理计算模块
 *
 * 提供匀速圆周运动的物理状态管理和数据计算
 * 模型：物体在水平面上做匀速圆周运动
 */

export interface CircularState {
  angle: number;              // 当前角度 (弧度)
  angularVelocity: number;     // 角速度 (rad/s)
  radius: number;             // 轨道半径 (米)
  mass: number;               // 质量 (kg)
  centerPos: THREE.Vector3;   // 圆心位置
  time: number;               // 运动时间 (秒)
}

export interface CircularData {
  linearVelocity: number;       // 线速度 (m/s)
  centripetalAcceleration: number; // 向心加速度 (m/s²)
  centripetalForce: number;     // 向心力 (N)
  period: number;               // 周期 (s)
  angularFrequency: number;     // 角频率 (rad/s)
}

/**
 * 创建初始圆周运动状态
 *
 * @param angularVelocity - 角速度 (rad/s)
 * @param radius - 轨道半径 (米)
 * @param mass - 质量 (kg)
 * @param centerPos - 圆心位置 (默认原点)
 * @returns 初始圆周运动状态
 */
export function createInitialCircularMotion(
  angularVelocity: number,
  radius: number,
  mass: number,
  centerPos: THREE.Vector3 = new THREE.Vector3(0, 0, 0)
): CircularState {
  return {
    angle: 0,
    angularVelocity,
    radius,
    mass,
    centerPos: centerPos.clone(),
    time: 0,
  };
}

/**
 * 更新圆周运动状态
 *
 * 匀速圆周运动：角度随时间线性增加
 * 位置计算：x = center.x + r * cos(θ), y = center.y + r * sin(θ)
 *
 * @param state - 当前状态
 * @param deltaTime - 时间步长 (秒)
 * @returns 更新后的状态
 */
export function updateCircular(
  state: CircularState,
  deltaTime: number
): CircularState {
  const newAngle = state.angle + state.angularVelocity * deltaTime;
  const newTime = state.time + deltaTime;

  return {
    ...state,
    angle: newAngle,
    time: newTime,
  };
}

/**
 * 计算圆周运动物理量数据
 *
 * @param state - 圆周运动状态
 * @returns 物理量数据（速度、加速度、力、周期等）
 */
export function calculateCircularData(state: CircularState): CircularData {
  const { angularVelocity, radius, mass } = state;

  // 线速度 v = ωr
  const linearVelocity = circularVelocity(angularVelocity, radius);

  // 向心加速度 a = ω²r
  const centripetalAcceleration_val = centripetalAcceleration(angularVelocity, radius);

  // 向心力 F = mω²r
  const centripetalForce_val = centripetalForce(mass, angularVelocity, radius);

  // 周期 T = 2π/ω
  const period = (2 * Math.PI) / angularVelocity;

  // 角频率 = 角速度
  const angularFrequency = angularVelocity;

  return {
    linearVelocity,
    centripetalAcceleration: centripetalAcceleration_val,
    centripetalForce: centripetalForce_val,
    period,
    angularFrequency,
  };
}

/**
 * 计算物体当前位置
 *
 * @param state - 圆周运动状态
 * @returns 当前位置向量
 */
export function calculateCircularPosition(state: CircularState): THREE.Vector3 {
  const { angle, radius, centerPos } = state;
  return new THREE.Vector3(
    centerPos.x + radius * Math.cos(angle),
    centerPos.y + radius * Math.sin(angle),
    centerPos.z
  );
}

/**
 * 计算速度向量（切线方向）
 *
 * @param state - 圆周运动状态
 * @returns 速度向量
 */
export function calculateCircularVelocityVector(state: CircularState): THREE.Vector3 {
  const { angle, angularVelocity, radius } = state;
  const speed = angularVelocity * radius;

  // 速度方向为切线方向：垂直于半径方向
  // 如果位置向量是 (cosθ, sinθ)，则速度方向是 (-sinθ, cosθ)
  return new THREE.Vector3(
    -speed * Math.sin(angle),
    speed * Math.cos(angle),
    0
  );
}

/**
 * 计算向心加速度向量（指向圆心）
 *
 * @param state - 圆周运动状态
 * @returns 向心加速度向量
 */
export function calculateCircularAccelerationVector(state: CircularState): THREE.Vector3 {
  const { angle, angularVelocity, radius } = state;
  const acceleration = angularVelocity * angularVelocity * radius;

  // 加速度方向指向圆心：与位置向量相反
  return new THREE.Vector3(
    -acceleration * Math.cos(angle),
    -acceleration * Math.sin(angle),
    0
  );
}
