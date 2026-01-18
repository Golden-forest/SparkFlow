import * as THREE from 'three';
import type { VisualPlanetParams } from './VisualData';

export class Planet {
    private params: VisualPlanetParams;
    private mesh: THREE.Mesh;
    private orbitLine: THREE.Line;
    private scene: THREE.Scene;
    private time: number = 0;
    private isSelected: boolean = false;
    private selectedMaterial: THREE.MeshStandardMaterial;
    private normalMaterial: THREE.MeshStandardMaterial;

    constructor(scene: THREE.Scene, params: VisualPlanetParams) {
        this.params = params;
        this.scene = scene;
        
        // 创建行星的3D模型
        this.mesh = this.createMesh();
        this.orbitLine = this.createOrbitLine();
        
        // 创建材质（普通和选中状态）
        this.normalMaterial = this.mesh.material as THREE.MeshStandardMaterial;
        this.selectedMaterial = new THREE.MeshStandardMaterial({
            color: this.normalMaterial.color,
            emissive: 0xffffff,
            emissiveIntensity: 0.3,
            metalness: this.normalMaterial.metalness,
            roughness: this.normalMaterial.roughness
        });
        
        // 添加到场景
        this.scene.add(this.orbitLine);
        this.scene.add(this.mesh);
    }

    /**
     * 创建行星的3D网格
     */
    private createMesh(): THREE.Mesh {
        // 直接使用可视化数据中的尺寸参数
        const size = Math.max(0.1, this.params.size);

        const geometry = new THREE.SphereGeometry(size, 32, 32);
        const material = new THREE.MeshStandardMaterial({
            color: this.params.color,
            metalness: 0.3,
            roughness: 0.7
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData = { type: 'planet', name: this.params.name };

        return mesh;
    }

    /**
     * 创建行星的轨道线
     */
    private createOrbitLine(): THREE.Line {
        // 直接使用可视化数据中的轨道半径
        const orbitRadius = this.params.orbit;
        const points: THREE.Vector3[] = [];

        // 创建圆形轨道线
        for (let i = 0; i <= 360; i++) {
            const angle = (i * Math.PI * 2) / 360;
            const x = Math.cos(angle) * orbitRadius;
            const z = Math.sin(angle) * orbitRadius;
            points.push(new THREE.Vector3(x, 0, z));
        }

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color: 0x666666,
            opacity: 0.3,
            transparent: true
        });

        return new THREE.Line(geometry, material);
    }

    /**
     * 更新行星位置和状态
     * @param deltaTime 时间增量（秒）
     */
    public update(deltaTime: number): void {
        this.time += deltaTime;

        // 使用简单的三角函数计算轨道位置
        // 基于可视化数据中的速度系数
        const angle = this.time * this.params.speed * 0.5; // 0.5是基础速度倍率
        const x = Math.cos(angle) * this.params.orbit;
        const z = Math.sin(angle) * this.params.orbit;

        // 更新行星位置
        this.mesh.position.set(x, 0, z);

        // 简单的自转效果（仅用于视觉效果）
        this.mesh.rotation.y += deltaTime * 0.5;
    }

    /**
     * 选择/取消选择行星
     */
    public setSelected(selected: boolean): void {
        this.isSelected = selected;
        this.mesh.material = selected ? this.selectedMaterial : this.normalMaterial;
    }

    /**
     * 检查点是否与行星相交
     */
    public intersects(raycaster: THREE.Raycaster): boolean {
        const intersects = raycaster.intersectObject(this.mesh);
        return intersects.length > 0;
    }

    /**
     * 获取行星名称
     */
    public getName(): string {
        return this.params.name;
    }

    /**
     * 获取行星的3D模型
     */
    public getMesh(): THREE.Mesh {
        return this.mesh;
    }

    /**
     * 获取行星的轨道线
     */
    public getOrbitLine(): THREE.Line {
        return this.orbitLine;
    }

    /**
     * 获取行星参数
     */
    public getParams(): VisualPlanetParams {
        return this.params;
    }

    /**
     * 获取行星的当前位置
     */
    public getPosition(): THREE.Vector3 {
        return this.mesh.position.clone();
    }

    /**
     * 设置行星的不透明度
     * @param opacity 不透明度值 (0-1)
     */
    public setOpacity(opacity: number): void {
        // 确保材质支持透明度
        if (this.mesh.material instanceof THREE.MeshStandardMaterial) {
            this.mesh.material.transparent = true;
            this.mesh.material.opacity = opacity;
        }

        // 同时更新选中材质的透明度
        if (this.selectedMaterial instanceof THREE.MeshStandardMaterial) {
            this.selectedMaterial.transparent = true;
            this.selectedMaterial.opacity = opacity;
        }

        // 当完全不透明时隐藏对象
        this.mesh.visible = opacity > 0;
    }

    /**
     * 销毁行星，清理资源
     */
    public dispose(): void {
        // 从场景中移除
        this.scene.remove(this.mesh);
        this.scene.remove(this.orbitLine);
        
        // 释放资源
        this.mesh.geometry.dispose();
        this.normalMaterial.dispose();
        this.selectedMaterial.dispose();
        this.orbitLine.geometry.dispose();
        (this.orbitLine.material as THREE.Material).dispose();
    }
}
