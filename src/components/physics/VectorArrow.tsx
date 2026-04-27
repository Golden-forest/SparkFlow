import { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

/**
 * Props for VectorArrow component
 */
export interface VectorArrowProps {
  /** Vector direction and magnitude */
  vector: THREE.Vector3;
  /** Arrow origin point */
  origin: THREE.Vector3;
  /** Arrow color (default: red) */
  color?: string;
  /** Scale factor for arrow length (default: 1) */
  scale?: number;
  /** Optional label text */
  label?: string;
  /** Visibility control (default: true) */
  visible?: boolean;
  /** Arrow shaft length (default: calculated from vector length) */
  length?: number;
  /** Arrow head length (default: 0.2 * length) */
  headLength?: number;
  /** Arrow head width (default: 0.1 * length) */
  headWidth?: number;
}

/**
 * VectorArrow - 3D vector arrow visualization component
 *
 * Draws vector arrows in 3D scene for visualizing physical quantities
 * like velocity, acceleration, and force.
 *
 * @example
 * ```tsx
 * <VectorArrow
 *   vector={new THREE.Vector3(1, 2, 3)}
 *   origin={new THREE.Vector3(0, 0, 0)}
 *   color="#ff0000"
 *   scale={1}
 *   label="Velocity"
 * />
 * ```
 */
export function VectorArrow({
  vector,
  origin,
  color = '#ff0000',
  scale = 1,
  label,
  visible = true,
  length,
  headLength,
  headWidth,
}: VectorArrowProps) {
  const arrowRef = useRef<THREE.ArrowHelper>(null);

  // Calculate arrow length from vector magnitude if not provided
  const arrowLength = length ?? vector.length() * scale;
  const calculatedHeadLength = headLength ?? arrowLength * 0.2;
  const calculatedHeadWidth = headWidth ?? arrowLength * 0.1;

  // Create normalized direction vector
  const direction = vector.clone().normalize();

  useFrame(() => {
    if (arrowRef.current && visible) {
      // Update arrow direction and length dynamically
      arrowRef.current.setDirection(direction);
      arrowRef.current.setLength(arrowLength, calculatedHeadLength, calculatedHeadLength);
    }
  });

  useEffect(() => {
    if (arrowRef.current) {
      // Update origin when it changes
      arrowRef.current.position.copy(origin);
    }
  }, [origin]);

  if (!visible) return null;

  // Create ArrowHelper instance only when dependencies change
  const arrowHelper = useMemo(() => {
    return new THREE.ArrowHelper(
      direction,
      origin,
      arrowLength,
      new THREE.Color(color),
      calculatedHeadLength,
      calculatedHeadWidth
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direction, origin, arrowLength, color, calculatedHeadLength, calculatedHeadWidth]);

  return (
    <>
      <primitive ref={arrowRef} object={arrowHelper} />
      {label && (
        <Html
          position={origin.clone().add(direction.clone().multiplyScalar(arrowLength))}
          style={{
            color: 'white',
            fontSize: '12px',
            textShadow: '0 0 2px black',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          {label}
        </Html>
      )}
    </>
  );
}

export default VectorArrow;
