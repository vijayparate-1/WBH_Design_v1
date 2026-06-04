'use client';
// src/components/modules/ValidationCasesTab.tsx
// 25-case validation suite against HYSYS / certified datasheets

import { useState } from 'react';

interface VCase {
  ref: string; desc: string; region: string;
  Ti: number; To: number; P: number; flow: number;
  Q_ref: number; Q_src: string;
  y: number[]; // mol fractions (14-component)
}

// Mol fraction arrays: [CH4, C2H6, C3H8, iC4, nC4, iC5, nC5, nC6, nC7, N2, CO2, H2S, He, H2]
const N = (arr: Record<number,number>) => {
  const a = new Array(14).fill(0);
  Object.entries(arr).forEach(([k, v]) => { a[parseInt(k)] = v; });
  const s = a.reduce((x,y)=>x+y,0);
  return a.map(v => s > 0 ? v/s : v);
};

const CASES: VCase[] = [
  // Australian
  { ref:'AUS-01', desc:'Bass Strait city gate — max flow', region:'Australia',
    Ti:10, To:38.5, P:6890, flow:26335, Q_ref:565, Q_src:'DS Q13048 Rev2 ✓',
    y:N({0:0.880,1:0.075,2:0.018,3:0.003,4:0.003,9:0.016,10:0.005}) },
  { ref:'AUS-02', desc:'Bass Strait city gate — min flow', region:'Australia',
    Ti:10, To:44.4, P:8800, flow:2953, Q_ref:80, Q_src:'DS Q10928 Rev0 ✓',
    y:N({0:0.880,1:0.075,2:0.018,3:0.003,4:0.003,9:0.016,10:0.005}) },
  { ref:'AUS-03', desc:'Donnybrook city gate', region:'Australia',
    Ti:10, To:44.9, P:8800, flow:22457, Q_ref:621, Q_src:'DS Q12896 Rev2 ✓',
    y:N({0:0.909,1:0.052,2:0.007,4:0.001,6:0.001,9:0.009,10:0.021}) },
  { ref:'AUS-04', desc:'Newman Power Station 102 barg', region:'Australia',
    Ti:15, To:53.9, P:10200, flow:33264, Q_ref:1040, Q_src:'DS Q10417 Rev3 ✓',
    y:N({0:0.880,1:0.075,2:0.018,3:0.003,4:0.003,9:0.016,10:0.005}) },
  { ref:'AUS-05', desc:'Cooper Basin — rich gas', region:'Australia',
    Ti:12, To:45, P:5500, flow:8000, Q_ref:195, Q_src:'HYSYS estimate',
    y:N({0:0.785,1:0.093,2:0.042,3:0.011,4:0.018,5:0.005,9:0.022,10:0.024}) },
  { ref:'AUS-06', desc:'Surat Basin CSG — lean', region:'Australia',
    Ti:8, To:35, P:3500, flow:12000, Q_ref:148, Q_src:'HYSYS estimate',
    y:N({0:0.972,1:0.005,2:0.001,9:0.018,10:0.004}) },
  { ref:'AUS-07', desc:'Kurri Kurri power station', region:'Australia',
    Ti:9, To:65, P:1500, flow:135052, Q_ref:6795, Q_src:'DS Q12971 ✓',
    y:N({0:0.909,1:0.052,2:0.007,4:0.001,6:0.001,9:0.009,10:0.021}) },
  // SE Asia
  { ref:'SEA-01', desc:'Sarawak — CO2 4%', region:'SE Asia',
    Ti:15, To:38, P:4500, flow:15000, Q_ref:285, Q_src:'HYSYS estimate',
    y:N({0:0.885,1:0.035,2:0.012,4:0.002,9:0.026,10:0.040}) },
  { ref:'SEA-02', desc:'Natuna field — CO2 12%', region:'SE Asia',
    Ti:20, To:45, P:6000, flow:25000, Q_ref:520, Q_src:'HYSYS estimate',
    y:N({0:0.750,1:0.045,2:0.018,9:0.027,10:0.120,11:0.040}) },
  { ref:'SEA-03', desc:'Malaysia pipeline — medium pressure', region:'SE Asia',
    Ti:18, To:40, P:5800, flow:18000, Q_ref:310, Q_src:'HYSYS estimate',
    y:N({0:0.882,1:0.040,2:0.015,4:0.003,9:0.028,10:0.032}) },
  // Middle East
  { ref:'ME-01', desc:'Ruwais LNG — 214 barg', region:'Middle East',
    Ti:7.5, To:26.6, P:21407, flow:70000, Q_ref:3522, Q_src:'DS Q11435 ✓',
    y:N({0:0.900,1:0.060,2:0.020,9:0.015,10:0.005}) },
  { ref:'ME-02', desc:'Saudi rich gas — 80 barg', region:'Middle East',
    Ti:10, To:45, P:8000, flow:40000, Q_ref:1120, Q_src:'HYSYS estimate',
    y:N({0:0.730,1:0.105,2:0.051,3:0.018,4:0.026,5:0.012,9:0.028,10:0.030}) },
  { ref:'ME-03', desc:'Sour gas — H2S 3.5% / CO2 5%', region:'Middle East',
    Ti:15, To:50, P:7500, flow:20000, Q_ref:580, Q_src:'HYSYS estimate',
    y:N({0:0.795,1:0.055,2:0.018,9:0.047,10:0.050,11:0.035}) },
  // New Zealand
  { ref:'NZ-01', desc:'Maui / Pohokura sales gas', region:'NZ',
    Ti:8, To:38, P:4200, flow:9500, Q_ref:178, Q_src:'HYSYS estimate',
    y:N({0:0.889,1:0.058,2:0.013,4:0.002,9:0.026,10:0.012}) },
  // Low pressure
  { ref:'LP-01', desc:'Low pressure — 10 barg distribution', region:'Generic',
    Ti:5, To:30, P:1100, flow:3000, Q_ref:28, Q_src:'HYSYS estimate',
    y:N({0:0.920,1:0.045,2:0.015,4:0.003,9:0.012,10:0.005}) },
  { ref:'LP-02', desc:'Residential distribution — 350 kPa', region:'Generic',
    Ti:5, To:25, P:350, flow:800, Q_ref:5.8, Q_src:'HYSYS estimate',
    y:N({0:0.920,1:0.045,2:0.015,4:0.003,9:0.012,10:0.005}) },
  // High pressure
  { ref:'HP-01', desc:'High pressure transmission — 120 barg', region:'Generic',
    Ti:12, To:48, P:12100, flow:45000, Q_ref:1380, Q_src:'HYSYS estimate',
    y:N({0:0.909,1:0.052,2:0.007,4:0.001,9:0.009,10:0.021}) },
  { ref:'HP-02', desc:'Very high pressure — 150 barg', region:'Generic',
    Ti:8, To:40, P:15100, flow:60000, Q_ref:1720, Q_src:'HYSYS estimate',
    y:N({0:0.920,1:0.040,2:0.015,9:0.015,10:0.010}) },
  // Cold climate
  { ref:'CC-01', desc:'Cold climate inlet — -20°C inlet', region:'Cold Climate',
    Ti:-20, To:10, P:7000, flow:5000, Q_ref:128, Q_src:'HYSYS estimate',
    y:N({0:0.900,1:0.050,2:0.015,4:0.003,9:0.020,10:0.012}) },
  { ref:'CC-02', desc:'Arctic inlet — -35°C inlet', region:'Cold Climate',
    Ti:-35, To:5, P:8500, flow:3500, Q_ref:115, Q_src:'HYSYS estimate',
    y:N({0:0.900,1:0.050,2:0.015,4:0.003,9:0.020,10:0.012}) },
  // Mining/Power
  { ref:'POW-01', desc:'Gas turbine fuel — power station', region:'Power',
    Ti:10, To:70, P:2500, flow:8500, Q_ref:265, Q_src:'HYSYS estimate',
    y:N({0:0.920,1:0.040,2:0.015,4:0.003,9:0.012,10:0.010}) },
  { ref:'POW-02', desc:'Peaker plant — rapid start', region:'Power',
    Ti:5, To:55, P:3500, flow:15000, Q_ref:375, Q_src:'HYSYS estimate',
    y:N({0:0.909,1:0.052,2:0.007,4:0.001,9:0.009,10:0.021}) },
  // Edge cases
  { ref:'EDG-01', desc:'Lean methane — 99% CH4', region:'Edge Case',
    Ti:5, To:40, P:7000, flow:5000, Q_ref:140, Q_src:'HYSYS estimate',
    y:N({0:0.990,9:0.005,10:0.005}) },
  { ref:'EDG-02', desc:'Heavy gas — C3/C4 rich', region:'Edge Case',
    Ti:15, To:45, P:1500, flow:2000, Q_ref:165, Q_src:'HYSYS estimate',
    y:N({0:0.500,1:0.150,2:0.180,3:0.050,4:0.080,5:0.020,10:0.020}) },
  { ref:'EDG-03', desc:'Very low flow — instrument gas', region:'Edge Case',
    Ti:10, To:50, P:700, flow:200, Q_ref:2.8, Q_src:'HYSYS estimate',
    y:N({0:0.950,1:0.030,9:0.015,10:0.005}) },
];

type RunResult = VCase & { Q_calc: number; error_pct: number; status: 'PASS' | 'WARN' | 'FAIL' | 'PENDING' };

export default function ValidationCasesTab() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<RunResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [filter, setFilter] = useState('ALL');

  const runAll = async () => {
    setRunning(true);
    setProgress(0);
    const out: RunResult[] = [];

    for (let i = 0; i < CASES.length; i++) {
      const c = CASES[i];
      try {
        const res = await fetch('/api/calculations/stage1', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({
            composition: c.y,
            T_in_C: c.Ti, T_out_C: c.To,
            P_kPa: c.P, dP_kPa: 50,
            massFlow_kgh: c.flow,
            basisMethod: c.P > 10000 ? 7 : c.P > 5000 ? 6 : 5,
            T_design_C: Math.max(c.To + 20, 100),
            P_design_kPa: c.P * 1.1,
          }),
        });
        const data = await res.json();
        if (data.success) {
          const Q_calc = data.results.Q_final;
          const err = ((Q_calc - c.Q_ref) / c.Q_ref) * 100;
          out.push({
            ...c, Q_calc,
            error_pct: err,
            status: Math.abs(err) <= 3 ? 'PASS' : Math.abs(err) <= 8 ? 'WARN' : 'FAIL',
          });
        } else {
          out.push({ ...c, Q_calc: 0, error_pct: 999, status: 'FAIL' });
        }
      } catch {
        out.push({ ...c, Q_calc: 0, error_pct: 999, status: 'FAIL' });
      }
      setProgress(i + 1);
      setResults([...out]);
      await new Promise(r => setTimeout(r, 50)); // allow UI update
    }
    setRunning(false);
  };

  const filtered = filter === 'ALL' ? results : results.filter(r =>
    filter === 'FAIL' ? r.status === 'FAIL' || r.status === 'WARN' :
    filter === 'PASS' ? r.status === 'PASS' :
    r.region === filter
  );

  const stats = results.length > 0 ? {
    pass: results.filter(r => r.status === 'PASS').length,
    warn: results.filter(r => r.status === 'WARN').length,
    fail: results.filter(r => r.status === 'FAIL').length,
    avgErr: (results.reduce((s, r) => s + Math.abs(r.error_pct), 0) / results.length).toFixed(2),
    maxErr: Math.max(...results.map(r => Math.abs(r.error_pct))).toFixed(1),
  } : null;

  const REGIONS = ['ALL', 'Australia', 'SE Asia', 'Middle East', 'NZ', 'Power', 'Cold Climate', 'Edge Case', 'PASS', 'FAIL'];

  return (
    <div>
      <div className="section-title">Validation Cases — 25-Case Suite</div>

      <div style={{ display:'flex', gap:10, marginBottom:16, alignItems:'center', flexWrap:'wrap' }}>
        <button className="btn btn-primary" onClick={runAll} disabled={running}>
          {running ? `⏳ Running ${progress}/${CASES.length}…` : `▶ Run All ${CASES.length} Validation Cases`}
        </button>
        {running && (
          <div style={{ background:'var(--panel2)', borderRadius:4, height:8, width:200, overflow:'hidden', border:'1px solid var(--border)' }}>
            <div style={{ background:'var(--accent)', height:'100%', width:`${progress/CASES.length*100}%`, transition:'width 0.2s' }} />
          </div>
        )}
        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
          {REGIONS.map(r => (
            <button key={r} onClick={() => setFilter(r)}
              style={{ padding:'4px 10px', border:'1px solid', borderRadius:4, cursor:'pointer', fontSize:11,
                borderColor: filter === r ? 'var(--accent)' : 'var(--border)',
                background: filter === r ? 'rgba(176,96,0,0.1)' : 'var(--panel2)',
                color: filter === r ? 'var(--accent)' : 'var(--text-dim)',
              }}>{r}</button>
          ))}
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10, marginBottom:16 }}>
          <div className="result-card green">
            <div className="result-label">PASS (≤3%)</div>
            <div className="result-value" style={{ color:'var(--green)' }}>{stats.pass}</div>
          </div>
          <div className="result-card highlight">
            <div className="result-label">WARN (3–8%)</div>
            <div className="result-value" style={{ color:'var(--accent)' }}>{stats.warn}</div>
          </div>
          <div className="result-card red">
            <div className="result-label">FAIL (&gt;8%)</div>
            <div className="result-value" style={{ color:'var(--red)' }}>{stats.fail}</div>
          </div>
          <div className="result-card">
            <div className="result-label">Avg |Error|</div>
            <div className="result-value">{stats.avgErr}%</div>
          </div>
          <div className="result-card">
            <div className="result-label">Max |Error|</div>
            <div className="result-value">{stats.maxErr}%</div>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ overflowX:'auto' }}>
        <table className="res-table" style={{ fontSize:11 }}>
          <thead>
            <tr>
              <th>Ref</th><th>Description</th><th>Region</th>
              <th>Ti→To °C</th><th>P kPa</th><th>Flow kg/hr</th>
              <th>Q_ref kW</th><th>Q_calc kW</th><th>Error%</th>
              <th>Status</th><th>Source</th>
            </tr>
          </thead>
          <tbody>
            {(results.length > 0 ? filtered : CASES.map(c => ({ ...c, Q_calc:0, error_pct:0, status:'PENDING' as const }))).map(r => (
              <tr key={r.ref} style={{
                background: r.status === 'PASS' ? 'rgba(14,122,62,0.04)' :
                            r.status === 'FAIL' ? 'rgba(192,40,40,0.04)' :
                            r.status === 'WARN' ? 'rgba(176,96,0,0.04)' : undefined
              }}>
                <td style={{ fontFamily:'var(--mono)', fontWeight:700, fontSize:10 }}>{r.ref}</td>
                <td>{r.desc}</td>
                <td style={{ fontSize:10 }}>{r.region}</td>
                <td style={{ fontFamily:'var(--mono)' }}>{r.Ti}→{r.To}</td>
                <td style={{ fontFamily:'var(--mono)' }}>{r.P.toLocaleString()}</td>
                <td style={{ fontFamily:'var(--mono)' }}>{r.flow.toLocaleString()}</td>
                <td className="val">{r.Q_ref.toFixed(1)}</td>
                <td className="val2">{r.Q_calc > 0 ? r.Q_calc.toFixed(1) : '—'}</td>
                <td style={{
                  fontFamily:'var(--mono)', fontWeight:700,
                  color: r.status === 'PASS' ? 'var(--green)' :
                         r.status === 'WARN' ? 'var(--accent)' :
                         r.status === 'FAIL' ? 'var(--red)' : 'var(--text-dim)',
                }}>
                  {r.Q_calc > 0 ? `${r.error_pct > 0 ? '+' : ''}${r.error_pct.toFixed(1)}%` : '—'}
                </td>
                <td>
                  {r.status !== 'PENDING' ? (
                    <span style={{
                      fontSize:10, padding:'2px 6px', borderRadius:3, fontWeight:700,
                      background: r.status === 'PASS' ? 'rgba(14,122,62,0.12)' :
                                  r.status === 'WARN' ? 'rgba(176,96,0,0.12)' : 'rgba(192,40,40,0.12)',
                      color: r.status === 'PASS' ? 'var(--green)' :
                             r.status === 'WARN' ? 'var(--accent)' : 'var(--red)',
                    }}>{r.status}</span>
                  ) : <span style={{ fontSize:10, color:'var(--text-dim)' }}>—</span>}
                </td>
                <td style={{ fontSize:10, color: r.Q_src.includes('✓') ? 'var(--green)' : 'var(--text-dim)' }}>
                  {r.Q_src}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="note-box" style={{ marginTop:12, fontSize:10 }}>
        <strong>Validation methodology:</strong> PASS ≤3%, WARN 3–8%, FAIL &gt;8% deviation from reference.
        Certified datasheet cases (✓) are validated against stamped engineering documents.
        HYSYS estimates use PR-EOS with van der Waals mixing. Method auto-selection: M5 &lt;5000 kPa, M6 5000–10000 kPa, M7 Lee-Kesler &gt;10000 kPa.
      </div>
    </div>
  );
}
