import React from 'react';
import { Play, Pause, RotateCcw, Atom } from 'lucide-react';
import type { SceneMode } from '@/experiments/atomic/hydrogen-transitions/TransitionPhysics';

interface SideToolbarProps {
    sceneMode: SceneMode;
    onSceneModeChange: (mode: SceneMode) => void;
    currentLevel: number;
    onLevelChange: (level: number) => void;
    photonEnergy: number;
    onPhotonEnergyChange: (energy: number) => void;
    validEnergies: number[];
    electronCount: 'single' | 'multi';
    onElectronCountChange: (count: 'single' | 'multi') => void;
    isRunning: boolean;
    onTogglePlay: () => void;
    onReset: () => void;
    onEmit: () => void;
}

export const SideToolbar: React.FC<SideToolbarProps> = ({
    sceneMode,
    onSceneModeChange,
    currentLevel,
    onLevelChange,
    photonEnergy,
    onPhotonEnergyChange,
    validEnergies,
    electronCount,
    onElectronCountChange,
    isRunning,
    onTogglePlay,
    onReset,
    onEmit,
}) => {
    // 能量滑块磁吸逻辑
    const handleEnergyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = parseFloat(e.target.value);

        // 磁吸效果
        const closest = validEnergies.reduce((prev, curr) => {
            return (Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev);
        }, -100);

        if (Math.abs(closest - value) < 0.3) {
            value = closest;
        }

        onPhotonEnergyChange(value);
    };

    return (
        <div className="absolute right-4 top-20 bottom-8 w-64 flex flex-col gap-4 pointer-events-none z-50">
            <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl border border-white/10 p-5 shadow-2xl flex flex-col gap-6 pointer-events-auto h-full overflow-y-auto">

                {/* 标题 */}
                <div className="flex items-center gap-2 border-b border-white/10 pb-4">
                    <Atom className="text-blue-400" size={24} />
                    <h3 className="text-white font-semibold">控制面板</h3>
                </div>

                {/* 场景选择 */}
                <div className="flex flex-col gap-2">
                    <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">实验场景</span>
                    <select
                        value={sceneMode}
                        onChange={(e) => onSceneModeChange(e.target.value as SceneMode)}
                        className="bg-slate-800 text-white text-sm rounded-lg border border-slate-700 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                    >
                        <option value="stimulated-absorption">受激吸收 (Absorb)</option>
                        <option value="spontaneous-emission">自发辐射 (Spontaneous)</option>
                        <option value="stimulated-emission">受激辐射 (Stimulated)</option>
                    </select>
                </div>

                <div className="h-px bg-white/10" />

                {/* 能级选择 */}
                <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                            {sceneMode === 'stimulated-absorption' ? '初始能级' : '激发态能级'}
                        </span>
                        <span className="text-white font-mono bg-slate-800 px-2 py-0.5 rounded text-sm">
                            n = {currentLevel}
                        </span>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => onLevelChange(Math.max(sceneMode === 'stimulated-absorption' ? 1 : 2, currentLevel - 1))}
                            disabled={currentLevel <= (sceneMode === 'stimulated-absorption' ? 1 : 2)}
                            className="flex-1 h-8 rounded bg-slate-700 text-white flex items-center justify-center hover:bg-slate-600 disabled:opacity-50 transition-colors"
                        >
                            -
                        </button>
                        <button
                            onClick={() => onLevelChange(Math.min(6, currentLevel + 1))}
                            disabled={currentLevel >= 6}
                            className="flex-1 h-8 rounded bg-slate-700 text-white flex items-center justify-center hover:bg-slate-600 disabled:opacity-50 transition-colors"
                        >
                            +
                        </button>
                    </div>
                </div>

                {/* 光子能量滑块 */}
                {sceneMode !== 'spontaneous-emission' && (
                    <>
                        <div className="h-px bg-white/10" />
                        <div className="flex flex-col gap-3">
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">光子能量</span>
                                <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${validEnergies.includes(photonEnergy)
                                        ? 'bg-green-500/20 text-green-400'
                                        : 'bg-slate-700 text-slate-300'
                                    }`}>
                                    {photonEnergy.toFixed(2)} eV
                                </span>
                            </div>

                            {/* 垂直或水平滑块？右侧边栏适合垂直吗？不，还是水平比较好控制 */}
                            <div className="relative h-8 flex items-center">
                                {/* 标记点 */}
                                {validEnergies.map(e => (
                                    <div
                                        key={e}
                                        className={`absolute w-1.5 h-1.5 rounded-full pointer-events-none transition-colors duration-300 ${Math.abs(photonEnergy - e) < 0.05 ? 'bg-green-400 scale-150' : 'bg-white/30'
                                            }`}
                                        style={{ left: `${(e / 15) * 100}%` }}
                                    />
                                ))}
                                {/* 滑块轨道 */}
                                <input
                                    type="range"
                                    min={0}
                                    max={15}
                                    step={0.01}
                                    value={photonEnergy}
                                    onChange={handleEnergyChange}
                                    className="w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:bg-slate-700 [&::-webkit-slider-runnable-track]:rounded-full"
                                />
                            </div>

                            <button
                                onClick={onEmit}
                                className={`w-full py-3 rounded-lg font-bold text-sm tracking-wide transition-all shadow-lg flex items-center justify-center gap-2 ${validEnergies.includes(photonEnergy)
                                        ? 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-blue-500/20'
                                        : 'bg-slate-700 text-slate-400 cursor-not-allowed' // 仍然允许点击，只是样式置灰？或者就是允许点击但只发射无效光子
                                    }`}
                            >
                                <span className="text-yellow-300">⚡</span>
                                发射光子
                            </button>
                            <p className="text-[10px] text-slate-500 text-center leading-tight">
                                {validEnergies.includes(photonEnergy)
                                    ? '能量匹配！可以激发跃迁'
                                    : '能量未匹配，光子将穿过原子'}
                            </p>
                        </div>
                    </>
                )}

                {/* 电子数量 */}
                {sceneMode === 'spontaneous-emission' && (
                    <>
                        <div className="h-px bg-white/10" />
                        <div className="flex flex-col gap-2">
                            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">电子数量</span>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => onElectronCountChange('single')}
                                    className={`py-2 text-xs rounded-lg transition-all border ${electronCount === 'single'
                                            ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                                        }`}
                                >
                                    单电子
                                </button>
                                <button
                                    onClick={() => onElectronCountChange('multi')}
                                    className={`py-2 text-xs rounded-lg transition-all border ${electronCount === 'multi'
                                            ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                                        }`}
                                >
                                    多电子
                                </button>
                            </div>
                        </div>

                        <div className="mt-auto">
                            <button
                                onClick={onTogglePlay}
                                className={`w-full py-3 rounded-lg font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2 ${isRunning
                                        ? 'bg-orange-600 hover:bg-orange-500 text-white shadow-orange-500/20'
                                        : 'bg-green-600 hover:bg-green-500 text-white shadow-green-500/20'
                                    }`}
                            >
                                {isRunning ? <Pause size={18} /> : <Play size={18} />}
                                {isRunning ? '暂停实验' : '开始实验'}
                            </button>
                        </div>
                    </>
                )}

                {/* 重置按钮 - 始终显示在最下方 */}
                <div className="mt-4 pt-4 border-t border-white/10">
                    <button
                        onClick={onReset}
                        className="w-full flex items-center justify-center gap-2 py-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors text-sm"
                    >
                        <RotateCcw size={16} />
                        重置所有状态
                    </button>
                </div>
            </div>
        </div>
    );
};
