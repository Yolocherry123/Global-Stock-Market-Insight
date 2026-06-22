import React, { useEffect, useState } from 'react';
import { Percent, AlertTriangle } from 'lucide-react';
import {
  FUNDAMENTAL_METRICS,
  getFundamentalItems,
  getBestWorstIndices,
} from './fundamentalsFormatters';

const DEFAULT_SLOT = {
  exchangeId: 'nasdaq',
  ticker: 'AAPL',
  useCustom: false,
  customTicker: '',
};

function resolveSlotTicker(slot) {
  if (slot.useCustom) {
    return (slot.customTicker || '').trim();
  }
  return (slot.ticker || '').trim();
}

function FundamentalsStockCard({ result, exchangeName }) {
  if (result.error || !result.info) {
    return (
      <div className="glass-panel" style={{ padding: '10px 12px' }}>
        <h3 style={{ fontSize: '12px', fontWeight: '600', marginBottom: '4px' }} className="mono">
          {result.ticker}
        </h3>
        <p className="text-down" style={{ fontSize: '11px' }}>{result.error || 'No data available.'}</p>
      </div>
    );
  }

  const { info } = result;
  const items = getFundamentalItems(info);

  return (
    <div className="glass-panel" style={{ padding: '10px 12px' }}>
      <h3 style={{ fontSize: '12px', fontWeight: '600', marginBottom: '2px' }}>
        {info.longName} (<span className="mono">{result.ticker}</span>)
      </h3>
      {exchangeName && (
        <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
          Exchange: {exchangeName}
        </div>
      )}
      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
        Sector: <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{info.sector}</span>
        {' | '}
        Industry: <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{info.industry}</span>
      </div>
      <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: 1.35 }}>
        {(info.longBusinessSummary || '').slice(0, 200)}
        {(info.longBusinessSummary || '').length > 200 ? '...' : ''}
      </p>
      {info.website && (
        <a
          href={info.website}
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: '10px', color: 'var(--accent-cyan)', display: 'inline-block', marginBottom: '8px' }}
        >
          {info.website.replace(/^https?:\/\//, '')}
        </a>
      )}
      <div className="metrics-pill-grid">
        {items.map((item) => (
          <div className="metric-pill" key={item.label}>
            <span className="metric-pill-label">{item.label}</span>
            <span className="metric-pill-value">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FundamentalsTab({ apiBase }) {
  const [catalog, setCatalog] = useState([]);
  const [slots, setSlots] = useState([
    { ...DEFAULT_SLOT, ticker: 'AAPL' },
    { ...DEFAULT_SLOT, exchangeId: 'nasdaq', ticker: 'MSFT' },
  ]);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const loadCatalog = async () => {
      setCatalogLoading(true);
      try {
        const res = await fetch(`${apiBase}/fundamentals/catalog`);
        if (!res.ok) throw new Error('Failed to load exchange catalog');
        const data = await res.json();
        if (!cancelled) setCatalog(data.exchanges || []);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    };
    loadCatalog();
    return () => { cancelled = true; };
  }, [apiBase]);

  const getExchange = (exchangeId) => catalog.find((ex) => ex.id === exchangeId);

  const updateSlot = (index, patch) => {
    setSlots((prev) => prev.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)));
  };

  const handleExchangeChange = (index, exchangeId) => {
    const ex = getExchange(exchangeId);
    const firstTicker = ex?.tickers?.[0] || '';
    updateSlot(index, { exchangeId, ticker: firstTicker });
  };

  const handleCompare = async (e) => {
    if (e) e.preventDefault();
    const tickers = slots.map(resolveSlotTicker).filter(Boolean);
    if (tickers.length === 0) {
      setError('Select at least one ticker to compare.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/fundamentals/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || 'Failed to compare fundamentals');
      }
      const data = await res.json();
      setResults(data.results || []);
    } catch (err) {
      setError(err.message);
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  const selectStyle = {
    background: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    color: '#fff',
    fontSize: '11px',
    padding: '3px 8px',
    borderRadius: '4px',
  };

  return (
    <div className="tab-content-container" style={{ flexGrow: 1, overflowY: 'auto', paddingRight: '4px' }}>
      <div className="glass-panel" style={{ marginBottom: '10px' }}>
        <h2 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Percent size={13} className="text-up" />
          Fundamental Analysis & Stock Comparison
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '11px', marginBottom: '4px' }}>
          Select stocks by exchange or enter custom tickers, then compare valuation, profitability, and balance-sheet metrics side by side.
        </p>
      </div>

      <form onSubmit={handleCompare} className="glass-panel" style={{ marginBottom: '10px', padding: '10px 12px' }}>
        <h3 style={{ fontSize: '11.5px', fontWeight: '600', marginBottom: '8px' }}>Stock Selection (up to 5)</h3>

        {catalogLoading ? (
          <div className="text-muted" style={{ fontSize: '11px' }}>Loading exchange catalog...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {slots.map((slot, idx) => {
              const ex = getExchange(slot.exchangeId);
              const tickers = ex?.tickers || [];
              return (
                <div key={idx} className="backtest-row" style={{ alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)', minWidth: '52px' }}>Stock {idx + 1}</span>
                  <select
                    className="backtest-input"
                    value={slot.exchangeId}
                    onChange={(e) => handleExchangeChange(idx, e.target.value)}
                    style={selectStyle}
                    disabled={slot.useCustom}
                  >
                    {catalog.map((exchange) => (
                      <option key={exchange.id} value={exchange.id}>{exchange.name}</option>
                    ))}
                  </select>
                  {!slot.useCustom ? (
                    <select
                      className="backtest-input backtest-input-ticker"
                      value={slot.ticker}
                      onChange={(e) => updateSlot(idx, { ticker: e.target.value })}
                      style={selectStyle}
                    >
                      {tickers.map((ticker) => (
                        <option key={ticker} value={ticker}>{ticker}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="Custom ticker (e.g. TSLA)"
                      className="backtest-input backtest-input-ticker"
                      value={slot.customTicker}
                      onChange={(e) => updateSlot(idx, { customTicker: e.target.value })}
                    />
                  )}
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--text-secondary)' }}>
                    <input
                      type="checkbox"
                      checked={slot.useCustom}
                      onChange={(e) => updateSlot(idx, { useCustom: e.target.checked })}
                    />
                    Custom ticker
                  </label>
                  {slots.length > 1 && (
                    <button
                      type="button"
                      className="btn-icon"
                      onClick={() => setSlots(slots.filter((_, i) => i !== idx))}
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="backtest-action-row" style={{ marginTop: '10px' }}>
          <button
            type="button"
            className="btn-secondary"
            disabled={slots.length >= 5}
            onClick={() => {
              const ex = catalog[0];
              setSlots([
                ...slots,
                {
                  ...DEFAULT_SLOT,
                  exchangeId: ex?.id || 'nasdaq',
                  ticker: ex?.tickers?.[0] || '',
                },
              ]);
            }}
          >
            + Add Stock
          </button>
          <button type="submit" className="btn-primary" disabled={loading || catalogLoading}>
            {loading ? 'Comparing...' : 'Compare Fundamentals'}
          </button>
        </div>

        {error && (
          <div
            className="text-down"
            style={{
              fontSize: '11px',
              marginTop: '8px',
              padding: '6px',
              background: 'rgba(255,23,68,0.1)',
              border: '1px solid rgba(255,23,68,0.2)',
              borderRadius: '4px',
              display: 'flex',
              gap: '6px',
              alignItems: 'center',
            }}
          >
            <AlertTriangle size={14} />
            {error}
          </div>
        )}
      </form>

      {loading && (
        <div className="loader-container">
          <div className="spinner"></div>
          <span className="loader-text">Fetching fundamental data from Yahoo Finance...</span>
        </div>
      )}

      {!loading && results && results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="glass-panel" style={{ padding: 0 }}>
            <div style={{ padding: '8px 12px' }}>
              <h3 style={{ fontSize: '12px', fontWeight: '600' }}>Side-by-Side Comparison</h3>
            </div>
            <div className="comparison-table-wrapper">
              <table className="custom-table" style={{ fontSize: '11px' }}>
                <thead>
                  <tr>
                    <th>Metric</th>
                    {results.map((r) => (
                      <th key={r.ticker} className="mono">{r.ticker}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {FUNDAMENTAL_METRICS.map((metric) => {
                    const rawValues = results.map((r) => (r.info ? r.info[metric.key] : null));
                    const { best, worst } = getBestWorstIndices(rawValues, metric.higherIsBetter);
                    return (
                      <tr key={metric.key}>
                        <td style={{ fontWeight: '600' }}>{metric.label}</td>
                        {results.map((r, colIdx) => {
                          if (r.error || !r.info) {
                            return (
                              <td key={`${r.ticker}-${metric.key}`} className="text-muted">
                                N/A
                              </td>
                            );
                          }
                          const value = metric.format(r.info[metric.key]);
                          let className = 'mono';
                          if (colIdx === best) className += ' text-up';
                          if (colIdx === worst) className += ' text-down';
                          return (
                            <td key={`${r.ticker}-${metric.key}`} className={className}>
                              {value}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {results.some((r) => r.error) && (
              <div style={{ padding: '6px 12px 10px', fontSize: '10px', color: 'var(--text-secondary)' }}>
                {results.filter((r) => r.error).map((r) => (
                  <div key={r.ticker} className="text-down">
                    {r.ticker}: {r.error}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
            {results.map((result) => {
              const exchangeName = result.exchange_id
                ? catalog.find((ex) => ex.id === result.exchange_id)?.name
                : null;
              return (
                <FundamentalsStockCard
                  key={result.ticker}
                  result={result}
                  exchangeName={exchangeName}
                />
              );
            })}
          </div>
        </div>
      )}

      {!loading && !results && !error && (
        <div className="glass-panel text-muted text-center" style={{ padding: '24px', fontSize: '11px' }}>
          Choose stocks above and click Compare Fundamentals to view metrics.
        </div>
      )}
    </div>
  );
}
