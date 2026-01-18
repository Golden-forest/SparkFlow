import { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ZoomIn, Play, Pause, RotateCcw } from 'lucide-react';

// 粒子状态
type ParticleState = 'flying_to_foil' | 'scattered' | 'hit' | 'escaped';

// 粒子数据类型
interface Particle {
    id: number;
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    state: ParticleState;
    type: 'direct' | 'small' | 'large';
}

// 痕迹点数据
interface HitMark {
    id: number;
    position: THREE.Vector3;
    type: 'direct' | 'small' | 'large';
}

// 常量配置
const DETECTOR_INNER_RADIUS = 4;
const DETECTOR_OUTER_RADIUS = 4.5;
const DETECTOR_HEIGHT = 1.5;
const GAP_ANGLE = Math.PI / 6;
const FOIL_X = 0;

/**
 * α粒子发生器组件
 */
function AlphaSource() {
    const meshRef = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        if (meshRef.current) {
            const material = meshRef.current.material as THREE.MeshStandardMaterial;
            material.emissiveIntensity = 0.5 + Math.sin(state.clock.elapsedTime * 3) * 0.3;
        }
    });

    return (
        <group position={[8, 0, 0]}>
            <mesh>
                <boxGeometry args={[2.5, 2, 2]} />
                <meshStandardMaterial color="#1e3a8a" metalness={0.6} roughness={0.4} />
            </mesh>
            <mesh ref={meshRef}>
                <sphereGeometry args={[0.4, 32, 32]} />
                <meshStandardMaterial color="#ff4500" emissive="#ff2200" emissiveIntensity={0.5} />
            </mesh>
            <mesh position={[-1.5, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.08, 0.08, 0.8, 16]} />
                <meshStandardMaterial color="#333" metalness={0.8} />
            </mesh>
        </group>
    );
}

/**
 * 金箔组件
 */
function GoldFoil() {
    return (
        <group position={[FOIL_X, 0, 0]}>
            <mesh>
                <boxGeometry args={[0.05, 2.5, 2.5]} />
                <meshStandardMaterial
                    color="#ffd700"
                    metalness={0.95}
                    roughness={0.05}
                    emissive="#ff8c00"
                    emissiveIntensity={0.15}
                />
            </mesh>
        </group>
    );
}

/**
 * 圆环形探测屏组件
 */
function DetectorScreen({ hitMarks }: { hitMarks: HitMark[] }) {
    const geometry = useMemo(() => {
        const shape = new THREE.Shape();
        const startAngle = GAP_ANGLE / 2;
        const endAngle = Math.PI * 2 - GAP_ANGLE / 2;

        shape.absarc(0, 0, DETECTOR_OUTER_RADIUS, startAngle, endAngle, false);
        shape.lineTo(Math.cos(endAngle) * DETECTOR_INNER_RADIUS, Math.sin(endAngle) * DETECTOR_INNER_RADIUS);
        shape.absarc(0, 0, DETECTOR_INNER_RADIUS, endAngle, startAngle, true);
        shape.lineTo(Math.cos(startAngle) * DETECTOR_OUTER_RADIUS, Math.sin(startAngle) * DETECTOR_OUTER_RADIUS);

        return new THREE.ExtrudeGeometry(shape, { depth: DETECTOR_HEIGHT * 2, bevelEnabled: false });
    }, []);

    return (
        <group rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
            <mesh geometry={geometry} position={[0, 0, -DETECTOR_HEIGHT]}>
                <meshStandardMaterial
                    color="#3b82f6"
                    metalness={0.3}
                    roughness={0.7}
                    transparent
                    opacity={0.7}
                    side={THREE.DoubleSide}
                />
            </mesh>

            {hitMarks.map((mark) => (
                <mesh key={mark.id} position={mark.position}>
                    <sphereGeometry args={[0.1, 8, 8]} />
                    <meshBasicMaterial
                        color={
                            mark.type === 'direct' ? '#ffdd00' :
                                mark.type === 'small' ? '#ffaa00' : '#ff4400'
                        }
                    />
                </mesh>
            ))}
        </group>
    );
}

/**
 * 检查位置是否在缝隙区域
 */
function isInGap(x: number, z: number): boolean {
    const angle = Math.atan2(z, x);
    return Math.abs(angle) < GAP_ANGLE / 2;
}

/**
 * 检查粒子是否击中探测屏内侧
 */
function checkDetectorHit(pos: THREE.Vector3): THREE.Vector3 | null {
    const distFromCenter = Math.sqrt(pos.x ** 2 + pos.z ** 2);

    if (distFromCenter >= DETECTOR_INNER_RADIUS && distFromCenter <= DETECTOR_OUTER_RADIUS) {
        if (Math.abs(pos.y) <= DETECTOR_HEIGHT) {
            if (!isInGap(pos.x, pos.z)) {
                const angle = Math.atan2(pos.z, pos.x);
                return new THREE.Vector3(
                    Math.cos(angle) * DETECTOR_INNER_RADIUS,
                    pos.z,
                    0
                );
            }
        }
    }
    return null;
}

/**
 * 粒子系统组件
 */
function ParticleSystem({
    particles,
    onParticleHit,
    onParticleUpdate
}: {
    particles: Particle[];
    onParticleHit: (particle: Particle, position: THREE.Vector3) => void;
    onParticleUpdate: (particles: Particle[]) => void;
}) {
    const meshRefs = useRef<Map<number, THREE.Mesh>>(new Map());

    useFrame((_, delta) => {
        let updated = false;

        particles.forEach((p) => {
            if (p.state === 'hit' || p.state === 'escaped') return;

            p.position.add(p.velocity.clone().multiplyScalar(delta));

            const mesh = meshRefs.current.get(p.id);
            if (mesh) {
                mesh.position.copy(p.position);
            }

            // 粒子到达金箔 - 在这里发生散射！
            if (p.state === 'flying_to_foil' && p.position.x <= FOIL_X) {
                p.state = 'scattered';

                // 决定散射类型和新速度
                const rand = Math.random();
                const speed = p.velocity.length();

                // 教学演示概率：直接穿过85%，小角度10%，大角度5%
                // 所有散射都在水平面(y=0)进行，确保粒子能打到探测屏
                if (rand > 0.15) {
                    // 直接穿过
                    p.type = 'direct';
                    // 继续向左飞（-x方向），在xz平面上有微小偏移
                    p.velocity.set(
                        -speed,
                        0, // 保持在水平面
                        (Math.random() - 0.5) * 0.5
                    );
                } else if (rand > 0.05) {
                    // 小角度散射（在xz平面上偏转）
                    p.type = 'small';
                    const scatterAngle = (Math.random() - 0.5) * Math.PI * 0.4;
                    p.velocity.set(
                        -speed * Math.cos(scatterAngle),
                        0, // 保持在水平面
                        speed * Math.sin(scatterAngle)
                    );
                } else {
                    // 大角度散射（在xz平面上，包括反弹回右侧）
                    p.type = 'large';
                    // 散射角在90°-170°之间，在xz平面上
                    const scatterAngle = (Math.random() > 0.5 ? 1 : -1) * (Math.PI * 0.5 + Math.random() * Math.PI * 0.4);
                    p.velocity.set(
                        speed * Math.cos(scatterAngle),
                        0, // 保持在水平面
                        speed * Math.sin(scatterAngle)
                    );
                }
                updated = true;
            }

            // 检测是否击中探测屏
            if (p.state === 'scattered') {
                const hitPos = checkDetectorHit(p.position);
                if (hitPos) {
                    p.state = 'hit';
                    onParticleHit(p, hitPos);
                    updated = true;
                }
            }

            // 飞出范围
            if (p.position.length() > 12) {
                p.state = 'escaped';
                updated = true;
            }
        });

        if (updated) {
            onParticleUpdate([...particles]);
        }
    });

    return (
        <group>
            {particles.map((p) => (
                (p.state === 'flying_to_foil' || p.state === 'scattered') && (
                    <mesh
                        key={p.id}
                        ref={(ref) => {
                            if (ref) meshRefs.current.set(p.id, ref);
                        }}
                        position={p.position}
                    >
                        <sphereGeometry args={[0.12, 12, 12]} />
                        <meshStandardMaterial
                            color="#ffd700"
                            emissive="#ffaa00"
                            emissiveIntensity={1}
                        />
                    </mesh>
                )
            ))}
        </group>
    );
}

/**
 * 实验场景
 */
function ExperimentScene({
    isRunning,
    onStatsUpdate
}: {
    isRunning: boolean;
    onStatsUpdate: (total: number, direct: number, small: number, large: number) => void;
}) {
    const [particles, setParticles] = useState<Particle[]>([]);
    const [hitMarks, setHitMarks] = useState<HitMark[]>([]);
    const nextId = useRef(0);
    const emitTimer = useRef(0);
    const stats = useRef({ total: 0, direct: 0, small: 0, large: 0 });

    useFrame((_, delta) => {
        if (!isRunning) return;

        emitTimer.current += delta;
        if (emitTimer.current >= 0.08) {
            emitTimer.current = 0;

            // 所有粒子都以相同方向发射（向左飞向金箔）
            const baseSpeed = 10;

            const newParticle: Particle = {
                id: nextId.current++,
                position: new THREE.Vector3(6, 0, 0),
                velocity: new THREE.Vector3(-baseSpeed, 0, 0), // 统一向左
                state: 'flying_to_foil',
                type: 'direct', // 初始类型，到达金箔时才决定真正类型
            };

            setParticles((prev) => [...prev.filter(p => p.state === 'flying_to_foil' || p.state === 'scattered').slice(-40), newParticle]);
            stats.current.total++;
            onStatsUpdate(stats.current.total, stats.current.direct, stats.current.small, stats.current.large);
        }
    });

    const handleParticleHit = (particle: Particle, position: THREE.Vector3) => {
        setHitMarks((prev) => [
            ...prev.slice(-300),
            { id: particle.id, position, type: particle.type }
        ]);

        if (particle.type === 'direct') stats.current.direct++;
        else if (particle.type === 'small') stats.current.small++;
        else stats.current.large++;

        onStatsUpdate(
            stats.current.total,
            stats.current.direct,
            stats.current.small,
            stats.current.large
        );
    };

    const handleParticleUpdate = (updatedParticles: Particle[]) => {
        setParticles(updatedParticles);
    };

    return (
        <>
            <AlphaSource />
            <GoldFoil />
            <DetectorScreen hitMarks={hitMarks} />
            <ParticleSystem
                particles={particles}
                onParticleHit={handleParticleHit}
                onParticleUpdate={handleParticleUpdate}
            />
        </>
    );
}

/**
 * 宏观实验装置页面
 */
export default function MacroExperimentView() {
    const navigate = useNavigate();
    const [isRunning, setIsRunning] = useState(false);
    const [stats, setStats] = useState({ total: 0, direct: 0, small: 0, large: 0 });

    const handleViewMicro = () => {
        navigate('/experiment/rutherford-scattering/micro');
    };

    const handleReset = () => {
        setIsRunning(false);
        setStats({ total: 0, direct: 0, small: 0, large: 0 });
        window.location.reload();
    };

    return (
        <div className="h-screen flex flex-col bg-slate-900">
            <header className="flex items-center justify-between border-b border-white/10 bg-slate-900/95 backdrop-blur-sm px-6 py-4 z-10">
                <div className="flex items-center gap-4">
                    <Link to="/" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 hover:text-white transition-all duration-200 border border-white/5 hover:border-white/10">
                        <ArrowLeft size={18} />
                        <span className="font-medium">Back</span>
                    </Link>
                    <div className="h-6 w-px bg-white/10" />
                    <h1 className="text-xl font-semibold text-white tracking-wide">Rutherford α-Particle Scattering - Device View</h1>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsRunning(!isRunning)}
                        className={`flex items-center gap-2.5 px-5 py-2.5 rounded-lg font-medium transition-all duration-200 shadow-lg ${isRunning ? 'bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white shadow-orange-900/30' : 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white shadow-emerald-900/30'
                            }`}
                    >
                        {isRunning ? <Pause size={18} /> : <Play size={18} />}
                        <span className="tracking-wide">{isRunning ? 'Pause' : 'Start'}</span>
                    </button>
                    <button
                        onClick={handleReset}
                        className="flex items-center gap-2.5 px-5 py-2.5 rounded-lg bg-gradient-to-r from-slate-700 to-slate-600 hover:from-slate-600 hover:to-slate-500 text-white font-medium transition-all duration-200 shadow-lg shadow-slate-900/30 border border-white/10"
                    >
                        <RotateCcw size={18} />
                        <span className="tracking-wide">Reset</span>
                    </button>
                </div>
            </header>

            <main className="flex-1 relative">
                <Canvas shadows>
                    {/* 俯视角度，稍微倾斜，可以看到整个探测屏 */}
                    <PerspectiveCamera makeDefault position={[2, 15, 8]} fov={50} />
                    <OrbitControls enableDamping dampingFactor={0.05} minDistance={8} maxDistance={25} target={[0, 0, 0]} />

                    <ambientLight intensity={0.5} />
                    <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
                    <pointLight position={[8, 2, 0]} intensity={0.8} color="#ff6b35" />

                    <ExperimentScene isRunning={isRunning} onStatsUpdate={(t, d, s, l) => setStats({ total: t, direct: d, small: s, large: l })} />

                    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]} receiveShadow>
                        <planeGeometry args={[30, 30]} />
                        <meshStandardMaterial color="#1e293b" />
                    </mesh>
                </Canvas>

                {/* 右下角数据面板 */}
                <div className="absolute bottom-4 right-4 w-64 rounded-lg bg-slate-800/90 backdrop-blur-sm border border-white/10 p-3">
                    <h3 className="text-sm font-semibold text-white mb-2">Experiment Data</h3>
                    <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                            <span className="text-slate-400">Particles Emitted</span>
                            <span className="text-white font-mono">{stats.total}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-yellow-400">Direct Passage</span>
                            <span className="text-white font-mono">{stats.direct} ({stats.total > 0 ? ((stats.direct / stats.total) * 100).toFixed(1) : 0}%)</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-orange-400">Small Angle Scatter</span>
                            <span className="text-white font-mono">{stats.small} ({stats.total > 0 ? ((stats.small / stats.total) * 100).toFixed(1) : 0}%)</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-red-400">Large Angle Scatter</span>
                            <span className="text-white font-mono">{stats.large} ({stats.total > 0 ? ((stats.large / stats.total) * 100).toFixed(1) : 0}%)</span>
                        </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-white/10">
                        <button
                            onClick={handleViewMicro}
                            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium py-2 rounded-lg transition-colors"
                        >
                            <ZoomIn size={16} />
                            View Microscopic
                        </button>
                    </div>
                </div>

                {/* 底部图例 */}
                <div className="absolute bottom-4 left-4 rounded-lg bg-slate-800/80 backdrop-blur-sm border border-white/10 px-4 py-3">
                    <div className="flex items-center gap-6 text-sm">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                            <span className="text-slate-300">Direct Passage</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-orange-400"></div>
                            <span className="text-slate-300">Small Angle</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-500"></div>
                            <span className="text-slate-300">Large Angle</span>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
