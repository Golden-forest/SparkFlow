import * as THREE from 'three';
import type { VisualSatelliteParams } from './VisualData';

export class Satellite {
    private params: VisualSatelliteParams;
    private mesh: THREE.Mesh;
    private orbitLine: THREE.Line;
    private scene: THREE.Scene;
    private time: number = 0;
    private isSelected: boolean = false;
    private selectedMaterial: THREE.MeshStandardMaterial;
    private normalMaterial: THREE.MeshStandardMaterial;

    constructor(scene: THREE.Scene, params: VisualSatelliteParams) {
        this.params = params;
        this.scene = scene;
        
        // 创建卫星的3D模型
        this.mesh = this.createMesh();
        this.orbitLine = this.createOrbitLine();
        
        // 创建材质（普通和选中状态）
        this.normalMaterial = this.mesh.material as THREE.MeshStandardMaterial;
        this.selectedMaterial = new THREE.MeshStandardMaterial({
            color: this.normalMaterial.color,
            emissive: this.normalMaterial.emissive, // Keep satellite's glow color
            emissiveIntensity: 0.8,                  // Same strong glow
            metalness: this.normalMaterial.metalness,
            roughness: this.normalMaterial.roughness
        });
        
        // 添加到场景
        this.scene.add(this.orbitLine);
        this.scene.add(this.mesh);
    }

    /**
     * 创建卫星的3D网格
     */
    private createMesh(): THREE.Mesh {
        // 直接使用可视化数据中的尺寸参数
        const size = Math.max(0.05, this.params.size);

        const geometry = new THREE.SphereGeometry(size, 16, 16);
        const material = new THREE.MeshStandardMaterial({
            color: this.params.color,
            metalness: 0.1,              // Lower metalness for glow effect
            roughness: 0.4,              // Lower roughness for smooth surface
            emissive: this.params.color, // NEW: Use satellite color for glow
            emissiveIntensity: 0.8       // NEW: Strong glow like energy fields
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData = { type: 'satellite', name: this.params.name };

        return mesh;
    }

    /**
     * 创建卫星的轨道线
     */
    private createOrbitLine(): THREE.Line {
        // 直接使用可视化数据中的轨道半径
        const orbitRadius = this.params.orbit;
        const points: THREE.Vector3[] = [];

        // 创建圆形轨道线，考虑倾角
        for (let i = 0; i <= 360; i++) {
            const angle = (i * Math.PI * 2) / 360;

            // 先计算赤道平面上的位置
            const pos = new THREE.Vector3(
                Math.cos(angle) * orbitRadius,
                0,
                Math.sin(angle) * orbitRadius
            );

            // 绕x轴旋转，应用倾角
            const rotatedPos = pos.applyAxisAngle(new THREE.Vector3(1, 0, 0), this.params.inclination);
            points.push(rotatedPos);
        }

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineDashedMaterial({
            color: 0x00ffff,           // Cyan color for satellites (brighter than planets)
            dashSize: 0.4,             // Slightly smaller dashes
            gapSize: 0.2,              // Smaller gaps
            scale: 1,
            transparent: true,
            opacity: 0.5,              // More visible since satellites are smaller
        });

        const orbitLine = new THREE.Line(geometry, material);
        orbitLine.computeLineDistances(); // CRITICAL: Required for dashed lines to render
        return orbitLine;
    }

    /**
     * 更新卫星位置和状态
     * @param deltaTime 时间增量（秒）
     * @param parentPosition 父行星的位置
     */
    public update(deltaTime: number, parentPosition: THREE.Vector3 = new THREE.Vector3()): void {
        this.time += deltaTime;

        // 使用简单的三角函数计算轨道位置
        // 基于可视化数据中的速度系数
        const angle = this.time * this.params.speed * 0.5; // 0.5是基础速度倍率

        // 先计算赤道平面上的位置
        const pos = new THREE.Vector3(
            Math.cos(angle) * this.params.orbit,
            0,
            Math.sin(angle) * this.params.orbit
        );

        // 绕x轴旋转，应用倾角
        const rotatedPos = pos.applyAxisAngle(new THREE.Vector3(1, 0, 0), this.params.inclination);

        // 更新卫星位置（相对于父行星）
        this.mesh.position.copy(rotatedPos).add(parentPosition);
    }

    /**
     * 选择/取消选择卫星
     */
    public setSelected(selected: boolean): void {
        this.isSelected = selected;
        this.mesh.material = selected ? this.selectedMaterial : this.normalMaterial;
    }

    /**
     * 检查点是否与卫星相交
     */
    public intersects(raycaster: THREE.Raycaster): boolean {
        const intersects = raycaster.intersectObject(this.mesh);
        return intersects.length > 0;
    }

    /**
     * 获取卫星名称
     */
    public getName(): string {
        return this.params.name;
    }

    /**
     * 获取卫星的3D模型
     */
    public getMesh(): THREE.Mesh {
        return this.mesh;
    }

    /**
     * 获取卫星的轨道线
     */
    public getOrbitLine(): THREE.Line {
        return this.orbitLine;
    }

    /**
     * 获取卫星参数
     */
    public getParams(): VisualSatelliteParams {
        return this.params;
    }

    /**
     * 获取卫星的当前位置
     */
    public getPosition(): THREE.Vector3 {
        return this.mesh.position.clone();
    }

    /**
     * 设置卫星的不透明度
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
     * 销毁卫星，清理资源
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
