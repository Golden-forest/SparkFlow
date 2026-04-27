import React from 'react';
import { Play, Pause, RotateCcw, Atom, ArrowRightLeft } from 'lucide-react';

interface AbstractSideToolbarProps {
    initialLevel: number;
    onInitialLevelChange: (level: number) => void;
    electronCount: 'single' | 'multi';
    onElectronCountChange: (count: 'single' | 'multi') => void;
    allowSecondary: boolean;
    onAllowSecondaryChange: (allow: boolean) => void;
    isRunning: boolean;
    onTogglePlay: () => void;
    onReset: () => void;
    // Excitation Props
    incidentType: 'photon' | 'electron';
    onIncidentTypeChange: (type: 'photon' | 'electron') => void;
    incidentEnergy: number;
    onIncidentEnergyChange: (energy: number) => void;
    onFire: () => void;
    // Mode Control
    viewMode: 'spontaneous' | 'excitation';
    onViewModeChange: (mode: 'spontaneous' | 'excitation') => void;
}

export const AbstractSideToolbar: React.FC<AbstractSideToolbarProps> = ({
    initialLevel,
    onInitialLevelChange,
    electronCount,
    onElectronCountChange,
    allowSecondary,
    onAllowSecondaryChange,
    isRunning,
    onTogglePlay,
    onReset,
    incidentType,
    onIncidentTypeChange,
    incidentEnergy,
    onIncidentEnergyChange,
    onFire,
    viewMode,
    onViewModeChange
}) => {
    // Non-linear mapping for energy slider
    // We want to spread out the values: 10.2, 12.09, 12.75, 13.6
    // Let's define key points on slider (0-100) -> Energy (eV)
    // 0 -> 0
    // 25 -> 10.2 (n=2)
    // 50 -> 12.09 (n=3)
    // 75 -> 13.6 (Ionization)
    // 100 -> 15.0

    const sliderToEnergy = (val: number) => {
        if (val <= 25) return (val / 25) * 10.2;
        if (val <= 50) return 10.2 + ((val - 25) / 25) * (12.09 - 10.2);
        if (val <= 75) return 12.09 + ((val - 50) / 25) * (13.6 - 12.09);
        return 13.6 + ((val - 75) / 25) * (15.0 - 13.6);
    };

    const energyToSlider = (energy: number) => {
        if (energy <= 10.2) return (energy / 10.2) * 25;
        if (energy <= 12.09) return 25 + ((energy - 10.2) / (12.09 - 10.2)) * 25;
        if (energy <= 13.6) return 50 + ((energy - 12.09) / (13.6 - 12.09)) * 25;
        return 75 + ((energy - 13.6) / (15.0 - 13.6)) * 25;
    };

    // Special energy markers for slider (using n labels for tooltip)
    const energyMarkers = [
        { value: 10.20, label: 'n=2' },
        { value: 12.09, label: 'n=3' },
        { value: 12.75, label: 'n=4' }, // This will be close to 13.6 on new scale too?
        { value: 13.60, label: '∞' },
    ];
    // n=4 (12.75) is between 12.09 (50%) and 13.6 (75%).
    // 12.75 is roughly midpoint. So it will be at ~61%. Much better spacing.

    return (
        <div className="absolute right-4 top-20 bottom-8 w-64 flex flex-col gap-4 pointer-events-none z-50">
            <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl border border-white/10 p-5 shadow-2xl flex flex-col gap-6 pointer-events-auto h-full overflow-y-auto">

                {/* 标题 */}
                <div className="flex items-center gap-2 border-b border-white/10 pb-4">
                    <Atom className="text-purple-400" size={24} />
                    <h3 className="text-white font-semibold">能级控制面板</h3>
                </div>

                {/* Mode Tabs */}
                <div className="flex bg-slate-800 p-1 rounded-lg">
                    <button
                        onClick={() => onViewModeChange('spontaneous')}
                        className={`flex-1 py-1.5 text-xs rounded-md transition-all ${viewMode === 'spontaneous'
                            ? 'bg-slate-600 text-white shadow'
                            : 'text-slate-400 hover:text-white'
                            }`}
                    >
                        自发辐射
                    </button>
                    <button
                        onClick={() => onViewModeChange('excitation')}
                        className={`flex-1 py-1.5 text-xs rounded-md transition-all ${viewMode === 'excitation'
                            ? 'bg-purple-600 text-white shadow'
                            : 'text-slate-400 hover:text-white'
                            }`}
                    >
                        激发演示
                    </button>
                </div>

                {viewMode === 'excitation' ? (
                    /* ======== EXCITATION MODE CONTROLS ======== */
                    <div className="flex flex-col gap-6 animate-fadeIn">
                        <div className="flex flex-col gap-3">
                            <span className="text-xs text-purple-400 font-bold uppercase tracking-wider flex items-center gap-2">
                                <ArrowRightLeft size={12} />
                                入射设置
                            </span>

                            {/* 粒子类型选择 */}
                            <div className="grid grid-cols-2 gap-2 bg-slate-800 p-1 rounded-lg">
                                <button
                                    onClick={() => onIncidentTypeChange('photon')}
                                    className={`py-1.5 text-xs rounded-md transition-all ${incidentType === 'photon'
                                        ? 'bg-purple-600 text-white shadow-lg'
                                        : 'text-slate-400 hover:text-white'
                                        }`}
                                >
                                    入射光子
                                </button>
                                <button
                                    onClick={() => onIncidentTypeChange('electron')}
                                    className={`py-1.5 text-xs rounded-md transition-all ${incidentType === 'electron'
                                        ? 'bg-blue-600 text-white shadow-lg'
                                        : 'text-slate-400 hover:text-white'
                                        }`}
                                >
                                    入射电子
                                </button>
                            </div>

                            {/* 能量调节 */}
                            <div className="flex flex-col gap-4 pt-2">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-400">入射能量</span>
                                    <span className="font-mono text-white bg-slate-800 px-2 py-0.5 rounded">
                                        {incidentEnergy.toFixed(2)} eV
                                    </span>
                                </div>

                                <div className="relative h-6 flex items-center">
                                    {/* Track */}
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        step="0.1"
                                        value={energyToSlider(incidentEnergy)}
                                        onChange={(e) => onIncidentEnergyChange(sliderToEnergy(parseFloat(e.target.value)))}
                                        className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500 z-10 relative"
                                    />
                                    {/* Markers (No Text Labels) */}
                                    {energyMarkers.map(m => {
                                        const pos = energyToSlider(m.value);
                                        return (
                                            <div
                                                key={m.value}
                                                className="absolute w-1.5 h-1.5 bg-white/50 rounded-full hover:bg-white cursor-help z-0 transition-colors"
                                                style={{ left: `calc(${pos}% - 3px)` }}
                                                title={`${m.label}: ${m.value} eV`}
                                            />
                                        );
                                    })}
                                </div>

                                {/* 发射按钮 */}
                                <button
                                    onClick={onFire}
                                    disabled={isRunning}
                                    className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-lg font-bold text-sm shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    Emit {incidentType === 'photon' ? 'Photon' : 'Electron'}
                                </button>
                            </div>
                        </div>

                        {/* Excitation Reset */}
                        <button
                            onClick={onReset}
                            className="w-full flex items-center justify-center gap-2 py-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors text-sm border border-slate-700 hover:border-slate-500"
                        >
                            <RotateCcw size={16} />
                            重置基态
                        </button>
                    </div>
                ) : (
                    /* ======== SPONTANEOUS MODE CONTROLS ======== */
                    <div className="flex flex-col gap-6 animate-fadeIn">
                        {/* 初始能级 */}
                        <div className="flex flex-col gap-2">
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                                    初始能级
                                </span>
                                <span className="text-white font-mono bg-slate-800 px-2 py-0.5 rounded text-sm">
                                    n = {initialLevel}
                                </span>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => onInitialLevelChange(Math.max(2, initialLevel - 1))}
                                    disabled={initialLevel <= 2 || isRunning}
                                    className="flex-1 h-8 rounded bg-slate-700 text-white flex items-center justify-center hover:bg-slate-600 disabled:opacity-50 transition-colors"
                                >
                                    -
                                </button>
                                <button
                                    onClick={() => onInitialLevelChange(Math.min(6, initialLevel + 1))}
                                    disabled={initialLevel >= 6 || isRunning}
                                    className="flex-1 h-8 rounded bg-slate-700 text-white flex items-center justify-center hover:bg-slate-600 disabled:opacity-50 transition-colors"
                                >
                                    +
                                </button>
                            </div>
                        </div>

                        <div className="h-px bg-white/10" />

                        {/* 电子数量 */}
                        <div className="flex flex-col gap-2">
                            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">电子数量</span>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => onElectronCountChange('single')}
                                    disabled={isRunning}
                                    className={`py-2 text-xs rounded-lg transition-all border ${electronCount === 'single'
                                        ? 'bg-purple-600/20 border-purple-500 text-purple-400'
                                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 disabled:opacity-50'
                                        }`}
                                >
                                    单电子
                                </button>
                                <button
                                    onClick={() => onElectronCountChange('multi')}
                                    disabled={isRunning}
                                    className={`py-2 text-xs rounded-lg transition-all border ${electronCount === 'multi'
                                        ? 'bg-purple-600/20 border-purple-500 text-purple-400'
                                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 disabled:opacity-50'
                                        }`}
                                >
                                    多电子
                                </button>
                            </div>
                        </div>

                        <div className="h-px bg-white/10" />

                        {/* 二次跃迁开关 */}
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">允许二次跃迁</span>
                            <button
                                onClick={() => !isRunning && onAllowSecondaryChange(!allowSecondary)}
                                disabled={isRunning}
                                className={`w-12 h-6 rounded-full p-1 transition-colors relative ${allowSecondary ? 'bg-purple-600' : 'bg-slate-700'
                                    } disabled:opacity-50`}
                            >
                                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${allowSecondary ? 'translate-x-6' : 'translate-x-0'
                                    }`} />
                            </button>
                        </div>

                        <div className="mt-auto flex flex-col gap-3">
                            <button
                                onClick={onTogglePlay}
                                className={`w-full py-3 rounded-lg font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2 ${isRunning
                                    ? 'bg-orange-600 hover:bg-orange-500 text-white shadow-orange-500/20'
                                    : 'bg-green-600 hover:bg-green-500 text-white shadow-green-500/20'
                                    }`}
                            >
                                {isRunning ? <Pause size={18} /> : <Play size={18} />}
                                {isRunning ? 'Pause Transition' : 'Start Spontaneous Emission'}
                            </button>

                            <button
                                onClick={onReset}
                                className="w-full flex items-center justify-center gap-2 py-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors text-sm border border-slate-700 hover:border-slate-500"
                            >
                                <RotateCcw size={16} />
                                重置演示
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
