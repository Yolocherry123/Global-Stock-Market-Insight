import React, { useMemo } from 'react';
import { RatioLabel } from './RatioInfoTip';
import { buildHeaderRatiosComparison, getBestWorstIndices } from '../fundamentalsFormatters';
import ScreenerFinancialTable from './ScreenerFinancialTable';
import ScreenerInterleavedTable from './ScreenerInterleavedTable';
import { ScreenerRatioPills } from './ScreenerRatioGrid';

function CurrentRatiosInterleaved({ ratioRows, companies }) {
  if (!ratioRows.length) return null;

  return (
    <div className="glass-panel" style={{ padding: 0, marginBottom: '12px' }}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)' }}>
        <h3 style={{ fontSize: '12px', fontWeight: '600' }}>Key Ratios — Current</h3>
        <p style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
          Latest ratio snapshot from Screener.in, compared across selected companies.
        </p>
      </div>
      <div className="fund-table-scroll">
        <table className="custom-table fund-financial-table fund-interleaved-table" style={{ fontSize: '12px' }}>
          <thead>
            <tr>
              <th className="fund-sticky-col">Ratio</th>
              <th className="fund-sticky-col-2">Company</th>
              <th className="mono">Current</th>
            </tr>
          </thead>
          <tbody>
            {ratioRows.map(({ key, direction, companies: rowCompanies }) => {
              const numerics = rowCompanies.map((c) => c.numeric);
              const { best, worst } = getBestWorstIndices(numerics, direction);

              return rowCompanies.map((c, cIdx) => {
                const company = companies.find((co) => co.ticker === c.ticker);
                let cls = '';
                if (rowCompanies.length > 1 && direction != null) {
                  if (cIdx === best) cls = 'fund-ratio-best text-up';
                  else if (cIdx === worst) cls = 'fund-ratio-worst text-down';
                }
                const isFirst = cIdx === 0;
                return (
                  <tr
                    key={`${key}-${c.ticker}`}
                    className={`fund-compare-company-row ${isFirst ? 'fund-compare-group-start' : ''}`}
                  >
                    <td className="fund-sticky-col" style={{ fontWeight: isFirst ? 600 : 400 }}>
                      {isFirst ? <RatioLabel name={key} /> : ''}
                    </td>
                    <td className="fund-sticky-col-2">
                      {company && (
                        <span
                          className="fund-company-tag mono"
                          style={{ borderColor: company.color, color: company.color }}
                        >
                          {c.symbol}
                        </span>
                      )}
                    </td>
                    <td className={`mono ${cls}`} style={{ fontWeight: 600 }}>
                      {c.value ?? '—'}
                    </td>
                  </tr>
                );
              });
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ScreenerRatiosTab({ results, tableViewMode }) {
  const valid = results.filter((r) => !r.error && r.data);
  const ratioRows = useMemo(() => buildHeaderRatiosComparison(valid), [valid]);

  const companies = useMemo(
    () => valid.map((r, idx) => ({
      ticker: r.ticker,
      symbol: r.screener_symbol || r.data.symbol,
      color: ['#00e5ff', '#a78bfa', '#fbbf24', '#34d399', '#f472b6'][idx % 5],
    })),
    [valid],
  );

  const hasHistorical = valid.some((r) => r.data.ratiosTable?.rows?.length);

  if (!valid.length) return null;

  if (valid.length === 1 || tableViewMode === 'separate') {
    return (
      <>
        {valid.map((r) => (
          <div key={r.ticker} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div className="glass-panel" style={{ padding: '10px 12px' }}>
              <h3 style={{ fontSize: '12px', fontWeight: '600', marginBottom: '8px' }}>
                Key Ratios — {r.data.name}
              </h3>
              <ScreenerRatioPills data={r.data} />
            </div>
            <ScreenerFinancialTable
              title="Ratios"
              section={r.data.ratiosTable}
              companyName={r.data.name}
            />
          </div>
        ))}
      </>
    );
  }

  return (
    <>
      <CurrentRatiosInterleaved ratioRows={ratioRows} companies={companies} />
      {hasHistorical ? (
        <ScreenerInterleavedTable
          title="Ratio Trends"
          results={valid}
          dataKey="ratiosTable"
          defaultExpandAll
        />
      ) : (
        <div className="glass-panel" style={{ padding: '10px 12px' }}>
          <p className="text-muted" style={{ fontSize: '11px' }}>
            No historical ratio trends available from Screener.in for these companies.
          </p>
        </div>
      )}
    </>
  );
}
