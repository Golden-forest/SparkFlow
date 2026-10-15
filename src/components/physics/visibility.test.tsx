import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { TrajectoryLine, type TrajectoryLineProps } from './TrajectoryLine';
import { VectorArrow, type VectorArrowProps } from './VectorArrow';

const frameCallbacks = vi.hoisted(() => [] as Array<() => void>);
vi.mock('@react-three/fiber', () => ({
  useFrame: (callback: () => void) => frameCallbacks.push(callback),
}));
vi.mock('@react-three/drei', () => ({ Html: () => null }));

describe('shared visualization visibility', () => {
  it('keeps trajectory hooks stable when a trail becomes visible and gains points', () => {
    const positions = [new THREE.Vector3(0, 0, 0)];
    const { result, rerender, unmount } = renderHook(
      (props: TrajectoryLineProps) => TrajectoryLine(props),
      { initialProps: { positions, visible: false } },
    );
    expect(result.current).toBeNull();

    positions.push(new THREE.Vector3(1, 2, 3));
    rerender({ positions, visible: true });
    const line = result.current?.props.object as THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
    expect(line.geometry.getAttribute('position').count).toBe(2);

    positions.push(new THREE.Vector3(4, 5, 6));
    rerender({ positions, visible: true });
    expect(line.geometry.getAttribute('position').count).toBe(3);

    const disposeGeometry = vi.spyOn(line.geometry, 'dispose');
    const disposeMaterial = vi.spyOn(line.material, 'dispose');
    rerender({ positions, visible: false });
    expect(result.current).toBeNull();
    rerender({ positions, visible: true });
    expect(result.current?.props.object).toBe(line);
    unmount();
    expect(disposeGeometry).toHaveBeenCalledOnce();
    expect(disposeMaterial).toHaveBeenCalledOnce();
  });

  it('toggles an arrow without changing hook order and preserves separate head dimensions', () => {
    frameCallbacks.length = 0;
    const props: VectorArrowProps = {
      vector: new THREE.Vector3(1, 0, 0),
      origin: new THREE.Vector3(),
      visible: false,
      headLength: 0.2,
      headWidth: 0.08,
    };
    const { result, rerender, unmount } = renderHook(
      (value: VectorArrowProps) => VectorArrow(value),
      { initialProps: props },
    );
    expect(result.current).toBeNull();
    rerender({ ...props, visible: true });
    const primitive = result.current?.props.children[0];
    const arrow = primitive.props.object as THREE.ArrowHelper;
    primitive.props.ref.current = arrow;
    act(() => frameCallbacks.at(-1)?.());
    expect(arrow.cone.scale.x).toBeCloseTo(0.08);
    expect(arrow.cone.scale.y).toBeCloseTo(0.2);

    rerender({ ...props, visible: false });
    expect(result.current).toBeNull();
    rerender({ ...props, visible: true });
    expect(result.current?.props.children[0].props.object).toBe(arrow);
    unmount();
  });
});
