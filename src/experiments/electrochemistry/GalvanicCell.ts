import * as THREE from 'three';
import {
    ExperimentBase,
    type ExperimentMetadata,
    type ExperimentConfig,
    type DisplayValue,
    type ControlSchema,
    type MonitorSchema,
    type ActionDefinition,
} from '@/experiments/base';
import { ExperimentCategory } from '@/utils/constants';
import { ParticleFlowSystem } from './ParticleFlowSystem';
import {
    calculateAllData,
    getReactions,
    type CellMode,
    type CalculationParams,
} from './ElectrochemistryPhysics';

/** Dopamine palette */
const COLORS = {
    zinc: 0x94a3b8,
    copper: 0xF97316,
    solution: 0x38BDF8,
    wire: 0xFACC15,
    beakerGlass: 0x94a3b8,
} as const;

export class GalvanicCell extends ExperimentBase {
    readonly metadata: ExperimentMetadata = {
        id: 'galvanic-cell',
        name: 'Electrochemical Cell',
        category: ExperimentCategory.Electrochemistry,
        description: 'Explore galvanic and electrolytic cells with particle flow visualization and real-time electrochemical calculations',
        difficulty: 'intermediate',
        duration: 25,
        keywords: ['electrochemistry', 'galvanic', 'electrolytic', 'cell', 'battery', 'redox'],
        thumbnail: '/thumbnails/galvanic-cell.png',
    };

    readonly config: ExperimentConfig = {
        physics: { timestep: 1 / 60 },
        camera: {
            position: [0, 4, 8],
            target: [0, 1, 0],
            fov: 50,
        },
        parameters: [
            {
                key: 'mode',
                label: 'Cell Mode',
                type: 'select',
                defaultValue: 'galvanic',
                options: [
                    { value: 'galvanic', label: 'Galvanic Cell' },
                    { value: 'electrolytic', label: 'Electrolytic Cell' },
                ],
            },
            {
                key: 'electrolyteConcentration',
                label: 'CuSO\u2084 Concentration',
                type: 'number',
                defaultValue: 1.0,
                min: 0.1,
                max: 2.0,
                step: 0.1,
                unit: 'mol/L',
            },
            {
                key: 'temperature',
                label: 'Temperature',
                type: 'number',
                defaultValue: 25,
                min: 0,
                max: 100,
                step: 5,
                unit: '\u00B0C',
            },
            {
                key: 'electrodeSpacing',
                label: 'Electrode Spacing',
                type: 'number',
                defaultValue: 8,
                min: 4,
                max: 14,
                step: 0.5,
                unit: 'cm',
            },
            {
                key: 'externalResistance',
                label: 'External Resistance',
                type: 'number',
                defaultValue: 10,
                min: 1,
                max: 100,
                step: 1,
                unit: '\u03A9',
            },
            {
                key: 'appliedVoltage',
                label: 'Applied Voltage',
                type: 'number',
                defaultValue: 3.0,
                min: 0,
                max: 12,
                step: 0.5,
                unit: 'V',
            },
            {
                key: 'showParticles',
                label: 'Show Particles',
                type: 'boolean',
                defaultValue: true,
            },
            {
                key: 'showEquations',
                label: 'Show Equations',
                type: 'boolean',
                defaultValue: true,
            },
        ],
    };

    // State
    private elapsedTime = 0;
    private particleSystem: ParticleFlowSystem | null = null;

    /** Convert electrodeSpacing parameter (cm) to scene half-spacing */
    private getHalfSpacing(spacing: number): number {
        return (spacing / 10) * 1.2;
    }

    // 3D object references
    private deviceMesh: THREE.Mesh | null = null;
    private znPolarityLabel: THREE.Sprite | null = null;
    private cuPolarityLabel: THREE.Sprite | null = null;

    protected async setupScene(): Promise<void> {
        if (!this.scene) return;

        // 添加星空背景
        this.addToScene(this.createStarfield());

        this.setupLights();
        this.createBeaker();
        this.createSolution();
        this.createElectrodes();
        this.createWire();
        this.createExternalDevice();
        this.createElectrodeLabels();
        this.initParticleSystem();
    }

    private setupLights(): void {
        if (!this.scene) return;

        const ambient = new THREE.AmbientLight(0xffffff, 0.5);
        this.addToScene(ambient);

        const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
        mainLight.position.set(5, 10, 7);
        this.addToScene(mainLight);

        const fillLight = new THREE.PointLight(0x38BDF8, 0.3, 20);
        fillLight.position.set(-3, 3, 2);
        this.addToScene(fillLight);
    }

    private createBeaker(): void {
        if (!this.scene) return;

        const width = 4.0;
        const depth = 1.6;
        const height = 3.0;
        const wallThickness = 0.05;

        const glassMat = new THREE.MeshPhysicalMaterial({
            color: COLORS.beakerGlass,
            transparent: true,
            opacity: 0.18,
            roughness: 0.1,
            metalness: 0.0,
            side: THREE.DoubleSide,
        });

        // Front wall
        const frontGeom = new THREE.PlaneGeometry(width, height);
        const front = new THREE.Mesh(frontGeom, glassMat);
        front.position.set(0, height / 2, depth / 2);
        this.addToScene(front);

        // Back wall
        const backGeom = new THREE.PlaneGeometry(width, height);
        const back = new THREE.Mesh(backGeom, glassMat);
        back.position.set(0, height / 2, -depth / 2);
        back.rotation.y = Math.PI;
        this.addToScene(back);

        // Left wall
        const leftGeom = new THREE.PlaneGeometry(depth, height);
        const left = new THREE.Mesh(leftGeom, glassMat);
        left.position.set(-width / 2, height / 2, 0);
        left.rotation.y = Math.PI / 2;
        this.addToScene(left);

        // Right wall
        const rightGeom = new THREE.PlaneGeometry(depth, height);
        const right = new THREE.Mesh(rightGeom, glassMat);
        right.position.set(width / 2, height / 2, 0);
        right.rotation.y = -Math.PI / 2;
        this.addToScene(right);

        // Bottom
        const bottomGeom = new THREE.PlaneGeometry(width, depth);
        const bottom = new THREE.Mesh(bottomGeom, glassMat);
        bottom.position.set(0, 0, 0);
        bottom.rotation.x = -Math.PI / 2;
        this.addToScene(bottom);

        // Rim - top edge highlight
        const rimShape = new THREE.Shape();
        const hw = width / 2 + wallThickness;
        const hd = depth / 2 + wallThickness;
        rimShape.moveTo(-hw, -hd);
        rimShape.lineTo(hw, -hd);
        rimShape.lineTo(hw, hd);
        rimShape.lineTo(-hw, hd);
        rimShape.lineTo(-hw, -hd);

        const rimHole = new THREE.Path();
        rimHole.moveTo(-width / 2, -depth / 2);
        rimHole.lineTo(width / 2, -depth / 2);
        rimHole.lineTo(width / 2, depth / 2);
        rimHole.lineTo(-width / 2, depth / 2);
        rimHole.lineTo(-width / 2, -depth / 2);
        rimShape.holes.push(rimHole);

        const rimGeom = new THREE.ShapeGeometry(rimShape);
        const rimMat = new THREE.MeshStandardMaterial({
            color: 0xcbd5e1,
            transparent: true,
            opacity: 0.4,
            side: THREE.DoubleSide,
        });
        const rim = new THREE.Mesh(rimGeom, rimMat);
        rim.rotation.x = -Math.PI / 2;
        rim.position.set(0, height, 0);
        this.addToScene(rim);
    }

    private createSolution(): void {
        if (!this.scene) return;

        const spacing = this.getParameter('electrodeSpacing') as number;
        const halfSpacing = this.getHalfSpacing(spacing);

        const fillHeight = 2.2;
        const innerWidth = Math.max(halfSpacing * 2 + 0.6, 3.8);
        const innerDepth = 1.5;

        const geometry = new THREE.BoxGeometry(innerWidth, fillHeight, innerDepth);
        const material = new THREE.MeshStandardMaterial({
            color: COLORS.solution,
            transparent: true,
            opacity: 0.25,
            roughness: 0.3,
            metalness: 0.1,
        });

        const solution = new THREE.Mesh(geometry, material);
        solution.position.set(0, fillHeight / 2, 0);
        this.addToScene(solution);
    }

    private createElectrodes(): void {
        if (!this.scene) return;

        const electrodeWidth = 0.15;
        const electrodeHeight = 3.5;
        const spacing = this.getParameter('electrodeSpacing') as number;
        const halfSpacing = this.getHalfSpacing(spacing);

        // Zn electrode (left)
        const znGeom = new THREE.BoxGeometry(electrodeWidth, electrodeHeight, 0.8);
        const znMat = new THREE.MeshStandardMaterial({
            color: COLORS.zinc,
            roughness: 0.4,
            metalness: 0.7,
        });
        const znElectrode = new THREE.Mesh(znGeom, znMat);
        znElectrode.position.set(-halfSpacing, electrodeHeight / 2 - 0.3, 0);
        this.addToScene(znElectrode);

        // Cu electrode (right)
        const cuGeom = new THREE.BoxGeometry(electrodeWidth, electrodeHeight, 0.8);
        const cuMat = new THREE.MeshStandardMaterial({
            color: COLORS.copper,
            roughness: 0.4,
            metalness: 0.7,
        });
        const cuElectrode = new THREE.Mesh(cuGeom, cuMat);
        cuElectrode.position.set(halfSpacing, electrodeHeight / 2 - 0.3, 0);
        this.addToScene(cuElectrode);
    }

    private createWire(): void {
        if (!this.scene) return;

        const spacing = this.getParameter('electrodeSpacing') as number;
        const halfSpacing = this.getHalfSpacing(spacing);

        const wireHeight = 4.5;
        const points = [
            new THREE.Vector3(-halfSpacing, 3.0, 0),
            new THREE.Vector3(-halfSpacing, wireHeight, 0),
            new THREE.Vector3(-halfSpacing - 0.5, wireHeight + 0.3, 0),
            new THREE.Vector3(-halfSpacing - 1.5, wireHeight + 0.3, 0),
            new THREE.Vector3(-halfSpacing - 2.5, wireHeight + 0.3, 0),
            new THREE.Vector3(0, wireHeight, 0),
            new THREE.Vector3(halfSpacing + 2.5, wireHeight + 0.3, 0),
            new THREE.Vector3(halfSpacing + 1.5, wireHeight + 0.3, 0),
            new THREE.Vector3(halfSpacing + 0.5, wireHeight + 0.3, 0),
            new THREE.Vector3(halfSpacing, wireHeight, 0),
            new THREE.Vector3(halfSpacing, 3.0, 0),
        ];

        const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.3);
        const tubeGeometry = new THREE.TubeGeometry(curve, 64, 0.03, 8, false);
        const wireMaterial = new THREE.MeshStandardMaterial({
            color: COLORS.wire,
            roughness: 0.3,
            metalness: 0.8,
        });

        const wire = new THREE.Mesh(tubeGeometry, wireMaterial);
        this.addToScene(wire);
    }

    private createExternalDevice(): void {
        if (!this.scene) return;

        const spacing = this.getParameter('electrodeSpacing') as number;
        const halfSpacing = this.getHalfSpacing(spacing);
        const deviceX = -halfSpacing - 1.5;
        const deviceY = 4.8 + 0.3;

        const geometry = new THREE.BoxGeometry(0.8, 0.5, 0.4);
        const material = new THREE.MeshStandardMaterial({
            color: 0x1e293b,
            roughness: 0.5,
            metalness: 0.3,
        });

        this.deviceMesh = new THREE.Mesh(geometry, material);
        this.deviceMesh.position.set(deviceX, deviceY, 0);

        this.updateDeviceTexture();

        this.addToScene(this.deviceMesh);
    }

    private updateDeviceTexture(): void {
        if (!this.deviceMesh) return;

        const mode = this.getParameter('mode') as CellMode;
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, 256, 128);

        ctx.strokeStyle = mode === 'galvanic' ? '#FACC15' : '#F97316';
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, 252, 124);

        ctx.fillStyle = '#f0f6fc';
        ctx.font = 'bold 32px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (mode === 'galvanic') {
            ctx.fillText('V', 128, 50);
            ctx.font = '16px sans-serif';
            ctx.fillStyle = '#94a3b8';
            ctx.fillText('Voltmeter', 128, 90);
        } else {
            ctx.fillText('DC', 128, 50);
            ctx.font = '16px sans-serif';
            ctx.fillStyle = '#94a3b8';
            ctx.fillText('Power Supply', 128, 90);
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;

        const oldMaterial = this.deviceMesh.material as THREE.MeshStandardMaterial;
        const oldMap = oldMaterial.map;
        oldMaterial.map = texture;
        oldMaterial.needsUpdate = true;
        oldMap?.dispose();
    }

    private createTextSprite(text: string, color: string, fontSize: number = 48): THREE.Sprite {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D context not available');

        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 128, 64);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(0.8, 0.4, 1);
        return sprite;
    }

    private createElectrodeLabels(): void {
        if (!this.scene) return;

        const spacing = this.getParameter('electrodeSpacing') as number;
        const halfSpacing = this.getHalfSpacing(spacing);

        const znLabel = this.createTextSprite('Zn', '#94a3b8', 56);
        znLabel.position.set(-halfSpacing, 3.8, 0);
        this.addToScene(znLabel);

        const cuLabel = this.createTextSprite('Cu', '#F97316', 56);
        cuLabel.position.set(halfSpacing, 3.8, 0);
        this.addToScene(cuLabel);

        this.updatePolarityLabels();
    }

    private updatePolarityLabels(): void {
        if (!this.scene) return;

        const spacing = this.getParameter('electrodeSpacing') as number;
        const halfSpacing = this.getHalfSpacing(spacing);
        const mode = this.getParameter('mode') as CellMode;
        const reactions = getReactions(mode);

        // Remove old labels
        if (this.znPolarityLabel) {
            this.removeFromScene(this.znPolarityLabel);
            this.znPolarityLabel.material.map?.dispose();
            (this.znPolarityLabel.material as THREE.SpriteMaterial).dispose();
        }
        if (this.cuPolarityLabel) {
            this.removeFromScene(this.cuPolarityLabel);
            this.cuPolarityLabel.material.map?.dispose();
            (this.cuPolarityLabel.material as THREE.SpriteMaterial).dispose();
        }

        this.znPolarityLabel = this.createTextSprite(reactions.anodeLabel, '#F87171', 36);
        this.znPolarityLabel.position.set(-halfSpacing, -0.3, 0.6);
        this.addToScene(this.znPolarityLabel);

        this.cuPolarityLabel = this.createTextSprite(reactions.cathodeLabel, '#22D3EE', 36);
        this.cuPolarityLabel.position.set(halfSpacing, -0.3, 0.6);
        this.addToScene(this.cuPolarityLabel);
    }

    private getWireParticlePath(): THREE.Vector3[] {
        const spacing = this.getParameter('electrodeSpacing') as number;
        const halfSpacing = this.getHalfSpacing(spacing);

        return [
            new THREE.Vector3(-halfSpacing, 2.5, 0),
            new THREE.Vector3(-halfSpacing, 4.5, 0),
            new THREE.Vector3(0, 5.1, 0),
            new THREE.Vector3(halfSpacing, 4.5, 0),
            new THREE.Vector3(halfSpacing, 2.5, 0),
        ];
    }

    private getSolutionPaths(): { cation: THREE.Vector3[]; anion: THREE.Vector3[] } {
        const spacing = this.getParameter('electrodeSpacing') as number;
        const halfSpacing = this.getHalfSpacing(spacing);

        return {
            cation: [
                new THREE.Vector3(-halfSpacing + 0.2, 0.5, 0),
                new THREE.Vector3(-halfSpacing + 0.2, 2.0, 0.3),
                new THREE.Vector3(0, 2.2, 0.2),
                new THREE.Vector3(halfSpacing - 0.2, 2.0, -0.2),
                new THREE.Vector3(halfSpacing - 0.2, 0.5, 0),
            ],
            anion: [
                new THREE.Vector3(halfSpacing - 0.2, 0.5, 0),
                new THREE.Vector3(halfSpacing - 0.2, 1.5, -0.3),
                new THREE.Vector3(0, 1.8, -0.2),
                new THREE.Vector3(-halfSpacing + 0.2, 1.5, 0.2),
                new THREE.Vector3(-halfSpacing + 0.2, 0.5, 0),
            ],
        };
    }

    private initParticleSystem(): void {
        if (!this.scene) return;

        this.particleSystem = new ParticleFlowSystem();
        this.particleSystem.init(
            this.scene,
            this.getWireParticlePath(),
            this.getSolutionPaths(),
        );

        const mode = this.getParameter('mode') as CellMode;
        this.particleSystem.setDirection(mode === 'galvanic' ? 1 : -1);

        const showParticles = this.getParameter('showParticles') as boolean;
        this.particleSystem.setVisible(showParticles);
    }

    protected onParameterChange(key: string, value: number | string | boolean): void {
        if (key === 'mode') {
            const mode = value as CellMode;
            this.updateDeviceTexture();
            this.updatePolarityLabels();
            this.particleSystem?.setDirection(mode === 'galvanic' ? 1 : -1);
            this.elapsedTime = 0;
        }

        if (key === 'showParticles') {
            this.particleSystem?.setVisible(value as boolean);
        }

        if (key === 'electrodeSpacing') {
            this.onReset();
        }

        if (['electrolyteConcentration', 'temperature', 'externalResistance', 'appliedVoltage'].includes(key)) {
            this.elapsedTime = 0;
        }
    }

    protected onReset(): void {
        this.elapsedTime = 0;

        this.particleSystem?.dispose();
        this.initParticleSystem();
    }

    update(deltaTime: number): void {
        if (!this.isRunning) return;

        this.elapsedTime += deltaTime;

        const mode = this.getParameter('mode') as CellMode;
        const concentration = this.getSafeNumber('electrolyteConcentration', 1.0, 0.1, 2.0);
        const temperature = this.getSafeNumber('temperature', 25, 0, 100);
        const spacing = this.getSafeNumber('electrodeSpacing', 8, 4, 14);
        const externalR = this.getSafeNumber('externalResistance', 10, 1, 100);
        const appliedV = this.getSafeNumber('appliedVoltage', 3.0, 0, 12);

        const params: CalculationParams = {
            mode,
            concentration,
            temperature,
            electrodeSpacing: spacing,
            externalResistance: externalR,
            appliedVoltage: appliedV,
            elapsedTime: this.elapsedTime,
        };

        const data = calculateAllData(params);

        const maxExpectedCurrent = 0.5;
        const normalizedCurrent = Math.min(data.current / maxExpectedCurrent, 1.0);

        this.particleSystem?.update(deltaTime, normalizedCurrent);
    }

    getDisplayData(): Record<string, DisplayValue> {
        const mode = this.getParameter('mode') as CellMode;
        const concentration = this.getSafeNumber('electrolyteConcentration', 1.0, 0.1, 2.0);
        const temperature = this.getSafeNumber('temperature', 25, 0, 100);
        const spacing = this.getSafeNumber('electrodeSpacing', 8, 4, 14);
        const externalR = this.getSafeNumber('externalResistance', 10, 1, 100);
        const appliedV = this.getSafeNumber('appliedVoltage', 3.0, 0, 12);

        const params: CalculationParams = {
            mode,
            concentration,
            temperature,
            electrodeSpacing: spacing,
            externalResistance: externalR,
            appliedVoltage: appliedV,
            elapsedTime: this.elapsedTime,
        };

        const data = calculateAllData(params);
        const reactions = getReactions(mode);

        return {
            mode: {
                label: 'Mode',
                value: mode === 'galvanic' ? 'Galvanic Cell' : 'Electrolytic Cell',
            },
            emf: {
                label: 'EMF',
                value: data.emf.toFixed(3),
                unit: 'V',
            },
            current: {
                label: 'Current',
                value: (data.current * 1000).toFixed(2),
                unit: 'mA',
            },
            znConc: {
                label: 'Zn\u00B2\u207A Conc.',
                value: data.znConcentration.toFixed(3),
                unit: 'mol/L',
            },
            cuDeposited: {
                label: 'Cu Deposited',
                value: data.cuDepositedMass.toFixed(2),
                unit: 'mg',
            },
            anodeReaction: {
                label: reactions.anodeProcess === 'oxidation' ? 'Anode (Oxidation)' : 'Cathode (Reduction)',
                value: reactions.anodeReaction,
            },
            cathodeReaction: {
                label: reactions.cathodeProcess === 'reduction' ? 'Cathode (Reduction)' : 'Anode (Oxidation)',
                value: reactions.cathodeReaction,
            },
            totalReaction: {
                label: 'Total',
                value: reactions.totalReaction,
            },
            elapsedTime: {
                label: 'Time',
                value: this.elapsedTime.toFixed(1),
                unit: 's',
            },
        };
    }

    getControlSchema(): ControlSchema {
        const mode = this.getParameter('mode') as CellMode;
        const allParams = this.config.parameters;

        const filteredParams = allParams.filter((param) => {
            if (param.key === 'externalResistance' && mode !== 'galvanic') return false;
            if (param.key === 'appliedVoltage' && mode !== 'electrolytic') return false;
            return true;
        });

        const actions: ActionDefinition[] = [
            { key: 'resetElectrodes', label: 'Reset Electrodes', variant: 'secondary' },
        ];

        return {
            title: 'Controls',
            parameters: filteredParams,
            actions,
        };
    }

    getMonitorSchema(): MonitorSchema {
        return {
            title: 'Monitor',
            quantities: [
                { key: 'emf', label: 'EMF', unit: 'V', color: '#22d3ee' },
                { key: 'current', label: 'Current', unit: 'mA', color: '#f59e0b' },
                { key: 'znConc', label: 'Zn\u00B2\u207A', unit: 'mol/L', color: '#FFD166' },
                { key: 'cuDeposited', label: 'Cu Deposited', unit: 'mg', color: '#F97316' },
            ],
            defaultSelected: ['emf', 'current'],
            sampleIntervalMs: 100,
        };
    }

    triggerAction(key: string): void {
        if (key === 'resetElectrodes') {
            this.onReset();
        }
    }

    dispose(): void {
        this.particleSystem?.dispose();
        this.particleSystem = null;
        super.dispose();
    }
}
