import { create } from 'zustand';
import type { ExperimentInstance } from '@/experiments/base';
import { SimulationState } from '@/utils/constants';

/**
 * Historical data for monitored quantities
 */
export interface MonitoringHistory {
  [quantityId: string]: number[];
}

interface SimulationStore {
    // 状态
    state: SimulationState;
    currentExperiment: ExperimentInstance | null;
    elapsedTime: number;
    deltaTime: number;
    monitoringHistory: MonitoringHistory;

    // 动作
    setExperiment: (experiment: ExperimentInstance | null) => void;
    setState: (state: SimulationState) => void;
    start: () => void;
    pause: () => void;
    resume: () => void;
    reset: () => void;
    tick: (deltaTime: number) => void;
    updateMonitoringHistory: (quantityId: string, value: number) => void;
}

export const useSimulationStore = create<SimulationStore>((set, get) => ({
    state: SimulationState.Idle,
    currentExperiment: null,
    elapsedTime: 0,
    deltaTime: 0,
    monitoringHistory: {},

    setExperiment: (experiment) => {
        const prev = get().currentExperiment;
        if (prev) {
            prev.dispose();
        }
        set({
            currentExperiment: experiment,
            state: SimulationState.Idle,
            elapsedTime: 0,
            monitoringHistory: {},
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
            set({ state: SimulationState.Idle, elapsedTime: 0, monitoringHistory: {} });
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

    updateMonitoringHistory: (quantityId: string, value: number) => set(state => {
        const currentHistory = state.monitoringHistory[quantityId] || [];
        const newHistory = [...currentHistory, value].slice(-100); // 保留最新100个数据点

        return {
            monitoringHistory: {
                ...state.monitoringHistory,
                [quantityId]: newHistory,
            },
        };
    }),
}));
