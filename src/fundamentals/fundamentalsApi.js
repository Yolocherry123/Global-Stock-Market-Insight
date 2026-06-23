/**
 * Fetch fundamentals for one ticker. Uses the single-company endpoint when
 * available; falls back to POST /fundamentals/compare on older deployments.
 */
export async function fetchFundamentalTicker(apiBase, ticker) {
  const encoded = encodeURIComponent(ticker);
  const singleRes = await fetch(`${apiBase}/fundamentals/company/${encoded}`);

  if (singleRes.ok) {
    return singleRes.json();
  }

  if (singleRes.status === 404) {
    return fetchViaBatchCompare(apiBase, ticker);
  }

  const body = await singleRes.json().catch(() => ({}));
  throw new Error(normalizeApiError(body.detail, singleRes.status));
}

async function fetchViaBatchCompare(apiBase, tickersOrOne) {
  const tickers = Array.isArray(tickersOrOne) ? tickersOrOne : [tickersOrOne];
  const res = await fetch(`${apiBase}/fundamentals/compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tickers }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(normalizeApiError(body.detail, res.status));
  }

  const data = await res.json();
  const results = data.results || [];

  if (tickers.length === 1) {
    const ticker = tickers[0];
    const bare = ticker.replace(/\.(NS|BO)$/i, '').toUpperCase();
    const match = results.find(
      (r) => (r.ticker || '').toUpperCase() === ticker.toUpperCase()
        || (r.screener_symbol || '').toUpperCase() === bare,
    );
    if (match) return match;
    if (results[0]) return results[0];
    return {
      ticker,
      screener_symbol: bare,
      exchange_id: null,
      data: null,
      error: 'No data returned from server',
    };
  }

  return results;
}

export async function fetchFundamentalTickers(apiBase, tickers, { onResult, onStatus, sleepMs = 1200 }) {
  if (!tickers.length) return [];

  const probeRes = await fetch(`${apiBase}/fundamentals/company/${encodeURIComponent(tickers[0])}`);

  if (probeRes.status === 404) {
    tickers.forEach((t) => onStatus?.(t, 'loading'));
    try {
      const results = await fetchViaBatchCompare(apiBase, tickers);
      const list = Array.isArray(results) ? results : [results];
      const acc = [];
      list.forEach((result) => {
        acc.push(result);
        onStatus?.(result.ticker, result.error ? 'error' : 'done');
        onResult?.(result, [...acc]);
      });
      return list;
    } catch (err) {
      tickers.forEach((t) => onStatus?.(t, 'error'));
      throw err;
    }
  }

  const collected = [];
  const startIdx = 0;

  for (let i = startIdx; i < tickers.length; i++) {
    const ticker = tickers[i];
    onStatus?.(ticker, 'loading');
    try {
      let result;
      if (i === 0 && probeRes.ok) {
        result = await probeRes.json();
      } else {
        result = await fetchFundamentalTicker(apiBase, ticker);
      }
      collected.push(result);
      onResult?.(result, [...collected]);
      onStatus?.(ticker, result.error ? 'error' : 'done');
    } catch (err) {
      const fail = {
        ticker,
        screener_symbol: ticker.replace(/\.(NS|BO)$/i, ''),
        exchange_id: null,
        data: null,
        error: err.message,
      };
      collected.push(fail);
      onResult?.(fail, [...collected]);
      onStatus?.(ticker, 'error');
    }
    if (i < tickers.length - 1) {
      await new Promise((r) => setTimeout(r, sleepMs));
    }
  }
  return collected;
}

export async function fetchFundamentalsSummary(apiBase, tickers) {
  const res = await fetch(`${apiBase}/fundamentals/summary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tickers }),
  });

  if (res.status === 404) {
    return buildClientSummaryFallback(tickers);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(normalizeApiError(body.detail, res.status));
  }

  return res.json();
}

function normalizeApiError(detail, status) {
  if (typeof detail === 'string' && detail && detail !== 'Not Found') return detail;
  if (status === 404) {
    return 'Fundamentals API not available. Restart the backend server to enable the latest endpoints.';
  }
  return detail || 'Failed to fetch fundamentals';
}

function buildClientSummaryFallback(tickers) {
  return {
    summary: `Compared ${tickers.join(', ')}. AI summary requires a server with the /fundamentals/summary endpoint and GEMINI_API_KEY.`,
    highlights: tickers.map((t) => `Review ${t} ratios and growth on the Overview tab.`),
    risks: ['AI summary endpoint not deployed on this server yet.'],
    source: 'fallback',
  };
}
