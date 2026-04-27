# Task 2.2 - Object Control Tab Visual Summary

## Component Structure

```
ObjectControlTab
├── Add Object Section
│   ├── [Sphere]   - Green circle icon + "Sphere" label
│   ├── [Box]      - Blue square icon + "Box" label
│   └── [Plank]    - Yellow rectangle icon + "Plank" label
│
├── Objects List Section
│   └── Objects (3)
│       ├── 🟢 Sphere [🗑️]
│       ├── 🔵 Box [🗑️]
│       └── 🟡 Plank [🗑️]
│
└── Parameters Section (when object selected)
    ├── Mass Slider (0.1-10 kg)
    └── Initial Velocity
        ├── Vx: [0.00]
        ├── Vy: [0.00]
        └── Vz: [0.00]
```

## Key Features

### 1. Add Object Buttons
- **3-column grid layout**
- **Visual icons** representing object types
- **Hover effects** for interactivity
- **Click handlers** for adding objects

### 2. Objects List
- **Scrollable** (max-height: 15rem)
- **Color-coded indicators**
  - 🟢 Green = Sphere
  - 🔵 Blue = Box
  - 🟡 Yellow = Plank
- **Selection highlighting**
  - Selected: Blue background with blue border
  - Unselected: Dark background with white border
- **Delete button** on each item (Trash icon)

### 3. Parameters Panel
- **Conditional rendering** (only shows when object selected)
- **Mass slider**
  - Range: 0.1 - 10 kg
  - Step: 0.1 kg
  - Live value display
- **Velocity controls**
  - Vx, Vy, Vz inputs
  - Number type
  - 2 decimal places
  - Real-time updates

## Styling

### Colors
- **Background**: `bg-slate-800`
- **Border**: `border-white/10`
- **Text**: `text-white`, `text-slate-300`, `text-slate-400`
- **Selection**: `bg-blue-600/20 border-blue-500`
- **Delete**: `text-red-400`, `hover:bg-red-600`

### Interactions
- **Hover**: `hover:bg-slate-700`
- **Transition**: `transition-colors`
- **Rounded corners**: `rounded-lg`
- **Spacing**: `gap-2`, `p-3`

## Data Flow

```
User Action → Component Callback → Parent Handler
─────────────────────────────────────────────────
Click "Sphere" → onAddObject('sphere') → Create sphere
Click "Delete" → onRemoveObject(id) → Remove object
Change mass → onUpdateObject(id, {mass}) → Update mass
Change velocity → onUpdateObject(id, {velocity}) → Update velocity
```

## TypeScript Types

```typescript
interface ObjectControlTabProps {
  objects: Map<string, SimulationObject>;
  onAddObject: (type: 'sphere' | 'box' | 'plank') => void;
  onRemoveObject: (id: string) => void;
  onUpdateObject: (id: string, params: any) => void;
}

function ObjectParams({
  object: SimulationObject;
  onUpdate: (params: any) => void;
}
```

## Component Props Example

```typescript
<ObjectControlTab
  objects={objectsMap}
  onAddObject={(type) => experiment?.addObject(type)}
  onRemoveObject={(id) => experiment?.removeObject(id)}
  onUpdateObject={(id, params) => experiment?.updateObject(id, params)}
/>
```

## File Location

**Path**: `/Users/hl/Projects/atomic_physics/src/components/experiment/ControlTab.tsx`

**Exports**:
- `ControlTab` - Main tab container (existing)
- `ObjectControlTab` - New object control component ✨

## Import Example

```typescript
import { ObjectControlTab } from '@/components/experiment/ControlTab';
```

## Next Integration Steps

To use this component in the experiment:

1. Import ObjectControlTab
2. Pass objects Map from experiment state
3. Connect add/remove/update handlers
4. Update ControlContent to use ObjectControlTab

Example:
```typescript
function ControlContent() {
  const { objects } = useExperimentStore();

  return (
    <ObjectControlTab
      objects={objects}
      onAddObject={(type) => addObject(type)}
      onRemoveObject={(id) => removeObject(id)}
      onUpdateObject={(id, params) => updateObject(id, params)}
    />
  );
}
```
