import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Atom } from 'lucide-react';
import type { SceneMode } from '@/experiments/atomic/hydrogen-transitions/TransitionPhysics';

interface BottomToolbarProps {
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

export const BottomToolbar: React.FC<BottomToolbarProps> = ({
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

        // 磁吸效果：如果距离某个有效值很近(0.3eV以内)，吸附过去
        const closest = validEnergies.reduce((prev, curr) => {
            return (Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev);
        }, -100);

        if (Math.abs(closest - value) < 0.3) {
            value = closest;
        }

        onPhotonEnergyChange(value);
    };

    return (
        <div className="fixed bottom-0 left-0 right-0 p-6 flex justify-center pointer-events-none z-50">
            <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl border border-white/10 p-4 shadow-2xl flex items-center gap-6 pointer-events-auto">

                {/* 场景选择 */}
                <div className="flex flex-col gap-1">
                    <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">实验场景</span>
                    <select
                        value={sceneMode}
                        onChange={(e) => onSceneModeChange(e.target.value as SceneMode)}
                        className="bg-slate-800 text-white text-sm rounded-lg border border-slate-700 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="stimulated-absorption">受激吸收</option>
                        <option value="spontaneous-emission">自发辐射</option>
                        <option value="stimulated-emission">受激辐射</option>
                    </select>
                </div>

                <div className="w-px h-10 bg-white/10" />

                {/* 能级选择 */}
                <div className="flex flex-col gap-1">
                    <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                        {sceneMode === 'stimulated-absorption' ? '初始能级' : '激发态能级'}
                    </span>
                    <div className="flex items-center gap-2">
                        <span className="text-white font-mono">n={currentLevel}</span>
                        <div className="flex gap-1">
                            <button
                                onClick={() => onLevelChange(Math.max(sceneMode === 'stimulated-absorption' ? 1 : 2, currentLevel - 1))}
                                disabled={currentLevel <= (sceneMode === 'stimulated-absorption' ? 1 : 2)}
                                className="w-6 h-6 rounded bg-slate-700 text-white flex items-center justify-center hover:bg-slate-600 disabled:opacity-50"
                            >
                                -
                            </button>
                            <button
                                onClick={() => onLevelChange(Math.min(6, currentLevel + 1))}
                                disabled={currentLevel >= 6}
                                className="w-6 h-6 rounded bg-slate-700 text-white flex items-center justify-center hover:bg-slate-600 disabled:opacity-50"
                            >
                                +
                            </button>
                        </div>
                    </div>
                </div>

                {/* 光子能量滑块 (仅在非自发辐射模式显示) */}
                {sceneMode !== 'spontaneous-emission' && (
                    <>
                        <div className="w-px h-10 bg-white/10" />
                        <div className="flex flex-col gap-1 min-w-[200px]">
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">光子能量</span>
                                <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${validEnergies.includes(photonEnergy)
                                    ? 'bg-green-500/20 text-green-400'
                                    : 'bg-slate-700 text-slate-300'
                                    }`}>
                                    {photonEnergy.toFixed(2)} eV
                                </span>
                            </div>
                            <div className="relative h-6 flex items-center">
                                {/* 标记点 */}
                                {validEnergies.map(e => (
                                    <div
                                        key={e}
                                        className="absolute w-1.5 h-1.5 rounded-full bg-white/30 pointer-events-none transition-colors duration-300"
                                        style={{ left: `${(e / 15) * 100}%` }}
                                    >
                                        {/* Tooltip on hover could go here */}
                                    </div>
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
                        </div>

                        <button
                            onClick={onEmit}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${validEnergies.includes(photonEnergy)
                                ? 'bg-blue-500 hover:bg-blue-600 text-white'
                                : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                }`}
                        // 如果不在有效能量上，点击只会发射穿透的光子，不会触发跃迁
                        >
                            <span className="text-lg">⚡</span>
                            发射光子
                        </button>
                    </>
                )}

                {/* 电子数量 (仅在自发辐射模式显示) */}
                {sceneMode === 'spontaneous-emission' && (
                    <>
                        <div className="w-px h-10 bg-white/10" />
                        <div className="flex flex-col gap-1">
                            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">电子数量</span>
                            <div className="flex bg-slate-800 rounded-lg p-0.5 border border-slate-700">
                                <button
                                    onClick={() => onElectronCountChange('single')}
                                    className={`px-3 py-1 text-xs rounded-md transition-all ${electronCount === 'single' ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                                        }`}
                                >
                                    单电子
                                </button>
                                <button
                                    onClick={() => onElectronCountChange('multi')}
                                    className={`px-3 py-1 text-xs rounded-md transition-all ${electronCount === 'multi' ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                                        }`}
                                >
                                    多电子
                                </button>
                            </div>
                        </div>

                        <div className="w-px h-10 bg-white/10" />

                        <button
                            onClick={onTogglePlay}
                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        // disabled={isRunning}
                        >
                            {isRunning ? <Pause size={18} /> : <Play size={18} />}
                            {isRunning ? '停止' : '开始'}
                        </button>
                    </>
                )}

                <div className="w-px h-10 bg-white/10" />

                {/* 重置按钮 */}
                <button
                    onClick={onReset}
                    className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    title="重置实验"
                >
                    <RotateCcw size={20} />
                </button>
            </div>
        </div>
    );
};
