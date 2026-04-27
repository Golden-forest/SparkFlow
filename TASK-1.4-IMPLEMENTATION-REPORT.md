# Task 1.4 实现报告：轨迹系统（可开关）

## 📋 任务概述

根据重构计划（`docs/plans/2026-01-19-mechanics-experiments-refactor.md` 第453-573行），实现了一个完整的轨迹追踪系统，支持可视化物体运动轨迹并可通过参数控制显示/隐藏。

## ✅ 实现内容

### 1. 创建 TrajectoryManager 工具类

**文件**: `src/experiments/mechanics/motion-collision/components/TrajectoryManager.ts`

#### 核心功能：

- **`MAX_POINTS` (500)**: 限制轨迹最大点数，防止内存溢出
- **`TRAIL_INTERVAL` (0.05s)**: 50ms时间间隔控制，防止过于频繁采样
- **`updateTrajectory()`**: 更新物体轨迹数据
  - 时间间隔检查（避免过度采样）
  - 添加当前位置到轨迹
  - 限制轨迹点数量
- **`createTrajectoryLine()`**: 创建THREE.Line轨迹线
  - 支持自定义颜色
  - 半透明效果（opacity: 0.6）
- **`updateTrajectoryGeometry()`**: 更新轨迹线几何体
  - 从轨迹点数组更新线几何
  - 少于2个点时隐藏轨迹线
- **`clearTrajectory()`**: 清除轨迹数据

#### 设计特点：
- **无状态工具类**: 所有方法都是静态的，不维护实例状态
- **性能优化**: 通过时间间隔和最大点数限制优化性能
- **内存安全**: 自动移除超出限制的旧轨迹点

### 2. 集成到 MotionCollisionLab

**文件**: `src/experiments/mechanics/motion-collision/MotionCollisionLab.ts`

#### 新增属性：

```typescript
private trajectoryLines: Map<string, THREE.Line> = new Map();
private showTrajectory = true; // 参数控制
```

#### 修改的方法：

1. **`updateTrajectories()`** - 完全重写
   - 为每个物体更新轨迹数据
   - 动态创建轨迹线（首次使用时）
   - 根据物体类型设置不同颜色
     - sphere: `0x00ff41` (绿色)
     - box: `0x60a5fa` (蓝色)
   - 更新轨迹线几何体
   - 根据`showTrajectory`参数控制可见性

2. **`setParameter()`** - 新增方法
   - 支持`showTrajectory`参数动态修改
   - 实时更新所有轨迹线的可见性

3. **`removeObject()`** - 增强资源清理
   - 移除物体时同步清理对应的轨迹线
   - 正确释放几何体和材质资源

4. **`onReset()`** - 增强重置逻辑
   - 使用`TrajectoryManager.clearTrajectory()`清除轨迹
   - 清空所有轨迹线的几何体

5. **`dispose()`** - 完善资源释放
   - 在实验销毁时清理所有轨迹线
   - 确保无内存泄漏

### 3. 创建索引文件

**文件**: `src/experiments/mechanics/motion-collision/components/index.ts`

导出`TrajectoryManager`以便其他模块使用。

## 🔍 验证结果

### TypeScript 编译
✅ 通过 - 无类型错误

### 功能验证
✅ 所有计划要求均已实现：

- ✅ TrajectoryManager类使用静态方法
- ✅ 时间间隔控制（TRAIL_INTERVAL = 0.05）
- ✅ 最大点数限制（MAX_POINTS = 500）
- ✅ 不同物体类型使用不同颜色
- ✅ showTrajectory参数控制
- ✅ 正确的资源清理（removeObject, dispose, onReset）
- ✅ 轨迹线几何体正确更新

### 运行验证脚本
✅ 所有检查项通过（见 `verify-trajectory-system.js` 输出）

## 📂 修改的文件

### 新建文件
1. `/src/experiments/mechanics/motion-collision/components/TrajectoryManager.ts`
2. `/src/experiments/mechanics/motion-collision/components/index.ts`

### 修改文件
1. `/src/experiments/mechanics/motion-collision/MotionCollisionLab.ts`
   - 导入 TrajectoryManager
   - 添加 trajectoryLines 和 showTrajectory 属性
   - 重写 updateTrajectories() 方法
   - 新增 setParameter() 方法
   - 增强 removeObject() 方法
   - 更新 onReset() 方法
   - 完善 dispose() 方法

## 🎯 关键设计决策

### 1. 静态方法 vs 实例方法
**决策**: 使用静态方法
**理由**: TrajectoryManager 是无状态工具类，不需要维护实例状态，静态方法更简洁高效

### 2. 时间间隔控制
**决策**: 50ms 采样间隔
**理由**:
- 平滑的轨迹显示（20 FPS）
- 避免过多点导致性能问题
- 与物理引擎更新频率相匹配

### 3. 最大点数限制
**决策**: 500个点
**理由**:
- 足够长的历史轨迹用于观察运动
- 限制内存使用（每个点约24字节，500点约12KB）
- 性能友好

### 4. 颜色编码
**决策**: sphere绿色(0x00ff41), box蓝色(0x60a5fa)
**理由**:
- 与物体材质颜色一致，视觉统一
- 便于区分不同类型物体的轨迹
- 符合项目UI规范

## 🔧 技术亮点

1. **性能优化**
   - 时间间隔采样避免过度绘制
   - 点数限制防止内存溢出
   - 静态方法减少实例开销

2. **资源管理**
   - 完整的资源生命周期管理
   - removeObject, onReset, dispose三个层次清理
   - 正确的Three.js资源释放

3. **用户体验**
   - 实时参数调整（showTrajectory）
   - 半透明轨迹线不遮挡物体
   - 不同颜色区分物体类型

4. **代码质量**
   - TypeScript类型安全
   - 清晰的注释和文档
   - 遵循项目规范

## 🚀 后续优化建议

1. **轨迹样式定制**
   - 允许用户自定义轨迹颜色和粗细
   - 支持轨迹渐变效果

2. **轨迹分析功能**
   - 显示轨迹总长度
   - 计算平均速度
   - 标记关键点（碰撞点、最高点等）

3. **性能监控**
   - 添加轨迹点数量统计
   - 监控帧率影响

4. **高级功能**
   - 轨迹预测
   - 多种轨迹显示模式（点线、虚线等）

## ✅ 总结

Task 1.4 已成功完成，实现了一个功能完整、性能优秀、资源管理正确的轨迹系统。所有代码遵循项目规范，通过TypeScript编译验证，符合重构计划的所有要求。

**实现时间**: 2026-01-19
**状态**: ✅ 完成
**验证**: ✅ 通过所有检查
