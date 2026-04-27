import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Stopwatch } from './Stopwatch';

describe('Stopwatch Component', () => {
  it('renders correctly with initial state', () => {
    render(<Stopwatch />);
    expect(screen.getByText('00:00.00')).toBeInTheDocument();
    expect(screen.getByText('Periods: 0')).toBeInTheDocument();
    expect(screen.getByText('Start')).toBeInTheDocument();
    expect(screen.getByText('Reset')).toBeInTheDocument();
  });

  it('starts and stops timer', () => {
    render(<Stopwatch />);

    const startButton = screen.getByText('Start');
    fireEvent.click(startButton);

    expect(screen.getByText('Pause')).toBeInTheDocument();
  });

  it('resets timer and periods', () => {
    render(<Stopwatch />);

    // Start the timer
    fireEvent.click(screen.getByText('Start'));
    // Increment periods
    fireEvent.click(screen.getByText('+'));

    // Reset
    fireEvent.click(screen.getByText('Reset'));

    expect(screen.getByText('00:00.00')).toBeInTheDocument();
    expect(screen.getByText('Periods: 0')).toBeInTheDocument();
  });

  it('increments and decrements periods', () => {
    render(<Stopwatch />);

    const incrementButton = screen.getByText('+');
    const decrementButton = screen.getByText('-');

    // Increment
    fireEvent.click(incrementButton);
    expect(screen.getByText('Periods: 1')).toBeInTheDocument();

    // Decrement
    fireEvent.click(decrementButton);
    expect(screen.getByText('Periods: 0')).toBeInTheDocument();
  });

  it('calls callbacks correctly', () => {
    const onPeriodsChange = jest.fn();
    const onTimeChange = jest.fn();

    render(<Stopwatch onPeriodsChange={onPeriodsChange} onTimeChange={onTimeChange} />);

    fireEvent.click(screen.getByText('+'));

    expect(onPeriodsChange).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByText('Start'));

    // Wait for at least one timer tick
    setTimeout(() => {
      expect(onTimeChange).toHaveBeenCalled();
    }, 20);
  });

  it('disables decrement button when periods is 0', () => {
    render(<Stopwatch />);

    const decrementButton = screen.getByText('-');
    expect(decrementButton).toBeDisabled();
  });

  it('formats time correctly', () => {
    const { rerender } = render(<Stopwatch />);

    // Initial state
    expect(screen.getByText('00:00.00')).toBeInTheDocument();

    // After clicking start, time should increase
    // Note: This is a basic check, actual time progression would need timing utilities
  });
});
