// 注册所有实验
import { ExperimentRegistry } from './base';
import { RutherfordExperiment } from './atomic/rutherford-scattering';
import { HydrogenTransition } from './atomic/hydrogen-transitions';
import { SolarSystem } from './celestial/solar-system';

// 注册实验
ExperimentRegistry.register('rutherford-scattering', RutherfordExperiment);
ExperimentRegistry.register('hydrogen-transitions', HydrogenTransition);
ExperimentRegistry.register('solar-system', SolarSystem);

export * from './base';
export { RutherfordExperiment } from './atomic/rutherford-scattering';
export { HydrogenTransition } from './atomic/hydrogen-transitions';
export { SolarSystem } from './celestial/solar-system';
