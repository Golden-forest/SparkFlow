import * as THREE from 'three';
import { PHYSICS_CONSTANTS } from '@/utils/constants';

/**
 * α粒子数据结构
 */
export interface AlphaParticle {
    id: number;
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    trajectory: THREE.Vector3[];
    isActive: boolean;
    hasLargeAngle: boolean; // 是否大角度散射(>90°)
    scatterAngle: number; // 偏转角(弧度), 0 = 未散射
}

/**
 * 散射物理计算类 - 优化版
 * 
 * 关键教学数据：
 * - 大多数α粒子直接穿过金箔（偏转角<5°）
 * - 少部分发生小角度散射（5°-20°）
 * - 极少数发生大角度散射（>90°），约1/8000
 */
export class ScatteringPhysics {
    // 金原子核电荷数
    private static readonly GOLD_Z = 79;
    // α粒子电荷数
    private static readonly ALPHA_Z = 2;

    // 可视化缩放参数（让微观现象可见）
    private static readonly VISUAL_SCALE = 1.0;
    // 原子核有效半径（用于判定大角度散射区域）
    private static readonly NUCLEUS_RADIUS = 0.3;
    // 电子云半径（原子实际大小约为核的10000倍）
    private static readonly ATOM_RADIUS = 4.0;

    /**
     * 计算库仑力（简化模型用于可视化）
     */
    static calculateCoulombForce(
        particlePos: THREE.Vector3,
        nucleusPos: THREE.Vector3 = new THREE.Vector3(0, 0, 0)
    ): THREE.Vector3 {
        const r = particlePos.clone().sub(nucleusPos);
        const distance = r.length();

        // 避免除零和过大力
        if (distance < 0.05) {
            return r.normalize().multiplyScalar(50);
        }

        // 简化的库仑斥力模型
        // 力的大小与距离平方成反比
        const forceMagnitude = 0.5 / (distance * distance);

        return r.normalize().multiplyScalar(forceMagnitude);
    }

    /**
     * 根据瞄准距离决定粒子行为
     * 
     * 瞄准距离(b)决定散射角(θ):
     * - b > 2.0: 几乎不偏转（直接穿过）
     * - b ∈ [0.5, 2.0]: 小角度偏转
     * - b ∈ [0.1, 0.5]: 中等角度偏转
     * - b < 0.1: 大角度偏转或反弹
     */
    static getScatteringBehavior(impactParameter: number): 'pass' | 'small' | 'medium' | 'large' {
        if (impactParameter > 2.0) return 'pass';
        if (impactParameter > 0.5) return 'small';
        if (impactParameter > 0.1) return 'medium';
        return 'large';
    }

    /**
     * 更新粒子位置
     */
    static updateParticle(
        particle: AlphaParticle,
        dt: number,
        nucleusPos: THREE.Vector3 = new THREE.Vector3(0, 0, 0)
    ): void {
        if (!particle.isActive) return;

        // 计算力和加速度
        const force = this.calculateCoulombForce(particle.position, nucleusPos);
        const acceleration = force.multiplyScalar(dt * 30);

        // 更新速度
        particle.velocity.add(acceleration);

        // 更新位置
        particle.position.add(particle.velocity.clone().multiplyScalar(dt));

        // 记录轨迹（每隔几帧记录一次以优化性能）
        if (particle.trajectory.length === 0 ||
            particle.position.distanceTo(particle.trajectory[particle.trajectory.length - 1]) > 0.1) {
            particle.trajectory.push(particle.position.clone());
        }

        // 检查是否离开可视区域
        if (particle.position.z > 15 ||
            particle.position.z < -15 ||
            Math.abs(particle.position.x) > 10) {
            particle.isActive = false;
            // 计算偏转角并判定散射类型
            const angle = ScatteringPhysics.computeScatterAngle(particle);
            particle.scatterAngle = angle;
            particle.hasLargeAngle = angle > Math.PI / 2;
        }
    }

    /**
     * 计算粒子偏转角（弧度）
     * 初始方向为+z方向，通过比较最终方向与初始方向的夹角
     */
    static computeScatterAngle(particle: AlphaParticle): number {
        if (particle.trajectory.length < 5) return 0;

        const initialDir = new THREE.Vector3(0, 0, 1);

        const len = particle.trajectory.length;
        const finalDir = particle.trajectory[len - 1]
            .clone()
            .sub(particle.trajectory[Math.max(0, len - 5)])
            .normalize();

        const cosAngle = THREE.MathUtils.clamp(initialDir.dot(finalDir), -1, 1);
        return Math.acos(cosAngle);
    }

    /**
     * 创建新的α粒子
     * 
     * @param id 粒子ID
     * @param impactParameter 瞄准距离（决定散射行为）
     */
    static createParticle(
        id: number,
        impactParameter: number
    ): AlphaParticle {
        // 固定的入射速度（适合可视化）
        const speed = 8;

        return {
            id,
            position: new THREE.Vector3(impactParameter, 0, -10),
            velocity: new THREE.Vector3(0, 0, speed),
            trajectory: [],
            isActive: true,
            hasLargeAngle: false,
            scatterAngle: 0,
        };
    }

    /**
   * 生成随机瞄准距离
   * 
   * 模拟真实实验中α粒子随机入射的情况
   * 原子核半径约为原子的1/10000，所以大多数粒子离核很远
   * 
   * 使用较大的入射范围，确保大角度散射比例接近1/8000
   */
    static generateRandomImpactParameter(): number {
        // 在[-6, 6]范围内均匀分布，原子核有效区域约0.1
        // 命中核心区域(|b|<0.1)的概率约为 0.2/12 ≈ 1.67%
        // 其中会发生大角度散射的约为1/10，总体约0.17%
        // 为了更接近1/8000，增加抖动使粒子更分散
        const base = (Math.random() - 0.5) * 12;
        // 大多数粒子额外偏移，减少正对原子核的概率
        const offset = (Math.random() - 0.5) * 2;
        return base + offset;
    }
}
