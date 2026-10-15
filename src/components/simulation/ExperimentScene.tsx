import { useState, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import type { IExperiment } from '@/experiments/base';

interface ExperimentSceneProps {
    experiment: IExperiment | null;
}

/**
 * 实验场景组件 - 负责将实验对象与R3F场景连接
 */
export function ExperimentScene({ experiment }: ExperimentSceneProps) {
    const { scene } = useThree();
    const [initError, setInitError] = useState<Error | null>(null);

    useEffect(() => {
        if (!experiment) return;
        let cancelled = false;

        // 初始化实验场景
        void Promise.resolve().then(() => {
            if (!cancelled) return experiment.init(scene);
        }).catch(() => {
            if (!cancelled) setInitError(new Error('The experiment could not be initialized.'));
        });

        return () => {
            // 清理
            cancelled = true;
        };
    }, [experiment, scene]);

    if (initError) throw initError;
    return null;
}

export default ExperimentScene;
