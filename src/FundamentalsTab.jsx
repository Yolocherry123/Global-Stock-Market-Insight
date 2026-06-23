import React, { useCallback, useEffect, useState } from 'react';
import { Percent, AlertTriangle, ExternalLink, RotateCcw } from 'lucide-react';
import { FINANCIAL_SECTIONS, SECTION_KEYS, screenerUrl } from './fundamentalsFormatters';
import ScreenerRatioGrid, { ScreenerRatioPills } from './fundamentals/ScreenerRatioGrid';
import ScreenerFinancialTable from './fundamentals/ScreenerFinancialTable';
import ScreenerInterleavedTable from './fundamentals/ScreenerInterleavedTable';
import ScreenerCompanyCompare from './fundamentals/ScreenerCompanyCompare';
import ScreenerGrowthCards from './fundamentals/ScreenerGrowthCards';
import ScreenerGrowthCompare from './fundamentals/ScreenerGrowthCompare';
import ScreenerProsConsCompare from './fundamentals/ScreenerProsConsCompare';
import ScreenerPeersPanel from './fundamentals/ScreenerPeersPanel';
import ScreenerRatiosTab from './fundamentals/ScreenerRatiosTab';
import ScreenerTrendChart from './fundamentals/ScreenerTrendChart';
import ScreenerAiSummary from './fundamentals/ScreenerAiSummary';
import TickerAutocomplete from './fundamentals/TickerAutocomplete';
import { useFundamentalsState } from './fundamentals/useFundamentalsState';
import { fetchFundamentalTicker, fetchFundamentalTickers } from './fundamentals/fundamentalsApi';

function CompanyHeaderCard({ result, exchangeName }) {
  if (result.error || !result.data) {
    return (
      <div className="glass-panel" style={{ padding: '10px 12px' }}>
        <h3 style={{ fontSize: '12px', fontWeight: '600', marginBottom: '4px' }} className="mono">
          {result.ticker}
        </h3>
        <p className="text-down" style={{ fontSize: '11px' }}>{result.error || 'No data available.'}</p>
      </div>
    );
  }

  const { data } = result;
  const symbol = result.screener_symbol || data.symbol;

  return (
    <div className="glass-panel" style={{ padding: '10px 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
        <div>
          <h3 style={{ fontSize: '12px', fontWeight: '600', marginBottom: '2px' }}>
            {data.name} (<span className="mono">{symbol}</span>)
          </h3>
          {exchangeName && (
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Exchange: {exchangeName}
              {data.price != null && (
                <>
                  {' | '}
                  Price: <span className="mono">₹{data.price}</span>
                </>
              )}
              {data.website && (
                <>
                  {' | '}
                  <a href={data.website} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-cyan)' }}>
                    Website
                  </a>
                </>
              )}
            </div>
          )}
        </div>
        <a
          href={screenerUrl(symbol)}
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: '10px', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          Screener <ExternalLink size={10} />
        </a>
      </div>
      {data.about && (
        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: 1.35 }}>
          {data.about.slice(0, 220)}
          {data.about.length > 220 ? '...' : ''}
        </p>
      )}
      <ScreenerRatioPills data={data} />
    </div>
  );
}

function SlotStatusChip({ status, onRetry }) {
  if (!status) return null;
  const labels = { loading: 'Loading...', done: 'Done', error: 'Failed' };
  return (
    <span className={`fund-slot-status fund-slot-${status}`}>
      {labels[status] || status}
      {status === 'error' && onRetry && (
        <button type="button" className="fund-retry-btn" onClick={onRetry} title="Retry">
          <RotateCcw size={10} />
        </button>
      )}
    </span>
  );
}

export default function FundamentalsTab({ apiBase, initialTickers, onConsumeSeed }) {
  const {
    slots,
    setSlots,
    activeSection,
    setActiveSection,
    tableViewMode,
    setTableViewMode,
    slotStatus,
    updateSlotStatus,
    updateSlot,
    onCompareSuccess,
    shouldAutoRun,
    autoRunTickers,
    markAutoRan,
  } = useFundamentalsState(initialTickers);

  const [catalog, setCatalog] = useState([]);
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

  const runCompare = useCallback(async (tickerList) => {
    const tickers = tickerList || slots.map((s) => (s.ticker || '').trim()).filter(Boolean);
    if (!tickers.length) {
      setError('Enter at least one ticker to compare.');
      return;
    }

    setLoading(true);
    setError(null);
    setResults([]);

    try {
      await fetchFundamentalTickers(apiBase, tickers, {
        onStatus: (ticker, status) => updateSlotStatus(ticker, status),
        onResult: (_result, all) => {
          if (all) setResults(all);
        },
      });
      onCompareSuccess(tickers);
      setActiveSection('overview');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [slots, apiBase, updateSlotStatus, onCompareSuccess, setActiveSection]);

  const retryTicker = async (ticker) => {
    updateSlotStatus(ticker, 'loading');
    try {
      const result = await fetchFundamentalTicker(apiBase, ticker);
      setResults((prev) => {
        const list = prev || [];
        const idx = list.findIndex((r) => r.ticker === ticker);
        if (idx >= 0) {
          const next = [...list];
          next[idx] = result;
          return next;
        }
        return [...list, result];
      });
      updateSlotStatus(ticker, result.error ? 'error' : 'done');
    } catch (err) {
      updateSlotStatus(ticker, 'error');
      setError(err.message);
    }
  };

  useEffect(() => {
    if (shouldAutoRun && !catalogLoading && autoRunTickers?.length) {
      markAutoRan();
      if (onConsumeSeed) onConsumeSeed();
      runCompare(autoRunTickers);
    }
  }, [shouldAutoRun, catalogLoading, autoRunTickers, markAutoRan, onConsumeSeed, runCompare]);

  const handleCompare = (e) => {
    if (e) e.preventDefault();
    runCompare();
  };

  const onAddPeer = (symbol) => {
    const bare = symbol.replace(/\.(NS|BO)$/i, '');
    const used = new Set(slots.map((s) => (s.ticker || '').toUpperCase()));
    if (used.has(bare)) return;
    const emptyIdx = slots.findIndex((s) => !(s.ticker || '').trim());
    if (emptyIdx >= 0) {
      updateSlot(emptyIdx, { ticker: bare });
    } else if (slots.length < 5) {
      setSlots([...slots, { exchangeId: 'nse', ticker: bare }]);
    }
  };

  const onAddAllPeers = (peers) => {
    let next = [...slots];
    for (const peer of peers) {
      if (!peer.symbol || next.length >= 5) break;
      const bare = peer.symbol.replace(/\.(NS|BO)$/i, '');
      const used = new Set(next.map((s) => (s.ticker || '').toUpperCase()));
      if (used.has(bare)) continue;
      const emptyIdx = next.findIndex((s) => !(s.ticker || '').trim());
      if (emptyIdx >= 0) next[emptyIdx] = { ...next[emptyIdx], ticker: bare };
      else next = [...next, { exchangeId: 'nse', ticker: bare }];
    }
    setSlots(next);
  };

  const selectStyle = {
    background: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    color: '#fff',
    fontSize: '11px',
    padding: '3px 8px',
    borderRadius: '4px',
  };

  const inputStyle = {
    ...selectStyle,
    minWidth: '120px',
    flex: 1,
  };

  const validResults = results?.filter((r) => !r.error && r.data) || [];
  const activeFinancial = FINANCIAL_SECTIONS.find((s) => s.id === activeSection);
  const compareTickers = slots.map((s) => (s.ticker || '').trim()).filter(Boolean);

  return (
    <div className="tab-content-container" style={{ flexGrow: 1, overflowY: 'auto', paddingRight: '4px' }}>
      <div className="glass-panel" style={{ marginBottom: '10px' }}>
        <h2 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Percent size={13} className="text-up" />
          Fundamental Analysis (Screener.in)
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '11px', marginBottom: '4px' }}>
          Compare consolidated financials for any NSE/BSE symbol. Data sourced from Screener.in including expandable line items.
        </p>
      </div>

      <form onSubmit={handleCompare} className="glass-panel fund-selection-panel" style={{ marginBottom: '10px', padding: '10px 12px' }}>
        <h3 style={{ fontSize: '11.5px', fontWeight: '600', marginBottom: '4px' }}>Stock Selection (up to 5)</h3>
        <p className="text-muted" style={{ fontSize: '10px', marginBottom: '10px' }}>
          Choose NSE or BSE, search the catalog, quick-pick a symbol, or type any ticker directly.
        </p>

        {catalogLoading ? (
          <div className="text-muted" style={{ fontSize: '11px' }}>Loading catalog...</div>
        ) : (
          <div className="fund-stock-list">
            {slots.map((slot, idx) => {
              const ticker = (slot.ticker || '').trim();
              const catalogTickers = (catalog.find((ex) => ex.id === slot.exchangeId)?.tickers || []);
              return (
                <div key={idx} className="fund-stock-row">
                  <span className="fund-stock-label">#{idx + 1}</span>
                  <select
                    className="backtest-input fund-exchange-select"
                    value={slot.exchangeId}
                    onChange={(e) => updateSlot(idx, { exchangeId: e.target.value })}
                    title="Exchange (filters catalog & quick pick)"
                  >
                    {catalog.map((exchange) => (
                      <option key={exchange.id} value={exchange.id}>
                        {exchange.id === 'nse' ? 'NSE' : exchange.id === 'bse' ? 'BSE' : exchange.name}
                      </option>
                    ))}
                  </select>
                  <TickerAutocomplete
                    catalog={catalog}
                    exchangeId={slot.exchangeId}
                    value={slot.ticker}
                    inputStyle={inputStyle}
                    onChange={(t) => updateSlot(idx, { ticker: t })}
                  />
                  <select
                    className="backtest-input fund-quick-pick"
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        updateSlot(idx, { ticker: e.target.value.replace(/\.(NS|BO)$/i, '') });
                      }
                    }}
                    title="Quick pick from catalog"
                  >
                    <option value="">Quick pick</option>
                    {catalogTickers.map((t) => {
                      const bare = t.replace(/\.(NS|BO)$/i, '');
                      return (
                        <option key={t} value={t}>{bare}</option>
                      );
                    })}
                  </select>
                  {ticker && slotStatus[ticker] && (
                    <SlotStatusChip status={slotStatus[ticker]} onRetry={() => retryTicker(ticker)} />
                  )}
                  {slots.length > 1 && (
                    <button
                      type="button"
                      className="btn-icon"
                      onClick={() => setSlots(slots.filter((_, i) => i !== idx))}
                      title="Remove stock"
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
              const ex = catalog.find((e) => e.id === 'nse') || catalog[0];
              setSlots([...slots, { exchangeId: ex?.id || 'nse', ticker: '' }]);
            }}
          >
            + Add Stock
          </button>
          <button type="submit" className="btn-primary" disabled={loading || catalogLoading}>
            {loading ? 'Fetching...' : 'Compare Fundamentals'}
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

      {loading && !results?.length && (
        <div className="loader-container">
          <div className="spinner"></div>
          <span className="loader-text">Fetching from Screener.in...</span>
        </div>
      )}

      {results && results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="fund-section-tabs">
            {SECTION_KEYS.map((section) => (
              <button
                key={section.id}
                type="button"
                className={`tab-btn ${activeSection === section.id ? 'active' : ''}`}
                onClick={() => setActiveSection(section.id)}
              >
                {section.label}
              </button>
            ))}
          </div>

          {activeSection === 'overview' && (
            <>
              <ScreenerAiSummary apiBase={apiBase} tickers={compareTickers} disabled={loading} />
              <ScreenerTrendChart results={results} title="Key Metric Trends" />
              <ScreenerRatioGrid results={results} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
                {results.map((result) => {
                  const exchangeName = result.exchange_id
                    ? catalog.find((ex) => ex.id === result.exchange_id)?.name
                    : null;
                  return (
                    <CompanyHeaderCard
                      key={result.ticker}
                      result={result}
                      exchangeName={exchangeName}
                    />
                  );
                })}
              </div>
              {validResults.length > 1 ? (
                <ScreenerGrowthCompare results={results} />
              ) : (
                validResults.map((r) => (
                  <ScreenerGrowthCards key={r.ticker} growth={r.data.growth} />
                ))
              )}
              <ScreenerProsConsCompare results={results} />
              {validResults.length > 1 ? (
                <ScreenerPeersPanel
                  result={validResults[0]}
                  slots={slots}
                  onAddPeer={onAddPeer}
                  onAddAllPeers={onAddAllPeers}
                />
              ) : (
                validResults.map((r) => (
                  <ScreenerPeersPanel
                    key={`peers-${r.ticker}`}
                    result={r}
                    slots={slots}
                    onAddPeer={onAddPeer}
                    onAddAllPeers={onAddAllPeers}
                  />
                ))
              )}
            </>
          )}

          {activeSection === 'ratiosTable' && validResults.length > 1 && (
            <div className="fund-table-view-toggle">
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Table layout:</span>
              <button
                type="button"
                className={`tab-btn ${tableViewMode === 'interleaved' ? 'active' : ''}`}
                onClick={() => setTableViewMode('interleaved')}
              >
                Row comparison
              </button>
              <button
                type="button"
                className={`tab-btn ${tableViewMode === 'separate' ? 'active' : ''}`}
                onClick={() => setTableViewMode('separate')}
              >
                Separate tables
              </button>
            </div>
          )}

          {activeSection === 'ratiosTable' && validResults.length > 0 && (
            <ScreenerRatiosTab results={validResults} tableViewMode={tableViewMode} />
          )}

          {activeFinancial && activeSection !== 'ratiosTable' && (activeSection === 'quarterly' || activeSection === 'profitLoss') && (
            <ScreenerTrendChart
              results={results}
              defaultSection={activeSection}
              title={`${activeFinancial.label} Trends`}
              lockSection
            />
          )}

          {activeFinancial && activeSection !== 'ratiosTable' && validResults.length > 1 && (
            <div className="fund-table-view-toggle">
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Table layout:</span>
              <button
                type="button"
                className={`tab-btn ${tableViewMode === 'interleaved' ? 'active' : ''}`}
                onClick={() => setTableViewMode('interleaved')}
              >
                Row comparison
              </button>
              <button
                type="button"
                className={`tab-btn ${tableViewMode === 'separate' ? 'active' : ''}`}
                onClick={() => setTableViewMode('separate')}
              >
                Separate tables
              </button>
            </div>
          )}

          {activeFinancial && activeSection !== 'ratiosTable' && validResults.length > 1 && tableViewMode === 'interleaved' && (
            <ScreenerInterleavedTable
              title={activeFinancial.label}
              results={validResults}
              dataKey={activeFinancial.dataKey}
            />
          )}

          {activeFinancial && activeSection !== 'ratiosTable' && (validResults.length === 1 || tableViewMode === 'separate') && validResults.map((r) => (
            <ScreenerFinancialTable
              key={`${r.ticker}-${activeSection}`}
              title={activeFinancial.label}
              section={r.data[activeFinancial.dataKey]}
              companyName={r.data.name}
            />
          ))}

          {activeSection === 'compare' && (
            <ScreenerCompanyCompare results={results} />
          )}

          {results.some((r) => r.error) && (
            <div className="glass-panel" style={{ padding: '8px 12px' }}>
              {results.filter((r) => r.error).map((r) => (
                <div key={r.ticker} className="text-down" style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {r.ticker}: {r.error}
                  <button type="button" className="btn-secondary" style={{ fontSize: '10px' }} onClick={() => retryTicker(r.ticker)}>
                    Retry
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!loading && !results && !error && (
        <div className="glass-panel text-muted text-center" style={{ padding: '24px', fontSize: '11px' }}>
          Enter tickers above (e.g. HDFCBANK, RELIANCE) and click Compare Fundamentals.
        </div>
      )}
    </div>
  );
}
