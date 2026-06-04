'use client';
// src/components/modules/Stage1GasProps.tsx
// Full Stage 1 — PR-EOS Gas Properties, HHV/LHV, Joule-Thomson, Combustion

import { useState, useCallback } from 'react';
import ValidationPanel from '@/components/ui/ValidationPanel';
import { ResultCard, ResultGrid, ResultTable } from '@/components/ui/ResultCard';
import type { Stage1Results } from '@/lib/calculations/thermodynamics';

// ── Gas presets (matching HTML version) ──────────────────────────────────────
const GAS_PRESETS: Record<string, { name: string; comp: Record<number, number> }> = {
  aus_bass:     { name:'Bass Strait / VIC Transmission',         comp:{0:89.5,1:5.3,2:1.5,3:0.1,4:0.3,9:2.1,10:1.2} },
  aus_surat:    { name:'Surat Basin / QLD CSG',                  comp:{0:97.2,1:0.5,2:0.1,9:1.8,10:0.4} },
  aus_carnarvon:{ name:'Carnarvon Basin / WA (Dry)',             comp:{0:88.5,1:5.8,2:1.2,4:0.3,9:2.8,10:1.4} },
  aus_browse:   { name:'Browse Basin / WA (Rich)',               comp:{0:81.2,1:8.9,2:3.1,3:0.8,4:1.1,9:1.5,10:3.4} },
  aus_cooper:   { name:'Cooper Basin / SA–QLD',                  comp:{0:78.5,1:9.3,2:4.2,3:1.1,4:1.8,5:0.5,9:2.2,10:2.4} },
  sea_sarawak:  { name:'Sarawak / Malaysia (CO₂ 4%)',            comp:{0:88.5,1:3.5,2:1.2,4:0.2,9:2.6,10:4.0} },
  me_saudi:     { name:'Saudi Arabia / Gulf (rich)',             comp:{0:73.0,1:10.5,2:5.1,3:1.8,4:2.6,5:1.2,9:2.8,10:3.0} },
  me_sour:      { name:'Middle East Sour (H₂S 3.5%, CO₂ 5%)',  comp:{0:79.5,1:5.5,2:1.8,9:4.7,10:5.0,11:3.5} },
  nz_maui:      { name:'Maui / Pohokura — NZ Sales Gas',        comp:{0:88.9,1:5.8,2:1.3,4:0.2,9:2.6,10:1.2} },
  gen_lean:     { name:'Generic Lean (95% CH4)',                 comp:{0:95.0,1:2.5,9:1.5,10:1.0} },
  sour_mild:    { name:'Mild Sour (H₂S 2%, CO₂ 3.5%)',         comp:{0:85.0,1:5.0,2:1.5,4:0.3,9:2.7,10:3.5,11:2.0} },
};

const COMP_LIST = [
  [0, 'Methane',         'CH₄'],  [1,  'Ethane',          'C₂H₆'],
  [2, 'Propane',         'C₃H₈'], [3,  'i-Butane',        'iC₄'],
  [4, 'n-Butane',        'nC₄'],  [5,  'i-Pentane',       'iC₅'],
  [6, 'n-Pentane',       'nC₅'],  [7,  'n-Hexane',        'nC₆'],
  [8, 'n-Heptane',       'nC₇'],  [9,  'Nitrogen',        'N₂'],
  [10,'Carbon Dioxide',  'CO₂'],  [11, 'Hydrogen Sulfide','H₂S'],
  [12,'Helium',          'He'],   [13, 'Hydrogen',        'H₂'],
] as const;

const BASIS_OPTIONS = [
  { v:'1', label:'M1 PR Analytic' },
  { v:'2', label:'M2 PR Numeric ΔH' },
  { v:'3', label:'M3 PR Numeric ΔS' },
  { v:'4', label:'M4 SRK' },
  { v:'5', label:'M5 Avg(M1+M2) ★ Recommended' },
  { v:'6', label:'M6 ΔH Full (P>50 barg)' },
];

interface Props {
  onComplete?: (results: Stage1Results) => void;
  initialValues?: Partial<Stage1FormState>;
}

interface Stage1FormState {
  comp: Record<number, string>;
  T_in: string; T_out: string; P_in: string; dP: string;
  mflow: string; flowUnit: 'kgh' | 'nm3h';
  basis: string;
  T_design: string; P_design: string;
  dutyOverride: string;
}

const DEFAULT_FORM: Stage1FormState = {
  comp: { 0:'92.0', 1:'4.5', 2:'1.5', 4:'0.3', 9:'1.2', 10:'0.5' },
  T_in:'5', T_out:'40', P_in:'7000', dP:'50',
  mflow:'5000', flowUnit:'kgh',
  basis:'5',
  T_design:'100', P_design:'7700',
  dutyOverride:'',
};

export default function Stage1GasProps({ onComplete, initialValues }: Props) {
  const [form, setForm] = useState<Stage1FormState>({ ...DEFAULT_FORM, ...initialValues });
  const [results, setResults] = useState<Stage1Results | null>(null);
  const [validation, setValidation] = useState<{ messages: { code:string; message:string; severity:'error'|'warning'|'info'; reference?:string }[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'props'|'hv'|'jt'|'comb'>('props');
  const [error, setError] = useState('');

  const total = COMP_LIST.reduce((s, [i]) => s + parseFloat(form.comp[i] ?? '0'), 0);
  const totalOK = Math.abs(total - 100) < 0.01;

  const setComp = useCallback((idx: number, val: string) => {
    setForm(f => ({ ...f, comp: { ...f.comp, [idx]: val } }));
  }, []);

  const normalise = () => {
    if (total < 0.01) return;
    const next: Record<number, string> = {};
    COMP_LIST.forEach(([i]) => {
      const v = parseFloat(form.comp[i] ?? '0');
      next[i] = ((v / total) * 100).toFixed(4);
    });
    setForm(f => ({ ...f, comp: next }));
  };

  const clearComp = () => {
    setForm(f => ({ ...f, comp: {} }));
  };

  const loadPreset = (key: string) => {
    const p = GAS_PRESETS[key];
    if (!p) return;
    const next: Record<number, string> = {};
    COMP_LIST.forEach(([i]) => { next[i] = String(p.comp[i] ?? '0'); });
    setForm(f => ({ ...f, comp: next }));
  };

  const calculate = async () => {
    setLoading(true);
    setError('');
    try {
      const compArr = COMP_LIST.map(([i]) => parseFloat(form.comp[i] ?? '0') / 100);
      const ySum = compArr.reduce((a, b) => a + b, 0);
      const y = ySum > 0 ? compArr.map(v => v / ySum) : compArr;

      const payload = {
        composition: y,
        T_in_C: parseFloat(form.T_in),
        T_out_C: parseFloat(form.T_out),
        P_kPa: parseFloat(form.P_in),
        dP_kPa: parseFloat(form.dP),
        massFlow_kgh: parseFloat(form.mflow) * (form.flowUnit === 'nm3h' ? 0.68 : 1), // rough Nm³→kg
        basisMethod: parseInt(form.basis),
        T_design_C: parseFloat(form.T_design),
        P_design_kPa: parseFloat(form.P_design),
        dutyOverride_kW: form.dutyOverride ? parseFloat(form.dutyOverride) : undefined,
      };

      const res = await fetch('/api/calculations/stage1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setResults(data.results);
        setValidation(data.validation);
        onComplete?.(data.results);
      } else {
        setError(data.error ?? 'Calculation failed');
      }
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  };

  const f = (v: number | undefined, d = 4) =>
    v !== undefined && isFinite(v) ? v.toFixed(d) : '—';

  return (
    <div>
      {/* Sub-tab bar */}
      <div style={{ display:'flex', background:'var(--panel)', borderBottom:'1px solid var(--border)',
        padding:'0 0 0 0', margin:'-20px -24px 16px', overflowX:'auto' }}>
        {[
          { id:'props', label:'① PR-EOS Gas Properties' },
          { id:'hv',    label:'② HHV / LHV / Wobbe' },
          { id:'jt',    label:'③ Joule-Thomson' },
          { id:'comb',  label:'④ Combustion & Flue Gas' },
        ].map(t => (
          <button
            key={t.id}
            className={`tab-btn${activeSubTab === t.id ? ' active' : ''}`}
            style={{ fontSize: 12, padding: '10px 18px' }}
            onClick={() => setActiveSubTab(t.id as 'props'|'hv'|'jt'|'comb')}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* ── LEFT COLUMN ── */}
        <div>
          {/* Gas composition panel */}
          <div className="panel" style={{ marginBottom: 12 }}>
            <div className="panel-header">
              <div style={{ width:6,height:6,borderRadius:'50%',background:'var(--accent)' }} />
              <div className="panel-title">Gas Composition — Mole %</div>
            </div>
            <div className="panel-body">
              {/* Preset selector */}
              <div style={{ marginBottom: 10 }}>
                <label className="field-label">Load Preset Composition</label>
                <select onChange={e => e.target.value && loadPreset(e.target.value)}
                  defaultValue="">
                  <option value="">— Select Preset —</option>
                  <optgroup label="Australian Sales Gas">
                    <option value="aus_bass">Bass Strait / VIC Transmission</option>
                    <option value="aus_surat">Surat Basin / QLD CSG</option>
                    <option value="aus_carnarvon">Carnarvon Basin / WA (Dry)</option>
                    <option value="aus_browse">Browse Basin / WA (Rich)</option>
                    <option value="aus_cooper">Cooper Basin / SA–QLD</option>
                  </optgroup>
                  <optgroup label="SE Asia">
                    <option value="sea_sarawak">Sarawak / Malaysia (CO₂ 4%)</option>
                  </optgroup>
                  <optgroup label="Middle East">
                    <option value="me_saudi">Saudi Arabia / Gulf (rich)</option>
                    <option value="me_sour">Middle East Sour (H₂S 3.5%)</option>
                  </optgroup>
                  <optgroup label="New Zealand">
                    <option value="nz_maui">Maui / Pohokura</option>
                  </optgroup>
                  <optgroup label="Generic">
                    <option value="gen_lean">Generic Lean (95% CH4)</option>
                    <option value="sour_mild">Mild Sour (H₂S 2%)</option>
                  </optgroup>
                </select>
              </div>

              {/* Composition table */}
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr>
                    {['Component','Formula','Mol%'].map(h => (
                      <th key={h} style={{ textAlign:'left', padding:'5px 8px',
                        borderBottom:'1px solid var(--border)', fontSize:11,
                        fontWeight:700, color:'var(--text-dim)', textTransform:'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMP_LIST.map(([idx, name, formula]) => (
                    <tr key={idx} style={
                      idx === 10 ? { background:'rgba(10,95,168,0.03)' } :
                      idx === 11 ? { background:'rgba(122,26,160,0.05)' } : {}
                    }>
                      <td style={{ padding:'2px 8px', fontWeight: idx <= 8 ? 600 : 500, fontSize:12 }}>
                        {name}
                      </td>
                      <td style={{ padding:'2px 8px', fontFamily:'var(--mono)', color:'var(--text-dim)', fontSize:11 }}>
                        {formula}
                      </td>
                      <td style={{ padding:'2px 4px' }}>
                        <input
                          type="number" step="0.01" min="0" max="100"
                          value={form.comp[idx] ?? '0'}
                          style={{ width:80 }}
                          onChange={e => setComp(idx, e.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                  <tr style={{ borderTop:'2px solid var(--accent)' }}>
                    <td colSpan={2} style={{ padding:'5px 8px', fontSize:11, textTransform:'uppercase', color:'var(--text-dim)' }}>
                      TOTAL
                    </td>
                    <td style={{ padding:'5px 8px', fontFamily:'var(--mono)', fontWeight:700,
                      color: totalOK ? 'var(--green)' : Math.abs(total-100) < 0.5 ? 'var(--accent)' : 'var(--red)' }}>
                      {total.toFixed(3)}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div style={{ display:'flex', gap:8, marginTop:10 }}>
                <button className="btn btn-secondary btn-sm" onClick={normalise}>Normalise to 100%</button>
                <button className="btn btn-danger btn-sm" onClick={clearComp}>Clear</button>
              </div>
            </div>
          </div>

          {/* Process conditions */}
          <div className="panel">
            <div className="panel-header">
              <div style={{ width:6,height:6,borderRadius:'50%',background:'var(--accent)' }} />
              <div className="panel-title">Process Conditions</div>
            </div>
            <div className="panel-body">
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                {[
                  { label:'Inlet Temperature', key:'T_in', unit:'°C' },
                  { label:'Outlet Temperature', key:'T_out', unit:'°C' },
                  { label:'Inlet Pressure', key:'P_in', unit:'kPa' },
                  { label:'Pressure Drop', key:'dP', unit:'kPa' },
                ].map(f_ => (
                  <div key={f_.key}>
                    <label className="field-label">{f_.label}</label>
                    <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                      <input type="number" value={form[f_.key as keyof Stage1FormState] as string}
                        onChange={e => setForm(f => ({ ...f, [f_.key]: e.target.value }))} />
                      <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text-dim)', whiteSpace:'nowrap', minWidth:40 }}>
                        {f_.unit}
                      </span>
                    </div>
                  </div>
                ))}
                <div>
                  <label className="field-label">Mass Flow Rate</label>
                  <div style={{ display:'flex', gap:4 }}>
                    <input type="number" value={form.mflow} style={{ flex:1 }}
                      onChange={e => setForm(f => ({ ...f, mflow: e.target.value }))} />
                    <select value={form.flowUnit} style={{ width:100 }}
                      onChange={e => setForm(f => ({ ...f, flowUnit: e.target.value as 'kgh'|'nm3h' }))}>
                      <option value="kgh">kg/hr</option>
                      <option value="nm3h">Nm³/hr</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="field-label">Duty Override (optional)</label>
                  <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                    <input type="number" value={form.dutyOverride} placeholder="Leave blank = auto"
                      onChange={e => setForm(f => ({ ...f, dutyOverride: e.target.value }))} />
                    <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text-dim)', whiteSpace:'nowrap', minWidth:40 }}>kW</span>
                  </div>
                </div>
              </div>

              <div style={{ margin:'12px 0', borderTop:'1px solid var(--border)', paddingTop:12 }}>
                <label className="field-label" style={{ marginBottom:8 }}>Design Basis Cp Method</label>
                <div style={{ display:'flex', flexWrap:'wrap', gap:0,
                  background:'var(--panel2)', border:'1px solid var(--border)', borderRadius:6, overflow:'hidden' }}>
                  {BASIS_OPTIONS.map(b => (
                    <button key={b.v}
                      style={{
                        fontFamily:'var(--mono)', fontSize:11, fontWeight:600,
                        padding:'7px 12px', border:'none', cursor:'pointer',
                        borderRight:'1px solid var(--border)',
                        color: form.basis === b.v ? '#fff' : 'var(--text-dim)',
                        background: form.basis === b.v
                          ? (b.v === '6' ? 'var(--accent)' : '#162438')
                          : 'transparent',
                        transition:'all 0.15s',
                      }}
                      onClick={() => setForm(f => ({ ...f, basis: b.v }))}
                    >{b.label}</button>
                  ))}
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:8 }}>
                <div>
                  <label className="field-label">Max Operating / Design Temperature</label>
                  <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                    <input type="number" value={form.T_design}
                      onChange={e => setForm(f => ({ ...f, T_design: e.target.value }))} />
                    <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text-dim)', whiteSpace:'nowrap' }}>°C</span>
                  </div>
                </div>
                <div>
                  <label className="field-label">Max Operating / Design Pressure</label>
                  <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                    <input type="number" value={form.P_design}
                      onChange={e => setForm(f => ({ ...f, P_design: e.target.value }))} />
                    <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text-dim)', whiteSpace:'nowrap' }}>kPa</span>
                  </div>
                </div>
              </div>

              <div style={{ marginTop:12, display:'flex', gap:8 }}>
                <button className="btn btn-primary" onClick={calculate} disabled={loading || !totalOK}>
                  {loading ? '⏳ Calculating…' : '▶ Calculate Gas Properties'}
                </button>
                {!totalOK && (
                  <span style={{ color:'var(--red)', fontSize:11, alignSelf:'center' }}>
                    Composition must sum to 100%
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN — RESULTS ── */}
        <div>
          {error && (
            <div className="alert alert-fail" style={{ marginBottom:12 }}>
              ❌ {error}
            </div>
          )}

          {validation && (
            <ValidationPanel
              messages={validation.messages ?? []}
              title="Engineering Checks"
            />
          )}

          {results ? (
            <>
              <div className="panel" style={{ marginBottom:12 }}>
                <div className="panel-header">
                  <div className="panel-title">Mixture Identification</div>
                </div>
                <div className="panel-body">
                  <ResultGrid cols={4}>
                    <ResultCard label="MW mix" value={results.MW} unit="g/mol" decimals={3} variant="highlight" />
                    <ResultCard label="Spec. Gravity (Air=1)" value={results.SG} decimals={4} variant="highlight" />
                    <ResultCard label="Pseudo-Tc" value={results.pc.Tc_pc} unit="K" decimals={1} />
                    <ResultCard label="Pseudo-Pc" value={results.pc.Pc_pc} unit="bar" decimals={2} />
                  </ResultGrid>

                  <ResultGrid cols={3}>
                    <ResultCard label="Process Duty Q" value={results.Q_final} unit="kW" decimals={1} variant="highlight" />
                    <ResultCard label="Mass Flow" value={results.mdot_kgs ? results.mdot_kgs * 3600 : undefined} unit="kg/hr" decimals={0} />
                    <ResultCard label="Hydrate T" value={results.hydrateT_C} unit="°C" decimals={1}
                      variant={results.T_out_C && results.hydrateT_C >= results.T_out_C ? 'red' : 'default'} />
                  </ResultGrid>
                </div>
              </div>

              <div className="panel" style={{ marginBottom:12 }}>
                <div className="panel-header">
                  <div className="panel-title">Transport Properties — All State Points</div>
                </div>
                <div className="panel-body" style={{ overflowX:'auto' }}>
                  <table className="res-table" style={{ minWidth:600, fontSize:11 }}>
                    <thead>
                      <tr>
                        <th>Property</th>
                        <th style={{ color:'#7a4500' }}>Inlet {f(results.T_in_C,1)}°C</th>
                        <th style={{ color:'#084d8a' }}>Outlet {f(results.T_out_C,1)}°C</th>
                        <th style={{ color:'#5a0e8a' }}>Design {f(results.T_des_C,1)}°C</th>
                        <th>Units</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label:'Z-Factor', key:'Z', dec:4, unit:'—' },
                        { label:'Density ρ', key:'rho', dec:3, unit:'kg/m³' },
                        { label:'Cp° Ideal Gas', key:'Cp0_kgK', dec:4, unit:'kJ/(kg·K)' },
                        { label:'Cp M5 Avg(M1+M2)', key:'Cp5_kgK', dec:4, unit:'kJ/(kg·K)' },
                        { label:'Cp M6 ΔH Full', key:'Cp6_kgK', dec:4, unit:'kJ/(kg·K)' },
                        { label:'Viscosity μ', key:'mu', dec:6, unit:'Pa·s' },
                        { label:'Thermal Cond. k', key:'k', dec:4, unit:'W/(m·K)' },
                        { label:'Prandtl Pr', key:'Pr', dec:3, unit:'—' },
                      ].map(row => (
                        <tr key={row.key}>
                          <td>{row.label}</td>
                          <td className="val">{f((results.ST_in as unknown as Record<string,number>)[row.key], row.dec)}</td>
                          <td className="val2">{f((results.ST_out as unknown as Record<string,number>)[row.key], row.dec)}</td>
                          <td style={{ color:'#5a0e8a', fontWeight:600 }}>{f((results.ST_des as unknown as Record<string,number>)[row.key], row.dec)}</td>
                          <td style={{ color:'var(--text-dim)', fontSize:10 }}>{row.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {results.heatingValues && (
                <div className="panel">
                  <div className="panel-header">
                    <div className="panel-title" style={{ color:'var(--blue)' }}>Heating Values</div>
                  </div>
                  <div className="panel-body">
                    <ResultGrid cols={2}>
                      <ResultCard label="HHV" value={results.heatingValues.HHV_kJkg} unit="kJ/kg" decimals={0} />
                      <ResultCard label="LHV" value={results.heatingValues.LHV_kJkg} unit="kJ/kg" decimals={0} />
                    </ResultGrid>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="panel">
              <div className="panel-body">
                <div style={{ color:'var(--text-dim)', padding:'20px 0', textAlign:'center' }}>
                  Enter composition and conditions, then click Calculate.
                </div>
                <div className="note-box" style={{ marginTop:8 }}>
                  <strong>PR-EOS 1976</strong> with GPSA §9 binary interaction parameters (GPSA BIPs).
                  M5 Avg(M1+M2) recommended for P &lt; 50 barg.
                  Use <strong>M6 ΔH Full</strong> for high-pressure services (matches HYSYS/Aspen ±0.5%).
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
