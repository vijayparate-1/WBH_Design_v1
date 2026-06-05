'use client';
// src/components/modules/Stage2Firetube.tsx
// Stage 2 — Firetube Sizing + Forced Draft Blower & Burner (TJ Series)
// Auto-calculates 300ms after any input change — no Calculate button needed.

import { useState, useEffect, useRef, useCallback } from 'react';
import ValidationPanel from '@/components/ui/ValidationPanel';
import { ResultCard, ResultGrid } from '@/components/ui/ResultCard';
import type { Stage1Results } from '@/lib/calculations/thermodynamics';
import type { Stage2Inputs } from '@/lib/calculations/heater-sizing';
import {
  calcForcedDraftBlower, selectBurnerModel, getCompatibleModels,
  checkTurndownFeasibility, getFlameLengthRange, validateControlSystem,
  kWToBtuH, inWCToMbar, scfhToNm3h,
} from '@/lib/calculations/wbhEngine';
import type { BurnerModel, FuelType, ControlMethod } from '@/data/wbhData';
import { BURNER_SPECS } from '@/data/wbhData';

// ─── Combustion tube data ────────────────────────────────────────────────────
const FIRE_PIPES = [
  { dn:150, od:168.3, wt:3.40, label:'DN150 (6") Sch 10'  },
  { dn:200, od:219.1, wt:4.78, label:'DN200 (8") Sch 10'  },
  { dn:250, od:273.1, wt:4.78, label:'DN250 (10") Sch 10' },
  { dn:300, od:323.9, wt:4.78, label:'DN300 (12") Sch 10' },
  { dn:350, od:355.6, wt:6.35, label:'DN350 (14") Sch 20' },
  { dn:400, od:406.4, wt:6.35, label:'DN400 (16") Sch 20' },
  { dn:450, od:457.0, wt:6.35, label:'DN450 (18") Sch 20' },
  { dn:500, od:508.0, wt:6.35, label:'DN500 (20") Sch 20' },
];

interface Props {
  s1Results?: Stage1Results;
  onComplete?: (r: any) => void;
}

// ── Firetube pass sketch ─────────────────────────────────────────────────────
function FiretubeSVG({ nPass, L, od_mm, nBurners }: {
  nPass: number; L: number; od_mm: number; nBurners: number;
}) {
  const W = 380, legW = 265;
  const spacing = nPass === 2 ? 28 : 22;
  const H = 24 + nPass * spacing + 20;
  const x1 = 44, x2 = x1 + legW;
  const r = Math.min(spacing * 0.48, 16);
  const sw = Math.max(5, Math.min(11, od_mm / 30));
  const pc = '#c47d00', tc = '#5a6e88', fc = '#e05000';

  const passYs = Array.from({ length: nPass }, (_, i) => 20 + i * spacing);

  return (
    <div>
      <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:1,
        color:'var(--text-dim)', marginBottom:4 }}>
        Firetube — {nPass}-Pass {nBurners > 1 ? `× ${nBurners} burners` : ''}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', background:'#0d1520', borderRadius:4 }}>
        {/* Pass lines */}
        {passYs.map((y, i) => (
          <g key={i}>
            <line x1={x1} y1={y} x2={x2} y2={y}
              stroke={pc} strokeWidth={sw - i * 0.5} strokeLinecap="round"/>
            <line x1={x1 + 3} y1={y} x2={x2 - 3} y2={y}
              stroke="rgba(180,220,255,0.25)" strokeWidth={sw * 0.5} strokeLinecap="round"/>
          </g>
        ))}
        {/* Bends at right for even-indexed passes */}
        {passYs.slice(0, -1).map((y, i) => i % 2 === 0 ? (
          <path key={`br${i}`}
            d={`M${x2} ${y} A${r} ${r} 0 0 1 ${x2} ${passYs[i + 1]}`}
            fill="none" stroke={pc} strokeWidth={sw - i * 0.4}/>
        ) : null)}
        {/* Bends at left for odd-indexed passes */}
        {passYs.slice(0, -1).map((y, i) => i % 2 === 1 ? (
          <path key={`bl${i}`}
            d={`M${x1} ${y} A${r} ${r} 0 0 0 ${x1} ${passYs[i + 1]}`}
            fill="none" stroke={pc} strokeWidth={sw - i * 0.4}/>
        ) : null)}
        {/* Flame symbols */}
        {Array.from({ length: Math.min(nBurners, 2) }, (_, bi) => {
          const fx = x1 - 22 + bi * 4;
          const fy = passYs[0];
          return (
            <g key={bi}>
              <polygon points={`${fx},${fy + 8} ${fx - 5},${fy + 16} ${fx},${fy + 12} ${fx + 5},${fy + 16}`}
                fill={fc} opacity={0.9}/>
              <text x={fx} y={fy + 26} textAnchor="middle" fill={fc}
                fontSize={8} fontFamily="monospace">B{bi + 1}</text>
            </g>
          );
        })}
        {/* Flow labels */}
        <text x={x1 - 2} y={passYs[0] + 4} textAnchor="end"
          fill={tc} fontSize={9} fontFamily="monospace">IN→</text>
        <text x={x1 - 2} y={passYs[nPass - 1] + 4} textAnchor="end"
          fill={tc} fontSize={9} fontFamily="monospace">←OUT</text>
        {/* Dimension */}
        <line x1={x1} y1={H - 6} x2={x2} y2={H - 6} stroke={tc} strokeWidth={0.7}/>
        <text x={(x1 + x2) / 2} y={H - 1} textAnchor="middle"
          fill={tc} fontSize={9} fontFamily="monospace">L = {L.toFixed(2)} m</text>
        {/* Bend radius note */}
        <text x={x2 + r + 4} y={(passYs[0] + (passYs[1] ?? passYs[0])) / 2 + 3}
          fill={pc} fontSize={8} fontFamily="monospace">r=1.5D</text>
      </svg>
    </div>
  );
}

// ── Blower Pressure Gauge — vertical bar showing Available vs Required ──────
// Shows P_Blower (available from selected blower catalogue) vs
// system total raw pressure (sum of burner + piping + valves + chamber).
// The gap = safety margin. Engineer sees immediately if blower is oversized/tight.
function BlowerPressureGauge({ pAvailable, pRequired, pComponents }:
  { pAvailable: number; pRequired: number;
    pComponents: { burner: number; piping: number; valves: number; chamber: number } }) {
  if (!isFinite(pAvailable) || !isFinite(pRequired) || pAvailable <= 0) return null;

  const W = 260, H = 200, pL = 16, pR = 60, pT = 20, pB = 28;
  const cH = H - pT - pB;
  const maxV = Math.max(pAvailable, pRequired) * 1.25;

  // Y coordinate — 0 at bottom, maxV at top
  const toY = (v: number) => pT + cH - (v / maxV) * cH;
  const bW  = 40;

  // Stacked required bar segments
  const segs = [
    { v: Math.max(0, pComponents.burner),  col: '#1a6ab8', label: 'Burner' },
    { v: Math.max(0, pComponents.piping),  col: '#7a3a00', label: 'Piping' },
    { v: Math.max(0, pComponents.valves),  col: '#7a1aa0', label: 'Valves' },
    { v: Math.max(0, pComponents.chamber), col: '#b04000', label: 'Chamber' },
  ].filter(s => s.v > 0);
  const totalReq = segs.reduce((s, seg) => s + seg.v, 0);

  const margin = pAvailable - totalReq;
  const marginPct = (margin / Math.max(pAvailable, 0.001)) * 100;
  const safe = margin > 0;

  // Build stacked bar Y positions
  let stackY = toY(0);
  const stackSegs = segs.map(seg => {
    const segH = (seg.v / maxV) * cH;
    const y = stackY - segH;
    stackY = y;
    return { ...seg, y, h: segH };
  });

  // Y-axis ticks
  const ticks = 5;

  return (
    <div style={{ marginBottom:12 }}>
      <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:1,
        color:'var(--text-dim)', marginBottom:4 }}>
        Blower Pressure Balance ["w.c.]
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', maxWidth:280 }}>

        {/* Y-axis grid */}
        {Array.from({ length: ticks + 1 }, (_, i) => {
          const v = (maxV * i) / ticks;
          const y = toY(v);
          return (
            <g key={i}>
              <line x1={pL} y1={y} x2={W - pR + 4} y2={y}
                stroke="rgba(180,190,200,0.25)" strokeWidth={0.5} />
              <text x={pL - 2} y={y + 4} textAnchor="end" fontSize={8}
                fill="var(--text-dim)" fontFamily="monospace">{v.toFixed(1)}</text>
            </g>
          );
        })}

        {/* Available P bar (left) */}
        <rect x={pL + 4} y={toY(pAvailable)} width={bW}
          height={toY(0) - toY(pAvailable)}
          fill={safe ? 'rgba(14,122,62,0.6)' : 'rgba(192,40,40,0.6)'} rx={3} />
        <text x={pL + 4 + bW/2} y={toY(pAvailable) - 5} textAnchor="middle"
          fontSize={9} fill={safe ? 'var(--green)' : 'var(--red)'}
          fontFamily="monospace" fontWeight={700}>
          {pAvailable.toFixed(2)}
        </text>
        <text x={pL + 4 + bW/2} y={H - 6} textAnchor="middle"
          fontSize={8} fill={safe ? 'var(--green)' : 'var(--red)'} fontFamily="sans-serif">
          Available
        </text>

        {/* Required P bar — stacked segments (right) */}
        {stackSegs.map((seg, i) => (
          <g key={i}>
            <rect x={pL + bW + 20} y={seg.y} width={bW} height={seg.h}
              fill={seg.col} opacity={0.8} rx={i === 0 ? 3 : 0}
              style={{ borderBottom: i < stackSegs.length-1 ? '1px solid rgba(255,255,255,0.2)' : undefined }} />
            {seg.h > 12 && (
              <text x={pL + bW + 20 + bW/2} y={seg.y + seg.h/2 + 3}
                textAnchor="middle" fontSize={7} fill="white"
                fontFamily="monospace" fontWeight={600}>{seg.label}</text>
            )}
          </g>
        ))}
        <text x={pL + bW + 20 + bW/2} y={toY(totalReq) - 5} textAnchor="middle"
          fontSize={9} fill="var(--accent)" fontFamily="monospace" fontWeight={700}>
          {totalReq.toFixed(2)}
        </text>
        <text x={pL + bW + 20 + bW/2} y={H - 6} textAnchor="middle"
          fontSize={8} fill="var(--text-dim)" fontFamily="sans-serif">Required</text>

        {/* Safety margin bracket */}
        {safe && (
          <g>
            <line x1={pL + bW + 4} y1={toY(pAvailable)} x2={pL + bW + 4} y2={toY(totalReq)}
              stroke="var(--green)" strokeWidth={1.5} />
            <line x1={pL + bW + 1} y1={toY(pAvailable)} x2={pL + bW + 7} y2={toY(pAvailable)}
              stroke="var(--green)" strokeWidth={1.5} />
            <line x1={pL + bW + 1} y1={toY(totalReq)} x2={pL + bW + 7} y2={toY(totalReq)}
              stroke="var(--green)" strokeWidth={1.5} />
            <text x={pL + bW + 10} y={(toY(pAvailable) + toY(totalReq))/2 + 3}
              fontSize={8} fill="var(--green)" fontFamily="monospace" fontWeight={700}>
              +{marginPct.toFixed(0)}%
            </text>
          </g>
        )}
        {!safe && (
          <text x={pL + bW + 10} y={(toY(pAvailable) + toY(totalReq))/2 + 3}
            fontSize={8} fill="var(--red)" fontFamily="monospace" fontWeight={700}>
            DEFICIT
          </text>
        )}

        {/* Status badge */}
        <rect x={pL} y={pT - 18} width={W - pL - pR + 4} height={14}
          fill={safe ? 'rgba(14,122,62,0.12)' : 'rgba(192,40,40,0.12)'} rx={3} />
        <text x={(W - pR + pL + 4)/2 + pL/2} y={pT - 8} textAnchor="middle"
          fontSize={9} fill={safe ? 'var(--green)' : 'var(--red)'}
          fontFamily="monospace" fontWeight={700}>
          {safe ? `✔ ${marginPct.toFixed(1)}% safety margin` : `✘ BLOWER UNDERSIZED`}
        </text>
      </svg>

      {/* Numeric summary below */}
      <table style={{ width:'100%', fontSize:10, marginTop:4, borderCollapse:'collapse',
        fontFamily:'var(--mono)' }}>
        <tbody>
          <tr>
            <td style={{ color:'var(--text-dim)', paddingRight:8 }}>P_Blower available</td>
            <td style={{ color: safe ? 'var(--green)' : 'var(--red)', fontWeight:700, textAlign:'right' }}>
              {pAvailable.toFixed(3)}"w.c.
            </td>
            <td style={{ color:'var(--text-dim)', paddingLeft:8 }}>
              = {(pAvailable * 2.4908).toFixed(1)} mbar
            </td>
          </tr>
          <tr>
            <td style={{ color:'var(--text-dim)' }}>System total required</td>
            <td style={{ color:'var(--accent)', fontWeight:700, textAlign:'right' }}>
              {totalReq.toFixed(3)}"w.c.
            </td>
            <td style={{ color:'var(--text-dim)', paddingLeft:8 }}>
              = {(totalReq * 2.4908).toFixed(1)} mbar
            </td>
          </tr>
          <tr style={{ borderTop:'1px solid var(--border)' }}>
            <td style={{ color:'var(--text-dim)' }}>Margin (×1.10 factor incl.)</td>
            <td style={{ color: safe ? 'var(--green)' : 'var(--red)', fontWeight:700, textAlign:'right' }}>
              {margin >= 0 ? '+' : ''}{margin.toFixed(3)}"w.c.
            </td>
            <td style={{ color: safe ? 'var(--green)' : 'var(--red)', paddingLeft:8 }}>
              {safe ? '✔ OK' : '✘ DEFICIT'}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── Draft bar chart ──────────────────────────────────────────────────────────
function DraftBar({ available, required }: { available: number; required: number }) {
  if (!isFinite(available) || !isFinite(required) || available <= 0) return null;
  const max = Math.max(available, required) * 1.2;
  const W = 300, pL = 8, pR = 8;
  const sc = (v: number) => pL + (v / max) * (W - pL - pR);
  return (
    <svg viewBox={`0 0 ${W} 52`} style={{ width:'100%' }}>
      <rect x={pL} y={8}  width={sc(required)  - pL} height={12} fill="var(--red)"   opacity={0.6} rx={2}/>
      <text x={sc(required)  + 4} y={18}  fontSize={9} fill="var(--text-dim)" fontFamily="monospace">
        {required.toFixed(1)} Pa req
      </text>
      <rect x={pL} y={26} width={sc(available) - pL} height={12}
        fill={available >= required ? 'var(--green)' : 'var(--red)'} opacity={0.8} rx={2}/>
      <text x={sc(available) + 4} y={36} fontSize={9} fontFamily="monospace" fontWeight={700}
        fill={available >= required ? 'var(--green)' : 'var(--red)'}>
        {available.toFixed(1)} Pa avail
      </text>
    </svg>
  );
}

// ── Blower pressure chain SVG ────────────────────────────────────────────────
function PressureChainSVG({ pBurner, pPiping, pValves, pChamber, pBlower }: {
  pBurner: number; pPiping: number; pValves: number; pChamber: number; pBlower: number;
}) {
  const items = [
    { label: 'P_Burner\n(Tap A)', val: pBurner, col: '#1a6ab8' },
    { label: 'ΔP_Piping', val: pPiping, col: '#7a3a00' },
    { label: 'ΔP_Valves', val: pValves, col: '#7a1aa0' },
    { label: 'P_Chamber', val: pChamber, col: pChamber >= 0 ? '#b04000' : '#0e7a3e' },
  ];
  const W = 380, H = 80, pL = 8, bW = 60, gap = 12;
  const maxV = Math.max(pBlower, 1);
  const bH = (v: number) => Math.max(0, (Math.abs(v) / maxV) * 50);

  return (
    <div>
      <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:1,
        color:'var(--text-dim)', marginBottom:4 }}>Pressure Chain ["w.c.]</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%' }}>
        {items.map((it, i) => {
          const x = pL + i * (bW + gap);
          const h = bH(it.val);
          const y = 48 - (it.val >= 0 ? h : 0);
          return (
            <g key={i}>
              <rect x={x} y={y} width={bW} height={h || 2}
                fill={it.col} opacity={0.8} rx={2}/>
              <text x={x + bW / 2} y={it.val >= 0 ? y - 3 : y + h + 10}
                textAnchor="middle" fontSize={8} fill={it.col}
                fontFamily="monospace" fontWeight={700}>
                {it.val >= 0 ? '+' : ''}{it.val.toFixed(2)}
              </text>
              <text x={x + bW / 2} y={H - 2} textAnchor="middle"
                fontSize={7} fill="var(--text-dim)" fontFamily="sans-serif">
                {it.label.split('\n')[0]}
              </text>
            </g>
          );
        })}
        {/* Total */}
        <g>
          <rect x={pL + 4 * (bW + gap)} y={48 - bH(pBlower)} width={bW} height={bH(pBlower)}
            fill="var(--accent)" opacity={1} rx={2}/>
          <rect x={pL + 4 * (bW + gap) - 1} y={48 - bH(pBlower) - 1} width={bW + 2} height={bH(pBlower) + 2}
            fill="none" stroke="var(--accent)" strokeWidth={1.5} rx={3}/>
          <text x={pL + 4 * (bW + gap) + bW / 2} y={48 - bH(pBlower) - 4}
            textAnchor="middle" fontSize={8} fill="var(--accent)"
            fontFamily="monospace" fontWeight={700}>{pBlower.toFixed(2)}</text>
          <text x={pL + 4 * (bW + gap) + bW / 2} y={H - 2}
            textAnchor="middle" fontSize={7} fill="var(--accent)" fontFamily="sans-serif">
            P_Blower ★
          </text>
        </g>
        {/* Zero line */}
        <line x1={pL} y1={48} x2={W - pL} y2={48}
          stroke="rgba(180,190,200,0.3)" strokeWidth={0.5}/>
      </svg>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════════════════
export default function Stage2Firetube({ s1Results, onComplete }: Props) {
  const [activeTab, setActiveTab] = useState<'firetube' | 'blower'>('firetube');

  // ── Firetube form ────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    Q_net: s1Results?.Q_final.toFixed(1) ?? '400',
    nBurners: '2', draftType: 'natural',
    efficiency: '80', burnerFactor: '1.15',
    nPass: '2', tubeLen: '4.0', pipeDN: 400,
    Tbath: '62', stackAlt: '0', stackTamb: '15',
    stackTflue: '450', excessAir: '22.5',
    stackHeight: '4.0', stackDia: '355',
  });
  const [ftResults, setFtResults] = useState<any>(null);
  const [ftValidation, setFtValidation] = useState<any>(null);
  const [ftLoading, setFtLoading] = useState(false);
  const [ftError, setFtError] = useState('');

  // ── Blower form ──────────────────────────────────────────────────────────
  const [bForm, setBForm] = useState({
    burnerModel: 'auto' as BurnerModel | 'auto',
    fuel: 'natural_gas' as FuelType,
    excessAir: '15',
    pipingDP: '1.5', valveDP: '0.8', chamberP: '0',
    altitude: '0', preheatTemp: '',
    ambientTemp: '21',
    controlMethod: 'proportional_on_ratio' as ControlMethod,
    efficiency: '60',
    minFire_kW: '',
  });
  const [blResult, setBlResult] = useState<ReturnType<typeof calcForcedDraftBlower> | null>(null);

  // ── Auto-sync Q from Stage 1 ─────────────────────────────────────────────
  useEffect(() => {
    if (s1Results?.Q_final) {
      setForm(f => ({ ...f, Q_net: s1Results.Q_final.toFixed(1) }));
    }
  }, [s1Results]);

  const setF = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const val = e.target.value;
    setForm(f => ({ ...f, [k]: val }));
    // Auto-switch to blower tab when forced draft selected
    if (k === 'draftType' && val === 'forced') setActiveTab('blower');
    if (k === 'draftType' && val === 'natural') setActiveTab('firetube');
  };
  const setBF = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setBForm(f => ({ ...f, [k]: e.target.value }));

  // ── Firetube auto-calculate (debounced 300ms) ────────────────────────────
  const calcFT = useCallback(async () => {
    const Q = parseFloat(form.Q_net);
    if (!Q || Q <= 0) return;
    setFtLoading(true); setFtError('');
    try {
      const inputs: Stage2Inputs = {
        Q_net_kW:         Q,
        burnerConfig:     form.nBurners === '2' ? '2x75' : '1x100',
        efficiency_pct:   parseFloat(form.efficiency),
        burnerRatingFactor: parseFloat(form.burnerFactor),
        nPass:            parseInt(form.nPass),
        tubeLengthM:      parseFloat(form.tubeLen),
        pipeDN:           form.pipeDN,
        T_bath_C:         parseFloat(form.Tbath),
        T_amb_C:          parseFloat(form.stackTamb),
        stackAltM:        parseFloat(form.stackAlt),
        T_flue_C:         parseFloat(form.stackTflue),
        excessAir_pct:    parseFloat(form.excessAir),
        stackHeightM:     parseFloat(form.stackHeight),
        stackDiaMm:       parseFloat(form.stackDia),
      };
      const res = await fetch('/api/calculations/stage2', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(inputs),
      });
      const data = await res.json();
      if (data.success) { setFtResults(data.results); setFtValidation(data.validation); onComplete?.(data.results); }
      else setFtError(data.error ?? 'Calculation failed');
    } catch (e) { setFtError(String(e)); }
    setFtLoading(false);
  }, [form, onComplete]);

  useEffect(() => {
    const t = setTimeout(calcFT, 300);
    return () => clearTimeout(t);
  }, [calcFT]);

  // ── Blower auto-calculate (instant — pure math, no API) ─────────────────
  useEffect(() => {
    const Q_kW = ftResults?.Q_gross_kW ?? parseFloat(form.Q_net);
    if (!Q_kW || Q_kW <= 0) return;

    // Auto-select burner model if 'auto'
    const requiredBtuH = kWToBtuH(Q_kW);
    const resolvedModel: BurnerModel = bForm.burnerModel === 'auto'
      ? (selectBurnerModel(requiredBtuH) ?? 'TJ1500')
      : bForm.burnerModel;

    const result = calcForcedDraftBlower({
      burnerModel:                resolvedModel,
      fuel:                       bForm.fuel,
      Q_gross_kW:                 Q_kW,
      excessAir_pct:              parseFloat(bForm.excessAir) || 15,
      pipingPressureLoss_inWC:    parseFloat(bForm.pipingDP) || 0,
      valvePressureLoss_inWC:     parseFloat(bForm.valveDP) || 0,
      chamberStaticPressure_inWC: parseFloat(bForm.chamberP) || 0,
      altitude_m:                 parseFloat(bForm.altitude) || 0,
      preheatAirTemp_C:           bForm.preheatTemp ? parseFloat(bForm.preheatTemp) : null,
      ambientAirTemp_C:           parseFloat(bForm.ambientTemp) || 21,
      controlMethod:              bForm.controlMethod,
      efficiency_pct:             parseFloat(bForm.efficiency) || 60,
    });
    setBlResult(result);
  }, [bForm, ftResults, form.Q_net]);

  const f1 = (v?: number) => v !== undefined && isFinite(v) ? v.toFixed(1) : '—';
  const f2 = (v?: number) => v !== undefined && isFinite(v) ? v.toFixed(2) : '—';
  const selectedPipe = FIRE_PIPES.find(p => p.dn === form.pipeDN) ?? FIRE_PIPES[3];

  // Turndown check for blower tab
  const td = blResult && bForm.minFire_kW
    ? checkTurndownFeasibility(
        blResult.burnerModel,
        kWToBtuH(parseFloat(bForm.minFire_kW) || 0),
        kWToBtuH(blResult.grossLoad_kW)
      )
    : null;

  // Flame length check vs firetube ID
  const flameLen = blResult
    ? getFlameLengthRange(blResult.burnerModel, bForm.fuel)
    : null;
  const fireTubeID = selectedPipe.od - 2 * selectedPipe.wt;
  const flameClearanceOK = flameLen ? flameLen.maxMm < fireTubeID * 0.9 : true;

  const allFtValidation = [
    ...(ftValidation?.heatFlux?.messages ?? []),
    ...(ftValidation?.stack?.messages ?? []),
  ];

  return (
    <div>
      {/* Sub-tab bar */}
      <div style={{ display:'flex', background:'var(--panel)', borderBottom:'1px solid var(--border)',
        margin:'-20px -24px 16px', overflowX:'auto' }}>
        <button className={`tab-btn${activeTab === 'firetube' ? ' active' : ''}`}
          onClick={() => setActiveTab('firetube')}>
          ① Firetube & Stack
          {ftLoading && <span style={{ marginLeft:6, fontSize:9, color:'var(--text-dim)' }}>⏳</span>}
        </button>
        <button
          className={`tab-btn${activeTab === 'blower' ? ' active' : ''}`}
          onClick={() => form.draftType === 'forced' ? setActiveTab('blower') : undefined}
          style={{ opacity: form.draftType === 'forced' ? 1 : 0.45, cursor: form.draftType === 'forced' ? 'pointer' : 'not-allowed' }}
          title={form.draftType !== 'forced' ? 'Select "Forced Draft" in Tab ① to enable blower sizing' : undefined}>
          ② Forced Draft Blower & Burner
          {form.draftType !== 'forced' && <span style={{ fontSize:9, marginLeft:4, color:'var(--text-dim)' }}>🔒</span>}
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          TAB ①: FIRETUBE & STACK
         ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'firetube' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          {/* LEFT */}
          <div>
            {s1Results && (
              <div className="alert alert-info" style={{ marginBottom:12 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:12 }}>
                    Stage 1 Q = <strong>{s1Results.Q_final.toFixed(1)} kW</strong>
                    {' '}(auto-populated). Adjust as needed.
                  </span>
                </div>
              </div>
            )}

            <div className="panel" style={{ marginBottom:12 }}>
              <div className="panel-header"><div className="panel-title">Thermal Duty & Burner</div></div>
              <div className="panel-body">
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div>
                    <label className="field-label">Net Process Duty Q</label>
                    <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                      <input type="number" value={form.Q_net} onChange={setF('Q_net')} />
                      <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text-dim)' }}>kW</span>
                    </div>
                  </div>
                  <div>
                    <label className="field-label">No. of Burners</label>
                    <select value={form.nBurners} onChange={setF('nBurners')}>
                      <option value="1">1 Burner</option>
                      <option value="2">2 Burners</option>
                    </select>
                  </div>
                  <div>
                    <label className="field-label">Thermal Efficiency η</label>
                    <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                      <input type="number" value={form.efficiency} step="1" min="50" max="95"
                        onChange={setF('efficiency')} />
                      <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text-dim)' }}>%</span>
                    </div>
                  </div>
                  <div>
                    <label className="field-label">AS 3814 Rating Factor</label>
                    <input type="number" value={form.burnerFactor} step="0.05" min="1.0" max="1.5"
                      onChange={setF('burnerFactor')} />
                  </div>
                  <div>
                    <label className="field-label">Draft Type</label>
                    <select value={form.draftType} onChange={setF('draftType')}>
                      <option value="natural">Natural Stack</option>
                      <option value="forced">Forced Draft</option>
                    </select>
                  </div>
                  <div>
                    <label className="field-label">Bath Temperature</label>
                    <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                      <input type="number" value={form.Tbath} step="1" onChange={setF('Tbath')} />
                      <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text-dim)' }}>°C</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="panel" style={{ marginBottom:12 }}>
              <div className="panel-header"><div className="panel-title">Firetube Geometry</div></div>
              <div className="panel-body">
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                  <div>
                    <label className="field-label">Tube Passes</label>
                    <select value={form.nPass} onChange={setF('nPass')}>
                      <option value="2">2-Pass (U-Tube)</option>
                      <option value="4">4-Pass</option>
                    </select>
                  </div>
                  <div>
                    <label className="field-label">Leg Length L</label>
                    <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                      <input type="number" value={form.tubeLen} step="0.25" min="1" max="12"
                        onChange={setF('tubeLen')} />
                      <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text-dim)' }}>m</span>
                    </div>
                  </div>
                </div>

                <label className="field-label" style={{ marginBottom:6 }}>
                  Combustion Tube DN (Sch 10/20)
                </label>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(100px,1fr))', gap:6 }}>
                  {FIRE_PIPES.map(p => (
                    <button key={p.dn}
                      onClick={() => setForm(f => ({ ...f, pipeDN: p.dn }))}
                      style={{
                        background: form.pipeDN === p.dn ? 'rgba(176,96,0,0.12)' : 'var(--panel2)',
                        border:`1px solid ${form.pipeDN === p.dn ? 'var(--accent)' : 'var(--border)'}`,
                        borderRadius:4, padding:'6px', cursor:'pointer', textAlign:'center',
                      }}>
                      <div style={{ fontWeight:'bold', fontSize:11 }}>DN{p.dn}</div>
                      <div style={{ fontFamily:'var(--mono)', fontSize:9, color:'var(--text-dim)' }}>
                        {p.od} mm OD
                      </div>
                      <div style={{ fontFamily:'var(--mono)', fontSize:9, color:'var(--accent)' }}>
                        t={p.wt}mm
                      </div>
                    </button>
                  ))}
                </div>

                {/* Live sketch */}
                <div style={{ marginTop:12 }}>
                  <FiretubeSVG nPass={parseInt(form.nPass)} L={parseFloat(form.tubeLen) || 4}
                    od_mm={selectedPipe.od} nBurners={parseInt(form.nBurners)} />
                </div>

                <div style={{ marginTop:8, background:'var(--panel2)', borderRadius:4,
                  padding:'8px 10px', fontSize:11, fontFamily:'var(--mono)',
                  display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
                  <span style={{ color:'var(--text-dim)' }}>OD:</span>
                  <span style={{ color:'var(--accent)' }}>{selectedPipe.od} mm</span>
                  <span style={{ color:'var(--text-dim)' }}>Wall:</span>
                  <span>{selectedPipe.wt} mm ({selectedPipe.label.split(' ').slice(-2).join(' ')})</span>
                  <span style={{ color:'var(--text-dim)' }}>ID:</span>
                  <span style={{ color:'var(--green)' }}>{(selectedPipe.od - 2 * selectedPipe.wt).toFixed(1)} mm</span>
                  <span style={{ color:'var(--text-dim)' }}>Bend r:</span>
                  <span>{(selectedPipe.od * 1.5).toFixed(0)} mm</span>
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header"><div className="panel-title">Stack (AS 3814 / API 12K)</div></div>
              <div className="panel-body">
                {form.draftType === 'forced' && (
                <div className="alert alert-info" style={{ marginBottom:10 }}>
                  ℹ Forced Draft selected — natural stack sizing not required.
                  Set altitude and ambient temp for blower calculations in Tab ②.
                </div>
              )}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  {[
                    { label:'Site Altitude',      k:'stackAlt',    unit:'m ASL' },
                    { label:'Ambient Temp',        k:'stackTamb',   unit:'°C' },
                    { label:'Flue Gas Temp',       k:'stackTflue',  unit:'°C' },
                    { label:'Excess Air',          k:'excessAir',   unit:'%' },
                    ...(form.draftType === 'natural' ? [
                      { label:'Stack Height', k:'stackHeight', unit:'m' },
                      { label:'Stack Dia (internal)', k:'stackDia', unit:'mm' },
                    ] : []),
                  ].map(fi => (
                    <div key={fi.k}>
                      <label className="field-label">{fi.label}</label>
                      <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                        <input type="number"
                          value={form[fi.k as keyof typeof form] as string}
                          onChange={setF(fi.k)} />
                        <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text-dim)' }}>
                          {fi.unit}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT — results */}
          <div>
            {ftError && (
              <div className="alert alert-fail" style={{ marginBottom:12 }}>❌ {ftError}</div>
            )}
            {allFtValidation.length > 0 && (
              <ValidationPanel messages={allFtValidation} title="AS 3814 / API 12K Checks" />
            )}

            {ftLoading && !ftResults && (
              <div style={{ color:'var(--text-dim)', padding:20, textAlign:'center' }}>
                ⏳ Calculating…
              </div>
            )}

            {ftResults && (
              <>
                <div className="panel" style={{ marginBottom:12 }}>
                  <div className="panel-header">
                    <div className="panel-title">Thermal Duty</div>
                    {ftLoading && <span style={{ fontSize:9, color:'var(--text-dim)', marginLeft:'auto' }}>
                      updating…
                    </span>}
                  </div>
                  <div className="panel-body">
                    <ResultGrid cols={3}>
                      <ResultCard label="Q Net" value={ftResults.Q_net_kW} unit="kW" decimals={1}
                        variant="highlight" />
                      <ResultCard label="Q Gross" value={ftResults.Q_gross_kW} unit="kW" decimals={1} />
                      <ResultCard label="Q Rated" value={ftResults.Q_burner_rated_kW} unit="kW" decimals={1} />
                    </ResultGrid>
                    <div style={{ marginTop:8 }}>
                      <ResultGrid cols={2}>
                        <ResultCard label="No. Burners" value={ftResults.nBurners} />
                        <ResultCard label="Q / Burner" value={ftResults.Q_per_burner_kW} unit="kW" decimals={1} />
                      </ResultGrid>
                    </div>
                  </div>
                </div>

                <div className="panel" style={{ marginBottom:12 }}>
                  <div className="panel-header"><div className="panel-title">Vessel Envelope</div></div>
                  <div className="panel-body">
                    <ResultGrid cols={2}>
                      <ResultCard label="Shell OD" value={ftResults.OD_shell_mm} unit="mm" decimals={0}
                        variant="highlight" />
                      <ResultCard label="Shell Length" value={ftResults.L_shell_mm} unit="mm" decimals={0} />
                      <ResultCard label="Bath Volume" value={ftResults.bath_volume_L} unit="L" decimals={0} />
                      <ResultCard label="Firetube Area" value={ftResults.A_ft} unit="m²" decimals={2} />
                    </ResultGrid>
                  </div>
                </div>

                <div className="panel" style={{ marginBottom:12,
                  borderColor: ftResults.fluxOK ? undefined : 'var(--red)' }}>
                  <div className="panel-header">
                    <div className="panel-title"
                      style={{ color: ftResults.fluxOK ? 'var(--green)' : 'var(--red)' }}>
                      Heat Flux — API 12K §4.3
                    </div>
                  </div>
                  <div className="panel-body">
                    <ResultGrid cols={2}>
                      <ResultCard label="Heat Flux" value={ftResults.heatFlux_kWm2}
                        unit="kW/m²" decimals={1} variant={ftResults.fluxOK ? 'green' : 'red'} />
                      <ResultCard label="Heat Flux (Imp.)" value={ftResults.heatFlux_BTUhrft2}
                        unit="BTU/hr·ft²" decimals={0} variant={ftResults.fluxOK ? 'green' : 'red'} />
                    </ResultGrid>
                    <div className={`alert ${ftResults.fluxOK ? 'alert-ok' : 'alert-fail'}`}
                      style={{ marginTop:8 }}>
                      {ftResults.fluxOK
                        ? `✔ API 12K: ${ftResults.heatFlux_kWm2?.toFixed(1)} kW/m² ≤ 37.9 kW/m²`
                        : `✘ EXCEEDS API 12K limit: ${ftResults.heatFlux_kWm2?.toFixed(1)} kW/m². Increase DN or length.`}
                    </div>
                    {ftResults.volumetricHeatReleaseOK !== undefined && (
                      <div className={`alert ${ftResults.volumetricHeatReleaseOK ? 'alert-ok' : 'alert-warn'}`}
                        style={{ marginTop:6 }}>
                        {ftResults.volumetricHeatReleaseOK
                          ? '✔ AS 3814: Volumetric heat release OK'
                          : '⚠ AS 3814: Volumetric heat release > 350 kW/m³ — enlarge flame tube.'}
                      </div>
                    )}
                    {ftResults.linearHeatReleaseOK !== undefined && (
                      <div className={`alert ${ftResults.linearHeatReleaseOK ? 'alert-ok' : 'alert-warn'}`}
                        style={{ marginTop:6 }}>
                        {ftResults.linearHeatReleaseOK
                          ? '✔ AS 1228: Linear heat intensity ≤ 150 kW/m'
                          : '⚠ AS 1228: Linear heat intensity > 150 kW/m — risk of film boiling.'}
                      </div>
                    )}
                  </div>
                </div>

                <div className="panel">
                  <div className="panel-header"><div className="panel-title">Stack Draft</div></div>
                  <div className="panel-body">
                    <ResultGrid cols={2}>
                      <ResultCard label="Draft Available" value={ftResults.P_available_Pa}
                        unit="Pa" decimals={1} variant={ftResults.draftOK ? 'green' : 'red'} />
                      <ResultCard label="Friction Required" value={ftResults.P_required_Pa}
                        unit="Pa" decimals={1} />
                      <ResultCard label="Stack Velocity" value={ftResults.stackVelocity_ms}
                        unit="m/s" decimals={1} />
                      <ResultCard label="Fuel Demand" value={ftResults.m_fuel_kghr}
                        unit="kg/hr" decimals={1} variant="highlight" />
                    </ResultGrid>
                    <DraftBar available={ftResults.P_available_Pa}
                      required={ftResults.P_required_Pa} />
                    <div className={`alert ${ftResults.draftOK ? 'alert-ok' : 'alert-fail'}`}
                      style={{ marginTop:8 }}>
                      {ftResults.draftOK
                        ? '✔ Natural draft adequate.'
                        : '✘ Insufficient draft. Increase stack height or switch to forced draft.'}
                    </div>
                    {ftResults.V_fuel_Nm3hr !== undefined && (
                      <table className="res-table" style={{ marginTop:8, fontSize:11 }}>
                        <tbody>
                          <tr><td>Fuel volume</td>
                            <td className="val">{f1(ftResults.V_fuel_Nm3hr)}</td><td>Nm³/hr</td></tr>
                          <tr><td>Est. stack T at base</td>
                            <td className="val">{ftResults.T_stack_est ?? '—'}</td><td>°C</td></tr>
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB ②: FORCED DRAFT BLOWER & BURNER
         ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'blower' && form.draftType !== 'forced' && (
        <div className="panel">
          <div className="panel-body" style={{ padding:40, textAlign:'center' }}>
            <div style={{ fontSize:32, marginBottom:12 }}>🔒</div>
            <div style={{ fontSize:14, fontWeight:700, color:'var(--text-dim)', marginBottom:8 }}>
              Forced Draft Blower Sizing
            </div>
            <div style={{ fontSize:12, color:'var(--text-dim)' }}>
              Switch Draft Type to <strong>Forced Draft</strong> in Tab ① to enable blower and burner sizing.
            </div>
          </div>
        </div>
      )}
      {activeTab === 'blower' && form.draftType === 'forced' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          {/* LEFT — inputs */}
          <div>
            <div className="panel" style={{ marginBottom:12 }}>
              <div className="panel-header"><div className="panel-title">Burner Selection</div></div>
              <div className="panel-body">
                <div className="note-box" style={{ marginBottom:10, fontSize:11 }}>
                  Q_gross from Firetube tab = <strong>
                    {ftResults?.Q_gross_kW?.toFixed(1) ?? form.Q_net} kW
                  </strong>. Blower sized from this value automatically.
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div>
                    <label className="field-label">Burner Model</label>
                    <select value={bForm.burnerModel} onChange={setBF('burnerModel')}>
                      <option value="auto">Auto-select (smallest fit)</option>
                      <option value="TJ0750">TJ0750 — 7.5M Btu/h (1,983 kW)</option>
                      <option value="TJ1000">TJ1000 — 10M Btu/h (2,666 kW)</option>
                      <option value="TJ1500">TJ1500 — 15M Btu/h (4,000 kW)</option>
                    </select>
                  </div>
                  <div>
                    <label className="field-label">Fuel Type</label>
                    <select value={bForm.fuel} onChange={setBF('fuel')}>
                      <option value="natural_gas">Natural Gas</option>
                      <option value="propane">Propane</option>
                      <option value="butane">Butane</option>
                    </select>
                  </div>
                  <div>
                    <label className="field-label">Control Method</label>
                    <select value={bForm.controlMethod} onChange={setBF('controlMethod')}>
                      <option value="proportional_on_ratio">Proportional On-Ratio (Recommended)</option>
                      <option value="fixed_air_modulating_gas">Fixed Air / Modulating Gas</option>
                    </select>
                  </div>
                  <div>
                    <label className="field-label">Min Fire (turndown check)</label>
                    <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                      <input type="number" value={bForm.minFire_kW} placeholder="Optional"
                        onChange={setBF('minFire_kW')} />
                      <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text-dim)' }}>kW</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="panel" style={{ marginBottom:12 }}>
              <div className="panel-header"><div className="panel-title">Air System Pressure Drops</div></div>
              <div className="panel-body">
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  {[
                    { k:'pipingDP',   label:'Piping ΔP',        unit:'"w.c.' },
                    { k:'valveDP',    label:'Valve Train ΔP',    unit:'"w.c.' },
                    { k:'chamberP',   label:'Chamber Static P (±)', unit:'"w.c.' },
                    { k:'excessAir',  label:'Excess Air',        unit:'%' },
                    { k:'altitude',   label:'Site Altitude',     unit:'m ASL' },
                    { k:'ambientTemp',label:'Ambient Temp',      unit:'°C' },
                    { k:'preheatTemp',label:'Preheat Air Temp',  unit:'°C' },
                    { k:'efficiency', label:'Blower Efficiency', unit:'%' },
                  ].map(fi => (
                    <div key={fi.k}>
                      <label className="field-label">{fi.label}</label>
                      <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                        <input type="number" value={bForm[fi.k as keyof typeof bForm] as string}
                          placeholder={fi.k === 'preheatTemp' ? 'None' : undefined}
                          onChange={setBF(fi.k)} />
                        <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text-dim)' }}>
                          {fi.unit}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="note-box" style={{ marginTop:10, fontSize:10 }}>
                  +ve Chamber P = pressurised (adds to blower duty).
                  −ve = negative draft (reduces duty). Zero = atmospheric.
                  Preheat temp blank = ambient air.
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT — blower results (auto-computed, no button) */}
          <div>
            {blResult && (
              <>
                {/* Errors / warnings */}
                {blResult.errors.length > 0 && (
                  <div className="panel" style={{ marginBottom:12, borderColor:'var(--red)' }}>
                    <div className="panel-header">
                      <div className="panel-title" style={{ color:'var(--red)' }}>Errors</div>
                    </div>
                    <div className="panel-body">
                      {blResult.errors.map((e, i) => (
                        <div key={i} className="alert alert-fail" style={{ marginBottom:6 }}>✘ {e}</div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Burner spec card */}
                <div className="panel" style={{ marginBottom:12 }}>
                  <div className="panel-header">
                    <div className="panel-title">
                      Burner — {blResult.burnerModel}
                      <span style={{ marginLeft:8, fontSize:10, color:'var(--text-dim)', fontWeight:400 }}>
                        {BURNER_SPECS[blResult.burnerModel].combustion.flameExitVelocity.mPerSec} m/s exit velocity
                      </span>
                    </div>
                  </div>
                  <div className="panel-body">
                    <ResultGrid cols={2}>
                      <ResultCard label="Max Input" value={BURNER_SPECS[blResult.burnerModel].maxInput.kW}
                        unit="kW" decimals={0} />
                      <ResultCard label="Design Load"
                        value={blResult.grossLoad_kW} unit="kW" decimals={1} variant="highlight" />
                      <ResultCard label="Min Proportional"
                        value={BURNER_SPECS[blResult.burnerModel].minProportionalInput.kW}
                        unit="kW" decimals={0} />
                      <ResultCard label="Min Fixed-Air"
                        value={BURNER_SPECS[blResult.burnerModel].minFixedAirInput.kW}
                        unit="kW" decimals={0} />
                    </ResultGrid>

                    {/* Turndown */}
                    {td && (
                      <div className={`alert ${td.feasible ? 'alert-ok' : 'alert-fail'}`}
                        style={{ marginTop:8 }}>
                        {td.feasible
                          ? `✔ Turndown feasible — ${td.mode} control mode. Min achievable: ${(td.achievableMin_BtuH / 3412.142).toFixed(0)} kW`
                          : `✘ Turndown NOT feasible at ${bForm.minFire_kW} kW. Burner minimum: ${(td.achievableMin_BtuH / 3412.142).toFixed(0)} kW`}
                      </div>
                    )}

                    {/* Flame length vs firetube */}
                    {flameLen && (
                      <div className={`alert ${flameClearanceOK ? 'alert-ok' : 'alert-warn'}`}
                        style={{ marginTop:6 }}>
                        {flameClearanceOK
                          ? `✔ Flame length ${flameLen.maxMm} mm fits within firetube ID ${fireTubeID.toFixed(0)} mm (margin: ${(fireTubeID - flameLen.maxMm).toFixed(0)} mm)`
                          : `⚠ Flame length ${flameLen.maxMm} mm may approach firetube ID ${fireTubeID.toFixed(0)} mm. Verify clearance.`}
                      </div>
                    )}

                    <table className="res-table" style={{ marginTop:8, fontSize:11 }}>
                      <tbody>
                        <tr><td>Gas connection</td>
                          <td className="val">{BURNER_SPECS[blResult.burnerModel].dimensions.gasConnectionSize}</td></tr>
                        <tr><td>Air connection</td>
                          <td className="val">{BURNER_SPECS[blResult.burnerModel].dimensions.airConnectionSize}</td></tr>
                        <tr><td>Nozzle Ø</td>
                          <td className="val">{BURNER_SPECS[blResult.burnerModel].nozzleDiameter.mm} mm
                            ({BURNER_SPECS[blResult.burnerModel].nozzleDiameter.in}")</td></tr>
                        <tr><td>Mass</td>
                          <td className="val">{BURNER_SPECS[blResult.burnerModel].dimensions.mass.kg} kg</td></tr>
                        <tr><td>Gas Tap B pressure</td>
                          <td className="val">
                            {BURNER_SPECS[blResult.burnerModel].combustion.gasPressureTapB.inWC}" w.c.
                            ({BURNER_SPECS[blResult.burnerModel].combustion.gasPressureTapB.mbar} mbar)
                          </td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Blower sizing */}
                {blResult.errors.length === 0 && (
                  <>
                    <div className="panel" style={{ marginBottom:12 }}>
                      <div className="panel-header"><div className="panel-title">Air Flow — Blower Duty</div></div>
                      <div className="panel-body">
                        <ResultGrid cols={2}>
                          <ResultCard label="Gas Flow" value={blResult.gasFlow_scfh}
                            unit="scfh" decimals={0} />
                          <ResultCard label="Air Stoich" value={blResult.airFlowStoich_scfh}
                            unit="scfh" decimals={0} />
                          <ResultCard label="Air Design (incl EA)" value={blResult.airFlowDesign_scfh}
                            unit="scfh" decimals={0} />
                          <ResultCard label="Air Blower (×1.10)" value={blResult.airFlowBlower_scfh}
                            unit="scfh" decimals={0} variant="highlight" />
                        </ResultGrid>
                        <table className="res-table" style={{ marginTop:8, fontSize:11 }}>
                          <tbody>
                            <tr><td>Air blower (Nm³/hr)</td>
                              <td className="val">{scfhToNm3h(blResult.airFlowBlower_scfh).toFixed(1)}</td>
                              <td>Nm³/hr</td></tr>
                            <tr><td>Air catalogue (altitude adj.)</td>
                              <td className="val">{blResult.airFlowCatalogue_scfh.toFixed(0)}</td>
                              <td>scfh (δ={blResult.altitudeCorrectionFactor.toFixed(4)})</td></tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="panel" style={{ marginBottom:12 }}>
                      <div className="panel-header"><div className="panel-title">Pressure Chain & Motor</div></div>
                      <div className="panel-body">
                        <PressureChainSVG
                          pBurner={blResult.pBurner_inWC}
                          pPiping={blResult.pPiping_inWC}
                          pValves={blResult.pValves_inWC}
                          pChamber={blResult.pChamber_inWC}
                          pBlower={blResult.pBlower_inWC}
                        />
                        <div style={{ marginTop:10 }}><ResultGrid cols={2}>
                          <ResultCard label="P Tap A (Burner)" value={blResult.pBurner_inWC}
                            unit={'"w.c.'} decimals={2} />
                          <ResultCard label="P_Blower (×1.10)" value={blResult.pBlower_inWC}
                            unit={'"w.c.'} decimals={2} variant="highlight" />
                          <ResultCard label="P_Blower" value={inWCToMbar(blResult.pBlower_inWC)}
                            unit="mbar" decimals={1} />
                          <ResultCard label="Estimated BHP" value={blResult.estimatedBHP}
                            unit="BHP" decimals={2} />
                        </ResultGrid></div>
                        <div style={{ marginTop:10, padding:'12px', background:'rgba(176,96,0,0.08)',
                          border:'2px solid var(--accent)', borderRadius:6, textAlign:'center' }}>
                          <div style={{ fontSize:10, textTransform:'uppercase', letterSpacing:1,
                            color:'var(--text-dim)', marginBottom:4 }}>Recommended Motor Frame</div>
                          <div style={{ fontSize:28, fontWeight:900, fontFamily:'var(--mono)',
                            color:'var(--accent)' }}>
                            {blResult.recommendedMotor_kW} kW
                          </div>
                        </div>

                        {/* Blower pressure gauge */}
                        <div style={{ marginTop:14 }}>
                          <BlowerPressureGauge
                            pAvailable={blResult.pBlower_inWC}
                            pRequired={blResult.pTotalRaw_inWC}
                            pComponents={{
                              burner:  blResult.pBurner_inWC,
                              piping:  blResult.pPiping_inWC,
                              valves:  blResult.pValves_inWC,
                              chamber: Math.max(0, blResult.pChamber_inWC),
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Warnings / alerts */}
                    {(blResult.warnings.length > 0 || blResult.alerts.length > 0) && (
                      <div className="panel">
                        <div className="panel-header"><div className="panel-title">Notices</div></div>
                        <div className="panel-body">
                          {blResult.warnings.map((w, i) => (
                            <div key={i} className="alert alert-warn" style={{ marginBottom:6 }}>
                              ⚠ {w}
                            </div>
                          ))}
                          {blResult.alerts.map((a, i) => (
                            <div key={i} className="alert alert-info" style={{ marginBottom:6 }}>
                              ℹ {a}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {!blResult && (
              <div className="panel">
                <div className="panel-body" style={{ color:'var(--text-dim)', padding:20 }}>
                  Set Q_net in the Firetube tab and configure air system parameters.
                  Blower sizing updates automatically.
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
