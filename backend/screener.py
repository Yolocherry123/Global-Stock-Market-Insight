import datetime
import re
import time
import yfinance as yf

SCREENER_CACHE = {}
CACHE_TTL_SECONDS = 300


def _cache_get(cache_key):
    entry = SCREENER_CACHE.get(cache_key)
    if not entry:
        return None
    cached_at, data = entry
    if time.time() - cached_at > CACHE_TTL_SECONDS:
        SCREENER_CACHE.pop(cache_key, None)
        return None
    return data


def _cache_set(cache_key, data):
    SCREENER_CACHE[cache_key] = (time.time(), data)


def _safe_float(value, default=0.0):
    try:
        if value is None:
            return default
        val = float(value)
        if val != val:
            return default
        return val
    except (TypeError, ValueError):
        return default


def _is_real_stock(symbol, quote):
    if not symbol:
        return False

    # 1. Check for US tickers with hyphens
    if "-" in symbol:
        parts = symbol.split("-")
        suffix = parts[-1].upper()
        # Common share classes like BRK-A, BRK-B, BF-B are real stocks.
        if suffix in ("A", "B", "C", "K"):
            return True

        # If the suffix is a warrant, right, unit, or preferred, filter it out
        if (
            suffix in ("WT", "WS", "RW", "RI", "U", "UN", "W", "R")
            or suffix.startswith("P")
            or any(w in suffix for w in ("WT", "WS", "RW", "RI"))
        ):
            return False

        # Also, if marketCap is missing or None, it's highly likely a non-equity instrument
        market_cap = quote.get("marketCap")
        if market_cap is None or market_cap == 0:
            return False

    # 2. Check quote fields if available
    long_name = (quote.get("longName") or "").lower()
    short_name = (quote.get("shortName") or "").lower()
    combined_name = f"{long_name} {short_name}"

    for word in ("warrant", "right", "preferred", "unit"):
        if word in long_name or word in short_name:
            return False

    # ETFs and funds are often tagged as EQUITY by Yahoo; filter by name instead.
    for phrase in (
        "exchange traded fund",
        "mutual fund",
        "index fund",
        "closed-end fund",
        "closed end fund",
    ):
        if phrase in combined_name:
            return False
    if re.search(r"\betf\b", combined_name):
        return False

    quote_type = (quote.get("quoteType") or "").upper()
    if quote_type and quote_type not in ("EQUITY", ""):
        return False

    return True


def _quote_to_candidate(quote, actual_target):
    pct_change = _safe_float(quote.get("regularMarketChangePercent"))
    close = _safe_float(quote.get("regularMarketPrice"))
    open_price = _safe_float(quote.get("regularMarketOpen"), close)
    high = _safe_float(quote.get("regularMarketDayHigh"), close)
    low = _safe_float(quote.get("regularMarketDayLow"), close)
    volume = int(_safe_float(quote.get("regularMarketVolume"), 0))

    return {
        "ticker": quote.get("symbol", ""),
        "pct_change": pct_change,
        "abs_change": abs(pct_change),
        "open": open_price,
        "close": close,
        "high": high,
        "low": low,
        "volume": volume,
        "prev_close": close / (1 + pct_change / 100) if pct_change != -100 else close,
        "actual_date": actual_target,
    }


def _matches_suffix(symbol, suffixes):
    if not suffixes:
        return True
    return any(symbol.endswith(suffix) for suffix in suffixes)


def _build_screener_query(screener_cfg, direction):
    region = screener_cfg.get("region", "us").lower()
    exchange_codes = screener_cfg.get("exchange_codes", [])
    operands = [yf.EquityQuery("eq", ["region", region])]

    if exchange_codes:
        operands.append(yf.EquityQuery("is-in", ["exchange"] + exchange_codes))

    if direction == "gainers":
        operands.append(yf.EquityQuery("gt", ["percentchange", 0]))
    else:
        operands.append(yf.EquityQuery("lt", ["percentchange", 0]))

    return yf.EquityQuery("and", operands)


def _run_screener(screener_cfg, direction, limit):
    query = _build_screener_query(screener_cfg, direction)
    fetch_size = max(limit * 20, 100)
    response = yf.screen(
        query,
        size=min(fetch_size, 250),
        sortField="percentchange",
        sortAsc=(direction == "losers"),
    )
    return response.get("quotes", []) if response else []


def _fallback_movers(ex, direction, limit, actual_target, reason=""):
    import analyst

    exchange_id = ex.get("id", "unknown")
    print(f"\n⚠️  [FALLBACK TRIGGERED] Exchange '{exchange_id}' ({direction}) is using the hardcoded fallback list. Reason: {reason}\n")

    tickers = ex.get("tickers", [])
    if not tickers:
        return []

    candidates = analyst._fetch_mover_candidates(tickers, actual_target)
    if direction == "gainers":
        return analyst.get_top_gainers(tickers, actual_target, None, limit=limit, candidates=candidates)
    return analyst.get_top_losers(tickers, actual_target, None, limit=limit, candidates=candidates)


def fetch_exchange_screener_movers(ex, direction, limit=5, actual_target=None):
    if direction not in ("gainers", "losers"):
        raise ValueError(f"Invalid direction: {direction}")

    exchange_id = ex.get("id", "unknown")
    cache_key = (exchange_id, direction, limit, str(actual_target))
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    screener_cfg = ex.get("screener")
    if not screener_cfg or actual_target is None:
        reason = "No screener configuration found" if not screener_cfg else "actual_target is None"
        result = _fallback_movers(ex, direction, limit, actual_target, reason=reason)
        _cache_set(cache_key, result)
        return result

    try:
        quotes = _run_screener(screener_cfg, direction, limit)
        suffixes = screener_cfg.get("ticker_suffixes", [])
        candidates = []

        for quote in quotes:
            symbol = quote.get("symbol")
            if not symbol or not _matches_suffix(symbol, suffixes):
                continue
            if not _is_real_stock(symbol, quote):
                continue
            candidates.append(_quote_to_candidate(quote, actual_target))
            if len(candidates) >= limit:
                break

        if len(candidates) < limit and suffixes:
            for quote in quotes:
                symbol = quote.get("symbol")
                if not symbol:
                    continue
                if any(c["ticker"] == symbol for c in candidates):
                    continue
                if not _is_real_stock(symbol, quote):
                    continue
                candidates.append(_quote_to_candidate(quote, actual_target))
                if len(candidates) >= limit:
                    break

        if not candidates:
            candidates = _fallback_movers(ex, direction, limit, actual_target, reason="Screener returned zero matching candidates")

        _cache_set(cache_key, candidates)
        return candidates
    except Exception as exc:
        reason = f"Screener execution threw an exception: {exc}"
        result = _fallback_movers(ex, direction, limit, actual_target, reason=reason)
        _cache_set(cache_key, result)
        return result


def format_overview_mover(candidate):
    if not candidate:
        return None
    return {
        "ticker": candidate["ticker"],
        "price": round(float(candidate["close"]), 2),
        "change_percent": round(float(candidate["pct_change"]), 2),
    }
