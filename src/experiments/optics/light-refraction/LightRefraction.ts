import * as THREE from 'three';
import {
  ExperimentBase,
  type DisplayValue,
  type ExperimentConfig,
  type ExperimentMetadata,
} from '@/experiments/base';
import { ExperimentCategory } from '@/utils/constants';
import {
  MEDIUM_OPTIONS,
  MEDIUM_PRESETS,
  calculateRefraction,
  getMediumRefractiveIndex,
  resolveMediumKey,
  type MediumKey,
  type RefractionResult,
} from './RefractionPhysics';
import { MEDIUM_SHAPE_OPTIONS, createMediumGeometry, resolveMediumShapeKey, type MediumShapeKey } from './shapes/MediumShapes';

const INTERFACE_SIZE = 11;
const RAY_LENGTH_UPPER = 4.2;
const RAY_LENGTH_LOWER = 4.6;
const ARC_SEGMENTS = 64;

const UP_VECTOR = new THREE.Vector3(0, 1, 0);

export class LightRefraction extends ExperimentBase {
  readonly metadata: ExperimentMetadata = {
    id: 'light-refraction',
    name: 'Light Refraction',
    category: ExperimentCategory.Optics,
    description: 'Explore Snell refraction, Fresnel reflectance, and total internal reflection',
    difficulty: 'basic',
    duration: 15,
    keywords: ['optics', 'snell', 'fresnel', 'total internal reflection', 'critical angle'],
    thumbnail: '/thumbnails/light-refraction.png',
  };

  readonly config: ExperimentConfig = {
    physics: {
      timestep: 1 / 60,
    },
    camera: {
      position: [7.5, 4.8, 7],
      target: [0, 0, 0],
      fov: 45,
    },
    parameters: [
      {
        key: 'incidentAngle',
        label: 'Incident Angle',
        type: 'number',
        defaultValue: 30,
        min: 0,
        max: 89,
        step: 1,
        unit: '°',
      },
      {
        key: 'upperMedium',
        label: 'Upper Medium',
        type: 'select',
        defaultValue: 'air',
        options: MEDIUM_OPTIONS,
      },
      {
        key: 'lowerMedium',
        label: 'Lower Medium',
        type: 'select',
        defaultValue: 'glass',
        options: MEDIUM_OPTIONS,
      },
      {
        key: 'shape',
        label: 'Medium Shape',
        type: 'select',
        defaultValue: 'rectangle',
        options: MEDIUM_SHAPE_OPTIONS.map((shape) => ({ value: shape.value, label: shape.label })),
      },
      {
        key: 'wavelength',
        label: 'Wavelength',
        type: 'number',
        defaultValue: 550,
        min: 380,
        max: 780,
        step: 1,
        unit: 'nm',
      },
    ],
  };

  private mediumMesh: THREE.Mesh | null = null;
  private incidentRay: THREE.Line | null = null;
  private reflectedRay: THREE.Line | null = null;
  private refractedRay: THREE.Line | null = null;
  private normalLine: THREE.Line | null = null;
  private incidentArc: THREE.Line | null = null;
  private refractedArc: THREE.Line | null = null;
  private criticalArc: THREE.Line | null = null;

  private incidentArrow: THREE.Mesh | null = null;
  private reflectedArrow: THREE.Mesh | null = null;
  private refractedArrow: THREE.Mesh | null = null;
  private tirIndicator: THREE.Sprite | null = null;

  private currentRefraction: RefractionResult | null = null;

  private readonly incidentRayMaterial = new THREE.LineBasicMaterial({ color: 0xfff275, transparent: true, opacity: 0.95 });
  private readonly reflectedRayMaterial = new THREE.LineBasicMaterial({ color: 0xf3f4f6, transparent: true, opacity: 0.55 });
  private readonly refractedRayMaterial = new THREE.LineBasicMaterial({ color: 0xfff275, transparent: true, opacity: 0.85 });
  private readonly incidentArcMaterial = new THREE.LineBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.85 });
  private readonly refractedArcMaterial = new THREE.LineBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.85 });
  private readonly criticalArcMaterial = new THREE.LineDashedMaterial({ color: 0xf87171, dashSize: 0.08, gapSize: 0.05, transparent: true, opacity: 0.9 });
  private readonly normalLineMaterial = new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.14, gapSize: 0.08, transparent: true, opacity: 0.6 });

  protected async setupScene(): Promise<void> {
    this.setupLighting();
    this.createInterfacePlane();
    this.createMediumBlock();
    this.createRaysAndGuides();
    this.createTirIndicator();
    this.updateVisualization();
  }

  protected onReset(): void {
    this.updateVisualization();
  }

  protected onParameterChange(): void {
    this.updateVisualization();
  }

  update(deltaTime: number): void {
    void deltaTime;
  }

  getDisplayData(): Record<string, DisplayValue> {
    const result = this.currentRefraction ?? this.computeRefraction();
    const upperMedium = this.getMedium('upperMedium');
    const lowerMedium = this.getMedium('lowerMedium');
    const upperPreset = MEDIUM_PRESETS[upperMedium];
    const lowerPreset = MEDIUM_PRESETS[lowerMedium];

    return {
      upperMedium: {
        label: 'Upper Medium',
        value: `${upperPreset.label} (n=${result.n1.toFixed(2)})`,
      },
      lowerMedium: {
        label: 'Lower Medium',
        value: `${lowerPreset.label} (n=${result.n2.toFixed(2)})`,
      },
      incidentAngle: {
        label: 'Incident Angle',
        value: result.incidentAngleDeg.toFixed(2),
        unit: '°',
      },
      reflectedAngle: {
        label: 'Reflected Angle',
        value: result.reflectedAngleDeg.toFixed(2),
        unit: '°',
      },
      refractedAngle: {
        label: 'Refracted Angle',
        value: result.refractedAngleDeg === null ? 'N/A (TIR)' : result.refractedAngleDeg.toFixed(2),
        unit: result.refractedAngleDeg === null ? undefined : '°',
      },
      criticalAngle: {
        label: 'Critical Angle',
        value: result.criticalAngleDeg === null ? 'N/A' : result.criticalAngleDeg.toFixed(2),
        unit: result.criticalAngleDeg === null ? undefined : '°',
      },
      reflectance: {
        label: 'Reflectance',
        value: (result.reflectance * 100).toFixed(2),
        unit: '%',
      },
      transmittance: {
        label: 'Transmittance',
        value: (result.transmittance * 100).toFixed(2),
        unit: '%',
      },
      tirStatus: {
        label: 'TIR Status',
        value: result.isTotalInternalReflection ? 'Total Internal Reflection' : 'Refraction Active',
      },
    };
  }

  getMonitorSchema() {
    return {
      title: 'Monitor',
      quantities: [],
      defaultSelected: [],
      sampleIntervalMs: 100,
    };
  }

  dispose(): void {
    this.disposeLineObject(this.incidentRay);
    this.disposeLineObject(this.reflectedRay);
    this.disposeLineObject(this.refractedRay);
    this.disposeLineObject(this.normalLine);
    this.disposeLineObject(this.incidentArc);
    this.disposeLineObject(this.refractedArc);
    this.disposeLineObject(this.criticalArc);

    this.incidentRayMaterial.dispose();
    this.reflectedRayMaterial.dispose();
    this.refractedRayMaterial.dispose();
    this.incidentArcMaterial.dispose();
    this.refractedArcMaterial.dispose();
    this.criticalArcMaterial.dispose();
    this.normalLineMaterial.dispose();

    if (this.tirIndicator) {
      const material = this.tirIndicator.material as THREE.SpriteMaterial;
      material.map?.dispose();
      material.dispose();
    }

    super.dispose();
  }

  private setupLighting(): void {
    const ambient = new THREE.AmbientLight(0xffffff, 0.65);
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.85);
    keyLight.position.set(5, 9, 4);
    const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.35);
    fillLight.position.set(-4, 5, -3);

    this.addToScene(ambient);
    this.addToScene(keyLight);
    this.addToScene(fillLight);
  }

  private createInterfacePlane(): void {
    const interfaceGeometry = new THREE.CircleGeometry(INTERFACE_SIZE / 2, 64);
    const interfaceMaterial = new THREE.MeshBasicMaterial({
      color: 0xd1d5db,
      transparent: true,
      opacity: 0.14,
      side: THREE.DoubleSide,
    });
    const interfaceMesh = new THREE.Mesh(interfaceGeometry, interfaceMaterial);
    interfaceMesh.rotation.x = -Math.PI / 2;
    interfaceMesh.position.y = 0.001;
    this.addToScene(interfaceMesh);
  }

  private createMediumBlock(): void {
    const material = new THREE.MeshPhysicalMaterial({
      color: 0x60a5fa,
      transmission: 0.65,
      transparent: true,
      opacity: 0.42,
      roughness: 0.22,
      metalness: 0,
      thickness: 1.2,
    });

    this.mediumMesh = new THREE.Mesh(createMediumGeometry('rectangle'), material);
    this.mediumMesh.position.y = 0;
    this.mediumMesh.receiveShadow = true;
    this.mediumMesh.castShadow = true;
    this.addToScene(this.mediumMesh);
  }

  private createRaysAndGuides(): void {
    this.incidentRay = this.createLine(this.incidentRayMaterial);
    this.reflectedRay = this.createLine(this.reflectedRayMaterial);
    this.refractedRay = this.createLine(this.refractedRayMaterial);
    this.normalLine = this.createLine(this.normalLineMaterial);
    this.incidentArc = this.createLine(this.incidentArcMaterial);
    this.refractedArc = this.createLine(this.refractedArcMaterial);
    this.criticalArc = this.createLine(this.criticalArcMaterial);

    this.incidentArrow = this.createArrow(0xfff275);
    this.reflectedArrow = this.createArrow(0xf3f4f6);
    this.refractedArrow = this.createArrow(0xfff275);
  }

  private createTirIndicator(): void {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 160;
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    context.fillStyle = 'rgba(10, 15, 30, 0.78)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = 'rgba(248, 113, 113, 0.9)';
    context.lineWidth = 6;
    context.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);

    context.fillStyle = '#fef2f2';
    context.font = 'bold 52px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('Total Internal Reflection', canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.tirIndicator = new THREE.Sprite(material);
    this.tirIndicator.scale.set(3.6, 0.9, 1);
    this.tirIndicator.position.set(0.35, 1.55, 0);
    this.tirIndicator.visible = false;
    this.addToScene(this.tirIndicator);
  }

  private updateVisualization(): void {
    if (!this.mediumMesh) {
      return;
    }

    const result = this.computeRefraction();
    this.currentRefraction = result;
    this.updateMediumShapeAndMaterial();
    this.updateRayColoring(result);
    this.updateRaysGeometry(result);
    this.updateAngleArcs(result);

    if (this.tirIndicator) {
      this.tirIndicator.visible = result.isTotalInternalReflection;
    }
  }

  private computeRefraction(): RefractionResult {
    const incidentAngle = this.getSafeNumber('incidentAngle', 30, 0, 89);
    const upperMedium = this.getMedium('upperMedium');
    const lowerMedium = this.getMedium('lowerMedium');
    const n1 = getMediumRefractiveIndex(upperMedium);
    const n2 = getMediumRefractiveIndex(lowerMedium);
    return calculateRefraction(incidentAngle, n1, n2);
  }

  private getMedium(key: 'upperMedium' | 'lowerMedium'): MediumKey {
    const rawValue = this.getParameter(key);
    return resolveMediumKey(typeof rawValue === 'string' ? rawValue : 'air', 'air');
  }

  private getShape(): MediumShapeKey {
    const rawShape = this.getParameter('shape');
    return resolveMediumShapeKey(typeof rawShape === 'string' ? rawShape : 'rectangle');
  }

  private updateMediumShapeAndMaterial(): void {
    if (!this.mediumMesh) {
      return;
    }

    const shape = this.getShape();
    const nextGeometry = createMediumGeometry(shape);
    this.mediumMesh.geometry.dispose();
    this.mediumMesh.geometry = nextGeometry;

    const lowerMedium = this.getMedium('lowerMedium');
    const lowerIndex = MEDIUM_PRESETS[lowerMedium].refractiveIndex;
    const material = this.mediumMesh.material as THREE.MeshPhysicalMaterial;
    material.color.set(this.getMediumTint(lowerIndex));
    material.opacity = 0.26 + Math.min(lowerIndex / 3.5, 0.32);
    material.needsUpdate = true;
  }

  private updateRayColoring(result: RefractionResult): void {
    const wavelength = this.getSafeNumber('wavelength', 550, 380, 780);
    const baseColor = wavelengthToColor(wavelength);
    this.incidentRayMaterial.color.copy(baseColor);
    this.refractedRayMaterial.color.copy(baseColor);

    const reflectedTint = baseColor.clone().lerp(new THREE.Color(0xffffff), Math.max(result.reflectance, 0.32));
    if (result.isTotalInternalReflection) {
      reflectedTint.set(0xffffff);
    }
    this.reflectedRayMaterial.color.copy(reflectedTint);
    this.reflectedRayMaterial.opacity = result.isTotalInternalReflection ? 1 : 0.4 + result.reflectance * 0.6;
    this.refractedRayMaterial.opacity = result.isTotalInternalReflection ? 0 : Math.max(result.transmittance, 0.15);

    this.incidentArcMaterial.color.copy(baseColor.clone().offsetHSL(0, 0, 0.1));
    this.refractedArcMaterial.color.copy(baseColor.clone().offsetHSL(0.08, -0.1, 0.08));

    this.setArrowColor(this.incidentArrow, baseColor);
    this.setArrowColor(this.refractedArrow, baseColor);
    this.setArrowColor(this.reflectedArrow, reflectedTint);
  }

  private updateRaysGeometry(result: RefractionResult): void {
    if (!this.incidentRay || !this.reflectedRay || !this.refractedRay || !this.normalLine) {
      return;
    }

    const thetaI = THREE.MathUtils.degToRad(result.incidentAngleDeg);
    const incidentDirection = new THREE.Vector3(Math.sin(thetaI), -Math.cos(thetaI), 0);
    const reflectedDirection = new THREE.Vector3(Math.sin(thetaI), Math.cos(thetaI), 0);

    const origin = new THREE.Vector3(0, 0, 0);
    const incidentStart = origin.clone().addScaledVector(incidentDirection, -RAY_LENGTH_UPPER);
    const reflectedEnd = origin.clone().addScaledVector(reflectedDirection, RAY_LENGTH_UPPER);

    this.updateLine(this.incidentRay, [incidentStart, origin]);
    this.updateLine(this.reflectedRay, [origin, reflectedEnd]);
    this.updateLine(this.normalLine, [new THREE.Vector3(0, -3.6, 0), new THREE.Vector3(0, 3.6, 0)], true);

    this.placeArrow(this.incidentArrow, incidentStart, origin, 0.75);
    this.placeArrow(this.reflectedArrow, origin, reflectedEnd, 0.72);

    if (result.refractedAngleDeg === null) {
      this.refractedRay.visible = false;
      if (this.refractedArrow) {
        this.refractedArrow.visible = false;
      }
      return;
    }

    const thetaT = THREE.MathUtils.degToRad(result.refractedAngleDeg);
    const refractedDirection = new THREE.Vector3(Math.sin(thetaT), -Math.cos(thetaT), 0);
    const refractedEnd = origin.clone().addScaledVector(refractedDirection, RAY_LENGTH_LOWER);
    this.updateLine(this.refractedRay, [origin, refractedEnd]);
    this.refractedRay.visible = true;
    this.placeArrow(this.refractedArrow, origin, refractedEnd, 0.72);
  }

  private updateAngleArcs(result: RefractionResult): void {
    if (!this.incidentArc || !this.refractedArc || !this.criticalArc) {
      return;
    }

    const incidentRadius = 0.95;
    const refractedRadius = 1.2;
    const criticalRadius = 1.45;

    const incidentRad = THREE.MathUtils.degToRad(result.incidentAngleDeg);
    const incidentPoints = buildArcPoints(Math.PI / 2, Math.PI / 2 + incidentRad, incidentRadius, ARC_SEGMENTS);
    this.updateLine(this.incidentArc, incidentPoints);
    this.incidentArc.visible = true;

    if (result.refractedAngleDeg === null) {
      this.refractedArc.visible = false;
    } else {
      const refractedRad = THREE.MathUtils.degToRad(result.refractedAngleDeg);
      const refractedPoints = buildArcPoints(-Math.PI / 2, -Math.PI / 2 + refractedRad, refractedRadius, ARC_SEGMENTS);
      this.updateLine(this.refractedArc, refractedPoints);
      this.refractedArc.visible = true;
    }

    if (result.criticalAngleDeg === null) {
      this.criticalArc.visible = false;
      return;
    }

    const criticalRad = THREE.MathUtils.degToRad(result.criticalAngleDeg);
    const criticalPoints = buildArcPoints(-Math.PI / 2, -Math.PI / 2 + criticalRad, criticalRadius, ARC_SEGMENTS);
    this.updateLine(this.criticalArc, criticalPoints, true);
    this.criticalArc.visible = true;
  }

  private createLine(material: THREE.LineBasicMaterial | THREE.LineDashedMaterial): THREE.Line {
    const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const line = new THREE.Line(geometry, material);
    this.addToScene(line);
    return line;
  }

  private createArrow(color: number): THREE.Mesh {
    const geometry = new THREE.ConeGeometry(0.08, 0.24, 16);
    const material = new THREE.MeshBasicMaterial({ color });
    const arrow = new THREE.Mesh(geometry, material);
    this.addToScene(arrow);
    return arrow;
  }

  private setArrowColor(arrow: THREE.Mesh | null, color: THREE.Color): void {
    if (!arrow) {
      return;
    }
    const material = arrow.material as THREE.MeshBasicMaterial;
    material.color.copy(color);
  }

  private placeArrow(arrow: THREE.Mesh | null, start: THREE.Vector3, end: THREE.Vector3, t: number): void {
    if (!arrow) {
      return;
    }

    const direction = end.clone().sub(start);
    if (direction.lengthSq() < 1e-8) {
      arrow.visible = false;
      return;
    }

    arrow.visible = true;
    arrow.position.copy(start.clone().lerp(end, t));
    arrow.quaternion.setFromUnitVectors(UP_VECTOR, direction.normalize());
  }

  private updateLine(line: THREE.Line, points: THREE.Vector3[], dashed = false): void {
    const geometry = line.geometry as THREE.BufferGeometry;
    geometry.setFromPoints(points);
    geometry.computeBoundingSphere();

    if (dashed) {
      line.computeLineDistances();
    }
  }

  private getMediumTint(refractiveIndex: number): number {
    if (refractiveIndex >= 2) {
      return 0x93c5fd;
    }
    if (refractiveIndex >= 1.45) {
      return 0x60a5fa;
    }
    if (refractiveIndex >= 1.2) {
      return 0x67e8f9;
    }
    return 0xbfdbfe;
  }

  private disposeLineObject(line: THREE.Line | null): void {
    if (!line) {
      return;
    }
    line.geometry.dispose();
  }
}

function buildArcPoints(startAngle: number, endAngle: number, radius: number, segments: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const step = (endAngle - startAngle) / Math.max(segments, 1);
  for (let i = 0; i <= segments; i += 1) {
    const angle = startAngle + step * i;
    points.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0));
  }
  return points;
}

function wavelengthToColor(wavelengthNm: number): THREE.Color {
  const wavelength = Math.min(Math.max(wavelengthNm, 380), 780);
  let r = 0;
  let g = 0;
  let b = 0;

  if (wavelength < 440) {
    r = -(wavelength - 440) / (440 - 380);
    b = 1;
  } else if (wavelength < 490) {
    g = (wavelength - 440) / (490 - 440);
    b = 1;
  } else if (wavelength < 510) {
    g = 1;
    b = -(wavelength - 510) / (510 - 490);
  } else if (wavelength < 580) {
    r = (wavelength - 510) / (580 - 510);
    g = 1;
  } else if (wavelength < 645) {
    r = 1;
    g = -(wavelength - 645) / (645 - 580);
  } else {
    r = 1;
  }

  let factor = 1;
  if (wavelength > 700) {
    factor = 0.3 + 0.7 * ((780 - wavelength) / (780 - 700));
  } else if (wavelength < 420) {
    factor = 0.3 + 0.7 * ((wavelength - 380) / (420 - 380));
  }

  const gamma = 0.8;
  return new THREE.Color(
    Math.pow(r * factor, gamma),
    Math.pow(g * factor, gamma),
    Math.pow(b * factor, gamma)
  );
}

