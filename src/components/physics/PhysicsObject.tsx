import { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { VectorArrow } from './VectorArrow';
import { TrajectoryLine } from './TrajectoryLine';

/**
 * Props for PhysicsObject component
 */
export interface PhysicsObjectProps {
  /** Object geometry type */
  type: 'sphere' | 'box' | 'plane';
  /** Size: radius for sphere, [width, height, depth] for box, [width, height] for plane */
  size: number | [number, number, number] | [number, number];
  /** Mass in kg (default: 1) */
  mass?: number;
  /** Position in 3D space (default: origin) */
  position?: THREE.Vector3;
  /** Velocity vector (default: zero) */
  velocity?: THREE.Vector3;
  /** Acceleration vector (default: zero) */
  acceleration?: THREE.Vector3;
  /** Object color (default: white) */
  color?: string;
  /** Show velocity vector arrow (default: false) */
  showVelocity?: boolean;
  /** Show acceleration vector arrow (default: false) */
  showAcceleration?: boolean;
  /** Show motion trajectory (default: false) */
  showTrajectory?: boolean;
  /** Trajectory line color (default: green) */
  trajectoryColor?: string;
  /** Maximum trajectory points (default: 500) */
  trajectoryMaxPoints?: number;
  /** Velocity arrow color (default: blue) */
  velocityColor?: string;
  /** Acceleration arrow color (default: red) */
  accelerationColor?: string;
  /** Scale factor for vector arrows (default: 0.5) */
  vectorScale?: number;
  /** Enable shadows (default: true) */
  castShadow?: boolean;
  /** Receive shadows (default: true for planes) */
  receiveShadow?: boolean;
  /** Material roughness (default: 0.5) */
  roughness?: number;
  /** Material metalness (default: 0.1) */
  metalness?: number;
}

/**
 * PhysicsObject - Generic physics object component
 *
 * Encapsulates common physics objects (sphere, box, plane) with integrated
 * vector visualization and trajectory tracking.
 *
 * @example
 * ```tsx
 * <PhysicsObject
 *   type="sphere"
 *   size={1}
 *   mass={2}
 *   position={new THREE.Vector3(0, 5, 0)}
 *   velocity={new THREE.Vector3(1, 0, 0)}
 *   acceleration={new THREE.Vector3(0, 0, -9.8)}
 *   color="#ff6b6b"
 *   showVelocity={true}
 *   showAcceleration={true}
 *   showTrajectory={true}
 * />
 * ```
 */
export function PhysicsObject({
  type,
  size,
  mass = 1,
  position = new THREE.Vector3(0, 0, 0),
  velocity = new THREE.Vector3(0, 0, 0),
  acceleration = new THREE.Vector3(0, 0, 0),
  color = '#ffffff',
  showVelocity = false,
  showAcceleration = false,
  showTrajectory = false,
  trajectoryColor = '#00ff00',
  trajectoryMaxPoints = 500,
  velocityColor = '#0088ff',
  accelerationColor = '#ff4444',
  vectorScale = 0.5,
  castShadow = true,
  receiveShadow,
  roughness = 0.5,
  metalness = 0.1,
}: PhysicsObjectProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const trajectoryHistoryRef = useRef<THREE.Vector3[]>([]);
  const lastUpdateRef = useRef<number>(0);
  const [, forceUpdate] = useState(0);

  // Update mesh position when position prop changes
  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.position.copy(position);
    }
  }, [position]);

  // Update trajectory history with throttling (update every 0.1s)
  useFrame(({ clock }) => {
    if (showTrajectory) {
      const currentTime = clock.getElapsedTime();
      const timeSinceLastUpdate = currentTime - lastUpdateRef.current;

      // Throttle updates to every 0.1 seconds
      if (timeSinceLastUpdate >= 0.1) {
        trajectoryHistoryRef.current.push(position.clone());

        // Limit history size
        if (trajectoryHistoryRef.current.length > trajectoryMaxPoints) {
          trajectoryHistoryRef.current = trajectoryHistoryRef.current.slice(-trajectoryMaxPoints);
        }

        lastUpdateRef.current = currentTime;
        // Trigger re-render to update trajectory line
        forceUpdate(prev => prev + 1);
      }
    }
  });

  // Create geometry based on type
  const geometry = useMemo(() => {
    switch (type) {
      case 'sphere':
        return new THREE.SphereGeometry(size as number, 32, 32);
      case 'box':
        const [w, h, d] = size as [number, number, number];
        return new THREE.BoxGeometry(w, h, d);
      case 'plane':
        const [pw, ph] = size as [number, number];
        return new THREE.PlaneGeometry(pw, ph);
      default:
        return new THREE.SphereGeometry(1, 32, 32);
    }
  }, [type, size]);

  // Create material
  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness,
      metalness,
    });
  }, [color, roughness, metalness]);

  // Calculate if this object should receive shadows
  const shouldReceiveShadow = receiveShadow !== undefined ? receiveShadow : type === 'plane';

  return (
    <group>
      {/* Main physics object mesh */}
      <mesh
        ref={meshRef}
        geometry={geometry}
        material={material}
        castShadow={castShadow}
        receiveShadow={shouldReceiveShadow}
        position={position}
        rotation={type === 'plane' ? ([-Math.PI / 2, 0, 0] as [number, number, number]) : undefined}
      />

      {/* Velocity vector arrow */}
      {showVelocity && velocity.length() > 0 && (
        <VectorArrow
          vector={velocity.clone().multiplyScalar(vectorScale)}
          origin={position}
          color={velocityColor}
          scale={1}
          label="v"
        />
      )}

      {/* Acceleration vector arrow */}
      {showAcceleration && acceleration.length() > 0 && (
        <VectorArrow
          vector={acceleration.clone().multiplyScalar(vectorScale)}
          origin={position}
          color={accelerationColor}
          scale={1}
          label="a"
        />
      )}

      {/* Trajectory line */}
      {showTrajectory && trajectoryHistoryRef.current.length >= 2 && (
        <TrajectoryLine
          positions={trajectoryHistoryRef.current}
          color={trajectoryColor}
          maxPoints={trajectoryMaxPoints}
          visible={true}
        />
      )}
    </group>
  );
}

export default PhysicsObject;
