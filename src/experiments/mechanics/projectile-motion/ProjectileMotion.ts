import * as THREE from 'three';
import { ExperimentBase, type ExperimentMetadata, type ExperimentConfig, type DisplayValue } from '@/experiments/base';
import { ExperimentCategory } from '@/utils/constants';
import {
  createInitialProjectile,
  updateProjectile,
  calculateProjectileData,
  isLanded,
  type ProjectileState,
  type ProjectileData,
} from './ProjectilePhysics';

/**
 * 抛体运动实验室
 *
 * 涵盖：自由落体、竖直上抛、平抛、斜抛
 *
 * 核心功能：
 * - 可调节初速度矢量(v0x, v0y, v0z)和质量
 * - 实时监控位置、速度、加速度、能量
 * - 可视化速度/加速度矢量箭头
 * - 显示运动轨迹
 *
 * 物理模型：理想化抛体运动（忽略空气阻力）
 */
export class ProjectileMotion extends ExperimentBase {
  readonly metadata: ExperimentMetadata = {
    id: 'projectile-motion',
    name: 'Projectile Motion Laboratory',
    category: ExperimentCategory.Mechanics,
    description: 'Explore projectile motion including free fall, vertical throw, horizontal and oblique projection',
    difficulty: 'basic',
    duration: 15,
    keywords: ['projectile', 'free fall', 'motion', 'kinematics', 'energy'],
    thumbnail: '/thumbnails/projectile-motion.png',
  };

  readonly config: ExperimentConfig = {
    physics: {
      gravity: [0, 0, -9.8],
      timestep: 1 / 60,
    },
    camera: {
      position: [15, 15, 10],
      target: [0, 0, 5],
      fov: 50,
    },
    parameters: [
      {
        key: 'v0x',
        label: 'Initial Velocity X',
        type: 'number',
        defaultValue: 5,
        min: -20,
        max: 20,
        step: 0.5,
        unit: 'm/s',
      },
      {
        key: 'v0y',
        label: 'Initial Velocity Y',
        type: 'number',
        defaultValue: 0,
        min: -20,
        max: 20,
        step: 0.5,
        unit: 'm/s',
      },
      {
        key: 'v0z',
        label: 'Initial Velocity Z',
        type: 'number',
        defaultValue: 10,
        min: 0,
        max: 30,
        step: 0.5,
        unit: 'm/s',
      },
      {
        key: 'mass',
        label: 'Mass',
        type: 'number',
        defaultValue: 1,
        min: 0.1,
        max: 10,
        step: 0.1,
        unit: 'kg',
      },
      {
        key: 'showVectors',
        label: 'Show Vectors',
        type: 'boolean',
        defaultValue: true,
      },
      {
        key: 'showTrajectory',
        label: 'Show Trajectory',
        type: 'boolean',
        defaultValue: true,
      },
    ],
  };

  // 状态
  private projectileState: ProjectileState | null = null;
  private trajectoryHistory: THREE.Vector3[] = [];
  private projectileDataHistory: ProjectileData[] = [];
  private hasLanded = false;

  // 3D对象引用
  private groundPlane: THREE.Mesh | null = null;
  private gridHelper: THREE.GridHelper | null = null;
  private axesHelper: THREE.AxesHelper | null = null;
  private projectileMesh: THREE.Mesh | null = null;
  private trajectoryLine: THREE.Line | null = null;

  protected async setupScene(): Promise<void> {
    if (!this.scene) return;

    // 1. 创建地面
    this.createGround();

    // 2. 创建网格辅助线
    this.createGrid();

    // 3. 初始化抛体状态
    this.resetProjectile();
  }

  private createGround(): void {
    if (!this.scene) return;

    // 地面平面
    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1a2e,
      roughness: 0.8,
      metalness: 0.2,
    });
    this.groundPlane = new THREE.Mesh(groundGeometry, groundMaterial);
    this.groundPlane.rotation.x = -Math.PI / 2;
    this.groundPlane.position.y = 0;
    this.groundPlane.receiveShadow = true;
    this.addToScene(this.groundPlane);

    // 地面网格
    this.gridHelper = new THREE.GridHelper(100, 50, 0x444444, 0x222222);
    this.gridHelper.position.y = 0.01;
    this.addToScene(this.gridHelper);
  }

  private createGrid(): void {
    if (!this.scene) return;

    // 添加坐标轴辅助线
    this.axesHelper = new THREE.AxesHelper(5);
    this.axesHelper.position.set(0, 0.01, 0);
    this.addToScene(this.axesHelper);
  }

  private createProjectileMesh(): void {
    if (!this.scene) return;

    // 移除旧网格
    if (this.projectileMesh) {
      this.removeFromScene(this.projectileMesh);
    }

    // 创建抛体球体
    const radius = 0.5;
    const geometry = new THREE.SphereGeometry(radius, 32, 32);
    const material = new THREE.MeshStandardMaterial({
      color: 0xff6b6b,
      roughness: 0.3,
      metalness: 0.7,
    });
    this.projectileMesh = new THREE.Mesh(geometry, material);
    this.projectileMesh.castShadow = true;
    this.projectileMesh.receiveShadow = true;

    if (this.projectileState) {
      this.projectileMesh.position.copy(this.projectileState.position);
    }

    this.addToScene(this.projectileMesh);
  }

  private updateTrajectoryLine(): void {
    // Check if trajectory should be shown
    const showTrajectory = this.getParameter('showTrajectory') as boolean;
    if (!showTrajectory || this.trajectoryHistory.length < 2) {
      return;
    }

    // Reuse geometry and material, only update vertices
    if (!this.trajectoryLine) {
      const geometry = new THREE.BufferGeometry();
      const material = new THREE.LineBasicMaterial({
        color: 0x00ff00,
        transparent: true,
        opacity: 0.6,
      });
      this.trajectoryLine = new THREE.Line(geometry, material);
      this.addToScene(this.trajectoryLine);
    }

    // Update only vertex positions
    const points = this.trajectoryHistory;
    this.trajectoryLine.geometry.setFromPoints(points);
    this.trajectoryLine.geometry.attributes.position.needsUpdate = true;
  }

  private resetProjectile(): void {
    const v0x = this.getParameter('v0x') as number;
    const v0y = this.getParameter('v0y') as number;
    const v0z = this.getParameter('v0z') as number;
    const mass = this.getParameter('mass') as number;

    this.projectileState = createInitialProjectile(
      new THREE.Vector3(v0x, v0y, v0z),
      mass,
      new THREE.Vector3(0, 0, 0.5) // 从地面以上0.5米开始
    );

    this.trajectoryHistory = [this.projectileState.position.clone()];
    this.projectileDataHistory = [calculateProjectileData(this.projectileState)];
    this.hasLanded = false;

    // 创建或更新抛体网格
    this.createProjectileMesh();

    // 清除旧轨迹线
    if (this.trajectoryLine) {
      this.removeFromScene(this.trajectoryLine);
      this.trajectoryLine = null;
    }
  }

  private get showVectors(): boolean {
    return this.getParameter('showVectors') as boolean;
  }

  private get showTrajectory(): boolean {
    return this.getParameter('showTrajectory') as boolean;
  }

  protected onStart(): void {
    this.resetProjectile();
  }

  protected onReset(): void {
    this.resetProjectile();
  }

  protected onParameterChange(key: string, value: number | string | boolean): void {
    if (['v0x', 'v0y', 'v0z', 'mass'].includes(key)) {
      // 参数变化时重置实验
      this.resetProjectile();
    } else if (key === 'showVectors' || key === 'showTrajectory') {
      // 更新可视化选项
      if (key === 'showTrajectory') {
        this.updateTrajectoryLine();
      }
    }
  }

  update(deltaTime: number): void {
    if (!this.isRunning || !this.projectileState || this.hasLanded) return;

    // 更新物理状态
    this.projectileState = updateProjectile(this.projectileState, deltaTime);

    // 记录轨迹
    this.trajectoryHistory.push(this.projectileState.position.clone());
    this.projectileDataHistory.push(calculateProjectileData(this.projectileState));

    // 更新3D对象位置
    if (this.projectileMesh) {
      this.projectileMesh.position.copy(this.projectileState.position);
    }

    // 更新轨迹线
    if (this.showTrajectory) {
      this.updateTrajectoryLine();
    }

    // 检查是否落地
    if (isLanded(this.projectileState, 0)) {
      this.hasLanded = true;
      // 修正位置到地面
      this.projectileState.position.z = 0.5;
      this.projectileState.velocity.set(0, 0, 0);
      if (this.projectileMesh) {
        this.projectileMesh.position.copy(this.projectileState.position);
      }
    }
  }

  getDisplayData(): Record<string, DisplayValue> {
    if (!this.projectileState) {
      return {};
    }

    const data = calculateProjectileData(this.projectileState);

    return {
      time: {
        label: 'Time',
        value: this.projectileState.time.toFixed(2),
        unit: 's',
      },
      position: {
        label: 'Position',
        value: `(${this.projectileState.position.x.toFixed(1)}, ${this.projectileState.position.y.toFixed(1)}, ${this.projectileState.position.z.toFixed(1)})`,
        unit: 'm',
      },
      velocity: {
        label: 'Velocity',
        value: this.projectileState.velocity.length().toFixed(2),
        unit: 'm/s',
      },
      acceleration: {
        label: 'Acceleration',
        value: this.projectileState.acceleration.length().toFixed(2),
        unit: 'm/s²',
      },
      kineticEnergy: {
        label: 'Kinetic Energy',
        value: data.kineticEnergy.toFixed(2),
        unit: 'J',
      },
      potentialEnergy: {
        label: 'Potential Energy',
        value: data.potentialEnergy.toFixed(2),
        unit: 'J',
      },
      mechanicalEnergy: {
        label: 'Mechanical Energy',
        value: data.mechanicalEnergy.toFixed(2),
        unit: 'J',
      },
    };
  }

  dispose(): void {
    // 清理资源
    this.trajectoryHistory = [];
    this.projectileDataHistory = [];

    // 清理轨迹线
    if (this.trajectoryLine) {
      this.removeFromScene(this.trajectoryLine);
      // Properly dispose geometry and material to prevent memory leaks
      this.trajectoryLine.geometry.dispose();
      if (this.trajectoryLine.material instanceof THREE.Material) {
        this.trajectoryLine.material.dispose();
      }
      this.trajectoryLine = null;
    }

    super.dispose();
  }
}
