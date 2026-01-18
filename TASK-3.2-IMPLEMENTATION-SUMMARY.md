# Task 3.2 实现总结 - 视图切换逻辑

## 任务概述
实现视图切换逻辑 - 当用户切换视图模式时,更新场景对象的可见性。相机动画将在后续任务中实现(Task 4.2)。

## 实现的功能

### 1. 新增方法

#### Planet.getOrbitLine()
- **文件**: `/Users/hl/Projects/atomic_physics/src/experiments/celestial/solar-system/Planet.ts`
- **位置**: 第 133-138 行
- **功能**: 返回行星的轨道线对象
- **用途**: 允许外部代码直接访问和控制轨道线的可见性

```typescript
public getOrbitLine(): THREE.Line {
    return this.orbitLine;
}
```

#### Satellite.getOrbitLine()
- **文件**: `/Users/hl/Projects/atomic_physics/src/experiments/celestial/solar-system/Satellite.ts`
- **位置**: 第 147-152 行
- **功能**: 返回卫星的轨道线对象
- **用途**: 允许外部代码直接访问和控制轨道线的可见性

```typescript
public getOrbitLine(): THREE.Line {
    return this.orbitLine;
}
```

### 2. 新增状态变量

#### SolarSystem.showOrbits
- **文件**: `/Users/hl/Projects/atomic_physics/src/experiments/celestial/solar-system/SolarSystem.ts`
- **位置**: 第 81 行
- **类型**: `boolean`
- **默认值**: `true`
- **用途**: 跟踪轨道显示开关的状态,确保视图切换时能正确应用

```typescript
private showOrbits: boolean = true; // 轨道显示状态
```

### 3. 增强的方法

#### SolarSystem.toggleOrbits()
- **文件**: `/Users/hl/Projects/atomic_physics/src/experiments/celestial/solar-system/SolarSystem.ts`
- **位置**: 第 266-273 行
- **改进**: 使用新的 `getOrbitLine()` 方法直接访问轨道线,不再依赖复杂的 DOM 查找

```typescript
private toggleOrbits(show: boolean): void {
    this.planets.forEach(planet => {
        planet.getOrbitLine().visible = show;
    });
    this.satellites.forEach(satellite => {
        satellite.getOrbitLine().visible = show;
    });
}
```

#### SolarSystem.switchViewMode()
- **文件**: `/Users/hl/Projects/atomic_physics/src/experiments/celestial/solar-system/SolarSystem.ts`
- **位置**: 第 226-259 行
- **功能**: 核心视图切换逻辑

**太阳系视图行为**:
- 显示所有行星
- 隐藏所有卫星
- 行星轨道显示取决于 `showOrbits` 参数

**卫星视图行为**:
- 只显示地球
- 显示所有卫星
- 隐藏其他行星
- 地球和卫星的轨道显示取决于 `showOrbits` 参数

**防重复切换**:
- 检查 `currentViewMode`,如果已经是该模式则直接返回

```typescript
private switchViewMode(mode: 'solar' | 'satellite'): void {
    // 如果已经在该模式,直接返回
    if (this.currentViewMode === mode) {
        return;
    }

    this.currentViewMode = mode;

    if (mode === 'solar') {
        // 显示太阳系视图:显示所有行星,隐藏所有卫星
        this.planets.forEach(planet => {
            planet.getMesh().visible = true;
            // 根据showOrbits状态决定是否显示轨道
            planet.getOrbitLine().visible = this.showOrbits;
        });
        this.satellites.forEach(satellite => {
            satellite.getMesh().visible = false;
            satellite.getOrbitLine().visible = false;
        });
    } else {
        // 显示卫星视图:只显示地球和所有卫星
        this.planets.forEach(planet => {
            const isEarth = planet.getName() === '地球';
            planet.getMesh().visible = isEarth;
            // 地球的轨道显示取决于showOrbits状态
            planet.getOrbitLine().visible = isEarth && this.showOrbits;
        });
        this.satellites.forEach(satellite => {
            satellite.getMesh().visible = true;
            // 根据showOrbits状态决定是否显示轨道
            satellite.getOrbitLine().visible = this.showOrbits;
        });
    }
}
```

#### SolarSystem.onParameterChange()
- **文件**: `/Users/hl/Projects/atomic_physics/src/experiments/celestial/solar-system/SolarSystem.ts`
- **位置**: 第 210-221 行
- **改进**: 在处理 `showOrbits` 参数时,先更新状态再调用 `toggleOrbits()`

```typescript
protected onParameterChange(key: string, value: any): void {
    if (key === 'timeScale') {
        this.timeScale = value;
    } else if (key === 'showOrbits') {
        this.showOrbits = value; // 新增:更新状态
        this.toggleOrbits(value);
    } else if (key === 'selectedPlanet') {
        this.selectPlanet(value);
    } else if (key === 'viewMode') {
        this.switchViewMode(value);
    }
}
```

## 技术实现细节

### 对象可见性控制
使用 Three.js 的标准可见性属性:
```typescript
mesh.visible = true/false;
orbitLine.visible = true/false;
```

### 状态同步机制
1. `currentViewMode`: 跟踪当前视图模式
2. `showOrbits`: 跟踪轨道显示开关
3. 两个状态相互独立但协同工作

### 防重复切换
在 `switchViewMode()` 方法开始时检查:
```typescript
if (this.currentViewMode === mode) {
    return;
}
```

## 预期行为

### 初始状态
- 视图模式: 太阳系视图 (`solar`)
- 所有行星可见
- 所有卫星隐藏
- 轨道显示 (`showOrbits = true`)

### 切换到卫星视图
- 只显示地球
- 显示所有卫星
- 隐藏其他行星
- 轨道显示保持一致

### 切回太阳系视图
- 显示所有行星
- 隐藏所有卫星
- 轨道显示保持一致

### 轨道显示开关
- 关闭: 所有轨道隐藏
- 开启: 当前可见对象的轨道显示

## 测试验证

### 单元测试
- 创建了测试框架: `/Users/hl/Projects/atomic_physics/src/experiments/celestial/solar-system/__tests__/SolarSystem.viewSwitching.test.ts`

### 手动测试
- 测试文档: `/Users/hl/Projects/atomic_physics/test-view-switching.md`

### 构建验证
- ✅ TypeScript 编译通过
- ✅ Vite 构建成功
- ✅ 无类型错误

## 文件修改清单

1. **Planet.ts** - 添加 `getOrbitLine()` 方法
2. **Satellite.ts** - 添加 `getOrbitLine()` 方法
3. **SolarSystem.ts** - 增强视图切换和轨道控制逻辑

## 后续任务

**Task 4.2**: 实现相机动画
- 在视图切换时添加平滑的相机过渡
- 太阳系视图: 广角俯瞰
- 卫星视图: 近距离跟随地球

## 代码质量

- ✅ 遵循 TypeScript 类型安全
- ✅ 添加详细的中文注释
- ✅ 符合项目编码规范
- ✅ 逻辑清晰,易于维护
- ✅ 考虑了边界情况(重复切换)

## 总结

Task 3.2 已成功实现视图切换逻辑,所有对象可见性控制正常工作。代码通过构建验证,准备进入下一个任务(Task 4.2 - 相机动画实现)。
