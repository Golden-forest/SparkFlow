import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { PendulumControlPanel } from './PendulumControlPanel';

describe('PendulumControlPanel', () => {
  const defaultProps = {
    pendulumLength: 2.5,
    onLengthChange: jest.fn(),
    mass: 1.0,
    onMassChange: jest.fn(),
    initialAngle: 30,
    onAngleChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render all parameter controls', () => {
    render(<PendulumControlPanel {...defaultProps} />);

    // Check parameter labels
    expect(screen.getByText('Pendulum Length')).toBeInTheDocument();
    expect(screen.getByText('Initial Angle')).toBeInTheDocument();
    expect(screen.getByText('Bob Mass')).toBeInTheDocument();

    // Check section labels
    expect(screen.getByText('Timer')).toBeInTheDocument();
    expect(screen.getByText('Analysis')).toBeInTheDocument();
  });

  it('should display initial values correctly', () => {
    render(<PendulumControlPanel {...defaultProps} />);

    // Check displayed values
    expect(screen.getByText('2.5 m')).toBeInTheDocument();
    expect(screen.getByText('30°')).toBeInTheDocument();
    expect(screen.getByText('1.0 kg')).toBeInTheDocument();
  });

  it('should call onLengthChange when length slider changes', () => {
    render(<PendulumControlPanel {...defaultProps} />);

    const lengthSlider = screen.getByDisplayValue('2.5');
    fireEvent.change(lengthSlider, { target: { value: '5.0' } });

    expect(defaultProps.onLengthChange).toHaveBeenCalledWith(5.0);
  });

  it('should call onMassChange when mass slider changes', () => {
    render(<PendulumControlPanel {...defaultProps} />);

    const massSlider = screen.getByDisplayValue('1');
    fireEvent.change(massSlider, { target: { value: '2.5' } });

    expect(defaultProps.onMassChange).toHaveBeenCalledWith(2.5);
  });

  it('should call onAngleChange when angle slider changes', () => {
    render(<PendulumControlPanel {...defaultProps} />);

    const angleSlider = screen.getByDisplayValue('30');
    fireEvent.change(angleSlider, { target: { value: '45' } });

    expect(defaultProps.onAngleChange).toHaveBeenCalledWith(45);
  });

  it('should format length with 1 decimal place', () => {
    render(<PendulumControlPanel {...defaultProps} pendulumLength={1.23} />);

    expect(screen.getByText('1.2 m')).toBeInTheDocument();
  });

  it('should format mass with 1 decimal place', () => {
    render(<PendulumControlPanel {...defaultProps} mass={1.56} />);

    expect(screen.getByText('1.6 kg')).toBeInTheDocument();
  });

  it('should format angle with 0 decimal places', () => {
    render(<PendulumControlPanel {...defaultProps} initialAngle={30.7} />);

    expect(screen.getByText('31°')).toBeInTheDocument();
  });

  it('should integrate Stopwatch component', () => {
    render(<PendulumControlPanel {...defaultProps} />);

    // Stopwatch should be present
    expect(screen.getByText('Periods: 0')).toBeInTheDocument();
    expect(screen.getByText('Start')).toBeInTheDocument();
    expect(screen.getByText('Reset')).toBeInTheDocument();
  });

  it('should integrate GravityCalculator component', () => {
    render(<PendulumControlPanel {...defaultProps} />);

    // GravityCalculator should be present
    expect(screen.getByText('Results')).toBeInTheDocument();
    expect(screen.getByText('Period (T)')).toBeInTheDocument();
    expect(screen.getByText('Calculated g')).toBeInTheDocument();
  });

  it('should have correct slider ranges', () => {
    render(<PendulumControlPanel {...defaultProps} />);

    const lengthSlider = screen.getByDisplayValue('2.5');
    const massSlider = screen.getByDisplayValue('1');
    const angleSlider = screen.getByDisplayValue('30');

    expect(lengthSlider).toHaveAttribute('min', '0.5');
    expect(lengthSlider).toHaveAttribute('max', '10');
    expect(lengthSlider).toHaveAttribute('step', '0.1');

    expect(massSlider).toHaveAttribute('min', '0.1');
    expect(massSlider).toHaveAttribute('max', '10');
    expect(massSlider).toHaveAttribute('step', '0.1');

    expect(angleSlider).toHaveAttribute('min', '5');
    expect(angleSlider).toHaveAttribute('max', '60');
    expect(angleSlider).toHaveAttribute('step', '1');
  });

  it('should manage state for periods and totalTime', () => {
    render(<PendulumControlPanel {...defaultProps} />);

    // Initial state should show 0 periods
    expect(screen.getByText('Periods: 0')).toBeInTheDocument();

    // The state management is tested indirectly through the integration
    // with Stopwatch and GravityCalculator components
  });
});
