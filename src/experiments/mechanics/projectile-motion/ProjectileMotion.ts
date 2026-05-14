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
        { key: 'launchAngle', label: 'Launch Angle', type: 'number' as const, defaultValue: 45, min: 5, max: 85, step: 1, unit: '\u00b0' },
        { key: 'launchHeight', label: 'Launch Height', type: 'number' as const, defaultValue: 0, min: 0, max: 12, step: 0.1, unit: 'm' },
        { key: 'mass', label: 'Projectile Mass', type: 'number' as const, defaultValue: 0.2, min: 0.05, max: 2, step: 0.05, unit: 'kg' },
        { key: 'gravity', label: 'Gravity', type: 'number' as const, defaultValue: EARTH_GRAVITY, min: 1.6, max: 15, step: 0.1, unit: 'm/s\u00b2' },
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
    private rangeLineEl: SVGLineElement | null = null;
    private maxHeightLineEl: SVGLineElement | null = null;
    private rangeLabelEl: SVGTextElement | null = null;
    private maxHeightLabelEl: SVGTextElement | null = null;
    private groundLineEl: SVGLineElement | null = null;
    private groundFillEl: SVGRectElement | null = null;
    private launcherBaseEl: SVGCircleElement | null = null;

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
        this.rangeLineEl = null;
        this.maxHeightLineEl = null;
        this.rangeLabelEl = null;
        this.maxHeightLabelEl = null;
        this.groundLineEl = null;
        this.groundFillEl = null;
        this.launcherBaseEl = null;
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

        // Defs: glow filter
        const defs = document.createElementNS(NS, 'defs');

        const glowFilter = document.createElementNS(NS, 'filter');
        glowFilter.setAttribute('id', 'proj-glow');
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

        // Ground fill (solid area below ground line)
        this.groundFillEl = this.svgEl('rect') as unknown as SVGRectElement;
        this.groundFillEl.setAttribute('fill', '#1a2332');
        this.groundFillEl.setAttribute('opacity', '0.6');
        this.svg.appendChild(this.groundFillEl);

        // Trajectory (behind other elements)
        this.trajectoryEl = this.svgEl('polyline') as unknown as SVGPolylineElement;
        this.trajectoryEl.setAttribute('fill', 'none');
        this.trajectoryEl.setAttribute('stroke', 'var(--exp-2d-accent)');
        this.trajectoryEl.setAttribute('stroke-width', '2');
        this.trajectoryEl.setAttribute('opacity', '0.8');
        this.trajectoryEl.setAttribute('stroke-linecap', 'round');
        this.trajectoryEl.setAttribute('stroke-linejoin', 'round');
        this.svg.appendChild(this.trajectoryEl);

        // Range dashed line (shown on landing)
        this.rangeLineEl = this.svgEl('line') as unknown as SVGLineElement;
        this.rangeLineEl.setAttribute('stroke', 'var(--exp-2d-positive)');
        this.rangeLineEl.setAttribute('stroke-width', '1.5');
        this.rangeLineEl.setAttribute('stroke-dasharray', '4 3');
        this.rangeLineEl.setAttribute('opacity', '0');
        this.svg.appendChild(this.rangeLineEl);

        // Max height dashed line (shown on landing)
        this.maxHeightLineEl = this.svgEl('line') as unknown as SVGLineElement;
        this.maxHeightLineEl.setAttribute('stroke', 'var(--exp-2d-negative)');
        this.maxHeightLineEl.setAttribute('stroke-width', '1.5');
        this.maxHeightLineEl.setAttribute('stroke-dasharray', '4 3');
        this.maxHeightLineEl.setAttribute('opacity', '0');
        this.svg.appendChild(this.maxHeightLineEl);

        // Range label
        this.rangeLabelEl = this.svgEl('text') as unknown as SVGTextElement;
        this.rangeLabelEl.setAttribute('fill', 'var(--exp-2d-positive)');
        this.rangeLabelEl.setAttribute('font-size', '2.5');
        this.rangeLabelEl.setAttribute('text-anchor', 'middle');
        this.rangeLabelEl.setAttribute('opacity', '0');
        this.svg.appendChild(this.rangeLabelEl);

        // Max height label
        this.maxHeightLabelEl = this.svgEl('text') as unknown as SVGTextElement;
        this.maxHeightLabelEl.setAttribute('fill', 'var(--exp-2d-negative)');
        this.maxHeightLabelEl.setAttribute('font-size', '2.5');
        this.maxHeightLabelEl.setAttribute('text-anchor', 'start');
        this.maxHeightLabelEl.setAttribute('opacity', '0');
        this.svg.appendChild(this.maxHeightLabelEl);

        // Ground line
        this.groundLineEl = this.svgEl('line') as unknown as SVGLineElement;
        this.groundLineEl.setAttribute('stroke', 'var(--exp-2d-primary)');
        this.groundLineEl.setAttribute('stroke-width', '2');
        this.groundLineEl.setAttribute('opacity', '0.5');
        this.svg.appendChild(this.groundLineEl);

        // Launcher tube
        this.launcherTubeEl = this.svgEl('line') as unknown as SVGLineElement;
        this.launcherTubeEl.setAttribute('stroke', 'var(--exp-2d-primary)');
        this.launcherTubeEl.setAttribute('stroke-width', '2.5');
        this.launcherTubeEl.setAttribute('stroke-linecap', 'round');
        this.svg.appendChild(this.launcherTubeEl);

        // Launcher base dot
        this.launcherBaseEl = this.svgEl('circle') as unknown as SVGCircleElement;
        this.launcherBaseEl.setAttribute('r', '0.3');
        this.launcherBaseEl.setAttribute('fill', 'var(--exp-2d-primary)');
        this.launcherBaseEl.setAttribute('opacity', '0.6');
        this.svg.appendChild(this.launcherBaseEl);

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
        this.svg.appendChild(this.velocityArrowEl);

        // Landing marker
        this.landingMarkerEl = this.svgEl('circle') as unknown as SVGCircleElement;
        this.landingMarkerEl.setAttribute('r', '0.3');
        this.landingMarkerEl.setAttribute('fill', '#f87171');
        this.landingMarkerEl.setAttribute('opacity', '0');
        this.svg.appendChild(this.landingMarkerEl);

        // Projectile (on top of everything)
        this.projectileEl = this.svgEl('circle') as unknown as SVGCircleElement;
        this.projectileEl.setAttribute('r', '0.25');
        this.projectileEl.setAttribute('fill', 'var(--exp-2d-particle)');
        this.projectileEl.setAttribute('filter', 'url(#proj-glow)');
        this.svg.appendChild(this.projectileEl);

        this.container.appendChild(this.svg);
        this.resetSimulation();
    }

    // --- Private Helpers ---

    private svgEl(tag: string): SVGElement {
        return document.createElementNS(NS, tag);
    }

    /**
     * Convert physics y-coordinate to SVG y-coordinate.
     * Physics: y=0 is ground (bottom), y increases upward.
     * SVG: y=0 is top, y increases downward.
     * So svgY = viewHeight - physicsY.
     */
    private toSvgY(physicsY: number): number {
        return this.viewHeight - physicsY;
    }

    private getLaunchParams(): ProjectileLaunchParameters {
        return {
            launchSpeed: this.getSafeNumber('launchSpeed', 20, 5, 60),
            launchAngleDeg: this.getSafeNumber('launchAngle', 45, 5, 85),
            launchHeight: this.getSafeNumber('launchHeight', 0, 0, 12),
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
        const leftPad = Math.max(5, this.viewRange * 0.05);
        const topPad = Math.max(3, this.viewHeight * 0.08);
        const rightPad = Math.max(5, this.viewRange * 0.08);
        const bottomPad = Math.max(5, this.viewHeight * 0.1);
        this.svg.setAttribute('viewBox',
            `${-leftPad} ${-topPad} ${this.viewRange + leftPad + rightPad} ${this.viewHeight + topPad + bottomPad}`
        );
        this.svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    }

    private updateSVG(): void {
        if (!this.state || !this.svg) return;
        const pos = this.state.position;
        const vel = this.state.velocity;
        const angle = this.getSafeNumber('launchAngle', 45, 5, 85);
        const mass = this.getSafeNumber('mass', 0.2, 0.05, 2);
        const launchHeight = this.getSafeNumber('launchHeight', 0, 0, 12);
        const groundSvgY = this.toSvgY(0);

        // --- Ground fill (rectangle below ground line) ---
        if (this.groundFillEl) {
            this.groundFillEl.setAttribute('x', String(-20));
            this.groundFillEl.setAttribute('y', String(groundSvgY));
            this.groundFillEl.setAttribute('width', String(this.viewRange + 40));
            this.groundFillEl.setAttribute('height', String(10));
        }

        // --- Ground line ---
        if (this.groundLineEl) {
            this.groundLineEl.setAttribute('x1', String(-10));
            this.groundLineEl.setAttribute('y1', String(groundSvgY));
            this.groundLineEl.setAttribute('x2', String(this.viewRange + 10));
            this.groundLineEl.setAttribute('y2', String(groundSvgY));
        }

        // --- Projectile ---
        if (this.projectileEl) {
            const r = 0.15 + mass * 0.08;
            this.projectileEl.setAttribute('cx', String(pos.x));
            this.projectileEl.setAttribute('cy', String(this.toSvgY(pos.y)));
            this.projectileEl.setAttribute('r', String(r));
        }

        // --- Trajectory (flip y for each point) ---
        if (this.trajectoryEl) {
            const show = this.getParameter('showTrajectory');
            if (show && this.trajectory.length > 0) {
                const points = this.trajectory
                    .map((p) => `${p.x},${this.toSvgY(p.y)}`)
                    .join(' ');
                this.trajectoryEl.setAttribute('points', points);
                this.trajectoryEl.setAttribute('display', '');
            } else {
                this.trajectoryEl.setAttribute('display', 'none');
            }
        }

        // --- Landing marker (on ground at landing x) ---
        if (this.landingMarkerEl) {
            if (this.state.hasLanded) {
                this.landingMarkerEl.setAttribute('cx', String(pos.x));
                this.landingMarkerEl.setAttribute('cy', String(groundSvgY));
                this.landingMarkerEl.setAttribute('opacity', '0.7');
            } else {
                this.landingMarkerEl.setAttribute('opacity', '0');
            }
        }

        // --- Launcher tube (from origin at launch height, pointing UP at angle) ---
        if (this.launcherTubeEl) {
            const tubeLen = Math.max(1.5, this.viewRange * 0.04);
            const angleRad = angle * Math.PI / 180;
            const launchSvgY = this.toSvgY(launchHeight);
            // In SVG, "up" means decreasing y
            const endX = tubeLen * Math.cos(angleRad);
            const endSvgY = launchSvgY - tubeLen * Math.sin(angleRad);
            this.launcherTubeEl.setAttribute('x1', '0');
            this.launcherTubeEl.setAttribute('y1', String(launchSvgY));
            this.launcherTubeEl.setAttribute('x2', String(endX));
            this.launcherTubeEl.setAttribute('y2', String(endSvgY));
        }

        // --- Launcher base dot ---
        if (this.launcherBaseEl) {
            this.launcherBaseEl.setAttribute('cx', '0');
            this.launcherBaseEl.setAttribute('cy', String(this.toSvgY(launchHeight)));
        }

        // --- Angle arc (from horizontal-right, sweeping counter-clockwise = upward in SVG) ---
        if (this.angleArcEl && this.angleLabelEl) {
            const arcR = Math.max(2, this.viewRange * 0.06);
            const angleRad = angle * Math.PI / 180;
            const launchSvgY = this.toSvgY(launchHeight);
            // Start: (arcR, launchSvgY) — horizontal right
            // End: (arcR*cos(angle), launchSvgY - arcR*sin(angle)) — at launch angle upward
            const endX = arcR * Math.cos(angleRad);
            const endSvgY = launchSvgY - arcR * Math.sin(angleRad);
            // sweep-flag=0 means counter-clockwise in SVG, which goes upward
            this.angleArcEl.setAttribute('d',
                `M ${arcR},${launchSvgY} A ${arcR},${arcR} 0 0,0 ${endX},${endSvgY}`
            );

            // Label at midpoint of the arc
            const midAngle = angleRad / 2;
            const labelR = arcR + 1.5;
            const labelSvgX = labelR * Math.cos(midAngle);
            const labelSvgY = launchSvgY - labelR * Math.sin(midAngle) + 1;
            this.angleLabelEl.setAttribute('x', String(labelSvgX));
            this.angleLabelEl.setAttribute('y', String(labelSvgY));
            this.angleLabelEl.textContent = `${angle}\u00b0`;
        }

        // --- Velocity arrow (from projectile, direction flipped y) ---
        if (this.velocityArrowEl && !this.state.hasLanded) {
            const speed = Math.sqrt(vel.x ** 2 + vel.y ** 2);
            if (speed > 0.1) {
                const arrowLen = Math.min(this.viewRange * 0.08, speed * 0.15);
                const nx = vel.x / speed;
                const ny = vel.y / speed; // positive = upward in physics
                const startSvgX = pos.x;
                const startSvgY = this.toSvgY(pos.y);
                // Arrow end: x follows velocity normally, y is inverted for SVG
                this.velocityArrowEl.setAttribute('x1', String(startSvgX));
                this.velocityArrowEl.setAttribute('y1', String(startSvgY));
                this.velocityArrowEl.setAttribute('x2', String(startSvgX + nx * arrowLen));
                this.velocityArrowEl.setAttribute('y2', String(startSvgY - ny * arrowLen));
                this.velocityArrowEl.setAttribute('display', '');
            } else {
                this.velocityArrowEl.setAttribute('display', 'none');
            }
        } else if (this.velocityArrowEl) {
            this.velocityArrowEl.setAttribute('display', 'none');
        }

        // --- Range line + label (shown when landed) ---
        if (this.rangeLineEl && this.rangeLabelEl) {
            if (this.state.hasLanded) {
                const rangeY = groundSvgY + 2.5; // below ground
                this.rangeLineEl.setAttribute('x1', '0');
                this.rangeLineEl.setAttribute('y1', String(rangeY));
                this.rangeLineEl.setAttribute('x2', String(pos.x));
                this.rangeLineEl.setAttribute('y2', String(rangeY));
                this.rangeLineEl.setAttribute('opacity', '0.6');

                this.rangeLabelEl.setAttribute('x', String(pos.x / 2));
                this.rangeLabelEl.setAttribute('y', String(rangeY + 3));
                this.rangeLabelEl.textContent = `R = ${pos.x.toFixed(1)} m`;
                this.rangeLabelEl.setAttribute('opacity', '0.9');
            } else {
                this.rangeLineEl.setAttribute('opacity', '0');
                this.rangeLabelEl.setAttribute('opacity', '0');
            }
        }

        // --- Max height line + label (shown when landed) ---
        if (this.maxHeightLineEl && this.maxHeightLabelEl) {
            if (this.state.hasLanded) {
                const mh = this.state.maxHeight;
                const mhSvgY = this.toSvgY(mh);
                this.maxHeightLineEl.setAttribute('x1', String(pos.x));
                this.maxHeightLineEl.setAttribute('y1', String(groundSvgY));
                this.maxHeightLineEl.setAttribute('x2', String(pos.x));
                this.maxHeightLineEl.setAttribute('y2', String(mhSvgY));
                this.maxHeightLineEl.setAttribute('opacity', '0.6');

                this.maxHeightLabelEl.setAttribute('x', String(pos.x + 1.5));
                this.maxHeightLabelEl.setAttribute('y', String((groundSvgY + mhSvgY) / 2 + 1));
                this.maxHeightLabelEl.textContent = `H = ${mh.toFixed(1)} m`;
                this.maxHeightLabelEl.setAttribute('opacity', '0.9');
            } else {
                this.maxHeightLineEl.setAttribute('opacity', '0');
                this.maxHeightLabelEl.setAttribute('opacity', '0');
            }
        }
    }
}
