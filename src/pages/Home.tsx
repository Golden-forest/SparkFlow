import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';

interface ExperimentCard {
    id: string;
    title: string;
    route?: string;
    diagram: ReactNode;
    gradient: string;
}

const HydrogenAtomDiagram = () => (
    <div className="relative flex h-36 w-full items-center justify-center">
        <svg width="220" height="132" viewBox="0 0 220 132" className="overflow-visible opacity-75">
            <defs>
                <linearGradient id="hydrogenTransitionGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#60A5FA" />
                    <stop offset="100%" stopColor="#34D399" />
                </linearGradient>
                <radialGradient id="hydrogenPhotonGlow">
                    <stop offset="0%" stopColor="#F0F6FC" />
                    <stop offset="100%" stopColor="#00FF41" stopOpacity="0" />
                </radialGradient>
            </defs>
            {[24, 54, 84, 114].map((y, index) => (
                <line
                    key={y}
                    x1="34"
                    y1={y}
                    x2="186"
                    y2={y}
                    stroke="currentColor"
                    strokeWidth={index === 3 ? 2 : 1.5}
                    className={index === 3 ? 'text-[#00FF41]' : 'text-blue-400'}
                    opacity={0.72}
                />
            ))}
            <path
                d="M 54 27 Q 94 48 132 86"
                stroke="url(#hydrogenTransitionGradient)"
                strokeWidth="2.5"
                fill="none"
                strokeDasharray="4 4"
            >
                <animate attributeName="stroke-dashoffset" values="0;-16" dur="1.8s" repeatCount="indefinite" />
            </path>
            <circle cx="54" cy="24" r="4" fill="#F0F6FC" />
            <circle cx="91" cy="54" r="4" fill="#F0F6FC" opacity="0.82" />
            <circle cx="132" cy="84" r="4" fill="#F0F6FC" opacity="0.82" />
            <circle cx="166" cy="114" r="5" fill="#00FF41">
                <animate attributeName="r" values="4;6;4" dur="2s" repeatCount="indefinite" />
            </circle>
            <circle cx="160" cy="40" r="12" fill="url(#hydrogenPhotonGlow)" opacity="0.65">
                <animate attributeName="opacity" values="0.2;0.75;0.2" dur="2.2s" repeatCount="indefinite" />
            </circle>
        </svg>
    </div>
);

const RutherfordScatteringDiagram = () => (
    <div className="relative flex h-36 w-full items-center justify-center">
        <svg width="240" height="132" viewBox="0 0 240 132" className="overflow-visible opacity-80">
            <defs>
                <radialGradient id="rutherfordGold">
                    <stop offset="0%" stopColor="#FDE68A" />
                    <stop offset="100%" stopColor="#F97316" />
                </radialGradient>
                <linearGradient id="rutherfordAlpha" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#F87171" />
                    <stop offset="100%" stopColor="#FDBA74" />
                </linearGradient>
            </defs>
            <circle cx="120" cy="66" r="14" fill="url(#rutherfordGold)" opacity="0.94">
                <animate attributeName="r" values="13;15;13" dur="2.4s" repeatCount="indefinite" />
            </circle>
            {[
                'M 28 36 Q 116 31 210 24',
                'M 28 66 Q 110 66 210 66',
                'M 28 96 Q 116 101 210 108',
            ].map((path, index) => (
                <path
                    key={path}
                    d={path}
                    stroke="url(#rutherfordAlpha)"
                    strokeWidth="2.2"
                    fill="none"
                    strokeDasharray="6 8"
                    opacity={0.8}
                >
                    <animate
                        attributeName="stroke-dashoffset"
                        values="0;-28"
                        dur={`${1.6 + index * 0.18}s`}
                        repeatCount="indefinite"
                    />
                </path>
            ))}
            {[36, 66, 96].map((y, index) => (
                <circle key={y} cx="30" cy={y} r="4" fill="url(#rutherfordAlpha)">
                    <animate
                        attributeName="cx"
                        values="24;58;24"
                        dur={`${1.8 + index * 0.2}s`}
                        repeatCount="indefinite"
                    />
                </circle>
            ))}
        </svg>
    </div>
);

const SolarSystemDiagram = () => (
    <div className="relative flex h-36 w-full items-center justify-center">
        <svg width="220" height="132" viewBox="0 0 220 132" className="overflow-visible opacity-75">
            <circle cx="110" cy="66" r="16" fill="#FFD166" opacity="0.95" />
            {[34, 52, 70].map((r) => (
                <circle key={r} cx="110" cy="66" r={r} stroke="#30363D" strokeWidth="1" fill="none" />
            ))}
            <g>
                <animateTransform attributeName="transform" type="rotate" from="0 110 66" to="360 110 66" dur="7s" repeatCount="indefinite" />
                <circle cx="144" cy="66" r="4" fill="#60A5FA" />
            </g>
            <g>
                <animateTransform attributeName="transform" type="rotate" from="90 110 66" to="450 110 66" dur="11s" repeatCount="indefinite" />
                <circle cx="162" cy="66" r="5" fill="#34D399" />
            </g>
            <g>
                <animateTransform attributeName="transform" type="rotate" from="210 110 66" to="570 110 66" dur="15s" repeatCount="indefinite" />
                <circle cx="180" cy="66" r="7" fill="#F59E0B" />
            </g>
        </svg>
    </div>
);

const PendulumDiagram = () => (
    <div className="relative flex h-36 w-full items-center justify-center">
        <svg width="220" height="132" viewBox="0 0 220 132" className="overflow-visible opacity-78">
            <defs>
                <radialGradient id="pendulumBob">
                    <stop offset="0%" stopColor="#E0FFF0" />
                    <stop offset="100%" stopColor="#00FF41" />
                </radialGradient>
            </defs>
            <line x1="70" y1="22" x2="150" y2="22" stroke="#8B949E" strokeWidth="3" />
            <circle cx="110" cy="22" r="4" fill="#FFD166" />
            <line x1="110" y1="22" x2="110" y2="112" stroke="#30363D" strokeWidth="1.5" strokeDasharray="4 4" />
            <g>
                <animateTransform attributeName="transform" type="rotate" values="-18 110 22;18 110 22;-18 110 22" dur="2.4s" repeatCount="indefinite" />
                <line x1="110" y1="22" x2="143" y2="88" stroke="#C9D1D9" strokeWidth="2" />
                <circle cx="143" cy="88" r="11" fill="url(#pendulumBob)" />
                <line x1="143" y1="88" x2="166" y2="88" stroke="#00FF41" strokeWidth="2.5" />
                <path d="M 164 85 L 170 88 L 164 91 Z" fill="#00FF41" />
            </g>
        </svg>
    </div>
);

const MotionCollisionDiagram = () => (
    <div className="relative flex h-36 w-full items-center justify-center">
        <svg width="240" height="132" viewBox="0 0 240 132" className="overflow-visible opacity-78">
            <defs>
                <radialGradient id="collisionBallA">
                    <stop offset="0%" stopColor="#E0FFF0" />
                    <stop offset="100%" stopColor="#00CC33" />
                </radialGradient>
                <radialGradient id="collisionBallB">
                    <stop offset="0%" stopColor="#DBEAFE" />
                    <stop offset="100%" stopColor="#3B82F6" />
                </radialGradient>
            </defs>
            <line x1="24" y1="94" x2="216" y2="94" stroke="#8B949E" strokeWidth="2" opacity="0.75" />
            <polygon points="42,94 104,94 104,52" fill="#30363D" opacity="0.72" />
            <path d="M 72 70 Q 108 82 140 86" stroke="#00FF41" strokeWidth="2" fill="none" strokeDasharray="4 5">
                <animate attributeName="stroke-dashoffset" values="0;-18" dur="1.5s" repeatCount="indefinite" />
            </path>
            <circle cx="74" cy="69" r="8" fill="url(#collisionBallA)" />
            <circle cx="142" cy="86" r="8" fill="url(#collisionBallA)">
                <animate attributeName="cx" values="132;150;132" dur="2s" repeatCount="indefinite" />
            </circle>
            <circle cx="180" cy="86" r="8" fill="url(#collisionBallB)">
                <animate attributeName="cx" values="178;194;178" dur="2s" repeatCount="indefinite" />
            </circle>
        </svg>
    </div>
);

const ProjectileDiagram = () => (
    <div className="relative flex h-36 w-full items-center justify-center">
        <svg width="240" height="132" viewBox="0 0 240 132" className="overflow-visible opacity-78">
            <line x1="26" y1="106" x2="214" y2="106" stroke="#8B949E" strokeWidth="2" opacity="0.7" />
            <path d="M 42 100 Q 112 16 194 100" stroke="#38BDF8" strokeWidth="2.4" fill="none" strokeDasharray="5 6">
                <animate attributeName="stroke-dashoffset" values="0;-22" dur="1.7s" repeatCount="indefinite" />
            </path>
            <circle r="7" fill="#F0F6FC">
                <animateMotion dur="2.4s" repeatCount="indefinite" path="M 42 100 Q 112 16 194 100" />
            </circle>
            <line x1="42" y1="100" x2="70" y2="70" stroke="#00FF41" strokeWidth="3" />
            <path d="M 68 66 L 76 64 L 72 72 Z" fill="#00FF41" />
        </svg>
    </div>
);

const CircularMotionDiagram = () => (
    <div className="relative flex h-36 w-full items-center justify-center">
        <svg width="220" height="132" viewBox="0 0 220 132" className="overflow-visible opacity-78">
            <circle cx="110" cy="66" r="46" stroke="#30363D" strokeWidth="2" fill="none" />
            <circle cx="110" cy="66" r="5" fill="#FFD166" />
            <g>
                <animateTransform attributeName="transform" type="rotate" from="0 110 66" to="360 110 66" dur="2.8s" repeatCount="indefinite" />
                <line x1="110" y1="66" x2="156" y2="66" stroke="#8B949E" strokeWidth="2" />
                <circle cx="156" cy="66" r="10" fill="#38BDF8" />
                <line x1="156" y1="66" x2="156" y2="36" stroke="#00FF41" strokeWidth="2.5" />
                <path d="M 153 39 L 156 31 L 159 39 Z" fill="#00FF41" />
            </g>
        </svg>
    </div>
);

const InclinedPlaneDiagram = () => (
    <div className="relative flex h-36 w-full items-center justify-center">
        <svg width="240" height="132" viewBox="0 0 240 132" className="overflow-visible opacity-78">
            <polygon points="48,104 190,104 190,48" fill="#30363D" opacity="0.76" />
            <line x1="48" y1="104" x2="190" y2="48" stroke="#C9D1D9" strokeWidth="3" />
            <g>
                <animateTransform attributeName="transform" type="translate" values="0 0;46 -18;0 0" dur="2.8s" repeatCount="indefinite" />
                <rect x="78" y="80" width="30" height="22" rx="3" fill="#F59E0B" transform="rotate(-21 93 91)" />
            </g>
            <line x1="120" y1="72" x2="102" y2="112" stroke="#F87171" strokeWidth="2.5" />
            <path d="M 100 108 L 99 118 L 106 112 Z" fill="#F87171" />
        </svg>
    </div>
);

const SpringOscillationDiagram = () => (
    <div className="relative flex h-36 w-full items-center justify-center">
        <svg width="240" height="132" viewBox="0 0 240 132" className="overflow-visible opacity-78">
            <rect x="34" y="36" width="12" height="72" rx="2" fill="#8B949E" />
            <line x1="46" y1="92" x2="206" y2="92" stroke="#30363D" strokeWidth="3" />
            <path d="M 46 72 C 54 52 62 92 70 72 C 78 52 86 92 94 72 C 102 52 110 92 118 72 C 126 52 134 92 142 72" stroke="#00FF41" strokeWidth="2.5" fill="none">
                <animate attributeName="d" values="M 46 72 C 54 52 62 92 70 72 C 78 52 86 92 94 72 C 102 52 110 92 118 72 C 126 52 134 92 142 72;M 46 72 C 58 52 70 92 82 72 C 94 52 106 92 118 72 C 130 52 142 92 154 72 C 166 52 178 92 190 72;M 46 72 C 54 52 62 92 70 72 C 78 52 86 92 94 72 C 102 52 110 92 118 72 C 126 52 134 92 142 72" dur="2s" repeatCount="indefinite" />
            </path>
            <rect x="142" y="56" width="42" height="32" rx="5" fill="#60A5FA">
                <animate attributeName="x" values="142;190;142" dur="2s" repeatCount="indefinite" />
            </rect>
        </svg>
    </div>
);

const MomentumCartsDiagram = () => (
    <div className="relative flex h-36 w-full items-center justify-center">
        <svg width="240" height="132" viewBox="0 0 240 132" className="overflow-visible opacity-78">
            <line x1="28" y1="94" x2="212" y2="94" stroke="#8B949E" strokeWidth="2" opacity="0.7" />
            <g>
                <animateTransform attributeName="transform" type="translate" values="0 0;42 0;0 0" dur="2.4s" repeatCount="indefinite" />
                <rect x="52" y="64" width="44" height="24" rx="5" fill="#34D399" />
                <circle cx="64" cy="92" r="5" fill="#0D1117" />
                <circle cx="84" cy="92" r="5" fill="#0D1117" />
            </g>
            <g>
                <animateTransform attributeName="transform" type="translate" values="0 0;-32 0;0 0" dur="2.4s" repeatCount="indefinite" />
                <rect x="150" y="64" width="44" height="24" rx="5" fill="#60A5FA" />
                <circle cx="162" cy="92" r="5" fill="#0D1117" />
                <circle cx="182" cy="92" r="5" fill="#0D1117" />
            </g>
            <circle cx="124" cy="76" r="5" fill="#FFD166">
                <animate attributeName="opacity" values="0;1;0" dur="2.4s" repeatCount="indefinite" />
                <animate attributeName="r" values="3;10;3" dur="2.4s" repeatCount="indefinite" />
            </circle>
        </svg>
    </div>
);

const experiments: ExperimentCard[] = [
    {
        id: 'hydrogen-transitions',
        title: 'Hydrogen Atom',
        diagram: <HydrogenAtomDiagram />,
        gradient: 'from-blue-900/20 via-purple-900/10 to-teal-900/20',
    },
    {
        id: 'rutherford-scattering',
        title: 'Rutherford',
        route: '/experiment/rutherford-scattering',
        diagram: <RutherfordScatteringDiagram />,
        gradient: 'from-red-900/20 via-orange-900/10 to-yellow-900/20',
    },
    {
        id: 'solar-system',
        title: 'Solar System',
        diagram: <SolarSystemDiagram />,
        gradient: 'from-blue-900/20 via-cyan-900/10 to-indigo-900/20',
    },
    {
        id: 'pendulum',
        title: 'Simple Pendulum',
        diagram: <PendulumDiagram />,
        gradient: 'from-purple-900/20 via-pink-900/10 to-rose-900/20',
    },
    {
        id: 'motion-collision',
        title: 'Motion & Collision',
        diagram: <MotionCollisionDiagram />,
        gradient: 'from-green-900/20 via-emerald-900/10 to-teal-900/20',
    },
    {
        id: 'projectile-motion',
        title: 'Projectile Motion',
        diagram: <ProjectileDiagram />,
        gradient: 'from-sky-900/20 via-cyan-900/10 to-blue-900/20',
    },
    {
        id: 'uniform-circular-motion',
        title: 'Circular Motion',
        diagram: <CircularMotionDiagram />,
        gradient: 'from-indigo-900/20 via-sky-900/10 to-cyan-900/20',
    },
    {
        id: 'inclined-plane-friction',
        title: 'Inclined Plane',
        diagram: <InclinedPlaneDiagram />,
        gradient: 'from-amber-900/20 via-orange-900/10 to-slate-900/20',
    },
    {
        id: 'spring-oscillation',
        title: 'Spring Oscillation',
        diagram: <SpringOscillationDiagram />,
        gradient: 'from-emerald-900/20 via-lime-900/10 to-sky-900/20',
    },
    {
        id: 'momentum-carts',
        title: 'Momentum Carts',
        diagram: <MomentumCartsDiagram />,
        gradient: 'from-teal-900/20 via-blue-900/10 to-emerald-900/20',
    },
];

export default function Home() {
    const navigate = useNavigate();

    return (
        <div
            className="flex min-h-screen flex-col bg-[#0D1117]"
            style={{
                fontFamily:
                    'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            }}
        >
            <header className="px-6 pb-8 pt-12 sm:px-10 lg:px-20 lg:pb-10 lg:pt-16">
                <h1 className="bg-gradient-to-br from-[#F0F6FC] to-[#00FF41] bg-clip-text text-center text-[44px] font-[700] leading-[1.08] text-transparent sm:text-[56px]">
                    Spark Flow
                </h1>
            </header>

            <main className="flex-1 px-6 pb-12 sm:px-10 lg:px-20">
                <div className="grid w-full grid-cols-1 gap-7 md:grid-cols-2 xl:grid-cols-3">
                    {experiments.map((experiment) => (
                        <article
                            key={experiment.id}
                            onClick={() => navigate(experiment.route ?? `/experiment/${experiment.id}`)}
                            className={`group relative min-h-[260px] cursor-pointer overflow-hidden rounded-[20px] border border-[#30363D] bg-gradient-to-br ${experiment.gradient} p-8 transition-all duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:-translate-y-2 hover:border-[#00FF41]/35 hover:bg-[#161B22] hover:shadow-[0_24px_50px_rgba(0,255,65,0.12)]`}
                        >
                            <div className="absolute inset-2 rounded-[16px] bg-gradient-to-br from-white/[0.04] via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

                            <div className="relative z-10 flex h-full flex-col">
                                <h2 className="px-2 pt-1 text-[25px] font-[700] leading-[1.15] tracking-[-0.01em] text-[#F0F6FC] transition-colors duration-[400ms] group-hover:text-white">
                                    {experiment.title}
                                </h2>

                                <div className="flex flex-1 items-center justify-center py-8">
                                    <div className="w-full transform transition-transform duration-[400ms] group-hover:scale-[1.04]">
                                        {experiment.diagram}
                                    </div>
                                </div>

                                <div className="flex justify-end px-2 pb-1">
                                    <div className="flex h-8 w-8 scale-75 items-center justify-center rounded-full bg-[#00FF41]/10 opacity-0 transition-all duration-[400ms] group-hover:scale-100 group-hover:opacity-100">
                                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                                            <path
                                                d="M6 3L11 8L6 13"
                                                stroke="#00FF41"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            </main>
        </div>
    );
}
