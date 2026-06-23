import React from 'react';
import { screenerUrl } from '../fundamentalsFormatters';

export default function ScreenerPeersPanel({ result, slots, onAddPeer, onAddAllPeers }) {
  const peers = result?.data?.peers;
  if (!peers?.length) return null;

  const usedTickers = new Set(slots.map((s) => (s.ticker || '').toUpperCase()));
  const canAddMore = slots.length < 5;
  const addablePeers = peers.filter((p) => p.symbol && !usedTickers.has(p.symbol));

  const ratioKeys = peers.length
    ? Object.keys(peers[0]).filter((k) => !['name', 'symbol', 'url'].includes(k))
    : [];

  return (
    <div className="glass-panel" style={{ padding: '10px 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <h4 style={{ fontSize: '11px', fontWeight: '600' }}>
          Peers — {result.data.name}
        </h4>
        {canAddMore && addablePeers.length > 0 && (
          <button type="button" className="btn-secondary fund-peer-actions" onClick={() => onAddAllPeers(addablePeers)}>
            Add all peers
          </button>
        )}
      </div>
      <div className="comparison-table-wrapper fund-table-scroll">
        <table className="custom-table" style={{ fontSize: '11px' }}>
          <thead>
            <tr>
              <th>Company</th>
              {ratioKeys.slice(0, 4).map((k) => <th key={k}>{k}</th>)}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {peers.map((peer) => (
              <tr key={peer.name}>
                <td>
                  {peer.url ? (
                    <a href={peer.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-cyan)' }}>
                      {peer.name}
                    </a>
                  ) : peer.name}
                </td>
                {ratioKeys.slice(0, 4).map((k) => (
                  <td key={k} className="mono">{peer[k] ?? '—'}</td>
                ))}
                <td>
                  {peer.symbol && canAddMore && !usedTickers.has(peer.symbol) && (
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ fontSize: '10px', padding: '2px 6px' }}
                      onClick={() => onAddPeer(peer.symbol)}
                    >
                      Add
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {result.data.symbol && (
        <p style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '6px' }}>
          Source: <a href={screenerUrl(result.data.symbol)} target="_blank" rel="noreferrer">Screener.in peers</a>
        </p>
      )}
    </div>
  );
}
