import type {
    ExperimentConfig2D,
    DisplayValue,
    MonitorSchema,
} from '@/experiments/base';
import { ExperimentBase2D, registerExperiment2D } from '@/experiments/base';
import { ExperimentCategory, EARTH_GRAVITY } from '@/utils/constants';
import {
    calculateProjectileEnergies,
    createInitialProjectileState,
    estimateProjectileKinematics,
    stepProjectile,
    type ProjectileLaunchParameters,
    type ProjectileState,
} from './ProjectilePhysics';

const NS = 'http://www.w3.org/2000/svg';
const TRAJECTORY_MAX_POINTS = 500;

const metadata = {
    id: 'projectile-motion',
    name: 'Projectile Motion Lab',
    category: ExperimentCategory.Mechanics,
    description: 'Investigate range, flight time, and energy conversion in 2D projectile motion',
    difficulty: 'basic' as const,
    duration: 20,
    keywords: ['projectile', 'range', 'trajectory', 'kinematics', 'gravity'],
    thumbnail: '/thumbnails/projectile-motion.png',
    renderMode: '2d' as const,
};

const config: ExperimentConfig2D = {
    parameters: [
        { key: 'launchSpeed', label: 'Launch Speed', type: 'number' as const, defaultValue: 20, min: 5, max: 60, step: 0.5, unit: 'm/s' },
        { key: 'launchAngle', label: 'Launch Angle', type: 'number' as const, defaultValue: 45, min: 5, max: 85, step: 1, unit: '°' },
        { key: 'launchHeight', label: 'Launch Height', type: 'number' as const, defaultValue: 1.2, min: 0.2, max: 12, step: 0.1, unit: 'm' },
        { key: 'mass', label: 'Projectile Mass', type: 'number' as const, defaultValue: 0.2, min: 0.05, max: 2, step: 0.05, unit: 'kg' },
        { key: 'gravity', label: 'Gravity', type: 'number' as const, defaultValue: EARTH_GRAVITY, min: 1.6, max: 15, step: 0.1, unit: 'm/s²' },
        { key: 'showTrajectory', label: 'Show Trajectory', type: 'boolean' as const, defaultValue: true },
    ],
};

@registerExperiment2D('projectile-motion')
export class ProjectileMotion extends ExperimentBase2D {
    readonly metadata = metadata;
    readonly config = config;

    private state: ProjectileState | null = null;
    private trajectory: { x: number; y: number }[] = [];

    // SVG element references
    private svg: SVGSVGElement | null = null;
    private projectileEl: SVGCircleElement | null = null;
    private trajectoryEl: SVGPolylineElement | null = null;
    private landingMarkerEl: SVGCircleElement | null = null;
    private launcherTubeEl: SVGLineElement | null = null;
    private angleArcEl: SVGPathElement | null = null;
    private angleLabelEl: SVGTextElement | null = null;
    private velocityArrowEl: SVGLineElement | null = null;
    private viewRange = 50;
    private viewHeight = 30;

    // --- Lifecycle ---

    override start(): void {
        this.resetSimulation();
        super.start();
    }

    override reset(): void {
        this.resetSimulation();
        super.reset();
    }

    override dispose(): void {
        this.state = null;
        this.trajectory = [];
        this.svg = null;
        this.projectileEl = null;
        this.trajectoryEl = null;
        this.landingMarkerEl = null;
        this.launcherTubeEl = null;
        this.angleArcEl = null;
        this.angleLabelEl = null;
        this.velocityArrowEl = null;
        super.dispose();
    }

    // --- Physics Update ---

    update(deltaTime: number): void {
        if (!this.isRunning || !this.state) return;

        const gravity = this.getLaunchParams().gravity;
        const clampedDelta = Math.min(deltaTime, 1 / 30);
        this.state = stepProjectile(this.state, clampedDelta, gravity, 0);

        if (this.getParameter('showTrajectory')) {
            this.trajectory.push({ x: this.state.position.x, y: this.state.position.y });
            if (this.trajectory.length > TRAJECTORY_MAX_POINTS) this.trajectory.shift();
        }

        this.updateSVG();

        if (this.state.hasLanded) {
            this.isRunning = false;
        }
    }

    // --- Data Output ---

    getDisplayData(): Record<string, DisplayValue> {
        if (!this.state) return {};
        const params = this.getLaunchParams();
        const theoretical = estimateProjectileKinematics(params);
        const energies = calculateProjectileEnergies(this.state, params.mass, params.gravity, 0);

        return {
            status: { label: 'Status', value: this.state.hasLanded ? 'Landed' : 'In Flight' },
            time: { label: 'Time', value: this.state.time.toFixed(2), unit: 's' },
            horizontalDistance: { label: 'Horizontal Distance', value: this.state.horizontalDistance.toFixed(2), unit: 'm' },
            height: { label: 'Current Height', value: Math.max(0, this.state.position.y).toFixed(2), unit: 'm' },
            speed: { label: 'Speed', value: energies.speed.toFixed(2), unit: 'm/s' },
            maxHeight: { label: 'Max Height', value: Math.max(0, this.state.maxHeight).toFixed(2), unit: 'm' },
            theoreticalRange: { label: 'Theoretical Range', value: theoretical.range.toFixed(2), unit: 'm' },
            theoreticalFlightTime: { label: 'Theoretical Flight Time', value: theoretical.flightTime.toFixed(2), unit: 's' },
            kineticEnergy: { label: 'Kinetic Energy', value: energies.kineticEnergy.toFixed(2), unit: 'J' },
            potentialEnergy: { label: 'Potential Energy', value: energies.potentialEnergy.toFixed(2), unit: 'J' },
            totalEnergy: { label: 'Mechanical Energy', value: energies.mechanicalEnergy.toFixed(2), unit: 'J' },
        };
    }

    getMonitorSchema(): MonitorSchema {
        return {
            title: 'Monitor',
            quantities: [
                { key: 'time', label: 'Time', unit: 's', color: '#22d3ee' },
                { key: 'horizontalDistance', label: 'H. Distance', unit: 'm', color: '#34d399' },
                { key: 'height', label: 'Height', unit: 'm', color: '#fbbf24' },
                { key: 'speed', label: 'Speed', unit: 'm/s', color: '#f87171' },
                { key: 'kineticEnergy', label: 'KE', unit: 'J', color: '#60a5fa' },
                { key: 'potentialEnergy', label: 'PE', unit: 'J', color: '#a78bfa' },
            ],
            defaultSelected: ['time', 'horizontalDistance', 'height', 'speed'],
            sampleIntervalMs: 80,
        };
    }

    // --- Resize ---

    onResize(_width: number, _height: number): void {
        this.recalculateView();
        this.updateViewBox();
        this.rebuildGrid();
        this.updateSVG();
    }

    // --- Setup ---

    protected async setupScene(): Promise<void> {
        if (!this.container) return;

        this.recalculateView();

        // SVG root
        this.svg = document.createElementNS(NS, 'svg');
        this.svg.setAttribute('width', '100%');
        this.svg.setAttribute('height', '100%');
        this.svg.style.display = 'block';
        this.svg.style.background = 'var(--exp-2d-bg)';
        this.updateViewBox();

        // Defs: glow filter for projectile
        const defs = document.createElementNS(NS, 'defs');

        const glowFilter = document.createElementNS(NS, 'filter');
        glowFilter.setAttribute('id', 'projectile-glow');
        glowFilter.setAttribute('x', '-50%');
        glowFilter.setAttribute('y', '-50%');
        glowFilter.setAttribute('width', '200%');
        glowFilter.setAttribute('height', '200%');
        const blur = document.createElementNS(NS, 'feGaussianBlur');
        blur.setAttribute('in', 'SourceGraphic');
        blur.setAttribute('stdDeviation', '3');
        glowFilter.appendChild(blur);
        defs.appendChild(glowFilter);

        this.svg.appendChild(defs);

        // Background
        const bg = this.svgEl('rect');
        bg.setAttribute('x', '0'); bg.setAttribute('y', '0');
        bg.setAttribute('width', '100%'); bg.setAttribute('height', '100%');
        bg.setAttribute('fill', 'var(--exp-2d-bg)');
        this.svg.appendChild(bg);

        // Grid group (rebuilt on resize)
        this.svg.appendChild(this.createGrid());

        // Ground line
        const ground = this.svgEl('line');
        ground.setAttribute('x1', '-10'); ground.setAttribute('x2', String(this.viewRange + 10));
        ground.setAttribute('y1', '0'); ground.setAttribute('y2', '0');
        ground.setAttribute('stroke', 'var(--exp-2d-primary)');
        ground.setAttribute('stroke-width', '2');
        ground.setAttribute('opacity', '0.5');
        this.svg.appendChild(ground);

        // Trajectory
        this.trajectoryEl = this.svgEl('polyline') as unknown as SVGPolylineElement;
        this.trajectoryEl.setAttribute('fill', 'none');
        this.trajectoryEl.setAttribute('stroke', 'var(--exp-2d-accent)');
        this.trajectoryEl.setAttribute('stroke-width', '2');
        this.trajectoryEl.setAttribute('opacity', '0.8');
        this.trajectoryEl.setAttribute('stroke-linecap', 'round');
        this.trajectoryEl.setAttribute('stroke-linejoin', 'round');
        this.svg.appendChild(this.trajectoryEl);

        // Landing marker
        this.landingMarkerEl = this.svgEl('circle') as unknown as SVGCircleElement;
        this.landingMarkerEl.setAttribute('r', '0.3');
        this.landingMarkerEl.setAttribute('fill', '#f87171');
        this.landingMarkerEl.setAttribute('opacity', '0.7');
        this.landingMarkerEl.setAttribute('display', 'none');
        this.svg.appendChild(this.landingMarkerEl);

        // Launcher tube
        this.launcherTubeEl = this.svgEl('line') as unknown as SVGLineElement;
        this.launcherTubeEl.setAttribute('stroke', 'var(--exp-2d-primary)');
        this.launcherTubeEl.setAttribute('stroke-width', '2.5');
        this.launcherTubeEl.setAttribute('stroke-linecap', 'round');
        this.svg.appendChild(this.launcherTubeEl);

        // Launcher base
        const base = this.svgEl('circle');
        base.setAttribute('cx', '0'); base.setAttribute('cy', '0');
        base.setAttribute('r', '0.3');
        base.setAttribute('fill', 'var(--exp-2d-primary)');
        base.setAttribute('opacity', '0.6');
        this.svg.appendChild(base);

        // Angle arc
        this.angleArcEl = this.svgEl('path') as unknown as SVGPathElement;
        this.angleArcEl.setAttribute('fill', 'none');
        this.angleArcEl.setAttribute('stroke', 'var(--exp-2d-text-dim)');
        this.angleArcEl.setAttribute('stroke-width', '1');
        this.angleArcEl.setAttribute('stroke-dasharray', '3 3');
        this.svg.appendChild(this.angleArcEl);

        // Angle label
        this.angleLabelEl = this.svgEl('text') as unknown as SVGTextElement;
        this.angleLabelEl.setAttribute('fill', 'var(--exp-2d-text-dim)');
        this.angleLabelEl.setAttribute('font-size', '2.5');
        this.angleLabelEl.setAttribute('text-anchor', 'middle');
        this.svg.appendChild(this.angleLabelEl);

        // Velocity arrow
        this.velocityArrowEl = this.svgEl('line') as unknown as SVGLineElement;
        this.velocityArrowEl.setAttribute('stroke', 'var(--exp-2d-negative)');
        this.velocityArrowEl.setAttribute('stroke-width', '1.5');
        this.velocityArrowEl.setAttribute('opacity', '0.6');
        this.velocityArrowEl.setAttribute('marker-end', '');
        this.svg.appendChild(this.velocityArrowEl);

        // Projectile (on top)
        this.projectileEl = this.svgEl('circle') as unknown as SVGCircleElement;
        this.projectileEl.setAttribute('r', '0.25');
        this.projectileEl.setAttribute('fill', 'var(--exp-2d-particle)');
        this.projectileEl.setAttribute('filter', 'url(#projectile-glow)');
        this.svg.appendChild(this.projectileEl);

        this.container.appendChild(this.svg);
        this.resetSimulation();
    }

    // --- Private Helpers ---

    private svgEl(tag: string): SVGElement {
        return document.createElementNS(NS, tag);
    }

    private getLaunchParams(): ProjectileLaunchParameters {
        return {
            launchSpeed: this.getSafeNumber('launchSpeed', 20, 5, 60),
            launchAngleDeg: this.getSafeNumber('launchAngle', 45, 5, 85),
            launchHeight: this.getSafeNumber('launchHeight', 1.2, 0.2, 12),
            mass: this.getSafeNumber('mass', 0.2, 0.05, 2),
            gravity: this.getSafeNumber('gravity', EARTH_GRAVITY, 1.6, 15),
        };
    }

    private resetSimulation(): void {
        const params = this.getLaunchParams();
        this.state = createInitialProjectileState(params);
        this.trajectory = [{ x: 0, y: params.launchHeight }];
        this.recalculateView();
        this.updateViewBox();
        this.rebuildGrid();
        this.updateSVG();
    }

    private recalculateView(): void {
        const params = this.getLaunchParams();
        const kin = estimateProjectileKinematics(params);
        const pad = Math.max(5, kin.range * 0.15);
        this.viewRange = kin.range + pad * 2;
        this.viewHeight = kin.maxHeight + pad * 2;
    }

    private updateViewBox(): void {
        if (!this.svg) return;
        const pad = Math.max(5, this.viewRange * 0.08);
        this.svg.setAttribute('viewBox', `${-pad} ${-pad * 0.5} ${this.viewRange + pad * 2} ${this.viewHeight + pad}`);
        this.svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    }

    private createGrid(): SVGGElement {
        const g = this.svgEl('g') as unknown as SVGGElement;
        g.setAttribute('id', 'grid-group');
        this.populateGrid(g);
        return g;
    }

    private populateGrid(g: SVGGElement): void {
        // Clear existing
        while (g.firstChild) g.removeChild(g.firstChild);

        const xStep = this.niceStep(this.viewRange, 8);
        const yStep = this.niceStep(this.viewHeight, 6);

        // Vertical grid lines
        for (let x = 0; x <= this.viewRange; x += xStep) {
            const line = this.svgEl('line');
            line.setAttribute('x1', String(x)); line.setAttribute('x2', String(x));
            line.setAttribute('y1', '0'); line.setAttribute('y2', String(this.viewHeight * 0.95));
            line.setAttribute('stroke', 'var(--exp-2d-stroke-color)');
            line.setAttribute('stroke-width', '0.5');
            line.setAttribute('stroke-dasharray', '2 4');
            g.appendChild(line);

            // Label
            if (x > 0) {
                const label = this.svgEl('text') as unknown as SVGTextElement;
                label.setAttribute('x', String(x));
                label.setAttribute('y', '-0.5');
                label.setAttribute('fill', 'var(--exp-2d-text-dim)');
                label.setAttribute('font-size', '2');
                label.setAttribute('text-anchor', 'middle');
                label.textContent = String(x);
                g.appendChild(label);
            }
        }

        // Horizontal grid lines + labels
        for (let y = yStep; y <= this.viewHeight; y += yStep) {
            const line = this.svgEl('line');
            line.setAttribute('x1', '-5'); line.setAttribute('x2', String(this.viewRange + 5));
            line.setAttribute('y1', String(y)); line.setAttribute('y2', String(y));
            line.setAttribute('stroke', 'var(--exp-2d-stroke-color)');
            line.setAttribute('stroke-width', '0.5');
            line.setAttribute('stroke-dasharray', '2 4');
            g.appendChild(line);

            const label = this.svgEl('text') as unknown as SVGTextElement;
            label.setAttribute('x', '-1');
            label.setAttribute('y', String(y + 0.5));
            label.setAttribute('fill', 'var(--exp-2d-text-dim)');
            label.setAttribute('font-size', '2');
            label.setAttribute('text-anchor', 'end');
            label.textContent = y.toFixed(0);
            g.appendChild(label);
        }
    }

    private rebuildGrid(): void {
        if (!this.svg) return;
        const existing = this.svg.querySelector('#grid-group');
        if (existing) {
            const newGrid = this.createGrid();
            this.svg.replaceChild(newGrid, existing);
        }
    }

    private niceStep(range: number, targetTicks: number): number {
        const rough = range / targetTicks;
        const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
        const normalized = rough / magnitude;
        let nice: number;
        if (normalized <= 1.5) nice = 1;
        else if (normalized <= 3) nice = 2;
        else if (normalized <= 7) nice = 5;
        else nice = 10;
        return Math.max(nice * magnitude, 0.1);
    }

    private updateSVG(): void {
        if (!this.state) return;
        const pos = this.state.position;
        const vel = this.state.velocity;
        const angle = this.getSafeNumber('launchAngle', 45, 5, 85);
        const mass = this.getSafeNumber('mass', 0.2, 0.05, 2);
        const launchHeight = this.getSafeNumber('launchHeight', 1.2, 0.2, 12);

        // Projectile
        if (this.projectileEl) {
            const r = 0.15 + mass * 0.08;
            this.projectileEl.setAttribute('cx', String(pos.x));
            this.projectileEl.setAttribute('cy', String(pos.y));
            this.projectileEl.setAttribute('r', String(r));
        }

        // Trajectory
        if (this.trajectoryEl) {
            const show = this.getParameter('showTrajectory');
            if (show && this.trajectory.length > 0) {
                const points = this.trajectory.map((p) => `${p.x},${p.y}`).join(' ');
                this.trajectoryEl.setAttribute('points', points);
                this.trajectoryEl.setAttribute('display', '');
            } else {
                this.trajectoryEl.setAttribute('display', 'none');
            }
        }

        // Landing marker
        if (this.landingMarkerEl) {
            if (this.state.hasLanded) {
                this.landingMarkerEl.setAttribute('cx', String(pos.x));
                this.landingMarkerEl.setAttribute('cy', String(pos.y));
                this.landingMarkerEl.setAttribute('display', '');
            } else {
                this.landingMarkerEl.setAttribute('display', 'none');
            }
        }

        // Launcher tube
        if (this.launcherTubeEl) {
            const tubeLen = Math.max(1.5, this.viewRange * 0.04);
            const angleRad = angle * Math.PI / 180;
            this.launcherTubeEl.setAttribute('x1', '0');
            this.launcherTubeEl.setAttribute('y1', String(launchHeight));
            this.launcherTubeEl.setAttribute('x2', String(tubeLen * Math.cos(angleRad)));
            this.launcherTubeEl.setAttribute('y2', String(launchHeight + tubeLen * Math.sin(angleRad)));
        }

        // Angle arc
        if (this.angleArcEl && this.angleLabelEl) {
            const arcR = Math.max(2, this.viewRange * 0.06);
            const angleRad = angle * Math.PI / 180;
            const largeArc = angle > 180 ? 1 : 0;
            const ex = arcR * Math.cos(angleRad);
            const ey = launchHeight + arcR * Math.sin(angleRad);
            this.angleArcEl.setAttribute('d', `M ${arcR},0 A ${arcR},${arcR} 0 ${largeArc},1 ${ex},${ey}`);

            const midAngle = angleRad / 2;
            const labelR = arcR + 1.5;
            this.angleLabelEl.setAttribute('x', String(labelR * Math.cos(midAngle)));
            this.angleLabelEl.setAttribute('y', String(launchHeight + labelR * Math.sin(midAngle) + 1));
            this.angleLabelEl.textContent = `${angle}°`;
        }

        // Velocity arrow
        if (this.velocityArrowEl && !this.state.hasLanded) {
            const speed = Math.sqrt(vel.x ** 2 + vel.y ** 2);
            if (speed > 0.1) {
                const arrowLen = Math.min(this.viewRange * 0.08, speed * 0.15);
                const nx = vel.x / speed;
                const ny = vel.y / speed;
                this.velocityArrowEl.setAttribute('x1', String(pos.x));
                this.velocityArrowEl.setAttribute('y1', String(pos.y));
                this.velocityArrowEl.setAttribute('x2', String(pos.x + nx * arrowLen));
                this.velocityArrowEl.setAttribute('y2', String(pos.y + ny * arrowLen));
                this.velocityArrowEl.setAttribute('display', '');
            } else {
                this.velocityArrowEl.setAttribute('display', 'none');
            }
        } else if (this.velocityArrowEl) {
            this.velocityArrowEl.setAttribute('display', 'none');
        }
    }
}
