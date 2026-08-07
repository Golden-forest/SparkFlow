import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

/**
 * Props for QuantityChart component
 */
export interface QuantityChartProps {
  data: number[];           // Historical data array
  color: string;            // Line color
  unit: string;             // Unit for display
  maxPoints?: number;       // Maximum number of points to display (default: 200)
  height?: number;          // Chart height in pixels (default: 150)
  yMin?: number;            // Fixed Y-axis lower bound (omit for auto)
  yMax?: number;            // Fixed Y-axis upper bound (omit for auto)
}

/**
 * Real-time chart component for displaying physics quantity changes over time
 *
 * Uses recharts library to display a line chart that accumulates over time.
 * Implements performance optimizations for smooth rendering during rapid updates.
 *
 * Features:
 * - X-axis accumulation: full history from start, left-aligned (origin stays)
 * - Y-axis fixed range (via yMin/yMax props) or auto
 * - Performance optimizations (animations disabled)
 * - Custom tooltip with unit display
 *
 * @component
 */
export function QuantityChart({
  data,
  color,
  unit,
  maxPoints = 200,
  height = 150,
  yMin,
  yMax,
}: QuantityChartProps) {
  /**
   * 累积模式：保留全部历史，仅当点数超过 maxPoints 时做等间隔抽样。
   * 与滚动窗口不同，左端始终是仿真起点，曲线从左向右持续生长。
   * 抽样保持首尾点，避免末端被截断。
   */
  const displayData = useMemo(() => {
    if (data.length <= maxPoints) {
      return data.map((value, index) => ({ index, value }));
    }
    // 等间隔抽样：保留 [0, step, 2*step, ..., last]
    const step = data.length / (maxPoints - 1);
    const sampled: { index: number; value: number }[] = [];
    for (let i = 0; i < maxPoints - 1; i++) {
      const srcIdx = Math.floor(i * step);
      sampled.push({ index: srcIdx, value: data[srcIdx] });
    }
    // 确保最后一个点为最新数据
    sampled.push({ index: data.length - 1, value: data[data.length - 1] });
    return sampled;
  }, [data, maxPoints]);

  // Y 轴 domain：传入则固定，否则 auto
  const yDomain: [number | string, number | string] =
    yMin !== undefined && yMax !== undefined
      ? [yMin, yMax]
      : ['auto', 'auto'];

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={displayData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          {/* X-axis: 累积模式，按全局索引显示，不滚动 */}
          <XAxis
            dataKey="index"
            hide
            type="number"
            domain={[0, 'dataMax']}
          />

          {/* Y-axis: 固定范围或 auto */}
          <YAxis
            domain={yDomain}
            tickFormatter={function(value: unknown) { return Number(value).toFixed(1); }}
            stroke="#64748b"
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            width={35}
          />

          {/* Custom tooltip */}
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: 'none',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            }}
            labelStyle={{ color: '#cbd5e1', fontSize: 12 }}
            itemStyle={{ color: '#fff', fontSize: 12 }}
            formatter={function(value: number | string | undefined) {
              const numeric = typeof value === 'number' ? value : Number(value ?? 0);
              return [numeric.toFixed(2), unit];
            }}
            cursor={{ stroke: color, strokeWidth: 1 }}
          />

          {/* The data line */}
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false} // Performance: disable animations for real-time updates
            activeDot={{ r: 4, fill: color, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
