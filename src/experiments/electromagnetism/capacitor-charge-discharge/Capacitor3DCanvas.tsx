/**
 * Capacitor3DCanvas — R3F Canvas 包装组件
 *
 * 职责:
 * - 渲染一个独立的 <Canvas>（嵌在 2D SVG 视图下方，见 CircuitView2D）
 * - 用 useState 惰性初始化持有 Capacitor3DView 实例（避免每帧重建，且兼容 StrictMode）
 * - 用 useFrame（非独立 rAF）驱动 view.update()，接入 R3F 渲染循环
 * - useEffect cleanup 调用 view.dispose()，防止 WebGL 资源泄漏
 *
 * 架构（spec §7.1 + handoff §5.2）:
 * - 不通过 SceneContainer（避免双 Canvas 路由复杂度）
 * - 灯光配置复制 SceneContainer.DefaultLighting（项目内验证可用的设置）
 * - 相机 [3,3,5] 看向原点，略俯视，正好展示两板与电场
 *
 * 资源生命周期:
 * - showField3D 切换为 true 时挂载本组件 → new Capacitor3DView()
 * - 切换为 false 时卸载本组件 → useEffect cleanup → view.dispose()
 * - view.group 通过 <primitive object={view.group} /> 注入 R3F 场景图
 *
 * 关于 useState（C2 修复）:
 * - 原实现用 useMemo(() => new Capacitor3DView(), [])。
 * - React StrictMode 下组件会 mount → unmount → remount，cleanup 会 dispose view，
 *   但 useMemo 在 remount 时可能返回同一个（已 dispose 的）实例，导致 3D 视图为空。
 * - 改用 useState(() => new Capacitor3DView()) 惰性初始化：每次 mount（含 remount）
 *   都会执行 initializer 创建新实例，保证 remount 后拿到的是未被 dispose 的 view。
 */

import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { useEffect, useState } from 'react';
import { Capacitor3DView } from './Capacitor3DView';
import type { CapacitorExperiment } from './CapacitorExperiment';

interface SceneProps {
    experiment: CapacitorExperiment;
}

/**
 * 场景内组件：在 R3F Canvas 内部运行。
 * - useFrame 接入 R3F 渲染循环（每帧调用 view.update）
 * - <primitive> 把命令式 THREE.Group 注入 React 协调树
 */
function Capacitor3DScene({ experiment }: SceneProps) {
    // useState 惰性初始化：每次 mount 都创建新实例（关键：StrictMode remount 后拿到全新 view，
    // 而非已被 cleanup dispose 掉的旧实例）。useMemo 在 StrictMode 下不保证重新执行。
    const [view] = useState(() => new Capacitor3DView());

    // 卸载时释放所有 Three.js 资源（geometry / material）
    useEffect(() => {
        return () => {
            view.dispose();
        };
    }, [view]);

    // 接入 R3F 渲染循环（非独立 rAF，避免三重循环）
    // 注: view.update 只从 experiment 读 state/params，不依赖 dt；物理推进由
    // CapacitorExperiment.update 在另一条 rAF 链路完成，本视图只做"读取 + 可视化"。
    useFrame(() => {
        const state = experiment.getPhysicsState();
        const params = experiment.getParams();
        view.update(state, params);
    });

    return (
        <>
            <PerspectiveCamera makeDefault position={[3, 3, 5]} fov={50} />
            <OrbitControls
                enableDamping
                dampingFactor={0.05}
                minDistance={2}
                maxDistance={15}
                target={[0, 0, 0]}
            />
            {/* 灯光：复制 SceneContainer.DefaultLighting */}
            <ambientLight intensity={0.28} />
            <hemisphereLight args={['#7dd3fc', '#0b1023', 0.4]} />
            <directionalLight position={[10, 10, 5]} intensity={0.92} />
            <pointLight position={[-10, -10, -5]} intensity={0.4} color="#93c5fd" />
            <pointLight position={[8, 6, 6]} intensity={0.24} color="#5eead4" />
            {/* 命令式 group 注入 */}
            <primitive object={view.group} />
        </>
    );
}

interface Capacitor3DCanvasProps {
    experiment: CapacitorExperiment;
}

/**
 * 对外暴露的 Canvas 包装组件。
 * 父组件 CircuitView2D 通过 showField3D 控制是否挂载本组件。
 */
export function Capacitor3DCanvas({ experiment }: Capacitor3DCanvasProps) {
    return (
        <Canvas
            style={{
                width: '100%',
                height: '100%',
                background: '#0D1117',
                display: 'block',
            }}
            camera={{ position: [3, 3, 5], fov: 50 }}
        >
            <Capacitor3DScene experiment={experiment} />
        </Canvas>
    );
}

export default Capacitor3DCanvas;
