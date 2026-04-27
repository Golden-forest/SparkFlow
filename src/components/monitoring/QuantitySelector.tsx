import React from 'react';

/**
 * Monitored quantity interface
 */
export interface MonitoredQuantity {
  id: string;              // Unique identifier
  name: string;            // Display name
  unit: string;            // Unit
  color: string;           // Chart color
  currentValue: number;    // Current value
}

/**
 * Props for QuantitySelector component
 */
export interface QuantitySelectorProps {
  quantities: MonitoredQuantity[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

/**
 * Physical quantity selector component
 *
 * Provides a checkbox list for selecting quantities to monitor,
 * with support for select all/deselect all and color indicators.
 *
 * @component
 */
export function QuantitySelector({
  quantities,
  selectedIds,
  onChange,
}: QuantitySelectorProps) {
  /**
   * Toggle selection of a single quantity
   */
  const handleToggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(sid => sid !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  /**
   * Select all quantities
   */
  const handleSelectAll = () => {
    onChange(quantities.map(q => q.id));
  };

  /**
   * Deselect all quantities
   */
  const handleDeselectAll = () => {
    onChange([]);
  };

  return (
    <div>
      {/* Header with title and select all/none buttons */}
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
          Monitor Quantities
        </span>
        <div className="flex gap-1">
          <button
            onClick={handleSelectAll}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            All
          </button>
          <span className="text-slate-600">|</span>
          <button
            onClick={handleDeselectAll}
            className="text-xs text-slate-400 hover:text-slate-300 transition-colors"
          >
            None
          </button>
        </div>
      </div>

      {/* Checkbox list */}
      <div className="space-y-2">
        {quantities.map(quantity => (
          <label
            key={quantity.id}
            className="flex items-center gap-2 cursor-pointer hover:bg-white/5 rounded p-1 transition-colors"
          >
            <input
              type="checkbox"
              checked={selectedIds.includes(quantity.id)}
              onChange={() => handleToggle(quantity.id)}
              className="rounded border-slate-600 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 focus:ring-1"
              aria-label={`Toggle ${quantity.name} monitoring`}
              aria-checked={selectedIds.includes(quantity.id)}
            />
            {/* Color indicator */}
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: quantity.color }}
              title={`Color: ${quantity.color}`}
            />
            {/* Quantity name */}
            <span className="text-sm text-slate-300 select-none">{quantity.name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
