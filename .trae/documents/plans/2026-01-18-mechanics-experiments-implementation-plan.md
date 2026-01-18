# 高中物理力学实验批量开发实现计划

**创建日期**: 2026-01-18
**目标**: 扩展现有架构，开发4个核心力学实验
**策略**: 基于现有优秀架构进行扩展，而非从零重建

---

## 📋 开发范围

### 第一批实验（4个核心力学实验）

1. **抛体运动实验室** (Projectile Motion Lab)
   - 涵盖：自由落体、竖直上抛、平抛、斜抛
   - 可调参数：初速度矢量(vx, vy, vz)、重力加速度
   - 实时监控：速度、加速度、位置、动能、势能、机械能

2. **圆周运动模拟** (Circular Motion Simulator)
   - 涵盖：匀速圆周、竖直面圆周运动
   - 可调参数：角速度、半径、质量
   - 实时监控：线速度、向心力、向心加速度、周期

3. **简谐运动实验室** (Simple Harmonic Motion Lab)
   - 涵盖：弹簧振子、单摆
   - 可调参数：质量、劲度系数、摆长、振幅
   - 实时监控：位移、速度、加速度、动能、势能

4. **碰撞与动量守恒** (Collision & Momentum Conservation)
   - 涵盖：弹性碰撞、非弹性碰撞、完全非弹性碰撞
   - 可调参数：两物体质量、初速度、恢复系数
   - 实时监控：动量、动能、碰撞前后状态

---

## 🏗️ 架构设计：扩展现有基础设施

### 策略原则
> **不要从零开始，站在巨人的肩膀上**
> - ✅ 复用现有组件和模式
> - ✅ 扩展现有工具库
> - ✅ 提取通用模式为新组件

### 阶段 1: 扩展物理工具库

#### 1.1 扩展 `src/utils/math/physics-formulas.ts`

**现有内容**（保留）：
- `kineticEnergy()` - 动能计算
- `coulombForce()` - 库仑力（原子物理）
- `photonEnergy()` - 光子能量
- 等等...

**新增力学公式**：
```typescript
// ===== 运动学公式 =====

// 抛体运动位置计算（理想化模型，无空气阻力）
export function projectilePosition(
  t: number,
  v0: THREE.Vector3,
  g: number = 9.8
): THREE.Vector3 {
  return new THREE.Vector3(
    v0.x * t,
    v0.y * t,
    v0.z * t - 0.5 * g * t * t
  );
}

// 抛体运动速度计算
export function projectileVelocity(
  t: number,
  v0: THREE.Vector3,
  g: number = 9.8
): THREE.Vector3 {
  return new THREE.Vector3(v0.x, v0.y, v0.z - g * t);
}

// 圆周运动线速度
export function circularVelocity(omega: number, radius: number): number {
  return omega * radius;
}

// 圆周运动向心加速度
export function centripetalAcceleration(omega: number, radius: number): number {
  return omega * omega * radius;
}

// 圆周运动向心力
export function centripetalForce(mass: number, omega: number, radius: number): number {
  return mass * omega * omega * radius;
}

// ===== 简谐运动公式 =====

// 弹簧振子位移 x(t) = A * cos(ωt + φ)
export function springOscillation(
  t: number,
  amplitude: number,
  angularFrequency: number,
  phase: number = 0
): number {
  return amplitude * Math.cos(angularFrequency * t + phase);
}

// 弹簧振子速度 v(t) = -Aω * sin(ωt + φ)
export function springOscillationVelocity(
  t: number,
  amplitude: number,
  angularFrequency: number,
  phase: number = 0
): number {
  return -amplitude * angularFrequency * Math.sin(angularFrequency * t + phase);
}

// 弹簧劲度系数 ω = √(k/m)
export function springAngularFrequency(k: number, m: number): number {
  return Math.sqrt(k / m);
}

// 单摆周期 T = 2π * √(L/g) (小角度近似)
export function pendulumPeriod(length: number, g: number = 9.8): number {
  return 2 * Math.PI * Math.sqrt(length / g);
}

// 单摆角频率
export function pendulumAngularFrequency(length: number, g: number = 9.8): number {
  return Math.sqrt(g / length);
}

// 单摆位移（小角度近似）θ(t) = θ₀ * cos(ωt + φ)
export function pendulumOscillation(
  t: number,
  initialAngle: number,
  length: number,
  g: number = 9.8,
  phase: number = 0
): number {
  const omega = pendulumAngularFrequency(length, g);
  return initialAngle * Math.cos(omega * t + phase);
}

// ===== 能量公式 =====

// 重力势能 Ep = mgh
export function gravitationalPotentialEnergy(
  mass: number,
  height: number,
  g: number = 9.8
): number {
  return mass * g * height;
}

// 弹性势能 Ep = ½kx²
export function elasticPotentialEnergy(
  k: number,
  displacement: number
): number {
  return 0.5 * k * displacement * displacement;
}

// 机械能 E = Ek + Ep
export function mechanicalEnergy(
  kineticEnergy: number,
  potentialEnergy: number
): number {
  return kineticEnergy + potentialEnergy;
}

// ===== 动量与碰撞公式 =====

// 动量 p = mv
export function momentum(mass: number, velocity: number): number {
  return mass * velocity;
}

// 一维碰撞后速度（基于恢复系数）
export function collisionVelocity(
  m1: number,
  v1: number,
  m2: number,
  v2: number,
  restitution: number // 0=完全非弹性, 1=弹性
): { v1Final: number; v2Final: number } {
  const totalMass = m1 + m2;
  const v1Final = ((m1 - restitution * m2) * v1 + (1 + restitution) * m2 * v2) / totalMass;
  const v2Final = ((1 + restitution) * m1 * v1 + (m2 - restitution * m1) * v2) / totalMass;
  return { v1Final, v2Final };
}

// 碰撞后动能
export function kineticEnergyAfterCollision(
  m1: number,
  v1: number,
  m2: number,
  v2: number
): number {
  return kineticEnergy(m1, v1) + kineticEnergy(m2, v2);
}

// 动量损失（用于非弹性碰撞）
export function momentumLoss(
  m1: number,
  v1_initial: number,
  v1_final: number,
  m2: number,
  v2_initial: number,
  v2_final: number
): number {
  const p_initial = Math.abs(momentum(m1, v1_initial) + momentum(m2, v2_initial));
  const p_final = Math.abs(momentum(m1, v1_final) + momentum(m2, v2_final));
  return p_initial - p_final;
}
```

#### 1.2 扩展 `src/utils/constants.ts`

**新增内容**：
```typescript
// 力学实验类别
export const MechanicsExperimentType = {
  PROJECTILE_MOTION: 'projectile-motion',
  CIRCULAR_MOTION: 'circular-motion',
  SIMPLE_HARMONIC_MOTION: 'simple-harmonic-motion',
  COLLISION: 'collision',
} as const;

export type MechanicsExperimentType = typeof MechanicsExperimentType[keyof typeof MechanicsExperimentType];

// 标准重力加速度 (m/s²)
export const STANDARD_GRAVITY = 9.80665;

// 地球表面重力加速度近似值
export const EARTH_GRAVITY = 9.8;

// 空气阻力系数（可选，虽然我们使用理想化模型）
export const AIR_DENSITY = 1.225; // kg/m³ at sea level
```

---

### 阶段 2: 创建可复用的力学组件

#### 2.1 创建 `src/components/physics/` 目录（新增）

**组件结构**：
```
src/components/physics/
├── VectorArrow.tsx       # 矢量箭头可视化（速度、加速度、力）
├── TrajectoryLine.tsx    # 运动轨迹线
├── PhysicsObject.tsx     # 通用物理对象（球体、方块等）
└── index.ts
```

##### 2.1.1 `VectorArrow.tsx` - 矢量箭头组件

**功能**：
- 在3D场景中绘制矢量箭头（速度、加速度、力等）
- 支持自定义颜色、大小、标签
- 动态更新箭头方向和大小

**接口设计**：
```typescript
interface VectorArrowProps {
  vector: THREE.Vector3;      // 矢量方向和大小
  origin: THREE.Vector3;      // 箭头起点
  color?: string;             // 颜色（默认红色）
  scale?: number;             // 缩放系数
  label?: string;             // 标签文本
  visible?: boolean;          // 可见性
}

export function VectorArrow({
  vector,
  origin,
  color = '#ff0000',
  scale = 1,
  label,
  visible = true,
}: VectorArrowProps): JSX.Element | null {
  if (!visible) return null;

  // 使用 THREE.ArrowHelper 或自定义箭头网格
  // 返回 JSX 元素
}
```

**实现要点**：
- 使用 `@react-three/drei` 的 `<ArrowHelper>` 或自定义 `THREE.ArrowHelper`
- 支持动态更新（使用 React Three Fiber 的 `useFrame`）
- 可选的文本标签（使用 `Text3D` 或 `Html` 组件）

##### 2.1.2 `TrajectoryLine.tsx` - 轨迹线组件

**功能**：
- 绘制物体的运动轨迹
- 支持实时更新和淡出效果
- 可配置最大点数和更新频率

**接口设计**：
```typescript
interface TrajectoryLineProps {
  positions: THREE.Vector3[];  // 历史位置点
  color?: string;              // 线条颜色
  maxPoints?: number;          // 最大点数（防止内存溢出）
  visible?: boolean;           // 可见性
}

export function TrajectoryLine({
  positions,
  color = '#00ff00',
  maxPoints = 500,
  visible = true,
}: TrajectoryLineProps): JSX.Element | null {
  if (!visible || positions.length < 2) return null;

  // 使用 THREE.Line 或 THREE.Line2
}
```

**实现要点**：
- 使用 `THREE.BufferGeometry` 动态更新顶点
- 性能优化：限制最大点数，定期清理旧数据
- 参考 `RutherfordExperiment.ts:233` 的轨迹线实现

##### 2.1.3 `PhysicsObject.tsx` - 通用物理对象

**功能**：
- 封装常见的物理对象（球体、方块、平面）
- 集成 VectorArrow 和 TrajectoryLine
- 支持物理属性（质量、速度、加速度）

**接口设计**：
```typescript
interface PhysicsObjectProps {
  type: 'sphere' | 'box' | 'plane';
  size: number | [number, number, number];  // 半径或长宽高
  mass?: number;
  position?: THREE.Vector3;
  velocity?: THREE.Vector3;
  acceleration?: THREE.Vector3;
  color?: string;
  showVelocity?: boolean;        // 显示速度矢量
  showAcceleration?: boolean;    // 显示加速度矢量
  showTrajectory?: boolean;      // 显示轨迹
  trajectoryColor?: string;      // 轨迹颜色
}

export function PhysicsObject({
  type,
  size,
  mass = 1,
  position = new THREE.Vector3(0, 0, 0),
  velocity = new THREE.Vector3(0, 0, 0),
  acceleration = new THREE.Vector3(0, 0, 0),
  color = '#ffffff',
  showVelocity = false,
  showAcceleration = false,
  showTrajectory = false,
  trajectoryColor = '#00ff00',
}: PhysicsObjectProps): JSX.Element {
  // 返回包含几何体、矢量箭头、轨迹线的组合组件
}
```

**实现要点**：
- 使用 React Three Fiber 的 `<mesh>` 组件
- 集成 `VectorArrow` 和 `TrajectoryLine` 子组件
- 保持状态管理（位置、速度、加速度的历史记录）

---

### 阶段 3: 扩展监控系统（复用 SideToolbar 设计）

#### 3.1 创建 `src/components/monitoring/` 目录（新增）

**组件结构**：
```
src/components/monitoring/
├── PhysicsMonitor.tsx      # 主监控面板（复用 SideToolbar 设计）
├── QuantityChart.tsx       # 物理量实时图表
├── QuantitySelector.tsx    # 物理量选择器
└── index.ts
```

##### 3.1.1 `PhysicsMonitor.tsx` - 可拖动监控面板

**设计灵感**：复用 `SideToolbar.tsx` 的设计模式
- 绝对定位在右侧
- 可折叠/展开（点击箭头切换）
- 可拖动调整宽度（使用 `react-resizable-panels`）
- 毛玻璃背景效果

**接口设计**：
```typescript
interface PhysicsMonitorProps {
  quantities: MonitoredQuantity[];      // 监控的物理量列表
  history: QuantityHistory;              // 历史数据
  selectedQuantities: string[];          // 用户选择的物理量
  onSelectionChange: (ids: string[]) => void;
  isExpanded: boolean;                   // 是否展开
  onToggleExpand: () => void;            // 切换展开/折叠
}

interface MonitoredQuantity {
  id: string;              // 唯一标识符
  name: string;            // 显示名称
  unit: string;            // 单位
  color: string;           // 图表颜色
  currentValue: number;    // 当前值
}

interface QuantityHistory {
  [quantityId: string]: number[];  // 每个物理量的历史值数组
}

export function PhysicsMonitor({
  quantities,
  history,
  selectedQuantities,
  onSelectionChange,
  isExpanded,
  onToggleExpand,
}: PhysicsMonitorProps): JSX.Element {
  // 返回可拖动的侧边面板
}
```

**实现要点**：
```typescript
// 使用 react-resizable-panels 实现拖动
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

export function PhysicsMonitor(props: PhysicsMonitorProps) {
  if (!isExpanded) {
    // 折叠状态：只显示一个箭头按钮
    return (
      <button
        onClick={onToggleExpand}
        className="absolute right-0 top-1/2 -translate-y-1/2 bg-slate-800 p-2 rounded-l-lg"
      >
        <ChevronLeft size={20} />
      </button>
    );
  }

  // 展开状态：显示完整面板
  return (
    <div className="absolute right-0 top-20 bottom-8 flex z-50">
      {/* 3D场景区域（自动缩小）*/}
      <PanelGroup direction="horizontal">
        <Panel defaultSize={70} minSize={30}>
          {/* 这里是3D场景区域，由父组件处理 */}
        </Panel>

        <PanelResizeHandle className="w-1 bg-white/10 hover:bg-white/20 cursor-col-resize" />

        <Panel defaultSize={30} minSize={20} maxSize={50}>
          {/* 监控面板内容 */}
          <div className="w-full h-full bg-slate-900/90 backdrop-blur-md rounded-l-2xl border border-white/10 p-5 overflow-y-auto">
            {/* 标题栏 */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">Physics Monitor</h3>
              <button onClick={onToggleExpand}>
                <ChevronRight size={20} />
              </button>
            </div>

            {/* 物理量选择器 */}
            <QuantitySelector
              quantities={quantities}
              selectedIds={selectedQuantities}
              onChange={onSelectionChange}
            />

            <div className="h-px bg-white/10 my-4" />

            {/* 实时数值面板 */}
            <div className="space-y-3">
              {selectedQuantities.map(id => {
                const quantity = quantities.find(q => q.id === id);
                return quantity ? (
                  <div key={id} className="bg-slate-800/50 rounded-lg p-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-400">{quantity.name}</span>
                      <span className="text-lg font-mono text-white">
                        {quantity.currentValue.toFixed(2)}
                        <span className="text-slate-500 ml-1">{quantity.unit}</span>
                      </span>
                    </div>
                  </div>
                ) : null;
              })}
            </div>

            <div className="h-px bg-white/10 my-4" />

            {/* 实时图表 */}
            <div className="space-y-4">
              {selectedQuantities.map(id => (
                <QuantityChart
                  key={id}
                  data={history[id] || []}
                  color={quantities.find(q => q.id === id)?.color || '#ffffff'}
                  unit={quantities.find(q => q.id === id)?.unit || ''}
                />
              ))}
            </div>
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}
```

**布局方案**：
```
初始状态（折叠）:
┌────────────────────────────────────┐ [▶]
│                                    │
│         3D Scene                   │
│                                    │
└────────────────────────────────────┘

展开状态:
┌────────────────────────────┬───────[◀]
│         3D Scene           │ Monitor│
│                            │ Panel  │
│                            │        │
└────────────────────────────┴────────┘
      ↑ 拖动调整宽度 ↑
```

##### 3.1.2 `QuantityChart.tsx` - 实时图表组件

**功能**：
- 显示物理量随时间的变化曲线
- 使用 `recharts` 库（轻量、React友好）
- 支持实时更新和数据滚动

**接口设计**：
```typescript
interface QuantityChartProps {
  data: number[];           // 历史数据数组
  color: string;            // 线条颜色
  unit: string;             // 单位
  maxPoints?: number;       // 最大显示点数（默认100）
  height?: number;          // 图表高度（默认150px）
}

export function QuantityChart({
  data,
  color,
  unit,
  maxPoints = 100,
  height = 150,
}: QuantityChartProps): JSX.Element {
  // 使用 recharts 的 LineChart
}
```

**实现要点**：
```typescript
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export function QuantityChart({ data, color, unit, maxPoints, height }: QuantityChartProps) {
  // 限制显示点数（只显示最近的 maxPoints 个数据点）
  const displayData = data.slice(-maxPoints).map((value, index) => ({
    index,
    value,
  }));

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={displayData}>
          <XAxis hide />
          <YAxis
            domain={['auto', 'auto']}
            tickFormatter={(value) => value.toFixed(1)}
            stroke="#64748b"
            tick={{ fill: '#94a3b8', fontSize: 10 }}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
            labelStyle={{ color: '#cbd5e1' }}
            formatter={(value: number) => [value.toFixed(2), unit]}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

**性能优化**：
- 使用 `isAnimationActive={false}` 禁用动画，提高实时更新性能
- 限制 `maxPoints` 避免内存溢出
- 使用 `ResponsiveContainer` 自适应容器大小

##### 3.1.3 `QuantitySelector.tsx` - 物理量选择器

**功能**：
- 复选框列表，选择要监控的物理量
- 支持全选/全不选
- 显示每个物理量的颜色标识

**接口设计**：
```typescript
interface QuantitySelectorProps {
  quantities: MonitoredQuantity[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function QuantitySelector({
  quantities,
  selectedIds,
  onChange,
}: QuantitySelectorProps): JSX.Element {
  // 复选框列表
}
```

**实现要点**：
```typescript
export function QuantitySelector({ quantities, selectedIds, onChange }: QuantitySelectorProps) {
  const handleToggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(sid => sid !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const handleSelectAll = () => {
    onChange(quantities.map(q => q.id));
  };

  const handleDeselectAll = () => {
    onChange([]);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
          Monitor Quantities
        </span>
        <div className="flex gap-1">
          <button
            onClick={handleSelectAll}
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            All
          </button>
          <span className="text-slate-600">|</span>
          <button
            onClick={handleDeselectAll}
            className="text-xs text-slate-400 hover:text-slate-300"
          >
            None
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {quantities.map(quantity => (
          <label
            key={quantity.id}
            className="flex items-center gap-2 cursor-pointer hover:bg-white/5 rounded p-1"
          >
            <input
              type="checkbox"
              checked={selectedIds.includes(quantity.id)}
              onChange={() => handleToggle(quantity.id)}
              className="rounded border-slate-600 text-blue-500 focus:ring-blue-500"
            />
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: quantity.color }}
            />
            <span className="text-sm text-slate-300">{quantity.name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
```

---

### 阶段 4: 实验实现（基于模板复制）

#### 4.1 创建实验目录结构

```bash
mkdir -p src/experiments/mechanics/projectile-motion
mkdir -p src/experiments/mechanics/circular-motion
mkdir -p src/experiments/mechanics/simple-harmonic-motion
mkdir -p src/experiments/mechanics/collision
mkdir -p src/experiments/mechanics/index.ts
```

**目录结构**（复制现有模式）：
```
src/experiments/mechanics/
├── projectile-motion/
│   ├── ProjectileMotion.ts           # 主实验类
│   ├── ProjectilePhysics.ts          # 物理计算
│   └── index.ts
├── circular-motion/
│   ├── CircularMotion.ts
│   ├── CircularPhysics.ts
│   └── index.ts
├── simple-harmonic-motion/
│   ├── SimpleHarmonicMotion.ts
│   ├── HarmonicPhysics.ts
│   └── index.ts
├── collision/
│   ├── Collision.ts
│   ├── CollisionPhysics.ts
│   └── index.ts
└── index.ts                           # 导出所有实验
```

#### 4.2 实现模板：抛体运动实验室（作为第一个实验）

**目标**：建立完整的力学实验模板，其他3个实验快速复制

##### 4.2.1 `ProjectilePhysics.ts` - 物理计算模块

```typescript
import * as THREE from 'three';
import {
  projectilePosition,
  projectileVelocity,
  kineticEnergy,
  gravitationalPotentialEnergy,
  mechanicalEnergy,
} from '@/utils/math/physics-formulas';
import { EARTH_GRAVITY } from '@/utils/constants';

/**
 * 抛体运动物理计算
 */

export interface ProjectileState {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  acceleration: THREE.Vector3;
  mass: number;
  time: number;
}

export interface ProjectileData {
  kineticEnergy: number;
  potentialEnergy: number;
  mechanicalEnergy: number;
  height: number;
  speed: number;
}

/**
 * 创建初始抛体状态
 */
export function createInitialProjectile(
  v0: THREE.Vector3,
  mass: number = 1,
  startPos: THREE.Vector3 = new THREE.Vector3(0, 0, 0)
): ProjectileState {
  return {
    position: startPos.clone(),
    velocity: v0.clone(),
    acceleration: new THREE.Vector3(0, 0, -EARTH_GRAVITY),
    mass,
    time: 0,
  };
}

/**
 * 更新抛体状态（使用理想化模型，无空气阻力）
 */
export function updateProjectile(
  state: ProjectileState,
  deltaTime: number
): ProjectileState {
  const newTime = state.time + deltaTime;

  // 使用公式计算新位置和速度
  const newPosition = projectilePosition(newTime, state.velocity, EARTH_GRAVITY).add(state.position);
  const newVelocity = projectileVelocity(newTime, state.velocity, EARTH_GRAVITY);

  return {
    ...state,
    position: newPosition,
    velocity: newVelocity,
    acceleration: new THREE.Vector3(0, 0, -EARTH_GRAVITY),
    time: newTime,
  };
}

/**
 * 计算抛体物理量数据
 */
export function calculateProjectileData(state: ProjectileState): ProjectileData {
  const speed = state.velocity.length();
  const height = state.position.z;
  const kineticEnergy_val = kineticEnergy(state.mass, speed);
  const potentialEnergy_val = gravitationalPotentialEnergy(state.mass, height);

  return {
    kineticEnergy: kineticEnergy_val,
    potentialEnergy: potentialEnergy_val,
    mechanicalEnergy: mechanicalEnergy(kineticEnergy_val, potentialEnergy_val),
    height,
    speed,
  };
}

/**
 * 判断抛体是否落地
 */
export function isLanded(state: ProjectileState, groundLevel: number = 0): boolean {
  return state.position.z <= groundLevel;
}
```

##### 4.2.2 `ProjectileMotion.ts` - 主实验类

```typescript
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
import { PhysicsObject } from '@/components/physics';

/**
 * 抛体运动实验室
 * 涵盖：自由落体、竖直上抛、平抛、斜抛
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
    this.addToScene(this.groundPlane);

    // 地面网格
    this.gridHelper = new THREE.GridHelper(100, 50, 0x444444, 0x222222);
    this.gridHelper.position.y = 0.01;
    this.addToScene(this.gridHelper);
  }

  private createGrid(): void {
    if (!this.scene) return;

    // 添加坐标轴辅助线
    const axesHelper = new THREE.AxesHelper(5);
    this.addToScene(axesHelper);
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

    // 清除旧的轨迹线（如果有）
    // TODO: 实现轨迹线清理
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
    }
  }

  update(deltaTime: number): void {
    if (!this.isRunning || !this.projectileState || this.hasLanded) return;

    // 更新物理状态
    this.projectileState = updateProjectile(this.projectileState, deltaTime);

    // 记录轨迹
    this.trajectoryHistory.push(this.projectileState.position.clone());
    this.projectileDataHistory.push(calculateProjectileData(this.projectileState));

    // 检查是否落地
    if (isLanded(this.projectileState, 0)) {
      this.hasLanded = true;
      // 修正位置到地面
      this.projectileState.position.z = 0.5;
      this.projectileState.velocity.set(0, 0, 0);
    }

    // 更新3D对象位置
    // TODO: 更新 PhysicsObject 组件的位置
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
    super.dispose();
  }
}
```

---

## 📦 依赖安装

需要安装的新依赖：

```bash
# 图表库
npm install recharts

# 可拖动面板
npm install react-resizable-panels
```

---

## 🎯 开发顺序

### 第1步：基础设施（1-2天）
1. ✅ 扩展 `physics-formulas.ts` 添加力学公式
2. ✅ 扩展 `constants.ts` 添加力学常量
3. ✅ 安装依赖：`recharts`, `react-resizable-panels`

### 第2步：可复用组件（2-3天）
4. ✅ 创建 `src/components/physics/` 目录
5. ✅ 实现 `VectorArrow.tsx`
6. ✅ 实现 `TrajectoryLine.tsx`
7. ✅ 实现 `PhysicsObject.tsx`

### 第3步：监控系统（2-3天）
8. ✅ 创建 `src/components/monitoring/` 目录
9. ✅ 实现 `PhysicsMonitor.tsx`（复用 SideToolbar 设计）
10. ✅ 实现 `QuantityChart.tsx`
11. ✅ 实现 `QuantitySelector.tsx`

### 第4步：实验实现（3-5天）
12. ✅ 创建 `src/experiments/mechanics/` 目录结构
13. ✅ 实现抛体运动实验（作为模板）
14. ✅ 复制模板实现圆周运动实验
15. ✅ 复制模板实现简谐运动实验
16. ✅ 复制模板实现碰撞实验

### 第5步：集成与优化（2-3天）
17. ✅ 在 `src/experiments/index.ts` 注册所有实验
18. ✅ 更新路由和导航
19. ✅ 性能优化和测试
20. ✅ 文档更新

**预计总时间**: 10-16 天

---

## 🧪 测试策略

### 单元测试
```typescript
// tests/unit/physics-formulas.test.ts
describe('projectilePosition', () => {
  it('should calculate position correctly', () => {
    const v0 = new THREE.Vector3(10, 0, 20);
    const t = 1;
    const position = projectilePosition(t, v0, 9.8);
    expect(position.x).toBe(10);
    expect(position.z).toBeCloseTo(15.1, 1); // 20 - 0.5*9.8*1²
  });
});
```

### 集成测试
- 验证实验生命周期（init → start → pause → resume → reset → dispose）
- 验证参数变化响应
- 验证数据输出格式

### E2E测试
- 使用 Playwright 测试UI交互
- 验证监控面板的展开/折叠
- 验证图表实时更新

---

## 📝 文档更新

### 更新 `CLAUDE.md`

在"开发方法论"部分添加：

```markdown
### 力学实验开发规范

1. **物理计算分离** - 所有物理公式放在 `{Experiment}Physics.ts` 文件中
2. **复用通用组件** - 优先使用 `VectorArrow`, `TrajectoryLine`, `PhysicsObject`
3. **监控系统标准化** - 所有力学实验必须支持 `PhysicsMonitor` 接口
4. **理想化模型声明** - 在实验描述中明确说明忽略的因素（如空气阻力）

### 可复用的力学组件

位于 `src/components/physics/`:
- **VectorArrow** - 矢量箭头可视化（速度、加速度、力）
- **TrajectoryLine** - 运动轨迹线绘制
- **PhysicsObject** - 通用物理对象封装

位于 `src/components/monitoring/`:
- **PhysicsMonitor** - 可拖动的监控面板（复用 SideToolbar 设计）
- **QuantityChart** - 物理量实时图表（基于 recharts）
- **QuantitySelector** - 物理量选择器
```

### 更新 CHANGELOG.md

```markdown
## 2026-01-18 - 力学实验模块

- ✨ 新增4个核心力学实验：抛体运动、圆周运动、简谐运动、碰撞
- ✨ 新增力学公式库（扩展 physics-formulas.ts）
- ✨ 新增可复用的物理组件（VectorArrow, TrajectoryLine, PhysicsObject）
- ✨ 新增可拖动的监控系统（PhysicsMonitor, QuantityChart）
- 📝 遵循理想化模型，明确忽略空气阻力等次要因素
```

---

## ✅ 验证清单

### 功能验证
- [ ] 所有4个实验可以正常启动、暂停、重置
- [ ] 监控面板可以展开/折叠，拖动调整宽度
- [ ] 图表实时更新，数据准确
- [ ] 矢量箭头和轨迹线正确显示
- [ ] 参数调整后物理现象正确变化

### 性能验证
- [ ] 帧率保持在 60 FPS
- [ ] 内存使用稳定（无泄漏）
- [ ] 轨迹线点数限制有效（防止内存溢出）

### 用户体验验证
- [ ] UI响应流畅
- [ ] 数据显示清晰
- [ ] 图表易读
- [ ] 物理量选择方便

---

## 🚀 后续扩展

基于这个架构，未来可以轻松扩展：

1. **更多力学实验**：
   - 斜面运动
   - 连接体问题
   - 流体阻力（可选，非理想化模型）

2. **电磁学实验**（复用相同架构）：
   - 电场线可视化
   - 磁场模拟
   - 电磁感应

3. **光学实验**（复用相同架构）：
   - 波的传播
   - 干涉和衍射
   - 折射和反射

---

*本计划基于现有架构扩展，充分利用已有的优秀设计：SceneContainer、ControlPanel、DataDisplay、SideToolbar 等*
