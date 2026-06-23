import React from 'react';
import ScreenerProsCons from './ScreenerProsCons';

export default function ScreenerProsConsCompare({ results }) {
  const valid = results.filter((r) => !r.error && r.data);
  if (!valid.length) return null;

  if (valid.length === 1) {
    const r = valid[0];
    return (
      <div className="glass-panel" style={{ padding: '10px 12px' }}>
        <ScreenerProsCons pros={r.data.pros} cons={r.data.cons} companyName={r.data.name} />
      </div>
    );
  }

  return (
    <div className="glass-panel" style={{ padding: '10px 12px' }}>
      <h3 style={{ fontSize: '12px', fontWeight: '600', marginBottom: '10px' }}>Pros & Cons Comparison</h3>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(valid.length, 3)}, 1fr)`, gap: '10px' }}>
        {valid.map((r) => (
          <div key={r.ticker}>
            <ScreenerProsCons pros={r.data.pros} cons={r.data.cons} companyName={r.data.name} />
          </div>
        ))}
      </div>
    </div>
  );
}
