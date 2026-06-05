'use client';
// src/components/modules/Stage1GasProps.tsx
// Stage 1 — PR-EOS Gas Properties (complete rewrite with graphs + all sub-tabs)

import { useState, useCallback, useRef } from 'react';
import ValidationPanel from '@/components/ui/ValidationPanel';
import { ResultCard, ResultGrid } from '@/components/ui/ResultCard';
import type { Stage1Results, GasStatePoint } from '@/lib/calculations/thermodynamics';

// ─── Gas presets ─────────────────────────────────────────────────────────────
const GAS_PRESETS: Record<string, { name: string; comp: Record<number, number> }> = {
  aus_bass:     { name:'Bass Strait / VIC Transmission',        comp:{0:89.5,1:5.3,2:1.5,3:0.1,4:0.3,9:2.1,10:1.2} },
  aus_surat:    { name:'Surat Basin / QLD CSG',                 comp:{0:97.2,1:0.5,2:0.1,9:1.8,10:0.4} },
  aus_carnarvon:{ name:'Carnarvon Basin / WA (Dry)',            comp:{0:88.5,1:5.8,2:1.2,4:0.3,9:2.8,10:1.4} },
  aus_browse:   { name:'Browse Basin / WA (Rich)',              comp:{0:81.2,1:8.9,2:3.1,3:0.8,4:1.1,9:1.5,10:3.4} },
  aus_cooper:   { name:'Cooper Basin / SA–QLD',                 comp:{0:78.5,1:9.3,2:4.2,3:1.1,4:1.8,5:0.5,9:2.2,10:2.4} },
  sea_sarawak:  { name:'Sarawak / Malaysia (CO₂ 4%)',           comp:{0:88.5,1:3.5,2:1.2,4:0.2,9:2.6,10:4.0} },
  sea_natuna:   { name:'Natuna / Indonesia (CO₂ 12%)',          comp:{0:75.0,1:4.5,2:1.8,9:2.7,10:12.0} },
  me_saudi:     { name:'Saudi Arabia / Gulf (rich)',            comp:{0:73.0,1:10.5,2:5.1,3:1.8,4:2.6,5:1.2,9:2.8,10:3.0} },
  me_sour:      { name:'Middle East Sour (H₂S 3.5%, CO₂ 5%)', comp:{0:79.5,1:5.5,2:1.8,9:4.7,10:5.0,11:3.5} },
  nz_maui:      { name:'Maui / Pohokura — NZ Sales Gas',       comp:{0:88.9,1:5.8,2:1.3,4:0.2,9:2.6,10:1.2} },
  gen_lean:     { name:'Generic Lean (95% CH4)',                comp:{0:95.0,1:2.5,9:1.5,10:1.0} },
  sour_mild:    { name:'Mild Sour (H₂S 2%, CO₂ 3.5%)',        comp:{0:85.0,1:5.0,2:1.5,4:0.3,9:2.7,10:3.5,11:2.0} },
};

const COMP_LIST = [
  [0,'Methane','CH₄'],[1,'Ethane','C₂H₆'],[2,'Propane','C₃H₈'],
  [3,'i-Butane','iC₄'],[4,'n-Butane','nC₄'],[5,'i-Pentane','iC₅'],
  [6,'n-Pentane','nC₅'],[7,'n-Hexane','nC₆'],[8,'n-Heptane','nC₇'],
  [9,'Nitrogen','N₂'],[10,'Carbon Dioxide','CO₂'],[11,'H₂S','H₂S'],
  [12,'Helium','He'],[13,'Hydrogen','H₂'],
] as const;

const METHODS = [
  { v:'1', label:'M1', desc:'Peng-Robinson Analytic' },
  { v:'2', label:'M2', desc:'Peng-Robinson ΔH' },
  { v:'3', label:'M3', desc:'Peng-Robinson T·dS/dT' },
  { v:'4', label:'M4', desc:'SRK' },
  { v:'5', label:'M5 ★', desc:'Avg(M1+M2)' },
  { v:'6', label:'M6', desc:'Peng-Robinson ΔH Full' },
  { v:'7', label:'M7', desc:'Lee-Kesler' },
];

interface Props {
  onComplete?: (r: Stage1Results) => void;
  initialValues?: Partial<S1Form>;
}
interface S1Form {
  comp: Record<number, string>;
  T_in: string; T_out: string; P_in: string; dP: string;
  mflow: string; flowUnit: 'kgh' | 'nm3h';
  basis: string; T_design: string; P_design: string; dutyOverride: string;
}

const DEFAULT: S1Form = {
  comp: { 0:'92.0', 1:'4.5', 2:'1.5', 4:'0.3', 9:'1.2', 10:'0.5' },
  T_in:'5', T_out:'40', P_in:'7000', dP:'50',
  mflow:'5000', flowUnit:'kgh', basis:'5',
  T_design:'100', P_design:'7700', dutyOverride:'',
};

// ─── Small inline SVG chart ───────────────────────────────────────────────────
function SparkBar({ values, labels, colors, title, unit, yMin }: {
  values: number[]; labels: string[]; colors: string[];
  title: string; unit: string; yMin?: number;
}) {
  const valid = values.filter(v => v > 0 && isFinite(v));
  if (valid.length === 0) return null;
  const max = Math.max(...valid);
  const min = yMin ?? Math.min(...valid) * 0.9;
  const W = 300, H = 120, padL = 48, padB = 24, padT = 20, padR = 8;
  const cW = W - padL - padR, cH = H - padB - padT;
  const bW = Math.floor(cW / values.length) - 4;

  return (
    <div>
      <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:1,
        color:'var(--text-dim)', marginBottom:4 }}>{title}</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', maxWidth:320 }}>
        {/* Y axis labels */}
        {[0, 0.5, 1].map(t => {
          const v = min + (max - min) * t;
          const y = padT + cH * (1 - t);
          return (
            <g key={t}>
              <text x={padL - 4} y={y + 4} textAnchor="end" fontSize={8}
                fill="var(--text-dim)" fontFamily="monospace">{v.toFixed(2)}</text>
              <line x1={padL} y1={y} x2={padL + cW} y2={y}
                stroke="rgba(180,190,200,0.3)" strokeWidth={0.5} />
            </g>
          );
        })}
        {/* Bars */}
        {values.map((v, i) => {
          if (!isFinite(v) || v <= 0) return null;
          const barH = max > min ? ((v - min) / (max - min)) * cH : cH * 0.5;
          const x = padL + i * (cW / values.length) + 2;
          const y = padT + cH - barH;
          return (
            <g key={i}>
              <rect x={x} y={y} width={bW} height={barH}
                fill={colors[i % colors.length]} opacity={0.85} rx={2} />
              <text x={x + bW/2} y={H - 4} textAnchor="middle" fontSize={8}
                fill="var(--text-dim)" fontFamily="sans-serif">{labels[i]}</text>
            </g>
          );
        })}
        {/* Unit */}
        <text x={padL + cW + padR - 2} y={padT - 4} textAnchor="end" fontSize={8}
          fill="var(--text-dim)" fontFamily="sans-serif">{unit}</text>
      </svg>
    </div>
  );
}

// Cp method comparison bar chart
function CpComparisonChart({ results }: { results: Stage1Results }) {
  const ST = results.ST_in as unknown as Record<string, number>;
  const vals = [
    ST.Cp0_kgK, ST.Cp1_kgK, ST.Cp2_kgK, ST.Cp3_kgK,
    ST.Cp4_kgK, ST.Cp5_kgK, ST.Cp6_kgK, ST.Cp7_kgK,
  ].map(v => (v && isFinite(v) ? v : 0));
  const labels = ['Cp0','M1','M2','M3','M4','M5★','M6','M7'];
  const colors = ['#6a8faf','#e06000','#1a7a3a','#7a1ab0','#1a6ab8','#c04000','#0a5a9a','#7a3a00'];

  const W = 380, H = 140, padL = 52, padB = 28, padT = 22, padR = 8;
  const cW = W - padL - padR, cH = H - padB - padT;
  const bW = Math.floor(cW / vals.length) - 6;
  const validVals = vals.filter(v => v > 0);
  if (validVals.length === 0) return null;
  const maxV = Math.max(...validVals) * 1.08;
  const minV = Math.min(...validVals) * 0.92;

  return (
    <div>
      <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:1,
        color:'var(--text-dim)', marginBottom:4 }}>Cp Comparison — All Methods at Inlet T</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%' }}>
        {[0, 0.33, 0.67, 1].map(t => {
          const v = minV + (maxV - minV) * t;
          const y = padT + cH * (1 - t);
          return (
            <g key={t}>
              <text x={padL-4} y={y+4} textAnchor="end" fontSize={9} fill="var(--text-dim)"
                fontFamily="monospace">{v.toFixed(3)}</text>
              <line x1={padL} y1={y} x2={padL+cW} y2={y}
                stroke="rgba(180,190,200,0.25)" strokeWidth={0.5} />
            </g>
          );
        })}
        {vals.map((v, i) => {
          if (!v || !isFinite(v)) return null;
          const bH = maxV > minV ? ((v - minV) / (maxV - minV)) * cH : cH * 0.5;
          const x = padL + i * (cW / vals.length) + 3;
          const y = padT + cH - bH;
          const isSel = String(i + (i === 0 ? 0 : 0)) === '5'; // M5 highlight
          return (
            <g key={i}>
              <rect x={x} y={y} width={bW} height={bH} fill={colors[i]}
                opacity={labels[i].includes('★') ? 1 : 0.7} rx={2} />
              {labels[i].includes('★') && (
                <rect x={x-1} y={y-1} width={bW+2} height={bH+2}
                  fill="none" stroke="var(--accent)" strokeWidth={1.5} rx={3} />
              )}
              <text x={x+bW/2} y={H-6} textAnchor="middle" fontSize={9}
                fill={labels[i].includes('★') ? 'var(--accent)' : 'var(--text-dim)'}
                fontFamily="sans-serif" fontWeight={labels[i].includes('★') ? 700 : 400}>
                {labels[i]}
              </text>
              <text x={x+bW/2} y={y-3} textAnchor="middle" fontSize={8}
                fill={colors[i]} fontFamily="monospace" fontWeight={700}>
                {v.toFixed(3)}
              </text>
            </g>
          );
        })}
        <text x={padL+cW+padR} y={padT-4} textAnchor="end" fontSize={8}
          fill="var(--text-dim)" fontFamily="sans-serif">kJ/(kg·K)</text>
      </svg>
    </div>
  );
}

// Composition pie-ish bar chart
function CompositionChart({ comp }: { comp: Record<number, string> }) {
  const data = COMP_LIST.map(([i, name, formula]) => ({
    idx: i, name, formula, val: parseFloat(comp[i] ?? '0'),
  })).filter(d => d.val > 0.01).sort((a, b) => b.val - a.val);
  if (data.length === 0) return null;
  const CLRS = ['#c04000','#1a6ab8','#0e7a3e','#7a1ab0','#e09000','#1a8ab0','#8a4020','#5a8a00','#c05080','#406080'];
  const W = 280, H = data.length * 22 + 24;
  const maxVal = data[0].val;
  const barMaxW = 180;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', maxWidth:300 }}>
      {data.map((d, i) => (
        <g key={d.idx} transform={`translate(0, ${i * 22 + 4})`}>
          <text x={62} y={14} textAnchor="end" fontSize={10} fill="var(--text-dim)"
            fontFamily="sans-serif">{d.formula}</text>
          <rect x={66} y={4} width={Math.max((d.val / maxVal) * barMaxW, 2)} height={14}
            fill={CLRS[i % CLRS.length]} rx={2} opacity={0.8} />
          <text x={66 + (d.val / maxVal) * barMaxW + 4} y={14} fontSize={10}
            fill={CLRS[i % CLRS.length]} fontFamily="monospace" fontWeight={700}>
            {d.val.toFixed(2)}%
          </text>
        </g>
      ))}
    </svg>
  );
}

// Duty comparison chart — Q_PR vs Q_SRK vs Q_LK
function DutyComparisonChart({ results }: { results: Stage1Results }) {
  const vals = [results.Q_PR, results.Q_SRK, results.Q_LK, results.Q_final].map(v => v ?? 0);
  const labels = ['PR M6','SRK M4','LK M7','Selected'];
  const colors = ['#1a6ab8','#0e7a3e','#c04000','#b06000'];
  const maxV = Math.max(...vals.filter(v => v > 0)) * 1.1;
  const W = 280, H = 110, padL = 50, padB = 24, padT = 18;
  const cW = W - padL - 8, cH = H - padB - padT;
  const bW = Math.floor(cW / 4) - 8;

  return (
    <div>
      <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:1,
        color:'var(--text-dim)', marginBottom:4 }}>Process Duty — EOS Cross-Check</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%' }}>
        {[0, 0.5, 1].map(t => {
          const v = maxV * t;
          const y = padT + cH * (1 - t);
          return (
            <g key={t}>
              <text x={padL-4} y={y+4} textAnchor="end" fontSize={8}
                fill="var(--text-dim)" fontFamily="monospace">{v.toFixed(0)}</text>
              <line x1={padL} y1={y} x2={padL+cW} y2={y}
                stroke="rgba(180,190,200,0.3)" strokeWidth={0.5} />
            </g>
          );
        })}
        {vals.map((v, i) => {
          if (!v || !isFinite(v)) return null;
          const bH = (v / maxV) * cH;
          const x = padL + i * (cW / 4) + 4;
          const y = padT + cH - bH;
          return (
            <g key={i}>
              <rect x={x} y={y} width={bW} height={bH} fill={colors[i]}
                opacity={i === 3 ? 1 : 0.65} rx={2} />
              {i === 3 && <rect x={x-1} y={y-1} width={bW+2} height={bH+2}
                fill="none" stroke="var(--accent)" strokeWidth={1.5} rx={3} />}
              <text x={x+bW/2} y={H-5} textAnchor="middle" fontSize={9}
                fill={i===3?'var(--accent)':'var(--text-dim)'} fontFamily="sans-serif">
                {labels[i]}
              </text>
              <text x={x+bW/2} y={y-3} textAnchor="middle" fontSize={8}
                fill={colors[i]} fontFamily="monospace" fontWeight={700}>
                {v.toFixed(0)}
              </text>
            </g>
          );
        })}
        <text x={padL+cW+4} y={padT-2} textAnchor="end" fontSize={8}
          fill="var(--text-dim)">kW</text>
      </svg>
    </div>
  );
}


// ─── JOULE-THOMSON SUB-TAB (inline) ────────────────────────────────────────
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


interface JTProps {
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

  // HIGH pressure LEFT (inlet), LOW pressure RIGHT (outlet) — engineering convention
  const sx = (P: number) => pL + (1 - (P - minP) / (maxP - minP)) * cW;
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

function JTSubTab({ results, form, f, ST }: JTProps) {
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

export default function Stage1GasProps({ onComplete, initialValues }: Props) {
  const [form, setForm] = useState<S1Form>({ ...DEFAULT, ...initialValues });
  const [results, setResults] = useState<Stage1Results | null>(null);
  const [validation, setValidation] = useState<{messages:{code:string;message:string;severity:'error'|'warning'|'info';reference?:string}[]} | null>(null);
  const [loading, setLoading] = useState(false);
  const [subTab, setSubTab] = useState<'props'|'cp'|'hv'|'jt'|'comb'>('props');
  const [error, setError] = useState('');
  const [combInputs, setCombInputs] = useState({ altitude:0, rh:60, excessAir:25, T_amb:15 });

  // Composition total — user enters mol%, so sum should be ~100
  const total = COMP_LIST.reduce((s, [i]) => s + parseFloat(form.comp[i] ?? '0'), 0);
  // Valid if within ±0.5 mol% of 100 (user tolerance)
  const totalOK = Math.abs(total - 100) < 0.5;
  const totalWarn = totalOK && Math.abs(total - 100) > 0.01;

  const setComp = useCallback((idx: number, val: string) => {
    setForm(f => ({ ...f, comp: { ...f.comp, [idx]: val } }));
  }, []);

  const normalise = () => {
    if (total < 0.01) return;
    const next: Record<number, string> = {};
    COMP_LIST.forEach(([i]) => { next[i] = ((parseFloat(form.comp[i] ?? '0') / total) * 100).toFixed(4); });
    setForm(f => ({ ...f, comp: next }));
  };

  const loadPreset = (key: string) => {
    const p = GAS_PRESETS[key]; if (!p) return;
    const next: Record<number, string> = {};
    COMP_LIST.forEach(([i]) => { next[i] = String(p.comp[i] ?? '0'); });
    setForm(f => ({ ...f, comp: next }));
  };

  const calculate = async () => {
    setLoading(true); setError('');
    try {
      // Convert mol% → mol fractions (sum to 1)
      const molPcts = COMP_LIST.map(([i]) => parseFloat(form.comp[i] ?? '0'));
      const sumPct = molPcts.reduce((a, b) => a + b, 0);
      const y = sumPct > 0 ? molPcts.map(v => v / sumPct) : molPcts;

      // MW for Nm³/hr conversion: compute from normalised composition
      const MW_comps = [16.043,30.070,44.097,58.123,58.123,72.150,72.150,86.177,100.20,28.014,44.010,34.082,4.003,2.016];
      const MW_est = y.reduce((s, yi, i) => s + yi * MW_comps[i], 0);
      const nm3_factor = MW_est / 22.414; // kg/Nm³ at 0°C, 101.325 kPa

      const massFlow_kgh = parseFloat(form.mflow) * (form.flowUnit === 'nm3h' ? nm3_factor : 1);

      const res = await fetch('/api/calculations/stage1', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          composition: y,
          T_in_C: parseFloat(form.T_in),
          T_out_C: parseFloat(form.T_out),
          P_kPa: parseFloat(form.P_in),
          dP_kPa: parseFloat(form.dP),
          massFlow_kgh,
          basisMethod: parseInt(form.basis),
          T_design_C: parseFloat(form.T_design),
          P_design_kPa: parseFloat(form.P_design),
          dutyOverride_kW: form.dutyOverride ? parseFloat(form.dutyOverride) : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) { setResults(data.results); setValidation(data.validation); onComplete?.(data.results); }
      else setError(data.error ?? 'Calculation failed');
    } catch (e) { setError(String(e)); }
    setLoading(false);
  };

  const f = (v: number | undefined, d = 4) => v !== undefined && isFinite(v) ? v.toFixed(d) : '—';
  const ST = (pt: GasStatePoint | undefined) => pt as unknown as Record<string, number> | undefined;

  // Joule-Thomson calc (from results)
  // Combustion flue gas composition (stoichiometric + excess air + humidity)
  const combFlue = results?.heatingValues ? (() => {
    const { altitude, rh, excessAir, T_amb } = combInputs;
    // Air density at altitude: ρ = 1.225 * exp(-altitude/8500) * (288.15/(T_amb+273.15))
    const rho_air = 1.225 * Math.exp(-altitude/8500) * (288.15/(T_amb+273.15));
    // Water vapour partial pressure at T_amb (Magnus formula)
    const psat = 0.6108 * Math.exp(17.27*T_amb/(T_amb+237.3)); // kPa
    const p_atm = 101.325 * Math.exp(-altitude/8500); // kPa
    const h2o_air_vol = rh/100 * psat / p_atm; // vol fraction water in air
    const dry_air_frac = 1 - h2o_air_vol;
    // Stoichiometric AFR for NG: ~17.2 mass; ~9.52 vol (O2 basis: CH4 + 2O2 → CO2 + 2H2O)
    const afr_actual = 17.2 * (1 + excessAir/100);
    const m_air = afr_actual; // per kg fuel
    const m_flue = 1 + m_air; // kg flue per kg fuel
    // Flue gas composition (vol%): simplified for lean NG
    const moles_fuel = 1/results.MW; // mol/kg
    const ch4_frac = form.comp[0] ? parseFloat(form.comp[0])/100 : 0.92;
    const moles_co2 = moles_fuel; // ~1 CO2 per CH4 (lean gas approx)
    const moles_h2o = moles_fuel * 2 * ch4_frac + m_air * h2o_air_vol / 0.018;
    const moles_o2_in = m_air * dry_air_frac / 28.97 * 0.21 * 28.97 / 32;
    const moles_o2_used = moles_fuel * 2 * ch4_frac;
    const moles_o2_excess = Math.max(0, moles_o2_in - moles_o2_used);
    const moles_n2 = m_air * dry_air_frac / 28.97 * 0.79;
    const total_moles = moles_co2 + moles_h2o + moles_o2_excess + moles_n2;
    const co2_pct = moles_co2/total_moles*100;
    const h2o_pct = moles_h2o/total_moles*100;
    const o2_pct = moles_o2_excess/total_moles*100;
    const n2_pct = moles_n2/total_moles*100;
    const mw_flue = (co2_pct*44 + h2o_pct*18 + o2_pct*32 + n2_pct*28)/100;
    return { co2_pct, h2o_pct, o2_pct, n2_pct, mw_flue, rho_air };
  })() : null;

  const calcJT = () => {
    if (!results) return null;
    const mu = results.pressureWarning
      ? '⚠ JT calc via API — use M7 at P>100 barg'
      : null;
    return mu;
  };

  // Combustion calcs
  const combCalc = results ? (() => {
    const HHV = results.heatingValues?.HHV_kJkg ?? 0;
    const LHV = results.heatingValues?.LHV_kJkg ?? 0;
    const mdot = results.mdot_kgs;
    const Q_comb = mdot * HHV / 1000; // MW
    return { HHV, LHV, Q_comb, airFuelStoich: 17.2, airFuelActual: 17.2 * 1.225 };
  })() : null;

  return (
    <div>
      {/* Sub-tab bar */}
      <div style={{ display:'flex', background:'var(--panel)', borderBottom:'1px solid var(--border)',
        margin:'-20px -24px 16px', overflowX:'auto' }}>
        {[
          { id:'props', label:'① Gas Properties & EOS' },
          { id:'cp',    label:'② Cp Method Comparison' },
          { id:'hv',    label:'③ Heating Values' },
          { id:'jt',    label:'④ Joule-Thomson' },
          { id:'comb',  label:'⑤ Combustion' },
        ].map(t => (
          <button key={t.id} className={`tab-btn${subTab === t.id ? ' active' : ''}`}
            style={{ fontSize:12 }} onClick={() => setSubTab(t.id as typeof subTab)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── SUB-TAB: GAS PROPERTIES ── */}
      {subTab === 'props' && (
        <div style={{ display:'grid', gridTemplateColumns:'480px 1fr', gap:16, alignItems:'start' }}>
          {/* LEFT */}
          <div>
            <div className="panel" style={{ marginBottom:12 }}>
              <div className="panel-header">
                <div style={{ width:6,height:6,borderRadius:'50%',background:'var(--accent)' }} />
                <div className="panel-title">Gas Composition — Mole %</div>
              </div>
              <div className="panel-body">
                <div style={{ marginBottom:10 }}>
                  <label className="field-label">Load Preset Composition</label>
                  <select onChange={e => e.target.value && loadPreset(e.target.value)} defaultValue="">
                    <option value="">— Select Preset —</option>
                    <optgroup label="Australia">
                      {['aus_bass','aus_surat','aus_carnarvon','aus_browse','aus_cooper'].map(k => (
                        <option key={k} value={k}>{GAS_PRESETS[k].name}</option>
                      ))}
                    </optgroup>
                    <optgroup label="SE Asia">
                      {['sea_sarawak','sea_natuna'].map(k => (
                        <option key={k} value={k}>{GAS_PRESETS[k].name}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Middle East">
                      {['me_saudi','me_sour'].map(k => (
                        <option key={k} value={k}>{GAS_PRESETS[k].name}</option>
                      ))}
                    </optgroup>
                    <optgroup label="New Zealand / Generic">
                      {['nz_maui','gen_lean','sour_mild'].map(k => (
                        <option key={k} value={k}>{GAS_PRESETS[k].name}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                  <thead>
                    <tr>
                      {['Component','Formula','Mol %'].map(h => (
                        <th key={h} style={{ textAlign:'left', padding:'5px 8px',
                          borderBottom:'1px solid var(--border)', fontSize:11, fontWeight:700,
                          color:'var(--text-dim)', textTransform:'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {COMP_LIST.map(([idx, name, formula]) => (
                      <tr key={idx} style={{
                        background: idx === 10 ? 'rgba(10,95,168,0.03)' :
                                    idx === 11 ? 'rgba(122,26,160,0.04)' : undefined
                      }}>
                        <td style={{ padding:'2px 8px', fontSize:12 }}>{name}</td>
                        <td style={{ padding:'2px 8px', fontFamily:'var(--mono)',
                          color: idx === 11 ? 'var(--sour)' : idx === 10 ? 'var(--blue)' : 'var(--text-dim)',
                          fontSize:11 }}>{formula}</td>
                        <td style={{ padding:'2px 4px' }}>
                          <input type="number" step="0.01" min="0" max="100"
                            value={form.comp[idx] ?? '0'}
                            style={{ width:80 }}
                            onChange={e => setComp(idx, e.target.value)} />
                        </td>
                      </tr>
                    ))}
                    <tr style={{ borderTop:`2px solid ${totalOK ? 'var(--accent)' : 'var(--red)'}` }}>
                      <td colSpan={2} style={{ padding:'5px 8px', fontSize:11,
                        textTransform:'uppercase', color:'var(--text-dim)' }}>TOTAL</td>
                      <td style={{ padding:'5px 8px', fontFamily:'var(--mono)', fontWeight:700,
                        color: totalOK ? 'var(--green)' : 'var(--red)' }}>
                        {total.toFixed(3)} mol%
                      </td>
                    </tr>
                  </tbody>
                </table>
                {/* Status message */}
                <div style={{ fontSize:11, marginTop:6, display:'flex', gap:8, alignItems:'center' }}>
                  {!totalOK ? (
                    <span style={{ color:'var(--red)' }}>
                      ✘ Sum {total.toFixed(2)} mol% — must be 100%. Use Normalise or adjust.
                    </span>
                  ) : totalWarn ? (
                    <span style={{ color:'var(--accent)' }}>
                      ⚠ Sum {total.toFixed(3)} mol% — small imbalance; results normalised internally.
                    </span>
                  ) : (
                    <span style={{ color:'var(--green)' }}>✔ Composition sums to 100 mol%</span>
                  )}
                </div>
                <div style={{ display:'flex', gap:8, marginTop:8 }}>
                  <button className="btn btn-secondary btn-sm" onClick={normalise}>Normalise to 100%</button>
                  <button className="btn btn-danger btn-sm" onClick={() => setForm(f => ({ ...f, comp:{} }))}>Clear</button>
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <div style={{ width:6,height:6,borderRadius:'50%',background:'var(--accent)' }} />
                <div className="panel-title">Process Conditions</div>
              </div>
              <div className="panel-body">
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  {[
                    { label:'Inlet Temperature', k:'T_in', unit:'°C' },
                    { label:'Outlet Temperature', k:'T_out', unit:'°C' },
                    { label:'Inlet Pressure', k:'P_in', unit:'kPa' },
                    { label:'Pressure Drop', k:'dP', unit:'kPa' },
                  ].map(fi => (
                    <div key={fi.k}>
                      <label className="field-label">{fi.label}</label>
                      <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                        <input type="number" value={form[fi.k as keyof S1Form] as string}
                          onChange={e => setForm(f => ({ ...f, [fi.k]: e.target.value }))} />
                        <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text-dim)', whiteSpace:'nowrap' }}>{fi.unit}</span>
                      </div>
                    </div>
                  ))}
                  <div>
                    <label className="field-label">Mass / Vol Flow</label>
                    <div style={{ display:'flex', gap:4 }}>
                      <input type="number" value={form.mflow} style={{ flex:1 }}
                        onChange={e => setForm(f => ({ ...f, mflow: e.target.value }))} />
                      <select value={form.flowUnit} style={{ width:95 }}
                        onChange={e => setForm(f => ({ ...f, flowUnit: e.target.value as 'kgh'|'nm3h' }))}>
                        <option value="kgh">kg/hr</option>
                        <option value="nm3h">Nm³/hr</option>
                      </select>
                    </div>
                    {form.flowUnit === 'nm3h' && (
                      <div style={{ fontSize:10, color:'var(--text-dim)', marginTop:2 }}>
                        Nm³/hr → kg/hr uses MW_mix/22.414
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="field-label">Duty Override (optional)</label>
                    <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                      <input type="number" value={form.dutyOverride} placeholder="Auto"
                        onChange={e => setForm(f => ({ ...f, dutyOverride: e.target.value }))} />
                      <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text-dim)', whiteSpace:'nowrap' }}>kW</span>
                    </div>
                  </div>
                  <div>
                    <label className="field-label">Design Temperature</label>
                    <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                      <input type="number" value={form.T_design}
                        onChange={e => setForm(f => ({ ...f, T_design: e.target.value }))} />
                      <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text-dim)', whiteSpace:'nowrap' }}>°C</span>
                    </div>
                  </div>
                  <div>
                    <label className="field-label">Design Pressure</label>
                    <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                      <input type="number" value={form.P_design}
                        onChange={e => setForm(f => ({ ...f, P_design: e.target.value }))} />
                      <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text-dim)', whiteSpace:'nowrap' }}>kPa</span>
                    </div>
                  </div>
                </div>

                {/* Cp basis selector */}
                <div style={{ marginTop:12, borderTop:'1px solid var(--border)', paddingTop:12 }}>
                  <label className="field-label" style={{ marginBottom:6 }}>Cp Calculation Basis</label>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                    {METHODS.map(m => (
                      <button key={m.v} onClick={() => setForm(f => ({ ...f, basis: m.v }))}
                        style={{
                          padding:'5px 10px', border:'1px solid', borderRadius:4, cursor:'pointer',
                          fontSize:11, fontFamily:'var(--mono)', fontWeight:600,
                          borderColor: form.basis === m.v ? 'var(--accent)' : 'var(--border)',
                          background: form.basis === m.v ? 'rgba(176,96,0,0.12)' : 'var(--panel2)',
                          color: form.basis === m.v ? 'var(--accent)' : 'var(--text-dim)',
                        }}>
                        {m.label} <span style={{ fontWeight:400, fontSize:10 }}>— {m.desc}</span>
                      </button>
                    ))}
                  </div>
                  {(parseInt(form.basis) >= 6) && (
                    <div style={{ fontSize:10, color:'var(--blue)', marginTop:4 }}>
                      {form.basis === '6' ? 'M6: PR ΔH — recommended 50–100 barg'
                        : 'M7: Lee-Kesler — recommended >100 barg'}
                    </div>
                  )}
                </div>

                <div style={{ marginTop:12, display:'flex', gap:8 }}>
                  <button className="btn btn-primary" onClick={calculate}
                    disabled={loading || !totalOK}>
                    {loading ? '⏳ Calculating…' : '▶ Calculate Stage 1'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div>
            {error && <div className="alert alert-fail" style={{ marginBottom:12 }}>❌ {error}</div>}
            {validation && <ValidationPanel messages={validation.messages ?? []} title="Engineering Checks" />}

            {results ? (
              <>
                {results.pressureWarning && (
                  <div className="alert alert-warn" style={{ marginBottom:12 }}>
                    ⚠ P = {(results.P_kPa/100-1).toFixed(0)} barg — High pressure service.
                    Use <strong>M7 Lee-Kesler</strong> for best accuracy. Cross-check with HYSYS/GERG-2008 for P&gt;150 barg.
                  </div>
                )}

                {/* Key results */}
                <div className="panel" style={{ marginBottom:12 }}>
                  <div className="panel-header"><div className="panel-title">Mixture Properties</div></div>
                  <div className="panel-body">
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:12 }}>
                      <ResultCard label="MW mix" value={results.MW} unit="g/mol" decimals={3} variant="highlight" />
                      <ResultCard label="Spec. Gravity" value={results.SG} decimals={4} variant="highlight" />
                      <ResultCard label="Process Duty Q" value={results.Q_final} unit="kW" decimals={1} variant="highlight" />
                      <ResultCard label="Pseudo-Tc (Kay)" value={results.pc?.Tc_pc} unit="K" decimals={1} />
                      <ResultCard label="Pseudo-Pc (Kay)" value={results.pc?.Pc_pc} unit="bar" decimals={2} />
                      <ResultCard label="Hydrate T" value={results.hydrateT_C} unit="°C" decimals={1}
                        variant={results.hydrateT_C >= results.T_out_C ? 'red' : 'green'} />
                    </div>

                    {/* Composition bar chart */}
                    <div style={{ marginTop:8 }}>
                      <CompositionChart comp={form.comp} />
                    </div>
                  </div>
                </div>

                {/* State point table */}
                <div className="panel" style={{ marginBottom:12 }}>
                  <div className="panel-header"><div className="panel-title">State Points — PR-EOS</div></div>
                  <div className="panel-body" style={{ overflowX:'auto' }}>
                    <table className="res-table" style={{ fontSize:11 }}>
                      <thead>
                        <tr>
                          <th>Property</th>
                          <th style={{ color:'#7a4500' }}>Inlet {f(results.T_in_C,1)}°C</th>
                          <th style={{ color:'#084d8a' }}>Outlet {f(results.T_out_C,1)}°C</th>
                          <th style={{ color:'#5a0e8a' }}>Design {f(results.T_des_C,1)}°C</th>
                          <th>Unit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { label:'Z-Factor (PR)', key:'Z', dec:4, unit:'—' },
                          { label:'Density ρ', key:'rho', dec:3, unit:'kg/m³' },
                          { label:'Ideal Gas ρ', key:'rho_ideal', dec:3, unit:'kg/m³' },
                          { label:'Cp° (ideal gas)', key:'Cp0_kgK', dec:4, unit:'kJ/(kg·K)' },
                          { label:'Cp M5 ★ Recommended', key:'Cp5_kgK', dec:4, unit:'kJ/(kg·K)' },
                          { label:'Cp M7 Lee-Kesler', key:'Cp7_kgK', dec:4, unit:'kJ/(kg·K)' },
                          { label:'Cv', key:'Cv_kgK', dec:4, unit:'kJ/(kg·K)' },
                          { label:'γ = Cp/Cv', key:'gamma', dec:4, unit:'—' },
                          { label:'Viscosity μ', key:'mu', dec:6, unit:'Pa·s' },
                          { label:'Therm. Cond. k', key:'k_therm', dec:4, unit:'W/(m·K)' },
                          { label:'Prandtl Pr', key:'Pr', dec:3, unit:'—' },
                        ].map(row => (
                          <tr key={row.key}>
                            <td>{row.label}</td>
                            <td className="val">{f(ST(results.ST_in)?.[row.key], row.dec)}</td>
                            <td className="val2">{f(ST(results.ST_out)?.[row.key], row.dec)}</td>
                            <td style={{ color:'#5a0e8a', fontWeight:600 }}>{f(ST(results.ST_des)?.[row.key], row.dec)}</td>
                            <td style={{ color:'var(--text-dim)', fontSize:10 }}>{row.unit}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Duty comparison chart */}
                <div className="panel">
                  <div className="panel-header"><div className="panel-title">EOS Cross-Check</div></div>
                  <div className="panel-body">
                    <DutyComparisonChart results={results} />
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginTop:10 }}>
                      <ResultCard label="Q PR-EOS (M6)" value={results.Q_PR} unit="kW" decimals={1} />
                      <ResultCard label="Q SRK (M4)" value={results.Q_SRK} unit="kW" decimals={1} />
                      <ResultCard label="Q Lee-Kesler (M7)" value={results.Q_LK} unit="kW" decimals={1} />
                    </div>
                    <div className="note-box" style={{ marginTop:8 }}>
                      <strong>Method selection:</strong> M5 recommended &lt;50 barg · M6 for 50–100 barg ·
                      M7 Lee-Kesler &gt;100 barg. Agreement between M5/M6/M7 &lt;3% = high confidence.
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="panel">
                <div className="panel-body">
                  <div style={{ color:'var(--text-dim)', padding:'24px 0', textAlign:'center', fontSize:13 }}>
                    Enter gas composition and conditions, then click <strong>Calculate Stage 1</strong>.
                  </div>
                  <div className="note-box">
                    <strong>PR-EOS 1976</strong> with GPSA §9 BIPs.
                    Cp methods M1–M7 give independent cross-checks.
                    M5 = avg(M1+M2) recommended for P &lt; 50 barg.
                    M7 Lee-Kesler for P &gt; 100 barg.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SUB-TAB: Cp COMPARISON ── */}
      {subTab === 'cp' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <div>
            {results ? (
              <>
                <div className="panel" style={{ marginBottom:12 }}>
                  <div className="panel-header"><div className="panel-title">Cp Comparison — All 7 Methods</div></div>
                  <div className="panel-body">
                    <CpComparisonChart results={results} />
                    <table className="res-table" style={{ fontSize:11, marginTop:10 }}>
                      <thead>
                        <tr><th>Method</th><th>Description</th><th>Cp Inlet</th><th>Cp Outlet</th><th>kJ/(kg·K)</th></tr>
                      </thead>
                      <tbody>
                        {[
                          { key:'Cp0_kgK', label:'Cp°', desc:'Ideal gas — DIPPR 107 Aly-Lee' },
                          { key:'Cp1_kgK', label:'M1', desc:'Peng-Robinson analytic' },
                          { key:'Cp2_kgK', label:'M2', desc:'Peng-Robinson dH/dT' },
                          { key:'Cp3_kgK', label:'M3', desc:'Peng-Robinson T·dS/dT' },
                          { key:'Cp4_kgK', label:'M4', desc:'SRK Soave (1972)' },
                          { key:'Cp5_kgK', label:'M5 ★', desc:'avg(M1+M2) — recommended <50 barg' },
                          { key:'Cp6_kgK', label:'M6', desc:'Peng-Robinson ΔH departure' },
                          { key:'Cp7_kgK', label:'M7', desc:'Lee-Kesler — >100 barg' },
                        ].map(row => {
                          const inVal = ST(results.ST_in)?.[row.key];
                          const outVal = ST(results.ST_out)?.[row.key];
                          const isSel = form.basis === row.key.replace('Cp','').replace('_kgK','');
                          return (
                            <tr key={row.key} style={{ background: row.label === 'M5 ★' ? 'rgba(176,96,0,0.05)' : undefined }}>
                              <td style={{ fontFamily:'var(--mono)', fontWeight: row.label === 'M5 ★' ? 700 : 400,
                                color: row.label === 'M5 ★' ? 'var(--accent)' : undefined }}>{row.label}</td>
                              <td style={{ fontSize:10 }}>{row.desc}</td>
                              <td className="val">{f(inVal, 4)}</td>
                              <td className="val2">{f(outVal, 4)}</td>
                              <td style={{ fontSize:10, color:'var(--text-dim)' }}>kJ/(kg·K)</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <div className="panel"><div className="panel-body" style={{ color:'var(--text-dim)', padding:20 }}>
                Run Stage 1 calculation first.
              </div></div>
            )}
          </div>
          <div>
            {results && (
              <div className="panel">
                <div className="panel-header"><div className="panel-title">Method Accuracy Notes</div></div>
                <div className="panel-body" style={{ fontSize:12, lineHeight:1.8 }}>
                  <div style={{ marginBottom:10 }}>
                    <strong style={{ color:'var(--accent)' }}>M5 ★ Recommended for P &lt; 50 barg</strong><br/>
                    Averages M1 (analytical Cv departure) and M2 (numerical dH/dT).
                    Brackets the true value. Agreement within ±5% of M2 is expected.
                  </div>
                  <div style={{ marginBottom:10 }}>
                    <strong style={{ color:'var(--blue)' }}>M6 for 50–100 barg</strong><br/>
                    Full PR-EOS enthalpy departure integral. More accurate than M5 at
                    elevated pressure. Validated ±2% vs certified datasheets (Q13048, Q10928).
                  </div>
                  <div style={{ marginBottom:10 }}>
                    <strong style={{ color:'#7a3a00' }}>M7 Lee-Kesler for &gt;100 barg</strong><br/>
                    BWR-type corresponding states. More accurate than PR-EOS above
                    Pr ≈ 2. Still shows ~8–10% error vs HYSYS at 214 barg (GERG-2008 regime).
                  </div>
                  <div style={{ marginBottom:10 }}>
                    <strong style={{ color:'#5a0e8a' }}>M4 SRK cross-check</strong><br/>
                    Soave (1972) EOS — independent of PR. Large agreement between M4, M5, M6 gives
                    high confidence; large divergence signals near-critical conditions.
                  </div>
                  <div className="note-box" style={{ marginTop:12 }}>
                    For the three validated projects (Q13048, Q10928, Newman), M5/M6
                    agree to within ±2.8% of certified datasheets at 69–102 barg.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SUB-TAB: HEATING VALUES ── */}
      {subTab === 'hv' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <div>
            {results?.heatingValues ? (
              <>
                <div className="panel" style={{ marginBottom:12 }}>
                  <div className="panel-header"><div className="panel-title">Heating Values — ISO 6976</div></div>
                  <div className="panel-body">
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
                      <ResultCard label="HHV (Gross CV)" value={results.heatingValues.HHV_kJkg} unit="kJ/kg" decimals={0} variant="highlight" />
                      <ResultCard label="LHV (Net CV)" value={results.heatingValues.LHV_kJkg} unit="kJ/kg" decimals={0} variant="highlight" />
                      <ResultCard label="HHV" value={results.heatingValues.HHV_MJNm3} unit="MJ/Nm³" decimals={2} />
                      <ResultCard label="Wobbe Index" value={results.heatingValues.WobbeIdx} unit="MJ/Nm³" decimals={2} />
                      <ResultCard label="Spec. Gravity (Air=1)" value={results.SG} decimals={4} />
                      <ResultCard label="HHV/LHV ratio" value={results.heatingValues.HHV_kJkg / results.heatingValues.LHV_kJkg} decimals={4} />
                    </div>
                    <table className="res-table" style={{ fontSize:11 }}>
                      <thead>
                        <tr><th>Parameter</th><th>Value</th><th>Unit</th><th>Note</th></tr>
                      </thead>
                      <tbody>
                        <tr><td>Combustion fuel flow (at Q_final)</td>
                          <td className="val">{f(results.mdot_kgs * 3600 / (results.heatingValues.LHV_kJkg / 47000), 1)}</td>
                          <td>kg/hr</td><td style={{ fontSize:10 }}>Estimated at η=80%</td></tr>
                        <tr><td>Fuel volume flow (Nm³/hr)</td>
                          <td className="val">{f(results.mdot_kgs * 3600 / (results.heatingValues.LHV_kJkg / 47000) / (results.MW / 22.414), 1)}</td>
                          <td>Nm³/hr</td><td style={{ fontSize:10 }}>At 0°C, 101.325 kPa</td></tr>
                        <tr><td>Wobbe Index (NG range)</td>
                          <td className="val" style={{ color: results.heatingValues.WobbeIdx >= 46 && results.heatingValues.WobbeIdx <= 52 ? 'var(--green)' : 'var(--accent)' }}>
                            {results.heatingValues.WobbeIdx.toFixed(2)}</td>
                          <td>MJ/Nm³</td>
                          <td style={{ fontSize:10 }}>{results.heatingValues.WobbeIdx >= 46 && results.heatingValues.WobbeIdx <= 52 ? '✔ AGA/AS 4564 range' : '⚠ Check AS 4564'}</td></tr>
                      </tbody>
                    </table>
                    <div className="note-box" style={{ marginTop:10 }}>
                      Component HHV/LHV from ISO 6976. Wobbe = HHV/√SG.
                      AS 4564 (AUS Nat Gas) target: Wobbe 46–52 MJ/Nm³ (gross, 25°C reference).
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="panel"><div className="panel-body" style={{ color:'var(--text-dim)', padding:20 }}>Run Stage 1 first.</div></div>
            )}
          </div>
          <div>
            {results?.heatingValues && (
              <div className="panel">
                <div className="panel-header"><div className="panel-title">Component Contribution — HHV</div></div>
                <div className="panel-body">
                  {/* Bar chart of component HHV contribution */}
                  {(() => {
                    const HHV_vals = [55695,51877,50330,49360,49500,48583,48643,47793,47641,0,0,21900,0,141800];
                    const MW_comps = [16.043,30.070,44.097,58.123,58.123,72.150,72.150,86.177,100.20,28.014,44.010,34.082,4.003,2.016];
                    const ySum = COMP_LIST.reduce((s, [i]) => s + parseFloat(form.comp[i] ?? '0'), 0);
                    const contribs = COMP_LIST.map(([i, n, f2]) => ({
                      name: String(f2), val: parseFloat(form.comp[i] ?? '0') / ySum * HHV_vals[i],
                    })).filter(d => d.val > 10).sort((a, b) => b.val - a.val);
                    return (
                      <SparkBar
                        values={contribs.map(d => d.val)}
                        labels={contribs.map(d => d.name)}
                        colors={['#c04000','#1a6ab8','#0e7a3e','#7a1ab0','#e09000','#1a8ab0']}
                        title="Weighted HHV contribution by component [kJ/kg]"
                        unit="kJ/kg"
                        yMin={0}
                      />
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SUB-TAB: JOULE-THOMSON ── */}
      {subTab === 'jt' && (
        <JTSubTab results={results} form={form} f={f} ST={ST} />
      )}

      {/* ── SUB-TAB: COMBUSTION ── */}
      {subTab === 'comb' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <div>
            <div className="panel">
              <div className="panel-header"><div className="panel-title">Combustion Properties — Fuel Gas</div></div>
              <div className="panel-body">
                {results?.heatingValues ? (
                  <>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
                      <ResultCard label="LHV" value={results.heatingValues.LHV_kJkg} unit="kJ/kg" decimals={0} variant="highlight" />
                      <ResultCard label="HHV" value={results.heatingValues.HHV_kJkg} unit="kJ/kg" decimals={0} />
                      <ResultCard label="Wobbe Index" value={results.heatingValues.WobbeIdx} unit="MJ/Nm³" decimals={2} />
                      <ResultCard label="MW fuel" value={results.MW} unit="g/mol" decimals={3} />
                    </div>
                    <table className="res-table" style={{ fontSize:11 }}>
                      <thead><tr><th>Parameter</th><th>Value</th><th>Unit</th></tr></thead>
                      <tbody>
                        {[
                          { label:'Stoichiometric AFR (mass)', val:'17.2', unit:'kg air/kg fuel' },
                          { label:'Flue gas at 25% excess air', val:(17.2*1.25+1).toFixed(2), unit:'kg flue/kg fuel' },
                          { label:'Fuel density (Nm³)', val:(results.MW/22.414).toFixed(4), unit:'kg/Nm³' },
                          { label:'CO₂ in fuel', val:`${(results.pc ? (COMP_LIST.find(([i])=>i===10)?.[0]??0) : 0)}`, unit:'mol%' },
                          { label:'H₂S in fuel', val:`${parseFloat(form.comp[11] ?? '0').toFixed(2)}`, unit:'mol%' },
                        ].map(row => (
                          <tr key={row.label}>
                            <td>{row.label}</td>
                            <td className="val">{row.val}</td>
                            <td style={{ fontSize:10, color:'var(--text-dim)' }}>{row.unit}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginTop:10 }}>
                      <div>
                        <label className="field-label">Site Altitude</label>
                        <input type="number" defaultValue="0" id="comb_alt" style={{ width:'100%' }}
                          onChange={e => setCombInputs(p => ({...p, altitude: parseFloat(e.target.value)}))} />
                        <span style={{ fontSize:10, color:'var(--text-dim)' }}>m ASL</span>
                      </div>
                      <div>
                        <label className="field-label">Relative Humidity</label>
                        <input type="number" defaultValue="60" min="0" max="100" id="comb_rh" style={{ width:'100%' }}
                          onChange={e => setCombInputs(p => ({...p, rh: parseFloat(e.target.value)}))} />
                        <span style={{ fontSize:10, color:'var(--text-dim)' }}>%</span>
                      </div>
                      <div>
                        <label className="field-label">Excess Air</label>
                        <input type="number" defaultValue="25" min="10" max="100" id="comb_ea" style={{ width:'100%' }}
                          onChange={e => setCombInputs(p => ({...p, excessAir: parseFloat(e.target.value)}))} />
                        <span style={{ fontSize:10, color:'var(--text-dim)' }}>%</span>
                      </div>
                      <div>
                        <label className="field-label">Ambient Temperature</label>
                        <input type="number" defaultValue="15" id="comb_tamb" style={{ width:'100%' }}
                          onChange={e => setCombInputs(p => ({...p, T_amb: parseFloat(e.target.value)}))} />
                        <span style={{ fontSize:10, color:'var(--text-dim)' }}>°C</span>
                      </div>
                    </div>
                    {combFlue && (
                      <table className="res-table" style={{ marginTop:10, fontSize:11 }}>
                        <thead><tr><th>Flue Gas Component</th><th>Volume %</th><th>Note</th></tr></thead>
                        <tbody>
                          <tr><td>CO₂</td><td className="val">{combFlue.co2_pct.toFixed(2)}%</td><td style={{fontSize:10}}>Complete combustion</td></tr>
                          <tr><td>H₂O (vapour)</td><td className="val">{combFlue.h2o_pct.toFixed(2)}%</td><td style={{fontSize:10}}>Incl. humidity</td></tr>
                          <tr><td>O₂ (excess)</td><td className="val">{combFlue.o2_pct.toFixed(2)}%</td><td style={{fontSize:10}}>Excess air</td></tr>
                          <tr><td>N₂</td><td className="val">{combFlue.n2_pct.toFixed(2)}%</td><td style={{fontSize:10}}>From air + fuel</td></tr>
                          <tr><td>Flue gas MW</td><td className="val">{combFlue.mw_flue.toFixed(2)}</td><td style={{fontSize:10}}>g/mol</td></tr>
                          <tr><td>Air density at altitude</td><td className="val">{combFlue.rho_air.toFixed(4)}</td><td style={{fontSize:10}}>kg/m³</td></tr>
                          <tr><td>Theoretical AFR</td><td className="val">17.2</td><td style={{fontSize:10}}>kg air/kg fuel</td></tr>
                          <tr><td>Actual AFR ({combInputs.excessAir}% excess)</td><td className="val">{(17.2*(1+combInputs.excessAir/100)).toFixed(2)}</td><td style={{fontSize:10}}>kg air/kg fuel</td></tr>
                        </tbody>
                      </table>
                    )}
                    <div className="note-box" style={{ marginTop:10, fontSize:10 }}>
                      Stoichiometric AFR: 17.2 kg air/kg fuel (natural gas, ISO 13443).
                      AS 3814 / AS 1228: excess air ≥ 10% for flame stability.
                      Typical WBH: 20–30% excess. Altitude reduces air density — derate burner accordingly.
                    </div>
                  </>
                ) : (
                  <div style={{ color:'var(--text-dim)', padding:20 }}>Run Stage 1 first.</div>
                )}
              </div>
            </div>
          </div>
          <div>
            <div className="panel">
              <div className="panel-header"><div className="panel-title">Sour Gas Flag (NACE MR0175)</div></div>
              <div className="panel-body">
                {results && (() => {
                  const h2s_pct = parseFloat(form.comp[11] ?? '0');
                  const pH2S_kPa = h2s_pct / 100 * results.P_kPa;
                  const isSour = pH2S_kPa > 0.3;
                  return (
                    <>
                      <div className={`alert ${isSour ? 'alert-fail' : 'alert-ok'}`}>
                        {isSour
                          ? `✘ SOUR SERVICE: H₂S partial pressure ${pH2S_kPa.toFixed(3)} kPa > 0.3 kPa threshold. NACE MR0175 / ISO 15156 applies.`
                          : `✔ Sweet gas: H₂S partial pressure ${pH2S_kPa.toFixed(4)} kPa ≤ 0.3 kPa NACE threshold.`}
                      </div>
                      <table className="res-table" style={{ marginTop:8, fontSize:11 }}>
                        <tbody>
                          <tr><td>H₂S mol%</td><td className="val">{h2s_pct.toFixed(3)}</td><td>mol%</td></tr>
                          <tr><td>H₂S partial pressure</td><td className="val">{pH2S_kPa.toFixed(4)}</td><td>kPa</td></tr>
                          <tr><td>NACE threshold</td><td style={{ fontFamily:'var(--mono)' }}>0.3</td><td>kPa</td></tr>
                          <tr><td>CO₂ mol%</td><td className="val">{parseFloat(form.comp[10] ?? '0').toFixed(3)}</td><td>mol%</td></tr>
                          <tr><td>CO₂ partial pressure</td><td className="val">{(parseFloat(form.comp[10] ?? '0') / 100 * results.P_kPa).toFixed(1)}</td><td>kPa</td></tr>
                        </tbody>
                      </table>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
