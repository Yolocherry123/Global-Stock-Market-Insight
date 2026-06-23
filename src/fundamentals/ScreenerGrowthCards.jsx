import React from 'react';

const GROWTH_LABELS = {
  sales: 'Compounded Sales Growth',
  profit: 'Compounded Profit Growth',
  price: 'Stock Price CAGR',
  roe: 'Return on Equity',
};

export default function ScreenerGrowthCards({ growth }) {
  if (!growth) return null;

  const cards = Object.entries(GROWTH_LABELS)
    .map(([key, title]) => ({ key, title, data: growth[key] }))
    .filter((c) => c.data && Object.keys(c.data).length > 0);

  if (cards.length === 0) return null;

  return (
    <div className="fund-growth-grid">
      {cards.map(({ key, title, data }) => (
        <div className="glass-panel fund-growth-card" key={key}>
          <h4 style={{ fontSize: '11px', fontWeight: '600', marginBottom: '8px' }}>{title}</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {Object.entries(data).map(([label, value]) => (
              <div
                key={label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '10px',
                  gap: '8px',
                }}
              >
                <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                <span className="mono" style={{ fontWeight: 600 }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
