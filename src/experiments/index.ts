// 注册所有实验
import { ExperimentRegistry } from './base';
import { RutherfordExperiment } from './atomic/rutherford-scattering';
import { HydrogenTransition } from './atomic/hydrogen-transitions';
import { SolarSystem } from './celestial/solar-system';
import { Pendulum } from './mechanics/pendulum';
import { MotionCollisionLab } from './mechanics/motion-collision';
import { ProjectileMotion } from './mechanics/projectile-motion';
import { UniformCircularMotion } from './mechanics/uniform-circular-motion';
import { InclinedPlaneFriction } from './mechanics/inclined-plane-friction';
import { SpringOscillation } from './mechanics/spring-oscillation';
import { MomentumCarts } from './mechanics/momentum-carts';
import { LightRefraction } from './optics/light-refraction';
import { DoubleSlitInterference } from './optics/double-slit-interference';
import { BoyleLaw } from './thermodynamics/boyle-law';
import { GalvanicCell } from './electrochemistry';
import { CircleDemo2D } from './test-circle-2d';

// 注册实验
ExperimentRegistry.register('rutherford-scattering', RutherfordExperiment);
ExperimentRegistry.register('hydrogen-transitions', HydrogenTransition);
ExperimentRegistry.register('solar-system', SolarSystem);
ExperimentRegistry.register('pendulum', Pendulum);
ExperimentRegistry.register('motion-collision', MotionCollisionLab);
// projectile-motion registered via @registerExperiment2D decorator in class
ExperimentRegistry.register('uniform-circular-motion', UniformCircularMotion);
ExperimentRegistry.register('inclined-plane-friction', InclinedPlaneFriction);
ExperimentRegistry.register('spring-oscillation', SpringOscillation);
ExperimentRegistry.register('momentum-carts', MomentumCarts);
ExperimentRegistry.register('light-refraction', LightRefraction);
ExperimentRegistry.register('double-slit-interference', DoubleSlitInterference);
ExperimentRegistry.register('boyle-law', BoyleLaw);
ExperimentRegistry.register('galvanic-cell', GalvanicCell);

export * from './base';
export { RutherfordExperiment } from './atomic/rutherford-scattering';
export { HydrogenTransition } from './atomic/hydrogen-transitions';
export { SolarSystem } from './celestial/solar-system';
export { Pendulum } from './mechanics/pendulum';
export { MotionCollisionLab } from './mechanics/motion-collision';
export { ProjectileMotion } from './mechanics/projectile-motion';
export { UniformCircularMotion } from './mechanics/uniform-circular-motion';
export { InclinedPlaneFriction } from './mechanics/inclined-plane-friction';
export { SpringOscillation } from './mechanics/spring-oscillation';
export { MomentumCarts } from './mechanics/momentum-carts';
export { LightRefraction } from './optics/light-refraction';
export { DoubleSlitInterference } from './optics/double-slit-interference';
export { BoyleLaw } from './thermodynamics/boyle-law';
export { GalvanicCell } from './electrochemistry';
export { CircleDemo2D } from './test-circle-2d';
