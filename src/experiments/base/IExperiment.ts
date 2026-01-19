import * as THREE from 'three';
import type { ExperimentCategory, ExperimentDifficulty } from '@/utils/constants';

/**
 * 实验元数据接口
 */
export interface ExperimentMetadata {
    id: string;
    name: string;
    category: ExperimentCategory;
    description: string;
    difficulty: ExperimentDifficulty;
    duration: number; // 预计时长(分钟)
    keywords: string[];
    thumbnail: string;
}

/**
 * 参数定义接口
 */
export interface ParameterDefinition {
    key: string;
    label: string;
    type: 'number' | 'boolean' | 'select';
    defaultValue: number | boolean | string;
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
    options?: { value: string; label: string }[];
}

/**
 * 显示数据接口
 */
export interface DisplayValue {
    label: string;
    value: string | number;
    unit?: string;
    precision?: number;
}

/**
 * 实验配置接口
 */
export interface ExperimentConfig {
    physics: {
        gravity?: [number, number, number];
        timestep?: number;
        maxSubSteps?: number;
    };
    camera: {
        position: [number, number, number];
        target: [number, number, number];
        fov?: number;
    };
    parameters: ParameterDefinition[];
}

/**
 * 交互事件接口
 */
export interface InteractionEvent {
    type: 'click' | 'drag' | 'hover';
    position: THREE.Vector3;
    object?: THREE.Object3D;
}

/**
 * 实验接口 - 所有实验必须实现此接口
 */
export interface IExperiment {
    // 元数据
    readonly metadata: ExperimentMetadata;
    readonly config: ExperimentConfig;

    // 生命周期方法
    init(scene: THREE.Scene): Promise<void>;
    start(): void;
    pause(): void;
    resume(): void;
    reset(): void;
    dispose(): void;

    // 每帧更新
    update(deltaTime: number): void;

    // 参数控制
    setParameter(key: string, value: number | string | boolean): void;
    getParameter(key: string): number | string | boolean;

    // 数据输出
    getDisplayData(): Record<string, DisplayValue>;

    // 事件处理(可选)
    onInteraction?(event: InteractionEvent): void;

    // 动态对象管理(可选) - 用于支持动态添加/删除仿真对象的实验
    createObject?(config: any): any;
    removeObject?(id: string): boolean;
    addRamp?(config: any): void;
    removeRamp?(id: string): void;
    getSimulationObjects?(): Map<string, any>;
}
