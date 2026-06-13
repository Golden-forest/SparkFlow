import * as THREE from 'three';
import gsap from 'gsap';
import { ExperimentBase } from '../../base';
import type { DisplayValue, InteractionEvent } from '../../base';
import { ExperimentCategory, type ExperimentDifficulty } from '@/utils/constants';
import { Planet } from './Planet';
import { Satellite } from './Satellite';
import { CAMERA_CONFIG, SOLAR_SYSTEM_VISUAL_DATA, SATELLITE_VISUAL_DATA } from './VisualData';

/**
 * 天体运动模拟实验 - 太阳系行星运动
 */
export class SolarSystem extends ExperimentBase {
    readonly metadata = {
        id: 'solar-system',
        name: 'Celestial Motion Simulation',
        category: ExperimentCategory.Celestial,
        description: 'Explore planetary motion in the solar system and Earth satellite orbits',
        difficulty: 'intermediate' as ExperimentDifficulty,
        duration: 20,
        keywords: ['solar system', 'planets', 'satellites', 'orbits', 'gravitation'],
        thumbnail: '/thumbnails/solar-system.png',
    };

    readonly config = {
        physics: {
            timestep: 1 / 60,
        },
        camera: {
            position: CAMERA_CONFIG.solarView.position,
            target: CAMERA_CONFIG.solarView.target,
            fov: CAMERA_CONFIG.solarView.fov,
        },
        parameters: [
            {
                key: 'timeScale',
                label: 'Time Scale',
                type: 'number' as const,
                defaultValue: 1,
                min: 0.1,
                max: 10,
                step: 0.1,
            },
            {
                key: 'showOrbits',
                label: 'Show Orbits',
                type: 'boolean' as const,
                defaultValue: true,
            },
            {
                key: 'selectedPlanet',
                label: 'Selected Body',
                type: 'select' as const,
                defaultValue: 'Earth',
                options: SOLAR_SYSTEM_VISUAL_DATA.planets.map(planet => ({
                    value: planet.name,
                    label: planet.name
                })),
            },
            {
                key: 'viewMode',
                label: 'View Mode',
                type: 'select' as const,
                defaultValue: 'solar',
                options: [
                    { value: 'solar', label: 'Solar System View' },
                    { value: 'satellite', label: 'Satellite View' },
                ],
            },
        ],
    };

    // 场景对象
    private sun: THREE.Mesh | null = null;
    private sunGlows: THREE.Mesh[] = []; // 太阳光晕网格引用
    private planets: Planet[] = [];
    private satellites: Satellite[] = [];
    private selectedPlanet: Planet | null = null;
    private currentViewMode: 'solar' | 'satellite' = 'solar';
    private earthPosition: THREE.Vector3 = new THREE.Vector3();
    private timeScale: number = 1;
    private showOrbits: boolean = true; // 轨道显示状态

    protected async setupScene(): Promise<void> {
        if (!this.scene) return;

        // 1. 创建星空背景
        // this.createStarfield(); // Disabled - keeping simple dark background

        // 2. 创建太阳
        this.createSun();

        // 3. 创建行星
        this.createPlanets();

        // 4. 创建卫星（初始隐藏，在卫星视图中显示）
        this.createSatellites();

        // 5. 灯光设置
        this.setupLights();

        // 6. 默认选中地球
        this.selectPlanet('Earth');
    }

    /**
     * 创建太阳
     */
    private createSun(): void {
        if (!this.scene) return;

        const sunData = SOLAR_SYSTEM_VISUAL_DATA.sun;
        const sunGeometry = new THREE.SphereGeometry(sunData.radius, 64, 64);

        // 加载太阳纹理
        const textureLoader = new THREE.TextureLoader();
        const sunTexture = textureLoader.load('/textures/planets/sun.jpg');
        sunTexture.colorSpace = THREE.SRGBColorSpace;

        const sunMaterial = new THREE.MeshStandardMaterial({
            map: sunTexture,                  // 添加太阳纹理
            color: 0xffffff,                  // 白色让纹理完全显示
            emissive: sunData.emissive,
            emissiveIntensity: 0.8,           // 大幅降低发光让纹理可见
            metalness: 0,
            roughness: 1
        });

        this.sun = new THREE.Mesh(sunGeometry, sunMaterial);
        this.sun.userData = { type: 'sun', name: 'Sun' };
        this.addToScene(this.sun);

        // 添加太阳光晕效果
        // 外层光晕（大而淡）
        const outerGlowGeometry = new THREE.SphereGeometry(6.5, 32, 32); // 缩小光晕（太阳半径5）
        const outerGlowMaterial = new THREE.MeshBasicMaterial({
            color: 0xffaa00,
            transparent: true,
            opacity: 0.15, // 降低不透明度让光晕更柔和
            side: THREE.BackSide, // 渲染球体内部
        });
        const outerGlow = new THREE.Mesh(outerGlowGeometry, outerGlowMaterial);
        this.sun.add(outerGlow); // 作为太阳的子对象添加
        this.sunGlows.push(outerGlow); // 追踪光晕网格以便清理

        // 内层光晕（小而亮）
        const innerGlowGeometry = new THREE.SphereGeometry(5.8, 32, 32); // 紧贴太阳表面
        const innerGlowMaterial = new THREE.MeshBasicMaterial({
            color: 0xffdd00,
            transparent: true,
            opacity: 0.2, // 降低不透明度
            side: THREE.BackSide,
        });
        const innerGlow = new THREE.Mesh(innerGlowGeometry, innerGlowMaterial);
        this.sun.add(innerGlow);
        this.sunGlows.push(innerGlow); // 追踪光晕网格以便清理

        // 添加太阳光 (增强科技未来感氛围)
        const sunLight = new THREE.PointLight(
            0xffdd00,    // 暖黄色
            3,           // 增强强度从0.8到3
            300,         // 增加距离从200到300
            1            // Decay
        );
        this.addToScene(sunLight);
    }

    /**
     * 创建行星
     */
    private createPlanets(): void {
        if (!this.scene) return;

        this.planets = SOLAR_SYSTEM_VISUAL_DATA.planets.map(params => new Planet(this.scene!, params));
    }

    /**
     * 创建卫星
     */
    private createSatellites(): void {
        if (!this.scene) return;

        this.satellites = SATELLITE_VISUAL_DATA.satellites.map(params => {
            const satellite = new Satellite(this.scene!, params);
            satellite.getMesh().visible = false; // 初始隐藏卫星本身
            satellite.getOrbitLine().visible = false; // 初始隐藏卫星轨道线
            return satellite;
        });
    }

    /**
     * 设置灯光
     */
    private setupLights(): void {
        if (!this.scene) return;

        // 环境光 (冷蓝色营造科技未来感氛围)
        const ambientLight = new THREE.AmbientLight(
            0x404080,    // 冷蓝色 (从中性灰改为冷蓝)
            0.3          // 稍微提高强度从0.2到0.3
        );
        this.addToScene(ambientLight);

        // 方向光（用于补光,降低强度）
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.1);
        directionalLight.position.set(100, 100, 100);
        this.addToScene(directionalLight);
    }

    protected onStart(): void {
        // Hook for simulation start.
    }

    protected onReset(): void {
        // 重置实验状态
        this.planets.forEach(planet => {
            planet.setSelected(false);
        });
        this.satellites.forEach(satellite => {
            satellite.setSelected(false);
        });
        this.selectPlanet('Earth');
    }

    protected onParameterChange(key: string, value: number | string | boolean): void {
        if (key === 'timeScale') {
            this.timeScale = Number(value);
        } else if (key === 'showOrbits') {
            this.showOrbits = Boolean(value);
            this.toggleOrbits(Boolean(value));
        } else if (key === 'selectedPlanet') {
            this.selectPlanet(String(value));
        } else if (key === 'viewMode') {
            this.switchViewMode(value === 'satellite' ? 'satellite' : 'solar');
        }
    }

    /**
     * 切换视图模式
     */
    private switchViewMode(mode: 'solar' | 'satellite'): void {
        // 如果已经在该模式,直接返回
        if (this.currentViewMode === mode) {
            return;
        }

        this.currentViewMode = mode;
        const fadeDuration = 0.8; // 800ms淡入淡出时间

        if (mode === 'solar') {
            // 太阳系视图：淡入所有行星，淡出所有卫星
            this.animateObjectOpacity(this.planets, 1, fadeDuration);
            this.animateObjectOpacity(this.satellites, 0, fadeDuration);

            // 同时控制轨道线的显示
            this.planets.forEach(planet => {
                planet.getOrbitLine().visible = this.showOrbits;
            });
            this.satellites.forEach(satellite => {
                satellite.getOrbitLine().visible = false;
            });
        } else {
            // 卫星视图：淡入所有卫星，淡出除地球外的所有行星
            this.animateObjectOpacity(this.satellites, 1, fadeDuration);

            // 淡出所有行星，除了地球
            this.planets.forEach(planet => {
                if (planet.getName() !== 'Earth') {
                    this.animateObjectOpacity([planet], 0, fadeDuration);
                    planet.getOrbitLine().visible = false;
                } else {
                    this.animateObjectOpacity([planet], 1, fadeDuration);
                    planet.getOrbitLine().visible = this.showOrbits;
                }
            });

            // 同时控制卫星轨道线的显示
            this.satellites.forEach(satellite => {
                satellite.getOrbitLine().visible = this.showOrbits;
            });
        }
    }

    /**
     * 使用GSAP动画化对象的不透明度
     * @param objects 行星或卫星数组
     * @param targetOpacity 目标不透明度 (0-1)
     * @param duration 动画持续时间（秒）
     */
    private animateObjectOpacity(
        objects: Planet[] | Satellite[],
        targetOpacity: number,
        duration: number
    ): void {
        objects.forEach(obj => {
            const mesh = obj.getMesh();

            // 确保材质支持透明度
            if (mesh.material instanceof THREE.MeshStandardMaterial) {
                mesh.material.transparent = true;
                mesh.material.needsUpdate = true;
            }

            // 使用GSAP动画化材质的opacity属性
            gsap.to(mesh.material, {
                opacity: targetOpacity,
                duration: duration,
                ease: "power2.inOut",
                onUpdate: () => {
                    // 在动画过程中确保材质需要更新
                    if (mesh.material instanceof THREE.MeshStandardMaterial) {
                        mesh.material.needsUpdate = true;
                    }
                },
                onComplete: () => {
                    // 动画完成后，根据目标不透明度决定是否显示对象
                    mesh.visible = targetOpacity > 0;
                }
            });
        });
    }

    /**
     * 选择行星
     */
    private selectPlanet(planetName: string): void {
        this.planets.forEach(planet => {
            if (planet.getName() === planetName) {
                planet.setSelected(true);
                this.selectedPlanet = planet;
                if (planetName === 'Earth') {
                    this.earthPosition = planet.getPosition();
                }
            } else {
                planet.setSelected(false);
            }
        });
    }

    /**
     * 切换轨道显示
     */
    private toggleOrbits(show: boolean): void {
        this.planets.forEach(planet => {
            planet.getOrbitLine().visible = show;
        });
        this.satellites.forEach(satellite => {
            satellite.getOrbitLine().visible = show;
        });
    }

    update(deltaTime: number): void {
        try {
            if (!this.isRunning) return;

            // 应用时间缩放
            const scaledDelta = deltaTime * this.timeScale;

            // 根据视图模式决定是否更新行星位置
            if (this.currentViewMode === 'solar') {
                // 太阳系视图：更新所有行星，地球会绕太阳运动
                this.planets.forEach(planet => {
                    planet.update(scaledDelta);
                    if (planet.getName() === 'Earth') {
                        this.earthPosition = planet.getPosition();
                    }
                });
            }
            // 卫星视图：不更新行星位置，地球保持在场景中心静止不动

            // 卫星始终更新（相对于地球位置）
            this.satellites.forEach(satellite => {
                if (this.currentViewMode === 'satellite' || satellite.getMesh().visible) {
                    satellite.update(scaledDelta, this.earthPosition);
                }
            });

        } catch (e) {
            console.error('Error in SolarSystem update:', e);
        }
    }

    getDisplayData(): Record<string, DisplayValue> {
        const selectedPlanetName = this.selectedPlanet?.getName() || 'Earth';
        const selectedPlanet = this.planets.find(p => p.getName() === selectedPlanetName);

        const planetData = selectedPlanet ? selectedPlanet.getParams() : null;

        // 计算相对于地球的速度（地球的速度是1.0）
        const relativeSpeed = planetData ? planetData.speed : 1.0;

        return {
            currentView: {
                label: 'Current View',
                value: this.currentViewMode === 'solar' ? 'Solar System' : 'Satellite System'
            },
            selectedPlanet: {
                label: 'Selected Body',
                value: selectedPlanetName
            },
            ...(planetData && {
                orbitalPeriod: {
                    label: 'Orbital Period',
                    value: planetData.period,
                },
                relativeSpeed: {
                    label: 'Relative Speed',
                    value: relativeSpeed,
                    unit: 'Earth=1.0x'
                }
            }),
            planetCount: {
                label: 'Planets',
                value: this.planets.length
            },
            satelliteCount: {
                label: 'Satellites',
                value: this.satellites.length
            },
            timeScale: {
                label: 'Time Scale',
                value: this.timeScale,
                unit: 'x'
            }
        };
    }

    getMonitorSchema() {
        return {
            title: 'Monitor',
            quantities: [
                { key: 'planetCount', label: 'Planets', unit: 'count', color: '#22d3ee' },
                { key: 'satelliteCount', label: 'Satellites', unit: 'count', color: '#34d399' },
                { key: 'timeScale', label: 'Time Scale', unit: 'x', color: '#f59e0b' },
                { key: 'relativeSpeed', label: 'Relative Speed', unit: 'Earth=1.0x', color: '#a78bfa' },
            ],
            defaultSelected: ['timeScale', 'relativeSpeed', 'planetCount'],
            sampleIntervalMs: 120,
        };
    }

    public onInteraction?(event: InteractionEvent): void {
        // 处理交互事件，如点击行星
        if (event.type === 'click' && event.object) {
            const object = event.object;
            if (object.userData.type === 'planet') {
                this.selectPlanet(object.userData.name);
            } else if (object.userData.type === 'satellite') {
                // 处理卫星点击
            }
        }
    }

    /**
     * 清理资源
     */
    dispose(): void {
        // 清理光晕网格
        this.sunGlows.forEach(glow => {
            glow.geometry?.dispose();
            if (glow.material instanceof THREE.Material) {
                glow.material.dispose();
            }
        });
        this.sunGlows = [];

        // 清理行星
        this.planets.forEach(planet => planet.dispose?.());
        this.planets = [];

        // 清理卫星
        this.satellites.forEach(satellite => satellite.dispose?.());
        this.satellites = [];

        // 调用基类的清理方法
        super.dispose();
    }
}
