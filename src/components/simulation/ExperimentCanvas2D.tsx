import { useEffect, useRef } from 'react';
import { useSimulationStore } from '@/stores/simulationStore';
import type { IExperiment2D } from '@/experiments/base';

interface ExperimentCanvas2DProps {
    experiment: IExperiment2D;
}

/**
 * 2D experiment rendering container.
 *
 * Responsibilities:
 * 1. Initialize experiment with the container div
 * 2. Run requestAnimationFrame loop that calls store.tick(delta)
 * 3. Notify experiment of container resize via onResize()
 * 4. Cleanup on unmount (dispose experiment, cancel rAF, disconnect observer)
 */
export function ExperimentCanvas2D({ experiment }: ExperimentCanvas2DProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const tick = useSimulationStore((s) => s.tick);

    // Initialize experiment
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        experiment.init(container);
        return () => {
            experiment.dispose();
        };
    }, [experiment]);

    // Animation loop — drives store.tick(), store calls experiment.update()
    useEffect(() => {
        let rafId: number;
        let lastTime = performance.now();

        const loop = () => {
            const now = performance.now();
            const delta = (now - lastTime) / 1000;
            lastTime = now;
            tick(delta);
            rafId = requestAnimationFrame(loop);
        };

        rafId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(rafId);
    }, [tick]);

    // Resize handling
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const observer = new ResizeObserver((entries) => {
            const { width, height } = entries[0].contentRect;
            experiment.onResize?.(width, height);
        });
        observer.observe(container);
        return () => observer.disconnect();
    }, [experiment]);

    return (
        <div
            ref={containerRef}
            className="h-full w-full"
            style={{ background: '#0D1117' }}
        />
    );
}

export default ExperimentCanvas2D;
