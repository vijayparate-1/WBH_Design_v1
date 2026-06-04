'use client';
// src/components/modules/SourGasTab.tsx
// Sour Gas Assessment — NACE MR0175 / ISO 15156, AS 4041 Sour Service

import { useState } from 'react';
import { ResultCard, ResultGrid } from '@/components/ui/ResultCard';

interface SourInputs {
  h2s_molPct: string;
  co2_molPct: string;
  P_kPa: string;
  T_C: string;
  pH: string;
  material: string;
}

const MATERIALS = [
  { id:'a106b',      label:'ASTM A106 Gr B — Carbon Steel (standard)',         maxH2S:0.3,  nace:'Not suitable sour' },
  { id:'a333g6',     label:'ASTM A333 Gr 6 — Low-Temp Carbon Steel',           maxH2S:0.3,  nace:'Not suitable sour' },
  { id:'a312tp316l', label:'ASTM A312 TP316L — 316L Stainless Steel',          maxH2S:50.0, nace:'Suitable with limits' },
  { id:'api5l_x65',  label:'API 5L X65 — High-Strength Line Pipe (NACE cert)', maxH2S:1.0,  nace:'HIC tested required' },
  { id:'duplex_2205',label:'Duplex 2205 (UNS S31803) — Sour rated',            maxH2S:100.0,nace:'NACE MR0175 compliant' },
  { id:'inconel_625',label:'Inconel 625 — Severe sour applications',           maxH2S:100.0,nace:'NACE MR0175 compliant' },
];

export default function SourGasTab() {
  const [form, setForm] = useState<SourInputs>({
    h2s_molPct:'3.5', co2_molPct:'5.0', P_kPa:'7000',
    T_C:'40', pH:'6.5', material:'a106b',
  });
  const [calc, setCalc] = useState<ReturnType<typeof calcSour> | null>(null);

  const set = (k: keyof SourInputs) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  function calcSour(f: SourInputs) {
    const h2s = parseFloat(f.h2s_molPct);
    const co2 = parseFloat(f.co2_molPct);
    const P = parseFloat(f.P_kPa);
    const T = parseFloat(f.T_C);
    const pH_val = parseFloat(f.pH);

    const pH2S_kPa = h2s / 100 * P;
    const pCO2_kPa = co2 / 100 * P;
    const pH2S_psi = pH2S_kPa * 0.14504;
    const pCO2_psi = pCO2_kPa * 0.14504;

    // NACE MR0175 Region assessment (simplified)
    const sourByNACE = pH2S_kPa > 0.3;  // 0.3 kPa = 0.0435 psi threshold
    const sourSevere = pH2S_kPa > 10;   // 10 kPa threshold for severe
    const sourExtreme = pH2S_kPa > 100; // 100 kPa extreme

    // EFC-16 (European) alternative threshold: H2S > 1 ppm or partial P > 0.05 psi
    const sourByEFC = pH2S_psi > 0.05;

    // CO2 corrosion risk (de Waard-Milliams, rough)
    const pCO2_bar = pCO2_kPa / 100;
    const co2_corr_rate_mpy = 0.5 * Math.pow(pCO2_bar, 0.67) * Math.exp(1710/(273+T) - 1710/363);

    // SSC risk index (HRC Brinell check placeholder)
    const sscRisk = sourByNACE && T < 60 ? 'High' : sourByNACE ? 'Moderate' : 'Low';

    // HIC risk: typically at pH < 6 and pH2S > 0.3 kPa
    const hicRisk = sourByNACE && pH_val < 6.5 ? 'High — HIC test required (NACE TM0284)' :
                    sourByNACE ? 'Moderate — HIC test recommended' : 'Low';

    const matSelected = MATERIALS.find(m => m.id === f.material) ?? MATERIALS[0];
    const matOK = pH2S_kPa <= matSelected.maxH2S;

    return {
      pH2S_kPa, pCO2_kPa, pH2S_psi, pCO2_psi,
      sourByNACE, sourSevere, sourExtreme, sourByEFC,
      co2_corr_rate_mpy, sscRisk, hicRisk,
      matOK, matSelected,
    };
  }

  const run = () => setCalc(calcSour(form));
  const r = calc;

  return (
    <div style={{ display:'grid', gridTemplateColumns:'400px 1fr', gap:16 }}>
      {/* INPUTS */}
      <div>
        <div className="panel" style={{ marginBottom:12 }}>
          <div className="panel-header">
            <div style={{ width:6, height:6, borderRadius:'50%', background:'var(--sour)' }} />
            <div className="panel-title" style={{ color:'var(--sour)' }}>Sour Gas Conditions</div>
          </div>
          <div className="panel-body">
            <div style={{ display:'grid', gap:10 }}>
              {[
                { k:'h2s_molPct', label:'H₂S Concentration', unit:'mol%' },
                { k:'co2_molPct', label:'CO₂ Concentration', unit:'mol%' },
                { k:'P_kPa',     label:'Operating Pressure', unit:'kPa' },
                { k:'T_C',       label:'Operating Temperature', unit:'°C' },
                { k:'pH',        label:'Water Phase pH (if condensed water present)', unit:'—' },
              ].map(fi => (
                <div key={fi.k}>
                  <label className="field-label">{fi.label}</label>
                  <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                    <input type="number" step="0.01" value={form[fi.k as keyof SourInputs]}
                      onChange={set(fi.k as keyof SourInputs)} />
                    <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text-dim)', whiteSpace:'nowrap' }}>{fi.unit}</span>
                  </div>
                </div>
              ))}
              <div>
                <label className="field-label">Wetted Material (proposed)</label>
                <select value={form.material} onChange={set('material')}>
                  {MATERIALS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </div>
              <button className="btn btn-primary" style={{ marginTop:4 }} onClick={run}>
                ▶ Assess Sour Service
              </button>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header"><div className="panel-title">Standards Reference</div></div>
          <div className="panel-body" style={{ fontSize:11, lineHeight:1.8 }}>
            <div><strong>NACE MR0175 / ISO 15156:</strong> H₂S partial pressure &gt; 0.3 kPa triggers sour service requirements for all wetted carbon steel.</div>
            <div style={{ marginTop:6 }}><strong>EFC-16:</strong> More conservative — H₂S partial pressure &gt; 0.05 psi (0.34 kPa) or &gt; 1 ppm mole fraction.</div>
            <div style={{ marginTop:6 }}><strong>AS 4041-2006:</strong> References NACE MR0175 for sour service piping in Australia.</div>
            <div style={{ marginTop:6 }}><strong>HIC (NACE TM0284):</strong> Hydrogen-Induced Cracking test required for plate material at sustained sour exposure.</div>
            <div style={{ marginTop:6 }}><strong>SSC:</strong> Sulphide Stress Cracking — most critical at T &lt; 60°C, high H₂S, low pH. Hardness limit HRC ≤22 (NACE MR0175 §4).</div>
          </div>
        </div>
      </div>

      {/* RESULTS */}
      <div>
        {r ? (
          <>
            {/* Sour classification banner */}
            <div className={`alert ${r.sourByNACE ? (r.sourSevere ? 'alert-fail' : 'alert-warn') : 'alert-ok'}`}
              style={{ marginBottom:12, fontSize:13 }}>
              {r.sourByNACE
                ? `☠ SOUR SERVICE — H₂S partial pressure ${r.pH2S_kPa.toFixed(3)} kPa (${r.pH2S_psi.toFixed(4)} psi) EXCEEDS NACE MR0175 threshold (0.3 kPa). All wetted materials must comply with NACE MR0175 / ISO 15156.`
                : `✔ SWEET SERVICE — H₂S partial pressure ${r.pH2S_kPa.toFixed(4)} kPa (${r.pH2S_psi.toFixed(5)} psi) is below NACE MR0175 threshold.`}
            </div>

            {/* Partial pressures */}
            <div className="panel" style={{ marginBottom:12 }}>
              <div className="panel-header"><div className="panel-title">Partial Pressure Assessment</div></div>
              <div className="panel-body">
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:8, marginBottom:10 }}>
                  <ResultCard label="H₂S Partial P" value={r.pH2S_kPa} unit="kPa" decimals={4}
                    variant={r.sourByNACE ? 'red' : 'green'} />
                  <ResultCard label="H₂S Partial P" value={r.pH2S_psi} unit="psi" decimals={5}
                    variant={r.sourByNACE ? 'red' : 'green'} />
                  <ResultCard label="CO₂ Partial P" value={r.pCO2_kPa} unit="kPa" decimals={1}
                    variant={r.pCO2_kPa > 200 ? 'red' : r.pCO2_kPa > 50 ? 'highlight' : 'default'} />
                  <ResultCard label="CO₂ Partial P" value={r.pCO2_psi} unit="psi" decimals={2} />
                </div>
                <table className="res-table" style={{ fontSize:11 }}>
                  <thead><tr><th>Check</th><th>Result</th><th>Threshold</th><th>Standard</th></tr></thead>
                  <tbody>
                    <tr>
                      <td>NACE MR0175 sour</td>
                      <td style={{ color: r.sourByNACE ? 'var(--red)' : 'var(--green)', fontWeight:700 }}>
                        {r.sourByNACE ? '✘ SOUR' : '✔ SWEET'}</td>
                      <td style={{ fontFamily:'var(--mono)' }}>0.3 kPa</td>
                      <td style={{ fontSize:10 }}>NACE MR0175 §1</td>
                    </tr>
                    <tr>
                      <td>EFC-16 sour</td>
                      <td style={{ color: r.sourByEFC ? 'var(--accent)' : 'var(--green)', fontWeight:700 }}>
                        {r.sourByEFC ? '⚠ Sour (EFC)' : '✔ Sweet'}</td>
                      <td style={{ fontFamily:'var(--mono)' }}>0.05 psi</td>
                      <td style={{ fontSize:10 }}>EFC-16 §2.2</td>
                    </tr>
                    <tr>
                      <td>H₂S severity</td>
                      <td style={{ fontFamily:'var(--mono)', fontWeight:700 }}>
                        {r.sourExtreme ? 'EXTREME' : r.sourSevere ? 'SEVERE' : r.sourByNACE ? 'MILD-MODERATE' : 'N/A'}</td>
                      <td style={{ fontFamily:'var(--mono)' }}>&gt;100 / &gt;10 / &gt;0.3 kPa</td>
                      <td style={{ fontSize:10 }}>NACE MR0175 §4</td>
                    </tr>
                    <tr>
                      <td>SSC risk</td>
                      <td style={{ color: r.sscRisk === 'High' ? 'var(--red)' : 'var(--text-dim)', fontWeight:700 }}>{r.sscRisk}</td>
                      <td style={{ fontFamily:'var(--mono)' }}>T&lt;60°C, H₂S&gt;0.3kPa</td>
                      <td style={{ fontSize:10 }}>NACE MR0175 §4.2</td>
                    </tr>
                    <tr>
                      <td>HIC risk</td>
                      <td style={{ color: r.hicRisk.includes('High') ? 'var(--red)' : 'var(--text-dim)' }}>{r.hicRisk}</td>
                      <td style={{ fontFamily:'var(--mono)' }}>pH&lt;6.5, H₂S&gt;0.3kPa</td>
                      <td style={{ fontSize:10 }}>NACE TM0284</td>
                    </tr>
                    <tr>
                      <td>CO₂ corrosion risk</td>
                      <td style={{ fontFamily:'var(--mono)', color: r.co2_corr_rate_mpy > 10 ? 'var(--red)' : 'var(--text-dim)' }}>
                        ~{r.co2_corr_rate_mpy.toFixed(2)} mpy</td>
                      <td style={{ fontFamily:'var(--mono)' }}>&gt;10 mpy = high risk</td>
                      <td style={{ fontSize:10 }}>de Waard-Milliams</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Material check */}
            <div className="panel">
              <div className="panel-header"><div className="panel-title">Material Suitability</div></div>
              <div className="panel-body">
                <div className={`alert ${r.matOK ? 'alert-ok' : 'alert-fail'}`}>
                  {r.matOK
                    ? `✔ ${r.matSelected.label} — suitable for these conditions`
                    : `✘ ${r.matSelected.label} — NOT suitable. Max H₂S partial pressure: ${r.matSelected.maxH2S} kPa. Actual: ${r.pH2S_kPa.toFixed(3)} kPa. Upgrade material.`}
                </div>
                <div style={{ marginTop:10, fontSize:11 }}>
                  <strong>NACE status:</strong> {r.matSelected.nace}
                </div>
                {r.sourByNACE && (
                  <div className="note-box" style={{ marginTop:10 }}>
                    <strong>Action required for sour service:</strong>
                    <ul style={{ margin:'6px 0 0 16px', lineHeight:1.8 }}>
                      <li>All wetted CS/LTCS to be NACE MR0175 certified with hardness ≤ HRC 22</li>
                      <li>Plate material: HIC test per NACE TM0284</li>
                      <li>Weld procedure: PWHT required per NACE MR0175 §3.3</li>
                      <li>Flanges: ASTM A105 with HV hardness ≤ 250</li>
                      <li>Valves: API 6D sour trim per NACE MR0175 §4.2</li>
                      <li>Instruments: Wetted parts NACE certified</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="panel">
            <div className="panel-body" style={{ color:'var(--text-dim)', padding:20 }}>
              Enter conditions and click Assess to perform NACE MR0175 sour service evaluation.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
