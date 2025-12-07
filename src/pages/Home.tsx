import { Link } from 'react-router-dom';
import { ExperimentCategory } from '../utils/constants';

interface ExperimentCard {
    id: string;
    name: string;
    category: ExperimentCategory;
    description: string;
    thumbnail: string;
    difficulty: 'basic' | 'intermediate' | 'advanced';
}

// 临时实验数据
const experiments: ExperimentCard[] = [
    {
        id: 'rutherford-scattering',
        name: '卢瑟福α粒子散射实验',
        category: ExperimentCategory.AtomicPhysics,
        description: '通过α粒子轰击金箔,观察散射现象,揭示原子核式结构',
        thumbnail: '/thumbnails/rutherford.jpg',
        difficulty: 'intermediate',
    },
    {
        id: 'hydrogen-transitions',
        name: '氢原子能级跃迁',
        category: ExperimentCategory.AtomicPhysics,
        description: '观察氢原子电子在不同能级间跃迁,理解光谱线的产生',
        thumbnail: '/thumbnails/hydrogen.jpg',
        difficulty: 'basic',
    },
];

const difficultyColors = {
    basic: 'bg-green-500/20 text-green-300',
    intermediate: 'bg-yellow-500/20 text-yellow-300',
    advanced: 'bg-red-500/20 text-red-300',
};

const difficultyLabels = {
    basic: '基础',
    intermediate: '中级',
    advanced: '高级',
};

export default function Home() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
            {/* Header */}
            <header className="border-b border-white/10 bg-slate-900/50 backdrop-blur-sm">
                <div className="container mx-auto px-6 py-6">
                    <h1 className="text-3xl font-bold text-white">
                        高中物理虚拟实验室
                    </h1>
                    <p className="mt-2 text-slate-300">
                        交互式3D物理实验仿真平台
                    </p>
                </div>
            </header>

            {/* Main Content */}
            <main className="container mx-auto px-6 py-12">
                <section>
                    <h2 className="mb-8 text-2xl font-semibold text-white">
                        原子物理实验
                    </h2>

                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {experiments.map((exp) => (
                            <Link
                                key={exp.id}
                                to={`/experiment/${exp.id}`}
                                className="group relative overflow-hidden rounded-xl bg-slate-800/50 backdrop-blur-sm border border-white/10 transition-all hover:border-blue-500/50 hover:shadow-xl hover:shadow-blue-500/20"
                            >
                                {/* Thumbnail */}
                                <div className="aspect-video bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                                    <div className="text-6xl opacity-50">⚛️</div>
                                </div>

                                {/* Content */}
                                <div className="p-6">
                                    <div className="mb-2 flex items-center justify-between">
                                        <h3 className="text-lg font-semibold text-white group-hover:text-blue-400 transition-colors">
                                            {exp.name}
                                        </h3>
                                        <span
                                            className={`rounded-full px-2 py-1 text-xs font-medium ${difficultyColors[exp.difficulty]
                                                }`}
                                        >
                                            {difficultyLabels[exp.difficulty]}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-400">{exp.description}</p>
                                </div>

                                {/* Hover Effect */}
                                <div className="absolute inset-0 bg-gradient-to-t from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                            </Link>
                        ))}
                    </div>
                </section>

                {/* Coming Soon */}
                <section className="mt-16">
                    <h2 className="mb-6 text-2xl font-semibold text-white/50">
                        即将推出
                    </h2>
                    <div className="grid gap-4 md:grid-cols-4">
                        {['力学实验', '电磁学实验', '光学实验', '热学实验'].map(
                            (category) => (
                                <div
                                    key={category}
                                    className="rounded-lg bg-slate-800/30 border border-white/5 p-6 text-center"
                                >
                                    <p className="text-slate-500">{category}</p>
                                </div>
                            )
                        )}
                    </div>
                </section>
            </main>
        </div>
    );
}
