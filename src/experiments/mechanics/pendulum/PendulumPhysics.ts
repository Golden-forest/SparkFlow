import * as THREE from 'three';
import { EARTH_GRAVITY } from '@/utils/constants';

/**
 * 单摆状态接口
 */
export interface PendulumState {
  angle: number;           // 角度（弧度）
  angularVelocity: number; // 角速度（rad/s）
  length: number;          // 摆长（m）
  mass: number;            // 质量（kg）
  time: number;            // 时间（s）
}

/**
 * 单摆数据接口
 */
export interface PendulumData {
  period: number;          // 周期（s）
  frequency: number;       // 频率（Hz）
  angularFrequency: number;// 角频率（rad/s）
  velocity: number;        // 线速度（m/s）
  kineticEnergy: number;   // 动能（J）
  potentialEnergy: number; // 势能（J）
  mechanicalEnergy: number;// 机械能（J）
}

/**
 * 创建初始单摆状态
 *
 * @param length - 摆长（米）
 * @param mass - 摆球质量（千克）
 * @param initialAngle - 初始角度（弧度），默认30度（π/6）
 * @returns 单摆状态对象
 */
export function createInitialPendulum(
  length: number,
  mass: number,
  initialAngle: number = Math.PI / 6 // 默认30度
): PendulumState {
  return {
    angle: initialAngle,
    angularVelocity: 0,
    length,
    mass,
    time: 0,
  };
}

/**
 * 更新单摆状态（小角度近似）
 *
 * 使用简谐运动模型：θ'' = -(g/L)θ
 * 解析解：θ(t) = θ₀·cos(ωt)，其中 ω = √(g/L)
 *
 * @param state - 当前单摆状态
 * @param deltaTime - 时间步长（秒）
 * @returns 更新后的单摆状态
 */
export function updatePendulum(
  state: PendulumState,
  deltaTime: number
): PendulumState {
  // 角频率：ω = √(g/L)
  const angularFrequency = Math.sqrt(EARTH_GRAVITY / state.length);

  // 简谐运动：θ(t) = θ₀·cos(ωt)
  // 角速度：ω(t) = -θ₀·ω·sin(ωt)
  const newAngle = state.angle * Math.cos(angularFrequency * deltaTime);
  const newAngularVelocity = -state.angle * angularFrequency * Math.sin(angularFrequency * deltaTime);

  return {
    ...state,
    angle: newAngle,
    angularVelocity: newAngularVelocity,
    time: state.time + deltaTime,
  };
}

/**
 * 计算单摆物理数据
 *
 * @param state - 单摆状态
 * @returns 包含周期、频率、能量等物理量
 */
export function calculatePendulumData(state: PendulumState): PendulumData {
  // 角频率：ω = √(g/L)
  const angularFrequency = Math.sqrt(EARTH_GRAVITY / state.length);

  // 周期：T = 2π√(L/g)
  const period = 2 * Math.PI * Math.sqrt(state.length / EARTH_GRAVITY);

  // 频率：f = 1/T
  const frequency = 1 / period;

  // 线速度：v = ω·L（切向速度）
  const velocity = Math.abs(state.angularVelocity * state.length);

  // 高度（相对于最低点）：h = L(1 - cosθ)
  const height = state.length * (1 - Math.cos(state.angle));

  // 势能：Ep = mgh
  const potentialEnergy = state.mass * EARTH_GRAVITY * height;

  // 动能：Ek = (1/2)mv²
  const kineticEnergy = 0.5 * state.mass * velocity * velocity;

  // 机械能：E = Ek + Ep
  const mechanicalEnergy = potentialEnergy + kineticEnergy;

  return {
    period,
    frequency,
    angularFrequency,
    velocity,
    kineticEnergy,
    potentialEnergy,
    mechanicalEnergy,
  };
}

/**
 * 计算摆球位置
 *
 * 以悬挂点为原点，摆球在XY平面内运动
 * x = L·sinθ
 * y = -L·cosθ（向下为负）
 *
 * @param state - 单摆状态
 * @returns 摆球的三维位置向量
 */
export function calculatePendulumPosition(state: PendulumState): THREE.Vector3 {
  const x = state.length * Math.sin(state.angle);
  const y = -state.length * Math.cos(state.angle);
  return new THREE.Vector3(x, y, 0);
}
