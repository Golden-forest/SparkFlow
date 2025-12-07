import { create } from 'zustand';
import type { IExperiment } from '@/experiments/base';
import { SimulationState } from '@/utils/constants';

interface SimulationStore {
    // 状态
    state: SimulationState;
    currentExperiment: IExperiment | null;
    elapsedTime: number;
    deltaTime: number;

    // 动作
    setExperiment: (experiment: IExperiment | null) => void;
    setState: (state: SimulationState) => void;
    start: () => void;
    pause: () => void;
    resume: () => void;
    reset: () => void;
    tick: (deltaTime: number) => void;
}

export const useSimulationStore = create<SimulationStore>((set, get) => ({
    state: SimulationState.Idle,
    currentExperiment: null,
    elapsedTime: 0,
    deltaTime: 0,

    setExperiment: (experiment) => {
        const prev = get().currentExperiment;
        if (prev) {
            prev.dispose();
        }
        set({
            currentExperiment: experiment,
            state: SimulationState.Idle,
            elapsedTime: 0,
        });
    },

    setState: (state) => set({ state }),

    start: () => {
        const { currentExperiment } = get();
        if (currentExperiment) {
            currentExperiment.start();
            set({ state: SimulationState.Running });
        }
    },

    pause: () => {
        const { currentExperiment } = get();
        if (currentExperiment) {
            currentExperiment.pause();
            set({ state: SimulationState.Paused });
        }
    },

    resume: () => {
        const { currentExperiment } = get();
        if (currentExperiment) {
            currentExperiment.resume();
            set({ state: SimulationState.Running });
        }
    },

    reset: () => {
        const { currentExperiment } = get();
        if (currentExperiment) {
            currentExperiment.reset();
            set({ state: SimulationState.Idle, elapsedTime: 0 });
        }
    },

    tick: (deltaTime) => {
        const { state, currentExperiment, elapsedTime } = get();
        if (state === SimulationState.Running && currentExperiment) {
            currentExperiment.update(deltaTime);
            set({
                deltaTime,
                elapsedTime: elapsedTime + deltaTime,
            });
        }
    },
}));
