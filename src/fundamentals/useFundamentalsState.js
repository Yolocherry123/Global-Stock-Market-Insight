import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'fundamentals:lastCompare';

const DEFAULT_SLOTS = [
  { exchangeId: 'nse', ticker: 'HDFCBANK' },
  { exchangeId: 'nse', ticker: 'ICICIBANK' },
];

function parseUrlTickers() {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('tickers');
  if (!raw) return null;
  const tickers = raw.split(',').map((t) => t.trim().toUpperCase()).filter(Boolean);
  if (!tickers.length) return null;
  return tickers.map((ticker) => ({ exchangeId: 'nse', ticker }));
}

function loadStoredState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function useFundamentalsState(initialTickers) {
  const urlSlots = parseUrlTickers();
  const stored = loadStoredState();
  const seedSlots = initialTickers?.length
    ? initialTickers.map((t) => ({ exchangeId: 'nse', ticker: t.replace(/\.(NS|BO)$/i, '') }))
    : null;

  const initialSlots = seedSlots || urlSlots || stored?.slots || DEFAULT_SLOTS;

  const [slots, setSlots] = useState(initialSlots);
  const [activeSection, setActiveSection] = useState(stored?.activeSection || 'overview');
  const [tableViewMode, setTableViewMode] = useState(stored?.tableViewMode || 'interleaved');
  const [slotStatus, setSlotStatus] = useState({});
  const autoRanRef = useRef(false);

  const shouldAutoRunFromUrl = Boolean(urlSlots?.length);
  const shouldAutoRunFromSeed = Boolean(seedSlots?.length);

  const persistState = useCallback((nextSlots, nextSection, nextViewMode) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        slots: nextSlots,
        activeSection: nextSection,
        tableViewMode: nextViewMode,
      }));
    } catch {
      /* ignore */
    }
  }, []);

  const updateUrl = useCallback((tickers) => {
    const params = new URLSearchParams(window.location.search);
    if (tickers.length) {
      params.set('tickers', tickers.join(','));
    } else {
      params.delete('tickers');
    }
    const qs = params.toString();
    const next = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`;
    window.history.replaceState(null, '', next);
  }, []);

  useEffect(() => {
    persistState(slots, activeSection, tableViewMode);
  }, [slots, activeSection, tableViewMode, persistState]);

  const updateSlot = useCallback((index, patch) => {
    setSlots((prev) => prev.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)));
  }, []);

  const setSlotStatuses = useCallback((statuses) => {
    setSlotStatus(statuses);
  }, []);

  const updateSlotStatus = useCallback((ticker, status) => {
    setSlotStatus((prev) => ({ ...prev, [ticker]: status }));
  }, []);

  const onCompareSuccess = useCallback((tickers) => {
    updateUrl(tickers);
    persistState(slots, activeSection, tableViewMode);
  }, [slots, activeSection, tableViewMode, updateUrl, persistState]);

  return {
    slots,
    setSlots,
    activeSection,
    setActiveSection,
    tableViewMode,
    setTableViewMode,
    slotStatus,
    setSlotStatuses,
    updateSlotStatus,
    updateSlot,
    onCompareSuccess,
    shouldAutoRun: (shouldAutoRunFromSeed || shouldAutoRunFromUrl) && !autoRanRef.current,
    autoRunTickers: (seedSlots || urlSlots || []).map((s) => s.ticker),
    markAutoRan: () => { autoRanRef.current = true; },
  };
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
