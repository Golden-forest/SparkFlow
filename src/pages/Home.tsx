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

// Projectile Motion Diagram
const ProjectileMotionDiagram = () => (
    <div className="relative w-full h-32 flex items-center justify-center">
        <svg width="200" height="120" viewBox="0 0 200 120" className="opacity-70">
            {/* Ground */}
            <line x1="20" y1="100" x2="180" y2="100" stroke="currentColor" strokeWidth="2" className="text-gray-500"/>

            {/* Projectile Path (Parabola) */}
            <path d="M 30 100 Q 100 20 170 80" stroke="url(#projectileGradient)" strokeWidth="2" fill="none" strokeDasharray="4,2"/>

            {/* Velocity Vectors */}
            <line x1="60" y1="75" x2="80" y2="65" stroke="url(#velocityGradient)" strokeWidth="2"/>
            <polygon points="78,63 82,66 79,68" fill="url(#velocityGradient)"/>

            {/* Acceleration Vector (Gravity) */}
            <line x1="60" y1="75" x2="60" y2="90" stroke="#FF6B6B" strokeWidth="2"/>
            <polygon points="58,88 62,88 60,92" fill="#FF6B6B"/>

            {/* Projectile Ball */}
            <circle cx="60" cy="75" r="5" fill="#00FF41" opacity="0.9"/>

            {/* Gradient Definitions */}
            <defs>
                <linearGradient id="projectileGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#00FF41"/>
                    <stop offset="100%" stopColor="#00CC33"/>
                </linearGradient>
                <linearGradient id="velocityGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#60A5FA"/>
                    <stop offset="100%" stopColor="#3B82F6"/>
                </linearGradient>
            </defs>

            {/* Labels */}
            <text x="30" y="115" fill="currentColor" fontSize="9" className="text-gray-400">v₀</text>
            <text x="65" y="95" fill="currentColor" fontSize="9" className="text-red-400">g</text>
        </svg>
    </div>
);

// Circular Motion Diagram
const CircularMotionDiagram = () => (
    <div className="relative w-full h-32 flex items-center justify-center">
        <svg width="180" height="120" viewBox="0 0 180 120" className="opacity-70">
            {/* Circular Path */}
            <circle cx="90" cy="60" r="40" stroke="currentColor" strokeWidth="2" className="text-blue-400" fill="none" opacity="0.6"/>

            {/* Center Point */}
            <circle cx="90" cy="60" r="4" fill="#FFD700"/>

            {/* Radius Line */}
            <line x1="90" y1="60" x2="120" y2="40" stroke="currentColor" strokeWidth="2" className="text-gray-400" strokeDasharray="3,2"/>

            {/* Object in Motion */}
            <circle cx="120" cy="40" r="6" fill="#00FF41" opacity="0.9"/>

            {/* Velocity Vector (Tangent) */}
            <line x1="120" y1="40" x2="145" y2="55" stroke="url(#velocityGradient2)" strokeWidth="2.5"/>
            <polygon points="143,53 147,56 144,58" fill="url(#velocityGradient2)"/>

            {/* Centripetal Force Vector (Toward Center) */}
            <line x1="120" y1="40" x2="105" y2="50" stroke="#FF6B6B" strokeWidth="2.5"/>
            <polygon points="107,48 111,51 108,53" fill="#FF6B6B"/>

            {/* Angular Velocity Indicator */}
            <path d="M 75 50 A 20 20 0 0 1 85 45" stroke="url(#angularGradient)" strokeWidth="2" fill="none"/>
            <polygon points="83,43 87,45 85,48" fill="url(#angularGradient)"/>

            {/* Gradient Definitions */}
            <defs>
                <linearGradient id="velocityGradient2" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#60A5FA"/>
                    <stop offset="100%" stopColor="#3B82F6"/>
                </linearGradient>
                <linearGradient id="angularGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#A78BFA"/>
                    <stop offset="100%" stopColor="#8B5CF6"/>
                </linearGradient>
            </defs>

            {/* Labels */}
            <text x="150" y="50" fill="currentColor" fontSize="9" className="text-blue-400">v</text>
            <text x="95" y="55" fill="currentColor" fontSize="9" className="text-red-400">F</text>
            <text x="70" y="42" fill="currentColor" fontSize="9" className="text-purple-400">ω</text>
        </svg>
    </div>
);

// Simple Harmonic Motion Diagram
const SHMDiagram = () => (
    <div className="relative w-full h-32 flex items-center justify-center">
        <svg width="200" height="120" viewBox="0 0 200 120" className="opacity-70">
            {/* Spring/Base Line */}
            <line x1="30" y1="60" x2="80" y2="60" stroke="currentColor" strokeWidth="3" className="text-gray-500"/>

            {/* Spring Coils */}
            <path d="M 80 60 L 85 50 L 90 70 L 95 50 L 100 70 L 105 50 L 110 70 L 115 50 L 120 60"
                  stroke="url(#springGradient)" strokeWidth="2" fill="none"/>

            {/* Mass Object */}
            <rect x="120" y="45" width="25" height="30" rx="3" fill="url(#massGradient)" opacity="0.9"/>

            {/* Equilibrium Position (Dashed) */}
            <line x1="132.5" y1="30" x2="132.5" y2="90" stroke="currentColor" strokeWidth="1.5" className="text-gray-400" strokeDasharray="3,3"/>

            {/* Displacement Arrow */}
            <line x1="132.5" y1="75" x2="155" y2="75" stroke="#00FF41" strokeWidth="2"/>
            <polygon points="153,73 157,75 153,77" fill="#00FF41"/>
            <text x="140" y="85" fill="currentColor" fontSize="9" className="text-green-400">x</text>

            {/* Velocity Vector */}
            <line x1="132.5" y1="45" x2="132.5" y2="25" stroke="url(#velocityGradient3)" strokeWidth="2.5"/>
            <polygon points="130,27 135,27 132.5,22" fill="url(#velocityGradient3)"/>

            {/* Acceleration Vector (Opposite Direction) */}
            <line x1="132.5" y1="45" x2="112.5" y2="45" stroke="#FF6B6B" strokeWidth="2.5"/>
            <polygon points="114,43 109,45 114,47" fill="#FF6B6B"/>

            {/* Gradient Definitions */}
            <defs>
                <linearGradient id="springGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#9CA3AF"/>
                    <stop offset="100%" stopColor="#6B7280"/>
                </linearGradient>
                <linearGradient id="massGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#60A5FA"/>
                    <stop offset="100%" stopColor="#3B82F6"/>
                </linearGradient>
                <linearGradient id="velocityGradient3" x1="0%" y1="100%" x2="0%" y2="0%">
                    <stop offset="0%" stopColor="#60A5FA"/>
                    <stop offset="100%" stopColor="#3B82F6"/>
                </linearGradient>
            </defs>

            {/* Labels */}
            <text x="125" y="20" fill="currentColor" fontSize="9" className="text-blue-400">v</text>
            <text x="100" y="42" fill="currentColor" fontSize="9" className="text-red-400">a</text>
        </svg>
    </div>
);

// Collision Diagram
const CollisionDiagram = () => (
    <div className="relative w-full h-32 flex items-center justify-center">
        <svg width="220" height="120" viewBox="0 0 220 120" className="opacity-70">
            {/* Ground */}
            <line x1="20" y1="80" x2="200" y2="80" stroke="currentColor" strokeWidth="2" className="text-gray-500"/>

            {/* Before Collision State (Top) */}
            <text x="20" y="25" fill="currentColor" fontSize="10" className="text-gray-400">Before:</text>

            {/* Object 1 Before */}
            <circle cx="70" cy="40" r="12" fill="url(#obj1Gradient)" opacity="0.9"/>
            <text x="65" y="44" fill="white" fontSize="10" fontWeight="bold">m₁</text>

            {/* Object 2 Before */}
            <circle cx="130" cy="40" r="10" fill="url(#obj2Gradient)" opacity="0.9"/>
            <text x="125" y="44" fill="white" fontSize="10" fontWeight="bold">m₂</text>

            {/* Velocity Arrows Before */}
            <line x1="70" y1="40" x2="100" y2="40" stroke="#00FF41" strokeWidth="2.5"/>
            <polygon points="98,38 102,40 98,42" fill="#00FF41"/>

            <line x1="130" y1="40" x2="100" y2="40" stroke="#60A5FA" strokeWidth="2.5"/>
            <polygon points="102,38 98,40 102,42" fill="#60A5FA"/>

            {/* After Collision State (Bottom) */}
            <text x="20" y="65" fill="currentColor" fontSize="10" className="text-gray-400">After:</text>

            {/* Object 1 After (Slower) */}
            <circle cx="100" cy="80" r="12" fill="url(#obj1Gradient)" opacity="0.7"/>
            <text x="95" y="84" fill="white" fontSize="10" fontWeight="bold">m₁</text>

            {/* Object 2 After (Faster) */}
            <circle cx="150" cy="80" r="10" fill="url(#obj2Gradient)" opacity="0.9"/>
            <text x="145" y="84" fill="white" fontSize="10" fontWeight="bold">m₂</text>

            {/* Velocity Arrows After */}
            <line x1="100" y1="80" x2="115" y2="80" stroke="#00FF41" strokeWidth="2" opacity="0.6"/>
            <polygon points="113,78 117,80 113,82" fill="#00FF41" opacity="0.6"/>

            <line x1="150" y1="80" x2="180" y2="80" stroke="#60A5FA" strokeWidth="2.5"/>
            <polygon points="178,78 182,80 178,82" fill="#60A5FA"/>

            {/* Momentum Label */}
            <text x="180" y="115" fill="currentColor" fontSize="9" className="text-green-400">P = constant</text>

            {/* Gradient Definitions */}
            <defs>
                <radialGradient id="obj1Gradient">
                    <stop offset="0%" stopColor="#FF6B6B"/>
                    <stop offset="100%" stopColor="#DC2626"/>
                </radialGradient>
                <radialGradient id="obj2Gradient">
                    <stop offset="0%" stopColor="#60A5FA"/>
                    <stop offset="100%" stopColor="#3B82F6"/>
                </radialGradient>
            </defs>
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
        id: 'projectile-motion',
        title: 'Projectile Motion',
        subtitle: 'Kinematics & Trajectories',
        diagram: <ProjectileMotionDiagram />,
        gradient: 'from-green-900/20 via-emerald-900/10 to-teal-900/20',
    },
    {
        id: 'circular-motion',
        title: 'Circular Motion',
        subtitle: 'Centripetal Force & Velocity',
        diagram: <CircularMotionDiagram />,
        gradient: 'from-blue-900/20 via-indigo-900/10 to-violet-900/20',
    },
    {
        id: 'simple-harmonic-motion',
        title: 'Harmonic Motion',
        subtitle: 'Springs & Pendulums',
        diagram: <SHMDiagram />,
        gradient: 'from-purple-900/20 via-pink-900/10 to-rose-900/20',
    },
    {
        id: 'collision',
        title: 'Collisions',
        subtitle: 'Momentum & Energy',
        diagram: <CollisionDiagram />,
        gradient: 'from-red-900/20 via-orange-900/10 to-amber-900/20',
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
