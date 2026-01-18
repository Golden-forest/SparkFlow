# 视图切换功能演示

## 功能概述

天体运动实验现在支持两种视图模式的无缝切换:

### 🌞 太阳系视图
- 观看所有行星围绕太阳运动
- 俯瞰整个太阳系
- 适合理解行星轨道和相对速度

### 🌍 卫星视图
- 聚焦地球及其卫星系统
- 近距离观察卫星轨道
- 适合理解卫星运动规律

## 使用方法

1. **进入实验**: 从首页选择"天体运动模拟"
2. **切换视图**: 使用控制面板中的"视图模式"下拉菜单
3. **观察变化**: 场景会即时显示对应的天体对象

## 功能特性

### ✅ 智能对象管理
- 太阳系视图: 显示所有行星,隐藏卫星
- 卫星视图: 只显示地球,显示所有卫星
- 切换即时生效,无需刷新

### ✅ 轨道显示控制
- 独立的"显示轨道"开关
- 视图切换时尊重当前设置
- 可随时开启或关闭

### ✅ 流畅的用户体验
- 防止重复切换
- 状态同步管理
- 响应式控制面板

## 技术实现

### 核心代码
```typescript
// 视图切换逻辑
private switchViewMode(mode: 'solar' | 'satellite'): void {
    if (mode === 'solar') {
        // 显示所有行星,隐藏卫星
        this.planets.forEach(p => {
            p.getMesh().visible = true;
            p.getOrbitLine().visible = this.showOrbits;
        });
        this.satellites.forEach(s => {
            s.getMesh().visible = false;
            s.getOrbitLine().visible = false;
        });
    } else {
        // 只显示地球和卫星
        this.planets.forEach(p => {
            const isEarth = p.getName() === '地球';
            p.getMesh().visible = isEarth;
            p.getOrbitLine().visible = isEarth && this.showOrbits;
        });
        this.satellites.forEach(s => {
            s.getMesh().visible = true;
            s.getOrbitLine().visible = this.showOrbits;
        });
    }
}
```

### 新增方法
- `Planet.getOrbitLine()`: 访问行星轨道线
- `Satellite.getOrbitLine()`: 访问卫星轨道线
- `switchViewMode()`: 核心视图切换逻辑

## 截图展示

### 太阳系视图
```
太阳在中心
↓
所有行星可见
↓
行星轨道显示
↓
卫星隐藏
```

### 卫星视图
```
地球在中心
↓
只有地球可见
↓
所有卫星可见
↓
卫星轨道显示
```

## 后续计划

**Task 4.2**: 相机动画
- 平滑的视图过渡动画
- 自动调整相机位置
- 增强视觉体验

## 反馈与建议

如有问题或建议,欢迎反馈!
