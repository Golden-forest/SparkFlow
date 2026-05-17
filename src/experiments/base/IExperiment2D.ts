import type {
    ExperimentMetadata,
    ParameterDefinition,
    DisplayValue,
    ControlSchema,
    MonitorSchema,
    IExperiment,
} from './IExperiment';

export type {
    ExperimentMetadata,
    ParameterDefinition,
    DisplayValue,
    ControlSchema,
    MonitorSchema,
} from './IExperiment';

/**
 * 2D experiment configuration — no camera, no 3D gravity vector.
 */
export interface ExperimentConfig2D {
    physics?: {
        timestep?: number;
        maxSubSteps?: number;
    };
    parameters: ParameterDefinition[];
}

/**
 * 2D experiment interface — parallel to IExperiment.
 * Key differences from IExperiment:
 * - init() receives HTMLDivElement instead of THREE.Scene
 * - config uses ExperimentConfig2D (no camera, no gravity vector)
 * - No onInteraction (DOM events handled by React)
 * - No dynamic object management methods (createObject, etc.)
 */
export interface IExperiment2D {
    readonly metadata: ExperimentMetadata;
    readonly config: ExperimentConfig2D;

    init(container: HTMLDivElement): Promise<void>;
    start(): void;
    pause(): void;
    resume(): void;
    reset(): void;
    dispose(): void;

    update(deltaTime: number): void;

    setParameter(key: string, value: number | string | boolean): void;
    getParameter(key: string): number | string | boolean;

    getDisplayData(): Record<string, DisplayValue>;

    getControlSchema?(): ControlSchema;
    getMonitorSchema?(): MonitorSchema;

    triggerAction?(key: string): void;

    /** Called when the container resizes. Subclasses can override to adapt layout. */
    onResize?(width: number, height: number): void;
}

/**
 * Union type for any experiment (3D or 2D).
 * Used by simulationStore and ExperimentRegistry to accept both types.
 */
export type ExperimentInstance = IExperiment | IExperiment2D;

/**
 * Type guard — narrows ExperimentInstance to IExperiment2D.
 */
export function isExperiment2D(exp: ExperimentInstance): exp is IExperiment2D {
    return exp.metadata.renderMode === '2d';
}
