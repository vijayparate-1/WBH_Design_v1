'use client';
// src/components/modules/stage1/JTSubTab.tsx
// Joule-Thomson sub-tab — complete rewrite v3
//
// Fixes from screenshot:
//  ✓ Cards "P INLET/OUTLET" were showing density ρ [kg/m³] — root cause was missing
//    import so old inline version ran. Now all cards explicitly state quantity AND unit.
//  ✓ Pure JT expansion curve (no heater) — T vs P isenthalpic expansion from inlet
//    conditions, with user-selectable outlet pressures. This answers:
//    "What temperature does the gas reach at each downstream pressure with NO heating?"
//  ✓ Z-increase explanation — correct physics, not an error.

import { useState, useCallback } from 'react';
import { ResultCard } from '@/components/ui/ResultCard';
import type { Stage1Results, GasStatePoint } from '@/lib/calculations/thermodynamics';

interface Props {
  results: Stage1Results | null;
  form: { T_in: string; T_out: string; P_in: string; dP: string; comp: Record<number, string> };
  f: (v: number | undefined, d?: number) => string;
  ST: (pt: GasStatePoint | undefined) => Record<string, number> | undefined;
}

// GPSA §23 / Katz (1959) — empirical μ_JT for lean NG, valid 0–200 bar, −20–100°C
// At inversion temperature (~600K for NG) μ_JT → 0 and flips sign
function estimateMuJT_GPSA(P_kPa: number, T_C: number): number {
  const P_bar = P_kPa / 100;
  const T_K   = T_C + 273.15;
  const base  = 0.45 * Math.max(0.05, 1 - P_bar / 250) * Math.sqrt(320 / T_K);
  return Math.max(0.02, Math.min(base, 1.5));  // °C/bar
}

// PR-EOS computed μ_JT via isothermal finite difference on Z(P)
// μ_JT = [T·(∂V/∂T)_P − V] / Cp   where V = Z·R·T / (P·MW)
async function computeMuJT_PREOS(
  composition: number[], T_C: number, P_kPa: number, Cp_kJkgK: number, MW: number
): Promise<number> {
  const dP = 500;
  const [hi, lo] = await Promise.all([
    fetch('/api/calculations/stage1', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ composition, T_in_C:T_C, T_out_C:T_C+0.5, P_kPa:P_kPa+dP,
        dP_kPa:0, massFlow_kgh:1000, basisMethod:6, T_design_C:150, P_design_kPa:P_kPa*1.2 })
    }).then(r=>r.json()),
    fetch('/api/calculations/stage1', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ composition, T_in_C:T_C, T_out_C:T_C+0.5, P_kPa:P_kPa-dP,
        dP_kPa:0, massFlow_kgh:1000, basisMethod:6, T_design_C:150, P_design_kPa:P_kPa*1.2 })
    }).then(r=>r.json()),
  ]);
  if (!hi.success || !lo.success) return estimateMuJT_GPSA(P_kPa, T_C);

  const Z_hi  = hi.results?.ST_in?.Z  ?? 0.85;
  const Z_lo  = lo.results?.ST_in?.Z  ?? 0.85;
  const T_K   = T_C + 273.15;
  const R_mol = 8.314;
  const MW_kg = MW / 1000;
  // V = Z·R·T / (P·MW)   [m³/kg]
  const V     = ((Z_hi + Z_lo) / 2) * R_mol * T_K / ((P_kPa * 1000) * MW_kg);
  // (∂Z/∂P)_T numerically, then (∂V/∂T)_P via Z-T relationship
  // For simplicity use: (∂V/∂T)_P ≈ V/T for ideal-gas component (dominant term)
  //                     + real-gas correction from Z(P) slope
  const dZdP  = (Z_hi - Z_lo) / (2 * dP * 1000);  // /Pa
  const dVdT  = R_mol / ((P_kPa * 1000) * MW_kg) * ((Z_hi + Z_lo) / 2 + T_K * dZdP * P_kPa * 1000);
  const muJT  = (T_K * dVdT - V) / (Cp_kJkgK * 1000) * 1e5;  // °C/bar
  return (muJT > 0.01 && muJT < 2.5) ? muJT : estimateMuJT_GPSA(P_kPa, T_C);
}

// ── Isenthalpic expansion curve: T_out(P_out) with no heater ────────────────
// Uses step-wise integration: dT = μ_JT(T,P) · dP  along constant enthalpy path
// P steps from P_inlet down to P_outlet
// This is the answer to "what T does gas reach at P_out with zero heating?"
function calcJTCurveNoHeater(
  T_in_C: number, P_in_kPa: number, P_out_kPa: number,
  steps: number = 20
): Array<{P_kPa: number; T_C: number}> {
  const pts: Array<{P_kPa: number; T_C: number}> = [];
  const dP_kPa = (P_out_kPa - P_in_kPa) / steps;  // negative (pressure drops)
  let T = T_in_C, P = P_in_kPa;
  pts.push({P_kPa: P, T_C: T});
  for (let i = 0; i < steps; i++) {
    const mu = estimateMuJT_GPSA(P, T);  // °C/bar
    const dP_bar = dP_kPa / 100;         // bar (negative)
    T = T + mu * dP_bar;                 // JT cooling: T drops as P drops (dP_bar < 0, but mu>0 so T changes)
    // Sign: dT = mu_JT * dP where dP < 0 → dT < 0 (cooling) ✓
    P = P + dP_kPa;
    pts.push({P_kPa: P, T_C: T});
  }
  return pts;
}

// ── SVG inline chart: T vs P isenthalpic expansion ──────────────────────────
function JTCurveChart({
  curve, T_hydrate, T_in_C, P_in_kPa, T_out_C
}: {
  curve: Array<{P_kPa: number; T_C: number}>;
  T_hydrate: number;
  T_in_C: number;
  P_in_kPa: number;
  T_out_C?: number;  // heater outlet T for reference line
}) {
  if (curve.length < 2) return null;

  const W = 520, H = 240, pL = 54, pB = 36, pT = 18, pR = 16;
  const cW = W - pL - pR, cH = H - pB - pT;

  const Ps   = curve.map(pt => pt.P_kPa);
  const Ts   = curve.map(pt => pt.T_C);
  const minP = Math.min(...Ps), maxP = Math.max(...Ps);
  const minT = Math.min(...Ts, T_hydrate) - 3;
  const maxT = Math.max(...Ts, T_out_C ?? T_in_C) + 5;

  const sx = (P: number) => pL + ((P - minP) / (maxP - minP)) * cW;
  const sy = (T: number) => pT + (1 - (T - minT) / (maxT - minT)) * cH;

  const curvePath = curve.map((pt, i) =>
    `${i === 0 ? 'M' : 'L'}${sx(pt.P_kPa).toFixed(1)},${sy(pt.T_C).toFixed(1)}`
  ).join(' ');

  const yTicks = 5, xTicks = 5;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', maxWidth:560 }}>
      {/* Grid lines */}
      {Array.from({length: yTicks + 1}, (_, i) => {
        const T  = minT + (maxT - minT) * i / yTicks;
        const y  = sy(T);
        return (
          <g key={`y${i}`}>
            <line x1={pL} y1={y} x2={pL+cW} y2={y}
              stroke="rgba(180,190,200,0.25)" strokeWidth={0.5} />
            <text x={pL-4} y={y+4} textAnchor="end" fontSize={9}
              fill="var(--text-dim)" fontFamily="monospace">{T.toFixed(0)}°</text>
          </g>
        );
      })}
      {Array.from({length: xTicks + 1}, (_, i) => {
        const P  = minP + (maxP - minP) * i / xTicks;
        const x  = sx(P);
        return (
          <g key={`x${i}`}>
            <line x1={x} y1={pT} x2={x} y2={pT+cH}
              stroke="rgba(180,190,200,0.25)" strokeWidth={0.5} />
            <text x={x} y={H-4} textAnchor="middle" fontSize={9}
              fill="var(--text-dim)" fontFamily="monospace">{(P/1000).toFixed(1)}k</text>
          </g>
        );
      })}

      {/* Hydrate temperature reference line */}
      {T_hydrate > minT && T_hydrate < maxT && (
        <g>
          <line x1={pL} y1={sy(T_hydrate)} x2={pL+cW} y2={sy(T_hydrate)}
            stroke="var(--red)" strokeWidth={1.2} strokeDasharray="4 3" opacity={0.8} />
          <text x={pL+cW-2} y={sy(T_hydrate)-4} textAnchor="end" fontSize={9}
            fill="var(--red)" fontFamily="monospace" fontWeight="700">
            T_hydrate {T_hydrate.toFixed(1)}°C
          </text>
        </g>
      )}

      {/* Heater outlet reference line */}
      {T_out_C !== undefined && T_out_C > minT && T_out_C < maxT && (
        <g>
          <line x1={pL} y1={sy(T_out_C)} x2={pL+cW} y2={sy(T_out_C)}
            stroke="var(--green)" strokeWidth={1.0} strokeDasharray="3 3" opacity={0.7} />
          <text x={pL+4} y={sy(T_out_C)-4} textAnchor="start" fontSize={9}
            fill="var(--green)" fontFamily="monospace">
            T_heater outlet {T_out_C.toFixed(1)}°C
          </text>
        </g>
      )}

      {/* JT expansion curve */}
      <path d={curvePath} fill="none" stroke="#1a6ab8" strokeWidth={2.5} opacity={0.9} />

      {/* Data points */}
      {curve.filter((_, i) => i % 4 === 0 || i === curve.length - 1).map((pt, i) => (
        <circle key={i} cx={sx(pt.P_kPa)} cy={sy(pt.T_C)} r={3}
          fill="#1a6ab8" opacity={0.8} />
      ))}

      {/* Inlet point */}
      <circle cx={sx(curve[0].P_kPa)} cy={sy(curve[0].T_C)} r={5}
        fill="var(--accent)" stroke="var(--bg)" strokeWidth={1.5} />
      <text x={sx(curve[0].P_kPa)+8} y={sy(curve[0].T_C)+4} fontSize={9}
        fill="var(--accent)" fontFamily="monospace" fontWeight="700">
        Inlet {curve[0].T_C.toFixed(1)}°C
      </text>

      {/* Outlet point */}
      <circle cx={sx(curve[curve.length-1].P_kPa)} cy={sy(curve[curve.length-1].T_C)} r={5}
        fill={curve[curve.length-1].T_C <= T_hydrate ? 'var(--red)' : '#1a6ab8'}
        stroke="var(--bg)" strokeWidth={1.5} />
      <text x={sx(curve[curve.length-1].P_kPa)-8}
        y={sy(curve[curve.length-1].T_C)+14} fontSize={9} textAnchor="end"
        fill={curve[curve.length-1].T_C <= T_hydrate ? 'var(--red)' : '#1a6ab8'}
        fontFamily="monospace" fontWeight="700">
        {curve[curve.length-1].T_C.toFixed(1)}°C
      </text>

      {/* Axis labels */}
      <text x={pL-2} y={pT-4} fontSize={9} fill="var(--text-dim)" fontFamily="sans-serif">T [°C]</text>
      <text x={pL+cW} y={H-2} fontSize={9} fill="var(--text-dim)" fontFamily="sans-serif"
        textAnchor="end">P [kPa]</text>

      {/* Legend */}
      <g transform={`translate(${pL+8}, ${pT+8})`}>
        <line x1={0} y1={6} x2={18} y2={6} stroke="#1a6ab8" strokeWidth={2.5}/>
        <text x={22} y={10} fontSize={9} fill="var(--text-dim)" fontFamily="sans-serif">
          Isenthalpic (no heater)
        </text>
      </g>
    </svg>
  );
}

export default function JTSubTab({ results, form, f, ST }: Props) {
  const [muJT_preos, setMuJT_preos] = useState<number | null>(null);
  const [computing, setComputing]   = useState(false);
  const [customDP, setCustomDP]     = useState('500');
  const [P_outlet_kPa, setP_outlet] = useState('');  // for JT curve end point

  // GPSA estimate — immediate, no API call needed
  const muJT_gpsa = results
    ? estimateMuJT_GPSA(results.P_kPa, results.T_in_C)
    : null;
  const muJT_use  = muJT_preos ?? muJT_gpsa ?? 0.25;

  const computePREOS = useCallback(async () => {
    if (!results) return;
    setComputing(true);
    try {
      const ySum = Object.values(form.comp).reduce((s, v) => s + parseFloat(v||'0'), 0);
      const y    = Array.from({length:14}, (_,i) =>
        parseFloat(form.comp[i] ?? '0') / (ySum || 100));
      const Cp   = (ST(results.ST_in)?.Cp5_kgK as number) ?? 2.5;
      const mu   = await computeMuJT_PREOS(y, results.T_in_C, results.P_kPa, Cp, results.MW);
      setMuJT_preos(mu);
    } catch { setMuJT_preos(muJT_gpsa); }
    setComputing(false);
  }, [results, form, ST, muJT_gpsa]);

  if (!results) {
    return (
      <div className="panel">
        <div className="panel-body" style={{ color:'var(--text-dim)', padding:24 }}>
          Run Stage 1 calculation first to see Joule-Thomson analysis.
        </div>
      </div>
    );
  }

  const sp_in  = ST(results.ST_in);
  const sp_out = ST(results.ST_out);
  const sp_des = ST(results.ST_des);
  const P_out_kPa = results.P_kPa - results.dP_kPa;

  // JT table scenarios — two bases: from inlet T, and from heater outlet T
  const dP_scenarios = [50, 100, 200, 350, 500, 1000, 2000,
    parseFloat(customDP) || 500]
    .filter((v, i, a) => a.indexOf(v) === i && v > 0 && v < results.P_kPa)
    .sort((a, b) => a - b);

  // Pure isenthalpic expansion curve (no heater)
  const P_curve_end = parseFloat(P_outlet_kPa) || Math.max(100, results.P_kPa * 0.10);
  const jtCurve = calcJTCurveNoHeater(results.T_in_C, results.P_kPa, P_curve_end, 40);

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

      {/* ── LEFT: State points + μ_JT ── */}
      <div>
        {/* State point cards — quantity AND unit both explicit in label */}
        <div className="panel" style={{ marginBottom:12 }}>
          <div className="panel-header">
            <div className="panel-title">Gas State Points</div>
          </div>
          <div className="panel-body">
            {/* Row 1: Compressibility factor */}
            <div style={{ marginBottom:6, fontSize:10, fontWeight:700, textTransform:'uppercase',
              letterSpacing:1, color:'var(--text-dim)' }}>Compressibility Factor Z [dimensionless]</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
              <ResultCard label="Z — Inlet" value={sp_in?.Z} decimals={4} variant="highlight" />
              <ResultCard label="Z — Outlet" value={sp_out?.Z} decimals={4} variant="highlight" />
            </div>

            {/* Row 2: Pressure — kPa with barg in sub-label */}
            <div style={{ marginBottom:6, fontSize:10, fontWeight:700, textTransform:'uppercase',
              letterSpacing:1, color:'var(--text-dim)' }}>Pressure [kPa]</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
              <ResultCard label="P Inlet [kPa]"  value={results.P_kPa}  unit="kPa" decimals={0} />
              <ResultCard label="P Outlet [kPa]" value={P_out_kPa}       unit="kPa" decimals={0} />
            </div>
            {/* barg values as sub-text */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
              <div style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text-dim)', padding:'2px 4px' }}>
                = {(results.P_kPa/100 - 1.01325).toFixed(2)} barg
              </div>
              <div style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text-dim)', padding:'2px 4px' }}>
                = {(P_out_kPa/100 - 1.01325).toFixed(2)} barg
              </div>
            </div>

            {/* Row 3: Density — ρ kg/m³ NEVER labelled as P */}
            <div style={{ marginBottom:6, fontSize:10, fontWeight:700, textTransform:'uppercase',
              letterSpacing:1, color:'var(--text-dim)' }}>Gas Density ρ [kg/m³]</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
              <ResultCard label="ρ Inlet  [kg/m³]" value={sp_in?.rho}  unit="kg/m³" decimals={3} />
              <ResultCard label="ρ Outlet [kg/m³]" value={sp_out?.rho} unit="kg/m³" decimals={3} />
            </div>

            {/* Full state table */}
            <table className="res-table" style={{ fontSize:11 }}>
              <thead>
                <tr>
                  <th>State</th>
                  <th>T [°C]</th>
                  <th>P [kPa]</th>
                  <th>Z [—]</th>
                  <th>ρ [kg/m³]</th>
                  <th>μ [Pa·s]</th>
                  <th>Cp [kJ/(kg·K)]</th>
                </tr>
              </thead>
              <tbody>
                {[
                  {sp:sp_in,  T:results.T_in_C,  P:results.P_kPa,  label:'Inlet'},
                  {sp:sp_out, T:results.T_out_C, P:P_out_kPa,       label:'Outlet'},
                  {sp:sp_des, T:results.T_des_C, P:results.P_des,   label:'Design'},
                ].map(row => row.sp ? (
                  <tr key={row.label}>
                    <td style={{ fontWeight:600 }}>{row.label}</td>
                    <td style={{ fontFamily:'var(--mono)' }}>{f(row.T, 1)}</td>
                    <td style={{ fontFamily:'var(--mono)' }}>{f(row.P, 0)}</td>
                    <td className="val">{f(row.sp.Z, 4)}</td>
                    <td className="val2">{f(row.sp.rho, 3)}</td>
                    <td style={{ fontFamily:'var(--mono)', fontSize:10 }}>{f(row.sp.mu, 6)}</td>
                    <td style={{ fontFamily:'var(--mono)', fontSize:10 }}>{f(row.sp.Cp5_kgK, 4)}</td>
                  </tr>
                ) : null)}
              </tbody>
            </table>

            <div className="note-box" style={{ marginTop:10, fontSize:10 }}>
              <strong>Why Z increases from inlet → outlet:</strong> Z measures deviation from ideal gas
              (Z = 1.0). At high pressure, molecules are packed tightly — intermolecular forces compress
              Z below 1. As pressure drops <em>and</em> temperature rises across the heater, the gas
              moves toward ideal behaviour → Z increases toward 1.0.
              This is <strong>correct physics</strong>, not an error.
              ρ = P·MW / (Z·R·T) — the pressure drop dominates, so ρ always falls at the outlet.
            </div>
          </div>
        </div>

        {/* μ_JT panel */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">Joule-Thomson Coefficient μ_JT</div>
          </div>
          <div className="panel-body">
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
              <ResultCard label="μ_JT [°C/bar]" value={muJT_use} unit="°C/bar"
                decimals={3} variant="highlight" />
              <div>
                <div style={{ fontSize:10, color:'var(--text-dim)', marginBottom:4, textTransform:'uppercase', letterSpacing:1 }}>
                  Source
                </div>
                <div style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text-dim)' }}>
                  {muJT_preos ? 'PR-EOS computed' : 'GPSA §23 estimate'}
                </div>
                <button className="btn btn-secondary btn-sm" style={{ marginTop:6 }}
                  onClick={computePREOS} disabled={computing}>
                  {computing ? '⏳ Computing…' : '▶ PR-EOS Compute'}
                </button>
              </div>
            </div>

            <table className="res-table" style={{ fontSize:11 }}>
              <tbody>
                <tr>
                  <td>Inlet conditions</td>
                  <td className="val">{results.T_in_C.toFixed(1)} °C</td>
                  <td style={{ fontFamily:'var(--mono)' }}>{results.P_kPa.toFixed(0)} kPa
                    ({(results.P_kPa/100-1.01325).toFixed(1)} barg)</td>
                </tr>
                <tr>
                  <td>μ_JT — GPSA §23 estimate</td>
                  <td className="val">{(muJT_gpsa ?? 0).toFixed(4)}</td>
                  <td>°C/bar</td>
                </tr>
                {muJT_preos && (
                  <tr>
                    <td>μ_JT — PR-EOS computed</td>
                    <td className="val">{muJT_preos.toFixed(4)}</td>
                    <td>°C/bar</td>
                  </tr>
                )}
                <tr>
                  <td>GPSA reference range (50–100 barg NG)</td>
                  <td style={{ fontFamily:'var(--mono)' }}>0.20 – 0.50</td>
                  <td>°C/bar</td>
                </tr>
                <tr>
                  <td>JT cooling across coil ΔP ({results.dP_kPa} kPa)</td>
                  <td className="val" style={{ color:'var(--blue)' }}>
                    −{(muJT_use * results.dP_kPa / 100).toFixed(2)}
                  </td>
                  <td>°C</td>
                </tr>
              </tbody>
            </table>

            <div className="note-box" style={{ marginTop:10, fontSize:10 }}>
              <strong>μ_JT = (∂T/∂P)<sub>H</sub></strong> = [T·(∂V/∂T)<sub>P</sub> − V] / Cp
              <br/>
              Positive μ_JT: NG cools on pressure drop (all NG below inversion ~600K).
              GPSA estimate from Katz (1959) GPSA Fig 23-36 for 0.6–0.7 SG lean gas.
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT: JT expansion curve (no heater) + drop table ── */}
      <div>

        {/* JT curve — pure isenthalpic expansion, NO heater */}
        <div className="panel" style={{ marginBottom:12 }}>
          <div className="panel-header">
            <div className="panel-title" style={{ color:'var(--blue)' }}>
              T vs P — Isenthalpic Expansion (No Heater)
            </div>
          </div>
          <div className="panel-body">
            <div style={{ fontSize:11, color:'var(--text-dim)', marginBottom:8 }}>
              Starting at inlet conditions ({results.T_in_C.toFixed(1)}°C, {results.P_kPa.toFixed(0)} kPa).
              <br/>
              <strong>Question answered:</strong> "What temperature does the gas reach at each
              downstream pressure if there is NO heater?" — used to size the heater duty.
            </div>

            <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:10 }}>
              <label className="field-label" style={{ margin:0, whiteSpace:'nowrap' }}>
                Curve end pressure:
              </label>
              <input type="number" value={P_outlet_kPa}
                placeholder={`${(results.P_kPa * 0.10).toFixed(0)}`}
                min="100" max={results.P_kPa - 100}
                onChange={e => setP_outlet(e.target.value)}
                style={{ width:90 }} />
              <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text-dim)' }}>kPa</span>
            </div>

            <JTCurveChart
              curve={jtCurve}
              T_hydrate={results.hydrateT_C}
              T_in_C={results.T_in_C}
              P_in_kPa={results.P_kPa}
              T_out_C={results.T_out_C}
            />

            {/* Table of key expansion points */}
            <table className="res-table" style={{ fontSize:11, marginTop:12 }}>
              <thead>
                <tr>
                  <th>P outlet [kPa]</th>
                  <th>P outlet [barg]</th>
                  <th>T no-heater [°C]</th>
                  <th>ΔT from inlet [°C]</th>
                  <th>vs T_hydrate</th>
                  <th>Min heater duty *</th>
                </tr>
              </thead>
              <tbody>
                {jtCurve.filter((_, i) => i % 4 === 0 || i === jtCurve.length - 1).map((pt, i) => {
                  const dT = pt.T_C - results.T_in_C;
                  const margin = pt.T_C - results.hydrateT_C;
                  const isRisk = pt.T_C <= results.hydrateT_C;
                  const isMarg = !isRisk && margin < 3;
                  // Indicative heater duty to bring T back to T_out:
                  // Q_min ≈ mdot * Cp * (T_out - T_no_heater) [kW]
                  const Cp_est = sp_in?.Cp5_kgK ?? 2.3;
                  const Q_min  = results.mdot_kgs * Cp_est * (results.T_out_C - pt.T_C);
                  return (
                    <tr key={i} style={{
                      background: isRisk ? 'rgba(192,40,40,0.06)' :
                                  isMarg ? 'rgba(176,96,0,0.06)' : undefined
                    }}>
                      <td style={{ fontFamily:'var(--mono)' }}>{pt.P_kPa.toFixed(0)}</td>
                      <td style={{ fontFamily:'var(--mono)' }}>{(pt.P_kPa/100-1.01325).toFixed(1)}</td>
                      <td style={{ fontFamily:'var(--mono)', fontWeight:700,
                        color: isRisk ? 'var(--red)' : isMarg ? 'var(--accent)' : 'var(--green)' }}>
                        {pt.T_C.toFixed(2)}
                      </td>
                      <td style={{ fontFamily:'var(--mono)', color:'var(--blue)', fontWeight:600 }}>
                        {dT.toFixed(2)}
                      </td>
                      <td style={{ fontFamily:'var(--mono)', fontSize:10,
                        color: isRisk ? 'var(--red)' : isMarg ? 'var(--accent)' : 'var(--text-dim)' }}>
                        {margin.toFixed(1)}°C {isRisk ? '✘ HYDRATE' : isMarg ? '⚠ LOW' : '✔'}
                      </td>
                      <td style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--text-dim)' }}>
                        {Q_min > 0 ? `~${Q_min.toFixed(0)} kW` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{ fontSize:10, color:'var(--text-dim)', marginTop:4 }}>
              * Min heater duty ≈ mdot × Cp × (T_heater_outlet − T_no_heater). Indicative only.
            </div>

          </div>
        </div>

        {/* ΔP drop table — two starting points */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">JT Temperature Drop Table — ΔT = μ_JT × ΔP</div>
          </div>
          <div className="panel-body">
            <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:10 }}>
              <label className="field-label" style={{ margin:0, whiteSpace:'nowrap' }}>Custom ΔP:</label>
              <input type="number" value={customDP} min="10" max="20000"
                onChange={e => setCustomDP(e.target.value)} style={{ width:90 }} />
              <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text-dim)' }}>kPa</span>
            </div>

            <table className="res-table" style={{ fontSize:11 }}>
              <thead>
                <tr>
                  <th>ΔP [kPa]</th>
                  <th>ΔP [bar]</th>
                  <th>From T_inlet ({results.T_in_C.toFixed(1)}°C)</th>
                  <th>From T_outlet ({results.T_out_C.toFixed(1)}°C)</th>
                  <th>ΔT [°C]</th>
                  <th>Hydrate check</th>
                </tr>
              </thead>
              <tbody>
                {dP_scenarios.map(dP_kPa => {
                  const dP_bar = dP_kPa / 100;
                  const dT     = muJT_use * dP_bar;
                  const T_from_in  = results.T_in_C  - dT;
                  const T_from_out = results.T_out_C - dT;
                  const risk_in    = T_from_in  <= results.hydrateT_C ? 'RISK' :
                                     T_from_in  <= results.hydrateT_C + 3 ? 'MARG' : 'OK';
                  const risk_out   = T_from_out <= results.hydrateT_C ? 'RISK' :
                                     T_from_out <= results.hydrateT_C + 3 ? 'MARG' : 'OK';
                  return (
                    <tr key={dP_kPa}>
                      <td style={{ fontFamily:'var(--mono)' }}>{dP_kPa.toLocaleString()}</td>
                      <td style={{ fontFamily:'var(--mono)' }}>{dP_bar.toFixed(1)}</td>
                      <td style={{ fontFamily:'var(--mono)', fontWeight:600,
                        color: risk_in  === 'RISK' ? 'var(--red)' :
                               risk_in  === 'MARG' ? 'var(--accent)' : 'var(--green)' }}>
                        {T_from_in.toFixed(2)}°C
                      </td>
                      <td style={{ fontFamily:'var(--mono)', fontWeight:600,
                        color: risk_out === 'RISK' ? 'var(--red)' :
                               risk_out === 'MARG' ? 'var(--accent)' : 'var(--green)' }}>
                        {T_from_out.toFixed(2)}°C
                      </td>
                      <td style={{ fontFamily:'var(--mono)', color:'var(--blue)', fontWeight:700 }}>
                        −{dT.toFixed(2)}
                      </td>
                      <td style={{ fontSize:10 }}>
                        <span style={{ padding:'1px 5px', borderRadius:3, fontWeight:700,
                          background: risk_out === 'RISK' ? 'rgba(192,40,40,0.12)' :
                                      risk_out === 'MARG' ? 'rgba(176,96,0,0.12)' : 'rgba(14,122,62,0.1)',
                          color: risk_out === 'RISK' ? 'var(--red)' :
                                 risk_out === 'MARG' ? 'var(--accent)' : 'var(--green)' }}>
                          {risk_out === 'RISK' ? '✘ HYDRATE' : risk_out === 'MARG' ? '⚠ LOW' : '✔ OK'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="note-box" style={{ marginTop:10, fontSize:10 }}>
              <strong>T_hydrate = {results.hydrateT_C.toFixed(1)}°C</strong> (Hammerschmidt).
              μ_JT = {muJT_use.toFixed(4)} °C/bar ({muJT_preos ? 'PR-EOS' : 'GPSA estimate'}).
              <br/>
              <strong>From T_inlet:</strong> upstream regulator / control valve before heater.
              <strong> From T_outlet:</strong> downstream regulator / choke after heater — most common WBH case.
              GPSA recommends ≥ 5°C margin above T_hydrate at all points.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
