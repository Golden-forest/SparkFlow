import * as THREE from 'three';
import { ExperimentBase, registerExperiment } from '../../base';
import type { DisplayValue } from '../../base';
import type { ExperimentCategory, ExperimentDifficulty } from '@/utils/constants';
import {
    ENERGY_LEVELS,
    calculateTransition,
    calculateAllTransitions,
    calculateSpectralLineCount,
    getValidTransitionEnergies,
    matchValidEnergy,
    getTargetLevel,
    calculateEnergy,
    getLevelColor,
} from './TransitionPhysics';
import type { ExcitationMode, AtomType, Transition, SceneMode } from './TransitionPhysics';
import { PhotonWave, createIncomingPhoton, createEmittedPhoton } from './PhotonWave';

/**
 * 氢原子能级跃迁实验 - 优化版
 */
@registerExperiment('hydrogen-transitions')
export class HydrogenTransition extends ExperimentBase {
    readonly metadata = {
        id: 'hydrogen-transitions',
        name: '氢原子能级跃迁',
        category: 'atomic' as ExperimentCategory,
        description: '探索氢原子能级结构，观察光子激发、电子碰撞激发和自发辐射过程',
        difficulty: 'intermediate' as ExperimentDifficulty,
        duration: 15,
        keywords: ['氢原子', '能级', '跃迁', '光子', '玻尔模型'],
        thumbnail: '/thumbnails/hydrogen-transitions.png',
    };

    readonly config = {
        physics: {
            timestep: 1 / 60,
        },
        camera: {
            position: [0, 0, 18] as [number, number, number],
            target: [0, 0, 0] as [number, number, number],
            fov: 45,
        },
        parameters: [
            {
                key: 'excitationMode',
                label: '场景模式',
                type: 'select' as const,
                defaultValue: 'stimulated-absorption',
                options: [
                    { value: 'stimulated-absorption', label: '受激吸收' },
                    { value: 'spontaneous-emission', label: '自发辐射' },
                    { value: 'stimulated-emission', label: '受激辐射' },
                ],
            },
            {
                key: 'inputEnergy',
                label: '光子能量',
                type: 'number' as const,
                defaultValue: 10.2,
                min: 0,
                max: 15,
            },
            {
                key: 'initialLevel',
                label: '当前能级',
                type: 'number' as const,
                defaultValue: 1,
            },
            {
                key: 'atomType',
                label: '电子模式',
                type: 'select' as const,
                defaultValue: 'single',
                options: [{ value: 'single', label: '单电子' }, { value: 'group', label: '多电子' }]
            }
        ],
    };

    // 状态
    private currentLevel = 1;
    private sceneMode: SceneMode = 'stimulated-absorption';
    private inputEnergy = 10.2;
    private atomType: AtomType = 'single';

    // 3D对象
    private nucleus: THREE.Mesh | null = null;
    private orbits: THREE.Mesh[] = []; // 使用 Mesh (Torus) 代替 Line
    private electrons: THREE.Mesh[] = [];
    private photons: PhotonWave[] = [];

    // 动画状态
    private isAnimating = false;
    private transitionQueue: { from: number, to: number, electronIndex: number }[] = [];

    protected async setupScene(): Promise<void> {
        if (!this.scene) return;

        // 1. 创建原子核 (金黄色辉光)
        this.createNucleus();

        // 2. 创建轨道 (渐变色同心圆)
        this.createOrbits();

        // 3. 创建电子
        this.updateElectrons();

        // 4. 灯光
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.addToScene(ambientLight);
        const pointLight = new THREE.PointLight(0xffffff, 1.5, 50);
        pointLight.position.set(5, 5, 10);
        this.addToScene(pointLight);

        // 背景色建议在 CSS 中设置，或者在这里添加一个比如大的背景球，但通常 CSS 足够。
    }

    private createNucleus(): void {
        const geometry = new THREE.SphereGeometry(0.4, 32, 32);
        const material = new THREE.MeshStandardMaterial({
            color: 0xffd700,
            emissive: 0xffaa00,
            emissiveIntensity: 0.8,
            roughness: 0.2,
            metalness: 0.8,
        });
        this.nucleus = new THREE.Mesh(geometry, material);
        this.addToScene(this.nucleus);

        // 添加辉光(简化版，透明球体)
        const glowGeo = new THREE.SphereGeometry(0.8, 32, 32);
        const glowMat = new THREE.MeshBasicMaterial({
            color: 0xffd700,
            transparent: true,
            opacity: 0.15,
            side: THREE.BackSide, // 内部不可见
        });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        this.nucleus.add(glow);
    }

    private createOrbits(): void {
        // 清理旧轨道
        this.orbits.forEach(o => this.removeFromScene(o));
        this.orbits = [];

        ENERGY_LEVELS.forEach(level => {
            const radius = this.getOrbitRadius(level.n);
            // 使用圆环几何体
            const geometry = new THREE.TorusGeometry(radius, 0.03, 16, 100);
            const material = new THREE.MeshBasicMaterial({
                color: level.color,
                transparent: true,
                opacity: 0.3 + (level.n * 0.05), // 外层稍微亮一点
            });
            const orbit = new THREE.Mesh(geometry, material);

            // 旋转使其面朝相机 (Torus 默认是在 XY 平面，这符合我们的顶视图需求，不用转)
            // 我们的相机在 Z 轴，看 XY 平面

            this.orbits.push(orbit);
            this.addToScene(orbit);
        });
    }

    private updateElectrons(): void {
        // 清理现有电子
        this.electrons.forEach(e => this.removeFromScene(e));
        this.electrons = [];

        // 根据模式创建电子
        const count = (this.sceneMode === 'spontaneous-emission' && this.atomType === 'group') ? 8 : 1;

        for (let i = 0; i < count; i++) {
            const geometry = new THREE.SphereGeometry(0.15, 32, 32);
            const material = new THREE.MeshStandardMaterial({
                color: 0x00ffff,
                emissive: 0x0088ff,
                emissiveIntensity: 1,
            });
            const electron = new THREE.Mesh(geometry, material);

            // 设置初始位置
            const radius = this.getOrbitRadius(this.currentLevel);
            const angle = (Math.PI * 2 * i) / count + Math.random(); // 分布在轨道上

            electron.position.set(
                Math.cos(angle) * radius,
                Math.sin(angle) * radius,
                0
            );

            // 绑定额外数据用于动画
            electron.userData = {
                currentN: this.currentLevel,
                targetN: this.currentLevel,
                angle: angle,
                speed: 1 / this.currentLevel, // 内层快外层慢
                isTransitioning: false,
                transitionProgress: 0,
            };

            this.electrons.push(electron);
            this.addToScene(electron);
        }
    }

    private getOrbitRadius(n: number): number {
        // 调整视觉比例，不是严格按 n^2，否则 n=6 太远
        // n=1 -> 2
        // n=6 -> 8
        return 1.5 + n * 1.1;
    }

    protected onStart(): void {
        // 当用户点击工具栏的 "开始/发射" 按钮时触发
        // 根据场景执行不同逻辑

        if (this.sceneMode === 'stimulated-absorption') {
            this.emitIncomingPhoton();
        } else if (this.sceneMode === 'stimulated-emission') {
            this.emitIncomingPhoton();
        } else if (this.sceneMode === 'spontaneous-emission') {
            this.startSpontaneous();
        }
    }

    protected onReset(): void {
        this.photons.forEach(p => {
            this.removeFromScene(p.getObject());
            p.dispose();
        });
        this.photons = [];
        this.transitionQueue = [];

        // 重置电子
        if (this.sceneMode === 'stimulated-absorption') {
            this.currentLevel = 1;
        } else {
            this.currentLevel = 3;
        }
        this.updateElectrons();
    }

    protected onParameterChange(key: string, value: any): void {
        if (key === 'excitationMode') {
            this.sceneMode = value as SceneMode;
            // 切换模式时重置部分状态
            this.onReset();
        } else if (key === 'initialLevel') {
            this.currentLevel = value as number;
            this.updateElectrons();
        } else if (key === 'inputEnergy') {
            this.inputEnergy = value as number;
        } else if (key === 'atomType') {
            this.atomType = value as AtomType;
            this.updateElectrons();
        } else if (key === 'triggerEmission') {
            // 响应发射触发信号
            this.emitIncomingPhoton();
        }
    }

    /**
     * 发射入射光子（用于受激吸收/辐射）
     */
    private emitIncomingPhoton(): void {
        // 从左侧射入
        const photon = createIncomingPhoton(this.inputEnergy);
        this.addPhoton(photon);
    }

    /**
     * 开始自发辐射
     */
    private startSpontaneous(): void {
        // 重置状态
        this.transitionQueue = [];

        // 为每个电子安排随机跃迁
        this.electrons.forEach((electron, index) => {
            const currentN = electron.userData.currentN;
            if (currentN > 1) {
                // 将跃迁计划存储在 queue 中，但在 update 中根据时间触发
                // 或者简单地，给每个电子一个随机倒计时
                electron.userData.transitionDelay = Math.random() * 2; // 0-2秒延迟
                electron.userData.hasScheduledTransition = true;
            }
        });
    }

    private addPhoton(photon: PhotonWave): void {
        this.photons.push(photon);
        this.addToScene(photon.getObject());
    }

    update(deltaTime: number): void {
        try {
            // 允许在暂停时也更新光子吗？通常不允许，除非是在做特殊演示。
            // 这里遵循 isRunning 控制
            if (!this.isRunning) return;

            // 0. 处理自发辐射的倒计时
            if (this.sceneMode === 'spontaneous-emission') {
                this.electrons.forEach((electron, index) => {
                    if (electron.userData.hasScheduledTransition) {
                        electron.userData.transitionDelay -= deltaTime;
                        if (electron.userData.transitionDelay <= 0) {
                            // 触发跃迁
                            electron.userData.hasScheduledTransition = false;
                            const currentN = electron.userData.currentN;
                            const targetN = Math.max(1, currentN - 1 - Math.floor(Math.random() * (currentN - 1)));

                            this.transitionQueue.push({
                                from: currentN,
                                to: targetN,
                                electronIndex: index
                            });
                        }
                    }
                });
            }

            // 1. 更新光子
            for (let i = this.photons.length - 1; i >= 0; i--) {
                const photon = this.photons[i];
                const alive = photon.update(deltaTime);

                if (!alive) {
                    this.removeFromScene(photon.getObject());
                    photon.dispose();
                    this.photons.splice(i, 1);
                    continue;
                }

                // 检查与原子核/电子系统的交互
                // 只有 *入射* 光子才触发交互检查
                if (photon.isIncoming) {
                    const pos = photon.getPosition();
                    // 交互判定：当光子到达圆心附近
                    if (pos.x >= -0.5 && pos.x <= 0.5 && !photon.hasInteracted) {
                        photon.hasInteracted = true;
                        this.handlePhotonInteraction(photon);
                    }
                }
            }

            // 2. 处理跃迁队列
            if (this.transitionQueue.length > 0) {
                const transition = this.transitionQueue.shift();
                if (transition && this.electrons[transition.electronIndex]) {
                    const electron = this.electrons[transition.electronIndex];
                    this.startElectronTransition(electron, transition.to);

                    // 发射光子 (自发辐射)
                    const deltaE = Math.abs(calculateEnergy(transition.from) - calculateEnergy(transition.to));
                    const emittedPhoton = createEmittedPhoton(deltaE, electron.position.clone());
                    this.addPhoton(emittedPhoton);
                }
            }

            // 3. 更新电子运动和动画
            this.electrons.forEach(electron => {
                const data = electron.userData;
                // Safety check
                if (!data) return;

                if (data.isTransitioning) {
                    data.transitionProgress += deltaTime * 2; // 跃迁速度
                    if (data.transitionProgress >= 1) {
                        data.transitionProgress = 1;
                        data.isTransitioning = false;
                        data.currentN = data.targetN;
                        // 更新当前能级参数显示（如果是单电子）
                        if (this.electrons.length === 1) {
                            this.currentLevel = data.currentN;
                            // 注意：不要调 setParameter 导致死循环，这里只是更新内部状态
                        }
                    }

                    // 插值半径
                    const startR = this.getOrbitRadius(data.currentN); // 确信 getOrbitRadius 存在
                    const endR = this.getOrbitRadius(data.targetN);
                    const r = startR + (endR - startR) * data.transitionProgress;

                    electron.position.set(
                        Math.cos(data.angle) * r,
                        Math.sin(data.angle) * r,
                        0
                    );
                } else {
                    // 正常公转
                    data.angle += deltaTime * data.speed;
                    const r = this.getOrbitRadius(data.currentN);
                    electron.position.set(
                        Math.cos(data.angle) * r,
                        Math.sin(data.angle) * r,
                        0
                    );
                }
            });
        } catch (e) {
            console.error('Error in HydrogenTransition update:', e);
        }
    }

    private handlePhotonInteraction(inPhoton: PhotonWave): void {
        try {
            const energy = this.inputEnergy;
            const validEnergies = getValidTransitionEnergies(this.currentLevel, this.sceneMode);

            // 检查是否匹配（利用 slide 标记点的逻辑，只有精确匹配才算）
            const matchedEnergy = matchValidEnergy(energy, validEnergies);

            if (matchedEnergy) {
                const targetN = getTargetLevel(this.currentLevel, matchedEnergy, this.sceneMode);

                if (targetN !== null && targetN !== Infinity) {
                    if (this.sceneMode === 'stimulated-absorption') {
                        // 吸收：光子消失，电子跃迁
                        this.removeFromScene(inPhoton.getObject());
                        inPhoton.dispose();
                        this.photons = this.photons.filter(p => p !== inPhoton); // 移除光子

                        // 触发电子跃迁
                        if (this.electrons[0]) {
                            this.startElectronTransition(this.electrons[0], targetN);
                        }

                    } else if (this.sceneMode === 'stimulated-emission') {
                        // 受激辐射：光子继续，并发射一个新的一样的光子
                        // 电子向下跃迁
                        if (this.electrons[0]) {
                            this.startElectronTransition(this.electrons[0], targetN);

                            // 创建受激辐射光子（同方向、同相位）
                            // 假设入射光子方向是 (1,0,0)
                            const emitted = createEmittedPhoton(
                                matchedEnergy,
                                this.electrons[0].position.clone(), // 从电子当前位置发射？或者从中心？通常演示为了整齐从中心或平行
                                new THREE.Vector3(1, 0, 0), // 同方向
                                0 // 同相位 (简化处理)
                            );
                            // 让新光子稍微错开一点 webGL z轴 或 y轴 以便看清是两个
                            emitted.getObject().position.y += 0.5;

                            this.addPhoton(emitted);
                        }
                    }
                }
            }
            // 如果不匹配，光子继续飞行（不做处理）
        } catch (e) {
            console.error(e);
        }
    }

    private startElectronTransition(electron: THREE.Mesh, targetN: number): void {
        electron.userData.targetN = targetN;
        electron.userData.isTransitioning = true;
        electron.userData.transitionProgress = 0;
        // 如果是单电子模式，更新组件参数状态（用于UI同步）
        // 这需要反向通信，目前简化处理
    }

    getDisplayData(): Record<string, DisplayValue> {
        return {
            status: {
                label: '状态',
                value: this.sceneMode === 'stimulated-absorption' ? '等待激发' : '辐射中'
            }
        };
    }
}
