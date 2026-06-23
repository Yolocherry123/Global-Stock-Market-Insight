import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { buildTickerSuggestions } from '../fundamentalsFormatters';

export default function TickerAutocomplete({
  catalog,
  value,
  onChange,
  exchangeId,
  inputStyle,
}) {
  const [query, setQuery] = useState(value || '');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef(null);

  const suggestions = useMemo(
    () => buildTickerSuggestions(catalog, exchangeId),
    [catalog, exchangeId],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return suggestions.slice(0, 25);
    return suggestions
      .filter((s) => s.search.includes(q) || s.ticker.toLowerCase().startsWith(q))
      .slice(0, 25);
  }, [suggestions, query]);

  const queryTrimmed = query.trim().toUpperCase();
  const showFreeTextHint = open && queryTrimmed
    && !filtered.some((s) => s.ticker === queryTrimmed);

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const pick = (item) => {
    setQuery(item.ticker);
    onChange(item.ticker);
    setOpen(false);
  };

  const commitFreeText = () => {
    if (queryTrimmed) {
      onChange(queryTrimmed);
      setOpen(false);
    }
  };

  const onKeyDown = (e) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && filtered[highlight]) pick(filtered[highlight]);
      else commitFreeText();
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="fund-ticker-search">
      <Search size={12} className="fund-ticker-search-icon" />
      <input
        type="text"
        className="backtest-input fund-ticker-input"
        placeholder="Type or search symbol…"
        value={query}
        onChange={(e) => {
          const v = e.target.value.toUpperCase();
          setQuery(v);
          onChange(v);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        style={inputStyle}
        autoComplete="off"
        spellCheck={false}
      />
      {open && (
        <ul className="fund-autocomplete-list">
          {filtered.length > 0 ? (
            filtered.map((item, idx) => (
              <li
                key={`${item.ticker}-${item.exchangeId}-${idx}`}
                className={idx === highlight ? 'active' : ''}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(item);
                }}
              >
                <span className="mono">{item.ticker}</span>
                <span className="fund-exchange-badge">{item.exchangeLabel}</span>
              </li>
            ))
          ) : (
            <li className="fund-autocomplete-hint">
              No catalog matches for this exchange
            </li>
          )}
          {showFreeTextHint && (
            <li
              className="fund-autocomplete-free"
              onMouseDown={(e) => {
                e.preventDefault();
                commitFreeText();
              }}
            >
              Use <span className="mono">{queryTrimmed}</span> (not in catalog)
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
