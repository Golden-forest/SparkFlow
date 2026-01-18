import { useEffect, useState } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Play, Pause, RotateCcw, ZoomOut } from 'lucide-react';
import { SceneContainer, ExperimentScene, DataDisplay } from '@/components/simulation';
import { useSimulationStore } from '@/stores/simulationStore';
import { ExperimentRegistry, type DisplayValue } from '@/experiments/base';
import { SimulationState } from '@/utils/constants';

// 导入实验注册
import '@/experiments';

// 导入自定义工具栏和类型
import { SideToolbar } from '@/components/simulation/SideToolbar';
import type { SceneMode } from '@/experiments/atomic/hydrogen-transitions/TransitionPhysics';
import { getValidTransitionEnergies } from '@/experiments/atomic/hydrogen-transitions/TransitionPhysics';

// 实验说明内容类型
interface ExperimentDescriptionItem {
    colorClass: string;
    label: string;
    description: string;
}

// 根据实验ID获取说明内容
function getExperimentDescription(experimentId: string | undefined): ExperimentDescriptionItem[] {
    if (!experimentId) return [];

    switch (experimentId) {
        case 'solar-system':
            return [
                { colorClass: 'text-yellow-400', label: '金黄色大球', description: '太阳' },
                { colorClass: 'text-orange-400', label: '彩色小球', description: '行星' },
                { colorClass: 'text-slate-400', label: '灰白色圆环', description: '行星轨道' },
                { colorClass: 'text-blue-400', label: '当前视图', description: '太阳系视图 / 卫星视图' },
            ];

        case 'rutherford-scattering':
            return [
                { colorClass: 'text-yellow-400', label: '金黄色小球', description: '原子核' },
                { colorClass: 'text-green-400', label: '蓝绿色小球', description: '电子' },
                { colorClass: 'text-blue-400', label: '彩色圆环', description: '电子轨道 (n=1-6)' },
            ];

        case 'hydrogen-transitions':
            return [
                { colorClass: 'text-yellow-400', label: '金黄色小球', description: '原子核' },
                { colorClass: 'text-green-400', label: '蓝绿色小球', description: '电子' },
                { colorClass: 'text-blue-400', label: '彩色圆环', description: '电子轨道 (n=1-6)' },
                { colorClass: 'text-purple-400', label: '波动线条', description: '光子' },
            ];

        default:
            return [];
    }
}

export default function ExperimentView() {
    const { experimentId: paramId } = useParams<{ experimentId: string }>();
    const location = useLocation();

    // 判断是否为卢瑟福微观视图（固定路由）
    const isRutherfordMicro = location.pathname === '/experiment/rutherford-scattering/micro';
    const experimentId = isRutherfordMicro ? 'rutherford-scattering' : paramId;
    const isHydrogen = experimentId === 'hydrogen-transitions';

    const { state, start, pause, resume, reset, setExperiment, currentExperiment } = useSimulationStore();

    const [displayData, setDisplayData] = useState<Record<string, DisplayValue>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Hydrogen 特有状态
    const [sceneMode, setSceneMode] = useState<SceneMode>('stimulated-absorption');
    const [currentLevel, setCurrentLevel] = useState(1);
    const [photonEnergy, setPhotonEnergy] = useState(10.2);
    const [electronCount, setElectronCount] = useState<'single' | 'multi'>('single');
    const [validEnergies, setValidEnergies] = useState<number[]>([]);

    // 加载实验
    useEffect(() => {
        if (!experimentId) return;

        setIsLoading(true);
        setError(null);

        try {
            if (!ExperimentRegistry.has(experimentId)) {
                throw new Error(`实验 "${experimentId}" 未注册`);
            }
            const experiment = ExperimentRegistry.create(experimentId);
            setExperiment(experiment);

            // 初始化特定实验的状态
            if (experimentId === 'hydrogen-transitions') {
                // 默认值同步
                setSceneMode(experiment.getParameter('excitationMode') as SceneMode || 'stimulated-absorption');
                setCurrentLevel(experiment.getParameter('initialLevel') as number || 1);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : '加载实验失败');
        } finally {
            setIsLoading(false);
        }

        return () => {
            setExperiment(null);
        };
    }, [experimentId, setExperiment]);

    // 刷新显示数据 & 计算有效能量
    useEffect(() => {
        if (!currentExperiment) return;

        const interval = setInterval(() => {
            setDisplayData(currentExperiment.getDisplayData());

            // 如果是氢原子实验，并且正在运行（自发辐射可能自动改变能级），需要同步能级
            if (isHydrogen && state === SimulationState.Running) {
                // 注意：这里可能需要从 displayData 或 getParameter 获取实时能级
                // 但目前架构中 parameter 通常是输入，displayData 是输出
                // 我们暂时信任 React 状态作为 source of truth 用于控制
            }
        }, 100);

        return () => clearInterval(interval);
    }, [currentExperiment, isHydrogen, state]);

    // 更新有效能量列表
    useEffect(() => {
        if (isHydrogen) {
            setValidEnergies(getValidTransitionEnergies(currentLevel, sceneMode));
        }
    }, [currentLevel, sceneMode, isHydrogen]);

    const handlePlayPause = () => {
        if (state === SimulationState.Running) {
            pause();
        } else if (state === SimulationState.Paused) {
            resume();
        } else {
            start();
        }
    };

    const handleReset = () => {
        reset();
        if (isHydrogen) {
            // 重置 React 状态
            // 保持当前模式，但重置能级
            if (sceneMode === 'stimulated-absorption') {
                setCurrentLevel(1);
                handleHydrogenParam('initialLevel', 1);
            } else {
                setCurrentLevel(3); // 激发态默认
                handleHydrogenParam('initialLevel', 3);
            }
        }
    };

    const handleHydrogenParam = (key: string, value: any) => {
        if (!currentExperiment) return;
        currentExperiment.setParameter(key, value);

        if (key === 'excitationMode') setSceneMode(value);
        if (key === 'initialLevel') setCurrentLevel(value);
        if (key === 'inputEnergy') setPhotonEnergy(value);
        if (key === 'atomType') setElectronCount(value === 'single' ? 'single' : 'multi');
    };

    const isPlaying = state === SimulationState.Running;

    const handleEmit = () => {
        // 确保仿真在运行
        if (state !== SimulationState.Running) {
            start();
        }

        // 触发发射信号
        // 我们利用 Parameter Change 并不总是需要改变值，只要触发 notify 即可
        // 但为了保险，我们用时间戳
        handleHydrogenParam('triggerEmission', Date.now());
    };

    if (isLoading) {
        return (
            <div className="h-screen flex items-center justify-center bg-slate-900">
                <div className="text-white text-xl">加载中...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-screen flex flex-col items-center justify-center bg-slate-900">
                <div className="text-red-400 text-xl mb-4">{error}</div>
                <Link to="/" className="text-blue-400 hover:underline">返回首页</Link>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col bg-slate-900">
            {/* 顶部导航栏 */}
            <header className="flex items-center justify-between border-b border-white/10 bg-slate-900/95 backdrop-blur-sm px-6 py-4 z-10">
                <div className="flex items-center gap-4">
                    <Link
                        to={isRutherfordMicro ? '/experiment/rutherford-scattering' : '/'}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 hover:text-white transition-all duration-200 border border-white/5 hover:border-white/10"
                    >
                        {isRutherfordMicro ? <ZoomOut size={18} /> : <ArrowLeft size={18} />}
                        <span className="font-medium">{isRutherfordMicro ? 'Back to Device' : 'Back'}</span>
                    </Link>
                    <div className="h-6 w-px bg-white/10" />
                    <h1 className="text-xl font-semibold text-white tracking-wide">
                        {currentExperiment?.metadata.name ?? 'Experiment'}
                    </h1>
                </div>

                {/* 控制按钮 - 仅在非氢原子实验显示 */}
                {!isHydrogen && (
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handlePlayPause}
                            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-lg font-medium transition-all duration-200 shadow-lg ${isPlaying
                                ? 'bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white shadow-orange-900/30'
                                : 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white shadow-emerald-900/30'
                                }`}
                        >
                            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                            <span className="tracking-wide">{isPlaying ? 'Pause' : state === SimulationState.Paused ? 'Resume' : 'Start'}</span>
                        </button>
                        <button
                            onClick={handleReset}
                            className="flex items-center gap-2.5 px-5 py-2.5 rounded-lg bg-gradient-to-r from-slate-700 to-slate-600 hover:from-slate-600 hover:to-slate-500 text-white font-medium transition-all duration-200 shadow-lg shadow-slate-900/30 border border-white/10"
                        >
                            <RotateCcw size={18} />
                            <span className="tracking-wide">Reset</span>
                        </button>
                    </div>
                )}

              {/* 氢原子实验跳转按钮 */}
                {isHydrogen && (
                    <Link
                        to="/experiment/hydrogen-transitions/abstract"
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium transition-colors"
                    >
                        <span>Abstract Demo</span>
                        <ArrowLeft className="rotate-180" size={18} />
                    </Link>
                )}
            </header>

            {/* 3D场景 */}
            <main className="flex-1 relative">
                <SceneContainer
                    cameraPosition={currentExperiment?.config.camera.position ?? [0, 12, 8]}
                    cameraTarget={currentExperiment?.config.camera.target ?? [0, 0, 0]}
                    cameraFov={currentExperiment?.config.camera.fov ?? 50}
                    showGrid={false}
                    showAxes={false}
                >
                    <ExperimentScene experiment={currentExperiment} />
                </SceneContainer>

                {/* 氢原子实验专用工具栏 (右侧) */}
                {isHydrogen && (
                    <SideToolbar
                        sceneMode={sceneMode}
                        onSceneModeChange={(mode) => {
                            // 切换模式逻辑
                            let newLevel = currentLevel;
                            if (mode === 'stimulated-absorption') {
                                // 切换到吸收模式，默认回到基态或保持（如果当前是基态）
                                if (newLevel > 1) newLevel = 1;
                            } else {
                                // 切换到辐射模式，需要激发态
                                // 如果从吸收切换过来且已经在激发态，保持
                                // 否则默认设为 3
                                if (sceneMode === 'stimulated-absorption' && currentLevel > 1) {
                                    // keep currentLevel
                                } else if (currentLevel <= 1) {
                                    newLevel = 3;
                                }
                            }

                            setSceneMode(mode);
                            setCurrentLevel(newLevel);

                            // 同步到实验
                            handleHydrogenParam('excitationMode', mode);
                            handleHydrogenParam('initialLevel', newLevel);
                        }}
                        currentLevel={currentLevel}
                        onLevelChange={(level) => handleHydrogenParam('initialLevel', level)}
                        photonEnergy={photonEnergy}
                        onPhotonEnergyChange={(energy) => handleHydrogenParam('inputEnergy', energy)}
                        validEnergies={validEnergies}
                        electronCount={electronCount}
                        onElectronCountChange={(count) => handleHydrogenParam('atomType', count === 'single' ? 'single' : 'group')}
                        isRunning={isPlaying}
                        onTogglePlay={handlePlayPause}
                        onReset={handleReset}
                        onEmit={handleEmit}
                    />
                )}

                {/* 数据统计面板和实验说明已移除 */}
            </main>
        </div>
    );
}
