import * as THREE from 'three';

interface GlowingSphereOptions {
  coreRadius?: number;
  glowRadius?: number;
  coreColor?: number;
  glowColor?: number;
  glowOpacity?: number;
  emissiveIntensity?: number;
}

/**
 * 创建发光球体组件
 * 由核心球体和外围辉光层组成，适用于粒子、原子核等
 */
export function createGlowingSphere(options: GlowingSphereOptions = {}): THREE.Group {
  const {
    coreRadius = 0.1,
    glowRadius = 0.3,
    coreColor = 0xffffff,
    glowColor = 0x7dd3fc,
    glowOpacity = 0.2,
    emissiveIntensity = 1.2,
  } = options;

  const group = new THREE.Group();

  // 核心球体
  const coreGeometry = new THREE.SphereGeometry(coreRadius, 24, 24);
  const coreMaterial = new THREE.MeshStandardMaterial({
    color: coreColor,
    emissive: coreColor,
    emissiveIntensity,
    metalness: 0.5,
    roughness: 0.3,
  });
  const core = new THREE.Mesh(coreGeometry, coreMaterial);
  group.add(core);

  // 辉光层
  const glowGeometry = new THREE.SphereGeometry(glowRadius, 24, 24);
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: glowColor,
    transparent: true,
    opacity: glowOpacity,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const glow = new THREE.Mesh(glowGeometry, glowMaterial);
  group.add(glow);

  return group;
}

/**
 * 创建拖尾粒子系统
 */
export function createTrailLine(color: number, maxPoints = 100): THREE.Line {
  const positions = new Float32Array(maxPoints * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setDrawRange(0, 0);

  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  return new THREE.Line(geometry, material);
}
