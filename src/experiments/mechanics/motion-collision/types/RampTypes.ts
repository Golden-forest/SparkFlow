import * as THREE from 'three';

export interface RampConfig {
  id: string;
  position: THREE.Vector3;
  length: number;
  width: number;
  angle: number;        // 倾斜角度（度）
  height: number;       // 高度
}

export interface SimulationRamp extends RampConfig {
  mesh: THREE.Mesh;
}
