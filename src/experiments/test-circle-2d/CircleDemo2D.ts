import type { ExperimentConfig2D, DisplayValue } from '../base';
import { ExperimentBase2D } from '../base';
import { registerExperiment2D } from '../base';

const metadata = {
    id: 'circle-demo-2d',
    name: '2D Pipeline Test',
    category: 'atomic' as const,
    description: 'Minimal 2D experiment to validate the rendering pipeline.',
    difficulty: 'basic' as const,
    duration: 1,
    keywords: ['test', '2d'],
    thumbnail: '',
    renderMode: '2d' as const,
};

const config: ExperimentConfig2D = {
    parameters: [
        {
            key: 'radius',
            label: 'Radius',
            type: 'number' as const,
            defaultValue: 50,
            min: 10,
            max: 200,
            step: 1,
            unit: 'px',
        },
        {
            key: 'speed',
            label: 'Speed',
            type: 'number' as const,
            defaultValue: 2,
            min: 0.5,
            max: 10,
            step: 0.5,
            unit: 'Hz',
        },
    ],
};

@registerExperiment2D('circle-demo-2d')
export class CircleDemo2D extends ExperimentBase2D {
    readonly metadata = metadata;
    readonly config = config;

    private phase = 0;

    protected async setupScene(): Promise<void> {
        if (!this.container) return;

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 400 400');
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.style.display = 'block';

        // Background
        const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bg.setAttribute('width', '400');
        bg.setAttribute('height', '400');
        bg.setAttribute('fill', 'var(--exp-2d-bg)');
        svg.appendChild(bg);

        // Pulsing circle
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', '200');
        circle.setAttribute('cy', '200');
        circle.setAttribute('fill', 'var(--exp-2d-primary)');
        circle.setAttribute('opacity', '0.6');
        circle.id = 'pulse-circle';
        svg.appendChild(circle);

        // Label
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', '200');
        text.setAttribute('y', '380');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', 'var(--exp-2d-text)');
        text.setAttribute('font-size', '14');
        text.textContent = '2D Pipeline Active';
        svg.appendChild(text);

        this.container.appendChild(svg);
    }

    update(deltaTime: number): void {
        this.phase += deltaTime * this.getSafeNumber('speed', 2, 0.5, 10);
        const radius = this.getSafeNumber('radius', 50, 10, 200);
        const pulseRadius = radius + Math.sin(this.phase * Math.PI * 2) * radius * 0.3;

        const circle = this.container?.querySelector('#pulse-circle') as SVGCircleElement | null;
        if (circle) {
            circle.setAttribute('r', String(Math.max(1, pulseRadius)));
        }
    }

    getDisplayData(): Record<string, DisplayValue> {
        return {
            phase: { label: 'Phase', value: (this.phase % 1).toFixed(2), unit: 'cycles' },
            radius: { label: 'Radius', value: this.getParameter('radius') as number, unit: 'px' },
        };
    }

    override reset(): void {
        super.reset();
        this.phase = 0;
    }

    onResize(_width: number, _height: number): void {
        // Could update viewBox to match container aspect ratio
    }
}
