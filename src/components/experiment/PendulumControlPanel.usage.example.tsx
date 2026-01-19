import React, { useState } from 'react';
import { PendulumControlPanel } from './PendulumControlPanel';

/**
 * Example usage of PendulumControlPanel component
 *
 * This demonstrates how to integrate the PendulumControlPanel into a parent component
 * with state management for all parameters.
 */
export function PendulumControlPanelExample() {
  const [pendulumLength, setPendulumLength] = useState(2.5);
  const [mass, setMass] = useState(1.0);
  const [initialAngle, setInitialAngle] = useState(30);

  const handleLengthChange = (length: number) => {
    setPendulumLength(length);
    console.log(`Pendulum length changed to: ${length} m`);
  };

  const handleMassChange = (mass: number) => {
    setMass(mass);
    console.log(`Bob mass changed to: ${mass} kg`);
  };

  const handleAngleChange = (angle: number) => {
    setInitialAngle(angle);
    console.log(`Initial angle changed to: ${angle}°`);
  };

  return (
    <div className="p-6 bg-slate-900 min-h-screen">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">Pendulum Experiment</h1>
        <PendulumControlPanel
          pendulumLength={pendulumLength}
          onLengthChange={handleLengthChange}
          mass={mass}
          onMassChange={handleMassChange}
          initialAngle={initialAngle}
          onAngleChange={handleAngleChange}
        />
      </div>
    </div>
  );
}

/**
 * Example with default values for quick testing
 */
export function PendulumControlPanelDefaultExample() {
  return (
    <div className="p-6 bg-slate-900 min-h-screen">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">Pendulum Experiment (Defaults)</h1>
        <PendulumControlPanel
          pendulumLength={1.0}
          onLengthChange={(length) => console.log(`Length: ${length}`)}
          mass={0.5}
          onMassChange={(mass) => console.log(`Mass: ${mass}`)}
          initialAngle={15}
          onAngleChange={(angle) => console.log(`Angle: ${angle}`)}
        />
      </div>
    </div>
  );
}
