import React from 'react';
import { SCENE_PRESETS, type ScenePreset } from '@/experiments/mechanics/motion-collision/presets/ScenePresets';

interface ScenePresetSelectorProps {
  onLoadPreset: (preset: ScenePreset) => void;
}

/**
 * Scene Preset Selector Component (Task 7.3)
 * Allows users to quickly load predefined experiment scenarios
 */
export function ScenePresetSelector({ onLoadPreset }: ScenePresetSelectorProps) {
  return (
    <div className="space-y-2">
      <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
        Quick Start
      </span>
      <div className="grid grid-cols-1 gap-2">
        {SCENE_PRESETS.map(preset => (
          <button
            key={preset.id}
            onClick={() => onLoadPreset(preset)}
            className="flex flex-col items-start p-3 bg-slate-800 hover:bg-slate-700 rounded-lg border border-white/10 transition-all text-left group"
          >
            <div className="flex items-center justify-between w-full mb-1">
              <span className="text-sm font-medium text-slate-200 group-hover:text-white">
                {preset.name}
              </span>
              <span className="text-xs text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                Load →
              </span>
            </div>
            <span className="text-xs text-slate-400">
              {preset.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
