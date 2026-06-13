import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';

interface ExperimentCard {
    id: string;
    title: string;
    route?: string;
    quickViews?: Array<{
        label: string;
        route: string;
    }>;
    diagram: ReactNode;
    gradient: string;
}

type HomeTab = 'experiments' | 'courseware' | 'images';

interface CoursewareCard {
    id: string;
    title: string;
    description: string;
    status: 'draft' | 'ready';
    href?: string;
}

interface ImageResourceCard {
    id: string;
    title: string;
    path: string;
}

interface ResourceManifest {
    courseware: Array<{ id: string; title: string; path: string }>;
    images: Array<{ id: string; title: string; path: string }>;
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

const LightRefractionDiagram = () => (
    <div className="relative flex h-36 w-full items-center justify-center">
        <svg width="240" height="132" viewBox="0 0 240 132" className="overflow-visible opacity-80">
            <defs>
                <linearGradient id="refractionBeam" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FDE047" />
                    <stop offset="100%" stopColor="#FACC15" />
                </linearGradient>
            </defs>
            <rect x="36" y="62" width="168" height="50" rx="8" fill="#38BDF8" opacity="0.2" />
            <line x1="120" y1="22" x2="120" y2="112" stroke="#E2E8F0" strokeWidth="1.4" strokeDasharray="4 4" opacity="0.7" />
            <line x1="56" y1="30" x2="120" y2="66" stroke="url(#refractionBeam)" strokeWidth="3" />
            <line x1="120" y1="66" x2="176" y2="36" stroke="#F8FAFC" strokeWidth="2.5" opacity="0.8" />
            <line x1="120" y1="66" x2="164" y2="94" stroke="#38BDF8" strokeWidth="2.8" opacity="0.95" />
            <circle cx="120" cy="66" r="3.2" fill="#F8FAFC" />
        </svg>
    </div>
);

const BoyleLawDiagram = () => (
    <div className="relative flex h-36 w-full items-center justify-center">
        <svg width="220" height="132" viewBox="0 0 220 132" className="overflow-visible opacity-80">
            <rect x="72" y="24" width="76" height="88" rx="16" fill="#7DD3FC" opacity="0.2" stroke="#CFFAFE" strokeWidth="2" />
            <rect x="78" y="40" width="64" height="10" rx="3" fill="#94A3B8">
                <animate attributeName="y" values="40;54;40" dur="2.2s" repeatCount="indefinite" />
            </rect>
            <rect x="89" y="24" width="42" height="9" rx="2" fill="#334155" />
            {[0, 1, 2].map((index) => (
                <rect
                    key={index}
                    x={94 + (index % 2) * 16}
                    y={10 + Math.floor(index / 2) * 10}
                    width="12"
                    height="8"
                    rx="1.5"
                    fill="#475569"
                />
            ))}
            {[0, 1, 2, 3, 4, 5].map((index) => (
                <circle key={index} cx={84 + (index % 3) * 20} cy={72 + Math.floor(index / 3) * 18} r="4" fill="#22D3EE">
                    <animate attributeName="cx" values={`${82 + (index % 3) * 20};${88 + (index % 3) * 20};${82 + (index % 3) * 20}`} dur={`${1.4 + index * 0.15}s`} repeatCount="indefinite" />
                </circle>
            ))}
        </svg>
    </div>
);

const DoubleSlitDiagram = () => (
    <div className="relative flex h-36 w-full items-center justify-center">
        <svg width="240" height="132" viewBox="0 0 240 132" className="overflow-visible opacity-80">
            <circle cx="34" cy="66" r="7" fill="#A3E635" />
            <line x1="44" y1="66" x2="102" y2="66" stroke="#A3E635" strokeWidth="2.2" />
            <rect x="104" y="24" width="10" height="84" fill="#64748B" />
            <rect x="104" y="50" width="10" height="10" fill="#0D1117" />
            <rect x="104" y="72" width="10" height="10" fill="#0D1117" />
            {[0, 1, 2, 3, 4].map((ring) => (
                <path
                    key={`u-${ring}`}
                    d={`M 114 ${58 - ring * 2} Q ${132 + ring * 18} 58 ${150 + ring * 26} 58`}
                    stroke="#A3E635"
                    strokeWidth="1.2"
                    fill="none"
                    opacity={0.55 - ring * 0.08}
                />
            ))}
            {[0, 1, 2, 3, 4].map((ring) => (
                <path
                    key={`l-${ring}`}
                    d={`M 114 ${74 + ring * 2} Q ${132 + ring * 18} 74 ${150 + ring * 26} 74`}
                    stroke="#A3E635"
                    strokeWidth="1.2"
                    fill="none"
                    opacity={0.55 - ring * 0.08}
                />
            ))}
            <rect x="190" y="24" width="14" height="84" rx="2" fill="#1E293B" />
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <line
                    key={i}
                    x1={190}
                    y1={28 + i * 12}
                    x2={204}
                    y2={28 + i * 12}
                    stroke="#A3E635"
                    strokeWidth={i === 3 ? 2.6 : 1.2}
                    opacity={i === 3 ? 0.95 : 0.35}
                />
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

const ElectrochemicalCellDiagram = () => (
    <div className="relative flex h-36 w-full items-center justify-center">
        <svg width="240" height="132" viewBox="0 0 240 132" className="overflow-visible opacity-78">
            {/* Beaker outline */}
            <path d="M 60 40 L 60 110 Q 60 118 68 118 L 172 118 Q 180 118 180 110 L 180 40" fill="none" stroke="#475569" strokeWidth="2" />
            <line x1="56" y1="40" x2="184" y2="40" stroke="#475569" strokeWidth="2" />
            {/* Solution */}
            <rect x="62" y="58" width="116" height="58" rx="2" fill="#38BDF8" opacity="0.15" />
            {/* Zn electrode (left) */}
            <rect x="78" y="24" width="8" height="74" rx="1" fill="#94A3B8" />
            {/* Cu electrode (right) */}
            <rect x="154" y="24" width="8" height="74" rx="1" fill="#F97316" />
            {/* Wire */}
            <path d="M 82 24 L 82 16 L 46 16 L 46 10" stroke="#FACC15" strokeWidth="2" fill="none" />
            <path d="M 158 24 L 158 16 L 194 16 L 194 10" stroke="#FACC15" strokeWidth="2" fill="none" />
            <line x1="46" y1="10" x2="194" y2="10" stroke="#FACC15" strokeWidth="2" />
            {/* Voltmeter */}
            <circle cx="120" cy="10" r="8" fill="#1E293B" stroke="#FACC15" strokeWidth="1.5" />
            <text x="120" y="13" textAnchor="middle" fill="#F0F6FC" fontSize="10" fontWeight="bold">V</text>
            {/* Electrons on wire */}
            <circle cx="90" cy="10" r="2.5" fill="#00FF41">
                <animate attributeName="cx" values="60;180;60" dur="2.5s" repeatCount="indefinite" />
            </circle>
            <circle cx="140" cy="10" r="2.5" fill="#00FF41">
                <animate attributeName="cx" values="180;60;180" dur="2.5s" repeatCount="indefinite" />
            </circle>
            {/* Cations in solution */}
            <circle cx="95" cy="80" r="3" fill="#FFD166">
                <animate attributeName="cx" values="90;146;90" dur="3s" repeatCount="indefinite" />
            </circle>
            <circle cx="130" cy="90" r="3" fill="#FFD166">
                <animate attributeName="cx" values="140;96;140" dur="3.5s" repeatCount="indefinite" />
            </circle>
            {/* Anions in solution */}
            <circle cx="140" cy="75" r="2.5" fill="#38BDF8">
                <animate attributeName="cx" values="146;90;146" dur="2.8s" repeatCount="indefinite" />
            </circle>
            <circle cx="100" cy="100" r="2.5" fill="#38BDF8">
                <animate attributeName="cx" values="96;140;96" dur="3.2s" repeatCount="indefinite" />
            </circle>
            {/* Labels */}
            <text x="72" y="22" textAnchor="middle" fill="#94A3B8" fontSize="9" fontWeight="bold">Zn</text>
            <text x="168" y="22" textAnchor="middle" fill="#F97316" fontSize="9" fontWeight="bold">Cu</text>
        </svg>
    </div>
);

const SynchrotronDiagram = () => (
    <div className="relative flex h-36 w-full items-center justify-center">
        <svg width="240" height="132" viewBox="0 0 240 132" className="overflow-visible opacity-85">
            <defs>
                <radialGradient id="synchrotronCollisionGlow">
                    <stop offset="0%" stopColor="#F8FAFC" />
                    <stop offset="55%" stopColor="#38BDF8" stopOpacity="0.55" />
                    <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
                </radialGradient>
                <linearGradient id="synchrotronBlueBeam" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#67E8F9" />
                </linearGradient>
                <linearGradient id="synchrotronOrangeBeam" x1="100%" y1="0%" x2="0%" y2="0%">
                    <stop offset="0%" stopColor="#FB923C" />
                    <stop offset="100%" stopColor="#F97316" stopOpacity="0.2" />
                </linearGradient>
            </defs>
            <ellipse cx="120" cy="66" rx="74" ry="43" fill="none" stroke="#334155" strokeWidth="10" opacity="0.52" />
            <ellipse cx="120" cy="66" rx="74" ry="43" fill="none" stroke="#7DD3FC" strokeWidth="2.4" opacity="0.72" />
            {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => {
                const angle = (index / 8) * Math.PI * 2;
                const x = 120 + Math.cos(angle) * 74;
                const y = 66 + Math.sin(angle) * 43;
                return (
                    <rect
                        key={index}
                        x={x - 7}
                        y={y - 5}
                        width="14"
                        height="10"
                        rx="2"
                        fill={index % 4 === 0 ? '#F97316' : '#2563EB'}
                        opacity="0.9"
                        transform={`rotate(${(angle * 180) / Math.PI} ${x} ${y})`}
                    />
                );
            })}
            <ellipse
                cx="120"
                cy="66"
                rx="63"
                ry="34"
                fill="none"
                stroke="url(#synchrotronBlueBeam)"
                strokeWidth="2.6"
                strokeDasharray="10 10"
            >
                <animate attributeName="stroke-dashoffset" values="0;-40" dur="1.4s" repeatCount="indefinite" />
            </ellipse>
            <ellipse
                cx="120"
                cy="66"
                rx="56"
                ry="30"
                fill="none"
                stroke="url(#synchrotronOrangeBeam)"
                strokeWidth="2.6"
                strokeDasharray="10 10"
            >
                <animate attributeName="stroke-dashoffset" values="0;40" dur="1.4s" repeatCount="indefinite" />
            </ellipse>
            <circle cx="194" cy="66" r="16" fill="url(#synchrotronCollisionGlow)">
                <animate attributeName="r" values="10;18;10" dur="1.5s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.45;1;0.45" dur="1.5s" repeatCount="indefinite" />
            </circle>
            <circle cx="194" cy="66" r="5" fill="#F8FAFC" />
            <path d="M 48 104 C 76 88 94 88 120 104" stroke="#38BDF8" strokeWidth="1.8" fill="none" opacity="0.68" />
            <path d="M 52 106 L 64 101 L 60 112 Z" fill="#38BDF8" opacity="0.72" />
            <path d="M 36 29 L 64 29" stroke="#F97316" strokeWidth="2.5" />
            <path d="M 61 24 L 70 29 L 61 34 Z" fill="#F97316" />
        </svg>
    </div>
);

const experiments: ExperimentCard[] = [
    {
        id: 'synchrotron-em-fields',
        title: 'Synchrotron Fields',
        route: '/experiment/synchrotron-em-fields',
        quickViews: [
            { label: 'Macro View', route: '/experiment/synchrotron-em-fields' },
            { label: 'Micro View', route: '/experiment/synchrotron-em-fields/micro' },
        ],
        diagram: <SynchrotronDiagram />,
        gradient: 'from-cyan-900/20 via-slate-900/10 to-orange-900/20',
    },
    {
        id: 'light-refraction',
        title: 'Light Refraction',
        diagram: <LightRefractionDiagram />,
        gradient: 'from-cyan-900/20 via-sky-900/10 to-blue-900/20',
    },
    {
        id: 'boyle-law',
        title: "Boyle's Law",
        diagram: <BoyleLawDiagram />,
        gradient: 'from-emerald-900/20 via-teal-900/10 to-cyan-900/20',
    },
    {
        id: 'double-slit-interference',
        title: 'Double-Slit Interference',
        diagram: <DoubleSlitDiagram />,
        gradient: 'from-lime-900/20 via-emerald-900/10 to-green-900/20',
    },
    {
        id: 'hydrogen-transitions',
        title: 'Hydrogen Atom',
        quickViews: [
            { label: '3D View', route: '/experiment/hydrogen-transitions' },
            { label: 'Abstract View', route: '/experiment/hydrogen-transitions/abstract' },
        ],
        diagram: <HydrogenAtomDiagram />,
        gradient: 'from-blue-900/20 via-purple-900/10 to-teal-900/20',
    },
    {
        id: 'rutherford-scattering',
        title: 'Rutherford',
        route: '/experiment/rutherford-scattering',
        quickViews: [
            { label: 'Macro View', route: '/experiment/rutherford-scattering' },
            { label: 'Micro View', route: '/experiment/rutherford-scattering/micro' },
        ],
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
    {
        id: 'galvanic-cell',
        title: 'Electrochemical Cell',
        diagram: <ElectrochemicalCellDiagram />,
        gradient: 'from-amber-900/20 via-yellow-900/10 to-orange-900/20',
    },
];

export default function Home() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<HomeTab>('experiments');
    const [coursewareCards, setCoursewareCards] = useState<CoursewareCard[]>([]);
    const [imageResources, setImageResources] = useState<ImageResourceCard[]>([]);

    useEffect(() => {
        let cancelled = false;

        const loadManifest = async () => {
            try {
                const response = await fetch(`/resource-manifest.json?t=${Date.now()}`, {
                    cache: 'no-store',
                });
                if (!response.ok) {
                    throw new Error('Failed to load resource manifest.');
                }

                const manifest = (await response.json()) as ResourceManifest;
                if (cancelled) return;

                setCoursewareCards(
                    (manifest.courseware ?? []).map((item) => ({
                        id: item.id,
                        title: item.title,
                        description: `HTML Courseware: ${item.path}`,
                        status: 'ready',
                        href: item.path,
                    })),
                );
                setImageResources(
                    (manifest.images ?? []).map((item) => ({
                        id: item.id,
                        title: item.title,
                        path: item.path,
                    })),
                );
            } catch {
                if (cancelled) return;
                setCoursewareCards([]);
                setImageResources([]);
            }
        };

        void loadManifest();

        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <div
            className="flex min-h-screen flex-col bg-[#0D1117]"
            style={{
                fontFamily:
                    'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            }}
        >
            <header className="px-6 pb-8 pt-12 sm:px-10 lg:px-20 lg:pb-10 lg:pt-16">
                <h1
                    className="bg-gradient-to-r from-[#22D3EE] via-[#34D399] to-[#A78BFA] bg-clip-text text-center text-[44px] font-[700] leading-[1.08] text-transparent sm:text-[56px]"
                    style={{ filter: 'drop-shadow(0 10px 24px rgba(52, 211, 153, 0.3))' }}
                >
                    Spark Flow
                </h1>
            </header>

            <main className="flex-1 px-6 pb-14 sm:px-10 lg:px-20 lg:pb-16">
                <div className="mx-auto w-full max-w-[1360px]">
                <section className="flex justify-center" style={{ marginBottom: 80 }}>
                    <div className="inline-flex rounded-2xl border border-[#30363D] bg-[#111827]/70 p-1.5 shadow-lg">
                        {[
                            { key: 'experiments', label: 'Experiments' },
                            { key: 'courseware', label: 'Courseware' },
                            { key: 'images', label: 'Images' },
                        ].map((tab) => {
                            const isActive = activeTab === tab.key;
                            return (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key as HomeTab)}
                                    className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-all ${
                                        isActive
                                            ? 'bg-gradient-to-r from-cyan-600 to-sky-500 text-white shadow-lg shadow-cyan-900/30'
                                            : 'text-slate-300 hover:bg-white/5 hover:text-white'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                </section>

                {activeTab === 'experiments' ? (
                    <div className="grid w-full grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
                        {experiments.map((experiment) => (
                            <article
                                key={experiment.id}
                                onClick={() => navigate(experiment.route ?? `/experiment/${experiment.id}`)}
                                className={`group relative min-h-[292px] cursor-pointer overflow-hidden rounded-[20px] border border-[#30363D] bg-gradient-to-br ${experiment.gradient} p-8 transition-all duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:-translate-y-2 hover:border-[#00FF41]/35 hover:bg-[#161B22] hover:shadow-[0_24px_50px_rgba(0,255,65,0.12)]`}
                            >
                                <div className="absolute inset-2 rounded-[16px] bg-gradient-to-br from-white/[0.04] via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

                                <div className="relative z-10 flex h-full flex-col">
                                    <h2 className="px-2 pt-1 text-[25px] font-[700] leading-[1.15] tracking-[-0.01em] text-[#F0F6FC] transition-colors duration-[400ms] group-hover:text-white">
                                        {experiment.title}
                                    </h2>

                                    <div className="flex flex-1 items-center justify-center py-7">
                                        <div className="w-full transform transition-transform duration-[400ms] group-hover:scale-[1.04]">
                                            {experiment.diagram}
                                        </div>
                                    </div>

                                    <div className="mt-auto flex items-center justify-between gap-3 px-2 pb-1 pt-2">
                                        <div className="flex flex-wrap gap-2">
                                            {(experiment.quickViews ?? []).map((view) => (
                                                <button
                                                    key={view.route}
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        navigate(view.route);
                                                    }}
                                                    className="rounded-full border border-cyan-400/35 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-200 transition-all hover:border-cyan-300/70 hover:bg-cyan-400/20 hover:text-white"
                                                >
                                                    {view.label}
                                                </button>
                                            ))}
                                        </div>
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
                ) : null}

                {activeTab === 'courseware' ? (
                    <div className="grid w-full grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
                        {coursewareCards.length === 0 ? (
                            <article className="relative min-h-[240px] overflow-hidden rounded-[20px] border border-dashed border-[#30363D] bg-slate-900/50 p-8 md:col-span-2 xl:col-span-3">
                                <h2 className="mb-3 text-2xl font-[700] leading-tight text-[#F0F6FC]">
                                    No Courseware Found
                                </h2>
                                <p className="text-sm leading-relaxed text-slate-300">
                                    Add `.html` files to `public/courseware`, then refresh this page.
                                </p>
                            </article>
                        ) : null}
                        {coursewareCards.map((card) => (
                            <article
                                key={card.id}
                                className="relative min-h-[240px] overflow-hidden rounded-[20px] border border-[#30363D] bg-gradient-to-br from-slate-900/80 via-slate-800/40 to-slate-900/80 p-8"
                            >
                                <div className="mb-5 inline-flex rounded-full border border-amber-400/40 bg-amber-900/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-200">
                                    {card.status === 'ready' ? 'Ready' : 'Draft'}
                                </div>
                                <h2 className="mb-3 text-2xl font-[700] leading-tight text-[#F0F6FC]">
                                    {card.title}
                                </h2>
                                <p className="text-sm leading-relaxed text-slate-300">{card.description}</p>
                                {card.href ? (
                                    <a
                                        href={card.href}
                                        className="mt-6 inline-flex items-center rounded-lg bg-gradient-to-r from-cyan-600 to-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-900/30 transition-all hover:from-cyan-500 hover:to-sky-400"
                                    >
                                        Open HTML
                                    </a>
                                ) : (
                                    <p className="mt-6 text-xs font-medium uppercase tracking-wider text-slate-500">
                                        Waiting for HTML content
                                    </p>
                                )}
                            </article>
                        ))}
                    </div>
                ) : null}

                {activeTab === 'images' ? (
                    <div className="grid w-full grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-3">
                        {imageResources.length === 0 ? (
                            <article className="relative min-h-[240px] overflow-hidden rounded-[20px] border border-dashed border-[#30363D] bg-slate-900/50 p-8 sm:col-span-2 xl:col-span-3">
                                <h2 className="mb-3 text-2xl font-[700] leading-tight text-[#F0F6FC]">
                                    No Image Assets Found
                                </h2>
                                <p className="text-sm leading-relaxed text-slate-300">
                                    Add image files to `public/images`, then refresh this page.
                                </p>
                            </article>
                        ) : null}
                        {imageResources.map((image) => (
                            <a
                                key={image.id}
                                href={image.path}
                                target="_blank"
                                rel="noreferrer"
                                className="group overflow-hidden rounded-[20px] border border-[#30363D] bg-slate-900/70 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/45 hover:shadow-[0_18px_36px_rgba(34,211,238,0.16)]"
                            >
                                <div className="aspect-[16/10] overflow-hidden bg-slate-950">
                                    <img
                                        src={image.path}
                                        alt={image.title}
                                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                        loading="lazy"
                                    />
                                </div>
                                <div className="space-y-1 px-5 py-4">
                                    <h3 className="text-base font-semibold text-[#F0F6FC]">{image.title}</h3>
                                    <p className="truncate text-xs text-slate-400">{image.path}</p>
                                </div>
                            </a>
                        ))}
                    </div>
                ) : null}
                </div>
            </main>
        </div>
    );
}
