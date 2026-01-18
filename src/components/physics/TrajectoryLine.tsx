import { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';

/**
 * Props for TrajectoryLine component
 */
export interface TrajectoryLineProps {
  /** Array of historical position points */
  positions: THREE.Vector3[];
  /** Line color (default: green) */
  color?: string;
  /** Maximum number of points to display (default: 500) */
  maxPoints?: number;
  /** Visibility control (default: true) */
  visible?: boolean;
  /** Line width (default: 2) */
  lineWidth?: number;
  /** Enable fade effect for older points (default: true) */
  fadeEffect?: boolean;
  /** Opacity of the line (default: 0.8) */
  opacity?: number;
}

/**
 * TrajectoryLine - Motion trajectory line component
 *
 * Draws object motion trajectory in 3D space with real-time updates.
 * Automatically limits memory usage by maxPoints configuration.
 *
 * @example
 * ```tsx
 * <TrajectoryLine
 *   positions={trajectoryHistory}
 *   color="#00ff00"
 *   maxPoints={500}
 *   visible={true}
 * />
 * ```
 */
export function TrajectoryLine({
  positions,
  color = '#00ff00',
  maxPoints = 500,
  visible = true,
  lineWidth = 2,
  fadeEffect = true,
  opacity = 0.8,
}: TrajectoryLineProps): JSX.Element | null {
  const lineRef = useRef<THREE.Line>(null);
  const geometryRef = useRef<THREE.BufferGeometry>(null);

  // Limit positions to maxPoints for performance
  const limitedPositions = useMemo(() => {
    if (positions.length <= maxPoints) {
      return positions;
    }
    // Keep only the most recent maxPoints
    return positions.slice(-maxPoints);
  }, [positions, maxPoints]);

  // Create or update geometry
  useEffect(() => {
    if (!visible || limitedPositions.length < 2) {
      return;
    }

    const geometry = geometryRef.current || new THREE.BufferGeometry();
    geometryRef.current = geometry;

    // Convert positions to flat array
    const points = limitedPositions.map(p => [p.x, p.y, p.z]).flat();

    // Update geometry attributes
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    geometry.computeBoundingSphere();

    // Update line reference
    if (lineRef.current) {
      lineRef.current.geometry = geometry;
    }
  }, [limitedPositions, visible]);

  if (!visible || limitedPositions.length < 2) {
    return null;
  }

  // Create material with fade effect if enabled
  const material = useMemo(() => {
    const lineColor = new THREE.Color(color);

    if (fadeEffect) {
      return new THREE.LineBasicMaterial({
        vertexColors: true,
        linewidth: lineWidth,
        transparent: true,
        opacity,
      });
    } else {
      // Single color for entire line
      return new THREE.LineBasicMaterial({
        color: lineColor,
        linewidth: lineWidth,
        transparent: opacity < 1,
        opacity,
      });
    }
  }, [color, lineWidth, opacity, fadeEffect]);

  // Update vertex colors for fade effect
  useEffect(() => {
    if (fadeEffect && geometryRef.current && limitedPositions.length >= 2) {
      const lineColor = new THREE.Color(color);
      const colors: number[] = [];
      const pointCount = limitedPositions.length;

      for (let i = 0; i < pointCount; i++) {
        // Calculate fade factor (older points are more transparent)
        const fadeFactor = i / (pointCount - 1);
        colors.push(
          lineColor.r * fadeFactor,
          lineColor.g * fadeFactor,
          lineColor.b * fadeFactor
        );
      }

      // Add vertex colors to geometry
      geometryRef.current.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    }
  }, [fadeEffect, limitedPositions.length, color]);

  return (
    <primitive
      ref={lineRef}
      object={new THREE.Line(geometryRef.current!, material)}
    />
  );
}

export default TrajectoryLine;
