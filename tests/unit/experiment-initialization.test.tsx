import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IExperiment, IExperiment2D } from '@/experiments/base';
import { ExperimentCanvas2D } from '@/components/simulation/ExperimentCanvas2D';
import { ExperimentScene } from '@/components/simulation/ExperimentScene';
import { ErrorBoundary } from '@/platform/ErrorBoundary';

const runtime = vi.hoisted(() => ({ tick: vi.fn(), scene: {} }));
vi.mock('@/stores/simulationStore', () => ({ useSimulationStore: () => runtime.tick }));
vi.mock('@react-three/fiber', () => ({ useThree: () => ({ scene: runtime.scene }) }));

function makeExperiment(init: IExperiment2D['init']): IExperiment2D {
  return {
    metadata: { id: 'test', name: 'Test', category: 'mechanics', description: '', difficulty: 'basic', duration: 1, keywords: [], thumbnail: '', renderMode: '2d' },
    config: { parameters: [] },
    init,
    start: vi.fn(), pause: vi.fn(), resume: vi.fn(), reset: vi.fn(), dispose: vi.fn(),
    update: vi.fn(), setParameter: vi.fn(), getParameter: () => 0, getDisplayData: () => ({}),
  };
}

let nextFrame: FrameRequestCallback;
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { nextFrame = callback; return 1; }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});
afterEach(() => vi.unstubAllGlobals());

describe('experiment initialization boundary', () => {
  it('shows recovery when asynchronous 2D initialization fails', async () => {
    const experiment = makeExperiment(vi.fn().mockRejectedValue(new Error('Internal failure')));
    render(<ErrorBoundary><ExperimentCanvas2D experiment={experiment} /></ErrorBoundary>);
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');
  });

  it('does not advance simulation before initialization completes', async () => {
    let complete!: () => void;
    const pending = new Promise<void>((resolve) => { complete = resolve; });
    const experiment = makeExperiment(() => pending);
    experiment.onResize = vi.fn();
    const view = render(<ExperimentCanvas2D experiment={experiment} />);
    Object.defineProperties(view.container.firstElementChild, {
      clientWidth: { value: 640 }, clientHeight: { value: 360 },
    });
    act(() => nextFrame(0));
    expect(runtime.tick).not.toHaveBeenCalled();
    await act(async () => { complete(); await pending; });
    expect(experiment.onResize).toHaveBeenLastCalledWith(640, 360);
    act(() => nextFrame(1));
    expect(runtime.tick).toHaveBeenCalledOnce();
    view.unmount();
    expect(experiment.dispose).toHaveBeenCalledOnce();
  });

  it('ignores a rejected initialization after unmount', async () => {
    let fail!: (error: Error) => void;
    const pending = new Promise<void>((_resolve, reject) => { fail = reject; });
    const experiment = makeExperiment(() => pending);
    const view = render(<ExperimentCanvas2D experiment={experiment} />);
    await act(async () => { await Promise.resolve(); });
    view.unmount();
    await act(async () => { fail(new Error('Late failure')); });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(experiment.dispose).toHaveBeenCalledOnce();
  });

  it('shows recovery when asynchronous 3D initialization fails', async () => {
    const experiment: IExperiment = {
      ...makeExperiment(() => Promise.resolve()),
      config: { physics: {}, camera: { position: [0, 0, 1], target: [0, 0, 0] }, parameters: [] },
      init: vi.fn().mockRejectedValue(new Error('Internal failure')),
    };
    render(<ErrorBoundary><ExperimentScene experiment={experiment} /></ErrorBoundary>);
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');
  });
});
