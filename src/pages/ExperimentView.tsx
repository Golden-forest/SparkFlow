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
                        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
                    >
                        {isRutherfordMicro ? <ZoomOut size={20} /> : <ArrowLeft size={20} />}
                        <span>{isRutherfordMicro ? '返回装置视图' : '返回'}</span>
                    </Link>
                    <div className="h-6 w-px bg-white/10" />
                    <h1 className="text-xl font-semibold text-white">
                        {currentExperiment?.metadata.name ?? '实验'}
                    </h1>
                </div>

                {/* 控制按钮 - 仅在非氢原子实验显示 */}
                {!isHydrogen && (
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handlePlayPause}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-colors ${isPlaying
                                ? 'bg-orange-600 hover:bg-orange-700 text-white'
                                : 'bg-green-600 hover:bg-green-700 text-white'
                                }`}
                        >
                            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                            <span>{isPlaying ? '暂停' : state === SimulationState.Paused ? '继续' : '开始实验'}</span>
                        </button>
                        <button
                            onClick={handleReset}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors"
                        >
                            <RotateCcw size={18} />
                            <span>重置</span>
                        </button>
                    </div>
                )}

                {/* 氢原子实验跳转按钮 */}
                {isHydrogen && (
                    <Link
                        to="/experiment/hydrogen-transitions/abstract"
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium transition-colors"
                    >
                        <span>切换到抽象演示</span>
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

                {/* 数据统计面板 - 氢原子实验可能不需要这个通用面板，或者简化显示 */}
                {!isHydrogen && <DataDisplay data={displayData} />}

                {/* 实验说明卡片 - 右下角 (氢原子模式下需要让位给 SideToolbar, 改到左下角) */}
                <div className={`absolute w-64 rounded-lg bg-slate-800/90 backdrop-blur-sm border border-white/10 p-3 ${isHydrogen ? 'bottom-4 left-4' : 'bottom-4 right-4'
                    }`}>
                    <h3 className="text-sm font-semibold text-white mb-2">实验说明</h3>
                    <div className="space-y-1.5 text-xs text-slate-300">
                        <p>
                            <span className="text-yellow-400 font-medium">金黄色小球</span>：原子核
                        </p>
                        <p>
                            <span className="text-green-400 font-medium">蓝绿色小球</span>：电子
                        </p>
                        <p>
                            <span className="text-blue-400 font-medium">彩色圆环</span>：电子轨道 (n=1-6)
                        </p>
                        {isHydrogen && (
                            <p>
                                <span className="text-purple-400 font-medium">波动线条</span>：光子
                            </p>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
