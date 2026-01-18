/**
 * Projectile Motion Experiment
 *
 * 抛体运动实验室 - 导出模块
 */

export { ProjectileMotion } from './ProjectileMotion';
export type {
  ProjectileState,
  ProjectileData,
} from './ProjectilePhysics';
export {
  createInitialProjectile,
  updateProjectile,
  calculateProjectileData,
  isLanded,
} from './ProjectilePhysics';
