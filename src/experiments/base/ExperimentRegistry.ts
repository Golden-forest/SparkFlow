import type { IExperiment, ExperimentMetadata } from './IExperiment';
import type { IExperiment2D, ExperimentInstance } from './IExperiment2D';
import type { ExperimentCategory } from '@/utils/constants';

type ExperimentConstructor = new () => IExperiment;
type Experiment2DConstructor = new () => IExperiment2D;

/**
 * 实验注册中心 - 管理所有已注册的实验
 */
class ExperimentRegistryClass {
    private experiments = new Map<string, ExperimentConstructor>();
    private experiments2D = new Map<string, Experiment2DConstructor>();
    private metadataCache = new Map<string, ExperimentMetadata>();

    /**
     * 注册实验
     */
    register(id: string, experimentClass: ExperimentConstructor): void {
        this.experiments.set(id, experimentClass);
        // 创建临时实例获取元数据
        const instance = new experimentClass();
        this.metadataCache.set(id, instance.metadata);
    }

    /**
     * 注册 2D 实验
     */
    register2D(id: string, experimentClass: Experiment2DConstructor): void {
        this.experiments2D.set(id, experimentClass);
        const instance = new experimentClass();
        this.metadataCache.set(id, instance.metadata);
    }

    /**
     * 获取所有已注册实验的元数据
     */
    getAll(): ExperimentMetadata[] {
        return Array.from(this.metadataCache.values());
    }

    /**
     * 按类别获取实验列表
     */
    getByCategory(category: ExperimentCategory): ExperimentMetadata[] {
        return this.getAll().filter((meta) => meta.category === category);
    }

    /**
     * 获取单个实验的元数据
     */
    getMetadata(id: string): ExperimentMetadata | undefined {
        return this.metadataCache.get(id);
    }

    /**
     * 创建实验实例 (支持 3D 和 2D)
     */
    create(id: string): ExperimentInstance {
        const cls2D = this.experiments2D.get(id);
        if (cls2D) return new cls2D();

        const ExperimentClass = this.experiments.get(id);
        if (!ExperimentClass) {
            throw new Error(`Experiment "${id}" not registered`);
        }
        return new ExperimentClass();
    }

    /**
     * 检查实验是否已注册
     */
    has(id: string): boolean {
        return this.experiments.has(id) || this.experiments2D.has(id);
    }
}

// 导出单例
export const ExperimentRegistry = new ExperimentRegistryClass();

/**
 * 注册装饰器 - 用于自动注册实验类
 * @example
 * @registerExperiment('rutherford-scattering')
 * class RutherfordExperiment extends ExperimentBase { ... }
 */
export function registerExperiment(id: string) {
    return function <T extends ExperimentConstructor>(target: T): T {
        ExperimentRegistry.register(id, target);
        return target;
    };
}

/**
 * 注册装饰器 - 用于自动注册 2D 实验类
 * @example
 * @registerExperiment2D('hydrogen-abstract')
 * class HydrogenAbstract2D extends ExperimentBase2D { ... }
 */
export function registerExperiment2D(id: string) {
    return function <T extends Experiment2DConstructor>(target: T): T {
        ExperimentRegistry.register2D(id, target);
        return target;
    };
}
