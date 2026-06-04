'use client';
// src/components/modules/Stage2Firetube.tsx
// Stage 2 — Firetube & Stack Sizing (API 12K / AS 3814)

import { useState } from 'react';
import ValidationPanel from '@/components/ui/ValidationPanel';
import { ResultCard, ResultGrid } from '@/components/ui/ResultCard';
import type { Stage1Results } from '@/lib/calculations/thermodynamics';
import type { Stage2Results } from '@/lib/calculations/heater-sizing';
import { PIPE_TABLE } from '@/lib/calculations/heater-sizing';

interface Props {
  s1Results?: Stage1Results;
  onComplete?: (results: Stage2Results) => void;
}

interface S2Form {
  Q_net: string; burnerConfig: string; draftType: string;
  efficiency: string; burnerFactor: string;
  nPass: string; tubeLen: string; pipeDN: number;
  Tbath: string;
  stackAlt: string; stackTamb: string; stackTflue: string;
  excessAir: string; stackHeight: string; stackDia: string;
}

const DEFAULT_S2: S2Form = {
  Q_net:'400', burnerConfig:'2x75', draftType:'natural',
  efficiency:'80', burnerFactor:'1.15',
  nPass:'2', tubeLen:'4.0', pipeDN:400,
  Tbath:'62',
  stackAlt:'0', stackTamb:'15', stackTflue:'450',
  excessAir:'22.5', stackHeight:'4.0', stackDia:'355',
};

export default function Stage2Firetube({ s1Results, onComplete }: Props) {
  const [form, setForm] = useState<S2Form>(DEFAULT_S2);
  const [results, setResults] = useState<Stage2Results | null>(null);
  const [validation, setValidation] = useState<Record<string, { messages: {code:string;message:string;severity:'error'|'warning'|'info';reference?:string}[] }> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k: keyof S2Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  // Sync Q from Stage 1 if available
  const syncFromS1 = () => {
    if (!s1Results) return;
    setForm(f => ({
      ...f,
      Q_net: s1Results.Q_final.toFixed(1),
    }));
  };

  const calculate = async () => {
    setLoading(true); setError('');
    try {
      const inputs = {
        Q_net_kW: parseFloat(form.Q_net),
        burnerConfig: form.burnerConfig,
        draftType: form.draftType,
        efficiency_pct: parseFloat(form.efficiency),
        burnerRatingFactor: parseFloat(form.burnerFactor),
        nPass: parseInt(form.nPass),
        tubeLengthM: parseFloat(form.tubeLen),
        pipeDN: form.pipeDN,
        T_bath_C: parseFloat(form.Tbath),
        T_amb_C: parseFloat(form.stackTamb),
        stackAltM: parseFloat(form.stackAlt),
        T_flue_C: parseFloat(form.stackTflue),
        excessAir_pct: parseFloat(form.excessAir),
        stackHeightM: parseFloat(form.stackHeight),
        stackDiaMm: parseFloat(form.stackDia),
      };
      const res = await fetch('/api/calculations/stage2', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ inputs, Q_net_kW: parseFloat(form.Q_net) }),
      });
      const data = await res.json();
      if (data.success) { setResults(data.results); setValidation(data.validation); onComplete?.(data.results); }
      else setError(data.error ?? 'Calculation failed');
    } catch(e) { setError(String(e)); }
    setLoading(false);
  };

  const f1 = (v?: number) => v !== undefined && isFinite(v) ? v.toFixed(1) : '—';
  const f0 = (v?: number) => v !== undefined && isFinite(v) ? Math.round(v).toLocaleString() : '—';
  const f2 = (v?: number) => v !== undefined && isFinite(v) ? v.toFixed(2) : '—';

  const allValidation = validation
    ? Object.values(validation).flatMap(v => v.messages)
    : [];

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
      {/* ── LEFT: INPUTS ── */}
      <div>
        {/* Duty & Config */}
        <div className="panel" style={{ marginBottom:12 }}>
          <div className="panel-header"><div className="panel-title">Heater Configuration — API 12K</div></div>
          <div className="panel-body">
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div>
                <label className="field-label">Net Process Duty Q_net</label>
                <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                  <input type="number" value={form.Q_net} onChange={set('Q_net')} />
                  <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text-dim)', whiteSpace:'nowrap' }}>kW</span>
                </div>
                {s1Results && (
                  <button className="btn btn-secondary btn-sm" style={{ marginTop:4 }} onClick={syncFromS1}>
                    ← Use Stage 1 ({s1Results.Q_final.toFixed(1)} kW)
                  </button>
                )}
              </div>
              <div>
                <label className="field-label">Burner Configuration</label>
                <select value={form.burnerConfig} onChange={set('burnerConfig')}>
                  <option value="1x100">1×100% — Single burner</option>
                  <option value="2x50">2×50% — Dual 50%</option>
                  <option value="2x75">2×75% — Dual 75% (standard WBH)</option>
                  <option value="2x100">2×100% — Dual full-size</option>
                  <option value="3x50">3×50% — Triple 50%</option>
                </select>
              </div>
              <div>
                <label className="field-label">Thermal Efficiency η</label>
                <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                  <input type="number" value={form.efficiency} step="1" min="50" max="95" onChange={set('efficiency')} />
                  <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text-dim)', whiteSpace:'nowrap' }}>%</span>
                </div>
              </div>
              <div>
                <label className="field-label">Burner Rating Factor</label>
                <input type="number" value={form.burnerFactor} step="0.05" min="1.0" max="1.5" onChange={set('burnerFactor')} />
                <div style={{ fontSize:10, color:'var(--text-dim)', marginTop:2 }}>Per AS 3814:2018 §5.3</div>
              </div>
              <div>
                <label className="field-label">Draft Type</label>
                <select value={form.draftType} onChange={set('draftType')}>
                  <option value="natural">Natural Draft (standard WBH)</option>
                  <option value="forced">Forced Draft</option>
                  <option value="induced">Induced Draft</option>
                </select>
              </div>
              <div>
                <label className="field-label">Bath Temperature</label>
                <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                  <input type="number" value={form.Tbath} step="1" onChange={set('Tbath')} />
                  <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text-dim)', whiteSpace:'nowrap' }}>°C</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Firetube Geometry */}
        <div className="panel" style={{ marginBottom:12 }}>
          <div className="panel-header"><div className="panel-title">Firetube Geometry</div></div>
          <div className="panel-body">
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div>
                <label className="field-label">Number of Passes</label>
                <select value={form.nPass} onChange={set('nPass')}>
                  <option value="2">2-Pass (U-tube) — standard WBH</option>
                  <option value="4">4-Pass — larger duty / compact shell</option>
                </select>
              </div>
              <div>
                <label className="field-label">Tube Length per Section (L)</label>
                <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                  <input type="number" value={form.tubeLen} step="0.25" min="1" max="12" onChange={set('tubeLen')} />
                  <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text-dim)', whiteSpace:'nowrap' }}>m</span>
                </div>
                <div style={{ fontSize:10, color:'var(--text-dim)', marginTop:2 }}>Typical WBH: 2.5–6 m</div>
              </div>
            </div>

            {/* Pipe grid */}
            <div style={{ marginTop:12 }}>
              <label className="field-label" style={{ marginBottom:8 }}>Firetube Pipe Size — DN Selection</label>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(80px,1fr))', gap:6 }}>
                {PIPE_TABLE.map(p => (
                  <button
                    key={p.dn}
                    onClick={() => setForm(f => ({ ...f, pipeDN: p.dn }))}
                    style={{
                      background: form.pipeDN === p.dn ? 'rgba(176,96,0,0.12)' : 'var(--panel2)',
                      border: `1px solid ${form.pipeDN === p.dn ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius:4, padding:'8px 6px', cursor:'pointer', textAlign:'center',
                    }}
                  >
                    <div style={{ fontWeight:700, fontSize:13 }}>DN{p.dn}</div>
                    <div style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--text-dim)' }}>{p.od} mm</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Stack & Draft */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title" style={{ color:'var(--blue)' }}>Stack & Draft Sizing — API 12K / AS 3814</div>
          </div>
          <div className="panel-body">
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              {[
                { label:'Site Altitude', key:'stackAlt', unit:'m ASL' },
                { label:'Ambient Temperature', key:'stackTamb', unit:'°C' },
                { label:'Flue Gas Temperature', key:'stackTflue', unit:'°C' },
                { label:'Excess Air', key:'excessAir', unit:'%' },
                { label:'Stack Height', key:'stackHeight', unit:'m' },
                { label:'Stack Diameter', key:'stackDia', unit:'mm' },
              ].map(fi => (
                <div key={fi.key}>
                  <label className="field-label">{fi.label}</label>
                  <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                    <input type="number" value={form[fi.key as keyof S2Form] as string}
                      onChange={set(fi.key as keyof S2Form)} />
                    <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text-dim)', whiteSpace:'nowrap' }}>{fi.unit}</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop:12 }}>
              <button className="btn btn-primary" onClick={calculate} disabled={loading}>
                {loading ? '⏳ Calculating…' : '▶ Calculate Firetube & Stack'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT: RESULTS ── */}
      <div>
        {error && <div className="alert alert-fail" style={{ marginBottom:12 }}>❌ {error}</div>}
        {allValidation.length > 0 && <ValidationPanel messages={allValidation} title="Engineering Checks" />}

        {results ? (
          <>
            {/* Duty Chain */}
            <div className="panel" style={{ marginBottom:12 }}>
              <div className="panel-header"><div className="panel-title">Duty Chain — API 12K Logic</div></div>
              <div className="panel-body">
                <ResultGrid cols={3}>
                  <ResultCard label="Q Net (process)" value={results.Q_net_kW} unit="kW" decimals={1} variant="highlight" />
                  <ResultCard label="Q Gross (fuel input)" value={results.Q_gross_kW} unit="kW" decimals={1} />
                  <ResultCard label="Q Burner Rated" value={results.Q_burner_rated_kW} unit="kW" decimals={1} />
                </ResultGrid>
                <ResultGrid cols={2}>
                  <ResultCard label="No. of Burners" value={results.nBurners} />
                  <ResultCard label="Q per Burner" value={results.Q_per_burner_kW} unit="kW" decimals={1} />
                </ResultGrid>
              </div>
            </div>

            {/* Firetube Geometry */}
            <div className="panel" style={{ marginBottom:12 }}>
              <div className="panel-header"><div className="panel-title">Firetube Geometry Results</div></div>
              <div className="panel-body">
                <ResultGrid cols={2}>
                  <ResultCard label="Shell OD" value={results.OD_shell_mm} unit="mm" decimals={0} variant="highlight" />
                  <ResultCard label="Shell Length" value={results.L_shell_mm} unit="mm" decimals={0} />
                  <ResultCard label="Bath Volume" value={results.bath_volume_L} unit="litres" decimals={0} />
                  <ResultCard label="Firetube Area" value={results.A_ft} unit="m²" decimals={2} />
                </ResultGrid>
                <table className="res-table" style={{ fontSize:11 }}>
                  <tbody>
                    <tr><td>Firetube OD</td><td className="val">{f2(results.OD * 1000)}</td><td>mm</td></tr>
                    <tr><td>No. of Passes</td><td className="val">{results.nPass}</td><td>—</td></tr>
                    <tr><td>Leg Length L</td><td className="val">{f2(results.L)}</td><td>m</td></tr>
                    <tr><td>No. of Tubes</td><td className="val">{results.n_tubes}</td><td>—</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Heat Flux */}
            <div className="panel" style={{ marginBottom:12, borderColor: results.fluxOK ? '' : 'var(--red)' }}>
              <div className="panel-header">
                <div className="panel-title" style={{ color: results.fluxOK ? 'var(--green)' : 'var(--red)' }}>
                  Heat Flux Compliance — API 12K §4.3
                </div>
              </div>
              <div className="panel-body">
                <ResultGrid cols={2}>
                  <ResultCard label="Heat Flux" value={results.heatFlux_kWm2} unit="kW/m²" decimals={1}
                    variant={results.fluxOK ? 'green' : 'red'} />
                  <ResultCard label="Heat Flux (BTU)" value={results.heatFlux_BTUhrft2} unit="BTU/hr·ft²" decimals={0}
                    variant={results.fluxOK ? 'green' : 'red'} />
                </ResultGrid>
                <div className={`alert ${results.fluxOK ? 'alert-ok' : 'alert-fail'}`}>
                  {results.fluxOK
                    ? `✔ Heat flux ${f1(results.heatFlux_kWm2)} kW/m² — within API 12K limit 37.9 kW/m²`
                    : `✘ Heat flux ${f1(results.heatFlux_kWm2)} kW/m² EXCEEDS API 12K limit 37.9 kW/m²`}
                </div>
              </div>
            </div>

            {/* Stack */}
            <div className="panel" style={{ marginBottom:12 }}>
              <div className="panel-header">
                <div className="panel-title" style={{ color:'var(--blue)' }}>Stack & Draft Analysis</div>
              </div>
              <div className="panel-body">
                <ResultGrid cols={2}>
                  <ResultCard label="Draft Available" value={results.P_available_Pa} unit="Pa" decimals={1}
                    variant={results.draftOK ? 'green' : 'red'} />
                  <ResultCard label="Draft Required" value={results.P_required_Pa} unit="Pa" decimals={1} />
                  <ResultCard label="Stack Velocity" value={results.stackVelocity_ms} unit="m/s" decimals={1}
                    variant={results.stackVelOK ? 'default' : 'red'} />
                  <ResultCard label="Fuel Consumption" value={results.m_fuel_kghr} unit="kg/hr" decimals={1} variant="highlight" />
                </ResultGrid>
                <div className={`alert ${results.draftOK ? 'alert-ok' : 'alert-fail'}`}>
                  {results.draftOK ? '✔ Adequate natural draft' : '✘ Insufficient draft — increase stack height or diameter'}
                </div>
              </div>
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
