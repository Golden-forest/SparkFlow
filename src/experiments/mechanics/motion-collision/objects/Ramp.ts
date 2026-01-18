import * as THREE from 'three';
import type { RampConfig } from '../types/RampTypes';

export class RampFactory {
  static create(config: RampConfig): THREE.Mesh {
    // 参数验证
    if (config.angle <= 0 || config.angle >= 90) {
      throw new Error('Ramp angle must be between 0 and 90 degrees');
    }
    if (config.height <= 0 || config.width <= 0) {
      throw new Error('Ramp height and width must be positive');
    }

    // 创建三棱柱形状
    const shape = new THREE.Shape();
    const angleRad = (config.angle * Math.PI) / 180;

    // 根据角度计算底边长度：tan(angle) = height/base, 所以 base = height/tan(angle)
    const baseLength = config.height / Math.tan(angleRad);

    // 斜面截面（直角三角形）
    shape.moveTo(0, 0);
    shape.lineTo(baseLength, 0);      // 使用计算的底边长度
    shape.lineTo(0, config.height);   // 高度
    shape.closePath();

    const extrudeSettings = {
      steps: 1,
      depth: config.width,
      bevelEnabled: false,
    };

    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

    // 旋转到正确位置
    geometry.rotateZ(Math.PI / 2);

    const material = new THREE.MeshStandardMaterial({
      color: 0x8b5cf6,
      metalness: 0.3,
      roughness: 0.7,
      transparent: true,
      opacity: 0.8,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(config.position);
    mesh.receiveShadow = true;

    return mesh;
  }
}
