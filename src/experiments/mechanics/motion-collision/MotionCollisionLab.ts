import * as THREE from 'three';
import { ExperimentBase, type ExperimentMetadata, type ExperimentConfig, type DisplayValue } from '@/experiments/base';
import { ExperimentCategory, EARTH_GRAVITY } from '@/utils/constants';
import { PhysicsObjectFactory } from './objects/PhysicsObject';
import { RampFactory } from './objects/Ramp';
import type { SimulationObject, ObjectType } from './types/ObjectTypes';
import type { RampConfig, SimulationRamp } from './types/RampTypes';

/**
 * 运动与碰撞实验室
 *
 * 统一的力学实验平台，支持：
 * - 多种物体类型（球体、滑块、木板）
 * - 自由运动、重力、碰撞检测
 * - 轨迹追踪和可视化
 * - 实时物理监控
 */
export class MotionCollisionLab extends ExperimentBase {
  readonly metadata: ExperimentMetadata = {
    id: 'motion-collision',
    name: 'Motion & Collision Laboratory',
    category: ExperimentCategory.Mechanics,
    description: 'Unified physics lab for objects motion, trajectories, gravity, and collision detection',
    difficulty: 'intermediate',
    duration: 25,
    keywords: ['motion', 'collision', 'trajectory', 'gravity', 'kinematics'],
    thumbnail: '/thumbnails/motion-collision.png',
  };

  readonly config: ExperimentConfig = {
    physics: {
      gravity: [0, -9.8, 0],
      timestep: 1 / 60,
    },
    camera: {
      position: [5, 5, 10],
      target: [0, 0, 0],
      fov: 50,
    },
    parameters: [
      {
        key: 'showTrajectory',
        label: 'Show Trajectory',
        type: 'boolean',
        defaultValue: true,
      },
    ],
  };

  // 对象管理
  private simulationObjects: Map<string, SimulationObject> = new Map();
  private nextObjectId = 1;
  private simulationTime = 0;

  // 斜面管理
  private ramps: Map<string, SimulationRamp> = new Map();

  /**
   * 创建物体
   */
  createObject(config: Omit<SimulationObject, 'mesh' | 'trajectory' | 'isSelected'>): SimulationObject {
    const mesh = PhysicsObjectFactory.create(config);

    return {
      ...config,
      mesh,
      trajectory: [],
      isSelected: false,
    };
  }

  /**
   * 添加默认球体
   */
  private addDefaultSphere(): void {
    const sphere = this.createObject({
      id: `sphere-${this.nextObjectId++}`,
      type: 'sphere',
      position: new THREE.Vector3(0, 1, 0),
      velocity: new THREE.Vector3(0, 0, 0),
      mass: 1.0,
      radius: 0.5,
    });
    this.simulationObjects.set(sphere.id, sphere);
    this.addToScene(sphere.mesh);
  }

  /**
   * 移除对象
   * 正确清理网格、几何体和材质
   */
  removeObject(objectId: string): boolean {
    const obj = this.simulationObjects.get(objectId);
    if (!obj) return false;

    // 从场景中移除
    if (obj.mesh) {
      this.removeFromScene(obj.mesh);

      // 清理几何体
      if (obj.mesh.geometry) {
        obj.mesh.geometry.dispose();
      }

      // 清理材质（支持材质数组）
      if (Array.isArray(obj.mesh.material)) {
        obj.mesh.material.forEach(material => material.dispose());
      } else {
        obj.mesh.material.dispose();
      }
    }

    // 从映射中移除
    this.simulationObjects.delete(objectId);

    return true;
  }

  /**
   * 添加斜面
   */
  addRamp(config: RampConfig): void {
    const ramp = RampFactory.create(config);
    this.ramps.set(config.id, { ...config, mesh: ramp });
    this.addToScene(ramp);
  }

  /**
   * 移除斜面
   */
  removeRamp(id: string): void {
    const ramp = this.ramps.get(id);
    if (ramp) {
      this.removeFromScene(ramp.mesh);
      ramp.mesh.geometry.dispose();
      (ramp.mesh.material as THREE.Material).dispose();
      this.ramps.delete(id);
    }
  }

  /**
   * 设置场景
   */
  protected async setupScene(): Promise<void> {
    if (!this.scene) return;

    // 创建地面
    this.createGround();

    // 添加默认球体
    this.addDefaultSphere();

    // 设置灯光
    this.setupLights();
  }

  /**
   * 创建地面
   */
  private createGround(): void {
    if (!this.scene) return;

    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1a2e,
      roughness: 0.9,
      metalness: 0.1,
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    this.addToScene(ground);
  }

  /**
   * 设置灯光
   */
  private setupLights(): void {
    if (!this.scene) return;

    // 环境光
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.addToScene(ambientLight);

    // 主光源（产生阴影）
    const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
    mainLight.position.set(10, 20, 10);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    this.addToScene(mainLight);
  }

  /**
   * 开始实验
   */
  protected onStart(): void {
    this.simulationTime = 0;
  }

  /**
   * 重置实验
   */
  protected onReset(): void {
    this.simulationTime = 0;
    // 清除所有轨迹
    this.simulationObjects.forEach(obj => {
      obj.trajectory = [];
      obj.velocity.set(0, 0, 0);
    });
  }

  /**
   * 每帧更新
   */
  update(deltaTime: number): void {
    if (!this.isRunning) return;

    // 更新物理（位置、重力）
    this.updatePhysics(deltaTime);

    // 更新时间
    this.simulationTime += deltaTime;
  }

  /**
   * 更新物理状态 - 正确的欧拉积分顺序
   * 1. 应用重力加速度 → 更新速度
   * 2. 使用新速度 → 更新位置
   * 3. 检测碰撞 → 修正位置和速度
   */
  private updatePhysics(deltaTime: number): void {
    this.simulationObjects.forEach(obj => {
      // 步骤1: 应用重力加速度更新速度
      obj.velocity.y -= EARTH_GRAVITY * deltaTime;

      // 步骤2: 使用新速度更新位置
      const displacement = obj.velocity.clone().multiplyScalar(deltaTime);
      obj.mesh.position.add(displacement);
      obj.position.copy(obj.mesh.position);

      // 步骤3: 地面碰撞检测和响应
      this.handleGroundCollision(obj);
    });
  }

  /**
   * 处理地面碰撞
   * 正确处理不同物体类型的碰撞边界
   */
  private handleGroundCollision(obj: SimulationObject): void {
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
    if (obj.mesh.position.y - collisionBoundary <= 0) {
      // 修正位置，防止穿地
      obj.mesh.position.y = collisionBoundary;
      obj.position.y = collisionBoundary;

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
  }

  /**
   * 获取显示数据
   */
  getDisplayData(): Record<string, DisplayValue> {
    const data: Record<string, DisplayValue> = {
      time: {
        label: 'Time',
        value: this.simulationTime.toFixed(2),
        unit: 's',
      },
      objectCount: {
        label: 'Objects',
        value: this.simulationObjects.size.toString(),
      },
    };

    // 显示第一个对象的数据
    const firstObject = Array.from(this.simulationObjects.values())[0];
    if (firstObject) {
      data.velocity = {
        label: 'Velocity',
        value: firstObject.velocity.length().toFixed(2),
        unit: 'm/s',
      };
      data.position = {
        label: 'Position',
        value: `(${firstObject.position.x.toFixed(1)}, ${firstObject.position.y.toFixed(1)}, ${firstObject.position.z.toFixed(1)})`,
        unit: 'm',
      };
    }

    return data;
  }

  /**
   * 销毁实验
   */
  dispose(): void {
    // 清理所有仿真对象
    this.simulationObjects.forEach(obj => {
      if (obj.mesh) {
        this.removeFromScene(obj.mesh);

        // 清理几何体
        if (obj.mesh.geometry) {
          obj.mesh.geometry.dispose();
        }

        // 清理材质（支持材质数组）
        if (Array.isArray(obj.mesh.material)) {
          obj.mesh.material.forEach(material => material.dispose());
        } else {
          obj.mesh.material.dispose();
        }
      }
    });
    this.simulationObjects.clear();

    // 清理所有斜面
    this.ramps.forEach(ramp => {
      this.removeFromScene(ramp.mesh);
      ramp.mesh.geometry.dispose();
      (ramp.mesh.material as THREE.Material).dispose();
    });
    this.ramps.clear();

    // 清理 PhysicsObjectFactory 的共享材质
    PhysicsObjectFactory.dispose();

    super.dispose();
  }
}
