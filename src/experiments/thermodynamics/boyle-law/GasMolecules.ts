import * as THREE from 'three';

export interface GasMoleculeBounds {
  radius: number;
  minY: number;
  maxY: number;
}

interface GasMoleculesOptions {
  count: number;
  maxCount: number;
  bounds: GasMoleculeBounds;
  temperature: number;
  particleRadius?: number;
  color?: number;
}

/**
 * Instanced molecule system used by Boyle's law experiment.
 * Speed magnitude is scaled with sqrt(T).
 */
export class GasMolecules {
  private readonly maxCount: number;
  private readonly particleRadius: number;
  private readonly dummy = new THREE.Object3D();

  private mesh: THREE.InstancedMesh | null;
  private positions: Float32Array;
  private velocities: Float32Array;
  private activeCount = 0;
  private temperature = 300;
  private bounds: GasMoleculeBounds;

  constructor(options: GasMoleculesOptions) {
    this.maxCount = Math.max(1, Math.floor(options.maxCount));
    this.particleRadius = options.particleRadius ?? 0.04;
    this.bounds = {
      radius: Math.max(options.bounds.radius, this.particleRadius * 3),
      minY: options.bounds.minY,
      maxY: Math.max(options.bounds.maxY, options.bounds.minY + this.particleRadius * 3),
    };

    const geometry = new THREE.SphereGeometry(this.particleRadius, 10, 10);
    const material = new THREE.MeshStandardMaterial({
      color: options.color ?? 0x22d3ee,
      roughness: 0.35,
      metalness: 0.1,
      transparent: true,
      opacity: 0.85,
    });

    this.mesh = new THREE.InstancedMesh(geometry, material, this.maxCount);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;

    this.positions = new Float32Array(this.maxCount * 3);
    this.velocities = new Float32Array(this.maxCount * 3);

    this.setCount(options.count);
    this.setTemperature(options.temperature);
  }

  getObject(): THREE.InstancedMesh | null {
    return this.mesh;
  }

  setBounds(bounds: GasMoleculeBounds): void {
    this.bounds = {
      radius: Math.max(bounds.radius, this.particleRadius * 3),
      minY: bounds.minY,
      maxY: Math.max(bounds.maxY, bounds.minY + this.particleRadius * 3),
    };
  }

  setTemperature(temperature: number): void {
    const safeTemperature = THREE.MathUtils.clamp(temperature, 100, 1200);
    const previous = this.temperature;
    this.temperature = safeTemperature;

    if (this.activeCount === 0 || previous <= 0) {
      return;
    }

    const scale = Math.sqrt(this.temperature / previous);
    for (let i = 0; i < this.activeCount; i += 1) {
      const index = i * 3;
      this.velocities[index] *= scale;
      this.velocities[index + 1] *= scale;
      this.velocities[index + 2] *= scale;
    }
  }

  setCount(count: number): void {
    this.activeCount = THREE.MathUtils.clamp(Math.round(count), 0, this.maxCount);
    if (this.mesh) {
      this.mesh.count = this.activeCount;
    }
    this.randomizeState();
  }

  update(deltaTime: number): void {
    if (!this.mesh || this.activeCount === 0) {
      return;
    }

    const dt = THREE.MathUtils.clamp(deltaTime, 0.001, 0.05);
    const maxRadius = Math.max(this.particleRadius * 2, this.bounds.radius - this.particleRadius);
    const minY = this.bounds.minY + this.particleRadius;
    const maxY = Math.max(minY + this.particleRadius * 2, this.bounds.maxY - this.particleRadius);

    for (let i = 0; i < this.activeCount; i += 1) {
      const index = i * 3;
      let x = this.positions[index] + this.velocities[index] * dt;
      let y = this.positions[index + 1] + this.velocities[index + 1] * dt;
      let z = this.positions[index + 2] + this.velocities[index + 2] * dt;
      let vx = this.velocities[index];
      let vy = this.velocities[index + 1];
      let vz = this.velocities[index + 2];

      const radial = Math.hypot(x, z);
      if (radial > maxRadius) {
        const nx = radial > 0 ? x / radial : 1;
        const nz = radial > 0 ? z / radial : 0;
        const dot = vx * nx + vz * nz;
        if (dot > 0) {
          vx -= 2 * dot * nx;
          vz -= 2 * dot * nz;
        }
        x = nx * (maxRadius - 0.001);
        z = nz * (maxRadius - 0.001);
      }

      if (y <= minY) {
        y = minY;
        vy = Math.abs(vy);
      } else if (y >= maxY) {
        y = maxY;
        vy = -Math.abs(vy);
      }

      this.positions[index] = x;
      this.positions[index + 1] = y;
      this.positions[index + 2] = z;
      this.velocities[index] = vx;
      this.velocities[index + 1] = vy;
      this.velocities[index + 2] = vz;

      this.dummy.position.set(x, y, z);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }

    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.mesh = null;
    this.positions = new Float32Array(0);
    this.velocities = new Float32Array(0);
    this.activeCount = 0;
  }

  private randomizeState(): void {
    if (!this.mesh) {
      return;
    }

    const maxRadius = Math.max(this.particleRadius * 2, this.bounds.radius - this.particleRadius);
    const minY = this.bounds.minY + this.particleRadius;
    const maxY = Math.max(minY + this.particleRadius * 2, this.bounds.maxY - this.particleRadius);
    const speed = this.getSpeedForTemperature(this.temperature);

    for (let i = 0; i < this.activeCount; i += 1) {
      const index = i * 3;
      const { x, y, z } = this.randomPointInCylinder(maxRadius, minY, maxY);
      const direction = this.randomUnitVector();

      this.positions[index] = x;
      this.positions[index + 1] = y;
      this.positions[index + 2] = z;
      this.velocities[index] = direction.x * speed;
      this.velocities[index + 1] = direction.y * speed;
      this.velocities[index + 2] = direction.z * speed;

      this.dummy.position.set(x, y, z);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }

    this.mesh.instanceMatrix.needsUpdate = true;
  }

  private getSpeedForTemperature(temperature: number): number {
    const baseSpeed = 1.35;
    return baseSpeed * Math.sqrt(Math.max(temperature, 1) / 300);
  }

  private randomPointInCylinder(radius: number, minY: number, maxY: number): { x: number; y: number; z: number } {
    const theta = Math.random() * Math.PI * 2;
    const radial = Math.sqrt(Math.random()) * radius;

    return {
      x: Math.cos(theta) * radial,
      y: minY + Math.random() * (maxY - minY),
      z: Math.sin(theta) * radial,
    };
  }

  private randomUnitVector(): THREE.Vector3 {
    const theta = Math.random() * Math.PI * 2;
    const u = Math.random() * 2 - 1;
    const xy = Math.sqrt(1 - u * u);
    return new THREE.Vector3(Math.cos(theta) * xy, u, Math.sin(theta) * xy);
  }
}
