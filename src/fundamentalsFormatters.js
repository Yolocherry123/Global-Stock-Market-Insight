export function formatLargeNumber(val) {
  if (val == null || Number.isNaN(val)) return 'N/A';
  if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
  if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
  return `$${val.toLocaleString()}`;
}

export function formatRatio(val, suffix = '') {
  if (val == null || Number.isNaN(val)) return 'N/A';
  return `${Number(val).toFixed(2)}${suffix}`;
}

export function formatPercent(val) {
  if (val == null || Number.isNaN(val)) return 'N/A';
  return `${(Number(val) * 100).toFixed(2)}%`;
}

export const FUNDAMENTAL_METRICS = [
  { key: 'marketCap', label: 'Market Cap', format: formatLargeNumber, higherIsBetter: true },
  { key: 'trailingPE', label: 'Trailing P/E', format: formatRatio, higherIsBetter: false },
  { key: 'forwardPE', label: 'Forward P/E', format: formatRatio, higherIsBetter: false },
  { key: 'pegRatio', label: 'PEG Ratio', format: formatRatio, higherIsBetter: false },
  { key: 'priceToBook', label: 'Price/Book', format: formatRatio, higherIsBetter: false },
  { key: 'debtToEquity', label: 'Debt/Equity', format: formatRatio, higherIsBetter: false },
  { key: 'ebitda', label: 'EBITDA', format: formatLargeNumber, higherIsBetter: true },
  { key: 'profitMargins', label: 'Profit Margin', format: formatPercent, higherIsBetter: true },
  { key: 'returnOnEquity', label: 'ROE', format: formatPercent, higherIsBetter: true },
  { key: 'dividendYield', label: 'Dividend Yield', format: formatPercent, higherIsBetter: true },
  { key: 'fullTimeEmployees', label: 'Employees', format: (val) => (val ? val.toLocaleString() : 'N/A'), higherIsBetter: null },
];

export function getFundamentalItems(info) {
  if (!info) return [];
  return FUNDAMENTAL_METRICS.map((metric) => ({
    label: metric.label,
    value: metric.format(info[metric.key]),
  }));
}

export function getBestWorstIndices(values, higherIsBetter) {
  if (higherIsBetter == null) return { best: -1, worst: -1 };
  const numeric = values.map((v) => (v == null || Number.isNaN(v) ? null : Number(v)));
  const valid = numeric.filter((v) => v != null);
  if (valid.length < 2) return { best: -1, worst: -1 };

  const target = higherIsBetter ? Math.max(...valid) : Math.min(...valid);
  const opposite = higherIsBetter ? Math.min(...valid) : Math.max(...valid);
  if (target === opposite) return { best: -1, worst: -1 };

  return {
    best: numeric.indexOf(target),
    worst: numeric.indexOf(opposite),
  };
}

// --- Screener.in helpers ---

export const SCREENER_KEY_RATIOS = [
  'Market Cap',
  'Current Price',
  'Stock P/E',
  'Book Value',
  'Dividend Yield',
  'ROCE',
  'ROE',
  'Debt to equity',
  'Face Value',
];

/** Formula / definition text keyed by normalized ratio name */
export const RATIO_FORMULAS = {
  'market cap': 'Market Cap = Current Share Price × Total Shares Outstanding',
  'current price': 'Current Price = Latest traded market price per share',
  'stock p/e': 'P/E Ratio = Current Share Price ÷ Earnings Per Share (EPS)',
  'p/e': 'P/E Ratio = Share Price ÷ Earnings Per Share (EPS)',
  'price to earning': 'P/E Ratio = Share Price ÷ Earnings Per Share (EPS)',
  'trailing p/e': 'Trailing P/E = Current Price ÷ EPS (last 12 months)',
  'forward p/e': 'Forward P/E = Current Price ÷ Expected EPS (next 12 months)',
  'book value': 'Book Value per Share = (Total Assets − Total Liabilities) ÷ Shares Outstanding',
  'price to book': 'P/B Ratio = Market Price per Share ÷ Book Value per Share',
  'dividend yield': 'Dividend Yield = (Annual Dividend per Share ÷ Share Price) × 100',
  roce: 'ROCE = (EBIT ÷ Capital Employed) × 100, where Capital Employed = Total Assets − Current Liabilities',
  'roe %': 'ROE = (Net Profit ÷ Shareholders\' Equity) × 100',
  roe: 'ROE = (Net Profit ÷ Shareholders\' Equity) × 100',
  'return on equity': 'ROE = (Net Profit ÷ Shareholders\' Equity) × 100',
  'debt to equity': 'Debt to Equity = Total Debt ÷ Shareholders\' Equity',
  'debt / equity': 'Debt / Equity = Total Borrowings ÷ Shareholders\' Equity',
  'face value': 'Face Value = Nominal/par value printed on the share certificate',
  'current ratio': 'Current Ratio = Current Assets ÷ Current Liabilities',
  'quick ratio': 'Quick Ratio = (Current Assets − Inventory) ÷ Current Liabilities',
  'interest coverage': 'Interest Coverage = EBIT ÷ Interest Expense',
  'asset turnover': 'Asset Turnover = Revenue ÷ Average Total Assets',
  'inventory turnover': 'Inventory Turnover = Cost of Goods Sold ÷ Average Inventory',
  'days receivable': 'Days Receivable = (Average Receivables ÷ Revenue) × 365',
  'opm %': 'Operating Profit Margin = (Operating Profit ÷ Revenue) × 100',
  'npm %': 'Net Profit Margin = (Net Profit ÷ Revenue) × 100',
  'gross margin %': 'Gross Margin = (Gross Profit ÷ Revenue) × 100',
  'ebitda margin %': 'EBITDA Margin = (EBITDA ÷ Revenue) × 100',
  'eps in rs': 'EPS = Net Profit Attributable to Equity Holders ÷ Weighted Average Shares',
  'eps': 'EPS = Net Profit ÷ Number of Shares Outstanding',
  'peg ratio': 'PEG Ratio = P/E Ratio ÷ Earnings Growth Rate (%)',
  'dividend payout %': 'Dividend Payout = (Dividends Paid ÷ Net Profit) × 100',
  'return on assets %': 'ROA = (Net Profit ÷ Average Total Assets) × 100',
  'roce %': 'ROCE = (EBIT ÷ Capital Employed) × 100',
  'debt to asset': 'Debt to Assets = Total Debt ÷ Total Assets',
  'enterprise value': 'EV = Market Cap + Total Debt − Cash & Equivalents',
  'ev/ebitda': 'EV/EBITDA = Enterprise Value ÷ EBITDA',
  'price to sales': 'P/S Ratio = Market Cap ÷ Annual Revenue',
  'promoter holding': 'Promoter Holding = % of shares held by promoters/founders',
  'fii holding': 'FII Holding = % of shares held by foreign institutional investors',
  'dii holding': 'DII Holding = % of shares held by domestic institutional investors',
};

export function getRatioFormula(name) {
  if (!name) return null;
  const lower = String(name).toLowerCase().trim();
  if (RATIO_FORMULAS[lower]) return RATIO_FORMULAS[lower];

  const normalized = lower.replace(/\s+/g, ' ');
  for (const [key, formula] of Object.entries(RATIO_FORMULAS)) {
    if (normalized === key || normalized.includes(key) || key.includes(normalized)) {
      return formula;
    }
  }
  return null;
}

export const SECTION_KEYS = [
  { id: 'overview', label: 'Overview' },
  { id: 'quarterly', label: 'Quarterly', dataKey: 'quarterly' },
  { id: 'profitLoss', label: 'P&L', dataKey: 'profitLoss' },
  { id: 'balanceSheet', label: 'Balance Sheet', dataKey: 'balanceSheet' },
  { id: 'cashFlow', label: 'Cash Flow', dataKey: 'cashFlow' },
  { id: 'ratiosTable', label: 'Ratios', dataKey: 'ratiosTable' },
  { id: 'shareholding', label: 'Shareholding', dataKey: 'shareholding' },
  { id: 'compare', label: 'Compare' },
];

export const FINANCIAL_SECTIONS = SECTION_KEYS.filter((s) => s.dataKey);

export const SCREENER_RATIO_DIRECTIONS = {
  'Market Cap': null,
  'Current Price': null,
  'Stock P/E': false,
  'Book Value': null,
  'Dividend Yield': true,
  ROCE: true,
  ROE: true,
  'Debt to equity': false,
  'Face Value': null,
};

export const DERIVED_METRIC_LABELS = ['Sales', 'Revenue', 'Net Profit', 'Operating Profit', 'OPM %', 'NPM %'];

export const TREND_METRIC_PRESETS = [
  'Sales',
  'Revenue',
  'Net Profit',
  'Operating Profit',
  'OPM %',
  'EPS in Rs',
  'Total Debt',
];

export const COMPARE_PRESETS = {
  profitability: {
    label: 'Profitability',
    metrics: ['Sales', 'Revenue', 'Operating Profit', 'Net Profit', 'OPM %', 'NPM %', 'EBITDA'],
  },
  leverage: {
    label: 'Leverage',
    metrics: ['Borrowings', 'Total Debt', 'Debt / Equity', 'Debt to equity', 'Interest Coverage'],
  },
  returns: {
    label: 'Returns',
    metrics: ['ROE %', 'ROCE %', 'ROE', 'ROCE', 'Return on Assets %'],
  },
  ratios: {
    label: 'Key ratios',
    metrics: [
      'ROE %', 'ROCE %', 'Debt / Equity', 'Current Ratio', 'Quick Ratio',
      'Interest Coverage', 'Asset Turnover', 'Inventory Turnover', 'Days Receivable',
    ],
  },
  margins: {
    label: 'Margins',
    metrics: ['OPM %', 'NPM %', 'Gross Margin %', 'EBITDA Margin %'],
  },
  perShare: {
    label: 'Per share',
    metrics: ['EPS in Rs', 'Book Value', 'Dividend Payout %', 'Face Value'],
  },
  cashFlow: {
    label: 'Cash flow',
    metrics: ['Cash from Operating Activity', 'Cash from Investing Activity', 'Cash from Financing Activity', 'Net Cash Flow'],
  },
};

export const RATIO_TABLE_PRIORITY = [
  'ROE %', 'ROCE %', 'Debt / Equity', 'Current Ratio', 'Interest Coverage',
  'Asset Turnover', 'Inventory Turnover', 'OPM %', 'NPM %', 'EPS in Rs',
];

export const COMPANY_COLORS = [
  '#00e5ff',
  '#a78bfa',
  '#fbbf24',
  '#34d399',
  '#f472b6',
  '#60a5fa',
  '#fb923c',
  '#2dd4bf',
];

export function formatIndianNumber(val) {
  if (val == null || val === '') return '—';
  if (typeof val === 'string') {
    if (val.includes('%') || val.includes('Cr') || val.includes('₹')) return val;
    const parsed = Number(val.replace(/,/g, ''));
    if (!Number.isNaN(parsed)) return parsed.toLocaleString('en-IN');
    return val;
  }
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return val.toLocaleString('en-IN');
    return val.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }
  return String(val);
}

export function parseScreenerRatio(ratios, key) {
  if (!ratios) return null;
  if (ratios[key] != null) return ratios[key];
  const lower = key.toLowerCase();
  const found = Object.keys(ratios).find((k) => k.toLowerCase() === lower);
  return found ? ratios[found] : null;
}

export function flattenRows(rows, depth = 0, prefix = '') {
  if (!rows) return [];
  const out = [];
  for (const row of rows) {
    const label = prefix ? `${prefix} › ${row.label}` : row.label;
    out.push({ label, rowLabel: row.label, depth, row });
    if (row.children?.length) {
      out.push(...flattenRows(row.children, depth + 1, label));
    }
  }
  return out;
}

export function getRowValue(row, period) {
  if (!row?.values) return null;
  return row.values[period] ?? null;
}

export function findRowByPath(rows, path) {
  if (!rows || !path) return null;
  const parts = path.split(' › ');
  let current = rows;
  let node = null;
  for (const part of parts) {
    node = (current || []).find((r) => r.label === part);
    if (!node) return null;
    current = node.children;
  }
  return node;
}

export function buildOrderedPaths(results, dataKey) {
  const valid = results.filter((r) => !r.error && r.data?.[dataKey]?.rows);
  if (!valid.length) return [];

  const ordered = [];
  const seen = new Set();

  const addPath = (path, rowLabel, depth, expandable) => {
    if (seen.has(path)) return;
    seen.add(path);
    ordered.push({ path, rowLabel, depth, expandable });
  };

  const walk = (rows, prefix, depth) => {
    for (const row of rows || []) {
      const path = prefix ? `${prefix} › ${row.label}` : row.label;
      addPath(path, row.label, depth, !!(row.children?.length));
      walk(row.children, path, depth + 1);
    }
  };

  walk(valid[0].data[dataKey].rows, '', 0);
  valid.slice(1).forEach((r) => {
    flattenRows(r.data[dataKey].rows).forEach((f) => {
      addPath(f.label, f.rowLabel, f.depth, !!(f.row.children?.length));
    });
  });
  return ordered;
}

export function getPathCoverage(companies, path) {
  const present = [];
  const missing = [];
  for (const company of companies) {
    const row = findRowByPath(company.rows, path);
    if (row) present.push(company.symbol);
    else missing.push(company.symbol);
  }
  return { present, missing, complete: missing.length === 0 };
}

export function analyzeSectionCoverage(results, dataKey) {
  const valid = results.filter((r) => !r.error && r.data?.[dataKey]?.rows);
  if (valid.length < 2) return { paths: [], partialCount: 0, companyOnlyRows: {} };

  const companies = valid.map((r) => ({
    symbol: r.screener_symbol || r.data.symbol,
    rows: r.data[dataKey].rows,
  }));

  const paths = buildOrderedPaths(valid, dataKey);
  const partial = [];
  const companyOnlyRows = Object.fromEntries(companies.map((c) => [c.symbol, []]));

  for (const { path, rowLabel } of paths) {
    const { missing, complete } = getPathCoverage(companies, path);
    if (!complete) {
      partial.push({ path, rowLabel, missing });
    }
    for (const company of companies) {
      const row = findRowByPath(company.rows, path);
      const othersHave = companies.some(
        (other) => other.symbol !== company.symbol && findRowByPath(other.rows, path),
      );
      if (row && !othersHave) {
        companyOnlyRows[company.symbol].push(rowLabel);
      }
    }
  }

  return {
    paths,
    partialCount: partial.length,
    partial,
    companyOnlyRows,
    totalPaths: paths.length,
    companyCount: companies.length,
  };
}

export function parentPath(path) {
  const parts = path.split(' › ');
  if (parts.length <= 1) return null;
  return parts.slice(0, -1).join(' › ');
}

export function isPathVisible(path, depth, expanded) {
  if (depth === 0) return true;
  let current = path;
  while (parentPath(current)) {
    current = parentPath(current);
    if (expanded[current] === false) return false;
  }
  return true;
}

export function findRowByLabel(rows, label) {
  const flat = flattenRows(rows);
  const exact = flat.find((f) => f.rowLabel === label || f.label === label);
  return exact?.row ?? null;
}

export function buildCompanyComparison(results, sectionKey, metricLabel, period) {
  const dataKey = SECTION_KEYS.find((s) => s.dataKey === sectionKey)?.dataKey || sectionKey;
  return results
    .filter((r) => !r.error && r.data)
    .map((r) => {
      const section = r.data[dataKey];
      const flat = flattenRows(section?.rows || []);
      const match = flat.find((f) => f.label === metricLabel || f.rowLabel === metricLabel);
      const value = match ? getRowValue(match.row, period) : null;
      return {
        ticker: r.ticker,
        screenerSymbol: r.screener_symbol,
        name: r.data.name,
        value,
      };
    });
}

export function buildTrendComparisonTable(results, sectionKey, metricLabel, maxPoints = 12) {
  const valid = results.filter((r) => !r.error && r.data);
  const periods = collectPeriods(valid, sectionKey);
  const sliced = maxPoints ? periods.slice(-maxPoints) : periods;

  const rows = valid.map((r) => {
    const section = r.data[sectionKey];
    const flat = flattenRows(section?.rows || []);
    const match = flat.find((f) => f.label === metricLabel || f.rowLabel === metricLabel);
    const values = {};
    sliced.forEach((p) => {
      values[p] = match ? getRowValue(match.row, p) : null;
    });
    const first = parseNumericValue(values[sliced[0]]);
    const last = parseNumericValue(values[sliced[sliced.length - 1]]);
    let changePct = null;
    if (first != null && last != null && first !== 0) {
      changePct = ((last - first) / Math.abs(first)) * 100;
    }
    return {
      ticker: r.ticker,
      symbol: r.screener_symbol || r.data.symbol,
      name: r.data.name,
      values,
      changePct,
    };
  });

  return { periods: sliced, rows };
}

export function buildHeaderRatiosComparison(results) {
  const valid = results.filter((r) => !r.error && r.data?.ratios);
  const keySet = new Set();
  valid.forEach((r) => Object.keys(r.data.ratios || {}).forEach((k) => keySet.add(k)));

  const ordered = [
    ...SCREENER_KEY_RATIOS.filter((k) => keySet.has(k)),
    ...[...keySet].filter((k) => !SCREENER_KEY_RATIOS.includes(k)).sort(),
  ];

  return ordered.map((key) => ({
    key,
    direction: getRatioDirection(key),
    companies: valid.map((r) => ({
      ticker: r.ticker,
      symbol: r.screener_symbol || r.data.symbol,
      name: r.data.name,
      value: parseScreenerRatio(r.data.ratios, key),
      numeric: parseRatioNumeric(r.data.ratios, key),
    })),
  })).filter((row) => row.companies.some((c) => c.value != null));
}

export function mergeCompareMetrics(collected, sectionKey) {
  const priority = sectionKey === 'ratiosTable' ? RATIO_TABLE_PRIORITY : TREND_METRIC_PRESETS;
  const merged = [];
  const seen = new Set();

  const add = (m) => {
    if (!m || seen.has(m.label)) return;
    seen.add(m.label);
    merged.push(m);
  };

  priority.forEach((rowLabel) => {
    const topLevel = collected.find((m) => m.rowLabel === rowLabel && !m.label.includes('›'));
    if (topLevel) add(topLevel);
    else {
      const match = collected.find((m) => m.rowLabel === rowLabel || m.label === rowLabel);
      if (match) add(match);
    }
  });

  collected.forEach((m) => add(m));
  return merged;
}

export function getAllCompareMetricOptions(results, dataKey) {
  const paths = buildOrderedPaths(results, dataKey);
  if (!paths.length) {
    return collectMetrics(results, dataKey).map((m) => ({ ...m, depth: 0 }));
  }
  return paths.map(({ path, rowLabel, depth }) => ({
    label: path,
    rowLabel,
    depth,
  }));
}

function parsePeriodSortKey(period) {
  const s = String(period).trim();
  const fyMatch = s.match(/FY\s*(\d{4})/i);
  if (fyMatch) return { year: Number(fyMatch[1]), month: 3 };
  const monthMatch = s.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/i);
  if (monthMatch) {
    const months = {
      jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
      jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
    };
    return { year: Number(monthMatch[2]), month: months[monthMatch[1].toLowerCase()] || 0 };
  }
  if (/^\d{4}$/.test(s)) return { year: Number(s), month: 6 };
  return { year: 0, month: 0, raw: s };
}

export function sortPeriods(periods) {
  return [...periods].sort((a, b) => {
    const ka = parsePeriodSortKey(a);
    const kb = parsePeriodSortKey(b);
    if (ka.year !== kb.year) return ka.year - kb.year;
    if (ka.month !== kb.month) return ka.month - kb.month;
    return String(a).localeCompare(String(b));
  });
}

export function collectPeriods(results, dataKey) {
  const periods = new Set();
  for (const r of results) {
    if (r.error || !r.data?.[dataKey]?.periods) continue;
    r.data[dataKey].periods.forEach((p) => periods.add(p));
  }
  return sortPeriods(Array.from(periods));
}

export function formatMetricDisplayName(label) {
  if (!label) return '';
  if (label.includes(' › ')) return label.split(' › ').pop();
  return label;
}

export function collectMetrics(results, dataKey) {
  const metrics = new Map();
  for (const r of results) {
    if (r.error || !r.data?.[dataKey]?.rows) continue;
    flattenRows(r.data[dataKey].rows).forEach((f) => {
      if (!metrics.has(f.label)) metrics.set(f.label, f.rowLabel);
    });
  }
  return Array.from(metrics.entries()).map(([label, rowLabel]) => ({ label, rowLabel }));
}

export function screenerUrl(symbol) {
  return `https://www.screener.in/company/${symbol}/consolidated/`;
}

export function parseNumericValue(val) {
  if (val == null || val === '' || val === '—') return null;
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  let s = String(val).trim();
  if (!s || s === 'N/A' || s === '-') return null;
  const isPercent = s.includes('%');
  s = s.replace(/₹|,/g, '').replace(/\s*Cr\.?/gi, '').replace(/%/g, '').trim();
  const parsed = Number(s);
  if (Number.isNaN(parsed)) return null;
  return isPercent ? parsed : parsed;
}

export function getRatioDirection(ratioKey) {
  if (SCREENER_RATIO_DIRECTIONS[ratioKey] != null) return SCREENER_RATIO_DIRECTIONS[ratioKey];
  const lower = ratioKey.toLowerCase();
  if (lower.includes('p/e') || lower.includes('debt') || lower.includes('peg')) return false;
  if (lower.includes('roe') || lower.includes('roce') || lower.includes('yield') || lower.includes('margin')) return true;
  return null;
}

export function parseRatioNumeric(ratios, key) {
  const raw = parseScreenerRatio(ratios, key);
  return parseNumericValue(raw);
}

export function getCatalogTickers(catalog, exchangeId = null) {
  const out = [];
  for (const ex of catalog || []) {
    if (exchangeId && ex.id !== exchangeId) continue;
    for (const ticker of ex.tickers || []) {
      const bare = ticker.replace(/\.(NS|BO)$/i, '');
      const exLabel = ex.id === 'nse' ? 'NSE' : ex.id === 'bse' ? 'BSE' : ex.name;
      out.push({
        ticker: bare,
        fullTicker: ticker,
        exchangeId: ex.id,
        exchangeName: ex.name,
        exchangeLabel: exLabel,
        search: `${bare} ${ex.name} ${exLabel}`.toLowerCase(),
      });
    }
  }
  return out.sort((a, b) => a.ticker.localeCompare(b.ticker));
}

export function buildTickerSuggestions(catalog, exchangeId = null) {
  return getCatalogTickers(catalog, exchangeId);
}

export function exportTableToCsv(filename, headers, rows) {
  const escape = (cell) => {
    const s = cell == null ? '' : String(cell);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = [
    headers.map(escape).join(','),
    ...rows.map((row) => row.map(escape).join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function periodToChartTime(period, index = 0) {
  if (!period) return null;
  const s = String(period).trim();
  const fyMatch = s.match(/FY\s*(\d{4})/i);
  if (fyMatch) return `${fyMatch[1]}-03-31`;
  const monthMatch = s.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/i);
  if (monthMatch) {
    const months = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
    const m = months[monthMatch[1].toLowerCase()];
    return `${monthMatch[2]}-${m}-28`;
  }
  const year = new Date().getFullYear();
  if (/^\d{4}$/.test(s)) return `${s}-06-30`;
  return `${year}-${String(index + 1).padStart(2, '0')}-15`;
}

export function buildTrendSeries(results, dataKey, metricLabel, maxPoints = null) {
  const valid = results.filter((r) => !r.error && r.data?.[dataKey]?.rows);
  const periods = collectPeriods(valid, dataKey);
  const sliced = maxPoints ? periods.slice(-maxPoints) : periods;

  return valid.map((r, idx) => {
    const section = r.data[dataKey];
    const flat = flattenRows(section?.rows || []);
    const match = flat.find((f) => f.label === metricLabel || f.rowLabel === metricLabel);
    const points = sliced
      .map((period, pIdx) => {
        const raw = match ? getRowValue(match.row, period) : null;
        const value = parseNumericValue(raw);
        const time = periodToChartTime(period, pIdx);
        if (value == null || !time) return null;
        return { time, value };
      })
      .filter(Boolean);
    return {
      id: r.ticker,
      label: r.screener_symbol || r.data.symbol,
      color: COMPANY_COLORS[idx % COMPANY_COLORS.length],
      points,
    };
  }).filter((s) => s.points.length > 0);
}

export function buildMultiMetricTrendCharts(results, dataKey, metricLabels, maxPoints = null) {
  const labels = (metricLabels || []).filter(Boolean);
  return labels.map((metricLabel) => ({
    metricLabel,
    series: buildTrendSeries(results, dataKey, metricLabel, maxPoints),
  })).filter((entry) => entry.series.length > 0);
}

export function normalizeTrendPointsToIndex(points) {
  if (!points?.length) return [];
  const base = points[0].value;
  if (base == null || base === 0) return points.filter((p) => p.value != null);
  return points
    .filter((p) => p.value != null)
    .map((p) => ({
      time: p.time,
      value: (p.value / base) * 100,
    }));
}

export function buildCombinedMultiMetricTrendSeries(
  results,
  dataKey,
  metricLabels,
  maxPoints = null,
  { normalize = true } = {},
) {
  const charts = buildMultiMetricTrendCharts(results, dataKey, metricLabels, maxPoints);
  const combined = [];

  charts.forEach(({ metricLabel, series }, metricIdx) => {
    series.forEach((s) => {
      const points = normalize ? normalizeTrendPointsToIndex(s.points) : s.points;
      if (!points.length) return;
      combined.push({
        id: `${s.id}-${metricLabel}`,
        label: `${s.label} · ${metricLabel}`,
        color: s.color,
        metricLabel,
        ticker: s.id,
        lineStyle: metricIdx % 4,
        points,
      });
    });
  });

  return combined;
}

export function computeDerivedGrowth(section, rowLabels = DERIVED_METRIC_LABELS) {
  if (!section?.rows?.length || !section.periods?.length) return [];
  const derived = [];
  const periods = section.periods;

  for (const targetLabel of rowLabels) {
    const row = findRowByLabel(section.rows, targetLabel);
    if (!row?.values) continue;

    for (let i = 1; i < periods.length; i++) {
      const prev = parseNumericValue(row.values[periods[i - 1]]);
      const curr = parseNumericValue(row.values[periods[i]]);
      if (prev == null || curr == null || prev === 0) continue;
      const pct = ((curr - prev) / Math.abs(prev)) * 100;
      if (!derived.find((d) => d.label === `${targetLabel} YoY %`)) {
        derived.push({
          label: `${targetLabel} YoY %`,
          parentLabel: targetLabel,
          values: {},
          isDerived: true,
        });
      }
      const entry = derived.find((d) => d.label === `${targetLabel} YoY %`);
      entry.values[periods[i]] = `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
    }
  }
  return derived;
}

export function rankComparison(comparison, higherIsBetter = true) {
  const parsed = comparison.map((row, idx) => ({
    ...row,
    idx,
    numeric: parseNumericValue(row.value),
  }));
  const valid = parsed.filter((r) => r.numeric != null);
  if (valid.length < 2) return parsed.map((r) => ({ ...r, rank: null }));

  const sorted = [...valid].sort((a, b) => (higherIsBetter ? b.numeric - a.numeric : a.numeric - b.numeric));
  const rankMap = new Map();
  sorted.forEach((r, i) => rankMap.set(r.idx, i + 1));
  return parsed.map((r) => ({ ...r, rank: rankMap.get(r.idx) ?? null }));
}
