const STORAGE_KEY = 'smb-watchlist-v1';

export const DEFAULT_WATCHLIST = [
  { ticker: 'AAPL', exchangeId: 'nasdaq', yahooSymbol: 'AAPL' },
  { ticker: 'MSFT', exchangeId: 'nasdaq', yahooSymbol: 'MSFT' },
  { ticker: 'RELIANCE', exchangeId: 'nse', yahooSymbol: 'RELIANCE.NS' },
  { ticker: 'TCS', exchangeId: 'nse', yahooSymbol: 'TCS.NS' },
  { ticker: '7203', exchangeId: 'jpx', yahooSymbol: '7203.T' },
  { ticker: '0700', exchangeId: 'hkex', yahooSymbol: '0700.HK' },
  { ticker: 'SHEL', exchangeId: 'lse', yahooSymbol: 'SHEL.L' },
  { ticker: 'RY', exchangeId: 'tsx', yahooSymbol: 'RY.TO' },
  { ticker: '005930', exchangeId: 'krx', yahooSymbol: '005930.KS' },
  { ticker: 'MC', exchangeId: 'euronext', yahooSymbol: 'MC.PA' },
];

function normalizeEntry(entry) {
  if (!entry?.ticker) return null;
  return {
    ticker: String(entry.ticker).trim().toUpperCase(),
    exchangeId: entry.exchangeId || entry.exchange_id || '',
    yahooSymbol: entry.yahooSymbol || entry.yahoo_symbol || entry.ticker,
    displayName: entry.displayName || entry.display_name || entry.ticker,
  };
}

export function loadWatchlist() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_WATCHLIST;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) return DEFAULT_WATCHLIST;
    return parsed.map(normalizeEntry).filter(Boolean);
  } catch {
    return DEFAULT_WATCHLIST;
  }
}

export function saveWatchlist(items) {
  const normalized = items.map(normalizeEntry).filter(Boolean);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function watchlistToApiPayload(items) {
  return items.map((item) => ({
    ticker: item.ticker,
    exchange_id: item.exchangeId,
    yahoo_symbol: item.yahooSymbol,
    display_name: item.displayName || item.ticker,
  }));
}
