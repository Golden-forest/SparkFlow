import { useState, useEffect, useCallback } from 'react';
import { useSimulationStore } from '@/stores/simulationStore';
import { ExperimentRegistry, type IExperiment } from '@/experiments/base';

interface UseExperimentOptions {
    autoInit?: boolean;
}

export function useExperiment(experimentId: string | undefined, options: UseExperimentOptions = {}) {
    const { autoInit = true } = options;

    const { currentExperiment, setExperiment } = useSimulationStore();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [parameterValues, setParameterValues] = useState<Record<string, number | string | boolean>>({});

    // 加载实验
    const loadExperiment = useCallback(async () => {
        if (!experimentId) return;

        setIsLoading(true);
        setError(null);

        try {
            if (!ExperimentRegistry.has(experimentId)) {
                throw new Error(`实验 "${experimentId}" 未注册`);
            }

            const experiment = ExperimentRegistry.create(experimentId);
            setExperiment(experiment);

            // 初始化参数值
            const initialValues: Record<string, number | string | boolean> = {};
            experiment.config.parameters.forEach((param) => {
                initialValues[param.key] = param.defaultValue;
            });
            setParameterValues(initialValues);

        } catch (err) {
            setError(err instanceof Error ? err.message : '加载实验失败');
        } finally {
            setIsLoading(false);
        }
    }, [experimentId, setExperiment]);

    // 自动加载
    useEffect(() => {
        if (autoInit && experimentId) {
            loadExperiment();
        }

        return () => {
            // 清理
            setExperiment(null);
        };
    }, [experimentId, autoInit, loadExperiment, setExperiment]);

    // 更新参数
    const updateParameter = useCallback((key: string, value: number | string | boolean) => {
        if (currentExperiment) {
            currentExperiment.setParameter(key, value);
            setParameterValues((prev) => ({ ...prev, [key]: value }));
        }
    }, [currentExperiment]);

    return {
        experiment: currentExperiment,
        isLoading,
        error,
        parameterValues,
        updateParameter,
        reload: loadExperiment,
    };
}

export default useExperiment;
