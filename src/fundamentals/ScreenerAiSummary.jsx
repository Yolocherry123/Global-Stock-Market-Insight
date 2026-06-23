import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { fetchFundamentalsSummary } from './fundamentalsApi';

export default function ScreenerAiSummary({ apiBase, tickers, disabled }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const generate = async () => {
    if (!tickers?.length) return;
    setLoading(true);
    setError(null);
    try {
      const json = await fetchFundamentalsSummary(apiBase, tickers);
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel fund-ai-summary" style={{ padding: '10px 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <h3 style={{ fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Sparkles size={13} className="text-up" />
          AI Fundamental Analysis
        </h3>
        <button
          type="button"
          className="btn-primary"
          disabled={disabled || loading || !tickers?.length}
          onClick={generate}
          style={{ fontSize: '10px', padding: '4px 10px' }}
        >
          {loading ? 'Analyzing...' : data ? 'Regenerate' : 'Generate analysis'}
        </button>
      </div>

      {error && (
        <p className="text-down" style={{ fontSize: '11px', marginTop: '8px' }}>{error}</p>
      )}

      {data && (
        <div style={{ marginTop: '10px' }}>
          <p style={{ fontSize: '11px', lineHeight: 1.5, marginBottom: '8px' }}>{data.summary}</p>
          {data.highlights?.length > 0 && (
            <>
              <h4 style={{ fontSize: '10px', fontWeight: '600', color: 'var(--color-green)', marginBottom: '4px' }}>Highlights</h4>
              <ul style={{ margin: '0 0 8px', paddingLeft: '16px', fontSize: '10px', lineHeight: 1.5 }}>
                {data.highlights.map((h) => <li key={h}>{h}</li>)}
              </ul>
            </>
          )}
          {data.risks?.length > 0 && (
            <>
              <h4 style={{ fontSize: '10px', fontWeight: '600', color: 'var(--color-red)', marginBottom: '4px' }}>Risks</h4>
              <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '10px', lineHeight: 1.5 }}>
                {data.risks.map((r) => <li key={r}>{r}</li>)}
              </ul>
            </>
          )}
          <p className="text-muted" style={{ fontSize: '9px', marginTop: '6px' }}>
            Source: {data.source === 'gemini' ? 'Gemini AI' : 'Rule-based fallback'}
          </p>
        </div>
      )}

      {!data && !loading && !error && (
        <p className="text-muted" style={{ fontSize: '10px', marginTop: '8px' }}>
          On-demand AI summary of ratios, growth, and pros/cons. Requires GEMINI_API_KEY on the server for full analysis.
        </p>
      )}
    </div>
  );
}
