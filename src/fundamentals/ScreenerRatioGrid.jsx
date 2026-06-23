import React from 'react';
import { RatioLabel } from './RatioInfoTip';
import {
  SCREENER_KEY_RATIOS,
  getBestWorstIndices,
  getRatioDirection,
  parseRatioNumeric,
  parseScreenerRatio,
} from '../fundamentalsFormatters';

export default function ScreenerRatioGrid({ results }) {
  const valid = results.filter((r) => !r.error && r.data);
  if (valid.length === 0) return null;

  return (
    <div className="glass-panel" style={{ padding: 0 }}>
      <div style={{ padding: '8px 12px' }}>
        <h3 style={{ fontSize: '12px', fontWeight: '600' }}>Key Ratios Comparison</h3>
      </div>
      <div className="comparison-table-wrapper fund-table-scroll">
        <table className="custom-table fund-financial-table" style={{ fontSize: '12px' }}>
          <thead>
            <tr>
              <th>Ratio</th>
              {valid.map((r) => (
                <th key={r.ticker} className="mono">{r.data.name || r.screener_symbol}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SCREENER_KEY_RATIOS.map((ratioKey) => {
              const values = valid.map((r) => parseRatioNumeric(r.data.ratios, ratioKey));
              const hasAny = values.some((v) => v != null);
              if (!hasAny) return null;
              const direction = getRatioDirection(ratioKey);
              const { best, worst } = getBestWorstIndices(values, direction);

              return (
                <tr key={ratioKey}>
                  <td style={{ fontWeight: '600' }}><RatioLabel name={ratioKey} /></td>
                  {valid.map((r, idx) => {
                    let cls = '';
                    if (valid.length > 1 && direction != null) {
                      if (idx === best) cls = 'fund-ratio-best text-up';
                      else if (idx === worst) cls = 'fund-ratio-worst text-down';
                    }
                    return (
                      <td key={r.ticker} className={`mono ${cls}`}>
                        {parseScreenerRatio(r.data.ratios, ratioKey) ?? '—'}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ScreenerRatioPills({ data }) {
  if (!data?.ratios) return null;
  const entries = Object.entries(data.ratios).slice(0, 12);
  return (
    <div className="metrics-pill-grid">
      {entries.map(([label, value]) => (
        <div className="metric-pill" key={label}>
          <span className="metric-pill-label"><RatioLabel name={label} /></span>
          <span className="metric-pill-value">{value}</span>
        </div>
      ))}
    </div>
  );
}
