import * as THREE from 'three';
import { createTextSprite } from './SynchrotronAnnotations';
import {
  DESIGN_ORBIT_RADIUS,
  createMicroState,
  getDesignOrbitPosition,
  getDesignOrbitVelocity,
  getMicroVectorHints,
  getPrimaryMetrics,
  isGuidedOrbitMechanism,
  stepMicroState,
  type MicroParticleState,
  type SynchrotronMicroSettings,
  type SynchrotronMicroState,
} from './SynchrotronMicroPhysics';

interface MicroViewSettings extends SynchrotronMicroSettings {
  showVectors: boolean;
  showLabels: boolean;
}

interface RenderedParticle {
  group: THREE.Group;
  glow: THREE.Mesh;
  trail: THREE.Line;
  trailPositions: Float32Array;
}

interface Fragment {
  line: THREE.Line;
  origin: THREE.Vector3;
  velocity: THREE.Vector3;
  age: number;
  duration: number;
}

interface Shockwave {
  mesh: THREE.Mesh;
  age: number;
  duration: number;
  maxScale: number;
}

interface EnergyCloud {
  points: THREE.Points;
  velocities: Float32Array;
  origin: THREE.Vector3;
  age: number;
  duration: number;
}

const TRAIL_POINTS = 220;

export class SynchrotronMicroMechanismView {
  readonly group = new THREE.Group();

  private settings: MicroViewSettings;
  private state: SynchrotronMicroState;
  private straightGuideGroup = new THREE.Group();
  private rfGroup = new THREE.Group();
  private bendingGroup = new THREE.Group();
  private syncGroup = new THREE.Group();
  private collisionGroup = new THREE.Group();
  private particleLayer = new THREE.Group();
  private vectorLayer = new THREE.Group();
  private effectLayer = new THREE.Group();
  private particles = new Map<string, RenderedParticle>();
  private rfEArrows: THREE.ArrowHelper[] = [];
  private syncEArrows: THREE.ArrowHelper[] = [];
  private bArrows: THREE.ArrowHelper[] = [];
  private velocityArrow: THREE.ArrowHelper;
  private electricArrow: THREE.ArrowHelper;
  private magneticArrow: THREE.ArrowHelper;
  private forceArrow: THREE.ArrowHelper;
  private collisionFlash: THREE.Mesh | null = null;
  private fragments: Fragment[] = [];
  private shockwaves: Shockwave[] = [];
  private energyClouds: EnergyCloud[] = [];
  private labelSprites: THREE.Sprite[] = [];
  private elapsedTime = 0;

  constructor(settings: MicroViewSettings) {
    this.settings = { ...settings };
    this.state = createMicroState(settings);
    this.group.name = 'Synchrotron microscopic mechanism view';

    this.createStage();
    this.createRfVisuals();
    this.createBendingVisuals();
    this.createCollisionVisuals();

    this.velocityArrow = this.createArrow(0x34d399);
    this.electricArrow = this.createArrow(0xf97316);
    this.magneticArrow = this.createArrow(0x38bdf8);
    this.forceArrow = this.createArrow(0xfacc15);
    this.vectorLayer.add(this.velocityArrow, this.electricArrow, this.magneticArrow, this.forceArrow);

    this.group.add(
      this.straightGuideGroup,
      this.rfGroup,
      this.bendingGroup,
      this.syncGroup,
      this.collisionGroup,
      this.particleLayer,
      this.vectorLayer,
      this.effectLayer,
    );
    this.applyModeVisibility();
    this.updateLabels();
    this.update(0);
  }

  setParameters(settings: MicroViewSettings): void {
    const mechanismChanged = settings.mechanism !== this.settings.mechanism;
    const resetRequired =
      mechanismChanged ||
      Math.abs(settings.charge - this.settings.charge) > 0.001 ||
      Math.abs(settings.mass - this.settings.mass) > 0.001 ||
      Math.abs(settings.initialSpeed - this.settings.initialSpeed) > 0.001;

    this.settings = { ...settings };

    if (resetRequired) {
      this.reset();
      return;
    }

    this.applyModeVisibility();
    this.updateLabels();
    this.updateStaticFields();
    this.updateVectors();
  }

  reset(): void {
    this.state = createMicroState(this.settings);
    this.elapsedTime = 0;
    this.fragments.forEach((fragment) => this.effectLayer.remove(fragment.line));
    this.fragments = [];
    this.shockwaves.forEach((shockwave) => this.effectLayer.remove(shockwave.mesh));
    this.shockwaves = [];
    this.energyClouds.forEach((cloud) => this.effectLayer.remove(cloud.points));
    this.energyClouds = [];
    if (this.collisionFlash) {
      this.effectLayer.remove(this.collisionFlash);
      this.collisionFlash = null;
    }
    this.clearTrails();
    this.applyModeVisibility();
    this.updateLabels();
    this.update(0);
  }

  clearTrails(): void {
    this.state.particles = this.state.particles.map((particle) => ({
      ...particle,
      trajectory: [particle.position.clone()],
    }));
    this.particles.forEach((particle) => {
      particle.trailPositions.fill(0);
      particle.trail.geometry.setDrawRange(0, 0);
      const position = particle.trail.geometry.getAttribute('position') as THREE.BufferAttribute;
      position.needsUpdate = true;
    });
  }

  update(deltaTime: number): void {
    this.elapsedTime += deltaTime;

    if (deltaTime > 0) {
      const steps = Math.max(1, Math.ceil(deltaTime / (1 / 90)));
      const stepDelta = deltaTime / steps;
      for (let index = 0; index < steps; index += 1) {
        const beforeCollision = this.state.collision.hasCollided;
        this.state = stepMicroState(this.state, this.settings, stepDelta);
        if (!beforeCollision && this.state.collision.hasCollided) {
          this.triggerCollisionEffect();
        }
      }

      if (this.shouldRecycle()) {
        this.reset();
        return;
      }
    }

    this.updateStaticFields();
    this.updateParticles();
    this.updateVectors();
    this.updateCollisionEffects(deltaTime);
  }

  getDisplayData() {
    const primary = this.state.particles.find((particle) => particle.active) ?? this.state.particles[0];
    const hints = primary ? getMicroVectorHints(this.settings, primary) : null;
    const force = hints?.lorentzForce ?? new THREE.Vector3();

    return {
      ...getPrimaryMetrics(this.state),
      forceMagnitude: force.length(),
      collisionAge: this.state.collision.age,
      collisionEnergy: this.state.collision.energy,
    };
  }

  private createStage(): void {
    this.straightGuideGroup.name = 'Straight microscopic beam pipe';

    const tube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.34, 6.8, 32, 1, true),
      new THREE.MeshPhysicalMaterial({
        color: 0x7dd3fc,
        transparent: true,
        opacity: 0.18,
        roughness: 0.1,
        metalness: 0.1,
        side: THREE.DoubleSide,
      }),
    );
    tube.rotation.z = Math.PI / 2;
    tube.name = 'Transparent vacuum beam pipe';
    this.straightGuideGroup.add(tube);

    const axis = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-3.4, 0, 0), new THREE.Vector3(3.4, 0, 0)]),
      new THREE.LineBasicMaterial({
        color: 0x7dd3fc,
        transparent: true,
        opacity: 0.32,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.straightGuideGroup.add(axis);

    const grid = new THREE.GridHelper(7.6, 18, 0x164e63, 0x1e293b);
    grid.position.y = -0.62;
    this.group.add(grid);
  }

  private createRfVisuals(): void {
    this.rfGroup.name = 'RF accelerating cavity mechanism';
    [-2.25, -0.75, 0.75, 2.25].forEach((x, index) => {
      const cavity = new THREE.Mesh(
        new THREE.TorusGeometry(0.5, 0.045, 10, 48),
        new THREE.MeshStandardMaterial({
          color: 0xf97316,
          emissive: 0xf97316,
          emissiveIntensity: 0.7,
          metalness: 0.45,
          roughness: 0.22,
        }),
      );
      cavity.position.set(x, 0, 0);
      cavity.rotation.y = Math.PI / 2;
      cavity.name = index % 2 === 0 ? 'RF accelerating gap positive phase' : 'RF accelerating gap negative phase';
      this.rfGroup.add(cavity);
    });

    for (let index = 0; index < 6; index += 1) {
      const arrow = new THREE.ArrowHelper(
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(-2.7 + index * 1.05, 0.72, 0),
        0.62,
        0xf97316,
        0.18,
        0.1,
      );
      this.rfEArrows.push(arrow);
      this.rfGroup.add(arrow);
    }

    const label = createTextSprite('RF Acceleration: electric field increases speed', {
      color: '#FED7AA',
      border: 'rgba(251,146,60,0.65)',
      scale: 0.0065,
    });
    label.position.set(0, 1.55, -1.18);
    this.addLabel(this.rfGroup, label);
  }

  private createBendingVisuals(): void {
    this.bendingGroup.name = 'Circular top-bottom dipole bending mechanism';
    this.syncGroup.name = 'Synchronized RF-on-bend overlay';

    const arcPoints = this.createArcPoints(176);
    const arcCurve = new THREE.CatmullRomCurve3(arcPoints, true, 'centripetal', 0.2);
    const curvedTube = new THREE.Mesh(
      new THREE.TubeGeometry(arcCurve, 176, 0.18, 28, true),
      new THREE.MeshPhysicalMaterial({
        color: 0x7dd3fc,
        transparent: true,
        opacity: 0.2,
        roughness: 0.08,
        metalness: 0.16,
        side: THREE.DoubleSide,
      }),
    );
    curvedTube.name = 'Curved vacuum beam pipe';
    this.bendingGroup.add(curvedTube);

    const orbitLine = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(arcPoints),
      new THREE.LineBasicMaterial({
        color: 0x67e8f9,
        transparent: true,
        opacity: 0.44,
        blending: THREE.AdditiveBlending,
      }),
    );
    orbitLine.name = 'Design orbit centerline';
    this.bendingGroup.add(orbitLine);

    const northPoleMaterial = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      emissive: 0xef4444,
      emissiveIntensity: 0.52,
      metalness: 0.5,
      roughness: 0.25,
      transparent: true,
      opacity: 0.68,
      depthWrite: false,
    });
    const southPoleMaterial = new THREE.MeshStandardMaterial({
      color: 0x2563eb,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.5,
      metalness: 0.58,
      roughness: 0.28,
      transparent: true,
      opacity: 0.66,
      depthWrite: false,
    });

    for (let index = 0; index < 16; index += 1) {
      const progress = index / 16;
      const center = getDesignOrbitPosition(progress);
      const radial = new THREE.Vector3(center.x, 0, center.z).normalize();
      const tangent = getDesignOrbitVelocity(progress, 1).normalize();
      const orientation = new THREE.Matrix4().makeBasis(tangent, new THREE.Vector3(0, 1, 0), radial);

      const northPole = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.24, 0.9), northPoleMaterial);
      northPole.position.copy(center).add(new THREE.Vector3(0, 0.58, 0));
      northPole.quaternion.setFromRotationMatrix(orientation);
      northPole.name = 'North pole above beam pipe';
      this.bendingGroup.add(northPole);
      const northOutline = new THREE.LineSegments(
        new THREE.EdgesGeometry(northPole.geometry),
        new THREE.LineBasicMaterial({
          color: 0xfca5a5,
          transparent: true,
          opacity: 0.52,
          blending: THREE.AdditiveBlending,
        }),
      );
      northOutline.position.copy(northPole.position);
      northOutline.quaternion.copy(northPole.quaternion);
      this.bendingGroup.add(northOutline);

      const southPole = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.24, 0.9), southPoleMaterial);
      southPole.position.copy(center).add(new THREE.Vector3(0, -0.5, 0));
      southPole.quaternion.setFromRotationMatrix(orientation);
      southPole.name = 'South pole below beam pipe';
      this.bendingGroup.add(southPole);
      const southOutline = new THREE.LineSegments(
        new THREE.EdgesGeometry(southPole.geometry),
        new THREE.LineBasicMaterial({
          color: 0x7dd3fc,
          transparent: true,
          opacity: 0.5,
          blending: THREE.AdditiveBlending,
        }),
      );
      southOutline.position.copy(southPole.position);
      southOutline.quaternion.copy(southPole.quaternion);
      this.bendingGroup.add(southOutline);

      if (index % 4 === 0) {
        const northLabel = createTextSprite('N', {
          color: '#FECACA',
          border: 'rgba(248,113,113,0.46)',
          scale: 0.0048,
        });
        northLabel.position.copy(center).add(new THREE.Vector3(0, 0.92, 0));
        this.addLabel(this.bendingGroup, northLabel);

        const southLabel = createTextSprite('S', {
          color: '#BAE6FD',
          border: 'rgba(56,189,248,0.42)',
          scale: 0.0048,
        });
        southLabel.position.copy(center).add(new THREE.Vector3(0, -0.82, 0));
        this.addLabel(this.bendingGroup, southLabel);
      }
    }

    for (let index = 0; index < 18; index += 1) {
      const progress = index / 18;
      const center = getDesignOrbitPosition(progress);
      const arrow = new THREE.ArrowHelper(
        new THREE.Vector3(0, -1, 0),
        center.clone().add(new THREE.Vector3(0, 0.66, 0)),
        0.92,
        0x38bdf8,
        0.18,
        0.1,
      );
      arrow.userData.progress = progress;
      this.bArrows.push(arrow);
      this.bendingGroup.add(arrow);
    }

    [0.08, 0.2, 0.34, 0.5, 0.66, 0.82].forEach((progress, index) => {
      const center = getDesignOrbitPosition(progress);
      const tangent = getDesignOrbitVelocity(progress, 1).normalize();
      const cavity = new THREE.Mesh(
        new THREE.TorusGeometry(0.28, 0.035, 10, 48),
        new THREE.MeshStandardMaterial({
          color: 0xf97316,
          emissive: 0xf97316,
          emissiveIntensity: 0.7,
          metalness: 0.48,
          roughness: 0.22,
        }),
      );
      cavity.position.copy(center);
      cavity.position.y += 0.02;
      cavity.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
      cavity.name = `Synchronized RF phase marker ${index + 1}`;
      this.syncGroup.add(cavity);

      const eArrow = new THREE.ArrowHelper(
        tangent,
        center.clone().add(new THREE.Vector3(0, 0.52, 0)),
        0.52,
        0xf97316,
        0.16,
        0.09,
      );
      eArrow.userData.progress = progress;
      this.syncEArrows.push(eArrow);
      this.syncGroup.add(eArrow);
    });

    const radiusGhost = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(this.createArcPoints(96).map((point) => point.clone().setY(-0.04))),
      new THREE.LineDashedMaterial({
        color: 0x94a3b8,
        transparent: true,
        opacity: 0.36,
        dashSize: 0.12,
        gapSize: 0.08,
      }),
    );
    radiusGhost.computeLineDistances();
    radiusGhost.name = 'Full design radius reference';
    this.bendingGroup.add(radiusGhost);

    const radialReference = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, -0.04, 0),
        new THREE.Vector3(0, -0.04, DESIGN_ORBIT_RADIUS),
      ]),
      new THREE.LineDashedMaterial({
        color: 0x94a3b8,
        transparent: true,
        opacity: 0.4,
        dashSize: 0.12,
        gapSize: 0.08,
      }),
    );
    radialReference.computeLineDistances();
    radialReference.name = 'Design radius marker';
    this.bendingGroup.add(radialReference);

    const bendingLabel = createTextSprite('Magnetic Bending: top N pole to bottom S pole gives downward B', {
      color: '#BAE6FD',
      border: 'rgba(56,189,248,0.65)',
      scale: 0.0057,
    });
    bendingLabel.position.set(0, 1.55, DESIGN_ORBIT_RADIUS + 0.42);
    this.addLabel(this.bendingGroup, bendingLabel);

    const syncLabel = createTextSprite('Synchronized Orbit: slow injection, RF ramp, tuned B radius lock', {
      color: '#FED7AA',
      border: 'rgba(251,146,60,0.65)',
      scale: 0.0058,
    });
    syncLabel.position.set(0, 1.2, DESIGN_ORBIT_RADIUS + 0.42);
    this.addLabel(this.syncGroup, syncLabel);

    ['v', 'B', 'F'].forEach((symbol, index) => {
      const tag = createTextSprite(symbol, {
        color: index === 0 ? '#BBF7D0' : index === 1 ? '#BAE6FD' : '#FEF08A',
        border: 'rgba(148,163,184,0.38)',
        scale: 0.005,
      });
      tag.position.set(-2.7 + index * 0.36, 1.03, DESIGN_ORBIT_RADIUS + 0.18);
      this.addLabel(this.bendingGroup, tag);
    });

    const eTag = createTextSprite('E', {
      color: '#FED7AA',
      border: 'rgba(251,146,60,0.44)',
      scale: 0.005,
    });
    eTag.position.set(1.14, 1.03, DESIGN_ORBIT_RADIUS + 0.18);
    this.addLabel(this.syncGroup, eTag);
  }

  private createCollisionVisuals(): void {
    this.collisionGroup.name = 'Collision point mechanism';
    const detectorMaterial = new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.6,
      metalness: 0.62,
      roughness: 0.18,
    });

    const ringA = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.04, 10, 72), detectorMaterial);
    ringA.rotation.y = Math.PI / 2;
    const ringB = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.03, 10, 72), detectorMaterial);
    ringB.rotation.x = Math.PI / 2;
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 24, 24),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.92,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.collisionGroup.add(ringA, ringB, core);

    const label = createTextSprite('Collision Point: counter-running beams meet here', {
      color: '#F8FAFC',
      border: 'rgba(248,250,252,0.62)',
      scale: 0.0062,
    });
    label.position.set(0, 1.48, -1.16);
    this.addLabel(this.collisionGroup, label);

    const note = createTextSprite('collision visualization', {
      color: '#CBD5E1',
      border: 'rgba(148,163,184,0.42)',
      scale: 0.0055,
    });
    note.position.set(0, -0.28, 1.2);
    this.addLabel(this.collisionGroup, note);
  }

  private updateStaticFields(): void {
    const eStrength = Math.abs(this.settings.electricFieldStrength);
    const eDirection = Math.sign(this.settings.electricFieldStrength || 1);

    this.rfEArrows.forEach((arrow, index) => {
      const pulse = 0.7 + Math.sin(this.elapsedTime * 7 + index * 0.6) * 0.18;
      arrow.setDirection(new THREE.Vector3(eDirection, 0, 0));
      arrow.setLength(0.42 + eStrength * 0.16 * pulse, 0.18, 0.1);
      arrow.visible = this.settings.mechanism === 'rf';
    });

    this.syncEArrows.forEach((arrow, index) => {
      const progress = Number(arrow.userData.progress ?? 0);
      const pulse = 0.78 + Math.sin(this.elapsedTime * 8.5 + index * 0.72) * 0.18;
      const tangent = getDesignOrbitVelocity(progress, 1).normalize().multiplyScalar(eDirection);
      arrow.setDirection(tangent);
      arrow.setLength(0.34 + eStrength * 0.14 * pulse, 0.16, 0.09);
      arrow.visible = this.settings.mechanism === 'synchronized';
    });

    const bStrength = Math.abs(this.settings.magneticFieldStrength);
    const magneticDirection = new THREE.Vector3(0, -1, 0);
    const primarySpeed = this.state.particles[0]?.velocity.length() ?? Math.abs(this.settings.initialSpeed);
    const guidedBScale = bStrength + primarySpeed * 0.28;
    this.bArrows.forEach((arrow) => {
      arrow.setDirection(magneticDirection);
      arrow.setLength(0.48 + guidedBScale * 0.12, 0.18, 0.1);
      arrow.visible = isGuidedOrbitMechanism(this.settings.mechanism);
    });
  }

  private updateParticles(): void {
    const activeIds = new Set(this.state.particles.map((particle) => particle.id));
    Array.from(this.particles.keys()).forEach((id) => {
      if (!activeIds.has(id)) {
        const rendered = this.particles.get(id);
        if (rendered) {
          this.particleLayer.remove(rendered.group, rendered.trail);
        }
        this.particles.delete(id);
      }
    });

    this.state.particles.forEach((particle) => {
      const rendered = this.ensureParticle(particle);
      rendered.group.visible = particle.active;
      rendered.group.position.copy(particle.position);
      rendered.glow.scale.setScalar(1 + Math.sin(this.elapsedTime * 8 + particle.position.x) * 0.08);
      this.updateTrail(rendered, particle);
    });
  }

  private ensureParticle(particle: MicroParticleState): RenderedParticle {
    const existing = this.particles.get(particle.id);
    if (existing) {
      return existing;
    }

    const group = new THREE.Group();
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 24, 24),
      new THREE.MeshBasicMaterial({
        color: particle.color,
        transparent: true,
        opacity: 0.25,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.105, 24, 24),
      new THREE.MeshStandardMaterial({
        color: particle.color,
        emissive: particle.color,
        emissiveIntensity: 1.4,
      }),
    );
    group.add(glow, core);

    const trailPositions = new Float32Array(TRAIL_POINTS * 3);
    const trailGeometry = new THREE.BufferGeometry();
    trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
    trailGeometry.setDrawRange(0, 0);
    const trail = new THREE.Line(
      trailGeometry,
      new THREE.LineBasicMaterial({
        color: particle.color,
        transparent: true,
        opacity: 0.82,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );

    this.particleLayer.add(trail, group);
    const rendered = { group, glow, trail, trailPositions };
    this.particles.set(particle.id, rendered);
    return rendered;
  }

  private updateTrail(rendered: RenderedParticle, particle: MicroParticleState): void {
    const points = particle.trajectory.slice(-TRAIL_POINTS);
    rendered.trailPositions.fill(0);
    points.forEach((point, index) => {
      rendered.trailPositions[index * 3] = point.x;
      rendered.trailPositions[index * 3 + 1] = point.y;
      rendered.trailPositions[index * 3 + 2] = point.z;
    });
    const position = rendered.trail.geometry.getAttribute('position') as THREE.BufferAttribute;
    position.needsUpdate = true;
    rendered.trail.geometry.setDrawRange(0, points.length);
    rendered.trail.geometry.computeBoundingSphere();
  }

  private updateVectors(): void {
    const primary = this.state.particles.find((particle) => particle.active) ?? this.state.particles[0];
    this.vectorLayer.visible = this.settings.showVectors && Boolean(primary);
    if (!primary || !this.vectorLayer.visible) return;

    const hints = getMicroVectorHints(this.settings, primary);
    this.setVector(this.velocityArrow, primary.position.clone().add(new THREE.Vector3(0, 0.35, 0)), hints.velocity, 1.1);
    this.setVector(this.electricArrow, primary.position.clone().add(new THREE.Vector3(-0.12, 0.68, -0.2)), hints.electricField, 0.95);
    this.setVector(this.magneticArrow, primary.position.clone().add(new THREE.Vector3(0.26, 0.52, 0.22)), hints.magneticField, 0.95);
    this.setVector(this.forceArrow, primary.position.clone().add(new THREE.Vector3(0, 0.85, 0)), hints.lorentzForce, 1.1);
  }

  private createArrow(color: number): THREE.ArrowHelper {
    return new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 0.8, color, 0.18, 0.1);
  }

  private setVector(arrow: THREE.ArrowHelper, origin: THREE.Vector3, vector: THREE.Vector3, maxLength: number): void {
    const visible = vector.lengthSq() > 0.0001;
    arrow.visible = visible;
    if (!visible) return;
    arrow.position.copy(origin);
    arrow.setDirection(vector.clone().normalize());
    arrow.setLength(THREE.MathUtils.clamp(vector.length() * 0.34, 0.32, maxLength), 0.18, 0.1);
  }

  private triggerCollisionEffect(): void {
    const point = this.state.collision.point;
    this.collisionFlash = new THREE.Mesh(
      new THREE.SphereGeometry(0.44, 32, 32),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.collisionFlash.position.copy(point);
    this.effectLayer.add(this.collisionFlash);

    const shockwaveRotations = [
      new THREE.Euler(Math.PI / 2, 0, 0),
      new THREE.Euler(0, Math.PI / 2, 0),
      new THREE.Euler(Math.PI / 2, Math.PI / 4, 0),
    ];
    shockwaveRotations.forEach((rotation, index) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.26 + index * 0.06, 0.018, 8, 96),
        new THREE.MeshBasicMaterial({
          color: index === 1 ? 0xfb923c : 0x38bdf8,
          transparent: true,
          opacity: 0.82,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      ring.position.copy(point);
      ring.rotation.copy(rotation);
      this.effectLayer.add(ring);
      this.shockwaves.push({
        mesh: ring,
        age: 0,
        duration: 0.86 + index * 0.12,
        maxScale: 4.8 + index * 1.1,
      });
    });

    const cloudCount = 96;
    const cloudPositions = new Float32Array(cloudCount * 3);
    const cloudColors = new Float32Array(cloudCount * 3);
    const cloudVelocities = new Float32Array(cloudCount * 3);
    const colorA = new THREE.Color(0x38bdf8);
    const colorB = new THREE.Color(0xfb923c);
    const colorC = new THREE.Color(0xffffff);
    for (let index = 0; index < cloudCount; index += 1) {
      const color = index % 5 === 0 ? colorC : index % 2 === 0 ? colorA : colorB;
      cloudPositions[index * 3] = point.x;
      cloudPositions[index * 3 + 1] = point.y;
      cloudPositions[index * 3 + 2] = point.z;
      cloudColors[index * 3] = color.r;
      cloudColors[index * 3 + 1] = color.g;
      cloudColors[index * 3 + 2] = color.b;

      const direction = new THREE.Vector3(
        THREE.MathUtils.randFloatSpread(1.5),
        THREE.MathUtils.randFloatSpread(1.1),
        THREE.MathUtils.randFloatSpread(1.5),
      ).normalize();
      const speed = THREE.MathUtils.randFloat(0.75, 2.6);
      cloudVelocities[index * 3] = direction.x * speed;
      cloudVelocities[index * 3 + 1] = direction.y * speed;
      cloudVelocities[index * 3 + 2] = direction.z * speed;
    }
    const cloudGeometry = new THREE.BufferGeometry();
    cloudGeometry.setAttribute('position', new THREE.BufferAttribute(cloudPositions, 3));
    cloudGeometry.setAttribute('color', new THREE.BufferAttribute(cloudColors, 3));
    const cloud = new THREE.Points(
      cloudGeometry,
      new THREE.PointsMaterial({
        size: 0.085,
        vertexColors: true,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    cloud.name = 'Collision energy cloud visualization';
    this.effectLayer.add(cloud);
    this.energyClouds.push({
      points: cloud,
      velocities: cloudVelocities,
      origin: point.clone(),
      age: 0,
      duration: 1.15,
    });

    for (let index = 0; index < 46; index += 1) {
      const direction = new THREE.Vector3(
        THREE.MathUtils.randFloatSpread(1.3),
        THREE.MathUtils.randFloatSpread(0.95),
        THREE.MathUtils.randFloatSpread(1.3),
      ).normalize();
      const geometry = new THREE.BufferGeometry().setFromPoints([point, point.clone()]);
      const color = index % 7 === 0 ? 0xffffff : index % 2 === 0 ? 0x38bdf8 : 0xfb923c;
      const line = new THREE.Line(
        geometry,
        new THREE.LineBasicMaterial({
          color,
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      this.effectLayer.add(line);
      this.fragments.push({
        line,
        origin: point.clone(),
        velocity: direction.multiplyScalar(THREE.MathUtils.randFloat(1.8, 4.4)),
        age: 0,
        duration: THREE.MathUtils.randFloat(0.55, 1.25),
      });
    }
  }

  private updateCollisionEffects(deltaTime: number): void {
    if (this.collisionFlash) {
      const age = this.state.collision.age;
      this.collisionFlash.scale.setScalar(1 + age * 6.2);
      const material = this.collisionFlash.material as THREE.MeshBasicMaterial;
      material.opacity = Math.max(0, 0.95 - age * 1.35);
      if (material.opacity <= 0.01) {
        this.effectLayer.remove(this.collisionFlash);
        this.collisionFlash = null;
      }
    }

    this.shockwaves = this.shockwaves.filter((shockwave) => {
      shockwave.age += deltaTime;
      const progress = shockwave.age / shockwave.duration;
      if (progress >= 1) {
        this.effectLayer.remove(shockwave.mesh);
        return false;
      }
      const eased = 1 - Math.pow(1 - progress, 3);
      shockwave.mesh.scale.setScalar(1 + eased * shockwave.maxScale);
      const material = shockwave.mesh.material as THREE.MeshBasicMaterial;
      material.opacity = Math.max(0, 0.82 * (1 - progress));
      return true;
    });

    this.energyClouds = this.energyClouds.filter((cloud) => {
      cloud.age += deltaTime;
      const progress = cloud.age / cloud.duration;
      if (progress >= 1) {
        this.effectLayer.remove(cloud.points);
        return false;
      }
      const positions = cloud.points.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let index = 0; index < positions.count; index += 1) {
        const velocityIndex = index * 3;
        const swirl = Math.sin(cloud.age * 8 + index * 0.17) * 0.08;
        positions.setXYZ(
          index,
          cloud.origin.x + cloud.velocities[velocityIndex] * cloud.age + swirl,
          cloud.origin.y + cloud.velocities[velocityIndex + 1] * cloud.age * 0.72,
          cloud.origin.z + cloud.velocities[velocityIndex + 2] * cloud.age - swirl,
        );
      }
      positions.needsUpdate = true;
      const material = cloud.points.material as THREE.PointsMaterial;
      material.opacity = Math.max(0, 0.95 * (1 - progress));
      material.size = 0.085 * (1 - progress) + 0.018;
      return true;
    });

    this.fragments = this.fragments.filter((fragment) => {
      fragment.age += deltaTime;
      const progress = fragment.age / fragment.duration;
      if (progress >= 1) {
        this.effectLayer.remove(fragment.line);
        return false;
      }
      const start = fragment.origin.clone().add(fragment.velocity.clone().multiplyScalar(fragment.age * 0.25));
      const end = fragment.origin.clone().add(fragment.velocity.clone().multiplyScalar(fragment.age));
      fragment.line.geometry.setFromPoints([start, end]);
      const material = fragment.line.material as THREE.LineBasicMaterial;
      material.opacity = 1 - progress;
      return true;
    });
  }

  private createArcPoints(segments: number): THREE.Vector3[] {
    return Array.from({ length: segments }, (_, index) => getDesignOrbitPosition(index / segments));
  }

  private addLabel(parent: THREE.Group, label: THREE.Sprite): void {
    this.labelSprites.push(label);
    parent.add(label);
  }

  private updateLabels(): void {
    this.labelSprites.forEach((label) => {
      label.visible = this.settings.showLabels;
    });
  }

  private applyModeVisibility(): void {
    const guidedOrbit = isGuidedOrbitMechanism(this.settings.mechanism);
    this.straightGuideGroup.visible = !guidedOrbit;
    this.rfGroup.visible = this.settings.mechanism === 'rf';
    this.bendingGroup.visible = guidedOrbit;
    this.syncGroup.visible = this.settings.mechanism === 'synchronized';
    this.collisionGroup.visible = this.settings.mechanism === 'collision';
  }

  private shouldRecycle(): boolean {
    if (this.state.collision.hasCollided) {
      return this.state.collision.age > 1.8;
    }
    if (isGuidedOrbitMechanism(this.settings.mechanism)) {
      return false;
    }
    return this.state.particles.some((particle) => Math.abs(particle.position.x) > 3.65 || Math.abs(particle.position.z) > 2.35);
  }
}
