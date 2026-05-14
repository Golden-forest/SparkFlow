import type {
    ExperimentMetadata,
    ExperimentConfig2D,
    ParameterDefinition,
    DisplayValue,
    ControlSchema,
    MonitorSchema,
} from './IExperiment2D';
import type { IExperiment2D } from './IExperiment2D';

/**
 * Abstract base class for 2D experiments.
 *
 * Key differences from ExperimentBase (3D):
 * - No THREE.Scene, no THREE.Object3D[], no Three.js disposal
 * - No built-in requestAnimationFrame loop — animation is driven by
 *   ExperimentCanvas2D calling store.tick(), which calls this.update()
 * - init() receives HTMLDivElement instead of THREE.Scene
 */
export abstract class ExperimentBase2D implements IExperiment2D {
    abstract readonly metadata: ExperimentMetadata;
    abstract readonly config: ExperimentConfig2D;

    protected container: HTMLDivElement | null = null;
    protected isRunning = false;
    protected parameters: Map<string, number | string | boolean> = new Map();

    /**
     * Subclass implements: build SVG/Canvas structure and attach to this.container.
     */
    protected abstract setupScene(): Promise<void>;

    /**
     * Initialize the experiment with a container element.
     */
    async init(container: HTMLDivElement): Promise<void> {
        this.container = container;
        this.initParameters();
        await this.setupScene();
    }

    /**
     * Load default values from config.parameters.
     * Same logic as ExperimentBase.initParameters() (ExperimentBase.ts:37-41).
     * Only depends on config.parameters, compatible with ExperimentConfig2D.
     */
    protected initParameters(): void {
        this.config.parameters.forEach((param: ParameterDefinition) => {
            this.parameters.set(param.key, param.defaultValue);
        });
    }

    start(): void {
        this.isRunning = true;
    }

    pause(): void {
        this.isRunning = false;
    }

    resume(): void {
        this.isRunning = true;
    }

    reset(): void {
        this.isRunning = false;
        this.initParameters();
    }

    dispose(): void {
        this.isRunning = false;
        this.container?.replaceChildren();
        this.container = null;
        this.parameters.clear();
    }

    abstract update(deltaTime: number): void;

    setParameter(key: string, value: number | string | boolean): void {
        const isDefinedParameter =
            this.parameters.has(key) ||
            this.config.parameters.some((p) => p.key === key);
        if (!isDefinedParameter) return;
        this.parameters.set(key, value);
    }

    getParameter(key: string): number | string | boolean {
        if (this.parameters.has(key)) {
            return this.parameters.get(key) as number | string | boolean;
        }
        const def = this.config.parameters.find((p) => p.key === key);
        if (def) return def.defaultValue;
        return 0;
    }

    /**
     * Safely read a numeric parameter, clamped to [min, max].
     */
    protected getSafeNumber(key: string, fallback: number, min: number, max: number): number {
        const value = this.getParameter(key);
        if (typeof value !== 'number' || Number.isNaN(value)) {
            return fallback;
        }
        return Math.min(Math.max(value, min), max);
    }

    abstract getDisplayData(): Record<string, DisplayValue>;

    getControlSchema(): ControlSchema {
        return { title: 'Controls', parameters: this.config.parameters };
    }

    getMonitorSchema(): MonitorSchema {
        return {
            title: 'Monitor',
            quantities: [],
            defaultSelected: [],
            sampleIntervalMs: 100,
        };
    }

    triggerAction(_key: string): void {
        // Subclass overrides for action handling
    }
}
