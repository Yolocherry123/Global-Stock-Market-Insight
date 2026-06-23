import React, { useMemo, useState } from 'react';
import { LightweightFundamentalsChart } from '../charts/LightweightCharts';
import {
  buildTrendSeries,
  collectMetrics,
  formatMetricDisplayName,
  mergeCompareMetrics,
} from '../fundamentalsFormatters';

const SECTION_LABELS = {
  quarterly: 'Quarterly results',
  profitLoss: 'Annual P&L',
};

const RANGE_OPTIONS = [
  { value: 8, label: 'Last 8 periods' },
  { value: 12, label: 'Last 12 periods' },
  { value: 0, label: 'All periods' },
];

export default function ScreenerTrendChart({
  results,
  defaultSection = 'quarterly',
  title,
  lockSection = false,
}) {
  const valid = results.filter((r) => !r.error && r.data);
  const [sectionKey, setSectionKey] = useState(defaultSection);
  const [metricLabel, setMetricLabel] = useState('Sales');
  const [range, setRange] = useState(8);

  const activeSection = lockSection ? defaultSection : sectionKey;
  const isQuarterly = activeSection === 'quarterly';
  const periodWord = isQuarterly ? 'quarters' : 'years';

  const metrics = useMemo(() => collectMetrics(valid, activeSection), [valid, activeSection]);

  const availableMetrics = useMemo(
    () => mergeCompareMetrics(metrics, activeSection),
    [metrics, activeSection],
  );

  const activeMetricLabel = useMemo(() => {
    if (availableMetrics.some((m) => m.label === metricLabel)) return metricLabel;
    const byRow = availableMetrics.find((m) => m.rowLabel === metricLabel);
    return byRow?.label || availableMetrics[0]?.label || 'Sales';
  }, [availableMetrics, metricLabel]);

  const series = useMemo(
    () => buildTrendSeries(valid, activeSection, activeMetricLabel, range === 0 ? null : range),
    [valid, activeSection, activeMetricLabel, range],
  );

  if (!valid.length) return null;

  const selectStyle = {
    background: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    color: '#fff',
    fontSize: '11px',
    padding: '4px 8px',
    borderRadius: '4px',
  };

  return (
    <div className="glass-panel" style={{ padding: '10px 12px' }}>
      {title && (
        <h3 style={{ fontSize: '12px', fontWeight: '600', marginBottom: '8px' }}>{title}</h3>
      )}
      <div className="fund-trend-filters">
        {!lockSection && (
          <label className="fund-filter-label">
            Data source
            <select
              className="backtest-input"
              value={activeSection}
              onChange={(e) => setSectionKey(e.target.value)}
              style={{ ...selectStyle, display: 'block', marginTop: '4px' }}
            >
              <option value="quarterly">Quarterly results</option>
              <option value="profitLoss">Annual P&L</option>
            </select>
          </label>
        )}
        <label className="fund-filter-label">
          Line item
          <select
            className="backtest-input"
            value={activeMetricLabel}
            onChange={(e) => setMetricLabel(e.target.value)}
            style={{ ...selectStyle, display: 'block', marginTop: '4px', minWidth: '160px' }}
          >
            {availableMetrics.map((m) => (
              <option key={m.label} value={m.label}>{m.label}</option>
            ))}
          </select>
        </label>
        <label className="fund-filter-label">
          {isQuarterly ? 'Quarters shown' : 'Years shown'}
          <select
            className="backtest-input"
            value={range}
            onChange={(e) => setRange(Number(e.target.value))}
            style={{ ...selectStyle, display: 'block', marginTop: '4px' }}
          >
            {RANGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.value === 0 ? `All ${periodWord}` : `Last ${opt.value} ${periodWord}`}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!lockSection && (
        <p className="text-muted" style={{ fontSize: '10px', marginBottom: '8px' }}>
          Viewing {SECTION_LABELS[activeSection] || activeSection} · {formatMetricDisplayName(activeMetricLabel)}
        </p>
      )}
      <LightweightFundamentalsChart series={series} />
    </div>
  );
}
