import * as THREE from 'three';
import type { SimulationObject } from '../types/ObjectTypes';

export class TrajectoryManager {
  private static readonly MAX_POINTS = 500;
  private static readonly TRAIL_INTERVAL = 0.05; // 50ms

  /**
   * 更新物体轨迹
   */
  static updateTrajectory(
    obj: SimulationObject,
    currentTime: number,
    showTrajectory: boolean,
    lastRecordTime: number
  ): number {
    if (!showTrajectory) return lastRecordTime;

    // 时间间隔控制
    if (currentTime - lastRecordTime < this.TRAIL_INTERVAL) {
      return lastRecordTime;
    }

    // 添加当前位置到轨迹
    obj.trajectory.push(obj.mesh.position.clone());

    // 限制轨迹点数量
    if (obj.trajectory.length > this.MAX_POINTS) {
      obj.trajectory.shift();
    }

    return currentTime;
  }

  /**
   * 创建轨迹线
   */
  static createTrajectoryLine(
    color: number = 0x00ff41
  ): THREE.Line {
    const geometry = new THREE.BufferGeometry();
    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.6,
    });
    return new THREE.Line(geometry, material);
  }

  /**
   * 更新轨迹线几何体
   */
  static updateTrajectoryGeometry(
    line: THREE.Line,
    trajectory: THREE.Vector3[]
  ): void {
    if (trajectory.length < 2) {
      line.visible = false;
      return;
    }

    line.visible = true;
    line.geometry.setFromPoints(trajectory);
    line.geometry.attributes.position.needsUpdate = true;
  }

  /**
   * 清除轨迹
   */
  static clearTrajectory(obj: SimulationObject): void {
    obj.trajectory = [];
  }
}
