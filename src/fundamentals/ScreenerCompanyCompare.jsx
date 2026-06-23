import React, { useEffect, useMemo, useState } from 'react';
import { LightweightFundamentalsChart } from '../charts/LightweightCharts';
import { RatioLabel } from './RatioInfoTip';
import {
  FINANCIAL_SECTIONS,
  buildCompanyComparison,
  buildHeaderRatiosComparison,
  buildTrendComparisonTable,
  buildTrendSeries,
  collectMetrics,
  collectPeriods,
  exportTableToCsv,
  formatIndianNumber,
  getBestWorstIndices,
  mergeCompareMetrics,
  parseNumericValue,
  rankComparison,
} from '../fundamentalsFormatters';

const RANGE_OPTIONS = [
  { value: 8, label: 'Last 8 periods' },
  { value: 12, label: 'Last 12 periods' },
  { value: 0, label: 'All periods' },
];

function HeaderRatiosPanel({ ratioRows, validCount }) {
  if (!ratioRows.length || validCount < 2) return null;

  return (
    <div style={{ marginBottom: '14px' }}>
      <h4 style={{ fontSize: '11px', fontWeight: '600', marginBottom: '8px' }}>
        Screener key ratios (current)
      </h4>
      <div className="comparison-table-wrapper fund-table-scroll">
        <table className="custom-table fund-financial-table" style={{ fontSize: '12px' }}>
          <thead>
            <tr>
              <th>Ratio</th>
              {ratioRows[0]?.companies.map((c) => (
                <th key={c.ticker} className="mono">{c.symbol}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ratioRows.map(({ key, direction, companies }) => {
              const numerics = companies.map((c) => c.numeric);
              const { best, worst } = getBestWorstIndices(numerics, direction);
              return (
                <tr key={key}>
                  <td style={{ fontWeight: 600 }}><RatioLabel name={key} /></td>
                  {companies.map((c, idx) => {
                    let cls = '';
                    if (validCount > 1 && direction != null) {
                      if (idx === best) cls = 'fund-ratio-best text-up';
                      else if (idx === worst) cls = 'fund-ratio-worst text-down';
                    }
                    return (
                      <td key={c.ticker} className={`mono ${cls}`}>
                        {c.value ?? '—'}
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

export default function ScreenerCompanyCompare({ results }) {
  const valid = results.filter((r) => !r.error && r.data);
  const [sectionKey, setSectionKey] = useState('profitLoss');
  const [metricLabel, setMetricLabel] = useState('Sales');
  const [period, setPeriod] = useState('');
  const [presetKey, setPresetKey] = useState('');
  const [multiMode, setMultiMode] = useState(false);
  const [viewMode, setViewMode] = useState('snapshot');
  const [trendRange, setTrendRange] = useState(12);

  const periods = useMemo(() => collectPeriods(valid, sectionKey), [valid, sectionKey]);
  const rawMetrics = useMemo(() => collectMetrics(valid, sectionKey), [valid, sectionKey]);
  const metrics = useMemo(
    () => mergeCompareMetrics(rawMetrics, sectionKey),
    [rawMetrics, sectionKey],
  );

  const headerRatios = useMemo(() => buildHeaderRatiosComparison(valid), [valid]);

  useEffect(() => {
    if (metrics.length && !metrics.some((m) => m.rowLabel === metricLabel)) {
      setMetricLabel(metrics[0].rowLabel);
    }
  }, [metrics, metricLabel]);

  useEffect(() => {
    if (sectionKey === 'ratiosTable' && metrics.some((m) => m.rowLabel === 'ROE %')) {
      setMetricLabel('ROE %');
    }
  }, [sectionKey, metrics]);

  const activePeriod = period || periods[periods.length - 1] || '';

  const comparison = useMemo(
    () => buildCompanyComparison(valid, sectionKey, metricLabel, activePeriod),
    [valid, sectionKey, metricLabel, activePeriod],
  );

  const ranked = useMemo(() => rankComparison(comparison, true), [comparison]);

  const trendTable = useMemo(
    () => buildTrendComparisonTable(valid, sectionKey, metricLabel, trendRange || null),
    [valid, sectionKey, metricLabel, trendRange],
  );

  const trendSeries = useMemo(
    () => buildTrendSeries(valid, sectionKey, metricLabel, trendRange || null),
    [valid, sectionKey, metricLabel, trendRange],
  );

  const maxVal = useMemo(() => {
    const nums = ranked.map((r) => r.numeric).filter((n) => n != null);
    return nums.length ? Math.max(...nums) : 1;
  }, [ranked]);

  const presetMetrics = presetKey ? COMPARE_PRESETS[presetKey]?.metrics || [] : [];

  const multiRows = useMemo(() => {
    if (!multiMode || !presetKey || viewMode === 'trend') return [];
    return presetMetrics.map((m) => ({
      metric: m,
      rows: buildCompanyComparison(valid, sectionKey, m, activePeriod),
    }));
  }, [multiMode, presetKey, presetMetrics, valid, sectionKey, activePeriod, viewMode]);

  const trendPresetRows = useMemo(() => {
    if (!multiMode || !presetKey || viewMode !== 'trend') return [];
    return presetMetrics.map((m) => ({
      metric: m,
      ...buildTrendComparisonTable(valid, sectionKey, m, trendRange || null),
    }));
  }, [multiMode, presetKey, presetMetrics, valid, sectionKey, trendRange, viewMode]);

  if (valid.length < 1) return null;

  const selectStyle = {
    background: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    color: '#fff',
    fontSize: '11px',
    padding: '4px 8px',
    borderRadius: '4px',
  };

  const exportTrend = () => {
    const headers = ['Company', 'Symbol', 'Trend change %', ...trendTable.periods];
    const rows = trendTable.rows.map((row) => [
      row.name,
      row.symbol,
      row.changePct != null ? `${row.changePct >= 0 ? '+' : ''}${row.changePct.toFixed(1)}%` : '',
      ...trendTable.periods.map((p) => formatIndianNumber(row.values[p])),
    ]);
    exportTableToCsv(`compare-trend-${metricLabel}.csv`, headers, rows);
  };

  const exportSingle = () => {
    exportTableToCsv(
      `compare-${metricLabel}-${activePeriod}.csv`,
      ['Company', 'Symbol', metricLabel, 'Period', 'Rank'],
      ranked.map((row) => [
        row.name,
        row.screenerSymbol,
        formatIndianNumber(row.value),
        activePeriod,
        row.rank ?? '',
      ]),
    );
  };

  const exportMulti = () => {
    const headers = ['Metric', ...valid.map((r) => r.screener_symbol || r.data.symbol)];
    const rows = multiRows.map(({ metric, rows: rws }) => [
      metric,
      ...valid.map((v) => {
        const match = rws.find((r) => r.ticker === v.ticker);
        return formatIndianNumber(match?.value);
      }),
    ]);
    exportTableToCsv(`compare-preset-${activePeriod}.csv`, headers, rows);
  };

  const handleExport = () => {
    if (viewMode === 'trend') exportTrend();
    else if (multiMode) exportMulti();
    else exportSingle();
  };

  return (
    <div className="glass-panel" style={{ padding: '10px 12px' }}>
      <h3 style={{ fontSize: '12px', fontWeight: '600', marginBottom: '8px' }}>
        Cross-Company Comparison
      </h3>

      <HeaderRatiosPanel ratioRows={headerRatios} validCount={valid.length} />

      <div className="fund-compare-mode-toggle" style={{ marginBottom: '10px' }}>
        <button
          type="button"
          className={`tab-btn ${viewMode === 'snapshot' ? 'active' : ''}`}
          onClick={() => setViewMode('snapshot')}
        >
          Single period
        </button>
        <button
          type="button"
          className={`tab-btn ${viewMode === 'trend' ? 'active' : ''}`}
          onClick={() => setViewMode('trend')}
        >
          Trend over time
        </button>
      </div>

      <div className="backtest-row" style={{ flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
        <label style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
          Statement
          <select
            className="backtest-input"
            value={sectionKey}
            onChange={(e) => setSectionKey(e.target.value)}
            style={{ ...selectStyle, display: 'block', marginTop: '4px' }}
          >
            {FINANCIAL_SECTIONS.map((opt) => (
              <option key={opt.dataKey} value={opt.dataKey}>{opt.label}</option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
          Preset
          <select
            className="backtest-input"
            value={presetKey}
            onChange={(e) => {
              setPresetKey(e.target.value);
              setMultiMode(Boolean(e.target.value));
            }}
            style={{ ...selectStyle, display: 'block', marginTop: '4px' }}
          >
            <option value="">Single metric</option>
            {Object.entries(COMPARE_PRESETS).map(([key, p]) => (
              <option key={key} value={key}>{p.label}</option>
            ))}
          </select>
        </label>
        {!multiMode && (
          <label style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
            Line item
            <select
              className="backtest-input"
              value={metricLabel}
              onChange={(e) => setMetricLabel(e.target.value)}
              style={{ ...selectStyle, display: 'block', marginTop: '4px', minWidth: '160px' }}
            >
              {metrics.map((m) => (
                <option key={m.label} value={m.rowLabel}>{m.label}</option>
              ))}
            </select>
          </label>
        )}
        {viewMode === 'snapshot' ? (
          <label style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
            Period
            <select
              className="backtest-input"
              value={activePeriod}
              onChange={(e) => setPeriod(e.target.value)}
              style={{ ...selectStyle, display: 'block', marginTop: '4px' }}
            >
              {periods.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </label>
        ) : (
          <label style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
            Periods shown
            <select
              className="backtest-input"
              value={trendRange}
              onChange={(e) => setTrendRange(Number(e.target.value))}
              style={{ ...selectStyle, display: 'block', marginTop: '4px' }}
            >
              {RANGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
        )}
        <button
          type="button"
          className="btn-secondary"
          style={{ alignSelf: 'flex-end', fontSize: '10px' }}
          onClick={handleExport}
        >
          Export CSV
        </button>
      </div>

      {viewMode === 'trend' && !multiMode && (
        <>
          <LightweightFundamentalsChart series={trendSeries} />
          <div className="comparison-table-wrapper fund-table-scroll" style={{ marginTop: '12px' }}>
            <table className="custom-table fund-financial-table" style={{ fontSize: '12px' }}>
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Symbol</th>
                  <th>Trend Δ</th>
                  {trendTable.periods.map((p) => (
                    <th key={p} className="mono">{p}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trendTable.rows.map((row) => (
                  <tr key={row.ticker}>
                    <td>{row.name}</td>
                    <td className="mono">{row.symbol}</td>
                    <td className={`mono ${row.changePct != null && row.changePct >= 0 ? 'text-up' : 'text-down'}`}>
                      {row.changePct != null
                        ? `${row.changePct >= 0 ? '+' : ''}${row.changePct.toFixed(1)}%`
                        : '—'}
                    </td>
                    {trendTable.periods.map((p) => (
                      <td key={p} className="mono">{formatIndianNumber(row.values[p])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {viewMode === 'trend' && multiMode && trendPresetRows.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {trendPresetRows.map(({ metric, periods: pds, rows }) => (
            <div key={metric}>
              <h4 style={{ fontSize: '11px', fontWeight: '600', marginBottom: '6px' }}>{metric}</h4>
              <div className="comparison-table-wrapper fund-table-scroll">
                <table className="custom-table fund-financial-table" style={{ fontSize: '11px' }}>
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th>Trend Δ</th>
                      {pds.map((p) => <th key={p} className="mono">{p}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={`${metric}-${row.ticker}`}>
                        <td className="mono">{row.symbol}</td>
                        <td className={`mono ${row.changePct != null && row.changePct >= 0 ? 'text-up' : 'text-down'}`}>
                          {row.changePct != null
                            ? `${row.changePct >= 0 ? '+' : ''}${row.changePct.toFixed(1)}%`
                            : '—'}
                        </td>
                        {pds.map((p) => (
                          <td key={p} className="mono">{formatIndianNumber(row.values[p])}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {viewMode === 'snapshot' && multiMode && multiRows.length > 0 && (
        <div className="comparison-table-wrapper">
          <table className="custom-table fund-financial-table" style={{ fontSize: '12px' }}>
            <thead>
              <tr>
                <th>Metric</th>
                {valid.map((r) => (
                  <th key={r.ticker} className="mono">{r.screener_symbol}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {multiRows.map(({ metric, rows: rws }) => (
                <tr key={metric}>
                  <td style={{ fontWeight: 600 }}>{metric}</td>
                  {valid.map((v) => {
                    const match = rws.find((r) => r.ticker === v.ticker);
                    const num = parseNumericValue(match?.value);
                    const max = Math.max(
                      ...rws.map((r) => parseNumericValue(r.value) || 0),
                      1,
                    );
                    return (
                      <td key={v.ticker}>
                        <div className="mono" style={{ fontWeight: 600, marginBottom: '2px' }}>
                          {formatIndianNumber(match?.value)}
                        </div>
                        {num != null && (
                          <div className="fund-compare-bar-track">
                            <div
                              className="fund-compare-bar"
                              style={{ width: `${(num / max) * 100}%` }}
                            />
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viewMode === 'snapshot' && !multiMode && (
        <>
          <div className="comparison-table-wrapper">
            <table className="custom-table fund-financial-table" style={{ fontSize: '12px' }}>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Company</th>
                  <th>Symbol</th>
                  <th>{metricLabel}</th>
                  <th>Visual</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((row) => (
                  <tr key={row.ticker}>
                    <td>
                      {row.rank != null && (
                        <span className={`fund-rank-badge rank-${row.rank}`}>#{row.rank}</span>
                      )}
                    </td>
                    <td>{row.name}</td>
                    <td className="mono">{row.screenerSymbol}</td>
                    <td className="mono" style={{ fontWeight: 600 }}>
                      {formatIndianNumber(row.value)}
                    </td>
                    <td style={{ minWidth: '100px' }}>
                      {row.numeric != null && (
                        <div className="fund-compare-bar-track">
                          <div
                            className="fund-compare-bar"
                            style={{ width: `${(row.numeric / maxVal) * 100}%` }}
                          />
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {valid.length > 1 && (
            <div style={{ marginTop: '12px' }}>
              <h4 style={{ fontSize: '11px', fontWeight: '600', marginBottom: '6px' }}>
                Side-by-side: {metricLabel} ({activePeriod})
              </h4>
              <div className="comparison-table-wrapper">
                <table className="custom-table" style={{ fontSize: '12px' }}>
                  <thead>
                    <tr>
                      {comparison.map((row) => (
                        <th key={row.ticker} className="mono">{row.screenerSymbol}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {comparison.map((row) => (
                        <td key={row.ticker} className="mono" style={{ fontWeight: 600, fontSize: '13px' }}>
                          {formatIndianNumber(row.value)}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
