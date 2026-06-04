'use client';
// src/components/modules/Stage3ProcessCoil.tsx
// Stage 3 — Process Coil Thermal Sizing & ASME B31.3 Compliance (v4 Production Ready)
// Fully optimized for light-wall pipelines with dynamic fluid kinetic monitors

import { useState } from 'react';
import ValidationPanel from '@/components/ui/ValidationPanel';
import { ResultCard, ResultGrid } from '@/components/ui/ResultCard';
import type { Stage1Results } from '@/lib/calculations/thermodynamics';

// ASME B31.3 Schedule standard carbon steel dimensions map
const COIL_PIPE_TABLE = [
  { nps: '2"',  od: 60.32,  sch40_wt: 3.91,  sch80_wt: 5.54,  label: 'DN50 (2")' },
  { nps: '3"',  od: 88.90,  sch40_wt: 5.49,  sch80_wt: 7.62,  label: 'DN80 (3")' },
  { nps: '4"',  od: 114.30, sch40_wt: 6.02,  sch80_wt: 8.56,  label: 'DN100 (4")' },
  { nps: '6"',  od: 168.28, sch40_wt: 7.11,  sch80_wt: 10.97, label: 'DN150 (6")' },
  { nps: '8"',  od: 219.08, sch40_wt: 8.18,  sch80_wt: 12.70, label: 'DN200 (8")' },
];

interface Props {
  s1Results?: Stage1Results;
  s2Results?: any;
  onComplete?: (results: any) => void;
}

const U_METHODS = [
  { v: 'natco_lo',  label: 'NATCO Low Baseline — 250 W/(m²·K)' },
  { v: 'natco_hi',  label: 'NATCO High Optimization — 400 W/(m²·K) [Rec]' },
  { v: 'gpsa_typ',  label: 'GPSA Standard Sweet — 350 W/(m²·K)' },
  { v: 'cfer_cold', label: 'C-FER High Viscosity Cold — 280 W/(m²·K)' },
];

// SVG structural schematic displaying LMTD fluid trends
function ThermalProfileChart({ tIn, tOut, tBath }: { tIn: number; tOut: number; tBath: number }) {
  if (!isFinite(tIn) || !isFinite(tOut) || !isFinite(tBath)) return null;
  const W = 320, H = 80, pL = 40, pR = 20, pT = 15, pB = 20;
  const maxT = Math.max(tIn, tOut, tBath) * 1.1;
  const minT = Math.min(tIn, tOut, tBath) * 0.8;
  const ty = (t: number) => pT + (1 - (t - minT) / (maxT - minT)) * (H - pT - pB);

  return (
    <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 4 }}>
        Thermal Gradient Profile (LMTD Boundaries)
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%' }}>
        {/* Bath Medium Reference Line */}
        <line x1={pL} y1={ty(tBath)} x2={W - pR} y2={ty(tBath)} stroke="var(--red)" strokeWidth={1.5} strokeDasharray="3 2" />
        <text x={W - pR} y={ty(tBath) - 4} textAnchor="end" fontSize={8} fill="var(--red)" fontFamily="monospace">Bath: {tBath.toFixed(0)}°C</text>

        {/* Process Stream Heating Trend Curve */}
        <path d={`M ${pL} ${ty(tIn)} Q ${(pL + W - pR) / 2} ${(ty(tIn) + ty(tOut)) / 2} ${W - pR} ${ty(tOut)}`} fill="none" stroke="var(--accent)" strokeWidth={2.5} />
        <circle cx={pL} cy={ty(tIn)} r={4} fill="var(--accent)" />
        <text x={pL - 6} y={ty(tIn) + 3} textAnchor="end" fontSize={8} fill="var(--text-dim)" fontFamily="monospace">{tIn.toFixed(0)}°C</text>
        <circle cx={W - pR} cy={ty(tOut)} r={4} fill="var(--accent)" />
        <text x={W - pR + 4} y={ty(tOut) + 3} fontSize={8} fill="var(--text-dim)" fontFamily="monospace">{tOut.toFixed(0)}°C</text>
      </svg>
    </div>
  );
}

export default function Stage3ProcessCoil({ s1Results, s2Results, onComplete }: Props) {
  const [form, setForm] = useState({
    Q_net: '400', T_in: '5', T_out: '40', T_bath: '62',
    nPaths: '3', nRows: '8', nps: '3"',
    material: 'a106b', P_maop: '7000', P_design: '7700', T_design: '100',
    corrAllow: '3', safetyFactor: '1.15', uMethod: 'natco_hi',
    legLengthFixed: '',
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
        // Pass background tracking parameters from Stage 1 if available
        rhoGasIn: s1Results?.ST_in?.rho ?? 55.0,
        rhoGasOut: s1Results?.ST_out?.rho ?? 51.0,
        massFlowKgh: s1Results?.mdot_kgs ? s1Results.mdot_kgs * 3600 : 5000
      };

      const res = await fetch('/api/calculations/stage3', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setResults(data.results);
        setValidation(data.validation?.wallThickness || null);
        onComplete?.(data.results);
      } else {
        setError(data.error ?? 'Failed');
      }
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  };

  const f2 = (v?: number) => v !== undefined && isFinite(v) ? v.toFixed(2) : '—';
  const f1 = (v?: number) => v !== undefined && isFinite(v) ? v.toFixed(1) : '—';

  const allValidation = validation?.messages || [];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      {/* ── LEFT PANEL: CONFIGURATION INPUTS ── */}
      <div>
        <div className="panel" style={{ marginBottom: 12 }}>
          <div className="panel-header"><div className="panel-title">Process Coil Boundary Framework</div></div>
          <div className="panel-body">
            {(s1Results || s2Results) && (
              <div style={{ marginBottom: 10 }}>
                <button className="btn btn-secondary btn-sm" onClick={syncFromPrev}>
                  ← Synchronize from Stage 1 & 2 Streams
                </button>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { k: 'Q_net', label: 'Net Thermal Load (Q)', unit: 'kW' },
                { k: 'T_in', label: 'Gas Feed Inlet Temp', unit: '°C' },
                { k: 'T_out', label: 'Gas Target Outlet Temp', unit: '°C' },
                { k: 'T_bath', label: 'Uniform Water Bath Temp', unit: '°C' },
                { k: 'P_maop', label: 'System MAOP Boundary', unit: 'kPa' },
                { k: 'P_design', label: 'Mechanical Design Press', unit: 'kPa' },
                { k: 'T_design', label: 'Mechanical Design Temp', unit: '°C' },
                { k: 'corrAllow', label: 'Corrosion Allowance (CA)', unit: 'mm' },
              ].map(fi => (
                <div key={fi.k}>
                  <label className="field-label">{fi.label}</label>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input type="number" value={form[fi.k as keyof typeof form] as string} onChange={set(fi.k)} />
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)' }}>{fi.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="panel" style={{ marginBottom: 12 }}>
          <div className="panel-header"><div className="panel-title">Coil Geometric Array & Metallurgy</div></div>
          <div className="panel-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label className="field-label">NPS Bore Size</label>
                <select value={form.nps} onChange={set('nps')}>
                  {COIL_PIPE_TABLE.map(p => (
                    <option key={p.nps} value={p.nps}>{p.label} — {p.od} mm OD</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">Piping Metallurgy Selection</label>
                <select value={form.material} onChange={set('material')}>
                  <option value="a106b">ASTM A106 Gr B Carbon Steel</option>
                  <option value="a333g6">ASTM A333 Gr 6 Low-Temp Steel</option>
                  <option value="a312tp316l">ASTM A312 TP316L Stainless Steel</option>
                </select>
              </div>
              <div>
                <label className="field-label">Parallel Flow Paths Count</label>
                <input type="number" value={form.nPaths} min="1" max="12" onChange={set('nPaths')} />
              </div>
              <div>
                <label className="field-label">Pass Rows per Path (Even)</label>
                <input type="number" value={form.nRows} min="2" max="30" step="2" onChange={set('nRows')} />
              </div>
              <div>
                <label className="field-label">Fouling Safety Factor (cf)</label>
                <select value={form.safetyFactor} onChange={set('safetyFactor')}>
                  {['1.00', '1.05', '1.10', '1.15', '1.20'].map(v => (
                    <option key={v} value={v}>{v} {v === '1.15' ? '(Recommended Spec)' : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">Convective Flux Formula</label>
                <select value={form.uMethod} onChange={set('uMethod')}>
                  {U_METHODS.map(m => <option key={m.v} value={m.v}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Leg Length Limit Boundary</label>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="number" value={form.legLengthFixed} placeholder="Auto-compute from Q" onChange={set('legLengthFixed')} />
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)' }}>m</span>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <button className="btn btn-primary" onClick={calculate} disabled={loading}>
                {loading ? '⏳ Solving Geometric Boundary Stencils…' : '▶ Calculate Process Coil'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL: COMPUTED FLUID & MECHANICAL DATA ── */}
      <div>
        {error && <div className="alert alert-fail" style={{ marginBottom: 12 }}>❌ {error}</div>}
        {allValidation.length > 0 && <ValidationPanel messages={allValidation} title="ASME B31.3 Compliance Checks" />}

        {results ? (
          <>
            <div className="panel" style={{ marginBottom: 12 }}>
              <div className="panel-header"><div className="panel-title">Thermal Area Requirements</div></div>
              <div className="panel-body">
                <ResultGrid cols={3}>
                  <ResultCard label="Vessel LMTD Profile" value={results.LMTD} unit="°C" decimals={1} variant="highlight" />
                  <ResultCard label="U Overall Flux" value={results.U_Wm2K} unit="W/m²·K" decimals={0} />
                  <ResultCard label="Surface Req. Area" value={results.Ac_design} unit="m²" decimals={2} />
                </ResultGrid>
                
                <div style={{ marginTop: 8 }}>
                  <ResultGrid cols={3}>
                    <ResultCard label="Surface Actual Area" value={results.Ac_actual} unit="m²" decimals={2} variant={results.area_adequate ? 'green' : 'red'} />
                    <ResultCard label="Thermal Area Margin" value={results.area_margin_pct} unit="%" decimals={1} variant={results.area_adequate ? 'green' : 'red'} />
                    <ResultCard label="Total Coil Running Len" value={results.L_total} unit="m" decimals={1} variant="highlight" />
                  </ResultGrid>
                </div>

                <ThermalProfileChart tIn={parseFloat(form.T_in)} tOut={parseFloat(form.T_out)} tBath={parseFloat(form.T_bath)} />
              </div>
            </div>

            <div className="panel" style={{ marginBottom: 12 }}>
              <div className="panel-header"><div className="panel-title">Fluid Kinetic & Friction Results</div></div>
              <div className="panel-body">
                <ResultGrid cols={2}>
                  <ResultCard label="Inlet Fluid Velocity" value={results.v_inlet_ms} unit="m/s" decimals={1} variant={results.v_inlet_ms > 15 ? 'red' : 'default'} />
                  <ResultCard label="Outlet Fluid Velocity" value={results.v_outlet_ms} unit="m/s" decimals={1} variant={results.v_outlet_ms > 15 ? 'red' : 'default'} />
                </ResultGrid>
                <div className={`alert ${results.dP_acceptable ? 'alert-ok' : 'alert-fail'}`} style={{ marginTop: 8 }}>
                  {results.dP_acceptable
                    ? `✔ Hydraulic Drop Passed: Coil friction drop (${f1(results.dP_kPa)} kPa) satisfies standard processing allowances.`
                    : `✘ EXCEEDS FLOW RESISTANCE CEILING: Coil drop (${f1(results.dP_kPa)} kPa) is excessively high. Expand parallel flow path loops count to avoid structural erosion.`
                  }
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header"><div className="panel-title">Mechanical Pipe Sizing (ASME B31.3)</div></div>
              <div className="panel-body">
                <table className="res-table" style={{ fontSize: 11 }}>
                  <tbody>
                    <tr><td>Nominal OD / WT</td><td className="val">{f2(results.do_m * 1000)} mm / {f2(results.wt_act)} mm</td><td>Schedule {results.sched?.nm}</td></tr>
                    <tr><td>Clean ID (Post CA)</td><td className="val">{f2(results.di_act)}</td><td>mm</td></tr>
                    <tr><td>Structural Paths × Rows</td><td className="val">{results.n_pass} × {results.n_rows}</td><td>Matrix Layout</td></tr>
                    <tr><td>Computed Leg Length</td><td className="val">{f2(results.L_leg)}</td><td>m {results.lenFixed ? '(FIXED CONSTRAINT)' : '(CALCULATED)'}</td></tr>
                    <tr><td>B31.3 Required Wall Thickness (t)</td><td className="val">{f2(results.t_nom)}</td><td>mm (Includes Mill Tol + CA)</td></tr>
                    <tr><td>Allowable Design Stress (S)</td><td className="val">{results.S_MPa}</td><td>MPa at {form.T_design}°C</td></tr>
                    <tr><td>Recommended Flange Rating</td><td className="val">ASME Class {results.flangeClass}</td><td>RF Connection Face</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="panel">
            <div className="panel-body" style={{ color: 'var(--text-dim)', padding: '32px 0', textAlign: 'center' }}>
              Configure design variables and click <strong>Calculate Process Coil</strong>.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
