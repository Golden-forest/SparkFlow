import * as THREE from 'three';
import type {
    IExperiment,
    ExperimentMetadata,
    ExperimentConfig,
    ParameterDefinition,
    DisplayValue,
    InteractionEvent,
    ControlSchema,
    MonitorSchema,
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
        const isDefinedParameter = this.parameters.has(key) || this.config.parameters.some((parameter) => parameter.key === key);
        if (!isDefinedParameter) return;

        this.parameters.set(key, value);
        this.onParameterChange(key, value);
    }

    /**
     * 子类可重写：参数变化时的响应
     */
    protected onParameterChange(key: string, value: number | string | boolean): void {
        void key;
        void value;
    }

    /**
     * 获取参数值
     */
    getParameter(key: string): number | string | boolean {
        if (this.parameters.has(key)) {
            return this.parameters.get(key) as number | string | boolean;
        }

        const definition = this.config.parameters.find((parameter) => parameter.key === key);
        if (definition) {
            return definition.defaultValue;
        }

        return 0;
    }

    /**
     * 安全读取数值参数并约束在范围内
     */
    protected getSafeNumber(key: string, fallback: number, min: number, max: number): number {
        const value = this.getParameter(key);
        if (typeof value !== 'number' || Number.isNaN(value)) {
            return fallback;
        }
        return Math.min(Math.max(value, min), max);
    }

    /**
     * 获取显示数据 - 子类实现
     */
    abstract getDisplayData(): Record<string, DisplayValue>;

    /**
     * 获取通用控制 schema
     */
    getControlSchema(): ControlSchema {
        return {
            title: 'Controls',
            parameters: this.config.parameters,
        };
    }

    /**
     * 获取通用监控 schema，默认由页面回退策略处理
     */
    getMonitorSchema(): MonitorSchema {
        return {
            title: 'Monitor',
            quantities: [],
            defaultSelected: [],
            sampleIntervalMs: 100,
        };
    }

    /**
     * 通用动作触发，子类可覆盖
     */
    triggerAction(key: string): void {
        void key;
    }

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

    /**
     * 创建统一的星空粒子背景
     * 浅青色粒子点，模拟深空实验室氛围
     */
    protected createStarfield(particleCount = 520): THREE.Points {
        const positions = new Float32Array(particleCount * 3);

        for (let index = 0; index < particleCount; index += 1) {
            const radius = 8 + Math.random() * 18;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(THREE.MathUtils.randFloatSpread(2));
            positions[index * 3] = Math.sin(phi) * Math.cos(theta) * radius;
            positions[index * 3 + 1] = Math.cos(phi) * radius * 0.7 + 2;
            positions[index * 3 + 2] = Math.sin(phi) * Math.sin(theta) * radius;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const stars = new THREE.Points(
            geometry,
            new THREE.PointsMaterial({
                color: 0x7dd3fc,
                size: 0.025,
                transparent: true,
                opacity: 0.52,
                depthWrite: false,
            }),
        );
        stars.name = 'Dark laboratory star field';
        return stars;
    }

    /**
     * 创建统一的深青蓝色调地面网格
     * @param size 网格大小
     * @param divisions 网格分段数
     */
    protected createDefaultGrid(size = 12, divisions = 28): THREE.GridHelper {
        const grid = new THREE.GridHelper(size, divisions, 0x164e63, 0x1e293b);
        return grid;
    }
}
