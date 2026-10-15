export const simCanvasCategories = [
    { id: 'all', label: '全部 · All' },
    { id: 'mechanics', label: '力学与热学 · Mechanics & Heat' },
    { id: 'electromagnetism', label: '电磁 · Electromagnetism' },
    { id: 'waves', label: '波与光 · Waves & Optics' },
    { id: 'cosmos', label: '原子与宇宙 · Atoms & Cosmos' },
    { id: 'math', label: '数学与计算 · Math & Computing' },
    { id: 'chembio', label: '化学与生物 · Chemistry & Biology' },
    { id: 'earth', label: '地球科学 · Earth Science' },
    { id: 'art', label: '视觉艺术 · Visual Arts' },
    { id: 'exam', label: '高考真题 · Exam Problems' },
    { id: 'research', label: '论文实验 · Paper Lab' },
] as const;
export type SimCanvasCategory = typeof simCanvasCategories[number]['id'];

/** meta.json discipline -> gallery tab. Legacy 'physics' (first sync) defaults
 * to mechanics; unknown values also fall back to mechanics, like before. */
const META_TAB: Record<string, SimCanvasCategory> = {
    mechanics: 'mechanics',
    electromagnetism: 'electromagnetism',
    waves: 'waves',
    cosmos: 'cosmos',
    math: 'math',
    cs: 'math',
    chemistry: 'chembio',
    biology: 'chembio',
    earth: 'earth',
    art: 'art',
    research: 'research',
};

const EXAM_SLUGS = ['charged-bead-parallel-plates', 'jumping-robot-guangdong-2026', 'charged-bead-exam-steps', 'jumping-robot-exam-steps'];

export function simCanvasTopics(card: { href?: string; category?: string }): SimCanvasCategory[] {
    const slug = (card.href ?? '').replace(/[?#].*$/, '').replace(/\/+$/, '').split('/').pop() ?? '';
    const discipline = META_TAB[card.category ?? ''] ?? 'mechanics';
    return EXAM_SLUGS.includes(slug) ? [discipline, 'exam'] : [discipline];
}
