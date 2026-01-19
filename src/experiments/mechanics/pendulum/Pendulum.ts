import * as THREE from 'three';
import {
  ExperimentBase,
  type ExperimentMetadata,
  type ExperimentConfig,
  type DisplayValue,
} from '@/experiments/base';
import { ExperimentCategory } from '@/utils/constants';
import {
  createInitialPendulum,
  updatePendulum,
  calculatePendulumData,
  calculatePendulumPosition,
  type PendulumState,
  type PendulumData,
} from './PendulumPhysics';

/**
 * 单摆实验
 *
 * 核心功能：
 * - 可调节摆长、质量、初始角度
 * - 实时显示周期、频率、能量等物理量
 * - 3D可视化：悬挂点、摆线、摆球
 * - 简谐运动模型（小角度近似）
 *
 * 物理模型：
 * - 使用小角度近似：θ'' = -(g/L)θ
 * - 解析解：θ(t) = θ₀·cos(ωt)，其中 ω = √(g/L)
 * - 适用于角度 ≤ 15° 的场合
 */
export class Pendulum extends ExperimentBase {
  readonly metadata: ExperimentMetadata = {
    id: 'pendulum',
    name: 'Simple Pendulum Lab',
    category: ExperimentCategory.Mechanics,
    description: 'Explore simple pendulum motion, measure period, and calculate gravitational acceleration',
    difficulty: 'basic',
    duration: 20,
    keywords: ['pendulum', 'period', 'gravity', 'harmonic', 'motion'],
    thumbnail: '/thumbnails/pendulum.png',
  };

  readonly config: ExperimentConfig = {
    physics: {
      timestep: 1 / 60,
    },
    camera: {
      position: [0, 0, 15],
      target: [0, -2, 0],
      fov: 50,
    },
    parameters: [
      {
        key: 'length',
        label: 'Pendulum Length',
        type: 'number',
        defaultValue: 2.0,
        min: 0.5,
        max: 10,
        step: 0.1,
        unit: 'm',
      },
      {
        key: 'mass',
        label: 'Bob Mass',
        type: 'number',
        defaultValue: 1.0,
        min: 0.1,
        max: 10,
        step: 0.1,
        unit: 'kg',
      },
      {
        key: 'initialAngle',
        label: 'Initial Angle',
        type: 'number',
        defaultValue: 15,
        min: -15, // Limited to ±15° for small angle approximation validity
        max: 15,
        step: 1,
        unit: '°',
      },
      {
        key: 'showTrace',
        label: 'Show Trace',
        type: 'boolean',
        defaultValue: true,
      },
    ],
  };

  // 状态
  private pendulumState: PendulumState | null = null;
  private pendulumDataHistory: PendulumData[] = [];
  private traceHistory: THREE.Vector3[] = [];
  private frameCount = 0; // For trace optimization (record every 3rd frame)

  // 3D对象引用
  private pivotPoint: THREE.Mesh | null = null;
  private stringLine: THREE.Line | null = null;
  private bobMesh: THREE.Mesh | null = null;
  private traceLine: THREE.Line | null = null;

  protected async setupScene(): Promise<void> {
    if (!this.scene) return;

    // 设置灯光
    this.setupLights();

    // 创建地面
    this.createGround();

    // 创建悬挂点
    this.createPivotPoint();

    // 创建摆线
    this.createString();

    // 创建摆球
    this.createBob();

    // 初始化单摆状态
    this.resetPendulum();
  }

  /**
   * 设置灯光
   */
  private setupLights(): void {
    if (!this.scene) return;

    // 环境光 - 提供柔和的填充光
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.addToScene(ambientLight);

    // 主光源 - 产生阴影
    const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
    mainLight.position.set(10, 20, 10);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    this.addToScene(mainLight);
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
   * 创建悬挂点（固定点）
   */
  private createPivotPoint(): void {
    if (!this.scene) return;

    const geometry = new THREE.SphereGeometry(0.1, 16, 16);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.5,
      metalness: 0.5,
    });

    this.pivotPoint = new THREE.Mesh(geometry, material);
    this.pivotPoint.position.set(0, 0, 0);
    this.pivotPoint.castShadow = true;

    this.addToScene(this.pivotPoint);
  }

  /**
   * 创建摆线
   */
  private createString(): void {
    if (!this.scene) return;

    const material = new THREE.LineBasicMaterial({
      color: 0x888888,
      linewidth: 2,
    });

    const geometry = new THREE.BufferGeometry();
    this.stringLine = new THREE.Line(geometry, material);

    this.addToScene(this.stringLine);
  }

  /**
   * 创建摆球
   */
  private createBob(): void {
    if (!this.scene) return;

    const radius = 0.3;
    const geometry = new THREE.SphereGeometry(radius, 32, 32);
    const material = new THREE.MeshStandardMaterial({
      color: 0x00ff41,
      roughness: 0.3,
      metalness: 0.7,
    });

    this.bobMesh = new THREE.Mesh(geometry, material);
    this.bobMesh.castShadow = true;
    this.bobMesh.receiveShadow = true;

    this.addToScene(this.bobMesh);
  }

  /**
   * 更新摆线位置
   */
  private updateString(bobPosition: THREE.Vector3): void {
    if (!this.stringLine) return;

    const points = [new THREE.Vector3(0, 0, 0), bobPosition];
    this.stringLine.geometry.setFromPoints(points);
    this.stringLine.geometry.attributes.position.needsUpdate = true;
  }

  /**
   * 更新轨迹线
   */
  private updateTrace(): void {
    const showTrace = this.getParameter('showTrace') as boolean;
    if (!showTrace || this.traceHistory.length < 2) {
      return;
    }

    if (!this.traceLine) {
      const geometry = new THREE.BufferGeometry();
      const material = new THREE.LineBasicMaterial({
        color: 0x60a5fa,
        transparent: true,
        opacity: 0.5,
      });
      this.traceLine = new THREE.Line(geometry, material);
      this.addToScene(this.traceLine);
    }

    this.traceLine.geometry.setFromPoints(this.traceHistory);
    this.traceLine.geometry.attributes.position.needsUpdate = true;
  }

  /**
   * 重置单摆状态
   */
  private resetPendulum(): void {
    // Get parameters with runtime validation for safety
    const rawLength = this.getParameter('length') as number;
    const rawMass = this.getParameter('mass') as number;
    const rawAngle = this.getParameter('initialAngle') as number;

    // Clamp to safe ranges (defense in depth)
    const length = Math.max(0.1, Math.min(20, rawLength));
    const mass = Math.max(0.01, Math.min(100, rawMass));
    const initialAngleDeg = Math.max(-15, Math.min(15, rawAngle));

    // 将角度转换为弧度
    const initialAngleRad = (initialAngleDeg * Math.PI) / 180;

    this.pendulumState = createInitialPendulum(length, mass, initialAngleRad);
    this.pendulumDataHistory = [calculatePendulumData(this.pendulumState)];
    this.traceHistory = [];

    // 更新3D对象位置
    this.updateVisualization();

    // 清除轨迹线
    if (this.traceLine) {
      this.removeFromScene(this.traceLine);
      this.traceLine.geometry.dispose();
      if (this.traceLine.material instanceof THREE.Material) {
        this.traceLine.material.dispose();
      }
      this.traceLine = null;
    }
  }

  /**
   * 更新3D可视化
   */
  private updateVisualization(): void {
    if (!this.pendulumState || !this.bobMesh) return;

    const bobPosition = calculatePendulumPosition(this.pendulumState);

    // 更新摆球位置
    this.bobMesh.position.copy(bobPosition);

    // 更新摆线
    this.updateString(bobPosition);

    // 记录轨迹（每3帧记录一次以优化性能，减少内存分配）
    this.frameCount++;
    const showTrace = this.getParameter('showTrace') as boolean;
    if (showTrace && this.frameCount % 3 === 0) {
      this.traceHistory.push(bobPosition.clone());
      // 限制轨迹点数量
      if (this.traceHistory.length > 500) {
        this.traceHistory.shift();
      }
    }
  }

  protected onStart(): void {
    this.resetPendulum();
  }

  protected onReset(): void {
    this.resetPendulum();
  }

  protected onParameterChange(key: string, value: number | string | boolean): void {
    if (['length', 'mass', 'initialAngle'].includes(key)) {
      // 参数变化时重置实验
      this.resetPendulum();
    } else if (key === 'showTrace') {
      // 更新轨迹显示
      if (!value && this.traceLine) {
        this.removeFromScene(this.traceLine);
        this.traceLine.geometry.dispose();
        if (this.traceLine.material instanceof THREE.Material) {
          this.traceLine.material.dispose();
        }
        this.traceLine = null;
      }
    }
  }

  update(deltaTime: number): void {
    if (!this.isRunning || !this.pendulumState) return;

    // 更新物理状态
    this.pendulumState = updatePendulum(this.pendulumState, deltaTime);

    // 记录数据
    this.pendulumDataHistory.push(calculatePendulumData(this.pendulumState));

    // 更新3D可视化
    this.updateVisualization();

    // 更新轨迹线
    this.updateTrace();
  }

  getDisplayData(): Record<string, DisplayValue> {
    if (!this.pendulumState) {
      return {};
    }

    const data = calculatePendulumData(this.pendulumState);
    const angleDeg = (this.pendulumState.angle * 180) / Math.PI;

    return {
      time: {
        label: 'Time',
        value: this.pendulumState.time.toFixed(2),
        unit: 's',
      },
      angle: {
        label: 'Angle',
        value: angleDeg.toFixed(1),
        unit: '°',
      },
      length: {
        label: 'Length',
        value: this.pendulumState.length.toFixed(2),
        unit: 'm',
      },
      period: {
        label: 'Period',
        value: data.period.toFixed(3),
        unit: 's',
      },
      frequency: {
        label: 'Frequency',
        value: data.frequency.toFixed(3),
        unit: 'Hz',
      },
      angularFrequency: {
        label: 'Angular Frequency',
        value: data.angularFrequency.toFixed(2),
        unit: 'rad/s',
      },
      velocity: {
        label: 'Velocity',
        value: data.velocity.toFixed(2),
        unit: 'm/s',
      },
      kineticEnergy: {
        label: 'Kinetic Energy',
        value: data.kineticEnergy.toFixed(3),
        unit: 'J',
      },
      potentialEnergy: {
        label: 'Potential Energy',
        value: data.potentialEnergy.toFixed(3),
        unit: 'J',
      },
      mechanicalEnergy: {
        label: 'Mechanical Energy',
        value: data.mechanicalEnergy.toFixed(3),
        unit: 'J',
      },
    };
  }

  dispose(): void {
    // 清理资源
    this.pendulumDataHistory = [];
    this.traceHistory = [];

    // 清理轨迹线
    if (this.traceLine) {
      this.removeFromScene(this.traceLine);
      this.traceLine.geometry.dispose();
      if (this.traceLine.material instanceof THREE.Material) {
        this.traceLine.material.dispose();
      }
      this.traceLine = null;
    }

    super.dispose();
  }
}
