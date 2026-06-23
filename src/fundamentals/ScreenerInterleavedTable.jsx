import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import {
  analyzeSectionCoverage,
  buildOrderedPaths,
  collectPeriods,
  COMPANY_COLORS,
  exportTableToCsv,
  findRowByPath,
  formatIndianNumber,
  getPathCoverage,
  getRatioFormula,
  isPathVisible,
} from '../fundamentalsFormatters';
import { RatioLabel } from './RatioInfoTip';

function LineItemLabel({ label, showFormula }) {
  if (showFormula && getRatioFormula(label)) {
    return <RatioLabel name={label} />;
  }
  return label;
}

function CoverageSummary({ coverage, companies }) {
  const [showDetails, setShowDetails] = useState(false);

  if (coverage.partialCount === 0) {
    return (
      <div className="fund-coverage-ok" style={{ fontSize: '10px', marginTop: '6px' }}>
        All {coverage.totalPaths} line items are present for every company in this section.
      </div>
    );
  }

  const companyOnlyEntries = Object.entries(coverage.companyOnlyRows || {}).filter(
    ([, rows]) => rows.length > 0,
  );

  return (
    <div className="fund-coverage-warn" style={{ marginTop: '6px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px' }}>
        <AlertTriangle size={12} />
        <span>
          {coverage.partialCount} of {coverage.totalPaths} line items are not available for all
          {' '}{companies.length} companies — missing rows are marked below.
        </span>
        <button
          type="button"
          className="fund-coverage-toggle"
          onClick={() => setShowDetails((v) => !v)}
        >
          {showDetails ? 'Hide details' : 'Show details'}
        </button>
      </div>
      {showDetails && (
        <ul style={{ margin: '6px 0 0', paddingLeft: '18px', fontSize: '10px', lineHeight: 1.45 }}>
          {coverage.partial.slice(0, 25).map(({ path, missing }) => (
            <li key={path}>
              <strong>{path}</strong>
              {' — missing for: '}
              <span className="mono text-down">{missing.join(', ')}</span>
            </li>
          ))}
          {coverage.partial.length > 25 && (
            <li className="text-muted">…and {coverage.partial.length - 25} more</li>
          )}
          {companyOnlyEntries.map(([symbol, rows]) => (
            rows.length > 0 ? (
              <li key={`only-${symbol}`}>
                <span className="mono">{symbol}</span>
                {' only: '}
                {rows.slice(0, 8).join(', ')}
                {rows.length > 8 ? ` (+${rows.length - 8} more)` : ''}
              </li>
            ) : null
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ScreenerInterleavedTable({ title, results, dataKey, defaultExpandAll = false }) {
  const showFormula = dataKey === 'ratiosTable';
  const [expanded, setExpanded] = useState({});
  const [focusPeriod, setFocusPeriod] = useState('');

  const valid = results.filter((r) => !r.error && r.data?.[dataKey]?.rows?.length);
  const periods = valid.length ? collectPeriods(valid, dataKey) : [];
  const paths = valid.length ? buildOrderedPaths(valid, dataKey) : [];

  useEffect(() => {
    if (defaultExpandAll && paths.length) {
      const all = {};
      paths.forEach(({ path }) => { all[path] = true; });
      setExpanded(all);
    }
  }, [defaultExpandAll, dataKey, valid.length, paths.length]);

  if (valid.length === 0) {
    return (
      <div className="glass-panel" style={{ padding: '12px' }}>
        <p className="text-muted" style={{ fontSize: '11px' }}>No {title} data available.</p>
      </div>
    );
  }

  const companies = valid.map((r, idx) => ({
    ticker: r.ticker,
    symbol: r.screener_symbol || r.data.symbol,
    name: r.data.name,
    rows: r.data[dataKey].rows,
    color: COMPANY_COLORS[idx % COMPANY_COLORS.length],
  }));

  const coverage = useMemo(
    () => analyzeSectionCoverage(valid, dataKey),
    [valid, dataKey],
  );

  const onToggle = (path) => {
    setExpanded((prev) => ({ ...prev, [path]: prev[path] === false }));
  };

  const expandAll = () => {
    const all = {};
    paths.forEach(({ path }) => { all[path] = true; });
    setExpanded(all);
  };

  const collapseAll = () => setExpanded({});

  const activeFocus = focusPeriod || periods[periods.length - 1] || '';

  const exportCsv = () => {
    const headers = ['Line Item', 'Company', ...periods];
    const rows = [];
    paths.forEach(({ path, rowLabel }) => {
      companies.forEach((company) => {
        const row = findRowByPath(company.rows, path);
        rows.push([
          rowLabel,
          company.symbol,
          ...periods.map((p) => formatIndianNumber(row?.values?.[p])),
        ]);
      });
    });
    exportTableToCsv(`${title}-comparison.csv`, headers, rows);
  };

  let lastPath = null;

  return (
    <div className="glass-panel" style={{ padding: 0 }}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ fontSize: '12px', fontWeight: '600' }}>{title} — Row Comparison</h3>
            <p style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Same line items stacked by company. Rows missing from a company&apos;s statement are
              labelled &quot;Not available&quot;.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button type="button" className="btn-secondary" style={{ fontSize: '10px' }} onClick={expandAll}>Expand all</button>
            <button type="button" className="btn-secondary" style={{ fontSize: '10px' }} onClick={collapseAll}>Collapse all</button>
            <button type="button" className="btn-secondary" style={{ fontSize: '10px' }} onClick={exportCsv}>Export CSV</button>
          </div>
        </div>
        <label style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '6px', display: 'inline-block' }}>
          Focus period:{' '}
          <select
            className="backtest-input"
            value={activeFocus}
            onChange={(e) => setFocusPeriod(e.target.value)}
            style={{ fontSize: '10px', marginLeft: '4px' }}
          >
            {periods.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        {valid.length > 1 && <CoverageSummary coverage={coverage} companies={companies} />}
      </div>
      <div className="fund-table-scroll">
        <table className="custom-table fund-financial-table fund-interleaved-table" style={{ fontSize: '12px' }}>
          <thead>
            <tr>
              <th className="fund-sticky-col">Line Item</th>
              <th className="fund-sticky-col-2">Company</th>
              {periods.map((p) => (
                <th key={p} className={`mono ${activeFocus === p ? 'fund-period-focus' : ''}`}>{p}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paths.map(({ path, rowLabel, depth, expandable }) => {
              if (!isPathVisible(path, depth, expanded)) return null;

              const isNewGroup = path !== lastPath;
              lastPath = path;
              const { missing, complete } = getPathCoverage(companies, path);

              const rows = [];

              if (expandable) {
                const isOpen = expanded[path] !== false;
                rows.push(
                  <tr key={`${path}-header`} className={`fund-group-header ${isNewGroup ? 'fund-compare-group-start' : ''}`}>
                    <td
                      className="fund-sticky-col"
                      colSpan={2 + periods.length}
                      style={{ paddingLeft: `${8 + depth * 14}px` }}
                    >
                      <button
                        type="button"
                        className="fund-expand-btn"
                        onClick={() => onToggle(path)}
                        style={{ fontWeight: 600 }}
                      >
                        {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        <span><LineItemLabel label={rowLabel} showFormula={showFormula} /></span>
                        {!complete && (
                          <span className="fund-partial-badge" title={`Missing for: ${missing.join(', ')}`}>
                            partial
                          </span>
                        )}
                      </button>
                    </td>
                  </tr>,
                );
              } else if (!complete) {
                rows.push(
                  <tr key={`${path}-partial`} className="fund-partial-label-row">
                    <td
                      className="fund-sticky-col"
                      colSpan={2 + periods.length}
                      style={{ paddingLeft: `${8 + depth * 14}px`, fontSize: '10px' }}
                    >
                      <span style={{ fontWeight: 600 }}><LineItemLabel label={rowLabel} showFormula={showFormula} /></span>
                      <span className="fund-partial-badge" style={{ marginLeft: '8px' }}>
                        missing for {missing.join(', ')}
                      </span>
                    </td>
                  </tr>,
                );
              }

              companies.forEach((company, cIdx) => {
                const row = findRowByPath(company.rows, path);
                const isMissing = !row;

                rows.push(
                  <tr
                    key={`${path}-${company.ticker}`}
                    className={`fund-compare-company-row ${isMissing ? 'fund-row-missing' : ''} ${!expandable && isNewGroup && cIdx === 0 ? 'fund-compare-group-start' : ''}`}
                  >
                    <td
                      className="fund-sticky-col"
                      style={{
                        paddingLeft: `${8 + depth * 14}px`,
                        fontWeight: expandable ? 400 : 600,
                        color: expandable ? 'var(--text-secondary)' : 'var(--text-primary)',
                      }}
                    >
                      {!expandable ? <LineItemLabel label={rowLabel} showFormula={showFormula} /> : ''}
                    </td>
                    <td className="fund-sticky-col-2">
                      <span
                        className="fund-company-tag mono"
                        style={{ borderColor: company.color, color: company.color }}
                      >
                        {company.symbol}
                      </span>
                    </td>
                    {isMissing ? (
                      <td
                        colSpan={periods.length}
                        className="fund-not-available"
                        title={`${rowLabel} is not reported on ${company.name}'s ${title} statement`}
                      >
                        Not available
                      </td>
                    ) : (
                      periods.map((period) => (
                        <td key={period} className={`mono ${activeFocus === period ? 'fund-period-focus' : ''}`}>
                          {formatIndianNumber(row.values?.[period])}
                        </td>
                      ))
                    )}
                  </tr>,
                );
              });

              return rows;
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
