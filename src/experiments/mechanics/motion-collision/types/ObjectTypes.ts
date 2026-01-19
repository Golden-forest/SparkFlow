import * as THREE from 'three';

export type ObjectType = 'sphere' | 'box' | 'plank';

export interface PhysicsObjectConfig {
  id: string;
  type: ObjectType;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  mass: number;
  // 尺寸
  radius?: number;        // 球体半径
  width?: number;         // 盒子宽度
  height?: number;        // 盒子高度
  depth?: number;         // 盒子深度
  // 材质
  friction?: number;      // 摩擦系数
  restitution?: number;   // 恢复系数（弹性）
}

export interface SimulationObject extends PhysicsObjectConfig {
  mesh: THREE.Mesh;
  trajectory: THREE.Vector3[];
  isSelected: boolean;
  acceleration: THREE.Vector3; // 新增：加速度向量
}
