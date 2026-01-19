import React, { useState } from 'react';
import { Stopwatch } from './Stopwatch';
import { GravityCalculator } from './GravityCalculator';

/**
 * Props for PendulumControlPanel component
 *
 * @param pendulumLength - Current pendulum length in meters (0.5-10)
 * @param onLengthChange - Callback when pendulum length changes
 * @param mass - Bob mass in kilograms (0.1-10)
 * @param onMassChange - Callback when mass changes
 * @param initialAngle - Initial angle in degrees (5-60)
 * @param onAngleChange - Callback when initial angle changes
 */
export interface PendulumControlPanelProps {
  pendulumLength: number;
  onLengthChange: (value: number) => void;
  mass: number;
  onMassChange: (value: number) => void;
  initialAngle: number;
  onAngleChange: (value: number) => void;
}

/**
 * PendulumControlPanel component for pendulum experiment controls
 *
 * Provides comprehensive controls for pendulum simulation including:
 * - Parameter adjustment (length, mass, initial angle)
 * - High-precision stopwatch for timing oscillations
 * - Gravitational acceleration calculator
 *
 * Features:
 * - Slider controls with real-time value display
 * - Integrated stopwatch with period counting
 * - Automatic gravity calculation from measured data
 * - Glassmorphism UI design matching project style
 *
 * @component
 */
export function PendulumControlPanel({
  pendulumLength,
  onLengthChange,
  mass,
  onMassChange,
  initialAngle,
  onAngleChange,
}: PendulumControlPanelProps) {
  // State for stopwatch and calculator integration
  const [periods, setPeriods] = useState(0);
  const [totalTime, setTotalTime] = useState(0);

  // Handle period changes from stopwatch
  const handlePeriodsChange = (newPeriods: number) => {
    setPeriods(newPeriods);
  };

  // Handle time changes from stopwatch
  const handleTimeChange = (newTime: number) => {
    setTotalTime(newTime);
  };

  // Input validation handlers with clamping
  const handleLengthChange = (value: number[]) => {
    const clampedValue = Math.max(0.5, Math.min(10, value[0]));
    onLengthChange(clampedValue);
  };

  const handleMassChange = (value: number[]) => {
    const clampedValue = Math.max(0.1, Math.min(10, value[0]));
    onMassChange(clampedValue);
  };

  const handleAngleChange = (value: number[]) => {
    const clampedValue = Math.max(5, Math.min(60, value[0]));
    onAngleChange(clampedValue);
  };

  return (
    <div className="space-y-4">
      {/* Section 1: Parameter Controls */}
      <div className="space-y-3">
        {/* Pendulum Length Control */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-slate-300">Pendulum Length</span>
            <span className="text-blue-400">{pendulumLength.toFixed(1)} m</span>
          </div>
          <input
            type="range"
            min={0.5}
            max={10}
            step={0.1}
            value={pendulumLength}
            onChange={(e) => onLengthChange(parseFloat(e.target.value))}
            className="w-full"
          />
        </div>

        {/* Initial Angle Control */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-slate-300">Initial Angle</span>
            <span className="text-blue-400">{initialAngle.toFixed(0)}°</span>
          </div>
          <input
            type="range"
            min={5}
            max={60}
            step={1}
            value={initialAngle}
            onChange={(e) => onAngleChange(parseFloat(e.target.value))}
            className="w-full"
          />
        </div>

        {/* Bob Mass Control */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-slate-300">Bob Mass</span>
            <span className="text-blue-400">{mass.toFixed(1)} kg</span>
          </div>
          <input
            type="range"
            min={0.1}
            max={10}
            step={0.1}
            value={mass}
            onChange={(e) => onMassChange(parseFloat(e.target.value))}
            className="w-full"
          />
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-white/10"></div>

      {/* Section 2: Stopwatch */}
      <div>
        <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
          Timer
        </span>
        <div className="mt-2">
          <Stopwatch
            onPeriodsChange={handlePeriodsChange}
            onTimeChange={handleTimeChange}
          />
        </div>
      </div>

      {/* Section 3: Gravity Calculator */}
      <div>
        <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
          Analysis
        </span>
        <div className="mt-2">
          <GravityCalculator
            periods={periods}
            totalTime={totalTime}
            pendulumLength={pendulumLength}
          />
        </div>
      </div>
    </div>
  );
}
