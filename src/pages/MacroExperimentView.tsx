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
                <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.4} />
            </mesh>
            <mesh ref={meshRef}>
                <sphereGeometry args={[0.4, 32, 32]} />
                <meshStandardMaterial color="#38BDF8" emissive="#0EA5E9" emissiveIntensity={0.5} />
            </mesh>
            <mesh position={[-1.5, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.08, 0.08, 0.8, 16]} />
                <meshStandardMaterial color="#64748b" metalness={0.8} />
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
                    color="#22D3EE"
                    metalness={0.3}
                    roughness={0.7}
                    transparent
                    opacity={0.8}
                    side={THREE.DoubleSide}
                />
            </mesh>

            {hitMarks.map((mark) => (
                <mesh key={mark.id} position={mark.position}>
                    <sphereGeometry args={[0.1, 8, 8]} />
                    <meshBasicMaterial
                        color={
                            mark.type === 'direct' ? '#34D399' :
                                mark.type === 'small' ? '#F59E0B' : '#F97316'
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
        <div className="relative flex h-screen flex-col overflow-hidden bg-slate-950">
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute -top-40 left-1/2 h-[420px] w-[640px] -translate-x-1/2 rounded-full bg-cyan-400/12 blur-3xl" />
                <div className="absolute -bottom-48 right-8 h-[320px] w-[320px] rounded-full bg-emerald-300/8 blur-3xl" />
            </div>

            <header className="z-10 mx-4 mt-4 flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900/78 px-6 py-4 shadow-[0_18px_55px_rgba(2,12,27,0.45)] backdrop-blur-xl">
                <div className="flex items-center gap-4">
                    <Link to="/" className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-800/65 px-4 py-2 text-slate-200 transition-all duration-200 hover:border-cyan-200/40 hover:bg-slate-700/70">
                        <ArrowLeft size={18} />
                        <span className="font-medium">Back</span>
                    </Link>
                    <div className="h-6 w-px bg-white/10" />
                    <h1 className="bg-gradient-to-r from-[#22D3EE] via-[#60A5FA] to-[#818CF8] bg-clip-text text-xl font-semibold tracking-wide text-transparent">
                        Rutherford α-Particle Scattering - Device View
                    </h1>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsRunning(!isRunning)}
                        className={`flex items-center gap-2.5 rounded-xl px-5 py-2.5 font-medium text-white shadow-lg transition-all duration-200 ${isRunning ? 'bg-gradient-to-r from-amber-600 to-orange-500 shadow-orange-900/30 hover:from-amber-500 hover:to-orange-400' : 'bg-gradient-to-r from-sky-600 to-cyan-500 shadow-cyan-900/30 hover:from-sky-500 hover:to-cyan-400'
                            }`}
                    >
                        {isRunning ? <Pause size={18} /> : <Play size={18} />}
                        <span className="tracking-wide">{isRunning ? 'Pause' : 'Start'}</span>
                    </button>
                    <button
                        onClick={handleReset}
                        className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-slate-800/85 px-5 py-2.5 font-medium text-slate-100 shadow-lg shadow-slate-950/40 transition-all duration-200 hover:bg-slate-700/85"
                    >
                        <RotateCcw size={18} />
                        <span className="tracking-wide">Reset</span>
                    </button>
                </div>
            </header>

            <main className="relative flex-1 px-4 pb-4 pt-3">
                <div className="relative h-full overflow-hidden rounded-2xl border border-white/10 bg-slate-900/45 shadow-[0_18px_60px_rgba(2,12,27,0.5)]">
                    <Canvas
                        shadows
                        style={{
                            background:
                                'radial-gradient(circle at 16% 15%, rgba(56, 189, 248, 0.18), transparent 34%), radial-gradient(circle at 84% 80%, rgba(0, 255, 65, 0.08), transparent 40%), linear-gradient(180deg, #0D1117 0%, #111827 46%, #1a2332 100%)',
                        }}
                    >
                    {/* 俯视角度，稍微倾斜，可以看到整个探测屏 */}
                    <PerspectiveCamera makeDefault position={[2, 15, 8]} fov={50} />
                    <OrbitControls enableDamping dampingFactor={0.05} minDistance={8} maxDistance={25} target={[0, 0, 0]} />

                    <ambientLight intensity={0.5} />
                    <hemisphereLight args={['#8be9ff', '#0b1021', 0.55]} />
                    <directionalLight position={[10, 10, 5]} intensity={1.2} castShadow />
                    <pointLight position={[8, 2, 0]} intensity={0.5} color="#38BDF8" />
                    <pointLight position={[-7, 5, -4]} intensity={0.4} color="#00FF41" />

                    <ExperimentScene isRunning={isRunning} onStatsUpdate={(t, d, s, l) => setStats({ total: t, direct: d, small: s, large: l })} />

                    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]} receiveShadow>
                        <planeGeometry args={[30, 30]} />
                        <meshStandardMaterial color="#1a2332" />
                    </mesh>
                    </Canvas>
                </div>

                {/* 右下角数据面板 */}
                <div className="absolute bottom-8 right-8 w-72 rounded-2xl border border-white/10 bg-slate-900/82 p-4 shadow-xl shadow-slate-950/45 backdrop-blur-xl">
                    <h3 className="mb-3 text-sm font-semibold text-white">Experiment Data</h3>
                    <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                            <span className="text-slate-400">Particles Emitted</span>
                            <span className="text-white font-mono">{stats.total}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-emerald-400">Direct Passage</span>
                            <span className="text-white font-mono">{stats.direct} ({stats.total > 0 ? ((stats.direct / stats.total) * 100).toFixed(1) : 0}%)</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-amber-400">Small Angle Scatter</span>
                            <span className="text-white font-mono">{stats.small} ({stats.total > 0 ? ((stats.small / stats.total) * 100).toFixed(1) : 0}%)</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-orange-500">Large Angle Scatter</span>
                            <span className="text-white font-mono">{stats.large} ({stats.total > 0 ? ((stats.large / stats.total) * 100).toFixed(1) : 0}%)</span>
                        </div>
                    </div>

                    <div className="mt-4 border-t border-white/10 pt-3">
                        <button
                            onClick={handleViewMicro}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 py-2 text-xs font-medium text-white transition-all duration-200 hover:from-sky-500 hover:to-cyan-400"
                        >
                            <ZoomIn size={16} />
                            View Microscopic
                        </button>
                    </div>
                </div>

                {/* 底部图例 */}
                <div className="absolute bottom-8 left-8 rounded-2xl border border-white/10 bg-slate-900/78 px-4 py-3 backdrop-blur-xl">
                    <div className="flex items-center gap-6 text-sm">
                        <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-full bg-emerald-400" />
                            <span className="text-slate-300">Direct Passage</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-full bg-amber-400" />
                            <span className="text-slate-300">Small Angle</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-full bg-orange-500" />
                            <span className="text-slate-300">Large Angle</span>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
