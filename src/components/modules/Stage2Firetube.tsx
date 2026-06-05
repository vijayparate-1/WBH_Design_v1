'use client';
// src/components/modules/Stage2Firetube.tsx
// Stage 2 — Firetube & Stack Sizing (API 12K / AS 3814)
// v5 — firetube cross-section sketch, all fixes applied

import { useState } from 'react';
import ValidationPanel from '@/components/ui/ValidationPanel';
import { ResultCard, ResultGrid } from '@/components/ui/ResultCard';
import type { Stage1Results } from '@/lib/calculations/thermodynamics';

// ANSI/ASME B36.10M — Combustion Tubes (light wall for heat transfer)
const INTERNAL_PIPE_TABLE = [
  { dn:150, od:168.3, thickness:3.40, label:'DN150 (6") Sch 10'  },
  { dn:200, od:219.1, thickness:4.78, label:'DN200 (8") Sch 10'  },
  { dn:250, od:273.1, thickness:4.78, label:'DN250 (10") Sch 10' },
  { dn:300, od:323.9, thickness:4.78, label:'DN300 (12") Sch 10' },
  { dn:350, od:355.6, thickness:6.35, label:'DN350 (14") Sch 20' },
  { dn:400, od:406.4, thickness:6.35, label:'DN400 (16") Sch 20' },
  { dn:450, od:457.0, thickness:6.35, label:'DN450 (18") Sch 20' },
  { dn:500, od:508.0, thickness:6.35, label:'DN500 (20") Sch 20' },
];

interface Props {
  s1Results?: Stage1Results;
  onComplete?: (results: any) => void;
}

interface S2Form {
  Q_net: string; draftType: string;
  efficiency: string; burnerFactor: string;
  nPass: string; tubeLen: string; pipeDN: number;
  Tbath: string;
  stackAlt: string; stackTamb: string; stackTflue: string;
  excessAir: string; stackHeight: string; stackDia: string;
  nBurners: string;
}

const DEFAULT_S2: S2Form = {
  Q_net:'400', draftType:'natural',
  efficiency:'80', burnerFactor:'1.15',
  nPass:'2', tubeLen:'4.0', pipeDN:400,
  Tbath:'62',
  stackAlt:'0', stackTamb:'15', stackTflue:'450',
  excessAir:'22.5', stackHeight:'4.0', stackDia:'355',
  nBurners:'2',
};

// ─── FIRETUBE PASS SKETCH ────────────────────────────────────────────────────
// Generates SVG diagram of 2-pass or 4-pass firetube layout
// Accurate to original v28 HTML (pc = pipe colour, tc = text colour)
function FiretubeSVG({ nPass, L, od_mm, nBurners }: {
  nPass: number; L: number; od_mm: number; nBurners: number;
}) {
  const pc = '#c47d00';  // pipe/tube colour
  const tc = '#5a6e88';  // annotation colour
  const fc = '#e05000';  // flame colour
  const rBend = Math.max(18, od_mm * 0.06);  // bend radius in SVG units
  const W = 380, legW = 260;
  const legSpacing = Math.max(20, Math.min(32, (80 / Math.max(nPass, 2))));
  const H = nPass === 2 ? 90 : 130;
  const x1 = 48, x2 = x1 + legW;
  const tubeStroke = Math.max(5, Math.min(12, od_mm / 30));

  // Build multiple burner assemblies side by side
  const burnerXs = nBurners === 2
    ? [x1 - 30, x1 - 30]
    : [x1 - 30];

  // Pass Y positions
  const passYs: number[] = [];
  for (let i = 0; i < nPass; i++) {
    passYs.push(20 + i * legSpacing);
  }

  let paths = '';

  if (nPass === 2) {
    // 2-pass U-tube
    paths = `
      <line x1="${x1}" y1="${passYs[0]}" x2="${x2}" y2="${passYs[0]}" stroke="${pc}" stroke-width="${tubeStroke}" stroke-linecap="round"/>
      <path d="M${x2} ${passYs[0]} A${rBend} ${rBend} 0 0 1 ${x2} ${passYs[1]}" fill="none" stroke="${pc}" stroke-width="${tubeStroke}"/>
      <line x1="${x1}" y1="${passYs[1]}" x2="${x2}" y2="${passYs[1]}" stroke="${pc}" stroke-width="${tubeStroke - 1}" stroke-linecap="round"/>
      <text x="${x1 + legW/2}" y="${passYs[0] - 6}" text-anchor="middle" fill="${tc}" font-size="9" font-family="monospace">Pass 1 — ${L.toFixed(1)} m</text>
      <text x="${x1 + legW/2}" y="${passYs[1] + 16}" text-anchor="middle" fill="${tc}" font-size="9" font-family="monospace">Pass 2 — ${L.toFixed(1)} m</text>
      <text x="${x2 + rBend + 4}" y="${(passYs[0]+passYs[1])/2 + 3}" fill="${pc}" font-size="8" font-family="monospace">r=1.5D</text>
    `;
  } else {
    // 4-pass chained
    paths = `
      <line x1="${x1}" y1="${passYs[0]}" x2="${x2}" y2="${passYs[0]}" stroke="${pc}" stroke-width="${tubeStroke}" stroke-linecap="round"/>
      <path d="M${x2} ${passYs[0]} A${rBend} ${rBend} 0 0 1 ${x2} ${passYs[1]}" fill="none" stroke="${pc}" stroke-width="${tubeStroke}"/>
      <line x1="${x1}" y1="${passYs[1]}" x2="${x2}" y2="${passYs[1]}" stroke="${pc}" stroke-width="${tubeStroke-1}" stroke-linecap="round"/>
      <path d="M${x1} ${passYs[1]} A${rBend} ${rBend} 0 0 0 ${x1} ${passYs[2]}" fill="none" stroke="${pc}" stroke-width="${tubeStroke-1}"/>
      <line x1="${x1}" y1="${passYs[2]}" x2="${x2}" y2="${passYs[2]}" stroke="${pc}" stroke-width="${tubeStroke-2}" stroke-linecap="round"/>
      <path d="M${x2} ${passYs[2]} A${rBend} ${rBend} 0 0 1 ${x2} ${passYs[3]}" fill="none" stroke="${pc}" stroke-width="${tubeStroke-2}"/>
      <line x1="${x1}" y1="${passYs[3]}" x2="${x2}" y2="${passYs[3]}" stroke="${pc}" stroke-width="${tubeStroke-3}" stroke-linecap="round"/>
      ${[0,1,2,3].map(i => `<text x="${x1+legW/2}" y="${passYs[i] + (i%2===0 ? -6 : 14)}" text-anchor="middle" fill="${tc}" font-size="8" font-family="monospace">P${i+1} — ${L.toFixed(1)} m</text>`).join('')}
    `;
  }

  // Flame symbols at burner inlets
  const flamesSVG = Array.from({length: nBurners}, (_, bi) => {
    const burnerX = nBurners === 1
      ? x1 - 28
      : x1 - 28 + bi * (passYs[1] - passYs[0]);
    const flameY = passYs[0];
    return `
      <polygon points="${burnerX},${flameY+8} ${burnerX-6},${flameY+18} ${burnerX},${flameY+14} ${burnerX+6},${flameY+18}" fill="${fc}" opacity="0.85"/>
      <text x="${burnerX}" y="${flameY+28}" text-anchor="middle" fill="${fc}" font-size="8" font-family="monospace">B${bi+1}</text>
    `;
  }).join('');

  // Flow direction arrows
  const arrows = `
    <text x="${x1 - 2}" y="${passYs[0] + 4}" text-anchor="end" fill="${tc}" font-size="9" font-family="monospace">IN→</text>
    <text x="${x1 - 2}" y="${passYs[nPass-1] + 4}" text-anchor="end" fill="${tc}" font-size="9" font-family="monospace">←OUT</text>
  `;

  // Dimension line at top
  const dimLine = `
    <line x1="${x1}" y1="8" x2="${x2}" y2="8" stroke="${tc}" stroke-width="0.8" marker-start="url(#arr)" marker-end="url(#arr)"/>
    <text x="${x1 + legW/2}" y="6" text-anchor="middle" fill="${tc}" font-size="9" font-family="monospace">L = ${L.toFixed(2)} m</text>
  `;

  return (
    <div>
      <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:1,
        color:'var(--text-dim)', marginBottom:4 }}>
        Firetube Layout — {nPass}-Pass {nBurners > 1 ? `(${nBurners} Burners)` : ''}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', background:'#0d1520', borderRadius:4 }}>
        <defs>
          <marker id="arr" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 Z" fill="#5a6e88"/>
          </marker>
        </defs>
        <g dangerouslySetInnerHTML={{ __html: paths + flamesSVG + arrows + dimLine }} />
      </svg>
    </div>
  );
}

// ─── DRAFT BUOYANCY MONITOR ──────────────────────────────────────────────────
function DraftBuoyancyMonitor({ available, required }: { available: number; required: number }) {
  if (!isFinite(available) || !isFinite(required) || available <= 0) return null;
  const maxVal = Math.max(available, required, 5.0) * 1.2;
  const W = 320, H = 60, pL = 10, pR = 10;
  const sc = (v: number) => pL + (v / maxVal) * (W - pL - pR);
  return (
    <div style={{ marginTop:10, borderTop:'1px solid var(--border)', paddingTop:10 }}>
      <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', color:'var(--text-dim)', marginBottom:6 }}>
        Natural Draft Balance [Pa]
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%' }}>
        <rect x={pL} y={10} width={sc(required) - pL} height={12} fill="var(--red)" opacity={0.6} rx={2}/>
        <text x={sc(required)+4} y={20} fontSize={9} fill="var(--text-dim)" fontFamily="monospace">{required.toFixed(1)} Pa Required</text>
        <rect x={pL} y={28} width={sc(available) - pL} height={12}
          fill={available >= required ? 'var(--green)' : 'var(--red)'} opacity={0.8} rx={2}/>
        <text x={sc(available)+4} y={38} fontSize={9} fontFamily="monospace" fontWeight={700}
          fill={available >= required ? 'var(--green)' : 'var(--red)'}>
          {available.toFixed(1)} Pa Available
        </text>
      </svg>
    </div>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function Stage2Firetube({ s1Results, onComplete }: Props) {
  const [form, setForm] = useState<S2Form>(DEFAULT_S2);
  const [results, setResults] = useState<any | null>(null);
  const [validation, setValidation] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k: keyof S2Form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  // Auto-populate Q from Stage 1 result
  const syncFromS1 = () => {
    if (!s1Results) return;
    setForm(f => ({
      ...f,
      Q_net: s1Results.Q_final.toFixed(1),
      excessAir: '22.5',
    }));
  };

  const calculate = async () => {
    setLoading(true); setError('');
    try {
      const pipe = INTERNAL_PIPE_TABLE.find(p => p.dn === form.pipeDN)
        ?? INTERNAL_PIPE_TABLE[3];
      const payload = {
        Q_duty_kW: parseFloat(form.Q_net),
        efficiency_pct: parseFloat(form.efficiency),
        burnerFactor: parseFloat(form.burnerFactor),
        nBurners: parseInt(form.nBurners),
        nPass: parseInt(form.nPass),
        L: parseFloat(form.tubeLen),
        T_bath_C: parseFloat(form.Tbath),
        pipe: { dn: pipe.dn, od: pipe.od, wt: pipe.thickness },
        stack: {
          altitude_m: parseFloat(form.stackAlt),
          T_amb_C: parseFloat(form.stackTamb),
          T_flue_C: parseFloat(form.stackTflue),
          excessAir_pct: parseFloat(form.excessAir),
          height_m: parseFloat(form.stackHeight),
          dia_mm: parseFloat(form.stackDia),
          draft_type: form.draftType,
        },
      };
      const res = await fetch('/api/calculations/stage2', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setResults(data.results);
        setValidation(data.validation);
        onComplete?.(data.results);
      } else {
        setError(data.error ?? 'Stage 2 calculation failed');
      }
    } catch (e) { setError(String(e)); }
    setLoading(false);
  };

  const allValidation = [
    ...(validation?.firetube?.messages ?? []),
    ...(validation?.stack?.messages ?? []),
  ];

  const f1 = (v?: number) => v !== undefined && isFinite(v) ? v.toFixed(1) : '—';
  const f2 = (v?: number) => v !== undefined && isFinite(v) ? v.toFixed(2) : '—';

  const selectedPipe = INTERNAL_PIPE_TABLE.find(p => p.dn === form.pipeDN) ?? INTERNAL_PIPE_TABLE[3];

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

      {/* ── LEFT: INPUTS ── */}
      <div>
        {/* Sync from Stage 1 */}
        {s1Results && (
          <div className="alert alert-info" style={{ marginBottom:12 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span>Stage 1 Q = <strong>{s1Results.Q_final.toFixed(1)} kW</strong> available</span>
              <button className="btn btn-secondary btn-sm" onClick={syncFromS1}>← Sync Q from Stage 1</button>
            </div>
          </div>
        )}

        {/* Thermal duty */}
        <div className="panel" style={{ marginBottom:12 }}>
          <div className="panel-header"><div className="panel-title">Thermal Duty & Burner Config</div></div>
          <div className="panel-body">
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div>
                <label className="field-label">Net Process Heat Duty Q</label>
                <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                  <input type="number" value={form.Q_net} onChange={set('Q_net')} />
                  <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text-dim)' }}>kW</span>
                </div>
              </div>
              <div>
                <label className="field-label">Number of Burners</label>
                <select value={form.nBurners} onChange={set('nBurners')}>
                  <option value="1">1 Burner</option>
                  <option value="2">2 Burners</option>
                </select>
              </div>
              <div>
                <label className="field-label">Thermal Efficiency η</label>
                <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                  <input type="number" value={form.efficiency} step="1" min="50" max="95" onChange={set('efficiency')} />
                  <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text-dim)' }}>%</span>
                </div>
              </div>
              <div>
                <label className="field-label">AS 3814 Rating Factor</label>
                <input type="number" value={form.burnerFactor} step="0.05" min="1.0" max="1.5" onChange={set('burnerFactor')} />
              </div>
              <div>
                <label className="field-label">Draft Type</label>
                <select value={form.draftType} onChange={set('draftType')}>
                  <option value="natural">Natural Stack Buoyancy</option>
                  <option value="forced">Forced Draft (Fan)</option>
                </select>
              </div>
              <div>
                <label className="field-label">Bath Temperature</label>
                <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                  <input type="number" value={form.Tbath} step="1" onChange={set('Tbath')} />
                  <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text-dim)' }}>°C</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Firetube geometry */}
        <div className="panel" style={{ marginBottom:12 }}>
          <div className="panel-header"><div className="panel-title">Firetube Geometry</div></div>
          <div className="panel-body">
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
              <div>
                <label className="field-label">Tube Passes</label>
                <select value={form.nPass} onChange={set('nPass')}>
                  <option value="2">2-Pass (U-Tube)</option>
                  <option value="4">4-Pass (High Duty)</option>
                </select>
              </div>
              <div>
                <label className="field-label">Leg Length L</label>
                <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                  <input type="number" value={form.tubeLen} step="0.25" min="1" max="12" onChange={set('tubeLen')} />
                  <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text-dim)' }}>m</span>
                </div>
              </div>
            </div>

            <label className="field-label" style={{ marginBottom:6 }}>Combustion Tube DN (Sch 10/20 light wall)</label>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(100px,1fr))', gap:6 }}>
              {INTERNAL_PIPE_TABLE.map(p => (
                <button key={p.dn} onClick={() => setForm(f => ({ ...f, pipeDN: p.dn }))}
                  style={{
                    background: form.pipeDN === p.dn ? 'rgba(176,96,0,0.12)' : 'var(--panel2)',
                    border:`1px solid ${form.pipeDN === p.dn ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius:4, padding:'6px', cursor:'pointer', textAlign:'center',
                  }}>
                  <div style={{ fontWeight:'bold', fontSize:11 }}>DN{p.dn}</div>
                  <div style={{ fontFamily:'var(--mono)', fontSize:9, color:'var(--text-dim)' }}>{p.od} mm OD</div>
                  <div style={{ fontFamily:'var(--mono)', fontSize:9, color:'var(--accent)' }}>t={p.thickness}mm</div>
                </button>
              ))}
            </div>

            {/* LIVE FIRETUBE SKETCH — updates on input change, no calculation needed */}
            <div style={{ marginTop:14 }}>
              <FiretubeSVG
                nPass={parseInt(form.nPass)}
                L={parseFloat(form.tubeLen) || 4.0}
                od_mm={selectedPipe.od}
                nBurners={parseInt(form.nBurners)}
              />
            </div>

            <div style={{ marginTop:8, background:'var(--panel2)', borderRadius:4, padding:'8px 10px',
              fontSize:11, fontFamily:'var(--mono)', display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
              <span style={{ color:'var(--text-dim)' }}>OD:</span>
              <span style={{ color:'var(--accent)' }}>{selectedPipe.od} mm</span>
              <span style={{ color:'var(--text-dim)' }}>Wall:</span>
              <span>{selectedPipe.thickness} mm ({selectedPipe.label.split(' ').pop()})</span>
              <span style={{ color:'var(--text-dim)' }}>ID:</span>
              <span style={{ color:'var(--green)' }}>{(selectedPipe.od - 2*selectedPipe.thickness).toFixed(1)} mm</span>
              <span style={{ color:'var(--text-dim)' }}>Bend radius:</span>
              <span>{(selectedPipe.od * 1.5).toFixed(0)} mm (1.5 × OD)</span>
            </div>
          </div>
        </div>

        {/* Stack sizing */}
        <div className="panel">
          <div className="panel-header"><div className="panel-title">Stack Draft Sizing (AS 3814 / API 12K)</div></div>
          <div className="panel-body">
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
              {[
                { label:'Site Altitude',           k:'stackAlt',    unit:'m ASL' },
                { label:'Ambient Temperature',     k:'stackTamb',   unit:'°C' },
                { label:'Flue Gas Temperature',    k:'stackTflue',  unit:'°C' },
                { label:'Excess Air',              k:'excessAir',   unit:'%' },
                { label:'Stack Height',            k:'stackHeight', unit:'m' },
                { label:'Stack Internal Diameter', k:'stackDia',    unit:'mm' },
              ].map(fi => (
                <div key={fi.k}>
                  <label className="field-label">{fi.label}</label>
                  <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                    <input type="number" value={form[fi.k as keyof S2Form] as string}
                      onChange={set(fi.k as keyof S2Form)} />
                    <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text-dim)' }}>{fi.unit}</span>
                  </div>
                </div>
              ))}
            </div>
            <button className="btn btn-primary" onClick={calculate} disabled={loading}>
              {loading ? '⏳ Calculating…' : '▶ Calculate Firetube & Stack'}
            </button>
          </div>
        </div>
      </div>

      {/* ── RIGHT: RESULTS ── */}
      <div>
        {error && <div className="alert alert-fail" style={{ marginBottom:12 }}>❌ {error}</div>}
        {allValidation.length > 0 && <ValidationPanel messages={allValidation} title="AS 3814 / API 12K Checks" />}

        {results ? (
          <>
            {/* Duty */}
            <div className="panel" style={{ marginBottom:12 }}>
              <div className="panel-header"><div className="panel-title">Thermal Duty Summary</div></div>
              <div className="panel-body">
                <ResultGrid cols={3}>
                  <ResultCard label="Q Net Process" value={results.Q_net_kW} unit="kW" decimals={1} variant="highlight" />
                  <ResultCard label="Q Gross Input" value={results.Q_gross_kW} unit="kW" decimals={1} />
                  <ResultCard label="Q Rated Nameplate" value={results.Q_burner_rated_kW} unit="kW" decimals={1} />
                </ResultGrid>
                <div style={{ marginTop:8 }}>
                  <ResultGrid cols={2}>
                    <ResultCard label="No. of Burners" value={results.nBurners} />
                    <ResultCard label="Q per Burner" value={results.Q_per_burner_kW} unit="kW" decimals={1} />
                  </ResultGrid>
                </div>
              </div>
            </div>

            {/* Shell dimensions */}
            <div className="panel" style={{ marginBottom:12 }}>
              <div className="panel-header"><div className="panel-title">Vessel Envelope</div></div>
              <div className="panel-body">
                <ResultGrid cols={2}>
                  <ResultCard label="Shell OD" value={results.OD_shell_mm} unit="mm" decimals={0} variant="highlight" />
                  <ResultCard label="Shell Length" value={results.L_shell_mm} unit="mm" decimals={0} />
                  <ResultCard label="Bath Volume" value={results.bath_volume_L} unit="L" decimals={0} />
                  <ResultCard label="Firetube Area" value={results.A_ft} unit="m²" decimals={2} />
                </ResultGrid>
              </div>
            </div>

            {/* Heat flux — API 12K §4.3 */}
            <div className="panel" style={{ marginBottom:12,
              borderColor: results.fluxOK ? undefined : 'var(--red)' }}>
              <div className="panel-header">
                <div className="panel-title" style={{ color: results.fluxOK ? 'var(--green)' : 'var(--red)' }}>
                  Heat Flux — API 12K §4.3
                </div>
              </div>
              <div className="panel-body">
                <ResultGrid cols={2}>
                  <ResultCard label="Heat Flux" value={results.heatFlux_kWm2} unit="kW/m²" decimals={1}
                    variant={results.fluxOK ? 'green' : 'red'} />
                  <ResultCard label="Heat Flux (Imperial)" value={results.heatFlux_BTUhrft2}
                    unit="BTU/hr·ft²" decimals={0} variant={results.fluxOK ? 'green' : 'red'} />
                </ResultGrid>
                <div className={`alert ${results.fluxOK ? 'alert-ok' : 'alert-fail'}`} style={{ marginTop:8 }}>
                  {results.fluxOK
                    ? `✔ API 12K compliant: ${results.heatFlux_kWm2?.toFixed(1)} kW/m² ≤ 37.9 kW/m² limit.`
                    : `✘ EXCEEDS API 12K limit: ${results.heatFlux_kWm2?.toFixed(1)} kW/m². Increase DN or tube length.`}
                </div>
                {/* Volumetric heat release AS 3814 */}
                {results.volumetricHeatReleaseOK !== undefined && (
                  <div className={`alert ${results.volumetricHeatReleaseOK ? 'alert-ok' : 'alert-warn'}`}
                    style={{ marginTop:6 }}>
                    {results.volumetricHeatReleaseOK
                      ? '✔ AS 3814 §4.4: Volumetric heat release within limits.'
                      : '⚠ AS 3814 §4.4: Volumetric heat release exceeds 350 kW/m³ — enlarge flame tube.'}
                  </div>
                )}
                {results.linearHeatReleaseOK !== undefined && (
                  <div className={`alert ${results.linearHeatReleaseOK ? 'alert-ok' : 'alert-warn'}`}
                    style={{ marginTop:6 }}>
                    {results.linearHeatReleaseOK
                      ? '✔ AS 1228: Linear heat intensity ≤ 150 kW/m.'
                      : '⚠ AS 1228: Linear heat intensity > 150 kW/m — risk of glycol film boiling.'}
                  </div>
                )}
              </div>
            </div>

            {/* Stack draft */}
            <div className="panel">
              <div className="panel-header"><div className="panel-title">Stack Draft Performance</div></div>
              <div className="panel-body">
                <ResultGrid cols={2}>
                  <ResultCard label="Natural Draft Available" value={results.P_available_Pa}
                    unit="Pa" decimals={1} variant={results.draftOK ? 'green' : 'red'} />
                  <ResultCard label="System Friction Required" value={results.P_required_Pa}
                    unit="Pa" decimals={1} />
                  <ResultCard label="Stack Velocity" value={results.stackVelocity_ms}
                    unit="m/s" decimals={1} />
                  <ResultCard label="Fuel Demand" value={results.m_fuel_kghr}
                    unit="kg/hr" decimals={1} variant="highlight" />
                </ResultGrid>

                <DraftBuoyancyMonitor
                  available={results.P_available_Pa}
                  required={results.P_required_Pa} />

                <div className={`alert ${results.draftOK ? 'alert-ok' : 'alert-fail'}`} style={{ marginTop:8 }}>
                  {results.draftOK
                    ? '✔ Stack buoyancy head exceeds system flow resistance — natural draft adequate.'
                    : '✘ Insufficient natural draft. Increase stack height or diameter, or switch to forced draft.'}
                </div>

                <table className="res-table" style={{ marginTop:10, fontSize:11 }}>
                  <tbody>
                    <tr><td>Fuel flow</td>
                      <td className="val">{f1(results.m_fuel_kghr)}</td><td>kg/hr</td></tr>
                    {results.V_fuel_Nm3hr !== undefined && (
                      <tr><td>Fuel volume (Nm³/hr)</td>
                        <td className="val">{f1(results.V_fuel_Nm3hr)}</td><td>Nm³/hr</td></tr>
                    )}
                    <tr><td>Est. stack T at base</td>
                      <td className="val">{results.T_stack_est ?? '—'}</td><td>°C</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="panel">
            <div className="panel-body" style={{ color:'var(--text-dim)', padding:'32px 0', textAlign:'center' }}>
              Configure inputs and click <strong>Calculate Firetube & Stack</strong>.<br/>
              <span style={{ fontSize:11 }}>The firetube sketch on the left updates live as you change geometry.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
