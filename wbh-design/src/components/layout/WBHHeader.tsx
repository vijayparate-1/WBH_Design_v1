'use client';
// src/components/layout/WBHHeader.tsx

interface WBHHeaderProps {
  version?: string;
}

export default function WBHHeader({ version = 'v28 · Next.js + Neon DB' }: WBHHeaderProps) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #0d1a2a 0%, #162438 40%, #1a2e44 70%, #0d1a2a 100%)',
      borderBottom: '3px solid var(--accent)',
      padding: '14px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky', top: 0, zIndex: 100,
      boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 6,
          background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg viewBox="0 0 44 44" width="44" height="44" xmlns="http://www.w3.org/2000/svg">
            <rect x="6" y="28" width="32" height="10" rx="3" fill="#2a5a8a" stroke="#4a8abf" strokeWidth="1"/>
            <rect x="10" y="20" width="24" height="10" rx="2" fill="#1a4a7a" stroke="#3a7aaf" strokeWidth="1"/>
            <rect x="17" y="10" width="10" height="12" rx="2" fill="#0a3a6a" stroke="#2a6a9f" strokeWidth="1"/>
            <path d="M22 6 Q24 8 22 10 Q20 8 22 6" fill="#f07000" opacity="0.9"/>
            <path d="M19 12 Q21 14 19 16 Q17 14 19 12" fill="#f04000" opacity="0.7"/>
            <path d="M25 12 Q27 14 25 16 Q23 14 25 12" fill="#f04000" opacity="0.7"/>
            <ellipse cx="22" cy="40" rx="14" ry="3" fill="#1a6ca8" opacity="0.5"/>
          </svg>
        </div>
        <div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 20, letterSpacing: 1 }}>
            Water Bath Heater Design Module
          </div>
          <div style={{ color: '#a8bfcf', fontSize: 11, fontFamily: 'var(--mono)', letterSpacing: 2 }}>
            API 12K · GPSA §9 · AS 1228 · ASME B31.3 · Australian Operations
          </div>
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 10,
          background: 'rgba(240,165,0,0.15)', border: '1px solid var(--accent)',
          color: 'var(--accent)', padding: '4px 10px', borderRadius: 3, letterSpacing: 1,
        }}>
          REV K — {version}
        </div>
        <div style={{ color: '#6a8faf', fontSize: 9, fontFamily: 'var(--mono)', letterSpacing: 1, marginTop: 4 }}>
          PR-EOS M5 · GPSA BIPs · 25-Case Validation
        </div>
      </div>
    </div>
  );
}
