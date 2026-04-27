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

// 注册实验
ExperimentRegistry.register('rutherford-scattering', RutherfordExperiment);
ExperimentRegistry.register('hydrogen-transitions', HydrogenTransition);
ExperimentRegistry.register('solar-system', SolarSystem);
ExperimentRegistry.register('pendulum', Pendulum);
ExperimentRegistry.register('motion-collision', MotionCollisionLab);
ExperimentRegistry.register('projectile-motion', ProjectileMotion);
ExperimentRegistry.register('uniform-circular-motion', UniformCircularMotion);
ExperimentRegistry.register('inclined-plane-friction', InclinedPlaneFriction);
ExperimentRegistry.register('spring-oscillation', SpringOscillation);
ExperimentRegistry.register('momentum-carts', MomentumCarts);

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
