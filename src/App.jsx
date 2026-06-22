import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Globe, 
  Newspaper, 
  Percent, 
  Info, 
  Activity, 
  Calendar,
  Clock,
  Compass,
  AlertTriangle
} from 'lucide-react';
import {
  LightweightCandlestickChart,
  LightweightTechnicalChart,
  LightweightMACDChart,
  LightweightBacktestChart,
} from './charts/LightweightCharts';
import { getFundamentalItems } from './fundamentalsFormatters';
import FundamentalsTab from './FundamentalsTab';

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://127.0.0.1:8000/api'
  : 'https://global-stock-market-insight-api.onrender.com/api';


const EXCHANGE_DISPLAY_NAMES = {
  nasdaq: { sidebar: "NASDAQ", ticker: "NASDAQ" },
  nyse: { sidebar: "NYSE", ticker: "NYSE" },
  sse: { sidebar: "Shanghai SE", ticker: "Shanghai" },
  jpx: { sidebar: "Japan JPX", ticker: "Japan JPX" },
  euronext: { sidebar: "Euronext", ticker: "Euronext" },
  szse: { sidebar: "Shenzhen SE", ticker: "Shenzhen" },
  hkex: { sidebar: "Hong Kong SE", ticker: "Hong Kong" },
  twse: { sidebar: "Taiwan SE", ticker: "Taiwan" },
  krx: { sidebar: "Korea Exchange", ticker: "Korea KRX" },
  bse: { sidebar: "Bombay BSE", ticker: "BSE" },
  nse: { sidebar: "National NSE", ticker: "NSE" },
  tsx: { sidebar: "Toronto TSX", ticker: "TSX" },
  lse: { sidebar: "London LSE", ticker: "LSE" }
};

// --- Custom Markdown-to-HTML Renderer Helper ---
function renderMarkdown(text) {
  if (!text) return '';
  let html = text;
  html = html.replace(/###\s+(.*)/g, '<h3>$1</h3>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  html = html.replace(/\n\n/g, '<p></p>');
  html = html.replace(/\n/g, '<br/>');
  return html;
}

// --- RSI Gauge Meter Component ---
function RSIGauge({ rsi }) {
  if (rsi === null || rsi === undefined) return <span className="text-muted">N/A</span>;
  const leftPercent = Math.min(100, Math.max(0, rsi));
  let statusText = 'Neutral';
  let statusClass = 'text-neutral';
  if (rsi < 30) {
    statusText = 'Oversold';
    statusClass = 'text-up';
  } else if (rsi > 70) {
    statusText = 'Overbought';
    statusClass = 'text-down';
  }
  
  return (
    <div className="rsi-gauge-container">
      <div className="rsi-gauge-track">
        <div className="rsi-gauge-pin" style={{ left: `${leftPercent}%` }} title={`RSI: ${rsi}`}></div>
      </div>
      <div className="rsi-gauge-labels">
        <span>OVERSOLD (30)</span>
        <span className={statusClass} style={{ fontWeight: 'bold' }}>{rsi} - {statusText}</span>
        <span>OVERBOUGHT (70)</span>
      </div>
    </div>
  );
}

// --- Custom SVG Chart Components with Left Padding to Fix Clipping ---

function CandlestickChart({ points }) {
  if (!points || points.length === 0) {
    return <div className="text-muted text-center" style={{ paddingTop: '50px', fontSize: '11px' }}>No intraday data available</div>;
  }

  const leftPadding = 55; // Fixed clipping
  const rightPadding = 15;
  const topPadding = 20;
  const bottomPadding = 20;
  const width = 500;
  const height = 120;

  const prices = points.flatMap(p => [p.open, p.high, p.low, p.close]);
  const maxPrice = Math.max(...prices);
  const minPrice = Math.min(...prices);
  const priceRange = maxPrice - minPrice || 1.0;

  const yMax = maxPrice + priceRange * 0.05;
  const yMin = Math.max(0, minPrice - priceRange * 0.05);
  const yRange = yMax - yMin;

  const scaleX = (index) => leftPadding + (index * (width - leftPadding - rightPadding)) / (points.length - 1 || 1);
  const scaleY = (val) => height - bottomPadding - ((val - yMin) * (height - topPadding - bottomPadding)) / yRange;

  const gridLines = [];
  const gridCount = 2; // Reduced count to prevent crowding
  for (let i = 0; i <= gridCount; i++) {
    gridLines.push(yMin + (yRange * i) / gridCount);
  }

  const timeLabelsIndices = [0, Math.floor(points.length / 2), points.length - 1];

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg">
        {gridLines.map((yVal, idx) => (
          <g key={idx}>
            <line x1={leftPadding} y1={scaleY(yVal)} x2={width - rightPadding} y2={scaleY(yVal)} className="chart-grid-line" />
            <text x={leftPadding - 6} y={scaleY(yVal) + 3} textAnchor="end" className="chart-axis-text">{yVal.toFixed(2)}</text>
          </g>
        ))}

        {points.map((p, idx) => {
          const cx = scaleX(idx);
          const yOpen = scaleY(p.open);
          const yClose = scaleY(p.close);
          const yHigh = scaleY(p.high);
          const yLow = scaleY(p.low);
          
          const isUp = p.close >= p.open;
          const bodyHeight = Math.max(1.5, Math.abs(yClose - yOpen));
          const bodyY = Math.min(yOpen, yClose);
          const barWidth = Math.max(2, (width - leftPadding - rightPadding) / points.length * 0.6);

          return (
            <g key={idx}>
              <line x1={cx} y1={yHigh} x2={cx} y2={yLow} className="chart-wick" />
              <rect 
                x={cx - barWidth / 2} 
                y={bodyY} 
                width={barWidth} 
                height={bodyHeight} 
                className={isUp ? "chart-bar-up" : "chart-bar-down"}
              />
            </g>
          );
        })}

        {timeLabelsIndices.map((idx) => {
          if (idx >= points.length) return null;
          return (
            <text key={idx} x={scaleX(idx)} y={height - 4} textAnchor="middle" className="chart-axis-text">
              {points[idx].time}
            </text>
          );
        })}

        <line x1={leftPadding} y1={height - bottomPadding} x2={width - rightPadding} y2={height - bottomPadding} className="chart-axis-line" />
      </svg>
    </div>
  );
}

function VolatilityLineChart({ points }) {
  if (!points || points.length === 0) {
    return <div className="text-muted text-center" style={{ paddingTop: '50px', fontSize: '11px' }}>No intraday data available</div>;
  }

  const leftPadding = 55;
  const rightPadding = 15;
  const topPadding = 20;
  const bottomPadding = 20;
  const width = 500;
  const height = 120;

  const vols = points.map(p => p.volatility);
  const maxVol = Math.max(...vols);
  const minVol = Math.min(...vols);
  const volRange = maxVol - minVol || 0.1;

  const yMax = maxVol + volRange * 0.1;
  const yMin = Math.max(0, minVol - volRange * 0.1);
  const yRange = yMax - yMin;

  const scaleX = (index) => leftPadding + (index * (width - leftPadding - rightPadding)) / (points.length - 1 || 1);
  const scaleY = (val) => height - bottomPadding - ((val - yMin) * (height - topPadding - bottomPadding)) / yRange;

  let pathD = '';
  points.forEach((p, idx) => {
    const x = scaleX(idx);
    const y = scaleY(p.volatility);
    if (idx === 0) {
      pathD += `M ${x} ${y}`;
    } else {
      pathD += ` L ${x} ${y}`;
    }
  });

  let areaD = pathD;
  if (points.length > 0) {
    areaD += ` L ${scaleX(points.length - 1)} ${height - bottomPadding}`;
    areaD += ` L ${scaleX(0)} ${height - bottomPadding} Z`;
  }

  const gridLines = [];
  const gridCount = 2;
  for (let i = 0; i <= gridCount; i++) {
    gridLines.push(yMin + (yRange * i) / gridCount);
  }

  const timeLabelsIndices = [0, Math.floor(points.length / 2), points.length - 1];

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg">
        <defs>
          <linearGradient id="cyan-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity="0.25"/>
            <stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity="0"/>
          </linearGradient>
        </defs>

        {gridLines.map((yVal, idx) => (
          <g key={idx}>
            <line x1={leftPadding} y1={scaleY(yVal)} x2={width - rightPadding} y2={scaleY(yVal)} className="chart-grid-line" />
            <text x={leftPadding - 6} y={scaleY(yVal) + 3} textAnchor="end" className="chart-axis-text">{yVal.toFixed(3)}%</text>
          </g>
        ))}

        {points.length > 0 && <path d={areaD} className="chart-area-cyan" />}
        {points.length > 0 && <path d={pathD} className="chart-line cyan" />}

        {timeLabelsIndices.map((idx) => {
          if (idx >= points.length) return null;
          return (
            <text key={idx} x={scaleX(idx)} y={height - 4} textAnchor="middle" className="chart-axis-text">
              {points[idx].time}
            </text>
          );
        })}

        <line x1={leftPadding} y1={height - bottomPadding} x2={width - rightPadding} y2={height - bottomPadding} className="chart-axis-line" />
      </svg>
    </div>
  );
}

function TechnicalIndicatorChart({ points }) {
  if (!points || points.length === 0) {
    return <div className="text-muted text-center" style={{ paddingTop: '50px', fontSize: '11px' }}>No daily history trend available</div>;
  }

  const leftPadding = 55;
  const rightPadding = 15;
  const topPadding = 20;
  const bottomPadding = 20;
  const width = 500;
  const height = 120;

  const allValues = points.flatMap(p => [p.close, p.sma20, p.upper_bb, p.lower_bb].filter(v => v !== null && v !== undefined));
  const maxVal = Math.max(...allValues);
  const minVal = Math.min(...allValues);
  const valRange = maxVal - minVal || 1.0;

  const yMax = maxVal + valRange * 0.05;
  const yMin = Math.max(0, minVal - valRange * 0.05);
  const yRange = yMax - yMin;

  const scaleX = (index) => leftPadding + (index * (width - leftPadding - rightPadding)) / (points.length - 1 || 1);
  const scaleY = (val) => height - bottomPadding - ((val - yMin) * (height - topPadding - bottomPadding)) / yRange;

  let closePathD = '';
  let smaPathD = '';
  let upperBBD = '';
  let lowerBBD = '';

  points.forEach((p, idx) => {
    const x = scaleX(idx);
    if (idx === 0) {
      closePathD += `M ${x} ${scaleY(p.close)}`;
      if (p.sma20) smaPathD += `M ${x} ${scaleY(p.sma20)}`;
      if (p.upper_bb) upperBBD += `M ${x} ${scaleY(p.upper_bb)}`;
      if (p.lower_bb) lowerBBD += `M ${x} ${scaleY(p.lower_bb)}`;
    } else {
      closePathD += ` L ${x} ${scaleY(p.close)}`;
      if (p.sma20) smaPathD += ` L ${x} ${scaleY(p.sma20)}`;
      if (p.upper_bb) upperBBD += ` L ${x} ${scaleY(p.upper_bb)}`;
      if (p.lower_bb) lowerBBD += ` L ${x} ${scaleY(p.lower_bb)}`;
    }
  });

  let bbAreaD = '';
  if (points.length > 0 && points[0].upper_bb && points[0].lower_bb) {
    bbAreaD = upperBBD;
    for (let i = points.length - 1; i >= 0; i--) {
      bbAreaD += ` L ${scaleX(i)} ${scaleY(points[i].lower_bb)}`;
    }
    bbAreaD += ' Z';
  }

  const gridLines = [];
  const gridCount = 2;
  for (let i = 0; i <= gridCount; i++) {
    gridLines.push(yMin + (yRange * i) / gridCount);
  }

  const dateLabelsIndices = [0, Math.floor(points.length / 2), points.length - 1];

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg">
        {gridLines.map((yVal, idx) => (
          <g key={idx}>
            <line x1={leftPadding} y1={scaleY(yVal)} x2={width - rightPadding} y2={scaleY(yVal)} className="chart-grid-line" />
            <text x={leftPadding - 6} y={scaleY(yVal) + 3} textAnchor="end" className="chart-axis-text">{yVal.toFixed(2)}</text>
          </g>
        ))}

        {bbAreaD && <path d={bbAreaD} className="chart-area-bb" />}
        {upperBBD && <path d={upperBBD} className="chart-line bb-upper" />}
        {lowerBBD && <path d={lowerBBD} className="chart-line bb-lower" />}
        {smaPathD && <path d={smaPathD} className="chart-line sma" />}
        {closePathD && <path d={closePathD} className="chart-line cyan" />}

        {dateLabelsIndices.map((idx) => {
          if (idx >= points.length) return null;
          return (
            <text key={idx} x={scaleX(idx)} y={height - 4} textAnchor="middle" className="chart-axis-text">
              {points[idx].date}
            </text>
          );
        })}

        <line x1={leftPadding} y1={height - bottomPadding} x2={width - rightPadding} y2={height - bottomPadding} className="chart-axis-line" />
      </svg>
    </div>
  );
}

function MACDChart({ points }) {
  if (!points || points.length === 0) {
    return <div className="text-muted text-center" style={{ paddingTop: '50px', fontSize: '11px' }}>No MACD history trend available</div>;
  }

  const leftPadding = 55;
  const rightPadding = 15;
  const topPadding = 20;
  const bottomPadding = 20;
  const width = 500;
  const height = 120;

  const allVals = points.flatMap(p => [p.macd, p.signal, p.hist]);
  const maxVal = Math.max(...allVals, 0.01);
  const minVal = Math.min(...allVals, -0.01);
  const valRange = maxVal - minVal || 0.1;

  const yMax = maxVal + valRange * 0.05;
  const yMin = minVal - valRange * 0.05;
  const yRange = yMax - yMin;

  const scaleX = (index) => leftPadding + (index * (width - leftPadding - rightPadding)) / (points.length - 1 || 1);
  const scaleY = (val) => height - bottomPadding - ((val - yMin) * (height - topPadding - bottomPadding)) / yRange;

  const zeroY = scaleY(0);

  let macdPath = '';
  let signalPath = '';

  points.forEach((p, idx) => {
    const x = scaleX(idx);
    const yMacd = scaleY(p.macd);
    const ySignal = scaleY(p.signal);
    if (idx === 0) {
      macdPath += `M ${x} ${yMacd}`;
      signalPath += `M ${x} ${ySignal}`;
    } else {
      macdPath += ` L ${x} ${yMacd}`;
      signalPath += ` L ${x} ${ySignal}`;
    }
  });

  const timeLabelsIndices = [0, Math.floor(points.length / 2), points.length - 1];

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg">
        {/* Zero line */}
        <line x1={leftPadding} y1={zeroY} x2={width - rightPadding} y2={zeroY} className="chart-grid-line" style={{ strokeDasharray: 'none', stroke: 'rgba(255,255,255,0.15)' }} />

        {/* Y Axis Grid Label limits */}
        <text x={leftPadding - 6} y={scaleY(yMax) + 8} textAnchor="end" className="chart-axis-text">{yMax.toFixed(3)}</text>
        <text x={leftPadding - 6} y={zeroY + 3} textAnchor="end" className="chart-axis-text">0.00</text>
        <text x={leftPadding - 6} y={scaleY(yMin) - 3} textAnchor="end" className="chart-axis-text">{yMin.toFixed(3)}</text>

        {/* Hist Bars */}
        {points.map((p, idx) => {
          const x = scaleX(idx);
          const yHist = scaleY(p.hist);
          const isUp = p.hist >= 0;
          const barWidth = Math.max(2, (width - leftPadding - rightPadding) / points.length * 0.5);
          
          let barHeight = Math.abs(zeroY - yHist);
          if (barHeight < 1) barHeight = 1;
          const yPos = isUp ? yHist : zeroY;

          return (
            <rect 
              key={idx} 
              x={x - barWidth / 2} 
              y={yPos} 
              width={barWidth} 
              height={barHeight} 
              fill={isUp ? "var(--color-green)" : "var(--color-red)"} 
              opacity="0.6"
            />
          );
        })}

        {/* MACD Line */}
        {points.length > 0 && <path d={macdPath} className="chart-line cyan" style={{ strokeWidth: '1.2px' }} />}
        
        {/* Signal Line */}
        {points.length > 0 && <path d={signalPath} className="chart-line" style={{ stroke: 'var(--color-amber)', strokeWidth: '1.2px' }} />}

        {/* X labels */}
        {timeLabelsIndices.map((idx) => {
          if (idx >= points.length) return null;
          return (
            <text key={idx} x={scaleX(idx)} y={height - 4} textAnchor="middle" className="chart-axis-text">
              {points[idx].date}
            </text>
          );
        })}
        <line x1={leftPadding} y1={height - bottomPadding} x2={width - rightPadding} y2={height - bottomPadding} className="chart-axis-line" />
      </svg>
    </div>
  );
}

function VolumeChart({ points }) {
  if (!points || points.length === 0) {
    return <div className="text-muted text-center" style={{ paddingTop: '50px', fontSize: '11px' }}>No Volume history trend available</div>;
  }

  const leftPadding = 55;
  const rightPadding = 15;
  const topPadding = 20;
  const bottomPadding = 20;
  const width = 500;
  const height = 120;

  const maxVol = Math.max(...points.map(p => p.volume), 1000);
  const scaleX = (index) => leftPadding + (index * (width - leftPadding - rightPadding)) / (points.length - 1 || 1);
  const scaleY = (val) => height - bottomPadding - (val * (height - topPadding - bottomPadding)) / maxVol;

  let smaPath = '';
  points.forEach((p, idx) => {
    if (p.volume_sma !== null && p.volume_sma !== undefined) {
      const x = scaleX(idx);
      const ySma = scaleY(p.volume_sma);
      if (smaPath === '') {
        smaPath += `M ${x} ${ySma}`;
      } else {
        smaPath += ` L ${x} ${ySma}`;
      }
    }
  });

  const timeLabelsIndices = [0, Math.floor(points.length / 2), points.length - 1];

  const formatVol = (val) => {
    if (val >= 1e6) return (val / 1e6).toFixed(1) + 'M';
    if (val >= 1e3) return (val / 1e3).toFixed(0) + 'K';
    return val;
  };

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg">
        {/* Y Axis Grid lines */}
        {[0.5, 1.0].map((ratio, idx) => (
          <g key={idx}>
            <line x1={leftPadding} y1={scaleY(maxVol * ratio)} x2={width - rightPadding} y2={scaleY(maxVol * ratio)} className="chart-grid-line" />
            <text x={leftPadding - 6} y={scaleY(maxVol * ratio) + 3} textAnchor="end" className="chart-axis-text">{formatVol(maxVol * ratio)}</text>
          </g>
        ))}

        {/* Volume Bars */}
        {points.map((p, idx) => {
          const x = scaleX(idx);
          const yVol = scaleY(p.volume);
          const barWidth = Math.max(2, (width - leftPadding - rightPadding) / points.length * 0.6);
          const barHeight = Math.max(1, height - bottomPadding - yVol);

          return (
            <rect 
              key={idx} 
              x={x - barWidth / 2} 
              y={yVol} 
              width={barWidth} 
              height={barHeight} 
              fill="rgba(0, 229, 255, 0.45)"
              className="volume-bar-rect"
            />
          );
        })}

        {/* SMA volume line */}
        {smaPath && <path d={smaPath} className="chart-line" style={{ stroke: 'var(--color-amber)', strokeWidth: '1.2px', strokeDasharray: '3' }} />}

        {/* X labels */}
        {timeLabelsIndices.map((idx) => {
          if (idx >= points.length) return null;
          return (
            <text key={idx} x={scaleX(idx)} y={height - 4} textAnchor="middle" className="chart-axis-text">
              {points[idx].date}
            </text>
          );
        })}
        <line x1={leftPadding} y1={height - bottomPadding} x2={width - rightPadding} y2={height - bottomPadding} className="chart-axis-line" />
      </svg>
    </div>
  );
}



function CorrelationHeatmap({ matrix }) {
  if (!matrix || Object.keys(matrix).length === 0) {
    return <div className="text-muted text-center" style={{ padding: '30px', fontSize: '11px' }}>Loading correlation matrix...</div>;
  }

  const rowKeys = Object.keys(matrix);
  const colKeys = rowKeys.length > 0 ? Object.keys(matrix[rowKeys[0]] || {}) : [];
  
  const getCellColor = (r) => {
    if (r > 0) {
      return `rgba(0, 230, 118, ${Math.min(1, r)})`;
    } else {
      return `rgba(255, 23, 68, ${Math.min(1, Math.abs(r))})`;
    }
  };

  const gridStyle = {
    marginBottom: '2px',
    gridTemplateColumns: `repeat(${colKeys.length + 1}, 1fr)`
  };

  return (
    <div className="heatmap-container">
      <div style={{ overflowX: 'auto', display: 'flex', justifyContent: 'flex-start' }}>
        <div style={{ 
          width: '100%',
          maxWidth: colKeys.length > 5 ? '100%' : '200px',
          minWidth: colKeys.length > 5 ? '600px' : '180px'
        }}>
          <div className="heatmap-grid" style={gridStyle}>
            <div className="heatmap-header" style={{ textAlign: 'left', fontWeight: 'bold' }}>EX</div>
            {colKeys.map(k => (
              <div key={k} className="heatmap-header" title={k}>{k.slice(0, 3)}</div>
            ))}
          </div>

          {rowKeys.map((rowKey) => (
            <div key={rowKey} className="heatmap-grid" style={gridStyle}>
              <div className="heatmap-header" style={{ textAlign: 'left', fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
                {rowKey.toUpperCase()}
              </div>
              {colKeys.map((colKey) => {
                const r = matrix[rowKey][colKey] ?? 0;
                return (
                  <div 
                    key={colKey} 
                    className="heatmap-cell" 
                    style={{ backgroundColor: getCellColor(r) }}
                    title={`${rowKey.toUpperCase()} vs ${colKey.toUpperCase()}: ${r}`}
                  >
                    {r.toFixed(2)}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Timezone Spillover Transmission Network ---
function TimezoneSpilloverNetwork({ exchanges }) {
  const getStatus = (id) => {
    const ex = exchanges.find(e => e.id === id);
    return ex ? ex.status === 'OPEN' : false;
  };

  const markets = [
    { id: 'jpx', name: 'Tokyo (JPX)', x: 50, y: 70, open: getStatus('jpx') },
    { id: 'hkex', name: 'HK / Shanghai', x: 140, y: 40, open: getStatus('hkex') || getStatus('sse') },
    { id: 'nse', name: 'India (NSE)', x: 230, y: 80, open: getStatus('nse') },
    { id: 'euronext', name: 'Europe (LSE/EU)', x: 340, y: 30, open: getStatus('euronext') || getStatus('lse') },
    { id: 'nasdaq', name: 'New York (US)', x: 440, y: 70, open: getStatus('nasdaq') || getStatus('nyse') }
  ];

  return (
    <div className="glass-panel timezone-network-panel">
      <h3 style={{ fontSize: '12px', fontWeight: '600', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
        <Clock size={12} className="text-up" />
        Timezone Spillover Transmission Network
      </h3>
      <svg className="timezone-svg" viewBox="0 0 500 120">
        {/* Draw connections */}
        {markets.slice(0, -1).map((m, idx) => {
          const next = markets[idx + 1];
          const pathD = `M ${m.x} ${m.y} Q ${(m.x + next.x)/2} ${(m.y + next.y)/2 + (idx % 2 === 0 ? -15 : 15)} ${next.x} ${next.y}`;
          const isFlowing = m.open || next.open;
          return (
            <g key={idx}>
              <path 
                d={pathD} 
                fill="none" 
                stroke={isFlowing ? "var(--accent-cyan)" : "rgba(255,255,255,0.06)"} 
                strokeWidth={isFlowing ? "1.5" : "1"} 
                className={isFlowing ? "connection-flow" : ""}
                opacity={isFlowing ? 0.7 : 0.3}
              />
            </g>
          );
        })}

        {/* Draw nodes */}
        {markets.map((m) => (
          <g key={m.id} transform={`translate(${m.x}, ${m.y})`}>
            {m.open && (
              <circle r="6" fill="var(--color-green)" className="node-pulse" />
            )}
            <circle r="4" fill={m.open ? "var(--color-green)" : "var(--text-muted)"} />
            <text 
              y="-10" 
              textAnchor="middle" 
              fill={m.open ? "var(--text-primary)" : "var(--text-secondary)"} 
              style={{ fontSize: '9px', fontWeight: m.open ? '600' : '400' }}
            >
              {m.name}
            </text>
            <text 
              y="16" 
              textAnchor="middle" 
              fill={m.open ? "var(--color-green)" : "var(--text-muted)"} 
              style={{ fontSize: '8px', fontFamily: 'var(--font-mono)' }}
            >
              {m.open ? 'OPEN' : 'CLOSED'}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// --- Economic Calendar ---
function EconomicCalendar({ events }) {
  if (!events || events.length === 0) {
    return <div className="text-muted text-center" style={{ padding: '15px', fontSize: '11px' }}>Loading calendar events...</div>;
  }
  
  return (
    <div className="glass-panel">
      <h3 style={{ fontSize: '12px', fontWeight: '600', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
        <Calendar size={12} className="text-up" />
        Economic Calendar & Institutional Releases
      </h3>
      <div className="calendar-panel" style={{ maxHeight: '160px', overflowY: 'auto' }}>
        <div className="calendar-header">
          <span>Date</span>
          <span>Time</span>
          <span>Event</span>
          <span>Impact</span>
          <span>Cons</span>
          <span>Actual</span>
        </div>
        {events.map((e, idx) => (
          <div className="calendar-row" key={idx}>
            <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{e.date.slice(5)}</span>
            <span style={{ color: 'var(--text-secondary)' }}>{e.time}</span>
            <span style={{ fontWeight: '500', color: 'var(--text-primary)', display: 'flex', alignItems: 'center' }}>
              {e.event}
              {e.reasoning && (
                <span className="tooltip-container">
                  <Info size={10} style={{ display: 'block' }} />
                  <span className="tooltip-box">
                    <strong style={{ color: 'var(--accent-cyan)' }}>Source:</strong> {e.source || 'N/A'}
                    <div style={{ marginTop: '5px', color: 'var(--text-primary)', fontWeight: 'normal' }}>
                      {e.reasoning}
                    </div>
                  </span>
                </span>
              )}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span className={`impact-badge impact-${e.impact.toLowerCase()}`}>{e.impact}</span>
              <span className="tooltip-container" style={{ marginLeft: 0 }}>
                <Info size={10} style={{ display: 'block' }} />
                <span className="tooltip-box">
                  <strong style={{ color: 'var(--accent-cyan)' }}>Impact Assessment:</strong>
                  <div style={{ marginTop: '5px', color: 'var(--text-primary)', fontWeight: 'normal' }}>
                    {e.impact === 'HIGH' && 'High volatility expected. Likely to trigger significant price shifts in index benchmarks and local currency trading pairs.'}
                    {e.impact === 'MEDIUM' && 'Moderate volatility expected. Typically affects specific sectors or influences short-term interest rate adjustments.'}
                    {e.impact === 'LOW' && 'Low volatility expected. Minimal direct price impact, but tracks baseline structural macro indicators.'}
                  </div>
                </span>
              </span>
            </div>
            <span className="mono">{e.consensus || '-'}</span>
            <span className={`mono ${e.actual ? 'text-up' : 'text-muted'}`}>{e.actual || 'Pending'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Sentiment Analyzer & Buzzwords ---
function SentimentAnalysisPanel({ sentiment }) {
  if (!sentiment) return null;
  const score = sentiment.score;
  const rotation = score * 90;

  return (
    <div className="glass-panel" style={{ padding: '8px 12px' }}>
      <h3 style={{ fontSize: '11.5px', fontWeight: '600', marginBottom: '4px' }}>
        News Sentiment Analyzer
        {sentiment.source === 'gemini' && (
          <span style={{ fontSize: '8px', color: 'var(--accent-cyan)', marginLeft: '6px', fontWeight: '500' }}>AI-POWERED</span>
        )}
      </h3>
      {sentiment.summary && (
        <p style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '6px', lineHeight: 1.35 }}>
          {sentiment.summary}
        </p>
      )}
      <div className="sentiment-gauge-panel">
        <svg className="sentiment-dial-svg" viewBox="0 0 160 90">
          <defs>
            <linearGradient id="gauge-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--color-red)" />
              <stop offset="50%" stopColor="var(--text-muted)" />
              <stop offset="100%" stopColor="var(--color-green)" />
            </linearGradient>
          </defs>
          <path 
            d="M 20 80 A 60 60 0 0 1 140 80" 
            fill="none" 
            stroke="url(#gauge-grad)" 
            strokeWidth="10" 
            strokeLinecap="round"
          />
          <text x="20" y="88" textAnchor="middle" style={{ fontSize: '8px', fill: 'var(--color-red)', fontWeight: 'bold' }}>BEARISH</text>
          <text x="80" y="15" textAnchor="middle" style={{ fontSize: '8px', fill: 'var(--text-muted)', fontWeight: 'bold' }}>NEUTRAL</text>
          <text x="140" y="88" textAnchor="middle" style={{ fontSize: '8px', fill: 'var(--color-green)', fontWeight: 'bold' }}>BULLISH</text>
          
          <circle cx="80" cy="80" r="4" fill="#fff" />
          
          <line 
            x1="80" y1="80" 
            x2="80" y2="30" 
            stroke="#fff" 
            strokeWidth="2.5" 
            strokeLinecap="round"
            className="sentiment-needle"
            style={{ transform: `rotate(${rotation}deg)` }}
          />
        </svg>
        <div style={{ marginTop: '-10px', fontSize: '12px', fontWeight: '700', color: score > 0.2 ? 'var(--color-green)' : score < -0.2 ? 'var(--color-red)' : 'var(--text-secondary)' }}>
          {sentiment.sentiment} ({score > 0 ? `+${score.toFixed(2)}` : score.toFixed(2)})
        </div>
      </div>
      
      <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '6px', paddingTop: '6px' }}>
        <span style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', textAlign: 'center', marginBottom: '4px' }}>Key Sentiment Terms</span>
        <div className="buzzword-cloud">
          {sentiment.buzzwords.map((word, idx) => (
            <span className="buzzword-tag" key={idx}>{word}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function FundamentalsPanel({ info }) {
  if (!info) return null;

  const items = getFundamentalItems(info);

  return (
    <div className="glass-panel" style={{ padding: '8px 12px' }}>
      <h3 style={{ fontSize: '11.5px', fontWeight: '600', marginBottom: '6px' }}>Fundamental Analysis</h3>
      <div className="metrics-pill-grid">
        {items.map((item) => (
          <div className="metric-pill" key={item.label}>
            <span className="metric-pill-label">{item.label}</span>
            <span className="metric-pill-value">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Algorithmic Signal Flags ---
function AlgorithmicSignalsPanel({ signals }) {
  return (
    <div className="glass-panel" style={{ padding: '8px 12px' }}>
      <h3 style={{ fontSize: '11.5px', fontWeight: '600', marginBottom: '6px' }}>Algorithmic Technical Signals</h3>
      <div className="signals-container">
        {signals && signals.length > 0 ? (
          signals.map((sig, idx) => (
            <div className={`signal-flag-card ${sig.type.toLowerCase()}`} key={idx}>
              <span className={`signal-badge ${sig.type.toLowerCase()}`}>{sig.type}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '600', fontSize: '11px', color: 'var(--text-primary)' }}>{sig.name}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: 1.25 }}>{sig.desc}</div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-muted text-center" style={{ paddingTop: '30px', fontSize: '11px' }}>
            No algorithmic trade triggers active on current daily bar
          </div>
        )}
      </div>
    </div>
  );
}

// --- Portfolio Backtest Equity Chart ---
function PortfolioBacktestChart({ points }) {
  if (!points || points.length === 0) return null;

  const leftPadding = 55;
  const rightPadding = 15;
  const topPadding = 20;
  const bottomPadding = 20;
  const width = 600;
  const height = 180;

  const values = points.flatMap(p => [p.portfolio, p.benchmark]);
  const maxVal = Math.max(...values);
  const minVal = Math.min(...values);
  const valRange = maxVal - minVal || 1.0;

  const yMax = maxVal + valRange * 0.05;
  const yMin = Math.max(0, minVal - valRange * 0.05);
  const yRange = yMax - yMin;

  const scaleX = (index) => leftPadding + (index * (width - leftPadding - rightPadding)) / (points.length - 1 || 1);
  const scaleY = (val) => height - bottomPadding - ((val - yMin) * (height - topPadding - bottomPadding)) / yRange;

  let portPath = '';
  let benchPath = '';

  points.forEach((p, idx) => {
    const x = scaleX(idx);
    if (idx === 0) {
      portPath += `M ${x} ${scaleY(p.portfolio)}`;
      benchPath += `M ${x} ${scaleY(p.benchmark)}`;
    } else {
      portPath += ` L ${x} ${scaleY(p.portfolio)}`;
      benchPath += ` L ${x} ${scaleY(p.benchmark)}`;
    }
  });

  let portAreaPath = portPath;
  if (points.length > 0) {
    portAreaPath += ` L ${scaleX(points.length - 1)} ${height - bottomPadding}`;
    portAreaPath += ` L ${scaleX(0)} ${height - bottomPadding} Z`;
  }

  const gridLines = [];
  const gridCount = 3;
  for (let i = 0; i <= gridCount; i++) {
    gridLines.push(yMin + (yRange * i) / gridCount);
  }

  const dateLabelsIndices = [0, Math.floor(points.length / 2), points.length - 1];

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg">
        <defs>
          <linearGradient id="port-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity="0.25"/>
            <stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity="0"/>
          </linearGradient>
        </defs>

        {gridLines.map((yVal, idx) => (
          <g key={idx}>
            <line x1={leftPadding} y1={scaleY(yVal)} x2={width - rightPadding} y2={scaleY(yVal)} className="chart-grid-line" />
            <text x={leftPadding - 6} y={scaleY(yVal) + 3} textAnchor="end" className="chart-axis-text">${yVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</text>
          </g>
        ))}

        {points.length > 0 && <path d={portAreaPath} fill="url(#port-grad)" opacity="0.4" />}
        {points.length > 0 && <path d={benchPath} className="chart-line benchmark" />}
        {points.length > 0 && <path d={portPath} className="chart-line portfolio" />}

        {dateLabelsIndices.map((idx) => {
          if (idx >= points.length) return null;
          return (
            <text key={idx} x={scaleX(idx)} y={height - 4} textAnchor="middle" className="chart-axis-text">
              {points[idx].date}
            </text>
          );
        })}

        <line x1={leftPadding} y1={height - bottomPadding} x2={width - rightPadding} y2={height - bottomPadding} className="chart-axis-line" />
      </svg>
    </div>
  );
}

// --- Monte Carlo Forecast Chart ---
function MonteCarloChart({ points }) {
  if (!points || points.length === 0) return null;

  const leftPadding = 55;
  const rightPadding = 15;
  const topPadding = 20;
  const bottomPadding = 20;
  const width = 600;
  const height = 180;

  const values = points.flatMap(p => [p.conservative, p.median, p.optimistic]);
  const maxVal = Math.max(...values);
  const minVal = Math.min(...values);
  const valRange = maxVal - minVal || 1.0;

  const yMax = maxVal + valRange * 0.05;
  const yMin = Math.max(0, minVal - valRange * 0.05);
  const yRange = yMax - yMin;

  const scaleX = (index) => leftPadding + (index * (width - leftPadding - rightPadding)) / (points.length - 1 || 1);
  const scaleY = (val) => height - bottomPadding - ((val - yMin) * (height - topPadding - bottomPadding)) / yRange;

  let medPath = '';
  let optPath = '';
  let consPath = '';

  points.forEach((p, idx) => {
    const x = scaleX(idx);
    if (idx === 0) {
      medPath += `M ${x} ${scaleY(p.median)}`;
      optPath += `M ${x} ${scaleY(p.optimistic)}`;
      consPath += `M ${x} ${scaleY(p.conservative)}`;
    } else {
      medPath += ` L ${x} ${scaleY(p.median)}`;
      optPath += ` L ${x} ${scaleY(p.optimistic)}`;
      consPath += ` L ${x} ${scaleY(p.conservative)}`;
    }
  });

  let areaD = optPath;
  for (let i = points.length - 1; i >= 0; i--) {
    areaD += ` L ${scaleX(i)} ${scaleY(points[i].conservative)}`;
  }
  areaD += ' Z';

  const gridLines = [];
  const gridCount = 3;
  for (let i = 0; i <= gridCount; i++) {
    gridLines.push(yMin + (yRange * i) / gridCount);
  }

  const stepsIndices = [0, Math.floor(points.length / 2), points.length - 1];

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg">
        <defs>
          <linearGradient id="mc-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity="0.15"/>
            <stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity="0.02"/>
          </linearGradient>
        </defs>

        {gridLines.map((yVal, idx) => (
          <g key={idx}>
            <line x1={leftPadding} y1={scaleY(yVal)} x2={width - rightPadding} y2={scaleY(yVal)} className="chart-grid-line" />
            <text x={leftPadding - 6} y={scaleY(yVal) + 3} textAnchor="end" className="chart-axis-text">${yVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</text>
          </g>
        ))}

        {points.length > 0 && <path d={areaD} fill="url(#mc-grad)" opacity="0.6" />}
        {points.length > 0 && <path d={optPath} className="chart-line" style={{ stroke: 'rgba(0, 229, 255, 0.4)', strokeDasharray: '2,2' }} />}
        {points.length > 0 && <path d={consPath} className="chart-line" style={{ stroke: 'rgba(255, 23, 68, 0.4)', strokeDasharray: '2,2' }} />}
        {points.length > 0 && <path d={medPath} className="chart-line portfolio" />}

        {stepsIndices.map((idx) => {
          if (idx >= points.length) return null;
          return (
            <text key={idx} x={scaleX(idx)} y={height - 4} textAnchor="middle" className="chart-axis-text">
              Day {points[idx].step}
            </text>
          );
        })}

        <line x1={leftPadding} y1={height - bottomPadding} x2={width - rightPadding} y2={height - bottomPadding} className="chart-axis-line" />
      </svg>
    </div>
  );
}

// --- Global Returns Bar Chart ---
function GlobalReturnsBarChart({ exchanges }) {
  if (!exchanges || exchanges.length === 0) return null;

  const leftPadding = 35;
  const rightPadding = 15;
  const topPadding = 15;
  const bottomPadding = 25;
  const width = 600;
  const height = 150;

  const changes = exchanges.map(e => e.change_percent);
  const maxVal = Math.max(...changes, 1.0);
  const minVal = Math.min(...changes, -1.0);
  const limit = Math.max(Math.abs(maxVal), Math.abs(minVal));

  const scaleX = (index) => leftPadding + (index * (width - leftPadding - rightPadding)) / exchanges.length;
  const scaleY = (val) => height / 2 - (val * (height / 2 - topPadding)) / limit;
  const zeroY = height / 2;

  const barWidth = Math.max(8, (width - leftPadding - rightPadding) / exchanges.length * 0.5);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg">
        <line x1={leftPadding} y1={zeroY} x2={width - rightPadding} y2={zeroY} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
        
        <line x1={leftPadding} y1={scaleY(limit)} x2={width - rightPadding} y2={scaleY(limit)} className="chart-grid-line" />
        <text x={leftPadding - 6} y={scaleY(limit) + 3} textAnchor="end" className="chart-axis-text">+{limit.toFixed(1)}%</text>

        <line x1={leftPadding} y1={scaleY(-limit)} x2={width - rightPadding} y2={scaleY(-limit)} className="chart-grid-line" />
        <text x={leftPadding - 6} y={scaleY(-limit) + 3} textAnchor="end" className="chart-axis-text">-{limit.toFixed(1)}%</text>
        <text x={leftPadding - 6} y={zeroY + 3} textAnchor="end" className="chart-axis-text">0.0%</text>

        {exchanges.map((ex, idx) => {
          const x = scaleX(idx) + (width - leftPadding - rightPadding) / exchanges.length / 2;
          const yVal = scaleY(ex.change_percent);
          const isUp = ex.change_percent >= 0;
          const barHeight = Math.max(2, Math.abs(zeroY - yVal));
          const yPos = isUp ? yVal : zeroY;

          return (
            <g key={ex.id}>
              <rect 
                x={x - barWidth / 2} 
                y={yPos} 
                width={barWidth} 
                height={barHeight} 
                fill={isUp ? "var(--color-green)" : "var(--color-red)"}
                opacity="0.75"
                rx="1"
              />
              <text 
                x={x} 
                y={isUp ? yPos - 3 : yPos + barHeight + 9} 
                textAnchor="middle" 
                style={{ fontSize: '7px', fill: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
              >
                {ex.change_percent >= 0 ? `+${ex.change_percent.toFixed(2)}` : ex.change_percent.toFixed(2)}
              </text>
              <text 
                x={x} 
                y={height - 4} 
                textAnchor="middle" 
                className="chart-axis-text"
                style={{ fontSize: '7.5px', fontWeight: '500' }}
              >
                {ex.id.toUpperCase().slice(0, 3)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// --- Main App Component ---




function MoverCardList({ title, movers, selectedMover, onSelect, emptyMessage }) {
  return (
    <div className="movers-list-section">
      <h3 className="movers-list-title">{title}</h3>
      {movers && movers.length > 0 ? (
        movers.map((m) => {
          const isUp = m.pct_change >= 0;
          const isSelected = selectedMover && selectedMover.ticker === m.ticker;
          return (
            <div
              key={m.ticker}
              className={`mover-card ${isSelected ? 'active' : ''}`}
              onClick={() => onSelect(m)}
            >
              <div className="mover-card-left">
                <span className="mover-symbol">{m.ticker}</span>
                <span className="mover-name">{m.info.longName}</span>
              </div>
              <div className="mover-card-right">
                <span className="mover-price">{m.close.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                <span className={isUp ? 'text-up font-weight-bold' : 'text-down font-weight-bold'} style={{ fontSize: '11px' }}>
                  {isUp ? `+${m.pct_change.toFixed(2)}%` : `${m.pct_change.toFixed(2)}%`}
                </span>
              </div>
            </div>
          );
        })
      ) : (
        <div className="text-muted" style={{ padding: '8px 4px', fontSize: '10px' }}>
          {emptyMessage}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [exchanges, setExchanges] = useState([]);
  const [selectedExId, setSelectedExId] = useState('nasdaq');
  const [activeTab, setActiveTab] = useState('overview');
  const [exchangeDetails, setExchangeDetails] = useState(null);
  const [selectedMover, setSelectedMover] = useState(null);
  
  const [correlationData, setCorrelationData] = useState(null);
  const [corrType, setCorrType] = useState('contemporaneous');
  const [macroData, setMacroData] = useState(null);
  const [overallReport, setOverallReport] = useState('');
  
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState(null);

  const [calendarEvents, setCalendarEvents] = useState([]);
  const [backtestAllocations, setBacktestAllocations] = useState([
    { ticker: 'AAPL', weight: 30 },
    { ticker: 'MSFT', weight: 30 },
    { ticker: 'GOOGL', weight: 20 },
    { ticker: 'AMZN', weight: 20 }
  ]);
  const [backtestResult, setBacktestResult] = useState(null);
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [backtestError, setBacktestError] = useState(null);
  const [transactionFee, setTransactionFee] = useState(10);
  const [slippage, setSlippage] = useState(0.1);
  const [backtestView, setBacktestView] = useState('historical');
  const [researchData, setResearchData] = useState(null);
  const [researchLoading, setResearchLoading] = useState(false);
  const [compareA, setCompareA] = useState('nasdaq');
  const [compareB, setCompareB] = useState('lse');



  useEffect(() => {
    fetchGlobalData();
  }, []);

  useEffect(() => {
    if (selectedExId && selectedExId !== 'global') {
      fetchExchangeDetails(selectedExId);
    }
  }, [selectedExId]);

  const fetchGlobalData = async () => {
    setLoadingOverview(true);
    setError(null);
    try {
      const resEx = await fetch(`${API_BASE}/exchanges`);
      if (!resEx.ok) throw new Error("Failed to fetch exchange overview");
      const dataEx = await resEx.json();
      setExchanges(dataEx.exchanges);

      const resCorr = await fetch(`${API_BASE}/correlation`);
      if (resCorr.ok) {
        const dataCorr = await resCorr.json();
        setCorrelationData(dataCorr);
      }

      const resMacro = await fetch(`${API_BASE}/macro`);
      if (resMacro.ok) {
        const dataMacro = await resMacro.json();
        setMacroData(dataMacro);
      }

      const resReport = await fetch(`${API_BASE}/report`);
      if (resReport.ok) {
        const dataRep = await resReport.json();
        setOverallReport(dataRep.report);
      }

      const resCal = await fetch(`${API_BASE}/calendar`);
      if (resCal.ok) {
        const dataCal = await resCal.json();
        setCalendarEvents(dataCal.events);
      }

      setResearchLoading(true);
      const resComp = await fetch(`${API_BASE}/research/comparison`);
      if (resComp.ok) {
        const dataComp = await resComp.json();
        setResearchData(dataComp);
      }
      setResearchLoading(false);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingOverview(false);
    }
  };

  const handleBacktest = async (e) => {
    if (e) e.preventDefault();
    const totalWeight = backtestAllocations.reduce((sum, a) => sum + parseFloat(a.weight || 0), 0);
    if (Math.abs(totalWeight - 100) > 0.01) {
      setBacktestError("Portfolio weights must sum to exactly 100%. Current total: " + totalWeight + "%");
      return;
    }

    setBacktestLoading(true);
    setBacktestError(null);
    try {
      const res = await fetch(`${API_BASE}/backtest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allocations: backtestAllocations
            .filter(a => a.ticker.trim() !== '')
            .map(a => ({ ticker: a.ticker.toUpperCase(), weight: parseFloat(a.weight) })),
          transaction_fee_bps: parseFloat(transactionFee || 0),
          slippage_pct: parseFloat(slippage || 0)
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Backtest calculation failed.");
      }
      const data = await res.json();
      setBacktestResult({
        ...data,
        metrics: {
          benchmark_return_pct: 0,
          alpha_pct: 0,
          beat_benchmark: false,
          ...data.metrics,
        },
      });
    } catch (err) {
      setBacktestError(err.message);
    } finally {
      setBacktestLoading(false);
    }
  };


  const fetchExchangeDetails = async (id) => {
    setLoadingDetails(true);
    try {
      const res = await fetch(`${API_BASE}/movers/${id}`);
      if (!res.ok) throw new Error(`Failed to load movers for ${id}`);
      const data = await res.json();
      setExchangeDetails(data);
      const defaultMover = (data.gainers && data.gainers.length > 0)
        ? data.gainers[0]
        : (data.losers && data.losers.length > 0)
          ? data.losers[0]
          : (data.movers && data.movers.length > 0)
            ? data.movers[0]
            : null;
      setSelectedMover(defaultMover);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetails(false);
    }
  };

  return (
    <div className="app-container">
      {/* 1. Header Bar */}
      <header className="header-bar">
        <div className="brand">
          <Activity className="brand-logo" size={20} />
          <h1 className="brand-title">Antigravity Global Stock Terminal</h1>
        </div>
        <div className="timezone-info" style={{ fontSize: '11px' }}>
          <span>Current Local Time: <span className="timezone-pill">{new Date().toLocaleTimeString('en-US', { hour12: false }) } IST</span></span>
        </div>
        <div className="persona-badge">
          <Compass size={11} />
          <span>Macro Research Division</span>
        </div>
      </header>

      {/* 2. Top Ticker Tape (13 Indices) */}
      <div className="ticker-tape">
        <div className="ticker-wrap">
          {exchanges.map((ex) => (
            <div 
              key={ex.id} 
              className="ticker-item" 
              onClick={() => {
                setSelectedExId(ex.id);
                setActiveTab('movers');
              }}
            >
              <span className="ticker-name">{EXCHANGE_DISPLAY_NAMES[ex.id]?.ticker || ex.name.split(' ')[0]}</span>
              <span className="ticker-price">{ex.price ? ex.price.toLocaleString() : 'N/A'}</span>
              <span className={`ticker-change ${ex.change_percent >= 0 ? 'text-up' : 'text-down'}`}>
                {ex.change_percent >= 0 ? `+${ex.change_percent.toFixed(2)}%` : `${ex.change_percent.toFixed(2)}%`}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Main content Layout */}
      <main className="main-content">
        {/* Left Sidebar */}
        <aside className="sidebar">
          <h2 className="sidebar-title">Global Markets</h2>
          <button 
            className={`exchange-btn ${selectedExId === 'global' && activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => {
              setSelectedExId('global');
              setActiveTab('overview');
            }}
          >
            <div className="exchange-btn-left">
              <Globe size={14} />
              <span>Overview & Correlation</span>
            </div>
          </button>

          <div style={{ height: '6px' }}></div>
          <h2 className="sidebar-title">Exchanges</h2>

          {exchanges.map((ex) => (
            <button
              key={ex.id}
              className={`exchange-btn ${selectedExId === ex.id && activeTab === 'movers' ? 'active' : ''}`}
              onClick={() => {
                setSelectedExId(ex.id);
                setActiveTab('movers');
              }}
            >
              <div className="exchange-btn-left">
                <span className={`status-dot ${ex.status === 'OPEN' ? 'open' : 'closed'}`}></span>
                <span>{EXCHANGE_DISPLAY_NAMES[ex.id]?.sidebar || ex.name}</span>
              </div>
              <span className={ex.change_percent >= 0 ? 'text-up font-mono' : 'text-down font-mono'} style={{ fontSize: '11px' }}>
                {ex.change_percent >= 0 ? `+${ex.change_percent}%` : `${ex.change_percent}%`}
              </span>
            </button>
          ))}
        </aside>

        {/* Center Workspace */}
        <section className="dashboard-workspace">
          {/* Tab nav */}
          <div className="tab-nav">
            <button 
              className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              <Globe size={14} />
              <span>Global Overview</span>
            </button>
            <button 
              className={`tab-btn ${activeTab === 'movers' ? 'active' : ''}`}
              onClick={() => setActiveTab('movers')}
            >
              <TrendingUp size={14} />
              <span>Daily Movers</span>
            </button>
            <button 
              className={`tab-btn ${activeTab === 'quant' ? 'active' : ''}`}
              onClick={() => setActiveTab('quant')}
            >
              <Activity size={14} style={{ color: 'var(--accent-cyan)' }} />
              <span>Quant Simulator</span>
            </button>
            <button 
              className={`tab-btn ${activeTab === 'research' ? 'active' : ''}`}
              onClick={() => setActiveTab('research')}
            >
              <Compass size={14} style={{ color: 'var(--color-amber)' }} />
              <span>Exchange Research</span>
            </button>
            <button 
              className={`tab-btn ${activeTab === 'fundamentals' ? 'active' : ''}`}
              onClick={() => setActiveTab('fundamentals')}
            >
              <Percent size={14} style={{ color: 'var(--accent-cyan)' }} />
              <span>Fundamental Analysis</span>
            </button>


          </div>

          {/* Connection Error Banner */}
          {error && (
            <div className="glass-panel" style={{ borderColor: 'var(--color-red)', marginBottom: '10px', display: 'flex', gap: '8px', alignItems: 'center', padding: '8px' }}>
              <AlertTriangle className="text-down" size={16} />
              <div style={{ fontSize: '12px' }}>
                <span className="text-down" style={{ fontWeight: '600' }}>Server Offline: </span>
                <span style={{ color: 'var(--text-secondary)' }}>Launch backend server to populate data.</span>
              </div>
            </div>
          )}

          {/* TAB 1: GLOBAL OVERVIEW */}
          {activeTab === 'overview' && !loadingOverview && (
            <div className="tab-content-container">
              {/* Macro Analysis */}
              <div className="glass-panel">
                <h2 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Compass size={13} className="text-up" />
                  Macro Regime & Timezone Spillovers
                </h2>
                <div 
                  className="academic-report" 
                  style={{ maxHeight: '300px', overflowY: 'auto', paddingRight: '4px', fontSize: '12.5px' }}
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(overallReport) }} 
                />
              </div>

              {/* Comparison Table */}
              <div className="glass-panel" style={{ padding: 0 }}>
                <div style={{ padding: '8px 12px' }}>
                  <h2 style={{ fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Info size={13} className="text-up" />
                    Global Stock Exchange Comparison Table
                  </h2>
                </div>
                <div className="comparison-table-wrapper">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Exchange</th>
                        <th>Index Price</th>
                        <th>Daily Change</th>
                        <th>Top Gainer</th>
                        <th>Top Loser</th>
                        <th>Trading Date</th>
                        <th>Local Time</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exchanges.map((ex) => (
                        <tr key={ex.id}>
                          <td style={{ fontWeight: '600' }}>{ex.name}</td>
                          <td className="mono">{ex.price ? ex.price.toLocaleString(undefined, { minimumFractionDigits: 2 }) : 'N/A'}</td>
                          <td className={`mono font-weight-bold ${ex.change_percent >= 0 ? 'text-up' : 'text-down'}`}>
                            {ex.change_percent >= 0 ? `+${ex.change_percent.toFixed(2)}%` : `${ex.change_percent.toFixed(2)}%`}
                          </td>
                          <td>
                            {ex.top_gainer ? (
                              <div className="table-mover-cell">
                                <span className="table-mover-ticker">{ex.top_gainer.ticker}</span>
                                <span className="text-up" style={{ fontSize: '11px' }}>+{ex.top_gainer.change_percent}%</span>
                              </div>
                            ) : '-'}
                          </td>
                          <td>
                            {ex.top_loser ? (
                              <div className="table-mover-cell">
                                <span className="table-mover-ticker">{ex.top_loser.ticker}</span>
                                <span className="text-down" style={{ fontSize: '11px' }}>{ex.top_loser.change_percent}%</span>
                              </div>
                            ) : '-'}
                          </td>
                          <td>{ex.trading_day}</td>
                          <td>{ex.local_time ? ex.local_time.split(' ')[1] : 'N/A'}</td>
                          <td>
                            <span className={`badge-${ex.status === 'OPEN' ? 'up' : 'down'}`} style={{ fontSize: '10px' }}>
                              {ex.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Correlation + bank rates + calendar + timezone spillovers */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div className="glass-panel">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <h2 style={{ fontSize: '12.5px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Activity size={12} className="text-up" />
                        Inter-Exchange Return Correlation Heatmap
                      </h2>
                      <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.02)', padding: '1px', borderRadius: '4px' }}>
                        <button 
                          className={`exchange-btn ${corrType === 'contemporaneous' ? 'active' : ''}`}
                          style={{ padding: '2px 5px', fontSize: '9.5px', height: '18px' }}
                          onClick={() => setCorrType('contemporaneous')}
                        >
                          Same-Day
                        </button>
                        <button 
                          className={`exchange-btn ${corrType === 'us_lagged' ? 'active' : ''}`}
                          style={{ padding: '2px 5px', fontSize: '9.5px', height: '18px' }}
                          onClick={() => setCorrType('us_lagged')}
                        >
                          US-Lagged
                        </button>
                        <button 
                          className={`exchange-btn ${corrType === 'cross_asset' ? 'active' : ''}`}
                          style={{ padding: '2px 5px', fontSize: '9.5px', height: '18px' }}
                          onClick={() => setCorrType('cross_asset')}
                        >
                          Cross-Asset
                        </button>
                      </div>
                    </div>
                    {correlationData && <CorrelationHeatmap matrix={correlationData[corrType]} />}
                  </div>
                  <TimezoneSpilloverNetwork exchanges={exchanges} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {/* Central Bank Policy Rates */}
                  <div className="glass-panel">
                    <h3 style={{ fontSize: '12px', fontWeight: '600', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Percent size={11} className="text-up" />
                      Central Bank Policy Rates
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                      {macroData && Object.entries(macroData.rates).map(([bank, rate]) => (
                        <div key={bank} style={{ background: 'rgba(255,255,255,0.008)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px 6px' }}>
                          <div style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>{bank}</div>
                          <div style={{ fontSize: '11px', fontWeight: '600', fontFamily: 'var(--font-mono)' }}>{rate}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Macro Headlines */}
                  <div className="glass-panel">
                    <h3 style={{ fontSize: '12px', fontWeight: '600', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Newspaper size={11} className="text-up" />
                      Macroeconomic Policy Headlines
                    </h3>
                    <div className="news-feed" style={{ maxHeight: '90px', overflowY: 'auto' }}>
                      {macroData && macroData.headlines.map((h, idx) => (
                        <div key={idx} className="news-item">
                          <span style={{ fontSize: '11.5px', fontWeight: '500', display: 'block', color: 'var(--text-primary)' }}>{h.title}</span>
                          <div className="news-meta" style={{ marginTop: '2px' }}>
                            <span>{h.source}</span>
                            <span>•</span>
                            <span>{h.time}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Economic Calendar */}
                  <EconomicCalendar events={calendarEvents} />
                </div>
              </div>
            </div>
          )}


          {/* TAB 2: DAILY MOVERS */}
          {activeTab === 'movers' && (
            <div style={{ flexGrow: 1, overflow: 'hidden', height: '100%' }}>
              {loadingDetails ? (
                <div className="loader-container">
                  <div className="spinner"></div>
                  <span className="loader-text">Loading top movers and calculating detailed volatility metrics...</span>
                </div>
              ) : (
                <div className="movers-grid">
                  {/* Left Movers Selection Column */}
                  <div className="movers-list">
                    <MoverCardList
                      title="Top Gainers"
                      movers={exchangeDetails?.gainers || exchangeDetails?.movers}
                      selectedMover={selectedMover}
                      onSelect={setSelectedMover}
                      emptyMessage="No gainers today."
                    />
                    <MoverCardList
                      title="Top Losers"
                      movers={exchangeDetails?.losers}
                      selectedMover={selectedMover}
                      onSelect={setSelectedMover}
                      emptyMessage="No losers today."
                    />
                  </div>

                  {/* Right Detail Panel */}
                  <div className="mover-detail-panel">
                    {selectedMover ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {/* Company Profile Header */}
                        <div className="glass-panel" style={{ padding: '8px 12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <h2 style={{ fontSize: '15px', fontWeight: '700' }}>
                                {selectedMover.info.longName} (<span className="mono">{selectedMover.ticker}</span>)
                              </h2>
                              <p style={{ color: 'var(--text-secondary)', fontSize: '10px', marginTop: '1px' }}>
                                Sector: <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{selectedMover.info.sector}</span> | Industry: <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{selectedMover.info.industry}</span>
                              </p>
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'right' }}>
                              <span>Stock trading date: <span className="mono text-up">{selectedMover.actual_trading_date}</span></span>
                            </div>
                          </div>
                          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: 1.35 }}>
                            {selectedMover.info.longBusinessSummary.slice(0, 240)}...
                          </p>
                        </div>

                        <FundamentalsPanel info={selectedMover.info} />

                        {/* Widescreen 3-Chart Column Layout */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                          {/* Price Candle */}
                          <div className="glass-panel" style={{ padding: '8px' }}>
                            <h3 style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Activity size={11} className="text-up" />
                              Intraday Candles (15m Price)
                            </h3>
                            <div className="chart-container-svg">
                              <LightweightCandlestickChart
                                points={selectedMover.intraday ? selectedMover.intraday.chart_points : []}
                                tradingDate={selectedMover.actual_trading_date}
                              />
                            </div>
                          </div>

                          {/* Volatility curve */}
                          <div className="glass-panel" style={{ padding: '8px' }}>
                            <h3 style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <TrendingUp size={11} className="text-up" />
                              Intraday Volatility Spread Curve (%)
                            </h3>
                            <div className="chart-container-svg">
                              <VolatilityLineChart points={selectedMover.intraday ? selectedMover.intraday.chart_points : []} />
                            </div>
                          </div>

                          {/* Daily Bollinger Bands & SMA Indicator Chart */}
                          <div className="glass-panel" style={{ padding: '8px' }}>
                            <h3 style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Activity size={11} style={{ color: 'var(--accent-blue)' }} />
                              Daily Bollinger Bands (20,2) & Close Trend
                            </h3>
                            <div className="chart-container-svg">
                              <LightweightTechnicalChart points={selectedMover.history_chart_points} />
                            </div>
                          </div>
                        </div>

                        {/* New Row: MACD & Volume Trend charts */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          {/* MACD Chart */}
                          <div className="glass-panel" style={{ padding: '8px' }}>
                            <h3 style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <TrendingUp size={11} className="text-up" />
                              MACD Trend (Line & Divergence Histogram)
                            </h3>
                            <div className="chart-container-svg">
                              <LightweightMACDChart points={selectedMover.macd_history} />
                            </div>
                          </div>

                          {/* Volume Chart */}
                          <div className="glass-panel" style={{ padding: '8px' }}>
                            <h3 style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Activity size={11} style={{ color: 'var(--accent-cyan)' }} />
                              Daily Volume vs 30-Day Avg Volume (SMA)
                            </h3>
                            <div className="chart-container-svg">
                              <VolumeChart points={selectedMover.volume_history} />
                            </div>
                          </div>
                        </div>

                        {/* Volatility pills and Technical indicators (RSI Gauge added) */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
                          {/* Volatility & Spreads (Annualized HV, Vol Ratio, Volume Spread added) */}
                          <div className="glass-panel" style={{ padding: '8px 12px' }}>
                            <h3 style={{ fontSize: '11.5px', fontWeight: '600', marginBottom: '6px' }}>Volatility & Advanced Spreads Metrics</h3>
                            <div className="metrics-pill-grid">
                              <div className="metric-pill">
                                <span className="metric-pill-label">Max Volatility</span>
                                <span className="metric-pill-value text-up">
                                  {selectedMover.intraday ? `${selectedMover.intraday.max_vol.toFixed(3)}%` : 'N/A'}
                                </span>
                              </div>
                              <div className="metric-pill">
                                <span className="metric-pill-label">Min Volatility</span>
                                <span className="metric-pill-value">
                                  {selectedMover.intraday ? `${selectedMover.intraday.min_vol.toFixed(3)}%` : 'N/A'}
                                </span>
                              </div>
                              <div className="metric-pill">
                                <span className="metric-pill-label">Volatility Spread</span>
                                <span className="metric-pill-value" style={{ color: 'var(--accent-cyan)' }}>
                                  {selectedMover.volatility_spread_pct.toFixed(3)}%
                                </span>
                              </div>
                              <div className="metric-pill">
                                <span className="metric-pill-label">Vol Ratio (Max/Min)</span>
                                <span className="metric-pill-value">
                                  {selectedMover.intraday ? `${(selectedMover.intraday.max_vol / Math.max(0.01, selectedMover.intraday.min_vol)).toFixed(2)}x` : 'N/A'}
                                </span>
                              </div>
                              <div className="metric-pill">
                                <span className="metric-pill-label">20d Ann. Hist Vol (HV)</span>
                                <span className="metric-pill-value text-down">
                                  {selectedMover.historical_volatility_20d_ann ? `${selectedMover.historical_volatility_20d_ann}%` : 'N/A'}
                                </span>
                              </div>
                              <div className="metric-pill">
                                <span className="metric-pill-label">Volume Ratio (20d SMA)</span>
                                <span className="metric-pill-value" style={{ color: selectedMover.volume_spread_index >= 1.5 ? 'var(--color-green)' : 'var(--text-primary)' }}>
                                  {selectedMover.volume_spread_index ? `${selectedMover.volume_spread_index}x` : 'N/A'}
                                </span>
                              </div>
                              <div className="metric-pill">
                                <span className="metric-pill-label">Beta (vs. Benchmark)</span>
                                <span className="metric-pill-value" style={{ color: 'var(--accent-blue)' }}>
                                  {selectedMover.beta !== null && selectedMover.beta !== undefined ? selectedMover.beta : 'N/A'}
                                </span>
                              </div>
                              <div className="metric-pill">
                                <span className="metric-pill-label">Sharpe Ratio (Ann.)</span>
                                <span className="metric-pill-value" style={{ color: selectedMover.sharpe_ratio >= 1.0 ? 'var(--color-green)' : selectedMover.sharpe_ratio < 0 ? 'var(--color-red)' : 'var(--text-primary)' }}>
                                  {selectedMover.sharpe_ratio !== null && selectedMover.sharpe_ratio !== undefined ? selectedMover.sharpe_ratio : 'N/A'}
                                </span>
                              </div>
                              <div className="metric-pill">
                                <span className="metric-pill-label">Garman-Klass Vol</span>
                                <span className="metric-pill-value text-down">
                                  {selectedMover.garman_klass_vol_pct !== null && selectedMover.garman_klass_vol_pct !== undefined ? `${selectedMover.garman_klass_vol_pct}%` : 'N/A'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Technical Indicators with RSI Gauge Meter */}
                          <div className="glass-panel" style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <h3 style={{ fontSize: '11.5px', fontWeight: '600' }}>Technical Indicators (Daily)</h3>
                            
                            <RSIGauge rsi={selectedMover.technical_indicators.rsi} />
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '2px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.008)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px 6px' }}>
                                <span style={{ fontSize: '8px', color: 'var(--text-muted)' }}>Bollinger Bands (20, 2)</span>
                                <span style={{ fontSize: '10.5px', fontWeight: '600', fontFamily: 'var(--font-mono)' }}>
                                  {selectedMover.technical_indicators.bollinger_upper ? `${selectedMover.technical_indicators.bollinger_lower} - ${selectedMover.technical_indicators.bollinger_upper}` : 'N/A'}
                                </span>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.008)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px 6px' }}>
                                <span style={{ fontSize: '8px', color: 'var(--text-muted)' }}>MACD Hist</span>
                                <span style={{ fontSize: '11px', fontWeight: '600', fontFamily: 'var(--font-mono)' }}>
                                  {selectedMover.technical_indicators.macd_hist ? selectedMover.technical_indicators.macd_hist : 'N/A'}
                                </span>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gridColumn: 'span 2', background: 'rgba(255,255,255,0.008)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px 6px' }}>
                                <span style={{ fontSize: '8px', color: 'var(--text-muted)' }}>20/50/200 Day SMA Trends</span>
                                <span style={{ fontSize: '11px', fontWeight: '600', fontFamily: 'var(--font-mono)' }}>
                                  {selectedMover.technical_indicators.sma_20 ? `${selectedMover.technical_indicators.sma_20} / ${selectedMover.technical_indicators.sma_50} / ${selectedMover.technical_indicators.sma_200}` : 'N/A'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* New Row: Sentiment NLP Analyzer & Algorithmic Signals */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '10px' }}>
                          <SentimentAnalysisPanel sentiment={selectedMover.sentiment_analysis} />
                          <AlgorithmicSignalsPanel signals={selectedMover.trading_signals} />
                        </div>

                        {/* Prior Sessions & News catalyst with date fix */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '10px' }}>

                          {/* Prior Sessions */}
                          <div className="glass-panel" style={{ padding: '8px 12px' }}>
                            <h3 style={{ fontSize: '11.5px', fontWeight: '600', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Calendar size={11} className="text-up" />
                              Prior Two Trading Sessions
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div style={{ background: 'rgba(255,255,255,0.008)', border: '1px solid var(--border-color)', padding: '5px 8px', borderRadius: '4px' }}>
                                <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: '600' }}>T-1 Session: {selectedMover.t_minus_1.date}</div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                                  <span>Close: <strong>{selectedMover.t_minus_1.close ? selectedMover.t_minus_1.close : 'N/A'}</strong></span>
                                  <span>High: {selectedMover.t_minus_1.high ? selectedMover.t_minus_1.high : 'N/A'}</span>
                                  <span>Low: {selectedMover.t_minus_1.low ? selectedMover.t_minus_1.low : 'N/A'}</span>
                                </div>
                              </div>

                              <div style={{ background: 'rgba(255,255,255,0.008)', border: '1px solid var(--border-color)', padding: '5px 8px', borderRadius: '4px' }}>
                                <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: '600' }}>T-2 Session: {selectedMover.t_minus_2.date}</div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                                  <span>Close: <strong>{selectedMover.t_minus_2.close ? selectedMover.t_minus_2.close : 'N/A'}</strong></span>
                                  <span>High: {selectedMover.t_minus_2.high ? selectedMover.t_minus_2.high : 'N/A'}</span>
                                  <span>Low: {selectedMover.t_minus_2.low ? selectedMover.t_minus_2.low : 'N/A'}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* News Catalysts */}
                          <div className="glass-panel" style={{ padding: '8px 12px' }}>
                            <h3 style={{ fontSize: '11.5px', fontWeight: '600', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Newspaper size={11} className="text-up" />
                              Catalyst News & Wires
                            </h3>
                            <div className="news-feed" style={{ maxHeight: '90px', overflowY: 'auto' }}>
                              {selectedMover.news && selectedMover.news.length > 0 ? (
                                selectedMover.news.slice(0, 3).map((n, idx) => (
                                  <div key={idx} className="news-item">
                                    <a href={n.link} target="_blank" rel="noreferrer" className="news-title" style={{ fontSize: '12px' }}>{n.title}</a>
                                    <div className="news-meta">
                                      <span>{n.publisher}</span>
                                      <span>•</span>
                                      <span>{n.publish_time}</span>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div className="text-muted text-center" style={{ paddingTop: '20px', fontSize: '11px' }}>No catalysts found on wires</div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Mover Academic Commentary with source links */}
                        <div className="glass-panel" style={{ padding: '8px 12px' }}>
                          <h2 style={{ fontSize: '12.5px', fontWeight: '600', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Info size={13} className="text-up" />
                            Expert Analyst & Academic Commentary ({exchangeDetails.exchange_name})
                          </h2>
                          <div 
                            className="academic-report" 
                            style={{ paddingRight: '4px', fontSize: '12.5px' }}
                            dangerouslySetInnerHTML={{ __html: renderMarkdown(exchangeDetails.expert_opinion) }} 
                          />
                        </div>

                      </div>
                    ) : (
                      <div className="text-muted text-center" style={{ paddingTop: '80px', fontSize: '11px' }}>
                        No stock details selected
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: QUANT PORTFOLIO SIMULATOR */}
          {activeTab === 'quant' && (
            <div className="tab-content-container" style={{ flexGrow: 1, overflowY: 'auto', paddingRight: '4px' }}>
              <div className="glass-panel" style={{ marginBottom: '10px' }}>
                <h2 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Activity size={13} className="text-up" />
                  Institutional Portfolio Backtester & Risk Simulator
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '11px', marginBottom: '4px' }}>
                  Simulate risk metrics, Sharpe/Sortino ratios, slippage, and max drawdown of your custom multi-asset portfolio compared against the S&P 500 index.
                </p>
              </div>

              <div className="backtest-container">
                {/* Left Form Panel */}
                <div className="glass-panel backtest-setup-panel">
                  <h3 style={{ fontSize: '11.5px', fontWeight: '600', marginBottom: '6px' }}>Portfolio Allocations</h3>
                  
                  <form onSubmit={handleBacktest} className="backtest-form">
                    {backtestAllocations.map((alloc, idx) => (
                      <div key={idx} className="backtest-row">
                        <input 
                          type="text" 
                          placeholder="Ticker (e.g. AAPL)" 
                          className="backtest-input backtest-input-ticker"
                          value={alloc.ticker}
                          onChange={(e) => {
                            const newAlloc = [...backtestAllocations];
                            newAlloc[idx].ticker = e.target.value;
                            setBacktestAllocations(newAlloc);
                          }}
                          required
                        />
                        <input 
                          type="number" 
                          placeholder="Weight %" 
                          className="backtest-input backtest-input-weight"
                          value={alloc.weight}
                          min="0"
                          max="100"
                          step="any"
                          onChange={(e) => {
                            const newAlloc = [...backtestAllocations];
                            newAlloc[idx].weight = e.target.value;
                            setBacktestAllocations(newAlloc);
                          }}
                          required
                        />
                        {backtestAllocations.length > 1 && (
                          <button 
                            type="button" 
                            className="btn-icon" 
                            onClick={() => {
                              setBacktestAllocations(backtestAllocations.filter((_, i) => i !== idx));
                            }}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px', borderTop: '1px solid var(--border-color)', paddingTop: '6px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <label style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>Execution Fee (bps)</label>
                        <input 
                          type="number" 
                          placeholder="bps"
                          className="backtest-input"
                          value={transactionFee}
                          min="0"
                          max="200"
                          onChange={(e) => setTransactionFee(e.target.value)}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <label style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>Slippage Penalty (%)</label>
                        <input 
                          type="number" 
                          placeholder="%"
                          className="backtest-input"
                          value={slippage}
                          min="0"
                          max="5"
                          step="0.05"
                          onChange={(e) => setSlippage(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="backtest-action-row" style={{ marginTop: '8px' }}>
                      <button 
                        type="button" 
                        className="btn-secondary"
                        onClick={() => {
                          setBacktestAllocations([...backtestAllocations, { ticker: '', weight: '' }]);
                        }}
                      >
                        + Add Asset
                      </button>
                      <button 
                        type="submit" 
                        className="btn-primary" 
                        disabled={backtestLoading}
                      >
                        {backtestLoading ? "Simulating..." : "Run Simulator"}
                      </button>
                    </div>
                  </form>

                  {backtestError && (
                    <div className="text-down" style={{ fontSize: '11px', marginTop: '6px', padding: '6px', background: 'rgba(255,23,68,0.1)', border: '1px solid rgba(255,23,68,0.2)', borderRadius: '4px' }}>
                      {backtestError}
                    </div>
                  )}

                  {backtestResult && backtestResult.metrics && (
                    <div style={{ marginTop: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                      <h4 style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Simulation Results</h4>
                      <div className="backtest-metrics-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        <div className="backtest-metric-card">
                          <span className="backtest-metric-label">Cumulative Return</span>
                          <span className={`backtest-metric-value ${backtestResult.metrics.cumulative_return_pct >= 0 ? 'text-up' : 'text-down'}`}>
                            {backtestResult.metrics.cumulative_return_pct >= 0 ? `+${backtestResult.metrics.cumulative_return_pct}%` : `${backtestResult.metrics.cumulative_return_pct}%`}
                          </span>
                        </div>
                        <div className="backtest-metric-card">
                          <span className="backtest-metric-label">S&P 500 Return</span>
                          <span className={`backtest-metric-value ${(backtestResult.metrics.benchmark_return_pct ?? 0) >= 0 ? 'text-up' : 'text-down'}`}>
                            {(backtestResult.metrics.benchmark_return_pct ?? 0) >= 0 ? `+${backtestResult.metrics.benchmark_return_pct}%` : `${backtestResult.metrics.benchmark_return_pct}%`}
                          </span>
                        </div>
                        <div className="backtest-metric-card">
                          <span className="backtest-metric-label">Alpha vs Benchmark</span>
                          <span className={`backtest-metric-value ${(backtestResult.metrics.alpha_pct ?? 0) >= 0 ? 'text-up' : 'text-down'}`}>
                            {(backtestResult.metrics.alpha_pct ?? 0) >= 0 ? `+${backtestResult.metrics.alpha_pct}%` : `${backtestResult.metrics.alpha_pct}%`}
                          </span>
                        </div>
                        <div className="backtest-metric-card">
                          <span className="backtest-metric-label">Beat S&P 500?</span>
                          <span className={`backtest-metric-value ${backtestResult.metrics.beat_benchmark ? 'text-up' : 'text-down'}`}>
                            {backtestResult.metrics.beat_benchmark ? 'Yes' : 'No'}
                          </span>
                        </div>
                        <div className="backtest-metric-card">
                          <span className="backtest-metric-label">Sharpe Ratio (Ann.)</span>
                          <span className="backtest-metric-value" style={{ color: 'var(--accent-cyan)' }}>
                            {backtestResult.metrics.sharpe_ratio ? backtestResult.metrics.sharpe_ratio.toFixed(2) : '0.00'}
                          </span>
                        </div>
                        <div className="backtest-metric-card">
                          <span className="backtest-metric-label">Sortino Ratio (Ann.)</span>
                          <span className="backtest-metric-value text-up">
                            {backtestResult.metrics.sortino_ratio ? backtestResult.metrics.sortino_ratio.toFixed(2) : '0.00'}
                          </span>
                        </div>
                        <div className="backtest-metric-card">
                          <span className="backtest-metric-label">Treynor Ratio (Ann.)</span>
                          <span className="backtest-metric-value" style={{ color: 'var(--accent-blue)' }}>
                            {backtestResult.metrics.treynor_ratio ? backtestResult.metrics.treynor_ratio.toFixed(4) : '0.0000'}
                          </span>
                        </div>
                        <div className="backtest-metric-card">
                          <span className="backtest-metric-label">Value at Risk (VaR 95%)</span>
                          <span className="backtest-metric-value text-down">
                            {backtestResult.metrics.var_95_pct ? `${backtestResult.metrics.var_95_pct.toFixed(2)}%` : '0.00%'}
                          </span>
                        </div>
                        <div className="backtest-metric-card">
                          <span className="backtest-metric-label">Expected Shortfall (CVaR)</span>
                          <span className="backtest-metric-value text-down">
                            {backtestResult.metrics.cvar_95_pct ? `${backtestResult.metrics.cvar_95_pct.toFixed(2)}%` : '0.00%'}
                          </span>
                        </div>
                        <div className="backtest-metric-card">
                          <span className="backtest-metric-label">Max Drawdown</span>
                          <span className="backtest-metric-value text-down">
                            {backtestResult.metrics.max_drawdown_pct ? backtestResult.metrics.max_drawdown_pct.toFixed(2) : '0.00'}%
                          </span>
                        </div>
                        <div className="backtest-metric-card">
                          <span className="backtest-metric-label">Portfolio Volatility</span>
                          <span className="backtest-metric-value text-down">
                            {backtestResult.metrics.portfolio_volatility_pct ? backtestResult.metrics.portfolio_volatility_pct.toFixed(2) : '0.00'}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Chart Panel */}
                <div className="glass-panel backtest-results-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '300px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <h3 style={{ fontSize: '11.5px', fontWeight: '600' }}>Portfolio Projections</h3>
                      {backtestResult && (
                        <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.02)', padding: '1px', borderRadius: '4px' }}>
                          <button 
                            className={`exchange-btn ${backtestView === 'historical' ? 'active' : ''}`}
                            style={{ padding: '2px 5px', fontSize: '9.5px', height: '18px' }}
                            onClick={() => setBacktestView('historical')}
                          >
                            Historical
                          </button>
                          <button 
                            className={`exchange-btn ${backtestView === 'montecarlo' ? 'active' : ''}`}
                            style={{ padding: '2px 5px', fontSize: '9.5px', height: '18px' }}
                            onClick={() => setBacktestView('montecarlo')}
                          >
                            Monte Carlo (1y)
                          </button>
                        </div>
                      )}
                    </div>
                    {backtestResult && (
                      <div style={{ display: 'flex', gap: '10px', fontSize: '9px' }}>
                        {backtestView === 'historical' ? (
                          <>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ width: '8px', height: '8px', background: 'var(--accent-cyan)', display: 'inline-block', borderRadius: '2px' }}></span>
                              Portfolio
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ width: '8px', height: '8px', border: '1px dashed var(--text-muted)', display: 'inline-block', borderRadius: '2px' }}></span>
                              S&P 500 Benchmark
                            </span>
                          </>
                        ) : (
                          <>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ width: '8px', height: '8px', background: 'var(--accent-cyan)', display: 'inline-block', borderRadius: '2px' }}></span>
                              Median Path
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ width: '8px', height: '8px', background: 'rgba(0, 229, 255, 0.45)', display: 'inline-block', borderRadius: '2px' }}></span>
                              90% Band
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ width: '8px', height: '8px', background: 'rgba(255, 23, 68, 0.45)', display: 'inline-block', borderRadius: '2px' }}></span>
                              10% Band
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {backtestResult ? (
                      backtestView === 'historical' ? (
                        <LightweightBacktestChart points={backtestResult.chart_points} />
                      ) : (
                        <MonteCarloChart points={backtestResult.monte_carlo} />
                      )
                    ) : (
                      <div className="text-muted text-center" style={{ fontSize: '11px' }}>
                        Set allocations and execute the simulation model to view equity path.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Stress Testing Section */}
              {backtestResult && backtestResult.stress_tests && (
                <div className="glass-panel" style={{ marginTop: '10px' }}>
                  <h3 style={{ fontSize: '11.5px', fontWeight: '600', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <AlertTriangle size={12} className="text-down" />
                    Macroeconomic Historical Shock Stress Testing Models
                  </h3>
                  <table className="custom-table" style={{ fontSize: '11px' }}>
                    <thead>
                      <tr>
                        <th>Shock Event</th>
                        <th>Crisis Period</th>
                        <th>Simulated Drawdown</th>
                        <th>Simulated Performance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {backtestResult.stress_tests.map((s, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: '600' }}>{s.name}</td>
                          <td className="mono">{s.period}</td>
                          <td className="mono text-down" style={{ fontWeight: '600' }}>-{Math.abs(s.max_drawdown_pct).toFixed(2)}%</td>
                          <td className={`mono ${s.return_pct >= 0 ? 'text-up' : 'text-down'}`} style={{ fontWeight: '600' }}>
                            {s.return_pct >= 0 ? `+${s.return_pct.toFixed(2)}%` : `${s.return_pct.toFixed(2)}%`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: EXCHANGE DEEP RESEARCH */}
          {activeTab === 'research' && (
            <div className="tab-content-container" style={{ flexGrow: 1, overflowY: 'auto', paddingRight: '4px' }}>
              <div className="glass-panel" style={{ marginBottom: '10px' }}>
                <h2 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Compass size={13} className="text-up" />
                  Exchange Research & Deep Comparison Analytics
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '11px', marginBottom: '4px' }}>
                  Perform side-by-side macro profiling, correlation comparisons, timezone session crossovers, and historical index volatility scans.
                </p>
              </div>

              {researchLoading ? (
                <div className="loader-container">
                  <div className="spinner"></div>
                  <span className="loader-text">Downloading and computing 45-day historical volatility data across global indices...</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  
                  {/* Selector Header */}
                  <div className="glass-panel" style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11.5px', fontWeight: '600' }}>Compare Exchange A:</span>
                      <select 
                        className="backtest-input" 
                        value={compareA} 
                        onChange={(e) => setCompareA(e.target.value)}
                        style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: '#fff', fontSize: '11px', padding: '3px 8px', borderRadius: '4px' }}
                      >
                        {exchanges.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
                      </select>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11.5px', fontWeight: '600' }}>with Exchange B:</span>
                      <select 
                        className="backtest-input" 
                        value={compareB} 
                        onChange={(e) => setCompareB(e.target.value)}
                        style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: '#fff', fontSize: '11px', padding: '3px 8px', borderRadius: '4px' }}
                      >
                        {exchanges.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Comparator Side by Side */}
                  {researchData && researchData[compareA] && researchData[compareB] && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      {/* Exchange A Details */}
                      <div className="glass-panel">
                        <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', marginBottom: '8px' }}>
                          <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--accent-cyan)' }}>{exchanges.find(e => e.id === compareA)?.name}</h3>
                          <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Index Ticker: <strong>{exchanges.find(e => e.id === compareA)?.index_ticker}</strong></span>
                        </div>
                        <div className="comparison-table-wrapper" style={{ maxHeight: 'none' }}>
                          <table className="custom-table" style={{ fontSize: '11.5px' }}>
                            <tbody>
                              <tr><td>Index Value</td><td className="mono">{exchanges.find(e => e.id === compareA)?.price?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td></tr>
                              <tr><td>Daily Change</td><td className={`mono ${exchanges.find(e => e.id === compareA)?.change_percent >= 0 ? 'text-up' : 'text-down'}`}>{exchanges.find(e => e.id === compareA)?.change_percent}%</td></tr>
                              <tr><td>45d Volatility (Ann.)</td><td className="mono text-down">{researchData[compareA].volatility_45d}%</td></tr>
                              <tr><td>45d Cumulative Performance</td><td className={`mono ${researchData[compareA].return_45d >= 0 ? 'text-up' : 'text-down'}`}>{researchData[compareA].return_45d}%</td></tr>
                              <tr><td>Market Status</td><td><span className={`badge-${exchanges.find(e => e.id === compareA)?.status === 'OPEN' ? 'up' : 'down'}`}>{exchanges.find(e => e.id === compareA)?.status}</span></td></tr>
                              <tr><td>Country / Region</td><td>{researchData[compareA].country}</td></tr>
                              <tr><td>Base Currency</td><td className="mono">{researchData[compareA].currency}</td></tr>
                              <tr><td>Central Bank</td><td>{researchData[compareA].central_bank} (Rate: {researchData[compareA].rate})</td></tr>
                              <tr><td>Timezone GMT Offset</td><td className="mono">{researchData[compareA].utc_offset}</td></tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Exchange B Details */}
                      <div className="glass-panel">
                        <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', marginBottom: '8px' }}>
                          <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--accent-cyan)' }}>{exchanges.find(e => e.id === compareB)?.name}</h3>
                          <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Index Ticker: <strong>{exchanges.find(e => e.id === compareB)?.index_ticker}</strong></span>
                        </div>
                        <div className="comparison-table-wrapper" style={{ maxHeight: 'none' }}>
                          <table className="custom-table" style={{ fontSize: '11.5px' }}>
                            <tbody>
                              <tr><td>Index Value</td><td className="mono">{exchanges.find(e => e.id === compareB)?.price?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td></tr>
                              <tr><td>Daily Change</td><td className={`mono ${exchanges.find(e => e.id === compareB)?.change_percent >= 0 ? 'text-up' : 'text-down'}`}>{exchanges.find(e => e.id === compareB)?.change_percent}%</td></tr>
                              <tr><td>45d Volatility (Ann.)</td><td className="mono text-down">{researchData[compareB].volatility_45d}%</td></tr>
                              <tr><td>45d Cumulative Performance</td><td className={`mono ${researchData[compareB].return_45d >= 0 ? 'text-up' : 'text-down'}`}>{researchData[compareB].return_45d}%</td></tr>
                              <tr><td>Market Status</td><td><span className={`badge-${exchanges.find(e => e.id === compareB)?.status === 'OPEN' ? 'up' : 'down'}`}>{exchanges.find(e => e.id === compareB)?.status}</span></td></tr>
                              <tr><td>Country / Region</td><td>{researchData[compareB].country}</td></tr>
                              <tr><td>Base Currency</td><td className="mono">{researchData[compareB].currency}</td></tr>
                              <tr><td>Central Bank</td><td>{researchData[compareB].central_bank} (Rate: {researchData[compareB].rate})</td></tr>
                              <tr><td>Timezone GMT Offset</td><td className="mono">{researchData[compareB].utc_offset}</td></tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Correlation Coefficient and Overlaps */}
                  {correlationData && correlationData.contemporaneous && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
                      <div className="glass-panel">
                        <h3 style={{ fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>Macroeconomic Overlap & Return Correlation</h3>
                        <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginTop: '10px' }}>
                          <div style={{ flex: 1, background: 'rgba(255,255,255,0.008)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '10px', textAlign: 'center' }}>
                            <span style={{ fontSize: '9px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Contemporaneous (Same-Day) Correlation</span>
                            <div style={{ fontSize: '26px', fontWeight: '800', color: 'var(--color-green)', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
                              {correlationData.contemporaneous[compareA]?.[compareB] !== undefined 
                                ? correlationData.contemporaneous[compareA][compareB].toFixed(4)
                                : '0.0000'}
                            </div>
                          </div>
                          
                           <div style={{ flex: 1, background: 'rgba(255,255,255,0.008)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '10px', textAlign: 'center' }}>
                            <span style={{ fontSize: '9px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>US-Lagged (Transmission) Correlation</span>
                            <div style={{ fontSize: '26px', fontWeight: '800', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
                              {correlationData.us_lagged[compareA]?.[compareB] !== undefined 
                                ? correlationData.us_lagged[compareA][compareB].toFixed(4)
                                : correlationData.us_lagged[compareB]?.[compareA] !== undefined
                                  ? correlationData.us_lagged[compareB][compareA].toFixed(4)
                                  : 'N/A'}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="glass-panel">
                        <h3 style={{ fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>Session Overlap Partners</h3>
                        <p style={{ fontSize: '10.5px', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                          Major exchanges sharing operational overlaps with selected indices:
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                          {researchData[compareA]?.overlap.map(o => (
                            <span key={o} className="buzzword-tag" style={{ color: 'var(--accent-cyan)', borderColor: 'rgba(0, 229, 255, 0.15)', background: 'rgba(0, 229, 255, 0.02)' }}>
                              {o.toUpperCase()}
                            </span>
                          ))}
                          {researchData[compareB]?.overlap.map(o => (
                            <span key={o} className="buzzword-tag" style={{ color: 'var(--color-amber)', borderColor: 'rgba(255, 179, 0, 0.15)', background: 'rgba(255, 179, 0, 0.02)' }}>
                              {o.toUpperCase()}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Global Comparison Chart */}
                  <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ fontSize: '12px', fontWeight: '600', marginBottom: '8px' }}>Global Exchange Session Returns Rank</h3>
                    <div style={{ height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <GlobalReturnsBarChart exchanges={exchanges} />
                    </div>
                  </div>

                </div>
              )}
            </div>
          )}

          {/* TAB 5: FUNDAMENTAL ANALYSIS */}
          {activeTab === 'fundamentals' && (
            <FundamentalsTab apiBase={API_BASE} />
          )}
        </section>

      </main>
    </div>
  );
}
