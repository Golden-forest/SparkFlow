import * as THREE from 'three';
import { getPhotonColor } from './TransitionPhysics';

/**
 * 光子波形配置
 */
export interface PhotonWaveConfig {
    wavelength: number;          // 波长 (nm) - 决定颜色
    amplitude: number;           // 振幅（显示用）
    direction: THREE.Vector3;    // 传播方向（单位向量）
    startPosition: THREE.Vector3;// 起始位置
    phase: number;               // 初始相位 (0-2π)
    speed: number;               // 传播速度（显示用）
    isIncoming: boolean;         // 是否为入射光子
}

/**
 * 光子相位波形类
 * 用正弦波表示光子，展示波动性和相位
 */
export class PhotonWave {
    private line: THREE.Line;
    private points: THREE.Vector3[] = [];
    private config: PhotonWaveConfig;
    private currentPosition: THREE.Vector3;
    private lifetime = 0;
    private maxLifetime = 3; // 存活时间（秒）
    public hasInteracted = false; // 是否已经发生交互
    public isIncoming = false; // 是否为入射光子

    // 波形参数
    private readonly waveLength = 2;      // 显示的波长（空间周期）
    private readonly cycles = 3;          // 显示几个完整周期
    private readonly segments = 64;       // 每个周期的分段数

    constructor(config: PhotonWaveConfig) {
        this.config = config;
        this.currentPosition = config.startPosition.clone();
        this.isIncoming = config.isIncoming;

        // 创建材质
        const colorVal = getPhotonColor(config.wavelength);
        const material = new THREE.LineBasicMaterial({
            color: colorVal || 0xff0000,
            linewidth: 2,
            transparent: false, // 暂时关闭透明度以排查可见性问题
            opacity: 1.0,
            depthTest: false,
        });

        // 初始生成点
        this.calculatePoints();
        const geometry = new THREE.BufferGeometry().setFromPoints(this.points);

        this.line = new THREE.Line(geometry, material);
        this.line.renderOrder = 999;
    }

    private calculatePoints(): void {
        this.points = [];

        // 创建正弦波形状
        const totalLength = this.waveLength * this.cycles;
        const totalSegments = this.segments * this.cycles;

        for (let i = 0; i <= totalSegments; i++) {
            // 倒序生成，让波头在 currentPosition
            // x是从 0 到 -length (因为通过dir决定方向，这里为了计算方便，x是沿dir的距离)
            // 实际上我们希望波形在 currentPosition *后面* 拖着
            // 或者 currentPosition 是波头

            const t = i / totalSegments;
            const dist = t * totalLength; // 0 to length

            // 波形从 currentPosition 向 *后* 延伸? 
            // 还是 currentPosition 是中心?
            // 假设 currentPosition 是波头 (前端)
            // 那么点应该是 currentPosition - dir * dist

            // 正弦波公式
            const angle = (2 * Math.PI * dist / this.waveLength) + this.config.phase;
            const y = this.config.amplitude * Math.sin(angle);

            // 方向: -dir (向后)
            const dir = this.config.direction.clone().negate();
            const perpendicular = this.getPerpendicular(this.config.direction);

            // 计算点位置
            const point = this.currentPosition.clone()
                .add(dir.multiplyScalar(dist))
                .add(perpendicular.clone().multiplyScalar(y));

            this.points.push(point);
        }
    }

    private createWaveGeometry(): void {
        this.calculatePoints();
        const geometry = new THREE.BufferGeometry().setFromPoints(this.points);

        if (this.line) {
            this.line.geometry.dispose();
            this.line.geometry = geometry;
        }
    }

    /**
     * 获取垂直于传播方向的向量（用于波动）
     */
    private getPerpendicular(dir: THREE.Vector3): THREE.Vector3 {
        // 如果方向是沿 z 轴，选择 y 轴
        if (Math.abs(dir.z) > 0.9) {
            return new THREE.Vector3(0, 1, 0);
        }
        // 否则在 xy 平面内找垂直向量
        return new THREE.Vector3(-dir.y, dir.x, 0).normalize();
    }

    /**
     * 更新波形位置（动画）
     */
    update(deltaTime: number): boolean {
        this.lifetime += deltaTime;

        // 超过生存时间，标记为可删除
        if (this.lifetime > this.maxLifetime) {
            return false;
        }

        // 波沿传播方向移动
        const displacement = this.config.direction.clone()
            .multiplyScalar(this.config.speed * deltaTime);
        this.currentPosition.add(displacement);

        // 更新相位（造成波动效果）
        this.config.phase += deltaTime * this.config.speed * 2 * Math.PI / this.waveLength;

        // 重新生成波形
        this.createWaveGeometry();

        // 更新透明度（接近生命尾声时淡出）
        const fadeStart = this.maxLifetime * 0.7;
        if (this.lifetime > fadeStart) {
            const fadeProgress = (this.lifetime - fadeStart) / (this.maxLifetime - fadeStart);
            const opacity = 1.0 * (1 - fadeProgress); // Use 1.0 as base opacity
            (this.line.material as THREE.LineBasicMaterial).opacity = opacity;
        }

        return true;
    }

    /**
     * 获取3D对象
     */
    getObject(): THREE.Line {
        return this.line;
    }

    /**
     * 获取当前位置
     */
    getPosition(): THREE.Vector3 {
        return this.currentPosition.clone();
    }

    /**
     * 检查是否与原子碰撞
     */
    checkCollision(atomPosition: THREE.Vector3, radius: number = 1): boolean {
        const distance = this.currentPosition.distanceTo(atomPosition);
        return distance < radius;
    }

    /**
     * 清理资源
     */
    dispose(): void {
        this.line.geometry.dispose();
        (this.line.material as THREE.Material).dispose();
    }
}

/**
 * 创建入射光子波形（从左侧射入）
 */
export function createIncomingPhoton(energy: number, yOffset: number = 0): PhotonWave {
    // 根据能量计算波长: E = hc/λ
    const h = 6.626e-34;
    const c = 3e8;
    const eV_to_J = 1.602e-19;
    const wavelength = (h * c) / (energy * eV_to_J) * 1e9; // nm

    return new PhotonWave({
        wavelength,
        amplitude: 0.8, // 增大振幅以提高可见度 (原 0.3)
        direction: new THREE.Vector3(1, 0, 0), // 向右
        startPosition: new THREE.Vector3(-10, yOffset, 0),
        phase: 0,
        speed: 5,
        isIncoming: true,
    });
}

/**
 * 创建发射光子波形（从原子向外发射）
 */
export function createEmittedPhoton(
    energy: number,
    atomPosition: THREE.Vector3,
    direction?: THREE.Vector3,
    phase: number = 0
): PhotonWave {
    const h = 6.626e-34;
    const c = 3e8;
    const eV_to_J = 1.602e-19;
    const wavelength = (h * c) / (energy * eV_to_J) * 1e9;

    // 默认随机方向
    const emitDirection = direction || new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        0
    ).normalize();

    return new PhotonWave({
        wavelength,
        amplitude: 0.8, // 增大振幅 (原 0.3)
        direction: emitDirection,
        startPosition: atomPosition.clone(),
        phase,
        speed: 5,
        isIncoming: false,
    });
}
