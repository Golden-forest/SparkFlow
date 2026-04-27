import { useState, useRef, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { AbstractSideToolbar } from '../components/simulation/AbstractSideToolbar';
import {
    calculateEnergy,
    getLevelColor,
    calculateTransition,
    type Transition
} from '../experiments/atomic/hydrogen-transitions/TransitionPhysics';

interface ElectronState {
    id: number;
    currentN: number;
    targetN: number | null;
    y: number; // Current visual Y position
    x: number; // Fixed X position for this electron lane
    state: 'idle' | 'falling' | 'grounded';
    history: Transition[]; // History of transitions for drawing arrows
}

interface Arrow {
    id: string; // unique id e.g. "e1-4-2" (electron 1, from 4 to 2)
    fromN: number;
    toN: number;
    x: number; // Vertical line X position
    color: string;
    opacity: number;
}

export default function HydrogenAbstractView() {
    // Canvas dimensions
    const width = 800;
    const height = 600;
    const padding = { top: 60, bottom: 40, left: 60, right: 80 }; // Increased right padding to 80 for text

    // State
    const [initialLevel, setInitialLevel] = useState(4);
    const [electronCount, setElectronCount] = useState<'single' | 'multi'>('single');
    const [allowSecondary, setAllowSecondary] = useState(false);
    const [isRunning, setIsRunning] = useState(false);

    // Mode: 'spontaneous' | 'excitation'
    const [viewMode, setViewMode] = useState<'spontaneous' | 'excitation'>('spontaneous');

    const [incidentType, setIncidentType] = useState<'photon' | 'electron'>('photon');
    const [incidentEnergy, setIncidentEnergy] = useState<number>(10.2); // Default to n=1->2

    // Simulation State
    const [electrons, setElectrons] = useState<ElectronState[]>([]);
    const [arrows, setArrows] = useState<Arrow[]>([]);
    const [incidentParticles, setIncidentParticles] = useState<any[]>([]); // New incident particles
    const [feedbackMessage, setFeedbackMessage] = useState<{ text: string, x: number, y: number, alpha: number } | null>(null);


    const requestRef = useRef<number | undefined>(undefined);
    const previousTimeRef = useRef<number | undefined>(undefined);

    // Constants for visualization
    // Map energy levels to Y coordinates
    // n=1 is at bottom, n=6 is at top (but below infinity)
    // We can map linear or by energy. The user said "abstract version", and "curves to lines"
    // Usually these are drawn with specific spacing. 
    // Let's use a non-linear spacing that mimics 1/n^2 but easier to see? 
    const getY = (n: number) => {
        // Pedagogical Scaling:
        // Instead of real energy 1/n^2, we map n=1..6 to fixed percentages of height
        // to ensure good visibility.
        // n=1 (Bottom): 100% (minus padding)
        // n=6 (Top): 10% 
        // n=inf: 0%

        // Manual slots for n=1 to 6 (from bottom up)
        // Top of canvas is 0.
        // Let's define normalized height (0 to 1) from bottom.
        // n=1: 0.0 (Bottom line)
        // n=2: 0.35 (Jump from 1 to 2 is big)
        // n=3: 0.55
        // n=4: 0.70
        // n=5: 0.82
        // n=6: 0.90
        // n=inf: 0.98

        const slots: Record<number, number> = {
            1: 0.0,
            2: 0.35,
            3: 0.55,
            4: 0.70,
            5: 0.82,
            6: 0.90,
            Infinity: 0.98
        };

        let normalized = slots[n];
        if (normalized === undefined) normalized = 0.95; // fallback

        const drawHeight = height - padding.top - padding.bottom;
        // Invert for Y coordinate (0 is top)
        return (height - padding.bottom) - (normalized * drawHeight);
    };

    // Calculate level Y positions once
    const levels = useMemo(() => {
        return [1, 2, 3, 4, 5, 6].map(n => ({
            n,
            y: getY(n),
            energy: calculateEnergy(n),
            color: getLevelColor(n)
        }));
    }, []);

    const groundY = levels[0].y; // n=1

    // Initialize/Reset
    const initSimulation = () => {
        setArrows([]);
        // Clean incident particles
        setIncidentParticles([]);
        setFeedbackMessage(null);

        let count = 1;
        let startLevel = 1;

        if (viewMode === 'spontaneous') {
            count = electronCount === 'single' ? 1 : 100;
            startLevel = initialLevel;
        } else {
            // Excitation Mode: Always 1 electron, Ground state
            count = 1;
            startLevel = 1;
        }

        const zoneWidth = width * 0.4;
        const startX = width * 0.05;
        const stepX = count > 1 ? zoneWidth / (count - 1) : 0;

        const newElectrons: ElectronState[] = [];
        for (let i = 0; i < count; i++) {
            newElectrons.push({
                id: i,
                currentN: startLevel,
                targetN: null,
                y: getY(startLevel),
                x: count === 1 ? (width * 0.25) : startX + Math.random() * zoneWidth,
                state: 'idle',
                history: []
            });
        }
        setElectrons(newElectrons);
        setIsRunning(false);
    };

    // Fire Incident Particle
    const handleFire = () => {
        // Create a new incident particle
        // Starts from left (-50), moves right
        // Target is the "first idle electron" or just the center
        // Let's target the first electron for simplicity or visualization
        // In multi-mode, maybe it hits one random electron?

        const targetElectron = electrons.find(e => e.state === 'idle'); // Target first idle
        const targetY = targetElectron ? getY(targetElectron.currentN) : getY(1);

        const newParticle = {
            id: Date.now(),
            type: incidentType,
            energy: incidentEnergy,
            x: -20,
            y: targetY,
            speed: 400, // px per sec
            state: 'moving'
        };

        setIncidentParticles(prev => [...prev, newParticle]);
        if (!isRunning) setIsRunning(true);
    };

    // Effect to reset when config changes (if not running)
    useEffect(() => {
        if (!isRunning) {
            initSimulation();
        }
    }, [initialLevel, electronCount, viewMode]); // Added viewMode dependency // Don't reset on allowSecondary change locally? logic says "switches" usually apply immediately or on reset. Let's apply on reset.

    // Helper to get Arrow X position (Deterministic)
    const getArrowX = (from: number, to: number) => {
        // Right Zone: 50% to 100% width
        const zoneStart = width * 0.55;
        const zoneEnd = width * 0.95;
        const zoneWidth = zoneEnd - zoneStart;

        // Calculate total possible transitions for n=6 down to 1
        // We want to group by 'toN' (destination)
        // Group n->1, Group n->2, ... Group n->5

        // Layout strategy:
        // Group 1 (Dest n=1): 2->1, 3->1 ... 6->1
        // Group 2 (Dest n=2): 3->2 ... 6->2
        // Dest 3: 3 slots (6->3, 5->3, 4->3)
        // Dest 4: 2 slots (6->4, 5->4)
        // Dest 5: 1 slot (6->5)
        // Total: 15 slots

        // Find slot index
        let slotIndex = 0;

        // Count slots before this destination group
        for (let d = 1; d < to; d++) {
            // For destination d, how many sources? (6 - d)
            slotIndex += (6 - d);
            // Add small gap between groups?
            slotIndex += 1; // 1 empty slot visual gap
        }

        // Inside group: Order by fromN (ascending or descending?)
        // Standard: 2->1, 3->1...
        // so offset = (from - (to + 1))
        slotIndex += (from - (to + 1));

        // Recalculate slotWidth with gaps
        // Total slots + gaps (4 gaps)
        const realTotalSlots = 15 + 4;
        const realSlotWidth = zoneWidth / realTotalSlots;

        return zoneStart + slotIndex * realSlotWidth + realSlotWidth / 2;
    };

    // Animation Loop
    const animate = (time: number) => {
        if (previousTimeRef.current !== undefined) {
            const deltaTime = (time - previousTimeRef.current) / 1000; // seconds

            setIncidentParticles(prev => {
                const nextParticles = [];
                for (const p of prev) {
                    // Move
                    const newX = p.x + p.speed * deltaTime;

                    // Check collision with electrons (simple x-check)
                    // If passes X ~ width*0.25 (center of left zone)
                    // Let's define interaction zone around X=100-300

                    // Find electrons near this Y and X?
                    // For demo simplicity: Particle hits "the atom" at X=width*0.25
                    const hitX = width * 0.25;

                    if (p.state === 'moving' && p.x < hitX && newX >= hitX) {
                        // Interaction Check!
                        // Find an electron at p.y (energy level)
                        // Allow some tolerance for Y
                        const hitElectronIndex = electrons.findIndex(e => Math.abs(e.y - p.y) < 10 && e.state === 'idle');

                        if (hitElectronIndex !== -1) {
                            const electron = electrons[hitElectronIndex];
                            // Physics Logic
                            const currentE = calculateEnergy(electron.currentN);
                            let success = false;
                            let targetN = null;

                            // 1. PHOTON Logic: Resonance
                            if (p.type === 'photon') {
                                // Must match deltaE exactly (tolerance 0.1 eV?)
                                // Check for ionization first?
                                // Ionization energy E_ion = 13.6 - currentE_binding? No, 13.6 is from ground.
                                // Level energy is negative. E_1 = -13.6. 
                                // To ionize, Need E_incident + E_current >= 0.

                                const finalEnergy = currentE + p.energy;

                                // Ionization Check
                                if (finalEnergy >= -0.05) { // Threshold for "0" (allow slight error)
                                    success = true;
                                    targetN = Infinity;
                                } else {
                                    // Regular Transition
                                    for (let n = electron.currentN + 1; n <= 6; n++) {
                                        const deltaE = calculateEnergy(n) - currentE;
                                        if (Math.abs(deltaE - p.energy) < 0.1) {
                                            success = true;
                                            targetN = n;
                                            break;
                                        }
                                    }
                                }
                            }
                            // 2. ELECTRON Logic: Threshold / Collision
                            else {
                                const finalEnergy = currentE + p.energy;
                                if (finalEnergy >= -0.05) {
                                    success = true;
                                    targetN = Infinity;
                                } else {
                                    // Frank-Hertz: find highest bound state
                                    let bestN = -1;
                                    for (let n = electron.currentN + 1; n <= 6; n++) {
                                        const deltaE = calculateEnergy(n) - currentE;
                                        if (p.energy >= deltaE) {
                                            bestN = n;
                                        }
                                    }
                                    if (bestN !== -1) {
                                        success = true;
                                        targetN = bestN;
                                    }
                                }
                            }

                            if (success && targetN) {
                                // Excitation!
                                setElectrons(prevElecs => {
                                    const newElecs = [...prevElecs];

                                    // Logic for Ionization (targetN === Infinity)
                                    // If Infinity -> Electron Flies away (UP and Out)

                                    newElecs[hitElectronIndex] = {
                                        ...newElecs[hitElectronIndex],
                                        targetN: targetN,
                                        state: 'falling' // Will trigger animation
                                    };
                                    return newElecs;
                                });

                                if (p.type === 'photon') {
                                    continue; // Absorbed
                                } else {
                                    // Electron continues? With reduced energy?
                                    // p.energy -= (E_target - E_current).
                                    // For ionization, energy loss = Binding Energy (abs(currentE))? Or full energy?
                                    // Physics: E_rem = E_inc - E_binding.
                                    // Let's passed through.
                                    nextParticles.push({ ...p, x: newX, state: 'passed' });
                                    continue;
                                }
                            } else {
                                // Interaction failed (passed through)
                                // Show "Energies don't match" feedback?
                                setFeedbackMessage({
                                    text: 'Energy mismatch',
                                    x: hitX,
                                    y: p.y - 20,
                                    alpha: 1
                                });
                                setTimeout(() => setFeedbackMessage(null), 1000);
                            }
                        }
                    }

                    if (newX < width) {
                        nextParticles.push({ ...p, x: newX });
                    }
                }
                return nextParticles;
            });

            setElectrons(prev => {
                let allDone = true;

                const nextElectrons = prev.map(e => {
                    // Logic when idle
                    if (e.state === 'idle') {
                        // Check if we can do SPONTANEOUS transition

                        // Rule: If e.currentN > 1, apply spontaneous decay logic
                        // IMPORTANT: User requested NO decay in Excitation Mode.

                        const isSpontaneousMode = viewMode === 'spontaneous';
                        const canDecay = isSpontaneousMode && (e.currentN > 1);

                        // Also logic for spontaneous mode start:
                        // If Spontaneous Mode: Wait for "Run" to decay?
                        // Yes, logic below is inside "animate" which runs when isRunning=true.
                        // So if Spontaneous Mode AND e.currentN > 1, we can decay.

                        // What about "Wait for input" in Excitation mode?
                        // In Excitation mode, we just sit there until particle hits.

                        if (canDecay) {
                            allDone = false;
                            // Probability to fall
                            const prob = electronCount === 'single' ? 0.05 : 0.02;
                            if (Math.random() < prob) {
                                const possibleTargets = [];
                                for (let n = 1; n < e.currentN; n++) {
                                    possibleTargets.push(n);
                                }
                                if (possibleTargets.length > 0) {
                                    const target = possibleTargets[Math.floor(Math.random() * possibleTargets.length)];
                                    return { ...e, targetN: target, state: 'falling' as const };
                                }
                            }
                        }
                    }
                    else if (e.state === 'falling' && e.targetN) {
                        allDone = false;

                        // Handle Infinity (Ionization)
                        const isIonization = e.targetN === Infinity;
                        const targetY = isIonization ? getY(8) : getY(e.targetN); // Target 8 (higher than 6) or just OFF screen (-50)

                        // If ionization, we fly WAY up. n=Infinity is at 0.98 height.
                        // Let's map targetY to y position of Infinity
                        const infiniteY = getY(Infinity);

                        const effectiveTargetY = isIonization ? (infiniteY - 20) : getY(e.targetN); // slight overshoot for infinity

                        const isUp = effectiveTargetY < e.y; // Jumping Up
                        const speed = 300;

                        let newY = e.y;
                        let arrived = false;

                        if (isUp) {
                            newY = e.y - speed * deltaTime;
                            if (newY <= effectiveTargetY) arrived = true;
                        } else {
                            newY = e.y + speed * deltaTime;
                            if (newY >= effectiveTargetY) arrived = true;
                        }

                        if (arrived) {
                            if (isIonization) {
                                // Ionized!
                                // Maybe remove electron or set state to 'ionized'?
                                // For visual, let's keep it at "Infinity" line?
                                // User said: "If energy exact, stay on 0 line. If energy > 13.6, fly off."
                                // We don't have exact energy check here inside animation loop easily (we lost p.energy).
                                // Let's infer: If targetN is Infinity, just stay at Infinity line?
                                // Refinement: "If energy > 13.6, fly off".
                                // We can just make "Infinty" target Y be the 0-line for now.

                                return {
                                    ...e,
                                    y: getY(Infinity),
                                    currentN: Infinity,
                                    state: 'idle' as const, // Idle at Infinity
                                    targetN: null
                                } as any;
                            }

                            const trans = calculateTransition(e.currentN, e.targetN!);

                            return {
                                ...e,
                                y: effectiveTargetY,
                                currentN: e.targetN!,
                                state: 'idle' as const,
                                targetN: null,
                                lastTransition: (e.currentN > e.targetN!) ? trans : undefined
                            } as any;
                        }

                        return { ...e, y: newY };
                    }

                    return e;
                });

                // Process arrivals for arrows (Reuse existing logic)
                // Filter: Only create arrows if viewMode === 'spontaneous' OR (actually user said arrows wrong in excitation, so dont draw)
                // So if viewMode === 'excitation', do NOT add to arrows.

                const newArrows: Arrow[] = [];
                const CLEAN_ELECTRONS = nextElectrons.map(e => {
                    const ee = e as any;
                    if (ee.lastTransition) {
                        const t = ee.lastTransition as Transition;

                        // Only add arrows if spontaneous mode
                        if (viewMode === 'spontaneous') {
                            const arrowId = `arrow-${t.from}-${t.to}`;
                            const arrowX = getArrowX(t.from, t.to);

                            newArrows.push({
                                id: arrowId,
                                fromN: t.from,
                                toN: t.to,
                                x: arrowX,
                                color: t.photonColor,
                                opacity: 1
                            });
                        }

                        const { lastTransition, ...rest } = ee;
                        return { ...rest, history: [...rest.history, t] };
                    }
                    return e;
                });

                if (newArrows.length > 0) {
                    setArrows(prev => {
                        const existingIds = new Set(prev.map(a => a.id));
                        const uniqueToAdd = newArrows.filter(a => !existingIds.has(a.id));
                        return [...prev, ...uniqueToAdd];
                    });
                }

                return CLEAN_ELECTRONS;
            });
        }
        previousTimeRef.current = time;
        if (isRunning) {
            requestRef.current = requestAnimationFrame(animate);
        }
    };

    useEffect(() => {
        if (isRunning) {
            requestRef.current = requestAnimationFrame(animate);
        } else {
            previousTimeRef.current = undefined;
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        }
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [isRunning, electrons, incidentParticles]); // Add electrons and incidentParticles to dependencies to re-run animate when they change

    // Handlers
    const handleTogglePlay = () => {
        setIsRunning(!isRunning);
    };

    const handleReset = () => {
        setIsRunning(false);
        setInitialLevel(initialLevel); // Trigger re-init
        initSimulation(); // Force init
    };

    return (
        <div className="h-screen flex flex-col bg-slate-900">
            {/* Header */}
            <header className="flex items-center justify-between border-b border-white/10 bg-slate-900/95 backdrop-blur-sm px-6 py-4 z-10">
                <div className="flex items-center gap-4">
                    <Link
                        to="/experiment/hydrogen-transitions"
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 hover:text-white transition-all duration-200 border border-white/5 hover:border-white/10"
                    >
                        <ArrowLeft size={18} />
                        <span className="font-medium">Back to Experiment</span>
                    </Link>
                    <div className="h-6 w-px bg-white/10" />
                    <h1 className="text-xl font-semibold text-white tracking-wide">
                        Hydrogen Energy Level Transitions - Abstract Demo
                    </h1>
                </div>
            </header>

            <main className="flex-1 relative flex overflow-hidden">
                {/* SVG Canvas */}
                <div className="flex-1 flex justify-center items-center bg-slate-900 p-4">
                    <svg
                        width={width}
                        height={height}
                        viewBox={`0 0 ${width} ${height}`}
                        className="bg-slate-800/50 rounded-xl border border-white/5 shadow-2xl"
                    >
                        {/* 0. Regions Visualization */}
                        {/* Split Line */}
                        <line
                            x1={width * 0.5} y1={padding.top - 20}
                            x2={width * 0.5} y2={height - padding.bottom + 20}
                            stroke="#ffffff"
                            strokeWidth={1}
                            strokeDasharray="4,4"
                            opacity={0.1}
                        />
                        {/* Titles */}
                        <text x={width * 0.25} y={40} textAnchor="middle" fill="#ffffff" opacity={0.5} fontSize={14}>
                            Transition Demo Area
                        </text>
                        <text x={width * 0.75} y={40} textAnchor="middle" fill="#ffffff" opacity={0.5} fontSize={14}>
                            Energy Level Diagram
                        </text>

                        {/* 0.5 Incident Particles */}
                        {incidentParticles.map(p => (
                            <g key={p.id}>
                                {p.type === 'photon' ? (
                                    // Photon: Wiggly Sine Wave
                                    <path
                                        d={`M ${p.x - 20} ${p.y} Q ${p.x - 10} ${p.y - 10}, ${p.x} ${p.y} T ${p.x + 10} ${p.y} T ${p.x + 20} ${p.y}`}
                                        stroke="#a855f7"
                                        strokeWidth={2}
                                        fill="none"
                                    />
                                ) : (
                                    // Electron: Blue Circle or Line
                                    <circle cx={p.x} cy={p.y} r={3} fill="#3b82f6" />
                                )}
                            </g>
                        ))}

                        {/* Feedback Message */}
                        {feedbackMessage && (
                            <text
                                x={feedbackMessage.x}
                                y={feedbackMessage.y}
                                textAnchor="middle"
                                fill="red"
                                fontSize={14}
                                opacity={feedbackMessage.alpha}
                            >
                                {feedbackMessage.text}
                            </text>
                        )}

                        {/* 1. Draw Energy Levels */}
                        {levels.map((l) => (
                            <g key={l.n}>
                                {/* Line */}
                                <line
                                    x1={padding.left}
                                    y1={l.y}
                                    x2={width - padding.right}
                                    y2={l.y}
                                    stroke={l.color}
                                    strokeWidth={2}
                                    opacity={0.3} // Fainter lines
                                />
                                {/* Label Left: n=x */}
                                <text
                                    x={padding.left - 10}
                                    y={l.y + 5}
                                    textAnchor="end"
                                    fill={l.color}
                                    fontSize="14"
                                    fontWeight="bold"
                                >
                                    n={l.n}
                                </text>
                                {/* Label Right: Energy */}
                                <text
                                    x={width - padding.right + 10}
                                    y={l.y + 5}
                                    textAnchor="start"
                                    fill={l.color}
                                    fontSize="12"
                                    fontFamily="monospace"
                                    opacity={0.7}
                                >
                                    {l.energy.toFixed(2)} eV
                                </text>
                            </g>
                        ))}

                        {/* Infinity Level (dashed) */}
                        <g>
                            <line
                                x1={padding.left}
                                y1={getY(Infinity)}
                                x2={width - padding.right}
                                y2={getY(Infinity)}
                                stroke="#ffffff"
                                strokeWidth={1}
                                strokeDasharray="5,5"
                                opacity={0.3}
                            />
                            <text
                                x={padding.left - 10}
                                y={getY(Infinity) + 5}
                                textAnchor="end"
                                fill="#ffffff"
                                fontSize="14"
                            >
                                ∞
                            </text>
                            <text
                                x={width - padding.right + 10}
                                y={getY(Infinity) + 5}
                                textAnchor="start"
                                fill="#ffffff"
                                fontSize="12"
                                fontFamily="monospace"
                                opacity={0.5}

                            >
                                0.00 eV
                            </text>
                        </g>


                        {/* 2. Draw Arrows (Transitions) */}
                        {arrows.map((arrow) => (
                            <g key={arrow.id} opacity={arrow.opacity}>
                                <defs>
                                    <marker
                                        id={`arrowhead-${arrow.id}`}
                                        markerWidth="10"
                                        markerHeight="7"
                                        refX="9"
                                        refY="3.5"
                                        orient="auto"
                                    >
                                        <polygon points="0 0, 10 3.5, 0 7" fill={arrow.color} />
                                    </marker>
                                </defs>
                                <line
                                    x1={arrow.x}
                                    y1={getY(arrow.fromN)}
                                    x2={arrow.x}
                                    y2={getY(arrow.toN)}
                                    stroke={arrow.color}
                                    strokeWidth={2}
                                    markerEnd={`url(#arrowhead-${arrow.id})`}
                                />
                                {/* Show wavelength if needed? Maybe too cluttered. */}
                            </g>
                        ))}


                        {/* 3. Draw Electrons */}
                        {electrons.map((e) => (
                            <circle
                                key={e.id}
                                cx={e.x}
                                cy={e.y}
                                r={6}
                                fill="#00ffff"
                                stroke="#ffffff"
                                strokeWidth={1}
                            />
                        ))}

                    </svg>
                </div>

                {/* Sidebar */}
                <AbstractSideToolbar
                    initialLevel={initialLevel}
                    onInitialLevelChange={setInitialLevel}
                    electronCount={electronCount}
                    onElectronCountChange={setElectronCount}
                    allowSecondary={allowSecondary}
                    onAllowSecondaryChange={setAllowSecondary}
                    isRunning={isRunning}
                    onTogglePlay={handleTogglePlay}
                    onReset={handleReset}
                    incidentType={incidentType}
                    onIncidentTypeChange={setIncidentType}
                    incidentEnergy={incidentEnergy}
                    onIncidentEnergyChange={setIncidentEnergy}
                    onFire={handleFire}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                />
            </main>
        </div>
    );
}
