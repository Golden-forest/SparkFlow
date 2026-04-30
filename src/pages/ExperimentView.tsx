import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Pause, Play, RotateCcw } from 'lucide-react';
import { ExperimentWorkbench } from '@/components/experiment';
import { ExperimentScene, SceneContainer } from '@/components/simulation';
import type {
    ControlSchema,
    DisplayValue,
    MonitorQuantityDefinition,
    MonitorSchema,
    ParameterDefinition,
} from '@/experiments/base';
import { ExperimentRegistry } from '@/experiments/base';
import '@/experiments';
import { useSimulationStore } from '@/stores/simulationStore';
import { SimulationState } from '@/utils/constants';

const MONITOR_COLORS = ['#22d3ee', '#34d399', '#f59e0b', '#f87171', '#60a5fa', '#a78bfa'];

function readNumericValue(item: DisplayValue | undefined): number | null {
    if (!item) return null;
    if (typeof item.value === 'number' && Number.isFinite(item.value)) {
        return item.value;
    }
    if (typeof item.value === 'string') {
        const parsed = Number.parseFloat(item.value);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    return null;
}

function buildFallbackMonitorSchema(displayData: Record<string, DisplayValue>): MonitorSchema {
    const quantities: MonitorQuantityDefinition[] = Object.entries(displayData)
        .filter(([, value]) => readNumericValue(value) !== null)
        .map(([key, value], index) => ({
            key,
            label: value.label,
            unit: value.unit,
            color: MONITOR_COLORS[index % MONITOR_COLORS.length],
        }));

    return {
        title: 'Monitor',
        quantities,
        defaultSelected: quantities.slice(0, Math.min(3, quantities.length)).map((item) => item.key),
        sampleIntervalMs: 100,
    };
}

function buildDefaultControlSchema(parameters: ParameterDefinition[]): ControlSchema {
    return {
        title: 'Controls',
        parameters,
    };
}

export default function ExperimentView() {
    const { experimentId } = useParams<{ experimentId: string }>();

    const state = useSimulationStore((store) => store.state);
    const start = useSimulationStore((store) => store.start);
    const pause = useSimulationStore((store) => store.pause);
    const resume = useSimulationStore((store) => store.resume);
    const reset = useSimulationStore((store) => store.reset);
    const setExperiment = useSimulationStore((store) => store.setExperiment);
    const currentExperiment = useSimulationStore((store) => store.currentExperiment);
    const monitoringHistory = useSimulationStore((store) => store.monitoringHistory);
    const updateMonitoringHistory = useSimulationStore((store) => store.updateMonitoringHistory);

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [displayData, setDisplayData] = useState<Record<string, DisplayValue>>({});
    const [parameterValues, setParameterValues] = useState<Record<string, number | string | boolean>>({});
    const [selectedMonitorIds, setSelectedMonitorIds] = useState<string[]>([]);

    useEffect(() => {
        if (!experimentId) return;

        setIsLoading(true);
        setError(null);
        setDisplayData({});
        setParameterValues({});
        setSelectedMonitorIds([]);

        try {
            if (!ExperimentRegistry.has(experimentId)) {
                throw new Error(`Experiment "${experimentId}" is not registered.`);
            }

            const experiment = ExperimentRegistry.create(experimentId);
            setExperiment(experiment);

            const values: Record<string, number | string | boolean> = {};
            experiment.config.parameters.forEach((parameter) => {
                values[parameter.key] = parameter.defaultValue;
            });
            setParameterValues(values);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'Failed to load experiment.');
        } finally {
            setIsLoading(false);
        }

        return () => {
            setExperiment(null);
        };
    }, [experimentId, setExperiment]);

    const controlSchema = useMemo(() => {
        if (!currentExperiment) {
            return buildDefaultControlSchema([]);
        }
        return currentExperiment.getControlSchema?.() ?? buildDefaultControlSchema(currentExperiment.config.parameters);
    }, [currentExperiment]);

    const monitorSchema = useMemo(() => {
        if (!currentExperiment) {
            return {
                title: 'Monitor',
                quantities: [],
                defaultSelected: [],
                sampleIntervalMs: 100,
            };
        }
        const schema = currentExperiment.getMonitorSchema?.();
        if (schema && schema.quantities.length > 0) {
            return schema;
        }
        return buildFallbackMonitorSchema(displayData);
    }, [currentExperiment, displayData]);

    useEffect(() => {
        if (!currentExperiment) return;

        const sampleInterval = Math.max(40, monitorSchema.sampleIntervalMs ?? 100);
        const timer = setInterval(() => {
            const data = currentExperiment.getDisplayData();
            setDisplayData(data);

            const activeSchema = currentExperiment.getMonitorSchema?.();
            const resolvedSchema =
                activeSchema && activeSchema.quantities.length > 0
                    ? activeSchema
                    : buildFallbackMonitorSchema(data);

            resolvedSchema.quantities.forEach((quantity) => {
                const numericValue = readNumericValue(data[quantity.key]);
                if (numericValue !== null) {
                    updateMonitoringHistory(quantity.key, numericValue);
                }
            });
        }, sampleInterval);

        return () => clearInterval(timer);
    }, [currentExperiment, monitorSchema.sampleIntervalMs, updateMonitoringHistory]);

    useEffect(() => {
        const validIds = new Set(monitorSchema.quantities.map((item) => item.key));
        setSelectedMonitorIds((previous) => {
            const kept = previous.filter((id) => validIds.has(id));
            if (kept.length > 0) {
                return kept;
            }
            const defaults = (monitorSchema.defaultSelected ?? []).filter((id) => validIds.has(id));
            if (defaults.length > 0) {
                return defaults;
            }
            return monitorSchema.quantities.slice(0, Math.min(3, monitorSchema.quantities.length)).map((item) => item.key);
        });
    }, [monitorSchema]);

    const isRunning = state === SimulationState.Running;

    const handlePlayPause = () => {
        if (state === SimulationState.Running) {
            pause();
            return;
        }
        if (state === SimulationState.Paused) {
            resume();
            return;
        }
        start();
    };

    const handleReset = () => {
        reset();
        if (!currentExperiment) return;
        const values: Record<string, number | string | boolean> = {};
        currentExperiment.config.parameters.forEach((parameter) => {
            values[parameter.key] = currentExperiment.getParameter(parameter.key);
        });
        setParameterValues(values);
    };

    const handleParameterChange = (key: string, value: number | string | boolean) => {
        if (!currentExperiment) return;
        currentExperiment.setParameter(key, value);
        setParameterValues((previous) => ({
            ...previous,
            [key]: value,
        }));
    };

    const handleAction = (key: string) => {
        currentExperiment?.triggerAction?.(key);
    };

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-950">
                <p className="text-xl text-slate-100">Loading experiment...</p>
            </div>
        );
    }

    if (error || !currentExperiment) {
        return (
            <div className="flex h-screen flex-col items-center justify-center bg-slate-950">
                <p className="mb-4 text-xl text-red-300">{error ?? 'Experiment unavailable.'}</p>
                <Link to="/" className="text-cyan-300 transition-colors hover:text-cyan-200 hover:underline">
                    Back to Home
                </Link>
            </div>
        );
    }

    return (
        <div className="relative flex h-screen flex-col overflow-hidden bg-slate-950">
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute -top-40 left-1/2 h-[430px] w-[640px] -translate-x-1/2 rounded-full bg-cyan-400/10 blur-3xl" />
                <div className="absolute -bottom-44 right-4 h-[300px] w-[300px] rounded-full bg-emerald-300/8 blur-3xl" />
            </div>

            <header className="z-20 mx-4 mt-4 flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900/80 px-6 py-4 shadow-[0_18px_55px_rgba(2,12,27,0.45)] backdrop-blur-xl">
                <div className="flex items-center gap-4">
                    <Link
                        to="/"
                        className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-800/70 px-4 py-2 text-slate-200 transition-all duration-200 hover:border-cyan-200/40 hover:bg-slate-700/75"
                    >
                        <ArrowLeft size={18} />
                        <span className="font-medium">Back</span>
                    </Link>
                    <h1 className="bg-gradient-to-r from-slate-100 via-sky-100 to-emerald-200 bg-clip-text text-xl font-semibold tracking-wide text-transparent">
                        {currentExperiment.metadata.name}
                    </h1>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handlePlayPause}
                        className={`flex items-center gap-2.5 rounded-xl px-5 py-2.5 font-medium text-white shadow-lg transition-all duration-200 ${
                            isRunning
                                ? 'bg-gradient-to-r from-amber-600 to-orange-500 shadow-orange-900/30 hover:from-amber-500 hover:to-orange-400'
                                : 'bg-gradient-to-r from-sky-600 to-cyan-500 shadow-cyan-900/30 hover:from-sky-500 hover:to-cyan-400'
                        }`}
                    >
                        {isRunning ? <Pause size={18} /> : <Play size={18} />}
                        <span>{isRunning ? 'Pause' : state === SimulationState.Paused ? 'Resume' : 'Start'}</span>
                    </button>
                    <button
                        onClick={handleReset}
                        className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-slate-800/85 px-5 py-2.5 font-medium text-slate-100 shadow-lg shadow-slate-950/40 transition-all duration-200 hover:bg-slate-700/85"
                    >
                        <RotateCcw size={18} />
                        <span>Reset</span>
                    </button>
                </div>
            </header>

            <main className="relative flex-1 px-4 pb-4 pt-3">
                <div className="relative h-full overflow-hidden rounded-2xl border border-white/10 bg-slate-900/45 shadow-[0_18px_60px_rgba(2,12,27,0.5)]">
                    <SceneContainer
                        cameraPosition={currentExperiment.config.camera.position}
                        cameraTarget={currentExperiment.config.camera.target}
                        cameraFov={currentExperiment.config.camera.fov ?? 50}
                        showGrid={false}
                        showAxes={false}
                        backgroundColor="#0D1117"
                    >
                        <ExperimentScene experiment={currentExperiment} />
                    </SceneContainer>
                </div>

                <ExperimentWorkbench
                    title={currentExperiment.metadata.name}
                    controlSchema={controlSchema}
                    monitorSchema={monitorSchema}
                    parameterValues={parameterValues}
                    onParameterChange={handleParameterChange}
                    onAction={handleAction}
                    displayData={displayData}
                    monitorHistory={monitoringHistory}
                    selectedMonitorIds={selectedMonitorIds}
                    onSelectedMonitorIdsChange={setSelectedMonitorIds}
                />
            </main>
        </div>
    );
}
