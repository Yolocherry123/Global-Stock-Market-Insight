import { useEffect, useRef, useState, useMemo } from 'react';
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  AreaSeries,
  ColorType,
} from 'lightweight-charts';

const CHART_THEME = {
  layout: {
    background: { type: ColorType.Solid, color: 'transparent' },
    textColor: 'rgba(255,255,255,0.55)',
    fontSize: 10,
  },
  grid: {
    vertLines: { color: 'rgba(255,255,255,0.04)' },
    horzLines: { color: 'rgba(255,255,255,0.04)' },
  },
  rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
  timeScale: { borderColor: 'rgba(255,255,255,0.08)', timeVisible: true },
};

function useResizeObserver(containerRef, chartRef) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry || !chartRef.current) return;
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        chartRef.current.applyOptions({ width, height });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [containerRef, chartRef]);
}

function toUnixTimestamp(dateStr, timeStr) {
  if (!dateStr) return Math.floor(Date.now() / 1000);
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour = 0, minute = 0] = (timeStr || '00:00').split(':').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day, hour, minute) / 1000);
}

function chartHeightStyle(height) {
  return typeof height === 'number' ? `${height}px` : height;
}

export function LightweightCandlestickChart({ points, tradingDate, height = 160, interactive = true }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);

  useResizeObserver(containerRef, chartRef);

  useEffect(() => {
    if (!containerRef.current || !points?.length) return undefined;

    const chart = createChart(containerRef.current, {
      ...CHART_THEME,
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight || (typeof height === 'number' ? height : 160),
      handleScroll: interactive,
      handleScale: interactive,
    });
    chartRef.current = chart;

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#00e676',
      downColor: '#ff1744',
      borderUpColor: '#00e676',
      borderDownColor: '#ff1744',
      wickUpColor: '#00e676',
      wickDownColor: '#ff1744',
    });

    const candleData = points.map((p) => ({
      time: toUnixTimestamp(tradingDate, p.time),
      open: p.open,
      high: p.high,
      low: p.low,
      close: p.close,
    }));
    series.setData(candleData);
    chart.timeScale().fitContent();

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [points, tradingDate, height, interactive]);

  if (!points?.length) {
    return <div className="text-muted text-center" style={{ paddingTop: '50px', fontSize: '11px' }}>No intraday data available</div>;
  }

  return <div ref={containerRef} style={{ width: '100%', height: chartHeightStyle(height) }} />;
}

export function LightweightTechnicalChart({ points, height = 160, interactive = true }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);

  useResizeObserver(containerRef, chartRef);

  useEffect(() => {
    if (!containerRef.current || !points?.length) return undefined;

    const chart = createChart(containerRef.current, {
      ...CHART_THEME,
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight || (typeof height === 'number' ? height : 160),
      handleScroll: interactive,
      handleScale: interactive,
    });
    chartRef.current = chart;

    const closeSeries = chart.addSeries(LineSeries, { color: '#00e5ff', lineWidth: 2, title: 'Close' });
    const sma20Series = chart.addSeries(LineSeries, { color: '#ffd54f', lineWidth: 1, title: 'SMA 20' });
    const sma50Series = chart.addSeries(LineSeries, { color: '#7c4dff', lineWidth: 1, title: 'SMA 50' });
    const upperSeries = chart.addSeries(LineSeries, { color: 'rgba(255,255,255,0.25)', lineWidth: 1, title: 'Upper BB' });
    const lowerSeries = chart.addSeries(LineSeries, { color: 'rgba(255,255,255,0.25)', lineWidth: 1, title: 'Lower BB' });

    const closeData = [];
    const sma20Data = [];
    const sma50Data = [];
    const upperData = [];
    const lowerData = [];

    points.forEach((p) => {
      const time = p.date;
      closeData.push({ time, value: p.close });
      if (p.sma20 != null) sma20Data.push({ time, value: p.sma20 });
      if (p.sma50 != null) sma50Data.push({ time, value: p.sma50 });
      if (p.upper_bb != null) upperData.push({ time, value: p.upper_bb });
      if (p.lower_bb != null) lowerData.push({ time, value: p.lower_bb });
    });

    closeSeries.setData(closeData);
    if (sma20Data.length) sma20Series.setData(sma20Data);
    if (sma50Data.length) sma50Series.setData(sma50Data);
    if (upperData.length) upperSeries.setData(upperData);
    if (lowerData.length) lowerSeries.setData(lowerData);
    chart.timeScale().fitContent();

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [points, height, interactive]);

  if (!points?.length) {
    return <div className="text-muted text-center" style={{ paddingTop: '50px', fontSize: '11px' }}>No daily history trend available</div>;
  }

  return <div ref={containerRef} style={{ width: '100%', height: chartHeightStyle(height) }} />;
}

export function LightweightMACDChart({ points, height = 160, interactive = true }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);

  useResizeObserver(containerRef, chartRef);

  useEffect(() => {
    if (!containerRef.current || !points?.length) return undefined;

    const chart = createChart(containerRef.current, {
      ...CHART_THEME,
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight || (typeof height === 'number' ? height : 160),
      handleScroll: interactive,
      handleScale: interactive,
    });
    chartRef.current = chart;

    const histSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'price', precision: 4, minMove: 0.0001 },
    });
    const macdSeries = chart.addSeries(LineSeries, { color: '#00e5ff', lineWidth: 1.5, title: 'MACD' });
    const signalSeries = chart.addSeries(LineSeries, { color: '#ffb300', lineWidth: 1.5, title: 'Signal' });

    const histData = points.map((p) => ({
      time: p.date,
      value: p.hist,
      color: p.hist >= 0 ? 'rgba(0, 230, 118, 0.55)' : 'rgba(255, 23, 68, 0.55)',
    }));
    const macdData = points.map((p) => ({ time: p.date, value: p.macd }));
    const signalData = points.map((p) => ({ time: p.date, value: p.signal }));

    histSeries.setData(histData);
    macdSeries.setData(macdData);
    signalSeries.setData(signalData);
    chart.timeScale().fitContent();

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [points, height, interactive]);

  if (!points?.length) {
    return <div className="text-muted text-center" style={{ paddingTop: '50px', fontSize: '11px' }}>No MACD history trend available</div>;
  }

  return <div ref={containerRef} style={{ width: '100%', height: chartHeightStyle(height) }} />;
}

export function LightweightVolatilityChart({ points, tradingDate, height = 160, interactive = true }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);

  useResizeObserver(containerRef, chartRef);

  useEffect(() => {
    if (!containerRef.current || !points?.length) return undefined;

    const chart = createChart(containerRef.current, {
      ...CHART_THEME,
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight || (typeof height === 'number' ? height : 160),
      handleScroll: interactive,
      handleScale: interactive,
    });
    chartRef.current = chart;

    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor: '#00e5ff',
      topColor: 'rgba(0, 229, 255, 0.25)',
      bottomColor: 'rgba(0, 229, 255, 0)',
      lineWidth: 2,
      title: 'Volatility',
      priceFormat: {
        type: 'custom',
        formatter: (price) => `${price.toFixed(3)}%`,
      },
    });

    const volData = points.map((p) => ({
      time: toUnixTimestamp(tradingDate, p.time),
      value: p.volatility,
    }));
    areaSeries.setData(volData);
    chart.timeScale().fitContent();

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [points, tradingDate, height, interactive]);

  if (!points?.length) {
    return <div className="text-muted text-center" style={{ paddingTop: '50px', fontSize: '11px' }}>No intraday data available</div>;
  }

  return <div ref={containerRef} style={{ width: '100%', height: chartHeightStyle(height) }} />;
}

export function LightweightVolumeChart({ points, height = 160, interactive = true }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);

  useResizeObserver(containerRef, chartRef);

  useEffect(() => {
    if (!containerRef.current || !points?.length) return undefined;

    const chart = createChart(containerRef.current, {
      ...CHART_THEME,
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight || (typeof height === 'number' ? height : 160),
      handleScroll: interactive,
      handleScale: interactive,
    });
    chartRef.current = chart;

    const volSeries = chart.addSeries(HistogramSeries, {
      color: 'rgba(0, 229, 255, 0.45)',
      priceFormat: { type: 'volume' },
      title: 'Volume',
    });
    const smaSeries = chart.addSeries(LineSeries, {
      color: '#ffb300',
      lineWidth: 1.2,
      lineStyle: 2,
      title: '30d SMA',
    });

    const volData = points.map((p) => ({
      time: p.date,
      value: p.volume,
      color: 'rgba(0, 229, 255, 0.45)',
    }));
    const smaData = points
      .filter((p) => p.volume_sma != null)
      .map((p) => ({ time: p.date, value: p.volume_sma }));

    volSeries.setData(volData);
    if (smaData.length) smaSeries.setData(smaData);
    chart.timeScale().fitContent();

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [points, height, interactive]);

  if (!points?.length) {
    return <div className="text-muted text-center" style={{ paddingTop: '50px', fontSize: '11px' }}>No volume history trend available</div>;
  }

  return <div ref={containerRef} style={{ width: '100%', height: chartHeightStyle(height) }} />;
}

function rsiStatusText(rsi) {
  if (rsi == null) return { text: 'N/A', className: 'text-muted' };
  if (rsi < 30) return { text: `${rsi} - Oversold`, className: 'text-up' };
  if (rsi > 70) return { text: `${rsi} - Overbought`, className: 'text-down' };
  return { text: `${rsi} - Neutral`, className: 'text-neutral' };
}

export function LightweightRSIChart({
  points,
  currentRsi,
  height = 72,
  interactive = true,
  compact = false,
  showLegend = true,
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const latestRsi = currentRsi ?? (points?.length ? points[points.length - 1].rsi : null);
  const status = rsiStatusText(latestRsi);

  useResizeObserver(containerRef, chartRef);

  useEffect(() => {
    if (!containerRef.current || !points?.length) return undefined;

    const chart = createChart(containerRef.current, {
      ...CHART_THEME,
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight || (typeof height === 'number' ? height : 72),
      handleScroll: interactive,
      handleScale: interactive,
    });
    chartRef.current = chart;

    const rsiSeries = chart.addSeries(LineSeries, {
      color: '#00e5ff',
      lineWidth: compact ? 1.5 : 2,
      title: 'RSI (14)',
      autoscaleInfoProvider: () => ({
        priceRange: { minValue: 0, maxValue: 100 },
      }),
    });

    rsiSeries.createPriceLine({
      price: 70,
      color: 'rgba(255, 23, 68, 0.55)',
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: '70',
    });
    rsiSeries.createPriceLine({
      price: 30,
      color: 'rgba(0, 230, 118, 0.55)',
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: '30',
    });

    const rsiData = points.map((p) => ({ time: p.date, value: p.rsi }));
    rsiSeries.setData(rsiData);
    chart.timeScale().fitContent();

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [points, height, interactive, compact]);

  if (!points?.length) {
    return <div className="text-muted text-center" style={{ paddingTop: '20px', fontSize: '11px' }}>No RSI history available</div>;
  }

  return (
    <div className="rsi-chart-wrap">
      <div ref={containerRef} style={{ width: '100%', height: chartHeightStyle(height) }} />
      {showLegend && (
        <div className="rsi-gauge-labels">
          <span>OVERSOLD (30)</span>
          <span className={status.className} style={{ fontWeight: 'bold' }}>{status.text}</span>
          <span>OVERBOUGHT (70)</span>
        </div>
      )}
    </div>
  );
}

const BACKTEST_CHART_THEME = {
  layout: {
    background: { type: ColorType.Solid, color: 'transparent' },
    textColor: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    attributionLogo: false,
  },
  grid: {
    vertLines: { color: 'rgba(255,255,255,0.05)' },
    horzLines: { color: 'rgba(255,255,255,0.05)' },
  },
  rightPriceScale: {
    borderColor: 'rgba(255,255,255,0.08)',
    scaleMargins: { top: 0.1, bottom: 0.08 },
    minimumWidth: 58,
  },
  timeScale: {
    borderColor: 'rgba(255,255,255,0.08)',
    timeVisible: true,
    secondsVisible: false,
    rightOffset: 6,
    barSpacing: 3,
    minBarSpacing: 0.5,
  },
  crosshair: {
    vertLine: { color: 'rgba(255,255,255,0.18)', width: 1, style: 2, labelBackgroundColor: '#1a2332' },
    horzLine: { color: 'rgba(255,255,255,0.18)', width: 1, style: 2, labelBackgroundColor: '#1a2332' },
  },
};

const PORTFOLIO_LINE_COLOR = '#00e5ff';
const BENCHMARK_LINE_COLOR = '#ffb300';
const STOCK_HOLDING_COLORS = [
  '#9b7dff', // purple
  '#3dd68c', // green
  '#ff6b9d', // pink
  '#4da3ff', // blue
  '#ffc14d', // gold
  '#e879f9', // magenta
  '#2ecfcf', // teal
  '#ff9f5a', // orange
];

function stockHoldingColor(idx) {
  if (idx < STOCK_HOLDING_COLORS.length) return STOCK_HOLDING_COLORS[idx];
  const hue = (idx * 137) % 360;
  return `hsl(${hue}, 72%, 58%)`;
}

function withAlpha(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Distinct hues at reduced opacity — background context, not competing with portfolio */
function stockChartLineColor(idx) {
  if (idx < STOCK_HOLDING_COLORS.length) {
    return withAlpha(STOCK_HOLDING_COLORS[idx], 0.45);
  }
  const hue = (idx * 137) % 360;
  return `hsla(${hue}, 72%, 58%, 0.45)`;
}

function formatChartValue(value, currency = 'USD') {
  if (!Number.isFinite(value)) return '—';
  const prefix = currency === 'INR' ? '₹' : '$';
  return `${prefix}${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function normalizeChartDate(dateStr) {
  if (!dateStr) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const year = new Date().getFullYear();
  const parts = dateStr.split('-');
  if (parts.length === 2) {
    const [month, day] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return dateStr;
}

export function LightweightBacktestChart({ points, stockSeries = [], benchmarkLabel = 'S&P 500', currency = 'USD' }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const [chartError, setChartError] = useState(null);

  const lastPoint = points?.length ? points[points.length - 1] : null;
  const stocksWithColors = useMemo(
    () => (stockSeries || []).map((stock, idx) => ({
      ...stock,
      color: stockHoldingColor(idx),
      lastValue: stock.points?.length ? stock.points[stock.points.length - 1].value : null,
    })),
    [stockSeries],
  );

  useResizeObserver(containerRef, chartRef);

  useEffect(() => {
    if (!containerRef.current || !points?.length) return undefined;
    setChartError(null);

    try {
      const chart = createChart(containerRef.current, {
        ...BACKTEST_CHART_THEME,
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight || 320,
      });
      chartRef.current = chart;

      const benchmarkLineOptions = {
        lineWidth: 2.5,
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
        color: BENCHMARK_LINE_COLOR,
        lineStyle: 2,
      };
      const portfolioLineOptions = {
        lineWidth: 3.5,
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 5,
        color: PORTFOLIO_LINE_COLOR,
      };

      stocksWithColors.forEach((stock, idx) => {
        if (!stock.points?.length) return;
        const stockLine = chart.addSeries(LineSeries, {
          lineWidth: 1,
          lastValueVisible: false,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
          color: stockChartLineColor(idx),
        });
        const stockData = stock.points
          .map((p) => ({ time: normalizeChartDate(p.date), value: p.value }))
          .filter((p) => p.time != null && Number.isFinite(p.value));
        if (stockData.length) stockLine.setData(stockData);
      });

      const benchmarkSeries = chart.addSeries(LineSeries, benchmarkLineOptions);
      const portfolioSeries = chart.addSeries(LineSeries, portfolioLineOptions);

      const portfolioData = points
        .map((p) => ({ time: normalizeChartDate(p.date), value: p.portfolio }))
        .filter((p) => p.time != null && Number.isFinite(p.value));
      const benchmarkData = points
        .map((p) => ({ time: normalizeChartDate(p.date), value: p.benchmark }))
        .filter((p) => p.time != null && Number.isFinite(p.value));

      if (!portfolioData.length) {
        throw new Error('No valid portfolio data points');
      }

      portfolioSeries.setData(portfolioData);
      benchmarkSeries.setData(benchmarkData);
      chart.timeScale().fitContent();

      return () => {
        chart.remove();
        chartRef.current = null;
      };
    } catch (err) {
      console.error('Backtest chart render failed:', err);
      setChartError('Unable to render backtest chart. Please try again.');
      return undefined;
    }
  }, [points, benchmarkLabel, stocksWithColors]);

  if (!points?.length) return null;

  if (chartError) {
    return <div className="text-muted text-center backtest-chart-error">{chartError}</div>;
  }

  return (
    <div className="backtest-chart-wrap">
      <div className="backtest-chart-legend backtest-chart-legend-main">
        <div className="backtest-chart-legend-item backtest-chart-legend-primary">
          <span className="backtest-chart-swatch portfolio" />
          <span className="backtest-chart-legend-label">Portfolio</span>
          {lastPoint && (
            <span className="backtest-chart-legend-value">{formatChartValue(lastPoint.portfolio, currency)}</span>
          )}
        </div>
        <div className="backtest-chart-legend-item backtest-chart-legend-primary">
          <span className="backtest-chart-swatch benchmark" />
          <span className="backtest-chart-legend-label">{benchmarkLabel}</span>
          {lastPoint && (
            <span className="backtest-chart-legend-value">{formatChartValue(lastPoint.benchmark, currency)}</span>
          )}
        </div>
      </div>
      {stocksWithColors.length > 0 && (
        <div className="backtest-holdings-summary">
          <span className="backtest-chart-legend-section">Holdings at period end</span>
          <div className="backtest-holdings-grid">
            {stocksWithColors.map((stock) => (
              <div key={stock.ticker} className="backtest-holding-chip">
                <span className="backtest-holding-dot" style={{ background: stock.color }} />
                <span className="backtest-holding-name">{stock.label}</span>
                <span className="backtest-holding-weight">{stock.weight}%</span>
                {stock.lastValue != null && (
                  <span className="backtest-holding-value">{formatChartValue(stock.lastValue, currency)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      <div ref={containerRef} className="backtest-chart-canvas" />
    </div>
  );
}

const MC_MEDIAN_COLOR = '#00e5ff';
const MC_OPTIMISTIC_COLOR = '#3dd68c';
const MC_CONSERVATIVE_COLOR = '#ff6b9d';
const MC_TIME_ANCHOR = { year: 2026, month: 1, day: 1 };

function stepToChartTime(step) {
  const date = new Date(Date.UTC(MC_TIME_ANCHOR.year, MC_TIME_ANCHOR.month - 1, MC_TIME_ANCHOR.day + step));
  return date.toISOString().slice(0, 10);
}

function chartTimeToStepLabel(time) {
  let year;
  let month;
  let day;
  if (typeof time === 'string') {
    [year, month, day] = time.split('-').map(Number);
  } else if (time && typeof time === 'object') {
    ({ year, month, day } = time);
  } else {
    return '';
  }
  const base = Date.UTC(MC_TIME_ANCHOR.year, MC_TIME_ANCHOR.month - 1, MC_TIME_ANCHOR.day);
  const current = Date.UTC(year, month - 1, day);
  return `Day ${Math.round((current - base) / 86400000)}`;
}

export function LightweightMonteCarloChart({ points, currency = 'USD' }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const [chartError, setChartError] = useState(null);

  const lastPoint = points?.length ? points[points.length - 1] : null;

  useResizeObserver(containerRef, chartRef);

  useEffect(() => {
    if (!containerRef.current || !points?.length) return undefined;
    setChartError(null);

    try {
      const chart = createChart(containerRef.current, {
        ...BACKTEST_CHART_THEME,
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight || 320,
        timeScale: {
          ...BACKTEST_CHART_THEME.timeScale,
          tickMarkFormatter: (time) => chartTimeToStepLabel(time),
        },
      });
      chartRef.current = chart;

      const bandLineOptions = (color) => ({
        lineWidth: 1,
        lineStyle: 2,
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerVisible: false,
        color: withAlpha(color, 0.45),
      });

      const optimisticSeries = chart.addSeries(LineSeries, bandLineOptions(MC_OPTIMISTIC_COLOR));
      const conservativeSeries = chart.addSeries(LineSeries, bandLineOptions(MC_CONSERVATIVE_COLOR));
      const medianSeries = chart.addSeries(LineSeries, {
        lineWidth: 3.5,
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 5,
        color: MC_MEDIAN_COLOR,
      });

      const toData = (key) => points
        .map((p) => ({ time: stepToChartTime(p.step), value: p[key] }))
        .filter((p) => p.time && Number.isFinite(p.value));

      const medianData = toData('median');
      if (!medianData.length) {
        throw new Error('No valid Monte Carlo data points');
      }

      optimisticSeries.setData(toData('optimistic'));
      conservativeSeries.setData(toData('conservative'));
      medianSeries.setData(medianData);
      chart.timeScale().fitContent();

      return () => {
        chart.remove();
        chartRef.current = null;
      };
    } catch (err) {
      console.error('Monte Carlo chart render failed:', err);
      setChartError('Unable to render Monte Carlo chart. Please try again.');
      return undefined;
    }
  }, [points]);

  if (!points?.length) return null;

  if (chartError) {
    return <div className="text-muted text-center backtest-chart-error">{chartError}</div>;
  }

  return (
    <div className="backtest-chart-wrap">
      <div className="backtest-chart-legend backtest-chart-legend-main">
        <div className="backtest-chart-legend-item backtest-chart-legend-primary">
          <span className="backtest-chart-swatch portfolio" />
          <span className="backtest-chart-legend-label">Median Path</span>
          {lastPoint && (
            <span className="backtest-chart-legend-value">{formatChartValue(lastPoint.median, currency)}</span>
          )}
        </div>
        <div className="backtest-chart-legend-item">
          <span className="backtest-chart-swatch" style={{ background: MC_OPTIMISTIC_COLOR, opacity: 0.75 }} />
          <span className="backtest-chart-legend-label">90% Band</span>
          {lastPoint && (
            <span className="backtest-chart-legend-value muted">{formatChartValue(lastPoint.optimistic, currency)}</span>
          )}
        </div>
        <div className="backtest-chart-legend-item">
          <span className="backtest-chart-swatch" style={{ background: MC_CONSERVATIVE_COLOR, opacity: 0.75 }} />
          <span className="backtest-chart-legend-label">10% Band</span>
          {lastPoint && (
            <span className="backtest-chart-legend-value muted">{formatChartValue(lastPoint.conservative, currency)}</span>
          )}
        </div>
      </div>
      <div ref={containerRef} className="backtest-chart-canvas" />
    </div>
  );
}

export function LightweightFundamentalsChart({ series, height = 200 }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);

  useResizeObserver(containerRef, chartRef);

  useEffect(() => {
    if (!containerRef.current || !series?.length) return undefined;

    const chart = createChart(containerRef.current, {
      ...CHART_THEME,
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight || height,
    });
    chartRef.current = chart;

    series.forEach((s) => {
      if (!s.points?.length) return;
      const color = s.color?.startsWith('var(') ? '#00e5ff' : (s.color || '#00e5ff');
      const line = chart.addSeries(LineSeries, {
        color,
        lineWidth: 2,
        lineStyle: s.lineStyle ?? 0,
        title: s.label,
        crosshairMarkerVisible: true,
        lastValueVisible: true,
        priceLineVisible: false,
      });
      line.setData(s.points);
    });

    chart.timeScale().fitContent();

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [series, height]);

  if (!series?.length || !series.some((s) => s.points?.length)) {
    return (
      <div className="text-muted text-center" style={{ paddingTop: '40px', fontSize: '11px' }}>
        No trend data for selected metric
      </div>
    );
  }

  return (
    <div className="fund-trend-chart">
      <div className="fund-trend-legend" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '6px', fontSize: '10px' }}>
        {series.map((s) => (
          <span key={s.id} className="fund-trend-legend-item" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: 'var(--text-secondary)' }}>
            <span
              className="fund-trend-legend-swatch"
              style={{
                display: 'inline-block',
                width: '18px',
                height: '0',
                borderTop: `2px ${s.lineStyle === 2 || s.lineStyle === 3 ? 'dashed' : s.lineStyle === 1 || s.lineStyle === 4 ? 'dotted' : 'solid'} ${s.color}`,
              }}
            />
            <span style={{ color: s.color }}>{s.label}</span>
          </span>
        ))}
      </div>
      <div ref={containerRef} style={{ width: '100%', height: `${height}px` }} />
    </div>
  );
}
