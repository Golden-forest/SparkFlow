import * as THREE from 'three';
import { createTextSprite } from '../utils/threeUtils';

interface VectorArrowOptions {
  color?: number;
  headLength?: number;
  headWidth?: number;
  shaftWidth?: number;
  initialLength?: number;
}

/**
 * 创建向量箭头组件
 * 用于显示速度、力、电场、磁场等物理量
 */
export function createVectorArrow(options: VectorArrowOptions = {}): THREE.ArrowHelper {
  const {
    color = 0x34d399,
    headLength = 0.18,
    headWidth = 0.1,
    shaftWidth = 0.06,
    initialLength = 1,
  } = options;

  return new THREE.ArrowHelper(
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(),
    initialLength,
    color,
    headLength,
    headWidth,
  );
}

/**
 * 创建向量标签组合（箭头 + 文字标签）
 */
export function createVectorLabel(
  text: string,
  color: number,
  options: {
    arrowOptions?: VectorArrowOptions;
    labelScale?: number;
    labelOffset?: THREE.Vector3;
  } = {}
): THREE.Group {
  const group = new THREE.Group();

  const { arrowOptions = {}, labelScale = 0.005, labelOffset = new THREE.Vector3(0, 0.5, 0) } = options;

  const arrow = createVectorArrow({ ...arrowOptions, color });
  group.add(arrow);

  const hexColor = `#${color.toString(16).padStart(6, '0')}`;
  const r = (color >> 16) & 255;
  const g = (color >> 8) & 255;
  const b = color & 255;
  const label = createTextSprite(text, {
    color: hexColor,
    border: `rgba(${r}, ${g}, ${b}, 0.5)`,
    scale: labelScale,
  });
  label.position.copy(labelOffset);
  group.add(label);

  return group;
}
