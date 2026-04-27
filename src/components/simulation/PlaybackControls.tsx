import { Play, Pause, RotateCcw } from 'lucide-react';
import { useSimulationStore } from '@/stores/simulationStore';
import { SimulationState } from '@/utils/constants';

interface PlaybackControlsProps {
    onStart?: () => void;
    onPause?: () => void;
    onReset?: () => void;
}

export function PlaybackControls({ onStart, onPause, onReset }: PlaybackControlsProps) {
    const { state, start, pause, resume, reset } = useSimulationStore();

    const handlePlayPause = () => {
        if (state === SimulationState.Running) {
            pause();
            onPause?.();
        } else if (state === SimulationState.Paused) {
            resume();
        } else {
            start();
            onStart?.();
        }
    };

    const handleReset = () => {
        reset();
        onReset?.();
    };

    const isPlaying = state === SimulationState.Running;

    return (
        <div className="flex gap-2">
            <button
                onClick={handlePlayPause}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-white font-medium hover:bg-blue-700 transition-colors"
            >
                {isPlaying ? (
                    <>
                        <Pause size={18} />
                        <span>Pause</span>
                    </>
                ) : (
                    <>
                        <Play size={18} />
                        <span>{state === SimulationState.Paused ? 'Resume' : 'Start'}</span>
                    </>
                )}
            </button>
            <button
                onClick={handleReset}
                className="flex items-center justify-center gap-2 rounded-lg bg-slate-700 px-4 py-2.5 text-white font-medium hover:bg-slate-600 transition-colors"
            >
                <RotateCcw size={18} />
                <span>Reset</span>
            </button>
        </div>
    );
}

export default PlaybackControls;
