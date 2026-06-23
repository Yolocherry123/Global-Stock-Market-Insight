import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Download } from 'lucide-react';
import {
  computeDerivedGrowth,
  exportTableToCsv,
  formatIndianNumber,
  getRatioFormula,
} from '../fundamentalsFormatters';
import { RatioLabel } from './RatioInfoTip';

function RowLabel({ label, showFormula }) {
  if (showFormula && getRatioFormula(label)) {
    return <RatioLabel name={label} />;
  }
  return label;
}

function FinancialRow({ row, periods, depth, expanded, onToggle, focusPeriod, showFormula }) {
  const hasChildren = row.children?.length > 0;
  const isExpanded = expanded[row.label] !== false;

  return (
    <>
      <tr className={`${depth > 0 ? 'fund-row-child' : ''} ${row.isDerived ? 'fund-derived-row' : ''}`}>
        <td
          className="fund-sticky-col"
          style={{ paddingLeft: `${8 + depth * 14}px`, fontWeight: depth === 0 ? 600 : 400 }}
        >
          {hasChildren ? (
            <button
              type="button"
              className="fund-expand-btn"
              onClick={() => onToggle(row.label)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onToggle(row.label);
                }
              }}
              tabIndex={0}
            >
              {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <span><RowLabel label={row.label} showFormula={showFormula} /></span>
            </button>
          ) : (
            <span><RowLabel label={row.label} showFormula={showFormula} /></span>
          )}
        </td>
        {periods.map((period) => (
          <td
            key={period}
            className={`mono ${focusPeriod === period ? 'fund-period-focus' : ''}`}
          >
            {formatIndianNumber(row.values?.[period])}
          </td>
        ))}
      </tr>
      {hasChildren && isExpanded && row.children.map((child) => (
        <FinancialRow
          key={`${row.label}-${child.label}`}
          row={child}
          periods={periods}
          depth={depth + 1}
          expanded={expanded}
          onToggle={onToggle}
          focusPeriod={focusPeriod}
          showFormula={showFormula}
        />
      ))}
    </>
  );
}

function collectAllLabels(rows, out = []) {
  for (const row of rows || []) {
    out.push(row.label);
    if (row.children?.length) collectAllLabels(row.children, out);
  }
  return out;
}

function flattenForCsv(rows, periods, depth = 0, out = []) {
  for (const row of rows || []) {
    out.push([
      '  '.repeat(depth) + row.label,
      ...periods.map((p) => formatIndianNumber(row.values?.[p])),
    ]);
    if (row.children?.length) flattenForCsv(row.children, periods, depth + 1, out);
  }
  return out;
}

export default function ScreenerFinancialTable({ title, section, companyName }) {
  const [expanded, setExpanded] = useState({});
  const [showDerived, setShowDerived] = useState(false);
  const [focusPeriod, setFocusPeriod] = useState('');

  const derivedRows = useMemo(
    () => (showDerived ? computeDerivedGrowth(section) : []),
    [section, showDerived],
  );

  if (!section?.rows?.length) {
    return (
      <div className="glass-panel" style={{ padding: '12px' }}>
        <p className="text-muted" style={{ fontSize: '11px' }}>No {title} data available.</p>
      </div>
    );
  }

  const { periods, rows } = section;
  const showFormula = title === 'Ratios';
  const activeFocus = focusPeriod || periods[periods.length - 1] || '';

  const displayRows = [...rows, ...derivedRows];

  const onToggle = (label) => {
    setExpanded((prev) => ({ ...prev, [label]: prev[label] === false }));
  };

  const expandAll = () => {
    const all = {};
    collectAllLabels(rows).forEach((l) => { all[l] = true; });
    setExpanded(all);
  };

  const collapseAll = () => setExpanded({});

  const exportCsv = () => {
    exportTableToCsv(
      `${companyName || 'company'}-${title.replace(/\s/g, '-')}.csv`,
      ['Item', ...periods],
      flattenForCsv(displayRows, periods),
    );
  };

  return (
    <div className="glass-panel" style={{ padding: 0 }}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
          <div>
            <h3 style={{ fontSize: '12px', fontWeight: '600' }}>
              {title}
              {companyName && (
                <span style={{ fontWeight: 400, color: 'var(--text-secondary)', marginLeft: '6px' }}>
                  — {companyName}
                </span>
              )}
            </h3>
            <p style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Consolidated figures in Rs. Crores
            </p>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button type="button" className="btn-secondary" style={{ fontSize: '10px' }} onClick={expandAll}>Expand all</button>
            <button type="button" className="btn-secondary" style={{ fontSize: '10px' }} onClick={collapseAll}>Collapse all</button>
            <button type="button" className="btn-secondary" style={{ fontSize: '10px' }} onClick={() => setShowDerived((v) => !v)}>
              {showDerived ? 'Hide growth %' : 'Show growth %'}
            </button>
            <button type="button" className="btn-secondary" style={{ fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={exportCsv}>
              <Download size={11} /> CSV
            </button>
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
      </div>
      <div className="fund-table-scroll">
        <table className="custom-table fund-financial-table" style={{ fontSize: '12px' }}>
          <thead>
            <tr>
              <th className="fund-sticky-col">Item</th>
              {periods.map((p) => (
                <th key={p} className={`mono ${activeFocus === p ? 'fund-period-focus' : ''}`}>{p}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row) => (
              <FinancialRow
                key={row.label}
                row={row}
                periods={periods}
                depth={0}
                expanded={expanded}
                onToggle={onToggle}
                focusPeriod={activeFocus}
                showFormula={showFormula}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
