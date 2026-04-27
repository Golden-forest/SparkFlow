# Stopwatch Component

## 概述

`Stopwatch` 是一个用于测量时间和计数的React组件,专为物理实验设计,特别适用于单摆实验等需要测量周期的场景。

## 功能特性

1. **高精度计时**
   - 10毫秒更新精度
   - 时间格式: MM:SS.ms (例如: 01:23.45)
   - 最大计时: 理论上无限制

2. **周期计数**
   - 手动计数按钮 (+/-)
   - 实时显示周期数量
   - 计数防负数保护

3. **回调接口**
   - `onPeriodsChange`: 周期数变化时触发
   - `onTimeChange`: 时间更新时触发
   - 支持父组件实时计算周期

4. **UI设计**
   - Glassmorphism 风格
   - 渐变按钮背景
   - 响应式布局
   - 悬停和禁用状态

## Props 接口

```typescript
interface StopwatchProps {
  onPeriodsChange?: (periods: number) => void;
  onTimeChange?: (time: number) => void;
}
```

### 参数说明

- **onPeriodsChange** (可选): 周期数变化时的回调函数
  - 参数: 当前周期数 (number)
  - 触发时机: 点击 + 或 - 按钮、重置时

- **onTimeChange** (可选): 时间更新时的回调函数
  - 参数: 当前时间 (number, 单位: 秒)
  - 触发时机: 计时器运行时每10毫秒触发一次、重置时

## 使用示例

### 基础用法

```tsx
import { Stopwatch } from '@/components/experiment';

function BasicExample() {
  return <Stopwatch />;
}
```

### 带计算的用法 (单摆实验)

```tsx
import { Stopwatch } from '@/components/experiment';

function PendulumExperiment() {
  const [periods, setPeriods] = useState(0);
  const [time, setTime] = useState(0);

  const calculateGravity = (period: number, length: number) => {
    const g = (4 * Math.PI * Math.PI * length) / (period * period);
    return g;
  };

  return (
    <div>
      <Stopwatch
        onPeriodsChange={setPeriods}
        onTimeChange={setTime}
      />

      {periods > 0 && time > 0 && (
        <div>
          <p>Average Period: {(time / periods).toFixed(3)}s</p>
          <p>
            Calculated g: {calculateGravity(time / periods, 1.0).toFixed(2)} m/s²
          </p>
        </div>
      )}
    </div>
  );
}
```

### 与物理引擎集成

```tsx
function PhysicsIntegration() {
  const [periods, setPeriods] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [endTime, setEndTime] = useState<number | null>(null);

  const handlePeriodsChange = (newPeriods: number) => {
    setPeriods(newPeriods);

    // 在单摆的最低点标记周期
    if (physicsEngine.isAtBottom()) {
      if (startTime === null) {
        setStartTime(performance.now());
      } else {
        setEndTime(performance.now());
      }
    }
  };

  return (
    <Stopwatch onPeriodsChange={handlePeriodsChange} />
  );
}
```

## 样式定制

组件使用 Tailwind CSS,可以通过以下方式自定义:

```tsx
// 包装容器自定义样式
<div className="custom-stopwatch-container">
  <Stopwatch />
</div>

// CSS 样式覆盖
.custom-stopwatch-container {
  background: linear-gradient(to bottom, #1a1a2e, #16213e);
  padding: 20px;
  border-radius: 12px;
}
```

## 技术实现

- **状态管理**: React Hooks (useState, useEffect, useCallback)
- **计时器**: setInterval (10ms 间隔)
- **内存优化**: useCallback 避免不必要的重新渲染
- **清理逻辑**: useEffect cleanup 函数确保定时器正确清除

## 注意事项

1. **时间精度**: 虽然更新间隔是10ms,但由于JavaScript事件循环特性,实际精度可能略有偏差
2. **长时间计时**: 对于长时间计时,建议使用 Date.now() 或 performance.now() 作为基准
3. **性能优化**: onTimeChange 回调频繁触发,应避免在回调中执行重计算
4. **可访问性**: 按钮已支持键盘导航和屏幕阅读器

## 未来改进

- [ ] 添加记录多个时间段的功能
- [ ] 支持计次模式 (记录每个周期的时间点)
- [ ] 添加导出数据功能 (CSV/JSON)
- [ ] 支持键盘快捷键 (Space 开始/暂停, R 重置)

## 相关组件

- `GravityCalculator`: 使用 Stopwatch 数据计算重力加速度
- `PendulumExperiment`: 单摆实验主组件
- `DataDisplay`: 显示实验数据

## 测试

组件包含完整的单元测试:

```bash
# 运行测试
npm test -- Stopwatch.test.tsx

# 查看覆盖率
npm run test:coverage
```

测试覆盖:
- ✓ 基础渲染
- ✓ 启动/暂停功能
- ✓ 重置功能
- ✓ 周期计数增减
- ✓ 回调函数触发
- ✓ 按钮禁用状态
- ✓ 时间格式化
