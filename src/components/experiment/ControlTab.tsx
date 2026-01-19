import React, { useState, useMemo } from 'react';
import { Trash2 } from 'lucide-react';
import * as THREE from 'three';
import { PhysicsMonitor } from '@/components/monitoring/PhysicsMonitor';
import type { MonitoredQuantity } from '@/components/monitoring/QuantitySelector';
import { useSimulationStore } from '@/stores/simulationStore';
import type { SimulationObject } from '@/experiments/mechanics/motion-collision/types/ObjectTypes';

interface ObjectControlTabProps {
  objects: Map<string, SimulationObject>;
  onAddObject: (type: 'sphere' | 'box' | 'plank') => void;
  onRemoveObject: (id: string) => void;
  onUpdateObject: (id: string, params: Partial<SimulationObject>) => void;
}

/**
 * Props for flexible ControlTab component (Task 5.1)
 */
export interface ControlTabProps {
  controlContent?: React.ReactNode;
  monitorContent?: React.ReactNode;
}

/**
 * Flexible ControlTab component that accepts custom content
 * Used for pendulum and motion-collision experiments
 */
export const ControlTab = React.memo(({ controlContent, monitorContent }: ControlTabProps) => {
  const [activeTab, setActiveTab] = useState<'control' | 'monitor'>('control');

  return (
    <div className="flex flex-col gap-4">
      {/* Tab按钮 */}
      <div className="flex gap-2 border-b border-white/10 pb-2">
        <button
          onClick={() => setActiveTab('control')}
          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
            activeTab === 'control'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          }`}
        >
          Control
        </button>
        <button
          onClick={() => setActiveTab('monitor')}
          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
            activeTab === 'monitor'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          }`}
        >
          Monitor
        </button>
      </div>

      {/* Tab内容 */}
      {activeTab === 'control' ? controlContent : monitorContent}
    </div>
  );
});

ControlTab.displayName = 'ControlTab';

function ControlContent() {
  // Demo: Show ObjectControlTab with sample data
  const demoObjects = new Map<string, SimulationObject>([
    ['demo-1', {
      id: 'demo-1',
      type: 'sphere' as const,
      position: new THREE.Vector3(0, 1, 0),
      velocity: new THREE.Vector3(0, 0, 0),
      mass: 1.0,
      radius: 0.5,
      mesh: null as unknown as THREE.Mesh, // Not needed for UI demo
      trajectory: [],
      isSelected: false,
    }]
  ]);

  const handleAdd = () => console.log('Add object');
  const handleRemove = () => console.log('Remove object');
  const handleUpdate = () => console.log('Update object');

  return (
    <ObjectControlTab
      objects={demoObjects}
      onAddObject={handleAdd}
      onRemoveObject={handleRemove}
      onUpdateObject={handleUpdate}
    />
  );
}

function MonitorContent() {
  const [selectedQuantities, setSelectedQuantities] = useState<string[]>(['velocity', 'position']);
  const [isExpanded, setIsExpanded] = useState(true);

  // Get monitoring history from store
  const history = useSimulationStore(state => state.monitoringHistory);
  // TODO: Task 2.4 - Populate history with real-time physics data from simulation engine

  // Demo objects for initial implementation
  const demoObjects = useMemo(() => new Map<string, SimulationObject>([
    ['demo-1', {
      id: 'demo-1',
      type: 'sphere' as const,
      position: new THREE.Vector3(0, 1, 0),
      velocity: new THREE.Vector3(2, 0, 0),
      mass: 1.0,
      radius: 0.5,
      mesh: null as unknown as THREE.Mesh,
      trajectory: [],
      isSelected: false,
    }]
  ]), []);

  // Compute current values for each monitored quantity
  const monitoredQuantities: MonitoredQuantity[] = useMemo(() => {
    const obj = demoObjects.get('demo-1');
    if (!obj) {
      console.warn('[MonitorContent] No demo objects available for monitoring');
      return [];
    }

    return [
      {
        id: 'velocity',
        name: 'Velocity',
        unit: 'm/s',
        color: '#00ff41',
        currentValue: obj.velocity.length(),
      },
      {
        id: 'acceleration',
        name: 'Acceleration',
        unit: 'm/s²',
        color: '#ff6b6b',
        currentValue: 1.5, // Demo value - will be calculated from physics engine in Task 2.4
      },
      {
        id: 'momentum',
        name: 'Momentum',
        unit: 'kg·m/s',
        color: '#60a5fa',
        currentValue: obj.velocity.length() * obj.mass,
      },
      {
        id: 'kineticEnergy',
        name: 'Kinetic Energy',
        unit: 'J',
        color: '#fbbf24',
        currentValue: 0.5 * obj.mass * Math.pow(obj.velocity.length(), 2),
      },
      {
        id: 'position',
        name: 'Position',
        unit: 'm',
        color: '#a78bfa',
        currentValue: obj.position.length(),
      },
    ];
  }, [demoObjects]);

  return (
    <PhysicsMonitor
      quantities={monitoredQuantities}
      history={history}
      selectedQuantities={selectedQuantities}
      onSelectionChange={setSelectedQuantities}
      isExpanded={isExpanded}
      onToggleExpand={() => setIsExpanded(!isExpanded)}
    />
  );
}

export function ObjectControlTab({
  objects,
  onAddObject,
  onRemoveObject,
  onUpdateObject,
}: ObjectControlTabProps) {
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      {/* 添加物体按钮组 */}
      <div className="space-y-2">
        <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
          Add Object
        </span>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => onAddObject('sphere')}
            className="flex flex-col items-center gap-1 p-3 bg-slate-800 hover:bg-slate-700 rounded-lg border border-white/10 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-green-500"></div>
            <span className="text-xs text-slate-300">Sphere</span>
          </button>
          <button
            onClick={() => onAddObject('box')}
            className="flex flex-col items-center gap-1 p-3 bg-slate-800 hover:bg-slate-700 rounded-lg border border-white/10 transition-colors"
          >
            <div className="w-8 h-8 bg-blue-500"></div>
            <span className="text-xs text-slate-300">Box</span>
          </button>
          <button
            onClick={() => onAddObject('plank')}
            className="flex flex-col items-center gap-1 p-3 bg-slate-800 hover:bg-slate-700 rounded-lg border border-white/10 transition-colors"
          >
            <div className="w-12 h-3 bg-yellow-700"></div>
            <span className="text-xs text-slate-300">Plank</span>
          </button>
        </div>
      </div>

      {/* 物体列表 */}
      <div className="space-y-2">
        <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
          Objects ({objects.size})
        </span>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {Array.from(objects.values()).map(obj => (
            <div
              key={obj.id}
              className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                selectedObjectId === obj.id
                  ? 'bg-blue-600/20 border-blue-500'
                  : 'bg-slate-800 border-white/10 hover:bg-slate-700'
              }`}
              onClick={() => setSelectedObjectId(obj.id)}
            >
              <div className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded-full ${
                  obj.type === 'sphere' ? 'bg-green-500' :
                  obj.type === 'box' ? 'bg-blue-500' :
                  'bg-yellow-700'
                }`} />
                <span className="text-sm text-white">{obj.type}</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveObject(obj.id);
                }}
                className="p-1 hover:bg-red-600 rounded transition-colors"
              >
                <Trash2 size={16} className="text-red-400" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 选中物体的参数控制 */}
      {selectedObjectId && (
        <ObjectParams
          object={objects.get(selectedObjectId)!}
          onUpdate={(params) => onUpdateObject(selectedObjectId, params)}
        />
      )}
    </div>
  );
}

function ObjectParams({
  object,
  onUpdate,
}: {
  object: SimulationObject;
  onUpdate: (params: Partial<SimulationObject>) => void;
}) {
  return (
    <div className="space-y-3">
      <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
        Parameters
      </span>

      {/* 质量滑块 */}
      <div>
        <div className="flex justify-between text-sm mb-1">
          <span className="text-slate-300">Mass</span>
          <span className="text-blue-400">{object.mass.toFixed(1)} kg</span>
        </div>
        <input
          type="range"
          min={0.1}
          max={10}
          step={0.1}
          value={object.mass}
          onChange={(e) => onUpdate({ mass: parseFloat(e.target.value) })}
          className="w-full"
        />
      </div>

      {/* 初速度控制 */}
      <div className="space-y-2">
        <span className="text-xs text-slate-300">Initial Velocity</span>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-xs text-slate-400">Vx</label>
            <input
              type="number"
              value={object.velocity.x.toFixed(2)}
              onChange={(e) => {
                const newVel = object.velocity.clone();
                newVel.x = parseFloat(e.target.value) || 0;
                onUpdate({ velocity: newVel });
              }}
              className="w-full bg-slate-800 border border-white/10 rounded px-2 py-1 text-white text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">Vy</label>
            <input
              type="number"
              value={object.velocity.y.toFixed(2)}
              onChange={(e) => {
                const newVel = object.velocity.clone();
                newVel.y = parseFloat(e.target.value) || 0;
                onUpdate({ velocity: newVel });
              }}
              className="w-full bg-slate-800 border border-white/10 rounded px-2 py-1 text-white text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">Vz</label>
            <input
              type="number"
              value={object.velocity.z.toFixed(2)}
              onChange={(e) => {
                const newVel = object.velocity.clone();
                newVel.z = parseFloat(e.target.value) || 0;
                onUpdate({ velocity: newVel });
              }}
              className="w-full bg-slate-800 border border-white/10 rounded px-2 py-1 text-white text-sm"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
