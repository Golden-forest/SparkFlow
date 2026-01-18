# 视图切换功能测试

## 测试目标
验证 Task 3.2 实现的视图切换逻辑是否正确工作

## 修改的文件
1. `/Users/hl/Projects/atomic_physics/src/experiments/celestial/solar-system/Planet.ts`
   - 添加了 `getOrbitLine()` 方法

2. `/Users/hl/Projects/atomic_physics/src/experiments/celestial/solar-system/Satellite.ts`
   - 添加了 `getOrbitLine()` 方法

3. `/Users/hl/Projects/atomic_physics/src/experiments/celestial/solar-system/SolarSystem.ts`
   - 添加了 `showOrbits` 状态变量
   - 增强了 `switchViewMode()` 方法
   - 优化了 `toggleOrbits()` 方法

## 实现的功能

### 1. 视图切换逻辑 (`switchViewMode`)

#### 太阳系视图 (solar)
- ✅ 显示所有行星
- ✅ 隐藏所有卫星
- ✅ 行星轨道显示取决于 `showOrbits` 参数

#### 卫星视图 (satellite)
- ✅ 只显示地球
- ✅ 隐藏其他行星
- ✅ 显示所有卫星
- ✅ 地球和卫星的轨道显示取决于 `showOrbits` 参数

### 2. 轨道显示控制 (`toggleOrbits`)

- ✅ 通过 `showOrbits` 参数统一控制所有轨道的可见性
- ✅ 视图切换时尊重当前的 `showOrbits` 状态
- ✅ 使用新添加的 `getOrbitLine()` 方法直接访问轨道线

### 3. 状态管理

- ✅ 跟踪当前视图模式 (`currentViewMode`)
- ✅ 跟踪轨道显示状态 (`showOrbits`)
- ✅ 避免重复切换到同一视图模式

## 预期行为

### 初始状态 (太阳系视图)
- 所有行星可见
- 所有卫星隐藏
- 轨道显示 (如果 `showOrbits = true`)

### 切换到卫星视图
- 只有地球可见
- 所有卫星可见
- 其他行星隐藏
- 轨道显示保持一致 (如果 `showOrbits = true`)

### 切回太阳系视图
- 所有行星可见
- 所有卫星隐藏
- 轨道显示保持一致 (如果 `showOrbits = true`)

### 关闭轨道显示
- 无论当前视图模式,所有轨道隐藏

### 开启轨道显示
- 无论当前视图模式,显示相应对象的所有轨道

## 手动测试步骤

1. 启动应用并进入天体运动实验
2. 观察初始状态 (太阳系视图)
3. 切换到卫星视图,验证:
   - 只有地球可见
   - 所有卫星可见
   - 轨道正确显示
4. 切换回太阳系视图,验证:
   - 所有行星可见
   - 所有卫星隐藏
5. 关闭轨道显示,验证:
   - 所有轨道隐藏
6. 开启轨道显示,验证:
   - 轨道重新显示

## 技术要点

1. **对象可见性控制**: 使用 `mesh.visible = true/false`
2. **轨道线访问**: 通过 `getOrbitLine()` 方法直接访问
3. **状态同步**: 视图切换和轨道显示控制相互独立但协同工作
4. **防重复切换**: 检查 `currentViewMode` 避免不必要的操作

## 后续任务 (Task 4.2)

相机动画将在下一个任务中实现,本任务只处理对象可见性。
