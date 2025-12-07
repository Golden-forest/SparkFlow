import { useRef, useEffect } from 'react';
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
    const initializedRef = useRef(false);

    useEffect(() => {
        if (!experiment || initializedRef.current) return;

        // 初始化实验场景
        experiment.init(scene).then(() => {
            initializedRef.current = true;
        });

        return () => {
            // 清理
            initializedRef.current = false;
        };
    }, [experiment, scene]);

    return null;
}

export default ExperimentScene;
