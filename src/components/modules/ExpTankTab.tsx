'use client';
// src/components/modules/ExpTankTab.tsx

import { useState } from 'react';
import { ResultCard, ResultGrid } from '@/components/ui/ResultCard';
import type { Stage2Results } from '@/lib/calculations/heater-sizing';

interface Props { s2Results?: Stage2Results; }

export default function ExpTankTab({ s2Results }: Props) {
  const [form, setForm] = useState({
    bathVolume: s2Results?.bath_volume_L?.toFixed(0) ?? '3000',
    glycolPct: '30',
    T_operating: '65',
    T_ambient: '5',
    T_design: '90',
    T_min_ambient: '-10',
  });
  const [result, setResult] = useState<Record<string, number | string> | null>(null);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const syncFromS2 = () => {
    if (!s2Results) return;
    setForm(f => ({ ...f, bathVolume: s2Results.bath_volume_L.toFixed(0) }));
  };

  // Kell (1975) water + Dow MEG blend
  const getGlycolDensity = (T: number, pct: number) => {
    const rho_water = 999.83 + 0.0559 * T - 0.00367 * T ** 2 - 2.68e-6 * T ** 3;
    const rho_meg = 1115.6 - 0.7313 * T - 0.00060 * T ** 2;
    const x = pct / 100;
    return rho_water * (1 - x) + rho_meg * x;
  };

  const calculate = () => {
    const bathVol = parseFloat(form.bathVolume);
    const glycol = parseFloat(form.glycolPct);
    const T_op = parseFloat(form.T_operating);
    const T_amb = parseFloat(form.T_ambient);
    const T_min = parseFloat(form.T_min_ambient);
    const T_des = parseFloat(form.T_design);

    const rho_cold = getGlycolDensity(T_amb, glycol);
    const rho_hot  = getGlycolDensity(T_op,  glycol);
    const rho_min  = getGlycolDensity(T_min, glycol);

    const expansion_L = bathVol * (rho_min / rho_hot - 1);
    const tank_net = Math.max(expansion_L * 1.25, bathVol * 0.05);
    const tank_total = tank_net * 1.2 + 10;

    // Glycol freeze point (approx, MEG-water)
    const freeze_T = -(0.54 * glycol + 0.003 * glycol ** 2);

    // Burst protection (vent sizing EN 13831 / AS 1274)
    const vent_dn = tank_total < 200 ? 'DN25' : 'DN40';
    const relief_kPa = 150; // typical atmospheric expansion vessel operating P

    // Tank dimension options
    const dims = tank_total < 80 ? '500×500×340mm' :
                 tank_total < 200 ? '600×600×560mm' :
                 tank_total < 500 ? '900×900×700mm' : '1200×1000×850mm';

    setResult({
      rho_cold: rho_cold.toFixed(2),
      rho_hot: rho_hot.toFixed(2),
      rho_min: rho_min.toFixed(2),
      expansion_L: expansion_L.toFixed(1),
      tank_net: tank_net.toFixed(1),
      tank_total: tank_total.toFixed(1),
      freeze_T: freeze_T.toFixed(1),
      dims,
      vent_dn,
      safety_factor: (tank_total / expansion_L).toFixed(2),
    });
  };

  const r = result;

  return (
    <div style={{ display:'grid', gridTemplateColumns:'380px 1fr', gap:16 }}>
      <div>
        <div className="panel">
          <div className="panel-header">
            <div style={{ width:6, height:6, borderRadius:'50%', background:'var(--accent)' }} />
            <div className="panel-title">Expansion Tank Design Inputs</div>
          </div>
          <div className="panel-body">
            {s2Results && (
              <button className="btn btn-secondary btn-sm" style={{ marginBottom:12 }} onClick={syncFromS2}>
                ← Sync bath volume from Stage 2 ({s2Results.bath_volume_L.toFixed(0)} L)
              </button>
            )}
            <div style={{ display:'grid', gap:10 }}>
              {[
                { k:'bathVolume',   label:'Bath Volume', unit:'L' },
                { k:'glycolPct',    label:'MEG Concentration (by volume)', unit:'%' },
                { k:'T_operating',  label:'Operating Bath Temperature', unit:'°C' },
                { k:'T_ambient',    label:'Ambient Temperature (design)', unit:'°C' },
                { k:'T_min_ambient',label:'Min. Ambient (cold climate)', unit:'°C' },
                { k:'T_design',     label:'Design Temperature', unit:'°C' },
              ].map(fi => (
                <div key={fi.k}>
                  <label className="field-label">{fi.label}</label>
                  <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                    <input type="number" value={form[fi.k as keyof typeof form]} onChange={set(fi.k)} />
                    <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text-dim)', whiteSpace:'nowrap' }}>{fi.unit}</span>
                  </div>
                </div>
              ))}
              <button className="btn btn-primary" style={{ marginTop:4 }} onClick={calculate}>
                ▶ Size Expansion Tank
              </button>
            </div>
          </div>
        </div>
      </div>

      <div>
        {r ? (
          <>
            <div className="panel" style={{ marginBottom:12 }}>
              <div className="panel-header"><div className="panel-title">Expansion Tank Sizing Results</div></div>
              <div className="panel-body">
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:12 }}>
                  <ResultCard label="Net Expansion Vol." value={parseFloat(r.expansion_L as string)} unit="L" decimals={1} variant="highlight" />
                  <ResultCard label="Tank Net Vol." value={parseFloat(r.tank_net as string)} unit="L" decimals={1} />
                  <ResultCard label="Tank Total Vol." value={parseFloat(r.tank_total as string)} unit="L" decimals={1} variant="highlight" />
                  <ResultCard label="Safety Factor" value={parseFloat(r.safety_factor as string)} decimals={2}
                    variant={parseFloat(r.safety_factor as string) >= 1.5 ? 'green' : 'red'} />
                  <ResultCard label="Freeze Point (MEG mix)" value={parseFloat(r.freeze_T as string)} unit="°C" decimals={1}
                    variant={parseFloat(r.freeze_T as string) < parseFloat(form.T_min_ambient) ? 'red' : 'green'} />
                  <ResultCard label="Vent Size" value={r.vent_dn as string} />
                </div>

                <table className="res-table" style={{ fontSize:11 }}>
                  <thead><tr><th>Parameter</th><th>Value</th><th>Unit</th><th>Note</th></tr></thead>
                  <tbody>
                    <tr><td>Bath fluid density (cold {form.T_ambient}°C)</td>
                      <td className="val">{r.rho_cold}</td><td>kg/m³</td><td style={{ fontSize:10 }}>Kell+Dow MEG</td></tr>
                    <tr><td>Bath fluid density (hot {form.T_operating}°C)</td>
                      <td className="val">{r.rho_hot}</td><td>kg/m³</td><td style={{ fontSize:10 }}></td></tr>
                    <tr><td>Bath fluid density (min ambient {form.T_min_ambient}°C)</td>
                      <td className="val">{r.rho_min}</td><td>kg/m³</td><td style={{ fontSize:10 }}>Worst-case fill</td></tr>
                    <tr><td>Tank dimensions (indicative)</td>
                      <td colSpan={2} style={{ fontFamily:'var(--mono)' }}>{r.dims}</td><td style={{ fontSize:10 }}>Check as built</td></tr>
                    <tr><td>Vent / overflow line</td>
                      <td style={{ fontFamily:'var(--mono)' }}>{r.vent_dn}</td><td></td><td style={{ fontSize:10 }}>AS 1274</td></tr>
                    <tr><td>Freeze margin ({form.glycolPct}% MEG)</td>
                      <td className="val" style={{ color: parseFloat(r.freeze_T as string) < parseFloat(form.T_min_ambient) ? 'var(--red)' : 'var(--green)' }}>
                        {r.freeze_T}°C</td><td>°C</td>
                      <td style={{ fontSize:10, color: parseFloat(r.freeze_T as string) < parseFloat(form.T_min_ambient) ? 'var(--red)' : 'var(--green)' }}>
                        {parseFloat(r.freeze_T as string) < parseFloat(form.T_min_ambient) ? '✘ INCREASE MEG%' : '✔ OK'}
                      </td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            {parseFloat(r.freeze_T as string) >= parseFloat(form.T_min_ambient) && (
              <div className="alert alert-fail">
                ⚠ MEG freeze point {r.freeze_T}°C is above minimum ambient {form.T_min_ambient}°C.
                Increase MEG concentration or add trace heating.
                Guideline: 30% MEG → −17°C, 40% MEG → −24°C, 50% MEG → −34°C.
              </div>
            )}

            <div className="panel">
              <div className="panel-header"><div className="panel-title">MEG Concentration Guide</div></div>
              <div className="panel-body">
                <table className="res-table" style={{ fontSize:11 }}>
                  <thead><tr><th>MEG %</th><th>Freeze Point</th><th>ρ @ 20°C</th><th>ρ @ 70°C</th><th>Typical Use</th></tr></thead>
                  <tbody>
                    {[10,20,30,40,50].map(pct => {
                      const fp = -(0.54*pct + 0.003*pct**2);
                      const rho20 = getGlycolDensity(20, pct);
                      const rho70 = getGlycolDensity(70, pct);
                      const isCurr = Math.abs(pct - parseFloat(form.glycolPct)) < 5;
                      return (
                        <tr key={pct} style={{ background: isCurr ? 'rgba(176,96,0,0.06)' : undefined }}>
                          <td style={{ fontWeight: isCurr ? 700 : 400 }}>{pct}% {isCurr ? '◄' : ''}</td>
                          <td className="val">{fp.toFixed(1)}°C</td>
                          <td style={{ fontFamily:'var(--mono)', fontSize:11 }}>{rho20.toFixed(1)}</td>
                          <td style={{ fontFamily:'var(--mono)', fontSize:11 }}>{rho70.toFixed(1)}</td>
                          <td style={{ fontSize:10, color:'var(--text-dim)' }}>
                            {pct <= 20 ? 'Mild climates (AUS coastal)' :
                             pct <= 30 ? 'Temperate (SE AUS, NZ)' :
                             pct <= 40 ? 'Cold (inland AUS, ME nights)' : 'Sub-zero (SEA highlands)'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="panel">
            <div className="panel-body" style={{ color:'var(--text-dim)', padding:20 }}>
              Enter bath parameters and click Size Expansion Tank.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
