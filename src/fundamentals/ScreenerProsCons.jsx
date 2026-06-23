import React from 'react';

export default function ScreenerProsCons({ pros, cons, companyName }) {
  if ((!pros || pros.length === 0) && (!cons || cons.length === 0)) return null;

  return (
    <div>
      {companyName && (
        <h4 style={{ fontSize: '11px', fontWeight: '600', marginBottom: '8px' }}>{companyName}</h4>
      )}
      <div className="fund-pros-cons">
        {pros?.length > 0 && (
          <div className="fund-pros-box">
            <h4 style={{ fontSize: '11px', fontWeight: '600', marginBottom: '6px' }}>Pros</h4>
            <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '10px', lineHeight: 1.5 }}>
              {pros.map((item) => (
                <li key={item} style={{ marginBottom: '4px' }}>{item}</li>
              ))}
            </ul>
          </div>
        )}
        {cons?.length > 0 && (
          <div className="fund-cons-box">
            <h4 style={{ fontSize: '11px', fontWeight: '600', marginBottom: '6px' }}>Cons</h4>
            <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '10px', lineHeight: 1.5 }}>
              {cons.map((item) => (
                <li key={item} style={{ marginBottom: '4px' }}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
