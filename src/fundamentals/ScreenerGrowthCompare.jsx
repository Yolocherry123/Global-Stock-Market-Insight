import React from 'react';

const GROWTH_LABELS = {
  sales: 'Compounded Sales Growth',
  profit: 'Compounded Profit Growth',
  price: 'Stock Price CAGR',
  roe: 'Return on Equity',
};

const PERIOD_ORDER = ['10 Years', '5 Years', '3 Years', '1 Year', 'TTM'];

function sortGrowthPeriods(periods) {
  return [...periods].sort((a, b) => {
    const ai = PERIOD_ORDER.indexOf(a);
    const bi = PERIOD_ORDER.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return String(a).localeCompare(String(b));
  });
}

export default function ScreenerGrowthCompare({ results }) {
  const valid = results.filter((r) => !r.error && r.data?.growth);
  if (valid.length < 2) return null;

  const periodKeys = new Set();
  valid.forEach((r) => {
    Object.values(r.data.growth).forEach((g) => {
      Object.keys(g || {}).forEach((k) => periodKeys.add(k));
    });
  });
  const periods = sortGrowthPeriods(Array.from(periodKeys));

  const types = Object.entries(GROWTH_LABELS).filter(([key]) =>
    valid.some((r) => r.data.growth[key] && Object.keys(r.data.growth[key]).length > 0),
  );

  if (!types.length) return null;

  return (
    <div className="glass-panel" style={{ padding: 0 }}>
      <div style={{ padding: '8px 12px' }}>
        <h3 style={{ fontSize: '12px', fontWeight: '600' }}>Growth Comparison</h3>
      </div>
      <div className="comparison-table-wrapper fund-table-scroll">
        <table className="custom-table fund-financial-table" style={{ fontSize: '12px' }}>
          <thead>
            <tr>
              <th>Metric</th>
              <th>Period</th>
              {valid.map((r) => (
                <th key={r.ticker} className="mono">{r.screener_symbol || r.data.symbol}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {types.map(([key, title]) =>
              periods.map((period) => (
                <tr key={`${key}-${period}`}>
                  <td style={{ fontWeight: 600 }}>{title}</td>
                  <td className="mono text-muted">{period}</td>
                  {valid.map((r) => (
                    <td key={r.ticker} className="mono">
                      {r.data.growth[key]?.[period] ?? '—'}
                    </td>
                  ))}
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
