import type { IExperiment, ExperimentMetadata } from './IExperiment';
import type { ExperimentCategory } from '@/utils/constants';

type ExperimentConstructor = new () => IExperiment;

/**
 * 实验注册中心 - 管理所有已注册的实验
 */
class ExperimentRegistryClass {
    private experiments = new Map<string, ExperimentConstructor>();
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
     * 创建实验实例
     */
    create(id: string): IExperiment {
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
        return this.experiments.has(id);
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
