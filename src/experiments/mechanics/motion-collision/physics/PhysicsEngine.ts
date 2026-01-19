import * as THREE from 'three';
import type { SimulationObject } from '../types/ObjectTypes';
import { EARTH_GRAVITY } from '@/utils/constants';

/**
 * 物理引擎 - 处理运动更新和碰撞检测
 */
export class PhysicsEngine {
  /**
   * 更新物体位置（正确的欧拉积分顺序）
   * 1. 应用重力加速度 → 更新速度
   * 2. 使用新速度 → 更新位置
   */
  static updatePositions(
    objects: Map<string, SimulationObject>,
    deltaTime: number
  ): void {
    objects.forEach(obj => {
      // 初始化加速度（重力加速度）
      obj.acceleration.set(0, -EARTH_GRAVITY, 0);

      // 步骤1: 应用重力加速度更新速度
      obj.velocity.y -= EARTH_GRAVITY * deltaTime;

      // 步骤2: 使用新速度更新位置
      const displacement = obj.velocity.clone().multiplyScalar(deltaTime);
      obj.mesh.position.add(displacement);
      obj.position.copy(obj.mesh.position);
    });
  }

  /**
   * 检测地面碰撞
   * 正确处理不同物体类型的碰撞边界
   */
  static detectGroundCollision(
    objects: Map<string, SimulationObject>,
    groundY: number = 0
  ): void {
    objects.forEach(obj => {
      // 根据物体类型确定碰撞边界
      let collisionBoundary: number;

      if (obj.type === 'sphere' && obj.radius !== undefined) {
        // 球体使用半径
        collisionBoundary = obj.radius;
      } else if (obj.type === 'box' || obj.type === 'plank') {
        // 盒子和木板使用高度的一半
        collisionBoundary = (obj.height || 1) / 2;
      } else {
        // 默认边界
        collisionBoundary = 0.5;
      }

      // 检测是否与地面碰撞
      if (obj.mesh.position.y - collisionBoundary <= groundY) {
        // 修正位置，防止穿地
        obj.mesh.position.y = groundY + collisionBoundary;
        obj.position.y = groundY + collisionBoundary;

        // 速度响应：反弹（非完全弹性碰撞）
        if (obj.velocity.y < 0) {
          const restitution = obj.restitution || 0.8; // 恢复系数
          obj.velocity.y *= -restitution;

          // 地面摩擦力
          const friction = obj.friction || 0.98;
          obj.velocity.x *= friction;
          obj.velocity.z *= friction;

          // 防止微小抖动：速度过小时直接归零
          if (Math.abs(obj.velocity.y) < 0.1) {
            obj.velocity.y = 0;
          }
        }
      }
    });
  }

  /**
   * 检测物体间碰撞
   */
  static detectObjectCollisions(
    objects: Map<string, SimulationObject>
  ): Map<string, Set<string>> {
    const collisions = new Map<string, Set<string>>();
    const objectArray = Array.from(objects.values());

    for (let i = 0; i < objectArray.length; i++) {
      for (let j = i + 1; j < objectArray.length; j++) {
        const obj1 = objectArray[i];
        const obj2 = objectArray[j];

        if (this.checkCollision(obj1, obj2)) {
          if (!collisions.has(obj1.id)) {
            collisions.set(obj1.id, new Set());
          }
          collisions.get(obj1.id)!.add(obj2.id);
        }
      }
    }

    return collisions;
  }

  /**
   * 检测两个物体是否碰撞
   * 使用距离检测，盒子用球体近似
   */
  private static checkCollision(
    obj1: SimulationObject,
    obj2: SimulationObject
  ): boolean {
    const dist = obj1.mesh.position.distanceTo(obj2.mesh.position);
    const minDist = (obj1.radius || 1) + (obj2.radius || 1);
    return dist <= minDist;
  }

  /**
   * 处理弹性碰撞
   * 包含位置修正，防止物体重叠
   * 步骤3: 更新加速度（碰撞产生瞬时加速度）
   */
  static resolveCollision(
    obj1: SimulationObject,
    obj2: SimulationObject,
    deltaTime: number
  ): void {
    const m1 = obj1.mass;
    const m2 = obj2.mass;
    const v1 = obj1.velocity;
    const v2 = obj2.velocity;
    const pos1 = obj1.mesh.position;
    const pos2 = obj2.mesh.position;

    // 计算碰撞法线（从obj1指向obj2）
    const normal = pos2.clone().sub(pos1).normalize();

    // 获取物体半径（盒子使用球体近似）
    const r1 = obj1.radius || 1;
    const r2 = obj2.radius || 1;

    // 计算重叠距离
    const distance = pos1.distanceTo(pos2);
    const overlap = r1 + r2 - distance;

    // 步骤1: 位置修正 - 将物体移开，避免重叠
    if (overlap > 0) {
      // 根据质量比例分配修正量
      const totalMass = m1 + m2;
      const ratio1 = m2 / totalMass; // 质量越大，移动越少
      const ratio2 = m1 / totalMass;

      // 沿碰撞法线移动物体
      const correction1 = normal.clone().multiplyScalar(-overlap * ratio1);
      const correction2 = normal.clone().multiplyScalar(overlap * ratio2);

      pos1.add(correction1);
      pos2.add(correction2);

      // 同步更新position属性
      obj1.position.copy(pos1);
      obj2.position.copy(pos2);
    }

    // 步骤2: 速度更新 - 弹性碰撞
    // 计算相对速度
    const relativeVelocity = v1.clone().sub(v2);

    // 计算沿碰撞法线的速度分量
    const velocityAlongNormal = relativeVelocity.dot(normal);

    // 如果物体正在分离，则不需要处理
    if (velocityAlongNormal > 0) {
      return;
    }

    // 保存初始速度（用于计算加速度）
    const v1Initial = v1.clone();
    const v2Initial = v2.clone();

    // 一维弹性碰撞公式（沿法线方向）
    const v1Final = v1.clone().multiplyScalar((m1 - m2) / (m1 + m2))
      .add(v2.clone().multiplyScalar(2 * m2 / (m1 + m2)));
    const v2Final = v2.clone().multiplyScalar((m2 - m1) / (m1 + m2))
      .add(v1.clone().multiplyScalar(2 * m1 / (m1 + m2)));

    obj1.velocity.copy(v1Final);
    obj2.velocity.copy(v2Final);

    // 步骤3: 更新加速度（碰撞产生瞬时加速度）
    // 加速度 = 速度变化 / 时间
    const deltaV1 = v1Final.clone().sub(v1Initial).divideScalar(deltaTime);
    const deltaV2 = v2Final.clone().sub(v2Initial).divideScalar(deltaTime);

    obj1.acceleration.copy(deltaV1);
    obj2.acceleration.copy(deltaV2);
  }
}
