import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

/**
 * Props for Stopwatch component
 */
export interface StopwatchProps {
  /** Callback when period count changes */
  onPeriodsChange?: (periods: number) => void;
  /** Callback when elapsed time changes (called every 10ms when running) */
  onTimeChange?: (time: number) => void;
}

/**
 * Stopwatch component for timing experiments
 *
 * Provides a high-precision timer (10ms resolution) with period counting functionality.
 * Designed for physics experiments like pendulum measurements.
 *
 * Features:
 * - Time display in MM:SS.ms format
 * - Manual period increment/decrement
 * - Start/Pause/Reset controls
 * - Optional callbacks for parent integration
 *
 * @component
 */
export function Stopwatch({ onPeriodsChange, onTimeChange }: StopwatchProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [periods, setPeriods] = useState(0);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    if (isRunning) {
      interval = setInterval(() => {
        setElapsedTime(prev => {
          const newTime = prev + 0.01; // 10ms update
          onTimeChange?.(newTime);
          return newTime;
        });
      }, 10);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, onTimeChange]);

  const handleToggle = useCallback(() => {
    setIsRunning(prev => !prev);
  }, []);

  const handleReset = useCallback(() => {
    setIsRunning(false);
    setElapsedTime(0);
    setPeriods(0);
    onPeriodsChange?.(0);
    onTimeChange?.(0);
  }, [onPeriodsChange, onTimeChange]);

  const handleIncrementPeriods = useCallback(() => {
    setPeriods(prev => {
      const newPeriods = prev + 1;
      onPeriodsChange?.(newPeriods);
      return newPeriods;
    });
  }, [onPeriodsChange]);

  const handleDecrementPeriods = useCallback(() => {
    setPeriods(prev => {
      const newPeriods = Math.max(0, prev - 1);
      onPeriodsChange?.(newPeriods);
      return newPeriods;
    });
  }, [onPeriodsChange]);

  // Format time as MM:SS.ms with improved precision
  const formatTime = useCallback((time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    // Fix floating point precision: round to nearest 10ms, then format
    const centiseconds = Math.floor(Math.round((time % 1) * 1000) / 10);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
  }, []);

  return (
    <div className="bg-slate-800/50 rounded-lg p-4 border border-white/10">
      {/* Time Display */}
      <div className="text-center mb-4">
        <div className="text-4xl font-mono font-bold text-white mb-2">
          {formatTime(elapsedTime)}
        </div>
        <div className="text-sm text-slate-400">
          Periods: {periods}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 mb-4">
        <button
          onClick={handleToggle}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all shadow-lg ${
            isRunning
              ? 'bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white shadow-orange-900/30'
              : 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white shadow-emerald-900/30'
          }`}
        >
          {isRunning ? <Pause size={18} /> : <Play size={18} />}
          <span>{isRunning ? 'Pause' : 'Start'}</span>
        </button>

        <button
          onClick={handleReset}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-slate-700 to-slate-600 hover:from-slate-600 hover:to-slate-500 text-white font-medium transition-all shadow-lg shadow-slate-900/30"
        >
          <RotateCcw size={18} />
          <span>Reset</span>
        </button>
      </div>

      {/* Period Counting */}
      <div className="space-y-2">
        <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
          Manual Period Count
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDecrementPeriods}
            disabled={periods === 0}
            className="w-10 h-10 flex items-center justify-center bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:text-slate-600 disabled:cursor-not-allowed rounded-lg text-white font-bold transition-colors border border-white/10"
          >
            -
          </button>
          <div className="flex-1 text-center text-xl font-mono font-bold text-white bg-slate-900/50 rounded-lg py-2 border border-white/10">
            {periods}
          </div>
          <button
            onClick={handleIncrementPeriods}
            className="w-10 h-10 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded-lg text-white font-bold transition-colors border border-white/10"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
