import { useEffect, useRef, useState } from 'react';
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
    const readyRef = useRef(false);
    const [initError, setInitError] = useState<Error | null>(null);

    // Initialize experiment
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        let cancelled = false;
        readyRef.current = false;
        void Promise.resolve().then(() => {
            if (!cancelled) return experiment.init(container);
        }).then(() => {
            if (!cancelled) {
                readyRef.current = true;
                experiment.onResize?.(container.clientWidth, container.clientHeight);
            }
        }).catch(() => {
            if (!cancelled) setInitError(new Error('The experiment could not be initialized.'));
        });
        return () => {
            cancelled = true;
            readyRef.current = false;
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
            if (readyRef.current) tick(Math.min(delta, 0.1));
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
            if (readyRef.current) experiment.onResize?.(width, height);
        });
        observer.observe(container);
        return () => observer.disconnect();
    }, [experiment]);

    if (initError) throw initError;
    return (
        <div
            ref={containerRef}
            className="h-full w-full"
            style={{ background: '#0D1117' }}
        />
    );
}

export default ExperimentCanvas2D;
