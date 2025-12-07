import { useState, useCallback } from 'react';
import type { ParameterDefinition } from '@/experiments/base';

interface ParameterSliderProps {
    definition: ParameterDefinition;
    value: number;
    onChange: (key: string, value: number) => void;
}

export function ParameterSlider({ definition, value, onChange }: ParameterSliderProps) {
    const { key, label, min = 0, max = 100, step = 1, unit } = definition;

    const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            onChange(key, parseFloat(e.target.value));
        },
        [key, onChange]
    );

    // 格式化显示值
    const displayValue = step < 1
        ? value.toFixed(Math.abs(Math.floor(Math.log10(step))))
        : value.toString();

    return (
        <div className="mb-4">
            <div className="flex justify-between mb-1.5">
                <label className="text-sm text-slate-300">{label}</label>
                <span className="text-sm text-blue-400 font-mono">
                    {displayValue}
                    {unit && <span className="text-slate-500 ml-1">{unit}</span>}
                </span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={handleChange}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <div className="flex justify-between mt-1 text-xs text-slate-500">
                <span>{min}{unit}</span>
                <span>{max}{unit}</span>
            </div>
        </div>
    );
}

interface ControlPanelProps {
    title?: string;
    parameters: ParameterDefinition[];
    values: Record<string, number | string | boolean>;
    onParameterChange: (key: string, value: number | string | boolean) => void;
    children?: React.ReactNode;
}

export function ControlPanel({
    title = '实验参数',
    parameters,
    values,
    onParameterChange,
    children,
}: ControlPanelProps) {
    return (
        <div className="absolute top-4 right-4 w-80 rounded-xl bg-slate-800/90 backdrop-blur-sm border border-white/10 p-5">
            <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>

            <div className="space-y-1">
                {parameters
                    .filter((p) => p.type === 'number')
                    .map((param) => (
                        <ParameterSlider
                            key={param.key}
                            definition={param}
                            value={values[param.key] as number}
                            onChange={onParameterChange}
                        />
                    ))}
            </div>

            {children && <div className="mt-4 pt-4 border-t border-white/10">{children}</div>}
        </div>
    );
}

export default ControlPanel;
