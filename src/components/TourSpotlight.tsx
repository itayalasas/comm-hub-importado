import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface TourSpotlightProps {
  selector: string;
  title: string;
  body: string;
  ctaLabel: string;
  onCta: () => void;
  onSkip: () => void;
  stepLabel?: string;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 6;

export function TourSpotlight({ selector, title, body, ctaLabel, onCta, onSkip, stepLabel }: TourSpotlightProps) {
  const [rect, setRect] = useState<Rect | null>(null);

  useEffect(() => {
    let frame: number;

    const update = () => {
      const el = document.querySelector(selector);
      if (el) {
        const r = el.getBoundingClientRect();
        setRect((prev) =>
          prev && prev.top === r.top && prev.left === r.left && prev.width === r.width && prev.height === r.height
            ? prev
            : { top: r.top, left: r.left, width: r.width, height: r.height },
        );
      } else {
        setRect((prev) => (prev === null ? prev : null));
      }
      frame = window.requestAnimationFrame(update);
    };

    frame = window.requestAnimationFrame(update);
    return () => window.cancelAnimationFrame(frame);
  }, [selector]);

  if (!rect) return null;

  const highlightTop = rect.top - PADDING;
  const highlightLeft = rect.left - PADDING;
  const highlightWidth = rect.width + PADDING * 2;
  const highlightHeight = rect.height + PADDING * 2;

  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 768;

  const cardWidth = 300;
  const spaceBelow = viewportHeight - (highlightTop + highlightHeight);
  const placeBelow = spaceBelow > 160 || highlightTop < 160;

  const cardTop = placeBelow
    ? Math.min(highlightTop + highlightHeight + 12, viewportHeight - 200)
    : Math.max(highlightTop - 12, 12);

  const cardLeft = Math.min(
    Math.max(highlightLeft, 12),
    viewportWidth - cardWidth - 12,
  );

  return (
    <>
      <div
        className="fixed rounded-xl border-2 border-cyan-400 transition-all duration-200 z-[9998]"
        style={{
          top: highlightTop,
          left: highlightLeft,
          width: highlightWidth,
          height: highlightHeight,
          boxShadow: '0 0 0 9999px rgba(2, 6, 23, 0.75)',
          pointerEvents: 'none',
        }}
      />
      <div
        className={`fixed z-[9999] w-[300px] bg-slate-800 border border-cyan-500/40 rounded-xl shadow-2xl p-4 ${placeBelow ? '' : '-translate-y-full'}`}
        style={{ top: cardTop, left: cardLeft }}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            {stepLabel && (
              <span className="text-[10px] font-semibold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full">
                {stepLabel}
              </span>
            )}
          </div>
          <button onClick={onSkip} className="text-slate-500 hover:text-white transition-colors flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
        <h4 className="text-sm font-semibold text-white mb-1">{title}</h4>
        <p className="text-xs text-slate-300 mb-3">{body}</p>
        <div className="flex items-center justify-between gap-2">
          <button onClick={onSkip} className="text-xs text-slate-400 hover:text-slate-200 transition-colors">
            Saltar tour
          </button>
          <button
            onClick={onCta}
            className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-medium rounded-lg transition-colors"
          >
            {ctaLabel}
          </button>
        </div>
      </div>
    </>
  );
}
