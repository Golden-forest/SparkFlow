import * as THREE from 'three';
import { ExperimentBase, type ExperimentMetadata, type ExperimentConfig, type DisplayValue } from '@/experiments/base';
import { ExperimentCategory } from '@/utils/constants';
import { PhysicsObjectFactory } from './objects/PhysicsObject';
import { RampFactory } from './objects/Ramp';
import { PhysicsEngine } from './physics/PhysicsEngine';
import { TrajectoryManager } from './components/TrajectoryManager';
import type { SimulationObject } from './types/ObjectTypes';
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

  // 轨迹管理
  private trajectoryLines: Map<string, THREE.Line> = new Map();
  private trajectoryRecordTimes: Map<string, number> = new Map();
  private showTrajectory = true; // 参数控制

  // 斜面管理
  private ramps: Map<string, SimulationRamp> = new Map();

  /**
   * 创建物体
   */
  createObject(config: Omit<SimulationObject, 'mesh' | 'trajectory' | 'isSelected' | 'acceleration'>): SimulationObject {
    const mesh = PhysicsObjectFactory.create(config);

    return {
      ...config,
      mesh,
      trajectory: [],
      isSelected: false,
      acceleration: new THREE.Vector3(0, -9.8, 0), // 新增：初始化为重力加速度
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

    // 移除轨迹线
    const line = this.trajectoryLines.get(objectId);
    if (line) {
      this.removeFromScene(line);
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
      this.trajectoryLines.delete(objectId);
    }

    // 清除轨迹记录时间
    this.trajectoryRecordTimes.delete(objectId);

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
   * 获取所有仿真对象 (Task 4.2: IExperiment接口实现)
   */
  getSimulationObjects(): Map<string, SimulationObject> {
    return this.simulationObjects;
  }

  /**
   * 加载场景预设 (Task 7.2)
   */
  loadScenePreset(objects: Omit<SimulationObject, 'mesh' | 'trajectory' | 'isSelected' | 'acceleration'>[]): void {
    // 清除所有现有对象
    const objectIds = Array.from(this.simulationObjects.keys());
    objectIds.forEach(id => this.removeObject(id));

    // 清除所有轨迹线
    this.trajectoryLines.forEach(line => {
      this.removeFromScene(line);
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    });
    this.trajectoryLines.clear();

    // 创建新对象
    objects.forEach(config => {
      const obj = this.createObject(config);
      this.simulationObjects.set(obj.id, obj);
      if (obj.mesh) {
        this.addToScene(obj.mesh);
      }
    });

    // 重置时间
    this.simulationTime = 0;
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
      TrajectoryManager.clearTrajectory(obj);
      obj.velocity.set(0, 0, 0);
    });

    // 清除所有轨迹线的几何体
    this.trajectoryLines.forEach(line => {
      line.geometry.setFromPoints([]);
    });

    // 清除轨迹记录时间
    this.trajectoryRecordTimes.clear();
  }

  /**
   * 每帧更新
   */
  update(deltaTime: number): void {
    if (!this.isRunning) return;

    // 更新位置
    PhysicsEngine.updatePositions(this.simulationObjects, deltaTime);

    // 地面碰撞检测
    PhysicsEngine.detectGroundCollision(this.simulationObjects);

    // 物体间碰撞检测
    const collisions = PhysicsEngine.detectObjectCollisions(this.simulationObjects);
    collisions.forEach((targets, id) => {
      const obj1 = this.simulationObjects.get(id)!;
      targets.forEach(targetId => {
        const obj2 = this.simulationObjects.get(targetId)!;
        PhysicsEngine.resolveCollision(obj1, obj2, deltaTime);
      });
    });

    // 更新轨迹
    this.updateTrajectories();

    // 更新时间
    this.simulationTime += deltaTime;
  }

  /**
   * 更新轨迹
   */
  private updateTrajectories(): void {
    this.simulationObjects.forEach((obj, id) => {
      // 获取该对象的上次记录时间，如果没有则使用0
      const lastRecordTime = this.trajectoryRecordTimes.get(id) || 0;

      // 更新轨迹数据，并获取新的记录时间
      const newRecordTime = TrajectoryManager.updateTrajectory(
        obj,
        this.simulationTime,
        this.showTrajectory,
        lastRecordTime
      );

      // 存储新的记录时间
      this.trajectoryRecordTimes.set(id, newRecordTime);

      // 获取或创建轨迹线
      let line = this.trajectoryLines.get(id);
      if (!line) {
        line = TrajectoryManager.createTrajectoryLine(
          obj.type === 'sphere' ? 0x00ff41 : 0x60a5fa
        );
        this.trajectoryLines.set(id, line);
        this.addToScene(line);
      }

      // 更新轨迹线
      TrajectoryManager.updateTrajectoryGeometry(line, obj.trajectory);

      // 根据showTrajectory参数控制可见性
      line.visible = this.showTrajectory && obj.trajectory.length >= 2;
    });
  }

  /**
   * 设置参数
   */
  setParameter(key: string, value: unknown): void {
    switch (key) {
      case 'showTrajectory':
        this.showTrajectory = value as boolean;
        // 更新所有轨迹线的可见性
        this.trajectoryLines.forEach(line => {
          line.visible = this.showTrajectory;
        });
        break;
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
      const v = firstObject.velocity.length();
      const m = firstObject.mass;

      data.velocity = {
        label: 'Velocity',
        value: v.toFixed(2),
        unit: 'm/s',
      };
      data.position = {
        label: 'Position',
        value: `(${firstObject.position.x.toFixed(1)}, ${firstObject.position.y.toFixed(1)}, ${firstObject.position.z.toFixed(1)})`,
        unit: 'm',
      };

      // 新增：加速度
      data.acceleration = {
        label: 'Acceleration',
        value: firstObject.acceleration.length().toFixed(2),
        unit: 'm/s²',
      };

      // 新增：动量 p = mv
      data.momentum = {
        label: 'Momentum',
        value: (m * v).toFixed(2),
        unit: 'kg·m/s',
      };

      // 新增：动能 Ek = ½mv²
      data.kineticEnergy = {
        label: 'Kinetic Energy',
        value: (0.5 * m * v * v).toFixed(2),
        unit: 'J',
      };
    }

    return data;
  }

  getMonitorSchema() {
    return {
      title: 'Monitor',
      quantities: [
        { key: 'velocity', label: 'Velocity', unit: 'm/s', color: '#22d3ee' },
        { key: 'acceleration', label: 'Acceleration', unit: 'm/s2', color: '#f59e0b' },
        { key: 'momentum', label: 'Momentum', unit: 'kg*m/s', color: '#34d399' },
        { key: 'kineticEnergy', label: 'Kinetic Energy', unit: 'J', color: '#a78bfa' },
      ],
      defaultSelected: ['velocity', 'momentum', 'kineticEnergy'],
      sampleIntervalMs: 100,
    };
  }

  /**
   * 销毁实验
   */
  dispose(): void {
    // 清理所有轨迹线
    this.trajectoryLines.forEach(line => {
      this.removeFromScene(line);
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    });
    this.trajectoryLines.clear();

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
