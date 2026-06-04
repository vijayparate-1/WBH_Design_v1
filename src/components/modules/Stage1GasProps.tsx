'use client';
// src/components/modules/Stage1GasProps.tsx
// Stage 1 — PR-EOS Gas Properties UI Module (v4 Production Ready)
// Fully realized display components across all tabs

import { useState, useCallback } from 'react';
import ValidationPanel from '@/components/ui/ValidationPanel';
import { ResultCard, ResultGrid } from '@/components/ui/ResultCard';
import type { Stage1Results, GasStatePoint } from '@/lib/calculations/thermodynamics';

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
  { v:'1', label:'M1', desc:'PR Analytic' },
  { v:'2', label:'M2', desc:'PR Numeric ΔH' },
  { v:'3', label:'M3', desc:'PR Numeric ΔS' },
  { v:'4', label:'M4', desc:'SRK' },
  { v:'5', label:'M5 ★', desc:'Avg(M1+M2)' },
  { v:'6', label:'M6', desc:'PR ΔH Full' },
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
      <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:1, color:'var(--text-dim)', marginBottom:4 }}>{title}</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', maxWidth:320 }}>
        {[0, 0.5, 1].map(t => {
          const v = min + (max - min) * t;
          const y = padT + cH * (1 - t);
          return (
            <g key={t}>
              <text x={padL - 4} y={y + 4} textAnchor="end" fontSize={8} fill="var(--text-dim)" fontFamily="monospace">{v.toFixed(2)}</text>
              <line x1={padL} y1={y} x2={padL + cW} y2={y} stroke="rgba(180,190,200,0.3)" strokeWidth={0.5} />
            </g>
          );
        })}
        {values.map((v, i) => {
          if (!isFinite(v) || v <= 0) return null;
          const barH = max > min ? ((v - min) / (max - min)) * cH : cH * 0.5;
          const x = padL + i * (cW / values.length) + 2;
          const y = padT + cH - barH;
          return (
            <g key={i}>
              <rect x={x} y={y} width={bW} height={barH} fill={colors[i % colors.length]} opacity={0.85} rx={2} />
              <text x={x + bW/2} y={H - 4} textAnchor="middle" fontSize={8} fill="var(--text-dim)" fontFamily="sans-serif">{labels[i]}</text>
            </g>
          );
        })}
        <text x={padL + cW + padR - 2} y={padT - 4} textAnchor="end" fontSize={8} fill="var(--text-dim)" fontFamily="sans-serif">{unit}</text>
      </svg>
    </div>
  );
}

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
      <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:1, color:'var(--text-dim)', marginBottom:4 }}>Cp Comparison — All Methods at Inlet T</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%' }}>
        {[0, 0.33, 0.67, 1].map(t => {
          const v = minV + (maxV - minV) * t;
          const y = padT + cH * (1 - t);
          return (
            <g key={t}>
              <text x={padL-4} y={y+4} textAnchor="end" fontSize={9} fill="var(--text-dim)" fontFamily="monospace">{v.toFixed(3)}</text>
              <line x1={padL} y1={y} x2={padL+cW} y2={y} stroke="rgba(180,190,200,0.25)" strokeWidth={0.5} />
            </g>
          );
        })}
        {vals.map((v, i) => {
          if (!v || !isFinite(v)) return null;
          const bH = maxV > minV ? ((v - minV) / (maxV - minV)) * cH : cH * 0.5;
          const x = padL + i * (cW / vals.length) + 3;
          const y = padT + cH - bH;
          return (
            <g key={i}>
              <rect x={x} y={y} width={bW} height={bH} fill={colors[i]} opacity={labels[i].includes('★') ? 1 : 0.7} rx={2} />
              {labels[i].includes('★') && (
                <rect x={x-1} y={y-1} width={bW+2} height={bH+2} fill="none" stroke="var(--accent)" strokeWidth={1.5} rx={3} />
              )}
              <text x={x+bW/2} y={H-6} textAnchor="middle" fontSize={9} fill={labels[i].includes('★') ? 'var(--accent)' : 'var(--text-dim)'} fontFamily="sans-serif" fontWeight={labels[i].includes('★') ? 700 : 400}>
                {labels[i]}
              </text>
              <text x={x+bW/2} y={y-3} textAnchor="middle" fontSize={8} fill={colors[i]} fontFamily="monospace" fontWeight={700}>
                {v.toFixed(3)}
              </text>
            </g>
          );
        })}
        <text x={padL+cW+padR} y={padT-4} textAnchor="end" fontSize={8} fill="var(--text-dim)" fontFamily="sans-serif">kJ/(kg·K)</text>
      </svg>
    </div>
  );
}

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
          <text x={62} y={14} textAnchor="end" fontSize={10} fill="var(--text-dim)" fontFamily="sans-serif">{d.formula}</text>
          <rect x={66} y={4} width={Math.max((d.val / maxVal) * barMaxW, 2)} height={14} fill={CLRS[i % CLRS.length]} rx={2} opacity={0.8} />
          <text x={66 + (d.val / maxVal) * barMaxW + 4} y={14} fontSize={10} fill={CLRS[i % CLRS.length]} fontFamily="monospace" fontWeight={700}>
            {d.val.toFixed(2)}%
          </text>
        </g>
      ))}
    </svg>
  );
}

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
      <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:1, color:'var(--text-dim)', marginBottom:4 }}>Process Duty — EOS Cross-Check</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%' }}>
        {[0, 0.5, 1].map(t => {
          const v = maxV * t;
          const y = padT + cH * (1 - t);
          return (
            <g key={t}>
              <text x={padL-4} y={y+4} textAnchor="end" fontSize={8} fill="var(--text-dim)" fontFamily="monospace">{v.toFixed(0)}</text>
              <line x1={padL} y1={y} x2={padL+cW} y2={y} stroke="rgba(180,190,200,0.3)" strokeWidth={0.5} />
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
              <rect x={x} y={y} width={bW} height={bH} fill={colors[i]} opacity={i === 3 ? 1 : 0.65} rx={2} />
              {i === 3 && <rect x={x-1} y={y-1} width={bW+2} height={bH+2} fill="none" stroke="var(--accent)" strokeWidth={1.5} rx={3} />}
              <text x={x+bW/2} y={H-5} textAnchor="middle" fontSize={9} fill={i===3?'var(--accent)':'var(--text-dim)'} fontFamily="sans-serif">
                {labels[i]}
              </text>
              <text x={x+bW/2} y={y-3} textAnchor="middle" fontSize={8} fill={colors[i]} fontFamily="monospace" fontWeight={700}>
                {v.toFixed(0)}
              </text>
            </g>
          );
        })}
        <text x={padL+cW+4} y={padT-2} textAnchor="end" fontSize={8} fill="var(--text-dim)">kW</text>
      </svg>
    </div>
  );
}

interface JTProps {
  results: Stage1Results | null;
  form: { T_in: string; T_out: string; P_in: string; dP: string; comp: Record<number, string> };
  f: (v: number | undefined, d?: number) => string;
  ST: (pt: GasStatePoint | undefined) => Record<string, number> | undefined;
}

function estimateMuJT_GPSA(P_kPa: number, T_C: number): number {
  const P_bar = P_kPa / 100;
  const T_K   = T_C + 273.15;
  const base  = 0.45 * Math.max(0.05, 1 - P_bar / 250) * Math.sqrt(320 / T_K);
  return Math.max(0.02, Math.min(base, 1.5));
}

function calcJTCurveNoHeater(T_in_C: number, P_in_kPa: number, P_out_kPa: number, steps = 20): Array<{P_kPa: number; T_C: number}> {
  const pts: Array<{P_kPa: number; T_C: number}> = [];
  const dP_kPa = (P_out_kPa - P_in_kPa) / steps;
  let T = T_in_C, P = P_in_kPa;
  pts.push({P_kPa: P, T_C: T});
  for (let i = 0; i < steps; i++) {
    const mu = estimateMuJT_GPSA(P, T);
    const dP_bar = dP_kPa / 100;
    T = T + mu * dP_bar;
    P = P + dP_kPa;
    pts.push({P_kPa: P, T_C: T});
  }
  return pts;
}

function JTCurveChart({ curve, T_hydrate, T_in_C, P_in_kPa, T_out_C }: {
  curve: Array<{P_kPa: number; T_C: number}>;
  T_hydrate: number;
  T_in_C: number;
  P_in_kPa: number;
  T_out_C?: number;
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

  const curvePath = curve.map((pt, i) => `${i === 0 ? 'M' : 'L'}${sx(pt.P_kPa).toFixed(1)},${sy(pt.T_C).toFixed(1)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', maxWidth:560 }}>
      {Array.from({length: 5 + 1}, (_, i) => {
        const T  = minT + (maxT - minT) * i / 5;
        const y  = sy(T);
        return (
          <g key={`y${i}`}>
            <line x1={pL} y1={y} x2={pL+cW} y2={y} stroke="rgba(180,190,200,0.25)" strokeWidth={0.5} />
            <text x={pL-4} y={y+4} textAnchor="end" fontSize={9} fill="var(--text-dim)" fontFamily="monospace">{T.toFixed(0)}°</text>
          </g>
        );
      })}
      {Array.from({length: 5 + 1}, (_, i) => {
        const P  = minP + (maxP - minP) * i / 5;
        const x  = sx(P);
        return (
          <g key={`x${i}`}>
            <line x1={x} y1={pT} x2={x} y2={pT+cH} stroke="rgba(180,190,200,0.25)" strokeWidth={0.5} />
            <text x={x} y={H-4} textAnchor="middle" fontSize={9} fill="var(--text-dim)" fontFamily="monospace">{(P/1000).toFixed(1)}k</text>
          </g>
        );
      })}
      {T_hydrate > minT && T_hydrate < maxT && (
        <g>
          <line x1={pL} y1={sy(T_hydrate)} x2={pL+cW} y2={sy(T_hydrate)} stroke="var(--red)" strokeWidth={1.2} strokeDasharray="4 3" opacity={0.8} />
          <text x={pL+cW-2} y={sy(T_hydrate)-4} textAnchor="end" fontSize={9} fill="var(--red)" fontFamily="monospace" fontWeight="700">T_hydrate {T_hydrate.toFixed(1)}°C</text>
        </g>
      )}
      <path d={curvePath} fill="none" stroke="#1a6ab8" strokeWidth={2.5} opacity={0.9} />
      <circle cx={sx(curve[0].P_kPa)} cy={sy(curve[0].T_C)} r={5} fill="var(--accent)" stroke="var(--bg)" strokeWidth={1.5} />
      <text x={sx(curve[0].P_kPa)+8} y={sy(curve[0].T_C)+4} fontSize={9} fill="var(--accent)" fontFamily="monospace" fontWeight="700">Inlet {curve[0].T_C.toFixed(1)}°C</text>
      <circle cx={sx(curve[curve.length-1].P_kPa)} cy={sy(curve[curve.length-1].T_C)} r={5} fill={curve[curve.length-1].T_C <= T_hydrate ? 'var(--red)' : '#1a6ab8'} stroke="var(--bg)" strokeWidth={1.5} />
      <text x={sx(curve[curve.length-1].P_kPa)-8} y={sy(curve[curve.length-1].T_C)+14} fontSize={9} textAnchor="end" fill={curve[curve.length-1].T_C <= T_hydrate ? 'var(--red)' : '#1a6ab8'} fontFamily="monospace" fontWeight="700">{curve[curve.length-1].T_C.toFixed(1)}°C</text>
    </svg>
  );
}

function JTSubTab({ results, form, f, ST }: JTProps) {
  const [customDP, setCustomDP]     = useState('500');
  const [P_outlet_kPa, setP_outlet] = useState('');

  if (!results) {
    return (
      <div className="panel">
        <div className="panel-body" style={{ color:'var(--text-dim)', padding:24 }}>Run Stage 1 calculation first to see Joule-Thomson analysis.</div>
      </div>
    );
  }

  const sp_in  = ST(results.ST_in);
  const sp_out = ST(results.ST_out);
  const sp_des = ST(results.ST_des);
  const P_out_kPa = results.P_kPa - results.dP_kPa;

  const dP_scenarios = [50, 100, 200, 350, 500, 1000, 2000, parseFloat(customDP) || 500]
    .filter((v, i, a) => a.indexOf(v) === i && v > 0 && v < results.P_kPa)
    .sort((a, b) => a - b);

  const P_curve_end = parseFloat(P_outlet_kPa) || Math.max(100, results.P_kPa * 0.10);
  const jtCurve = calcJTCurveNoHeater(results.T_in_C, results.P_kPa, P_curve_end, 40);

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
      <div>
        <div className="panel" style={{ marginBottom:12 }}>
          <div className="panel-header"><div className="panel-title">Gas State Points</div></div>
          <div className="panel-body">
            <div style={{ marginBottom:6, fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:1, color:'var(--text-dim)' }}>Compressibility Factor Z</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
              <ResultCard label="Z — Inlet" value={sp_in?.Z} decimals={4} variant="highlight" />
              <ResultCard label="Z — Outlet" value={sp_out?.Z} decimals={4} variant="highlight" />
            </div>

            <div style={{ marginBottom:6, fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:1, color:'var(--text-dim)' }}>Pressure [kPa]</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
              <ResultCard label="P Inlet [kPa]"  value={results.P_kPa}  unit="kPa" decimals={0} />
              <ResultCard label="P Outlet [kPa]" value={P_out_kPa}       unit="kPa" decimals={0} />
            </div>

            <div style={{ marginBottom:6, fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:1, color:'var(--text-dim)' }}>Gas Density ρ [kg/m³]</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
              <ResultCard label="ρ Inlet  [kg/m³]" value={sp_in?.rho}  unit="kg/m³" decimals={3} />
              <ResultCard label="ρ Outlet [kg/m³]" value={sp_out?.rho} unit="kg/m³" decimals={3} />
            </div>

            <table className="res-table" style={{ fontSize:11 }}>
              <thead>
                <tr>
                  <th>State</th><th>T [°C]</th><th>P [kPa]</th><th>Z [—]</th><th>ρ [kg/m³]</th><th>μ [Pa·s]</th><th>Cp [kJ/(kg·K)]</th>
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
          </div>
        </div>
      </div>

      <div>
        <div className="panel" style={{ marginBottom:12 }}>
          <div className="panel-header"><div className="panel-title" style={{ color:'var(--blue)' }}>T vs P — Isenthalpic Expansion (No Heater)</div></div>
          <div className="panel-body">
            <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:10 }}>
              <label className="field-label" style={{ margin:0, whiteSpace:'nowrap' }}>Curve end pressure:</label>
              <input type="number" value={P_outlet_kPa} placeholder={`${(results.P_kPa * 0.10).toFixed(0)}`} min="100" max={results.P_kPa - 100} onChange={e => setP_outlet(e.target.value)} style={{ width:90 }} />
              <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text-dim)' }}>kPa</span>
            </div>

            <JTCurveChart curve={jtCurve} T_hydrate={results.hydrateT_C} T_in_C={results.T_in_C} P_in_kPa={results.P_kPa} T_out_C={results.T_out_C} />

            <table className="res-table" style={{ fontSize:11, marginTop:12 }}>
              <thead>
                <tr>
                  <th>P outlet [kPa]</th><th>T no-heater [°C]</th><th>ΔT [°C]</th><th>vs T_hydrate</th><th>Min heater duty</th>
                </tr>
              </thead>
              <tbody>
                {jtCurve.filter((_, i) => i % 4 === 0 || i === jtCurve.length - 1).map((pt, i) => {
                  const dT = pt.T_C - results.T_in_C;
                  const margin = pt.T_C - results.hydrateT_C;
                  const isRisk = pt.T_C <= results.hydrateT_C;
                  const Cp_est = sp_in?.Cp5_kgK ?? 2.3;
                  const Q_min  = results.mdot_kgs * Cp_est * (results.T_out_C - pt.T_C);
                  return (
                    <tr key={i} style={{ background: isRisk ? 'rgba(192,40,40,0.06)' : undefined }}>
                      <td style={{ fontFamily:'var(--mono)' }}>{pt.P_kPa.toFixed(0)}</td>
                      <td style={{ fontFamily:'var(--mono)', fontWeight:700, color: isRisk ? 'var(--red)' : 'var(--green)' }}>{pt.T_C.toFixed(2)}</td>
                      <td style={{ fontFamily:'var(--mono)', color:'var(--blue)', fontWeight:600 }}>{dT.toFixed(2)}</td>
                      <td style={{ fontFamily:'var(--mono)', fontSize:10, color: isRisk ? 'var(--red)' : 'var(--text-dim)' }}>{margin.toFixed(1)}°C {isRisk ? '✘ HYDRATE' : '✔'}</td>
                      <td style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--text-dim)' }}>{Q_min > 0 ? `~${Q_min.toFixed(0)} kW` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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

  const total = COMP_LIST.reduce((s, [i]) => s + parseFloat(form.comp[i] ?? '0'), 0);
  const totalOK = Math.abs(total - 100) < 0.5;

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
      const sumPct = COMP_LIST.reduce((s, [i]) => s + parseFloat(form.comp[i] ?? '0'), 0);
      const y = Array.from({ length: 14 }, (_, i) => {
        const val = parseFloat(form.comp[i] ?? '0');
        return sumPct > 0 ? val / sumPct : 0;
      });

      const MW_comps = [16.043,30.070,44.097,58.123,58.123,72.150,72.150,86.177,100.20,28.014,44.010,34.082,4.003,2.016];
      const MW_est = y.reduce((s, yi, i) => s + yi * MW_comps[i], 0);
      const nm3_factor = MW_est / 22.414;

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

  const combFlue = results?.heatingValues ? (() => {
    const { altitude, rh, excessAir, T_amb } = combInputs;
    const rho_air = 1.225 * Math.exp(-altitude/8500) * (288.15/(T_amb+273.15));
    const psat = 0.6108 * Math.exp(17.27*T_amb/(T_amb+237.3));
    const p_atm = 101.325 * Math.exp(-altitude/8500);
    const h2o_air_vol = rh/100 * psat / p_atm;
    const dry_air_frac = 1 - h2o_air_vol;
    
    const afr_actual = 17.2 * (1 + excessAir/100);
    const m_air = afr_actual;
    const moles_fuel = 1/results.MW;
    const ch4_frac = parseFloat(form.comp[0] ?? '92.0') / 100;
    const moles_co2 = moles_fuel;
    const moles_h2o = moles_fuel * 2 * ch4_frac + m_air * h2o_air_vol / 0.018;
    const moles_o2_in = m_air * dry_air_frac / 28.97 * 0.21 * 28.97 / 32;
    const moles_o2_used = moles_fuel * 2 * ch4_frac;
    const moles_o2_excess = Math.max(0, moles_o2_in - moles_o2_used);
    const moles_n2 = m_air * dry_air_frac / 28.97 * 0.79;
    const total_moles = moles_co2 + moles_h2o + moles_o2_excess + moles_n2;
    
    return {
      co2_pct: moles_co2/total_moles*100,
      h2o_pct: moles_h2o/total_moles*100,
      o2_pct: moles_o2_excess/total_moles*100,
      n2_pct: moles_n2/total_moles*100,
      mw_flue: ((moles_co2/total_moles)*44 + (moles_h2o/total_moles)*18 + (moles_o2_excess/total_moles)*32 + (moles_n2/total_moles)*28) * 100 / 100,
      rho_air
    };
  })() : null;

  return (
    <div>
      <div style={{ display:'flex', background:'var(--panel)', borderBottom:'1px solid var(--border)', margin:'-20px -24px 16px', overflowX:'auto' }}>
        {[
          { id:'props', label:'① Gas Properties & EOS' },
          { id:'cp',    label:'② Cp Method Comparison' },
          { id:'hv',    label:'③ Heating Values' },
          { id:'jt',    label:'④ Joule-Thomson' },
          { id:'comb',  label:'⑤ Combustion' },
        ].map(t => (
          <button key={t.id} className={`tab-btn${subTab === t.id ? ' active' : ''}`} style={{ fontSize:12 }} onClick={() => setSubTab(t.id as typeof subTab)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB ①: GAS PROPERTIES & EOS ── */}
      {subTab === 'props' && (
        <div style={{ display:'grid', gridTemplateColumns:'480px 1fr', gap:16, alignItems:'start' }}>
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
                  </select>
                </div>

                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                  <tbody>
                    {COMP_LIST.map(([idx, name, formula]) => (
                      <tr key={idx}>
                        <td>{name}</td>
                        <td style={{ fontFamily:'var(--mono)' }}>{formula}</td>
                        <td><input type="number" step="0.01" min="0" max="100" value={form.comp[idx] ?? '0'} style={{ width:80 }} onChange={e => setComp(idx, e.target.value)} /></td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={2}>TOTAL</td>
                      <td style={{ fontFamily:'var(--mono)', fontWeight:700 }}>{total.toFixed(3)} mol%</td>
                    </tr>
                  </tbody>
                </table>
                <div style={{ display:'flex', gap:8, marginTop:8 }}>
                  <button className="btn btn-secondary btn-sm" onClick={normalise}>Normalise to 100%</button>
                </div>
              </div>
            </div>

            <div className="panel">
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
                      <input type="number" value={form[fi.k as keyof S1Form] as string} onChange={e => setForm(f => ({ ...f, [fi.k]: e.target.value }))} />
                    </div>
                  ))}
                </div>
                <button className="btn btn-primary" style={{ marginTop:12 }} onClick={calculate} disabled={loading || !totalOK}>
                  {loading ? '⏳ Calculating…' : '▶ Calculate Stage 1'}
                </button>
              </div>
            </div>
          </div>

          <div>
            {results && (
              <>
                <div className="panel" style={{ marginBottom:12 }}>
                  <div className="panel-header"><div className="panel-title">Mixture Properties</div></div>
                  <div className="panel-body">
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:12 }}>
                      <ResultCard label="MW mix" value={results.MW} unit="g/mol" decimals={3} variant="highlight" />
                      <ResultCard label="Spec. Gravity" value={results.SG} decimals={4} variant="highlight" />
                      <ResultCard label="Process Duty Q" value={results.Q_final} unit="kW" decimals={1} variant="highlight" />
                      <ResultCard label="Pseudo-Tc" value={results.pc?.Tc_pc} unit="K" decimals={1} />
                      <ResultCard label="Pseudo-Pc" value={results.pc?.Pc_pc} unit="bar" decimals={2} />
                      <ResultCard label="Hydrate T" value={results.hydrateT_C} unit="°C" decimals={1} />
                    </div>
                    <CompositionChart comp={form.comp} />
                  </div>
                </div>

                <div className="panel" style={{ marginBottom:12 }}>
                  <div className="panel-body">
                    <table className="res-table" style={{ fontSize:11 }}>
                      <tbody>
                        {[
                          { label:'Z-Factor (PR)', key:'Z', dec:4, unit:'—' },
                          { label:'Density ρ', key:'rho', dec:3, unit:'kg/m³' },
                          { label:'Ideal Gas ρ', key:'rho_ideal', dec:3, unit:'kg/m³' },
                        ].map(row => (
                          <tr key={row.key}>
                            <td>{row.label}</td>
                            <td className="val">{f(ST(results.ST_in)?.[row.key], row.dec)}</td>
                            <td className="val2">{f(ST(results.ST_out)?.[row.key], row.dec)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── TAB ②: Cp METHOD COMPARISON ── */}
      {subTab === 'cp' && results && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <div className="panel" style={{ marginBottom: 12 }}>
              <div className="panel-header"><div className="panel-title">Cp Calculation Matrix — 7 Independent Methods</div></div>
              <div className="panel-body">
                <CpComparisonChart results={results} />
                
                <table className="res-table" style={{ fontSize: 11, marginTop: 12 }}>
                  <thead>
                    <tr>
                      <th>Method</th>
                      <th>Thermodynamic Description</th>
                      <th className="val">Inlet [kJ/kg·K]</th>
                      <th className="val">Outlet [kJ/kg·K]</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { key: 'Cp0_kgK', label: 'Cp° Baseline', desc: 'Ideal Gas Limits — DIPPR 107 Aly-Lee Hyperbolic' },
                      { key: 'Cp1_kgK', label: 'Method 1', desc: 'PR Analytical Cv Departure Engine' },
                      { key: 'Cp2_kgK', label: 'Method 2', desc: 'PR Numeric Central Difference Enthalpy' },
                      { key: 'Cp3_kgK', label: 'Method 3', desc: 'PR Numeric Central Difference Entropy' },
                      { key: 'Cp4_kgK', label: 'Method 4', desc: 'Genuine Soave-Redlich-Kwong (SRK 1972)' },
                      { key: 'Cp5_kgK', label: 'Method 5 ★', desc: 'Averaged Engine (M1 + M2) — Optimal < 50 barg' },
                      { key: 'Cp6_kgK', label: 'Method 6', desc: 'Full PR Enthalpy Departure Envelope' },
                      { key: 'Cp7_kgK', label: 'Method 7', desc: 'Lee-Kesler Plait Point BWR Track — Optimal > 100 barg' },
                    ].map(row => {
                      const inVal = ST(results.ST_in)?.[row.key];
                      const outVal = ST(results.ST_out)?.[row.key];
                      const isSelected = form.basis === row.label.replace('Method ', '').replace(' ★', '');
                      return (
                        <tr key={row.key} style={{ 
                          background: isSelected ? 'rgba(176,96,0,0.06)' : undefined,
                          fontWeight: isSelected ? 600 : 400 
                        }}>
                          <td style={{ fontFamily: 'var(--mono)', color: isSelected ? 'var(--accent)' : 'inherit' }}>{row.label}</td>
                          <td style={{ color: 'var(--text-dim)', fontSize: 10 }}>{row.desc}</td>
                          <td className="val" style={{ fontFamily: 'var(--mono)' }}>{f(inVal, 4)}</td>
                          <td className="val" style={{ fontFamily: 'var(--mono)' }}>{f(outVal, 4)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div>
            <div className="panel" style={{ marginBottom: 12 }}>
              <div className="panel-header"><div className="panel-title">Stability & Variance Analysis</div></div>
              <div className="panel-body">
                {(() => {
                  const m1 = ST(results.ST_in)?.Cp1_kgK ?? 0;
                  const m6 = ST(results.ST_in)?.Cp6_kgK ?? 0;
                  const variance = m6 > 0 ? (Math.abs(m1 - m6) / m6) * 100 : 0;
                  const isHighVariance = variance > 5.0;
                  return (
                    <>
                      <div className={`alert ${isHighVariance ? 'alert-warn' : 'alert-ok'}`} style={{ marginBottom: 12 }}>
                        {isHighVariance 
                          ? `⚠ High EOS Derivative Drift: M1 vs M6 variance is ${variance.toFixed(2)}%. Fluid state is highly non-ideal. Avoid analytical methods; rely strictly on Enthalpy Differences (M6 or M7).`
                          : `✔ EOS Convergence Stable: M1 vs M6 derivative drift is tightly bounded at ${variance.toFixed(2)}%.`
                        }
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                        <ResultCard label="Isochoric Cv (Inlet)" value={ST(results.ST_in)?.Cv_kgK} unit="kJ/kg·K" decimals={4} />
                        <ResultCard label="Isentropic Exponent (γ)" value={ST(results.ST_in)?.gamma} unit="Cp/Cv" decimals={4} variant="highlight" />
                      </div>
                    </>
                  );
                })()}
                <div className="note-box" style={{ fontSize: 11, lineHeight: 1.5 }}>
                  <strong>Process Guidance on Exponent Tracking:</strong>
                  <br />
                  The real gas heat capacity ratio $\gamma$ directly influences compressor performance profiles and flow boundaries through high-pressure piping manifolds. While ideal gas methane hovers near $1.31$, dense pipeline configurations at high pressures drop toward $1.6 - 1.9$, reducing the adiabatic temperature rises across process systems.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB ③: HEATING VALUES ── */}
      {subTab === 'hv' && results?.heatingValues && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <div className="panel">
              <div className="panel-header"><div className="panel-title">Contractual Heating Metrics & Wobbe Realignment</div></div>
              <div className="panel-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                  <ResultCard label="Gross Calorific Value (HHV)" value={results.heatingValues.HHV_kJkg} unit="kJ/kg" decimals={0} variant="highlight" />
                  <ResultCard label="Net Calorific Value (LHV)" value={results.heatingValues.LHV_kJkg} unit="kJ/kg" decimals={0} variant="highlight" />
                  <ResultCard label="Volumetric HHV (15°C)" value={results.heatingValues.HHV_MJNm3} unit="MJ/Nm³" decimals={3} />
                  <ResultCard label="Wobbe Index (Iw)" value={results.heatingValues.WobbeIdx} unit="MJ/Nm³" decimals={2} />
                </div>

                {(() => {
                  const iw = results.heatingValues.WobbeIdx;
                  const isAs4564Compliant = iw >= 46.0 && iw <= 52.0;
                  return (
                    <div className={`alert ${isAs4564Compliant ? 'alert-ok' : 'alert-fail'}`} style={{ marginBottom: 12 }}>
                      {isAs4564Compliant
                        ? `✔ AS 4564 Compliant Pipeline Spec: Wobbe Index (${iw.toFixed(2)} MJ/Nm³) falls cleanly within standard Australian pipeline grid distribution guidelines.`
                        : `✘ Out of Specification: Wobbe Index (${iw.toFixed(2)} MJ/Nm³) violates AS 4564 constraints (Target: 46.0 – 52.0 MJ/Nm³). High risk of appliance burner flashback.`
                      }
                    </div>
                  );
                })()}

                <table className="res-table" style={{ fontSize: 11 }}>
                  <thead>
                    <tr>
                      <th>Volumetric Capacity Conversion</th>
                      <th className="val">Flowrate</th>
                      <th>Unit Basis</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Equivalent Normal Volumetric Flow</td>
                      <td className="val" style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{f(results.mdot_kgs * 3600 / (results.MW / 22.414), 1)}</td>
                      <td>Nm³/hr (at 0°C, 101.325 kPa)</td>
                    </tr>
                    <tr>
                      <td>Equivalent Standard Volumetric Flow</td>
                      <td className="val" style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{f(results.mdot_kgs * 3600 / (results.MW / 23.645), 1)}</td>
                      <td>Sm³/hr (at 15°C, 101.325 kPa)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div>
            <div className="panel">
              <div className="panel-header"><div className="panel-title">Energy Distribution Profiles</div></div>
              <div className="panel-body">
                {(() => {
                  const HHV_vals = [55695, 51877, 50330, 49360, 49500, 48583, 48643, 47793, 47641, 0, 0, 21900, 0, 141800];
                  const ySum = COMP_LIST.reduce((s, [i]) => s + parseFloat(form.comp[i] ?? '0'), 0);
                  const contribs = COMP_LIST.map(([i, n, f2]) => ({
                    name: String(f2),
                    val: (parseFloat(form.comp[i] ?? '0') / ySum) * HHV_vals[i],
                  })).filter(d => d.val > 10).sort((a, b) => b.val - a.val);
                  return (
                    <SparkBar
                      values={contribs.map(d => d.val)}
                      labels={contribs.map(d => d.name)}
                      colors={['#c04000', '#1a6ab8', '#0e7a3e', '#7a1ab0', '#e09000', '#1a8ab0']}
                      title="Weighted HHV Contribution Mix"
                      unit="kJ/kg"
                      yMin={0}
                    />
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB ④: JOULE-THOMSON ── */}
      {subTab === 'jt' && (
        <JTSubTab results={results} form={form} f={f} ST={ST} />
      )}

      {/* ── TAB ⑤: COMBUSTION ── */}
      {subTab === 'comb' && results && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <div className="panel" style={{ marginBottom: 12 }}>
              <div className="panel-header"><div className="panel-title">Air Requirements & Barometric Burner Derating</div></div>
              <div className="panel-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div>
                    <label className="field-label">Site Altitude [m]</label>
                    <input type="number" value={combInputs.altitude} min="0" max="5000"
                      onChange={e => setCombInputs(p => ({...p, altitude: parseFloat(e.target.value) || 0}))} />
                    <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>m above sea level</span>
                  </div>
                  <div>
                    <label className="field-label">Excess Air [%]</label>
                    <input type="number" value={combInputs.excessAir} min="0" max="200"
                      onChange={e => setCombInputs(p => ({...p, excessAir: parseFloat(e.target.value) || 0}))} />
                    <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>Target: 20–30% WBH</span>
                  </div>
                  <div>
                    <label className="field-label">Ambient Temp [°C]</label>
                    <input type="number" value={combInputs.T_amb} min="-40" max="60"
                      onChange={e => setCombInputs(p => ({...p, T_amb: parseFloat(e.target.value) || 0}))} />
                    <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>Burner inlet air T</span>
                  </div>
                </div>

                {combFlue && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                      <ResultCard label="Actual Air/Fuel Ratio" value={17.2 * (1 + combInputs.excessAir / 100)} unit="kg_air/kg_fuel" decimals={2} />
                      <ResultCard label="Local Air Density" value={combFlue.rho_air} unit="kg/m³" decimals={4} variant="highlight" />
                    </div>

                    <table className="res-table" style={{ fontSize: 11 }}>
                      <thead>
                        <tr>
                          <th>Flue Gas Constituent</th>
                          <th className="val">Molar Stream Fraction</th>
                          <th>Status Flag</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>Carbon Dioxide (CO₂)</td>
                          <td className="val" style={{ fontFamily: 'var(--mono)' }}>{combFlue.co2_pct.toFixed(2)}%</td>
                          <td>Stoichiometric Product</td>
                        </tr>
                        <tr>
                          <td>Water Vapor (H₂O)</td>
                          <td className="val" style={{ fontFamily: 'var(--mono)' }}>{combFlue.h2o_pct.toFixed(2)}%</td>
                          <td>Fuel Yield + Humid Carrier</td>
                        </tr>
                        <tr>
                          <td>Excess Oxygen (O₂)</td>
                          <td className="val" style={{ fontFamily: 'var(--mono)' }}>{combFlue.o2_pct.toFixed(2)}%</td>
                          <td>Flame Containment Margin</td>
                        </tr>
                        <tr>
                          <td>Nitrogen (N₂)</td>
                          <td className="val" style={{ fontFamily: 'var(--mono)' }}>{combFlue.n2_pct.toFixed(2)}%</td>
                          <td>Inert Thermal Mass Balance</td>
                        </tr>
                        <tr style={{ borderTop: '1px solid var(--border)', fontWeight: 600 }}>
                          <td>Flue Stream Mean MW</td>
                          <td className="val" style={{ fontFamily: 'var(--mono)' }}>{combFlue.mw_flue.toFixed(2)}</td>
                          <td>g/mol</td>
                        </tr>
                      </tbody>
                    </table>
                  </>
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="panel" style={{ marginBottom: 12 }}>
              <div className="panel-header"><div className="panel-title">NACE MR0175 / ISO 15156 Sour Hazard Check</div></div>
              <div className="panel-body">
                {(() => {
                  const h2s_pct = parseFloat(form.comp[11] ?? '0');
                  const pH2S_kPa = (h2s_pct / 100) * results.P_kPa;
                  const isSour = pH2S_kPa > 0.3;
                  return (
                    <>
                      <div className={`alert ${isSour ? 'alert-fail' : 'alert-ok'}`} style={{ marginBottom: 12 }}>
                        {isSour
                          ? `✘ SOUR HAZARD METALLURGY TRIGGERED: H₂S Partial Pressure is ${pH2S_kPa.toFixed(3)} kPa. This exceeds the 0.3 kPa NACE limit. Materials must comply with NACE MR0175 to avoid Sulfide Stress Cracking (SSC).`
                          : `✔ Material Compliance Cleared: H₂S Partial Pressure is ${pH2S_kPa.toFixed(4)} kPa, sitting below the NACE risk limit.`
                        }
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <ResultCard label="H2S Partial Pressure" value={pH2S_kPa} unit="kPa" decimals={4} />
                        <ResultCard label="NACE SSC Threshold" value={0.3} unit="kPa" decimals={1} />
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
            
            {/* EOS Cross-Check validation output on combustion panel */}
            <div className="panel">
              <div className="panel-header"><div className="panel-title">Thermal Energy Cross-Check</div></div>
              <div className="panel-body">
                <DutyComparisonChart results={results} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 10 }}>
                  <ResultCard label="Q PR-EOS (M6)" value={results.Q_PR} unit="kW" decimals={1} />
                  <ResultCard label="Q SRK (M4)" value={results.Q_SRK} unit="kW" decimals={1} />
                  <ResultCard label="Q Lee-Kesler (M7)" value={results.Q_LK} unit="kW" decimals={1} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
