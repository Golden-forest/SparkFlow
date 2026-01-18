/**
 * Pendulum Experiment
 *
 * 单摆实验模块 - 导出单摆实验类和相关物理计算
 */

export { Pendulum } from './Pendulum';
export {
  createInitialPendulum,
  updatePendulum,
  calculatePendulumData,
  calculatePendulumPosition,
  type PendulumState,
  type PendulumData,
} from './PendulumPhysics';
