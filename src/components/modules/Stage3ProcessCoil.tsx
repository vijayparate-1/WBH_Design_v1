'use client';
// src/components/modules/Stage3ProcessCoil.tsx
// Stage 3 — Process Coil Sizing & ASME B31.3
// Auto-calculates 300ms after any input change.
// Coil sketch: correct manifold → paths → rows → outlet layout.
// Hydraulics: flow splits equally across paths; per-path velocity shown.

import { useState, useEffect, useCallback } from 'react';
import ValidationPanel from '@/components/ui/ValidationPanel';
import { ResultCard, ResultGrid } from '@/components/ui/ResultCard';
import type { Stage1Results } from '@/lib/calculations/thermodynamics';

const COIL_PIPES = [
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
  onComplete?: (r: any) => void;
}

// ─── COIL PLAN-VIEW SKETCH ────────────────────────────────────────────────────
// Each path = a serpentine set of nRows horizontal runs connected by U-bends.
// Inlet manifold on left feeds all paths simultaneously.
// Outlet manifold on right collects all paths.
// This correctly shows that flow divides: each path carries mdot/nPaths.
function CoilSketchSVG({ nPaths, nRows, od_mm, nps, L_leg, Ac_actual, L_total }: {
  nPaths: number; nRows: number; od_mm: number; nps: string;
  L_leg?: number; Ac_actual?: number; L_total?: number;
}) {
  const nP = Math.min(Math.max(nPaths, 1), 6);
  const nR = Math.min(Math.max(nRows,  1), 20);
  const PATH_COLORS = ['#1e8a40','#1a6ab8','#c87020','#7a1aa0','#b01010','#0a7a7a'];

  // Layout constants
  const W = 420, MX = 44, MY_TOP = 22;
  const HEADER_W = 18;   // width of inlet/outlet manifold bar
  const RUN_X1   = MX + HEADER_W + 8;   // left edge of tube runs
  const RUN_X2   = W - MX - HEADER_W - 8; // right edge
  const RUN_W    = RUN_X2 - RUN_X1;

  // Row pitch — vertical spacing between adjacent rows within a path
  const ROW_PITCH = Math.max(8, Math.min(16, 120 / nR));
  // Path block height
  const PATH_H = nR * ROW_PITCH + 12;
  const H = MY_TOP + nP * PATH_H + 30;

  // Tube radius for visual — scale to od_mm but cap
  const TR = Math.max(2.5, Math.min(7, od_mm / 18));
  // Bend radius
  const BR = Math.max(TR + 2, Math.min(ROW_PITCH * 0.45, TR * 2.5));

  const pathElems: React.ReactNode[] = [];

  for (let p = 0; p < nP; p++) {
    const col = PATH_COLORS[p % PATH_COLORS.length];
    const pY0 = MY_TOP + p * PATH_H + 6; // top of this path block

    // Row Y positions within this path
    const rowYs = Array.from({ length: nR }, (_, r) => pY0 + r * ROW_PITCH + ROW_PITCH / 2);

    // Draw each row (horizontal run)
    rowYs.forEach((ry, r) => {
      pathElems.push(
        <g key={`run-${p}-${r}`}>
          {/* Pipe wall */}
          <line x1={RUN_X1} y1={ry} x2={RUN_X2} y2={ry}
            stroke={col} strokeWidth={TR * 2} strokeLinecap="round" opacity={0.85}/>
          {/* Bore highlight */}
          <line x1={RUN_X1 + 3} y1={ry} x2={RUN_X2 - 3} y2={ry}
            stroke="rgba(160,210,255,0.3)" strokeWidth={TR * 0.7} strokeLinecap="round"/>
        </g>
      );

      // U-bend connecting row r to row r+1
      if (r < nR - 1) {
        const ry2 = rowYs[r + 1];
        const midY = (ry + ry2) / 2;
        if (r % 2 === 0) {
          // Bend on RIGHT side
          pathElems.push(
            <path key={`bend-r-${p}-${r}`}
              d={`M ${RUN_X2} ${ry} A ${BR} ${BR} 0 0 1 ${RUN_X2} ${ry2}`}
              fill="none" stroke={col} strokeWidth={TR * 1.8} strokeLinecap="round"/>
          );
        } else {
          // Bend on LEFT side
          pathElems.push(
            <path key={`bend-l-${p}-${r}`}
              d={`M ${RUN_X1} ${ry} A ${BR} ${BR} 0 0 0 ${RUN_X1} ${ry2}`}
              fill="none" stroke={col} strokeWidth={TR * 1.8} strokeLinecap="round"/>
          );
        }
      }
    });

    // Inlet connection from manifold to first row
    const inY = rowYs[0];
    // Outlet from last row to manifold
    // If nR is odd, last row ends on same side as first row (LEFT → outlet left side)
    // If nR is even, last row ends on opposite side
    const lastBendSide = (nR - 1) % 2 === 0 ? 'right' : 'left';
    const outY = rowYs[nR - 1];

    // Stub lines connecting to manifold
    pathElems.push(
      <line key={`in-stub-${p}`}
        x1={MX + HEADER_W} y1={inY} x2={RUN_X1} y2={inY}
        stroke={col} strokeWidth={TR * 1.5} strokeLinecap="round"/>,
      <line key={`out-stub-${p}`}
        x1={lastBendSide === 'right' ? RUN_X2 : RUN_X1}
        y1={outY}
        x2={lastBendSide === 'right' ? W - MX - HEADER_W : RUN_X1}
        y2={outY}
        stroke={col} strokeWidth={TR * 1.5} strokeLinecap="round" opacity={0.7}/>
    );

    // Path label
    pathElems.push(
      <text key={`plabel-${p}`} x={MX + HEADER_W + 2} y={pY0 - 1}
        fontSize={8} fill={col} fontFamily="monospace" fontWeight={700}>
        P{p + 1}
      </text>
    );
  }

  // Inlet manifold (vertical bar on left)
  const manifold_y1 = MY_TOP + ROW_PITCH / 2 + 6;
  const manifold_y2 = MY_TOP + (nP - 1) * PATH_H + ROW_PITCH / 2 + 6;

  return (
    <div>
      <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:1,
        color:'var(--text-dim)', marginBottom:4 }}>
        Process Coil — Plan View &nbsp;
        <span style={{ fontWeight:400, color:'#4a7090' }}>
          {nP} path{nP > 1 ? 's' : ''} × {nR} rows · NPS {nps} ({od_mm} mm OD)
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', background:'#0a1520', borderRadius:4 }}>
        {/* Title bar */}
        <rect width={W} height={16} fill="#0d1520"/>
        <text x={8} y={12} fontFamily="monospace" fontSize={10} fontWeight={700} fill="#f0a530">
          {`PROCESS COIL — PLAN (${nP}×${nR}) · NPS ${nps} · OD ${od_mm} mm`}
        </text>

        {/* Inlet manifold — all paths share this */}
        <rect x={MX} y={manifold_y1 - 6} width={HEADER_W}
          height={manifold_y2 - manifold_y1 + 12}
          fill="#3a5a3a" stroke="#1e8a40" strokeWidth={1} rx={3} opacity={0.8}/>
        <text x={MX + HEADER_W / 2} y={manifold_y1 - 10} textAnchor="middle"
          fontSize={8} fill="#1e8a40" fontFamily="monospace" fontWeight={700}>
          INLET
        </text>
        <text x={MX + HEADER_W / 2} y={manifold_y1 - 2} textAnchor="middle"
          fontSize={7} fill="#1e8a40" fontFamily="monospace">
          ÷{nP}
        </text>

        {/* Outlet manifold on right */}
        <rect x={W - MX - HEADER_W} y={manifold_y1 - 6} width={HEADER_W}
          height={manifold_y2 - manifold_y1 + 12}
          fill="#3a3a5a" stroke="#1a6ab8" strokeWidth={1} rx={3} opacity={0.8}/>
        <text x={W - MX - HEADER_W / 2} y={manifold_y1 - 10} textAnchor="middle"
          fontSize={8} fill="#1a6ab8" fontFamily="monospace" fontWeight={700}>
          OUTLET
        </text>

        {/* Arrow into inlet */}
        <text x={MX - 4} y={(manifold_y1 + manifold_y2) / 2 + 3}
          textAnchor="end" fontSize={9} fill="#1e8a40" fontFamily="monospace">IN→</text>

        {/* Arrow out of outlet */}
        <text x={W - MX + 4} y={(manifold_y1 + manifold_y2) / 2 + 3}
          fontSize={9} fill="#1a6ab8" fontFamily="monospace">→OUT</text>

        {/* All tube elements */}
        {pathElems}

        {/* Dimension line */}
        <line x1={RUN_X1} y1={H - 8} x2={RUN_X2} y2={H - 8}
          stroke="#5a6e88" strokeWidth={0.7}/>
        <text x={(RUN_X1 + RUN_X2) / 2} y={H - 2} textAnchor="middle"
          fontSize={9} fill="#5a6e88" fontFamily="monospace">
          {L_leg ? `L_leg = ${L_leg.toFixed(2)} m` : 'L_leg = (calc after run)'}
        </text>

        {/* Area + total length overlay */}
        {Ac_actual !== undefined && (
          <text x={W - 4} y={H - 2} textAnchor="end"
            fontSize={8} fill="#1a8a40" fontFamily="monospace">
            A={Ac_actual.toFixed(2)} m²
            {L_total ? `  L=${L_total.toFixed(1)} m` : ''}
          </text>
        )}
      </svg>
    </div>
  );
}

// ─── LMTD CHART ──────────────────────────────────────────────────────────────
function LMTDChart({ tIn, tOut, tBath }: { tIn:number; tOut:number; tBath:number }) {
  if (!isFinite(tIn) || !isFinite(tOut) || !isFinite(tBath)) return null;
  const W = 340, H = 90, pL = 40, pR = 20, pT = 15, pB = 22;
  const allT = [tIn, tOut, tBath];
  const maxT = Math.max(...allT) * 1.08, minT = Math.min(...allT) * 0.88;
  const ty = (t: number) => pT + (1 - (t - minT) / (maxT - minT)) * (H - pT - pB);
  const x1 = pL, x2 = W - pR;
  const LMTD = ((tBath - tIn) - (tBath - tOut)) /
    Math.max(0.01, Math.log(Math.abs((tBath - tIn) / Math.max(0.01, tBath - tOut))));
  return (
    <div style={{ marginTop:10, borderTop:'1px solid var(--border)', paddingTop:10 }}>
      <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase',
        color:'var(--text-dim)', marginBottom:4 }}>
        LMTD = {isFinite(LMTD) ? LMTD.toFixed(1) : '—'}°C
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%' }}>
        {/* Bath line */}
        <line x1={x1} y1={ty(tBath)} x2={x2} y2={ty(tBath)}
          stroke="var(--red)" strokeWidth={1.5} strokeDasharray="3 2"/>
        <text x={x2} y={ty(tBath) - 4} textAnchor="end" fontSize={8}
          fill="var(--red)" fontFamily="monospace">Bath {tBath}°C</text>
        {/* Gas curve */}
        <path d={`M${x1} ${ty(tIn)} Q${(x1+x2)/2} ${(ty(tIn)+ty(tOut))/2} ${x2} ${ty(tOut)}`}
          fill="none" stroke="var(--accent)" strokeWidth={2.5}/>
        <circle cx={x1} cy={ty(tIn)} r={4} fill="var(--accent)"/>
        <text x={x1-4} y={ty(tIn)+3} textAnchor="end" fontSize={8}
          fill="var(--text-dim)" fontFamily="monospace">{tIn}°C</text>
        <circle cx={x2} cy={ty(tOut)} r={4} fill="var(--accent)"/>
        <text x={x2+4} y={ty(tOut)+3} fontSize={8}
          fill="var(--text-dim)" fontFamily="monospace">{tOut}°C</text>
        {/* ΔT annotations */}
        <line x1={x1} y1={ty(tIn)} x2={x1} y2={ty(tBath)} stroke="#5a6e88" strokeWidth={0.8} strokeDasharray="2 2"/>
        <text x={x1+2} y={(ty(tIn)+ty(tBath))/2+3} fontSize={7}
          fill="#5a6e88" fontFamily="monospace">ΔT₁={Math.abs(tBath-tIn).toFixed(1)}</text>
        <line x1={x2} y1={ty(tOut)} x2={x2} y2={ty(tBath)} stroke="#5a6e88" strokeWidth={0.8} strokeDasharray="2 2"/>
        <text x={x2-2} y={(ty(tOut)+ty(tBath))/2+3} textAnchor="end" fontSize={7}
          fill="#5a6e88" fontFamily="monospace">ΔT₂={Math.abs(tBath-tOut).toFixed(1)}</text>
        <text x={x1} y={H} fontSize={7} fill="#5a6e88" fontFamily="monospace">Gas In</text>
        <text x={x2} y={H} textAnchor="end" fontSize={7}
          fill="#5a6e88" fontFamily="monospace">Gas Out</text>
      </svg>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
export default function Stage3ProcessCoil({ s1Results, s2Results, onComplete }: Props) {
  const [form, setForm] = useState({
    Q_net:'400', T_in:'5', T_out:'40', T_bath:'62',
    nPaths:'3', nRows:'8', nps:'3"',
    material:'a106b', P_maop:'7000', P_design:'7700', T_design:'100',
    corrAllow:'3', safetyFactor:'1.15', uMethod:'natco_hi',
    legLengthFixed:'',
  });
  const [results, setResults] = useState<any>(null);
  const [validation, setValidation] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  // Auto-populate from Stage 1 & 2 whenever they arrive/update
  useEffect(() => {
    setForm(f => ({
      ...f,
      ...(s1Results && {
        Q_net:    s1Results.Q_final.toFixed(1),
        T_in:     String(s1Results.T_in_C),
        T_out:    String(s1Results.T_out_C),
        P_maop:   String(s1Results.P_kPa),
        P_design: String(s1Results.P_des),
      }),
      ...(s2Results?.T_bath_C && { T_bath: String(s2Results.T_bath_C) }),
    }));
  }, [s1Results, s2Results]);

  const calculate = useCallback(async () => {
    const Q = parseFloat(form.Q_net);
    const T_in = parseFloat(form.T_in), T_out = parseFloat(form.T_out);
    const T_bath = parseFloat(form.T_bath);
    if (!Q || Q <= 0 || !isFinite(T_in) || !isFinite(T_out) || !isFinite(T_bath)) return;
    if (T_bath <= T_out) { setError('Bath T must be > Outlet T'); return; }
    setLoading(true); setError('');
    try {
      const payload = {
        Q_net_kW:      Q,
        T_in_C:        T_in, T_out_C: T_out, T_bath_C: T_bath,
        nPaths:        parseInt(form.nPaths),
        nRows:         parseInt(form.nRows),
        npsKey:        form.nps,
        material:      form.material,
        P_maop_kPa:    parseFloat(form.P_maop),
        P_design_kPa:  parseFloat(form.P_design),
        T_design_C:    parseFloat(form.T_design),
        corrAllow_mm:  parseFloat(form.corrAllow),
        safetyFactor:  parseFloat(form.safetyFactor),
        uMethod:       form.uMethod,
        legLengthFixed: form.legLengthFixed ? parseFloat(form.legLengthFixed) : undefined,
        rhoGasIn:      s1Results?.ST_in?.rho  ?? 55.0,
        rhoGasOut:     s1Results?.ST_out?.rho ?? 51.0,
        massFlowKgh:   s1Results?.mdot_kgs ? s1Results.mdot_kgs * 3600 : 5000,
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
        setError(data.error ?? 'Stage 3 failed');
      }
    } catch (e) { setError(String(e)); }
    setLoading(false);
  }, [form, s1Results, onComplete]);

  // Auto-calc: 300ms debounce on any form change
  useEffect(() => {
    const t = setTimeout(calculate, 300);
    return () => clearTimeout(t);
  }, [calculate]);

  const f1 = (v?: number) => v !== undefined && isFinite(v) ? v.toFixed(1) : '—';
  const f2 = (v?: number) => v !== undefined && isFinite(v) ? v.toFixed(2) : '—';
  const allValidation = validation?.wallThickness?.messages ?? validation?.messages ?? [];

  const selectedPipe = COIL_PIPES.find(p => p.nps === form.nps) ?? COIL_PIPES[3];

  // Per-path hydraulics note
  const nP = parseInt(form.nPaths) || 1;
  const perPathVel_in  = results?.v_inlet_ms  ? (results.v_inlet_ms  * nP).toFixed(1) : '—';
  const perPathVel_out = results?.v_outlet_ms ? (results.v_outlet_ms * nP).toFixed(1) : '—';

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
      {/* ── LEFT: INPUTS ── */}
      <div>
        {(s1Results || s2Results) && (
          <div className="alert alert-ok" style={{ marginBottom:10, fontSize:11 }}>
            ✔ Auto-populated from Stage 1 & 2. Adjust as needed — results update automatically.
          </div>
        )}

        <div className="panel" style={{ marginBottom:12 }}>
          <div className="panel-header"><div className="panel-title">Process Conditions</div></div>
          <div className="panel-body">
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {[
                { k:'Q_net',    label:'Net Duty Q',             unit:'kW' },
                { k:'T_in',     label:'Gas Inlet T',            unit:'°C' },
                { k:'T_out',    label:'Gas Outlet T',           unit:'°C' },
                { k:'T_bath',   label:'Bath T',                 unit:'°C' },
                { k:'P_maop',   label:'MAOP',                   unit:'kPa' },
                { k:'P_design', label:'Design Pressure',        unit:'kPa' },
                { k:'T_design', label:'Design Temperature',     unit:'°C' },
                { k:'corrAllow',label:'Corrosion Allowance',    unit:'mm' },
              ].map(fi => (
                <div key={fi.k}>
                  <label className="field-label">{fi.label}</label>
                  <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                    <input type="number" value={form[fi.k as keyof typeof form] as string}
                      onChange={set(fi.k)} />
                    <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text-dim)' }}>
                      {fi.unit}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="panel" style={{ marginBottom:12 }}>
          <div className="panel-header"><div className="panel-title">Coil Geometry & Metallurgy</div></div>
          <div className="panel-body">
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div>
                <label className="field-label">NPS Pipe Size</label>
                <select value={form.nps} onChange={set('nps')}>
                  {COIL_PIPES.map(p => (
                    <option key={p.nps} value={p.nps}>{p.label} — {p.od} mm OD</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">Material</label>
                <select value={form.material} onChange={set('material')}>
                  <option value="a106b">ASTM A106 Gr B</option>
                  <option value="a333g6">ASTM A333 Gr 6 (Low-Temp)</option>
                  <option value="a312tp316l">ASTM A312 TP316L SS</option>
                </select>
              </div>
              <div>
                <label className="field-label">Parallel Flow Paths</label>
                <input type="number" value={form.nPaths} min="1" max="12" onChange={set('nPaths')} />
              </div>
              <div>
                <label className="field-label">Rows per Path</label>
                <input type="number" value={form.nRows} min="2" max="30" step="2" onChange={set('nRows')} />
              </div>
              <div>
                <label className="field-label">U Value Method</label>
                <select value={form.uMethod} onChange={set('uMethod')}>
                  {U_METHODS.map(m => <option key={m.v} value={m.v}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Safety Factor (fouling)</label>
                <select value={form.safetyFactor} onChange={set('safetyFactor')}>
                  {['1.00','1.05','1.10','1.15','1.20'].map(v => (
                    <option key={v} value={v}>{v}{v==='1.15'?' ★':''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">Leg Length (blank=auto)</label>
                <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                  <input type="number" value={form.legLengthFixed}
                    placeholder="Auto" onChange={set('legLengthFixed')} />
                  <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text-dim)' }}>m</span>
                </div>
              </div>
            </div>

            {/* Live coil sketch — updates on any geometry change */}
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

            {/* Per-path hydraulics note — explains the flow split */}
            <div className="note-box" style={{ marginTop:8, fontSize:10 }}>
              <strong>Flow split:</strong> Total flow divides equally across {nP} path{nP>1?'s':''}.
              Each path carries {nP > 1 ? `1/${nP} of total flow` : 'full flow'}.
              P_inlet is the <em>same</em> for all paths (shared manifold).
              Velocity per path ≈ total velocity / {nP}.
              ΔP per path is calculated at that reduced flow rate.
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT: RESULTS (auto-updating) ── */}
      <div>
        {error && <div className="alert alert-fail" style={{ marginBottom:12 }}>❌ {error}</div>}
        {allValidation.length > 0 && (
          <ValidationPanel messages={allValidation} title="ASME B31.3 Compliance" />
        )}
        {loading && !results && (
          <div style={{ color:'var(--text-dim)', padding:20, textAlign:'center' }}>⏳ Calculating…</div>
        )}

        {results && (
          <>
            <div className="panel" style={{ marginBottom:12 }}>
              <div className="panel-header">
                <div className="panel-title">Thermal Sizing</div>
                {loading && (
                  <span style={{ fontSize:9, color:'var(--text-dim)', marginLeft:'auto' }}>
                    updating…
                  </span>
                )}
              </div>
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
                    <ResultCard label="Total Length" value={results.L_total} unit="m"
                      decimals={1} variant="highlight" />
                  </ResultGrid>
                </div>
                <LMTDChart tIn={parseFloat(form.T_in)} tOut={parseFloat(form.T_out)}
                  tBath={parseFloat(form.T_bath)} />
              </div>
            </div>

            <div className="panel" style={{ marginBottom:12 }}>
              <div className="panel-header"><div className="panel-title">Hydraulics</div></div>
              <div className="panel-body">
                <ResultGrid cols={2}>
                  <ResultCard label="Velocity Inlet (total)" value={results.v_inlet_ms}
                    unit="m/s" decimals={1} variant={results.v_inlet_ms > 15 ? 'red' : 'default'} />
                  <ResultCard label="Velocity Outlet (total)" value={results.v_outlet_ms}
                    unit="m/s" decimals={1} variant={results.v_outlet_ms > 15 ? 'red' : 'default'} />
                </ResultGrid>
                <table className="res-table" style={{ marginTop:8, fontSize:11 }}>
                  <tbody>
                    <tr>
                      <td>Coil ΔP</td>
                      <td className="val"
                        style={{ color: results.dP_acceptable ? 'var(--green)' : 'var(--red)' }}>
                        {f1(results.dP_kPa)}
                      </td>
                      <td>kPa {results.dP_acceptable ? '✔' : '✘ too high'}</td>
                    </tr>
                    <tr>
                      <td>Leg length</td>
                      <td className="val">{f2(results.L_leg)}</td>
                      <td>m {results.lenFixed ? '(fixed)' : '(calculated)'}</td>
                    </tr>
                    <tr>
                      <td>Bends per path</td>
                      <td className="val">{results.n_bends_path ?? '—'}</td><td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header"><div className="panel-title">ASME B31.3 Mechanical</div></div>
              <div className="panel-body">
                <table className="res-table" style={{ fontSize:11 }}>
                  <tbody>
                    <tr>
                      <td>OD / Wall (selected)</td>
                      <td className="val">{f2(results.do_m * 1000)} / {f2(results.wt_act)} mm</td>
                      <td>Sch {results.sched?.nm ?? '—'}</td>
                    </tr>
                    <tr>
                      <td>ID (after CA)</td>
                      <td className="val">{f2(results.di_act)}</td><td>mm</td>
                    </tr>
                    <tr>
                      <td>Paths × Rows</td>
                      <td className="val">{results.n_pass} × {results.n_rows}</td><td></td>
                    </tr>
                    <tr>
                      <td>B31.3 t_nom</td>
                      <td className="val">{f2(results.t_nom)}</td><td>mm (with mill tol + CA)</td>
                    </tr>
                    <tr>
                      <td>Allowable stress S</td>
                      <td className="val">{results.S_MPa}</td><td>MPa @ {form.T_design}°C</td>
                    </tr>
                    <tr>
                      <td>Flange class</td>
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
          </>
        )}

        {!results && !loading && !error && (
          <div className="panel">
            <div className="panel-body" style={{ color:'var(--text-dim)', padding:'32px 0', textAlign:'center' }}>
              Adjust inputs — results appear automatically.
              <br/>
              <span style={{ fontSize:11 }}>Sketch updates live. Results follow 300ms after.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
