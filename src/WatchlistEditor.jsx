import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Settings2, Trash2, X } from 'lucide-react';
import TickerAutocomplete from './fundamentals/TickerAutocomplete';
import { getCatalogTickers } from './fundamentalsFormatters';

const EXCHANGE_LABELS = {
  nasdaq: 'NASDAQ',
  nyse: 'NYSE',
  nse: 'NSE',
  bse: 'BSE',
  lse: 'LSE',
  tsx: 'TSX',
  hkex: 'HKEX',
  jpx: 'JPX',
  krx: 'KRX',
  euronext: 'Euronext',
  sse: 'Shanghai',
  szse: 'Shenzhen',
  twse: 'Taiwan',
};

function exchangeLabel(exchangeId, name) {
  return EXCHANGE_LABELS[exchangeId] || name || exchangeId?.toUpperCase();
}

function resolveYahooFromCatalog(catalog, exchangeId, ticker) {
  const upper = (ticker || '').trim().toUpperCase();
  if (!upper) return '';
  const match = getCatalogTickers(catalog, exchangeId).find(
    (item) => item.ticker === upper || item.yahooSymbol === upper || item.fullTicker === upper,
  );
  if (match) return match.yahooSymbol;
  const ex = catalog.find((e) => e.id === exchangeId);
  const suffix = ex?.tickerSuffix || '';
  if (suffix && !upper.includes('.')) return `${upper}${suffix}`;
  return upper;
}

export default function WatchlistEditor({
  open,
  onClose,
  watchlist,
  onSave,
  catalog,
  catalogLoading,
}) {
  const [draft, setDraft] = useState(watchlist);
  const [exchangeId, setExchangeId] = useState('nasdaq');
  const [pickerTicker, setPickerTicker] = useState('');

  useEffect(() => {
    if (open) setDraft(watchlist);
  }, [open, watchlist]);

  const catalogWithSuffixes = useMemo(
    () => (catalog || []).map((ex) => ({
      ...ex,
      tickerSuffix: inferSuffix(ex),
    })),
    [catalog],
  );

  const addTicker = () => {
    const ticker = pickerTicker.trim().toUpperCase();
    if (!ticker) return;
    const yahooSymbol = resolveYahooFromCatalog(catalogWithSuffixes, exchangeId, ticker);
    const entry = {
      ticker: ticker.replace(/\.(NS|BO|SS|SZ|T|PA|AS|BR|HK|TW|KS|KQ|TO|L)$/i, '') || ticker,
      exchangeId,
      yahooSymbol,
      displayName: ticker,
    };
    if (draft.some((d) => d.yahooSymbol === entry.yahooSymbol)) return;
    setDraft([...draft, entry]);
    setPickerTicker('');
  };

  const removeAt = (idx) => {
    setDraft(draft.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    onSave(draft);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="watchlist-modal-overlay" onClick={onClose}>
      <div className="watchlist-modal glass-panel" onClick={(e) => e.stopPropagation()}>
        <div className="watchlist-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings2 size={14} className="text-up" />
            <h2>Customize Ticker Tape</h2>
          </div>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Close">
            <X size={14} />
          </button>
        </div>

        <p className="text-muted" style={{ fontSize: '11px', marginBottom: '12px' }}>
          Pick stocks from any supported exchange. Your choices are saved in this browser.
        </p>

        {catalogLoading ? (
          <div className="text-muted" style={{ fontSize: '11px' }}>Loading exchanges...</div>
        ) : (
          <>
            <div className="watchlist-add-row">
              <select
                className="backtest-input"
                value={exchangeId}
                onChange={(e) => setExchangeId(e.target.value)}
              >
                {catalogWithSuffixes.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {exchangeLabel(ex.id, ex.name)}
                  </option>
                ))}
              </select>
              <TickerAutocomplete
                catalog={catalogWithSuffixes}
                exchangeId={exchangeId}
                value={pickerTicker}
                onChange={setPickerTicker}
                inputStyle={{ flex: 1, minWidth: 0 }}
              />
              <button type="button" className="btn-secondary" onClick={addTicker}>
                <Plus size={12} /> Add
              </button>
            </div>

            <div className="watchlist-items">
              {draft.length === 0 ? (
                <div className="text-muted" style={{ fontSize: '11px', padding: '8px 0' }}>
                  No tickers selected. Add symbols above.
                </div>
              ) : (
                draft.map((item, idx) => (
                  <div key={`${item.yahooSymbol}-${idx}`} className="watchlist-item-row">
                    <span className="watchlist-item-exchange">
                      {exchangeLabel(item.exchangeId, catalogWithSuffixes.find((e) => e.id === item.exchangeId)?.name)}
                    </span>
                    <span className="mono watchlist-item-ticker">{item.ticker}</span>
                    <span className="text-muted" style={{ fontSize: '10px' }}>{item.yahooSymbol}</span>
                    <button
                      type="button"
                      className="btn-icon watchlist-remove-btn"
                      onClick={() => removeAt(idx)}
                      aria-label={`Remove ${item.ticker}`}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        <div className="watchlist-modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary" onClick={handleSave}>Save ticker tape</button>
        </div>
      </div>
    </div>
  );
}

function inferSuffix(exchange) {
  const tickers = exchange.tickers || [];
  if (!tickers.length) return '';
  const sample = String(tickers[0]).toUpperCase();
  const dot = sample.lastIndexOf('.');
  return dot >= 0 ? sample.slice(dot) : '';
}
