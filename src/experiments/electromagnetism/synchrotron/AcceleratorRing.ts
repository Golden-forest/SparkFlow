import * as THREE from 'three';
import { createTextSprite } from './SynchrotronAnnotations';

const COLORS = {
  tube: 0x7dd3fc,
  tubeGlow: 0x22d3ee,
  magnet: 0x2563eb,
  magnetHot: 0xf97316,
  rf: 0xf59e0b,
  detector: 0xe0f2fe,
  floor: 0x0f172a,
} as const;

export class AcceleratorRing {
  readonly group = new THREE.Group();
  readonly radius: number;

  private detectorGlow: THREE.Mesh | null = null;
  private innerPulse: THREE.Object3D | null = null;

  constructor(radius = 4.3) {
    this.radius = radius;
    this.group.name = 'Synchrotron accelerator ring';
    this.createVacuumTube();
    this.createMagnets();
    this.createRfCavities();
    this.createDetector();
    this.createSupports();
    this.createLabels();
  }

  update(elapsedTime: number): void {
    if (this.detectorGlow) {
      const pulse = 0.78 + Math.sin(elapsedTime * 5.4) * 0.18;
      this.detectorGlow.scale.setScalar(pulse);
      const material = this.detectorGlow.material as THREE.MeshBasicMaterial;
      material.opacity = 0.16 + Math.max(0, Math.sin(elapsedTime * 5.4)) * 0.22;
    }

    if (this.innerPulse) {
      this.innerPulse.rotation.y += 0.015;
      this.innerPulse.rotation.z -= 0.009;
    }
  }

  private createVacuumTube(): void {
    const tubeMaterial = new THREE.MeshPhysicalMaterial({
      color: COLORS.tube,
      emissive: COLORS.tubeGlow,
      emissiveIntensity: 0.22,
      metalness: 0.28,
      roughness: 0.18,
      transparent: true,
      opacity: 0.46,
      side: THREE.DoubleSide,
    });

    const tube = new THREE.Mesh(new THREE.TorusGeometry(this.radius, 0.14, 20, 192), tubeMaterial);
    tube.rotation.x = Math.PI / 2;
    tube.name = 'Vacuum beam pipe';
    this.group.add(tube);

    const inner = new THREE.Mesh(
      new THREE.TorusGeometry(this.radius - 0.34, 0.018, 8, 192),
      new THREE.MeshBasicMaterial({
        color: COLORS.tubeGlow,
        transparent: true,
        opacity: 0.45,
        blending: THREE.AdditiveBlending,
      }),
    );
    inner.rotation.x = Math.PI / 2;
    this.group.add(inner);

    const outer = new THREE.Mesh(
      new THREE.TorusGeometry(this.radius + 0.34, 0.018, 8, 192),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.28,
        blending: THREE.AdditiveBlending,
      }),
    );
    outer.rotation.x = Math.PI / 2;
    this.group.add(outer);
  }

  private createMagnets(): void {
    const magnetGeometry = new THREE.BoxGeometry(0.68, 0.52, 0.48);
    const magnetMaterial = new THREE.MeshStandardMaterial({
      color: COLORS.magnet,
      emissive: 0x1d4ed8,
      emissiveIntensity: 0.55,
      metalness: 0.62,
      roughness: 0.28,
    });
    const hotMaterial = new THREE.MeshStandardMaterial({
      color: COLORS.magnetHot,
      emissive: 0xea580c,
      emissiveIntensity: 0.45,
      metalness: 0.48,
      roughness: 0.26,
    });

    for (let index = 0; index < 28; index += 1) {
      const angle = (index / 28) * Math.PI * 2;
      const magnet = new THREE.Mesh(
        magnetGeometry,
        index % 7 === 0 ? hotMaterial : magnetMaterial,
      );
      magnet.position.set(
        Math.cos(angle) * this.radius,
        0,
        Math.sin(angle) * this.radius,
      );
      magnet.rotation.y = -angle - Math.PI / 2;
      magnet.name = index % 7 === 0 ? 'RF-adjacent focusing magnet' : 'Bending magnet';
      this.group.add(magnet);
    }
  }

  private createRfCavities(): void {
    const cavityMaterial = new THREE.MeshStandardMaterial({
      color: COLORS.rf,
      emissive: COLORS.rf,
      emissiveIntensity: 0.72,
      metalness: 0.42,
      roughness: 0.22,
    });
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    for (let index = 0; index < 6; index += 1) {
      const angle = (index / 6) * Math.PI * 2 + Math.PI / 6;
      const cavity = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.62, 0.92), cavityMaterial);
      cavity.position.set(
        Math.cos(angle) * this.radius,
        0.02,
        Math.sin(angle) * this.radius,
      );
      cavity.rotation.y = -angle - Math.PI / 2;
      cavity.name = 'RF accelerating cavity';
      this.group.add(cavity);

      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 18), glowMaterial);
      glow.position.copy(cavity.position);
      glow.scale.set(1.1, 0.62, 0.78);
      this.group.add(glow);
    }
  }

  private createDetector(): void {
    const detectorGroup = new THREE.Group();
    detectorGroup.position.set(this.radius, 0, 0);
    detectorGroup.name = 'Collision detector';

    const detectorMaterial = new THREE.MeshStandardMaterial({
      color: COLORS.detector,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.48,
      metalness: 0.7,
      roughness: 0.18,
    });

    const ringA = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.055, 12, 76), detectorMaterial);
    ringA.rotation.y = Math.PI / 2;
    detectorGroup.add(ringA);

    const ringB = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.045, 12, 76), detectorMaterial);
    ringB.rotation.x = Math.PI / 2;
    detectorGroup.add(ringB);

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 24, 24),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 1.1,
      }),
    );
    detectorGroup.add(core);

    this.detectorGlow = new THREE.Mesh(
      new THREE.SphereGeometry(0.88, 24, 24),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    detectorGroup.add(this.detectorGlow);
    this.group.add(detectorGroup);

    this.innerPulse = detectorGroup;
  }

  private createSupports(): void {
    const grid = new THREE.GridHelper(12, 28, 0x1e3a5f, 0x172554);
    grid.position.y = -0.64;
    this.group.add(grid);

    const floor = new THREE.Mesh(
      new THREE.RingGeometry(this.radius - 1.1, this.radius + 1.1, 160),
      new THREE.MeshBasicMaterial({
        color: COLORS.floor,
        transparent: true,
        opacity: 0.34,
        side: THREE.DoubleSide,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.66;
    this.group.add(floor);
  }

  private createLabels(): void {
    const labels: Array<[string, THREE.Vector3, string]> = [
      ['Vacuum Beam Pipe', new THREE.Vector3(-2.7, 1.05, -3.65), '#BAE6FD'],
      ['Bending Magnets', new THREE.Vector3(-4.85, 0.95, 1.55), '#BFDBFE'],
      ['RF Cavities', new THREE.Vector3(1.1, 1.16, -4.9), '#FED7AA'],
      ['Collision Point', new THREE.Vector3(5.35, 1.25, 0.1), '#F8FAFC'],
    ];

    labels.forEach(([text, position, color]) => {
      const label = createTextSprite(text, { color, scale: 0.0072 });
      label.position.copy(position);
      this.group.add(label);
    });
  }
}
