import * as THREE from 'three';
import { ExperimentBase, registerExperiment } from '../../base';
import type { DisplayValue } from '../../base';
import type { ExperimentCategory, ExperimentDifficulty } from '@/utils/constants';
import {
    ENERGY_LEVELS,
    calculateTransition,
    calculateAllTransitions,
    calculateSpectralLineCount,
    canAbsorbPhoton,
    canExciteByElectron,
    generateSpontaneousPath,
} from './TransitionPhysics';
import type { ExcitationMode, AtomType, Transition } from './TransitionPhysics';

/**
 * 氢原子能级跃迁实验
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
            position: [0, 0, 15] as [number, number, number],
            target: [0, 0, 0] as [number, number, number],
            fov: 50,
        },
        parameters: [
            {
                key: 'excitationMode',
                label: '激发模式',
                type: 'select' as const,
                defaultValue: 'spontaneous',
                options: [
                    { value: 'photon', label: '光子激发' },
                    { value: 'electron', label: '电子碰撞' },
                    { value: 'spontaneous', label: '自由跃迁' },
                ],
            },
            {
                key: 'atomType',
                label: '原子类型',
                type: 'select' as const,
                defaultValue: 'single',
                options: [
                    { value: 'single', label: '单个原子' },
                    { value: 'group', label: '一群原子' },
                ],
            },
            {
                key: 'initialLevel',
                label: '初始能级',
                type: 'number' as const,
                defaultValue: 3,
                min: 1,
                max: 6,
                step: 1,
            },
            {
                key: 'inputEnergy',
                label: '输入能量',
                type: 'number' as const,
                defaultValue: 10.2,
                min: 0,
                max: 15,
                step: 0.1,
                unit: 'eV',
            },
        ],
    };

    // 状态
    private currentLevel = 1;
    private excitationMode: ExcitationMode = 'spontaneous';
    private atomType: AtomType = 'single';
    private inputEnergy = 10.2;
    private transitionHistory: Transition[] = [];
    private spectralLineCount = 0;
    private lastResult = '';

    // 3D对象
    private nucleus: THREE.Mesh | null = null;
    private electron: THREE.Mesh | null = null;
    private orbits: THREE.Line[] = [];
    private photon: THREE.Mesh | null = null;

    // 动画状态
    private isAnimating = false;
    private animationProgress = 0;
    private animationTarget = 0;
    private pendingTransitions: Transition[] = [];

    protected async setupScene(): Promise<void> {
        if (!this.scene) return;

        // 创建原子核
        const nucleusGeometry = new THREE.SphereGeometry(0.3, 32, 32);
        const nucleusMaterial = new THREE.MeshStandardMaterial({
            color: '#ffd700',
            emissive: '#ff8c00',
            emissiveIntensity: 0.5,
        });
        this.nucleus = new THREE.Mesh(nucleusGeometry, nucleusMaterial);
        this.addToScene(this.nucleus);

        // 创建电子
        const electronGeometry = new THREE.SphereGeometry(0.15, 32, 32);
        const electronMaterial = new THREE.MeshStandardMaterial({
            color: '#00ff88',
            emissive: '#00ff88',
            emissiveIntensity: 0.8,
        });
        this.electron = new THREE.Mesh(electronGeometry, electronMaterial);
        this.electron.position.set(1, 0, 0);
        this.addToScene(this.electron);

        // 创建轨道
        this.createOrbits();

        // 创建光子
        const photonGeometry = new THREE.SphereGeometry(0.1, 16, 16);
        const photonMaterial = new THREE.MeshBasicMaterial({
            color: '#ffff00',
            transparent: true,
            opacity: 0,
        });
        this.photon = new THREE.Mesh(photonGeometry, photonMaterial);
        this.addToScene(this.photon);

        // 添加灯光
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.addToScene(ambientLight);

        const pointLight = new THREE.PointLight(0xffffff, 1, 100);
        pointLight.position.set(10, 10, 10);
        this.addToScene(pointLight);
    }

    private createOrbits(): void {
        this.orbits.forEach(orbit => this.removeFromScene(orbit));
        this.orbits = [];

        ENERGY_LEVELS.forEach(level => {
            const radius = level.n * 1.2;
            const points: THREE.Vector3[] = [];

            for (let i = 0; i <= 64; i++) {
                const angle = (i / 64) * Math.PI * 2;
                points.push(new THREE.Vector3(
                    Math.cos(angle) * radius,
                    Math.sin(angle) * radius,
                    0
                ));
            }

            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const material = new THREE.LineBasicMaterial({
                color: level.color,
                transparent: true,
                opacity: 0.5,
            });
            const orbit = new THREE.Line(geometry, material);
            this.orbits.push(orbit);
            this.addToScene(orbit);
        });
    }

    protected onStart(): void {
        this.currentLevel = this.getParameter('initialLevel') as number;
        this.excitationMode = this.getParameter('excitationMode') as ExcitationMode;
        this.atomType = this.getParameter('atomType') as AtomType;
        this.inputEnergy = this.getParameter('inputEnergy') as number;

        this.updateElectronPosition(this.currentLevel);
        this.startExcitation();
    }

    protected onReset(): void {
        this.currentLevel = 1;
        this.transitionHistory = [];
        this.spectralLineCount = 0;
        this.lastResult = '';
        this.isAnimating = false;
        this.pendingTransitions = [];
        this.updateElectronPosition(1);

        if (this.photon) {
            (this.photon.material as THREE.MeshBasicMaterial).opacity = 0;
        }
    }

    protected onParameterChange(key: string, value: number | string | boolean): void {
        switch (key) {
            case 'excitationMode':
                this.excitationMode = value as ExcitationMode;
                break;
            case 'atomType':
                this.atomType = value as AtomType;
                break;
            case 'initialLevel':
                this.currentLevel = value as number;
                this.updateElectronPosition(this.currentLevel);
                break;
            case 'inputEnergy':
                this.inputEnergy = value as number;
                break;
        }
    }

    private startExcitation(): void {
        const initialLevel = this.getParameter('initialLevel') as number;

        switch (this.excitationMode) {
            case 'photon':
                this.handlePhotonExcitation(initialLevel);
                break;
            case 'electron':
                this.handleElectronExcitation(initialLevel);
                break;
            case 'spontaneous':
                this.handleSpontaneousTransition(initialLevel);
                break;
        }
    }

    private handlePhotonExcitation(currentLevel: number): void {
        const result = canAbsorbPhoton(currentLevel, this.inputEnergy);

        if (result === null) {
            this.lastResult = '光子能量 ' + this.inputEnergy.toFixed(2) + ' eV 不能被吸收（需精确匹配能级差）';
        } else if (result === Infinity) {
            this.lastResult = '光子能量足够使原子电离！电子逃逸';
            this.animateIonization();
        } else {
            const transition = calculateTransition(currentLevel, result);
            this.lastResult = '光子被吸收！电子从 n=' + currentLevel + ' 跃迁到 n=' + result;
            this.animateTransition(transition);
        }
    }

    private handleElectronExcitation(currentLevel: number): void {
        const result = canExciteByElectron(currentLevel, this.inputEnergy);

        if (result === null) {
            this.lastResult = '电子能量 ' + this.inputEnergy.toFixed(2) + ' eV 不足以激发原子';
        } else if (result.targetLevel === Infinity) {
            this.lastResult = '电子碰撞使原子电离！剩余能量 ' + result.remainingEnergy.toFixed(2) + ' eV';
            this.animateIonization();
        } else {
            const transition = calculateTransition(currentLevel, result.targetLevel);
            this.lastResult = '碰撞激发成功！n=' + currentLevel + ' -> n=' + result.targetLevel + '，剩余能量 ' + result.remainingEnergy.toFixed(2) + ' eV';
            this.animateTransition(transition);
        }
    }

    private handleSpontaneousTransition(startLevel: number): void {
        if (startLevel <= 1) {
            this.lastResult = '已在基态，无法向下跃迁';
            return;
        }

        if (this.atomType === 'single') {
            const path = generateSpontaneousPath(startLevel);
            this.pendingTransitions = path;
            this.spectralLineCount = path.length;
            this.lastResult = '单原子从 n=' + startLevel + ' 开始自发跃迁，将发出 ' + path.length + ' 个光子';
            this.processNextTransition();
        } else {
            const allTransitions = calculateAllTransitions(startLevel);
            this.transitionHistory = allTransitions;
            this.spectralLineCount = calculateSpectralLineCount(startLevel);
            this.lastResult = '一群原子从 n=' + startLevel + ' 跃迁，可产生 C(' + startLevel + ',2)=' + this.spectralLineCount + ' 种光谱线';

            this.pendingTransitions = [...allTransitions];
            this.processNextTransition();
        }
    }

    private processNextTransition(): void {
        if (this.pendingTransitions.length === 0) {
            this.isAnimating = false;
            return;
        }

        const transition = this.pendingTransitions.shift()!;
        this.transitionHistory.push(transition);
        this.animateTransition(transition);
    }

    private animateTransition(transition: Transition): void {
        this.isAnimating = true;
        this.animationProgress = 0;
        this.animationTarget = transition.to;
        this.currentLevel = transition.from;

        if (this.photon) {
            (this.photon.material as THREE.MeshBasicMaterial).color.set(transition.photonColor);
        }
    }

    private animateIonization(): void {
        this.isAnimating = true;
        this.animationProgress = 0;
        this.animationTarget = 7;
    }

    private updateElectronPosition(level: number): void {
        if (!this.electron) return;

        const radius = level * 1.2;
        this.electron.position.set(radius, 0, 0);
    }

    update(deltaTime: number): void {
        if (!this.isRunning) return;

        // 电子轨道旋转
        if (this.electron && !this.isAnimating) {
            const radius = this.currentLevel * 1.2;
            const angle = Date.now() * 0.002;
            this.electron.position.set(
                Math.cos(angle) * radius,
                Math.sin(angle) * radius,
                0
            );
        }

        // 跃迁动画
        if (this.isAnimating) {
            this.animationProgress += deltaTime * 2;

            if (this.animationProgress >= 1) {
                this.animationProgress = 1;
                this.isAnimating = false;

                if (this.animationTarget <= 6) {
                    this.currentLevel = this.animationTarget;
                    this.updateElectronPosition(this.currentLevel);
                }

                if (this.photon) {
                    (this.photon.material as THREE.MeshBasicMaterial).opacity = 0;
                }

                setTimeout(() => this.processNextTransition(), 500);
            } else {
                const startRadius = this.currentLevel * 1.2;
                const endRadius = this.animationTarget <= 6 ? this.animationTarget * 1.2 : 10;
                const currentRadius = startRadius + (endRadius - startRadius) * this.animationProgress;

                const angle = Date.now() * 0.002;
                if (this.electron) {
                    this.electron.position.set(
                        Math.cos(angle) * currentRadius,
                        Math.sin(angle) * currentRadius,
                        0
                    );
                }

                if (this.photon && this.animationTarget < this.currentLevel) {
                    const photonRadius = currentRadius + 2 + this.animationProgress * 5;
                    this.photon.position.set(
                        Math.cos(angle + Math.PI) * photonRadius,
                        Math.sin(angle + Math.PI) * photonRadius,
                        0
                    );
                    (this.photon.material as THREE.MeshBasicMaterial).opacity = 1 - this.animationProgress;
                }
            }
        }
    }

    getDisplayData(): Record<string, DisplayValue> {
        return {
            currentLevel: {
                label: '当前能级',
                value: this.currentLevel <= 6 ? 'n=' + this.currentLevel : '电离',
            },
            energy: {
                label: '能量',
                value: this.currentLevel <= 6 ? (-13.6 / (this.currentLevel * this.currentLevel)).toFixed(2) : '0',
                unit: 'eV',
            },
            spectralLines: {
                label: '光谱线数',
                value: this.spectralLineCount,
                unit: '条',
            },
            result: {
                label: '结果',
                value: this.lastResult || '-',
            },
        };
    }
}
