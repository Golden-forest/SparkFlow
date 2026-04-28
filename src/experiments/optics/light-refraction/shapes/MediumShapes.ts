import * as THREE from 'three';

export const MEDIUM_SHAPE_OPTIONS = [
  { value: 'rectangle', label: 'Rectangle' },
  { value: 'prism', label: 'Prism' },
  { value: 'semicircle', label: 'Semicircle' },
  { value: 'hemisphere', label: 'Hemisphere' },
] as const;

export type MediumShapeKey = typeof MEDIUM_SHAPE_OPTIONS[number]['value'];

export interface MediumShapeDimensions {
  width: number;
  height: number;
  depth: number;
  radius: number;
}

const DEFAULT_DIMENSIONS: MediumShapeDimensions = {
  width: 6,
  height: 2.4,
  depth: 3.2,
  radius: 2.1,
};

export function isMediumShapeKey(value: string): value is MediumShapeKey {
  return MEDIUM_SHAPE_OPTIONS.some((shape) => shape.value === value);
}

export function resolveMediumShapeKey(value: string, fallback: MediumShapeKey = 'rectangle'): MediumShapeKey {
  return isMediumShapeKey(value) ? value : fallback;
}

export function createMediumGeometry(
  shape: MediumShapeKey,
  overrides: Partial<MediumShapeDimensions> = {}
): THREE.BufferGeometry {
  const dimensions = { ...DEFAULT_DIMENSIONS, ...overrides };

  switch (shape) {
    case 'rectangle':
      return createRectangleGeometry(dimensions);
    case 'prism':
      return createPrismGeometry(dimensions);
    case 'semicircle':
      return createSemicircleGeometry(dimensions);
    case 'hemisphere':
      return createHemisphereGeometry(dimensions);
    default:
      return createRectangleGeometry(dimensions);
  }
}

function createRectangleGeometry(dimensions: MediumShapeDimensions): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(dimensions.width, dimensions.height, dimensions.depth);
  geometry.translate(0, -dimensions.height / 2, 0);
  return geometry;
}

function createPrismGeometry(dimensions: MediumShapeDimensions): THREE.BufferGeometry {
  const halfWidth = dimensions.width / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-halfWidth, 0);
  shape.lineTo(halfWidth, 0);
  shape.lineTo(0, -dimensions.height);
  shape.lineTo(-halfWidth, 0);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: dimensions.depth,
    bevelEnabled: false,
    curveSegments: 4,
    steps: 1,
  });
  geometry.translate(0, 0, -dimensions.depth / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function createSemicircleGeometry(dimensions: MediumShapeDimensions): THREE.BufferGeometry {
  const radius = dimensions.radius;
  const shape = new THREE.Shape();
  shape.moveTo(-radius, 0);
  shape.lineTo(radius, 0);
  shape.absarc(0, 0, radius, 0, Math.PI, true);
  shape.lineTo(-radius, 0);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: dimensions.depth,
    bevelEnabled: false,
    curveSegments: 32,
    steps: 1,
  });
  geometry.translate(0, 0, -dimensions.depth / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function createHemisphereGeometry(dimensions: MediumShapeDimensions): THREE.BufferGeometry {
  const radius = dimensions.radius;
  const geometry = new THREE.SphereGeometry(radius, 48, 24, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  const depthScale = dimensions.depth / (radius * 2);
  geometry.scale(1, 1, Math.max(depthScale, 0.45));
  return geometry;
}

