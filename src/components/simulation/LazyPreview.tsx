import { useEffect, useRef, useState } from 'react';

/** Lazy live preview: mounts a fixed desktop-sized iframe only while the card
 * is near the viewport (unmounts when scrolled away, so off-screen animations
 * never keep running), then scales the whole page down to card width (shows
 * the full page as a thumbnail instead of cropping it). */
const PREVIEW_W = 1280;
const PREVIEW_H = 800;

export const LazyPreview = ({ src, paused }: { src: string; paused: boolean }) => {
    const ref = useRef<HTMLDivElement>(null);
    // preview=1 makes the page pin devicePixelRatio to 1 (flag injected by the
    // pull script): a thumbnail doesn't need Retina resolution, and that alone
    // cuts each card's pixel workload by 75%.
    const previewSrc = `${src}${src.includes('?') ? '&' : '?'}preview=1`;
    const [visible, setVisible] = useState(false);
    const [scale, setScale] = useState(0);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const observer = new IntersectionObserver(
            (entries) => {
                setVisible(entries.some((entry) => entry.isIntersecting));
            },
            { rootMargin: '100px' },
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const resize = () => setScale(el.clientWidth / PREVIEW_W);
        const observer = new ResizeObserver(resize);
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    return (
        <div ref={ref} className="relative w-full overflow-hidden bg-black/60" style={{ aspectRatio: `${PREVIEW_W} / ${PREVIEW_H}` }}>
            {visible && !paused ? (
                <iframe
                    src={previewSrc}
                    title=""
                    aria-hidden="true"
                    tabIndex={-1}
                    loading="lazy"
                    className="pointer-events-none absolute left-0 top-0 origin-top-left border-0"
                    style={{ width: PREVIEW_W, height: PREVIEW_H, transform: `scale(${scale})` }}
                />
            ) : null}
        </div>
    );
};
