import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LazyPreview } from '@/components/simulation/LazyPreview';

/**
 * 研究盲评区（隐藏入口：首页 SimCanvas 标签 5 连击）。
 * 数据全部在浏览器本地：manifest 只读自 /rating/manifest.json（随机 ID +
 * 任务背景 + 每评分者顺序），评分写 localStorage，导出文件回收，无后端。
 */

interface Manifest {
    version: number;
    rateable: Array<{ id: string; bg: string }>;
    orders: Record<string, string[]>;
    browse: Array<{ id: string; bg: string }>;
    cal: Array<{ n: number; file: string; label: string; symptom: string; goal: string }>;
}

type Dim = 'd3' | 'd4' | 'd7' | 'd8' | 'd9' | 'd10';
const DIMS: Dim[] = ['d3', 'd4', 'd7', 'd8', 'd9', 'd10'];
const FREE_TEXT_DIMS: Dim[] = ['d4', 'd7'];

type RaterId = 'teacher1' | 'teacher2' | 'author' | 'guest';
const RATERS: Array<{ id: RaterId; labelKey: string }> = [
    { id: 'teacher1', labelKey: 'identity.teacher1' },
    { id: 'teacher2', labelKey: 'identity.teacher2' },
    { id: 'author', labelKey: 'identity.author' },
    { id: 'guest', labelKey: 'identity.guest' },
];

interface RatingRecord {
    dims: Partial<Record<Dim, number>>;
    d4Text?: string;
    d7Text?: string;
    note?: string;
    seconds: number;
    savedAt?: string;
    sessionDate?: string;
}

/** rater -> artifactId -> record */
type Store = Record<string, Record<string, RatingRecord>>;

const LS_RATER = 'sparkflow.rating.rater';
const LS_STORE = 'sparkflow.rating.v1';

interface ScorePatch {
    dims?: Partial<Record<Dim, number>>;
    d4Text?: string;
    d7Text?: string;
    note?: string;
    addSeconds?: number;
}

const isComplete = (record?: RatingRecord) =>
    DIMS.every((dim) => (record?.dims?.[dim] ?? 0) > 0);

/** 1–5 分值按钮 */
const Chip = ({
    value,
    selected,
    disabled,
    onClick,
    label,
}: {
    value: number;
    selected: boolean;
    disabled: boolean;
    onClick: () => void;
    label: string;
}) => (
    <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        aria-label={label}
        className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold transition-all ${
            selected
                ? 'border-cyan-400/70 bg-cyan-500/25 text-cyan-100 shadow-[0_0_12px_rgba(34,211,238,0.35)]'
                : 'border-[#30363D] bg-black/30 text-slate-400 hover:border-cyan-400/40 hover:text-slate-200'
        } ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
    >
        {value}
    </button>
);

const PlayOverlay = () => (
    <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-300 group-hover:bg-black/35 group-hover:opacity-100">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-cyan-300/60 bg-black/55 backdrop-blur-sm">
            <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 8L11 8M11 8L7.5 4.5M11 8L7.5 11.5" stroke="#67E8F9" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        </div>
    </div>
);

/** 全屏查看弹窗（与 SimCanvasGallery 同款交互：进入即请求全屏，离开全屏即关闭） */
const FullscreenDialog = ({
    src,
    label,
    onClose,
}: {
    src: string;
    label: string;
    onClose: () => void;
}) => {
    const { t } = useTranslation('rating');
    const dialogRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        void dialogRef.current?.requestFullscreen?.().catch(() => {
            // fullscreen denied: the fixed overlay still covers the viewport
        });
        const onFullscreenChange = () => {
            if (!document.fullscreenElement) onClose();
        };
        document.addEventListener('fullscreenchange', onFullscreenChange);
        return () => {
            document.removeEventListener('fullscreenchange', onFullscreenChange);
            if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => undefined);
        };
    }, [onClose]);

    return (
        <div ref={dialogRef} className="fixed inset-0 z-50 bg-black" role="dialog" aria-modal="true" aria-label={label}>
            <iframe src={src} title={label} className="h-full w-full border-0" />
            <button
                type="button"
                onClick={onClose}
                aria-label={t('close')}
                className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/50 text-slate-300 opacity-40 backdrop-blur-sm transition-all hover:opacity-100 hover:border-cyan-400/50 hover:text-white"
            >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
            </button>
        </div>
    );
};

/** D4/D7 ≤2 必填自由文本弹框 */
const FreeTextModal = ({
    dim,
    score,
    initial,
    onSave,
    onCancel,
}: {
    dim: Dim;
    score: number;
    initial: string;
    onSave: (text: string) => void;
    onCancel: () => void;
}) => {
    const { t } = useTranslation('rating');
    const [text, setText] = useState(initial);
    const areaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        areaRef.current?.focus();
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onCancel();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onCancel]);

    const trimmed = text.trim();

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
            <div className="w-full max-w-lg rounded-2xl border border-[#30363D] bg-[#111827] p-6 shadow-2xl">
                <h3 className="mb-1 text-base font-bold text-[#F0F6FC]">
                    {t('freeText.title', { dim: t(`dim.${dim}`), score })}
                </h3>
                <textarea
                    ref={areaRef}
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    rows={4}
                    placeholder={t('freeText.placeholder')}
                    className="mt-3 w-full resize-none rounded-xl border border-[#30363D] bg-[#0D1117] p-3 text-sm text-slate-200 outline-none transition-colors placeholder:text-slate-500 focus:border-cyan-400/60"
                />
                <div className="mt-4 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-400 transition-colors hover:text-white"
                    >
                        {t('freeText.cancel')}
                    </button>
                    <button
                        type="button"
                        disabled={trimmed.length < 2}
                        onClick={() => onSave(text.trim())}
                        className="rounded-lg bg-gradient-to-r from-cyan-600 to-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-900/30 transition-all hover:from-cyan-500 hover:to-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {t('freeText.save')}
                    </button>
                </div>
            </div>
        </div>
    );
};

interface RateCardProps {
    id: string;
    index: number;
    bg: string;
    record: RatingRecord;
    disabled: boolean;
    paused: boolean;
    onOpen: (id: string) => void;
    onScore: (id: string, dim: Dim, score: number) => void;
    onNote: (id: string, note: string) => void;
}

const RateCard = ({ id, index, bg, record, disabled, paused, onOpen, onScore, onNote }: RateCardProps) => {
    const { t } = useTranslation('rating');
    const [noteOpen, setNoteOpen] = useState(false);
    const [noteDraft, setNoteDraft] = useState(record.note ?? '');
    const done = isComplete(record);

    return (
        <article className="overflow-hidden rounded-[16px] border border-[#30363D] bg-[#111827]/80 transition-all duration-[400ms] ease-[cubic-bezier(0.4,0.0,0.2,1)] hover:border-cyan-400/45">
            <div className="group relative cursor-pointer" onClick={() => onOpen(id)}>
                <LazyPreview src={`/rating/artifacts/${id}.html`} paused={paused} />
                <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-md border border-cyan-300/40 bg-black/60 px-2 py-0.5 font-mono text-xs font-semibold text-cyan-200">
                    {index}
                </div>
                <PlayOverlay />
            </div>
            <div className="space-y-2.5 p-4">
                <div className="flex items-start justify-between gap-2">
                    <p className="flex-1 text-xs leading-relaxed text-slate-400" title={bg}>
                        {bg}
                    </p>
                    {done ? (
                        <span className="flex shrink-0 items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-300">
                            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                                <path d="M3 8.5L6.5 12L13 4.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            {t('badge.rated')}
                        </span>
                    ) : null}
                </div>
                {DIMS.map((dim) => {
                    const current = record.dims?.[dim] ?? 0;
                    return (
                        <div key={dim} className="flex items-center justify-between gap-2">
                            <span className="w-[72px] shrink-0 text-xs font-semibold text-slate-300" title={t(`dimDesc.${dim}`)}>
                                {t(`dim.${dim}`)}
                            </span>
                            <div className="flex gap-1.5">
                                {[1, 2, 3, 4, 5].map((value) => (
                                    <Chip
                                        key={value}
                                        value={value}
                                        selected={current === value}
                                        disabled={disabled}
                                        label={`${t(`dim.${dim}`)} ${value}`}
                                        onClick={() => onScore(id, dim, value)}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })}
                <div className="flex items-center justify-between pt-0.5">
                    <button
                        type="button"
                        onClick={() => {
                            setNoteOpen(!noteOpen);
                            setNoteDraft(record.note ?? '');
                        }}
                        className="text-[11px] font-semibold text-slate-500 transition-colors hover:text-cyan-300"
                    >
                        {t('note.label')}
                    </button>
                    {record.seconds >= 60 ? (
                        <span className="text-[11px] text-slate-500">{t('time', { min: Math.round(record.seconds / 60) })}</span>
                    ) : null}
                </div>
                {noteOpen ? (
                    <textarea
                        value={noteDraft}
                        onChange={(event) => setNoteDraft(event.target.value)}
                        onBlur={() => onNote(id, noteDraft.trim())}
                        rows={2}
                        placeholder={t('note.placeholder')}
                        className="w-full resize-none rounded-lg border border-[#30363D] bg-[#0D1117] p-2 text-xs text-slate-300 outline-none placeholder:text-slate-600 focus:border-cyan-400/50"
                    />
                ) : null}
            </div>
        </article>
    );
};

const BrowseCard = ({ id, bg, paused, onOpen }: { id: string; bg: string; paused: boolean; onOpen: (id: string) => void }) => (
    <article className="overflow-hidden rounded-[16px] border border-[#30363D] bg-[#111827]/80 transition-all duration-[400ms] hover:border-cyan-400/45">
        <div className="group relative cursor-pointer" onClick={() => onOpen(id)}>
            <LazyPreview src={`/rating/browse/${id}.html`} paused={paused} />
            <PlayOverlay />
        </div>
        <p className="p-4 text-xs leading-relaxed text-slate-400">{bg}</p>
    </article>
);

const CalCard = ({
    item,
    paused,
    onOpen,
}: {
    item: Manifest['cal'][number];
    paused: boolean;
    onOpen: (src: string, label: string) => void;
}) => {
    const { t } = useTranslation('rating');
    return (
        <article className="overflow-hidden rounded-[16px] border border-[#30363D] bg-[#111827]/80 transition-all duration-[400ms] hover:border-cyan-400/45">
            <div className="group relative cursor-pointer" onClick={() => onOpen(item.file, item.label)}>
                <LazyPreview src={`/rating/${item.file}`} paused={paused} />
                <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-md border border-amber-300/40 bg-black/60 px-2 py-0.5 font-mono text-xs font-semibold text-amber-200">
                    {item.n}
                </div>
                <PlayOverlay />
            </div>
            <div className="space-y-2 p-4">
                <h3 className="text-sm font-bold text-[#F0F6FC]">{item.label}</h3>
                <p className="text-xs leading-relaxed text-slate-400">
                    <span className="font-semibold text-slate-300">{t('cal.symptom')}：</span>
                    {item.symptom}
                </p>
                <p className="rounded-lg border border-cyan-400/20 bg-cyan-500/5 p-2 text-xs leading-relaxed text-cyan-100/90">
                    <span className="font-semibold">{t('cal.goal')}：</span>
                    {item.goal}
                </p>
            </div>
        </article>
    );
};

export const RatingSection = () => {
    const { t } = useTranslation('rating');
    const [manifest, setManifest] = useState<Manifest | null>(null);
    const [loadError, setLoadError] = useState(false);
    const [rater, setRater] = useState<RaterId | ''>(() => {
        const saved = localStorage.getItem(LS_RATER);
        return RATERS.some((r) => r.id === saved) ? (saved as RaterId) : '';
    });
    const [store, setStore] = useState<Store>(() => {
        try {
            return JSON.parse(localStorage.getItem(LS_STORE) ?? '{}') as Store;
        } catch {
            return {};
        }
    });
    const [view, setView] = useState<'cal' | 'rate' | 'browse'>('cal');
    const [active, setActive] = useState<{ src: string; label: string; id?: string } | null>(null);
    const [pendingText, setPendingText] = useState<{ id: string; dim: Dim; score: number } | null>(null);
    const [flash, setFlash] = useState('');
    const openSince = useRef(0);

    useEffect(() => {
        let cancelled = false;
        fetch(`/rating/manifest.json?t=${Date.now()}`, { cache: 'no-store' })
            .then((response) => {
                if (!response.ok) throw new Error('manifest');
                return response.json() as Promise<Manifest>;
            })
            .then((data) => {
                if (!cancelled) setManifest(data);
            })
            .catch(() => {
                if (!cancelled) setLoadError(true);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!flash) return;
        const timer = window.setTimeout(() => setFlash(''), 4000);
        return () => window.clearTimeout(timer);
    }, [flash]);

    const locked = rater === '' || rater === 'guest';

    const records = locked ? {} : store[rater] ?? {};

    const updateRecord = (id: string, patch: ScorePatch) => {
        if (locked) return;
        setStore((prev) => {
            const raterRecords = { ...(prev[rater] ?? {}) };
            const base: RatingRecord = raterRecords[id] ?? { dims: {}, seconds: 0 };
            const { addSeconds = 0, dims, ...rest } = patch;
            const next: RatingRecord = {
                ...base,
                ...rest,
                // dims 在函数式更新内深合并：同步快速连点时不允许后一次覆盖前一次
                ...(dims ? { dims: { ...base.dims, ...dims } } : {}),
                seconds: (base.seconds ?? 0) + addSeconds,
                ...(Object.keys(rest).length > 0 || dims
                    ? { savedAt: new Date().toISOString(), sessionDate: new Date().toISOString().slice(0, 10) }
                    : {}),
            };
            raterRecords[id] = next;
            const nextStore = { ...prev, [rater]: raterRecords };
            localStorage.setItem(LS_STORE, JSON.stringify(nextStore));
            return nextStore;
        });
    };

    const chooseRater = (id: RaterId) => {
        localStorage.setItem(LS_RATER, id);
        setRater(id);
        setView(id === 'guest' ? 'browse' : 'cal');
    };

    const onScore = (id: string, dim: Dim, score: number) => {
        if (locked) return;
        if (FREE_TEXT_DIMS.includes(dim) && score <= 2) {
            setPendingText({ id, dim, score });
            return;
        }
        updateRecord(id, { dims: { [dim]: score } });
    };

    const commitPendingText = (text: string) => {
        if (!pendingText || locked) return;
        const { id, dim, score } = pendingText;
        updateRecord(id, {
            dims: { [dim]: score },
            ...(dim === 'd4' ? { d4Text: text } : { d7Text: text }),
        });
        setPendingText(null);
    };

    const openArtifact = (src: string, label: string, id?: string) => {
        openSince.current = Date.now();
        setActive({ src, label, id });
    };

    const closeArtifact = () => {
        const spent = Date.now() - openSince.current;
        if (active?.id && spent > 0 && spent < 3_600_000) {
            updateRecord(active.id, { addSeconds: Math.round(spent / 1000) });
        }
        setActive(null);
    };

    const ratedCount = manifest ? manifest.rateable.filter((item) => isComplete(records[item.id])).length : 0;

    const orderedRateable = (() => {
        if (!manifest) return [];
        const byId = new Map(manifest.rateable.map((item) => [item.id, item]));
        const order = locked ? [] : manifest.orders[rater] ?? [];
        const seen = new Set<string>();
        const list: Array<{ id: string; bg: string }> = [];
        for (const id of order) {
            const item = byId.get(id);
            if (item && !seen.has(id)) {
                seen.add(id);
                list.push(item);
            }
        }
        for (const item of manifest.rateable) {
            if (!seen.has(item.id)) {
                seen.add(item.id);
                list.push(item);
            }
        }
        return list;
    })();

    const doExport = () => {
        if (locked) return;
        const ratings = store[rater] ?? {};
        if (Object.keys(ratings).length === 0) {
            setFlash(t('export.empty'));
            return;
        }
        const now = new Date();
        const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
        const filename = `simcanvas-rating-${rater}-${stamp}.json`;
        const payload = { format: 'simcanvas-rating', version: 1, rater, exportedAt: now.toISOString(), ratings };
        const blob = new Blob([JSON.stringify(payload, null, 1)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        anchor.click();
        URL.revokeObjectURL(url);
        setFlash(t('export.done', { file: filename }));
    };

    const doCopy = async () => {
        if (locked) return;
        const ratings = store[rater] ?? {};
        if (Object.keys(ratings).length === 0) {
            setFlash(t('export.empty'));
            return;
        }
        const payload = JSON.stringify({ format: 'simcanvas-rating', version: 1, rater, exportedAt: new Date().toISOString(), ratings });
        try {
            await navigator.clipboard.writeText(payload);
            setFlash(t('export.copied'));
        } catch {
            const area = document.createElement('textarea');
            area.value = payload;
            document.body.appendChild(area);
            area.select();
            document.execCommand('copy');
            document.body.removeChild(area);
            setFlash(t('export.copied'));
        }
    };

    if (loadError) {
        return (
            <article className="min-h-[240px] overflow-hidden rounded-[20px] border border-dashed border-[#30363D] bg-slate-900/50 p-8">
                <p className="text-sm text-slate-300">{t('loadError')}</p>
            </article>
        );
    }

    if (!manifest) {
        return (
            <article className="min-h-[240px] overflow-hidden rounded-[20px] border border-dashed border-[#30363D] bg-slate-900/50 p-8">
                <p className="text-sm text-slate-400">{t('loading')}</p>
            </article>
        );
    }

    if (rater === '') {
        return (
            <article className="mx-auto max-w-xl rounded-[20px] border border-[#30363D] bg-[#111827]/80 p-8">
                <h2 className="mb-2 text-2xl font-[700] text-[#F0F6FC]">{t('title')}</h2>
                <p className="mb-6 text-sm leading-relaxed text-slate-400">{t('identity.hint')}</p>
                <div className="grid grid-cols-2 gap-3">
                    {RATERS.map((option) => (
                        <button
                            key={option.id}
                            type="button"
                            onClick={() => chooseRater(option.id)}
                            className="rounded-xl border border-[#30363D] bg-black/30 px-4 py-3 text-sm font-semibold text-slate-200 transition-all hover:border-cyan-400/50 hover:bg-cyan-500/10 hover:text-white"
                        >
                            {t(option.labelKey)}
                        </button>
                    ))}
                </div>
            </article>
        );
    }

    const tabs: Array<{ key: 'cal' | 'rate' | 'browse'; labelKey: string }> = [
        { key: 'cal', labelKey: 'tab.cal' },
        ...(locked ? [] : [{ key: 'rate' as const, labelKey: 'tab.rate' }]),
        { key: 'browse', labelKey: 'tab.browse' },
    ];

    return (
        <div className="w-full">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#30363D] bg-[#111827]/70 px-5 py-4">
                <div>
                    <h2 className="text-lg font-[700] text-[#F0F6FC]">{t('title')}</h2>
                    <p className="text-xs text-slate-500">{t('subtitle')}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    {locked ? null : (
                        <>
                            <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-200">
                                {t('progress', { rated: ratedCount, total: manifest.rateable.length })}
                            </span>
                            <button
                                type="button"
                                onClick={doExport}
                                className="rounded-lg bg-gradient-to-r from-cyan-600 to-sky-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-cyan-900/30 transition-all hover:from-cyan-500 hover:to-sky-400"
                            >
                                {t('export.button')}
                            </button>
                            <button
                                type="button"
                                onClick={doCopy}
                                className="rounded-lg border border-[#30363D] px-3 py-2 text-xs font-semibold text-slate-300 transition-all hover:border-cyan-400/40 hover:text-white"
                            >
                                {t('export.copy')}
                            </button>
                        </>
                    )}
                    <button
                        type="button"
                        onClick={() => setRater('')}
                        title={t('identity.change')}
                        className="rounded-lg border border-[#30363D] px-3 py-2 text-xs font-semibold text-slate-400 transition-all hover:border-cyan-400/40 hover:text-white"
                    >
                        {t(`identity.${rater}`)}
                        <span className="ml-1 text-slate-600">⇄</span>
                    </button>
                </div>
            </div>

            {locked ? (
                <p className="mb-5 rounded-xl border border-amber-400/25 bg-amber-500/5 px-4 py-2.5 text-xs leading-relaxed text-amber-200/90">
                    {t('guest.locked')}
                </p>
            ) : (
                <p className="mb-5 text-xs leading-relaxed text-slate-500">{t('export.hint')}</p>
            )}

            <div className="mb-7 flex justify-start">
                <div className="inline-flex rounded-2xl border border-[#30363D] bg-[#111827]/70 p-1.5">
                    {tabs.map((tab) => (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => setView(tab.key)}
                            className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                                view === tab.key
                                    ? 'bg-gradient-to-r from-cyan-600 to-sky-500 text-white shadow-lg shadow-cyan-900/30'
                                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                            }`}
                        >
                            {t(tab.labelKey)}
                        </button>
                    ))}
                </div>
            </div>

            {view === 'cal' ? (
                <div>
                    <p className="mb-5 rounded-xl border border-amber-400/25 bg-amber-500/5 px-4 py-2.5 text-xs leading-relaxed text-amber-200/90">
                        {t('cal.hint')}
                    </p>
                    <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                        {manifest.cal.map((item) => (
                            <CalCard key={item.n} item={item} paused={active !== null} onOpen={(src, label) => openArtifact(src, label)} />
                        ))}
                    </div>
                </div>
            ) : null}

            {view === 'rate' && !locked ? (
                <div>
                    <p className="mb-5 text-xs leading-relaxed text-slate-500">{t('scale')}</p>
                    <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                        {orderedRateable.map((item, index) => (
                            <RateCard
                                key={item.id}
                                id={item.id}
                                index={index + 1}
                                bg={item.bg}
                                record={records[item.id] ?? { dims: {}, seconds: 0 }}
                                disabled={false}
                                paused={active !== null}
                                onOpen={(id) => openArtifact(`/rating/artifacts/${id}.html`, id, id)}
                                onScore={onScore}
                                onNote={(id, note) => updateRecord(id, { note })}
                            />
                        ))}
                    </div>
                </div>
            ) : null}

            {view === 'browse' ? (
                <div>
                    <p className="mb-5 text-xs leading-relaxed text-slate-500">{t('browse.hint')}</p>
                    <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                        {manifest.browse.map((item) => (
                            <BrowseCard
                                key={item.id}
                                id={item.id}
                                bg={item.bg}
                                paused={active !== null}
                                onOpen={(id) => openArtifact(`/rating/browse/${id}.html`, id)}
                            />
                        ))}
                    </div>
                </div>
            ) : null}

            {flash ? (
                <div className="fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 rounded-full border border-cyan-400/40 bg-[#111827]/95 px-5 py-2.5 text-xs font-semibold text-cyan-100 shadow-xl">
                    {flash}
                </div>
            ) : null}

            {active ? <FullscreenDialog src={active.src} label={active.label} onClose={closeArtifact} /> : null}
            {pendingText ? (
                <FreeTextModal
                    dim={pendingText.dim}
                    score={pendingText.score}
                    initial={pendingText.dim === 'd4' ? records[pendingText.id]?.d4Text ?? '' : records[pendingText.id]?.d7Text ?? ''}
                    onSave={commitPendingText}
                    onCancel={() => setPendingText(null)}
                />
            ) : null}
        </div>
    );
};
