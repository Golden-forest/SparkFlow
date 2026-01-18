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
  maxPoints?: number;       // Maximum number of points to display (default: 100)
  height?: number;          // Chart height in pixels (default: 150)
}

/**
 * Real-time chart component for displaying physics quantity changes over time
 *
 * Uses recharts library to display a line chart that updates in real-time
 * as new data points arrive. Implements performance optimizations for smooth
 * rendering during rapid updates.
 *
 * Features:
 * - Data scrolling (shows only the most recent maxPoints)
 * - Auto-scaling Y-axis
 * - Performance optimizations (animations disabled)
 * - Custom tooltip with unit display
 *
 * @component
 */
export function QuantityChart({
  data,
  color,
  unit,
  maxPoints = 100,
  height = 150,
}: QuantityChartProps): JSX.Element {
  /**
   * Limit displayed data to most recent points for performance
   * Memoized to prevent recreation on every render
   */
  const displayData = useMemo(
    () =>
      data.slice(-maxPoints).map((value, index) => ({
        index,
        value,
      })),
    [data, maxPoints]
  );

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={displayData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          {/* Hide X-axis as we're showing a scrolling window */}
          <XAxis hide />

          {/* Y-axis with auto-scaling */}
          <YAxis
            domain={['auto', 'auto']}
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
            formatter={function(value: number) { return [value.toFixed(2), unit]; }}
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
