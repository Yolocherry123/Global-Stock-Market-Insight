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
