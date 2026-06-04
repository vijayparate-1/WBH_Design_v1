'use client';
// src/components/modules/InsulationTab.tsx

import { useState } from 'react';
import { ResultCard, ResultGrid } from '@/components/ui/ResultCard';
import type { Stage1Results } from '@/lib/calculations/thermodynamics';
import type { Stage2Results } from '@/lib/calculations/heater-sizing';

interface Props {
  s1Results?: Stage1Results;
  s2Results?: Stage2Results;
}

const INS_MATERIALS = [
  { id:'ceramic_96', label:'Ceramic Fibre 96 kg/m³ — Kaowool/Cerablanket', k:0.094, maxT:1100 },
  { id:'mineral_64', label:'Mineral Wool 64 kg/m³ — Rockwool/Isover', k:0.036, maxT:750 },
  { id:'calcium',    label:'Calcium Silicate 220 kg/m³', k:0.067, maxT:650 },
  { id:'pir',        label:'PIR Foam (cold insulation) — k=0.024', k:0.024, maxT:120 },
];

export default function InsulationTab({ s1Results, s2Results }: Props) {
  const [form, setForm] = useState({
    thickness:'75', material:'ceramic_96', cladding:'aluzinc',
    windSpeed:'3', T_amb:'25', T_process:'75',
    D_shell:'1.716', L_shell:'7.65',
  });
  const [result, setResult] = useState<Record<string,number> | null>(null);
  const [loading, setLoading] = useState(false);

  const syncFromS2 = () => {
    if (!s2Results) return;
    setForm(f => ({
      ...f,
      D_shell: (s2Results.OD_shell_mm / 1000).toFixed(3),
      L_shell: (s2Results.L_shell_mm / 1000).toFixed(3),
      T_process: String(Math.round(Number(75))), // bath temp not directly in S2 results type
    }));
  };

  const calculate = async () => {
    setLoading(true);
    try {
      const mat = INS_MATERIALS.find(m => m.id === form.material)!;
      const res = await fetch('/api/validate', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          composition: Array(14).fill(0),
          T_in_C:0, T_out_C:10, P_kPa:7000, dP_kPa:50,
          T_design_C:100, P_design_kPa:7700,
          Q_loss_kW: 0.5, Q_design_kW: 400,
        }),
      });
      // Simple local calc
      const t = parseFloat(form.thickness) / 1000;
      const k = mat.k * (1 + 0.0002 * (parseFloat(form.T_process) - 25));
      const R_shell = parseFloat(form.D_shell) / 2;
      const R_ins = R_shell + t;
      const h_ext = 5.7 + 3.8 * parseFloat(form.windSpeed);
      const L = parseFloat(form.L_shell);
      const dT = parseFloat(form.T_process) - parseFloat(form.T_amb);
      const A_cyl = Math.PI * parseFloat(form.D_shell) * L;
      const A_ends = 2 * Math.PI / 4 * parseFloat(form.D_shell) ** 2;
      const R_cyl = Math.log(R_ins / R_shell) / (2 * Math.PI * k * L);
      const R_ext = 1 / (h_ext * 2 * Math.PI * R_ins * L);
      const Q_cyl = dT / (R_cyl + R_ext);
      const R_slab = t / (k * A_ends);
      const R_ext_e = 1 / (h_ext * A_ends);
      const Q_ends = dT / (R_slab + R_ext_e);
      const Q_total = (Q_cyl + Q_ends) / 1000;
      setResult({ Q_total, A_cyl, A_ends, A_total: A_cyl+A_ends, h_ext, k_mean: k,
        blanket: (A_cyl+A_ends)*1.15, cladding: (A_cyl+A_ends)*1.10, loss_pct: Q_total/400*100 });
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
      <div>
        <div className="panel" style={{ marginBottom:12 }}>
          <div className="panel-header"><div className="panel-title">Vessel / Shell Dimensions</div></div>
          <div className="panel-body">
            {s2Results && (
              <button className="btn btn-secondary btn-sm" style={{ marginBottom:10 }} onClick={syncFromS2}>
                ← Sync from Stage 2
              </button>
            )}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {[{k:'D_shell',label:'Shell OD',unit:'m'},{k:'L_shell',label:'Shell Length',unit:'m'},
                {k:'T_process',label:'Process Temp (Bath)',unit:'°C'},{k:'T_amb',label:'Ambient Temperature',unit:'°C'},
              ].map(fi => (
                <div key={fi.k}>
                  <label className="field-label">{fi.label}</label>
                  <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                    <input type="number" value={form[fi.k as keyof typeof form]} onChange={set(fi.k)} />
                    <span style={{ fontFamily:'var(--mono)',fontSize:11,color:'var(--text-dim)',whiteSpace:'nowrap' }}>{fi.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header"><div className="panel-title">Insulation Specification</div></div>
          <div className="panel-body">
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div>
                <label className="field-label">Insulation Material</label>
                <select value={form.material} onChange={set('material')}>
                  {INS_MATERIALS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Thickness</label>
                <div style={{ display:'flex',gap:6,alignItems:'center' }}>
                  <input type="number" value={form.thickness} step="25" onChange={set('thickness')} />
                  <span style={{ fontFamily:'var(--mono)',fontSize:11,color:'var(--text-dim)',whiteSpace:'nowrap' }}>mm</span>
                </div>
              </div>
              <div>
                <label className="field-label">Cladding Material</label>
                <select value={form.cladding} onChange={set('cladding')}>
                  <option value="aluzinc">Colorbond® Zincalume 0.75 BMT (AUS)</option>
                  <option value="ss304">304 SS 0.9 mm sheet (MYS/ME)</option>
                  <option value="alum">Aluminium 0.9 mm</option>
                </select>
              </div>
              <div>
                <label className="field-label">Wind Speed</label>
                <div style={{ display:'flex',gap:6,alignItems:'center' }}>
                  <input type="number" value={form.windSpeed} step="0.5" onChange={set('windSpeed')} />
                  <span style={{ fontFamily:'var(--mono)',fontSize:11,color:'var(--text-dim)',whiteSpace:'nowrap' }}>m/s</span>
                </div>
              </div>
            </div>
            <div style={{ marginTop:12 }}>
              <button className="btn btn-primary" onClick={calculate} disabled={loading}>
                {loading ? '⏳…' : '▶ Calculate Insulation'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div>
        {result ? (
          <>
            <div className="panel" style={{ marginBottom:12 }}>
              <div className="panel-header"><div className="panel-title">Heat Loss Results — GPSA §3</div></div>
              <div className="panel-body">
                <ResultGrid cols={2}>
                  <ResultCard label="Heat Loss Q" value={result.Q_total} unit="kW" decimals={2}
                    variant={result.loss_pct <= 3 ? 'green' : 'red'} />
                  <ResultCard label="Loss % of Duty" value={result.loss_pct} unit="%" decimals={2}
                    variant={result.loss_pct <= 3 ? 'green' : 'red'} />
                  <ResultCard label="External h_conv" value={result.h_ext} unit="W/(m²·K)" decimals={1} />
                  <ResultCard label="k at mean T" value={result.k_mean} unit="W/(m·K)" decimals={3} />
                </ResultGrid>
                <div className={`alert ${result.loss_pct <= 3 ? 'alert-ok' : 'alert-warn'}`}>
                  {result.loss_pct <= 3
                    ? `✔ Heat loss ${result.Q_total.toFixed(2)} kW (${result.loss_pct.toFixed(1)}%) — within GPSA §3 guideline (≤ 3%)`
                    : `⚠ Heat loss ${result.Q_total.toFixed(2)} kW (${result.loss_pct.toFixed(1)}%) exceeds 3% — increase insulation thickness`}
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header"><div className="panel-title">Material Quantities</div></div>
              <div className="panel-body">
                <table className="res-table">
                  <thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Note</th></tr></thead>
                  <tbody>
                    <tr><td>Shell area</td><td className="val">{result.A_cyl.toFixed(2)}</td><td>m²</td><td>Cylindrical shell</td></tr>
                    <tr><td>End plates area</td><td className="val">{result.A_ends.toFixed(2)}</td><td>m²</td><td>Both ends</td></tr>
                    <tr><td>Insulation blanket</td><td className="val">{result.blanket.toFixed(2)}</td><td>m²</td><td>+15% waste/overlap</td></tr>
                    <tr><td>Cladding sheet</td><td className="val">{result.cladding.toFixed(2)}</td><td>m²</td><td>+10% laps/waste</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="panel">
            <div className="panel-body" style={{ color:'var(--text-dim)', padding:'20px 0' }}>
              Configure insulation parameters and click Calculate.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
