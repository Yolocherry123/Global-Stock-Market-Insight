import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Maximize2 } from 'lucide-react';

export function ChartZoomModal({ title, onClose, children }) {
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return createPortal(
    <div className="chart-zoom-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className="chart-zoom-panel glass-panel" onClick={(e) => e.stopPropagation()}>
        <div className="chart-zoom-header">
          <h3 className="chart-zoom-title">{title}</h3>
          <button type="button" className="chart-zoom-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="chart-zoom-body">
          <div className="chart-zoom-body-inner">{children}</div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function ZoomableChart({ title, children, renderExpanded }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="chart-zoom-trigger"
        onClick={() => setOpen(true)}
        title="Click to enlarge chart"
        aria-label={`Enlarge ${title}`}
      >
        {children}
        <span className="chart-zoom-hint" aria-hidden="true">
          <Maximize2 size={12} />
        </span>
      </button>
      {open && (
        <ChartZoomModal title={title} onClose={() => setOpen(false)}>
          {renderExpanded ? renderExpanded() : children}
        </ChartZoomModal>
      )}
    </>
  );
}
