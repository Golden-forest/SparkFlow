/**
 * Electrochemistry Physics - Pure calculation functions
 *
 * Provides Nernst equation, Ohm's law, and Faraday's law calculations
 * for galvanic cell and electrolytic cell simulations.
 */

/** Physical constants used in electrochemistry */
const R = 8.314;        // Gas constant (J/(mol·K))
const F = 96485;        // Faraday constant (C/mol)
const E0_ZnCu = 1.10;   // Standard EMF for Zn|Cu cell (V)

/** Cell mode determines reaction direction and labeling */
export type CellMode = 'galvanic' | 'electrolytic';

/** Electrode reaction data for display */
export interface ElectrodeReactions {
    anodeReaction: string;
    cathodeReaction: string;
    totalReaction: string;
    anodeLabel: string;
    cathodeLabel: string;
    anodeProcess: string;   // 'oxidation' | 'reduction'
    cathodeProcess: string; // 'oxidation' | 'reduction'
}

/** Computed electrochemical data */
export interface ElectrochemistryData {
    emf: number;                // Cell EMF (V)
    current: number;            // Current (A)
    electronFlowRate: number;   // Electrons per second
    znConcentration: number;    // Zn²⁺ concentration (mol/L)
    cuDepositedMass: number;    // Cu deposited (mg)
    decompositionVoltage: number; // Min voltage for electrolysis (V)
}

/** Parameters needed for calculations */
export interface CalculationParams {
    mode: CellMode;
    concentration: number;     // CuSO₄ concentration (mol/L)
    temperature: number;       // Temperature (°C)
    electrodeSpacing: number;  // Distance between electrodes (cm)
    externalResistance: number; // External resistance (Ω), galvanic only
    appliedVoltage: number;    // Applied voltage (V), electrolytic only
    elapsedTime: number;       // Total elapsed time (s)
}

/**
 * Calculate cell EMF using Nernst equation
 * E = E° - (RT / nF) * ln(Q)
 * For Zn|Cu: Q = [Zn²⁺] / [Cu²⁺], n = 2
 */
export function calculateEMF(
    cuConcentration: number,
    temperatureCelsius: number,
): number {
    const T = temperatureCelsius + 273.15; // Convert to Kelvin
    const n = 2; // electrons transferred
    // Assume Zn²⁺ concentration starts at 0.1 and increases over time
    const znConcentration = 0.1;
    const Q = znConcentration / Math.max(cuConcentration, 0.001);
    const emf = E0_ZnCu - (R * T / (n * F)) * Math.log(Q);
    return Math.max(0, emf);
}

/**
 * Estimate internal resistance based on electrode spacing
 * Simplified model: R_internal = k * d / (conductivity * A)
 * Using approximate values for CuSO₄ solution
 */
export function calculateInternalResistance(
    electrodeSpacingCm: number,
    concentration: number,
): number {
    // Simplified: higher concentration = lower resistance
    const conductivity = 0.5 + concentration * 2.0; // S/m (approximate)
    const distance = electrodeSpacingCm / 100; // Convert to meters
    const area = 0.001; // Approximate electrode area (m²)
    return Math.max(0.1, distance / (conductivity * area));
}

/**
 * Calculate current flowing through the circuit
 * Galvanic: I = E / (R_internal + R_external)
 * Electrolytic: I = (V_applied - V_decomposition) / R_total
 */
export function calculateCurrent(params: CalculationParams): number {
    const rInternal = calculateInternalResistance(params.electrodeSpacing, params.concentration);

    if (params.mode === 'galvanic') {
        const emf = calculateEMF(params.concentration, params.temperature);
        const totalResistance = rInternal + Math.max(params.externalResistance, 0.1);
        return emf / totalResistance;
    } else {
        // Electrolytic mode
        const vDecomp = calculateDecompositionVoltage(params.concentration, params.temperature);
        const netVoltage = Math.max(0, params.appliedVoltage - vDecomp);
        return netVoltage / (rInternal + 1.0); // +1Ω for wiring resistance
    }
}

/**
 * Calculate minimum decomposition voltage for electrolysis
 * V_decomp = E°(cell) + overpotentials (simplified)
 */
export function calculateDecompositionVoltage(
    concentration: number,
    temperatureCelsius: number,
): number {
    const emf = calculateEMF(concentration, temperatureCelsius);
    // Add overpotential (simplified: ~0.3V for gas evolution on electrodes)
    return emf + 0.3;
}

/**
 * Calculate mass deposited using Faraday's law
 * m = (M * I * t) / (n * F)
 * For Cu: M = 63.546 g/mol, n = 2
 */
export function calculateMassDeposited(
    current: number,
    elapsedTime: number,
): number {
    const M_Cu = 63.546; // g/mol
    const n = 2;
    const massGrams = (M_Cu * current * elapsedTime) / (n * F);
    return massGrams * 1000; // Convert to mg
}

/**
 * Calculate electron flow rate
 * rate = I / e where e is elementary charge
 */
export function calculateElectronFlowRate(current: number): number {
    const e = 1.602176634e-19; // Elementary charge (C)
    return current / e;
}

/**
 * Update Zn²⁺ concentration based on current and time
 * Δ[Zn²⁺] = (I * t) / (n * F * V_solution)
 */
export function updateZnConcentration(
    initialConcentration: number,
    current: number,
    deltaTime: number,
    solutionVolumeL: number = 0.5,
): number {
    const n = 2;
    const molesProduced = (current * deltaTime) / (n * F);
    const deltaConcentration = molesProduced / solutionVolumeL;
    return initialConcentration + deltaConcentration;
}

/**
 * Get all electrochemical data as a single object
 */
export function calculateAllData(params: CalculationParams): ElectrochemistryData {
    const emf = calculateEMF(params.concentration, params.temperature);
    const current = calculateCurrent(params);
    const electronFlowRate = calculateElectronFlowRate(current);
    const cuDepositedMass = calculateMassDeposited(current, params.elapsedTime);
    const decompositionVoltage = calculateDecompositionVoltage(
        params.concentration,
        params.temperature,
    );

    // Calculate Zn²⁺ concentration accumulated over time
    const znConcentration = 0.1 + (current * params.elapsedTime) / (2 * F * 0.5);

    return {
        emf,
        current,
        electronFlowRate,
        znConcentration,
        cuDepositedMass,
        decompositionVoltage,
    };
}

/**
 * Get electrode reactions based on cell mode
 */
export function getReactions(mode: CellMode): ElectrodeReactions {
    if (mode === 'galvanic') {
        return {
            anodeReaction: 'Zn \u2192 Zn\u00B2\u207A + 2e\u207B',
            cathodeReaction: 'Cu\u00B2\u207A + 2e\u207B \u2192 Cu',
            totalReaction: 'Zn + Cu\u00B2\u207A \u2192 Zn\u00B2\u207A + Cu',
            anodeLabel: 'Zn (\u2212)',
            cathodeLabel: 'Cu (+)',
            anodeProcess: 'oxidation',
            cathodeProcess: 'reduction',
        };
    } else {
        return {
            anodeReaction: 'Cu \u2192 Cu\u00B2\u207A + 2e\u207B',
            cathodeReaction: 'Cu\u00B2\u207A + 2e\u207B \u2192 Cu',
            totalReaction: 'Cu (anode) \u2192 Cu\u00B2\u207A \u2192 Cu (cathode)',
            anodeLabel: 'Cu (+)',
            cathodeLabel: 'Zn (\u2212)',
            anodeProcess: 'oxidation',
            cathodeProcess: 'reduction',
        };
    }
}
