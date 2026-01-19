import React, { useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Panel, Group, Separator } from 'react-resizable-panels';
import { QuantitySelector, type MonitoredQuantity } from './QuantitySelector';
import { QuantityChart } from './QuantityChart';

/**
 * Historical data for each monitored quantity
 */
export interface QuantityHistory {
  [quantityId: string]: number[];
}

/**
 * Props for PhysicsMonitor component
 */
export interface PhysicsMonitorProps {
  quantities: MonitoredQuantity[];      // List of monitored quantities
  history: QuantityHistory;              // Historical data
  selectedQuantities: string[];          // User-selected quantity IDs
  onSelectionChange: (ids: string[]) => void;
  isExpanded: boolean;                   // Whether panel is expanded
  onToggleExpand: () => void;            // Toggle expand/collapse
}

/**
 * Draggable monitoring panel for real-time physics quantity visualization
 *
 * Features:
 * - Collapsible/expandable panel (click arrow to toggle)
 * - Resizable width using react-resizable-panels
 * - Integrates QuantitySelector and QuantityChart components
 * - Shows real-time values and charts for selected quantities
 * - Glassmorphism design matching SideToolbar pattern
 *
 * Layout:
 * - When collapsed: Shows only a toggle arrow button on the right edge
 * - When expanded: Shows full panel with selector, values, and charts
 *
 * @component
 */
export function PhysicsMonitor({
  quantities,
  history,
  selectedQuantities,
  onSelectionChange,
  isExpanded,
  onToggleExpand,
}: PhysicsMonitorProps): JSX.Element {
  /**
   * Validate selectedQuantities against available quantities
   * Auto-cleanup invalid selections to prevent undefined access
   */
  const validSelectedQuantities = useMemo(
    () =>
      selectedQuantities.filter((id) => quantities.some((q) => q.id === id)),
    [selectedQuantities, quantities]
  );

  /**
   * Auto-cleanup invalid selections
   */
  useEffect(() => {
    if (validSelectedQuantities.length !== selectedQuantities.length) {
      onSelectionChange(validSelectedQuantities);
    }
  }, [validSelectedQuantities, selectedQuantities.length, onSelectionChange]);

  /**
   * Render collapsed state - just a toggle button
   */
  if (!isExpanded) {
    return (
      <button
        onClick={onToggleExpand}
        className="absolute right-0 top-1/2 -translate-y-1/2 bg-slate-800/90 backdrop-blur-md p-2 rounded-l-lg border border-l border-white/10 hover:bg-slate-700 transition-colors z-50"
        aria-label="Expand Physics Monitor"
        aria-expanded={false}
      >
        <ChevronLeft size={20} className="text-white" />
      </button>
    );
  }

  /**
   * Render expanded state - full monitoring panel
   */
  return (
    <div className="absolute right-0 top-20 bottom-8 flex z-50">
      <Group orientation="horizontal">
        {/* 3D scene area (auto-resized by parent) */}
        <Panel defaultSize={70} minSize={30} maxSize={85}>
          {/* Empty - this is where the 3D scene renders */}
        </Panel>

        {/* Resizable handle */}
        <Separator className="w-1 bg-white/10 hover:bg-white/20 cursor-col-resize transition-colors" />

        {/* Monitoring panel */}
        <Panel defaultSize={30} minSize={15} maxSize={50}>
          <div className="w-full h-full bg-slate-900/90 backdrop-blur-md rounded-l-2xl border border-white/10 p-5 overflow-y-auto">
            {/* Header with title and toggle button */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">Physics Monitor</h3>
              <button
                onClick={onToggleExpand}
                className="p-1 hover:bg-white/10 rounded transition-colors"
                aria-label="Collapse Physics Monitor"
                aria-expanded={true}
              >
                <ChevronRight size={20} className="text-slate-400 hover:text-white" />
              </button>
            </div>

            {/* Quantity selector */}
            <QuantitySelector
              quantities={quantities}
              selectedIds={validSelectedQuantities}
              onChange={onSelectionChange}
            />

            <div className="h-px bg-white/10 my-4" />

            {/* Real-time values display */}
            <div className="space-y-3 mb-4">
              {validSelectedQuantities.map((id) => {
                const quantity = quantities.find((q) => q.id === id);
                return quantity ? (
                  <div
                    key={id}
                    className="bg-slate-800/50 rounded-lg p-3 border border-white/5"
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        {/* Color indicator */}
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: quantity.color }}
                        />
                        <span className="text-sm text-slate-400">{quantity.name}</span>
                      </div>
                      <span className="text-lg font-mono text-white">
                        {quantity.currentValue.toFixed(2)}
                        <span className="text-slate-500 ml-1 text-sm">{quantity.unit}</span>
                      </span>
                    </div>
                  </div>
                ) : null;
              })}

              {/* Empty state */}
              {validSelectedQuantities.length === 0 && (
                <div className="text-center py-8 text-slate-500 text-sm">
                  No quantities selected.<br />
                  Select quantities above to monitor.
                </div>
              )}
            </div>

            {/* Real-time charts */}
            {validSelectedQuantities.length > 0 && (
              <>
                <div className="h-px bg-white/10 my-4" />
                <div className="space-y-4">
                  {validSelectedQuantities.map((id) => {
                    const quantity = quantities.find(q => q.id === id);
                    return quantity ? (
                      <div key={id}>
                        <div className="flex items-center gap-2 mb-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: quantity.color }}
                          />
                          <span className="text-xs text-slate-400">{quantity.name}</span>
                        </div>
                        <QuantityChart
                          data={history[id] || []}
                          color={quantity.color}
                          unit={quantity.unit}
                        />
                      </div>
                    ) : null;
                  })}
                </div>
              </>
            )}
          </div>
        </Panel>
      </Group>
    </div>
  );
}
