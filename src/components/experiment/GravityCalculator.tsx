import React, { useMemo } from 'react';

/**
 * Props for GravityCalculator component
 */
export interface GravityCalculatorProps {
  /** Number of periods counted */
  periods: number;
  /** Total elapsed time in seconds */
  totalTime: number;
  /** Pendulum length in meters */
  pendulumLength: number;
}

/**
 * GravityCalculator component for calculating gravitational acceleration
 *
 * Computes gravitational acceleration (g) from pendulum experiment data
 * using the formula: g = 4π²L/T²
 *
 * Features:
 * - Average period calculation
 * - Gravitational acceleration calculation
 * - Error analysis (absolute and percentage)
 * - Color-coded error display
 * - Formula display with KaTeX-ready format
 *
 * @component
 */
export function GravityCalculator({
  periods,
  totalTime,
  pendulumLength,
}: GravityCalculatorProps) {
  // Theoretical gravitational acceleration (standard value)
  const THEORETICAL_G = 9.80665;

  // Calculate all values using useMemo for performance optimization
  const calculations = useMemo(() => {
    // Handle edge cases
    if (periods <= 0 || totalTime <= 0 || pendulumLength <= 0) {
      return {
        period: 0,
        calculatedG: 0,
        absoluteError: 0,
        percentageError: 0,
        isValid: false,
      };
    }

    // Calculate average period: T = totalTime / periods
    const period = totalTime / periods;

    // Calculate gravitational acceleration: g = 4π²L/T²
    const calculatedG = (4 * Math.PI * Math.PI * pendulumLength) / (period * period);

    // Calculate absolute error: |calculatedG - theoreticalG|
    const absoluteError = Math.abs(calculatedG - THEORETICAL_G);

    // Calculate percentage error: (error / theoreticalG) * 100
    const percentageError = (absoluteError / THEORETICAL_G) * 100;

    return {
      period,
      calculatedG,
      absoluteError,
      percentageError,
      isValid: true,
    };
  }, [periods, totalTime, pendulumLength]);

  // Determine error color based on percentage error
  const getErrorColor = () => {
    if (!calculations.isValid) return 'text-slate-400';
    if (calculations.percentageError < 5) return 'text-emerald-400';
    if (calculations.percentageError < 10) return 'text-yellow-400';
    return 'text-red-400';
  };

  const errorColor = getErrorColor();

  return (
    <div className="bg-slate-800/50 rounded-lg p-4 border border-white/10">
      {/* Title */}
      <div className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-3">
        Results
      </div>

      {/* Results Display */}
      <div className="space-y-3">
        {/* Period */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-300">Period (T)</span>
          <span className="text-lg font-mono font-bold text-white">
            {calculations.isValid ? calculations.period.toFixed(3) : '0.000'} s
          </span>
        </div>

        {/* Calculated Gravitational Acceleration */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-300">Calculated g</span>
          <span className="text-lg font-mono font-bold text-emerald-400">
            {calculations.isValid ? calculations.calculatedG.toFixed(3) : '0.000'} m/s²
          </span>
        </div>

        {/* Theoretical Gravitational Acceleration */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-300">Theoretical g</span>
          <span className="text-lg font-mono font-bold text-slate-400">
            {THEORETICAL_G.toFixed(3)} m/s²
          </span>
        </div>

        {/* Error Display */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-300">Error</span>
          <span className={`text-lg font-mono font-bold ${errorColor}`}>
            {calculations.isValid
              ? `${calculations.absoluteError.toFixed(3)} m/s² (${calculations.percentageError.toFixed(2)}%)`
              : 'N/A'}
          </span>
        </div>

        {/* Separator */}
        <div className="border-t border-white/10 my-3"></div>

        {/* Formula Display */}
        <div className="text-center">
          <div className="text-xs text-slate-400 mb-1">Formula</div>
          <div className="text-sm font-mono text-slate-300">
            g = 4π²L/T²
          </div>
        </div>
      </div>
    </div>
  );
}
