import { useEffect, useState } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Play, Pause, RotateCcw, ZoomOut } from 'lucide-react';
import { SceneContainer, ExperimentScene, DataDisplay } from '@/components/simulation';
import { useSimulationStore } from '@/stores/simulationStore';
import { ExperimentRegistry, type DisplayValue } from '@/experiments/base';
import { SimulationState } from '@/utils/constants';

// 导入实验注册
import '@/experiments';

export default function ExperimentView() {
    const { experimentId: paramId } = useParams<{ experimentId: string }>();
    const location = useLocation();

    // 判断是否为卢瑟福微观视图（固定路由）
    const isRutherfordMicro = location.pathname === '/experiment/rutherford-scattering/micro';
    const experimentId = isRutherfordMicro ? 'rutherford-scattering' : paramId;

    const { state, start, pause, resume, reset, setExperiment, currentExperiment } = useSimulationStore();

    const [displayData, setDisplayData] = useState<Record<string, DisplayValue>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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
        } catch (err) {
            setError(err instanceof Error ? err.message : '加载实验失败');
        } finally {
            setIsLoading(false);
        }

        return () => {
            setExperiment(null);
        };
    }, [experimentId, setExperiment]);

    // 刷新显示数据
    useEffect(() => {
        if (!currentExperiment) return;

        const interval = setInterval(() => {
            setDisplayData(currentExperiment.getDisplayData());
        }, 100);

        return () => clearInterval(interval);
    }, [currentExperiment]);

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
    };

    const isPlaying = state === SimulationState.Running;

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

                {/* 简化的控制按钮 */}
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

                {/* 数据统计面板 */}
                <DataDisplay data={displayData} />

                {/* 实验说明卡片 - 右下角 */}
                <div className="absolute bottom-4 right-4 w-64 rounded-lg bg-slate-800/90 backdrop-blur-sm border border-white/10 p-3">
                    <h3 className="text-sm font-semibold text-white mb-2">实验说明</h3>
                    <div className="space-y-1.5 text-xs text-slate-300">
                        <p>
                            <span className="text-yellow-400 font-medium">金黄色小球</span>：原子核
                        </p>
                        <p>
                            <span className="text-blue-400 font-medium">蓝色区域</span>：电子云
                        </p>
                        <p>
                            <span className="text-green-400 font-medium">绿色粒子</span>：α粒子
                        </p>
                        <p>
                            <span className="text-red-400 font-medium">红色轨迹</span>：大角度散射(&gt;90°)
                        </p>
                    </div>
                    <div className="mt-3 pt-3 border-t border-white/10">
                        <h4 className="text-xs font-semibold text-white mb-1.5">实验结论</h4>
                        <ul className="text-xs text-slate-400 space-y-0.5">
                            <li>• 大多数α粒子直接穿过</li>
                            <li>• 极少数大角度散射</li>
                            <li>• 理论比例：约1/8000发生大角度散射</li>
                        </ul>
                    </div>
                </div>
            </main>
        </div>
    );
}
