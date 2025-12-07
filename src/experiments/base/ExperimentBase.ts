import * as THREE from 'three';
import type {
    IExperiment,
    ExperimentMetadata,
    ExperimentConfig,
    ParameterDefinition,
    DisplayValue,
    InteractionEvent,
} from './IExperiment';

/**
 * 实验基类 - 提供通用功能的默认实现
 */
export abstract class ExperimentBase implements IExperiment {
    abstract readonly metadata: ExperimentMetadata;
    abstract readonly config: ExperimentConfig;

    protected scene: THREE.Scene | null = null;
    protected isRunning = false;
    protected parameters: Map<string, number | string | boolean> = new Map();
    protected objects: THREE.Object3D[] = []; // 追踪创建的对象

    /**
     * 初始化实验
     */
    async init(scene: THREE.Scene): Promise<void> {
        this.scene = scene;
        this.initParameters();
        await this.setupScene();
    }

    /**
     * 初始化参数默认值
     */
    protected initParameters(): void {
        this.config.parameters.forEach((param: ParameterDefinition) => {
            this.parameters.set(param.key, param.defaultValue);
        });
    }

    /**
     * 子类实现：设置场景中的对象
     */
    protected abstract setupScene(): Promise<void>;

    /**
     * 开始实验
     */
    start(): void {
        this.isRunning = true;
        this.onStart();
    }

    /**
     * 子类可重写：开始时的额外逻辑
     */
    protected onStart(): void { }

    /**
     * 暂停实验
     */
    pause(): void {
        this.isRunning = false;
    }

    /**
     * 恢复实验
     */
    resume(): void {
        this.isRunning = true;
    }

    /**
     * 重置实验
     */
    reset(): void {
        this.isRunning = false;
        this.initParameters();
        this.onReset();
    }

    /**
     * 子类可重写：重置时的额外逻辑
     */
    protected onReset(): void { }

    /**
     * 销毁实验，清理资源
     */
    dispose(): void {
        this.isRunning = false;

        // 从场景中移除所有追踪的对象
        this.objects.forEach((obj) => {
            if (this.scene) {
                this.scene.remove(obj);
            }
            // 释放几何体和材质
            if (obj instanceof THREE.Mesh) {
                obj.geometry?.dispose();
                if (Array.isArray(obj.material)) {
                    obj.material.forEach((m) => m.dispose());
                } else {
                    obj.material?.dispose();
                }
            }
        });

        this.objects = [];
        this.scene = null;
        this.parameters.clear();
    }

    /**
     * 每帧更新 - 子类实现具体逻辑
     */
    abstract update(deltaTime: number): void;

    /**
     * 设置参数值
     */
    setParameter(key: string, value: number | string | boolean): void {
        if (this.parameters.has(key)) {
            this.parameters.set(key, value);
            this.onParameterChange(key, value);
        }
    }

    /**
     * 子类可重写：参数变化时的响应
     */
    protected onParameterChange(key: string, value: number | string | boolean): void { }

    /**
     * 获取参数值
     */
    getParameter(key: string): number | string | boolean {
        return this.parameters.get(key) ?? 0;
    }

    /**
     * 获取显示数据 - 子类实现
     */
    abstract getDisplayData(): Record<string, DisplayValue>;

    /**
     * 交互事件处理(可选)
     */
    onInteraction?(event: InteractionEvent): void;

    /**
     * 辅助方法：向场景添加对象并追踪
     */
    protected addToScene(object: THREE.Object3D): void {
        if (this.scene) {
            this.scene.add(object);
            this.objects.push(object);
        }
    }

    /**
     * 辅助方法：从场景移除对象
     */
    protected removeFromScene(object: THREE.Object3D): void {
        if (this.scene) {
            this.scene.remove(object);
            const index = this.objects.indexOf(object);
            if (index > -1) {
                this.objects.splice(index, 1);
            }
        }
    }
}
