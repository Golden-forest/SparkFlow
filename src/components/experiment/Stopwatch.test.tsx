import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Stopwatch } from './Stopwatch';

describe('Stopwatch', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('starts at zero and prevents negative period counts', () => {
    render(<Stopwatch />);
    expect(screen.getByText('00:00.00')).toBeInTheDocument();
    expect(screen.getByText('Periods: 0')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '-' })).toBeDisabled();
  });

  it('advances while running and holds elapsed time when paused', () => {
    const onTimeChange = vi.fn();
    render(<Stopwatch onTimeChange={onTimeChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    act(() => vi.advanceTimersByTime(1_230));
    expect(screen.getByText('00:01.23')).toBeInTheDocument();
    expect(onTimeChange).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByText('00:01.23')).toBeInTheDocument();
  });

  it('updates the period count and notifies the parent', () => {
    const onPeriodsChange = vi.fn();
    render(<Stopwatch onPeriodsChange={onPeriodsChange} />);
    fireEvent.click(screen.getByRole('button', { name: '+' }));
    expect(screen.getByText('Periods: 1')).toBeInTheDocument();
    expect(onPeriodsChange).toHaveBeenLastCalledWith(1);
    fireEvent.click(screen.getByRole('button', { name: '-' }));
    expect(screen.getByText('Periods: 0')).toBeInTheDocument();
    expect(onPeriodsChange).toHaveBeenLastCalledWith(0);
  });

  it('resets time and periods and stops the timer', () => {
    const onPeriodsChange = vi.fn();
    const onTimeChange = vi.fn();
    render(<Stopwatch onPeriodsChange={onPeriodsChange} onTimeChange={onTimeChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    act(() => vi.advanceTimersByTime(500));
    fireEvent.click(screen.getByRole('button', { name: '+' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByText('00:00.00')).toBeInTheDocument();
    expect(screen.getByText('Periods: 0')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
    expect(onPeriodsChange).toHaveBeenLastCalledWith(0);
    expect(onTimeChange).toHaveBeenLastCalledWith(0);
  });
});
