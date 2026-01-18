import { useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { useSimulationStore } from '@/stores/simulationStore';

interface SceneContainerProps {
    children?: React.ReactNode;
    cameraPosition?: [number, number, number];
    cameraTarget?: [number, number, number];
    cameraFov?: number;
    showGrid?: boolean;
    showAxes?: boolean;
    backgroundColor?: string;
}

/**
 * 仿真更新循环组件
 */
function SimulationLoop() {
    const tick = useSimulationStore((s) => s.tick);

    useFrame((_, delta) => {
        tick(delta);
    });

    return null;
}

/**
 * 相机控制器组件
 */
function CameraController({
    position = [5, 5, 5],
    target = [0, 0, 0],
    fov = 50,
}: {
    position?: [number, number, number];
    target?: [number, number, number];
    fov?: number;
}) {
    const controlsRef = useRef<any>(null);
    const { camera } = useThree();

    useEffect(() => {
        camera.position.set(...position);
        if (controlsRef.current) {
            controlsRef.current.target.set(...target);
            controlsRef.current.update();
        }
    }, [position, target, camera]);

    return (
        <>
            <PerspectiveCamera makeDefault fov={fov} />
            <OrbitControls
                ref={controlsRef}
                enableDamping
                dampingFactor={0.05}
                enablePan={true}
                enableZoom={true}
                minDistance={1}
                maxDistance={200}
                panSpeed={0.5}
                rotateSpeed={0.5}
                zoomSpeed={0.8}
            />
        </>
    );
}

/**
 * 基础灯光设置
 */
function DefaultLighting() {
    return (
        <>
            <ambientLight intensity={0.4} />
            <directionalLight
                position={[10, 10, 5]}
                intensity={1}
                castShadow
                shadow-mapSize={[1024, 1024]}
            />
            <pointLight position={[-10, -10, -5]} intensity={0.5} color="#8080ff" />
        </>
    );
}

/**
 * 辅助网格和坐标轴
 */
function Helpers({ showGrid, showAxes }: { showGrid?: boolean; showAxes?: boolean }) {
    return (
        <>
            {showGrid && (
                <gridHelper args={[20, 20, '#444444', '#222222']} />
            )}
            {showAxes && <axesHelper args={[5]} />}
        </>
    );
}

/**
 * 3D场景容器 - 封装Three.js场景设置
 */
export function SceneContainer({
    children,
    cameraPosition = [5, 5, 5],
    cameraTarget = [0, 0, 0],
    cameraFov = 50,
    showGrid = false,
    showAxes = false,
    backgroundColor = '#0f172a',
}: SceneContainerProps) {
    return (
        <Canvas
            shadows
            gl={{
                antialias: true,
                toneMapping: THREE.ACESFilmicToneMapping,
                toneMappingExposure: 1.0,
            }}
            style={{
                background: 'linear-gradient(to bottom, #0a0e27 0%, #0f172a 100%)'
            }}
        >
            <CameraController
                position={cameraPosition}
                target={cameraTarget}
                fov={cameraFov}
            />
            <DefaultLighting />
            <Helpers showGrid={showGrid} showAxes={showAxes} />
            <SimulationLoop />
            {children}
        </Canvas>
    );
}

export default SceneContainer;
