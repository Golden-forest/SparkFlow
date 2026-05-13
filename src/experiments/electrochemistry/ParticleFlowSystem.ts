import * as THREE from 'three';

/**
 * ParticleFlowSystem - Manages animated particles along predefined paths
 *
 * Uses InstancedMesh for efficient rendering of electrons, cations, and anions.
 * Particles follow spline curves and loop continuously.
 * Each particle has a glowing core + soft outer halo via additive blending.
 */

/** Dopamine palette colors */
const COLORS = {
    electron: new THREE.Color('#00FF41'),   // Green
    cation: new THREE.Color('#FFD166'),     // Yellow-Gold
    anion: new THREE.Color('#38BDF8'),      // Sky Blue
} as const;

const CORE_RADIUS = 0.045;
const HALO_RADIUS = 0.12;
const SEGMENTS = 8;

export type ParticleType = 'electron' | 'cation' | 'anion';

interface ParticlePath {
    curve: THREE.CatmullRomCurve3;
    type: ParticleType;
    count: number;
    /** Each particle's progress along the curve [0, 1) */
    offsets: number[];
}

export class ParticleFlowSystem {
    private paths: ParticlePath[] = [];
    /** Core meshes - bright solid spheres */
    private coreMeshes: Map<ParticleType, THREE.InstancedMesh> = new Map();
    /** Halo meshes - soft glow around each particle */
    private haloMeshes: Map<ParticleType, THREE.InstancedMesh> = new Map();
    private speed: number = 1.0;
    private direction: number = 1; // 1 = forward, -1 = reverse
    private scene: THREE.Scene | null = null;

    /** Temporary objects reused each frame to avoid GC pressure */
    private readonly _matrix = new THREE.Matrix4();
    private readonly _position = new THREE.Vector3();
    private readonly _quaternion = new THREE.Quaternion();
    private readonly _scale = new THREE.Vector3(1, 1, 1);

    /**
     * Initialize the particle system with paths and create InstancedMeshes
     */
    init(
        scene: THREE.Scene,
        wirePath: THREE.Vector3[],
        solutionPaths: { cation: THREE.Vector3[]; anion: THREE.Vector3[] },
        electronCount: number = 12,
        cationCount: number = 8,
        anionCount: number = 6,
    ): void {
        this.scene = scene;

        // Create wire path for electrons
        const electronCurve = new THREE.CatmullRomCurve3(wirePath, false, 'catmullrom', 0.5);
        const electronOffsets = this.createDistributedOffsets(electronCount);
        this.paths.push({ curve: electronCurve, type: 'electron', count: electronCount, offsets: electronOffsets });

        // Create solution paths for ions
        const cationCurve = new THREE.CatmullRomCurve3(solutionPaths.cation, false, 'catmullrom', 0.5);
        const cationOffsets = this.createDistributedOffsets(cationCount);
        this.paths.push({ curve: cationCurve, type: 'cation', count: cationCount, offsets: cationOffsets });

        const anionCurve = new THREE.CatmullRomCurve3(solutionPaths.anion, false, 'catmullrom', 0.5);
        const anionOffsets = this.createDistributedOffsets(anionCount);
        this.paths.push({ curve: anionCurve, type: 'anion', count: anionCount, offsets: anionOffsets });

        // Create glowing particle meshes for each type
        this.createGlowMesh('electron', electronCount, COLORS.electron);
        this.createGlowMesh('cation', cationCount, COLORS.cation);
        this.createGlowMesh('anion', anionCount, COLORS.anion);
    }

    /**
     * Create evenly distributed starting offsets [0, 1)
     */
    private createDistributedOffsets(count: number): number[] {
        const offsets: number[] = [];
        for (let i = 0; i < count; i++) {
            offsets.push(i / count);
        }
        return offsets;
    }

    /**
     * Create core + halo InstancedMesh pair for a particle type
     */
    private createGlowMesh(type: ParticleType, count: number, color: THREE.Color): void {
        if (!this.scene) return;

        // Core - bright solid sphere
        const coreGeom = new THREE.SphereGeometry(CORE_RADIUS, SEGMENTS, SEGMENTS);
        const coreMat = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 1.0,
        });
        const coreMesh = new THREE.InstancedMesh(coreGeom, coreMat, count);
        coreMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        for (let i = 0; i < count; i++) {
            coreMesh.setMatrixAt(i, this._matrix.identity());
        }
        coreMesh.instanceMatrix.needsUpdate = true;
        this.scene.add(coreMesh);
        this.coreMeshes.set(type, coreMesh);

        // Halo - soft additive-blended glow sphere
        const haloGeom = new THREE.SphereGeometry(HALO_RADIUS, SEGMENTS, SEGMENTS);
        const haloMat = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.35,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });
        const haloMesh = new THREE.InstancedMesh(haloGeom, haloMat, count);
        haloMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        for (let i = 0; i < count; i++) {
            haloMesh.setMatrixAt(i, this._matrix.identity());
        }
        haloMesh.instanceMatrix.needsUpdate = true;
        this.scene.add(haloMesh);
        this.haloMeshes.set(type, haloMesh);
    }

    /**
     * Update particle positions each frame
     * @param deltaTime - Time since last frame (seconds)
     * @param currentMagnitude - Current magnitude (affects speed), 0 to ~1
     */
    update(deltaTime: number, currentMagnitude: number = 1.0): void {
        const baseSpeed = 0.4; // Traverse 40% of path per second (was 15%)

        for (const path of this.paths) {
            const coreMesh = this.coreMeshes.get(path.type);
            const haloMesh = this.haloMeshes.get(path.type);
            if (!coreMesh || !haloMesh) continue;

            for (let i = 0; i < path.count; i++) {
                // Advance offset along curve
                path.offsets[i] += baseSpeed * currentMagnitude * this.speed * this.direction * deltaTime;

                // Wrap around [0, 1)
                if (path.offsets[i] > 1) path.offsets[i] -= 1;
                if (path.offsets[i] < 0) path.offsets[i] += 1;

                // Get position on curve
                const point = path.curve.getPoint(path.offsets[i]);
                this._position.copy(point);

                this._matrix.compose(this._position, this._quaternion, this._scale);
                coreMesh.setMatrixAt(i, this._matrix);
                haloMesh.setMatrixAt(i, this._matrix);
            }
            coreMesh.instanceMatrix.needsUpdate = true;
            haloMesh.instanceMatrix.needsUpdate = true;
        }
    }

    /**
     * Set particle speed multiplier
     */
    setSpeed(speed: number): void {
        this.speed = Math.max(0, speed);
    }

    /**
     * Set direction: 1 for forward (galvanic), -1 for reverse (electrolytic)
     */
    setDirection(direction: number): void {
        this.direction = direction >= 0 ? 1 : -1;
    }

    /**
     * Toggle visibility of all particles
     */
    setVisible(visible: boolean): void {
        for (const mesh of this.coreMeshes.values()) {
            mesh.visible = visible;
        }
        for (const mesh of this.haloMeshes.values()) {
            mesh.visible = visible;
        }
    }

    /**
     * Dispose all resources
     */
    dispose(): void {
        for (const mesh of this.coreMeshes.values()) {
            this.scene?.remove(mesh);
            mesh.geometry.dispose();
            if (mesh.material instanceof THREE.Material) {
                mesh.material.dispose();
            }
        }
        for (const mesh of this.haloMeshes.values()) {
            this.scene?.remove(mesh);
            mesh.geometry.dispose();
            if (mesh.material instanceof THREE.Material) {
                mesh.material.dispose();
            }
        }
        this.coreMeshes.clear();
        this.haloMeshes.clear();
        this.paths = [];
        this.scene = null;
    }
}
