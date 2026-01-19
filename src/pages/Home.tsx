import { Link, useNavigate } from 'react-router-dom';

interface ExperimentCard {
    id: string;
    title: string;
    subtitle: string;
    diagram: React.ReactNode;
    gradient: string;
}

// Hydrogen Atom Energy Level Diagram
const HydrogenAtomDiagram = () => (
    <div className="relative w-full h-32 flex items-center justify-center">
        <svg width="200" height="120" viewBox="0 0 200 120" className="opacity-60">
            {/* Energy Levels */}
            <line x1="30" y1="20" x2="170" y2="20" stroke="currentColor" strokeWidth="1.5" className="text-blue-400"/>
            <line x1="30" y1="50" x2="170" y2="50" stroke="currentColor" strokeWidth="1.5" className="text-blue-400"/>
            <line x1="30" y1="80" x2="170" y2="80" stroke="currentColor" strokeWidth="1.5" className="text-blue-400"/>
            <line x1="30" y1="110" x2="170" y2="110" stroke="currentColor" strokeWidth="2" className="text-green-400"/>

            {/* Electrons */}
            <circle cx="50" cy="20" r="4" fill="currentColor" className="text-white"/>
            <circle cx="80" cy="50" r="4" fill="currentColor" className="text-white"/>
            <circle cx="120" cy="80" r="4" fill="currentColor" className="text-white"/>
            <circle cx="160" cy="110" r="5" fill="currentColor" className="text-green-400"/>

            {/* Transition Arrow */}
            <path d="M 50 25 Q 85 40 120 75" stroke="url(#gradient)" strokeWidth="2" fill="none" strokeDasharray="3,2" opacity="0.8"/>

            {/* Gradient Definition */}
            <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#60A5FA"/>
                    <stop offset="100%" stopColor="#34D399"/>
                </linearGradient>
            </defs>

            {/* Labels */}
            <text x="8" y="25" fill="currentColor" fontSize="10" className="text-gray-400">n=3</text>
            <text x="8" y="55" fill="currentColor" fontSize="10" className="text-gray-400">n=2</text>
            <text x="8" y="85" fill="currentColor" fontSize="10" className="text-gray-400">n=1</text>
            <text x="8" y="115" fill="currentColor" fontSize="10" className="text-green-400">n=0</text>
        </svg>
    </div>
);

// Rutherford Scattering Diagram
const RutherfordScatteringDiagram = () => (
    <div className="relative w-full h-32 flex items-center justify-center">
        <svg width="220" height="120" viewBox="0 0 220 120" className="opacity-70">
            {/* Gold Nucleus */}
            <circle cx="110" cy="60" r="12" fill="url(#goldGradient)" opacity="0.9"/>

            {/* Alpha Particles */}
            <circle cx="30" cy="30" r="4" fill="url(#alphaGradient)"/>
            <circle cx="30" cy="60" r="4" fill="url(#alphaGradient)"/>
            <circle cx="30" cy="90" r="4" fill="url(#alphaGradient)"/>

            {/* Scattering Paths */}
            <path d="M 30 30 Q 110 25 190 20" stroke="url(#alphaGradient)" strokeWidth="2" fill="none" opacity="0.8"/>
            <path d="M 30 60 L 30 60" stroke="url(#alphaGradient)" strokeWidth="2" fill="none" opacity="0.8"/>
            <path d="M 30 90 Q 110 95 190 100" stroke="url(#alphaGradient)" strokeWidth="2" fill="none" opacity="0.8"/>

            {/* Arrow heads */}
            <polygon points="188,18 192,20 188,22" fill="url(#alphaGradient)" opacity="0.8"/>
            <polygon points="188,98 192,100 188,102" fill="url(#alphaGradient)" opacity="0.8"/>

            {/* Gradient Definitions */}
            <defs>
                <radialGradient id="goldGradient">
                    <stop offset="0%" stopColor="#FFD700"/>
                    <stop offset="100%" stopColor="#FFA500"/>
                </radialGradient>
                <linearGradient id="alphaGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#FF6B6B"/>
                    <stop offset="100%" stopColor="#FF8E8E"/>
                </linearGradient>
            </defs>

            {/* Labels */}
            <text x="20" y="25" fill="currentColor" fontSize="10" className="text-red-400">α</text>
            <text x="20" y="55" fill="currentColor" fontSize="10" className="text-red-400">α</text>
            <text x="20" y="85" fill="currentColor" fontSize="10" className="text-red-400">α</text>
            <text x="110" y="80" fill="currentColor" fontSize="8" className="text-yellow-400 text-center">Nucleus</text>
        </svg>
    </div>
);

// Solar System Diagram
const SolarSystemDiagram = () => (
    <div className="relative w-full h-32 flex items-center justify-center">
        <svg width="200" height="120" viewBox="0 0 200 120" className="opacity-60">
            {/* Sun */}
            <circle cx="100" cy="60" r="15" fill="#FFD700" opacity="0.9" />

            {/* Planets */}
            <circle cx="60" cy="60" r="3" fill="#8C7853" />
            <circle cx="75" cy="60" r="5" fill="#FFC649" />
            <circle cx="90" cy="60" r="5" fill="#4169E1" />
            <circle cx="110" cy="60" r="4" fill="#CD5C5C" />
            <circle cx="130" cy="60" r="8" fill="#D8CA9D" />
            <circle cx="150" cy="60" r="7" fill="#FAD5A5" />
            <circle cx="165" cy="60" r="6" fill="#4FD0E7" />
            <circle cx="180" cy="60" r="6" fill="#4169E1" />

            {/* Orbits */}
            <circle cx="100" cy="60" r="40" stroke="#444" strokeWidth="0.5" fill="none" opacity="0.4" />
            <circle cx="100" cy="60" r="55" stroke="#444" strokeWidth="0.5" fill="none" opacity="0.4" />
            <circle cx="100" cy="60" r="70" stroke="#444" strokeWidth="0.5" fill="none" opacity="0.4" />
            <circle cx="100" cy="60" r="90" stroke="#444" strokeWidth="0.5" fill="none" opacity="0.4" />
        </svg>
    </div>
);

// Simple Pendulum Diagram
const PendulumDiagram = () => (
    <div className="relative w-full h-32 flex items-center justify-center">
        <svg width="200" height="120" viewBox="0 0 200 120" className="opacity-70">
            {/* Support Structure */}
            <line x1="60" y1="20" x2="140" y2="20" stroke="currentColor" strokeWidth="3" className="text-gray-400"/>

            {/* Pivot Point */}
            <circle cx="100" cy="20" r="4" fill="#FFD700"/>

            {/* String */}
            <line x1="100" y1="20" x2="135" y2="80" stroke="url(#stringGradient)" strokeWidth="2"/>

            {/* Pendulum Bob */}
            <circle cx="135" cy="85" r="10" fill="url(#bobGradient)" opacity="0.9"/>

            {/* Equilibrium Line (Dashed) */}
            <line x1="100" y1="20" x2="100" y2="100" stroke="currentColor" strokeWidth="1.5" className="text-gray-400" strokeDasharray="4,4"/>

            {/* Angle Arc */}
            <path d="M 100 50 A 30 30 0 0 1 115 65" stroke="url(#angleGradient)" strokeWidth="2" fill="none"/>

            {/* Velocity Vector */}
            <line x1="135" y1="85" x2="155" y2="85" stroke="url(#velocityGradient)" strokeWidth="2.5"/>
            <polygon points="153,83 157,85 153,87" fill="url(#velocityGradient)"/>

            {/* Tension Force Vector */}
            <line x1="135" y1="85" x2="120" y2="55" stroke="#FF6B6B" strokeWidth="2.5"/>
            <polygon points="122,57 118,53 121,51" fill="#FF6B6B"/>

            {/* Gravity Force Vector */}
            <line x1="135" y1="85" x2="135" y2="105" stroke="#60A5FA" strokeWidth="2.5"/>
            <polygon points="133,103 137,103 135,108" fill="#60A5FA"/>

            {/* Gradient Definitions */}
            <defs>
                <linearGradient id="stringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#9CA3AF"/>
                    <stop offset="100%" stopColor="#6B7280"/>
                </linearGradient>
                <radialGradient id="bobGradient">
                    <stop offset="0%" stopColor="#00FF41"/>
                    <stop offset="100%" stopColor="#00CC33"/>
                </radialGradient>
                <linearGradient id="angleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#A78BFA"/>
                    <stop offset="100%" stopColor="#8B5CF6"/>
                </linearGradient>
                <linearGradient id="velocityGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#00FF41"/>
                    <stop offset="100%" stopColor="#00CC33"/>
                </linearGradient>
            </defs>

            {/* Labels */}
            <text x="105" y="45" fill="currentColor" fontSize="9" className="text-purple-400">θ</text>
            <text x="160" y="80" fill="currentColor" fontSize="9" className="text-green-400">v</text>
            <text x="110" y="60" fill="currentColor" fontSize="9" className="text-red-400">T</text>
            <text x="138" y="105" fill="currentColor" fontSize="9" className="text-blue-400">mg</text>
        </svg>
    </div>
);

// Motion & Collision Lab Diagram
const MotionCollisionDiagram = () => (
    <div className="relative w-full h-32 flex items-center justify-center">
        <svg width="220" height="120" viewBox="0 0 220 120" className="opacity-70">
            {/* Ground/Floor */}
            <line x1="20" y1="90" x2="200" y2="90" stroke="currentColor" strokeWidth="2" className="text-gray-500"/>

            {/* Ramp */}
            <polygon points="40,90 100,90 100,50 40,90" fill="url(#rampGradient)" opacity="0.6"/>

            {/* Ball on Ramp */}
            <circle cx="70" cy="65" r="8" fill="url(#ballGradient)"/>

            {/* Ball in Motion */}
            <circle cx="130" cy="82" r="8" fill="url(#ballGradient)"/>

            {/* Second Ball (for collision) */}
            <circle cx="170" cy="82" r="8" fill="url(#obj2Gradient)"/>

            {/* Trajectory Path */}
            <path d="M 70 65 Q 100 75 130 82" stroke="url(#trajectoryGradient)" strokeWidth="2" fill="none" strokeDasharray="3,3"/>

            {/* Velocity Arrow - First Ball */}
            <line x1="130" y1="82" x2="155" y2="82" stroke="#00FF41" strokeWidth="2.5"/>
            <polygon points="153,80 157,82 153,84" fill="#00FF41"/>

            {/* Collision Point Indicator */}
            <circle cx="150" cy="82" r="3" fill="#FFD700" opacity="0.8"/>

            {/* After Collision Velocity */}
            <line x1="170" y1="82" x2="195" y2="82" stroke="#60A5FA" strokeWidth="2.5"/>
            <polygon points="193,80 197,82 193,84" fill="#60A5FA"/>

            {/* Gravity Vector */}
            <line x1="70" y1="65" x2="70" y2="85" stroke="#FF6B6B" strokeWidth="2" opacity="0.7"/>
            <polygon points="68,83 72,83 70,88" fill="#FF6B6B" opacity="0.7"/>

            {/* Gradient Definitions */}
            <defs>
                <linearGradient id="rampGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#4B5563"/>
                    <stop offset="100%" stopColor="#374151"/>
                </linearGradient>
                <radialGradient id="ballGradient">
                    <stop offset="0%" stopColor="#00FF41"/>
                    <stop offset="100%" stopColor="#00CC33"/>
                </radialGradient>
                <radialGradient id="obj2Gradient">
                    <stop offset="0%" stopColor="#60A5FA"/>
                    <stop offset="100%" stopColor="#3B82F6"/>
                </radialGradient>
                <linearGradient id="trajectoryGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#00FF41" stopOpacity="0.3"/>
                    <stop offset="100%" stopColor="#00FF41" stopOpacity="0"/>
                </linearGradient>
            </defs>

            {/* Labels */}
            <text x="60" y="55" fill="currentColor" fontSize="8" className="text-gray-400">θ</text>
            <text x="65" y="95" fill="currentColor" fontSize="9" className="text-red-400">g</text>
            <text x="140" y="75" fill="currentColor" fontSize="9" className="text-green-400">v</text>
            <text x="180" y="75" fill="currentColor" fontSize="9" className="text-blue-400">v'</text>
            <text x="145" y="95" fill="currentColor" fontSize="9" className="text-yellow-400">collision</text>
        </svg>
    </div>
);

const experiments: ExperimentCard[] = [
    {
        id: 'hydrogen-transitions',
        title: 'Hydrogen Atom',
        subtitle: 'Energy Level Transitions',
        diagram: <HydrogenAtomDiagram />,
        gradient: 'from-blue-900/20 via-purple-900/10 to-teal-900/20',
    },
    {
        id: 'rutherford-scattering',
        title: 'Rutherford',
        subtitle: 'Alpha Particle Scattering',
        diagram: <RutherfordScatteringDiagram />,
        gradient: 'from-red-900/20 via-orange-900/10 to-yellow-900/20',
    },
    {
        id: 'solar-system',
        title: 'Solar System',
        subtitle: 'Celestial Motion Simulation',
        diagram: <SolarSystemDiagram />,
        gradient: 'from-blue-900/20 via-cyan-900/10 to-indigo-900/20',
    },
    {
        id: 'pendulum',
        title: 'Simple Pendulum Lab',
        subtitle: 'Period, Gravity & Harmonic Motion',
        diagram: <PendulumDiagram />,
        gradient: 'from-purple-900/20 via-pink-900/10 to-rose-900/20',
    },
    {
        id: 'motion-collision',
        title: 'Motion & Collision Lab',
        subtitle: 'Trajectories, Forces & Momentum',
        diagram: <MotionCollisionDiagram />,
        gradient: 'from-green-900/20 via-emerald-900/10 to-teal-900/20',
    },
];

export default function Home() {
    const navigate = useNavigate();
    
    return (
        <div className="min-h-screen bg-[#0D1117] flex flex-col" style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', paddingLeft: '80px', paddingRight: '80px' }}>
            {/* Header - Centered */}
            <header className="pt-16 pb-12">
                <h1 className="text-[56px] leading-[1.1] font-[700] text-center tracking-[-0.02em] bg-gradient-to-br from-[#F0F6FC] to-[#00FF41] bg-clip-text text-transparent">
                    Spark Flow
                </h1>
            </header>

            {/* Experiment Cards - Apple Style Poster Design */}
            <main className="flex-1 flex items-center justify-start py-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 w-full">
                    {experiments.map((exp) => (
                        <div
                            key={exp.id}
                            onClick={() => navigate(`/experiment/${exp.id}`)}
                            className="group relative overflow-hidden bg-gradient-to-br ${exp.gradient} backdrop-blur-sm border border-[#30363D] rounded-[20px] p-12 transition-all duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[#161B22] hover:border-[#00FF41]/30 hover:transform hover:-translate-y-[12px] hover:shadow-[0_25px_50px_rgba(0,255,65,0.15)] hover:shadow-[0_0_0_1px_rgba(0,255,65,0.2)] cursor-pointer"
                        >
                            {/* Background Glow Effect */}
                            <div className="absolute inset-2 bg-gradient-to-br from-white/[0.03] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-[500ms] rounded-[16px]" />

                            {/* Content Container */}
                            <div className="relative z-10 flex flex-col h-full">
                                {/* Header */}
                                <div className="mb-6" style={{paddingLeft: '16px', paddingRight: '16px', paddingTop: '8px'}}>
                                    <h3 className="text-[28px] leading-[1.1] font-[700] text-[#F0F6FC] mb-2 group-hover:text-white transition-colors duration-[400ms] tracking-tight">
                                        {exp.title}
                                    </h3>
                                    <p className="text-[16px] leading-[1.5] font-[500] text-[#8B949E] group-hover:text-[#C9D1D9] transition-colors duration-[400ms]">
                                        {exp.subtitle}
                                    </p>
                                </div>

                                {/* Diagram */}
                                <div className="flex-1 flex items-center justify-center mb-8">
                                    <div className="transform transition-all duration-[400ms] group-hover:scale-105">
                                        {exp.diagram}
                                    </div>
                                </div>

                                {/* Call to Action */}
                                <div className="flex items-center justify-between mt-auto" style={{paddingLeft: '16px', paddingRight: '16px', paddingBottom: '16px'}}>
                                    <div className="flex gap-3">
                                        <span className="text-[14px] font-[600] text-[#00FF41] opacity-0 group-hover:opacity-100 transition-all duration-[400ms] transform translate-y-2 group-hover:translate-y-0">
                                            Explore Physics →
                                        </span>
                                        {exp.id === 'hydrogen-transitions' && (
                                            <div
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate("/experiment/hydrogen-transitions/abstract");
                                                }}
                                                className="text-[14px] font-[600] text-purple-400 opacity-0 group-hover:opacity-100 transition-all duration-[400ms] transform translate-y-2 group-hover:translate-y-0 hover:text-purple-300 cursor-pointer"
                                            >
                                                Abstract Demo →
                                            </div>
                                        )}
                                        {exp.id === 'solar-system' && (
                                            <div
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate("/experiment/solar-system/satellite");
                                                }}
                                                className="text-[14px] font-[600] text-cyan-400 opacity-0 group-hover:opacity-100 transition-all duration-[400ms] transform translate-y-2 group-hover:translate-y-0 hover:text-cyan-300 cursor-pointer"
                                            >
                                                Satellite View →
                                            </div>
                                        )}
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-[#00FF41]/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-[400ms] transform scale-75 group-hover:scale-100">
                                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                            <path d="M6 3L11 8L6 13" stroke="#00FF41" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                    </div>
                                </div>
                            </div>

                           </div>
                    ))}
                </div>
            </main>
        </div>
    );
}
