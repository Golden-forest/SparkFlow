import * as THREE from 'three';

const PARTICLE_COUNT = 42;
const TRAIL_POINTS = 88;

interface BeamObject {
  root: THREE.Group;
  phaseOffset: number;
  sign: 1 | -1;
  yOffset: number;
}

export class ParticleBeamSystem {
  readonly group = new THREE.Group();

  private readonly radius: number;
  private phase = 0;
  private elapsedTime = 0;
  private beams: BeamObject[] = [];
  private blueTrailGeometry = new THREE.BufferGeometry();
  private orangeTrailGeometry = new THREE.BufferGeometry();
  private collisionPulse: THREE.Mesh;

  constructor(radius: number) {
    this.radius = radius;
    this.group.name = 'Counter-rotating particle beams';
    this.createBeams();
    this.createTrails();
    this.collisionPulse = this.createCollisionPulse();
  }

  reset(): void {
    this.phase = 0;
    this.elapsedTime = 0;
    this.update(0, 1.8);
  }

  update(deltaTime: number, speed: number): void {
    this.elapsedTime += deltaTime;
    const angularSpeed = THREE.MathUtils.clamp(0.42 + speed * 0.34, 0.3, 2.2);
    this.phase += deltaTime * angularSpeed;

    this.beams.forEach((beam) => {
      const angle = beam.phaseOffset + this.phase * beam.sign;
      beam.root.position.set(
        Math.cos(angle) * this.radius,
        beam.yOffset,
        Math.sin(angle) * this.radius,
      );
      beam.root.rotation.y = -angle;
      const scalePulse = 0.86 + Math.sin(this.elapsedTime * 8 + beam.phaseOffset) * 0.1;
      beam.root.scale.setScalar(scalePulse);
    });

    this.updateTrail(this.blueTrailGeometry, this.phase, 1, 0.08);
    this.updateTrail(this.orangeTrailGeometry, -this.phase + Math.PI, -1, -0.08);

    const pulse = Math.max(0, Math.sin(this.elapsedTime * 7.5));
    this.collisionPulse.scale.setScalar(0.52 + pulse * 0.72);
    const pulseMaterial = this.collisionPulse.material as THREE.MeshBasicMaterial;
    pulseMaterial.opacity = 0.08 + pulse * 0.24;
  }

  private createBeams(): void {
    const blueCore = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const orangeCore = new THREE.MeshBasicMaterial({ color: 0xfb923c });
    const blueGlow = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.24,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const orangeGlow = new THREE.MeshBasicMaterial({
      color: 0xf97316,
      transparent: true,
      opacity: 0.25,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    for (let index = 0; index < PARTICLE_COUNT; index += 1) {
      const phaseOffset = (index / PARTICLE_COUNT) * Math.PI * 2;
      this.addParticle(phaseOffset, 1, 0.08, blueCore, blueGlow);
      this.addParticle(phaseOffset + Math.PI, -1, -0.08, orangeCore, orangeGlow);
    }
  }

  private addParticle(
    phaseOffset: number,
    sign: 1 | -1,
    yOffset: number,
    coreMaterial: THREE.Material,
    glowMaterial: THREE.Material,
  ): void {
    const particle = new THREE.Group();
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 12), coreMaterial);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 14), glowMaterial);
    particle.add(glow);
    particle.add(core);
    this.group.add(particle);
    this.beams.push({ root: particle, phaseOffset, sign, yOffset });
  }

  private createTrails(): void {
    this.blueTrailGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(TRAIL_POINTS * 3), 3),
    );
    this.orangeTrailGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(TRAIL_POINTS * 3), 3),
    );

    const blueTrail = new THREE.Line(
      this.blueTrailGeometry,
      new THREE.LineBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
      }),
    );
    const orangeTrail = new THREE.Line(
      this.orangeTrailGeometry,
      new THREE.LineBasicMaterial({
        color: 0xfb923c,
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
      }),
    );

    this.group.add(blueTrail);
    this.group.add(orangeTrail);
  }

  private createCollisionPulse(): THREE.Mesh {
    const pulse = new THREE.Mesh(
      new THREE.SphereGeometry(0.52, 24, 24),
      new THREE.MeshBasicMaterial({
        color: 0xf8fafc,
        transparent: true,
        opacity: 0.12,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    pulse.position.set(this.radius, 0, 0);
    pulse.name = 'Collision pulse';
    this.group.add(pulse);
    return pulse;
  }

  private updateTrail(
    geometry: THREE.BufferGeometry,
    leadPhase: number,
    sign: 1 | -1,
    yOffset: number,
  ): void {
    const position = geometry.getAttribute('position') as THREE.BufferAttribute;
    const array = position.array as Float32Array;

    for (let index = 0; index < TRAIL_POINTS; index += 1) {
      const fade = index / (TRAIL_POINTS - 1);
      const angle = leadPhase - sign * fade * 1.35;
      array[index * 3] = Math.cos(angle) * this.radius;
      array[index * 3 + 1] = yOffset;
      array[index * 3 + 2] = Math.sin(angle) * this.radius;
    }

    position.needsUpdate = true;
    geometry.computeBoundingSphere();
  }
}
