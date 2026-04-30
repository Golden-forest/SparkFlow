import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import {
    ExperimentBase,
    type ExperimentMetadata,
    type ExperimentConfig,
    type DisplayValue,
} from '@/experiments/base';
import { ExperimentCategory } from '@/utils/constants';
import { ScatteringPhysics, type AlphaParticle } from './ScatteringPhysics';

/**
 * 卢瑟福α粒子散射实验 - 教学优化版
 * 
 * 核心教学目标：
 * 1. 大多数α粒子直接穿过金箔 → 原子内部大部分是空的
 * 2. 少数发生偏转 → 原子内有带正电的部分
 * 3. 极少数大角度散射（约1/8000）→ 正电荷和质量集中在极小的原子核
 */
export class RutherfordExperiment extends ExperimentBase {
    readonly metadata: ExperimentMetadata = {
        id: 'rutherford-scattering',
        name: 'Rutherford Alpha Scattering',
        category: ExperimentCategory.AtomicPhysics,
        description: 'Observe alpha-particle scattering through gold foil to reveal atomic nuclear structure',
        difficulty: 'basic',
        duration: 10,
        keywords: ['rutherford', 'alpha particle', 'scattering', 'nucleus', 'atomic structure'],
        thumbnail: '/thumbnails/rutherford.jpg',
    };

    readonly config: ExperimentConfig = {
        physics: { gravity: [0, 0, 0], timestep: 0.016 },
        camera: {
            position: [0, 12, 8],  // 固定的俯视角度
            target: [0, 0, 0],
            fov: 50,
        },
        parameters: [], // 不需要用户调节参数
    };

    // 粒子系统
    private particles: AlphaParticle[] = [];
    private nextParticleId = 0;
    private emitTimer = 0;
    private readonly EMIT_INTERVAL = 0.05; // 发射间隔（秒）- 加快发射速度

    // 3D对象
    private nucleus: THREE.Mesh | null = null;
    private electronCloud: THREE.Mesh | null = null;
    private trajectoryLines: Map<number, Line2> = new Map();
    private particleMeshes: Map<number, THREE.Mesh> = new Map();

    // 统计数据
    private totalEmitted = 0;
    private largeAngleCount = 0;

    protected async setupScene(): Promise<void> {
        if (!this.scene) return;

        // 创建原子模型（小原子核 + 大电子云）
        this.createAtomModel();

        // 创建粒子源指示
        this.createParticleSource();
    }

    private createAtomModel(): void {
        // 电子云（大而透明的球体）
        const cloudGeometry = new THREE.SphereGeometry(4, 32, 32);
        const cloudMaterial = new THREE.MeshBasicMaterial({
            color: 0x22D3EE,
            transparent: true,
            opacity: 0.12,
            depthWrite: false,
        });
        this.electronCloud = new THREE.Mesh(cloudGeometry, cloudMaterial);
        this.electronCloud.position.set(0, 0, 0);
        this.addToScene(this.electronCloud);

        // 电子云边界（淡蓝色圆环）
        const ringGeometry = new THREE.RingGeometry(3.9, 4.1, 64);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0x38BDF8,
            transparent: true,
            opacity: 0.35,
            side: THREE.DoubleSide,
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = Math.PI / 2;
        this.addToScene(ring);

        // 原子核（很小，金黄色发光）
        const nucleusGeometry = new THREE.SphereGeometry(0.15, 32, 32);
        const nucleusMaterial = new THREE.MeshStandardMaterial({
            color: 0xffd700,
            emissive: 0xffaa00,
            emissiveIntensity: 2,
            metalness: 0.8,
            roughness: 0.2,
        });
        this.nucleus = new THREE.Mesh(nucleusGeometry, nucleusMaterial);
        this.nucleus.position.set(0, 0, 0);
        this.addToScene(this.nucleus);

        // 原子核发光效果
        const glowGeometry = new THREE.SphereGeometry(0.3, 32, 32);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0xffdd00,
            transparent: true,
            opacity: 0.4,
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        this.nucleus.add(glow);

        // 添加点光源
        const pointLight = new THREE.PointLight(0xffaa00, 1, 5);
        this.nucleus.add(pointLight);
    }

    private createParticleSource(): void {
        // 粒子源指示器（在左侧）
        const geometry = new THREE.ConeGeometry(0.3, 0.8, 32);
        const material = new THREE.MeshStandardMaterial({
            color: 0x22D3EE,
            emissive: 0x0891B2,
            emissiveIntensity: 0.5,
        });
        const source = new THREE.Mesh(geometry, material);
        source.position.set(0, 0, -8);
        source.rotation.x = Math.PI / 2;
        this.addToScene(source);

        // 标签：α粒子源
        // (文字需要用sprite或HTML overlay，这里简化处理)
    }

    protected onStart(): void {
        this.emitTimer = 0;
    }

    protected onReset(): void {
        this.clearAllParticles();
        this.totalEmitted = 0;
        this.largeAngleCount = 0;
        this.emitTimer = 0;
    }

    private emitOneParticle(): void {
        // 随机瞄准距离
        const impactParameter = ScatteringPhysics.generateRandomImpactParameter();
        const particle = ScatteringPhysics.createParticle(this.nextParticleId++, impactParameter);
        this.particles.push(particle);
        this.createParticleMesh(particle);
        this.totalEmitted++;
    }

    private createParticleMesh(particle: AlphaParticle): void {
        const geometry = new THREE.SphereGeometry(0.08, 12, 12);
        const material = new THREE.MeshBasicMaterial({
            color: 0x00FF41,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(particle.position);
        this.addToScene(mesh);
        this.particleMeshes.set(particle.id, mesh);
    }

    update(deltaTime: number): void {
        if (!this.isRunning) return;

        // 定时发射新粒子
        this.emitTimer += deltaTime;
        if (this.emitTimer >= this.EMIT_INTERVAL) {
            this.emitTimer = 0;
            this.emitOneParticle();
        }

        // 更新所有活跃粒子
        this.particles.forEach((particle) => {
            if (!particle.isActive) return;

            const wasActive = particle.isActive;
            ScatteringPhysics.updateParticle(particle, deltaTime);

            // 更新3D网格位置
            const mesh = this.particleMeshes.get(particle.id);
            if (mesh) {
                mesh.position.copy(particle.position);

                // 根据距离原子核的远近改变颜色
                const distToNucleus = particle.position.length();
                if (distToNucleus < 1) {
                    (mesh.material as THREE.MeshBasicMaterial).color.setHex(0xF59E0B);
                } else if (distToNucleus < 2) {
                    (mesh.material as THREE.MeshBasicMaterial).color.setHex(0x34D399);
                }
            }

            // 更新轨迹线
            this.updateTrajectoryLine(particle);

            // 粒子刚完成散射
            if (wasActive && !particle.isActive) {
                if (particle.hasLargeAngle) {
                    this.largeAngleCount++;
                }
            }
        });

        // 清理已完成的粒子（保留最近的轨迹用于展示）
        this.cleanupOldParticles();
    }

    private updateTrajectoryLine(particle: AlphaParticle): void {
        if (particle.trajectory.length < 2) return;

        // 移除旧线
        const oldLine = this.trajectoryLines.get(particle.id);
        if (oldLine) {
            this.removeFromScene(oldLine);
            oldLine.geometry.dispose();
            (oldLine.material as LineMaterial).dispose();
        }

        const points = particle.trajectory;

        // 扁平化坐标数组 [x1,y1,z1, x2,y2,z2, ...]
        const positions: number[] = [];
        points.forEach((p) => {
            positions.push(p.x, p.y, p.z);
        });

        const geometry = new LineGeometry();
        geometry.setPositions(positions);

        // 3-tier coloring based on scatter angle
        let color = '#22D3EE'; // 默认: 青色 (直穿)
        if (!particle.isActive) {
            const angleDeg = (particle.scatterAngle * 180) / Math.PI;
            if (angleDeg >= 30) {
                color = '#F97316'; // 大角度: 橙色
            } else if (angleDeg >= 10) {
                color = '#34D399'; // 小角度: 翠绿
            }
        }

        const material = new LineMaterial({
            color: new THREE.Color(color).getHex(),
            linewidth: 2.5,
            transparent: true,
            opacity: particle.isActive ? 0.8 : 0.4,
            resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
        });

        const line = new Line2(geometry, material);
        line.computeLineDistances();
        this.addToScene(line);
        this.trajectoryLines.set(particle.id, line);
    }

    private cleanupOldParticles(): void {
        // 保留最近50个粒子的轨迹
        const maxKeep = 50;
        if (this.particles.length > maxKeep * 2) {
            const toRemove = this.particles.slice(0, this.particles.length - maxKeep);
            toRemove.forEach((p) => {
                const mesh = this.particleMeshes.get(p.id);
                if (mesh) {
                    this.removeFromScene(mesh);
                    this.particleMeshes.delete(p.id);
                }
                const line = this.trajectoryLines.get(p.id);
                if (line) {
                    this.removeFromScene(line);
                    line.geometry.dispose();
                    (line.material as LineMaterial).dispose();
                    this.trajectoryLines.delete(p.id);
                }
            });
            this.particles = this.particles.slice(-maxKeep);
        }
    }

    private clearAllParticles(): void {
        this.particleMeshes.forEach((mesh) => this.removeFromScene(mesh));
        this.particleMeshes.clear();
        this.trajectoryLines.forEach((line) => {
            this.removeFromScene(line);
            line.geometry.dispose();
            (line.material as LineMaterial).dispose();
        });
        this.trajectoryLines.clear();
        this.particles = [];
    }

    getDisplayData(): Record<string, DisplayValue> {
        // 计算大角度散射比例
        const ratio = this.totalEmitted > 0
            ? (this.largeAngleCount / this.totalEmitted * 100).toFixed(2)
            : '0.00';

        // 理论值：约1/8000 ≈ 0.0125%
        const theoreticalRatio = '0.0125';

        return {
            totalEmitted: {
                label: 'Emitted Particles',
                value: this.totalEmitted,
                unit: 'count',
            },
            largeAngle: {
                label: 'Large-Angle Events',
                value: this.largeAngleCount,
                unit: 'count',
            },
            ratio: {
                label: 'Large-Angle Ratio',
                value: ratio,
                unit: '%',
            },
            theoretical: {
                label: 'Reference Ratio (~1/8000)',
                value: theoreticalRatio,
                unit: '%',
            },
        };
    }

    getMonitorSchema() {
        return {
            title: 'Monitor',
            quantities: [
                { key: 'totalEmitted', label: 'Emitted Particles', unit: 'count', color: '#22d3ee' },
                { key: 'largeAngle', label: 'Large-Angle Events', unit: 'count', color: '#f97316' },
                { key: 'ratio', label: 'Large-Angle Ratio', unit: '%', color: '#34d399' },
            ],
            defaultSelected: ['ratio', 'largeAngle'],
            sampleIntervalMs: 100,
        };
    }

    dispose(): void {
        this.clearAllParticles();
        super.dispose();
    }
}
