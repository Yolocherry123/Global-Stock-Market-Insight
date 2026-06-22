import { useEffect, useRef, useState } from 'react';
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
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

export function LightweightCandlestickChart({ points, tradingDate }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);

  useResizeObserver(containerRef, chartRef);

  useEffect(() => {
    if (!containerRef.current || !points?.length) return undefined;

    const chart = createChart(containerRef.current, {
      ...CHART_THEME,
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight || 160,
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
  }, [points, tradingDate]);

  if (!points?.length) {
    return <div className="text-muted text-center" style={{ paddingTop: '50px', fontSize: '11px' }}>No intraday data available</div>;
  }

  return <div ref={containerRef} style={{ width: '100%', height: '160px' }} />;
}

export function LightweightTechnicalChart({ points }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);

  useResizeObserver(containerRef, chartRef);

  useEffect(() => {
    if (!containerRef.current || !points?.length) return undefined;

    const chart = createChart(containerRef.current, {
      ...CHART_THEME,
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight || 160,
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
  }, [points]);

  if (!points?.length) {
    return <div className="text-muted text-center" style={{ paddingTop: '50px', fontSize: '11px' }}>No daily history trend available</div>;
  }

  return <div ref={containerRef} style={{ width: '100%', height: '160px' }} />;
}

export function LightweightMACDChart({ points }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);

  useResizeObserver(containerRef, chartRef);

  useEffect(() => {
    if (!containerRef.current || !points?.length) return undefined;

    const chart = createChart(containerRef.current, {
      ...CHART_THEME,
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight || 160,
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
  }, [points]);

  if (!points?.length) {
    return <div className="text-muted text-center" style={{ paddingTop: '50px', fontSize: '11px' }}>No MACD history trend available</div>;
  }

  return <div ref={containerRef} style={{ width: '100%', height: '160px' }} />;
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

export function LightweightBacktestChart({ points }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const [chartError, setChartError] = useState(null);

  useResizeObserver(containerRef, chartRef);

  useEffect(() => {
    if (!containerRef.current || !points?.length) return undefined;
    setChartError(null);

    try {
      const chart = createChart(containerRef.current, {
        ...CHART_THEME,
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight || 200,
      });
      chartRef.current = chart;

      const portfolioSeries = chart.addSeries(LineSeries, { color: '#00e5ff', lineWidth: 2, title: 'Portfolio' });
      const benchmarkSeries = chart.addSeries(LineSeries, { color: '#ffb300', lineWidth: 2, title: 'S&P 500' });

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
  }, [points]);

  if (!points?.length) return null;

  if (chartError) {
    return <div className="text-muted text-center" style={{ paddingTop: '50px', fontSize: '11px' }}>{chartError}</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '6px', fontSize: '10px' }}>
        <span style={{ color: '#00e5ff' }}>● Portfolio</span>
        <span style={{ color: '#ffb300' }}>● S&P 500 Benchmark</span>
      </div>
      <div ref={containerRef} style={{ width: '100%', height: '200px' }} />
    </div>
  );
}
