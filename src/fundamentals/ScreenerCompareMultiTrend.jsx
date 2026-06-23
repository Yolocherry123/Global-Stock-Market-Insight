import { useEffect, useMemo, useState } from 'react';
import { LightweightFundamentalsChart } from '../charts/LightweightCharts';
import {
  TREND_METRIC_PRESETS,
  buildCombinedMultiMetricTrendSeries,
  buildMultiMetricTrendCharts,
  getAllCompareMetricOptions,
} from '../fundamentalsFormatters';

const TREND_SECTIONS = [
  { dataKey: 'quarterly', label: 'Quarterly results' },
  { dataKey: 'profitLoss', label: 'Annual P&L' },
  { dataKey: 'balanceSheet', label: 'Balance Sheet' },
  { dataKey: 'cashFlow', label: 'Cash Flow' },
  { dataKey: 'ratiosTable', label: 'Ratios' },
];

const RANGE_OPTIONS = [
  { value: 8, label: 'Last 8 periods' },
  { value: 12, label: 'Last 12 periods' },
  { value: 0, label: 'All periods' },
];

const DEFAULT_METRICS = ['Sales', 'Net Profit', 'Operating Profit'];

const selectStyle = {
  background: 'var(--bg-primary)',
  border: '1px solid var(--border-color)',
  color: '#fff',
  fontSize: '11px',
  padding: '4px 8px',
  borderRadius: '4px',
};

function pickDefaultMetrics(options) {
  const labels = options.map((m) => m.label);
  const picked = [];
  for (const rowLabel of DEFAULT_METRICS) {
    const match = options.find((m) => m.rowLabel === rowLabel && m.depth === 0)
      || options.find((m) => m.rowLabel === rowLabel);
    if (match && !picked.includes(match.label)) picked.push(match.label);
  }
  if (picked.length) return picked;
  return labels.slice(0, 3);
}

function metricDisplayName(metric) {
  return metric.label.includes('›') ? metric.label : metric.rowLabel;
}

export default function ScreenerCompareMultiTrend({ results }) {
  const valid = results.filter((r) => !r.error && r.data);
  const [sectionKey, setSectionKey] = useState('quarterly');
  const [selectedMetrics, setSelectedMetrics] = useState([]);
  const [range, setRange] = useState(8);
  const [chartLayout, setChartLayout] = useState('separate');
  const [combinedScale, setCombinedScale] = useState('raw');

  const metricOptions = useMemo(
    () => getAllCompareMetricOptions(valid, sectionKey),
    [valid, sectionKey],
  );

  const availableSections = useMemo(
    () => TREND_SECTIONS.filter((s) => valid.some((r) => r.data?.[s.dataKey]?.rows?.length)),
    [valid],
  );

  const activeSection = availableSections.some((s) => s.dataKey === sectionKey)
    ? sectionKey
    : availableSections[0]?.dataKey || 'quarterly';

  const isQuarterly = activeSection === 'quarterly';
  const periodWord = isQuarterly ? 'quarters' : 'years';
  const maxPoints = range === 0 ? null : range;
  const allMetricLabels = useMemo(
    () => metricOptions.map((m) => m.label),
    [metricOptions],
  );

  useEffect(() => {
    setSelectedMetrics((prev) => {
      const kept = prev.filter((m) => allMetricLabels.includes(m));
      if (kept.length) return kept;
      return pickDefaultMetrics(metricOptions);
    });
  }, [allMetricLabels, metricOptions]);

  const charts = useMemo(
    () => buildMultiMetricTrendCharts(valid, activeSection, selectedMetrics, maxPoints),
    [valid, activeSection, selectedMetrics, maxPoints],
  );

  const combinedSeries = useMemo(
    () => buildCombinedMultiMetricTrendSeries(
      valid,
      activeSection,
      selectedMetrics,
      maxPoints,
      { normalize: combinedScale === 'indexed' },
    ),
    [valid, activeSection, selectedMetrics, maxPoints, combinedScale],
  );

  const toggleMetric = (metricLabel) => {
    setSelectedMetrics((prev) => {
      if (prev.includes(metricLabel)) {
        return prev.length > 1 ? prev.filter((m) => m !== metricLabel) : prev;
      }
      return [...prev, metricLabel];
    });
  };

  const selectPresetMetrics = () => {
    const preset = [];
    for (const rowLabel of TREND_METRIC_PRESETS) {
      const match = metricOptions.find((m) => m.rowLabel === rowLabel && m.depth === 0)
        || metricOptions.find((m) => m.rowLabel === rowLabel);
      if (match && !preset.includes(match.label)) preset.push(match.label);
    }
    if (preset.length) setSelectedMetrics(preset);
  };

  const selectAllMetrics = () => {
    if (allMetricLabels.length) setSelectedMetrics(allMetricLabels);
  };

  const hasChartData = chartLayout === 'combined'
    ? combinedSeries.length > 0
    : charts.length > 0;

  if (!valid.length || !metricOptions.length) return null;

  return (
    <div className="glass-panel fund-compare-multi-trend" style={{ padding: '10px 12px', marginBottom: '12px' }}>
      <h3 style={{ fontSize: '12px', fontWeight: '600', marginBottom: '8px' }}>
        Multi-Metric Trends
      </h3>
      <p className="text-muted" style={{ fontSize: '10px', marginBottom: '10px' }}>
        Compare multiple line items over time across {valid.length} selected
        {valid.length === 1 ? ' company' : ' companies'}, including nested statement rows.
        {chartLayout === 'combined'
          ? ' Combined view overlays every ticker × metric series on one chart.'
          : ' Separate view shows one chart per metric with all tickers.'}
      </p>

      <div style={{ marginBottom: '10px' }}>
        <span className="fund-filter-label" style={{ display: 'block', marginBottom: '6px' }}>Chart layout</span>
        <div className="fund-compare-mode-toggle">
        <button
          type="button"
          className={`tab-btn ${chartLayout === 'separate' ? 'active' : ''}`}
          onClick={() => setChartLayout('separate')}
        >
          Separate charts
        </button>
        <button
          type="button"
          className={`tab-btn ${chartLayout === 'combined' ? 'active' : ''}`}
          onClick={() => setChartLayout('combined')}
        >
          Combined chart
        </button>
        </div>
      </div>

      <div className="fund-trend-filters">
        <label className="fund-filter-label">
          Data source
          <select
            className="backtest-input"
            value={activeSection}
            onChange={(e) => setSectionKey(e.target.value)}
            style={{ ...selectStyle, display: 'block', marginTop: '4px' }}
          >
            {availableSections.map((s) => (
              <option key={s.dataKey} value={s.dataKey}>{s.label}</option>
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
        {chartLayout === 'combined' && (
          <label className="fund-filter-label">
            Combined scale
            <select
              className="backtest-input"
              value={combinedScale}
              onChange={(e) => setCombinedScale(e.target.value)}
              style={{ ...selectStyle, display: 'block', marginTop: '4px', minWidth: '180px' }}
            >
              <option value="indexed">Indexed (100 = first period)</option>
              <option value="raw">Raw values</option>
            </select>
          </label>
        )}
        <div className="fund-filter-label" style={{ flex: '1 1 100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '6px' }}>
            <span>Line items ({selectedMetrics.length}/{metricOptions.length})</span>
            <button type="button" className="btn-secondary" style={{ fontSize: '9px', padding: '2px 6px' }} onClick={selectPresetMetrics}>
              Key metrics
            </button>
            <button type="button" className="btn-secondary" style={{ fontSize: '9px', padding: '2px 6px' }} onClick={selectAllMetrics}>
              Select all
            </button>
            <button
              type="button"
              className="btn-secondary"
              style={{ fontSize: '9px', padding: '2px 6px' }}
              onClick={() => setSelectedMetrics(pickDefaultMetrics(metricOptions))}
            >
              Reset
            </button>
          </div>
          <div className="fund-metric-pills fund-metric-pills-all">
            {metricOptions.map((metric) => {
              const active = selectedMetrics.includes(metric.label);
              return (
                <button
                  key={metric.label}
                  type="button"
                  className={`fund-metric-pill ${active ? 'active' : ''}`}
                  data-depth={metric.depth}
                  title={metric.label}
                  onClick={() => toggleMetric(metric.label)}
                >
                  {metricDisplayName(metric)}
                </button>
              );
            })}
          </div>
        </div>
      </div>

        {chartLayout === 'combined' && combinedScale === 'indexed' && (
        <p className="text-muted" style={{ fontSize: '10px', marginBottom: '8px' }}>
          Indexed view rescales each series to 100 at its first period so different units (e.g. Sales vs margins) can be compared on one axis.
          Each company keeps one color; line style (solid, dashed, dotted) distinguishes metrics.
        </p>
      )}

      {selectedMetrics.length > 12 && chartLayout === 'combined' && (
        <p className="text-muted" style={{ fontSize: '10px', marginBottom: '8px' }}>
          Showing {combinedSeries.length} series across {valid.length} companies. Use the legend below the chart to identify each ticker × line item.
        </p>
      )}

      {chartLayout === 'separate' && valid.length > 2 && charts.length > 0 && (
        <p className="text-muted" style={{ fontSize: '10px', marginBottom: '8px' }}>
          Each chart overlays all {valid.length} companies for the selected line item.
        </p>
      )}

      {!hasChartData ? (
        <div className="text-muted text-center" style={{ padding: '24px 0', fontSize: '11px' }}>
          Select at least one line item with data for the chosen statement.
        </div>
      ) : chartLayout === 'combined' ? (
        <div className="fund-compare-multi-trend-combined">
          <LightweightFundamentalsChart series={combinedSeries} height={280} />
        </div>
      ) : (
        <div className="fund-compare-multi-trend-charts">
          {charts.map(({ metricLabel, series }) => (
            <div key={metricLabel} className="fund-compare-multi-trend-block">
              <h4 style={{ fontSize: '11px', fontWeight: '600', marginBottom: '6px' }}>{metricLabel}</h4>
              <LightweightFundamentalsChart series={series} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
