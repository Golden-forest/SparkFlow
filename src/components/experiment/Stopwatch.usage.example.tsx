import React, { useState } from 'react';
import { Stopwatch } from './Stopwatch';

/**
 * Example usage of the Stopwatch component in a Pendulum Experiment
 */
export function PendulumTimerExample() {
  const [periods, setPeriods] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [calculatedPeriod, setCalculatedPeriod] = useState<number | null>(null);

  const handlePeriodsChange = (newPeriods: number) => {
    setPeriods(newPeriods);

    // Calculate period when we have at least one period and some elapsed time
    if (newPeriods > 0 && elapsedTime > 0) {
      const period = elapsedTime / newPeriods;
      setCalculatedPeriod(period);
    } else {
      setCalculatedPeriod(null);
    }
  };

  const handleTimeChange = (newTime: number) => {
    setElapsedTime(newTime);

    // Recalculate period if we have periods counted
    if (periods > 0) {
      const period = newTime / periods;
      setCalculatedPeriod(period);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-slate-900/50 rounded-lg p-4 border border-white/10">
        <h3 className="text-lg font-semibold text-white mb-2">
          Pendulum Period Measurement
        </h3>
        <p className="text-sm text-slate-400 mb-4">
          Start the timer and count each complete swing of the pendulum.
          Press + each time the pendulum returns to its starting position.
        </p>

        <Stopwatch
          onPeriodsChange={handlePeriodsChange}
          onTimeChange={handleTimeChange}
        />

        {calculatedPeriod !== null && (
          <div className="mt-4 p-3 bg-blue-900/20 rounded-lg border border-blue-500/30">
            <div className="text-sm text-slate-400">
              Average Period:
            </div>
            <div className="text-2xl font-mono font-bold text-blue-400">
              {calculatedPeriod.toFixed(3)} s
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Minimal usage example - just the timer without calculations
 */
export function MinimalStopwatchExample() {
  return (
    <div className="bg-slate-900/50 rounded-lg p-4 border border-white/10">
      <h3 className="text-lg font-semibold text-white mb-4">
        Simple Timer
      </h3>
      <Stopwatch />
    </div>
  );
}
