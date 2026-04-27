# 力学实验重构实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**目标:** 重构力学实验模块，创建统一的运动与碰撞实验室，优化单摆实验，集成完整的UI控制系统

**架构:**
- 合并抛体运动和碰撞实验为统一的"运动与碰撞实验室"
- 单摆实验独立，移除弹簧振子模式
- 创建右侧Tab控制面板（控制+监控）
- 集成PhysicsMonitor组件进行实时数据监控
- 实现多种物体类型（球体、滑块、木板、斜面）

**技术栈:**
- React 18 + TypeScript
- Three.js + React Three Fiber
- Zustand (状态管理)
- Tailwind CSS (样式)
- recharts (图表)
- react-resizable-panels (可调整面板)

---

## 任务概览

### Phase 1: 创建统一的运动与碰撞实验室（核心功能）
- Task 1.1: 创建物体系统（球体、滑块、木板）
- Task 1.2: 实现斜面系统
- Task 1.3: 创建物理引擎（运动+碰撞检测）
- Task 1.4: 实现轨迹系统（可开关）

### Phase 2: UI控制系统
- Task 2.1: 创建右侧Tab控制面板组件
- Task 2.2: 创建物体控制Tab（添加/删除/参数）
- Task 2.3: 集成PhysicsMonitor到监控Tab
- Task 2.4: 实现播放控制（开始/暂停/重置）

### Phase 3: 单摆实验重构
- Task 3.1: 创建单摆专用实验类（移除弹簧）
- Task 3.2: 创建计时器组件
- Task 3.3: 实现重力加速度计算
- Task 3.4: 创建单摆控制面板

### Phase 4: 地面与场景优化
- Task 4.1: 修改地面设计（纯色，无网格）
- Task 4.2: 优化相机和光照

### Phase 5: 集成与测试
- Task 5.1: 更新ExperimentView集成新UI
- Task 5.2: 更新首页实验卡片
- Task 5.3: 测试所有功能

---

## Phase 1: 创建统一的运动与碰撞实验室

### Task 1.1: 创建物体系统（球体、滑块、木板）

**Files:**
- Create: `src/experiments/mechanics/motion-collision/types/ObjectTypes.ts`
- Create: `src/experiments/mechanics/motion-collision/objects/PhysicsObject.ts`
- Modify: `src/experiments/mechanics/motion-collision/MotionCollisionLab.ts`

**Step 1: 定义物体类型**

创建 `src/experiments/mechanics/motion-collision/types/ObjectTypes.ts`:

```typescript
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
}
```

**Step 2: 创建物体工厂**

创建 `src/experiments/mechanics/motion-collision/objects/PhysicsObject.ts`:

```typescript
import * as THREE from 'three';
import type { PhysicsObjectConfig, ObjectType } from '../types/ObjectTypes';

export class PhysicsObjectFactory {
  private static readonly MATERIALS = {
    sphere: new THREE.MeshStandardMaterial({
      color: 0x00ff41,
      metalness: 0.3,
      roughness: 0.7,
    }),
    box: new THREE.MeshStandardMaterial({
      color: 0x60a5fa,
      metalness: 0.5,
      roughness: 0.5,
    }),
    plank: new THREE.MeshStandardMaterial({
      color: 0xd8ca9d,
      metalness: 0.1,
      roughness: 0.8,
    }),
  };

  static create(config: PhysicsObjectConfig): THREE.Mesh {
    let geometry: THREE.BufferGeometry;
    let material: THREE.MeshStandardMaterial;

    switch (config.type) {
      case 'sphere':
        geometry = new THREE.SphereGeometry(config.radius || 1, 32, 32);
        material = this.MATERIALS.sphere.clone();
        break;

      case 'box':
        geometry = new THREE.BoxGeometry(
          config.width || 2,
          config.height || 2,
          config.depth || 2
        );
        material = this.MATERIALS.box.clone();
        break;

      case 'plank':
        geometry = new THREE.BoxGeometry(
          config.width || 4,
          config.height || 0.5,
          config.depth || 2
        );
        material = this.MATERIALS.plank.clone();
        break;

      default:
        throw new Error(`Unknown object type: ${config.type}`);
    }

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(config.position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    return mesh;
  }

  static dispose(): void {
    Object.values(this.MATERIALS).forEach(material => material.dispose());
  }
}
```

**Step 3: 在主实验类中集成物体管理**

修改 `src/experiments/mechanics/motion-collision/MotionCollisionLab.ts`:

```typescript
export class MotionCollisionLab extends ExperimentBase {
  private objects: Map<string, SimulationObject> = new Map();
  private nextObjectId = 1;

  // 添加默认球体
  private addDefaultSphere(): void {
    const sphere = this.createObject({
      id: `sphere-${this.nextObjectId++}`,
      type: 'sphere',
      position: new THREE.Vector3(0, 1, 0),
      velocity: new THREE.Vector3(0, 0, 0),
      mass: 1.0,
      radius: 0.5,
    });
    this.objects.set(sphere.id, sphere);
    this.addToScene(sphere.mesh);
  }
}
```

**Step 4: 测试**

运行开发服务器，访问实验页面，验证默认球体创建成功。

---

### Task 1.2: 实现斜面系统

**Files:**
- Create: `src/experiments/mechanics/motion-collision/types/RampTypes.ts`
- Create: `src/experiments/mechanics/motion-collision/objects/Ramp.ts`
- Modify: `src/experiments/mechanics/motion-collision/MotionCollisionLab.ts`

**Step 1: 定义斜面类型**

创建 `src/experiments/mechanics/motion-collision/types/RampTypes.ts`:

```typescript
export interface RampConfig {
  id: string;
  position: THREE.Vector3;
  length: number;
  width: number;
  angle: number;        // 倾斜角度（度）
  height: number;       // 高度
}

export interface SimulationRamp extends RampConfig {
  mesh: THREE.Mesh;
}
```

**Step 2: 创建斜面类**

创建 `src/experiments/mechanics/motion-collision/objects/Ramp.ts`:

```typescript
import * as THREE from 'three';
import type { RampConfig } from '../types/RampTypes';

export class RampFactory {
  static create(config: RampConfig): THREE.Mesh {
    // 创建三棱柱形状
    const shape = new THREE.Shape();
    const angleRad = (config.angle * Math.PI) / 180;

    // 斜面截面（直角三角形）
    shape.moveTo(0, 0);
    shape.lineTo(config.height, 0);
    shape.lineTo(0, config.height);
    shape.closePath();

    const extrudeSettings = {
      steps: 1,
      depth: config.width,
      bevelEnabled: false,
    };

    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

    // 旋转到正确位置
    geometry.rotateZ(Math.PI / 2);

    const material = new THREE.MeshStandardMaterial({
      color: 0x8b5cf6,
      metalness: 0.3,
      roughness: 0.7,
      transparent: true,
      opacity: 0.8,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(config.position);
    mesh.receiveShadow = true;

    return mesh;
  }
}
```

**Step 3: 集成到主实验类**

```typescript
export class MotionCollisionLab extends ExperimentBase {
  private ramps: Map<string, SimulationRamp> = new Map();

  addRamp(config: RampConfig): void {
    const ramp = RampFactory.create(config);
    this.ramps.set(config.id, { ...config, mesh: ramp });
    this.addToScene(ramp);
  }

  removeRamp(id: string): void {
    const ramp = this.ramps.get(id);
    if (ramp) {
      this.removeFromScene(ramp.mesh);
      ramp.mesh.geometry.dispose();
      (ramp.mesh.material as THREE.Material).dispose();
      this.ramps.delete(id);
    }
  }
}
```

---

### Task 1.3: 创建物理引擎（运动+碰撞检测）

**Files:**
- Create: `src/experiments/mechanics/motion-collision/physics/PhysicsEngine.ts`
- Modify: `src/experiments/mechanics/motion-collision/MotionCollisionLab.ts`

**Step 1: 实现物理更新引擎**

创建 `src/experiments/mechanics/motion-collision/physics/PhysicsEngine.ts`:

```typescript
import * as THREE from 'three';
import type { SimulationObject } from '../objects/PhysicsObject';
import type { SimulationRamp } from '../objects/Ramp';
import { EARTH_GRAVITY } from '@/utils/constants';

export class PhysicsEngine {
  /**
   * 更新物体位置（欧拉积分）
   */
  static updatePositions(
    objects: Map<string, SimulationObject>,
    deltaTime: number
  ): void {
    objects.forEach(obj => {
      if (obj.velocity.length() === 0) return;

      // 速度积分位置
      const displacement = obj.velocity.clone().multiplyScalar(deltaTime);
      obj.mesh.position.add(displacement);
      obj.position.copy(obj.mesh.position);

      // 重力加速度
      obj.velocity.y -= EARTH_GRAVITY * deltaTime;
    });
  }

  /**
   * 检测地面碰撞
   */
  static detectGroundCollision(
    objects: Map<string, SimulationObject>,
    groundY: number = 0
  ): void {
    objects.forEach(obj => {
      const radius = obj.radius || 1;
      if (obj.mesh.position.y - radius <= groundY) {
        // 修正位置
        obj.mesh.position.y = groundY + radius;
        obj.position.y = groundY + radius;

        // 反弹（非完全弹性碰撞）
        if (obj.velocity.y < 0) {
          obj.velocity.y *= -0.8; // 恢复系数0.8

          // 摩擦力
          const friction = 0.98;
          obj.velocity.x *= friction;
          obj.velocity.z *= friction;
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
   */
  static resolveCollision(
    obj1: SimulationObject,
    obj2: SimulationObject
  ): void {
    const m1 = obj1.mass;
    const m2 = obj2.mass;
    const v1 = obj1.velocity;
    const v2 = obj2.velocity;

    // 一维弹性碰撞公式
    const v1Final = v1.clone().multiplyScalar((m1 - m2) / (m1 + m2))
      .add(v2.clone().multiplyScalar(2 * m2 / (m1 + m2)));
    const v2Final = v2.clone().multiplyScalar((m2 - m1) / (m1 + m2))
      .add(v1.clone().multiplyScalar(2 * m1 / (m1 + m2)));

    obj1.velocity.copy(v1Final);
    obj2.velocity.copy(v2Final);
  }
}
```

**Step 2: 在主实验类中使用物理引擎**

```typescript
export class MotionCollisionLab extends ExperimentBase {
  update(deltaTime: number): void {
    if (!this.isRunning) return;

    // 更新位置
    PhysicsEngine.updatePositions(this.objects, deltaTime);

    // 地面碰撞检测
    PhysicsEngine.detectGroundCollision(this.objects);

    // 物体间碰撞检测
    const collisions = PhysicsEngine.detectObjectCollisions(this.objects);
    collisions.forEach((targets, id) => {
      const obj1 = this.objects.get(id)!;
      targets.forEach(targetId => {
        const obj2 = this.objects.get(targetId)!;
        PhysicsEngine.resolveCollision(obj1, obj2);
      });
    });

    // 更新轨迹
    this.updateTrajectories();
  }
}
```

---

### Task 1.4: 实现轨迹系统（可开关）

**Files:**
- Create: `src/experiments/mechanics/motion-collision/components/TrajectoryManager.ts`
- Modify: `src/experiments/mechanics/motion-collision/MotionCollisionLab.ts`

**Step 1: 创建轨迹管理器**

创建 `src/experiments/mechanics/motion-collision/components/TrajectoryManager.ts`:

```typescript
import * as THREE from 'three';
import type { SimulationObject } from '../objects/PhysicsObject';

export class TrajectoryManager {
  private static readonly MAX_POINTS = 500;
  private static readonly TRAIL_INTERVAL = 0.05; // 50ms

  private lastTrailTime = 0;

  /**
   * 更新物体轨迹
   */
  static updateTrajectory(
    obj: SimulationObject,
    currentTime: number,
    showTrajectory: boolean
  ): void {
    if (!showTrajectory) return;

    // 时间间隔控制
    if (currentTime - this.lastTrailTime < this.TRAIL_INTERVAL) {
      return;
    }

    // 添加当前位置到轨迹
    obj.trajectory.push(obj.mesh.position.clone());

    // 限制轨迹点数量
    if (obj.trajectory.length > this.MAX_POINTS) {
      obj.trajectory.shift();
    }

    this.lastTrailTime = currentTime;
  }

  /**
   * 创建轨迹线
   */
  static createTrajectoryLine(
    color: number = 0x00ff41
  ): THREE.Line {
    const geometry = new THREE.BufferGeometry();
    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.6,
    });
    return new THREE.Line(geometry, material);
  }

  /**
   * 更新轨迹线几何体
   */
  static updateTrajectoryGeometry(
    line: THREE.Line,
    trajectory: THREE.Vector3[]
  ): void {
    if (trajectory.length < 2) {
      line.visible = false;
      return;
    }

    line.visible = true;
    line.geometry.setFromPoints(trajectory);
    line.geometry.attributes.position.needsUpdate = true;
  }

  /**
   * 清除轨迹
   */
  static clearTrajectory(obj: SimulationObject): void {
    obj.trajectory = [];
  }
}
```

**Step 2: 在主实验类中集成轨迹系统**

```typescript
export class MotionCollisionLab extends ExperimentBase {
  private trajectoryLines: Map<string, THREE.Line> = new Map();
  private showTrajectory = true; // 参数控制

  private updateTrajectories(): void {
    this.objects.forEach((obj, id) => {
      // 更新轨迹数据
      TrajectoryManager.updateTrajectory(
        obj,
        this.simulationTime,
        this.showTrajectory
      );

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
    });
  }
}
```

---

## Phase 2: UI控制系统

### Task 2.1: 创建右侧Tab控制面板组件

**Files:**
- Create: `src/components/experiment/TabPanel.tsx`
- Create: `src/components/experiment/ControlTab.tsx`
- Create: `src/components/experiment/MonitorTab.tsx`

**Step 1: 创建Tab面板容器**

创建 `src/components/experiment/TabPanel.tsx`:

```typescript
import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface TabPanelProps {
  children: React.ReactNode;
}

export function TabPanel({ children }: TabPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className={`absolute right-0 top-20 bottom-8 w-80 flex flex-col gap-4 pointer-events-none z-50 transition-all duration-300 ${isExpanded ? 'translate-x-0' : 'translate-x-[calc(100%-40px)]'}`}>
      {/* 切换按钮 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="absolute left-[-40px] top-1/2 -translate-y-1/2 w-10 h-20 bg-slate-900/90 backdrop-blur-md rounded-l-lg border border-white/10 flex items-center justify-center pointer-events-auto hover:bg-slate-800 transition-colors"
      >
        {isExpanded ? <ChevronRight size={20} className="text-white" /> : <ChevronLeft size={20} className="text-white" />}
      </button>

      {/* 面板内容 */}
      <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl border border-white/10 p-5 shadow-2xl flex flex-col gap-6 pointer-events-auto h-full overflow-hidden">
        {children}
      </div>
    </div>
  );
}
```

**Step 2: 创建Tab切换器**

创建 `src/components/experiment/ControlTab.tsx`:

```typescript
import React, { useState } from 'react';

export function ControlTab() {
  const [activeTab, setActiveTab] = useState<'control' | 'monitor'>('control');

  return (
    <div className="flex flex-col gap-4">
      {/* Tab按钮 */}
      <div className="flex gap-2 border-b border-white/10 pb-2">
        <button
          onClick={() => setActiveTab('control')}
          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
            activeTab === 'control'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          }`}
        >
          Control
        </button>
        <button
          onClick={() => setActiveTab('monitor')}
          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
            activeTab === 'monitor'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          }`}
        >
          Monitor
        </button>
      </div>

      {/* Tab内容 */}
      {activeTab === 'control' ? <ControlContent /> : <MonitorContent />}
    </div>
  );
}

function ControlContent() {
  return <div>控制面板内容</div>;
}

function MonitorContent() {
  return <div>监控面板内容</div>;
}
```

---

### Task 2.2: 创建物体控制Tab（添加/删除/参数）

**Files:**
- Modify: `src/components/experiment/ControlTab.tsx`

**Step 1: 实现物体列表和控制**

```typescript
import React, { useState } from 'react';
import { Plus, Trash2, Settings } from 'lucide-react';

interface ObjectControlTabProps {
  objects: Map<string, SimulationObject>;
  onAddObject: (type: 'sphere' | 'box' | 'plank') => void;
  onRemoveObject: (id: string) => void;
  onUpdateObject: (id: string, params: any) => void;
}

export function ObjectControlTab({
  objects,
  onAddObject,
  onRemoveObject,
  onUpdateObject,
}: ObjectControlTabProps) {
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      {/* 添加物体按钮组 */}
      <div className="space-y-2">
        <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
          Add Object
        </span>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => onAddObject('sphere')}
            className="flex flex-col items-center gap-1 p-3 bg-slate-800 hover:bg-slate-700 rounded-lg border border-white/10 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-green-500"></div>
            <span className="text-xs text-slate-300">Sphere</span>
          </button>
          <button
            onClick={() => onAddObject('box')}
            className="flex flex-col items-center gap-1 p-3 bg-slate-800 hover:bg-slate-700 rounded-lg border border-white/10 transition-colors"
          >
            <div className="w-8 h-8 bg-blue-500"></div>
            <span className="text-xs text-slate-300">Box</span>
          </button>
          <button
            onClick={() => onAddObject('plank')}
            className="flex flex-col items-center gap-1 p-3 bg-slate-800 hover:bg-slate-700 rounded-lg border border-white/10 transition-colors"
          >
            <div className="w-12 h-3 bg-yellow-700"></div>
            <span className="text-xs text-slate-300">Plank</span>
          </button>
        </div>
      </div>

      {/* 物体列表 */}
      <div className="space-y-2">
        <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
          Objects ({objects.size})
        </span>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {Array.from(objects.values()).map(obj => (
            <div
              key={obj.id}
              className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                selectedObjectId === obj.id
                  ? 'bg-blue-600/20 border-blue-500'
                  : 'bg-slate-800 border-white/10 hover:bg-slate-700'
              }`}
              onClick={() => setSelectedObjectId(obj.id)}
            >
              <div className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded-full ${
                  obj.type === 'sphere' ? 'bg-green-500' :
                  obj.type === 'box' ? 'bg-blue-500' :
                  'bg-yellow-700'
                }`} />
                <span className="text-sm text-white">{obj.type}</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveObject(obj.id);
                }}
                className="p-1 hover:bg-red-600 rounded transition-colors"
              >
                <Trash2 size={16} className="text-red-400" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 选中物体的参数控制 */}
      {selectedObjectId && (
        <ObjectParams
          object={objects.get(selectedObjectId)!}
          onUpdate={(params) => onUpdateObject(selectedObjectId, params)}
        />
      )}
    </div>
  );
}

function ObjectParams({
  object,
  onUpdate,
}: {
  object: SimulationObject;
  onUpdate: (params: any) => void;
}) {
  return (
    <div className="space-y-3">
      <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
        Parameters
      </span>

      {/* 质量滑块 */}
      <div>
        <div className="flex justify-between text-sm mb-1">
          <span className="text-slate-300">Mass</span>
          <span className="text-blue-400">{object.mass.toFixed(1)} kg</span>
        </div>
        <input
          type="range"
          min={0.1}
          max={10}
          step={0.1}
          value={object.mass}
          onChange={(e) => onUpdate({ mass: parseFloat(e.target.value) })}
          className="w-full"
        />
      </div>

      {/* 初速度控制 */}
      <div className="space-y-2">
        <span className="text-xs text-slate-300">Initial Velocity</span>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-xs text-slate-400">Vx</label>
            <input
              type="number"
              value={object.velocity.x.toFixed(2)}
              onChange={(e) => {
                const newVel = object.velocity.clone();
                newVel.x = parseFloat(e.target.value) || 0;
                onUpdate({ velocity: newVel });
              }}
              className="w-full bg-slate-800 border border-white/10 rounded px-2 py-1 text-white text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">Vy</label>
            <input
              type="number"
              value={object.velocity.y.toFixed(2)}
              onChange={(e) => {
                const newVel = object.velocity.clone();
                newVel.y = parseFloat(e.target.value) || 0;
                onUpdate({ velocity: newVel });
              }}
              className="w-full bg-slate-800 border border-white/10 rounded px-2 py-1 text-white text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">Vz</label>
            <input
              type="number"
              value={object.velocity.z.toFixed(2)}
              onChange={(e) => {
                const newVel = object.velocity.clone();
                newVel.z = parseFloat(e.target.value) || 0;
                onUpdate({ velocity: newVel });
              }}
              className="w-full bg-slate-800 border border-white/10 rounded px-2 py-1 text-white text-sm"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

### Task 2.3: 集成PhysicsMonitor到监控Tab

**Files:**
- Modify: `src/components/experiment/ControlTab.tsx`

**Step 1: 实现监控Tab内容**

```typescript
import { PhysicsMonitor } from '@/components/monitoring/PhysicsMonitor';
import type { MonitoredQuantity } from '@/components/monitoring/QuantitySelector';

function MonitorContent() {
  const monitoredQuantities: MonitoredQuantity[] = [
    { id: 'velocity', label: 'Velocity', unit: 'm/s', color: '#00ff41' },
    { id: 'acceleration', label: 'Acceleration', unit: 'm/s²', color: '#ff6b6b' },
    { id: 'momentum', label: 'Momentum', unit: 'kg·m/s', color: '#60a5fa' },
    { id: 'kineticEnergy', label: 'Kinetic Energy', unit: 'J', color: '#fbbf24' },
    { id: 'position', label: 'Position', unit: 'm', color: '#a78bfa' },
  ];

  const [selectedQuantities, setSelectedQuantities] = useState<string[]>(['velocity', 'position']);
  const [isExpanded, setIsExpanded] = useState(true);

  // 从实验获取历史数据
  const history = useSimulationStore(state => state.monitoringHistory);

  return (
    <PhysicsMonitor
      quantities={monitoredQuantities}
      history={history}
      selectedQuantities={selectedQuantities}
      onSelectionChange={setSelectedQuantities}
      isExpanded={isExpanded}
      onToggleExpand={() => setIsExpanded(!isExpanded)}
    />
  );
}
```

---

### Task 2.4: 实现播放控制

**Files:**
- Modify: `src/pages/ExperimentView.tsx`

**Step 1: 为运动与碰撞实验室添加播放控制**

```typescript
// 在 ExperimentView.tsx 中添加
const isMotionLab = experimentId === 'motion-collision';

// 在 header 的控制按钮区域
{isMotionLab && (
  <div className="flex items-center gap-3">
    <button
      onClick={handlePlayPause}
      className={`flex items-center gap-2.5 px-5 py-2.5 rounded-lg font-medium transition-all duration-200 shadow-lg ${
        isPlaying
          ? 'bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white shadow-orange-900/30'
          : 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white shadow-emerald-900/30'
      }`}
    >
      {isPlaying ? <Pause size={18} /> : <Play size={18} />}
      <span className="tracking-wide">{isPlaying ? 'Pause' : 'Start'}</span>
    </button>
    <button
      onClick={handleReset}
      className="flex items-center gap-2.5 px-5 py-2.5 rounded-lg bg-gradient-to-r from-slate-700 to-slate-600 hover:from-slate-600 hover:to-slate-500 text-white font-medium transition-all duration-200 shadow-lg shadow-slate-900/30 border border-white/10"
    >
      <RotateCcw size={18} />
      <span className="tracking-wide">Reset</span>
    </button>
  </div>
)}
```

---

## Phase 3: 单摆实验重构

### Task 3.1: 创建单摆专用实验类（移除弹簧）

**Files:**
- Create: `src/experiments/mechanics/pendulum/PendulumPhysics.ts`
- Create: `src/experiments/mechanics/pendulum/Pendulum.ts`
- Create: `src/experiments/mechanics/pendulum/index.ts`
- Delete: `src/experiments/mechanics/simple-harmonic-motion/` (或仅移除弹簧相关代码)

**Step 1: 创建单摆物理模块**

创建 `src/experiments/mechanics/pendulum/PendulumPhysics.ts`:

```typescript
import * as THREE from 'three';
import { EARTH_GRAVITY } from '@/utils/constants';

export interface PendulumState {
  angle: number;           // 角度（弧度）
  angularVelocity: number; // 角速度（rad/s）
  length: number;          // 摆长（m）
  mass: number;            // 质量（kg）
  time: number;            // 时间（s）
}

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
 */
export function updatePendulum(
  state: PendulumState,
  deltaTime: number
): PendulumState {
  // 角频率：ω = √(g/L)
  const angularFrequency = Math.sqrt(EARTH_GRAVITY / state.length);

  // 简谐运动：θ(t) = θ₀·cos(ωt)
  const newState: PendulumState = {
    ...state,
    angle: state.angle * Math.cos(angularFrequency * deltaTime),
    angularVelocity: -state.angle * angularFrequency * Math.sin(angularFrequency * deltaTime),
    time: state.time + deltaTime,
  };

  return newState;
}

/**
 * 计算单摆数据
 */
export function calculatePendulumData(state: PendulumState): PendulumData {
  const angularFrequency = Math.sqrt(EARTH_GRAVITY / state.length);
  const period = 2 * Math.PI * Math.sqrt(state.length / EARTH_GRAVITY);
  const frequency = 1 / period;

  // 线速度
  const velocity = state.angularVelocity * state.length;

  // 能量
  const height = state.length * (1 - Math.cos(state.angle));
  const potentialEnergy = state.mass * EARTH_GRAVITY * height;
  const kineticEnergy = 0.5 * state.mass * velocity * velocity;
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
 */
export function calculatePendulumPosition(state: PendulumState): THREE.Vector3 {
  const x = state.length * Math.sin(state.angle);
  const y = -state.length * Math.cos(state.angle);
  return new THREE.Vector3(x, y, 0);
}
```

**Step 2: 创建单摆实验类**

创建 `src/experiments/mechanics/pendulum/Pendulum.ts`:

```typescript
import * as THREE from 'three';
import { ExperimentBase, type ExperimentMetadata, type ExperimentConfig } from '@/experiments/base';
import { ExperimentCategory } from '@/utils/constants';
import {
  createInitialPendulum,
  updatePendulum,
  calculatePendulumData,
  calculatePendulumPosition,
  type PendulumState,
  type PendulumData,
} from './PendulumPhysics';

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
        defaultValue: 30,
        min: 5,
        max: 60,
        step: 1,
        unit: 'degrees',
      },
      {
        key: 'showVectors',
        label: 'Show Vectors',
        type: 'boolean',
        defaultValue: true,
      },
    ],
  };

  // 场景对象
  private pendulumState: PendulumState | null = null;
  private pivot: THREE.Mesh | null = null;
  private string: THREE.Line | null = null;
  private bob: THREE.Mesh | null = null;
  private velocityArrow: THREE.ArrowHelper | null = null;

  protected async setupScene(): Promise<void> {
    if (!this.scene) return;

    // 创建纯色地面
    this.createGround();

    // 创建单摆
    this.createPendulum();

    // 初始化状态
    this.resetPendulum();
  }

  private createGround(): void {
    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1a2e,
      roughness: 0.9,
      metalness: 0.1,
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -5;
    ground.receiveShadow = true;
    this.addToScene(ground);
  }

  private createPendulum(): void {
    if (!this.scene) return;

    // 支点
    const pivotGeometry = new THREE.SphereGeometry(0.2, 16, 16);
    const pivotMaterial = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 0.5,
      roughness: 0.5,
    });
    this.pivot = new THREE.Mesh(pivotGeometry, pivotMaterial);
    this.pivot.position.set(0, 5, 0);
    this.addToScene(this.pivot);

    // 摆线
    const stringMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      linewidth: 2,
    });
    const stringGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 5, 0),
      new THREE.Vector3(0, 3, 0),
    ]);
    this.string = new THREE.Line(stringGeometry, stringMaterial);
    this.addToScene(this.string);

    // 摆球
    const bobGeometry = new THREE.SphereGeometry(0.3, 32, 32);
    const bobMaterial = new THREE.MeshStandardMaterial({
      color: 0x60a5fa,
      metalness: 0.3,
      roughness: 0.7,
    });
    this.bob = new THREE.Mesh(bobGeometry, bobMaterial);
    this.bob.position.set(0, 3, 0);
    this.bob.castShadow = true;
    this.addToScene(this.bob);
  }

  private resetPendulum(): void {
    const length = this.getParameter('length') as number;
    const mass = this.getParameter('mass') as number;
    const initialAngle = this.getParameter('initialAngle') as number;

    this.pendulumState = createInitialPendulum(
      length,
      mass,
      (initialAngle * Math.PI) / 180 // 转换为弧度
    );

    this.updatePendulumVisuals();
  }

  protected onStart(): void {
    this.simulationTime = 0;
  }

  protected onReset(): void {
    this.resetPendulum();
    this.simulationTime = 0;
  }

  protected onParameterChange(key: string, value: any): void {
    if (key === 'length' || key === 'mass' || key === 'initialAngle') {
      this.resetPendulum();
    }
  }

  update(deltaTime: number): void {
    if (!this.isRunning || !this.pendulumState) return;

    // 更新物理状态
    this.pendulumState = updatePendulum(this.pendulumState, deltaTime);

    // 更新可视化
    this.updatePendulumVisuals();

    // 更新时间
    this.simulationTime += deltaTime;
  }

  private updatePendulumVisuals(): void {
    if (!this.pendulumState || !this.bob) return;

    const position = calculatePendulumPosition(this.pendulumState);
    position.y += 5; // 加上支点高度

    this.bob.position.copy(position);

    // 更新摆线
    if (this.string) {
      const points = [
        new THREE.Vector3(0, 5, 0),
        position,
      ];
      this.string.geometry.setFromPoints(points);
      this.string.geometry.attributes.position.needsUpdate = true;
    }

    // 更新速度箭头
    const showVectors = this.getParameter('showVectors') as boolean;
    if (showVectors) {
      const data = calculatePendulumData(this.pendulumState);
      // 创建/更新速度箭头
      if (!this.velocityArrow) {
        this.velocityArrow = new THREE.ArrowHelper(
          new THREE.Vector3(1, 0, 0),
          position,
          data.velocity,
          0x60a5fa
        );
        this.addToScene(this.velocityArrow);
      } else {
        this.velocityArrow.position.copy(position);
        this.velocityArrow.setLength(data.velocity);
      }
    }
  }

  getDisplayData(): Record<string, DisplayValue> {
    if (!this.pendulumState) {
      return {};
    }

    const data = calculatePendulumData(this.pendulumState);

    return {
      time: {
        label: 'Time',
        value: this.simulationTime.toFixed(2),
        unit: 's',
      },
      length: {
        label: 'Length',
        value: this.pendulumState.length.toFixed(2),
        unit: 'm',
      },
      angle: {
        label: 'Angle',
        value: (this.pendulumState.angle * 180 / Math.PI).toFixed(1),
        unit: '°',
      },
      period: {
        label: 'Period',
        value: data.period.toFixed(3),
        unit: 's',
      },
      frequency: {
        label: 'Frequency',
        value: data.frequency.toFixed(2),
        unit: 'Hz',
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
    // 清理3D对象
    if (this.pivot) {
      this.removeFromScene(this.pivot);
      this.pivot.geometry.dispose();
      (this.pivot.material as THREE.Material).dispose();
    }
    if (this.string) {
      this.removeFromScene(this.string);
      this.string.geometry.dispose();
      this.string.material.dispose();
    }
    if (this.bob) {
      this.removeFromScene(this.bob);
      this.bob.geometry.dispose();
      this.bob.material.dispose();
    }
    if (this.velocityArrow) {
      this.removeFromScene(this.velocityArrow);
      this.velocityArrow.dispose();
    }

    super.dispose();
  }
}
```

---

### Task 3.2: 创建计时器组件

**Files:**
- Create: `src/components/experiment/Stopwatch.tsx`

**Step 1: 实现计时器UI**

创建 `src/components/experiment/Stopwatch.tsx`:

```typescript
import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface StopwatchProps {
  onPeriodsChange: (periods: number) => void;
  onTimeChange: (time: number) => void;
}

export function Stopwatch({ onPeriodsChange, onTimeChange }: StopwatchProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [periods, setPeriods] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isRunning) {
      interval = setInterval(() => {
        setElapsedTime(prev => {
          const newTime = prev + 0.01; // 10ms更新
          onTimeChange(newTime);
          return newTime;
        });
      }, 10);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, onTimeChange]);

  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    const centiseconds = Math.floor((time % 1) * 100);

    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
  };

  const handleToggle = () => {
    setIsRunning(!isRunning);
  };

  const handleReset = () => {
    setIsRunning(false);
    setElapsedTime(0);
    setPeriods(0);
    onPeriodsChange(0);
    onTimeChange(0);
  };

  const handleIncrementPeriods = () => {
    setPeriods(prev => {
      const newPeriods = prev + 1;
      onPeriodsChange(newPeriods);
      return newPeriods;
    });
  };

  const handleDecrementPeriods = () => {
    setPeriods(prev => {
      const newPeriods = Math.max(0, prev - 1);
      onPeriodsChange(newPeriods);
      return newPeriods;
    });
  };

  return (
    <div className="space-y-4">
      {/* 时间显示 */}
      <div className="text-center">
        <div className="text-4xl font-mono font-bold text-white">
          {formatTime(elapsedTime)}
        </div>
      </div>

      {/* 控制按钮 */}
      <div className="flex gap-2">
        <button
          onClick={handleToggle}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-medium transition-all ${
            isRunning
              ? 'bg-orange-600 hover:bg-orange-700 text-white'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
          }`}
        >
          {isRunning ? <Pause size={18} /> : <Play size={18} />}
          {isRunning ? 'Stop' : 'Start'}
        </button>
        <button
          onClick={handleReset}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium transition-all"
        >
          <RotateCcw size={18} />
          Reset
        </button>
      </div>

      {/* 周期计数 */}
      <div className="space-y-2">
        <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
          Periods
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDecrementPeriods}
            className="w-10 h-10 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded-lg text-white font-bold transition-colors"
          >
            -
          </button>
          <div className="flex-1 text-center text-xl font-mono font-bold text-white">
            {periods}
          </div>
          <button
            onClick={handleIncrementPeriods}
            className="w-10 h-10 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded-lg text-white font-bold transition-colors"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

### Task 3.3: 实现重力加速度计算

**Files:**
- Create: `src/components/experiment/GravityCalculator.tsx`

**Step 1: 创建计算器组件**

创建 `src/components/experiment/GravityCalculator.tsx`:

```typescript
import React, { useMemo } from 'react';

interface GravityCalculatorProps {
  periods: number;        // 周期数
  totalTime: number;      // 总时间（s）
  pendulumLength: number;  // 摆长（m）
}

export function GravityCalculator({ periods, totalTime, pendulumLength }: GravityCalculatorProps) {
  const result = useMemo(() => {
    if (periods === 0 || totalTime === 0 || pendulumLength === 0) {
      return {
        period: 0,
        calculatedG: 0,
        theoreticalG: 9.80665,
        error: 0,
        errorPercent: 0,
      };
    }

    // 计算平均周期
    const period = totalTime / periods;

    // 计算重力加速度: g = 4π²L/T²
    const calculatedG = (4 * Math.PI * Math.PI * pendulumLength) / (period * period);

    // 理论值
    const theoreticalG = 9.80665;

    // 误差
    const error = Math.abs(calculatedG - theoreticalG);
    const errorPercent = (error / theoreticalG) * 100;

    return {
      period,
      calculatedG,
      theoreticalG,
      error,
      errorPercent,
    };
  }, [periods, totalTime, pendulumLength]);

  return (
    <div className="space-y-3 p-4 bg-slate-800/50 rounded-lg border border-white/10">
      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
        Results
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-400">Period (T):</span>
          <span className="font-mono text-white">{result.period.toFixed(3)} s</span>
        </div>

        <div className="flex justify-between">
          <span className="text-slate-400">Calculated g:</span>
          <span className="font-mono text-green-400">{result.calculatedG.toFixed(2)} m/s²</span>
        </div>

        <div className="flex justify-between">
          <span className="text-slate-400">Theoretical g:</span>
          <span className="font-mono text-slate-500">{result.theoreticalG.toFixed(2)} m/s²</span>
        </div>

        <div className="flex justify-between">
          <span className="text-slate-400">Error:</span>
          <span className={`font-mono ${
            result.errorPercent < 5 ? 'text-green-400' :
            result.errorPercent < 10 ? 'text-yellow-400' :
            'text-red-400'
          }`}>
            {result.errorPercent.toFixed(2)}%
          </span>
        </div>
      </div>

      {/* 公式显示 */}
      <div className="pt-3 border-t border-white/10">
        <div className="text-xs text-slate-500 text-center">
          g = 4π²L/T²
        </div>
      </div>
    </div>
  );
}
```

---

### Task 3.4: 创建单摆控制面板

**Files:**
- Create: `src/components/experiment/PendulumControlPanel.tsx`

**Step 1: 集成计时器和计算器**

创建 `src/components/experiment/PendulumControlPanel.tsx`:

```typescript
import React, { useState } from 'react';
import { Stopwatch } from './Stopwatch';
import { GravityCalculator } from './GravityCalculator';

interface PendulumControlPanelProps {
  pendulumLength: number;
  onLengthChange: (length: number) => void;
  mass: number;
  onMassChange: (mass: number) => void;
  initialAngle: number;
  onAngleChange: (angle: number) => void;
}

export function PendulumControlPanel({
  pendulumLength,
  onLengthChange,
  mass,
  onMassChange,
  initialAngle,
  onAngleChange,
}: PendulumControlPanelProps) {
  const [periods, setPeriods] = useState(0);
  const [totalTime, setTotalTime] = useState(0);

  return (
    <div className="space-y-4">
      {/* 参数控制 */}
      <div className="space-y-3">
        <div>
          <label className="text-xs text-slate-400 font-medium uppercase tracking-wider">
            Pendulum Length
          </label>
          <input
            type="range"
            min={0.5}
            max={10}
            step={0.1}
            value={pendulumLength}
            onChange={(e) => onLengthChange(parseFloat(e.target.value))}
            className="w-full"
          />
          <div className="text-right text-sm text-blue-400 mt-1">
            {pendulumLength.toFixed(1)} m
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-400 font-medium uppercase tracking-wider">
            Initial Angle
          </label>
          <input
            type="range"
            min={5}
            max={60}
            step={1}
            value={initialAngle}
            onChange={(e) => onAngleChange(parseFloat(e.target.value))}
            className="w-full"
          />
          <div className="text-right text-sm text-blue-400 mt-1">
            {initialAngle.toFixed(0)}°
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-400 font-medium uppercase tracking-wider">
            Bob Mass
          </label>
          <input
            type="range"
            min={0.1}
            max={10}
            step={0.1}
            value={mass}
            onChange={(e) => onMassChange(parseFloat(e.target.value))}
            className="w-full"
          />
          <div className="text-right text-sm text-blue-400 mt-1">
            {mass.toFixed(1)} kg
          </div>
        </div>
      </div>

      <div className="h-px bg-white/10"></div>

      {/* 计时器 */}
      <Stopwatch
        onPeriodsChange={setPeriods}
        onTimeChange={setTotalTime}
      />

      {/* 计算结果 */}
      <GravityCalculator
        periods={periods}
        totalTime={totalTime}
        pendulumLength={pendulumLength}
      />
    </div>
  );
}
```

---

## Phase 4: 地面与场景优化

### Task 4.1: 修改地面设计（纯色，无网格）

**Files:**
- Modify: `src/experiments/mechanics/pendulum/Pendulum.ts` (已在Task 3.1中实现)
- Modify: `src/experiments/mechanics/motion-collision/MotionCollisionLab.ts`

**Step 1: 在运动与碰撞实验室中创建纯色地面**

```typescript
private createGround(): void {
  if (!this.scene) return;

  const groundGeometry = new THREE.PlaneGeometry(100, 100);
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a1a2e,      // 深灰蓝色
    roughness: 0.9,
    metalness: 0.1,
  });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01; // 略低于y=0
  ground.receiveShadow = true;
  this.addToScene(ground);
}

protected async setupScene(): Promise<void> {
  if (!this.scene) return;

  // 创建地面
  this.createGround();

  // 添加默认球体
  this.addDefaultSphere();

  // 灯光设置
  this.setupLights();
}

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
```

---

### Task 4.2: 优化相机和光照

**Step 1: 设置默认相机位置**

在实验的config中已经定义了相机，确保提供良好的视角：

```typescript
camera: {
  position: [5, 5, 10],   // 俯视角度
  target: [0, 0, 0],      // 中心点
  fov: 50,
}
```

---

## Phase 5: 集成与测试

### Task 5.1: 更新ExperimentView集成新UI

**Files:**
- Modify: `src/pages/ExperimentView.tsx`

**Step 1: 集成TabPanel到实验视图**

```typescript
import { TabPanel } from '@/components/experiment/TabPanel';
import { ControlTab } from '@/components/experiment/ControlTab';
import { PendulumControlPanel } from '@/components/experiment/PendulumControlPanel';

// 在 ExperimentView 组件中
const isPendulum = experimentId === 'pendulum';
const isMotionLab = experimentId === 'motion-collision';

return (
  <div className="h-screen flex flex-col bg-slate-900">
    {/* 顶部导航栏 */}
    <header>...</header>

    {/* 3D场景 */}
    <main className="flex-1 relative">
      <SceneContainer>
        <ExperimentScene experiment={currentExperiment} />
      </SceneContainer>

      {/* 右侧控制面板 - 单摆实验 */}
      {isPendulum && (
        <TabPanel>
          <PendulumControlPanel
            pendulumLength={pendulumLength}
            onLengthChange={(length) => handleParam('length', length)}
            mass={mass}
            onMassChange={(mass) => handleParam('mass', mass)}
            initialAngle={initialAngle}
            onAngleChange={(angle) => handleParam('initialAngle', angle)}
          />
        </TabPanel>
      )}

      {/* 右侧控制面板 - 运动与碰撞实验室 */}
      {isMotionLab && (
        <TabPanel>
          <ControlTab />
        </TabPanel>
      )}
    </main>
  </div>
);
```

---

### Task 5.2: 更新首页实验卡片

**Files:**
- Modify: `src/pages/Home.tsx`
- Modify: `src/experiments/mechanics/index.ts`

**Step 1: 更新实验注册**

修改 `src/experiments/mechanics/index.ts`:

```typescript
export { ProjectileMotion } from './projectile-motion';
export { CircularMotion } from './circular-motion';
export { SimpleHarmonicMotion } from './simple-harmonic-motion';
export { Collision } from './collision';
export { MotionCollisionLab } from './motion-collision/MotionCollisionLab';  // 新增
export { Pendulum } from './pendulum/Pendulum';  // 新增
```

**Step 2: 更新首页实验卡片**

修改 `src/pages/Home.tsx`，替换原有的4个力学实验卡片为新的2个：

```typescript
const experiments: ExperimentCard[] = [
  {
    id: 'hydrogen-transitions',
    title: 'Hydrogen Atom',
    subtitle: 'Energy Level Transitions',
    diagram: <HydrogenAtomDiagram />,
    gradient: 'from-blue-900/20 via-purple-900/10 to-teal-900/20',
  },
  {
    id: 'rutherford-scattering',
    title: 'Rutherford',
    subtitle: 'Alpha Particle Scattering',
    diagram: <RutherfordScatteringDiagram />,
    gradient: 'from-red-900/20 via-orange-900/10 to-yellow-900/20',
  },
  {
    id: 'solar-system',
    title: 'Solar System',
    subtitle: 'Celestial Motion Simulation',
    diagram: <SolarSystemDiagram />,
    gradient: 'from-blue-900/20 via-cyan-900/10 to-indigo-900/20',
  },
  {
    id: 'motion-collision',  // 新实验ID
    title: 'Motion & Collision',
    subtitle: 'Objects, Trajectories, and Impacts',
    diagram: <MotionCollisionDiagram />,
    gradient: 'from-green-900/20 via-emerald-900/10 to-teal-900/20',
  },
  {
    id: 'pendulum',  // 新实验ID
    title: 'Pendulum',
    subtitle: 'Period Measurement & Gravity Calculation',
    diagram: <PendulumDiagram />,
    gradient: 'from-purple-900/20 via-pink-900/10 to-rose-900/20',
  },
];

// 添加新的SVG图表组件
const MotionCollisionDiagram = () => (
  // 创建显示球体、滑块、木板和斜面的SVG
);

const PendulumDiagram = () => (
  // 创建显示单摆的SVG
);
```

---

### Task 5.3: 测试所有功能

**Step 1: 功能测试清单**

```bash
# 1. 启动开发服务器
npm run dev

# 2. 测试运动与碰撞实验室
访问: http://localhost:5173/experiment/motion-collision

测试项:
- [ ] 默认有一个球体
- [ ] 可以添加球体、滑块、木板
- [ ] 可以删除物体
- [ ] 可以设置物体的初速度
- [ ] 物体运动正确（重力、碰撞）
- [ ] 轨迹显示/隐藏功能正常
- [ ] 监控面板显示实时数据
- [ ] 播放控制（开始/暂停/重置）正常

# 3. 测试单摆实验
访问: http://localhost:5173/experiment/pendulum

测试项:
- [ ] 摆长可调节
- [ ] 单摆运动正确（简谐运动）
- [ ] 计时器功能正常
- [ ] 周期计数功能正常
- [ ] 重力加速度计算正确
- [ ] 误差显示准确

# 4. 测试控制面板UI
- [ ] Tab切换正常（控制/监控）
- [ ] 面板展开/收起功能正常
- [ ] 所有滑块控制响应及时
- [ ] 实时数据更新流畅

# 5. 测试地面设计
- [ ] 地面为纯色（无网格）
- [ ] 光照和阴影效果良好
- [ ] 相机角度合适
```

---

## 附录A: 文件清单

### 新创建的文件

```
src/experiments/mechanics/motion-collision/
├── types/
│   ├── ObjectTypes.ts
│   └── RampTypes.ts
├── objects/
│   ├── PhysicsObject.ts
│   ├── Ramp.ts
│   └── index.ts
├── physics/
│   ├── PhysicsEngine.ts
│   └── index.ts
├── components/
│   ├── TrajectoryManager.ts
│   └── index.ts
├── MotionCollisionLab.ts
└── index.ts

src/experiments/mechanics/pendulum/
├── PendulumPhysics.ts
├── Pendulum.ts
└── index.ts

src/components/experiment/
├── TabPanel.tsx
├── ControlTab.tsx
├── PendulumControlPanel.tsx
├── Stopwatch.tsx
└── GravityCalculator.tsx
```

### 需要修改的文件

```
src/pages/ExperimentView.tsx
src/pages/Home.tsx
src/experiments/mechanics/index.ts
```

### 需要删除的文件

```
src/experiments/mechanics/projectile-motion/  # 合并到motion-collision
src/experiments/mechanics/collision/           # 合并到motion-collision
src/experiments/mechanics/simple-harmonic-motion/  # 替换为pendulum
```

---

## 附录B: 参数配置参考

### 运动与碰撞实验室默认参数

```typescript
{
  // 默认球体
  defaultSphere: {
    type: 'sphere',
    radius: 0.5,
    mass: 1.0,
    position: [0, 1, 0],
    velocity: [0, 0, 0],
    restitution: 0.8,
  },

  // 监控面板配置
  monitor: {
    quantities: ['velocity', 'acceleration', 'momentum', 'kineticEnergy', 'position'],
    refreshRate: 60, // Hz
    maxHistory: 500, // 数据点
  },

  // 轨迹配置
  trajectory: {
    show: true,
    maxPoints: 500,
    interval: 0.05, // s
    color: {
      sphere: 0x00ff41,
      box: 0x60a5fa,
      plank: 0xd8ca9d,
    },
  },
}
```

### 单摆实验默认参数

```typescript
{
  length: 2.0,        // m
  mass: 1.0,          // kg
  initialAngle: 30,   // degrees
  showVectors: true,

  // 计时器配置
  stopwatch: {
    maxPeriods: 100,
    refreshRate: 100, // Hz (10ms更新)
  },
}
```

---

## 附录C: 提交规范

### 每个Task完成后的提交

```bash
# Task 1.1
git add src/experiments/mechanics/motion-collision/types/
git add src/experiments/mechanics/motion-collision/objects/PhysicsObject.ts
git commit -m "feat(motion-collision): implement object system with sphere, box, and plank types"

# Task 1.2
git add src/experiments/mechanics/motion-collision/types/RampTypes.ts
git add src/experiments/mechanics/motion-collision/objects/Ramp.ts
git commit -m "feat(motion-collision): add ramp system for inclined plane experiments"

# Task 1.3
git add src/experiments/mechanics/motion-collision/physics/
git commit -m "feat(motion-collision): implement physics engine with collision detection and response"

# ... 依此类推
```

### 最终功能完成提交

```bash
git add .
git commit -m "feat(mechanics): complete refactor - merge experiments, add UI controls, integrate monitoring

Major changes:
- Merge projectile motion and collision into unified Motion & Collision Lab
- Refactor SHM experiment to Pendulum-only (remove spring oscillator)
- Create right-side Tab panel with Control and Monitor tabs
- Integrate PhysicsMonitor component for real-time data visualization
- Add stopwatch and gravity calculator for pendulum experiment
- Implement object system (sphere, box, plank, ramp)
- Update ground design (solid color, no grid)
- Update home page experiment cards

Technical details:
- Object types: sphere, box, plank with configurable mass and size
- Physics engine: gravity, collision detection, trajectory tracking
- UI: collapsible right panel with tabs for control and monitoring
- Pendulum: manual stopwatch, period counting, g calculation
- Monitor: velocity, acceleration, momentum, kinetic energy, position

All tests passing. Ready for review."
```

---

**计划完成！准备开始执行。**

两步执行选项：

**1. Subagent-Driven (推荐)** - 我在此会话中逐任务派发子代理，每个任务完成后进行代码审查，快速迭代。

**2. Parallel Session** - 在新会话中使用 executing-plans skill 批量执行。

你希望使用哪种方式？
