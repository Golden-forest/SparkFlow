# 运动与碰撞实验室功能完善实施计划

> **项目目标**: 完善Motion-Collision Lab的UI交互和数据监控功能，实现用户能够添加物体、设置物理参数、实时监测物理量的完整实验体验。

## 📊 项目背景

### 当前状态评估
- **物理引擎**: ⭐⭐⭐⭐⭐ 优秀（正确的物理公式，完善的功能）
- **架构设计**: ⭐⭐⭐⭐⭐ 优秀（模块化清晰，类型安全）
- **UI集成**: ⭐⭐☆☆☆ 待完善（占位符实现，需要连接）
- **功能完整度**: 50%（核心物理引擎完成，UI交互缺失）

### 用户需求
1. 添加物体：小球、滑块、木板、斜面
2. 设置物理参数：初速度、质量、受力情况
3. 物理运动符合真实物理规律
4. 实时监测：速度、加速度、动量、动能等变化

### 架构决策
✅ **不需要重写** - 当前架构优秀，采用渐进式扩展策略
✅ **保留现有代码** - PhysicsEngine、ObjectFactory、TrajectoryManager质量很高
✅ **补充缺失功能** - 加速度计算、UI集成、数据采集

---

## 🎯 实施阶段

### Phase 1: 核心物理计算增强 (预计2小时)

**目标**: 添加加速度计算，完善物理量数据输出

#### Task 1.1: 扩展SimulationObject接口
**文件**: `src/experiments/mechanics/motion-collision/types/ObjectTypes.ts`

**修改内容**:
```typescript
export interface SimulationObject extends PhysicsObjectConfig {
  mesh: THREE.Mesh;
  trajectory: THREE.Vector3[];
  isSelected: boolean;
  acceleration: THREE.Vector3; // 新增：加速度向量
}
```

**验证**: 类型检查通过，无编译错误

---

#### Task 1.2: 在PhysicsEngine中计算加速度
**文件**: `src/experiments/mechanics/motion-collision/physics/PhysicsEngine.ts`

**修改位置**: `updatePositions()` 方法（第14-27行）

**修改内容**:
```typescript
static updatePositions(
  objects: Map<string, SimulationObject>,
  deltaTime: number
): void {
  objects.forEach(obj => {
    // 初始化加速度（重力加速度）
    obj.acceleration = new THREE.Vector3(0, -EARTH_GRAVITY, 0);

    // 步骤1: 应用重力加速度更新速度
    obj.velocity.y -= EARTH_GRAVITY * deltaTime;

    // 步骤2: 使用新速度更新位置
    const displacement = obj.velocity.clone().multiplyScalar(deltaTime);
    obj.mesh.position.add(displacement);
    obj.position.copy(obj.mesh.position);
  });
}
```

**验证**:
- 编译通过
- 运行实验，控制台打印加速度值

**注意**: 碰撞时的加速度变化将在Task 1.3处理

---

#### Task 1.3: 处理碰撞时的加速度变化
**文件**: `src/experiments/mechanics/motion-collision/physics/PhysicsEngine.ts`

**修改位置**: `resolveCollision()` 方法（第120-181行）

**修改内容**:
在碰撞解决后，计算并更新加速度：
```typescript
static resolveCollision(
  obj1: SimulationObject,
  obj2: SimulationObject
): void {
  // ... 现有的位置修正代码 ...

  // 步骤2: 速度更新 - 弹性碰撞
  const v1Final = /* ... */;
  const v2Final = /* ... */;

  obj1.velocity.copy(v1Final);
  obj2.velocity.copy(v2Final);

  // 新增：更新加速度（碰撞产生瞬时加速度）
  const deltaV1 = v1Final.sub(v1).divideScalar(deltaTime);
  const deltaV2 = v2Final.sub(v2).divideScalar(deltaTime);

  obj1.acceleration.copy(deltaV1);
  obj2.acceleration.copy(deltaV2);
}
```

**注意**: 需要传入 deltaTime 参数，修改方法签名

**验证**:
- 两个物体碰撞时，加速度有瞬时变化
- 控制台打印碰撞前后的加速度值

---

#### Task 1.4: 在MotionCollisionLab中初始化加速度
**文件**: `src/experiments/mechanics/motion-collision/MotionCollisionLab.ts`

**修改位置**: `createObject()` 方法（第68-77行）

**修改内容**:
```typescript
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
```

**验证**: 创建物体后，acceleration属性存在且初始值为(0, -9.8, 0)

---

#### Task 1.5: 扩展getDisplayData()返回完整物理量
**文件**: `src/experiments/mechanics/motion-collision/MotionCollisionLab.ts`

**修改位置**: `getDisplayData()` 方法（第325-354行）

**修改内容**:
```typescript
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

    // 现有数据
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
```

**验证**:
- 运行实验，调用 `experiment.getDisplayData()`
- 确认返回数据包含 velocity, acceleration, momentum, kineticEnergy
- 数值计算正确（手动计算验证）

---

### Phase 2: 修复Store监控数据API (预计30分钟)

**目标**: 改进监控数据的增量更新机制

#### Task 2.1: 修改updateMonitoringHistory为增量更新
**文件**: `src/stores/simulationStore.ts`

**修改位置**: 第96行

**当前代码**:
```typescript
updateMonitoringHistory: (history) => set({ monitoringHistory: history }),
```

**修改为**:
```typescript
updateMonitoringHistory: (quantityId: string, value: number) => set(state => {
  const currentHistory = state.monitoringHistory[quantityId] || [];
  const newHistory = [...currentHistory, value].slice(-100); // 保留最新100个数据点

  return {
    monitoringHistory: {
      ...state.monitoringHistory,
      [quantityId]: newHistory,
    },
  };
}),
```

**验证**:
- 调用 `updateMonitoringHistory('velocity', 5.2)`
- 检查 `monitoringHistory.velocity` 是数组且包含5.2
- 多次调用后，数组长度不超过100

---

### Phase 3: 实现实时监控数据采集 (预计1.5小时)

**目标**: 在ExperimentView中添加数据采集逻辑，实时更新PhysicsMonitor

#### Task 3.1: 添加motion-collision数据采集useEffect
**文件**: `src/pages/ExperimentView.tsx`

**修改位置**: 在第230行后添加（pendulum数据采集逻辑之后）

**新增代码**:
```typescript
// Motion-collision lab monitoring data collection (Task 3.1)
useEffect(() => {
  if (!isMotionLab || !currentExperiment) return;

  const interval = setInterval(() => {
    const data = currentExperiment.getDisplayData();

    // Update monitoring history through store
    const { updateMonitoringHistory } = useSimulationStore.getState();
    const quantities = ['velocity', 'acceleration', 'momentum', 'kineticEnergy'];

    quantities.forEach(qid => {
      const value = safeNumberValue(data[qid]?.value);
      updateMonitoringHistory(qid, value);
    });
  }, 100); // Update every 100ms

  return () => clearInterval(interval);
}, [isMotionLab, currentExperiment]);
```

**验证**:
- 运行motion-collision实验
- 打开Monitor面板
- 确认velocity图表实时更新
- 数值与物理仿真一致

---

#### Task 3.2: 修改motionLabMonitoredQuantities使用真实数据
**文件**: `src/pages/ExperimentView.tsx`

**修改位置**: 第273-293行

**当前代码**:
```typescript
const motionLabMonitoredQuantities = useMemo((): MonitoredQuantity[] => {
  if (!isMotionLab) return [];

  // TODO: Task 5.2 - 从实际实验对象获取数据
  return [
    { id: 'velocity', currentValue: 0 },  // ❌ 硬编码
    { id: 'momentum', currentValue: 0 },  // ❌ 硬编码
  ];
}, [isMotionLab]);
```

**修改为**:
```typescript
const motionLabMonitoredQuantities = useMemo((): MonitoredQuantity[] => {
  if (!isMotionLab || !currentExperiment) return [];

  const data = currentExperiment.getDisplayData();

  return [
    {
      id: 'velocity',
      name: 'Velocity',
      unit: 'm/s',
      color: '#00ff41',
      currentValue: safeNumberValue(data.velocity?.value),
    },
    {
      id: 'acceleration',
      name: 'Acceleration',
      unit: 'm/s²',
      color: '#ff6b6b',
      currentValue: safeNumberValue(data.acceleration?.value),
    },
    {
      id: 'momentum',
      name: 'Momentum',
      unit: 'kg·m/s',
      color: '#60a5fa',
      currentValue: safeNumberValue(data.momentum?.value),
    },
    {
      id: 'kineticEnergy',
      name: 'Kinetic Energy',
      unit: 'J',
      color: '#fbbf24',
      currentValue: safeNumberValue(data.kineticEnergy?.value),
    },
  ];
}, [isMotionLab, currentExperiment]);
```

**验证**:
- Monitor面板显示4个物理量
- 数值与物理仿真一致
- 图表实时更新

---

#### Task 3.3: 更新默认选择的监控量
**文件**: `src/pages/ExperimentView.tsx`

**修改位置**: 第295行

**当前代码**:
```typescript
const [motionLabSelectedQuantities, setMotionLabSelectedQuantities] = useState<string[]>(['velocity']);
```

**修改为**:
```typescript
const [motionLabSelectedQuantities, setMotionLabSelectedQuantities] = useState<string[]>(['velocity', 'momentum', 'kineticEnergy']);
```

**验证**: Monitor面板默认显示velocity, momentum, kineticEnergy三个图表

---

### Phase 4: 扩展IExperiment接口支持动态对象管理 (预计30分钟)

**目标**: 为motion-collision专属API提供类型安全的访问方式

#### Task 4.1: 在IExperiment接口添加可选方法
**文件**: `src/experiments/base/IExperiment.ts`

**修改位置**: 第72-97行

**修改内容**:
```typescript
/**
 * 实验接口 - 所有实验必须实现此接口
 */
export interface IExperiment {
  // 元数据
  readonly metadata: ExperimentMetadata;
  readonly config: ExperimentConfig;

  // 生命周期方法
  init(scene: THREE.Scene): Promise<void>;
  start(): void;
  pause(): void;
  resume(): void;
  reset(): void;
  dispose(): void;

  // 每帧更新
  update(deltaTime: number): void;

  // 参数控制
  setParameter(key: string, value: number | string | boolean): void;
  getParameter(key: string): number | string | boolean;

  // 数据输出
  getDisplayData(): Record<string, DisplayValue>;

  // 事件处理(可选)
  onInteraction?(event: InteractionEvent): void;

  // 可选的动态对象管理接口（motion-collision专属）
  createObject?(config: any): any;
  removeObject?(id: string): boolean;
  addRamp?(config: any): void;
  removeRamp?(id: string): void;
  getSimulationObjects?(): Map<string, any>;
}
```

**验证**:
- TypeScript编译通过
- motion-collision实验实现这些方法后无类型错误

---

#### Task 4.2: 在MotionCollisionLab中实现可选接口方法
**文件**: `src/experiments/mechanics/motion-collision/MotionCollisionLab.ts`

**修改位置**: 在第20行后添加

**新增代码**:
```typescript
export class MotionCollisionLab extends ExperimentBase {
  // ... 现有代码 ...

  /**
   * 获取仿真对象集合（用于UI集成）
   */
  getSimulationObjects(): Map<string, SimulationObject> {
    return this.simulationObjects;
  }
}
```

**验证**:
- `experiment.getSimulationObjects()` 返回正确的Map
- Map包含当前所有仿真对象

---

### Phase 5: 实现UI交互功能 (预计2小时)

**目标**: 连接ObjectControlTab到实验实例，实现物体添加/删除/参数编辑

#### Task 5.1: 在ExperimentView中暴露motion-collision对象集合
**文件**: `src/pages/ExperimentView.tsx`

**修改位置**: 在第90行后添加（pendulum状态声明之后）

**新增代码**:
```typescript
// Motion-collision lab 特有状态
const [motionLabObjects, setMotionLabObjects] = useState<Map<string, SimulationObject>>(new Map());

// 同步motion-collision对象到React状态
useEffect(() => {
  if (!isMotionLab || !currentExperiment) return;

  const interval = setInterval(() => {
    const objects = (currentExperiment as any).getSimulationObjects?.() || new Map();
    setMotionLabObjects(objects);
  }, 200); // 每200ms同步一次

  return () => clearInterval(interval);
}, [isMotionLab, currentExperiment]);
```

**验证**:
- 添加物体后，motionLabObjects状态更新
- 删除物体后，motionLabObjects状态更新

---

#### Task 5.2: 实现物体添加处理器
**文件**: `src/pages/ExperimentView.tsx`

**修改位置**: 在第200行后添加（handlePendulumParam之后）

**新增代码**:
```typescript
const handleMotionLabAddObject = (type: 'sphere' | 'box' | 'plank') => {
  if (!currentExperiment || !currentExperiment.createObject) return;

  const config: any = {
    type,
    position: new THREE.Vector3(
      (Math.random() - 0.5) * 4, // x: -2 to 2
      2 + Math.random() * 2,     // y: 2 to 4
      (Math.random() - 0.5) * 4  // z: -2 to 2
    ),
    velocity: new THREE.Vector3(
      (Math.random() - 0.5) * 6, // vx: -3 to 3 m/s
      Math.random() * 2,         // vy: 0 to 2 m/s
      (Math.random() - 0.5) * 6  // vz: -3 to 3 m/s
    ),
    mass: 0.5 + Math.random() * 2, // 0.5 to 2.5 kg
  };

  // 根据类型添加特定属性
  if (type === 'sphere') {
    config.radius = 0.3 + Math.random() * 0.4; // 0.3 to 0.7 m
  } else if (type === 'box') {
    config.width = 0.5 + Math.random() * 1;   // 0.5 to 1.5 m
    config.height = 0.5 + Math.random() * 1;  // 0.5 to 1.5 m
    config.depth = 0.5 + Math.random() * 1;   // 0.5 to 1.5 m
  } else if (type === 'plank') {
    config.width = 2 + Math.random() * 2;     // 2 to 4 m
    config.height = 0.2;                      // 固定厚度
    config.depth = 0.8 + Math.random() * 0.4; // 0.8 to 1.2 m
  }

  const obj = currentExperiment.createObject(config);
  // 对象会自动添加到场景（在createObject内部处理）
};
```

**验证**:
- 点击"Add Sphere"按钮，场景中出现新球体
- 点击"Add Box"按钮，场景中出现新盒子
- 点击"Add Plank"按钮，场景中出现新木板
- 新物体的位置、速度、质量在合理范围内

---

#### Task 5.3: 实现物体删除处理器
**文件**: `src/pages/ExperimentView.tsx`

**修改位置**: 在handleMotionLabAddObject之后

**新增代码**:
```typescript
const handleMotionLabRemoveObject = (objectId: string) => {
  if (!currentExperiment || !currentExperiment.removeObject) return;

  const success = currentExperiment.removeObject(objectId);
  if (!success) {
    console.warn(`Failed to remove object ${objectId}`);
  }
};
```

**验证**:
- 点击物体列表中的删除按钮，物体从场景中消失
- 监控数据更新（objectCount减少）

---

#### Task 5.4: 实现物体参数更新处理器
**文件**: `src/pages/ExperimentView.tsx`

**修改位置**: 在handleMotionLabRemoveObject之后

**新增代码**:
```typescript
const handleMotionLabUpdateObject = (objectId: string, params: Partial<SimulationObject>) => {
  if (!isMotionLab || !currentExperiment) return;

  // 直接修改对象属性
  const objects = (currentExperiment as any).getSimulationObjects?.();
  if (!objects) return;

  const obj = objects.get(objectId);
  if (!obj) return;

  // 更新质量
  if (params.mass !== undefined) {
    obj.mass = params.mass;
  }

  // 更新速度
  if (params.velocity) {
    obj.velocity.copy(params.velocity);
  }

  // 注意：几何属性（radius, width, height, depth）需要重新创建mesh
  // 这里先实现质量和速度的实时调整
};
```

**验证**:
- 选中物体后，调整质量滑块，物体质量改变
- 修改Vx/Vy/Vz输入框，物体速度改变
- 调整参数后，动量、动能图表立即更新

---

#### Task 5.5: 连接ObjectControlTab到控制面板
**文件**: `src/pages/ExperimentView.tsx`

**修改位置**: 第463-484行

**当前代码**:
```typescript
{isMotionLab && (
  <TabPanel>
    <ControlTab
      controlContent={
        <div className="text-slate-400 text-sm p-4">
          <div className="mb-2 text-2xl">🚧 Under Construction</div>
        </div>
      }
      monitorContent={...PhysicsMonitor...}
    />
  </TabPanel>
)}
```

**修改为**:
```typescript
{isMotionLab && (
  <TabPanel>
    <ControlTab
      controlContent={
        <ObjectControlTab
          objects={motionLabObjects}
          onAddObject={handleMotionLabAddObject}
          onRemoveObject={handleMotionLabRemoveObject}
          onUpdateObject={handleMotionLabUpdateObject}
        />
      }
      monitorContent={
        <PhysicsMonitor
          quantities={motionLabMonitoredQuantities}
          history={monitoringHistory}
          selectedQuantities={motionLabSelectedQuantities}
          onSelectionChange={setMotionLabSelectedQuantities}
          isExpanded={isMotionLabMonitorExpanded}
          onToggleExpand={() => setIsMotionLabMonitorExpanded(!isMotionLabMonitorExpanded)}
        />
      }
    />
  </TabPanel>
)}
```

**导入ObjectControlTab**（在文件顶部）:
```typescript
import { ObjectControlTab } from '@/components/experiment/ControlTab';
```

**验证**:
- Control面板显示物体列表
- 点击添加按钮，物体成功添加
- 选中物体后，参数控制面板显示
- Monitor面板显示实时图表

---

### Phase 6: 添加轨迹显示开关UI (预计30分钟)

**目标**: 实现用户可切换轨迹显示的UI控件

#### Task 6.1: 在ControlTab中添加轨迹开关
**文件**: `src/pages/ExperimentView.tsx`

**修改位置**: 在ObjectControlTab之后添加轨迹控制组件

**新增代码**:
```typescript
// 在 controlContent 中添加
<div className="mt-4 pt-4 border-t border-white/10">
  <div className="flex items-center justify-between">
    <span className="text-sm text-slate-300">Show Trajectories</span>
    <button
      onClick={() => currentExperiment?.setParameter('showTrajectory', !showTrajectory)}
      className={`w-12 h-6 rounded-full transition-colors ${
        showTrajectory ? 'bg-blue-600' : 'bg-slate-700'
      }`}
    >
      <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
        showTrajectory ? 'translate-x-6' : 'translate-x-0.5'
      }`} />
    </button>
  </div>
</div>
```

**添加状态**:
```typescript
const [showTrajectory, setShowTrajectory] = useState(true);

// 同步参数变化
useEffect(() => {
  if (!isMotionLab || !currentExperiment) return;
  const value = currentExperiment.getParameter('showTrajectory');
  setShowTrajectory(value as boolean);
}, [isMotionLab, currentExperiment]);
```

**验证**:
- 点击开关，轨迹显示/隐藏
- 开关状态与实际显示一致

---

### Phase 7: 创建预设场景系统 (进阶功能，预计2小时)

**目标**: 提供一键加载经典力学实验场景

#### Task 7.1: 定义场景预设类型
**新文件**: `src/experiments/mechanics/motion-collision/presets/ScenePresets.ts`

**代码内容**:
```typescript
import type { SimulationObject } from '../types/ObjectTypes';
import type { RampConfig } from '../types/RampTypes';
import * as THREE from 'three';

export interface ScenePreset {
  id: string;
  name: string;
  description: string;
  objects: Omit<SimulationObject, 'mesh' | 'trajectory' | 'isSelected' | 'acceleration'>[];
  ramps?: RampConfig[];
}

export const SCENE_PRESETS: ScenePreset[] = [
  {
    id: 'free-fall',
    name: 'Free Fall',
    description: 'Single object free fall under gravity',
    objects: [
      {
        id: 'sphere-1',
        type: 'sphere',
        position: new THREE.Vector3(0, 5, 0),
        velocity: new THREE.Vector3(0, 0, 0),
        mass: 1.0,
        radius: 0.5,
        friction: 0.98,
        restitution: 0.8,
      },
    ],
  },
  {
    id: 'elastic-collision',
    name: 'Elastic Collision',
    description: 'Two spheres colliding elastically',
    objects: [
      {
        id: 'sphere-1',
        type: 'sphere',
        position: new THREE.Vector3(-3, 1, 0),
        velocity: new THREE.Vector3(3, 0, 0),
        mass: 1.0,
        radius: 0.5,
      },
      {
        id: 'sphere-2',
        type: 'sphere',
        position: new THREE.Vector3(3, 1, 0),
        velocity: new THREE.Vector3(-3, 0, 0),
        mass: 1.0,
        radius: 0.5,
      },
    ],
  },
  {
    id: 'projectile-motion',
    name: 'Projectile Motion',
    description: 'Ball launched at an angle',
    objects: [
      {
        id: 'sphere-1',
        type: 'sphere',
        position: new THREE.Vector3(-4, 1, 0),
        velocity: new THREE.Vector3(5, 5, 0), // 45° angle
        mass: 1.0,
        radius: 0.5,
      },
    ],
  },
];
```

**验证**: TypeScript编译通过

---

#### Task 7.2: 在MotionCollisionLab中添加场景加载方法
**文件**: `src/experiments/mechanics/motion-collision/MotionCollisionLab.ts`

**修改位置**: 在第320行后添加

**新增代码**:
```typescript
/**
 * 加载场景预设
 */
loadScenePreset(presetId: string): void {
  const preset = SCENE_PRESETS.find(p => p.id === presetId);
  if (!preset) {
    console.warn(`Scene preset ${presetId} not found`);
    return;
  }

  // 清除现有对象
  this.simulationObjects.forEach(obj => this.removeObject(obj.id));

  // 加载新对象
  preset.objects.forEach(objConfig => {
    const obj = this.createObject(objConfig);
    this.simulationObjects.set(obj.id, obj);
    this.addToScene(obj.mesh);
  });

  // 加载斜面（如果有）
  if (preset.ramps) {
    this.ramps.forEach(ramp => this.removeRamp(ramp.id));
    preset.ramps.forEach(rampConfig => {
      this.addRamp(rampConfig);
    });
  }

  // 重置时间
  this.simulationTime = 0;
}
```

**验证**:
- 调用 `loadScenePreset('elastic-collision')`
- 场景中出现两个球体
- 球体位置和速度与预设一致

---

#### Task 7.3: 创建场景选择器UI组件
**新文件**: `src/components/experiment/ScenePresetSelector.tsx`

**代码内容**:
```typescript
import React from 'react';
import { SCENE_PRESETS } from '@/experiments/mechanics/motion-collision/presets/ScenePresets';

interface ScenePresetSelectorProps {
  onLoadPreset: (presetId: string) => void;
}

export function ScenePresetSelector({ onLoadPreset }: ScenePresetSelectorProps) {
  return (
    <div className="space-y-2">
      <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
        Scene Presets
      </span>
      <div className="space-y-2 max-h-40 overflow-y-auto">
        {SCENE_PRESETS.map(preset => (
          <button
            key={preset.id}
            onClick={() => onLoadPreset(preset.id)}
            className="w-full p-3 bg-slate-800 hover:bg-slate-700 rounded-lg border border-white/10 transition-colors text-left"
          >
            <div className="text-sm text-white font-medium">{preset.name}</div>
            <div className="text-xs text-slate-400 mt-1">{preset.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
```

**验证**: 组件渲染正常，显示3个预设场景

---

#### Task 7.4: 集成场景选择器到ControlTab
**文件**: `src/pages/ExperimentView.tsx`

**修改位置**: 在ObjectControlTab之前添加

**新增代码**:
```typescript
const handleLoadScenePreset = (presetId: string) => {
  if (!currentExperiment) return;
  (currentExperiment as any).loadScenePreset?.(presetId);
};

// 在 controlContent 中添加
<ScenePresetSelector onLoadPreset={handleLoadScenePreset} />
```

**验证**:
- 点击预设场景按钮，场景正确加载
- 物理仿真正常运行

---

## 📋 验收标准

### 功能验收
1. ✅ 用户可以添加小球、滑块、木板（每种至少测试1次）
2. ✅ 用户可以删除物体
3. ✅ 用户可以调整物体的质量、初速度
4. ✅ Monitor面板实时显示velocity, acceleration, momentum, kineticEnergy
5. ✅ 图表数据与物理仿真一致（误差<5%）
6. ✅ 轨迹显示开关工作正常
7. ✅ 预设场景一键加载成功

### 性能验收
1. ✅ 60 FPS稳定运行（10个物体以内）
2. ✅ 数据采集不阻塞UI（100ms间隔）
3. ✅ 内存无泄漏（添加/删除物体20次后，内存增长<50MB）

### 代码质量验收
1. ✅ TypeScript编译无错误
2. ✅ ESLint无警告
3. ✅ 所有公共方法有JSDoc注释
4. ✅ 关键算法有中文注释说明

---

## ⏱️ 时间估算

| Phase | 任务数 | 预计时间 | 实际时间 |
|-------|--------|----------|----------|
| Phase 1 | 5 | 2h | ___ |
| Phase 2 | 1 | 0.5h | ___ |
| Phase 3 | 3 | 1.5h | ___ |
| Phase 4 | 2 | 0.5h | ___ |
| Phase 5 | 5 | 2h | ___ |
| Phase 6 | 1 | 0.5h | ___ |
| Phase 7 | 4 | 2h | ___ |
| **总计** | **21** | **9h** | **___** |

---

## 🚀 实施流程

1. **阅读计划** - 开发者完整阅读本计划（15分钟）
2. **Phase 1-3** - 完成核心物理计算和数据采集（4小时）
3. **Phase 4-5** - 完成UI交互功能（2.5小时）
4. **Phase 6** - 完成轨迹开关（30分钟）
5. **Phase 7** - 完成预设场景（2小时，可选）
6. **综合测试** - 验收标准检查（1小时）

---

## 📝 备注

### 架构优势保留
- ✅ PhysicsEngine物理公式保持不变
- ✅ ObjectFactory创建逻辑保持不变
- ✅ TrajectoryManager轨迹管理保持不变
- ✅ ExperimentBase基类保持不变

### 扩展策略
- ✅ 使用可选方法扩展IExperiment接口（不破坏现有实验）
- ✅ 使用类型断言访问motion-collision专属API（灵活但类型安全）
- ✅ 增量更新监控数据（性能优化）

### 未来扩展点
- ⏸️ Phase 8: 外力系统（风力、弹力、摩擦力）
- ⏸️ Phase 9: 斜面物理交互
- ⏸️ Phase 10: 数据导出（CSV、JSON）
- ⏸️ Phase 11: 多物体碰撞优化（空间分区）

---

**创建时间**: 2026-01-19
**预计完成**: 2026-01-19
**负责开发**: AI Subagent-Driven Development
**审查标准**: 功能验收 + 性能验收 + 代码质量验收
