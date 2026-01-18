/**
 * Monitoring components for real-time physics quantity visualization
 *
 * This module provides components for displaying and monitoring physical quantities
 * in real-time, including value displays and charts.
 *
 * @module monitoring
 */

export { PhysicsMonitor } from './PhysicsMonitor';
export { QuantityChart } from './QuantityChart';
export { QuantitySelector } from './QuantitySelector';

export type { MonitoredQuantity, QuantitySelectorProps } from './QuantitySelector';
export type { QuantityChartProps } from './QuantityChart';
export type { PhysicsMonitorProps, QuantityHistory } from './PhysicsMonitor';
