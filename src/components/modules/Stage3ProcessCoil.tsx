'use client';
// src/components/modules/Stage3ProcessCoil.tsx
// Stage 3 — Process Coil Sizing & ASME B31.3 Compliance
// v5 — process coil plan-view sketch, all fixes applied

import { useState } from 'react';
import ValidationPanel from '@/components/ui/ValidationPanel';
import { ResultCard, ResultGrid } from '@/components/ui/ResultCard';
import type { Stage1Results } from '@/lib/calculations/thermodynamics';

// ─── PIPE DATA — expanded to match heater-sizing.ts COIL_PIPE_DATA ───────────
// Must exactly match keys used in heater-sizing.ts to ensure API compat
const COIL_PIPE_TABLE = [
  { nps:'1.5"', dn:40,  od:48.3,  sch40:3.68, sch80:5.08,  label:'DN40 (1½")' },
  { nps:'2"',   dn:50,  od:60.3,  sch40:3.91, sch80:5.54,  label:'DN50 (2")' },
  { nps:'2.5"', dn:65,  od:73.0,  sch40:5.16, sch80:7.01,  label:'DN65 (2½")' },
  { nps:'3"',   dn:80,  od:88.9,  sch40:5.49, sch80:7.62,  label:'DN80 (3")' },
  { nps:'4"',   dn:100, od:114.3, sch40:6.02, sch80:8.56,  label:'DN100 (4")' },
  { nps:'5"',   dn:125, od:141.3, sch40:6.55, sch80:9.53,  label:'DN125 (5")' },
  { nps:'6"',   dn:150, od:168.3, sch40:7.11, sch80:10.97, label:'DN150 (6")' },
  { nps:'8"',   dn:200, od:219.1, sch40:8.18, sch80:12.70, label:'DN200 (8")' },
];

const U_METHODS = [
  { v:'natco_lo',  label:'NATCO Low — 250 W/(m²·K)' },
  { v:'natco_hi',  label:'NATCO High — 400 W/(m²·K) ★' },
  { v:'gpsa_typ',  label:'GPSA Sweet Gas — 350 W/(m²·K)' },
  { v:'cfer_cold', label:'C-FER Cold/Viscous — 280 W/(m²·K)' },
];

interface Props {
  s1Results?: Stage1Results;
  s2Results?: any;
  onComplete?: (results: any) => void;
}

// ─── PROCESS COIL PLAN-VIEW SKETCH ──────────────────────────────────────────
// Multi-path serpentine arrangement — ported from v28 HTML coil-layout-svg generator
// nPaths = number of parallel flow paths (side by side in plan view)
// nRows  = number of passes per path (hairpin legs, top + bottom of each U-bend)
function CoilSketchSVG({
  nPaths, nRows, od_mm, nps, L_leg, Ac_actual, L_total,
}: {
  nPaths: number; nRows: number; od_mm: number; nps: string;
  L_leg?: number; Ac_actual?: number; L_total?: number;
}) {
  const W = 400, H = 220, mx = 36, my = 20;
  const pathH = (H - 2 * my) / Math.max(nPaths, 1);
  const pitchY = Math.min(pathH / (nRows + 1), 18);
  const tubeR = Math.max(3, Math.min(8, od_mm / 16));
  const runW = W - 2 * mx - 28;
  const pathColors = ['#1e8a40','#1a6ab8','#c87020','#7a1aa0','#b01010','#0a7a7a'];

  const tubes: React.ReactNode[] = [];

  for (let p = 0; p < Math.min(nPaths, 6); p++) {
    const cy = my + 18 + p * pathH + pathH / 2;
    const col = pathColors[p % pathColors.length];

    for (let r = 0; r < nRows; r++) {
      const ry = cy - ((nRows - 1) / 2 - r) * pitchY;
      const x1 = mx, x2 = x1 + runW;

      // Tube wall (outer pipe)
      tubes.push(
        <line key={`t${p}-${r}`} x1={x1} y1={ry} x2={x2} y2={ry}
          stroke={col} strokeWidth={tubeR * 2} strokeLinecap="round" opacity={0.9} />
      );
      // Gas bore highlight
      tubes.push(
        <line key={`b${p}-${r}`} x1={x1 + 4} y1={ry} x2={x2 - 4} y2={ry}
          stroke="rgba(180,220,255,0.35)" strokeWidth={tubeR * 0.8} strokeLinecap="round" />
      );

      // U-bends at left end (even rows) — same-side header arrangement
      if (r < nRows - 1 && r % 2 === 0) {
        const ry_next = cy - ((nRows - 1) / 2 - (r + 1)) * pitchY;
        const xb = x1 - 14;
        const ymid = (ry + ry_next) / 2;
        tubes.push(
          <path key={`bend-l${p}-${r}`}
            d={`M ${x1} ${ry} Q ${xb} ${ymid} ${x1} ${ry_next}`}
            fill="none" stroke={col} strokeWidth={tubeR * 1.8} strokeLinecap="round" />
        );
      }
      // Header / termination at right end (odd rows)
      if (r < nRows - 1 && r % 2 === 1) {
        const ry_next = cy - ((nRows - 1) / 2 - (r + 1)) * pitchY;
        const xb2 = x2 + 14;
        const ymid2 = (ry + ry_next) / 2;
        tubes.push(
          <path key={`bend-r${p}-${r}`}
            d={`M ${x2} ${ry} Q ${xb2} ${ymid2} ${x2} ${ry_next}`}
            fill="none" stroke={col} strokeWidth={tubeR * 1.6} strokeLinecap="round" />
        );
      }
    }

    // IN/OUT arrows
    const firstY = my + 18 + p * pathH + pathH / 2 - ((nRows - 1) / 2) * pitchY;
    const lastY  = my + 18 + p * pathH + pathH / 2 + ((nRows - 1) / 2) * pitchY;
    const inY    = nRows % 2 === 0 ? lastY : firstY;
    const outY   = nRows % 2 === 0 ? firstY : lastY;
    const inSide = nRows % 2 === 0 ? 'right' : 'left';
    const xLeft  = mx;
    const xRight = mx + runW;
    tubes.push(
      <text key={`in${p}`} x={inSide === 'right' ? xRight + 18 : xLeft - 18}
        y={inY + 3} fontSize={8} fill={col} fontFamily="monospace" fontWeight={700}
        textAnchor={inSide === 'right' ? 'start' : 'end'}>
        P{p+1} IN
      </text>
    );
    tubes.push(
      <text key={`out${p}`} x={inSide === 'right' ? xLeft - 18 : xRight + 18}
        y={outY + 3} fontSize={8} fill={col} fontFamily="monospace"
        textAnchor={inSide === 'right' ? 'end' : 'start'}>
        OUT
      </text>
    );
  }

  return (
    <div>
      <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:1,
        color:'var(--text-dim)', marginBottom:4 }}>
        Process Coil — Plan View ({nPaths} path{nPaths > 1 ? 's' : ''} × {nRows} rows, {nps} NPS)
        <span style={{ fontFamily:'var(--mono)', fontSize:9, color:'#4a7090', marginLeft:8 }}>
          ASME B31.3 — Serpentine Hairpin
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', background:'#0a1520', borderRadius:4 }}>
        {/* Title bar */}
        <rect width={W} height={18} fill="#0d1520"/>
        <text x={8} y={13} fontFamily="monospace" fontSize={10} fontWeight={700} fill="#f0a530">
          {`PROCESS COIL — PLAN (${nPaths} × ${nRows})  NPS ${nps}  OD ${od_mm} mm`}
        </text>
        {/* Tubes */}
        {tubes}
        {/* Dimension line */}
        <line x1={mx} y1={H - 8} x2={mx + runW} y2={H - 8} stroke="#5a6e88" strokeWidth={0.8}
          markerStart="url(#a2)" markerEnd="url(#a2)"/>
        <text x={mx + runW / 2} y={H - 2} textAnchor="middle" fontSize={9}
          fill="#5a6e88" fontFamily="monospace">
          {L_leg ? `L_leg = ${L_leg.toFixed(2)} m` : 'L_leg'}
        </text>
        {/* Summary if results available */}
        {Ac_actual !== undefined && (
          <text x={W - 4} y={H - 2} textAnchor="end" fontSize={9}
            fill="#1a8a40" fontFamily="monospace">
            A = {Ac_actual.toFixed(2)} m²{L_total ? `  |  L_total = ${L_total.toFixed(1)} m` : ''}
          </text>
        )}
        <defs>
          <marker id="a2" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 Z" fill="#5a6e88"/>
          </marker>
        </defs>
      </svg>
    </div>
  );
}

// ─── LMTD THERMAL PROFILE CHART ─────────────────────────────────────────────
function ThermalProfileChart({ tIn, tOut, tBath }: { tIn:number; tOut:number; tBath:number }) {
  if (!isFinite(tIn) || !isFinite(tOut) || !isFinite(tBath)) return null;
  const W = 340, H = 90, pL = 40, pR = 20, pT = 15, pB = 22;
  const maxT = Math.max(tIn, tOut, tBath) * 1.1;
  const minT = Math.min(tIn, tOut, tBath) * 0.85;
  const ty = (t: number) => pT + (1 - (t - minT) / (maxT - minT)) * (H - pT - pB);
  const xt1 = pL, xt2 = W - pR;
  const LMTD = ((tBath - tIn) - (tBath - tOut)) / Math.log((tBath - tIn) / (tBath - tOut));

  return (
    <div style={{ marginTop:10, borderTop:'1px solid var(--border)', paddingTop:10 }}>
      <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', color:'var(--text-dim)', marginBottom:4 }}>
        Thermal Profile — LMTD = {isFinite(LMTD) ? LMTD.toFixed(1) : '—'}°C
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%' }}>
        {/* Bath line */}
        <line x1={xt1} y1={ty(tBath)} x2={xt2} y2={ty(tBath)}
          stroke="var(--red)" strokeWidth={1.5} strokeDasharray="3 2"/>
        <text x={xt2} y={ty(tBath) - 4} textAnchor="end" fontSize={8}
          fill="var(--red)" fontFamily="monospace">Bath {tBath.toFixed(0)}°C</text>
        {/* Gas heating curve */}
        <path d={`M ${xt1} ${ty(tIn)} Q ${(xt1+xt2)/2} ${(ty(tIn)+ty(tOut))/2} ${xt2} ${ty(tOut)}`}
          fill="none" stroke="var(--accent)" strokeWidth={2.5}/>
        <circle cx={xt1} cy={ty(tIn)} r={4} fill="var(--accent)"/>
        <text x={xt1-4} y={ty(tIn)+3} textAnchor="end" fontSize={8}
          fill="var(--text-dim)" fontFamily="monospace">{tIn.toFixed(0)}°C</text>
        <circle cx={xt2} cy={ty(tOut)} r={4} fill="var(--accent)"/>
        <text x={xt2+4} y={ty(tOut)+3} fontSize={8}
          fill="var(--text-dim)" fontFamily="monospace">{tOut.toFixed(0)}°C</text>
        {/* ΔT1 and ΔT2 annotations */}
        <line x1={xt1} y1={ty(tIn)} x2={xt1} y2={ty(tBath)} stroke="#5a6e88" strokeWidth={0.8} strokeDasharray="2 2"/>
        <text x={xt1+2} y={(ty(tIn)+ty(tBath))/2+3} fontSize={8} fill="#5a6e88" fontFamily="monospace">
          ΔT₁={Math.abs(tBath-tIn).toFixed(1)}
        </text>
        <line x1={xt2} y1={ty(tOut)} x2={xt2} y2={ty(tBath)} stroke="#5a6e88" strokeWidth={0.8} strokeDasharray="2 2"/>
        <text x={xt2-2} y={(ty(tOut)+ty(tBath))/2+3} textAnchor="end" fontSize={8}
          fill="#5a6e88" fontFamily="monospace">ΔT₂={Math.abs(tBath-tOut).toFixed(1)}</text>
        {/* Axis labels */}
        <text x={xt1} y={H-2} fontSize={8} fill="#5a6e88" fontFamily="monospace">Gas Inlet</text>
        <text x={xt2} y={H-2} textAnchor="end" fontSize={8} fill="#5a6e88" fontFamily="monospace">Gas Outlet</text>
      </svg>
    </div>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function Stage3ProcessCoil({ s1Results, s2Results, onComplete }: Props) {
  const [form, setForm] = useState({
    Q_net:'400', T_in:'5', T_out:'40', T_bath:'62',
    nPaths:'3', nRows:'8', nps:'3"',
    material:'a106b', P_maop:'7000', P_design:'7700', T_design:'100',
    corrAllow:'3', safetyFactor:'1.15', uMethod:'natco_hi',
    legLengthFixed:'',
  });
  const [results, setResults] = useState<any | null>(null);
  const [validation, setValidation] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const syncFromPrev = () => {
    setForm(f => ({
      ...f,
      Q_net: s1Results ? s1Results.Q_final.toFixed(1) : f.Q_net,
      T_in:  s1Results ? String(s1Results.T_in_C) : f.T_in,
      T_out: s1Results ? String(s1Results.T_out_C) : f.T_out,
      T_bath: s2Results ? String(s2Results.T_bath_C ?? 62) : f.T_bath,
      P_maop: s1Results ? String(s1Results.P_kPa) : f.P_maop,
      P_design: s1Results ? String(s1Results.P_des) : f.P_design,
    }));
  };

  const calculate = async () => {
    setLoading(true); setError('');
    try {
      const payload = {
        Q_net_kW: parseFloat(form.Q_net),
        T_in_C: parseFloat(form.T_in),
        T_out_C: parseFloat(form.T_out),
        T_bath_C: parseFloat(form.T_bath),
        nPaths: parseInt(form.nPaths),
        nRows: parseInt(form.nRows),
        npsKey: form.nps,
        material: form.material,
        P_maop_kPa: parseFloat(form.P_maop),
        P_design_kPa: parseFloat(form.P_design),
        T_design_C: parseFloat(form.T_design),
        corrAllow_mm: parseFloat(form.corrAllow),
        safetyFactor: parseFloat(form.safetyFactor),
        uMethod: form.uMethod,
        legLengthFixed: form.legLengthFixed ? parseFloat(form.legLengthFixed) : undefined,
        rhoGasIn:   s1Results?.ST_in?.rho  ?? 55.0,
        rhoGasOut:  s1Results?.ST_out?.rho ?? 51.0,
        massFlowKgh: s1Results?.mdot_kgs ? s1Results.mdot_kgs * 3600 : 5000,
      };
      const res = await fetch('/api/calculations/stage3', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setResults(data.results);
        setValidation(data.validation);
        onComplete?.(data.results);
      } else {
        setError(data.error ?? 'Stage 3 calculation failed');
      }
    } catch (e) { setError(String(e)); }
    setLoading(false);
  };

  const f1 = (v?: number) => v !== undefined && isFinite(v) ? v.toFixed(1) : '—';
  const f2 = (v?: number) => v !== undefined && isFinite(v) ? v.toFixed(2) : '—';
  const allValidation = [
    ...(validation?.wallThickness?.messages ?? validation?.messages ?? []),
  ];

  // Current pipe OD for sketch
  const selectedPipe = COIL_PIPE_TABLE.find(p => p.nps === form.nps) ?? COIL_PIPE_TABLE[3];

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

      {/* ── LEFT: INPUTS ── */}
      <div>
        {/* Sync */}
        {(s1Results || s2Results) && (
          <div style={{ marginBottom:10 }}>
            <button className="btn btn-secondary btn-sm" onClick={syncFromPrev}>
              ← Sync from Stage 1 & 2
            </button>
          </div>
        )}

        {/* Process conditions */}
        <div className="panel" style={{ marginBottom:12 }}>
          <div className="panel-header"><div className="panel-title">Process Conditions</div></div>
          <div className="panel-body">
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {[
                { k:'Q_net',    label:'Net Heat Duty Q',         unit:'kW' },
                { k:'T_in',     label:'Gas Inlet Temperature',   unit:'°C' },
                { k:'T_out',    label:'Gas Outlet Temperature',  unit:'°C' },
                { k:'T_bath',   label:'Bath Temperature',        unit:'°C' },
                { k:'P_maop',   label:'MAOP',                    unit:'kPa' },
                { k:'P_design', label:'Design Pressure',         unit:'kPa' },
                { k:'T_design', label:'Design Temperature',      unit:'°C' },
                { k:'corrAllow',label:'Corrosion Allowance',     unit:'mm' },
              ].map(fi => (
                <div key={fi.k}>
                  <label className="field-label">{fi.label}</label>
                  <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                    <input type="number" value={form[fi.k as keyof typeof form] as string}
                      onChange={set(fi.k)} />
                    <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text-dim)' }}>{fi.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Coil geometry */}
        <div className="panel" style={{ marginBottom:12 }}>
          <div className="panel-header"><div className="panel-title">Coil Geometry & Metallurgy</div></div>
          <div className="panel-body">
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div>
                <label className="field-label">NPS Pipe Size</label>
                <select value={form.nps} onChange={set('nps')}>
                  {COIL_PIPE_TABLE.map(p => (
                    <option key={p.nps} value={p.nps}>{p.label} — {p.od} mm OD</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">Material</label>
                <select value={form.material} onChange={set('material')}>
                  <option value="a106b">ASTM A106 Gr B — Carbon Steel</option>
                  <option value="a333g6">ASTM A333 Gr 6 — Low-Temp CS</option>
                  <option value="a312tp316l">ASTM A312 TP316L — Stainless</option>
                </select>
              </div>
              <div>
                <label className="field-label">Parallel Flow Paths</label>
                <input type="number" value={form.nPaths} min="1" max="12" onChange={set('nPaths')} />
              </div>
              <div>
                <label className="field-label">Rows per Path (hairpins)</label>
                <input type="number" value={form.nRows} min="2" max="30" step="2" onChange={set('nRows')} />
              </div>
              <div>
                <label className="field-label">U value Method</label>
                <select value={form.uMethod} onChange={set('uMethod')}>
                  {U_METHODS.map(m => <option key={m.v} value={m.v}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Safety Factor (fouling)</label>
                <select value={form.safetyFactor} onChange={set('safetyFactor')}>
                  {['1.00','1.05','1.10','1.15','1.20'].map(v => (
                    <option key={v} value={v}>{v}{v==='1.15' ? ' ★ Recommended' : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">Leg Length (leave blank = auto)</label>
                <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                  <input type="number" value={form.legLengthFixed}
                    placeholder="Auto" onChange={set('legLengthFixed')} />
                  <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text-dim)' }}>m</span>
                </div>
              </div>
            </div>

            {/* LIVE COIL SKETCH */}
            <div style={{ marginTop:14 }}>
              <CoilSketchSVG
                nPaths={parseInt(form.nPaths) || 3}
                nRows={parseInt(form.nRows) || 8}
                od_mm={selectedPipe.od}
                nps={form.nps}
                L_leg={results?.L_leg}
                Ac_actual={results?.Ac_actual}
                L_total={results?.L_total}
              />
            </div>

            <div style={{ marginTop:10, display:'flex', gap:8 }}>
              <button className="btn btn-primary" onClick={calculate} disabled={loading}>
                {loading ? '⏳ Calculating…' : '▶ Calculate Process Coil'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT: RESULTS ── */}
      <div>
        {error && <div className="alert alert-fail" style={{ marginBottom:12 }}>❌ {error}</div>}
        {allValidation.length > 0 && (
          <ValidationPanel messages={allValidation} title="ASME B31.3 Compliance" />
        )}

        {results ? (
          <>
            {/* Thermal area */}
            <div className="panel" style={{ marginBottom:12 }}>
              <div className="panel-header"><div className="panel-title">Thermal Sizing</div></div>
              <div className="panel-body">
                <ResultGrid cols={3}>
                  <ResultCard label="LMTD" value={results.LMTD} unit="°C" decimals={1} variant="highlight" />
                  <ResultCard label="U Overall" value={results.U_Wm2K} unit="W/m²·K" decimals={0} />
                  <ResultCard label="Area Required" value={results.Ac_design} unit="m²" decimals={2} />
                </ResultGrid>
                <div style={{ marginTop:8 }}>
                  <ResultGrid cols={3}>
                    <ResultCard label="Area Actual" value={results.Ac_actual} unit="m²" decimals={2}
                      variant={results.area_adequate ? 'green' : 'red'} />
                    <ResultCard label="Area Margin" value={results.area_margin_pct} unit="%"
                      decimals={1} variant={results.area_adequate ? 'green' : 'red'} />
                    <ResultCard label="Total Coil Length" value={results.L_total} unit="m"
                      decimals={1} variant="highlight" />
                  </ResultGrid>
                </div>
                <ThermalProfileChart
                  tIn={parseFloat(form.T_in)}
                  tOut={parseFloat(form.T_out)}
                  tBath={parseFloat(form.T_bath)} />
              </div>
            </div>

            {/* Hydraulics */}
            <div className="panel" style={{ marginBottom:12 }}>
              <div className="panel-header"><div className="panel-title">Hydraulics & Flow</div></div>
              <div className="panel-body">
                <ResultGrid cols={2}>
                  <ResultCard label="Velocity — Inlet" value={results.v_inlet_ms} unit="m/s"
                    decimals={1} variant={results.v_inlet_ms > 15 ? 'red' : 'default'} />
                  <ResultCard label="Velocity — Outlet" value={results.v_outlet_ms} unit="m/s"
                    decimals={1} variant={results.v_outlet_ms > 15 ? 'red' : 'default'} />
                </ResultGrid>
                <div className={`alert ${results.dP_acceptable ? 'alert-ok' : 'alert-fail'}`}
                  style={{ marginTop:8 }}>
                  {results.dP_acceptable
                    ? `✔ Coil ΔP = ${f1(results.dP_kPa)} kPa — within allowable limits.`
                    : `✘ Coil ΔP = ${f1(results.dP_kPa)} kPa — too high. Add parallel paths.`}
                </div>
              </div>
            </div>

            {/* ASME B31.3 mechanical */}
            <div className="panel" style={{ marginBottom:12 }}>
              <div className="panel-header"><div className="panel-title">ASME B31.3 Wall Thickness</div></div>
              <div className="panel-body">
                <table className="res-table" style={{ fontSize:11 }}>
                  <tbody>
                    <tr>
                      <td>Pipe OD / Wall selected</td>
                      <td className="val">{f2(results.do_m * 1000)} mm</td>
                      <td>Schedule {results.sched?.nm ?? '—'} — {f2(results.wt_act)} mm WT</td>
                    </tr>
                    <tr>
                      <td>Internal diameter (after CA)</td>
                      <td className="val">{f2(results.di_act)}</td><td>mm</td>
                    </tr>
                    <tr>
                      <td>Paths × Rows</td>
                      <td className="val">{results.n_pass} × {results.n_rows}</td><td></td>
                    </tr>
                    <tr>
                      <td>Leg length</td>
                      <td className="val">{f2(results.L_leg)}</td>
                      <td>m {results.lenFixed ? '(fixed)' : '(calculated)'}</td>
                    </tr>
                    <tr>
                      <td>B31.3 t_nom (with mill tolerance)</td>
                      <td className="val">{f2(results.t_nom)}</td><td>mm</td>
                    </tr>
                    <tr>
                      <td>Allowable stress S at {form.T_design}°C</td>
                      <td className="val">{results.S_MPa}</td><td>MPa</td>
                    </tr>
                    <tr>
                      <td>Recommended flange class</td>
                      <td className="val">
                        <span style={{ fontWeight:700,
                          color: results.flangeClassValid ? 'var(--green)' : 'var(--red)' }}>
                          ASME Class {results.flangeClass}
                        </span>
                      </td>
                      <td>RF face</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Dean number / bend details */}
            <div className="panel">
              <div className="panel-header"><div className="panel-title">Bend & Dean Number</div></div>
              <div className="panel-body">
                <table className="res-table" style={{ fontSize:11 }}>
                  <tbody>
                    <tr>
                      <td>Bend radius (r = 1.5 × OD)</td>
                      <td className="val">{f1((results.r_bend_m ?? 0) * 1000)}</td><td>mm</td>
                    </tr>
                    <tr>
                      <td>Bends per path</td>
                      <td className="val">{results.n_bends_path ?? '—'}</td><td></td>
                    </tr>
                    <tr>
                      <td>Bend heat transfer area</td>
                      <td className="val">{f2(results.A_total_bends)}</td><td>m²</td>
                    </tr>
                    <tr>
                      <td>Straight section area</td>
                      <td className="val">{f2(results.A_straight)}</td><td>m²</td>
                    </tr>
                  </tbody>
                </table>
                {results.uValueFeasible === false && (
                  <div className="alert alert-warn" style={{ marginTop:8 }}>
                    ⚠ Selected U-value may be optimistic for this geometry. Consider NATCO Low or C-FER method.
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="panel">
            <div className="panel-body" style={{ color:'var(--text-dim)', padding:'32px 0', textAlign:'center' }}>
              Configure inputs and click <strong>Calculate Process Coil</strong>.<br/>
              <span style={{ fontSize:11 }}>The coil sketch updates live as you change paths/rows/pipe size.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
