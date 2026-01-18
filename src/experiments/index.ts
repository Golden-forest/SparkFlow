// 注册所有实验
import { ExperimentRegistry } from './base';
import { RutherfordExperiment } from './atomic/rutherford-scattering';
import { HydrogenTransition } from './atomic/hydrogen-transitions';
import { SolarSystem } from './celestial/solar-system';
import { ProjectileMotion } from './mechanics/projectile-motion';
import { CircularMotion } from './mechanics/circular-motion';
import { SimpleHarmonicMotion } from './mechanics/simple-harmonic-motion';
import { Collision } from './mechanics/collision';

// 注册实验
ExperimentRegistry.register('rutherford-scattering', RutherfordExperiment);
ExperimentRegistry.register('hydrogen-transitions', HydrogenTransition);
ExperimentRegistry.register('solar-system', SolarSystem);
ExperimentRegistry.register('projectile-motion', ProjectileMotion);
ExperimentRegistry.register('circular-motion', CircularMotion);
ExperimentRegistry.register('simple-harmonic-motion', SimpleHarmonicMotion);
ExperimentRegistry.register('collision', Collision);

export * from './base';
export { RutherfordExperiment } from './atomic/rutherford-scattering';
export { HydrogenTransition } from './atomic/hydrogen-transitions';
export { SolarSystem } from './celestial/solar-system';
export { ProjectileMotion } from './mechanics/projectile-motion';
export { CircularMotion } from './mechanics/circular-motion';
export { SimpleHarmonicMotion } from './mechanics/simple-harmonic-motion';
export { Collision } from './mechanics/collision';
