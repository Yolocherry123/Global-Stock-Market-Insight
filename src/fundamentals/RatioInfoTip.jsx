import React, { useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';
import { getRatioFormula } from '../fundamentalsFormatters';

const VIEWPORT_PAD = 12;
const GAP = 8;

function RatioTooltip({ anchorRef, tipId, formula }) {
  const tooltipRef = useRef(null);
  const [coords, setCoords] = useState(null);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const tip = tooltipRef.current;
    if (!anchor || !tip) return;

    const update = () => {
      const rect = anchor.getBoundingClientRect();
      const tipW = tip.offsetWidth;
      const tipH = tip.offsetHeight;

      let placement = 'top';
      let top = rect.top - GAP;
      if (rect.top - tipH - GAP < VIEWPORT_PAD) {
        placement = 'bottom';
        top = rect.bottom + GAP;
      }

      let left = rect.left + rect.width / 2;
      const half = tipW / 2;
      left = Math.max(VIEWPORT_PAD + half, Math.min(window.innerWidth - VIEWPORT_PAD - half, left));

      setCoords({ top, left, placement });
    };

    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [anchorRef, formula]);

  return createPortal(
    <span
      ref={tooltipRef}
      id={tipId}
      className={`fund-ratio-info-tooltip fund-ratio-info-tooltip--portal fund-ratio-info-tooltip--${coords?.placement ?? 'top'}`}
      role="tooltip"
      style={
        coords
          ? {
              position: 'fixed',
              top: coords.top,
              left: coords.left,
              transform: coords.placement === 'top' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
              visibility: 'visible',
            }
          : { position: 'fixed', top: -9999, left: -9999, visibility: 'hidden' }
      }
    >
      {formula}
    </span>,
    document.body,
  );
}

export default function RatioInfoTip({ name }) {
  const formula = getRatioFormula(name);
  const [open, setOpen] = useState(false);
  const tipId = useId();
  const btnRef = useRef(null);

  if (!formula) return null;

  return (
    <span
      className="fund-ratio-info"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <button
        ref={btnRef}
        type="button"
        className="fund-ratio-info-btn"
        aria-label={`Formula for ${name}`}
        aria-describedby={open ? tipId : undefined}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <Info size={11} />
      </button>
      {open && <RatioTooltip anchorRef={btnRef} tipId={tipId} formula={formula} />}
    </span>
  );
}

export function RatioLabel({ name, style }) {
  return (
    <span className="fund-ratio-label" style={style}>
      {name}
      <RatioInfoTip name={name} />
    </span>
  );
}
