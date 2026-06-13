import { useMemo, useState } from 'react';
import { Activity, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';
import type {
    ControlSchema,
    MonitorSchema,
    DisplayValue,
    ParameterDefinition,
} from '@/experiments/base';
import { QuantityChart } from '@/components/monitoring/QuantityChart';

type ParameterValue = number | string | boolean;

interface ExperimentWorkbenchProps {
    title?: string;
    controlSchema: ControlSchema;
    monitorSchema: MonitorSchema;
    parameterValues: Record<string, ParameterValue>;
    onParameterChange: (key: string, value: ParameterValue) => void;
    onAction?: (key: string) => void;
    displayData: Record<string, DisplayValue>;
    monitorHistory: Record<string, number[]>;
    selectedMonitorIds: string[];
    onSelectedMonitorIdsChange: (ids: string[]) => void;
}

function readNumeric(value: DisplayValue | undefined): number | null {
    if (!value) return null;
    if (typeof value.value === 'number' && Number.isFinite(value.value)) {
        return value.value;
    }
    if (typeof value.value === 'string') {
        const parsed = Number.parseFloat(value.value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

function NumberControl({
    definition,
    value,
    onChange,
}: {
    definition: ParameterDefinition;
    value: number;
    onChange: (value: number) => void;
}) {
    const { label, min = 0, max = 100, step = 0.1, unit } = definition;
    const digits = step < 1 ? Math.abs(Math.floor(Math.log10(step))) : 0;
    return (
        <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/55 p-3.5">
            <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-200">{label}</label>
                <span className="text-sm font-mono text-cyan-300">
                    {value.toFixed(digits)}
                    {unit ? <span className="ml-1 text-slate-400">{unit}</span> : null}
                </span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(event) => onChange(Number.parseFloat(event.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-700 accent-sky-500"
            />
            <div className="grid grid-cols-2 gap-2">
                <span className="text-xs text-slate-500">
                    Min: {min}
                    {unit}
                </span>
                <span className="text-right text-xs text-slate-500">
                    Max: {max}
                    {unit}
                </span>
            </div>
        </div>
    );
}

function BooleanControl({
    label,
    value,
    onChange,
}: {
    label: string;
    value: boolean;
    onChange: (value: boolean) => void;
}) {
    return (
        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900/55 px-3.5 py-3">
            <span className="text-sm text-slate-200">{label}</span>
            <button
                onClick={() => onChange(!value)}
                className={`relative h-6 w-12 rounded-full transition-colors ${
                    value ? 'bg-sky-600' : 'bg-slate-600'
                }`}
                aria-label={`Toggle ${label}`}
            >
                <span
                    className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${
                        value ? 'left-7' : 'left-1'
                    }`}
                />
            </button>
        </div>
    );
}

function SelectControl({
    definition,
    value,
    onChange,
}: {
    definition: ParameterDefinition;
    value: string;
    onChange: (value: string) => void;
}) {
    return (
        <div className="space-y-2 rounded-2xl border border-white/10 bg-slate-900/55 p-3.5">
            <label className="text-sm font-medium text-slate-200">{definition.label}</label>
            <select
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none transition-colors focus:border-sky-400"
            >
                {(definition.options ?? []).map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </div>
    );
}

export function ExperimentWorkbench({
    title = 'Experiment Workbench',
    controlSchema,
    monitorSchema,
    parameterValues,
    onParameterChange,
    onAction,
    displayData,
    monitorHistory,
    selectedMonitorIds,
    onSelectedMonitorIdsChange,
}: ExperimentWorkbenchProps) {
    const [activeTab, setActiveTab] = useState<'controls' | 'monitor'>('controls');
    const [expanded, setExpanded] = useState(true);

    const availableMonitorIds = useMemo(
        () => new Set(monitorSchema.quantities.map((item) => item.key)),
        [monitorSchema.quantities]
    );

    const safeSelectedMonitorIds = useMemo(
        () => selectedMonitorIds.filter((id) => availableMonitorIds.has(id)),
        [selectedMonitorIds, availableMonitorIds]
    );

    if (!expanded) {
        return (
            <div className="absolute right-1 top-5 z-40">
                <button
                    onClick={() => setExpanded(true)}
                    className="rounded-l-xl border border-white/10 bg-slate-900/82 px-2 py-5 text-slate-300 backdrop-blur-xl transition-colors hover:bg-slate-800/85"
                    aria-label="Expand workbench"
                >
                    <ChevronLeft size={18} />
                </button>
            </div>
        );
    }

    return (
        <aside className="absolute bottom-5 right-5 top-5 z-40 w-[min(368px,calc(100vw-2.5rem))] rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/95 via-slate-900/90 to-slate-950/95 p-4 shadow-2xl shadow-slate-950/45 backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between">
                <h2 className="bg-gradient-to-r from-[#22D3EE] via-[#34D399] to-[#A78BFA] bg-clip-text text-sm font-semibold tracking-[0.18em] text-transparent">
                    {title}
                </h2>
                <button
                    onClick={() => setExpanded(false)}
                    className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                    aria-label="Collapse workbench"
                >
                    <ChevronRight size={18} />
                </button>
            </div>

            <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-slate-800/70 p-1.5">
                <button
                    onClick={() => setActiveTab('controls')}
                    className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                        activeTab === 'controls'
                            ? 'bg-gradient-to-r from-sky-600 to-cyan-500 text-white shadow-lg shadow-cyan-900/35'
                            : 'text-slate-300 hover:bg-slate-700/90'
                    }`}
                >
                    <SlidersHorizontal size={16} />
                    Controls
                </button>
                <button
                    onClick={() => setActiveTab('monitor')}
                    className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                        activeTab === 'monitor'
                            ? 'bg-gradient-to-r from-sky-600 to-cyan-500 text-white shadow-lg shadow-cyan-900/35'
                            : 'text-slate-300 hover:bg-slate-700/90'
                    }`}
                >
                    <Activity size={16} />
                    Monitor
                </button>
            </div>

            <div className="h-[calc(100%-102px)] overflow-y-auto pr-1">
                {activeTab === 'controls' ? (
                    <div className="space-y-4 pb-1">
                        {controlSchema.parameters.map((definition) => {
                            const currentValue = parameterValues[definition.key] ?? definition.defaultValue;
                            if (definition.type === 'number') {
                                return (
                                    <NumberControl
                                        key={definition.key}
                                        definition={definition}
                                        value={typeof currentValue === 'number' ? currentValue : Number(currentValue) || 0}
                                        onChange={(value) => onParameterChange(definition.key, value)}
                                    />
                                );
                            }
                            if (definition.type === 'boolean') {
                                return (
                                    <BooleanControl
                                        key={definition.key}
                                        label={definition.label}
                                        value={Boolean(currentValue)}
                                        onChange={(value) => onParameterChange(definition.key, value)}
                                    />
                                );
                            }
                            return (
                                <SelectControl
                                    key={definition.key}
                                    definition={definition}
                                    value={String(currentValue)}
                                    onChange={(value) => onParameterChange(definition.key, value)}
                                />
                            );
                        })}

                        {(controlSchema.actions ?? []).length > 0 ? (
                            <div className="space-y-2 pt-1">
                                {(controlSchema.actions ?? []).map((action) => (
                                    <button
                                        key={action.key}
                                        onClick={() => onAction?.(action.key)}
                                        className={`w-full rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                                            action.variant === 'secondary'
                                                ? 'border border-white/10 bg-slate-800 text-slate-100 hover:bg-slate-700'
                                                : 'bg-gradient-to-r from-sky-600 to-cyan-500 text-white shadow-lg shadow-cyan-900/30 hover:from-sky-500 hover:to-cyan-400'
                                        }`}
                                    >
                                        {action.label}
                                    </button>
                                ))}
                            </div>
                        ) : null}
                    </div>
                ) : (
                    <div className="space-y-4 pb-1">
                        <div className="rounded-xl border border-white/10 bg-slate-800/70 p-3.5">
                            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                                Monitored Quantities
                            </h3>
                            <div className="space-y-2">
                                {monitorSchema.quantities.map((item) => {
                                    const checked = safeSelectedMonitorIds.includes(item.key);
                                    return (
                                        <label key={item.key} className="flex cursor-pointer items-center gap-2 rounded-md p-1 hover:bg-white/5">
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => {
                                                    if (checked) {
                                                        onSelectedMonitorIdsChange(
                                                            safeSelectedMonitorIds.filter((id) => id !== item.key)
                                                        );
                                                    } else {
                                                        onSelectedMonitorIdsChange([...safeSelectedMonitorIds, item.key]);
                                                    }
                                                }}
                                                className="h-4 w-4 rounded border-slate-600 bg-slate-700 text-sky-500"
                                            />
                                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                                            <span className="text-sm text-slate-200">{item.label}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>

                        {safeSelectedMonitorIds.map((id) => {
                            const definition = monitorSchema.quantities.find((item) => item.key === id);
                            if (!definition) return null;
                            const numericValue = readNumeric(displayData[id]);
                            return (
                                <section key={id} className="rounded-xl border border-white/10 bg-slate-800/70 p-3.5">
                                    <div className="mb-2 flex items-center justify-between">
                                        <span className="text-sm text-slate-200">{definition.label}</span>
                                        <span className="font-mono text-sm text-white">
                                            {numericValue !== null ? numericValue.toFixed(2) : 'N/A'}
                                            {definition.unit ? (
                                                <span className="ml-1 text-slate-500">{definition.unit}</span>
                                            ) : null}
                                        </span>
                                    </div>
                                    <QuantityChart
                                        data={monitorHistory[id] ?? []}
                                        color={definition.color}
                                        unit={definition.unit ?? ''}
                                        height={120}
                                    />
                                </section>
                            );
                        })}
                    </div>
                )}
            </div>
        </aside>
    );
}

export default ExperimentWorkbench;
