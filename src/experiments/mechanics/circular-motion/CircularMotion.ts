import * as THREE from 'three';
import { ExperimentBase, type ExperimentMetadata, type ExperimentConfig, type DisplayValue } from '@/experiments/base';
import { ExperimentCategory } from '@/utils/constants';
import {
  createInitialCircularMotion,
  updateCircular,
  calculateCircularData,
  calculateCircularPosition,
  calculateCircularVelocityVector,
  calculateCircularAccelerationVector,
  type CircularState,
  type CircularData,
} from './CircularPhysics';

/**
 * 圆周运动实验室
 *
 * 涵盖：匀速圆周运动、向心力、角速度、线速度
 *
 * 核心功能：
 * - 可调节角速度、半径和质量
 * - 实时监控角度、角速度、线速度、向心加速度、向心力
 * - 可视化速度/向心力矢量箭头
 * - 显示运动轨迹
 *
 * 物理模型：理想化匀速圆周运动（忽略摩擦和阻力）
 */
export class CircularMotion extends ExperimentBase {
  readonly metadata: ExperimentMetadata = {
    id: 'circular-motion',
    name: 'Circular Motion Simulator',
    category: ExperimentCategory.Mechanics,
    description: 'Explore uniform circular motion, centripetal force, angular velocity, and the relationship between linear and angular quantities',
    difficulty: 'basic',
    duration: 15,
    keywords: ['circular', 'motion', 'centripetal', 'force', 'angular', 'velocity'],
    thumbnail: '/thumbnails/circular-motion.png',
  };

  readonly config: ExperimentConfig = {
    physics: {
      timestep: 1 / 60,
    },
    camera: {
      position: [0, 0, 20],
      target: [0, 0, 0],
      fov: 50,
    },
    parameters: [
      {
        key: 'angularVelocity',
        label: 'Angular Velocity',
        type: 'number',
        defaultValue: 2.0,
        min: 0.1,
        max: 10,
        step: 0.1,
        unit: 'rad/s',
      },
      {
        key: 'radius',
        label: 'Radius',
        type: 'number',
        defaultValue: 5.0,
        min: 1,
        max: 15,
        step: 0.5,
        unit: 'm',
      },
      {
        key: 'mass',
        label: 'Mass',
        type: 'number',
        defaultValue: 1.0,
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
        key: 'showTrail',
        label: 'Show Trail',
        type: 'boolean',
        defaultValue: true,
      },
    ],
  };

  // 状态
  private circularState: CircularState | null = null;
  private circularDataHistory: CircularData[] = [];
  private trailHistory: THREE.Vector3[] = [];
  private lastTrailTime = 0;
  private readonly TRAIL_INTERVAL = 0.05; // 每50ms记录一次
  private readonly maxTrailPoints = 200;

  // 向量箭头缩放因子
  private readonly VELOCITY_SCALE = 0.5;  // 速度箭头缩放因子
  private readonly FORCE_SCALE = 0.2;     // 力箭头缩放因子

  // 3D对象引用
  private groundPlane: THREE.Mesh | null = null;
  private gridHelper: THREE.GridHelper | null = null;
  private axesHelper: THREE.AxesHelper | null = null;
  private centerMarker: THREE.Mesh | null = null;
  private circularObject: THREE.Mesh | null = null;
  private orbitPath: THREE.Line | null = null;
  private velocityArrow: THREE.ArrowHelper | null = null;
  private forceArrow: THREE.ArrowHelper | null = null;
  private trailLine: THREE.Line | null = null;

  protected async setupScene(): Promise<void> {
    if (!this.scene) return;

    // 1. 创建地面
    this.createGround();

    // 2. 创建网格辅助线
    this.createGrid();

    // 3. 初始化圆周运动
    this.resetCircularMotion();
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
    this.groundPlane.position.z = -0.1;
    this.groundPlane.receiveShadow = true;
    this.addToScene(this.groundPlane);

    // 地面网格
    this.gridHelper = new THREE.GridHelper(100, 50, 0x444444, 0x222222);
    this.gridHelper.position.z = 0;
    this.addToScene(this.gridHelper);
  }

  private createGrid(): void {
    if (!this.scene) return;

    // 添加坐标轴辅助线
    this.axesHelper = new THREE.AxesHelper(5);
    this.axesHelper.position.set(0, 0, 0);
    this.addToScene(this.axesHelper);
  }

  private createCenterMarker(): void {
    if (!this.scene) return;

    // 移除旧标记
    if (this.centerMarker) {
      this.removeFromScene(this.centerMarker);
    }

    // 创建中心点标记（小球）
    const geometry = new THREE.SphereGeometry(0.3, 32, 32);
    const material = new THREE.MeshStandardMaterial({
      color: 0x666666,
      roughness: 0.5,
      metalness: 0.5,
    });
    this.centerMarker = new THREE.Mesh(geometry, material);
    this.centerMarker.position.set(0, 0, 0);
    this.centerMarker.castShadow = true;
    this.addToScene(this.centerMarker);
  }

  private createCircularObject(): void {
    if (!this.scene) return;

    // 移除旧网格
    if (this.circularObject) {
      this.removeFromScene(this.circularObject);
    }

    // 创建运动物体（球体）
    const radius = 0.5;
    const geometry = new THREE.SphereGeometry(radius, 32, 32);
    const material = new THREE.MeshStandardMaterial({
      color: 0x4ecdc4,
      roughness: 0.3,
      metalness: 0.7,
    });
    this.circularObject = new THREE.Mesh(geometry, material);
    this.circularObject.castShadow = true;
    this.circularObject.receiveShadow = true;

    if (this.circularState) {
      const position = calculateCircularPosition(this.circularState);
      this.circularObject.position.copy(position);
    }

    this.addToScene(this.circularObject);
  }

  private createOrbitPath(): void {
    if (!this.scene || !this.circularState) return;

    // 移除旧轨道
    if (this.orbitPath) {
      this.removeFromScene(this.orbitPath);
      this.orbitPath.geometry.dispose();
      if (this.orbitPath.material instanceof THREE.Material) {
        this.orbitPath.material.dispose();
      }
    }

    // 创建圆形轨道
    const { radius } = this.circularState;
    const segments = 128;
    const points: THREE.Vector3[] = [];

    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * 2 * Math.PI;
      points.push(
        new THREE.Vector3(
          radius * Math.cos(angle),
          radius * Math.sin(angle),
          0
        )
      );
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: 0x4444ff,
      transparent: true,
      opacity: 0.3,
    });
    this.orbitPath = new THREE.Line(geometry, material);
    this.addToScene(this.orbitPath);
  }

  private createVectorArrows(): void {
    if (!this.scene || !this.circularState) return;

    // 移除旧箭头
    if (this.velocityArrow) {
      this.removeFromScene(this.velocityArrow);
    }
    if (this.forceArrow) {
      this.removeFromScene(this.forceArrow);
    }

    const position = calculateCircularPosition(this.circularState);
    const velocityVector = calculateCircularVelocityVector(this.circularState);
    const accelerationVector = calculateCircularAccelerationVector(this.circularState);

    // 速度箭头（绿色，切线方向）
    const velocityLength = velocityVector.length();
    const velocityDir = velocityVector.clone().normalize();
    this.velocityArrow = new THREE.ArrowHelper(
      velocityDir,
      position,
      velocityLength * this.VELOCITY_SCALE,
      0x00ff00,
      0.5, // 箭头长度
      0.3  // 箭头宽度
    );
    this.addToScene(this.velocityArrow);

    // 向心力箭头（红色，指向圆心）
    const forceLength = accelerationVector.length();
    const forceDir = accelerationVector.clone().normalize();
    this.forceArrow = new THREE.ArrowHelper(
      forceDir,
      position,
      forceLength * this.FORCE_SCALE,
      0xff0000,
      0.5,
      0.3
    );
    this.addToScene(this.forceArrow);
  }

  private updateTrailLine(): void {
    const showTrail = this.getParameter('showTrail') as boolean;
    if (!showTrail || this.trailHistory.length < 2) {
      return;
    }

    // Reuse geometry and material, only update vertices
    if (!this.trailLine) {
      const geometry = new THREE.BufferGeometry();
      const material = new THREE.LineBasicMaterial({
        color: 0xffd700,
        transparent: true,
        opacity: 0.6,
      });
      this.trailLine = new THREE.Line(geometry, material);
      this.addToScene(this.trailLine);
    }

    // Limit trail length for performance
    if (this.trailHistory.length > this.maxTrailPoints) {
      this.trailHistory = this.trailHistory.slice(-this.maxTrailPoints);
    }

    // Update only vertex positions
    this.trailLine.geometry.setFromPoints(this.trailHistory);
    this.trailLine.geometry.attributes.position.needsUpdate = true;
  }

  private resetCircularMotion(): void {
    const angularVelocity = this.getParameter('angularVelocity') as number;
    const radius = this.getParameter('radius') as number;
    const mass = this.getParameter('mass') as number;

    this.circularState = createInitialCircularMotion(
      angularVelocity,
      radius,
      mass,
      new THREE.Vector3(0, 0, 0)
    );

    this.circularDataHistory = [calculateCircularData(this.circularState)];
    this.trailHistory = [calculateCircularPosition(this.circularState)];

    // 创建或更新3D对象
    this.createCenterMarker();
    this.createCircularObject();
    this.createOrbitPath();

    // 清除旧轨迹线
    if (this.trailLine) {
      this.removeFromScene(this.trailLine);
      this.trailLine.geometry.dispose();
      if (this.trailLine.material instanceof THREE.Material) {
        this.trailLine.material.dispose();
      }
      this.trailLine = null;
    }

    // 创建向量箭头
    if (this.showVectors) {
      this.createVectorArrows();
    }
  }

  private get showVectors(): boolean {
    return this.getParameter('showVectors') as boolean;
  }

  private get showTrail(): boolean {
    return this.getParameter('showTrail') as boolean;
  }

  protected onStart(): void {
    this.resetCircularMotion();
  }

  protected onReset(): void {
    this.resetCircularMotion();
  }

  protected onParameterChange(key: string, value: number | string | boolean): void {
    if (['angularVelocity', 'radius', 'mass'].includes(key)) {
      // 参数变化时重置实验
      this.resetCircularMotion();
    } else if (key === 'showVectors') {
      // 更新向量箭头显示
      if (this.showVectors) {
        this.createVectorArrows();
      } else {
        if (this.velocityArrow) {
          this.removeFromScene(this.velocityArrow);
          this.velocityArrow = null;
        }
        if (this.forceArrow) {
          this.removeFromScene(this.forceArrow);
          this.forceArrow = null;
        }
      }
    } else if (key === 'showTrail') {
      // 更新轨迹显示
      if (!this.showTrail && this.trailLine) {
        this.removeFromScene(this.trailLine);
        this.trailLine = null;
      }
    }
  }

  update(deltaTime: number): void {
    if (!this.isRunning || !this.circularState) return;

    // 更新物理状态
    this.circularState = updateCircular(this.circularState, deltaTime);
    this.circularDataHistory.push(calculateCircularData(this.circularState));

    // 计算当前位置
    const position = calculateCircularPosition(this.circularState);

    // 更新3D对象位置
    if (this.circularObject) {
      this.circularObject.position.copy(position);
    }

    // 记录轨迹（使用时间间隔控制，确保均匀分布）
    if (this.showTrail) {
      if (this.circularState.time - this.lastTrailTime >= this.TRAIL_INTERVAL) {
        this.trailHistory.push(position);
        if (this.trailHistory.length > this.maxTrailPoints) {
          this.trailHistory.shift();
        }
        this.lastTrailTime = this.circularState.time;
      }
      this.updateTrailLine();
    }

    // 更新向量箭头
    if (this.showVectors && this.velocityArrow && this.forceArrow) {
      const velocityVector = calculateCircularVelocityVector(this.circularState);
      const accelerationVector = calculateCircularAccelerationVector(this.circularState);

      // 更新速度箭头
      const velocityLength = velocityVector.length();
      const velocityDir = velocityVector.clone().normalize();
      this.velocityArrow.position.copy(position);
      this.velocityArrow.setDirection(velocityDir);
      this.velocityArrow.setLength(velocityLength * this.VELOCITY_SCALE, 0.5, 0.3);

      // 更新向心力箭头
      const forceLength = accelerationVector.length();
      const forceDir = accelerationVector.clone().normalize();
      this.forceArrow.position.copy(position);
      this.forceArrow.setDirection(forceDir);
      this.forceArrow.setLength(forceLength * this.FORCE_SCALE, 0.5, 0.3);
    }
  }

  getDisplayData(): Record<string, DisplayValue> {
    if (!this.circularState) {
      return {};
    }

    const data = calculateCircularData(this.circularState);

    return {
      time: {
        label: 'Time',
        value: this.circularState.time.toFixed(2),
        unit: 's',
      },
      angle: {
        label: 'Angle',
        value: ((this.circularState.angle % (2 * Math.PI)) * (180 / Math.PI)).toFixed(1),
        unit: '°',
      },
      angularVelocity: {
        label: 'Angular Velocity',
        value: this.circularState.angularVelocity.toFixed(2),
        unit: 'rad/s',
      },
      linearVelocity: {
        label: 'Linear Velocity',
        value: data.linearVelocity.toFixed(2),
        unit: 'm/s',
      },
      centripetalAcceleration: {
        label: 'Centripetal Acceleration',
        value: data.centripetalAcceleration.toFixed(2),
        unit: 'm/s²',
      },
      centripetalForce: {
        label: 'Centripetal Force',
        value: data.centripetalForce.toFixed(2),
        unit: 'N',
      },
      period: {
        label: 'Period',
        value: data.period.toFixed(2),
        unit: 's',
      },
    };
  }

  dispose(): void {
    // 清理资源
    this.circularDataHistory = [];
    this.trailHistory = [];

    // 清理向量箭头
    if (this.velocityArrow) {
      this.removeFromScene(this.velocityArrow);
      this.velocityArrow = null;
    }
    if (this.forceArrow) {
      this.removeFromScene(this.forceArrow);
      this.forceArrow = null;
    }

    // 清理轨迹线
    if (this.trailLine) {
      this.removeFromScene(this.trailLine);
      this.trailLine.geometry.dispose();
      if (this.trailLine.material instanceof THREE.Material) {
        this.trailLine.material.dispose();
      }
      this.trailLine = null;
    }

    // 清理轨道
    if (this.orbitPath) {
      this.removeFromScene(this.orbitPath);
      this.orbitPath.geometry.dispose();
      if (this.orbitPath.material instanceof THREE.Material) {
        this.orbitPath.material.dispose();
      }
      this.orbitPath = null;
    }

    super.dispose();
  }
}
