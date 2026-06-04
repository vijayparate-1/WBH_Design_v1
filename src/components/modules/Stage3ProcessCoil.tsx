'use client';
// src/components/modules/Stage3ProcessCoil.tsx

import { useState } from 'react';
import ValidationPanel from '@/components/ui/ValidationPanel';
import { ResultCard, ResultGrid } from '@/components/ui/ResultCard';
import type { Stage1Results } from '@/lib/calculations/thermodynamics';
import type { Stage2Results, Stage3Results } from '@/lib/calculations/heater-sizing';
import { COIL_PIPE_TABLE } from '@/lib/calculations/heater-sizing';

interface Props {
  s1Results?: Stage1Results;
  s2Results?: Stage2Results;
  onComplete?: (results: Stage3Results) => void;
}

const U_METHODS = [
  { v:'natco_lo',  label:'NATCO Low — 250 W/(m²·K)' },
  { v:'natco_hi',  label:'NATCO High — 400 W/(m²·K) [recommended]' },
  { v:'gpsa_typ',  label:'GPSA Typical — 350 W/(m²·K)' },
  { v:'cfer_cold', label:'C-FER Cold Climate — 280 W/(m²·K)' },
];

export default function Stage3ProcessCoil({ s1Results, s2Results, onComplete }: Props) {
  const [form, setForm] = useState({
    Q_net:'400', T_in:'5', T_out:'40', T_bath:'62',
    nPaths:'3', nRows:'8', nps:"3\"",
    material:'a106b', P_maop:'7000', P_design:'7700', T_design:'100',
    corrAllow:'3', safetyFactor:'1.15', uMethod:'natco_hi',
    legLengthFixed:'',
  });
  const [results, setResults] = useState<Stage3Results | null>(null);
  const [validation, setValidation] = useState<{ messages: {code:string;message:string;severity:'error'|'warning'|'info';reference?:string}[] } | null>(null);
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
      T_bath: s2Results ? String(s2Results.bath_volume_L > 0 ? 62 : 62) : f.T_bath,
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
      };
      const res = await fetch('/api/calculations/stage3', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) { setResults(data.results); setValidation(data.validation?.wallThickness); onComplete?.(data.results); }
      else setError(data.error ?? 'Failed');
    } catch(e) { setError(String(e)); }
    setLoading(false);
  };

  const f2 = (v?: number) => v !== undefined && isFinite(v) ? v.toFixed(2) : '—';
  const f1 = (v?: number) => v !== undefined && isFinite(v) ? v.toFixed(1) : '—';

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
      {/* LEFT */}
      <div>
        <div className="panel" style={{ marginBottom:12 }}>
          <div className="panel-header"><div className="panel-title">Process Coil Design Basis</div></div>
          <div className="panel-body">
            {(s1Results || s2Results) && (
              <div style={{ marginBottom:10 }}>
                <button className="btn btn-secondary btn-sm" onClick={syncFromPrev}>
                  ← Sync from Stages 1 & 2
                </button>
              </div>
            )}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {[
                {k:'Q_net', label:'Net Duty Q', unit:'kW'},
                {k:'T_in', label:'Gas Inlet T', unit:'°C'},
                {k:'T_out', label:'Gas Outlet T', unit:'°C'},
                {k:'T_bath', label:'Bath Temperature', unit:'°C'},
                {k:'P_maop', label:'MAOP', unit:'kPa'},
                {k:'P_design', label:'Design Pressure', unit:'kPa'},
                {k:'T_design', label:'Design Temperature', unit:'°C'},
                {k:'corrAllow', label:'Corrosion Allowance', unit:'mm'},
              ].map(fi => (
                <div key={fi.k}>
                  <label className="field-label">{fi.label}</label>
                  <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                    <input type="number" value={form[fi.k as keyof typeof form] as string}
                      onChange={set(fi.k)} />
                    <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text-dim)', whiteSpace:'nowrap' }}>{fi.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="panel" style={{ marginBottom:12 }}>
          <div className="panel-header"><div className="panel-title">Coil Geometry & Material</div></div>
          <div className="panel-body">
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div>
                <label className="field-label">NPS Selection</label>
                <select value={form.nps} onChange={set('nps')}>
                  {COIL_PIPE_TABLE.map(p => (
                    <option key={p.nps} value={p.nps}>{p.nps} — OD {p.od} mm</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">Material</label>
                <select value={form.material} onChange={set('material')}>
                  <option value="a106b">ASTM A106 Gr B (standard)</option>
                  <option value="a333g6">ASTM A333 Gr 6 (low-temp)</option>
                  <option value="a312tp316l">ASTM A312 TP316L (SS)</option>
                  <option value="a312tp304">ASTM A312 TP304 (SS)</option>
                </select>
              </div>
              <div>
                <label className="field-label">No. of Flow Paths</label>
                <input type="number" value={form.nPaths} min="1" max="12" onChange={set('nPaths')} />
              </div>
              <div>
                <label className="field-label">Rows per Path (even)</label>
                <input type="number" value={form.nRows} min="2" max="30" step="2" onChange={set('nRows')} />
              </div>
              <div>
                <label className="field-label">Safety Factor cf</label>
                <select value={form.safetyFactor} onChange={set('safetyFactor')}>
                  {['1.00','1.05','1.10','1.15','1.20','1.25'].map(v => (
                    <option key={v} value={v}>{v} {v === '1.15' ? '(recommended)' : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">U-Value Method</label>
                <select value={form.uMethod} onChange={set('uMethod')}>
                  {U_METHODS.map(m => <option key={m.v} value={m.v}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Leg Length (blank = calc from duty)</label>
                <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                  <input type="number" value={form.legLengthFixed} placeholder="Calculated"
                    onChange={set('legLengthFixed')} />
                  <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text-dim)', whiteSpace:'nowrap' }}>m</span>
                </div>
              </div>
            </div>

            <div style={{ marginTop:12 }}>
              <button className="btn btn-primary" onClick={calculate} disabled={loading}>
                {loading ? '⏳ Calculating…' : '▶ Calculate Process Coil'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT */}
      <div>
        {error && <div className="alert alert-fail" style={{ marginBottom:12 }}>❌ {error}</div>}
        {validation && <ValidationPanel messages={validation.messages ?? []} title="B31.3 Checks" />}

        {results ? (
          <>
            <div className="panel" style={{ marginBottom:12 }}>
              <div className="panel-header"><div className="panel-title">Coil Thermal Sizing</div></div>
              <div className="panel-body">
                <ResultGrid cols={3}>
                  <ResultCard label="LMTD" value={results.LMTD} unit="°C" decimals={1} variant="highlight" />
                  <ResultCard label="U Overall" value={results.U_Wm2K} unit="W/(m²·K)" decimals={0} />
                  <ResultCard label="Area Required" value={results.Ac_design} unit="m²" decimals={2} />
                </ResultGrid>
                <ResultGrid cols={3}>
                  <ResultCard label="Area Actual" value={results.Ac_actual} unit="m²" decimals={2}
                    variant={results.area_adequate ? 'green' : 'red'} />
                  <ResultCard label="Area Margin" value={results.area_margin_pct} unit="%" decimals={1}
                    variant={results.area_adequate ? 'green' : 'red'} />
                  <ResultCard label="Total Coil Length" value={results.L_total} unit="m" decimals={1} variant="highlight" />
                </ResultGrid>
              </div>
            </div>

            <div className="panel" style={{ marginBottom:12 }}>
              <div className="panel-header"><div className="panel-title">Geometry & Pressure Design</div></div>
              <div className="panel-body">
                <table className="res-table" style={{ fontSize:11 }}>
                  <tbody>
                    <tr><td>OD / WT</td><td className="val">{f2(results.do_m*1000)} mm / {f2(results.wt_act)} mm</td><td>Sch {results.sched?.nm}</td></tr>
                    <tr><td>ID (after CA)</td><td className="val">{f2(results.di_act)}</td><td>mm</td></tr>
                    <tr><td>Paths × Rows</td><td className="val">{results.n_pass} × {results.n_rows}</td><td>—</td></tr>
                    <tr><td>Leg Length</td><td className="val">{f2(results.L_leg)}</td><td>m {results.lenFixed ? '(FIXED)' : '(calc)'}</td></tr>
                    <tr><td>Pressure Drop</td><td className={`${results.dP_acceptable ? 'val' : ''}`}
                      style={!results.dP_acceptable ? {color:'var(--red)',fontWeight:600}:{}}>
                      {f1(results.dP_kPa)}</td><td>kPa {results.dP_acceptable ? '✔' : '⚠ HIGH'}</td></tr>
                    <tr><td>B31.3 t_required</td><td className="val">{f2(results.t_nom)}</td><td>mm</td></tr>
                    <tr><td>Allowable Stress S</td><td className="val">{results.S_MPa}</td><td>MPa at {form.T_design}°C</td></tr>
                    <tr><td>Flange Class</td><td className="val">ASME Class {results.flangeClass}</td><td>—</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="note-box">
              <strong>ASME B31.3-2022 §304.1.2</strong> — pressure design thickness t = P·D / [2(SEW + PY)].
              Mill tolerance −12.5%. Corrosion allowance {form.corrAllow} mm.
              <strong> LMTD</strong> computed assuming bath at uniform {form.T_bath}°C (conservative).
              For bath stratification correction, run HT Analyser (nodal method, C-FER/PRCI).
            </div>
          </>
        ) : (
          <div className="panel">
            <div className="panel-body" style={{ color:'var(--text-dim)', padding:'20px 0' }}>
              Configure inputs and click Calculate.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
